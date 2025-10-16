import json
import re
import statistics
import datetime
import os
from collections import defaultdict
from collections import Counter
from sqlalchemy import or_, and_, func
from app.models import Survey, Question, Submission, Response, User, SurveyLink, db, PointsLog, Badge, UserBadge
from pprint import pformat  
from flask import current_app, g
import ast
import logging
from app.controllers.xp_badge_controller import award_xp # Import for awarding XP
import random


def process_star_rating_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """
    Parse star-rating-grid answers robustly, handling various key formats.
    Builds matrices and calculates averages/totals. Includes detailed logging.
    """
    num_rows = len(grid_rows)
    num_cols = len(grid_columns)

    # Ensure grid_data has the necessary keys initialized safely
    # values: Stores the SUM of ratings for a cell
    # count_values: Stores the COUNT of valid ratings for a cell
    # cell_averages: Calculated average (sum/count) for a cell
    grid_data.setdefault("values", [[0.0 for _ in range(num_cols)] for _ in range(num_rows)])
    grid_data.setdefault("count_values", [[0 for _ in range(num_cols)] for _ in range(num_rows)])
    grid_data.setdefault("cell_averages", [[0.0 for _ in range(num_cols)] for _ in range(num_rows)])
    grid_data.setdefault("row_totals", [0 for _ in range(num_rows)]) # Total valid responses/ratings in the row
    grid_data.setdefault("column_totals", [0 for _ in range(num_cols)]) # Total valid responses/ratings in the col
    grid_data.setdefault("row_averages", [0.0 for _ in range(num_rows)])
    grid_data.setdefault("column_averages", [0.0 for _ in range(num_cols)])

    # Pre-normalize labels for efficient lookup
    # Use .get('text', '') for safety and convert to string
    normalized_row_labels = [str(row.get("text", "")).strip().lower() for row in grid_rows]
    normalized_col_labels = [str(col.get("text", "")).strip().lower() for col in grid_columns]
    # Find the index of the "Not Applicable" column if it exists
    na_col_index = next((i for i, col in enumerate(grid_columns) if col.get("isNotApplicable")), -1)

    total_response_count = 0 # Count total responses processed for this question
    log_prefix = "[STAR_GRID_FIX_DEBUG]" # Unique log prefix

    current_app.logger.info(f"{log_prefix} Starting processing for {len(responses)} responses.")
    current_app.logger.info(f"{log_prefix} Row Labels: {normalized_row_labels}")
    current_app.logger.info(f"{log_prefix} Col Labels: {normalized_col_labels}")
    current_app.logger.info(f"{log_prefix} N/A Col Index: {na_col_index}")

    for response in responses:
        total_response_count += 1
        if response.is_not_applicable: continue # Skip if the entire question was marked N/A

        try:
            # Expecting format like: {"row-0": {"col-0": 4, "col-1": "N/A"}, "row-1": {"col-0": 5}}
            # Or: {"new row 1": {"Rating": 4, "coul 2": 3}, "row 2": {"Rating": 5}}
            parsed = json.loads(response.response_text)
        except Exception as e:
            current_app.logger.warning(f"{log_prefix} Resp {response.id}: JSON parse error for text '{response.response_text}'. Error: {e}.")
            continue
        if not isinstance(parsed, dict):
            current_app.logger.warning(f"{log_prefix} Resp {response.id}: Parsed data is not a dict ({type(parsed)}). Skipping.")
            continue

        current_app.logger.info(f"{log_prefix} Resp {response.id}: Processing dict: {pformat(parsed)}")

        for row_key, col_dict in parsed.items():
            row_idx = None
            s_row_key = str(row_key) # Ensure string for matching
            normalized_row_key = s_row_key.strip().lower()

            # -------- FIXED: Row Index Resolution with Logging --------
            try:
                # 1. Try direct normalized text match (most reliable if labels are keys)
                row_idx = normalized_row_labels.index(normalized_row_key)
                current_app.logger.info(f"{log_prefix} Resp {response.id}: Row Key '{s_row_key}' matched TEXT label at index {row_idx}.")
            except ValueError:
                # 2. Try regex "row-X" or similar match
                m = re.match(r"row[-_\s]?(\d+)$", s_row_key, re.I) # Match "row-0", "row_0", "row 0", etc.
                if m:
                    try:
                        row_idx = int(m.group(1))
                        current_app.logger.info(f"{log_prefix} Resp {response.id}: Row Key '{s_row_key}' matched REGEX to index {row_idx}.")
                    except ValueError:
                        current_app.logger.warning(f"{log_prefix} Resp {response.id}: Row Key '{s_row_key}' matched REGEX but group was not int: '{m.group(1)}'. Skipping row.")
                        continue # Skip if regex group isn't an int
                else:
                    # 3. Try direct integer conversion (e.g., key is "0")
                    try:
                        row_idx = int(s_row_key)
                        current_app.logger.info(f"{log_prefix} Resp {response.id}: Row Key '{s_row_key}' matched INT to index {row_idx}.")
                    except (ValueError, TypeError):
                        current_app.logger.warning(f"{log_prefix} Resp {response.id}: Cannot resolve row key '{s_row_key}' by any method. SKIPPING ROW.")
                        continue # Skip this row entirely if key cannot be resolved

            # Check bounds AFTER attempting all methods
            if row_idx is None or not (0 <= row_idx < num_rows):
                current_app.logger.warning(f"{log_prefix} Resp {response.id}: Resolved row index {row_idx} OUT OF BOUNDS (0-{num_rows-1}) for key '{s_row_key}'. SKIPPING ROW.")
                continue

            # -------- Process Columns for the matched row --------
            if not isinstance(col_dict, dict):
                 # Handle case where row value isn't a dict (e.g., maybe "N/A" for the whole row)
                 if col_dict == "N/A":
                     current_app.logger.info(f"{log_prefix} Resp {response.id}: Row '{s_row_key}' (Idx {row_idx}) marked as N/A entirely.")
                     # Optionally increment row_total if N/A counts as a response for the row
                     # grid_data["row_totals"][row_idx] += 1
                 else:
                    current_app.logger.warning(f"{log_prefix} Resp {response.id}: Expected dict for columns in row '{s_row_key}' (Idx {row_idx}), got {type(col_dict)}. Skipping row.")
                 continue

            for col_key, rating in col_dict.items():
                col_idx = None
                s_col_key = str(col_key)
                normalized_col_key = s_col_key.strip().lower()

                # -------- FIXED: Column Index Resolution with Logging --------
                try:
                    # 1. Try direct normalized text match
                    col_idx = normalized_col_labels.index(normalized_col_key)
                    current_app.logger.info(f"{log_prefix} Resp {response.id}: Col Key '{s_col_key}' matched TEXT label at index {col_idx} (RowIdx {row_idx}).")
                except ValueError:
                    # 2. Try regex "col-X" or similar match
                    m = re.match(r"col[-_\s]?(\d+)$", s_col_key, re.I)
                    if m:
                        try:
                            col_idx = int(m.group(1))
                            current_app.logger.info(f"{log_prefix} Resp {response.id}: Col Key '{s_col_key}' matched REGEX to index {col_idx} (RowIdx {row_idx}).")
                        except ValueError:
                            current_app.logger.warning(f"{log_prefix} Resp {response.id}: Col Key '{s_col_key}' matched REGEX but group not int: '{m.group(1)}' (RowIdx {row_idx}). Skipping col.")
                            continue
                    else:
                        # 3. Try direct integer conversion
                        try:
                            col_idx = int(s_col_key)
                            current_app.logger.info(f"{log_prefix} Resp {response.id}: Col Key '{s_col_key}' matched INT to index {col_idx} (RowIdx {row_idx}).")
                        except (ValueError, TypeError):
                             current_app.logger.warning(f"{log_prefix} Resp {response.id}: Cannot resolve col key '{s_col_key}' for row '{s_row_key}' (Idx {row_idx}). SKIPPING COL.")
                             continue

                # Check bounds AFTER attempting all methods
                if col_idx is None or not (0 <= col_idx < num_cols):
                    current_app.logger.warning(f"{log_prefix} Resp {response.id}: Resolved col index {col_idx} OUT OF BOUNDS (0-{num_cols-1}) for key '{s_col_key}' (RowIdx {row_idx}). SKIPPING COL.")
                    continue
                # Skip if this IS the Not Applicable column (we don't process ratings for it)
                # if col_idx == na_col_index:
                #    current_app.logger.info(f"{log_prefix} Resp {response.id}: Skipping N/A column (Index {na_col_index}) at [{row_idx}][{col_idx}].")
                #    continue # Continue to next column key

                # -------- Process Rating Value --------
                if rating == "N/A":
                    current_app.logger.info(f"{log_prefix} Resp {response.id}: Cell [{row_idx}][{col_idx}] marked as N/A. Incrementing count only.")
                    # Only increment count, do not add to value sum
                    grid_data["count_values"][row_idx][col_idx] += 1
                    # Decide if N/A contributes to row/column totals (depends on definition)
                    # Let's assume an N/A choice *is* a response for that row/column
                    grid_data["row_totals"][row_idx] += 1
                    grid_data["column_totals"][col_idx] += 1
                    continue # Move to next column/rating pair

                # Try to convert rating to float
                rating_val = None
                try:
                    if isinstance(rating, (int, float)):
                         rating_val = float(rating)
                    elif isinstance(rating, str):
                         cleaned_rating = rating.strip()
                         # Check if it's a valid number representation
                         if cleaned_rating.replace('.', '', 1).replace('-', '', 1).isdigit():
                              rating_val = float(cleaned_rating)

                    if rating_val is None:
                         current_app.logger.warning(f"{log_prefix} Resp {response.id}: Invalid rating format '{rating}' at [{row_idx}][{col_idx}]. Skipping cell value.")
                         # Still increment count if needed? Or skip entirely? Let's skip value update but maybe count as response.
                         grid_data["count_values"][row_idx][col_idx] += 1 # Count that *some* response was given
                         grid_data["row_totals"][row_idx] += 1
                         grid_data["column_totals"][col_idx] += 1
                         continue

                    # ---> Log SUCCESS before incrementing <---
                    current_app.logger.info(f"{log_prefix} Resp {response.id}: SUCCESS -> Updating values/counts at [{row_idx}][{col_idx}] with rating {rating_val}")

                    # Increment SUM of ratings and COUNT of valid ratings
                    grid_data["values"][row_idx][col_idx] += rating_val
                    grid_data["count_values"][row_idx][col_idx] += 1
                    grid_data["row_totals"][row_idx] += 1
                    grid_data["column_totals"][col_idx] += 1

                except Exception as e_inner:
                    current_app.logger.error(f"{log_prefix} Resp {response.id}: Unexpected error processing rating '{rating}' at [{row_idx}][{col_idx}]: {e_inner}")
                    # Increment counts? Or skip? Let's be conservative and skip.
                    continue

    # --- Compute Averages & Final Totals ---

    # Compute cell averages
    for r in range(num_rows):
        for c in range(num_cols):
            count = grid_data["count_values"][r][c]
            total_value = grid_data["values"][r][c]
            # Calculate average only if there's at least one valid numeric rating
            if count > 0 and total_value > 0: # Ensure value is also > 0 to exclude cells with only N/A counts
                grid_data["cell_averages"][r][c] = round(total_value / count, 2)
            else:
                grid_data["cell_averages"][r][c] = 0.0 # Default to 0 if no valid ratings

    # Compute row averages (sum of valid ratings / count of valid ratings in the row)
    for r in range(num_rows):
        row_rating_sum = 0.0
        row_valid_rating_count = 0
        for c in range(num_cols):
             # Only include cells with valid numeric ratings
             if grid_data["count_values"][r][c] > 0 and grid_data["values"][r][c] > 0:
                  row_rating_sum += grid_data["values"][r][c] # Use the summed value
                  row_valid_rating_count += grid_data["count_values"][r][c] # Use the count

        if row_valid_rating_count > 0:
            grid_data["row_averages"][r] = round(row_rating_sum / row_valid_rating_count, 2)
        else:
            grid_data["row_averages"][r] = 0.0 # Default if no valid ratings in row

    # Compute column averages (sum of valid ratings / count of valid ratings in the column)
    for c in range(num_cols):
        col_rating_sum = 0.0
        col_valid_rating_count = 0
        for r in range(num_rows):
             # Only include cells with valid numeric ratings
             if grid_data["count_values"][r][c] > 0 and grid_data["values"][r][c] > 0:
                  col_rating_sum += grid_data["values"][r][c]
                  col_valid_rating_count += grid_data["count_values"][r][c]

        if col_valid_rating_count > 0:
            grid_data["column_averages"][c] = round(col_rating_sum / col_valid_rating_count, 2)
        else:
             grid_data["column_averages"][c] = 0.0 # Default if no valid ratings in column

    # Set the overall total responses processed for this question
    grid_data["total_responses"] = total_response_count
    current_app.logger.info(f"{log_prefix} Final Processed Grid Data: \n{pformat(grid_data)}")
    return grid_data
def map_age_to_group(age):
    """Map numeric age to standardized age group"""
    if age is None:
        return None
    if isinstance(age, str) and '-' in age:
        return age
    try:
        age_num = int(age)
        if age_num < 18:
            return "Under 18"
        elif age_num <= 24:
            return "18-24"
        elif age_num <= 34:
            return "25-34"
        elif age_num <= 44:
            return "35-44"
        elif age_num <= 54:
            return "45-54"
        elif age_num <= 64:
            return "55-64"
        else:
            return "65+"
    except (ValueError, TypeError):
        return None

class ResponseController:

    @staticmethod
    def submit_responses(data):
        # [DEBUG] Comprehensive debugging for XP and survey completion tracking, now using g.current_user
        def debug_user_state(user_id, stage, additional_info=None):
            """Debug helper to log user state at different stages"""
            if not user_id:
                current_app.logger.info(f"[XP_DEBUG_{stage}] No user_id provided, skipping user state debug")
                return None
                
            user = User.query.get(user_id)
            if not user:
                current_app.logger.error(f"[XP_DEBUG_{stage}] User {user_id} not found!")
                return None
                
            # Get user's points logs for this session
            recent_logs = PointsLog.query.filter_by(user_id=user_id).order_by(PointsLog.created_at.desc()).limit(5).all()
            log_data = [{"id": log.id, "activity": log.activity_type, "points": log.points_awarded, "created": log.created_at.isoformat()} for log in recent_logs]
            
            # Get user's badges
            user_badges = UserBadge.query.filter_by(user_id=user_id).all()
            badges_data = [{"badge_id": ub.badge_id, "earned_at": ub.earned_at.isoformat()} for ub in user_badges]
            
            state = {
                "user_id": user_id,
                "username": user.username,
                "email": user.email,
                "xp_balance": user.xp_balance,
                "total_xp_earned": user.total_xp_earned,
                "surveys_completed_count": user.surveys_completed_count,
                "recent_points_logs": log_data,
                "badges_count": len(badges_data),
                "badges": badges_data
            }
            
            current_app.logger.info(f"[XP_DEBUG_{stage}] User State: {json.dumps(state, indent=2)}")
            if additional_info:
                current_app.logger.info(f"[XP_DEBUG_{stage}] Additional Info: {json.dumps(additional_info, indent=2)}")
            
            return state

        def should_skip_question(question, responses, survey):
            rules = question.conditional_logic_rules
            if not rules:
                return False
            if isinstance(rules, str):
                try:
                    rules = json.loads(rules)
                except Exception:
                    return False
            base_seq = rules.get('baseQuestionSequence')
            if base_seq is None:
                return False
            base_response = responses.get(str(base_seq))
            if base_response is None or base_response == '' or (isinstance(base_response, list) and len(base_response) == 0):
                return True
            base_question = next((q for q in survey.questions if q.sequence_number == base_seq), None)
            if not base_question:
                return False
            cond_val = rules.get('conditionValue')
            cond_type = rules.get('conditionType') or 'equals'
            try:
                if cond_type == 'not_equals':
                    return base_response == cond_val
                # default equals
                if isinstance(base_response, list):
                    return cond_val not in base_response
                return base_response != cond_val
            except Exception:
                return False

        try:
            # ... (existing setup: survey_id, responses_data, etc.) ...
            current_app.logger.info(
                "[SUBMIT‑DEBUG] Incoming submit_responses payload:\n%s",
                pformat(data, width=120)
            )
            # Pull values out of JSON
            survey_id = data.get('survey_id')
            responses_data = data.get('responses')
            duration = data.get('duration')
            survey_link_id = data.get('survey_link_id')
            user_id = data.get('user_id')
            user_agent = data.get('user_agent')
            response_times = data.get('response_times', {})
            is_ai_generated = data.get('is_ai_generated', False) # Get the new flag

            # Instead of data.get('user_id'), fetch from g.current_user (because the route decorator enforced authentication)
            user = None  # Initialize user variable
            is_admin_user = False  # Track if current user is an Admin
            try:
                if not user_id:
                    user = g.current_user
                    user_id = user.id
                else:
                    # Even if user_id was provided, get user from g.current_user for consistency
                    user = g.current_user
                    if user.id != user_id:
                        current_app.logger.warning(f"[RESP_CTRL] user_id mismatch: g.current_user.id={user.id} vs provided user_id={user_id}")
                        # Use the authenticated user's ID for security
                        user_id = user.id
                
                # Detect if the current user is an Admin (check the class type or role)
                from app.models import Admin
                is_admin_user = isinstance(user, Admin) or (hasattr(user, 'role') and user.role in ['super_admin', 'business_admin'])
                current_app.logger.info(f"[SUBMIT-CTRL] User type: {'Admin' if is_admin_user else 'User'}, role: {getattr(user, 'role', 'N/A')}, user_id = {user_id}")
                
            except Exception as e:
                # If somehow g.current_user is None, bail out
                current_app.logger.error(f"[RESP_CTRL] g.current_user missing or invalid: {e}", exc_info=True)
                return {"error": "Authentication error: user missing"}, 401

            current_app.logger.info(f"[SUBMIT-CTRL] Using authenticated user_id = {user_id} for survey submission")

            # Ensure we have a valid user object
            if not user:
                current_app.logger.error(f"[RESP_CTRL] User object is None after setting from g.current_user")
                return {"error": "Authentication error: user object missing"}, 401

            # [DEBUG] Log initial user state BEFORE any database operations (only for User objects, not Admins)
            initial_state = None
            if not is_admin_user:
                initial_state = debug_user_state(user_id, "INITIAL", {
                    "survey_id": survey_id,
                    "submission_start": datetime.datetime.now().isoformat(),
                    "note": "using g.current_user.id"
                })

            survey = Survey.query.get(survey_id)
            if not survey: return {"error": "Survey not found"}, 404

            # Check existing completed submission to prevent duplicates
            # Allow admin users (super_admin and business_admin) and AI-generated responses to submit multiple responses
            # but restrict regular users to one response per survey
            if not is_admin_user and not is_ai_generated:  # Only check for duplicates for regular users
                existing_completed = Submission.query.filter_by(
                    user_id=user_id,
                    survey_id=survey_id,
                    is_complete=True
                ).first()
                if existing_completed:
                    current_app.logger.info(
                        f"[SUBMIT_DUPLICATE] Regular user {user_id} attempted to retake survey {survey_id}"
                    )
                    return {"error": "You have already completed this survey."}, 400
            elif is_ai_generated:
                current_app.logger.info(
                    f"[SUBMIT_AI_MULTI] AI-generated response for survey {survey_id} (multiple responses allowed)"
                )
            else:
                current_app.logger.info(
                    f"[SUBMIT_ADMIN_MULTI] Admin user {user_id} submitting response to survey {survey_id} (multiple responses allowed)"
                )

            submission = Submission(
                survey_id=survey_id,
                duration=duration,
                survey_link_id=survey_link_id,
                user_id=user_id,
                user_agent=(user_agent.get('userAgent') if user_agent else None)
            )
            if user_agent:
                submission.device_type = user_agent.get('deviceType')
                submission.browser_info = user_agent.get('browserInfo')

            # --- MODIFIED: Handle demographics for AI vs. real users vs. Admins ---
            submission.is_ai_generated = is_ai_generated
            if is_ai_generated:
                # For AI-generated responses, create random demographic data
                current_app.logger.info(f"[SUBMIT-CTRL] Populating randomized demographics for AI-generated submission for survey {survey_id}")
                submission.age_group = map_age_to_group(random.randint(18, 70))
                submission.gender = random.choice(['Male', 'Female', 'Other', 'Prefer not to say'])
                submission.location = random.choice(['USA', 'Canada', 'UK', 'Australia', 'Germany', 'France', 'India', 'Other'])
                submission.education = random.choice(['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other'])
                submission.company = "AI Generated Company"
            elif is_admin_user:
                # For Admin users, use random demographic data if missing from submission metadata
                current_app.logger.info(f"[SUBMIT-CTRL] Populating randomized demographics for Admin submission for survey {survey_id}")
                submission.age_group = map_age_to_group(random.randint(25, 65))
                submission.gender = random.choice(['Male', 'Female', 'Other', 'Prefer not to say'])
                submission.location = random.choice(['USA', 'Canada', 'UK', 'Australia', 'Germany', 'France', 'India', 'Other'])
                submission.education = random.choice(['Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Professional'])
                submission.company = random.choice(['Government', 'Private Sector', 'Non-profit', 'Educational Institution', 'Healthcare', 'Technology'])
            elif user:
                # For real User objects, get demographics if they exist
                if hasattr(user, 'age'):
                    submission.age_group = map_age_to_group(user.age)
                if hasattr(user, 'gender'):
                    submission.gender = user.gender
                if hasattr(user, 'location'):
                    submission.location = user.location
                if hasattr(user, 'education'):
                    submission.education = user.education
                if hasattr(user, 'company'):
                    submission.company = user.company

            # Use a dictionary for response data lookup
            responses_data = data.get('responses', {})
            response_times = data.get('response_times', {})

            # Check if submission is complete
            # A submission is complete if all 'required' questions have a response
            all_required_questions_answered = True
            for q in survey.questions:
                if not q.required:
                    continue
                if q.conditional_logic_rules and should_skip_question(q, responses_data, survey):
                    continue
                seq_str = str(q.sequence_number)
                if seq_str not in responses_data or not responses_data[seq_str]:
                    all_required_questions_answered = False
                    current_app.logger.warning(
                        f"[SUBMIT_VALIDATION] Required question {seq_str} is missing a response for submission on survey {survey_id}."
                    )
                    break
            
            submission.is_complete = all_required_questions_answered
            
            if submission.is_complete:
                current_app.logger.info(f"[SUBMIT_COMPLETE] Submission for survey {survey_id} by user {user_id} is marked as COMPLETE.")
            else:
                current_app.logger.info(f"[SUBMIT_INCOMPLETE] Submission for survey {survey_id} by user {user_id} is marked as INCOMPLETE.")

            db.session.add(submission)
            db.session.flush()

            # --- MODIFIED: XP and survey count logic only for real Users, not Admins or AI submissions ---
            # This logic should not run for AI-generated responses or when an Admin is the actor,
            # as Admins do not have the same gamification attributes as Users.
            if not is_ai_generated and not is_admin_user and hasattr(user, 'surveys_completed_count'):
                # Check if this is the first submission for this user and survey
                first_submission_for_survey = False
                if survey_id:
                    previous_completed_count = Submission.query.filter(
                        Submission.user_id == user_id,
                        Submission.survey_id == survey_id,
                        Submission.is_complete == True,
                        Submission.id != submission.id  # Exclude current submission
                    ).count()

                    current_app.logger.info(f"[XP_DEBUG_FIRST_CHECK] User {user_id} has {previous_completed_count} previous completed submissions for survey {survey_id}")

                    if previous_completed_count == 0:
                        first_submission_for_survey = True
                        # Use `user` from g; no need to re-query
                        old_count = user.surveys_completed_count or 0
                        user.surveys_completed_count = old_count + 1
                        db.session.add(user)
                        current_app.logger.info(f"[SURVEY_COUNT_UPDATE] User {user_id} completed survey {survey_id} for the first time. Count updated from {old_count} to {user.surveys_completed_count}")
                    else:
                        current_app.logger.info(f"[XP_DEBUG_FIRST_CHECK] User {user_id} has already completed survey {survey_id}. Not incrementing surveys_completed_count.")

                # [DEBUG] Log state after survey completion count update but before XP
                debug_user_state(user_id, "AFTER_SURVEY_COUNT", {
                    "first_submission_for_survey": first_submission_for_survey,
                    "previous_completed_count": previous_completed_count if 'previous_completed_count' in locals() else 'N/A'
                })

                # Award XP after processing all questions - dynamic calculation based on question count
                if first_submission_for_survey:
                    from app.utils.xp_calculator import calculate_survey_xp
                    question_count = survey.questions.count()
                    xp_to_award = calculate_survey_xp(question_count)
                    current_app.logger.info(f"[XP_DEBUG_AWARD] Awarding {xp_to_award} XP to user {user_id} for first completion of survey {survey_id} ({question_count} questions)")
                    award_xp(user_id, xp_to_award, 'SURVEY_COMPLETED', related_item_id=survey_id)
                else:
                    current_app.logger.info(f"[XP_DEBUG_AWARD] Not awarding XP to user {user_id} (not first completion)")

                # [DEBUG] Final user state check
                debug_user_state(user_id, "FINAL")
            else:
                current_app.logger.info(f"[SUBMIT-CTRL] Skipping XP and user stat updates for {'AI-generated submission' if is_ai_generated else 'Admin user' if is_admin_user else 'unknown reason'}.")

            for question in survey.questions:
                seq_num_str = str(question.sequence_number)
                if seq_num_str in data['responses']:
                    answer_payload = data['responses'][seq_num_str]
                    answer_text = None; file_path = None; file_type = None
                    is_na = False; is_other = False; other_text_val = None

                    if answer_payload is not None:
                        q_type = question.question_type
                        # Handle response format based on type
                        if q_type in ['checkbox', 'multi-choice', 'multiple-image-select']:
                            if isinstance(answer_payload, list):
                                answer_text = json.dumps(answer_payload)
                            else:
                                answer_text = json.dumps([str(answer_payload)])

                        elif q_type == 'interactive-ranking':
                            # If we already got a dict, JSON‑encode it
                            if isinstance(answer_payload, dict):
                                answer_text = json.dumps(answer_payload)
                                current_app.logger.debug(f"[SUBMIT_PROCESSING] Q {seq_num_str} (Ranking): Stored JSON string: {answer_text}")

                            # If it came in as a one‑item list of a dict‑string, unwrap and parse
                            elif isinstance(answer_payload, list) and len(answer_payload) == 1 and isinstance(answer_payload[0], str):
                                import ast
                                try:
                                    dict_payload = ast.literal_eval(answer_payload[0])
                                    if isinstance(dict_payload, dict):
                                        answer_text = json.dumps(dict_payload)
                                        current_app.logger.debug(f"[SUBMIT_PROCESSING] Q {seq_num_str} (Ranking): Unwrapped and stored: {answer_text}")
                                    else:
                                        raise ValueError("Not a dict after literal_eval")
                                except Exception as e:
                                    current_app.logger.error(f"[SUBMIT_PROCESSING] Q {seq_num_str} (Ranking): Failed to parse wrapped string: {e}")
                                    answer_text = answer_payload[0]

                            # Anything else is unexpected—log and store raw
                            else:
                                current_app.logger.error(
                                    f"[SUBMIT_PROCESSING] Q {seq_num_str} (Ranking): Unexpected payload type {type(answer_payload)}. Storing raw."
                                )
                                answer_text = str(answer_payload)

                        elif q_type == 'single-image-select':
                             # Stores the single hidden_label directly
                             answer_text = str(answer_payload)
                        elif q_type == 'star-rating-grid':
                            answer_text = json.dumps(answer_payload) if isinstance(answer_payload, dict) else str(answer_payload)
                            # REMOVED: debug_answers.append(...) - this was causing the linter error
                            
                        elif q_type == 'document-upload':
                            if isinstance(answer_payload, list) and answer_payload:
                                answer_text = json.dumps(answer_payload)
                                file_path = answer_payload[0].get('url'); file_type = answer_payload[0].get('type')
                            else: answer_text = '[]'
                        else: # Single choice, rating, text, etc.
                            answer_text = str(answer_payload)

                        # ... (N/A and Other checks remain the same) ...
                        na_text = question.not_applicable_text or "Not Applicable"
                        if isinstance(answer_text, str) and answer_text.strip().lower() == na_text.strip().lower():
                            is_na = True; answer_text = na_text
                        if question.has_other_option and isinstance(answer_text, str) and answer_text.startswith('other:'):
                            is_other = True; other_text_val = answer_text[6:]; answer_text = "Other"

                        resp = Response(
                            submission_id=submission.id, question_id=question.id,
                            response_text=answer_text, response_time=response_times.get(str(seq_num_str)),
                            file_path=file_path, file_type=file_type, is_not_applicable=is_na,
                            is_other=is_other, other_text=other_text_val
                        )
                        db.session.add(resp)

            # [DEBUG] Log state before XP awarding (only for User objects)
            if not is_ai_generated and not is_admin_user and hasattr(user, 'surveys_completed_count'):
                debug_user_state(user_id, "BEFORE_XP", {"submission_complete": submission.is_complete})

            # [DEBUG] Log state after XP awarding but before commit (only for User objects)
            if not is_ai_generated and not is_admin_user and hasattr(user, 'surveys_completed_count'):
                 debug_user_state(user_id, "AFTER_XP_BEFORE_COMMIT", {"note": "just before db.session.commit()"})

            # [DEBUG] Log that we're about to commit
            current_app.logger.info(f"[XP_DEBUG_COMMIT] About to commit transaction for submission {submission.id}")
            
            db.session.commit()
            
            current_app.logger.info(f"[XP_DEBUG_COMMIT_SUCCESS] Transaction committed successfully for submission {submission.id}")
            
            # [DEBUG] Log final state after commit to verify persistence (only for User objects)
            if not is_ai_generated and not is_admin_user and hasattr(user, 'surveys_completed_count'):
                final_state = debug_user_state(user_id, "FINAL_AFTER_COMMIT", {
                    "submission_id": submission.id,
                    "submission_complete": submission.is_complete
                })

                # [DEBUG] Compare initial vs final state
                if initial_state and final_state:
                    xp_change = final_state['xp_balance'] - initial_state['xp_balance']
                    total_xp_change = final_state['total_xp_earned'] - initial_state['total_xp_earned']
                    survey_count_change = final_state['surveys_completed_count'] - initial_state['surveys_completed_count']
                    
                    current_app.logger.info(f"[XP_DEBUG_SUMMARY] Changes for user {user_id}:")
                    current_app.logger.info(f"[XP_DEBUG_SUMMARY] XP Balance: {initial_state['xp_balance']} -> {final_state['xp_balance']} (change: {xp_change})")
                    current_app.logger.info(f"[XP_DEBUG_SUMMARY] Total XP: {initial_state['total_xp_earned']} -> {final_state['total_xp_earned']} (change: {total_xp_change})")
                    current_app.logger.info(f"[XP_DEBUG_SUMMARY] Survey Count: {initial_state['surveys_completed_count']} -> {final_state['surveys_completed_count']} (change: {survey_count_change})")
                    current_app.logger.info(f"[XP_DEBUG_SUMMARY] Badges: {initial_state['badges_count']} -> {final_state['badges_count']} (change: {final_state['badges_count'] - initial_state['badges_count']})")

            return {"message": "Responses submitted successfully", "submission_id": submission.id}, 201

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[XP_DEBUG_ERROR] Exception during submit_responses for user {user_id}: {e}", exc_info=True)
            
            # [DEBUG] Log user state after rollback (only for User objects)
            if not is_admin_user:
                debug_user_state(user_id, "AFTER_ROLLBACK", {"error": str(e)})
            
            import traceback
            print(f"Error submitting responses: {traceback.format_exc()}")
            return {"error": str(e)}, 500

    # DEPRECATED: get_live_responses method removed 
    # Now handled by LiveResponsesController which returns proper data format with pagination

    @staticmethod
    def get_all_responses(survey_id, page=1, per_page=50):
        """
        Get all responses for a survey with pagination and detailed information.
        Returns all submissions with their responses, user info, and metadata.
        """
        try:
            from app.models import Survey, Submission, Response, Question, User, Admin
            
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            # Build query for submissions
            query = Submission.query.filter_by(survey_id=survey_id).order_by(Submission.submitted_at.desc())
            
            # Paginate results
            try:
                pagination = query.paginate(
                    page=page, 
                    per_page=per_page, 
                    error_out=False
                )
                submissions = pagination.items
                total_submissions = pagination.total
                total_pages = pagination.pages
            except Exception as e:
                current_app.logger.error(f"Error paginating responses for survey {survey_id}: {e}")
                # Fallback to non-paginated results
                submissions = query.all()
                total_submissions = len(submissions)
                total_pages = 1

            responses_data = []
            for submission in submissions:
                # Get user information (handle both User and Admin types)
                user_info = {"id": submission.user_id, "name": "Unknown", "email": "N/A", "type": "unknown"}
                if submission.user_id:
                    # Try User first
                    user = User.query.get(submission.user_id)
                    if user:
                        user_info = {
                            "id": user.id,
                            "name": user.name or user.username,
                            "email": user.email,
                            "type": "user",
                            "role": getattr(user, 'role', 'user')
                        }
                    else:
                        # Try Admin
                        admin = Admin.query.get(submission.user_id)
                        if admin:
                            user_info = {
                                "id": admin.id,
                                "name": admin.name or admin.username,
                                "email": admin.email,
                                "type": "admin",
                                "role": "super_admin"
                            }

                # Get all responses for this submission
                submission_responses = []
                responses = Response.query.filter_by(submission_id=submission.id).order_by(Response.question_id).all()
                
                for response in responses:
                    question = Question.query.get(response.question_id)
                    response_data = {
                        "response_id": response.id,
                        "question_id": response.question_id,
                        "question_text": question.question_text if question else "Unknown Question",
                        "question_type": question.question_type if question else "unknown",
                        "sequence_number": question.sequence_number if question else None,
                        "response_text": response.response_text,
                        "is_not_applicable": response.is_not_applicable,
                        "is_other": response.is_other,
                        "other_text": response.other_text,
                        "file_path": response.file_path,
                        "file_type": response.file_type,
                        "response_time": response.response_time,
                        "created_at": response.created_at.isoformat() if response.created_at else None
                    }
                    submission_responses.append(response_data)

                # Compile submission data
                submission_data = {
                    "submission_id": submission.id,
                    "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                    "duration": submission.duration,
                    "is_complete": submission.is_complete,
                    "is_ai_generated": submission.is_ai_generated,
                    "survey_link_id": submission.survey_link_id,
                    "user": user_info,
                    "demographics": {
                        "age_group": submission.age_group,
                        "gender": submission.gender,
                        "location": submission.location,
                        "education": submission.education,
                        "company": submission.company,
                        "cohort_tag": submission.cohort_tag
                    },
                    "device_info": {
                        "user_agent": submission.user_agent,
                        "device_type": submission.device_type,
                        "browser_info": submission.browser_info,
                        "ip_address": submission.ip_address
                    },
                    "responses": submission_responses,
                    "response_count": len(submission_responses)
                }
                responses_data.append(submission_data)

            result = {
                "survey_id": survey_id,
                "survey_title": survey.title,
                "total_responses": total_submissions,
                "page": page,
                "per_page": per_page,
                "total_pages": total_pages,
                "submissions": responses_data
            }

            current_app.logger.info(f"Retrieved {len(responses_data)} responses for survey {survey_id} (page {page}/{total_pages})")
            return result, 200

        except Exception as e:
            current_app.logger.error(f"Error getting responses for survey {survey_id}: {e}", exc_info=True)
            return {"error": f"Failed to retrieve responses: {str(e)}"}, 500

    @staticmethod
    def get_analytics(survey_id):
        """
        Compute overall analytics for a survey.
        """
        try:
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404
            submissions = Submission.query.filter_by(survey_id=survey_id).all()
            analytics = compute_analytics(submissions, survey)
            return analytics, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_analytics_by_link(survey_id, link_id):
        """
        Get analytics for a specific distribution link.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id, survey_link_id=link_id).all()
        if not submissions:
            return {"error": "No responses found for this link"}, 404
        analytics = compute_analytics(submissions, survey)
        link = SurveyLink.query.get(link_id)
        if link:
            analytics['link_info'] = {
                'id': link.id,
                'label': link.label,
                'code': link.code,
                'is_approved': link.is_approved
            }
        return analytics, 200
    

    @staticmethod
    def get_multi_demographic_analytics(survey_id, filters):
        """
        Returns analytics for a given survey, filtered by multiple demographic criteria.
        Enhanced with comprehensive question-level analytics for the filtered data.
        """
        try:
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            print(f"Processing demographic analytics for survey {survey_id} with filters: {filters}")
            query = Submission.query.filter_by(survey_id=survey_id)

            # Apply demographic filters with error handling (Keep existing filter logic)
            try:
                if filters.get("age_group") and isinstance(filters["age_group"], list):
                    query = query.filter(Submission.age_group.in_(filters["age_group"]))
                if filters.get("location"):
                    loc_val = filters["location"]
                    if isinstance(loc_val, list): query = query.filter(Submission.location.in_(loc_val))
                    else: query = query.filter(Submission.location == loc_val)
                if filters.get("education"):
                    edu_val = filters["education"]
                    if isinstance(edu_val, list): query = query.filter(Submission.education.in_(edu_val))
                    else: query = query.filter(Submission.education == edu_val)
                if filters.get("company"):
                    comp_val = filters["company"]
                    if isinstance(comp_val, list): query = query.filter(Submission.company.in_(comp_val))
                    else: query = query.filter(Submission.company == comp_val)
                if filters.get("gender"):
                    gender_val = filters["gender"]
                    if isinstance(gender_val, list): query = query.filter(Submission.gender.in_(gender_val))
                    else: query = query.filter(Submission.gender == gender_val)
            except Exception as e:
                print(f"Error applying demographic filters: {e}")

            submissions = query.all()
            if not submissions:
                return {
                    "survey_id": survey_id,
                    "filters_applied": filters,
                    "error": "No submissions match these demographic filters"
                }, 404

            submission_count = len(submissions)
            print(f"Found {submission_count} matching submissions")
            submission_ids = [s.id for s in submissions]

            # Initialize the results structure
            results = {
                "total_responses": submission_count,
                "survey_id": survey_id,
                "filters_applied": filters,
                "question_stats": {},
                "demographics": {} # Keep demographic breakdown logic
            }

            # Process question-level analytics using the filtered function
            try:
                print("Processing question-level analytics with filters...")
                question_stats = {}

                for question in survey.questions:
                    # Use get_filtered_question_analytics to get stats for this specific question + filters
                    q_analytics, status = ResponseController.get_filtered_question_analytics(survey_id, question.id, filters)

                    if status == 200 and q_analytics and q_analytics.get('total_responses', 0) > 0:
                        question_stats[str(question.id)] = q_analytics # Store the detailed analytics object
                    elif status != 200:
                         print(f"Warning: Failed to get filtered analytics for Q {question.id}: Status {status}, Error: {q_analytics.get('error')}")


                results["question_stats"] = question_stats
                print(f"Processed {len(question_stats)} questions with filtered response data")

            except Exception as e:
                import traceback
                print(f"Error processing filtered question analytics: {e}")
                print(traceback.format_exc())
                results["question_stats"] = {}
                results["question_stats_error"] = str(e)

            # Process demographics breakdown (Keep existing logic)
            try:
                print("Processing demographics breakdown...")
                demographics = { 'age_groups': {}, 'locations': {}, 'genders': {}, 'education': {}, 'companies': {}, 'cohorts': {} }
                for sub in submissions:
                    try:
                        age_group = sub.age_group or "Unknown"; demographics['age_groups'][age_group] = demographics['age_groups'].get(age_group, 0) + 1
                        location = sub.location or "Unknown"; demographics['locations'][location] = demographics['locations'].get(location, 0) + 1
                        gender = sub.gender or "Unknown"; demographics['genders'][gender] = demographics['genders'].get(gender, 0) + 1
                        education = sub.education or "Unknown"; demographics['education'][education] = demographics['education'].get(education, 0) + 1
                        company = sub.company or "Unknown"; demographics['companies'][company] = demographics['companies'].get(company, 0) + 1
                        cohort = sub.cohort_tag or "Unknown"; demographics['cohorts'][cohort] = demographics['cohorts'].get(cohort, 0) + 1
                    except Exception as e: print(f"Error processing demographics for submission {sub.id}: {e}"); continue

                for category in demographics:
                    for key, count in list(demographics[category].items()):
                        demographics[category][key] = { 'count': count, 'percentage': round((count / submission_count * 100), 2) }
                results["demographics"] = demographics
                print(f"Demographics processed successfully")
            except Exception as e:
                print(f"Error processing demographics breakdown: {e}")
                results["demographics"] = { 'age_groups': {}, 'locations': {}, 'genders': {}, 'education': {}, 'companies': {}, 'cohorts': {} }


            return results, 200

        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return {"error": str(e)}, 500  
  
    @staticmethod
    def get_merged_analytics_advanced(survey_id, link_ids):
        """
        Merge analytics from selected link_ids. If the same user_id appears multiple times,
        discard all but the earliest submission to avoid duplication. 
        Then compute analytics on the final set. 
        """
        from collections import defaultdict

        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        if not link_ids:
            return {"error": "No link IDs provided"}, 400

        # Pull all submissions from these links
        submissions = Submission.query.filter(
            Submission.survey_id == survey_id,
            Submission.survey_link_id.in_(link_ids)
        ).order_by(Submission.submitted_at.asc()).all()
        if not submissions:
            return {"error": "No submissions found for those links"}, 404

        # Deduplicate by user_id if user_id is present
        # We'll keep track of which user_id we've seen
        unique_submissions = []
        seen_users = set()
        duplicate_count = 0

        for sub in submissions:
            if sub.user_id and sub.user_id in seen_users:
                duplicate_count += 1
                continue
            if sub.user_id:
                seen_users.add(sub.user_id)
            unique_submissions.append(sub)

        # Now compute analytics on unique_submissions
        analytics = compute_analytics(unique_submissions, survey)
        # Tag them with info about merged links
        link_records = SurveyLink.query.filter(SurveyLink.id.in_(link_ids)).all()
        analytics["merged_links"] = [
            {"id": ln.id, "label": ln.label, "code": ln.code} for ln in link_records
        ]
        analytics["duplicates_discarded"] = duplicate_count
        return analytics, 200


 
    @staticmethod
    def get_device_breakdown(survey_id):
        """
        Analyze survey responses by device type.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        if not submissions:
            return {"error": "No submissions found"}, 404
        import random
        devices = ["Desktop", "Mobile", "Tablet"]
        browser_types = ["Chrome", "Firefox", "Safari", "Edge"]
        device_breakdown = { "Desktop": 0, "Mobile": 0, "Tablet": 0 }
        browser_breakdown = { browser: 0 for browser in browser_types }
        for _ in submissions:
            device = random.choice(devices)
            browser = random.choice(browser_types)
            device_breakdown[device] += 1
            browser_breakdown[browser] += 1
        total = len(submissions)
        device_percentages = {device: (count / total * 100) for device, count in device_breakdown.items()}
        browser_percentages = {browser: (count / total * 100) for browser, count in browser_breakdown.items()}
        return {
            "survey_id": survey_id,
            "total_submissions": total,
            "device_breakdown": {
                device: {
                    "count": count,
                    "percentage": round(device_percentages[device], 2)
                } for device, count in device_breakdown.items()
            },
            "browser_breakdown": {
                browser: {
                    "count": count,
                    "percentage": round(browser_percentages[browser], 2)
                } for browser, count in browser_breakdown.items()
            }
        }, 200

    @staticmethod
    def get_response_trends(survey_id, timeframe='daily'):
        """
        Get response submission trends over time.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        if not submissions:
            return {"error": "No submissions found"}, 404
        time_periods = {}
        for sub in submissions:
            if timeframe == 'daily':
                period = sub.submitted_at.strftime('%Y-%m-%d')
            elif timeframe == 'weekly':
                period = f"{sub.submitted_at.isocalendar()[0]}-W{sub.submitted_at.isocalendar()[1]}"
            elif timeframe == 'monthly':
                period = sub.submitted_at.strftime('%Y-%m')
            elif timeframe == 'hourly':
                period = sub.submitted_at.strftime('%Y-%m-%d %H:00')
            else:
                period = sub.submitted_at.strftime('%Y-%m-%d')
            if period not in time_periods:
                time_periods[period] = 0
            time_periods[period] += 1
        sorted_periods = sorted(time_periods.items())
        trend_data = [{"period": period, "count": count} for period, count in sorted_periods]
        cumulative = 0
        for item in trend_data:
            cumulative += item["count"]
            item["cumulative"] = cumulative
        peak_period = max(trend_data, key=lambda x: x["count"]) if trend_data else None
        avg_submissions = sum(item["count"] for item in trend_data) / len(trend_data) if trend_data else 0
        return {
            "survey_id": survey_id,
            "timeframe": timeframe,
            "total_submissions": len(submissions),
            "trend_data": trend_data,
            "peak_period": peak_period,
            "average_submissions_per_period": round(avg_submissions, 2)
        }, 200

    @staticmethod
    def get_open_ended_responses_with_users(survey_id, question_id, limit=10):
        """
        Get open-ended responses with user information and word cloud analysis.
        Enhanced to better show user names.
        """
        question = Question.query.get(question_id)
        if not question or question.survey_id != int(survey_id):
            return {"error": "Question not found"}, 404
        if question.question_type != 'open-ended':
            return {"error": "This endpoint is only for open-ended questions"}, 400

        response_data = []
        responses = Response.query.filter_by(question_id=question_id).order_by(Response.created_at.desc()).limit(limit).all()
        
        for r in responses:
            submission = Submission.query.get(r.submission_id)
            if not submission:
                continue
                
            # Default to Anonymous
            user_name = "Anonymous"
            user_id = None
            
            # Try to get user information
            if submission.user_id:
                user = User.query.get(submission.user_id)
                if user:
                    # Use name, username, or email in that order of preference
                    user_id = user.id
                    print(f"Found user for response: {user_name} (ID: {user_id})")
                else:
                    print(f"User not found for submission with user_id: {submission.user_id}")
            else:
                print(f"No user_id associated with submission: {submission.id}")
                
            # Add response time information if available
            response_time = None
            if r.response_time:
                response_time = f"{r.response_time} seconds"
                
            response_data.append({
                "response_id": r.id,
                "response_text": r.response_text,
                "created_at": r.created_at.isoformat(),
                "user_name": user_name,
                "user_id": user_id,
                "submission_id": submission.id,
                "response_time": response_time
            })

        all_responses = Response.query.filter_by(question_id=question_id).all()
        all_words = []
        for r in all_responses:
            words = re.findall(r'\b\w+\b', r.response_text.lower())
            stopwords = {'the', 'a', 'an', 'in', 'and', 'to', 'of', 'is', 'that', 'it', 
                        'with', 'for', 'on', 'at', 'this', 'my', 'was', 'but', 'be', 'are'}
            words = [word for word in words if word not in stopwords and len(word) > 1]
            all_words.extend(words)
        word_counts = Counter(all_words)
        top_words = word_counts.most_common(100)
        word_cloud_data = [{"text": word, "value": count} for word, count in top_words]
        
        return {
            "question_id": question_id,
            "question_text": question.question_text,
            "responses": response_data,
            "word_cloud_data": word_cloud_data,
            "total_responses": len(all_responses)
        }, 200
        # Complete implementation for grid question handling

    @staticmethod
    def get_grid_question_analysis(survey_id, question_id):
        """
        Get detailed analysis for grid questions with comprehensive visualization options.
        This is a specialized endpoint specifically for radio-grid, checkbox-grid, and star-rating-grid questions.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        
        question = Question.query.get(question_id)
        if not question or question.survey_id != int(survey_id):
            return {"error": "Question not found"}, 404
        
        if question.question_type not in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
            return {"error": "This analysis is only available for grid-type questions"}, 400
        
        grid_rows = question.grid_rows if question.grid_rows else []
        grid_columns = question.grid_columns if question.grid_columns else []
        
        if not grid_rows or not grid_columns:
            return {"error": "Grid structure not defined for this question"}, 400
        
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        sub_ids = [sub.id for sub in submissions]
        responses = Response.query.filter(
            Response.question_id == question_id,
            Response.submission_id.in_(sub_ids)
        ).all()
        
        # Initialize grid data structure
        grid_data = {
            "rows": [row.get('text', f'Row {i+1}') for i, row in enumerate(grid_rows)],
            "columns": [col.get('text', f'Column {i+1}') for i, col in enumerate(grid_columns)],
            "values": [[0 for _ in range(len(grid_columns))] for _ in range(len(grid_rows))],
            "row_totals": [0 for _ in range(len(grid_rows))],
            "column_totals": [0 for _ in range(len(grid_columns))],
            "row_averages": [0 for _ in range(len(grid_rows))],
            "column_averages": [0 for _ in range(len(grid_columns))],
            "total_responses": len(responses),
            "cells": []
        }
        
        # Process responses based on question type
        if question.question_type == 'radio-grid':
            process_radio_grid_responses(responses, grid_data, grid_rows, grid_columns)
        elif question.question_type == 'checkbox-grid':
            process_checkbox_grid_responses(responses, grid_data, grid_rows, grid_columns)
        elif question.question_type == 'star-rating-grid':
            process_star_rating_grid_responses(responses, grid_data, grid_rows, grid_columns)
        
        # Calculate row and column averages
        calculate_grid_averages(grid_data, question.question_type)
        
        # Prepare cell-level data for the frontend
        prepare_grid_cells(grid_data, question.question_type)
        
        result = {
            "question_id": question_id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "grid_data": grid_data
        }
        
        # Add additional metadata for star ratings
        if question.question_type == 'star-rating-grid':
            result["rating_info"] = {
                "min": 0,
                "max": 5,  # Typical star rating range, can be adjusted based on question settings
                "step": 1
            }
            if question.rating_start is not None:
                result["rating_info"]["min"] = question.rating_start
            if question.rating_end is not None:
                result["rating_info"]["max"] = question.rating_end
            if question.rating_step is not None:
                result["rating_info"]["step"] = question.rating_step
        
        return result, 200

    @staticmethod
    def generate_random_responses(survey_id, count):
        """
        Generates a specified number of random, non-AI submissions for a given survey.
        This is intended for testing and demonstration purposes.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        # Expanded word list to over 200 words for more variety
        word_list = [
            "paradigm", "synergy", "blockchain", "cloud", "agile", "disruptive", "innovation", "scalability", "user-centric", 
            "gamification", "feedback", "analytics", "data", "platform", "integration", "workflow", "customer", "experience", 
            "journey", "value", "proposition", "ecosystem", "sustainability", "impact", "strategy", "deployment", "optimization", 
            "collaboration", "engagement", "retention", "market", "segment", "demographic", "insight", "intuitive", "seamless", 
            "robust", "holistic", "alignment", "benchmark", "leverage", "core-competency", "down-size", "right-size", 
            "mind-share", "on-the-fly", "proactive", "reactive", "win-win", "solution-oriented", "think-outside-the-box", 
            "touchpoint", "viral", "web-enabled", "architecture", "back-end", "front-end", "full-stack", "database", "API", 
            "framework", "library", "component", "module", "service", "microservice", "monolith", "containerization", "docker", 
            "kubernetes", "serverless", "lambda", "virtualization", "machine-learning", "AI", "deep-learning", "neural-network", 
            "algorithm", "big-data", "data-lake", "data-warehouse", "ETL", "business-intelligence", "dashboard", "visualization", 
            "KPI", "metric", "ROI", "TCO", "SaaS", "PaaS", "IaaS", "B2B", "B2C", "C2C", "stakeholder", "shareholder", "investor", 
            "venture-capital", "bootstrapping", "pivot", "iteration", "MVP", "product-market-fit", "growth-hacking", 
            "omnichannel", "personalization", "automation", "CRM", "ERP", "supply-chain", "logistics", "procurement", "human-resources", 
            "onboarding", "offboarding", "compliance", "governance", "risk-management", "cybersecurity", "encryption", "authentication", 
            "authorization", "firewall", "VPN", "phishing", "malware", "ransomware", "zero-day", "threat-intelligence", 
            "penetration-testing", "vulnerability", "patch-management", "incident-response", "disaster-recovery", 
            "business-continuity", "content-marketing", "SEO", "SEM", "social-media", "influencer-marketing", "email-marketing", 
            "affiliate-marketing", "brand-identity", "brand-equity", "brand-loyalty", "customer-lifetime-value", "churn-rate", 
            "conversion-rate", "click-through-rate", "cost-per-acquisition", "A/B-testing", "multivariate-testing", 
            "user-interface", "user-experience", "wireframe", "prototype", "mockup", "design-system", "usability-testing", 
            "accessibility", "responsive-design", "mobile-first", "cross-platform", "native-app", "web-app", "progressive-web-app", 
            "augmented-reality", "virtual-reality", "mixed-reality", "internet-of-things", "edge-computing", "quantum-computing", 
            "genomics", "nanotechnology", "robotics", "automation", "sprint", "scrum", "kanban", "waterfall", "devops", "git", 
            "repository", "version-control", "continuous-integration", "continuous-deployment", "testing", "quality-assurance", 
            "alpha-testing", "beta-testing", "user-acceptance-testing", "regression-testing", "load-testing", "stress-testing",
            "community", "network", "ecosystem", "partnership", "alliance", "merger", "acquisition", "due-diligence",
            "intellectual-property", "patent", "trademark", "copyright", "trade-secret", "licensing", "franchising", "globalization",
            "localization", "internationalization", "cultural-sensitivity", "diversity-and-inclusion", "corporate-social-responsibility",
            "thought-leader", "white-paper", "case-study", "webinar", "podcast", "blog-post", "infographic", "press-release"
        ]

        try:
            for _ in range(count):
                submission = Submission(
                    survey_id=survey.id,
                    is_complete=True,
                    is_ai_generated=True,  # Use this flag to identify generated responses
                    age_group=map_age_to_group(random.randint(18, 70)),
                    gender=random.choice(['Male', 'Female', 'Other']),
                    location=random.choice(['USA', 'Canada', 'UK', 'Australia', 'Other']),
                    education=random.choice(['High School', "Bachelor's Degree", "Master's Degree", "PhD"]),
                    company="Generated Test Data"
                )
                db.session.add(submission)
                db.session.flush()

                for question in survey.questions:
                    response_text = None
                    q_type = question.question_type

                    if q_type in ['document-upload', 'signature', 'content-text', 'content-media']:
                        continue

                    options = []
                    if q_type == 'scale' and question.scale_points:
                        options = question.scale_points
                    elif question.options:
                        options = [opt.get('text') if isinstance(opt, dict) else opt for opt in question.options]

                    if q_type in ['single-choice', 'dropdown', 'scale']:
                        if options:
                            response_text = random.choice(options)
                    elif q_type in ['multi-choice', 'checkbox']:
                        if options:
                            num_to_select = random.randint(1, len(options))
                            selected_options = random.sample(options, num_to_select)
                            response_text = json.dumps(selected_options)
                    elif q_type in ['single-image-select', 'multiple-image-select']:
                        if question.image_options:
                            hidden_labels = [opt.get('hidden_label') for opt in question.image_options if opt.get('hidden_label')]
                            if hidden_labels:
                                if q_type == 'single-image-select':
                                    response_text = random.choice(hidden_labels)
                                else:
                                    num_to_select = random.randint(1, len(hidden_labels))
                                    response_text = json.dumps(random.sample(hidden_labels, num_to_select))
                    elif q_type == 'open-ended':
                        num_words = random.randint(5, 15)
                        response_text = " ".join(random.sample(word_list, min(num_words, len(word_list))))
                    elif q_type in ['rating', 'nps', 'star-rating', 'numerical-input']:
                        min_val = question.rating_start if question.rating_start is not None else (question.min_value if question.min_value is not None else 0)
                        max_val = question.rating_end if question.rating_end is not None else (question.max_value if question.max_value is not None else 10)
                        step = question.rating_step if question.rating_step is not None else 1
                        if q_type == 'nps': min_val, max_val, step = 0, 10, 1
                        if q_type == 'star-rating': min_val, max_val, step = 1, 5, 1
                        possible_values = list(range(int(min_val), int(max_val) + 1, int(step)))
                        if possible_values: response_text = str(random.choice(possible_values))
                    elif q_type == 'interactive-ranking':
                        items = [item.get('text') if isinstance(item, dict) else item for item in (question.ranking_items or [])]
                        if items:
                            random.shuffle(items)
                            response_text = json.dumps({item: rank + 1 for rank, item in enumerate(items)})
                    elif q_type == 'radio-grid':
                        rows = [r.get('text') for r in (question.grid_rows or [])]
                        cols = [c.get('text') for c in (question.grid_columns or []) if not c.get('isNotApplicable')]
                        if rows and cols: response_text = json.dumps({row: random.choice(cols) for row in rows})
                    elif q_type == 'checkbox-grid':
                        rows = [r.get('text') for r in (question.grid_rows or [])]
                        cols = [c.get('text') for c in (question.grid_columns or []) if not c.get('isNotApplicable')]
                        if rows and cols: response_text = json.dumps({row: random.sample(cols, random.randint(0, len(cols))) for row in rows})
                    elif q_type == 'star-rating-grid':
                        rows = [r.get('text') for r in (question.grid_rows or [])]
                        cols = [c.get('text') for c in (question.grid_columns or []) if not c.get('isNotApplicable')]
                        if rows and cols:
                            response_text = json.dumps({row: {col: random.randint(1, 5) for col in cols} for row in rows})
                    elif q_type == 'date-picker':
                        from datetime import datetime, timedelta
                        start = question.min_date or datetime(2020, 1, 1)
                        end = question.max_date or datetime.now()
                        delta_days = (end - start).days
                        random_date = start + timedelta(days=random.randrange(delta_days if delta_days > 0 else 1))
                        response_text = random_date.date().isoformat()

                    if response_text is not None:
                        db.session.add(Response(submission_id=submission.id, question_id=question.id, response_text=response_text))
            
            db.session.commit()
            return {"message": f"{count} random responses generated successfully for survey '{survey.title}'."}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error generating random responses for survey {survey_id}: {e}", exc_info=True)
            return {"error": str(e)}, 500

    @staticmethod
    def export_response_data(survey_id, format='csv'):
        """
        Export raw response data in a structured format.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        if not submissions:
            return {"error": "No responses found for this survey"}, 404
        questions = sorted(survey.questions, key=lambda q: q.sequence_number or 0)
        headers = ["Submission ID", "Submitted At", "Duration"]
        question_headers = [f"Q{q.sequence_number}: {q.question_text}" for q in questions]
        headers.extend(question_headers)
        rows = []
        for sub in submissions:
            row = [
                sub.id,
                sub.submitted_at.isoformat(),
                sub.duration or ""
            ]
            responses_by_question = {r.question_id: r.response_text for r in sub.responses}
            for q in questions:
                response_text = responses_by_question.get(q.id, "")
                try:
                    if response_text.startswith('[') or response_text.startswith('{'):
                        parsed = json.loads(response_text)
                        if isinstance(parsed, list):
                            response_text = ", ".join(str(item) for item in parsed)
                except (json.JSONDecodeError, ValueError):
                    pass
                row.append(response_text)
            rows.append(row)
        export_data = {
            "headers": headers,
            "rows": rows
        }
        return {"export_data": export_data}, 200

    @staticmethod
    def get_question_data_for_charts(survey_id, question_id, **kwargs):
        """
        Get formatted data for client-side charting with optional filtering.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        question = Question.query.get(question_id)
        if not question or question.survey_id != int(survey_id):
            return {"error": "Question not found"}, 404
        query = Submission.query.filter_by(survey_id=survey_id)
        link_id = kwargs.get('link_id')
        if link_id:
            query = query.filter_by(survey_link_id=link_id)
        merge_ids = kwargs.get('merge_ids')
        if merge_ids:
            query = query.filter(Submission.survey_link_id.in_(merge_ids))
        filter_question_seq = kwargs.get('filter_question_seq')
        filter_option = kwargs.get('filter_option')
        if filter_question_seq and filter_option:
            filter_question = Question.query.filter_by(
                survey_id=survey_id,
                sequence_number=filter_question_seq
            ).first()
            if filter_question:
                filtered_submission_ids = []
                for submission in query.all():
                    responses = Response.query.filter_by(
                        submission_id=submission.id,
                        question_id=filter_question.id
                    ).all()
                    for resp in responses:
                        matches = False
                        try:
                            resp_data = json.loads(resp.response_text)
                            if isinstance(resp_data, list) and filter_option in resp_data:
                                matches = True
                            elif resp_data == filter_option:
                                matches = True
                        except json.JSONDecodeError:
                            if resp.response_text == filter_option:
                                matches = True
                        if matches:
                            filtered_submission_ids.append(submission.id)
                            break
                if filtered_submission_ids:
                    query = query.filter(Submission.id.in_(filtered_submission_ids))
                else:
                    return {
                        "question_id": question_id,
                        "question_text": question.question_text,
                        "question_type": question.question_type,
                        "data": [],
                        "filtered_count": 0,
                        "total_count": query.count()
                    }, 200
        submissions = query.all()
        submission_ids = [s.id for s in submissions]
        responses = Response.query.filter(
            Response.question_id == question_id,
            Response.submission_id.in_(submission_ids)
        ).all()
        question_type = question.question_type
        result = {
            "question_id": question_id,
            "question_text": question.question_text,
            "question_type": question_type,
            "filtered_count": len(submissions),
            "total_count": Submission.query.filter_by(survey_id=survey_id).count()
        }
        if question_type in [ 'dropdown','multiple-choice','single-choice']:
            counts = {}
            for resp in responses:
                answer = resp.response_text
                counts[answer] = counts.get(answer, 0) + 1
            chart_data = [
                {"label": option, "count": count, "percentage": (count/len(responses)*100) if responses else 0}
                for option, count in counts.items()
            ]
            chart_data.sort(key=lambda x: x["count"], reverse=True)
            result["data"] = chart_data
        elif question_type in ['checkbox','multi-choice']:
            counts = {}
            for resp in responses:
                try:
                    answers = json.loads(resp.response_text)
                    if isinstance(answers, list):
                        for answer in answers:
                            counts[answer] = counts.get(answer, 0) + 1
                    else:
                        counts[resp.response_text] = counts.get(resp.response_text, 0) + 1
                except json.JSONDecodeError:
                    counts[resp.response_text] = counts.get(resp.response_text, 0) + 1
            chart_data = [
                {"label": option, "count": count, "percentage": (count/len(responses)*100) if responses else 0}
                for option, count in counts.items()
            ]
            chart_data.sort(key=lambda x: x["count"], reverse=True)
            result["data"] = chart_data
        elif question_type in ["rating-scale","rating", 'nps', 'numerical-input']:
            values = []
            for resp in responses:
                try:
                    value = float(resp.response_text)
                    values.append(value)
                except (ValueError, TypeError):
                    continue
            if not values:
                result["data"] = []
                return result, 200
            min_val = int(min(values))
            max_val = int(max(values)) + 1
            value_counts = {}
            for val in values:
                rounded = round(val)
                value_counts[rounded] = value_counts.get(rounded, 0) + 1
            dist_data = []
            for i in range(min_val, max_val + 1):
                count = value_counts.get(i, 0)
                dist_data.append({
                    "label": str(i),
                    "count": count,
                    "percentage": (count/len(values)*100) if values else 0
                })
            result["data"] = dist_data
            result["statistics"] = {
                "mean": sum(values) / len(values),
                "median": statistics.median(values),
                "min": min(values),
                "max": max(values),
                "count": len(values)
            }
            if question_type == 'nps':
                promoters = sum(1 for v in values if v >= 9)
                passives = sum(1 for v in values if 7 <= v <= 8)
                detractors = sum(1 for v in values if v <= 6)
                nps_score = ((promoters - detractors) / len(values)) * 100
                result["nps"] = {
                    "promoters": promoters,
                    "passives": passives,
                    "detractors": detractors,
                    "nps_score": nps_score
                }
        elif question_type == 'open-ended':
            text_responses = [resp.response_text for resp in responses]
            recent_responses = []
            for resp in responses[-10:]:
                submission = next((s for s in submissions if s.id == resp.submission_id), None)
                recent_responses.append({
                    "text": resp.response_text,
                    "submission_id": resp.submission_id,
                    "date": resp.created_at.isoformat()
                })
            all_words = []
            for text in text_responses:
                words = re.findall(r'\b\w+\b', text.lower())
                stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'from', 'of', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'under', 'before', 'above', 'below', 'up', 'down', 'in', 'out'}
                words = [word for word in words if word not in stopwords and len(word) > 2]
                all_words.extend(words)
            word_counts = Counter(all_words)
            word_cloud_data = [{"text": word, "value": count} for word, count in word_counts.most_common(100)]
            result["data"] = recent_responses
            result["word_cloud"] = word_cloud_data
        elif question_type in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
            grid_data = {
                "rows": [row.get('text', '') for row in question.grid_rows or []],
                "columns": [col.get('text', '') for col in question.grid_columns or []],
                "cells": [],
                "row_totals": [],
                "column_totals": [],
                "total_responses": len(responses)
            }
            row_count = len(grid_data["rows"])
            col_count = len(grid_data["columns"])
            cell_counts = [[0 for _ in range(col_count)] for _ in range(row_count)]
            row_totals = [0] * row_count
            col_totals = [0] * col_count
            for resp in responses:
                try:
                    data = json.loads(resp.response_text)
                    if question_type == 'radio-grid':
                        for row, col in data.items():
                            row_idx = grid_data["rows"].index(row)
                            col_idx = grid_data["columns"].index(col)
                            cell_counts[row_idx][col_idx] += 1
                            row_totals[row_idx] += 1
                            col_totals[col_idx] += 1
                    elif question_type == 'checkbox-grid':
                        for row, cols in data.items():
                            if isinstance(cols, list):
                                row_idx = grid_data["rows"].index(row)
                                for col in cols:
                                    col_idx = grid_data["columns"].index(col)
                                    cell_counts[row_idx][col_idx] += 1
                                    row_totals[row_idx] += 1
                                    col_totals[col_idx] += 1
                    elif question_type == 'star-rating-grid':
                        row_ratings = {}
                        row_counts = {}
                        for row, rating in data.items():
                            row_idx = grid_data["rows"].index(row)
                            try:
                                rating_val = float(rating)
                                row_ratings[row_idx] = row_ratings.get(row_idx, 0) + rating_val
                                row_counts[row_idx] = row_counts.get(row_idx, 0) + 1
                            except (ValueError, TypeError):
                                continue
                except Exception:
                    continue
            for row_idx in range(row_count):
                for col_idx in range(col_count):
                    count = cell_counts[row_idx][col_idx]
                    row_pct = (count/row_totals[row_idx]*100) if row_totals[row_idx] > 0 else 0
                    col_pct = (count/col_totals[col_idx]*100) if col_totals[col_idx] > 0 else 0
                    grid_data["cells"].append({
                        "row_index": row_idx,
                        "col_index": col_idx,
                        "row_text": grid_data["rows"][row_idx],
                        "col_text": grid_data["columns"][col_idx],
                        "count": count,
                        "row_percentage": row_pct,
                        "column_percentage": col_pct
                    })
            for row_idx in range(row_count):
                row_data = {
                    "row_index": row_idx,
                    "row_text": grid_data["rows"][row_idx],
                    "total": row_totals[row_idx],
                    "percentage": (row_totals[row_idx]/len(responses)*100) if responses else 0
                }
                if question_type == 'star-rating-grid' and row_idx in row_ratings and row_counts.get(row_idx, 0) > 0:
                    row_data["average"] = row_ratings[row_idx] / row_counts[row_idx]
                grid_data["row_totals"].append(row_data)
            for col_idx in range(col_count):
                grid_data["column_totals"].append({
                    "col_index": col_idx,
                    "col_text": grid_data["columns"][col_idx],
                    "total": col_totals[col_idx],
                    "percentage": (col_totals[col_idx]/len(responses)*100) if responses else 0
                })
            result["data"] = grid_data
        else:
            result["data"] = []
        return result, 200

    @staticmethod
    def get_age_group_analytics(survey_id):
        """
        Get analytics breakdown by age group.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        age_question = None
        age_groups = {}
        for question in survey.questions:
            if ("age" in question.question_text.lower() or 
                (question.description and "age" in question.description.lower())):
                if question.question_type in ['multiple-choice', 'dropdown','single-choice']:
                    age_question = question
                    break
        if not age_question:
            return {"error": "No age group question found in survey"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        responses = Response.query.filter_by(question_id=age_question.id).all()
        sub_to_age = {r.submission_id: r.response_text for r in responses}
        for sub in submissions:
            if sub.id in sub_to_age:
                age_group = sub_to_age[sub.id]
                if age_group not in age_groups:
                    age_groups[age_group] = 0
                age_groups[age_group] += 1
        total = len(submissions)
        age_group_percentages = {}
        for group, count in age_groups.items():
            percentage = (count / total * 100) if total > 0 else 0
            age_group_percentages[group] = {
                "count": count,
                "percentage": round(percentage, 2)
            }
        return {
            "age_groups": age_group_percentages,
            "total_responses": total
        }, 200

    @staticmethod
    def get_question_completion_rate(survey_id):
        """
        Get completion rate for each question in the survey.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        if not submissions:
            return {"error": "No submissions found"}, 404
        total_submissions = len(submissions)
        completion_rates = {}
        for question in survey.questions:
            response_count = 0
            for sub in submissions:
                resp = Response.query.filter_by(
                    submission_id=sub.id,
                    question_id=question.id
                ).first()
                if resp and resp.response_text:
                    response_count += 1
            completion_rate = (response_count / total_submissions * 100) if total_submissions > 0 else 0
            completion_rates[question.id] = {
                "question_id": question.id,
                "sequence_number": question.sequence_number,
                "question_text": question.question_text,
                "response_count": response_count,
                "completion_rate": round(completion_rate, 2),
                "is_required": question.required
            }
        total_required_questions = sum(1 for q in survey.questions if q.required)
        completed_required = 0
        for qid, data in completion_rates.items():
            if data["is_required"] and data["response_count"] == total_submissions:
                completed_required += 1
        overall_rate = (completed_required / total_required_questions * 100) if total_required_questions > 0 else 100
        return {
            "survey_id": survey_id,
            "total_submissions": total_submissions,
            "total_questions": len(survey.questions),
            "total_required_questions": total_required_questions,
            "overall_completion_rate": round(overall_rate, 2),
            "question_completion_rates": completion_rates
        }, 200
        
    @staticmethod
    def get_recent_open_ended_responses(survey_id, question_id, limit=10):
        """
        Get the most recent open-ended responses for a specific question.
        """
        question = Question.query.get(question_id)
        if not question or question.survey_id != int(survey_id):
            return {"error": "Question not found"}, 404
        if question.question_type != 'open-ended':
            return {"error": "Question is not an open-ended type"}, 400
        submissions = Submission.query.filter_by(survey_id=survey_id).order_by(Submission.submitted_at.desc()).all()
        responses = []
        count = 0
        for sub in submissions:
            if count >= limit:
                break
            resp = Response.query.filter_by(
                submission_id=sub.id,
                question_id=question_id
            ).first()
            if resp and resp.response_text:
                responses.append({
                    "response_id": resp.id,
                    "response_text": resp.response_text,
                    "created_at": resp.created_at.isoformat(),
                    "submission_id": sub.id
                })
                count += 1
        return {
            "question_id": question_id,
            "question_text": question.question_text,
            "recent_responses": responses
        }, 200

    @staticmethod
    def get_advanced_report_options(survey_id, options=None):
        """
        Get or set report options for a survey.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        default_options = {
            "filter_details": True,
            "chart": True,
            "word_cloud": False,
            "summary_table": True,
            "statistics_table": False,
            "questions_with_no_data": True,
            "use_question_alias": False,
            "question_numbering": "sequential",
            "show_na_options": True,
            "response_counts": True,
            "show_no_data_options": False,
            "option_names": "original",
            "order_answers_by": "original",
            "decimal_places": 1,
            "chart_size": "medium",
            "axis_values": "percent",
            "row_total": False,
            "row_average": False,
            "column_total": False,
            "column_average": False,
            "language": "en"
        }
        if options is not None:
            updated_options = {**default_options, **options}
            return updated_options, 200
        return default_options, 200

    @staticmethod
    def generate_report_with_options(survey_id, options=None):
        """
        Generate a comprehensive report based on specified options.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        submissions = Submission.query.filter_by(survey_id=survey_id).all()
        if not submissions:
            return {"message": "No responses found for this survey", "report": {"questions": []}}, 200
        if options:
            report_options, _ = ResponseController.get_advanced_report_options(survey_id, options)
        else:
            report_options, _ = ResponseController.get_advanced_report_options(survey_id)
        analytics = compute_analytics(submissions, survey)
        report = {
            "survey": {
                "id": survey.id,
                "title": survey.title,
                "description": survey.description,
                "total_responses": len(submissions)
            },
            "options": report_options,
            "questions": []
        }
        for question in survey.questions:
            if not report_options["questions_with_no_data"] and question.id in analytics["questions_with_no_data"]:
                continue
            question_data = {
                "id": question.id,
                "question_text": question.question_text,
                "question_type": question.question_type,
                "sequence_number": question.sequence_number,
                "description": question.description,
                "total_responses": analytics["question_response_counts"].get(question.id, 0),
                "has_chart": False,
                "has_word_cloud": False,
                "has_summary_table": False,
                "has_statistics_table": False,
                "chart_data": None,
                "word_cloud_data": None,
                "summary_table": None,
                "statistics_table": None
            }
            if report_options["chart"] and question.question_type in ['multiple-choice', 'checkbox', 'dropdown', "rating-scale","rating", 'nps', 'numerical-input','single-choice','multi-choice']:
                question_data["has_chart"] = True
                question_data["chart_data"] = {
                    "type": "bar",
                    "url": f"/api/surveys/{survey_id}/questions/{question.id}/chart?type=bar"
                }
            if report_options["word_cloud"] and question.question_type == 'open-ended':
                question_data["has_word_cloud"] = True
                question_data["word_cloud_data"] = {
                    "url": f"/api/surveys/{survey_id}/questions/{question.id}/word-cloud"
                }
            if report_options["summary_table"]:
                question_data["has_summary_table"] = True
                if question.question_type in ['multiple-choice', 'checkbox', 'dropdown', 'radio-grid', 'checkbox-grid','multi-choice','single-choice']:
                    if question.id in analytics["mcq_stats"]:
                        question_data["summary_table"] = {
                            "option_counts": analytics["mcq_stats"][question.id]["option_counts"],
                            "option_percentages": analytics["mcq_stats"][question.id]["option_percentages"],
                            "total_selections": analytics["mcq_stats"][question.id]["total_selections"]
                        }
                elif question.question_type in ["rating-scale","rating", 'nps', 'numerical-input']:
                    if question.id in analytics["numerical_stats"]:
                        question_data["summary_table"] = {
                            "values": analytics["numerical_stats"][question.id]["values"]
                        }
                elif question.question_type == 'open-ended':
                    if question.id in analytics["text_stats"]:
                        question_data["summary_table"] = {
                            "latest_responses": analytics["text_stats"][question.id]["latest_responses"][:10]
                        }
                elif question.question_type in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
                    if question.id in analytics["grid_stats"]:
                        question_data["summary_table"] = {
                            "grid_data": analytics["grid_stats"][question.id]["grid_data"]
                        }
            if report_options["statistics_table"]:
                question_data["has_statistics_table"] = True
                if question.question_type in ["rating-scale","rating", 'nps', 'numerical-input']:
                    if question.id in analytics["numerical_stats"]:
                        question_data["statistics_table"] = {
                            "mean": analytics["numerical_stats"][question.id]["mean"],
                            "median": analytics["numerical_stats"][question.id]["median"],
                            "mode": analytics["numerical_stats"][question.id]["mode"],
                            "standard_deviation": analytics["numerical_stats"][question.id]["standard_deviation"],
                            "min": analytics["numerical_stats"][question.id]["min"],
                            "max": analytics["numerical_stats"][question.id]["max"]
                        }
                elif question.question_type in ['multiple-choice', 'checkbox', 'dropdown','single-choice','multi-choice'] and question.id in analytics["mcq_stats"]:
                    if "average_value" in analytics["mcq_stats"][question.id]:
                        question_data["statistics_table"] = {
                            "average_value": analytics["mcq_stats"][question.id]["average_value"]
                        }
            report["questions"].append(question_data)
        return {"report": report}, 200

    @staticmethod
    def parse_answer(resp_text):
        """
        Safely parse JSON or fallback to string. 
        This helps handle arrays for checkbox, or strings for single choice.
        """
        try:
            return json.loads(resp_text)
        except:
            return resp_text

 
    @staticmethod
    def search_open_ended_responses(question_id, keyword):
        try:
            question = Question.query.get(question_id)
            if not question or question.question_type != 'open-ended':
                return {"error": "Invalid question ID or type"}, 400

            # Use case-insensitive search
            matching_responses = Response.query.filter(
                Response.question_id == question_id,
                Response.response_text.ilike(f"%{keyword}%")
            ).order_by(Response.created_at.desc()).limit(100).all() # Limit results

            results = [
                {"text": r.response_text, "created_at": r.created_at.isoformat()}
                for r in matching_responses
            ]
            return {"results": results}, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_raw_export_data(survey_id):
        try:
            # ... (existing setup: survey, submissions, questions, headers) ...
            survey = Survey.query.get(survey_id); # ... error handling ...
            submissions = Submission.query.filter_by(survey_id=survey_id).order_by(Submission.submitted_at).all()
            if not submissions: return {"headers": [], "rows": []}, 200
            questions = sorted(survey.questions, key=lambda q: q.sequence_number or float('inf'))
            headers = ["Submission ID", "Submitted At", "Duration (s)", "Is Complete?", "User ID", "Age Group", "Gender", "Location", "Education", "Company", "Cohort/Tag", "Device Type", "Browser Info"]
            headers.extend([f"Q{q.sequence_number}: {q.question_text}" for q in questions])

            rows = []
            for sub in submissions:
                row_data = {h: '' for h in headers}
                # ... (populate standard submission metadata) ...
                row_data["Submission ID"] = sub.id; row_data["Submitted At"] = sub.submitted_at.isoformat() if sub.submitted_at else ''
                # ... (rest of metadata) ...
                row_data["Duration (s)"] = sub.duration if sub.duration is not None else ''
                row_data["Is Complete?"] = 'Yes' if sub.is_complete else 'No'
                row_data["User ID"] = sub.user_id if sub.user_id else ''
                row_data["Age Group"] = sub.age_group or ''; row_data["Gender"] = sub.gender or ''
                row_data["Location"] = sub.location or ''; row_data["Education"] = sub.education or ''
                row_data["Company"] = sub.company or ''; row_data["Cohort/Tag"] = sub.cohort_tag or ''
                row_data["Device Type"] = sub.device_type or ''; row_data["Browser Info"] = sub.browser_info or ''


                responses_dict = {r.question_id: r for r in sub.responses}

                for q in questions:
                    header_key = f"Q{q.sequence_number}: {q.question_text}"
                    response = responses_dict.get(q.id)
                    response_value = ''
                    if response:
                        # --- UPDATED EXPORT LOGIC ---
                        if q.question_type in ['single-image-select', 'multiple-image-select']:
                            # Map hidden labels back to visible labels for export
                            hidden_labels = ResponseController.parse_answer(response.response_text)
                            label_map = {opt.get('hidden_label'): opt.get('label', opt.get('hidden_label')) for opt in (q.image_options or []) if isinstance(opt, dict)}
                            visible_labels = []
                            if isinstance(hidden_labels, list):
                                visible_labels = [label_map.get(hl, hl) for hl in hidden_labels] # Fallback to hidden label if map fails
                            else:
                                visible_labels = [label_map.get(hidden_labels, hidden_labels)]
                            response_value = ", ".join(visible_labels)
                        elif q.question_type in ['checkbox', 'multi-choice', 'interactive-ranking']:
                             try: parsed = json.loads(response.response_text); response_value = ", ".join(map(str, parsed)) if isinstance(parsed, list) else response.response_text
                             except: response_value = response.response_text
                        elif q.question_type == 'document-upload':
                            try: paths = json.loads(response.response_text); filenames = [p.split('/')[-1] for p in paths]; response_value = ", ".join(filenames)
                            except: response_value = response.file_path.split('/')[-1] if response.file_path else ''
                        elif q.question_type == 'signature': response_value = "Yes" if response.response_text and response.response_text != '{}' else "No"
                        else: response_value = response.response_text # Includes grid JSON, rating numbers, text etc.
                        # --- END UPDATED EXPORT LOGIC ---

                    row_data[header_key] = response_value

                rows.append(list(row_data.values()))

            return {"headers": headers, "rows": rows}, 200
        except Exception as e:
            import traceback; print(traceback.format_exc())
            return {"error": f"Failed to generate export data: {str(e)}"}, 500


 
    @staticmethod
    def get_report_summary(survey_id):
        try:
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            summary_data = survey.get_analytics_summary() # Use the method from Survey model
            return summary_data, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def process_slider_analytics(question, question_responses):
        """
        NEW FUNCTION: Compute analytics specifically for slider questions (question_type 'rating').
        Calculates discrete distribution and standard numeric stats.
        """
        from collections import Counter
        import statistics
        from flask import current_app # Import current_app for logging

        numeric_values = []
        na_count = 0
        # 1. Collect numeric responses and count N/A
        for r in question_responses:
            # Check for the 'is_not_applicable' flag from the Response model
            if r.is_not_applicable:
                na_count += 1
                continue
            # Additionally check if the stored text itself indicates N/A (e.g., if 'N/A' was stored before is_not_applicable flag existed)
            parsed_val = ResponseController.parse_answer(r.response_text)
            # Ensure comparison is case-insensitive and handles potential surrounding spaces
            na_text = (question.not_applicable_text or "Not Applicable").strip().lower()
            if isinstance(parsed_val, str) and parsed_val.strip().lower() == na_text:
                na_count += 1
                continue

            try:
                # Attempt to convert the parsed value (which should be a number for sliders)
                val = float(parsed_val)
                numeric_values.append(val)
            except (ValueError, TypeError):
                # Log or handle cases where a non-numeric value (other than 'N/A') was stored
                current_app.logger.warning(f"Non-numeric value '{parsed_val}' found for slider question {question.id}, response {r.id}. Skipping.")
                continue

        count_valid = len(numeric_values)
        total_responses_considered = count_valid + na_count

        # 2. Calculate statistics only if there are valid numeric entries
        mean = round(statistics.mean(numeric_values), 2) if count_valid else None
        median = round(statistics.median(numeric_values), 2) if count_valid else None
        min_val = round(min(numeric_values), 2) if count_valid else None
        max_val = round(max(numeric_values), 2) if count_valid else None
        std_dev = (
            round(statistics.stdev(numeric_values), 2)
            if count_valid > 1 else (0 if count_valid == 1 else None)
        )

        # 3. Build distribution across the slider's defined range
        distribution = []
        # Use defined range if available, otherwise fallback to observed min/max
        # Default slider range 1-5 if not defined in question
        start = int(question.rating_start if question.rating_start is not None else 1)
        end = int(question.rating_end if question.rating_end is not None else 5)
        step = int(question.rating_step if question.rating_step is not None else 1)

        # Count occurrences of each value within the numeric responses
        value_counts = Counter(numeric_values)

        # Iterate through the expected steps of the slider
        current_val = float(start)
        while current_val <= float(end):
            cnt = value_counts.get(current_val, 0) # Get count for this specific slider value
            perc = round(cnt * 100.0 / count_valid, 2) if count_valid else 0
            distribution.append({"value": current_val, "count": cnt, "percentage": perc})
            current_val += float(step)
            # Handle potential float precision issues
            current_val = round(current_val, 8) # Keep reasonable precision

        # Add N/A count to the distribution table if applicable
        if question.show_na and na_count > 0:
            na_perc = round(na_count * 100.0 / total_responses_considered, 2) if total_responses_considered else 0
            na_option_text = question.not_applicable_text or "Not Applicable"
            distribution.append({"value": na_option_text, "count": na_count, "percentage": na_perc})


        # 4. Return structured analytics
        return {
            "type": "slider_stats", # Use a distinct type for sliders
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered, # Valid + N/A
            "mean": mean,
            "median": median,
            "min": min_val,
            "max": max_val,
            "std_dev": std_dev,
            "left_label": question.left_label,
            "center_label": question.center_label,
            "right_label": question.right_label,
            "rating_start": question.rating_start,
            "rating_end": question.rating_end,
            "rating_step": question.rating_step,
            "distribution": distribution # Table-ready data for each slider step + N/A
        }
        
        
        
    @staticmethod
    def process_numeric_input_analytics(question, question_responses):
        """
        NEW FUNCTION: Compute analytics specifically for numeric-input questions.
        Calculates distribution of unique entries and standard numeric stats.
        """
        import statistics # Ensure statistics is imported if not already
        from collections import Counter # Ensure Counter is imported if not already
        from flask import current_app # Import current_app for logging

        numeric_values = []
        na_count = 0
        # 1. Collect numeric responses and count N/A
        for r in question_responses:
            if r.is_not_applicable:
                na_count += 1
                continue
            try:
                # Parse answer (could be string) and convert to float
                val = float(ResponseController.parse_answer(r.response_text))
                numeric_values.append(val)
            except (ValueError, TypeError):
                # Skip entries that cannot be converted to float
                current_app.logger.warning(f"Non-numeric value '{r.response_text}' found for numeric-input question {question.id}, response {r.id}. Skipping.")
                continue

        count_valid = len(numeric_values)
        total_responses_considered = count_valid + na_count

        # 2. Calculate statistics only if there are valid entries
        mean = round(statistics.mean(numeric_values), 2) if count_valid else None
        median = round(statistics.median(numeric_values), 2) if count_valid else None
        min_val = round(min(numeric_values), 2) if count_valid else None
        max_val = round(max(numeric_values), 2) if count_valid else None
        std_dev = (
            round(statistics.stdev(numeric_values), 2)
            if count_valid > 1 else (0 if count_valid == 1 else None)
        )

        # 3. Build frequency distribution of unique numeric entries
        value_counts = Counter(numeric_values)
        distribution = []
        # Sort by the numeric value itself
        for val, cnt in sorted(value_counts.items()):
            perc = round(cnt * 100.0 / count_valid, 2) if count_valid else 0
            distribution.append({"value": val, "count": cnt, "percentage": perc})

        # Add N/A count if applicable
        na_option_text = question.not_applicable_text or "Not Applicable"
        if question.show_na and na_count > 0: # Check if N/A is relevant for this type
            na_perc = round(na_count * 100.0 / total_responses_considered, 2) if total_responses_considered else 0
            distribution.append({"value": na_option_text, "count": na_count, "percentage": na_perc})

        # 4. Return structured analytics
        return {
            "type": "numeric_stats", # Keep existing type, but structure is enhanced
            "count_valid": count_valid,
            "count_na": na_count,
            "total_responses_considered": total_responses_considered,
            "mean": mean,
            "median": median,
            "min": min_val,
            "max": max_val,
            "std_dev": std_dev,
            "distribution": distribution # Table-ready data for each unique numeric value + N/A
        }
        
    @staticmethod
    def process_ranking_analytics(question, question_responses):
        """
        NEW FUNCTION: Compute analytics for ranking questions.
        Calculates:
        1. Average rank per item.
        2. Rank distribution matrix (Item vs. Rank Position Frequency).
        Handles N/A responses and validates input data format.
        """
        rankings_for_avg = defaultdict(list) # { item_text: [rank1, rank2, ...] } - For average calculation
        na_count = 0
        response_valid_format_count = 0 # Count responses that had the correct dict format

        # --- Define items based on the question definition ---
        items_in_question = []
        if question.ranking_items and isinstance(question.ranking_items, list):
            for item in question.ranking_items:
                 # Handle both dict {text: "..."} and simple string items
                 if isinstance(item, dict) and item.get('text'):
                     items_in_question.append(str(item['text']).strip()) # Add strip()
                 elif isinstance(item, str) and item.strip(): # Ensure string is not empty after stripping
                      items_in_question.append(item.strip())

        if not items_in_question:
            current_app.logger.warning(f"No valid ranking items defined for question {question.id}. Cannot compute ranking analytics.")
            return {
                "type": "ranking_stats", "count_valid": 0, "count_na": 0,
                "average_ranks": [], "rank_distribution_matrix": {},
                "items_in_question": [],
                "error": "No ranking items defined in question."
                }

        num_items = len(items_in_question)
        current_app.logger.info(f"[Ranking Q{question.id}] Defined items ({num_items}): {items_in_question}")


        # --- Initialize distribution matrix (Items x Position Ranks) ---
        # Rows = items, Columns = rank positions (1 to n)
        # Cell (item, rank_pos) = count of times 'item' was placed in 'rank_pos'
        rank_distribution_matrix = {
            item_text: {rank_pos: 0 for rank_pos in range(1, num_items + 1)}
            for item_text in items_in_question
        }
        # --- End initialization ---

        # --- Process each response ---
        for r in question_responses:
            # 1. Handle N/A responses (skip processing, just count)
            if r.is_not_applicable:
                na_count += 1
                continue

            # 2. Parse response text (expecting JSON dictionary)
            try:
                # --- LOGGING ADDED ---
                current_app.logger.debug(f"[Ranking Q{question.id}] Parsing response {r.id} text: '{r.response_text}'")
                ranked_data = ResponseController.parse_answer(r.response_text)
                # --- END LOGGING ---
            except Exception as e:
                current_app.logger.error(f"Unexpected error parsing ranking response {r.id}: {e}", exc_info=True)
                continue # Skip response if parsing fails catastrophically

            # 3. Validate format (must be a dictionary)
            if not isinstance(ranked_data, dict):
                current_app.logger.warning(f"Unrecognized ranking format in response {r.id}: {type(ranked_data)}. Expected dict. Skipping response.")
                continue # Skip response if not the expected format

            # If format is correct, increment the valid format counter
            response_valid_format_count += 1
            # --- LOGGING ADDED ---
            current_app.logger.debug(f"[Ranking Q{question.id}] Parsed valid response {r.id} data: {ranked_data}")
            # --- END LOGGING ---

            seen_items_in_response = set()
            processed_ranks_in_response = set()
            items_processed_in_this_response = 0

            # 4. Iterate through items and ranks provided in the response dictionary
            for item_text, rank in ranked_data.items():
                item_text_str = str(item_text).strip() # Normalize item text

                # 5a. Validate Item: Is it one of the defined items?
                if item_text_str not in items_in_question:
                     current_app.logger.warning(f"[Ranking Q{question.id}] Response {r.id} contains item '{item_text_str}' not defined in question. Skipping item.")
                     continue

                # 5b. Validate Rank: Is it an integer within the valid range [1, n]?
                try:
                    rank_int = int(rank)
                    if not (1 <= rank_int <= num_items):
                        current_app.logger.warning(f"[Ranking Q{question.id}] Response {r.id} has out-of-bounds rank {rank_int} for item '{item_text_str}'. Skipping item.")
                        continue
                except (ValueError, TypeError):
                    current_app.logger.warning(f"[Ranking Q{question.id}] Response {r.id} has non-integer rank '{rank}' for item '{item_text_str}'. Skipping item.")
                    continue

                # 5c. Validate Uniqueness (within this single response)
                if item_text_str in seen_items_in_response:
                     current_app.logger.warning(f"[Ranking Q{question.id}] Response {r.id} ranks item '{item_text_str}' multiple times. Skipping duplicate.")
                     continue
                if rank_int in processed_ranks_in_response:
                     current_app.logger.warning(f"[Ranking Q{question.id}] Response {r.id} uses rank {rank_int} multiple times. Skipping item '{item_text_str}'.")
                     continue

                # 6. Update Aggregations (if validation passed)
                # --- Store rank for average calculation ---
                rankings_for_avg[item_text_str].append(rank_int)
                seen_items_in_response.add(item_text_str)
                processed_ranks_in_response.add(rank_int)

                # --- Increment count in distribution matrix (Position Frequency) ---
                if item_text_str in rank_distribution_matrix and rank_int in rank_distribution_matrix[item_text_str]:
                    rank_distribution_matrix[item_text_str][rank_int] += 1
                    # --- LOGGING ADDED ---
                    current_app.logger.debug(f"[Ranking Q{question.id}] Resp {r.id}: Incremented matrix[{item_text_str}][{rank_int}]")
                    # --- END LOGGING ---
                else:
                     current_app.logger.error(f"[Ranking Q{question.id}] Internal Error: Invalid item '{item_text_str}' or rank {rank_int} for matrix update.")
                # --- End increment ----

                items_processed_in_this_response += 1

            # Optional: Log if a response didn't rank all items (might indicate data issue)
            if items_processed_in_this_response != num_items and items_processed_in_this_response > 0:
                 current_app.logger.info(f"[Ranking Q{question.id}] Response {r.id} only processed {items_processed_in_this_response}/{num_items} items.")


        # --- Calculate Final Average Ranks (Backward Compatibility & Info) ---
        avg_ranks = []
        for item_text in items_in_question: # Iterate through defined items for completeness
            item_ranks = rankings_for_avg.get(item_text, [])
            avg_rank = round(statistics.mean(item_ranks), 2) if item_ranks else None
            count = len(item_ranks) # How many times this item was validly ranked across all responses
            avg_ranks.append({"item": item_text, "average_rank": avg_rank, "count": count})

        avg_ranks.sort(key=lambda x: x["average_rank"] if x["average_rank"] is not None else float('inf'))
        # --- End Average Rank Calculation ---

        # --- LOGGING ADDED ---
        current_app.logger.info(f"[Ranking Q{question.id}] Final Avg Ranks: {avg_ranks}")
        current_app.logger.info(f"[Ranking Q{question.id}] Final Dist Matrix: {rank_distribution_matrix}")
        # --- END LOGGING ---

        # --- Prepare final return structure ---
        return {
            "type": "ranking_stats",
            "count_valid": response_valid_format_count, # Number of submissions with valid dictionary format
            "count_na": na_count,
            "total_responses_considered": response_valid_format_count + na_count,
            "average_ranks": avg_ranks,                    # Included for compatibility
            "rank_distribution_matrix": rank_distribution_matrix, # The primary new output
            "items_in_question": items_in_question         # For context
        }



    @staticmethod
    def get_filtered_question_analytics(survey_id, question_id, filters):
        """
        Get analytics for a specific question filtered by demographic criteria.
        Handles image select mapping.
        Calls the specific processing function based on question type.
        """
        try:
            survey = Survey.query.get(survey_id)
            if not survey: return {"error": "Survey not found"}, 404
            question = Question.query.get(question_id)
            if not question or question.survey_id != int(survey_id): return {"error": "Question not found"}, 404

            query = Submission.query.filter_by(survey_id=survey_id)
            # --- Apply filters (same logic as before) ---
            if filters:
                if filters.get("age_group"): query = query.filter(Submission.age_group.in_(filters["age_group"]))
                if filters.get("location"): query = query.filter(Submission.location.in_(filters["location"])) if isinstance(filters["location"], list) else query.filter(Submission.location == filters["location"])
                if filters.get("education"): query = query.filter(Submission.education.in_(filters["education"])) if isinstance(filters["education"], list) else query.filter(Submission.education == filters["education"])
                if filters.get("company"): query = query.filter(Submission.company.in_(filters["company"])) if isinstance(filters["company"], list) else query.filter(Submission.company == filters["company"])
                if filters.get("gender"): query = query.filter(Submission.gender.in_(filters["gender"])) if isinstance(filters["gender"], list) else query.filter(Submission.gender == filters["gender"])
                if filters.get("cohort_tag"): query = query.filter(Submission.cohort_tag.in_(filters["cohort_tag"])) if isinstance(filters["cohort_tag"], list) else query.filter(Submission.cohort_tag == filters["cohort_tag"])
            # --- End Filter Application ---

            submissions = query.all()
            submission_count = len(submissions)
            na_option_text = question.not_applicable_text or "Not Applicable"

            if not submissions:
                return {"question_id": question.id, "question_text": question.question_text, "question_type": question.question_type, "has_na_option": question.not_applicable, "total_responses": 0, "analytics": {}, "filters_applied": filters}, 200

            submission_ids = [s.id for s in submissions]
            question_responses = Response.query.filter(
                Response.submission_id.in_(submission_ids),
                Response.question_id == question.id
            ).all()
            other_texts = [
                r.other_text for r in question_responses
                if getattr(r, "is_other", False) and r.other_text
            ]
            response_count = len(question_responses)

            if not question_responses:
                return {"question_id": question.id, "question_text": question.question_text, "question_type": question.question_type, "has_na_option": question.not_applicable, "total_responses": 0, "analytics": {}, "filters_applied": filters}, 200

            results = {"question_id": question.id, "question_text": question.question_text, "question_type": question.question_type, "has_na_option": question.not_applicable, "total_responses": response_count, "filters_applied": filters}
            qtype = question.question_type
            analytics_data = {} # Initialize

            # --- Call the appropriate processor based on type ---
            if qtype in ["multiple-choice", "dropdown", "single-choice", "scale"]:
                 # Use the single-select logic (which handles scale internally)
                 option_counts = Counter(); na_count = 0
                 # Determine the source of options/labels
                 if qtype == 'scale' and question.scale_points:
                     option_source = question.scale_points # List of strings
                     is_simple_list = True
                 elif question.options:
                     option_source = question.options # List of dicts or strings
                     is_simple_list = not all(isinstance(opt, dict) for opt in option_source)
                 else: option_source = []; is_simple_list = True

                 for r in question_responses:
                     if r.is_not_applicable: na_count += 1; continue
                     val = ResponseController.parse_answer(r.response_text)
                     val_str = str(val) # Simpler conversion for counting
                     option_counts[val_str] += 1
                 if question.not_applicable and na_count > 0: option_counts[na_option_text] += na_count
                 total_valid_opts = sum(option_counts.values())
                 distribution = [{"option": opt, "count": cnt, "percentage": round((cnt / total_valid_opts * 100), 2) if total_valid_opts else 0} for opt, cnt in option_counts.items()]
                 distribution.sort(key=lambda x: x["count"], reverse=True)
                 analytics_data = {"type": "single_select_distribution", "options_distribution": distribution}

            elif qtype in ['checkbox', 'multi-choice']:
                 # Use the multi-select logic
                 option_counts = Counter(); co_occurrence = Counter(); response_valid_count = 0; na_count = 0
                 for r in question_responses:
                     if r.is_not_applicable: na_count += 1; continue
                     response_valid_count += 1
                     val = ResponseController.parse_answer(r.response_text)
                     current_selection = [str(item) for item in val] if isinstance(val, list) else [str(val)] if val is not None else []
                     for item_str in current_selection: option_counts[item_str] += 1
                     sorted_items = sorted(current_selection);
                     for i in range(len(sorted_items)):
                         for j in range(i + 1, len(sorted_items)): co_occurrence[(sorted_items[i], sorted_items[j])] += 1
                 if question.not_applicable and na_count > 0: option_counts[na_option_text] = na_count
                 total_selections = sum(option_counts.values())
                 distribution = [{"option": opt, "count": cnt, "percentage_of_responses": round(cnt * 100.0 / response_valid_count, 2) if response_valid_count else 0, "percentage_of_selections": round(cnt * 100.0 / total_selections, 2) if total_selections else 0} for opt, cnt in option_counts.items()]
                 distribution.sort(key=lambda x: x["count"], reverse=True)
                 co_occurrence_list = [{"pair": pair, "count": ccount} for pair, ccount in co_occurrence.items()]; co_occurrence_list.sort(key=lambda x: x["count"], reverse=True)
                 analytics_data = {"type": "multi_select_distribution", "option_distribution": distribution, "top_co_occurrences": co_occurrence_list[:15], "count_na": na_count}

            elif qtype == "rating":
                analytics_data = ResponseController.process_slider_analytics(question, question_responses)
            elif qtype == "numerical-input":
                analytics_data = ResponseController.process_numeric_input_analytics(question, question_responses)
            elif qtype == "interactive-ranking":
                analytics_data = ResponseController.process_ranking_analytics(question, question_responses)
            # ... Add elif blocks for other specific processors if needed (e.g., star-rating, open-ended) ...
            elif qtype == "star-rating":
                 # Similar logic as get_question_analytics_unified's star-rating block
                 numeric_values = []; na_count = 0
                 for r in question_responses:
                     if r.is_not_applicable: na_count += 1; continue
                     val = ResponseController.parse_answer(r.response_text)
                     try: numeric_values.append(float(val))
                     except (ValueError, TypeError): continue
                 count_valid = len(numeric_values); total_responses_considered = count_valid + na_count
                 stats_data = {"type": "star-rating", "count_valid": count_valid, "count_na": na_count, "total_responses_considered": total_responses_considered, "mean": None, "distribution": []}
                 if numeric_values: stats_data["mean"] = round(statistics.mean(numeric_values), 2) # Calculate mean
                 analytics_data = stats_data # Assign the calculated stats
            elif qtype == "open-ended":
                # Similar logic as get_question_analytics_unified's open-ended block
                response_list = []; na_count = 0
                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    text_val = ResponseController.parse_answer(r.response_text); text_str = json.dumps(text_val) if isinstance(text_val, (list, dict)) else str(text_val)
                    response_list.append({"text": text_str})
                analytics_data = {"type": "open_ended", "count_valid": len(response_list), "count_na": na_count} # Basic counts for filtered view
            elif qtype in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
                try:
                    grid_data = ResponseController.process_grid_responses_for_analytics(question, question_responses, qtype)
                    analytics_data = { "type": "grid_data", "grid_data": grid_data }
                except Exception as e:
                    analytics_data = { "type": "grid_data_error", "error": str(e) }
            elif qtype in ['single-image-select', 'multiple-image-select']:
                 # Use the image select logic
                 hidden_label_counts = Counter(); na_count = 0; response_valid_count = 0
                 for r in question_responses:
                     if r.is_not_applicable: na_count += 1; continue
                     response_valid_count += 1
                     val = ResponseController.parse_answer(r.response_text)
                     if isinstance(val, list):
                         for hidden_label in val: hidden_label_counts[str(hidden_label)] += 1
                     elif val is not None: hidden_label_counts[str(val)] += 1
                 label_map = {opt.get('hidden_label'): opt for opt in (question.image_options or []) if isinstance(opt, dict) and opt.get('hidden_label')}
                 distribution = []; total_valid_selections = sum(hidden_label_counts.values())
                 for hidden_label, count in hidden_label_counts.items():
                     option_info = label_map.get(hidden_label); visible_label = option_info.get('label', hidden_label) if option_info else hidden_label; image_url = option_info.get('image_url') if option_info else None
                     perc_responses = round(count * 100.0 / response_valid_count, 2) if response_valid_count else 0; perc_selections = round(count * 100.0 / total_valid_selections, 2) if total_valid_selections else 0
                     distribution.append({ "option": visible_label, "hidden_label": hidden_label, "count": count, "percentage_of_responses": perc_responses, "percentage_of_selections": perc_selections, "image_url": image_url })
                 if question.not_applicable and na_count > 0:
                      na_perc_resp = round(na_count * 100.0 / response_valid_count, 2) if response_valid_count else 0; na_perc_sel = round(na_count * 100.0 / total_valid_selections, 2) if total_valid_selections else 0
                      distribution.append({ "option": na_option_text, "hidden_label": "N/A", "count": na_count, "percentage_of_responses": na_perc_resp, "percentage_of_selections": na_perc_sel, "image_url": None })
                 distribution.sort(key=lambda x: x["count"], reverse=True)
                 analytics_data = { "type": "image_select_distribution", "count_valid": response_valid_count, "count_na": na_count, "option_distribution": distribution }
            else:
                # Fallback for other types (document, signature etc.)
                na_count = sum(1 for r in question_responses if r.is_not_applicable)
                count_valid = response_count - na_count
                analytics_data = {"type": "other", "count_valid": count_valid, "count_na": na_count}

            if question.has_other_option:
                analytics_data["other_texts"] = other_texts
            results["analytics"] = analytics_data
            return results, 200

        except Exception as e:
            import traceback
            current_app.logger.error(f"Error processing filtered analytics for Q {question_id}: {traceback.format_exc()}")
            return {"error": f"Failed processing filtered analytics for question {question_id}: {str(e)}"}, 500

     
        
    @staticmethod
    def get_question_analytics_unified(survey_id, question_id):
        """
        Return analytics for a single question, covering multiple types.
        Handles N/A options explicitly.
        Handles image select using hidden_label and maps back to visible label.
        Handles star rating grid using updated processor.
        MODIFIED: Calls specific analytics processors for 'rating' and 'numerical-input'.
        MODIFIED: Calls specific analytics processor for 'ranking'.
        MODIFIED: Handles 'scale' within the single-choice block.
        """
        from collections import Counter
        import statistics
        import re
        from flask import current_app

        try:
            # --- Fetch Survey, Question, and Responses (existing logic) ---
            survey = Survey.query.get(survey_id)
            if not survey: return {"error": "Survey not found"}, 404
            question = Question.query.filter_by(id=question_id, survey_id=survey_id).first()
            if not question: return {"error": "Question not found or doesn't belong to this survey"}, 404
            submissions = Submission.query.filter_by(survey_id=survey_id).all()
            submission_ids = [s.id for s in submissions]
            question_responses = Response.query.filter(
                Response.submission_id.in_(submission_ids),
                Response.question_id == question.id
            ).all()
            # Collect free-form text entered when an "Other" option was selected
            other_texts = [
                r.other_text for r in question_responses
                if getattr(r, "is_other", False) and r.other_text
            ]
            na_option_text = question.not_applicable_text or "Not Applicable"
            total_count = len(question_responses)

            if not question_responses:
                 return { "question_id": question.id, "question_text": question.question_text, "question_type": question.question_type, "has_na_option": question.not_applicable, "total_responses": 0, "analytics": {}}, 200

            results = {
                "question_id": question.id, "question_text": question.question_text, "question_type": question.question_type,
                "has_na_option": question.not_applicable, "total_responses": total_count
            }
            qtype = question.question_type
            analytics = {} # Initialize analytics dict

            # --- Analytics Processing Logic ---

            # SINGLE-CHOICE / DROPDOWN / SCALE
            if qtype in ["multiple-choice", "dropdown", "single-choice", "scale"]:
                option_counts = Counter(); na_count = 0
                # Determine the source of options/labels
                if qtype == 'scale' and question.scale_points:
                    option_source = question.scale_points # List of strings
                    is_simple_list = True
                elif question.options:
                    option_source = question.options # List of dicts or strings
                    is_simple_list = not all(isinstance(opt, dict) for opt in option_source) # Check if it's not list of dicts
                else:
                    option_source = [] # No options defined
                    is_simple_list = True

                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    val = ResponseController.parse_answer(r.response_text)
                    # Normalize the response value to string for counting
                    if isinstance(val, dict) and 'text' in val: val_str = str(val['text'])
                    elif isinstance(val, list) and val: val_str = str(val[0]) # Use first element if list
                    else: val_str = str(val)
                    option_counts[val_str] += 1

                # Add N/A count if applicable
                if question.not_applicable and na_count > 0:
                     # Use the specific N/A text defined in the question
                     option_counts[na_option_text] += na_count

                total_valid_opts = sum(option_counts.values()) # Includes N/A if counted
                distribution = []

                # Ensure the distribution list includes all defined options/scale points, even if count is 0
                defined_labels = set()
                if is_simple_list:
                    for item in option_source:
                        label = str(item)
                        defined_labels.add(label)
                        count = option_counts.get(label, 0)
                        perc = round((count / total_valid_opts * 100), 2) if total_valid_opts else 0
                        distribution.append({"option": label, "count": count, "percentage": perc})
                else: # List of dicts
                    for item_dict in option_source:
                        label = str(item_dict.get('text',''))
                        if not label: continue
                        defined_labels.add(label)
                        count = option_counts.get(label, 0)
                        perc = round((count / total_valid_opts * 100), 2) if total_valid_opts else 0
                        distribution.append({"option": label, "count": count, "percentage": perc})

                # Add any counted options not in the original definition (e.g., "Other" text if stored that way)
                for counted_label, count in option_counts.items():
                    if counted_label not in defined_labels and counted_label != na_option_text: # Avoid re-adding defined or N/A
                        perc = round((count / total_valid_opts * 100), 2) if total_valid_opts else 0
                        distribution.append({"option": counted_label, "count": count, "percentage": perc})

                # Add N/A to distribution if it wasn't part of the defined options but was counted
                if question.not_applicable and na_option_text not in defined_labels and na_count > 0:
                    na_perc = round((na_count / total_valid_opts * 100), 2) if total_valid_opts else 0
                    # Ensure N/A isn't added twice if it was already counted as an "undefined" option
                    if not any(d['option'] == na_option_text for d in distribution):
                         distribution.append({"option": na_option_text, "count": na_count, "percentage": na_perc})


                # Sort distribution (optional, by count is common)
                #distribution.sort(key=lambda x: x["count"], reverse=True)
                #distribution.sort(key=lambda x: x["count"], reverse=True)
                analytics = {"type": "single_select_distribution", "options_distribution": distribution}


            # CHECKBOX / MULTI-SELECT (Non-grid)
            elif qtype in ['checkbox', 'multi-choice']:
                option_counts = Counter(); co_occurrence = Counter(); response_valid_count = 0; na_count = 0
                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    response_valid_count += 1
                    val = ResponseController.parse_answer(r.response_text)
                    current_selection = []
                    if isinstance(val, list):
                        current_selection = [str(item) for item in val] # Assume list of strings (or convert)
                    elif val is not None: # Handle single value stored for multi-select? (Less common)
                        current_selection = [str(val)]

                    for item_str in current_selection:
                        option_counts[item_str] += 1 # Count each selected option text

                    # Co-occurrence logic remains the same
                    sorted_items = sorted(current_selection)
                    for i in range(len(sorted_items)):
                        for j in range(i + 1, len(sorted_items)): co_occurrence[(sorted_items[i], sorted_items[j])] += 1

                # Add N/A count if applicable
                if question.not_applicable and na_count > 0:
                    option_counts[na_option_text] += na_count

                total_selections = sum(option_counts.values()) # Total number of times any option was checked
                distribution = []

                # Ensure all defined options appear in distribution
                defined_options_texts = set()
                if question.options and isinstance(question.options, list):
                    for opt in question.options:
                        label = str(opt.get('text')) if isinstance(opt, dict) else str(opt)
                        if label: defined_options_texts.add(label)

                for opt_text in defined_options_texts:
                     cnt = option_counts.get(opt_text, 0)
                     perc_resp = round(cnt * 100.0 / response_valid_count, 2) if response_valid_count else 0
                     perc_sel = round(cnt * 100.0 / total_selections, 2) if total_selections else 0
                     distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

                # Add any other counted options (like "Other") not in defined list
                for opt_text, cnt in option_counts.items():
                    if opt_text not in defined_options_texts and opt_text != na_option_text:
                        perc_resp = round(cnt * 100.0 / response_valid_count, 2) if response_valid_count else 0
                        perc_sel = round(cnt * 100.0 / total_selections, 2) if total_selections else 0
                        distribution.append({ "option": opt_text, "count": cnt, "percentage_of_responses": perc_resp, "percentage_of_selections": perc_sel })

                # Add N/A to distribution if counted and not already included
                if question.not_applicable and na_count > 0 and na_option_text not in defined_options_texts:
                    na_perc_resp = round(na_count * 100.0 / response_valid_count, 2) if response_valid_count else 0
                    na_perc_sel = round(na_count * 100.0 / total_selections, 2) if total_selections else 0
                    # Check if already added as an "other" counted option
                    if not any(d['option'] == na_option_text for d in distribution):
                        distribution.append({ "option": na_option_text, "count": na_count, "percentage_of_responses": na_perc_resp, "percentage_of_selections": na_perc_sel })


                # Sort distribution (optional, by count is common)
                # distribution.sort(key=lambda x: x["count"], reverse=True) # MODIFIED: Removed sort by count
                co_occurrence_list = [{"pair": pair, "count": ccount} for pair, ccount in co_occurrence.items()]
                co_occurrence_list.sort(key=lambda x: x["count"], reverse=True)
                analytics = {"type": "multi_select_distribution", "option_distribution": distribution, "top_co_occurrences": co_occurrence_list[:15], "count_na": na_count}


            # RATING (SLIDER)
            elif qtype == "rating":
                analytics = ResponseController.process_slider_analytics(question, question_responses)

            # NUMERICAL INPUT
            elif qtype == "numerical-input":
                analytics = ResponseController.process_numeric_input_analytics(question, question_responses)

            # NPS / LEGACY RATING-SCALE
            elif qtype in ["rating-scale", "nps"]:
                numeric_values = []; na_count = 0
                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    val = ResponseController.parse_answer(r.response_text)
                    try: numeric_values.append(float(val))
                    except (ValueError, TypeError): continue

                count_valid = len(numeric_values)
                total_responses_considered = count_valid + na_count
                stats_data = {
                    "type": "numeric_stats", "count_valid": count_valid, "count_na": na_count,
                    "total_responses_considered": total_responses_considered,
                    "mean": None, "median": None, "min": None, "max": None, "std_dev": None,
                    "distribution": []
                }
                if numeric_values:
                    stats_data["mean"] = round(statistics.mean(numeric_values), 2)
                    stats_data["median"] = round(statistics.median(numeric_values), 2)
                    stats_data["min"] = round(min(numeric_values), 2)
                    stats_data["max"] = round(max(numeric_values), 2)
                    try: stats_data["std_dev"] = round(statistics.stdev(numeric_values), 2) if count_valid > 1 else 0
                    except statistics.StatisticsError: stats_data["std_dev"] = None

                    if qtype == "nps":
                        value_counts = Counter(numeric_values)
                        for val_num in range(0, 11): # NPS range 0-10
                             val = float(val_num)
                             cnt = value_counts.get(val, 0)
                             perc = round(cnt * 100.0 / count_valid, 2) if count_valid else 0
                             stats_data["distribution"].append({"value": val, "count": cnt, "percentage": perc})

                        promoters = sum(1 for v in numeric_values if v >= 9)
                        passives = sum(1 for v in numeric_values if 7 <= v <= 8)
                        detractors = sum(1 for v in numeric_values if v <= 6)
                        total_nps_responses = len(numeric_values)
                        nps_score = (promoters - detractors) * 100 / total_nps_responses if total_nps_responses > 0 else 0
                        stats_data["nps_segments"] = {"promoters": promoters, "passives": passives, "detractors": detractors}
                        stats_data["nps_score"] = round(nps_score, 2)
                analytics = stats_data


            # STANDALONE STAR RATING
            elif qtype == "star-rating":
                numeric_values = []; na_count = 0
                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    val = ResponseController.parse_answer(r.response_text)
                    try: numeric_values.append(float(val))
                    except (ValueError, TypeError): continue

                count_valid = len(numeric_values)
                total_responses_considered = count_valid + na_count
                stats_data = {
                    "type": "star-rating", "count_valid": count_valid, "count_na": na_count,
                    "total_responses_considered": total_responses_considered, "mean": None,
                    "distribution": []
                }
                if numeric_values:
                    stats_data["mean"] = round(statistics.mean(numeric_values), 2)
                    value_counts = Counter(numeric_values)
                    # Default star range 1-5 if not defined
                    start = int(question.rating_start if question.rating_start is not None else 1)
                    end = int(question.rating_end if question.rating_end is not None else 5)
                    step = int(question.rating_step if question.rating_step is not None else 1)
                    for star_val_num in range(start, end + step, step):
                        star_val = float(star_val_num)
                        cnt = value_counts.get(star_val, 0)
                        perc = round(cnt * 100.0 / count_valid, 2) if count_valid else 0
                        stats_data["distribution"].append({"value": star_val, "count": cnt, "percentage": perc})

                    if question.show_na and na_count > 0:
                         na_perc = round(na_count * 100.0 / total_responses_considered, 2) if total_responses_considered else 0
                         stats_data["distribution"].append({"value": na_option_text, "count": na_count, "percentage": na_perc})
                analytics = stats_data


            # OPEN-ENDED
            elif qtype == "open-ended":
                response_list = []; na_count = 0
                for r in question_responses:
                    if r.is_not_applicable: na_count += 1; continue
                    text_val = ResponseController.parse_answer(r.response_text)
                    text_str = json.dumps(text_val) if isinstance(text_val, (list, dict)) else str(text_val)
                    sub = Submission.query.get(r.submission_id)
                    username = None
                    if sub and sub.user_id: user_info = User.query.get(sub.user_id); username = user_info.username if user_info else None
                    response_list.append({"text": text_str, "created_at": r.created_at.isoformat(), "username": username or "Anonymous"})

                response_list.sort(key=lambda x: x["created_at"], reverse=True)
                latest_10 = response_list[:10]
                all_words = []; STOPWORDS = set(["the", "a", "an", "in", "and", "to", "of", "is", "that", "it", 
                                                'with', 'for', 'on', 'at', 'this', 'my', 'was', 'but', 'be', 'are', 'i', 'you', 'me', 'they', 'or', 'as', 'so']) # Example stopwords
                for item in response_list:
                    words = re.findall(r"\b\w+\b", item["text"].lower())
                    for w in words:
                        if w not in STOPWORDS and len(w) > 1: all_words.append(w)
                freq = Counter(all_words).most_common(30); freq_data = [{"word": x[0], "count": x[1]} for x in freq]
                analytics = {"type": "open_ended", "count_valid": len(response_list), "count_na": na_count, "latest_10": latest_10, "word_frequencies": freq_data}

            # GRID-TYPE QUESTIONS
            elif qtype in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
                try:
                    grid_data = ResponseController.process_grid_responses_for_analytics(question, question_responses, qtype)
                    analytics = { "type": "grid_data", "grid_data": grid_data }
                    current_app.logger.info(f"Successfully processed grid data for Q {question.id} with {grid_data.get('total_responses', 0)} responses.")
                except Exception as e:
                    current_app.logger.error(f"Error processing grid data for Q {question.id}: {e}", exc_info=True)
                    analytics = { "type": "grid_data_error", "error": str(e) }


            # RANKING
            elif qtype == 'interactive-ranking':
                 analytics = ResponseController.process_ranking_analytics(question, question_responses)


            # IMAGE SELECT (Single/Multi)
            elif qtype in ['single-image-select', 'multiple-image-select']:
                 hidden_label_counts = Counter(); na_count = 0; response_valid_count = 0
                 for r in question_responses:
                     if r.is_not_applicable: na_count += 1; continue
                     response_valid_count += 1
                     val = ResponseController.parse_answer(r.response_text)
                     if isinstance(val, list):
                         for hidden_label in val: hidden_label_counts[str(hidden_label)] += 1
                     elif val is not None: # Handle single value case
                         hidden_label_counts[str(val)] += 1

                 label_map = {opt.get('hidden_label'): opt for opt in (question.image_options or []) if isinstance(opt, dict) and opt.get('hidden_label')}
                 distribution = []; total_valid_selections = sum(hidden_label_counts.values())

                 for hidden_label, count in hidden_label_counts.items():
                     option_info = label_map.get(hidden_label)
                     visible_label = option_info.get('label', hidden_label) if option_info else hidden_label
                     image_url = option_info.get('image_url') if option_info else None
                     perc_responses = round(count * 100.0 / response_valid_count, 2) if response_valid_count else 0; perc_selections = round(count * 100.0 / total_valid_selections, 2) if total_valid_selections else 0
                     distribution.append({ "option": visible_label, "hidden_label": hidden_label, "count": count, "percentage_of_responses": perc_responses, "percentage_of_selections": perc_selections, "image_url": image_url })

                 # Add N/A count if applicable
                 if question.not_applicable and na_count > 0:
                    na_perc_resp = round(na_count * 100.0 / response_valid_count, 2) if response_valid_count else 0
                    na_perc_sel = round(na_count * 100.0 / total_valid_selections, 2) if total_valid_selections else 0
                    distribution.append({ "option": na_option_text, "hidden_label": "N/A", "count": na_count, "percentage_of_responses": na_perc_resp, "percentage_of_selections": na_perc_sel, "image_url": None })


                 distribution.sort(key=lambda x: x["count"], reverse=True)
                 analytics = { "type": "image_select_distribution", "count_valid": response_valid_count, "count_na": na_count, "option_distribution": distribution }


            else: # Fallback for other/unsupported types
                 na_count = sum(1 for r in question_responses if r.is_not_applicable)
                 count_valid = total_count - na_count
                 analytics = {
                     "type": "other_unsupported",
                     "count_valid": count_valid,
                     "count_na": na_count,
                     "total_responses_considered": total_count
                 }

            if question.has_other_option:
                analytics["other_texts"] = other_texts
            results["analytics"] = analytics
            return results, 200

        except Exception as e:
            current_app.logger.error(f"Error processing analytics for Q {question_id}: {e}", exc_info=True)
            return {"error": f"Failed to process analytics for question {question_id}: {str(e)}"}, 500

    @staticmethod
    def get_response_time_analytics_advanced(survey_id, filters=None):
        """
        Returns advanced response time stats for the given survey including cohort_tag filter.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        query = Submission.query.filter_by(survey_id=survey_id)
        if filters:
            # Example filter usage for demographics
            if filters.get('age_group'):
                # Ensure list for 'in_' operator
                age_groups_filter = filters['age_group']
                if isinstance(age_groups_filter, str): age_groups_filter = [age_groups_filter]
                if isinstance(age_groups_filter, list): query = query.filter(Submission.age_group.in_(age_groups_filter))
            if filters.get('location'):
                 # Ensure list for 'in_' operator
                locations_filter = filters['location']
                if isinstance(locations_filter, str): locations_filter = [locations_filter]
                if isinstance(locations_filter, list): query = query.filter(Submission.location.in_(locations_filter))
            if filters.get('cohort_tag'): # ADDED Cohort Filter
                 # Ensure list for 'in_' operator
                cohorts_filter = filters['cohort_tag']
                if isinstance(cohorts_filter, str): cohorts_filter = [cohorts_filter]
                if isinstance(cohorts_filter, list): query = query.filter(Submission.cohort_tag.in_(cohorts_filter))
            # Add other filters similarly (education, company, gender)

        submissions = query.all()
        if not submissions:
            return {"error": "No submissions found for this filter"}, 404

        # 1) Overall average duration
        valid_durations = [s.duration for s in submissions if s.duration and s.duration > 0]
        avg_duration = round(sum(valid_durations)/len(valid_durations), 2) if valid_durations else 0

        # 2) Distribution histogram (simplified bins)
        bins = [0, 60, 120, 180, 240, 300, 600]
        bin_labels = ["<1m","1–2m","2–3m","3–4m","4–5m","5–10m","10m+"]
        histogram = { label: 0 for label in bin_labels }
        for d in valid_durations:
            if d < 60: histogram["<1m"] += 1
            elif d < 120: histogram["1–2m"] += 1
            elif d < 180: histogram["2–3m"] += 1
            elif d < 240: histogram["3–4m"] += 1
            elif d < 300: histogram["4–5m"] += 1
            elif d < 600: histogram["5–10m"] += 1
            else: histogram["10m+"] += 1

        # 3) Average time per question (based on Response.response_time)
        question_times = {}
        submission_ids = [s.id for s in submissions] # Get IDs for efficient response query
        all_responses = Response.query.filter(Response.submission_id.in_(submission_ids)).all()

        for r in all_responses:
            if r.response_time and r.response_time > 0:
                question_times.setdefault(r.question_id, []).append(r.response_time)

        question_avg_times = {}
        for qid, time_list in question_times.items():
            question_avg_times[qid] = round(sum(time_list)/len(time_list), 2)

        result = {
            "survey_id": survey_id,
            "filters": filters,
            "average_duration": avg_duration,
            "duration_histogram": histogram,
            "question_avg_times": question_avg_times,
            "count_submissions": len(submissions)
        }
        return result, 200

    @staticmethod
    def get_dropout_analysis(survey_id, filters=None):
        """
        Returns stats on which question is the last answered, including cohort_tag filter.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        query = Submission.query.filter_by(survey_id=survey_id)
        if filters:
            if filters.get('age_group'):
                age_groups_filter = filters['age_group']
                if isinstance(age_groups_filter, str): age_groups_filter = [age_groups_filter]
                if isinstance(age_groups_filter, list): query = query.filter(Submission.age_group.in_(age_groups_filter))
            if filters.get('location'):
                locations_filter = filters['location']
                if isinstance(locations_filter, str): locations_filter = [locations_filter]
                if isinstance(locations_filter, list): query = query.filter(Submission.location.in_(locations_filter))
            if filters.get('cohort_tag'): # ADDED Cohort Filter
                cohorts_filter = filters['cohort_tag']
                if isinstance(cohorts_filter, str): cohorts_filter = [cohorts_filter]
                if isinstance(cohorts_filter, list): query = query.filter(Submission.cohort_tag.in_(cohorts_filter))
            # Add other filters similarly

        submissions = query.all()
        if not submissions:
            return {"error": "No submissions found with those filters"}, 404

        last_question_counter = Counter()
        submission_ids = [s.id for s in submissions]
        # Eager load questions with responses for efficiency
        all_responses = Response.query.filter(Response.submission_id.in_(submission_ids)).options(db.joinedload(Response.question)).all()
        # Group responses by submission id
        responses_by_sub = {}
        for r in all_responses:
            if r.submission_id not in responses_by_sub:
                responses_by_sub[r.submission_id] = []
            responses_by_sub[r.submission_id].append(r)

        # Map sequence number to question text
        seq_map = {q.sequence_number: q.question_text for q in survey.questions if q.sequence_number is not None}

        for sub_id in submission_ids:
            responses = responses_by_sub.get(sub_id, [])
            seq_list = [r.question.sequence_number for r in responses if r.question and r.question.sequence_number is not None]
            if seq_list:
                max_seq = max(seq_list)
                last_question_counter[max_seq] += 1
            else:
                last_question_counter[0] += 1 # Dropped before Q1

        result = {
            "total_submissions": len(submissions),
            "filters_applied": filters,
            "dropout_distribution": {}
        }

        # Build distribution with question text
        for seq, count in last_question_counter.items():
            if seq == 0:
                label = "Dropped out before Q1"
            else:
                label = f"Last answered Q#{seq}"
                q_text = seq_map.get(seq)
                if q_text: label += f" ({q_text[:50]}{'...' if len(q_text) > 50 else ''})" # Add truncated text
            result["dropout_distribution"][label] = count

        return result, 200


    @staticmethod
    def process_grid_responses_for_analytics(question, question_responses, grid_type):
            from collections import Counter # Ensure Counter is imported

            print(f"Processing grid responses for question {question.id}, type {grid_type}")

            grid_rows = question.grid_rows if question.grid_rows else []
            grid_columns = question.grid_columns if question.grid_columns else []

            # Use labels directly from grid_rows/grid_columns definition
            row_labels = [row.get('text', f'Row {i+1}') for i, row in enumerate(grid_rows)]
            col_labels = [col.get('text', f'Column {i+1}') for i, col in enumerate(grid_columns)]
            row_count = len(row_labels)
            col_count = len(col_labels)

            print(f"Grid dimensions: {row_count} rows × {col_count} columns")
            print(f"Row Labels: {row_labels}")
            print(f"Column Labels: {col_labels}")

            grid_data = {
                "rows": row_labels,
                "columns": col_labels,
                "values": [[0 for _ in range(col_count)] for _ in range(row_count)], # Counts or sums
                "count_values": [[0 for _ in range(col_count)] for _ in range(row_count)], # Explicit counts for averages
                "cell_averages": [[0.0 for _ in range(col_count)] for _ in range(row_count)], # Specific for star rating
                "row_totals": [0 for _ in range(row_count)], # Total responses/selections per row
                "column_totals": [0 for _ in range(col_count)], # Total responses/selections per column
                "row_averages": [0.0 for _ in range(row_count)], # Average rating or % per row
                "column_averages": [0.0 for _ in range(col_count)], # Average rating or % per column
                "total_responses": len(question_responses) # Total submissions answering this question
            }

            # --- Helper to find index safely ---
            def find_index(label_list, label_to_find):
                try:
                    # Case-insensitive and trim spaces comparison
                    return next(i for i, lbl in enumerate(label_list) if lbl.strip().lower() == label_to_find.strip().lower())
                except StopIteration:
                    return None # Not found

            # --- Process based on grid type ---
            if grid_type == 'radio-grid':
                print("Processing radio-grid responses")
                for r in question_responses:
                    try:
                        parsed = json.loads(r.response_text)
                        if isinstance(parsed, dict):
                            # Format: {"Row Label 1": "Selected Column Label", "Row Label 2": "N/A"}
                            for row_label_str, selected_col_label_str in parsed.items():
                                row_idx = find_index(row_labels, row_label_str)
                                if row_idx is None:
                                    print(f"Warning: Row label '{row_label_str}' not found. Skipping.")
                                    continue

                                if selected_col_label_str == 'N/A':
                                    # Optionally handle N/A count if needed, but skip value processing
                                    grid_data["row_totals"][row_idx] += 1 # Count N/A as a response for the row total
                                    continue

                                col_idx = find_index(col_labels, str(selected_col_label_str))
                                if col_idx is None:
                                    print(f"Warning: Column label '{selected_col_label_str}' not found for row '{row_label_str}'. Skipping.")
                                    continue

                                # Increment count for the selected cell
                                grid_data["values"][row_idx][col_idx] += 1
                                grid_data["count_values"][row_idx][col_idx] += 1 # Also track count here
                                grid_data["row_totals"][row_idx] += 1
                                grid_data["column_totals"][col_idx] += 1
                    except (json.JSONDecodeError, TypeError, AttributeError) as e:
                        print(f"Error processing radio-grid response {r.id}: {e}")
                        continue

            elif grid_type == 'checkbox-grid':
                print("Processing checkbox-grid responses")
                co_occurrences = Counter()
                for r in question_responses:
                    try:
                        parsed = json.loads(r.response_text)
                        if isinstance(parsed, dict):
                            # Format: {"Row Label 1": ["Col Label A", "Col Label B"], "Row Label 2": "N/A"}
                            for row_label_str, selected_col_labels in parsed.items():
                                row_idx = find_index(row_labels, row_label_str)
                                if row_idx is None:
                                    print(f"Warning: Row label '{row_label_str}' not found. Skipping.")
                                    continue

                                if selected_col_labels == 'N/A':
                                    grid_data["row_totals"][row_idx] += 1 # Count N/A as a response for the row total
                                    continue

                                if isinstance(selected_col_labels, list):
                                    current_row_col_indices = [] # For co-occurrence
                                    for col_label_str in selected_col_labels:
                                        col_idx = find_index(col_labels, str(col_label_str))
                                        if col_idx is None:
                                            print(f"Warning: Column label '{col_label_str}' not found for row '{row_label_str}'. Skipping.")
                                            continue

                                        # Increment count for the selected cell
                                        grid_data["values"][row_idx][col_idx] += 1
                                        grid_data["count_values"][row_idx][col_idx] += 1
                                        grid_data["row_totals"][row_idx] += 1 # Increment row total for each check
                                        grid_data["column_totals"][col_idx] += 1
                                        current_row_col_indices.append(col_idx)

                                    # Process co-occurrences for this row
                                    current_row_col_indices.sort()
                                    for i in range(len(current_row_col_indices)):
                                        for j in range(i + 1, len(current_row_col_indices)):
                                            pair = (current_row_col_indices[i], current_row_col_indices[j])
                                            co_occurrences[pair] += 1
                                else:
                                    print(f"Warning: Expected list for checkbox cols, got {type(selected_col_labels)} for row '{row_label_str}'")

                    except (json.JSONDecodeError, TypeError, AttributeError) as e:
                        print(f"Error processing checkbox-grid response {r.id}: {e}")
                        continue
                # Add co-occurrences to grid data
                co_occurrences_list = [(k, v) for k, v in co_occurrences.items()]
                co_occurrences_list.sort(key=lambda x: x[1], reverse=True)
                grid_data["co_occurrences"] = co_occurrences_list

            elif grid_type == 'star-rating-grid':
                process_star_rating_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
            # --- Calculate Row and Column Averages/Totals (adjusted logic) ---
            # Row Averages
            for r_idx in range(row_count):
                row_total_count = grid_data["count_values"][r_idx] # List of counts per cell in this row
                valid_responses_in_row = sum(c for c in row_total_count if c > 0) # Sum of counts excluding 0 counts

                if valid_responses_in_row > 0:
                    if grid_type == 'star-rating-grid':
                        # Average of cell averages in the row
                        row_sum_of_averages = sum(grid_data["cell_averages"][r_idx][c_idx] * grid_data["count_values"][r_idx][c_idx]
                                                for c_idx in range(col_count) if grid_data["count_values"][r_idx][c_idx] > 0)
                        grid_data["row_averages"][r_idx] = round(row_sum_of_averages / valid_responses_in_row, 2)

                    elif grid_type == 'radio-grid' or grid_type == 'checkbox-grid':
                        # For choice grids, row average might represent % of total row selections or average value if cols are numeric
                        # Simple approach: Average number of selections per column for this row
                        grid_data["row_averages"][r_idx] = round(grid_data["row_totals"][r_idx] / col_count, 2) if col_count > 0 else 0.0


            # Column Averages
            for c_idx in range(col_count):
                col_total_count = [grid_data["count_values"][r_idx][c_idx] for r_idx in range(row_count)] # List of counts per cell in this col
                valid_responses_in_col = sum(c for c in col_total_count if c > 0)

                if valid_responses_in_col > 0:
                    if grid_type == 'star-rating-grid':
                        # Average of cell averages in the column
                        col_sum_of_averages = sum(grid_data["cell_averages"][r_idx][c_idx] * grid_data["count_values"][r_idx][c_idx]
                                                for r_idx in range(row_count) if grid_data["count_values"][r_idx][c_idx] > 0)
                        grid_data["column_averages"][c_idx] = round(col_sum_of_averages / valid_responses_in_col, 2)

                    elif grid_type == 'radio-grid' or grid_type == 'checkbox-grid':
                        # Simple approach: Average number of selections per row for this column
                        grid_data["column_averages"][c_idx] = round(grid_data["column_totals"][c_idx] / row_count, 2) if row_count > 0 else 0.0


            print(f"Finished processing grid responses for question {question.id}")
            # Remove keys not needed by GridAnalytics component to match its expectations
            # Keep: rows, columns, values (counts for radio/checkbox), count_values, cell_averages, row_totals, column_totals, row_averages, column_averages, total_responses
            # Remove if not directly used: co_occurrences (unless GridAnalytics needs it)
            grid_data.pop("co_occurrences", None) # Example: remove if not needed
            grid_data["question_type"] = grid_type # Add question type for frontend logic

            # For radio/checkbox, 'values' should contain counts. For star-rating, 'cell_averages' holds averages, and 'count_values' holds counts.
            if grid_type == 'star-rating-grid':
                # Ensure 'values' is not misinterpreted - maybe remove it if cell_averages is used
                # grid_data.pop("values", None) # Or ensure frontend uses cell_averages and count_values
                pass # Frontend expects cell_averages and count_values


            return grid_data






def process_radio_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """Process radio grid responses"""
    for r in responses:
        try:
            # Try to parse as JSON first
            data = json.loads(r.response_text)
            
            if isinstance(data, dict):
                # Process dictionary format: {"0": "1", "1": "0", "2": "2"} (row -> col)
                for row_idx_str, col_idx_str in data.items():
                    try:
                        row_idx = int(row_idx_str)
                        col_idx = int(col_idx_str)
                        
                        if 0 <= row_idx < len(grid_data["rows"]) and 0 <= col_idx < len(grid_data["columns"]):
                            grid_data["values"][row_idx][col_idx] += 1
                            grid_data["row_totals"][row_idx] += 1
                            grid_data["column_totals"][col_idx] += 1
                    except (ValueError, IndexError, TypeError) as e:
                        print(f"Error processing radio grid row/column indices: {e}")
                        continue
            elif isinstance(data, list):
                # Process list format: ["0:1", "1:0", "2:2"]
                for item in data:
                    try:
                        if isinstance(item, str) and ":" in item:
                            parts = item.split(":")
                            if len(parts) == 2:
                                row_idx = int(parts[0])
                                col_idx = int(parts[1])
                                
                                if 0 <= row_idx < len(grid_data["rows"]) and 0 <= col_idx < len(grid_data["columns"]):
                                    grid_data["values"][row_idx][col_idx] += 1
                                    grid_data["row_totals"][row_idx] += 1
                                    grid_data["column_totals"][col_idx] += 1
                    except (ValueError, IndexError, TypeError) as e:
                        print(f"Error processing radio grid list item: {e}")
                        continue
        except json.JSONDecodeError:
            # Handle non-JSON responses (format might be "row_idx:col_idx")
            try:
                parts = r.response_text.split(':')
                if len(parts) == 2:
                    try:
                        row_idx = int(parts[0])
                        col_idx = int(parts[1])
                        
                        if 0 <= row_idx < len(grid_data["rows"]) and 0 <= col_idx < len(grid_data["columns"]):
                            grid_data["values"][row_idx][col_idx] += 1
                            grid_data["row_totals"][row_idx] += 1
                            grid_data["column_totals"][col_idx] += 1
                    except (ValueError, IndexError, TypeError) as e:
                        print(f"Error processing radio grid string format: {e}")
                        continue
            except Exception as e:
                print(f"Error processing radio grid response: {e}")
                continue

def process_checkbox_grid_responses(responses, grid_data, grid_rows, grid_columns):
    """Process checkbox grid responses with enhanced error handling"""
    for r in responses:
        try:
            # Try to parse the response as JSON
            try:
                data = json.loads(r.response_text)
            except json.JSONDecodeError:
                # If not JSON, try as plain text (but likely invalid)
                data = r.response_text
                print(f"Warning: Non-JSON response for checkbox grid: {r.response_text}")
                continue  # Skip non-JSON responses for checkbox grids
            
            # Handle different possible formats of checkbox-grid responses
            if isinstance(data, list):
                # Format: ["0:1", "1:0", "2:2"] (row:column strings)
                for selection in data:
                    try:
                        if isinstance(selection, str) and ":" in selection:
                            parts = selection.split(':')
                            if len(parts) == 2:
                                try:
                                    row_idx = int(parts[0])
                                    col_idx = int(parts[1])
                                except ValueError:
                                    # Try to match by text if not numeric
                                    row_idx = -1
                                    col_idx = -1
                                    
                                    for i, row in enumerate(grid_data["rows"]):
                                        if row.get('text', '') == parts[0] or str(row) == parts[0]:
                                            row_idx = i
                                            break
                                            
                                    for i, col in enumerate(grid_data["columns"]):
                                        if col.get('text', '') == parts[1] or str(col) == parts[1]:
                                            col_idx = i
                                            break
                                
                                if 0 <= row_idx < len(grid_data["rows"]) and 0 <= col_idx < len(grid_data["columns"]):
                                    grid_data["values"][row_idx][col_idx] += 1
                                    grid_data["row_totals"][row_idx] += 1
                                    grid_data["column_totals"][col_idx] += 1
                    except (ValueError, IndexError, TypeError) as e:
                        print(f"Error processing checkbox grid list item: {e}")
                        continue
            elif isinstance(data, dict):
                # Format: {"0": [0, 2], "1": [1, 3]} (row -> list of selected columns)
                for row_idx_str, col_indices in data.items():
                    try:
                        # Try to get row index
                        row_idx = -1
                        try:
                            row_idx = int(row_idx_str)
                        except ValueError:
                            # Try as row text
                            for i, row in enumerate(grid_data["rows"]):
                                if row.get('text', '') == row_idx_str or str(row) == row_idx_str:
                                    row_idx = i
                                    break
                        
                        # Skip invalid row indices
                        if row_idx < 0 or row_idx >= len(grid_data["rows"]):
                            continue
                        
                        if isinstance(col_indices, list):
                            for col_idx_data in col_indices:
                                try:
                                    col_idx = -1
                                    if isinstance(col_idx_data, int):
                                        col_idx = col_idx_data
                                    elif isinstance(col_idx_data, str):
                                        try:
                                            col_idx = int(col_idx_data)
                                        except ValueError:
                                            # Try as column text
                                            for i, col in enumerate(grid_data["columns"]):
                                                if col.get('text', '') == col_idx_data or str(col) == col_idx_data:
                                                    col_idx = i
                                                    break
                                    
                                    if 0 <= row_idx < len(grid_data["rows"]) and 0 <= col_idx < len(grid_data["columns"]):
                                        grid_data["values"][row_idx][col_idx] += 1
                                        grid_data["row_totals"][row_idx] += 1
                                        grid_data["column_totals"][col_idx] += 1
                                except (ValueError, TypeError) as e:
                                    print(f"Error processing checkbox grid column index: {e}")
                                    continue
                        else:
                            print(f"Invalid column indices format for row {row_idx_str}: {col_indices}")
                    except (ValueError, IndexError, TypeError) as e:
                        print(f"Error processing checkbox grid row index: {e}")
                        continue
        except Exception as e:
            print(f"Error processing checkbox grid response: {e}")
            continue

        
def calculate_grid_averages(grid_data, question_type):
    """Calculate row and column averages for grid data"""
    # Star rating grids compute their averages during parsing
    if question_type == 'star-rating-grid':
        return
    for row_idx in range(len(grid_data["rows"])):
        if grid_data["row_totals"][row_idx] > 0:
            # For radio and checkbox grids, calculate the average across columns
            total_selections = sum(grid_data["values"][row_idx])
            total_possible = grid_data["row_totals"][row_idx] * len(grid_data["columns"])
            grid_data["row_averages"][row_idx] = (total_selections / total_possible * 100) if total_possible > 0 else 0
    
    # Calculate column percentages (what % of responses selected each column)
    total_responses = sum(grid_data["row_totals"])
    if total_responses > 0:
        for col_idx in range(len(grid_data["columns"])):
            grid_data["column_averages"][col_idx] = (grid_data["column_totals"][col_idx] / total_responses * 100)


def prepare_grid_cells(grid_data, question_type):
    """Prepare cell-level data for frontend rendering"""
    for row_idx in range(len(grid_data["rows"])):
        for col_idx in range(len(grid_data["columns"])):
            if question_type == 'star-rating-grid':
                avg = grid_data["cell_averages"][row_idx][col_idx]
                count = grid_data["count_values"][row_idx][col_idx]
                row_total = grid_data["row_totals"][row_idx]
                col_total = grid_data["column_totals"][col_idx]
                row_percentage = (count / row_total * 100) if row_total else 0
                column_percentage = (count / col_total * 100) if col_total else 0
                grid_data["cells"].append({
                    "row_idx": row_idx,
                    "col_idx": col_idx,
                    "row_text": grid_data["rows"][row_idx],
                    "col_text": grid_data["columns"][col_idx],
                    "value": avg,
                    "count": count,
                    "row_percentage": round(row_percentage, 2),
                    "column_percentage": round(column_percentage, 2)
                })
            else:
                value = grid_data["values"][row_idx][col_idx]
                row_percentage = 0
                if grid_data["row_totals"][row_idx] > 0:
                    row_percentage = (value / grid_data["row_totals"][row_idx] * 100)
                column_percentage = 0
                if grid_data["column_totals"][col_idx] > 0:
                    column_percentage = (value / grid_data["column_totals"][col_idx] * 100)
                grid_data["cells"].append({
                    "row_idx": row_idx,
                    "col_idx": col_idx,
                    "row_text": grid_data["rows"][row_idx],
                    "col_text": grid_data["columns"][col_idx],
                    "value": value,
                    "count": value,
                    "row_percentage": round(row_percentage, 2),
                    "column_percentage": round(column_percentage, 2)
                })

def compute_analytics(submissions, survey, skip_problematic_responses=False):
    """
    Compute analytics for a set of submissions.
    If skip_problematic_responses is True, will continue processing even if some grid responses have errors.
    """
    analytics = {}
    analytics['total_responses'] = len(submissions)
    
    # Calculate average duration (only valid durations)
    try:
        durations = [sub.duration for sub in submissions if sub.duration and sub.duration > 0]
        analytics['average_time'] = sum(durations) / len(durations) if durations else 0
    except Exception as e:
        print(f"Error calculating average duration: {e}")
        analytics['average_time'] = 0

    # Calculate completion rate and question response counts
    total_questions = len(survey.questions) if survey.questions else 0
    answered_questions = 0
    questions_with_no_data = []
    question_response_counts = {}

    # Age groups aggregation
    age_groups = {
        '18-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-54': 0,
        '55-64': 0,
        '65+': 0,
        'Unknown': 0
    }
    
    # Process each question with error handling
    for question in survey.questions:
        try:
            response_count = 0
            for sub in submissions:
                has_response = False
                for r in sub.responses:
                    if r.question_id == question.id and r.response_text:
                        has_response = True
                        response_count += 1
                        break
                if has_response:
                    answered_questions += 1
            question_response_counts[question.id] = response_count
            if response_count == 0:
                questions_with_no_data.append(question.id)
        except Exception as e:
            print(f"Error calculating response counts for question {question.id}: {e}")
            # If we're skipping problematic questions
            if skip_problematic_responses:
                question_response_counts[question.id] = 0
                questions_with_no_data.append(question.id)
            else:
                raise  # Re-raise if we're not skipping

    if total_questions > 0 and len(submissions) > 0:
        analytics['completion_rate'] = (answered_questions / (total_questions * len(submissions))) * 100
    else:
        analytics['completion_rate'] = 0
        
    analytics['question_response_counts'] = question_response_counts
    analytics['questions_with_no_data'] = questions_with_no_data

    # Advanced statistics for each question type
    numerical_stats = {}
    mcq_stats = {}
    text_stats = {}
    grid_stats = {}

    # Process each question for advanced stats with error handling
    for question in survey.questions:
        question_id = question.id
        question_type = question.question_type
        
        try:
            # For numerical input, rating-scale, and NPS questions
            if question_type in ['numerical-input', "rating-scale","rating", 'nps']:
                question_values = []
                for sub in submissions:
                    for r in sub.responses:
                        if r.question_id == question_id:
                            try:
                                value = float(r.response_text)
                                question_values.append(value)
                            except (ValueError, TypeError):
                                continue
                if question_values:
                    try:
                        mean_val = sum(question_values) / len(question_values)
                        
                        import statistics
                        try:
                            median_val = statistics.median(question_values)
                        except statistics.StatisticsError:
                            median_val = None
                        try:
                            mode_val = statistics.mode(question_values)
                        except statistics.StatisticsError:
                            mode_val = None
                        try:
                            std_dev = statistics.stdev(question_values)
                        except statistics.StatisticsError:
                            std_dev = None
                            
                        numerical_stats[question_id] = {
                            "question_text": question.question_text,
                            "mean": mean_val,
                            "median": median_val,
                            "mode": mode_val,
                            "standard_deviation": std_dev,
                            "min": min(question_values),
                            "max": max(question_values),
                            "values": question_values  # Raw values for histograms
                        }
                        
                        # Calculate NPS segments if this is an NPS question
                        if question_type == 'nps':
                            promoters = sum(1 for v in question_values if v >= 9)
                            passives = sum(1 for v in question_values if 7 <= v <= 8)
                            detractors = sum(1 for v in question_values if v <= 6)
                            total_nps = promoters + passives + detractors
                            
                            if total_nps > 0:
                                nps_score = (promoters - detractors) * 100 / total_nps
                                numerical_stats[question_id]["nps_segments"] = {
                                    "promoters": promoters,
                                    "passives": passives,
                                    "detractors": detractors
                                }
                                numerical_stats[question_id]["nps_score"] = nps_score
                    except Exception as e:
                        print(f"Error calculating numerical stats for question {question_id}: {e}")
                        if skip_problematic_responses:
                            continue
                        else:
                            raise
            
            # For multiple-choice, checkbox, dropdown, radio-grid, checkbox-grid questions
            elif question_type in ['multiple-choice', 'checkbox', 'dropdown', 'radio-grid', 'checkbox-grid','single-choice','multi-choice']:
                try:
                    answer_counts = {}
                    for sub in submissions:
                        for r in sub.responses:
                            if r.question_id == question_id:
                                try:
                                    answers = json.loads(r.response_text)
                                    if isinstance(answers, list):
                                        for answer in answers:
                                            answer_counts[str(answer)] = answer_counts.get(str(answer), 0) + 1
                                    else:
                                        answer_counts[r.response_text] = answer_counts.get(r.response_text, 0) + 1
                                except json.JSONDecodeError:
                                    answer_counts[r.response_text] = answer_counts.get(r.response_text, 0) + 1
                    
                    if answer_counts:
                        most_selected = max(answer_counts, key=answer_counts.get) if answer_counts else None
                        least_selected = min(answer_counts, key=answer_counts.get) if answer_counts else None
                        total_selections = sum(answer_counts.values())
                        percentages = {k: (v / total_selections * 100) for k, v in answer_counts.items()}
                        
                        mcq_stats[question_id] = {
                            "question_text": question.question_text,
                            "most_selected": most_selected,
                            "least_selected": least_selected,
                            "option_counts": answer_counts,
                            "option_percentages": percentages,
                            "total_selections": total_selections
                        }
                        
                        # If options have numeric reporting values, calculate average score
                        if question.options and isinstance(question.options, list):
                            numeric_values = []
                            for option in question.options:
                                if isinstance(option, dict) and 'value' in option:
                                    try:
                                        value = float(option['value'])
                                        text = option.get('text', '')
                                        count = answer_counts.get(text, 0)
                                        numeric_values.extend([value] * count)
                                    except (ValueError, TypeError):
                                        pass
                            if numeric_values:
                                mcq_stats[question_id]["average_value"] = sum(numeric_values) / len(numeric_values)
                except Exception as e:
                    print(f"Error calculating MCQ stats for question {question_id}: {e}")
                    if skip_problematic_responses:
                        continue
                    else:
                        raise
            
            # For open-ended text questions
            elif question_type == 'open-ended':
                try:
                    response_texts = []
                    response_lengths = []
                    for sub in submissions:
                        for r in sub.responses:
                            if r.question_id == question_id and r.response_text:
                                response_texts.append({
                                    "text": r.response_text,
                                    "created_at": r.created_at.isoformat() if hasattr(r.created_at, 'isoformat') else str(r.created_at)
                                })
                                response_lengths.append(len(r.response_text))
                    
                    if response_texts:
                        avg_length = sum(response_lengths) / len(response_lengths)
                        all_words = []
                        
                        for item in response_texts:
                            text = item["text"]
                            import re
                            words = re.findall(r'\b\w+\b', text.lower())
                            stopwords = {'the', 'a', 'an', 'in', 'and', 'to', 'of', 'is', 'that', 'it', 
                                        'with', 'for', 'on', 'at', 'this', 'my', 'was', 'but', 'be', 'are'}
                            words = [word for word in words if word not in stopwords and len(word) > 1]
                            all_words.extend(words)
                        
                        from collections import Counter
                        word_counts = Counter(all_words)
                        common_words = word_counts.most_common(50)
                        sorted_responses = sorted(response_texts, key=lambda x: x["created_at"], reverse=True)
                        
                        text_stats[question_id] = {
                            "question_text": question.question_text,
                            "response_count": len(response_texts),
                            "average_length": avg_length,
                            "longest_response": max(response_lengths) if response_lengths else 0,
                            "shortest_response": min(response_lengths) if response_lengths else 0,
                            "word_frequencies": common_words,
                            "latest_responses": sorted_responses[:10]
                        }
                except Exception as e:
                    print(f"Error calculating text stats for question {question_id}: {e}")
                    if skip_problematic_responses:
                        continue
                    else:
                        raise
            
            # For grid questions (radio-grid, checkbox-grid, star-rating-grid)
            elif question_type in ['radio-grid', 'checkbox-grid', 'star-rating-grid']:
                try:
                    grid_rows = question.grid_rows if question.grid_rows else []
                    grid_columns = question.grid_columns if question.grid_columns else []
                    
                    grid_data = {
                        "rows": [row.get('text', f'Row {i+1}') for i, row in enumerate(grid_rows)],
                        "columns": [col.get('text', f'Column {i+1}') for i, col in enumerate(grid_columns)],
                        "values": [[0 for _ in range(len(grid_columns))] for _ in range(len(grid_rows))],
                        "row_totals": [0] * len(grid_rows),
                        "column_totals": [0] * len(grid_columns),
                        "row_averages": [0] * len(grid_rows),
                        "column_averages": [0] * len(grid_columns)
                    }
                    
                    question_responses = []
                    for sub in submissions:
                        for r in sub.responses:
                            if r.question_id == question_id:
                                question_responses.append(r)
                    
                    # Process grid responses based on question type
                    if question_type == 'radio-grid':
                        process_radio_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
                    elif question_type == 'checkbox-grid':
                        process_checkbox_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
                    elif question_type == 'star-rating-grid':
                        process_star_rating_grid_responses(question_responses, grid_data, grid_rows, grid_columns)
                    
                    # Calculate grid averages
                    calculate_grid_averages(grid_data, question_type)
                    
                    grid_stats[question_id] = {
                        "question_text": question.question_text,
                        "grid_data": grid_data
                    }
                except Exception as e:
                    print(f"Error calculating grid stats for question {question_id}: {e}")
                    if skip_problematic_responses:
                        continue
                    else:
                        raise
        except Exception as e:
            print(f"Error processing question {question_id}: {e}")
            if skip_problematic_responses:
                continue
            else:
                raise

    analytics['numerical_stats'] = numerical_stats
    analytics['mcq_stats'] = mcq_stats
    analytics['text_stats'] = text_stats
    analytics['grid_stats'] = grid_stats
    analytics['age_groups'] = age_groups
    analytics['submission_dates'] = [sub.submitted_at.isoformat() if hasattr(sub.submitted_at, 'isoformat') else str(sub.submitted_at) for sub in submissions]

    return analytics

@staticmethod
def list_uploaded_files(survey_id, question_id=None):
    """Return a list of uploaded files for a survey/question."""
    try:
        query = Response.query.join(Submission, Response.submission_id == Submission.id)
        query = query.filter(Submission.survey_id == survey_id, Response.file_path.isnot(None))
        if question_id:
            query = query.filter(Response.question_id == question_id)

        files = []
        for r in query.all():
            files.append({
                "response_id": r.id,
                "question_id": r.question_id,
                "submission_id": r.submission_id,
                "filename": os.path.basename(r.file_path) if r.file_path else "",
                "file_type": r.file_type,
                "file_path": r.file_path,
                "uploaded_at": r.submission.submitted_at.isoformat() if r.submission and r.submission.submitted_at else None,
            })

        return {"files": files}, 200
    except Exception as e:
        return {"error": str(e)}, 500

@staticmethod
def get_uploaded_file(response_id):
    """Return absolute file path and meta for download."""
    try:
        resp = Response.query.get(response_id)
        if not resp or not resp.file_path:
            return {"error": "File not found"}, 404

        rel_path = resp.file_path.lstrip('/')
        if rel_path.startswith('uploads/'):
            rel_path = rel_path[len('uploads/') :]
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], rel_path)

        if not os.path.exists(file_path):
            return {"error": "File not found on server"}, 404

        filename = os.path.basename(file_path)
        mimetype = resp.file_type or 'application/octet-stream'
        return file_path, mimetype, filename
    except Exception as e:
        return {"error": str(e)}, 500
