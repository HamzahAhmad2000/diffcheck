# app/survey_controller.py
from app.models import Survey, Question, Response, Submission, db # Response not needed here directly
import json
from app.controllers.response_controller import ResponseController # Assuming this is used elsewhere or needed for analytics interaction
import uuid
from datetime import datetime, date # Import date for potential date parsing
 # Keep if used elsewhere
from flask import current_app, request, g
import logging
from ..models import SurveyDiscordRole, DiscordServerMembership, SurveyAudience, Business
import secrets
from ..models import db, Survey, Question, Response, Submission, SurveyLink, ChatThread, SurveyThread, AnalyticsThread, QuestionBank, Business, User, BusinessActivity, ActivityType, SurveyAudience, BusinessAudience, SurveyDiscordRole, DiscordServerMembership
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload
from sqlalchemy import and_, or_
from flask import Blueprint
import pandas as pd
import io
import re

from flask import jsonify

class SurveyController:

    @staticmethod
    def _assign_hidden_labels(image_options):
        """Assign unique hidden labels and apply default visible labels."""
        if not image_options or not isinstance(image_options, list):
            return []
        updated_options = []
        for index, option in enumerate(image_options):
            if isinstance(option, dict):
                visible_label = str(option.get('label', '')).strip()
                if not visible_label:
                    visible_label = f"Option {index + 1}"
                option_copy = {
                    'label': visible_label,
                    'image_url': str(option.get('image_url', '')),
                    'hidden_label': option.get('hidden_label') or f"imgopt_{uuid.uuid4().hex[:8]}_{index}"
                }
                if 'description' in option:
                    option_copy['description'] = str(option.get('description', ''))
                updated_options.append(option_copy)
            else:
                current_app.logger.warning(f"Skipping invalid image option format: {option}")
        return updated_options

    @staticmethod
    def _apply_image_label_defaults(image_options):
        """Return a copy of image options with default labels applied."""
        if not image_options or not isinstance(image_options, list):
            return []
        processed = []
        for idx, opt in enumerate(image_options):
            if isinstance(opt, dict):
                opt_copy = dict(opt)
                visible_label = str(opt_copy.get('label', '')).strip()
                if not visible_label:
                    opt_copy['label'] = f"Option {idx + 1}"
                processed.append(opt_copy)
            else:
                current_app.logger.warning(f"Skipping invalid image option format: {opt}")
        return processed

    @staticmethod
    def _parse_iso_date(date_string):
        """Safely parse an ISO date string, returning None on error."""
        if not date_string:
            return None
        try:
            # Handle both full datetime and just date strings
            if 'T' in date_string:
                 # Remove 'Z' if present for fromisoformat
                 if date_string.endswith('Z'):
                      date_string = date_string[:-1]
                 return datetime.fromisoformat(date_string)
            else:
                 return datetime.combine(date.fromisoformat(date_string), datetime.min.time())
        except (ValueError, TypeError) as e:
            current_app.logger.warning(f"Could not parse date string '{date_string}': {e}")
            return None

    @staticmethod
    def create_survey(data):
        try:
            # ... (existing setup code: start_date, end_date, title check) ...
            start_date = datetime.fromisoformat(data['start_date']) if data.get('start_date') else None
            end_date = datetime.fromisoformat(data['end_date']) if data.get('end_date') else None
            if 'title' not in data or not data['title'].strip():
                return {"error": "Title is required for creating a survey."}, 400

            # Get business_id from data if provided
            business_id_from_data = data.get('business_id')
            user_role = getattr(g, 'user_role', None)
            
            # For super-admin created surveys not assigned to a business, assign to ECLIPSEER
            if user_role == 'super_admin' and not business_id_from_data:
                from app.models import Business # Local import to avoid circular dependency
                eclipseer_business = Business.query.filter_by(name="ECLIPSEER").first()
                if eclipseer_business:
                    business_id_from_data = eclipseer_business.id
                    current_app.logger.info(f"[CREATE_SURVEY] Assigning super admin survey to 'ECLIPSEER' (ID: {business_id_from_data})")
                else:
                    current_app.logger.warning("[CREATE_SURVEY] 'ECLIPSEER' business not found for super admin survey assignment.")
            
            current_app.logger.info(f"[CREATE_SURVEY] Creating survey with business_id: {business_id_from_data}")
            
            # Validate business_id if provided
            if business_id_from_data:
                from app.models import Business # Local import to avoid circular dependency
                if not Business.query.get(business_id_from_data):
                    current_app.logger.warning(f"[CREATE_SURVEY] Invalid business_id: {business_id_from_data} provided.")
                    return {"error": f"Invalid business_id: {business_id_from_data}."}, 400

            survey = Survey(
                title=data['title'],
                description=data.get('description', ''),
                start_date=start_date,
                end_date=end_date,
                participant_limit=data.get('participant_limit'),
                branding=data.get('branding'),
                is_quickpoll=data.get('is_quickpoll', False),
                tags=data.get('tags', []), # ADDED: Save tags
                business_id=business_id_from_data  # Set the business_id
            )

            # REMOVED: Legacy businessless survey logic (now all super admin surveys go to ECLIPSEER)
            # REMOVED: Automatic publishing for super admin surveys
            # if user_role == 'super_admin' and not business_id_from_data:
            #     survey.published = True
            db.session.add(survey)
            db.session.flush()  # Get survey.id for foreign key

            # Note: Audience settings are now handled by business-level settings since all surveys have a business_id

            questions_data = data.get("questions", [])
            for index, q_data in enumerate(questions_data):
                # Ensure q_data is a dictionary
                if not isinstance(q_data, dict):
                    current_app.logger.warning(f"Skipping invalid question data format at index {index}: {q_data}")
                    continue

                question_type = q_data.get("question_type", "open-ended")
                required_flag = bool(q_data.get("required", False)) # Ensure boolean
                q_text = q_data.get('question_text', '') or ''

                # Process image options BEFORE creating the question
                processed_image_options = SurveyController._assign_hidden_labels(q_data.get('image_options'))

                # Process grid columns and N/A option
                grid_columns_processed = q_data.get('grid_columns', [])
                not_applicable_flag = bool(q_data.get('not_applicable', False)) # Ensure boolean
                not_applicable_text_val = q_data.get('not_applicable_text', 'Not Applicable')
                if not isinstance(grid_columns_processed, list): grid_columns_processed = []

                # Add N/A column logic only if not_applicable is True
                if not_applicable_flag:
                    # Filter out any existing column marked as N/A first
                    temp_cols = [col for col in grid_columns_processed if isinstance(col, dict) and not col.get('isNotApplicable')]
                    # Append the definitive N/A column
                    temp_cols.append({'text': not_applicable_text_val, 'isNotApplicable': True})
                    grid_columns_processed = temp_cols
                else:
                    # Ensure no column has the isNotApplicable flag if not_applicable is false
                    grid_columns_processed = [col for col in grid_columns_processed if isinstance(col, dict) and not col.get('isNotApplicable')]


                new_question = Question(
                    survey_id=survey.id,
                    question_text=q_text,
                    question_text_html=q_data.get('question_text_html'), # HTML text from frontend
                    description=q_data.get('description', ''),
                    additional_text=q_data.get('additional_text', ''),
                    question_type=question_type,
                    options=q_data.get('options'), # Assumes format is [{text, branch}, ...]
                    branch=q_data.get('branch'), # Top-level branch logic
                    sequence_number=index + 1,
                    original_sequence_number=index + 1, # Set on creation
                    image_url=q_data.get('image_url'), # Question level image
                    required=required_flag,

                    # --- Rating / Slider / NPS / Star Rating ---
                    rating_start=int(q_data['rating_start']) if q_data.get('rating_start') is not None else None,
                    rating_end=int(q_data['rating_end']) if q_data.get('rating_end') is not None else None,
                    rating_step=int(q_data['rating_step']) if q_data.get('rating_step') is not None else None,
                    rating_unit=q_data.get('rating_unit'),
                    left_label=q_data.get('left_label'),
                    center_label=q_data.get('center_label'),
                    right_label=q_data.get('right_label'),
                    nps_left_label=q_data.get('nps_left_label'),
                    nps_right_label=q_data.get('nps_right_label'),
                    row_text=q_data.get('row_text'), # For single star rating row

                    # --- Numerical Input ---
                    min_value=float(q_data['min_value']) if q_data.get('min_value') is not None else None,
                    max_value=float(q_data['max_value']) if q_data.get('max_value') is not None else None,
                    force_positive=bool(q_data.get('force_positive', False)), # Ensure boolean

                    # --- Grid questions ---
                    grid_rows=q_data.get('grid_rows'),
                    grid_columns=grid_columns_processed,

                    # --- N/A and Other Options ---
                    not_applicable=not_applicable_flag, # Use processed boolean
                    not_applicable_text=not_applicable_text_val,
                    has_other_option=bool(q_data.get('has_other_option', False)), # Ensure boolean
                    other_option_text=q_data.get('other_option_text', 'Other (Please specify)'),
                    show_na=bool(q_data.get('show_na', False)), # Flag for slider/star/scale N/A visibility

                    # --- Multiple Choice/Checkbox selection rules ---
                    min_selection=int(q_data['min_selection']) if q_data.get('min_selection') is not None else None,
                    max_selection=int(q_data['max_selection']) if q_data.get('max_selection') is not None else None,

                    # --- Image Select type ---
                    image_options=processed_image_options, # Use processed list with hidden_labels

                    # --- Ranking type ---
                    ranking_items=q_data.get('ranking_items'), # Assumes format is [{text}, ...]

                    # --- Document Upload Settings ---
                    allowed_types=q_data.get('allowed_types', 'pdf,doc,docx,xls,xlsx,txt,csv,jpg,jpeg,png,ppt,pptx'),
                    max_file_size=int(q_data['max_file_size']) if q_data.get('max_file_size') is not None else 5,
                    max_files=int(q_data['max_files']) if q_data.get('max_files') is not None else 1,

                    # --- Signature type ---
                    signature_options=q_data.get('signature_options'), # Store the JSON object

                    # --- Date Picker type ---
                    min_date=SurveyController._parse_iso_date(q_data.get('min_date')),
                    max_date=SurveyController._parse_iso_date(q_data.get('max_date')),

                    # --- Email Input type ---
                    verify_domain=bool(q_data.get('verify_domain', False)), # Ensure boolean
                    allowed_domains=q_data.get('allowed_domains'), # Store as string

                    # --- Scale (Likert) type ---
                    scale_points=q_data.get('scale_points'), # Store the JSON array of strings

                    # --- Numerical/Date Branching ---
                    numerical_branch_enabled=bool(q_data.get('numerical_branch_enabled', False)), # Ensure boolean
                    numerical_branch_rules=q_data.get('numerical_branch_rules'),

                    # --- Disqualification Logic ---
                    disqualify_enabled=bool(q_data.get('disqualify_enabled', False)), # Ensure boolean
                    disqualify_message=q_data.get('disqualify_message', "Thank you for your time..."),
                    disqualify_rules=q_data.get('disqualify_rules'),

                    # --- Conditional Logic ---
                    conditional_logic_rules=q_data.get('conditional_logic_rules'),

                    # --- Metadata/Analytics ---
                    report_sequence=int(q_data['report_sequence']) if q_data.get('report_sequence') is not None else None,
                )

                # Apply NPS defaults specifically if type is nps
                if question_type == 'nps':
                    new_question.rating_start = 0
                    new_question.rating_end = 10
                    new_question.rating_step = 1
                # Apply Star Rating defaults if type is star-rating
                elif question_type == 'star-rating':
                     new_question.rating_start = 1
                     new_question.rating_end = 5
                     new_question.rating_step = 1
                     new_question.rating_unit = 'stars'
                 # Apply Star Rating Grid defaults
                elif question_type == 'star-rating-grid':
                     new_question.rating_start = 1
                     new_question.rating_end = 5
                     new_question.rating_step = 1
                     new_question.rating_unit = 'stars'


                db.session.add(new_question)

            db.session.commit()
            db.session.refresh(survey) # Refresh to get the final state with relationships
            # Use get_survey to ensure consistent output format
            return SurveyController.get_survey(survey.id)

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to create survey: {e}", exc_info=True)
            return {"error": "Failed to create survey", "details": str(e)}, 500

    @staticmethod
    def get_survey(survey_id):
        # --- This method now implicitly returns the new fields added to the Question model ---
        # --- No major changes needed here, just ensure the model has the fields ---
        logger = logging.getLogger(__name__)
        
        logger.info(f"[SURVEY_CONTROLLER] get_survey called for survey_id: {survey_id}")
        
        try:
            logger.info(f"[SURVEY_CONTROLLER] Querying Survey.query.get({survey_id})")
            survey = Survey.query.get(survey_id)
            
            if not survey:
                logger.warning(f"[SURVEY_CONTROLLER] Survey {survey_id} not found in database")
                return {"error": "Survey not found"}, 404

            logger.info(f"[SURVEY_CONTROLLER] Found survey: '{survey.title}' (id={survey.id})")
            logger.info(f"[SURVEY_CONTROLLER] Survey details: published={survey.published}, is_archived={survey.is_archived}, business_id={survey.business_id}")
            
            logger.info(f"[SURVEY_CONTROLLER] Fetching questions for survey {survey_id}")
            sorted_questions = sorted(survey.questions, key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
            logger.info(f"[SURVEY_CONTROLLER] Found {len(sorted_questions)} questions")

            survey_data = {
                "id": survey.id,
                "title": survey.title,
                "description": survey.description,
                "start_date": survey.start_date.isoformat() if survey.start_date else None,
                "end_date": survey.end_date.isoformat() if survey.end_date else None,
                "participant_limit": survey.participant_limit,
                "published": survey.published,
                "is_archived": survey.is_archived,
                "branding": survey.branding,
                "is_quickpoll": survey.is_quickpoll,
                "business_id": survey.business_id,  # Include business_id for frontend context
                "created_at": survey.created_at.isoformat() if survey.created_at else None,
                "updated_at": survey.updated_at.isoformat() if survey.updated_at else None,
                "questions": []
            }

            logger.info(f"[SURVEY_CONTROLLER] Processing {len(sorted_questions)} questions for survey '{survey.title}'")
            for index, q in enumerate(sorted_questions):
                logger.debug(f"[SURVEY_CONTROLLER] Processing question {index + 1}: '{q.question_text[:50]}...' (type: {q.question_type})")
                
                question_dict = {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_text_html": q.question_text_html, 
                    "description": q.description,
                    "additional_text": q.additional_text,
                    "question_type": q.question_type,
                    "options": q.options,
                    "branch": q.branch,
                    "sequence_number": q.sequence_number,
                    "image_url": q.image_url,
                    "required": q.required,

                    # Rating/Slider/NPS/Star
                    "rating_start": q.rating_start,
                    "rating_end": q.rating_end,
                    "rating_step": q.rating_step,
                    "rating_unit": q.rating_unit,
                    "left_label": q.left_label,
                    "center_label": q.center_label,
                    "right_label": q.right_label,
                    "nps_left_label": q.nps_left_label,
                    "nps_right_label": q.nps_right_label,
                    "row_text": q.row_text,

                    # Numerical Input
                    "min_value": q.min_value,
                    "max_value": q.max_value,
                    "force_positive": q.force_positive,

                    # Grid
                    "grid_rows": q.grid_rows,
                    "grid_columns": q.grid_columns,

                    # N/A and Other
                    "not_applicable": q.not_applicable,
                    "not_applicable_text": q.not_applicable_text,
                    "has_other_option": q.has_other_option,
                    "other_option_text": q.other_option_text,
                    "show_na": q.show_na,

                    # Selection rules
                    "min_selection": q.min_selection,
                    "max_selection": q.max_selection,

                    # Image Select
                    "image_options": SurveyController._apply_image_label_defaults(q.image_options),

                    # Ranking
                    "ranking_items": q.ranking_items,

                    # Document Upload
                    "allowed_types": q.allowed_types,
                    "max_file_size": q.max_file_size,
                    "max_files": q.max_files,

                    # Signature
                    "signature_options": q.signature_options,

                    # Date Picker
                    "min_date": q.min_date.isoformat() if q.min_date else None,
                    "max_date": q.max_date.isoformat() if q.max_date else None,

                    # Email Input
                    "verify_domain": q.verify_domain,
                    "allowed_domains": q.allowed_domains,

                    # Scale (Likert)
                    "scale_points": q.scale_points,

                    # Branching/Logic
                    "numerical_branch_enabled": q.numerical_branch_enabled,
                    "numerical_branch_rules": q.numerical_branch_rules,
                    "disqualify_enabled": q.disqualify_enabled,
                    "disqualify_message": q.disqualify_message,
                    "disqualify_rules": q.disqualify_rules,
                    "conditional_logic_rules": q.conditional_logic_rules,

                    # Metadata
                    "report_sequence": q.report_sequence
                }
                survey_data["questions"].append(question_dict)

            logger.info(f"[SURVEY_CONTROLLER] Successfully prepared survey data for '{survey.title}' with {len(survey_data['questions'])} questions")
            return survey_data, 200
            
        except Exception as e:
            logger.error(f"[SURVEY_CONTROLLER] Exception in get_survey: {str(e)}", exc_info=True)
            return {"error": "Failed to retrieve survey", "details": str(e)}, 500


    @staticmethod
    def update_survey(survey_id, data):
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        try:
            # Update survey-level fields
            if "title" in data:
                if not data["title"].strip(): return {"error": "Title cannot be empty."}, 400
                survey.title = data["title"]
            # Use .get() for optional fields to avoid KeyError if missing
            survey.description = data.get('description', survey.description)
            survey.start_date = SurveyController._parse_iso_date(data.get('start_date')) if "start_date" in data else survey.start_date
            survey.end_date = SurveyController._parse_iso_date(data.get('end_date')) if "end_date" in data else survey.end_date
            survey.participant_limit = int(data['participant_limit']) if data.get('participant_limit') is not None else survey.participant_limit
            survey.branding = data.get('branding', survey.branding)
            survey.is_quickpoll = bool(data.get('is_quickpoll', survey.is_quickpoll))
            survey.published = bool(data.get('published', survey.published))
            
            # Allow updating business_id if provided and valid
            if 'business_id' in data:
                business_id_from_data = data.get('business_id')
                if business_id_from_data: # If not None or empty string
                    from app.models import Business # Local import
                    if Business.query.get(business_id_from_data):
                        survey.business_id = business_id_from_data
                    else:
                        current_app.logger.warning(f"[UPDATE_SURVEY] Invalid business_id: {business_id_from_data} provided for survey {survey_id}.")
                        return {"error": f"Invalid business_id: {business_id_from_data}."}, 400
                else: # If business_id is explicitly set to None/empty (to disassociate)
                    survey.business_id = None

            # Update questions (delete and recreate approach)
            if "questions" in data:
                # Delete existing questions first
                Question.query.filter_by(survey_id=survey_id).delete()

                questions_data = data.get("questions", []) # Use .get() here too
                for index, q_data in enumerate(questions_data):
                    # --- Re-use the exact same question creation logic from create_survey ---
                    if not isinstance(q_data, dict):
                        current_app.logger.warning(f"Skipping invalid question data format during update at index {index}: {q_data}")
                        continue

                    question_type = q_data.get("question_type", "open-ended")
                    required_flag = bool(q_data.get("required", False))
                    q_text = q_data.get('question_text', '') or ''
                    processed_image_options = SurveyController._assign_hidden_labels(q_data.get('image_options'))
                    grid_columns_processed = q_data.get('grid_columns', [])
                    not_applicable_flag = bool(q_data.get('not_applicable', False))
                    not_applicable_text_val = q_data.get('not_applicable_text', 'Not Applicable')
                    if not isinstance(grid_columns_processed, list): grid_columns_processed = []

                    if not_applicable_flag:
                         temp_cols = [col for col in grid_columns_processed if isinstance(col, dict) and not col.get('isNotApplicable')]
                         temp_cols.append({'text': not_applicable_text_val, 'isNotApplicable': True})
                         grid_columns_processed = temp_cols
                    else:
                         grid_columns_processed = [col for col in grid_columns_processed if isinstance(col, dict) and not col.get('isNotApplicable')]


                    new_question = Question(
                        survey_id=survey.id,
                        question_text=q_text,
                        question_text_html=q_data.get('question_text_html'),
                        description=q_data.get('description', ''),
                        additional_text=q_data.get('additional_text', ''),
                        question_type=question_type,
                        options=q_data.get('options'),
                        branch=q_data.get('branch'),
                        sequence_number=index + 1,
                        original_sequence_number=index + 1, # Set on creation
                        image_url=q_data.get('image_url'),
                        required=required_flag,
                        rating_start=int(q_data['rating_start']) if q_data.get('rating_start') is not None else None,
                        rating_end=int(q_data['rating_end']) if q_data.get('rating_end') is not None else None,
                        rating_step=int(q_data['rating_step']) if q_data.get('rating_step') is not None else None,
                        rating_unit=q_data.get('rating_unit'),
                        left_label=q_data.get('left_label'),
                        center_label=q_data.get('center_label'),
                        right_label=q_data.get('right_label'),
                        nps_left_label=q_data.get('nps_left_label'),
                        nps_right_label=q_data.get('nps_right_label'),
                        row_text=q_data.get('row_text'),
                        min_value=float(q_data['min_value']) if q_data.get('min_value') is not None else None,
                        max_value=float(q_data['max_value']) if q_data.get('max_value') is not None else None,
                        force_positive=bool(q_data.get('force_positive', False)),
                        grid_rows=q_data.get('grid_rows'),
                        grid_columns=grid_columns_processed,
                        not_applicable=not_applicable_flag,
                        not_applicable_text=not_applicable_text_val,
                        has_other_option=bool(q_data.get('has_other_option', False)),
                        other_option_text=q_data.get('other_option_text', 'Other (Please specify)'),
                        show_na=bool(q_data.get('show_na', False)),
                        min_selection=int(q_data['min_selection']) if q_data.get('min_selection') is not None else None,
                        max_selection=int(q_data['max_selection']) if q_data.get('max_selection') is not None else None,
                        image_options=processed_image_options,
                        ranking_items=q_data.get('ranking_items'),
                        allowed_types=q_data.get('allowed_types', 'pdf,doc,docx,xls,xlsx,txt,csv,jpg,jpeg,png,ppt,pptx'),
                        max_file_size=int(q_data['max_file_size']) if q_data.get('max_file_size') is not None else 5,
                        max_files=int(q_data['max_files']) if q_data.get('max_files') is not None else 1,
                        signature_options=q_data.get('signature_options'),
                        min_date=SurveyController._parse_iso_date(q_data.get('min_date')),
                        max_date=SurveyController._parse_iso_date(q_data.get('max_date')),
                        verify_domain=bool(q_data.get('verify_domain', False)),
                        allowed_domains=q_data.get('allowed_domains'),
                        scale_points=q_data.get('scale_points'),
                        numerical_branch_enabled=bool(q_data.get('numerical_branch_enabled', False)),
                        numerical_branch_rules=q_data.get('numerical_branch_rules'),
                        disqualify_enabled=bool(q_data.get('disqualify_enabled', False)),
                        disqualify_message=q_data.get('disqualify_message', "Thank you for your time..."),
                        disqualify_rules=q_data.get('disqualify_rules'),
                        conditional_logic_rules=q_data.get('conditional_logic_rules'),
                        report_sequence=int(q_data['report_sequence']) if q_data.get('report_sequence') is not None else None,
                    )
                    if question_type == 'nps':
                         new_question.rating_start = 0; new_question.rating_end = 10; new_question.rating_step = 1
                    elif question_type == 'star-rating':
                         new_question.rating_start = 1; new_question.rating_end = 5; new_question.rating_step = 1; new_question.rating_unit = 'stars'
                    elif question_type == 'star-rating-grid':
                         new_question.rating_start = 1; new_question.rating_end = 5; new_question.rating_step = 1; new_question.rating_unit = 'stars'

                    db.session.add(new_question)
                    # --- End of re-used logic ---

            # ADDED: Handle survey tags
            if 'tags' in data:
                survey.tags = data['tags']  # Expecting a list of tag IDs or names

            # Handle report_settings if provided
            if 'report_settings' in data:
                # Implement report_settings update logic
                pass

            db.session.commit()
            return {"id": survey.id, "message": "Survey updated successfully"}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to update survey {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to update survey", "details": str(e)}, 500

    # --- Other static methods (delete_survey, list_surveys, etc.) remain unchanged ---
    # --- Assume they don't need modification based on the Question model changes ---
    @staticmethod
    def delete_survey(survey_id):
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404
        try:
            survey.is_archived = True
            survey.published = False
            db.session.commit()
            return {"id": survey.id, "message": "Survey archived successfully"}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to archive survey {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to archive survey", "details": str(e)}, 500

    @staticmethod
    def list_surveys():
        try:
            surveys = Survey.query.filter_by(is_archived=False).order_by(Survey.created_at.desc()).all()
            survey_list = []
            for s in surveys:
                response_count = Submission.query.filter_by(survey_id=s.id, is_complete=True).count()
                survey_list.append({
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                    "published": s.published,
                    "participant_limit": s.participant_limit,
                    "is_quickpoll": s.is_quickpoll,
                    "branding": s.branding,
                    "business_id": s.business_id,  # Include business_id for frontend context
                    "response_count": response_count,
                    "question_count": s.questions.count()
                })
            return survey_list, 200
        except Exception as e:
            current_app.logger.error(f"Failed to list surveys: {e}", exc_info=True)
            return {"error": "Failed to list surveys", "details": str(e)}, 500

    @staticmethod
    def get_survey_results(survey_id):
        # Consider replacing with call to analytics endpoint for better structure
        survey = Survey.query.get(survey_id)
        if not survey: return {"error": "Survey not found"}, 404
        # Delegate to get_survey for consistent full data retrieval
        return SurveyController.get_survey(survey_id)


    @staticmethod
    def get_survey_summary(survey_id):
        return ResponseController.get_report_summary(survey_id)

    @staticmethod
    def create_branch(survey_id, question_id, data):
        # (Logic remains the same as previous version, assumes it handles numerical/option branching correctly based on input)
        question = Question.query.get(question_id)
        if not question or question.survey_id != int(survey_id):
            return {"error": "Question not found or doesn't belong to this survey"}, 404

        allowed_question_types = ['multiple-choice', 'dropdown', 'numerical-input', 'rating', 'nps', 'single-choice', 'date-picker'] # Added date-picker
        if question.question_type not in allowed_question_types:
            return {"error": f"Branching is only available for {', '.join(allowed_question_types)} questions."}, 400

        if question.question_type in ['numerical-input', 'rating', 'nps', 'date-picker']:
             rules = data.get("rules")
             if not isinstance(rules, list):
                 return {"error": "Missing or invalid 'rules' list for numerical/date branching"}, 400

             question.numerical_branch_enabled = True
             question.numerical_branch_rules = rules
             question.branch = None # Clear old option branch if switching to numerical
        else: # Option-based branching
            option_key = data.get("option_index") or data.get("option_text") # Allow index or text as key
            branch_data = data.get("branch")
            if option_key is None or not isinstance(branch_data, dict):
                return {"error": "Missing option_index/text or branch data for option branching"}, 400

            if not question.branch or not isinstance(question.branch, dict):
                 question.branch = {}

            question.branch[str(option_key)] = branch_data
            question.numerical_branch_enabled = False # Clear numerical if setting option branch
            question.numerical_branch_rules = None

        try:
            db.session.commit()
            return {"survey_id": survey_id, "question_id": question_id,
                    "branch": question.branch,
                    "numerical_branch_enabled": question.numerical_branch_enabled,
                    "numerical_branch_rules": question.numerical_branch_rules}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to create branch for question {question_id}: {e}", exc_info=True)
            return {"error": "Database update failed", "details": str(e)}, 500

    @staticmethod
    def copy_survey(survey_id, data):
        try:
            original_survey = Survey.query.get(survey_id)
            if not original_survey:
                return {"error": "Original survey not found"}, 404

            new_title = data.get("title", f"Copy of {original_survey.title}")
            business_id = data.get("business_id", original_survey.business_id) # Inherit business_id

            new_survey = Survey(
                title=new_title,
                description=original_survey.description,
                start_date=original_survey.start_date,
                end_date=original_survey.end_date,
                participant_limit=original_survey.participant_limit,
                published=False,  # Copies are unpublished by default
                is_archived=False,
                is_quickpoll=original_survey.is_quickpoll,
                branding=original_survey.branding,
                business_id=business_id, # Set business_id for the copy
                copy_of=survey_id
            )
            db.session.add(new_survey)
            db.session.flush()

            # Deep copy questions to maintain their settings
            original_questions = sorted(original_survey.questions, key=lambda q: q.sequence_number or 0)
            
            # Create a mapping from old question ID to new question object
            old_id_to_new_question = {}

            for q in original_questions:
                new_question = Question(
                    survey_id=new_survey.id,
                    question_text=q.question_text,
                    description=q.description,
                    additional_text=q.additional_text,
                    question_type=q.question_type,
                    options=q.options,
                    branch=q.branch,
                    sequence_number=q.sequence_number,
                    original_sequence_number=q.original_sequence_number, # Preserve original sequence
                    image_url=q.image_url,
                    required=q.required,
                    question_text_html=q.question_text_html,
                    rating_start=q.rating_start,
                    rating_end=q.rating_end,
                    rating_step=q.rating_step,
                    rating_unit=q.rating_unit,
                    left_label=q.left_label,
                    center_label=q.center_label,
                    right_label=q.right_label,
                    nps_left_label=q.nps_left_label,
                    nps_right_label=q.nps_right_label,
                    row_text=q.row_text,
                    min_value=q.min_value,
                    max_value=q.max_value,
                    force_positive=q.force_positive,
                    grid_rows=q.grid_rows,
                    grid_columns=q.grid_columns,
                    not_applicable=q.not_applicable,
                    not_applicable_text=q.not_applicable_text,
                    has_other_option=q.has_other_option,
                    other_option_text=q.other_option_text,
                    show_na=q.show_na,
                    min_selection=q.min_selection,
                    max_selection=q.max_selection,
                    image_options=q.image_options,
                    ranking_items=q.ranking_items,
                    allowed_types=q.allowed_types,
                    max_file_size=q.max_file_size,
                    max_files=q.max_files,
                    signature_options=q.signature_options,
                    min_date=q.min_date,
                    max_date=q.max_date,
                    verify_domain=q.verify_domain,
                    allowed_domains=q.allowed_domains,
                    scale_points=q.scale_points,
                    numerical_branch_enabled=q.numerical_branch_enabled,
                    numerical_branch_rules=q.numerical_branch_rules,
                    disqualify_enabled=q.disqualify_enabled,
                    disqualify_message=q.disqualify_message,
                    disqualify_rules=q.disqualify_rules,
                    conditional_logic_rules=q.conditional_logic_rules,
                    report_sequence=q.report_sequence
                )
                db.session.add(new_question)
                db.session.flush()
                old_id_to_new_question[q.id] = new_question

            # Here you would update conditional logic to point to new question IDs/UUIDs if needed
            # This is a complex step that requires re-mapping based on old_id_to_new_question

            db.session.commit()
            return SurveyController.get_survey(new_survey.id)

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to copy survey {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to copy survey", "details": str(e)}, 500

    @staticmethod
    def publish_survey(survey_id):
        logger = logging.getLogger(__name__)
        
        logger.info(f"[PUBLISH_SURVEY] ========== Starting publish operation ==========")
        logger.info(f"[PUBLISH_SURVEY] Survey ID: {survey_id}")
        
        survey = Survey.query.get(survey_id)
        if not survey:
            logger.error(f"[PUBLISH_SURVEY] ? Survey {survey_id} not found")
            return {"error": "Survey not found"}, 404
            
        logger.info(f"[PUBLISH_SURVEY] Found survey: '{survey.title}'")
        logger.info(f"[PUBLISH_SURVEY] Current published status: {survey.published}")
        logger.info(f"[PUBLISH_SURVEY] Survey business_id: {survey.business_id}")
        
        try:
            # Check if already published
            if survey.published:
                logger.warning(f"[PUBLISH_SURVEY] Survey {survey_id} is already published")
                return {"id": survey.id, "published": survey.published, "message": "Survey is already published"}, 200
            
            logger.info(f"[PUBLISH_SURVEY] Setting published=True for survey {survey_id}")
            survey.published = True
            
            logger.info(f"[PUBLISH_SURVEY] Before commit - survey.published = {survey.published}")
            
            # Log activity if the survey belongs to a business
            if survey.business_id:
                from app.models import Business # Import Business model
                business = Business.query.get(survey.business_id)
                if business:
                    business.active_survey_count = (business.active_survey_count or 0) + 1
                    # Assuming 40 points per survey/quest for now
                    business.cumulative_earnable_points = (business.active_survey_count + business.active_quest_count) * 40
                    db.session.add(business)
                    logger.info(f"[PUBLISH_SURVEY] Updated business {business.id} counters: active_surveys={business.active_survey_count}, earnable_points={business.cumulative_earnable_points}")

                logger.info(f"[PUBLISH_SURVEY] Survey belongs to business {survey.business_id}, logging activity")
                from app.controllers.activity_controller import ActivityController
                from app.models import ActivityType
                from flask import g
                
                # Get the current user information for activity logging
                user_id = None
                if hasattr(g, 'current_user') and g.current_user:
                    user_id = g.current_user.id
                    logger.info(f"[PUBLISH_SURVEY] Activity logged by user {user_id}")
                
                # Create activity log entry
                activity_title = f"Published survey: '{survey.title}'"
                activity_description = f"Survey '{survey.title}' has been published and is now live for responses."
                
                # Get business default setting for public wall visibility
                make_public = False
                if survey.business and hasattr(survey.business, 'default_public_on_wall'):
                    make_public = survey.business.default_public_on_wall
                
                try:
                    ActivityController.create_activity_log(
                        business_id=survey.business_id,
                        activity_type=ActivityType.SURVEY_PUBLISHED,
                        title=activity_title,
                        description=activity_description,
                        related_item_id=survey.id,
                        related_item_url=f"/surveys/{survey.id}",
                        user_id=user_id,
                        make_public_by_default=make_public  # Use business's default setting
                    )
                    logger.info(f"[PUBLISH_SURVEY] ? Activity logged for business {survey.business_id}: {activity_title}")
                except Exception as activity_error:
                    logger.error(f"[PUBLISH_SURVEY] ?? Failed to log activity: {str(activity_error)}")
                    # Continue with survey publishing even if activity logging fails
            
            logger.info(f"[PUBLISH_SURVEY] Committing database transaction...")
            db.session.commit()
            
            # Verify the change was committed
            db.session.refresh(survey)
            logger.info(f"[PUBLISH_SURVEY] After commit - survey.published = {survey.published}")
            
            if survey.published:
                logger.info(f"[PUBLISH_SURVEY] ? Survey {survey_id} published successfully!")
            else:
                logger.error(f"[PUBLISH_SURVEY] ? Database commit failed - survey.published is still {survey.published}")
                
            return {"id": survey.id, "published": survey.published, "message": "Survey published successfully"}, 200
            
        except Exception as e:
            logger.error(f"[PUBLISH_SURVEY] ? Exception during publish operation: {str(e)}", exc_info=True)
            db.session.rollback()
            logger.info(f"[PUBLISH_SURVEY] Database rolled back due to error")
            return {"error": "Failed to publish survey", "details": str(e)}, 500

    @staticmethod
    def unpublish_survey(survey_id):
        logger = logging.getLogger(__name__)
        
        logger.info(f"[UNPUBLISH_SURVEY] ========== Starting unpublish operation ==========")
        logger.info(f"[UNPUBLISH_SURVEY] Survey ID: {survey_id}")
        
        survey = Survey.query.get(survey_id)
        if not survey:
            logger.error(f"[UNPUBLISH_SURVEY] ? Survey {survey_id} not found")
            return {"error": "Survey not found"}, 404
            
        logger.info(f"[UNPUBLISH_SURVEY] Found survey: '{survey.title}'")
        logger.info(f"[UNPUBLISH_SURVEY] Current published status: {survey.published}")
        logger.info(f"[UNPUBLISH_SURVEY] Survey business_id: {survey.business_id}")
        
        if not survey.published:
            logger.warning(f"[UNPUBLISH_SURVEY] Survey {survey_id} is already unpublished")
            return {"message": "Survey is already unpublished (draft)"}, 200

        try:
            logger.info(f"[UNPUBLISH_SURVEY] Setting published=False for survey {survey_id}")
            survey.published = False
            
            logger.info(f"[UNPUBLISH_SURVEY] Before commit - survey.published = {survey.published}")
            
            # Log activity if the survey belongs to a business
            if survey.business_id:
                from app.models import Business # Import Business model
                business = Business.query.get(survey.business_id)
                if business:
                    business.active_survey_count = max(0, (business.active_survey_count or 0) - 1) # Ensure it doesn't go below 0
                    # Assuming 40 points per survey/quest for now
                    business.cumulative_earnable_points = (business.active_survey_count + business.active_quest_count) * 40
                    db.session.add(business)
                    logger.info(f"[UNPUBLISH_SURVEY] Updated business {business.id} counters: active_surveys={business.active_survey_count}, earnable_points={business.cumulative_earnable_points}")

                logger.info(f"[UNPUBLISH_SURVEY] Survey belongs to business {survey.business_id}, logging activity")
                from app.controllers.activity_controller import ActivityController
                from app.models import ActivityType
                from flask import g
                
                user_id_for_log = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
                logger.info(f"[UNPUBLISH_SURVEY] Activity logged by user {user_id_for_log}")

                try:
                    ActivityController.create_activity_log(
                        business_id=survey.business_id,
                        activity_type=ActivityType.SURVEY_ARCHIVED,  # Or create a new SURVEY_UNPUBLISHED type
                        title=f"Survey unpublished: '{survey.title}'",
                        description=f"Survey '{survey.title}' has been unpublished and reverted to draft.",
                        related_item_id=survey.id,
                        user_id=user_id_for_log,
                        make_public_by_default=False  # Internal action, likely not public on wall
                    )
                    logger.info(f"[UNPUBLISH_SURVEY] ? Activity logged for business {survey.business_id}")
                except Exception as activity_error:
                    logger.error(f"[UNPUBLISH_SURVEY] ?? Failed to log activity: {str(activity_error)}")
                    # Continue with survey unpublishing even if activity logging fails
                    
            logger.info(f"[UNPUBLISH_SURVEY] Committing database transaction...")
            db.session.commit()
            
            # Verify the change was committed
            db.session.refresh(survey)
            logger.info(f"[UNPUBLISH_SURVEY] After commit - survey.published = {survey.published}")
            
            if not survey.published:
                logger.info(f"[UNPUBLISH_SURVEY] ? Survey {survey_id} unpublished successfully!")
            else:
                logger.error(f"[UNPUBLISH_SURVEY] ? Database commit failed - survey.published is still {survey.published}")
                
            return {"id": survey.id, "published": survey.published, "message": "Survey unpublished successfully"}, 200
            
        except Exception as e:
            logger.error(f"[UNPUBLISH_SURVEY] ? Exception during unpublish operation: {str(e)}", exc_info=True)
            db.session.rollback()
            logger.info(f"[UNPUBLISH_SURVEY] Database rolled back due to error")
            return {"error": "Failed to unpublish survey", "details": str(e)}, 500

    @staticmethod
    def get_survey_history():
        try:
            surveys = Survey.query.order_by(Survey.created_at.desc()).all()
            history = []
            for s in surveys:
                 response_count = Submission.query.filter_by(survey_id=s.id, is_complete=True).count()
                 status = "Archived" if s.is_archived else ("Published" if s.published else "Draft")
                 history.append({
                    "id": s.id, "title": s.title, "created_at": s.created_at.isoformat() if s.created_at else None,
                    "status": status, "response_count": response_count, "is_archived": s.is_archived, "is_quickpoll": s.is_quickpoll,
                 })
            return history, 200
        except Exception as e:
            current_app.logger.error(f"Failed to retrieve survey history: {e}", exc_info=True)
            return {"error": "Failed to retrieve survey history", "details": str(e)}, 500

    @staticmethod
    def list_surveys_for_business(business_id):
        """List all surveys for a specific business"""
        try:
            from app.models import Business
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            surveys = Survey.query.filter_by(business_id=business_id, is_archived=False).order_by(Survey.created_at.desc()).all()
            survey_list = []
            for s in surveys:
                response_count = Submission.query.filter_by(survey_id=s.id, is_complete=True).count()
                survey_list.append({
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                    "published": s.published,
                    "participant_limit": s.participant_limit,
                    "is_quickpoll": s.is_quickpoll,
                    "branding": s.branding,
                    "business_id": s.business_id,
                    "response_count": response_count,
                    "question_count": s.questions.count(),
                    "is_featured": s.is_featured
                })
            return {"surveys": survey_list, "business_name": business.name}, 200
        except Exception as e:
            current_app.logger.error(f"Failed to list surveys for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to list surveys", "details": str(e)}, 500

    @staticmethod
    def get_survey_for_business(survey_id, business_id):
        """Get survey details ensuring it belongs to the specified business"""
        try:
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            return SurveyController.get_survey(survey_id)
        except Exception as e:
            current_app.logger.error(f"Failed to get survey {survey_id} for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to retrieve survey", "details": str(e)}, 500

    @staticmethod
    def update_survey_for_business(survey_id, business_id, data):
        """Update survey ensuring it belongs to the specified business"""
        try:
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            if str(survey.business_id) != str(business_id): # Ensure business_id is string for comparison
                return {"message": "Survey does not belong to this business"}, 403
            
            # Instead of only updating basic fields, call the main update_survey method
            # which properly handles both basic fields AND questions
            return SurveyController.update_survey(survey_id, data)
            
        except Exception as e:
            current_app.logger.error(f"Failed to update survey {survey_id} for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to update survey", "details": str(e)}, 500

    @staticmethod
    def delete_survey_for_business(survey_id, business_id):
        """Delete/archive survey ensuring it belongs to the specified business"""
        try:
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            return SurveyController.delete_survey(survey_id)
        except Exception as e:
            current_app.logger.error(f"Failed to delete survey {survey_id} for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to delete survey", "details": str(e)}, 500

    @staticmethod
    def copy_survey_for_business(survey_id, business_id, data):
        """Copy survey within the same business"""
        try:
            original = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not original:
                return {"error": "Original survey not found or does not belong to this business"}, 404
            
            # Ensure the copy stays within the same business
            data['business_id'] = business_id
            return SurveyController.copy_survey(survey_id, data)
        except Exception as e:
            current_app.logger.error(f"Failed to copy survey {survey_id} for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to copy survey", "details": str(e)}, 500

    @staticmethod
    def publish_survey_for_business(survey_id, business_id):
        """Publish survey ensuring it belongs to the specified business"""
        try:
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            return SurveyController.publish_survey(survey_id)
        except Exception as e:
            current_app.logger.error(f"Failed to publish survey {survey_id} for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to publish survey", "details": str(e)}, 500

    @staticmethod
    def unpublish_survey_for_business(survey_id, business_id):
        """Unpublish a survey for business"""
        result, status = SurveyController.unpublish_survey(survey_id) # Re-use generic method
        return result, status

    @staticmethod
    def create_branch_for_business(survey_id, business_id, question_id, data):
        """Create branching logic ensuring survey belongs to business"""
        try:
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            return SurveyController.create_branch(survey_id, question_id, data)
        except Exception as e:
            current_app.logger.error(f"Failed to create branch for survey {survey_id} business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to create branch", "details": str(e)}, 500

    @staticmethod
    def get_survey_audience(survey_id, business_id):
        """Get audience settings for a survey, including its restricted status."""
        try:
            from app.models import SurveyAudience # Keep local import
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            audience_record = SurveyAudience.query.filter_by(survey_id=survey_id).first()
            audience_settings_dict = audience_record.to_dict() if audience_record else {
                # Default audience settings if no record exists
                "survey_id": survey_id,
                "access_type": "BUSINESS_AUDIENCE", # Default if no specific settings for a restricted survey
                "email_domain_whitelist": [],
                "specific_email_whitelist": [],
                "discord_roles_allowed": [],
                "qr_code_token": None,
                "qr_code_expires_at": None
            }

            return {
                "is_restricted": survey.is_restricted,
                "audience_details": audience_settings_dict
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"Failed to get survey audience {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to retrieve survey audience settings", "details": str(e)}, 500

    @staticmethod
    def update_survey_audience(survey_id, business_id, data):
        """
        Update survey audience settings including email and domain whitelists.
        Args:
            survey_id (int): Survey ID
            business_id (int): Business ID
            data (dict): Audience settings data containing:
                - access_type: str
                - specific_email_whitelist: list[str]
                - email_domain_whitelist: list[str]
                - required_tags: list[str]
                - tag_matching_logic: str
                - discord_roles_allowed: list[str]
        """
        
        try:
            current_app.logger.info(f"[UPDATE_SURVEY_AUDIENCE] Updating audience for survey {survey_id} in business {business_id}")
            current_app.logger.debug(f"[UPDATE_SURVEY_AUDIENCE] Data received: {data}")

            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404

            if survey.business_id != business_id:
                return {"error": "Survey does not belong to this business"}, 403

            audience_settings = survey.audience_settings
            if not audience_settings:
                audience_settings = SurveyAudience(survey_id=survey_id)
                db.session.add(audience_settings)

            # 1. Set Access Type and is_restricted flag
            access_type = data.get('access_type', audience_settings.access_type or 'BUSINESS_AUDIENCE')
            audience_settings.access_type = access_type
            survey.is_restricted = access_type not in ['OPEN', 'PUBLIC', 'BUSINESS_AUDIENCE']

            # 2. Set Whitelists (direct assignment, avoiding mutation issues)
            audience_settings.specific_email_whitelist = data.get('specific_email_whitelist', [])
            audience_settings.email_domain_whitelist = data.get('email_domain_whitelist', [])
            # 3. Set Tag-based rules
            audience_settings.required_tags = data.get('required_tags', [])
            audience_settings.tag_matching_logic = data.get('tag_matching_logic', 'ANY')

            # 4. Set Discord roles and sync the helper table for efficient querying
            discord_roles = data.get('discord_roles_allowed', [])
            audience_settings.discord_roles_allowed = discord_roles

            # 5. Set access tokens (for token-gated access)
            access_tokens = data.get('access_tokens', [])
            if access_tokens:
                # Store as direct_access_tokens in the database
                audience_settings.direct_access_tokens = access_tokens
            else:
                audience_settings.direct_access_tokens = []

            # Sync the helper table for efficient querying
            from app.models import SurveyDiscordRole
            if discord_roles:
                SurveyController.update_survey_discord_roles(survey.id, business_id, discord_roles)
            else:
                SurveyDiscordRole.query.filter_by(survey_id=survey.id).delete()

            db.session.commit()

            current_app.logger.info(f"[UPDATE_SURVEY_AUDIENCE] Successfully updated audience settings for survey {survey_id}")
            return {
                "message": "Survey audience settings updated successfully",
                "settings": audience_settings.to_dict()
            }, 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_SURVEY_AUDIENCE] Error: {e}", exc_info=True)
            return {"error": "Failed to update survey audience settings", "details": str(e)}, 500
    @staticmethod
    def generate_survey_qr_code(survey_id, business_id):
        """Generate QR code for survey access"""
        try:
            import secrets
            from app.models import SurveyAudience
            
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {"error": "Survey not found or does not belong to this business"}, 404
            
            audience = SurveyAudience.query.filter_by(survey_id=survey_id).first()
            if not audience:
                audience = SurveyAudience(survey_id=survey_id)
                db.session.add(audience)
            
            # Generate new QR code token
            audience.qr_code_token = secrets.token_urlsafe(32)
            
            # Set expiry if provided
            if 'expires_at' in request.get_json() if hasattr(request, 'get_json') and request.get_json() else {}:
                audience.qr_code_expires_at = SurveyController._parse_iso_date(request.get_json()['expires_at'])
            
            db.session.commit()
            
            return {
                "qr_code_token": audience.qr_code_token,
                "qr_code_url": f"/access/survey/{audience.qr_code_token}",
                "expires_at": audience.qr_code_expires_at.isoformat() if audience.qr_code_expires_at else None
            }, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to generate QR code for survey {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to generate QR code", "details": str(e)}, 500

    @staticmethod
    def get_public_survey(survey_id):
        """Get survey for public access. Admins can view drafts and bypass audience restrictions."""
        logger = logging.getLogger(__name__)
        
        logger.info(f"[SURVEY_CONTROLLER] ========== get_public_survey called ==========")
        logger.info(f"[SURVEY_CONTROLLER] Survey ID: {survey_id}")
        logger.info(f"[SURVEY_CONTROLLER] Current user: {getattr(g, 'current_user', 'None')}")
        logger.info(f"[SURVEY_CONTROLLER] User role: {getattr(g, 'user_role', 'None')}")
        
        try:
            user_role = getattr(g, 'user_role', None)
            current_user = getattr(g, 'current_user', None)
            
            if user_role == 'super_admin':
                logger.info(f"[SURVEY_CONTROLLER] Super admin detected - fetching survey regardless of published status or audience restrictions")
                survey = Survey.query.filter_by(id=survey_id).first()
            elif user_role == 'business_admin':
                logger.info(f"[SURVEY_CONTROLLER] Business admin detected - checking business ownership")
                survey = Survey.query.filter_by(id=survey_id).first()
                if survey and current_user and current_user.business_id != survey.business_id:
                    logger.warning(f"[SURVEY_CONTROLLER] Business admin {current_user.id} cannot access survey from different business")
                    return {"error": "Access denied: Survey belongs to a different business"}, 403
                logger.info(f"[SURVEY_CONTROLLER] Business admin access granted for own business survey")
            else:
                logger.info(f"[SURVEY_CONTROLLER] Regular user - querying published surveys only")
                survey = Survey.query.filter_by(id=survey_id, published=True).first()
            
            if not survey:
                logger.warning(f"[SURVEY_CONTROLLER] ? Survey {survey_id} not found or not published")
                # Let's also check if the survey exists but is not published
                unpublished_survey = Survey.query.filter_by(id=survey_id).first()
                if unpublished_survey:
                    logger.warning(f"[SURVEY_CONTROLLER] Survey {survey_id} exists but is not published (published={unpublished_survey.published})")
                    logger.info(f"[SURVEY_CONTROLLER] Unpublished survey details: title='{unpublished_survey.title}', business_id={unpublished_survey.business_id}")
                else:
                    logger.warning(f"[SURVEY_CONTROLLER] Survey {survey_id} does not exist in database")
                    # Let's check what surveys do exist
                    try:
                        all_surveys = Survey.query.all()
                        logger.info(f"[SURVEY_CONTROLLER] Available surveys: {[s.id for s in all_surveys]}")
                    except Exception as e:
                        logger.error(f"[SURVEY_CONTROLLER] Error querying all surveys: {e}")
                return {"error": "Survey not found or not published"}, 404
            
            logger.info(f"[SURVEY_CONTROLLER] ? Found survey: '{survey.title}' (id={survey.id}, published={survey.published})")
            logger.info(f"[SURVEY_CONTROLLER] Survey business_id: {survey.business_id}")
            logger.info(f"[SURVEY_CONTROLLER] Survey is_archived: {survey.is_archived}")
            logger.info(f"[SURVEY_CONTROLLER] Survey created_at: {survey.created_at}")
            
            # Check if survey belongs to a business and log business details
            if survey.business:
                business = survey.business
                logger.info(f"[SURVEY_CONTROLLER] Survey belongs to business: '{business.name}' (id={business.id})")
                logger.info(f"[SURVEY_CONTROLLER] Business is_active: {business.is_active}")
                logger.info(f"[SURVEY_CONTROLLER] Business is_approved: {business.is_approved}")
                logger.info(f"[SURVEY_CONTROLLER] Business audience_type: {getattr(business, 'audience_type', 'N/A')}")
            else:
                logger.info(f"[SURVEY_CONTROLLER] Survey has no associated business")
            
            # Note: Audience access control should have been handled by the @enforce_survey_access decorator
            logger.info(f"[SURVEY_CONTROLLER] Audience access control passed, calling SurveyController.get_survey({survey_id})")
            result, status = SurveyController.get_survey(survey_id)
            completed = False
            try:
                if hasattr(g, 'current_user') and g.current_user:
                    # For admin users, we don't mark surveys as completed to allow multiple responses
                    user_role = getattr(g.current_user, 'role', 'user')
                    if user_role in ['super_admin', 'business_admin']:
                        completed = False  # Always allow admin access regardless of completion
                    else:
                        completed = Submission.query.filter_by(
                            survey_id=survey_id,
                            user_id=g.current_user.id,
                            is_complete=True
                        ).first() is not None
            except Exception:
                completed = False
            
            logger.info(f"[SURVEY_CONTROLLER] get_survey returned status: {status}")
            if status == 200:
                logger.info(f"[SURVEY_CONTROLLER] ? Successfully returned survey data for '{survey.title}'")
                logger.debug(f"[SURVEY_CONTROLLER] Survey data contains {len(result.get('questions', []))} questions")
                result['completed_by_user'] = completed
            else:
                logger.warning(f"[SURVEY_CONTROLLER] ? get_survey returned error: {result}")
                
            logger.info(f"[SURVEY_CONTROLLER] ========== get_public_survey completed ==========")
            return result, status
            
        except Exception as e:
            logger.error(f"[SURVEY_CONTROLLER] ? Exception in get_public_survey: {str(e)}", exc_info=True)
            return {"error": "Failed to retrieve survey", "details": str(e)}, 500

    @staticmethod
    def get_survey_analytics_secure(survey_id, current_user, user_role):
        """Get survey analytics with business ownership verification"""
        try:
            survey = Survey.query.get(survey_id)
            if not survey:
                return {"error": "Survey not found"}, 404
            
            # Check access permissions
            if user_role == 'super_admin':
                # Super admin can access any survey analytics
                pass
            elif user_role == 'business_admin':
                # Business admin can only access surveys from their business
                if current_user.business_id != survey.business_id:
                    return {"error": "Access denied: Survey belongs to a different business"}, 403
            else:
                return {"error": "Access denied: Insufficient permissions"}, 403
            
            # Return analytics data (implement this method or call existing analytics)
            return survey.get_analytics_summary(), 200
        except Exception as e:
            current_app.logger.error(f"Failed to get analytics for survey {survey_id}: {e}", exc_info=True)
            return {"error": "Failed to retrieve survey analytics", "details": str(e)}, 500

    @staticmethod
    def list_all_surveys_for_super_admin():
        """List all surveys across all businesses (Super Admin only)"""
        try:
            surveys = Survey.query.filter_by(is_archived=False).order_by(Survey.created_at.desc()).all()
            survey_list = []
            for s in surveys:
                response_count = Submission.query.filter_by(survey_id=s.id, is_complete=True).count()
                survey_list.append({
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "business_id": s.business_id,
                    "business_name": s.business.name if s.business else "Unassigned",
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "published": s.published,
                    "response_count": response_count,
                    "question_count": s.questions.count(),
                    "is_featured": s.is_featured
                })
            return survey_list
        except Exception as e:
            current_app.logger.error(f"Failed to list all surveys: {e}", exc_info=True)
            return []

    @staticmethod
    def get_accessible_surveys_for_user(current_user, user_role):
        """Get surveys the current user has access to. Admins see drafts as well."""
        try:
            from app.controllers.business_controller import BusinessController

            if user_role == 'super_admin':
                surveys = Survey.query.filter_by(is_archived=False).order_by(Survey.created_at.desc()).all()
            elif user_role == 'business_admin':
                surveys = Survey.query.filter_by(is_archived=False, business_id=current_user.business_id).order_by(Survey.created_at.desc()).all()
            else:
                surveys = Survey.query.filter_by(published=True, is_archived=False).order_by(Survey.created_at.desc()).all()
            accessible_surveys = []
            
            for survey in surveys:
                # Include public surveys created by super admins (no business)
                if not survey.business:
                    if survey.published and not survey.is_archived:
                        accessible_surveys.append(survey)
                    elif user_role == 'super_admin':
                        accessible_surveys.append(survey)
                    continue
                    
                # Super admins and business admins have access to all surveys
                if user_role == 'super_admin':
                    accessible_surveys.append(survey)
                    continue
                elif user_role == 'business_admin' and current_user.business_id == survey.business_id:
                    accessible_surveys.append(survey)
                    continue
                
                # For regular users, check business and survey audience access
                try:
                    # First check if business is accessible
                    business = survey.business
                    if not business.is_active or not business.is_approved:
                        continue
                        
                    # Check business audience settings
                    if business.audience_type == 'RESTRICTED':
                        if not BusinessController.check_user_access(current_user, business.id):
                            continue
                    
                    # Check survey-specific audience settings
                    has_access, reason = BusinessController.check_survey_access(current_user, survey.id)
                    if has_access:
                        accessible_surveys.append(survey)
                        
                except Exception as e:
                    current_app.logger.warning(f"Error checking access for survey {survey.id}: {e}")
                    continue
            
            # Convert to response format with questions data
            survey_list = []
            for s in accessible_surveys:
                response_count = Submission.query.filter_by(survey_id=s.id, is_complete=True).count()
                completed = False
                try:
                    # For admin users, we don't mark surveys as completed to allow multiple responses
                    # For regular users, check if they have already completed the survey
                    if user_role in ['super_admin', 'business_admin']:
                        completed = False  # Always allow admin access regardless of completion
                    else:
                        completed = Submission.query.filter_by(
                            survey_id=s.id,
                            user_id=current_user.id,
                            is_complete=True
                        ).first() is not None
                except Exception:
                    completed = False
                
                # Get questions for frontend time/XP calculations
                sorted_questions = sorted(s.questions, key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
                questions_data = []
                for q in sorted_questions:
                    questions_data.append({
                        "id": q.id,
                        "question_type": q.question_type,
                        "sequence_number": q.sequence_number
                        # Only include minimal question data needed for calculations
                    })
                
                survey_list.append({
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                    "published": s.published,
                    "participant_limit": s.participant_limit,
                    "is_quickpoll": s.is_quickpoll,
                    "branding": s.branding,
                    "companyLogo": getattr(s.business, 'logo_url', None) if s.business else None,
                    "business_id": s.business_id,
                    "business_name": s.business.name if s.business else "Platform Survey",  # Better label for super admin surveys
                    "response_count": response_count,
                    "question_count": s.questions.count(),
                    "questions": questions_data,  # Include questions for frontend calculations
                    "is_featured": s.is_featured,  # Include featured status
                    "completed_by_user": completed  # Include completion status
                })
            
            current_app.logger.info(f"Found {len(survey_list)} accessible surveys for user {current_user.email}")
            return survey_list, 200
            
        except Exception as e:
            current_app.logger.error(f"Failed to get accessible surveys for user: {e}", exc_info=True)
            return {"error": "Failed to retrieve accessible surveys", "details": str(e)}, 500

    @staticmethod
    def reorder_questions(survey_id, question_mappings):
        """Reorder questions while preserving conditional logic"""
        try:
            from ..utils.conditional_logic_helper import update_question_sequence_with_logic_preservation
            
            success = update_question_sequence_with_logic_preservation(survey_id, question_mappings)
            
            if success:
                return {'success': True, 'message': 'Questions reordered successfully'}, 200
            else:
                return {'error': 'Failed to reorder questions'}, 500
                
        except Exception as e:
            current_app.logger.error(f"Error reordering questions: {e}")
            return {'error': str(e)}, 500

    @staticmethod
    def validate_conditional_logic(survey_id):
        """Validate conditional logic integrity"""
        try:
            from ..utils.conditional_logic_helper import validate_conditional_logic_integrity
            
            errors = validate_conditional_logic_integrity(survey_id)
            
            return {
                'valid': len(errors) == 0,
                'errors': errors
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"Error validating conditional logic: {e}")
            return {'error': str(e)}, 500

    @staticmethod
    def get_public_survey_feed(args):
        from app.models import Business # Local import
        from app.controllers.business_controller import BusinessController # Local import

        current_user = g.get('current_user', None)
        page = args.get('page', 1, type=int)
        per_page = args.get('per_page', 10, type=int)
        filter_tags_str = args.get('tags', None, type=str)
        
        current_app.logger.info(f"[PUBLIC_SURVEY_FEED] User: {current_user.id if current_user else 'Anonymous'}, Page: {page}, PerPage: {per_page}, Tags: {filter_tags_str}")

        if current_user and getattr(current_user, 'role', None) in ['super_admin', 'business_admin']:
            if getattr(current_user, 'role', None) == 'business_admin':
                base_query = Survey.query.filter_by(is_archived=False, business_id=current_user.business_id)
            else:
                base_query = Survey.query.filter_by(is_archived=False)
        else:
            base_query = Survey.query.filter_by(published=True, is_archived=False)

        if filter_tags_str:
            filter_tags = [tag.strip().lower() for tag in filter_tags_str.split(',') if tag.strip()]
            if filter_tags:
                # This requires Survey.tags to be a JSON array of strings (tag names/IDs)
                # and the database/SQLAlchemy setup to support JSON operations.
                # For simplicity, this example might filter in Python if direct SQL JSON querying is complex.
                # A more robust solution would use DB specific JSON functions.
                # Example for PostgreSQL: base_query = base_query.filter(Survey.tags.contains(filter_tags)) # if tags are structured for this
                # Python-based filtering (less efficient for large datasets but works generally):
                all_surveys_for_tag_filtering = base_query.all()
                surveys_matching_tags = []
                for survey in all_surveys_for_tag_filtering:
                    if survey.tags and isinstance(survey.tags, list):
                        survey_tags_lower = [str(tag).lower() for tag in survey.tags]
                        if any(ft in survey_tags_lower for ft in filter_tags):
                            surveys_matching_tags.append(survey.id)
                if not surveys_matching_tags: # No surveys match the tags
                     return {'surveys': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}, 200
                base_query = Survey.query.filter(Survey.id.in_(surveys_matching_tags), Survey.published==True, Survey.is_archived==False)


        # Sort surveys: if authenticated and has interests, try to put those matching interests first.
        # This is a simple sort, more complex relevance scoring could be added.
        # This sorting is applied BEFORE pagination to ensure relevant items are on earlier pages.
        if current_user and hasattr(current_user, 'interests') and current_user.interests:
            user_interest_tags = set([str(t).lower() for t in current_user.interests])
            # This is a Python sort. For DB sort, would need complex case statements or full-text search.
            # surveys_to_sort = base_query.all() # Fetch all then sort
            # sorted_surveys = sorted(
            #     surveys_to_sort,
            #     key=lambda s: -len(user_interest_tags.intersection(set(str(t).lower() for t in s.tags))) if s.tags else 0,
            # )
            # # Then apply pagination to sorted_surveys (this is memory inefficient)
            # # For now, we'll paginate first, then sort the page if needed by frontend, or skip DB sort for simplicity.
            # current_app.logger.debug(f"User has interests, potential for sorting. User interests: {user_interest_tags}")
            # For DB level sorting (example, might need adjustment based on DB)
            # from sqlalchemy import case
            # sort_logic = case(
            #    [(Survey.tags.comparator.contains(user_interest_tag), 1) for user_interest_tag in user_interest_tags], # This is pseudo-code for matching
            #    else_=0
            # ).desc()
            # base_query = base_query.order_by(sort_logic, Survey.created_at.desc())
            # Simpler: order by creation date for now. Client can re-sort small pages.
            base_query = base_query.order_by(Survey.created_at.desc())

        else:
            base_query = base_query.order_by(Survey.created_at.desc())

        pagination_obj = base_query.paginate(page=page, per_page=per_page, error_out=False)
        surveys_on_page = pagination_obj.items
        
        accessible_surveys_dicts = []
        for survey in surveys_on_page:
            can_access = False
            if current_user:
                user_role = getattr(current_user, 'role', 'user')
                if user_role == 'super_admin':
                    can_access = True
                elif user_role == 'business_admin' and current_user.business_id == survey.business_id:
                    can_access = True
                else:
                    has_access, reason = BusinessController.check_survey_access(current_user, survey.id)
                    can_access = has_access
            else: # Anonymous user
                if survey.business_id is None: # Globally public, unlinked survey
                    if survey.is_restricted:
                        if survey.audience_settings:
                            if survey.audience_settings.required_tags or \
                               survey.audience_settings.specific_email_whitelist or \
                               survey.audience_settings.email_domain_whitelist:
                                can_access = False 
                            else: # Restricted but no specific auth-requiring rules
                                can_access = True
                        else: # Restricted but no audience settings (should not happen, but safer)
                            can_access = False
                    else: # Not restricted
                        can_access = True
                else: # Survey belongs to a business
                    business = Business.query.get(survey.business_id)
                    if business and business.is_active and business.is_approved and business.audience_type == 'PUBLIC':
                        if survey.is_restricted:
                            if survey.audience_settings:
                                if survey.audience_settings.access_type == 'SPECIFIC_RULES' and \
                                   (survey.audience_settings.specific_email_whitelist or \
                                    survey.audience_settings.email_domain_whitelist or \
                                    survey.audience_settings.required_tags):
                                    can_access = False
                                elif survey.audience_settings.required_tags and not (survey.audience_settings.access_type == 'SPECIFIC_RULES'): # if tags are required but not part of specific rules check already done
                                     can_access = False
                                else: # Public business, survey restricted but not in a way that blocks anonymous or already covered by SPECIFIC_RULES and passed
                                    # If it reached here, means SPECIFIC_RULES with auth did not block, or no such rules applied.
                                    # If required_tags were the only SPECIFIC_RULES and were met, it would be true from check_survey_access. This path is tricky for anonymous.
                                    # Let's simplify: if restricted, and SPECIFIC_RULES don't explicitly block anon, and no required_tags, then allow.
                                    if survey.audience_settings.access_type == 'SPECIFIC_RULES' and \
                                       not (survey.audience_settings.specific_email_whitelist or survey.audience_settings.email_domain_whitelist or survey.audience_settings.required_tags):
                                        can_access = True
                                    elif not survey.audience_settings.required_tags: # If not specific rules and no tags, allow
                                        can_access = True
                                    else: # Otherwise, default to false if specific checks didn't grant access
                                        can_access = False
                            else: # Restricted but no specific settings, safer to deny for anonymous
                                can_access = False
                        else: # Survey not restricted within a public business
                            can_access = True
            
            if can_access:
                # Check if survey is completed by current user
                completed = False
                if current_user:
                    try:
                        # For admin users, we don't mark surveys as completed to allow multiple responses
                        user_role = getattr(current_user, 'role', 'user')
                        if user_role in ['super_admin', 'business_admin']:
                            completed = False  # Always allow admin access regardless of completion
                        else:
                            completed = Submission.query.filter_by(
                                survey_id=survey.id,
                                user_id=current_user.id,
                                is_complete=True
                            ).first() is not None
                    except Exception:
                        completed = False
                
                from app.utils.xp_calculator import calculate_survey_xp, calculate_survey_time
                
                survey_dict = survey.to_dict(include_questions=False) # Avoid sending all questions in list view
                question_count = survey.questions.count()
                survey_dict['question_count'] = question_count
                survey_dict['xp_reward'] = calculate_survey_xp(question_count)  # Dynamic XP calculation
                survey_dict['estimated_time'] = calculate_survey_time(question_count)  # Dynamic time calculation
                survey_dict['completed_by_user'] = completed
                accessible_surveys_dicts.append(survey_dict)

        return {
            'surveys': accessible_surveys_dicts,
            'total': pagination_obj.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination_obj.pages
        }, 200

    @staticmethod
    def get_available_surveys():
        """
        Get all surveys available to current user based on:
        - Audience selection criteria
        - User profile tags
        - Business access permissions
        Returns surveys with calculated XP and time estimates
        """
        try:
            from ..utils.xp_calculator import calculate_survey_xp, calculate_survey_time
            
            current_user = getattr(g, 'current_user', None)
            user_role = getattr(g, 'user_role', 'user')
            
            current_app.logger.info(f"[GET_AVAILABLE_SURVEYS] Getting surveys for user: {current_user.id if current_user else 'Anonymous'}, role: {user_role}")
            
            if not current_user:
                return {"error": "Authentication required"}, 401
            
            # Get accessible surveys using existing method
            survey_list, status = SurveyController.get_accessible_surveys_for_user(current_user, user_role)
            
            if status != 200:
                return survey_list, status
            
            # Process surveys to add XP and time calculations
            processed_surveys = []
            for survey_data in survey_list:
                # Calculate XP and time based on question count using utility functions
                question_count = survey_data.get('question_count', 0)
                estimated_time = calculate_survey_time(question_count)
                xp_reward = calculate_survey_xp(question_count)
                
                # Add calculated fields
                survey_data['estimated_time'] = estimated_time
                survey_data['xp_reward'] = xp_reward
                
                # Remove business grouping - flatten the data structure
                processed_survey = {
                    'id': survey_data['id'],
                    'title': survey_data['title'],
                    'description': survey_data['description'],
                    'business_name': survey_data['business_name'],
                    'business_id': survey_data['business_id'],
                    'estimated_time': estimated_time,
                    'xp_reward': xp_reward,
                    'question_count': question_count,
                    'published': survey_data['published'],
                    'is_quickpoll': survey_data.get('is_quickpoll', False),
                    'created_at': survey_data.get('created_at'),
                    'questions': survey_data.get('questions', []),  # Include for frontend calculations if needed
                    'is_featured': survey_data.get('is_featured', False),  # Include featured status
                    'completed_by_user': survey_data.get('completed_by_user', False)  # Include completion status
                }
                
                processed_surveys.append(processed_survey)
            
            current_app.logger.info(f"[GET_AVAILABLE_SURVEYS] Returning {len(processed_surveys)} available surveys")
            return processed_surveys, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_AVAILABLE_SURVEYS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve available surveys", "details": str(e)}, 500

    @staticmethod
    def get_public_surveys():
        """
        Get public surveys including super admin surveys
        Super admin surveys (no business_id) are public to everyone
        """
        try:
            from ..utils.xp_calculator import calculate_survey_xp, calculate_survey_time
            
            current_app.logger.info("[GET_PUBLIC_SURVEYS] Getting public surveys")
            
            # Get surveys created by super admins (no business_id)
            super_admin_surveys = Survey.query.filter_by(
                business_id=None,
                published=True,
                is_archived=False
            ).all()
            
            # Get other public surveys based on business audience settings
            from app.models import Business
            business_public_surveys = Survey.query.join(Business).filter(
                Business.audience_type == 'PUBLIC',
                Survey.published == True,
                Survey.is_archived == False,
                Survey.business_id.isnot(None)
            ).all()
            
            all_public_surveys = super_admin_surveys + business_public_surveys
            
            # Process surveys with XP and time calculations
            survey_list = []
            for survey in all_public_surveys:
                question_count = survey.questions.count()
                estimated_time = calculate_survey_time(question_count)
                xp_reward = calculate_survey_xp(question_count)
                
                response_count = Submission.query.filter_by(survey_id=survey.id, is_complete=True).count()
                
                survey_data = {
                    'id': survey.id,
                    'title': survey.title,
                    'description': survey.description,
                    'business_name': survey.business.name if survey.business else "Platform Survey",  # Consistent with other methods
                    'business_id': survey.business_id,
                    'estimated_time': estimated_time,
                    'xp_reward': xp_reward,
                    'question_count': question_count,
                    'response_count': response_count,
                    'published': survey.published,
                    'is_quickpoll': survey.is_quickpoll,
                    'created_at': survey.created_at.isoformat() if survey.created_at else None
                }
                
                survey_list.append(survey_data)
            
            current_app.logger.info(f"[GET_PUBLIC_SURVEYS] Returning {len(survey_list)} public surveys")
            return survey_list, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PUBLIC_SURVEYS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve public surveys", "details": str(e)}, 500

    # === FEATURE / UNFEATURE ===
    @staticmethod
    def set_featured(survey_id, featured=True):
        """Toggle the featured flag on a survey (super-admin only or via admin controls)."""
        from app.models import Survey, db
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        # Optional: role-based guard
        user_role = getattr(g, 'user_role', None)
        if user_role not in ['super_admin', 'admin', 'business_admin']:
            return {"error": "Unauthorized"}, 403

        survey.is_featured = bool(featured)
        try:
            db.session.commit()
            return {"message": "Survey updated", "id": survey.id, "is_featured": survey.is_featured}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[SET_FEATURED] Failed to update survey {survey_id}: {e}")
            return {"error": "Failed to update survey", "details": str(e)}, 500

    @staticmethod
    def get_accessible_surveys_for_user_optimized(current_user, user_role, business_id=None):
        """
        NEW: Optimized survey fetching using database-level filtering
        This replaces the old method that checked each survey individually
        """
        try:
            from datetime import datetime
            from sqlalchemy.orm import joinedload
            from sqlalchemy import and_, or_
            
            # Extract user information for filtering
            user_email = current_user.email
            user_domain = user_email.split('@')[1] if '@' in user_email else None
            user_tag_ids = []
            
            # Collect user tags
            if hasattr(current_user, 'interests') and current_user.interests:
                user_tag_ids.extend(current_user.interests)
            if hasattr(current_user, 'owned_devices') and current_user.owned_devices:
                user_tag_ids.extend(current_user.owned_devices)
            if hasattr(current_user, 'memberships') and current_user.memberships:
                user_tag_ids.extend(current_user.memberships)
            
            # Get user's Discord roles - use the new discord_role_ids field for efficiency
            user_discord_role_ids = []
            if current_user.discord_id and current_user.discord_role_ids:
                user_discord_role_ids = current_user.discord_role_ids
            
            # Build the base query
            base_query = Survey.query.options(
                joinedload(Survey.audience_settings),
                joinedload(Survey.business)
            ).filter(
                Survey.published == True,
                Survey.is_archived == False
            )
            
            # Admin users get different access
            if user_role == 'super_admin':
                surveys = base_query.all()
            elif user_role == 'business_admin':
                surveys = base_query.filter(
                    or_(
                        Survey.business_id == current_user.business_id,
                        Survey.business_id.is_(None)  # Public surveys
                    )
                ).all()
            else:
                # For regular users, build optimized filters
                accessible_survey_ids = set()
                filter_summary = {
                    'user_email': user_email,
                    'user_domain': user_domain,
                    'user_discord_roles': len(user_discord_role_ids),
                    'user_tags': len(user_tag_ids),
                    'filters_applied': []
                }
                
                # 1. Get all public/open surveys
                public_surveys = db.session.query(Survey.id).filter(
                    Survey.published == True,
                    Survey.is_archived == False,
                    or_(
                        SurveyAudience.id.is_(None),
                        SurveyAudience.access_type.in_(['OPEN', 'PUBLIC'])
                    )
                ).outerjoin(SurveyAudience).all()
                
                accessible_survey_ids.update([s[0] for s in public_surveys])
                filter_summary['filters_applied'].append(f'Public surveys: {len(public_surveys)}')
                
                # 2. Email-specific surveys
                if user_email:
                    email_surveys = db.session.query(Survey.id).join(SurveyAudience).filter(
                        Survey.published == True,
                        Survey.is_archived == False,
                        SurveyAudience.specific_email_whitelist.contains([user_email])
                    ).all()
                    
                    accessible_survey_ids.update([s[0] for s in email_surveys])
                    filter_summary['filters_applied'].append(f'Email-specific surveys: {len(email_surveys)}')
                
                # 3. Domain-based surveys
                if user_domain:
                    domain_surveys = db.session.query(Survey.id).join(SurveyAudience).filter(
                        Survey.published == True,
                        Survey.is_archived == False,
                        SurveyAudience.email_domain_whitelist.contains([user_domain])
                    ).all()
                    
                    accessible_survey_ids.update([s[0] for s in domain_surveys])
                    filter_summary['filters_applied'].append(f'Domain-based surveys: {len(domain_surveys)}')
                
                # 4. Discord role-based surveys
                if user_discord_role_ids:
                    # Check both SurveyDiscordRole table and audience_settings.discord_roles_allowed
                    discord_surveys_from_table = db.session.query(Survey.id).join(SurveyDiscordRole).filter(
                        Survey.published == True,
                        Survey.is_archived == False,
                        SurveyDiscordRole.discord_role_id.in_(user_discord_role_ids)
                    ).all()
                    
                    # Also check audience_settings.discord_roles_allowed field
                    discord_surveys_from_audience = db.session.query(Survey.id).join(SurveyAudience).filter(
                        Survey.published == True,
                        Survey.is_archived == False,
                        SurveyAudience.discord_roles_allowed.isnot(None),
                        SurveyAudience.discord_roles_allowed != []
                    ).all()
                    
                    # For audience_settings, we need to check if any of the user's roles match the required roles
                    matching_audience_surveys = []
                    for survey_id in [s[0] for s in discord_surveys_from_audience]:
                        audience = SurveyAudience.query.filter_by(survey_id=survey_id).first()
                        if audience and audience.discord_roles_allowed:
                            user_role_set = set(user_discord_role_ids)
                            required_role_set = set(str(r) for r in audience.discord_roles_allowed)
                            if user_role_set.intersection(required_role_set):
                                matching_audience_surveys.append(survey_id)
                    
                    # Combine both results
                    all_discord_surveys = set([s[0] for s in discord_surveys_from_table] + matching_audience_surveys)
                    accessible_survey_ids.update(all_discord_surveys)
                    filter_summary['filters_applied'].append(f'Discord role surveys: {len(all_discord_surveys)}')
                
                # 5. Tag-based surveys
                if user_tag_ids:
                    # This is more complex due to ANY/ALL logic, so we'll handle it separately
                    tag_audience_settings = SurveyAudience.query.filter(
                        SurveyAudience.required_tags.isnot(None)
                    ).all()
                    
                    tag_survey_count = 0
                    for audience in tag_audience_settings:
                        if audience.required_tags:
                            required_set = set(audience.required_tags)
                            user_set = set(user_tag_ids)
                            
                            has_access = False
                            if audience.tag_matching_logic == 'ALL':
                                has_access = required_set.issubset(user_set)
                            else:  # ANY
                                has_access = bool(required_set.intersection(user_set))
                            
                            if has_access:
                                accessible_survey_ids.add(audience.survey_id)
                                tag_survey_count += 1
                    
                    filter_summary['filters_applied'].append(f'Tag-based surveys: {tag_survey_count}')
                
                # 6. Business audience inheritance
                business_audience_surveys = db.session.query(Survey.id).join(SurveyAudience).filter(
                    Survey.published == True,
                    Survey.is_archived == False,
                    SurveyAudience.access_type == 'BUSINESS_AUDIENCE'
                ).all()
                
                business_inherited_count = 0
                for survey_tuple in business_audience_surveys:
                    survey_id = survey_tuple[0]
                    survey = Survey.query.get(survey_id)
                    if survey and survey.business_id:
                        if SurveyController._check_business_audience_access(current_user, survey.business_id):
                            accessible_survey_ids.add(survey_id)
                            business_inherited_count += 1
                
                filter_summary['filters_applied'].append(f'Business audience surveys: {business_inherited_count}')
                
                # Get the actual survey objects
                surveys = Survey.query.options(
                    joinedload(Survey.audience_settings),
                    joinedload(Survey.business)
                ).filter(Survey.id.in_(accessible_survey_ids)).all() if accessible_survey_ids else []
                
                filter_summary['total_accessible'] = len(surveys)
                current_app.logger.info(f"[OPTIMIZED_SURVEY_FILTER] User {current_user.id}: {filter_summary}")
            
            # Convert to response format
            survey_list = []
            for survey in surveys:
                # Check if user has completed this survey
                completed = False
                if user_role not in ['super_admin', 'business_admin']:
                    completed = Submission.query.filter_by(
                        survey_id=survey.id,
                        user_id=current_user.id,
                        is_complete=True
                    ).first() is not None
                
                response_count = Submission.query.filter_by(survey_id=survey.id, is_complete=True).count()
                
                # Get questions for XP/time calculations
                sorted_questions = sorted(survey.questions, key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'))
                questions_data = []
                for q in sorted_questions:
                    questions_data.append({
                        "id": q.id,
                        "question_type": q.question_type,
                        "sequence_number": q.sequence_number
                    })
                
                survey_data = {
                    "id": survey.id,
                    "title": survey.title,
                    "description": survey.description,
                    "created_at": survey.created_at.isoformat() if survey.created_at else None,
                    "updated_at": survey.updated_at.isoformat() if survey.updated_at else None,
                    "published": survey.published,
                    "participant_limit": survey.participant_limit,
                    "is_quickpoll": survey.is_quickpoll,
                    "branding": survey.branding,
                    "companyLogo": getattr(survey.business, 'logo_url', None) if survey.business else None,
                    "business_id": survey.business_id,
                    "business_name": survey.business.name if survey.business else "Platform Survey",
                    "response_count": response_count,
                    "question_count": len(questions_data),
                    "questions": questions_data,
                    "is_featured": survey.is_featured,
                    "completed_by_user": completed
                }
                survey_list.append(survey_data)
            
            result = {
                'surveys': survey_list,
                'total_count': len(survey_list)
            }
            
            # Add filter summary for regular users
            if user_role not in ['super_admin', 'business_admin'] and 'filter_summary' in locals():
                result['filter_summary'] = filter_summary
            
            return result
            
        except Exception as e:
            current_app.logger.error(f"Failed to get optimized accessible surveys: {e}", exc_info=True)
            return {'surveys': [], 'total_count': 0, 'error': str(e)}

    @staticmethod
    def _check_business_audience_access(user, business_id):
        """Check if user has access to business audience"""
        try:
            business = Business.query.get(business_id)
            if not business or not business.is_active or not business.is_approved:
                return False
            
            if business.audience_type != 'RESTRICTED':
                return True
            
            # Check business audience settings
            audience = BusinessAudience.query.filter_by(business_id=business_id).first()
            if not audience:
                return True  # No restrictions
            
            user_email = user.email
            user_domain = user_email.split('@')[1] if '@' in user_email else None
            
            # Check specific emails
            if audience.specific_email_whitelist and user_email in audience.specific_email_whitelist:
                return True
            
            # Check domains
            if audience.email_domain_whitelist and user_domain in audience.email_domain_whitelist:
                return True
            
            # Check Discord roles if user has Discord linked - use the new discord_role_ids field
            if user.discord_id and audience.discord_roles_allowed and user.discord_role_ids:
                if any(role_id in audience.discord_roles_allowed for role_id in user.discord_role_ids):
                    return True
            
            return False
            
        except Exception as e:
            print(f"Error checking business audience access: {str(e)}")
            return False

    @staticmethod
    def update_survey_discord_roles(survey_id, business_id, discord_role_ids):
        """Update Discord role mappings for a survey"""
        try:
            # Verify survey belongs to business
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {'success': False, 'error': 'Survey not found or access denied'}
            
            # Clear existing mappings
            SurveyDiscordRole.query.filter_by(survey_id=survey_id).delete()
            
            # Add new mappings
            for role_data in discord_role_ids:
                if isinstance(role_data, dict):
                    role_id = role_data.get('id')
                    role_name = role_data.get('name')
                else:
                    role_id = role_data
                    role_name = None
                
                if role_id:
                    mapping = SurveyDiscordRole(
                        survey_id=survey_id,
                        discord_role_id=role_id,
                        discord_role_name=role_name,
                        business_id=business_id
                    )
                    db.session.add(mapping)
            
            db.session.commit()
            return {'success': True, 'message': f'Updated Discord roles for survey {survey_id}'}
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to update Discord roles: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    @staticmethod
    def generate_direct_access_link(survey_id, business_id):
        """Generate a direct access link that bypasses audience restrictions"""
        try:
            # Verify survey belongs to business
            survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first()
            if not survey:
                return {'success': False, 'error': 'Survey not found or access denied'}
            
            # Get or create audience settings
            audience = survey.audience_settings
            if not audience:
                audience = SurveyAudience(
                    survey_id=survey_id,
                    access_type='OPEN'
                )
                db.session.add(audience)
                db.session.flush()  # Get the ID
            
            # Generate direct access token
            token = audience.add_direct_access_token()
            db.session.commit()
            
            # Construct the direct access URL using url_for to ensure correct prefix
            from flask import url_for
            direct_url = url_for('survey.get_survey_with_direct_access', survey_id=survey_id, direct_token=token, _external=True)
            
            return {
                'success': True,
                'direct_access_url': direct_url,
                'token': token,
                'message': 'Direct access link generated successfully'
            }
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Failed to generate direct access link: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    @staticmethod
    def check_direct_access(survey_id, token):
        """Check if a direct access token is valid for a survey"""
        try:
            audience = SurveyAudience.query.filter_by(survey_id=survey_id).first()
            if not audience:
                return False
            
            return audience.is_valid_direct_access_token(token)
            
        except Exception as e:
            print(f"Error checking direct access: {str(e)}")
            return False


survey_api = Blueprint('survey_api', __name__)

@survey_api.route('/surveys/upload-emails', methods=['POST'])
def upload_emails():
    """
    Accept a CSV or XLSX file upload, extract all valid emails, and return them as a list.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    filename = file.filename.lower()
    if filename.endswith('.csv'):
        try:
            df = pd.read_csv(file)
        except Exception as e:
            return jsonify({'error': f'Failed to parse CSV: {str(e)}'}), 400
    elif filename.endswith('.xlsx'):
        try:
            df = pd.read_excel(file)
        except Exception as e:
            return jsonify({'error': f'Failed to parse XLSX: {str(e)}'}), 400
    else:
        return jsonify({'error': 'Unsupported file type. Please upload a CSV or XLSX file.'}), 400

    # Flatten all values and filter for valid emails
    values = df.values.flatten()
    email_regex = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
    emails = [str(v).strip().lower() for v in values if isinstance(v, str) and email_regex.match(str(v).strip())]
    emails = list(set(emails))  # Deduplicate
    return jsonify({'emails': emails, 'count': len(emails)}), 200

