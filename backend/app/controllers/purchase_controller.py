"""
Purchase Controller
Handles marketplace purchase flow, delivery information, and raffle management
"""

from flask import request, jsonify, current_app, g
from ..models import (
    db, User, MarketplaceItem, UserRewardLog, Purchase, DeliveryInfo, 
    RaffleEntry, Notification, PurchaseStatus, PaymentMethod, 
    NotificationType, NotificationStatus
)
from .xp_badge_controller import spend_xp
from datetime import datetime
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
import logging
import random

logger = logging.getLogger(__name__)

def initiate_purchase(user_id, item_id):
    """
    Initiate a direct purchase for a marketplace item
    Creates a purchase record and redirects to delivery form
    
    Args:
        user_id: ID of user making purchase
        item_id: ID of marketplace item
        
    Returns:
        dict: Purchase details or error
    """
    try:
        user = User.query.get(user_id)
        item = MarketplaceItem.query.get(item_id)
        
        if not user:
            return {'error': 'User not found'}, 404
        if not item:
            return {'error': 'Item not found'}, 404
        if not item.is_active:
            return {'error': 'Item is not available'}, 400
        if item.item_type != 'DIRECT':
            return {'error': 'This item is not available for direct purchase'}, 400
        
        # Check user has enough XP
        if user.xp_balance < item.xp_cost:
            return {'error': 'Insufficient XP balance'}, 400
        
        # Check stock if applicable
        if item.stock is not None and item.stock <= 0:
            return {'error': 'Item is out of stock'}, 400
        
        # Check redemption limit per user
        if item.redeem_limit_per_user is not None:
            redemption_count = UserRewardLog.query.filter(
                UserRewardLog.user_id == user_id,
                UserRewardLog.marketplace_item_id == item_id,
                UserRewardLog.reward_type == 'DIRECT'
            ).count()
            if redemption_count >= item.redeem_limit_per_user:
                return {'error': 'You have reached the redemption limit for this item'}, 400
        
        # Create purchase record
        purchase = Purchase(
            user_id=user_id,
            marketplace_item_id=item_id,
            purchase_type='DIRECT',
            xp_spent=item.xp_cost,
            purchase_status=PurchaseStatus.PENDING_DELIVERY_INFO.value,
            is_raffle_win=False
        )
        db.session.add(purchase)
        db.session.flush()  # Get the ID without committing
        
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Purchase initiated successfully. Please provide delivery information.',
            'purchase_id': purchase.id,
            'item_title': item.title,
            'xp_cost': item.xp_cost,
            'redirect_to_delivery_form': True
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error initiating purchase: {e}")
        return {'error': str(e)}, 500

def submit_delivery_info(user_id, purchase_id, delivery_data):
    """
    Submit delivery information for a purchase
    
    Args:
        user_id: ID of user
        purchase_id: ID of purchase
        delivery_data: Dictionary with delivery information
        
    Returns:
        dict: Success/error response
    """
    try:
        # Verify purchase belongs to user
        purchase = Purchase.query.filter_by(
            id=purchase_id, 
            user_id=user_id,
            purchase_status=PurchaseStatus.PENDING_DELIVERY_INFO.value
        ).first()
        
        if not purchase:
            return {'error': 'Purchase not found or already processed'}, 404
        
        # Validate required fields
        required_fields = [
            'full_name', 'phone_number', 'email', 'address', 
            'city', 'state_province', 'postal_code', 'country'
        ]
        for field in required_fields:
            if not delivery_data.get(field):
                return {'error': f'Missing required field: {field}'}, 400
        
        # Create delivery info
        delivery_info = DeliveryInfo(
            purchase_id=purchase_id,
            full_name=delivery_data['full_name'],
            phone_number=delivery_data['phone_number'],
            email=delivery_data['email'],
            address=delivery_data['address'],
            city=delivery_data['city'],
            state_province=delivery_data['state_province'],
            postal_code=delivery_data['postal_code'],
            country=delivery_data['country'],
            billing_same_as_delivery=delivery_data.get('billing_same_as_delivery', True),
            billing_address=delivery_data.get('billing_address'),
            billing_city=delivery_data.get('billing_city'),
            billing_state_province=delivery_data.get('billing_state_province'),
            billing_postal_code=delivery_data.get('billing_postal_code'),
            billing_country=delivery_data.get('billing_country'),
            payment_method=delivery_data.get('payment_method', PaymentMethod.WALLET.value),
            delivery_notes=delivery_data.get('delivery_notes')
        )
        
        # Now process the actual purchase (spend XP and create reward log)
        if not spend_xp(user_id, purchase.xp_spent, f"Purchased {purchase.marketplace_item.title}"):
            return {'error': 'Failed to process XP transaction'}, 500
        
        # Create reward log
        reward_log = UserRewardLog(
            user_id=user_id,
            marketplace_item_id=purchase.marketplace_item_id,
            xp_spent=purchase.xp_spent,
            reward_type='DIRECT',
            status='PENDING',
            notes=f"Direct purchase of {purchase.marketplace_item.title}"
        )
        db.session.add(reward_log)
        db.session.flush()
        
        # Link reward log to purchase
        purchase.user_reward_log_id = reward_log.id
        purchase.purchase_status = PurchaseStatus.PENDING_FULFILLMENT.value
        
        # Update stock if applicable
        if purchase.marketplace_item.stock is not None:
            purchase.marketplace_item.stock -= 1
        
        # Add delivery info
        db.session.add(delivery_info)
        
        # Create notification for the user that their order is being processed
        user_notification = Notification(
            user_id=user_id,
            title="Order Confirmed - Processing Started",
            message=f"Your order for {purchase.marketplace_item.title} has been confirmed! We've received your delivery information and your order is now being processed for fulfillment.",
            notification_type=NotificationType.ORDER_SHIPPED.value,  # Using ORDER_SHIPPED as closest match for processing
            marketplace_item_id=purchase.marketplace_item_id,
            purchase_id=purchase.id
        )
        db.session.add(user_notification)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Your order for {purchase.marketplace_item.title} has been placed successfully!',
            'purchase_id': purchase.id,
            'delivery_info_id': delivery_info.id
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error submitting delivery info: {e}")
        return {'error': str(e)}, 500

def get_purchase_details(user_id, purchase_id):
    """
    Get purchase details for confirmation screen
    
    Args:
        user_id: ID of user
        purchase_id: ID of purchase
        
    Returns:
        dict: Purchase details or error
    """
    try:
        purchase = Purchase.query.filter_by(id=purchase_id, user_id=user_id).first()
        
        if not purchase:
            return {'error': 'Purchase not found'}, 404
        
        result = purchase.to_dict()
        
        # Add delivery info if available
        if purchase.delivery_info:
            result['delivery_info'] = purchase.delivery_info.to_dict()
        
        # Add item details
        if purchase.marketplace_item:
            result['item'] = purchase.marketplace_item.to_dict()
        
        return result, 200
        
    except Exception as e:
        logger.error(f"Error getting purchase details: {e}")
        return {'error': str(e)}, 500

def get_user_purchases(user_id):
    """
    Get all purchases for a user
    
    Args:
        user_id: ID of user
        
    Returns:
        list: List of purchases
    """
    try:
        purchases = Purchase.query.filter_by(user_id=user_id)\
            .order_by(Purchase.created_at.desc()).all()
        
        result = []
        for purchase in purchases:
            purchase_dict = purchase.to_dict()
            if purchase.delivery_info:
                purchase_dict['delivery_info'] = purchase.delivery_info.to_dict()
            if purchase.marketplace_item:
                purchase_dict['item'] = purchase.marketplace_item.to_dict()
            result.append(purchase_dict)
        
        return result, 200
        
    except Exception as e:
        logger.error(f"Error getting user purchases: {e}")
        return {'error': str(e)}, 500

# Admin functions for raffle management

def get_raffle_entries(admin_id, item_id=None):
    """
    Get raffle entries for admin management
    
    Args:
        admin_id: ID of admin
        item_id: Optional filter by item ID
        
    Returns:
        list: List of raffle entries
    """
    try:
        query = RaffleEntry.query
        
        if item_id:
            query = query.filter_by(marketplace_item_id=item_id)
        
        entries = query.order_by(RaffleEntry.entry_date.desc()).all()
        
        return [entry.to_dict() for entry in entries], 200
        
    except Exception as e:
        logger.error(f"Error getting raffle entries: {e}")
        return {'error': str(e)}, 500

def select_raffle_winner(admin_id, item_id):
    """
    Randomly select a raffle winner for an item
    
    Args:
        admin_id: ID of admin selecting winner
        item_id: ID of marketplace item
        
    Returns:
        dict: Winner details or error
    """
    try:
        # Get all eligible entries (not already winners)
        eligible_entries = RaffleEntry.query.filter_by(
            marketplace_item_id=item_id,
            is_winner=False
        ).all()
        
        if not eligible_entries:
            return {'error': 'No eligible raffle entries found'}, 404
        
        # Randomly select a winner
        winner_entry = random.choice(eligible_entries)
        
        # Mark as winner
        winner_entry.is_winner = True
        winner_entry.selected_at = datetime.utcnow()
        winner_entry.selected_by_admin_id = admin_id
        
        # Create a purchase record for the winner
        purchase = Purchase(
            user_id=winner_entry.user_id,
            marketplace_item_id=item_id,
            user_reward_log_id=winner_entry.user_reward_log_id,
            purchase_type='RAFFLE_WIN',
            xp_spent=0,  # No additional XP for raffle win
            purchase_status=PurchaseStatus.PENDING_DELIVERY_INFO.value,
            is_raffle_win=True,
            raffle_selected_at=datetime.utcnow()
        )
        db.session.add(purchase)
        db.session.flush()
        
        # Create notification for winner
        notification = Notification(
            user_id=winner_entry.user_id,
            title="🎉 Congratulations! You've won a raffle!",
            message=f"You've been selected as the winner for {winner_entry.marketplace_item.title}! Please provide your delivery information to receive your prize.",
            notification_type=NotificationType.RAFFLE_WINNER.value,
            marketplace_item_id=item_id,
            purchase_id=purchase.id,
            sent_by_admin_id=admin_id
        )
        db.session.add(notification)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Winner selected for {winner_entry.marketplace_item.title}',
            'winner': {
                'user_id': winner_entry.user_id,
                'user_name': winner_entry.user.name,
                'user_email': winner_entry.user.email,
                'entry_id': winner_entry.id,
                'purchase_id': purchase.id
            }
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error selecting raffle winner: {e}")
        return {'error': str(e)}, 500

def get_admin_purchases(admin_id):
    """
    Get all purchases for admin management
    
    Args:
        admin_id: ID of admin
        
    Returns:
        list: List of purchases with delivery info
    """
    try:
        purchases = Purchase.query.join(User).join(MarketplaceItem)\
            .order_by(Purchase.created_at.desc()).all()
        
        result = []
        for purchase in purchases:
            purchase_dict = purchase.to_dict()
            
            # Add user information
            if purchase.user:
                purchase_dict['user'] = {
                    'id': purchase.user.id,
                    'username': purchase.user.username,
                    'email': purchase.user.email,
                    'name': getattr(purchase.user, 'name', purchase.user.username)
                }
                purchase_dict['user_name'] = getattr(purchase.user, 'name', purchase.user.username)
                purchase_dict['user_email'] = purchase.user.email
            
            # Add marketplace item information
            if purchase.marketplace_item:
                purchase_dict['marketplace_item'] = {
                    'id': purchase.marketplace_item.id,
                    'name': purchase.marketplace_item.title,
                    'title': purchase.marketplace_item.title,
                    'points_cost': purchase.marketplace_item.xp_cost,
                    'image_url': purchase.marketplace_item.image_url
                }
            
            # Add delivery info if available
            if purchase.delivery_info:
                delivery_dict = purchase.delivery_info.to_dict()
                purchase_dict['delivery_info'] = delivery_dict
            
            # Ensure status field is properly named
            purchase_dict['status'] = purchase.purchase_status
            
            result.append(purchase_dict)
        
        return result, 200
        
    except Exception as e:
        logger.error(f"Error getting admin purchases: {e}")
        return {'error': str(e)}, 500

def update_purchase_status(admin_id, purchase_id, new_status, notes=None):
    """
    Update purchase status (admin only)
    
    Args:
        admin_id: ID of admin
        purchase_id: ID of purchase
        new_status: New status
        notes: Optional notes
        
    Returns:
        dict: Success/error response
    """
    try:
        purchase = Purchase.query.get(purchase_id)
        if not purchase:
            return {'error': 'Purchase not found'}, 404
        
        old_status = purchase.purchase_status
        purchase.purchase_status = new_status
        
        # Create notification for status updates
        notification_message = f"Your order for {purchase.marketplace_item.title} has been updated to: {new_status.replace('_', ' ').title()}"
        if notes:
            notification_message += f"\n\nNote: {notes}"
        
        notification_type = NotificationType.CUSTOM_MESSAGE.value
        if new_status == PurchaseStatus.SHIPPED.value:
            notification_type = NotificationType.ORDER_SHIPPED.value
        elif new_status == PurchaseStatus.DELIVERED.value:
            notification_type = NotificationType.ORDER_DELIVERED.value
        
        notification = Notification(
            user_id=purchase.user_id,
            title="Order Status Update",
            message=notification_message,
            notification_type=notification_type,
            marketplace_item_id=purchase.marketplace_item_id,
            purchase_id=purchase.id,
            sent_by_admin_id=admin_id
        )
        db.session.add(notification)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Purchase status updated from {old_status} to {new_status}',
            'purchase_id': purchase.id
        }, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating purchase status: {e}")
        return {'error': str(e)}, 500 