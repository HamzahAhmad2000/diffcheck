# enforcement_controller.py
from datetime import datetime
from app.models import Survey, Submission, Response, db, User
from sqlalchemy import func
from app.controllers.response_controller import map_age_to_group

class EnforcementController:
    @staticmethod
    def submit_responses_enforced(data):
        print("Submission received:", data)  # Debug logging
        survey_id = data.get('survey_id')
        responses_data = data.get('responses')
        survey_link_id = data.get('survey_link_id')
        duration = data.get('duration')
        user_id = data.get('user_id')
        user_agent = data.get('user_agent')
        response_times = data.get('response_times', {})
        
        # Additional validation
        if not survey_id:
            return {"error": "survey_id is required"}, 400
        if not responses_data:
            return {"error": "responses data is required"}, 400
        
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        now = datetime.utcnow()
        if survey.start_date and now < survey.start_date:
            return {"error": "Survey not yet open"}, 403
        if survey.end_date and now > survey.end_date:
            return {"error": "Survey has ended"}, 403

        if survey.participant_limit:
            submission_count = Submission.query.filter_by(survey_id=survey_id).count()
            if submission_count >= survey.participant_limit:
                return {"error": "Survey response limit reached"}, 403

        if survey_link_id:
            from app.models import SurveyLink
            link = SurveyLink.query.filter_by(id=survey_link_id, survey_id=survey_id).first()
            if link and link.max_responses:
                link_submission_count = Submission.query.filter_by(survey_id=survey_id, survey_link_id=survey_link_id).count()
                if link_submission_count >= link.max_responses:
                    return {"error": "This survey link has reached its response limit"}, 403

        # Create submission with metadata and user information
        submission = Submission(
            survey_id=survey_id,
            duration=duration,
            survey_link_id=survey_link_id,
            user_id=user_id
        )
        
        # Handle user agent information if provided
        if user_agent:
            submission.user_agent = user_agent.get('userAgent', None)
            submission.device_type = user_agent.get('deviceType', None)
            submission.browser_info = user_agent.get('browserInfo', None)
            
        # Copy demographic data from User to Submission if user_id is provided
        if user_id:
            user = User.query.get(user_id)
            if user:
                # Copy all demographic fields from user to submission
                submission.age_group = map_age_to_group(user.age)
                submission.gender = user.gender
                submission.location = user.location
                submission.education = user.education
                submission.company = user.company
                print(f"Demographic data copied for user {user_id}: age={submission.age_group}, gender={submission.gender}, location={submission.location}, education={submission.education}, company={submission.company}")
            else:
                print(f"User not found for user_id: {user_id}")
        else:
            print("No user_id provided, skipping demographic data copy")
            
        db.session.add(submission)
        db.session.flush()  # to obtain submission.id
        
        print(f"Created submission with ID: {submission.id}, link ID: {survey_link_id}")  # Debug logging

        # Extract sequence number from string keys if needed
        processed_responses = {}
        for key, value in responses_data.items():
            if isinstance(key, str) and key.isdigit():
                processed_responses[int(key)] = value
            else:
                processed_responses[key] = value

        for question in survey.questions:
            seq = question.sequence_number
            # Accept response under string or integer key
            answer = processed_responses.get(seq) or processed_responses.get(str(seq))
            if answer is not None:
                if isinstance(answer, list):
                    import json
                    answer_text = json.dumps(answer)
                else:
                    answer_text = str(answer)
                response = Response(
                    submission_id=submission.id,
                    question_id=question.id,
                    response_text=answer_text,
                    response_time=response_times.get(str(seq))
                )
                db.session.add(response)
                print(f"Added response for question {question.id}, seq {seq}")  # Debug logging
        
        try:
            db.session.commit()
            print(f"Successfully committed submission {submission.id}")  # Debug logging
            return {"message": "Responses submitted successfully", "submission_id": submission.id}, 201
        except Exception as e:
            db.session.rollback()
            print(f"Error committing submission: {str(e)}")  # Debug logging
            return {"error": str(e)}, 500

    @staticmethod
    def get_merged_responses(survey_id):
        from app.models import SurveyLink
        approved_links = SurveyLink.query.filter_by(survey_id=survey_id, is_approved=True).all()
        approved_link_ids = [link.id for link in approved_links]
        submissions = Submission.query.filter(Submission.survey_id == survey_id,
                                              Submission.survey_link_id.in_(approved_link_ids)).all()
        merged = []
        for sub in submissions:
            responses_list = []
            for r in sub.responses:
                question = r.question
                responses_list.append({
                    "question_id": r.question_id,
                    "question_text": question.question_text if question else "",
                    "response_text": r.response_text,
                    "created_at": r.created_at.isoformat()
                })
            merged.append({
                "submission_id": sub.id,
                "submitted_at": sub.submitted_at.isoformat(),
                "duration": sub.duration,
                "survey_link_id": sub.survey_link_id,
                "responses": responses_list
            })
        return merged, 200