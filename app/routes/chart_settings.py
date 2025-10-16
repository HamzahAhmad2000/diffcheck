# Add this to app/routes/chart_settings.py

from flask import Blueprint, request, jsonify, g
from app.controllers.chart_settings_controller import ChartSettingsController
from app.routes.auth import token_required, admin_required

chart_settings_bp = Blueprint('chart_settings', __name__)

@chart_settings_bp.route('/surveys/<int:survey_id>/chart-settings', methods=['POST'])
@token_required
def save_chart_settings(survey_id):
    """Save chart settings for a survey"""
    data = request.get_json()
    user_id = g.current_user.id
    
    result, status = ChartSettingsController.save_chart_settings(survey_id, user_id, data)
    return jsonify(result), status

@chart_settings_bp.route('/surveys/<int:survey_id>/chart-settings', methods=['GET'])
@token_required
def get_chart_settings(survey_id):
    """Get chart settings for a survey"""
    user_id = g.current_user.id
    
    result, status = ChartSettingsController.get_chart_settings(survey_id, user_id)
    return jsonify(result), status

@chart_settings_bp.route('/surveys/<int:survey_id>/chart-settings', methods=['DELETE'])
@token_required
def delete_chart_settings(survey_id):
    """Delete chart settings for a survey"""
    user_id = g.current_user.id
    
    result, status = ChartSettingsController.delete_chart_settings(survey_id, user_id)
    return jsonify(result), status

# Add this blueprint to your app initialization in app/__init__.py:
# from app.routes.chart_settings import chart_settings_bp
# app.register_blueprint(chart_settings_bp, url_prefix='/api')