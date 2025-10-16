from flask import Blueprint, request, jsonify, send_file, current_app
from flask import g
from io import BytesIO
import openpyxl # pip install openpyxl

from app.controllers.response_controller import ResponseController
from app.controllers.auth_controller import token_required

response_bp = Blueprint('response', __name__)

# ----- Basic Routes -----

# Submit survey responses
@response_bp.route('/responses', methods=['POST'])
@token_required
def submit_responses():
    """Submit survey responses (authenticated user only)"""
    # Pull the JSON body
    data = request.get_json() or {}

    # Log the incoming request for debugging
    current_app.logger.info(f"[RESPONSE_ROUTE] Received submission request from user {g.current_user.id if hasattr(g, 'current_user') else 'UNKNOWN'}")
    current_app.logger.info(f"[RESPONSE_ROUTE] Request data keys: {list(data.keys())}")
    current_app.logger.info(f"[RESPONSE_ROUTE] Survey ID: {data.get('survey_id')}")

    # Inject the authenticated user's ID directly into the payload
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            current_app.logger.error(f"[RESPONSE_ROUTE] g.current_user is missing or None")
            return jsonify({"error": "Authentication error: user session invalid."}), 401
            
        data['user_id'] = g.current_user.id
        current_app.logger.info(f"[RESPONSE_ROUTE] Set user_id to {g.current_user.id} in request data")
    except Exception as e:
        # If something weird happens (e.g. g.current_user is missing), log & return 401
        current_app.logger.error(f"[RESPONSE_ROUTE] g.current_user not set: {e}", exc_info=True)
        return jsonify({"error": "Authentication error: could not resolve user."}), 401

    # Let the controller handle everything else
    result, status = ResponseController.submit_responses(data)
    current_app.logger.info(f"[RESPONSE_ROUTE] submit_responses result: {result}, status: {status}")
    return jsonify(result), status

# Submit survey responses - Alternative route matching frontend expectation
@response_bp.route('/surveys/<int:survey_id>/submit', methods=['POST'])
@token_required
def submit_survey_responses(survey_id):
    """Submit survey responses for a specific survey (authenticated user only)"""
    # Pull the JSON body
    data = request.get_json() or {}
    
    # Add survey_id from URL parameter
    data['survey_id'] = survey_id

    # Log the incoming request for debugging
    current_app.logger.info(f"[SURVEY_SUBMIT_ROUTE] Received submission request for survey {survey_id} from user {g.current_user.id if hasattr(g, 'current_user') else 'UNKNOWN'}")
    current_app.logger.info(f"[SURVEY_SUBMIT_ROUTE] Request data keys: {list(data.keys())}")

    # Inject the authenticated user's ID directly into the payload
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            current_app.logger.error(f"[SURVEY_SUBMIT_ROUTE] g.current_user is missing or None")
            return jsonify({"error": "Authentication error: user session invalid."}), 401
            
        data['user_id'] = g.current_user.id
        current_app.logger.info(f"[SURVEY_SUBMIT_ROUTE] Set user_id to {g.current_user.id} in request data")
    except Exception as e:
        # If something weird happens (e.g. g.current_user is missing), log & return 401
        current_app.logger.error(f"[SURVEY_SUBMIT_ROUTE] g.current_user not set: {e}", exc_info=True)
        return jsonify({"error": "Authentication error: could not resolve user."}), 401

    # Let the controller handle everything else
    result, status = ResponseController.submit_responses(data)
    current_app.logger.info(f"[SURVEY_SUBMIT_ROUTE] submit_responses result: {result}, status: {status}")
    return jsonify(result), status

@response_bp.route('/surveys/<int:survey_id>/generate-responses', methods=['POST'])
@token_required
def generate_random_responses_route(survey_id):
    """Generate a specified number of random responses for a survey (Admin only)."""
    # Role check to ensure only admins can use this feature
    if g.user_role not in ['super_admin', 'business_admin']:
        return jsonify({"error": "Unauthorized to perform this action"}), 403

    data = request.get_json()
    if not data or 'count' not in data:
        return jsonify({"error": "Missing 'count' in request body"}), 400

    try:
        count = int(data['count'])
        if not (1 <= count <= 500):  # Limit generation to 500 at a time to prevent abuse/overload
            return jsonify({"error": "Count must be between 1 and 500"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "'count' must be an integer"}), 400

    result, status = ResponseController.generate_random_responses(survey_id, count)
    return jsonify(result), status

# Get all responses for a survey
@response_bp.route('/surveys/<int:survey_id>/responses', methods=['GET'])
@token_required
def get_survey_responses(survey_id):
    """Get all responses for a survey with pagination and detailed information"""
    try:
        # Get pagination parameters from query string
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)  # Cap at 100 per page
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if per_page < 1:
            per_page = 50
            
        current_app.logger.info(f"[GET_RESPONSES] Fetching responses for survey {survey_id}, page {page}, per_page {per_page}")
        
        result, status = ResponseController.get_all_responses(survey_id, page, per_page)
        
        if status == 200:
            current_app.logger.info(f"[GET_RESPONSES] Successfully retrieved {len(result.get('submissions', []))} responses for survey {survey_id}")
        else:
            current_app.logger.warning(f"[GET_RESPONSES] Failed to retrieve responses for survey {survey_id}: {result}")
            
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_RESPONSES] Exception in route for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve responses", "details": str(e)}), 500

# Get full survey analytics (Uses compute_analytics internally)
@response_bp.route('/surveys/<int:survey_id>/analytics', methods=['GET'])
def get_survey_analytics(survey_id):
    """Get full analytics for a survey"""
    result, status = ResponseController.get_analytics(survey_id)
    return jsonify(result), status

# ----- Unified Analytics Routes -----

# Question analytics unified (handles all question types)
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/analytics-unified', methods=['GET'])
def question_analytics_unified_route(survey_id, question_id):
    """
    Single endpoint for question analytics (all supported types).
    Handles N/A options, ordering, and specific stats.
    """
    result, status_code = ResponseController.get_question_analytics_unified(survey_id, question_id)
    return jsonify(result), status_code

# Multi-demographic analytics
@response_bp.route('/surveys/<int:survey_id>/demographic-analytics', methods=['POST'])
def multi_demographic_analytics_route(survey_id):
    """
    Advanced endpoint for retrieving analytics filtered by multiple demographics including cohort_tag.
    Expects a JSON body like:
      {
        "age_group": ["18-24", "25-34"],
        "location": ["New York", "Los Angeles"],
        "education": "Masters",
        "company": ["ABC Corp", "XYZ Inc."],
        "cohort_tag": "Beta Users"
      }
    """
    filters = request.get_json() or {}
    result, status_code = ResponseController.get_multi_demographic_analytics(survey_id, filters)
    return jsonify(result), status_code

# Merged analytics
@response_bp.route('/surveys/<int:survey_id>/merged-analytics', methods=['POST'])
def merged_analytics_advanced_route(survey_id):
    """
    Expects a JSON body { "link_ids": [1,2,3] }
    Returns analytics with duplicates discarded if a user_id appears multiple times.
    """
    data = request.get_json() or {}
    link_ids = data.get("link_ids", [])
    if not link_ids:
        return jsonify({"error": "link_ids list is required"}), 400
    result, status_code = ResponseController.get_merged_analytics_advanced(survey_id, link_ids)
    return jsonify(result), status_code

# Response time analytics
@response_bp.route('/surveys/<int:survey_id>/response-times-advanced', methods=['POST'])
def get_response_times_advanced(survey_id):
    """
    POST with optional JSON filters. e.g.
      { "filters": { "age_group": ["18-24"], "location": ["USA"], "cohort_tag": "Group A" } }
    Returns advanced response time analytics.
    """
    data = request.get_json() or {}
    filters = data.get('filters', {})
    res, status = ResponseController.get_response_time_analytics_advanced(survey_id, filters)
    return jsonify(res), status # Propagate status code

# Dropout analysis
@response_bp.route('/surveys/<int:survey_id>/dropout-analysis', methods=['POST'])
def dropout_analysis_route(survey_id):
    """
    POST with optional JSON { "filters": {...} } including cohort_tag
    to get advanced dropout distribution stats.
    """
    data = request.get_json() or {}
    filters = data.get('filters', {})
    res, status = ResponseController.get_dropout_analysis(survey_id, filters)
    return jsonify(res), status # Propagate status code

# ADDED: Route for report summary
@response_bp.route('/surveys/<int:survey_id>/report-summary', methods=['GET'])
def get_report_summary_route(survey_id):
    """Get a high-level summary of survey analytics."""
    result, status = ResponseController.get_report_summary(survey_id)
    return jsonify(result), status

# ADDED: Route for searching open-ended responses
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/search-responses', methods=['GET'])
def search_responses_route(survey_id, question_id):
    """Search within open-ended responses for a specific keyword."""
    keyword = request.args.get('keyword')
    if not keyword:
        return jsonify({"error": "Missing 'keyword' query parameter"}), 400
    result, status = ResponseController.search_open_ended_responses(question_id, keyword) # survey_id implicitly checked by question_id fetch
    return jsonify(result), status

# ADDED: Route for Excel export
@response_bp.route('/surveys/<int:survey_id>/export/excel', methods=['GET'])
def export_responses_excel_route(survey_id):
    """Export raw response data in Excel (XLSX) format."""
    try:
        file_stream, filename = ResponseController.export_responses_excel(survey_id)
        if file_stream:
            return send_file(
                file_stream,
                as_attachment=True,
                download_name=filename, # Use attachment_filename for Flask < 2.0
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            # If export_responses_excel returns None, means error occurred (e.g., no data)
             # Controller method should return error dict/status in this case
             # This assumes export_responses_excel returns (None, None) on error
             result, status = ResponseController.get_raw_export_data(survey_id) # Get error msg
             return jsonify(result), status if isinstance(result, dict) else 500

    except Exception as e:
        current_app.logger.error(f"Excel export failed for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate Excel export", "details": str(e)}), 500

# ----- Legacy / Existing Routes (Review for consistency) -----

# Question-specific analytics (legacy - Suggest DEPRECATION in favor of unified)
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/analytics', methods=['GET'])
def question_analytics(survey_id, question_id):
    """Get detailed analytics for a specific question (Legacy - prefer /analytics-unified)"""
    # Redirect or call the unified endpoint? For now, keep separate if needed.
    # result, status = ResponseController.get_question_analytics(survey_id, question_id)
    # Calling unified for now:
    result, status = ResponseController.get_question_analytics_unified(survey_id, question_id)
    return jsonify(result), status

# Link-specific analytics
@response_bp.route('/responses/analytics/link', methods=['GET'])
def get_link_analytics():
    """Get analytics for a specific distribution link"""
    survey_id = request.args.get('survey_id', type=int)
    link_id = request.args.get('link_id', type=int)
    if not (survey_id and link_id):
        return jsonify({"error": "Missing required parameters survey_id and link_id"}), 400
    result, status = ResponseController.get_analytics_by_link(survey_id, link_id)
    return jsonify(result), status

# Filtered analytics (Legacy - Suggest DEPRECATION in favor of POST filtering)
@response_bp.route('/responses/analytics/filtered', methods=['GET'])
def get_filtered_analytics():
    """Get analytics filtered by a specific question response (Legacy - prefer POST filtering)"""
    survey_id = request.args.get('survey_id', type=int)
    filter_question_seq = request.args.get('filter_question_seq', type=int)
    filter_option = request.args.get('filter_option')
    if not (survey_id and filter_question_seq and filter_option):
        return jsonify({"error": "Missing required parameters survey_id, filter_question_seq, filter_option"}), 400

    # This logic is complex and better handled by POSTing filters
    # For now, return an error or placeholder indicating deprecation
    return jsonify({"error": "GET filtering is deprecated. Use POST /surveys/<id>/demographic-analytics or /filtered-analytics"}), 405
    # result, status = ResponseController.get_filtered_analytics(survey_id, filter_question_seq, filter_option) # Original call
    # return jsonify(result), status

# Live responses - REMOVED: Now handled by live_responses_bp 
# This route was causing conflicts with the proper live responses implementation

# Export responses (CSV - Legacy / Alternative)
@response_bp.route('/surveys/<int:survey_id>/export', methods=['GET'])
def export_responses(survey_id):
    """Export raw response data in CSV format (Use /export/excel for XLSX)"""
    # This currently calls a method that just returns data, not a file.
    # Needs implementation similar to Excel export but using CSV module.
    # For now, just returns the data structure.
    export_format = request.args.get('format', 'csv')
    if export_format.lower() != 'csv':
         return jsonify({"error": "Only CSV format supported via this legacy endpoint. Use /export/excel for XLSX."}), 400

    # Placeholder for actual CSV file generation
    result, status = ResponseController.get_raw_export_data(survey_id)
    if status == 200:
        # TODO: Implement CSV file generation and return with send_file
        return jsonify({"message": "CSV export not fully implemented yet. Returning raw data.", "data": result}), 200
    else:
        return jsonify(result), status

# List uploaded files for a survey/question
@response_bp.route('/surveys/<int:survey_id>/files', methods=['GET'])
def list_uploaded_files_route(survey_id):
    question_id = request.args.get('question_id', type=int)
    data, status = ResponseController.list_uploaded_files(survey_id, question_id)
    return jsonify(data), status

# Download an uploaded file by response ID
@response_bp.route('/responses/<int:response_id>/file', methods=['GET'])
def download_uploaded_file_route(response_id):
    result = ResponseController.get_uploaded_file(response_id)
    if isinstance(result, tuple) and len(result) == 3:
        file_path, mimetype, filename = result
        return send_file(file_path, mimetype=mimetype, as_attachment=True, download_name=filename)
    elif isinstance(result, tuple) and len(result) == 2 and isinstance(result[0], dict):
        data, status = result
        return jsonify(data), status
    else:
        return jsonify({"error": "Unexpected response"}), 500


# Legacy merged analytics (no duplicate filtering)
@response_bp.route('/responses/analytics/merged', methods=['GET'])
def get_merged_analytics():
    """Get merged analytics for selected links (Legacy, no deduplication - prefer POST /merged-analytics)"""
    survey_id = request.args.get('survey_id', type=int)
    merge_ids = request.args.get('merge_ids', '')
    try:
        merge_ids_list = [int(id) for id in merge_ids.split(',') if id.strip().isdigit()]
    except ValueError:
         return jsonify({"error": "Invalid merge_ids format"}), 400

    if not survey_id or not merge_ids_list:
        return jsonify({"error": "Missing required parameters survey_id and merge_ids"}), 400

    # Indicate deprecation or call the old controller method if it exists
    # ResponseController.get_custom_merged_analytics(survey_id, merge_ids_list)
    return jsonify({"error": "GET merging is deprecated. Use POST /surveys/<id>/merged-analytics"}), 405


# Open-ended responses with user info
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/openended-with-users', methods=['GET'])
def openended_responses_with_users(survey_id, question_id):
    """Get open-ended responses with user information"""
    limit = request.args.get('limit', 10, type=int)
    result, status = ResponseController.get_open_ended_responses_with_users(survey_id, question_id, limit)
    return jsonify(result), status

# Grid question analysis
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/grid-analysis', methods=['GET'])
def grid_question_analysis(survey_id, question_id):
    """Get detailed analysis for grid questions"""
    result, status = ResponseController.get_grid_question_analysis(survey_id, question_id)
    return jsonify(result), status

# Recent open-ended responses
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/recent-responses', methods=['GET'])
def recent_open_ended_responses(survey_id, question_id):
    """Get recent open-ended responses for a question"""
    limit = request.args.get('limit', 10, type=int)
    result, status = ResponseController.get_recent_open_ended_responses(survey_id, question_id, limit)
    return jsonify(result), status

# Chart data (Legacy - Suggest DEPRECATION)
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/chart-data', methods=['GET'])
def chart_data(survey_id, question_id):
    """Get formatted data for client-side charting (Legacy - prefer frontend processing or unified analytics)"""
    # This often becomes complex with filters via GET
    # Consider deprecating in favor of frontend processing unified analytics data
    kwargs = {
        'link_id': request.args.get('link_id', type=int),
        'filter_question_seq': request.args.get('filter_question_seq', type=int),
        'filter_option': request.args.get('filter_option')
    }
    merge_ids = request.args.get('merge_ids', '')
    if merge_ids:
        try:
            kwargs['merge_ids'] = [int(id) for id in merge_ids.split(',') if id.strip().isdigit()]
        except ValueError:
            return jsonify({"error": "Invalid merge_ids format"}), 400

    # Clean None values from kwargs
    kwargs = {k: v for k, v in kwargs.items() if v is not None}

    result, status = ResponseController.get_question_data_for_charts(survey_id, question_id, **kwargs)
    return jsonify(result), status


# Response trends
@response_bp.route('/surveys/<int:survey_id>/response-trends', methods=['GET'])
def get_response_trends(survey_id):
    """Get response submission trends over time"""
    timeframe = request.args.get('timeframe', 'daily') # daily, weekly, monthly, hourly
    result, status = ResponseController.get_response_trends(survey_id, timeframe)
    return jsonify(result), status

# Question completion rate
@response_bp.route('/surveys/<int:survey_id>/question-completion-rate', methods=['GET'])
def get_question_completion_rate(survey_id):
    """Get completion rate for each question in the survey"""
    result, status = ResponseController.get_question_completion_rate(survey_id)
    return jsonify(result), status

# Age group analytics (Legacy - Suggest DEPRECATION)
@response_bp.route('/surveys/<int:survey_id>/age-group-analytics', methods=['GET'])
def get_age_group_analytics(survey_id):
    """Get analytics breakdown by age group (Legacy - prefer POST demographic analytics)"""
    # result, status = ResponseController.get_age_group_analytics(survey_id)
    # Use the more general demographic analytics instead
    result, status = ResponseController.get_multi_demographic_analytics(survey_id, {}) # Call with empty filter
    # Extract just the age group part if needed, or return full demographic breakdown
    if status == 200 and "demographics" in result and "age_groups" in result["demographics"]:
        return jsonify(result["demographics"]["age_groups"]), 200
    else:
         return jsonify({"error": "Could not retrieve age group data"}), status if status != 200 else 500


# Filtered Question Analytics (POST version)
@response_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/filtered-analytics', methods=['POST'])
def filtered_question_analytics(survey_id, question_id):
    """
    Get analytics for a specific question filtered by demographic criteria including cohort_tag.
    Expects a JSON body containing filters, e.g., {"filters": {"age_group": ["18-24"], "cohort_tag": "A"}}
    """
    data = request.get_json() or {}
    filters = data.get('filters', {})
    # Call the controller method that now includes cohort filtering
    result, status = ResponseController.get_filtered_question_analytics(survey_id, question_id, filters)
    return jsonify(result), status
