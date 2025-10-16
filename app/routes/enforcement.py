from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.controllers.enforcement_controller import EnforcementController

enforcement_bp = Blueprint('enforcement', __name__, url_prefix='/api/surveys')

@enforcement_bp.route('/<int:survey_id>/submit', methods=['POST', 'OPTIONS'])
def submit_response_enforced(survey_id):
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return jsonify({"message": "CORS preflight handled"}), 200
        
    # Handle actual POST request
    data = request.json
    # Add survey_id from URL to the data
    if data:
        data['survey_id'] = survey_id
    result, status = EnforcementController.submit_responses_enforced(data)
    return jsonify(result), status

@enforcement_bp.route('/<int:survey_id>/merged-responses', methods=['GET'])
@cross_origin()
def get_merged_responses(survey_id):
    result, status = EnforcementController.get_merged_responses(survey_id)
    return jsonify(result), status