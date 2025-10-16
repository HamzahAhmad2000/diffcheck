from flask import Blueprint, request, jsonify
from app.controllers.comparison_controller import ComparisonController

comparison_bp = Blueprint('comparison', __name__, url_prefix='/api/surveys')

@comparison_bp.route('/<int:survey_id>/comparisons', methods=['GET'])
def get_comparisons(survey_id):
    group_by = request.args.get('group_by')
    if not group_by:
        return jsonify({"error": "group_by parameter is required"}), 400
    data, status = ComparisonController.get_comparison(
        survey_id=request.view_args['survey_id'],
        group_by=group_by
    )
    return jsonify(data), status
