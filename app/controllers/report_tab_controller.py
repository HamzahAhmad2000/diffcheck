# app/controllers/report_tab_controller.py
from flask import current_app, jsonify
from sqlalchemy import func, case
from sqlalchemy.orm import joinedload, aliased
from app.models import (
    Survey, Question, Submission, Response, ReportSetting,
    User, SurveyLink, db # Keep User import if needed for data processing
)
from .response_controller import ResponseController
from datetime import datetime, date
from collections import Counter, defaultdict
import json
import statistics
import re
import openpyxl # Ensure openpyxl is installed: pip install openpyxl
from io import BytesIO
from .response_controller import (
    process_star_rating_grid_responses, # Keep if used internally by process_grid_responses_for_analytics
    process_radio_grid_responses,       # Keep if used internally by process_grid_responses_for_analytics
    process_checkbox_grid_responses,    # Keep if used internally by process_grid_responses_for_analytics
    calculate_grid_averages             # Keep if used internally by process_grid_responses_for_analytics
)
# --- Helper Functions ---

def _parse_iso_date_str(date_string):
    """Safely parse ISO date string (YYYY-MM-DD), returning datetime or None."""
    if not date_string or not isinstance(date_string, str):
        return None
    try:
        return datetime.combine(date.fromisoformat(date_string), datetime.min.time())
    except ValueError:
        current_app.logger.warning(f"Invalid date format for filter: {date_string}")
        return None

def _apply_filters_to_query(query, filters):
    """Applies various filters to a SQLAlchemy Submission query."""
    if not filters or not isinstance(filters, dict):
        return query

    # Demographic Filters
    if filters.get("age_group") and isinstance(filters["age_group"], list):
        query = query.filter(Submission.age_group.in_(filters["age_group"]))
    if filters.get("location"):
        loc_val = filters["location"]
        if isinstance(loc_val, list): query = query.filter(Submission.location.in_(loc_val))
        elif isinstance(loc_val, str): query = query.filter(Submission.location == loc_val)
    if filters.get("education"):
        edu_val = filters["education"]
        if isinstance(edu_val, list): query = query.filter(Submission.education.in_(edu_val))
        elif isinstance(edu_val, str): query = query.filter(Submission.education == edu_val)
    if filters.get("company"):
        comp_val = filters["company"]
        if isinstance(comp_val, list): query = query.filter(Submission.company.in_(comp_val))
        elif isinstance(comp_val, str): query = query.filter(Submission.company == comp_val)
    if filters.get("gender"):
        gender_val = filters["gender"]
        if isinstance(gender_val, list): query = query.filter(Submission.gender.in_(gender_val))
        elif isinstance(gender_val, str): query = query.filter(Submission.gender == gender_val)
    if filters.get("cohort_tag"):
        cohort_val = filters["cohort_tag"]
        if isinstance(cohort_val, list): query = query.filter(Submission.cohort_tag.in_(cohort_val))
        elif isinstance(cohort_val, str): query = query.filter(Submission.cohort_tag == cohort_val)

    # Date Filters
    start_date = _parse_iso_date_str(filters.get("startDate"))
    end_date = _parse_iso_date_str(filters.get("endDate"))
    # Adjust end_date to include the whole day
    if end_date:
        end_date = end_date + datetime.timedelta(days=1, microseconds=-1)

    if start_date:
        query = query.filter(Submission.submitted_at >= start_date)
    if end_date:
        query = query.filter(Submission.submitted_at <= end_date)

    return query

def _calculate_summary_metrics(submissions):
    """Calculates summary metrics for a list of submissions."""
    if not submissions:
        return {"total_responses": 0, "average_duration": 0, "completion_rate": 0}

    total_responses = len(submissions)
    valid_durations = [s.duration for s in submissions if s.duration and s.duration > 0]
    avg_duration = round(sum(valid_durations) / len(valid_durations), 1) if valid_durations else 0
    completed_count = sum(1 for s in submissions if s.is_complete)
    completion_rate = round((completed_count / total_responses) * 100, 1) if total_responses else 0

    return {
        "total_responses": total_responses,
        "average_duration": avg_duration,
        "completion_rate": completion_rate
    }

def _calculate_demographics(submissions):
    """Calculates demographic breakdown for a list of submissions."""
    if not submissions:
        return {}

    total_count = len(submissions)
    demographics = defaultdict(lambda: defaultdict(int))
    categories = ['age_group', 'gender', 'location', 'education', 'company', 'cohort_tag']

    for sub in submissions:
        for category in categories:
            value = getattr(sub, category, None) or "Unknown"
            demographics[category][value] += 1

    demo_results = {}
    for category, counts in demographics.items():
        cat_results = {}
        if "Unknown" in counts and counts["Unknown"] == 0:
            del counts["Unknown"]

        for key, count in counts.items():
            percentage = round((count / total_count) * 100, 1) if total_count else 0
            cat_results[key] = {"count": count, "percentage": percentage}

        sorted_keys = sorted(k for k in cat_results if k != "Unknown")
        if "Unknown" in cat_results: sorted_keys.append("Unknown")
        demo_results[category + 's'] = {k: cat_results[k] for k in sorted_keys}

    return demo_results

def _process_single_question_analytics(question, filtered_responses):
    """
    Calculates detailed analytics for one question based on filtered responses.
    Handles all specified question types and N/A options.
    Returns a dictionary containing the analytics results.
    """
    qtype = question.question_type
    response_count = len(filtered_responses)
    na_option_text = question.not_applicable_text or "Not Applicable"
    analytics = {} # Initialize analytics dict
    analytics['response_count'] = response_count # Add overall filtered count

    # --- N/A Handling (Count first) ---
    na_count = 0
    valid_responses = [] # Responses that are not marked as N/A
    for r in filtered_responses:
        if r.is_not_applicable:
            na_count += 1
        else:
            # Further check if text content itself signifies N/A
            parsed_val = ResponseController.parse_answer(r.response_text)
            if isinstance(parsed_val, str) and parsed_val.strip().lower() == na_option_text.strip().lower():
                 na_count += 1
            else:
                 valid_responses.append(r)

    count_valid = len(valid_responses)
    total_responses_considered = count_valid + na_count

    # --- Analytics based on Question Type ---

    # Single Choice / Dropdown / Scale
    if qtype in ["multiple-choice", "dropdown", "single-choice", "scale"]:
        option_counts = Counter()
        # Determine the source of options/labels
        if qtype == 'scale' and question.scale_points: option_source = question.scale_points; is_simple_list = True
        elif question.options: option_source = question.options; is_simple_list = not all(isinstance(opt, dict) for opt in option_source)
        else: option_source = []; is_simple_list = True

        # Count valid responses
        for r in valid_responses:
            val = ResponseController.parse_answer(r.response_text); val_str = str(val)
            option_counts[val_str] += 1

        # Add N/A count if applicable
        if question.not_applicable and na_count > 0:
             option_counts[na_option_text] += na_count

        # *** FIXED: Calculate total_valid_opts *after* counting ***
        total_valid_opts = count_valid # Total used for percentage is based on valid responses only for single choice/scale

        distribution = []
        defined_labels = set()

        # Ensure all defined options/scale points are included
        if is_simple_list:
            for item in option_source:
                 label = str(item); defined_labels.add(label)
                 count = option_counts.get(label, 0)
                 perc = round((count / total_valid_opts * 100), 1) if total_valid_opts > 0 else 0
                 distribution.append({"option": label, "count": count, "percentage": perc})
        else: # List of dicts
            for item_dict in option_source:
                 label = str(item_dict.get('text','')); defined_labels.add(label)
                 count = option_counts.get(label, 0)
                 perc = round((count / total_valid_opts * 100), 1) if total_valid_opts > 0 else 0
                 distribution.append({"option": label, "count": count, "percentage": perc})

        # Add counted options not in definition
        for counted_label, count in option_counts.items():
            if counted_label not in defined_labels and counted_label != na_option_text:
                perc = round((count / total_valid_opts * 100), 1) if total_valid_opts > 0 else 0
                distribution.append({"option": counted_label, "count": count, "percentage": perc})

        # Add N/A if counted and show_na enabled (its count was added earlier)
        if question.not_applicable and na_count > 0:
             # N/A percentage relative to total considered (valid + NA)
            na_perc = round((na_count / total_responses_considered * 100), 1) if total_responses_considered > 0 else 0
            # Find if N/A is already in the distribution list and update percentage, otherwise add it.
            na_entry = next((d for d in distribution if d['option'] == na_option_text), None)
            if na_entry:
                na_entry['percentage'] = na_perc # Update percentage
            elif na_option_text not in defined_labels: # Add only if not defined and not already added
                 distribution.append({"option": na_option_text, "count": na_count, "percentage": na_perc})


        # Sort distribution
        if qtype == 'scale' and question.scale_points:
             scale_order_map = {point: i for i, point in enumerate(question.scale_points)}; distribution.sort(key=lambda x: scale_order_map.get(x['option'], float('inf')))
        else: distribution.sort(key=lambda x: x["count"], reverse=True)

        analytics = {
            "type": "single_select_distribution",
            "options_distribution": distribution,
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered
        }

    # Checkbox / Multi-Choice
    elif qtype in ['checkbox', 'multi-choice']:
        option_counts = Counter(); co_occurrence = Counter()
        # Count valid responses
        for r in valid_responses:
            val = ResponseController.parse_answer(r.response_text)
            current_selection = [str(item) for item in val] if isinstance(val, list) else ([str(val)] if val is not None else [])
            for item_str in current_selection: option_counts[item_str] += 1
            sorted_items = sorted(current_selection);
            for i in range(len(sorted_items)):
                for j in range(i + 1, len(sorted_items)): co_occurrence[(sorted_items[i], sorted_items[j])] += 1

        # Add N/A count if applicable
        if question.not_applicable and na_count > 0: option_counts[na_option_text] += na_count

        total_selections = sum(option_counts.values())
        distribution = []
        defined_options_texts = set()
        if question.options and isinstance(question.options, list):
            for opt in question.options: label = str(opt.get('text')) if isinstance(opt, dict) else str(opt); defined_options_texts.add(label)

        # Ensure all defined options are included
        for opt_text in defined_options_texts:
             cnt = option_counts.get(opt_text, 0)
             perc_resp = round(cnt * 100.0 / count_valid, 1) if count_valid else 0
             perc_sel = round(cnt * 100.0 / total_selections, 1) if total_selections else 0
             distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

        # Add other counted options
        for opt_text, cnt in option_counts.items():
            if opt_text not in defined_options_texts and opt_text != na_option_text:
                perc_resp = round(cnt * 100.0 / count_valid, 1) if count_valid else 0
                perc_sel = round(cnt * 100.0 / total_selections, 1) if total_selections else 0
                distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

        # Add N/A if counted and not already included
        if question.not_applicable and na_count > 0:
            # N/A percentage relative to total responses considered
            na_perc_resp = round(na_count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0
            # N/A percentage relative to total selections (might be less intuitive)
            na_perc_sel = round(na_count * 100.0 / total_selections, 1) if total_selections else 0
            if not any(d['option'] == na_option_text for d in distribution):
                distribution.append({ "option": na_option_text, "count": na_count, "percentage_of_responses": na_perc_resp, "percentage_of_selections": na_perc_sel })


        distribution.sort(key=lambda x: x["count"], reverse=True)
        co_occurrence_list = [{"pair": list(pair), "count": ccount} for pair, ccount in co_occurrence.items()]
        co_occurrence_list.sort(key=lambda x: x["count"], reverse=True)
        analytics = {
            "type": "multi_select_distribution",
            "option_distribution": distribution,
            "top_co_occurrences": co_occurrence_list[:15],
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered
        }

    # Rating (Slider)
    elif qtype == "rating":
        analytics = ResponseController.process_slider_analytics(question, valid_responses) # Use VALID responses
        analytics["count_na"] = na_count # Add back NA count
        analytics["total_responses_considered"] = count_valid + na_count # Recalculate total

    # Standalone Star Rating
    elif qtype == "star-rating":
        numeric_values = []
        for r in valid_responses: # Use VALID responses
            try: numeric_values.append(float(ResponseController.parse_answer(r.response_text)))
            except (ValueError, TypeError): continue

        stats_data = {"type": "star-rating", "count_valid": count_valid, "count_na": na_count, "total_responses_considered": total_responses_considered, "mean": None, "distribution": []}
        if numeric_values:
            stats_data["mean"] = round(statistics.mean(numeric_values), 2)
            value_counts = Counter(numeric_values)
            start = int(question.rating_start if question.rating_start is not None else 1)
            end = int(question.rating_end if question.rating_end is not None else 5)
            step = int(question.rating_step if question.rating_step is not None else 1)
            for star_val_num in range(start, end + step, step):
                star_val = float(star_val_num)
                cnt = value_counts.get(star_val, 0)
                perc = round(cnt * 100.0 / count_valid, 1) if count_valid else 0
                stats_data["distribution"].append({"value": star_val, "count": cnt, "percentage": perc})

            if question.show_na and na_count > 0:
                 na_perc = round(na_count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0
                 stats_data["distribution"].append({"value": na_option_text, "count": na_count, "percentage": na_perc})
        analytics = stats_data

    # Numerical Input
    elif qtype == "numerical-input":
        analytics = ResponseController.process_numeric_input_analytics(question, valid_responses) # Use VALID responses
        analytics["count_na"] = na_count # Add back NA count
        analytics["total_responses_considered"] = count_valid + na_count # Recalculate total

    # Image Select (Single/Multi)
    elif qtype in ['single-image-select', 'multiple-image-select']:
         hidden_label_counts = Counter()
         for r in valid_responses: # Use VALID responses
             val = ResponseController.parse_answer(r.response_text)
             if isinstance(val, list): # Multi-image select
                 for hidden_label in val: hidden_label_counts[str(hidden_label)] += 1
             elif val is not None: # Single-image select
                 hidden_label_counts[str(val)] += 1

         # Add N/A count if applicable
         if question.not_applicable and na_count > 0: hidden_label_counts[na_option_text] += na_count

         label_map = {opt.get('hidden_label'): opt for opt in (question.image_options or []) if isinstance(opt, dict) and opt.get('hidden_label')}
         distribution = []; total_valid_selections = sum(count for label, count in hidden_label_counts.items() if label != na_option_text) # Sum excluding N/A

         for hidden_label, count in hidden_label_counts.items():
             is_item_na = (hidden_label == na_option_text)
             option_info = label_map.get(hidden_label); visible_label = option_info.get('label', hidden_label) if option_info else hidden_label
             image_url = option_info.get('image_url') if option_info else None
             # Base percentage of responses on count_valid
             perc_responses = round(count * 100.0 / count_valid, 1) if count_valid else 0
             # Base percentage of selections on total_valid_selections (excluding N/A)
             perc_selections = round(count * 100.0 / total_valid_selections, 1) if total_valid_selections and not is_item_na else 0

             # For N/A, percentage of responses should be based on total_responses_considered
             if is_item_na:
                 perc_responses = round(count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0
                 perc_selections = 0 # N/A doesn't count as a "selection"

             distribution.append({ "option": visible_label, "hidden_label": hidden_label, "count": count, "percentage_of_responses": perc_responses, "percentage_of_selections": perc_selections, "image_url": image_url })

         distribution.sort(key=lambda x: x["count"], reverse=True)
         analytics = {
             "type": "image_select_distribution",
             "count_valid": count_valid,
             "count_na": na_count,
             "total_responses_considered": total_responses_considered,
             "option_distribution": distribution
         }

    # Ranking
    elif qtype == 'interactive-ranking':
         analytics = ResponseController.process_ranking_analytics(question, valid_responses) # Use VALID responses
         analytics["count_na"] = na_count # Add back NA count
         analytics["total_responses_considered"] = (analytics.get("count_valid", 0)) + na_count # Recalculate total

    # Open-Ended
    elif qtype == "open-ended":
        response_list = []
        for r in valid_responses: # Use VALID responses
            text_val = ResponseController.parse_answer(r.response_text)
            text_str = json.dumps(text_val) if isinstance(text_val, (list, dict)) else str(text_val)
            # Fetch user info if needed (assuming helper function exists or logic is here)
            # username = _get_username_for_submission(r.submission_id) # Placeholder
            response_list.append({"text": text_str, "created_at": r.created_at.isoformat()}) # Add username if fetched

        response_list.sort(key=lambda x: x["created_at"], reverse=True)
        latest_10 = response_list[:10]
        all_words = []; STOPWORDS = set(["the", "a", "an", "in", "and", "to", "of", "is", "that", "it", "with", "for", "on", "at", "this", "my", "was", "but", "be", "are", "i", "you", "me", "they", "or", "as", "so"])
        for item in response_list:
            words = re.findall(r"\b\w+\b", item["text"].lower())
            for w in words:
                if w not in STOPWORDS and len(w) > 1: all_words.append(w)
        freq = Counter(all_words).most_common(30); freq_data = [{"word": x[0], "count": x[1]} for x in freq]
        analytics = {
            "type": "open_ended",
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered,
            "latest_10": latest_10,
            "all_responses": response_list, # Provide all valid responses
            "word_frequencies": freq_data
        }

    # Grid Types
    elif qtype in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
         try:
             grid_data = ResponseController.process_grid_responses_for_analytics(question, valid_responses, qtype) # Use VALID responses
             analytics = { "type": "grid_data", "grid_data": grid_data }
             # Add counts for context
             analytics["count_na"] = na_count
             analytics["count_valid"] = count_valid
             analytics["total_responses_considered"] = total_responses_considered
             current_app.logger.info(f"Processed grid data for Q {question.id}. Valid: {count_valid}, N/A: {na_count}")
         except Exception as e:
             current_app.logger.error(f"Error processing grid analytics for Q {question.id}: {e}", exc_info=True)
             analytics = { "type": "grid_data_error", "error": str(e), "count_valid": count_valid, "count_na": na_count, "total_responses_considered": total_responses_considered }

    # Fallback for other types
    else:
        analytics = {
            "type": "other_unsupported",
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered
        }

    # --- Add standard metadata to the analytics object ---
    analytics['response_count'] = response_count  # Total filtered responses for this Q

    # Wrap analytics with question metadata for frontend consistency
    result = {
        'question_id': question.id,
        'question_text': question.question_text,
        'question_type': question.question_type,
        'sequence_number': question.sequence_number,
        'analytics': analytics
    }

    return result


def _find_grid_index(label_list, key_to_find, label_type="row"):
    """Finds index for a row/column key, trying text, standard formats, and int."""
    if label_list is None or not isinstance(label_list, list):
        current_app.logger.error(f"Invalid {label_type} label list provided for index finding.")
        return None

    s_key = str(key_to_find).strip() # Normalize key
    normalized_key = s_key.lower()
    normalized_labels = [(str(lbl.get("text", "") if isinstance(lbl, dict) else lbl).strip().lower(), idx) for idx, lbl in enumerate(label_list)]

    # 1. Direct text match (case-insensitive)
    for lbl_norm, idx in normalized_labels:
        if lbl_norm == normalized_key:
            # current_app.logger.debug(f"Index Find: Key '{s_key}' matched TEXT label '{lbl_norm}' at index {idx}.")
            return idx

    # 2. Regex match (e.g., "row-0", "col_1")
    pattern = r"row[-_\s]?(\d+)" if label_type == "row" else r"col[-_\s]?(\d+)"
    m = re.match(pattern, s_key, re.I)
    if m:
        try:
            idx = int(m.group(1))
            # current_app.logger.debug(f"Index Find: Key '{s_key}' matched REGEX to index {idx}.")
            return idx
        except (ValueError, IndexError):
            current_app.logger.warning(f"Index Find: Key '{s_key}' matched REGEX but group invalid: '{m.group(1)}'.")

    # 3. Direct integer conversion
    try:
        idx = int(s_key)
        # current_app.logger.debug(f"Index Find: Key '{s_key}' matched INT to index {idx}.")
        return idx
    except (ValueError, TypeError):
        pass # Ignore if not an integer

    current_app.logger.warning(f"Index Find: Could not resolve {label_type} key '{s_key}' to an index.")
    return None

# --- HELPER: Process Radio Grid (Ensure this is defined or imported) ---
def process_radio_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """Process radio grid responses, populating counts."""
    num_rows = len(grid_rows)
    num_cols = len(grid_columns)
    # No changes needed from the provided implementation in the thought process
    # Ensure it correctly updates grid_data["values"], grid_data["count_values"],
    # grid_data["row_totals"], and grid_data["column_totals"].
    # Use _find_grid_index for robustness.
    for r in responses:
        if r.is_not_applicable: continue # Skip N/A marked responses
        try:
            parsed = ResponseController.parse_answer(r.response_text)
            if isinstance(parsed, dict):
                for row_key, selected_col_key in parsed.items():
                    row_idx = _find_grid_index(grid_rows, row_key, "row")
                    col_idx = _find_grid_index(grid_columns, selected_col_key, "col")

                    if row_idx is not None and col_idx is not None and 0 <= row_idx < num_rows and 0 <= col_idx < num_cols:
                        grid_data["values"][row_idx][col_idx] += 1
                        grid_data["count_values"][row_idx][col_idx] += 1 # Also update count
                        grid_data["row_totals"][row_idx] += 1
                        grid_data["column_totals"][col_idx] += 1
                    else:
                        current_app.logger.warning(f"Invalid indices ({row_idx}, {col_idx}) for radio-grid response {r.id}")
            # Add handling for other potential formats if necessary (e.g., list)
        except Exception as e:
            current_app.logger.error(f"Error processing radio-grid response {r.id}: {e}", exc_info=True)

    grid_data["total_responses"] = len(responses) # Based on total responses passed in
    return grid_data # Return modified grid_data

# --- HELPER: Process Checkbox Grid (Ensure this is defined or imported) ---
def process_checkbox_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """Process checkbox grid responses, populating counts."""
    num_rows = len(grid_rows)
    num_cols = len(grid_columns)
    # No changes needed from the provided implementation in the thought process
    # Ensure it correctly updates grid_data["values"], grid_data["count_values"],
    # grid_data["row_totals"], and grid_data["column_totals"].
    # Use _find_grid_index for robustness.
    for r in responses:
        if r.is_not_applicable: continue
        try:
            parsed = ResponseController.parse_answer(r.response_text)
            if isinstance(parsed, dict):
                # Format: {"Row Label 1": ["Col Label A", "Col Label B"], ...}
                for row_key, selected_col_keys in parsed.items():
                    row_idx = _find_grid_index(grid_rows, row_key, "row")
                    if row_idx is None or not (0 <= row_idx < num_rows):
                        current_app.logger.warning(f"Invalid row index for key '{row_key}' in checkbox-grid response {r.id}")
                        continue

                    if isinstance(selected_col_keys, list):
                        selections_in_row = 0
                        for col_key in selected_col_keys:
                            col_idx = _find_grid_index(grid_columns, col_key, "col")
                            if col_idx is not None and 0 <= col_idx < num_cols:
                                grid_data["values"][row_idx][col_idx] += 1
                                grid_data["count_values"][row_idx][col_idx] += 1
                                grid_data["column_totals"][col_idx] += 1
                                selections_in_row += 1
                            else:
                                current_app.logger.warning(f"Invalid col index for key '{col_key}' in checkbox-grid response {r.id}, row '{row_key}'")
                        # Increment row_total by the *number of valid selections* in that row for this response
                        grid_data["row_totals"][row_idx] += selections_in_row
                    elif selected_col_keys == "N/A": # Handle row-level N/A if stored this way
                        pass # N/A doesn't contribute to cell counts
                    else:
                        current_app.logger.warning(f"Expected list for columns in checkbox-grid response {r.id}, row '{row_key}', got {type(selected_col_keys)}")

            # Add handling for other potential formats if necessary
        except Exception as e:
            current_app.logger.error(f"Error processing checkbox-grid response {r.id}: {e}", exc_info=True)

    grid_data["total_responses"] = len(responses)
    return grid_data

# --- HELPER: Process Star Rating Grid (Ensure this is defined or imported) ---
def process_star_rating_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """Process star rating grid, populating sums, counts, and calculating averages."""
    num_rows = len(grid_rows)
    num_cols = len(grid_columns)
    # No significant changes needed from the provided implementation in the thought process
    # Ensure it populates 'values' (sums), 'count_values', 'row_totals', 'column_totals'
    # Ensure it calculates and populates 'cell_averages', 'row_averages', 'column_averages', 'overall_average'.
    # Use _find_grid_index for robustness.
    # --- (Copy the full implementation from the thought process here) ---
    for r in responses:
        if r.is_not_applicable: continue # Skip entire response if marked N/A
        try:
            parsed = ResponseController.parse_answer(r.response_text)
            if not isinstance(parsed, dict):
                current_app.logger.warning(f"Star-rating grid response {r.id} not a dict: {type(parsed)}. Skipping.")
                continue

            for row_key, col_dict in parsed.items():
                row_idx = _find_grid_index(grid_rows, row_key, "row")
                if row_idx is None or not (0 <= row_idx < num_rows):
                    current_app.logger.warning(f"Invalid row index for key '{row_key}' in star-rating response {r.id}. Skipping row.")
                    continue

                if isinstance(col_dict, dict):
                    row_responded = False # Track if any valid response or N/A was given for this row
                    for col_key, rating in col_dict.items():
                        col_idx = _find_grid_index(grid_columns, col_key, "col")
                        if col_idx is None or not (0 <= col_idx < num_cols):
                            current_app.logger.warning(f"Invalid col index for key '{col_key}' in star-rating response {r.id}, row '{row_key}'. Skipping col.")
                            continue

                        row_responded = True # Mark row as responded to

                        if rating == "N/A":
                            grid_data["count_values"][row_idx][col_idx] += 1 # Count N/A response
                            grid_data["column_totals"][col_idx] += 1 # N/A contributes to column total responses
                        else:
                            try:
                                rating_val = float(rating)
                                grid_data["values"][row_idx][col_idx] += rating_val # SUM of ratings
                                grid_data["count_values"][row_idx][col_idx] += 1 # COUNT of valid ratings
                                grid_data["column_totals"][col_idx] += 1 # Valid rating contributes to column total
                            except (ValueError, TypeError):
                                current_app.logger.warning(f"Invalid rating value '{rating}' in star-rating response {r.id}, cell ({row_idx},{col_idx}). Treating as N/A.")
                                grid_data["count_values"][row_idx][col_idx] += 1 # Count invalid as N/A? Or skip? Let's count it.
                                grid_data["column_totals"][col_idx] += 1

                    if row_responded:
                        grid_data["row_totals"][row_idx] += 1 # Increment row total if *any* column in the row was responded to (including N/A)

                elif col_dict == "N/A": # Row-level N/A
                     grid_data["row_totals"][row_idx] += 1 # Count as response for the row
                     # Mark all cells in this row as having received an N/A response?
                     for c_idx in range(num_cols):
                        grid_data["count_values"][row_idx][c_idx] += 1 # Increment count
                        grid_data["column_totals"][c_idx] += 1 # Also contributes to column totals
                else:
                     current_app.logger.warning(f"Unexpected value type for columns in star-rating response {r.id}, row '{row_key}': {type(col_dict)}")


        except Exception as e:
            current_app.logger.error(f"Error processing star-rating response {r.id}: {e}", exc_info=True)

    # --- Calculate Averages ---
    # Cell Averages
    for r in range(num_rows):
        for c in range(num_cols):
            count = grid_data["count_values"][r][c]
            total_value = grid_data["values"][r][c] # This is the SUM
            # Find count of ONLY numeric ratings for this cell
            valid_numeric_ratings_count = 0
            for resp_r in responses:
                if not resp_r.is_not_applicable:
                    parsed_resp = ResponseController.parse_answer(resp_r.response_text)
                    if isinstance(parsed_resp, dict):
                        row_key = list(parsed_resp.keys())[0]
                        if _find_grid_index(grid_rows, row_key, "row") == r:
                            col_dict = parsed_resp[row_key]
                            if isinstance(col_dict, dict):
                                col_key = list(col_dict.keys())[0]
                                if _find_grid_index(grid_columns, col_key, "col") == c:
                                    rating = col_dict[col_key]
                                    if rating != "N/A":
                                        try:
                                            float(rating) # Check if it's convertible
                                            valid_numeric_ratings_count += 1
                                        except: pass

            if valid_numeric_ratings_count > 0:
                 avg = total_value / valid_numeric_ratings_count
                 grid_data["cell_averages"][r][c] = round(avg, 2)
            else:
                 grid_data["cell_averages"][r][c] = 0.0

    # Row & Column Averages (based on valid numeric cell averages)
    for r in range(num_rows):
        valid_numeric_cell_averages = [grid_data["cell_averages"][r][c] for c in range(num_cols) if grid_data["count_values"][r][c] > 0 and grid_data["values"][r][c] > 0]
        if valid_numeric_cell_averages: grid_data["row_averages"][r] = round(statistics.mean(valid_numeric_cell_averages), 2)
        else: grid_data["row_averages"][r] = 0.0

    for c in range(num_cols):
        valid_numeric_cell_averages = [grid_data["cell_averages"][r][c] for r in range(num_rows) if grid_data["values"][r][c] > 0 and grid_data["count_values"][r][c] > 0 ]
        if valid_numeric_cell_averages: grid_data["column_averages"][c] = round(statistics.mean(valid_numeric_cell_averages), 2)
        else: grid_data["column_averages"][c] = 0.0

    # Calculate Overall Average (based on all individual valid numeric ratings)
    all_valid_numeric_ratings = []
    for r in responses:
        if not r.is_not_applicable:
            parsed = ResponseController.parse_answer(r.response_text)
            if isinstance(parsed, dict):
                for row_key, col_dict in parsed.items():
                    if isinstance(col_dict, dict):
                        for col_key, rating in col_dict.items():
                            if rating != "N/A":
                                try: all_valid_numeric_ratings.append(float(rating))
                                except: pass

    if all_valid_numeric_ratings: grid_data["overall_average"] = round(statistics.mean(all_valid_numeric_ratings), 2)
    else: grid_data["overall_average"] = 0.0

    grid_data["total_responses"] = len(responses)
    return grid_data

# --- HELPER: Process Grid Responses Main (Ensure this is defined or imported) ---
def process_grid_responses_for_analytics(question, question_responses, grid_type):
    """Main dispatcher for processing grid responses."""
    grid_rows = question.grid_rows or []
    grid_columns = question.grid_columns or []
    if not grid_rows or not grid_columns:
        current_app.logger.warning(f"Grid Q {question.id} has no rows/columns defined.")
        return None # Or return empty structure

    # Initialize grid_data structure
    grid_data = {
        "rows": [row.get('text', f'Row {i+1}') for i, row in enumerate(grid_rows)],
        "columns": [col.get('text', f'Column {i+1}') for i, col in enumerate(grid_columns)],
        "values": [[0 for _ in grid_columns] for _ in grid_rows], # Sums (star) or Counts (choice)
        "count_values": [[0 for _ in grid_columns] for _ in grid_rows], # Explicit counts
        "cell_averages": [[0.0 for _ in grid_columns] for _ in grid_rows], # Specific for star rating
        "row_totals": [0] * len(grid_rows), # Total responses/selections per row
        "column_totals": [0] * len(grid_columns), # Total responses/selections per column
        "row_averages": [0.0] * len(grid_rows),
        "column_averages": [0.0] * len(grid_columns),
        "overall_average": 0.0, # Specific for star rating
        "total_responses": len(question_responses),
        "question_type": grid_type # Add type for context
    }

    # Call the specific processor
    if grid_type == 'radio-grid':
        grid_data = process_radio_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
    elif grid_type == 'checkbox-grid':
        grid_data = process_checkbox_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
    elif grid_type == 'star-rating-grid':
        grid_data = process_star_rating_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
        # Note: Averages are calculated within process_star_rating_grid_responses now
    else:
        current_app.logger.error(f"Unsupported grid type '{grid_type}' passed to main processor.")
        return None # Or handle error appropriately

    # Remove fields not strictly needed by frontend if desired, but keeping them is okay too
    # grid_data.pop("co_occurrences", None) # Example for checkbox

    return grid_data

# --- UPDATED: _process_single_question_analytics ---
def _process_single_question_analytics(question, filtered_responses):
    """
    Calculates detailed analytics for one question based on filtered responses.
    Handles all specified question types and N/A options.
    Returns a dictionary containing the analytics results.
    """
    qtype = question.question_type
    response_count = len(filtered_responses)
    na_option_text = question.not_applicable_text or "Not Applicable"
    analytics = {} # Initialize analytics dict
    analytics['response_count'] = response_count # Overall filtered count for this Q

    # --- N/A Handling (Count first) ---
    na_count = 0
    valid_responses = [] # Responses that are not marked as N/A
    for r in filtered_responses:
        if r.is_not_applicable:
            na_count += 1
        else:
            # Further check if text content itself signifies N/A
            parsed_val = ResponseController.parse_answer(r.response_text)
            # Use strip() and lower() for robust comparison
            if isinstance(parsed_val, str) and parsed_val.strip().lower() == na_option_text.strip().lower():
                 na_count += 1
            else:
                 valid_responses.append(r)

    count_valid = len(valid_responses)
    total_responses_considered = count_valid + na_count

    # --- Analytics based on Question Type ---

    # Single Choice / Dropdown / Scale
    if qtype in ["multiple-choice", "dropdown", "single-choice", "scale"]:
        option_counts = Counter()
        if qtype == 'scale' and question.scale_points: option_source = question.scale_points; is_simple_list = True
        elif question.options: option_source = question.options; is_simple_list = not all(isinstance(opt, dict) for opt in option_source)
        else: option_source = []; is_simple_list = True

        for r in valid_responses: # Count valid responses
            val = ResponseController.parse_answer(r.response_text)
            val_str = str(val.get('text')) if isinstance(val, dict) and 'text' in val else str(val)
            option_counts[val_str] += 1

        # Add N/A count to counts if applicable
        if question.not_applicable and na_count > 0: option_counts[na_option_text] += na_count

        total_valid_responses_for_percentage = count_valid # Base % on valid responses

        distribution = []
        defined_labels = set()

        if is_simple_list:
            for item in option_source: label = str(item); defined_labels.add(label); count = option_counts.get(label, 0); perc = round((count / total_valid_responses_for_percentage * 100), 1) if total_valid_responses_for_percentage > 0 else 0; distribution.append({"option": label, "count": count, "percentage": perc})
        else: # List of dicts
            for item_dict in option_source: label = str(item_dict.get('text','')); defined_labels.add(label); count = option_counts.get(label, 0); perc = round((count / total_valid_responses_for_percentage * 100), 1) if total_valid_responses_for_percentage > 0 else 0; distribution.append({"option": label, "count": count, "percentage": perc})

        for counted_label, count in option_counts.items(): # Add counted options not in definition
            if counted_label not in defined_labels and counted_label != na_option_text: perc = round((count / total_valid_responses_for_percentage * 100), 1) if total_valid_responses_for_percentage > 0 else 0; distribution.append({"option": counted_label, "count": count, "percentage": perc})

        # Add N/A if counted and not already included
        if question.not_applicable and na_count > 0 and na_option_text not in defined_labels:
            na_perc_total = round((na_count / total_responses_considered * 100), 1) if total_responses_considered > 0 else 0
            if not any(d['option'] == na_option_text for d in distribution): distribution.append({"option": na_option_text, "count": na_count, "percentage": na_perc_total}) # Use % of total

        # Sort distribution
        if qtype == 'scale' and question.scale_points: scale_order_map = {point: i for i, point in enumerate(question.scale_points)}; distribution.sort(key=lambda x: scale_order_map.get(x['option'], float('inf')))
        else: distribution.sort(key=lambda x: x["count"], reverse=True)

        analytics = {"type": "single_select_distribution", "options_distribution": distribution}
        # Add average score specifically for scale type
        if qtype == 'scale' and question.scale_points:
            weighted_sum = 0; count_for_avg = 0; scale_map = {point: i + 1 for i, point in enumerate(question.scale_points)}
            for item in distribution: # Use calculated distribution
                scale_val = scale_map.get(item['option'])
                if scale_val is not None: weighted_sum += item['count'] * scale_val; count_for_avg += item['count']
            analytics['mean'] = round(weighted_sum / count_for_avg, 2) if count_for_avg > 0 else None
            analytics['count_valid_for_avg'] = count_for_avg # Add count used for avg calculation

    # Checkbox / Multi-Choice
    elif qtype in ['checkbox', 'multi-choice']:
        option_counts = Counter(); co_occurrence = Counter()
        for r in valid_responses: # Count valid responses
            val = ResponseController.parse_answer(r.response_text)
            current_selection = [str(item) for item in val] if isinstance(val, list) else ([str(val)] if val is not None else [])
            for item_str in current_selection: option_counts[item_str] += 1
            sorted_items = sorted(current_selection);
            for i in range(len(sorted_items)):
                for j in range(i + 1, len(sorted_items)): co_occurrence[(sorted_items[i], sorted_items[j])] += 1

        # Add N/A count if applicable
        if question.not_applicable and na_count > 0: option_counts[na_option_text] += na_count

        total_selections = sum(option_counts.values()) # Includes N/A selections if counted
        total_responses_for_percentage = count_valid # Base % of responses on valid count

        distribution = []
        defined_options_texts = set()
        if question.options and isinstance(question.options, list):
            for opt in question.options: label = str(opt.get('text')) if isinstance(opt, dict) else str(opt); defined_options_texts.add(label)

        for opt_text in defined_options_texts:
             cnt = option_counts.get(opt_text, 0)
             perc_resp = round(cnt * 100.0 / total_responses_for_percentage, 1) if total_responses_for_percentage else 0
             perc_sel = round(cnt * 100.0 / total_selections, 1) if total_selections else 0
             distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

        for opt_text, cnt in option_counts.items(): # Add other counted options
            if opt_text not in defined_options_texts and opt_text != na_option_text:
                perc_resp = round(cnt * 100.0 / total_responses_for_percentage, 1) if total_responses_for_percentage else 0
                perc_sel = round(cnt * 100.0 / total_selections, 1) if total_selections else 0
                distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

        # Add N/A if counted and not already included
        if question.not_applicable and na_count > 0:
            na_perc_resp = round(na_count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0 # N/A % of total responses
            na_perc_sel = round(na_count * 100.0 / total_selections, 1) if total_selections else 0 # N/A % of total selections
            if not any(d['option'] == na_option_text for d in distribution): distribution.append({ "option": na_option_text, "count": na_count, "percentage_of_responses": na_perc_resp, "percentage_of_selections": na_perc_sel })

        distribution.sort(key=lambda x: x["count"], reverse=True)
        co_occurrence_list = [{"pair": list(pair), "count": ccount} for pair, ccount in co_occurrence.items()]
        co_occurrence_list.sort(key=lambda x: x["count"], reverse=True)
        analytics = {"type": "multi_select_distribution", "option_distribution": distribution, "top_co_occurrences": co_occurrence_list[:15]}

    # Rating (Slider)
    elif qtype == "rating":
        analytics = ResponseController.process_slider_analytics(question, valid_responses)

    # Standalone Star Rating
    elif qtype == "star-rating":
        numeric_values = []
        for r in valid_responses:
            try: numeric_values.append(float(ResponseController.parse_answer(r.response_text)))
            except (ValueError, TypeError): continue
        stats_data = {"type": "star-rating", "mean": None, "distribution": []}
        if numeric_values:
            stats_data["mean"] = round(statistics.mean(numeric_values), 2)
            value_counts = Counter(numeric_values)
            start = int(question.rating_start if question.rating_start is not None else 1); end = int(question.rating_end if question.rating_end is not None else 5); step = int(question.rating_step if question.rating_step is not None else 1)
            for star_val_num in range(start, end + step, step):
                star_val = float(star_val_num); cnt = value_counts.get(star_val, 0); perc = round(cnt * 100.0 / count_valid, 1) if count_valid else 0
                stats_data["distribution"].append({"value": star_val, "count": cnt, "percentage": perc})
            # Add N/A if needed, using total_responses_considered for percentage
            if question.show_na and na_count > 0: na_perc = round(na_count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0; stats_data["distribution"].append({"value": na_option_text, "count": na_count, "percentage": na_perc})
        analytics = stats_data

    # Numerical Input
    elif qtype == "numerical-input":
        analytics = ResponseController.process_numeric_input_analytics(question, valid_responses)

    # NPS
    elif qtype == "nps":
        numeric_values = [];
        for r in valid_responses:
            try: numeric_values.append(float(ResponseController.parse_answer(r.response_text)))
            except (ValueError, TypeError): continue
        stats_data = {"type": "numeric_stats", "mean": None, "median": None, "min": None, "max": None, "std_dev": None, "distribution": [], "nps_segments": None, "nps_score": None}
        if numeric_values:
            stats_data["mean"] = round(statistics.mean(numeric_values), 2); stats_data["median"] = round(statistics.median(numeric_values), 2); stats_data["min"] = round(min(numeric_values), 2); stats_data["max"] = round(max(numeric_values), 2)
            try: stats_data["std_dev"] = round(statistics.stdev(numeric_values), 2) if count_valid > 1 else 0
            except statistics.StatisticsError: stats_data["std_dev"] = None
            value_counts = Counter(numeric_values)
            for val_num in range(0, 11): val = float(val_num); cnt = value_counts.get(val, 0); perc = round(cnt * 100.0 / count_valid, 1) if count_valid else 0; stats_data["distribution"].append({"value": val, "count": cnt, "percentage": perc})
            promoters = sum(1 for v in numeric_values if v >= 9); passives = sum(1 for v in numeric_values if 7 <= v <= 8); detractors = sum(1 for v in numeric_values if v <= 6); total_nps_responses = len(numeric_values)
            nps_score = (promoters - detractors) * 100 / total_nps_responses if total_nps_responses > 0 else 0
            stats_data["nps_segments"] = {"promoters": promoters, "passives": passives, "detractors": detractors}; stats_data["nps_score"] = round(nps_score, 1)
        analytics = stats_data

    # Image Select (Single/Multi)
    elif qtype in ['single-image-select', 'multiple-image-select']:
         hidden_label_counts = Counter()
         for r in valid_responses:
             val = ResponseController.parse_answer(r.response_text)
             if isinstance(val, list): # Multi-image select
                 for hidden_label in val: hidden_label_counts[str(hidden_label)] += 1
             elif val is not None: hidden_label_counts[str(val)] += 1 # Single-image select

         # Add N/A count if applicable
         if question.not_applicable and na_count > 0: hidden_label_counts[na_option_text] += na_count

         label_map = {opt.get('hidden_label'): opt for opt in (question.image_options or []) if isinstance(opt, dict) and opt.get('hidden_label')}
         distribution = []; total_valid_selections = sum(count for label, count in hidden_label_counts.items() if label != na_option_text)

         for hidden_label, count in hidden_label_counts.items():
             is_item_na = (hidden_label == na_option_text)
             option_info = label_map.get(hidden_label); visible_label = option_info.get('label', hidden_label) if option_info else hidden_label; image_url = option_info.get('image_url') if option_info else None
             perc_responses = round(count * 100.0 / count_valid, 1) if count_valid else 0
             perc_selections = round(count * 100.0 / total_valid_selections, 1) if total_valid_selections and not is_item_na else 0
             if is_item_na: perc_responses = round(count * 100.0 / total_responses_considered, 1) if total_responses_considered else 0; perc_selections = 0
             distribution.append({ "option": visible_label, "hidden_label": hidden_label, "count": count, "percentage_of_responses": perc_responses, "percentage_of_selections": perc_selections, "image_url": image_url })

         distribution.sort(key=lambda x: x["count"], reverse=True)
         analytics = { "type": "image_select_distribution", "option_distribution": distribution }

    # Ranking
    elif qtype == 'interactive-ranking':
         analytics = ResponseController.process_ranking_analytics(question, valid_responses)

    # Open-Ended
    elif qtype == "open-ended":
        response_list = [{"text": ResponseController.parse_answer(r.response_text), "created_at": r.created_at.isoformat()} for r in valid_responses]
        response_list.sort(key=lambda x: x["created_at"], reverse=True)
        latest_10 = response_list[:10]; all_words = []; STOPWORDS = set(["the", "a", "an", "in", "and", "to", "of", "is", "that", "it", "with", "for", "on", "at", "this", "my", "was", "but", "be", "are", "i", "you", "me", "they", "or", "as", "so"])
        for item in response_list:
            words = re.findall(r"\b\w+\b", str(item["text"]).lower()) # Ensure text is string
            for w in words:
                if w not in STOPWORDS and len(w) > 1: all_words.append(w)
        freq = Counter(all_words).most_common(30); freq_data = [{"word": x[0], "count": x[1]} for x in freq]
        analytics = {"type": "open_ended", "latest_10": latest_10, "all_responses": response_list, "word_frequencies": freq_data}

    # Grid Types
    elif qtype in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
         try:
             grid_data = ResponseController.process_grid_responses_for_analytics(question, valid_responses, qtype)
             analytics = { "type": "grid_data", "grid_data": grid_data }
             current_app.logger.info(f"Processed grid data for Q {question.id}. Valid: {count_valid}, N/A: {na_count}")
         except Exception as e:
             current_app.logger.error(f"Error processing grid analytics for Q {question.id}: {e}", exc_info=True)
             analytics = { "type": "grid_data_error", "error": str(e) }

    # Fallback for other types
    else:
        analytics = {"type": "other_unsupported"}

    # --- Add standard metadata and counts to the analytics object ---
    analytics['count_valid'] = count_valid
    analytics['count_na'] = na_count
    analytics['total_responses_considered'] = total_responses_considered
    # Add these fields even if the specific block didn't set them
    analytics.setdefault('sequence_number', question.sequence_number)
    analytics.setdefault('question_text', question.question_text)
    analytics.setdefault('question_type', question.question_type)
    analytics.setdefault('question_id', question.id)

    result = {
        'question_id': question.id,
        'question_text': question.question_text,
        'question_type': question.question_type,
        'sequence_number': question.sequence_number,
        'analytics': analytics
    }

    return result



class ReportTabController:

    @staticmethod
    def get_base_data(survey_id):
        try:
            survey = Survey.query.get(survey_id)
            if not survey: return {"error": "Survey not found"}, 404
            sorted_questions = sorted(survey.questions.all(), key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
            survey_data = {
                "id": survey.id, "title": survey.title,
                "questions": [
                     { "id": q.id, "question_text": q.question_text, "question_type": q.question_type, "sequence_number": q.sequence_number,
                       "options": q.options, "scale_points": q.scale_points, "grid_rows": q.grid_rows, "grid_columns": q.grid_columns,
                       "image_options": q.image_options, "ranking_items": q.ranking_items, "not_applicable": q.not_applicable,
                       "not_applicable_text": q.not_applicable_text, "show_na": q.show_na
                     } for q in sorted_questions ] }
            available_options = { 'age_groups': [], 'genders': [], 'locations': [], 'education': [], 'companies': [], 'cohort_tags': [] }
            demo_fields = { 'age_groups': Submission.age_group, 'genders': Submission.gender, 'locations': Submission.location,
                            'education': Submission.education, 'companies': Submission.company, 'cohort_tags': Submission.cohort_tag }
            for key, field in demo_fields.items():
                try:
                    distinct_values = db.session.query(field).filter(Submission.survey_id == survey_id, field.isnot(None), field != '').distinct().all()
                    available_options[key] = sorted([value[0] for value in distinct_values if value[0]])
                except Exception as e: current_app.logger.error(f"Error querying distinct values for {key}: {e}"); available_options[key] = []
            return { "survey": survey_data, "available_filter_options": available_options }, 200
        except Exception as e: current_app.logger.error(f"Error in get_base_data: {e}", exc_info=True); return {"error": "Failed to retrieve base report data"}, 500

    @staticmethod
    def get_report_data(survey_id, filters=None, comparison=None):
        """Fetches filtered analytics data, handles comparison."""
        try:
            survey = Survey.query.get(survey_id)
            if not survey: return {"error": "Survey not found"}, 404

            def get_analytics_for_filters(current_filters):
                query = Submission.query.filter(Submission.survey_id == survey_id)
                query = _apply_filters_to_query(query, current_filters)
                filtered_submissions = query.all()

                if not filtered_submissions:
                    return {"summary_metrics": _calculate_summary_metrics([]), "demographics": {}, "question_stats": {}}

                submission_ids = [s.id for s in filtered_submissions]
                all_relevant_responses = Response.query.filter(Response.submission_id.in_(submission_ids)).all()
                responses_by_question = defaultdict(list)
                for r in all_relevant_responses: responses_by_question[r.question_id].append(r)

                question_stats = {}
                for q in survey.questions.all():
                    q_responses = responses_by_question.get(q.id, [])
                    try:
                        q_analytics = _process_single_question_analytics(q, q_responses)
                        question_stats[str(q.id)] = q_analytics
                    except Exception as q_err:
                        current_app.logger.error(f"Error processing analytics for Q{q.id}: {q_err}", exc_info=True)
                        question_stats[str(q.id)] = {"error": str(q_err), "sequence_number": q.sequence_number, "question_text": q.question_text}

                return {
                    "summary_metrics": _calculate_summary_metrics(filtered_submissions),
                    "demographics": _calculate_demographics(filtered_submissions),
                    "question_stats": question_stats
                }

            base_filters = filters or {}
            report_data = {"group1": None, "group2": None}

            if not comparison or comparison.get("type") == "No Comparison" or comparison.get("dimension") is None:
                report_data["group1"] = get_analytics_for_filters(base_filters)
            else:
                dimension = comparison.get("dimension")
                segments = comparison.get("segments", [])
                if not dimension or not hasattr(Submission, dimension): return {"error": f"Invalid comparison dimension: {dimension}"}, 400
                if len(segments) < 2: return {"error": "Need at least two segments to compare"}, 400

                filters_g1 = base_filters.copy()
                filters_g1[dimension] = [segments[0]] # Assume list for IN clause, adjust if direct match needed
                report_data["group1"] = get_analytics_for_filters(filters_g1)

                filters_g2 = base_filters.copy()
                filters_g2[dimension] = [segments[1]]
                report_data["group2"] = get_analytics_for_filters(filters_g2)

            return report_data, 200
        except AttributeError as ae:
             current_app.logger.error(f"Invalid dimension attribute for comparison: {ae}")
             return {"error": f"Invalid comparison dimension provided."}, 400
        except Exception as e:
            current_app.logger.error(f"Error in get_report_data: {e}", exc_info=True)
            return {"error": "Failed to retrieve report analytics data"}, 500

    @staticmethod
    def get_filtered_count(survey_id, filters=None):
        try:
            survey = Survey.query.get(survey_id);
            if not survey: return {"error": "Survey not found"}, 404
            query = Submission.query.filter_by(survey_id=survey_id)
            query = _apply_filters_to_query(query, filters) # Use helper
            count = query.count()
            return {"count": count}, 200
        except Exception as e: current_app.logger.error(f"Error in get_filtered_count: {e}", exc_info=True); return {"error": "Failed to retrieve filtered count"}, 500

    @staticmethod
    def get_segment_counts(survey_id, dimension, base_filters=None):
        try:
            survey = Survey.query.get(survey_id);
            if not survey: return {"error": "Survey not found"}, 404
            if not hasattr(Submission, dimension): return {"error": f"Invalid comparison dimension: {dimension}"}, 400
            query = db.session.query(getattr(Submission, dimension), func.count(Submission.id)).filter(Submission.survey_id == survey_id)
            query = _apply_filters_to_query(query, base_filters) # Apply base filters
            # Ensure grouping dimension is not null/empty
            query = query.filter(getattr(Submission, dimension).isnot(None)).filter(getattr(Submission, dimension) != '')
            query = query.group_by(getattr(Submission, dimension))
            results = query.all()
            segment_counts = {str(segment): count for segment, count in results if segment}
            return {"segment_counts": segment_counts}, 200
        except Exception as e: current_app.logger.error(f"Error in get_segment_counts: {e}", exc_info=True); return {"error": "Failed to retrieve segment counts"}, 500

    # --- Settings Methods (No Auth) ---
    @staticmethod
    def get_report_settings(survey_id):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        try:
            from app.controllers.chart_settings_controller import ChartSettingsController
            # Assuming ChartSettingsController.get_chart_settings expects user_id
            result, status = ChartSettingsController.get_chart_settings(survey_id, placeholder_user_id)
            return result, status
        except Exception as e: current_app.logger.error(f"Error getting settings: {e}", exc_info=True); return {"error": "Failed to retrieve report settings"}, 500

    @staticmethod
    def save_report_settings(survey_id, settings):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        try:
            from app.controllers.chart_settings_controller import ChartSettingsController
            # Assuming ChartSettingsController.save_chart_settings expects user_id
            result, status = ChartSettingsController.save_chart_settings(survey_id, placeholder_user_id, settings)
            return result, status
        except Exception as e: current_app.logger.error(f"Error saving settings: {e}", exc_info=True); return {"error": "Failed to save report settings"}, 500

    # --- Saved Views Methods (No Auth) ---
    @staticmethod
    def list_saved_views(survey_id):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        try:
            views = ReportSetting.query.filter( ReportSetting.survey_id == survey_id, ReportSetting.user_id == placeholder_user_id, ReportSetting.view_name.isnot(None) ).order_by(ReportSetting.updated_at.desc()).all()
            view_list = [{"id": v.id, "name": v.view_name, "updated_at": v.updated_at.isoformat()} for v in views]
            return view_list, 200
        except Exception as e: current_app.logger.error(f"Error listing saved views: {e}", exc_info=True); return {"error": "Failed to list saved views"}, 500

    @staticmethod
    def save_named_view(survey_id, name, settings_snapshot):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        if not name or not isinstance(name, str) or len(name.strip()) == 0: return {"error": "View name cannot be empty"}, 400
        if not settings_snapshot or not isinstance(settings_snapshot, dict): return {"error": "Invalid settings snapshot data"}, 400
        existing = ReportSetting.query.filter_by(survey_id=survey_id, user_id=placeholder_user_id, view_name=name.strip()).first()
        if existing: existing.settings = settings_snapshot; existing.updated_at = datetime.utcnow(); message = "View updated"; new_id = existing.id
        else: new_view = ReportSetting(survey_id=survey_id, user_id=placeholder_user_id, view_name=name.strip(), settings=settings_snapshot); db.session.add(new_view); db.session.flush(); new_id = new_view.id; message = "View saved"
        try: db.session.commit(); return {"message": message, "id": new_id, "name": name.strip()}, 200
        except Exception as e: db.session.rollback(); current_app.logger.error(f"Error saving named view '{name}': {e}", exc_info=True); return {"error": "Failed to save view"}, 500

    @staticmethod
    def load_named_view(survey_id, view_identifier):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        try:
            view_setting = None
            try: view_id = int(view_identifier); view_setting = ReportSetting.query.filter_by(id=view_id, survey_id=survey_id, user_id=placeholder_user_id).first()
            except ValueError: view_setting = ReportSetting.query.filter_by(view_name=view_identifier, survey_id=survey_id, user_id=placeholder_user_id).first()
            if view_setting and view_setting.view_name is not None: return {"name": view_setting.view_name, "settingsSnapshot": view_setting.settings}, 200
            else: return {"error": "Saved view not found"}, 404
        except Exception as e: current_app.logger.error(f"Error loading view '{view_identifier}': {e}", exc_info=True); return {"error": "Failed to load view"}, 500

    @staticmethod
    def delete_named_view(survey_id, view_identifier):
        # !! WARNING: NO AUTH - Using placeholder user_id = 1 !!
        placeholder_user_id = 1
        try:
            view_setting = None
            try: view_id = int(view_identifier); view_setting = ReportSetting.query.filter_by(id=view_id, survey_id=survey_id, user_id=placeholder_user_id).first()
            except ValueError: view_setting = ReportSetting.query.filter_by(view_name=view_identifier, survey_id=survey_id, user_id=placeholder_user_id).first()
            if view_setting and view_setting.view_name is not None: db.session.delete(view_setting); db.session.commit(); return {"message": "View deleted successfully"}, 200
            else: return {"error": "Saved view not found or cannot be deleted"}, 404
        except Exception as e: db.session.rollback(); current_app.logger.error(f"Error deleting view '{view_identifier}': {e}", exc_info=True); return {"error": "Failed to delete view"}, 500

    # --- Export Method ---
    @staticmethod
    def export_excel_report(survey_id, filters=None):
        """Generates and returns an Excel file stream with filtered raw data."""
        try:
            survey = Survey.query.get(survey_id)
            if not survey: raise ValueError("Survey not found")

            # Build query without joinedload for responses to avoid SQLAlchemy error
            query = Submission.query.filter(Submission.survey_id == survey_id)
            query = _apply_filters_to_query(query, filters) # Apply filters
            submissions = query.order_by(Submission.submitted_at).all() 

            output = BytesIO()
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = "Responses"

            if not submissions:
                sheet.cell(row=1, column=1, value="No responses found matching the selected filters.")
            else:
                # --- Prepare Headers ---
                sorted_questions = sorted(survey.questions.all(), key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
                headers = ["Survey ID", "Survey Name", "Submitted At", "Duration (s)", "Age Group", "Gender", "Location", "Education", "Company"]
                question_headers_map = {q.id: f"Q{q.sequence_number}: {q.question_text}" for q in sorted_questions}
                headers.extend([question_headers_map[q.id] for q in sorted_questions])
                sheet.append(headers)

                # Fetch all responses for these submissions in a separate query
                submission_ids = [sub.id for sub in submissions]
                responses = Response.query.filter(Response.submission_id.in_(submission_ids)).all()
                
                # Group responses by submission_id for efficient lookup
                responses_by_submission = defaultdict(list)
                for response in responses:
                    responses_by_submission[response.submission_id].append(response)

                # --- Prepare Rows ---
                for sub in submissions:
                    submission_responses = responses_by_submission.get(sub.id, [])
                    responses_map = {r.question_id: r for r in submission_responses}
                    row_dict = {h: '' for h in headers}

                    # Populate survey, submission timing, and demographic fields only
                    row_dict["Survey ID"] = survey_id
                    row_dict["Survey Name"] = survey.title or ''
                    row_dict["Submitted At"] = sub.submitted_at.isoformat() if sub.submitted_at else ''
                    row_dict["Duration (s)"] = sub.duration if sub.duration is not None else ''
                    row_dict["Age Group"] = sub.age_group or ''
                    row_dict["Gender"] = sub.gender or ''
                    row_dict["Location"] = sub.location or ''
                    row_dict["Education"] = sub.education or ''
                    row_dict["Company"] = sub.company or ''

                    # Populate question responses
                    for q in sorted_questions:
                        header_key = question_headers_map.get(q.id)
                        if not header_key: continue

                        response = responses_map.get(q.id)
                        response_value = ''
                        if response:
                            if q.question_type == 'signature':
                                is_signed = bool(response.response_text and response.response_text.strip() not in ['{}', 'null', ''])
                                response_value = "Yes" if is_signed else "No"
                            elif q.question_type == 'document-upload':
                                try:
                                    file_info_list = json.loads(response.response_text or '[]') # Handle null text
                                    if isinstance(file_info_list, list) and file_info_list:
                                        filenames = [f.get('name', f.get('url', '').split('/')[-1]) for f in file_info_list if isinstance(f, dict)]
                                        response_value = ", ".join(filenames)
                                except (json.JSONDecodeError, TypeError):
                                    response_value = response.file_path.split('/')[-1] if response.file_path else '[Upload Error]'
                            elif q.question_type in ['checkbox', 'multi-choice', 'multiple-image-select', 'ranking', 'radio-grid', 'checkbox-grid', 'star-rating-grid']:
                                try:
                                    parsed = json.loads(response.response_text or 'null') # Handle null text
                                    if isinstance(parsed, list): response_value = ", ".join(map(str, parsed))
                                    elif isinstance(parsed, dict): response_value = "; ".join(f"{k}: {v}" for k, v in parsed.items())
                                    else: response_value = str(parsed)
                                except (json.JSONDecodeError, TypeError): response_value = response.response_text
                            else: response_value = response.response_text

                        row_dict[header_key] = response_value if response_value is not None else ''

                    # Append row to sheet
                    safe_row = []
                    for item in list(row_dict.values()):
                        if isinstance(item, (datetime, date)): safe_row.append(item.isoformat())
                        elif item is None: safe_row.append('')
                        else: safe_row.append(item)
                    sheet.append(safe_row)

            # --- Finalize Excel ---
            workbook.save(output)
            output.seek(0)
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f"survey_{survey_id}_responses_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"

            return output, mimetype, filename

        except ValueError as ve:
             raise ve # Re-raise for the route to handle as 404/other error
        except Exception as e:
            current_app.logger.error(f"Error exporting Excel for survey {survey_id}: {e}", exc_info=True)
            raise # Re-raise for the route to handle as 500