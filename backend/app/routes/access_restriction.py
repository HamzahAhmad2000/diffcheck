from flask import Blueprint, request, jsonify
from app.controllers.access_restriction_controller import AccessRestrictionController

access_bp = Blueprint('access_restriction', __name__, url_prefix='/api/surveys')

@access_bp.route('/<int:survey_id>/verify-email', methods=['POST'])
def verify_email(survey_id):
    payload = request.json
    # Expected payload: { "link_code": "XXXXXX", "email": "user@example.com" }
    link_code = payload.get('link_code')
    email = payload.get('email')
    if not link_code or not email:
        return jsonify({"error": "link_code and email are required"}), 400
    data, status = AccessRestrictionController.verify_email(request.view_args['survey_id'], link_code, email)
    return jsonify(data), status
