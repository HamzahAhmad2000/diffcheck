# app/routes/ai_usage_analytics_routes.py

from flask import Blueprint, request, jsonify
from app.controllers.ai_usage_analytics_controller import AIUsageAnalyticsController
from app.controllers.auth_controller import token_required, admin_required

ai_usage_analytics_bp = Blueprint('ai_usage_analytics_bp', __name__)

@ai_usage_analytics_bp.route("/dashboard_stats", methods=["GET"])
@token_required
@admin_required
def get_ai_usage_dashboard_stats():
    """Get comprehensive AI usage statistics for super admin dashboard"""
    result, status = AIUsageAnalyticsController.get_ai_usage_dashboard_stats()
    return jsonify(result), status

@ai_usage_analytics_bp.route("/detailed_logs", methods=["GET"])
@token_required
@admin_required
def get_ai_usage_detailed_logs():
    """Get detailed AI usage logs with filtering and pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    # Build filters from query parameters
    filters = {}
    if request.args.get('operation_type'):
        filters['operation_type'] = request.args.get('operation_type')
    if request.args.get('business_id'):
        filters['business_id'] = request.args.get('business_id', type=int)
    if request.args.get('success') is not None:
        filters['success'] = request.args.get('success').lower() == 'true'
    if request.args.get('date_from'):
        from datetime import datetime
        filters['date_from'] = datetime.fromisoformat(request.args.get('date_from'))
    if request.args.get('date_to'):
        from datetime import datetime
        filters['date_to'] = datetime.fromisoformat(request.args.get('date_to'))
    
    result, status = AIUsageAnalyticsController.get_ai_usage_detailed_logs(
        page=page, per_page=per_page, filters=filters
    )
    return jsonify(result), status

@ai_usage_analytics_bp.route("/charts_data", methods=["GET"])
@token_required
@admin_required
def get_ai_usage_charts_data():
    """Get data for AI usage analytics charts"""
    result, status = AIUsageAnalyticsController.get_ai_usage_charts_data()
    return jsonify(result), status

@ai_usage_analytics_bp.route("/business_summary", methods=["GET"])
@token_required
@admin_required
def get_business_ai_usage_summary():
    """Get AI usage summary by business for super admin"""
    result, status = AIUsageAnalyticsController.get_business_ai_usage_summary()
    return jsonify(result), status

@ai_usage_analytics_bp.route("/mark_survey_saved", methods=["POST"])
@token_required
def mark_survey_saved():
    """Mark an AI-generated survey as saved"""
    data = request.get_json() or {}
    survey_id = data.get('survey_id')
    
    if not survey_id:
        return jsonify({"error": "survey_id is required"}), 400
    
    try:
        AIUsageAnalyticsController.mark_survey_as_saved(survey_id)
        return jsonify({"message": "Survey marked as saved"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ai_usage_analytics_bp.route("/openai_cost_breakdown", methods=["GET"])
@token_required
def get_openai_cost_breakdown():
    """Get detailed OpenAI cost breakdown and pricing information"""
    try:
        result, status_code = AIUsageAnalyticsController.get_openai_cost_breakdown()
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

