"""Admin Dashboard Controller
Provides summary data for super admin tasks and notifications."""

from flask import current_app
from ..models import Business, FeatureRequest, Quest, Purchase, PurchaseStatus, Notification, NotificationStatus


def get_admin_dashboard_summary():
    """Return counts of pending items requiring super admin attention."""
    try:
        pending_quests = Quest.query.filter_by(approval_status='PENDING').count()
        pending_businesses = Business.query.filter_by(is_approved=False).count()
        pending_feature_requests = FeatureRequest.query.filter_by(status='PENDING').count()
        
        # Count pending deliveries (orders that have delivery info submitted and are awaiting fulfillment)
        pending_deliveries = Purchase.query.filter_by(
            purchase_status=PurchaseStatus.PENDING_FULFILLMENT.value
        ).count()
        
        # Count unread notifications across all users for admin awareness
        unread_notifications = Notification.query.filter_by(
            status=NotificationStatus.UNREAD.value
        ).count()

        return {
            'pending_quest_approvals': pending_quests,
            'pending_business_requests': pending_businesses,
            'pending_feature_requests': pending_feature_requests,
            'pending_deliveries': pending_deliveries,
            'unread_notifications': unread_notifications
        }, 200
    except Exception as e:
        current_app.logger.error(f"[ADMIN_DASHBOARD_SUMMARY] Error: {e}", exc_info=True)
        return {'error': 'Failed to retrieve admin dashboard summary'}, 500
