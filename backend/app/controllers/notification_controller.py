"""
Notification Controller
Handles user notifications and admin notification management
"""

from flask import request, jsonify, current_app, g
from ..models import (
    db, User, Admin, Notification, NotificationType, 
    NotificationStatus, MarketplaceItem, Purchase
)
from datetime import datetime
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

def get_user_notifications(user_id, status_filter=None, limit=50, offset=0):
    """
    Get notifications for a user
    
    Args:
        user_id: ID of user
        status_filter: Optional status filter ('unread', 'read', 'all')
        limit: Number of notifications to return
        offset: Offset for pagination
        
    Returns:
        dict: Notifications and metadata
    """
    try:
        query = Notification.query.filter_by(user_id=user_id)
        
        # Apply status filter
        if status_filter == 'unread':
            query = query.filter_by(status=NotificationStatus.UNREAD.value)
        elif status_filter == 'read':
            query = query.filter(
                or_(
                    Notification.status == NotificationStatus.READ.value,
                    Notification.status == NotificationStatus.DISMISSED.value
                )
            )
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination and ordering
        notifications = query.order_by(Notification.created_at.desc())\
            .offset(offset).limit(limit).all()
        
        # Count unread notifications
        unread_count = Notification.query.filter_by(
            user_id=user_id, 
            status=NotificationStatus.UNREAD.value
        ).count()
        
        result = []
        for notification in notifications:
            notification_dict = notification.to_dict()
            
            # Add related item information
            if notification.marketplace_item:
                notification_dict['marketplace_item'] = {
                    'id': notification.marketplace_item.id,
                    'title': notification.marketplace_item.title,
                    'image_url': notification.marketplace_item.image_url
                }
            
            result.append(notification_dict)
        
        return {
            'notifications': result,
            'total_count': total_count,
            'unread_count': unread_count,
            'has_more': (offset + limit) < total_count
        }, 200
        
    except Exception as e:
        logger.error(f"Error getting user notifications: {e}")
        return {'error': str(e)}, 500

def mark_notification_as_read(user_id, notification_id):
    """
    Mark a notification as read
    
    Args:
        user_id: ID of user
        notification_id: ID of notification
        
    Returns:
        dict: Success/error response
    """
    try:
        notification = Notification.query.filter_by(
            id=notification_id, 
            user_id=user_id
        ).first()
        
        if not notification:
            return {'error': 'Notification not found'}, 404
        
        notification.mark_as_read()
        
        return {
            'success': True,
            'message': 'Notification marked as read'
        }, 200
        
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return {'error': str(e)}, 500

def mark_all_notifications_as_read(user_id):
    """
    Mark all notifications as read for a user
    
    Args:
        user_id: ID of user
        
    Returns:
        dict: Success/error response
    """
    try:
        unread_notifications = Notification.query.filter_by(
            user_id=user_id,
            status=NotificationStatus.UNREAD.value
        ).all()
        
        for notification in unread_notifications:
            notification.status = NotificationStatus.READ.value
            notification.read_at = datetime.utcnow()
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Marked {len(unread_notifications)} notifications as read'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking all notifications as read: {e}")
        return {'error': str(e)}, 500

def dismiss_notification(user_id, notification_id):
    """
    Dismiss a notification (mark as dismissed)
    
    Args:
        user_id: ID of user
        notification_id: ID of notification
        
    Returns:
        dict: Success/error response
    """
    try:
        notification = Notification.query.filter_by(
            id=notification_id, 
            user_id=user_id
        ).first()
        
        if not notification:
            return {'error': 'Notification not found'}, 404
        
        notification.status = NotificationStatus.DISMISSED.value
        if not notification.read_at:
            notification.read_at = datetime.utcnow()
        
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Notification dismissed'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error dismissing notification: {e}")
        return {'error': str(e)}, 500

def delete_notification(user_id, notification_id):
    """
    Delete a notification (remove from database)
    
    Args:
        user_id: ID of user
        notification_id: ID of notification
        
    Returns:
        dict: Success/error response
    """
    try:
        notification = Notification.query.filter_by(
            id=notification_id, 
            user_id=user_id
        ).first()
        
        if not notification:
            return {'error': 'Notification not found'}, 404
        
        db.session.delete(notification)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Notification deleted'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting notification: {e}")
        return {'error': str(e)}, 500

def get_notification_summary(user_id):
    """
    Get notification summary for a user (counts by type)
    
    Args:
        user_id: ID of user
        
    Returns:
        dict: Notification summary
    """
    try:
        total_notifications = Notification.query.filter_by(user_id=user_id).count()
        unread_notifications = Notification.query.filter_by(
            user_id=user_id, 
            status=NotificationStatus.UNREAD.value
        ).count()
        
        # Count by type
        type_counts = db.session.query(
            Notification.notification_type,
            func.count(Notification.id).label('count')
        ).filter_by(user_id=user_id, status=NotificationStatus.UNREAD.value)\
         .group_by(Notification.notification_type).all()
        
        type_summary = {type_name: count for type_name, count in type_counts}
        
        return {
            'total_notifications': total_notifications,
            'unread_notifications': unread_notifications,
            'unread_by_type': type_summary
        }, 200
        
    except Exception as e:
        logger.error(f"Error getting notification summary: {e}")
        return {'error': str(e)}, 500

# Admin functions

def send_custom_notification(admin_id, target_user_id, title, message, notification_type=None):
    """
    Send a custom notification to a user (Admin only)
    
    Args:
        admin_id: ID of admin sending notification
        target_user_id: ID of user to receive notification
        title: Notification title
        message: Notification message
        notification_type: Optional notification type
        
    Returns:
        dict: Success/error response
    """
    try:
        # Verify target user exists
        target_user = User.query.get(target_user_id)
        if not target_user:
            return {'error': 'Target user not found'}, 404
        
        # Create notification
        notification = Notification(
            user_id=target_user_id,
            title=title,
            message=message,
            notification_type=notification_type or NotificationType.CUSTOM_MESSAGE.value,
            sent_by_admin_id=admin_id
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Notification sent to {target_user.name or target_user.email}',
            'notification_id': notification.id
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error sending custom notification: {e}")
        return {'error': str(e)}, 500

def send_bulk_notification(admin_id, user_ids, title, message, notification_type=None):
    """
    Send a notification to multiple users (Admin only)
    
    Args:
        admin_id: ID of admin sending notifications
        user_ids: List of user IDs to receive notification
        title: Notification title
        message: Notification message
        notification_type: Optional notification type
        
    Returns:
        dict: Success/error response
    """
    try:
        # Verify users exist
        users = User.query.filter(User.id.in_(user_ids)).all()
        if len(users) != len(user_ids):
            return {'error': 'Some target users not found'}, 404
        
        # Create notifications for all users
        notifications = []
        for user_id in user_ids:
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                notification_type=notification_type or NotificationType.GENERAL_ANNOUNCEMENT.value,
                sent_by_admin_id=admin_id
            )
            notifications.append(notification)
        
        db.session.add_all(notifications)
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Notification sent to {len(notifications)} users',
            'notification_count': len(notifications)
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error sending bulk notification: {e}")
        return {'error': str(e)}, 500

def get_admin_notification_stats(admin_id):
    """
    Get notification statistics for admin dashboard
    
    Args:
        admin_id: ID of admin
        
    Returns:
        dict: Notification statistics
    """
    try:
        # Total notifications sent by this admin
        total_sent = Notification.query.filter_by(sent_by_admin_id=admin_id).count()
        
        # Notifications sent today
        today = datetime.utcnow().date()
        sent_today = Notification.query.filter(
            Notification.sent_by_admin_id == admin_id,
            func.date(Notification.created_at) == today
        ).count()
        
        # Unread notifications across all users
        total_unread = Notification.query.filter_by(
            status=NotificationStatus.UNREAD.value
        ).count()
        
        # Notifications by type (sent by this admin)
        type_counts = db.session.query(
            Notification.notification_type,
            func.count(Notification.id).label('count')
        ).filter_by(sent_by_admin_id=admin_id)\
         .group_by(Notification.notification_type).all()
        
        type_summary = {type_name: count for type_name, count in type_counts}
        
        return {
            'total_sent_by_admin': total_sent,
            'sent_today': sent_today,
            'total_unread_system_wide': total_unread,
            'sent_by_type': type_summary
        }, 200
        
    except Exception as e:
        logger.error(f"Error getting admin notification stats: {e}")
        return {'error': str(e)}, 500

def get_all_users_for_notification(admin_id, search='', limit=50):
    """
    Get list of users for notification targeting (Admin only)
    
    Args:
        admin_id: ID of admin
        search: Search term for filtering users
        limit: Maximum number of users to return
        
    Returns:
        list: List of users with basic info
    """
    try:
        query = User.query.filter_by(is_active=True)
        
        # Apply search filter if provided
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.name.ilike(search_pattern)
                )
            )
        
        users = query.order_by(User.username, User.email).limit(limit).all()
        
        result = []
        for user in users:
            user_dict = {
                'id': user.id,
                'username': user.username,
                'name': user.name,
                'email': user.email,
                'xp_balance': user.xp_balance,
                'unread_notifications': Notification.query.filter_by(
                    user_id=user.id,
                    status=NotificationStatus.UNREAD.value
                ).count()
            }
            result.append(user_dict)
        
        return result, 200
        
    except Exception as e:
        logger.error(f"Error getting users for notification: {e}")
        return {'error': str(e)}, 500

def create_system_notification(title, message, notification_type, user_id=None, marketplace_item_id=None, purchase_id=None):
    """
    Create a system notification (internal function)
    
    Args:
        title: Notification title
        message: Notification message
        notification_type: Type of notification
        user_id: Target user ID
        marketplace_item_id: Optional marketplace item reference
        purchase_id: Optional purchase reference
        
    Returns:
        Notification: Created notification object
    """
    try:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            marketplace_item_id=marketplace_item_id,
            purchase_id=purchase_id
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return notification
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating system notification: {e}")
        return None 