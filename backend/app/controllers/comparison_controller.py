from collections import defaultdict
from app.models import Survey, Response

class ComparisonController:
    @staticmethod
    def get_comparison(survey_id, group_by):
        """
        For each question in the survey, group responses by the specified field from the associated Submission.
        For simplicity, we assume each Submission object has an attribute named as group_by;
        if missing, the value defaults to "Unknown".
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        comparison = {
            "survey_id": survey.id,
            "group_by": group_by,
            "questions": []
        }
        for question in survey.questions:
            q_data = {
                "question_id": question.id,
                "question_text": question.question_text,
                "options": {}  # Will map each answer option to counts per group.
            }
            responses = Response.query.filter_by(question_id=question.id).all()
            for r in responses:
                # Assume the related Submission has the attribute (e.g. gender, department, etc.)
                submission = r.submission
                group_value = getattr(submission, group_by, None)
                if group_value is None:
                    group_value = "Unknown"
                answer = r.response_text
                if answer not in q_data["options"]:
                    q_data["options"][answer] = defaultdict(int)
                q_data["options"][answer][group_value] += 1
            # Convert inner defaultdicts to dicts.
            for ans in q_data["options"]:
                q_data["options"][ans] = dict(q_data["options"][ans])
            comparison["questions"].append(q_data)
        return comparison, 200
