# live_responses_bp.py
from flask import Blueprint, request, jsonify, send_file, current_app # Added current_app
from app.controllers.live_responses_controller import LiveResponsesController
from flask_cors import cross_origin
from app.routes.auth import token_required
import io

live_responses_bp = Blueprint('live_responses', __name__)

@live_responses_bp.route('/<int:survey_id>/live-responses', methods=['GET','OPTIONS'])
@cross_origin(origins='*',
              methods=['GET','OPTIONS'],
              allow_headers=['Content-Type','Authorization','ngrok-skip-browser-warning'])
@token_required
def get_live_responses(survey_id):
    """
    Get live responses for a survey with optional filtering.
    Returns JSON response with filtered submissions and pagination metadata.
    """
    try:
        # Extract all query parameters
        filters = {
            "age_min": request.args.get('age_min', ''),
            "age_max": request.args.get('age_max', ''),
            "email_domain": request.args.get('email_domain', ''),
            "submitted_after": request.args.get('submitted_after', ''),
            "submitted_before": request.args.get('submitted_before', ''),
            "gender": request.args.get('gender', ''),
            "location": request.args.get('location', ''),
            "education": request.args.get('education', ''),
            "company": request.args.get('company', ''),
            "device_type": request.args.get('device_type', ''),
            "link_id": request.args.get('link_id', ''),
            "page": request.args.get('page', 1, type=int), # Ensure type conversion
            "per_page": request.args.get('per_page', 20, type=int) # Ensure type conversion
        }

        # Remove empty filters before passing to controller
        filters = {k: v for k, v in filters.items() if v != '' and v is not None}

        # Call controller method to handle request
        data, status = LiveResponsesController.get_live_responses(survey_id, filters)
        return jsonify(data), status
    except Exception as e:
        current_app.logger.error(f"Error in /live-responses route for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred."}), 500


@live_responses_bp.route('/<int:survey_id>/response-count', methods=['GET'])
@cross_origin()
@token_required
def get_response_count(survey_id):
    """
    Get response count over time for a survey (Not Implemented Yet).
    """
    try:
        interval = request.args.get('interval', 'day')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        link_id = request.args.get('link_id', '')

        filters = {
            "interval": interval,
            "start_date": start_date,
            "end_date": end_date,
            "link_id": link_id
        }
        filters = {k: v for k, v in filters.items() if v != '' and v is not None}

        # Call controller method
        data, status = LiveResponsesController.get_response_count(survey_id, filters)
        return jsonify(data), status
    except Exception as e:
        current_app.logger.error(f"Error in /response-count route for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred."}), 500


@live_responses_bp.route('/<int:survey_id>/export-responses', methods=['GET'])
@cross_origin()
@token_required
def export_responses(survey_id):
    """
    Export responses to CSV or Excel format.
    Returns File download response or JSON error.
    """
    try:
        export_format = request.args.get('format', 'csv').lower()
        if export_format not in ['csv', 'xlsx']:
             return jsonify({"error": "Invalid format specified. Use 'csv' or 'xlsx'."}), 400

        # Extract all other filters (excluding pagination params for export)
        filters = {k: v for k, v in request.args.items() if k not in ['format', 'page', 'per_page']}
        filters = {k: v for k, v in filters.items() if v != '' and v is not None} # Clean empty filters

        # Call controller method to handle request
        result = LiveResponsesController.export_responses(survey_id, export_format, filters)

        # Check if the controller returned an error dictionary and status code
        if isinstance(result, tuple) and len(result) == 2 and isinstance(result[0], dict):
            error_data, status_code = result
            return jsonify(error_data), status_code

        # Check if the controller returned the file stream, mimetype, and filename
        elif isinstance(result, tuple) and len(result) == 3:
            file_stream, mimetype, filename = result

            # Ensure the stream is BytesIO for send_file
            if isinstance(file_stream, io.StringIO):
                # Encode StringIO to BytesIO
                output_bytes = io.BytesIO(file_stream.getvalue().encode('utf-8'))
                file_stream.close() # Close the original StringIO
                file_stream_to_send = output_bytes
            elif isinstance(file_stream, io.BytesIO):
                file_stream_to_send = file_stream
            else:
                 current_app.logger.error(f"Export for survey {survey_id} returned unexpected stream type: {type(file_stream)}")
                 return jsonify({"error": "Internal server error generating file stream."}), 500

            # Ensure stream position is at the beginning
            file_stream_to_send.seek(0)

            return send_file(
                file_stream_to_send,
                mimetype=mimetype,
                as_attachment=True,
                download_name=filename # Use attachment_filename for Flask < 2.0
            )
        else:
            # Handle unexpected return format from controller
            current_app.logger.error(f"Export for survey {survey_id} returned unexpected result format: {type(result)}")
            return jsonify({"error": "Internal server error processing export."}), 500

    except Exception as e:
        current_app.logger.error(f"Error in /export-responses route for survey {survey_id}: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during export."}), 500