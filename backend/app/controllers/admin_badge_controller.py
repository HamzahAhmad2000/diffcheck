"""
Badge Administration Controller
Handles admin-level CRUD operations for badges.
"""

from flask import request, current_app
from ..models import db, Badge
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

def get_all_badges_admin():
    """
    Get all badges for the admin management view.
    
    Returns:
        list: List of all badge dictionaries.
    """
    try:
        badges = Badge.query.order_by(Badge.xp_threshold.asc()).all()
        return [badge.to_dict() for badge in badges]
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_BADGES_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def get_badge_by_id_admin(badge_id):
    """
    Get a single badge by its ID.
    
    Args:
        badge_id: ID of the badge.
        
    Returns:
        dict: Badge data or error.
    """
    try:
        badge = Badge.query.get(badge_id)
        if not badge:
            return {'error': 'Badge not found'}
        return {'badge': badge.to_dict()}
    except Exception as e:
        current_app.logger.error(f"[GET_BADGE_BY_ID_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def create_badge_admin(data):
    """
    Create a new badge.
    
    Args:
        data: Dictionary with badge information from form data.
        
    Returns:
        dict: Success/error response with badge data.
    """
    try:
        required_fields = ['name', 'xp_threshold']
        for field in required_fields:
            if field not in data:
                return {'error': f'Missing required field: {field}'}

        image_path = None
        if 'image' in request.files and request.files['image'].filename != '':
            from ..utils.file_helpers import save_uploaded_file
            try:
                # Subfolder for badge images
                image_path = save_uploaded_file(request.files['image'], subfolder='badges')
            except Exception as e:
                current_app.logger.error(f"[CREATE_BADGE_ADMIN] Image upload failed: {e}", exc_info=True)
                return {'error': f"Image upload failed: {str(e)}"}, 400
        elif 'image_url' in data and data['image_url']:
            image_path = data['image_url']

        if not image_path:
            return {'error': 'Image is required. Please upload one or provide a URL.'}, 400

        new_badge = Badge(
            name=data['name'],
            description=data.get('description'),
            image_url=image_path,
            xp_threshold=int(data['xp_threshold'])
        )
        
        db.session.add(new_badge)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Badge created successfully!',
            'badge': new_badge.to_dict()
        }
    except IntegrityError:
        db.session.rollback()
        return {'error': 'A badge with this name or XP threshold already exists.'}, 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[CREATE_BADGE_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def update_badge_admin(badge_id, data):
    """
    Update an existing badge.
    
    Args:
        badge_id: ID of the badge to update.
        data: Dictionary with updated information.
        
    Returns:
        dict: Success/error response with badge data.
    """
    try:
        badge = Badge.query.get(badge_id)
        if not badge:
            return {'error': 'Badge not found'}, 404

        if 'name' in data: badge.name = data['name']
        if 'description' in data: badge.description = data['description']
        if 'xp_threshold' in data: badge.xp_threshold = int(data['xp_threshold'])

        if 'image' in request.files and request.files['image'].filename != '':
            from ..utils.file_helpers import save_uploaded_file, remove_file
            if badge.image_url and not badge.image_url.startswith('http'):
                remove_file(badge.image_url) 
            try:
                badge.image_url = save_uploaded_file(request.files['image'], subfolder='badges')
            except Exception as e:
                current_app.logger.error(f"[UPDATE_BADGE_ADMIN] Image upload failed: {e}")
                return {'error': f"Image upload failed: {str(e)}"}, 400
        elif 'image_url' in data:
            if data['image_url'] == '' and badge.image_url and not badge.image_url.startswith('http'):
                 from ..utils.file_helpers import remove_file
                 remove_file(badge.image_url)
                 badge.image_url = None
            elif data['image_url']:
                badge.image_url = data['image_url']

        if not badge.image_url:
             return {'error': 'Image cannot be removed. Please provide a new one.'}, 400

        db.session.commit()
        
        return {
            'success': True,
            'message': 'Badge updated successfully!',
            'badge': badge.to_dict()
        }
    except IntegrityError:
        db.session.rollback()
        return {'error': 'A badge with this name or XP threshold already exists.'}, 409
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[UPDATE_BADGE_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def delete_badge_admin(badge_id):
    """
    Delete a badge.
    
    Args:
        badge_id: ID of the badge to delete.
        
    Returns:
        dict: Success/error response.
    """
    try:
        badge = Badge.query.get(badge_id)
        if not badge:
            return {'error': 'Badge not found'}, 404
        
        # Note: Consider logic for what happens to users who have this badge.
        # For now, we'll delete the badge. UserBadge entries will have a broken link.
        # A better approach might be to "deactivate" badges instead of deleting.
        
        db.session.delete(badge)
        db.session.commit()
        
        return {'success': True, 'message': 'Badge deleted successfully.'}
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[DELETE_BADGE_ADMIN] Error: {e}", exc_info=True)
        return {'error': 'This badge cannot be deleted, it might be in use.'} 