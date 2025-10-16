import datetime
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from app.controllers.survey_distribution_controller import SurveyDistributionController

distribution_bp = Blueprint('distribution', __name__, url_prefix='/api/surveys')

@distribution_bp.route('/<int:survey_id>/links', methods=['GET'])
@cross_origin()
def list_links(survey_id):
    data, status = SurveyDistributionController.list_links(survey_id)
    return jsonify(data), status

@distribution_bp.route('/<int:survey_id>/links', methods=['POST'])
@cross_origin()
def create_link(survey_id):
    data = request.json
    data, status = SurveyDistributionController.create_link(survey_id, data)
    return jsonify(data), status

@distribution_bp.route('/<int:survey_id>/links/<int:link_id>', methods=['PUT'])
@cross_origin()
def update_link(survey_id, link_id):
    data = request.json
    data, status = SurveyDistributionController.update_link(survey_id, link_id, data)
    return jsonify(data), status

@distribution_bp.route('/<int:survey_id>/links/<int:link_id>/qrcode', methods=['GET'])
@cross_origin()
def get_qr(survey_id, link_id):
    return SurveyDistributionController.generate_qr(survey_id, link_id)
