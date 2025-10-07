# live_responses_controller.py
from app.models import Survey, Submission, Response, Question, User, SurveyLink, db # Added SurveyLink
from sqlalchemy import and_, or_, func
import datetime
import json
import csv
import io
import openpyxl
from flask import current_app

class LiveResponsesController:
    @staticmethod
    def get_live_responses(survey_id, filters, export_mode=False):
        """
        Get live responses for a survey with optional filtering.
        Can operate in normal paginated mode or export mode (all results).

        Args:
            survey_id: The ID of the survey to fetch responses for
            filters: Dictionary containing filter parameters...
            export_mode (bool): If True, fetches all matching results without pagination.

        Returns:
            tuple: (data, status_code) or (processed_data, questions_dict, status_code) if export_mode
                - data: Dict with 'results' and 'pagination' keys
                - processed_data: List of processed submission dicts for export
                - questions_dict: Dict of survey questions {id: Question} for export
                - status_code: HTTP status code
        """
        try:
            current_app.logger.info(f"[LIVE_RESPONSES] Fetching live responses for survey {survey_id}, filters: {filters}, export_mode: {export_mode}")
            
            survey = Survey.query.get(survey_id)
            if not survey:
                current_app.logger.warning(f"[LIVE_RESPONSES] Survey {survey_id} not found")
                if export_mode:
                     raise ValueError("Survey not found")
                return {"error": "Survey not found"}, 404

            # Eager load related data for efficiency, especially for export
            query = Submission.query.options(
                db.joinedload(Submission.user),       # Load User if user_id exists
                db.joinedload(Submission.survey_link) # Load SurveyLink if survey_link_id exists
            ).filter(Submission.survey_id == survey_id)

            # --- Apply Filters (with optimized joins) ---
            # Age filters
            if filters.get('age_min'):
                try: query = query.filter(Submission.age >= int(filters['age_min']))
                except (ValueError, TypeError): pass # Ignore invalid input
            if filters.get('age_max'):
                try: query = query.filter(Submission.age <= int(filters['age_max']))
                except (ValueError, TypeError): pass # Ignore invalid input

            # Email Domain (requires User join - joinedload doesn't work for filtering)
            if filters.get('email_domain'):
                email_filter = filters['email_domain']
                # Use left outer join to include submissions without users
                query = query.outerjoin(User, Submission.user_id == User.id)
                # Check both User.email and Submission.email (if user is None)
                query = query.filter(
                    or_(
                        User.email.ilike(f"%@{email_filter}"),
                        and_(Submission.user_id.is_(None), Submission.email.ilike(f"%@{email_filter}"))
                    )
                 )

            # Time-based filters
            if filters.get('submitted_after'):
                try:
                    # Handle ISO format with optional 'Z'
                    dt_str = filters['submitted_after'].replace('Z', '+00:00')
                    dt = datetime.datetime.fromisoformat(dt_str)
                    query = query.filter(Submission.submitted_at >= dt)
                except (ValueError, TypeError): pass # Ignore invalid date formats
            if filters.get('submitted_before'):
                try:
                    dt_str = filters['submitted_before'].replace('Z', '+00:00')
                    dt = datetime.datetime.fromisoformat(dt_str)
                    query = query.filter(Submission.submitted_at <= dt)
                except (ValueError, TypeError): pass # Ignore invalid date formats

            # Other demographic/metadata filters
            if filters.get('gender'): query = query.filter(Submission.gender == filters['gender'])
            if filters.get('location'): query = query.filter(Submission.location.ilike(f"%{filters['location']}%"))
            if filters.get('education'): query = query.filter(Submission.education == filters['education'])
            if filters.get('company'): query = query.filter(Submission.company.ilike(f"%{filters['company']}%"))
            if filters.get('device_type'): query = query.filter(Submission.device_type == filters['device_type'])
            if filters.get('link_id'):
                 try: query = query.filter(Submission.survey_link_id == int(filters['link_id']))
                 except (ValueError, TypeError): pass # Ignore invalid link ID format


            # --- Fetch Submissions (Paginated or All) ---
            if export_mode:
                submissions = query.order_by(Submission.submitted_at.desc()).all()
                total_results = len(submissions) # Not needed for export return, but good to know
            else:
                page = int(filters.get('page', 1))
                per_page = int(filters.get('per_page', 20))
                paginated_query = query.order_by(Submission.submitted_at.desc()).paginate(
                    page=page, per_page=per_page, error_out=False
                )
                total_results = paginated_query.total
                total_pages = paginated_query.pages
                submissions = paginated_query.items

            # --- Process Submissions & Responses ---
            processed_results = []
            # Pre-fetch all questions for this survey for efficiency
            survey_questions = {q.id: q for q in Question.query.filter_by(survey_id=survey_id).all()}
            # Pre-fetch all responses for the selected submissions for efficiency
            submission_ids = [sub.id for sub in submissions]
            all_responses = Response.query.filter(Response.submission_id.in_(submission_ids)).all()
            responses_by_submission_id = {}
            for resp in all_responses:
                 if resp.submission_id not in responses_by_submission_id:
                      responses_by_submission_id[resp.submission_id] = []
                 responses_by_submission_id[resp.submission_id].append(resp)


            for sub in submissions:
                responses_list = []
                submission_responses = responses_by_submission_id.get(sub.id, [])

                for r in submission_responses:
                    question = survey_questions.get(r.question_id)
                    if not question: continue # Should not happen if data is consistent

                    formatted_response = r.response_text
                    # Format specific types for better display/export
                    if question.question_type in ['checkbox', 'multi-choice', 'ranking', 'multiple-image-select']:
                         try:
                             parsed = json.loads(r.response_text)
                             if isinstance(parsed, list):
                                 # Join array elements into a comma-separated string for export/simple display
                                 formatted_response = ", ".join(map(str, parsed))
                             # Keep as is if not a list (e.g., single selection stored unexpectedly)
                         except (json.JSONDecodeError, TypeError): pass # Keep original text if parsing fails
                    elif question.question_type == 'document-upload':
                          try:
                              parsed = json.loads(r.response_text)
                              if isinstance(parsed, list) and parsed:
                                  # Extract filename if available
                                  filenames = [f.get('name', f.get('url', '').split('/')[-1]) for f in parsed if isinstance(f, dict)]
                                  formatted_response = ", ".join(filenames) if filenames else "[Uploaded File(s)]"
                              else: formatted_response = ""
                          except (json.JSONDecodeError, TypeError):
                              formatted_response = "[Upload Error]"
                    # Add formatting for other types if needed (e.g., grid)

                    responses_list.append({
                        "question_id": r.question_id,
                        "question_text": question.question_text,
                        "question_type": question.question_type,
                        "response_text": formatted_response, # Use formatted version
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "response_time": r.response_time
                    })

                # Build the submission dictionary
                submission_data = {
                    "submission_id": sub.id,
                    "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                    "duration": sub.duration,
                    "completion_percentage": sub.get_completion_percentage(), # Include completion %
                    # Safely access user email (using eager loaded user)
                    "email": sub.user.email if sub.user else getattr(sub, 'email', None),
                    # Include all relevant demographic fields from Submission model
                    "age": getattr(sub, 'age', None),
                    "gender": getattr(sub, 'gender', None),
                    "location": getattr(sub, 'location', None),
                    "education": getattr(sub, 'education', None),
                    "company": getattr(sub, 'company', None),
                    "device_type": getattr(sub, 'device_type', None),
                    "browser_info": getattr(sub, 'browser_info', None),
                    "responses": responses_list, # Include the processed list of responses
                    # Include distribution link info (using eager loaded link)
                    "distribution_link": {
                        "id": sub.survey_link_id,
                        "label": sub.survey_link.label if sub.survey_link else None,
                        "code": sub.survey_link.code if sub.survey_link else None
                    } if sub.survey_link_id else None
                }
                processed_results.append(submission_data)

            # --- Return based on mode ---
            if export_mode:
                current_app.logger.info(f"[LIVE_RESPONSES] Export mode: returning {len(processed_results)} processed results")
                # Return the full list of processed data and the questions dict
                return processed_results, survey_questions, 200
            else:
                current_app.logger.info(f"[LIVE_RESPONSES] Normal mode: returning {len(processed_results)} results, pagination: page {page}/{total_pages}, total: {total_results}")
                # Return paginated results
                return {
                    "results": processed_results,
                    "pagination": {
                        "total_results": total_results,
                        "total_pages": total_pages,
                        "current_page": page,
                        "per_page": per_page
                    }
                }, 200

        except ValueError as ve:
            current_app.logger.error(f"Value error retrieving live responses for survey {survey_id}: {ve}")
            if export_mode: raise
            return {"error": str(ve)}, 404
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Exception retrieving live responses for survey {survey_id}: {e}", exc_info=True)
            if export_mode: raise
            return {"error": "Failed to retrieve live responses", "details": str(e)}, 500

    @staticmethod
    def export_responses(survey_id, export_format, filters):
        """
        Exports survey responses to CSV or XLSX format.

        Args:
            survey_id: ID of the survey.
            export_format: 'csv' or 'xlsx'.
            filters: Dictionary of filters applied to responses.

        Returns:
            tuple: (file_stream, mimetype, filename) or (error_dict, status_code)
        """
        try:
            # 1. Fetch all filtered data using the modified get_live_responses
            # Note: This now returns (list_of_submission_dicts, questions_dict, status_code)
            all_responses_data, survey_questions_dict, status = LiveResponsesController.get_live_responses(survey_id, filters, export_mode=True)

            # Propagate error if fetching failed (status is already checked inside get_live_responses)
            # Status here should always be 200 if no exception was raised by get_live_responses

            if not all_responses_data:
                 # Return tuple expected by route handler for error
                 return {"error": "No responses found matching the filters."}, 404

            # 2. Prepare Headers
            sorted_questions = sorted(survey_questions_dict.values(), key=lambda q: q.sequence_number or float('inf'))

            # Define standard headers
            headers = [
                "Submission ID", "Submitted At", "Duration (s)", "Completion (%)",
                "Email", "Age", "Gender", "Location", "Education", "Company",
                "Device Type", "Browser Info", "Link ID", "Link Label"
            ]
            # Create question headers map {question_id: "Q#: Text"}
            question_headers = {q.id: f"Q{q.sequence_number}: {q.question_text}" for q in sorted_questions}
            # Append question headers in the correct sequence
            headers.extend([question_headers[q.id] for q in sorted_questions])

            # 3. Prepare Rows (Flatten data)
            rows = []
            for submission_data in all_responses_data:
                row_dict = {h: '' for h in headers} # Initialize row with empty strings based on headers

                # Populate standard submission fields
                row_dict["Submission ID"] = submission_data.get("submission_id", "")
                row_dict["Submitted At"] = submission_data.get("submitted_at", "")
                row_dict["Duration (s)"] = submission_data.get("duration", "")
                row_dict["Completion (%)"] = round(submission_data.get("completion_percentage", 0), 1) # Format percentage
                row_dict["Email"] = submission_data.get("email", "")
                row_dict["Age"] = submission_data.get("age", "")
                row_dict["Gender"] = submission_data.get("gender", "")
                row_dict["Location"] = submission_data.get("location", "")
                row_dict["Education"] = submission_data.get("education", "")
                row_dict["Company"] = submission_data.get("company", "")
                row_dict["Device Type"] = submission_data.get("device_type", "")
                row_dict["Browser Info"] = submission_data.get("browser_info", "")
                row_dict["Link ID"] = submission_data.get("distribution_link", {}).get("id", "") if submission_data.get("distribution_link") else ""
                row_dict["Link Label"] = submission_data.get("distribution_link", {}).get("label", "") if submission_data.get("distribution_link") else ""


                # Create a map of {question_id: response_text} for this submission
                responses_map = {r['question_id']: r['response_text'] for r in submission_data.get('responses', [])}

                # Populate question response columns using the map and sorted questions
                for q in sorted_questions:
                    q_header = question_headers.get(q.id)
                    if q_header:
                        # Find the response text for this question ID in the map
                        row_dict[q_header] = responses_map.get(q.id, "") # Use empty string if no response found

                # Append the list of values in the correct header order
                rows.append(list(row_dict.values()))

            # 4. Generate File Stream
            if export_format == 'csv':
                output = io.StringIO()
                writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL) # Use minimal quoting
                writer.writerow(headers)
                writer.writerows(rows)
                output.seek(0)
                mimetype = 'text/csv'
                filename = f"survey_{survey_id}_responses_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
                # Return tuple expected by route handler
                return output, mimetype, filename

            elif export_format == 'xlsx':
                output = io.BytesIO()
                workbook = openpyxl.Workbook()
                sheet = workbook.active
                sheet.title = "Responses"
                sheet.append(headers) # Write header row
                for row_data in rows:
                    # Append data row - openpyxl handles basic types
                    sheet.append(row_data)

                # Auto-adjust column widths (optional, can be slow for large files)
                # for col_idx, header in enumerate(headers, 1):
                #     column_letter = openpyxl.utils.get_column_letter(col_idx)
                #     # Simple width based on header length + buffer
                #     sheet.column_dimensions[column_letter].width = len(str(header)) + 5


                workbook.save(output)
                output.seek(0)
                mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                filename = f"survey_{survey_id}_responses_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
                 # Return tuple expected by route handler
                return output, mimetype, filename

            else:
                 # Should not happen due to check in route, but good practice
                 return {"error": "Unsupported export format specified."}, 400

        except ValueError as ve: # Catch specific errors like "Survey not found" from get_live_responses
            current_app.logger.error(f"Value error during export for survey {survey_id}: {ve}")
            return {"error": str(ve)}, 404 # Return error dict and status
        except Exception as e:
            # db.session.rollback() # Rollback not needed for read operations
            current_app.logger.error(f"Exception exporting responses for survey {survey_id}: {e}", exc_info=True)
            # Return error dict and status
            return {"error": "Failed to export responses", "details": str(e)}, 500

    # Add get_response_count method (placeholder - needs implementation)
    @staticmethod
    def get_response_count(survey_id, filters):
        # Placeholder: This method needs to be implemented based on requirements
        # (e.g., using SQLAlchemy time functions like func.date_trunc)
        current_app.logger.warning("get_response_count endpoint called but not implemented.")
        return {"error": "Response count endpoint not implemented"}, 501