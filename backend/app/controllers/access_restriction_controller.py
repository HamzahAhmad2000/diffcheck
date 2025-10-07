from app.models import Survey, db, SurveyLink
#from ..survey_link import SurveyLink

class AccessRestrictionController:
    @staticmethod
    def verify_email(survey_id, link_code, email):
        # Find the distribution link by code and survey_id.
        link = SurveyLink.query.filter_by(survey_id=survey_id, code=link_code).first()
        if not link:
            return {"error": "Invalid survey link"}, 404
        # Check specific allowed emails first
        if link.allowed_emails:
            if email.lower() not in [e.lower() for e in link.allowed_emails]:
                return {"error": "You are not allowed to access this survey"}, 403
        # Then check allowed domain if provided
        if link.allowed_domain:
            if not email.lower().endswith("@" + link.allowed_domain.lower()):
                return {"error": f"Email must belong to {link.allowed_domain}"}, 403
        # Optionally, additional verification can be added here.
        return {"message": "Email verified"}, 200
