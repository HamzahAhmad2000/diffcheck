
from flask import Blueprint, request, jsonify, current_app
import os
from werkzeug.utils import secure_filename
import uuid
from app.models import Question, db # Added db potentially for checks later
import datetime
import traceback

upload_bp = Blueprint('upload', __name__) # Changed name to match __init__

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
# This is defined in Question model now, retrieve from there
# ALLOWED_DOCUMENT_EXTENSIONS = { ... }

def allowed_image_file(filename):
    """Check if the file extension is allowed for images"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

# Route changed to match registration in __init__
@upload_bp.route('/image', methods=['POST'])
def upload_image():
    current_app.logger.info(f"--- Received request for /upload/image ---") # Log request start

    if 'file' not in request.files:
        current_app.logger.warning("Upload request missing 'file' part.")
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        current_app.logger.warning("Upload request received with empty filename.")
        return jsonify({'error': 'No selected file'}), 400

    current_app.logger.info(f"Processing file: {file.filename}")

    if file and allowed_image_file(file.filename):
        try: # Wrap the main logic in a try block for better error catching
            original_filename = secure_filename(file.filename)
            if not original_filename: # Added check in case secure_filename returns empty
                 current_app.logger.warning(f"secure_filename returned empty for: {file.filename}")
                 return jsonify({'error': 'Invalid filename after sanitization'}), 400

            extension = original_filename.rsplit('.', 1)[1].lower()
            # Use timestamp and uuid for uniqueness
            unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{extension}"

            upload_folder_base = current_app.config.get('UPLOAD_FOLDER')
            if not upload_folder_base:
                 current_app.logger.error("'UPLOAD_FOLDER' not configured in Flask app.")
                 return jsonify({'error': 'Server configuration error: Upload folder not set'}), 500

            # Construct the target directory path
            images_dir = os.path.join(upload_folder_base, 'images')
            current_app.logger.info(f"Target images directory: {images_dir}")

            # Ensure the directory exists (handled in run.py, but check again for safety)
            if not os.path.isdir(images_dir):
                current_app.logger.warning(f"Images directory did not exist: {images_dir}. Attempting creation.")
                try:
                    os.makedirs(images_dir, exist_ok=True)
                    current_app.logger.info(f"Successfully created directory: {images_dir}")
                except Exception as mkdir_e:
                    current_app.logger.error(f"Failed to create images directory {images_dir}: {mkdir_e}")
                    return jsonify({'error': 'Server error: Cannot create upload directory'}), 500

            # Check for write permissions (optional but good for debugging)
            if not os.access(images_dir, os.W_OK):
                 current_app.logger.error(f"Write permission denied for directory: {images_dir}")
                 # NOTE: This check might be unreliable in some environments (e.g., containers)
                 # Don't necessarily return an error here unless confirmed it's the issue.
                 # Consider logging a warning instead.
                 # return jsonify({'error': 'Server error: Permission denied for upload directory'}), 500

            # Construct the full file path
            file_path = os.path.join(images_dir, unique_filename)
            current_app.logger.info(f"Attempting to save file to: {file_path}")

            # --- The Core Operation ---
            file.save(file_path)
            # ------------------------

            current_app.logger.info(f"File successfully saved to: {file_path}")

            # Construct the URL path for the client
            # Use os.path.join for robustness and then replace backslashes for URL compatibility
            relative_path = os.path.join('/uploads', 'images', unique_filename).replace('\\', '/')
            current_app.logger.info(f"Returning image URL: {relative_path}")

            return jsonify({
                'message': 'Image uploaded successfully',
                'filename': original_filename,
                'image_url': relative_path # This URL should now work
            }), 200

        except Exception as e:
            # Log the full traceback for detailed debugging
            detailed_error = traceback.format_exc()
            current_app.logger.error(f"!!! Internal Server Error during image upload !!!")
            current_app.logger.error(f"Filename: {file.filename if file else 'N/A'}")
            current_app.logger.error(f"Exception type: {type(e).__name__}")
            current_app.logger.error(f"Exception message: {e}")
            current_app.logger.error(f"Traceback:\n{detailed_error}")
            # Return a more informative error message if possible
            return jsonify({'error': f'Internal server error during file upload. Please check server logs.'}), 500
    else:
        allowed_types_str = ", ".join(ALLOWED_IMAGE_EXTENSIONS)
        current_app.logger.warning(f"Upload attempt with disallowed file type: {file.filename}. Allowed: {allowed_types_str}")
        return jsonify({'error': f'File type not allowed. Allowed: {allowed_types_str}'}), 400


# Route changed to match registration in __init__
@upload_bp.route('/document', methods=['POST'])
# @token_required # Add if authentication is needed
def upload_document():
    """Upload a document file as a survey response"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Get context: survey_id and question_id are crucial for validation
    # submission_id might be a temporary ID generated by frontend before final submission
    survey_id = request.form.get('survey_id')
    question_id = request.form.get('question_id')
    # temp_submission_id = request.form.get('submission_id') # Or however frontend tracks ongoing submission

    if not survey_id or not question_id:
        # Allow upload without survey/question context for general purpose?
        # For response uploads, context is essential.
        return jsonify({'error': 'Survey ID and Question ID are required for document response upload'}), 400

    try:
        survey_id = int(survey_id)
        question_id = int(question_id)
    except ValueError:
        return jsonify({'error': 'Invalid Survey ID or Question ID'}), 400

    question = Question.query.get(question_id)
    if not question or question.survey_id != survey_id:
        return jsonify({'error': 'Question not found or does not belong to the specified survey'}), 404
    if question.question_type != 'document-upload':
         return jsonify({'error': 'This question is not configured for document uploads'}), 400

    # --- Validation ---
    # 1. File Type
    allowed_ext_str = question.allowed_types or 'pdf,doc,docx,xls,xlsx,txt,csv,jpg,jpeg,png,ppt,pptx' # Fallback default
    allowed_extensions = {ext.strip().lower() for ext in allowed_ext_str.split(',')}
    file_ext = ''
    if '.' in file.filename:
        file_ext = file.filename.rsplit('.', 1)[1].lower()
    if not file_ext or file_ext not in allowed_extensions:
        return jsonify({'error': f'File type not allowed. Allowed: {allowed_ext_str}'}), 400

    # 2. File Size (convert MB to bytes)
    max_size_mb = question.max_file_size if question.max_file_size is not None else 5 # Default 5MB
    max_size_bytes = max_size_mb * 1024 * 1024
    try:
        # Efficiently get file size without loading into memory
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0) # Reset pointer
    except Exception as e:
         current_app.logger.error(f"Could not determine file size: {e}")
         return jsonify({'error': 'Could not determine file size'}), 500

    if file_size > max_size_bytes:
         return jsonify({'error': f'File exceeds maximum size of {max_size_mb}MB'}), 400

    # 3. Max Files Validation:
    # This is tricky here. This endpoint uploads *one* file.
    # The check against `question.max_files` should ideally happen *before* uploading the N+1th file.
    # This usually requires frontend logic or checking existing responses for the same submission context.
    # We'll add a comment here.
    # TODO: Implement max_files check during the SUBMISSION process, not just upload.
    #       The frontend should prevent uploading more than max_files allowed by the question.

    # --- End Validation ---

    original_filename = secure_filename(file.filename)
    # Use timestamp and uuid for uniqueness
    unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{file_ext}"

    # Organized save path: uploads/documents/<survey_id>/<question_id>/<unique_filename>
    # Using question_id helps organize uploads per question. Submission ID might be better if available consistently.
    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'documents', str(survey_id), str(question_id))
    os.makedirs(upload_dir, exist_ok=True) # Ensure directory exists

    file_path = os.path.join(upload_dir, unique_filename)

    try:
        file.save(file_path)

        # Return relative path for frontend to store in response data
        # This path will be saved in the Response model's file_path field during submission
        relative_path = os.path.join('/uploads', 'documents', str(survey_id), str(question_id), unique_filename).replace('\\', '/')

        return jsonify({
            'message': 'File uploaded successfully',
            'filename': original_filename,
            'filePath': relative_path, # This path should be sent back during survey submission
            'fileType': file.content_type or f'.{file_ext}', # Get mime type or use extension
            'fileSize': file_size, # Size in bytes
            'uploadTime': datetime.datetime.now().isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error(f"Failed to save document {unique_filename}: {e}", exc_info=True)
        # Clean up partially saved file? Might be complex.
        return jsonify({'error': f'Failed to save file: {str(e)}'}), 500