"""
Notification Routes
Handles user notifications and admin notification management
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.notification_controller import (
    get_user_notifications, mark_notification_as_read, mark_all_notifications_as_read,
    dismiss_notification, delete_notification, get_notification_summary,
    send_custom_notification, send_bulk_notification, get_admin_notification_stats,
    get_all_users_for_notification
)
from ..controllers.auth_controller import token_required, admin_required
import logging

# Additional imports for admin endpoints
from ..models import Notification, NotificationStatus, User, db
from sqlalchemy import or_

logger = logging.getLogger(__name__)

notification_bp = Blueprint('notification', __name__)
admin_notification_bp = Blueprint('admin_notification', __name__, url_prefix='/api/admin/notification')

# User notification routes

@notification_bp.route('/notifications', methods=['GET'])
@token_required
def get_notifications():
    """Get notifications for the current user"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        # Get query parameters
        status_filter = request.args.get('status', 'all')  # 'unread', 'read', 'all'
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100
        offset = int(request.args.get('offset', 0))

        result, status_code = get_user_notifications(current_user.id, status_filter, limit, offset)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/notifications/summary', methods=['GET'])
@token_required
def get_notifications_summary():
    """Get notification summary for the current user"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = get_notification_summary(current_user.id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error getting notification summary: {e}")
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@token_required
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = mark_notification_as_read(current_user.id, notification_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/notifications/read-all', methods=['PUT'])
@token_required
def mark_all_notifications_read():
    """Mark all notifications as read for the current user"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = mark_all_notifications_as_read(current_user.id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/notifications/<int:notification_id>/dismiss', methods=['PUT'])
@token_required
def dismiss_notification_route(notification_id):
    """Dismiss a notification"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = dismiss_notification(current_user.id, notification_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error dismissing notification: {e}")
        return jsonify({'error': str(e)}), 500

@notification_bp.route('/notifications/<int:notification_id>', methods=['DELETE'])
@token_required
def delete_notification_route(notification_id):
    """Delete a notification"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = delete_notification(current_user.id, notification_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return jsonify({'error': str(e)}), 500

# Admin notification routes

@admin_notification_bp.route('/send', methods=['POST'])
@token_required
@admin_required
def admin_send_custom_notification():
    """Send a custom notification to a user (Admin only)"""
    try:
        current_admin = g.current_admin
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Missing notification data.'}), 400

        # Accept both target_user_id and user_id for compatibility
        target_user_id = data.get('target_user_id') or data.get('user_id')
        if not target_user_id:
            return jsonify({'error': 'Missing target_user_id or user_id'}), 400

        # Validate other required fields
        for field in ['title', 'message']:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        title = data['title']
        message = data['message']
        notification_type = data.get('notification_type')

        result, status_code = send_custom_notification(
            current_admin.id, target_user_id, title, message, notification_type
        )
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error sending custom notification: {e}")
        return jsonify({'error': str(e)}), 500

@admin_notification_bp.route('/send-bulk', methods=['POST'])
@token_required
@admin_required
def admin_send_bulk_notification():
    """Send a notification to multiple users (Admin only)"""
    try:
        current_admin = g.current_admin
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Missing notification data.'}), 400

        # Validate required fields
        required_fields = ['user_ids', 'title', 'message']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        user_ids = data['user_ids']
        title = data['title']
        message = data['message']
        notification_type = data.get('notification_type')

        if not isinstance(user_ids, list) or len(user_ids) == 0:
            return jsonify({'error': 'user_ids must be a non-empty list'}), 400

        result, status_code = send_bulk_notification(
            current_admin.id, user_ids, title, message, notification_type
        )
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error sending bulk notification: {e}")
        return jsonify({'error': str(e)}), 500

@admin_notification_bp.route('/stats', methods=['GET'])
@token_required
@admin_required
def admin_get_notification_stats():
    """Get notification statistics for admin dashboard"""
    try:
        current_admin = g.current_admin
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        result, status_code = get_admin_notification_stats(current_admin.id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
        return jsonify({'error': str(e)}), 500

@admin_notification_bp.route('/users', methods=['GET'])
@token_required
@admin_required
def admin_get_users_for_notification():
    """Get list of users for notification targeting (Admin only)"""
    try:
        current_admin = g.current_admin
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        # Get query parameters for search and pagination
        search = request.args.get('search', '')
        limit = min(int(request.args.get('limit', 50)), 100)
        
        result, status_code = get_all_users_for_notification(current_admin.id, search, limit)
        return jsonify({'users': result}), status_code
        
    except Exception as e:
        logger.error(f"Error getting users for notification: {e}")
        return jsonify({'error': str(e)}), 500 

# ------------------------- New Admin Notification Management -------------------------

@admin_notification_bp.route('', methods=['GET'])
@token_required
@admin_required
def admin_list_notifications():
    """List notifications with optional filters (Admin only)"""
    try:
        # Query parameters
        status_filter = request.args.get('filter', 'all')  # all, unread, read
        search_query = request.args.get('search', '').strip()
        page = max(int(request.args.get('page', 1)), 1)
        per_page = min(int(request.args.get('per_page', 20)), 100)
        offset = (page - 1) * per_page

        # Base query
        query = Notification.query

        # Status filter
        if status_filter == 'unread':
            query = query.filter(Notification.status == NotificationStatus.UNREAD.value)
        elif status_filter == 'read':
            query = query.filter(Notification.status.in_([NotificationStatus.READ.value, NotificationStatus.DISMISSED.value]))

        # Search across title, message, and user email/username
        if search_query:
            like_pattern = f"%{search_query}%"
            query = query.join(User, Notification.user_id == User.id, isouter=True)
            query = query.filter(or_(Notification.title.ilike(like_pattern),
                                      Notification.message.ilike(like_pattern),
                                      User.email.ilike(like_pattern),
                                      User.username.ilike(like_pattern)))

        total = query.count()
        notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(per_page).all()

        results = []
        for n in notifications:
            try:
                notif_dict = n.to_dict(include_user=True)  # If model supports flag
            except TypeError:
                notif_dict = n.to_dict()
                # Manually attach user if available
                if n.user:
                    notif_dict['user'] = {
                        'id': n.user.id,
                        'username': n.user.username,
                        'email': n.user.email
                    }
            results.append(notif_dict)

        return jsonify({
            'notifications': results,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.error(f"Error listing notifications: {e}")
        return jsonify({'error': str(e)}), 500

@admin_notification_bp.route('/<int:notification_id>/read', methods=['PUT'])
@token_required
@admin_required
def admin_mark_notification_read(notification_id):
    """Mark any notification as read (Admin only)"""
    try:
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404

        notification.mark_as_read()
        return jsonify({'success': True, 'message': 'Notification marked as read'}), 200

    except Exception as e:
        logger.error(f"Error marking notification read: {e}")
        return jsonify({'error': str(e)}), 500

@admin_notification_bp.route('/<int:notification_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_notification(notification_id):
    """Delete any notification (Admin only)"""
    try:
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404

        db.session.delete(notification)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Notification deleted'}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting notification: {e}")
        return jsonify({'error': str(e)}), 500 