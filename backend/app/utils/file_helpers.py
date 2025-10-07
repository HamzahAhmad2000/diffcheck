import os
from flask import current_app
from werkzeug.utils import secure_filename
import uuid

def save_uploaded_file(file, subfolder='general'):
    """
    Saves an uploaded file to the configured UPLOAD_FOLDER within a specified subfolder.
    Returns a web-accessible path to the file.
    """
    if not file or file.filename == '':
        raise ValueError("No file selected or file has no name.")

    filename = secure_filename(file.filename)
    # Add a unique prefix to avoid overwriting files with the same name
    unique_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
    
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads') # Default to 'uploads' if not set
    
    # Ensure base upload directory exists
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)
        
    target_folder = os.path.join(upload_folder, subfolder)
    if not os.path.exists(target_folder):
        os.makedirs(target_folder, exist_ok=True)
        
    file_path = os.path.join(target_folder, unique_filename)
    
    try:
        file.save(file_path)
        current_app.logger.info(f"File saved to: {file_path}")
        # Return a web-accessible path, assuming UPLOAD_FOLDER is served at /uploads
        # Adjust this if your static file serving is different
        web_path = f"/uploads/{subfolder}/{unique_filename}" 
        return web_path
    except Exception as e:
        current_app.logger.error(f"Failed to save file {unique_filename} to {target_folder}: {e}", exc_info=True)
        raise IOError(f"Could not save file: {str(e)}")

def remove_file(file_web_path):
    """
    Removes a file given its web-accessible path.
    Assumes the web path starts with /uploads/ which maps to the UPLOAD_FOLDER.
    """
    if not file_web_path or not file_web_path.startswith('/uploads/'):
        current_app.logger.warning(f"Cannot remove file with invalid path: {file_web_path}")
        return False

    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    # Convert web path to system path
    # Example: /uploads/marketplace_images/file.jpg -> uploads/marketplace_images/file.jpg
    relative_system_path = file_web_path[len('/uploads/'):] 
    system_file_path = os.path.join(upload_folder, relative_system_path)
    
    try:
        if os.path.exists(system_file_path):
            os.remove(system_file_path)
            current_app.logger.info(f"File removed: {system_file_path}")
            return True
        else:
            current_app.logger.warning(f"File not found for removal: {system_file_path} (from web path: {file_web_path})")
            return False
    except Exception as e:
        current_app.logger.error(f"Error removing file {system_file_path}: {e}", exc_info=True)
        return False 