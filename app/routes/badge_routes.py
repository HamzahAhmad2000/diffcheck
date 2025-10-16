"""
Badge Routes
Handles badge management API endpoints for admins and public viewing.
"""

from flask import Blueprint, request, jsonify, current_app
from ..controllers.auth_controller import token_required, admin_required
from ..controllers.admin_badge_controller import (
    get_all_badges_admin, get_badge_by_id_admin, create_badge_admin,
    update_badge_admin, delete_badge_admin
)
from ..models import Badge

# Public-facing badge routes
badge_bp = Blueprint('badge', __name__, url_prefix='/badges')

# Admin-only badge routes
admin_badge_bp = Blueprint('admin_badge', __name__, url_prefix='/api/admin/badges')


@badge_bp.route('/available', methods=['GET'])
def get_available_badges():
    """Get all available badge definitions for public display."""
    try:
        badges = Badge.query.order_by(Badge.xp_threshold.asc()).all()
        return jsonify([badge.to_dict() for badge in badges]), 200
    except Exception as e:
        current_app.logger.error(f"[ROUTE_GET_AVAILABLE_BADGES] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_badge_bp.route('', methods=['GET'])
@token_required
@admin_required
def admin_get_all_badges():
    """Get all badges for the admin panel."""
    try:
        result = get_all_badges_admin()
        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 500
        return jsonify({'badges': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_badge_bp.route('/<int:badge_id>', methods=['GET'])
@token_required
@admin_required
def admin_get_badge_by_id(badge_id):
    """Get a single badge by ID for editing."""
    try:
        result = get_badge_by_id_admin(badge_id)
        if 'error' in result and result['error'] == 'Badge not found':
            return jsonify(result), 404
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_badge_bp.route('', methods=['POST'])
@token_required
@admin_required
def admin_create_badge():
    """Create a new badge."""
    try:
        data = request.form.to_dict()
        result = create_badge_admin(data)
        
        if 'error' in result:
            status_code = 400
            if "already exists" in result['error']:
                status_code = 409
            return jsonify(result), status_code
            
        return jsonify(result), 201
    except Exception as e:
        current_app.logger.error(f"[ROUTE_ADMIN_CREATE_BADGE] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_badge_bp.route('/<int:badge_id>', methods=['PUT'])
@token_required
@admin_required
def admin_update_badge(badge_id):
    """Update an existing badge."""
    try:
        data = request.form.to_dict()
        result = update_badge_admin(badge_id, data)
        
        if 'error' in result:
            status_code = 500
            if result.get('error') == 'Badge not found':
                status_code = 404
            elif "already exists" in result.get('error', ''):
                status_code = 409
            elif "Image upload failed" in result.get('error', '') or "Image cannot be removed" in result.get('error', ''):
                status_code = 400
            return jsonify(result), status_code

        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f"[ROUTE_ADMIN_UPDATE_BADGE] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_badge_bp.route('/<int:badge_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_badge(badge_id):
    """Delete a badge."""
    try:
        result = delete_badge_admin(badge_id)
        if 'error' in result:
            status_code = 400
            if result.get('error') == 'Badge not found':
                status_code = 404
            return jsonify(result), status_code
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500 