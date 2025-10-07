# app/routes/pdf_reporting_routes.py
from flask import Blueprint, request, jsonify, send_file, current_app
from app.controllers.report_tab_controller import ReportTabController
# Remove flask_login import
# from flask_login import login_required

# Define the blueprint with URL prefix
pdf_reporting_bp = Blueprint('pdf_reporting', __name__, url_prefix='/pdf-reporting')

# --- Define Routes (Removed @login_required) ---

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/base-data', methods=['GET'])
# @login_required # Removed
def get_base_data_route(survey_id):
    """Get survey structure and available filter options."""
    result, status = ReportTabController.get_base_data(survey_id)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/report-data', methods=['POST'])
# @login_required # Removed
def get_report_data_route(survey_id):
    """Get filtered/compared analytics data for the report."""
    data = request.get_json() or {}
    filters = data.get('filters')
    comparison = data.get('comparison')
    result, status = ReportTabController.get_report_data(survey_id, filters, comparison)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/filtered-count', methods=['POST'])
# @login_required # Removed
def get_filtered_count_route(survey_id):
    """Get the count of submissions matching filters."""
    data = request.get_json() or {}
    filters = data.get('filters')
    result, status = ReportTabController.get_filtered_count(survey_id, filters)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/segment-counts', methods=['POST'])
# @login_required # Removed
def get_segment_counts_route(survey_id):
    """Get counts per segment for a comparison dimension."""
    data = request.get_json() or {}
    dimension = data.get('dimension')
    base_filters = data.get('base_filters')
    if not dimension:
        return jsonify({"error": "Missing 'dimension' in request body"}), 400
    result, status = ReportTabController.get_segment_counts(survey_id, dimension, base_filters)
    return jsonify(result), status

# --- Settings Routes (Default View - No Auth) ---

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/settings', methods=['GET'])
# @login_required # Removed
def get_settings_route(survey_id):
    """Get default report settings (using placeholder user)."""
    result, status = ReportTabController.get_report_settings(survey_id)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/settings', methods=['POST'])
# @login_required # Removed
def save_settings_route(survey_id):
    """Save default report settings (using placeholder user)."""
    data = request.get_json() or {}
    settings = data.get('settings')
    if not settings:
        return jsonify({"error": "Missing 'settings' in request body"}), 400
    result, status = ReportTabController.save_report_settings(survey_id, settings)
    return jsonify(result), status

# --- Saved Views Routes (No Auth) ---

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/views', methods=['GET'])
# @login_required # Removed
def list_views_route(survey_id):
    """List named saved views (using placeholder user)."""
    result, status = ReportTabController.list_saved_views(survey_id)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/views', methods=['POST'])
# @login_required # Removed
def save_view_route(survey_id):
    """Save a new named view (using placeholder user)."""
    data = request.get_json() or {}
    name = data.get('name')
    settings_snapshot = data.get('settingsSnapshot')
    if not name or not settings_snapshot:
        return jsonify({"error": "Missing 'name' or 'settingsSnapshot' in request body"}), 400
    result, status = ReportTabController.save_named_view(survey_id, name, settings_snapshot)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/views/<path:view_identifier>', methods=['GET'])
# @login_required # Removed
def load_view_route(survey_id, view_identifier):
    """Load settings for a specific named view by ID or name (using placeholder user)."""
    result, status = ReportTabController.load_named_view(survey_id, view_identifier)
    return jsonify(result), status

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/views/<path:view_identifier>', methods=['DELETE'])
# @login_required # Removed
def delete_view_route(survey_id, view_identifier):
    """Delete a specific named view by ID or name (using placeholder user)."""
    result, status = ReportTabController.delete_named_view(survey_id, view_identifier)
    return jsonify(result), status

# --- Export Route (No Auth) ---

@pdf_reporting_bp.route('/surveys/<int:survey_id>/report/export-excel', methods=['POST'])
# @login_required # Removed
def export_excel_route(survey_id):
    """Export filtered raw data to Excel."""
    data = request.get_json() or {}
    filters = data.get('filters')
    try:
        file_stream, mimetype, filename = ReportTabController.export_excel_report(survey_id, filters)
        return send_file(
            file_stream,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        current_app.logger.error(f"Excel export route failed for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate Excel export", "details": str(e)}), 500