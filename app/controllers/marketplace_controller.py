"""
Marketplace Controller
Handles marketplace items, redemptions, and user rewards
"""

from flask import request, jsonify, current_app
from ..models import db, User, MarketplaceItem, UserRewardLog, RewardStatus
from .xp_badge_controller import spend_xp
from datetime import datetime
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

class MarketplaceController:

    @staticmethod
    def list_items_for_user(user_id):
        # user = User.query.get(user_id)
        # items = MarketplaceItem.query.filter_by(is_active=True).order_by(MarketplaceItem.xp_cost.asc()).all()
        # user_xp = user.xp_balance if user else 0
        # return jsonify({"items": [item.to_dict() for item in items], "user_xp": user_xp}), 200
        logger.info(f"Placeholder: Listing items for user {user_id}")
        return {"items": [{"id": 1, "title": "Sample Item", "xp_cost": 100}], "user_xp": 500}, 200

    @staticmethod
    def redeem_item(user_id, item_id, data=None):
        # user = User.query.get_or_404(user_id)
        # item = MarketplaceItem.query.filter_by(id=item_id, is_active=True, item_type='DIRECT').first_or_404()
        # if item.stock is not None and item.stock <= 0:
        #     return {"error": "Item out of stock"}, 400
        # if user.xp_balance < item.xp_cost:
        #     return {"error": "Not enough XP to redeem this item"}, 403
        # try:
        #     XPBadgeController.spend_xp(user_id, item.xp_cost, f"Redeemed marketplace item: {item.title}")
        #     if item.stock is not None:
        #         item.stock -= 1
        #     reward_log = UserRewardLog(
        #         user_id=user_id,
        #         marketplace_item_id=item_id,
        #         xp_spent=item.xp_cost,
        #         reward_type='DIRECT_PURCHASE',
        #         status='PENDING_DELIVERY' # Or 'DELIVERED' if digital
        #     )
        #     db.session.add(reward_log)
        #     db.session.commit()
        #     return {"message": "Item redeemed successfully!", "item_id": item_id, "xp_spent": item.xp_cost, "new_xp_balance": user.xp_balance}, 200
        # except Exception as e:
        #     db.session.rollback()
        #     logger.error(f"Error redeeming item {item_id} for user {user_id}: {e}")
        #     return {"error": "Failed to redeem item."}, 500
        logger.info(f"Placeholder: User {user_id} redeeming item {item_id}")
        if item_id == 1: return {"message": "Item redeemed!", "xp_spent": 100}, 200
        return {"error": "Cannot redeem"}, 400

    @staticmethod
    def enter_raffle(user_id, item_id):
        # Similar logic: check if item is RAFFLE, check raffle_end_date, check entries_per_user, spend XP, create UserRewardLog with type RAFFLE_ENTRY
        logger.info(f"Placeholder: User {user_id} entering raffle for item {item_id}")
        if item_id == 2: return {"message": "Entered raffle!"}, 200
        return {"error": "Cannot enter raffle"}, 400

    @staticmethod
    def get_user_rewards_history(user_id):
        # rewards = UserRewardLog.query.filter_by(user_id=user_id).order_by(UserRewardLog.redeemed_at.desc()).all()
        # return jsonify([reward.to_dict_with_item() for reward in rewards]), 200
        logger.info(f"Placeholder: Getting rewards history for user {user_id}")
        return [{"item_title": "Sample Item", "status": "DELIVERED"}], 200

    # --- Admin Methods ---
    @staticmethod
    def create_item(data, admin_id):
        # title = data.get('title')
        # description = data.get('description')
        # ... (all fields from MarketplaceItem model)
        # new_item = MarketplaceItem(...)
        # db.session.add(new_item)
        # db.session.commit()
        # return jsonify(new_item.to_dict()), 201
        logger.info(f"Placeholder: Admin {admin_id} creating item with data: {data}")
        return {"id": 101, **data}, 201

    @staticmethod
    def list_all_items_admin():
        # items = MarketplaceItem.query.all()
        # return jsonify([item.to_dict() for item in items]), 200
        logger.info("Placeholder: Admin listing all items")
        return [{"id": 1, "title": "Sample Item", "xp_cost": 100, "stock": 10}], 200

    @staticmethod
    def update_item(item_id, data, admin_id):
        # item = MarketplaceItem.query.get_or_404(item_id)
        # for key, value in data.items():
        #     if hasattr(item, key):
        #         setattr(item, key, value)
        # db.session.commit()
        # return jsonify(item.to_dict()), 200
        logger.info(f"Placeholder: Admin {admin_id} updating item {item_id} with data: {data}")
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {"error": "Item not found"}, 404
        # No complex permission check here; assume admin_required decorator used in route
        item.title = data.get('title', item.title)
        item.description = data.get('description', item.description)
        item.xp_cost = int(data.get('xp_cost', item.xp_cost))
        item.item_type = data.get('item_type', item.item_type)
        item.stock = int(data.get('stock', item.stock)) if data.get('stock') and data.get('stock') != '' else None
        item.redeem_limit_per_user = int(data.get('redeem_limit_per_user', item.redeem_limit_per_user)) if data.get('redeem_limit_per_user') and data.get('redeem_limit_per_user') != '' else None
        item.raffle_entries_per_user = int(data.get('raffle_entries_per_user', item.raffle_entries_per_user)) if data.get('raffle_entries_per_user') else 1
        item.raffle_end_date = datetime.fromisoformat(data.get('raffle_end_date', item.raffle_end_date)) if data.get('raffle_end_date') and data.get('raffle_end_date') != '' else None
        item.is_active = bool(data.get('is_active', item.is_active))
        item.is_featured = bool(data.get('is_featured', item.is_featured))
        
        # Handle image upload like the badge controller
        if 'image' in request.files and request.files['image'].filename != '':
            from ..utils.file_helpers import save_uploaded_file, remove_file
            # Remove old image if it exists and is not a URL
            if item.image_url and not item.image_url.startswith('http'):
                remove_file(item.image_url)
            try:
                item.image_url = save_uploaded_file(request.files['image'], subfolder='marketplace_images')
            except Exception as e:
                current_app.logger.error(f"[UPDATE_MARKETPLACE_ITEM] Image upload failed: {e}")
                return {'error': f"Image upload failed: {str(e)}"}, 400
        elif 'image_url' in data:
            if data['image_url'] == '' and item.image_url and not item.image_url.startswith('http'):
                # Remove image
                from ..utils.file_helpers import remove_file
                remove_file(item.image_url)
                item.image_url = None
            elif data['image_url']:
                item.image_url = data['image_url']
                
        try:
            db.session.commit()
            logger.info(f"Admin {admin_id} updated item {item_id}")
            return {"message": "Item updated", "id": item.id, "is_featured": item.is_featured}, 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"[UPDATE_MARKETPLACE_ITEM] Failed for item {item_id}: {e}")
            return {"error": "Failed to update item", "details": str(e)}, 500

    @staticmethod
    def delete_item(item_id, admin_id):
        # item = MarketplaceItem.query.get_or_404(item_id)
        # db.session.delete(item)
        # db.session.commit()
        # return jsonify({"message": "Item deleted"}), 200
        logger.info(f"Placeholder: Admin {admin_id} deleting item {item_id}")
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {"error": "Item not found"}, 404
        # No complex permission check here; assume admin_required decorator used in route
        try:
            db.session.delete(item)
            db.session.commit()
            logger.info(f"Admin {admin_id} deleted item {item_id}")
            return {"message": "Item deleted"}, 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"[DELETE_MARKETPLACE_ITEM] Failed for item {item_id}: {e}")
            return {"error": "Failed to delete item", "details": str(e)}, 500

    @staticmethod
    def list_all_rewards_admin():
        # logs = UserRewardLog.query.order_by(UserRewardLog.redeemed_at.desc()).all()
        # return jsonify([log.to_dict_with_item_and_user() for log in logs]), 200 # Enhance to_dict
        logger.info("Placeholder: Admin listing all reward logs")
        return [{"log_id": 1, "user_email": "user@example.com", "item_title": "Sample Item"}], 200

    @staticmethod
    def update_reward_log_status(log_id, data, admin_id):
        # log = UserRewardLog.query.get_or_404(log_id)
        # new_status = data.get('status')
        # if new_status not in ['PENDING_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED']: # Example statuses
        #     return {"error": "Invalid status"}, 400
        # log.status = new_status
        # log.notes = data.get('notes', log.notes) # Optional notes from admin
        # db.session.commit()
        # return jsonify(log.to_dict_with_item_and_user()), 200
        logger.info(f"Placeholder: Admin {admin_id} updating reward log {log_id} with data: {data}")
        return {"log_id": log_id, **data}, 200

    @staticmethod
    def set_item_featured(item_id, featured=True, admin_id=None):
        """Toggle the is_featured flag on a marketplace item"""
        from ..models import MarketplaceItem, db
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {"error": "Item not found"}, 404
        # No complex permission check here; assume admin_required decorator used in route
        item.is_featured = bool(featured)
        try:
            db.session.commit()
            logger.info(f"Admin {admin_id} set is_featured={featured} for item {item_id}")
            return {"message": "Item updated", "id": item.id, "is_featured": item.is_featured}, 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"[SET_ITEM_FEATURED] Failed for item {item_id}: {e}")
            return {"error": "Failed to update item", "details": str(e)}, 500

def list_items_for_user(user_id, filters=None):
    """
    Get marketplace items available for user with optional filters
    
    Args:
        user_id: ID of the user
        filters: Dictionary with optional filters (xp_min, xp_max, item_type)
        
    Returns:
        dict: {
            'items': list of item dicts with user redemption counts,
            'user_xp': int
        }
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        # Base query for active items
        query = MarketplaceItem.query.filter_by(is_active=True)
        
        # Apply filters if provided
        if filters:
            if filters.get('xp_min'):
                query = query.filter(MarketplaceItem.xp_cost >= filters['xp_min'])
            if filters.get('xp_max'):
                query = query.filter(MarketplaceItem.xp_cost <= filters['xp_max'])
            if filters.get('item_type') and filters['item_type'] != 'ALL':
                query = query.filter(MarketplaceItem.item_type == filters['item_type'])
        
        items = query.order_by(MarketplaceItem.xp_cost.asc()).all()
        
        # Get user redemption counts for each item
        items_with_user_data = []
        # Refresh the session to ensure we get the latest data
        db.session.commit()
        for item in items:
            item_dict = item.to_dict()
            
            # Count user's redemptions for this item (include all redemption types)
            user_redemption_count = UserRewardLog.query.filter(
                UserRewardLog.user_id == user_id,
                UserRewardLog.marketplace_item_id == item.id,
                UserRewardLog.reward_type.in_(['DIRECT', 'RAFFLE_ENTRY'])
            ).count()
            

            # Add user-specific data
            item_dict['user_redemption_count'] = user_redemption_count
            
            # Check if user has reached redemption limit
            if item.redeem_limit_per_user is not None:
                item_dict['user_limit_reached'] = user_redemption_count >= item.redeem_limit_per_user
            else:
                item_dict['user_limit_reached'] = False
            
            # For raffles, check user's entry count vs max entries
            if item.item_type == 'RAFFLE' and item.raffle_entries_per_user is not None:
                raffle_entries_count = UserRewardLog.query.filter_by(
                    user_id=user_id,
                    marketplace_item_id=item.id,
                    reward_type='RAFFLE_ENTRY'
                ).count()
                item_dict['user_raffle_entries'] = raffle_entries_count
                item_dict['user_raffle_limit_reached'] = raffle_entries_count >= item.raffle_entries_per_user
            
            items_with_user_data.append(item_dict)
        
        return {
            'items': items_with_user_data,
            'user_xp': user.xp_balance
        }
        
    except Exception as e:
        return {'error': str(e)}

def redeem_item(user_id, item_id):
    """
    Redeem a direct marketplace item
    
    Args:
        user_id: ID of user redeeming
        item_id: ID of marketplace item
        
    Returns:
        dict: Success/error response
    """
    try:
        user = User.query.get(user_id)
        item = MarketplaceItem.query.get(item_id)
        
        if not user:
            return {'error': 'User not found'}
        if not item:
            return {'error': 'Item not found'}
        if not item.is_active:
            return {'error': 'Item is not available'}
        if item.item_type != 'DIRECT':
            return {'error': 'This item is not available for direct redemption'}
        
        # Check user has enough XP
        if user.xp_balance < item.xp_cost:
            return {'error': 'Insufficient XP balance'}
        
        # Check stock if applicable
        if item.stock is not None and item.stock <= 0:
            return {'error': 'Item is out of stock'}
        
        # Check redemption limit per user
        if item.redeem_limit_per_user is not None:
            redemption_count = UserRewardLog.query.filter(
                UserRewardLog.user_id == user_id,
                UserRewardLog.marketplace_item_id == item_id,
                UserRewardLog.reward_type == 'DIRECT'
            ).count()
            if redemption_count >= item.redeem_limit_per_user:
                return {'error': 'You have reached the redemption limit for this item'}
        
        # Spend XP
        if not spend_xp(user_id, item.xp_cost, f"Redeemed {item.title}"):
            return {'error': 'Failed to process XP transaction'}
        
        # Create reward log
        reward_log = UserRewardLog(
            user_id=user_id,
            marketplace_item_id=item_id,
            xp_spent=item.xp_cost,
            reward_type='DIRECT',
            status=RewardStatus.PENDING.value,
            notes=f"Direct redemption of {item.title}"
        )
        db.session.add(reward_log)
        

        # Update stock if applicable
        if item.stock is not None:
            item.stock -= 1
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Successfully redeemed {item.title}!',
            'xp_spent': item.xp_cost,
            'remaining_xp': user.xp_balance
        }
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def enter_raffle(user_id, item_id):
    """
    Enter a raffle for a marketplace item
    
    Args:
        user_id: ID of user entering
        item_id: ID of marketplace item
        
    Returns:
        dict: Success/error response
    """
    try:
        from ..models import RaffleEntry  # Import here to avoid circular imports
        
        user = User.query.get(user_id)
        item = MarketplaceItem.query.get(item_id)
        
        if not user:
            return {'error': 'User not found'}
        if not item:
            return {'error': 'Item not found'}
        if not item.is_active:
            return {'error': 'Item is not available'}
        if item.item_type != 'RAFFLE':
            return {'error': 'This item is not available for raffle entry'}
        
        # Check if raffle is still open
        if item.raffle_end_date and item.raffle_end_date < datetime.utcnow():
            return {'error': 'Raffle has ended'}
        
        # Check user has enough XP
        if user.xp_balance < item.xp_cost:
            return {'error': 'Insufficient XP balance'}
        
        # Check if user has already entered maximum times
        existing_entries = RaffleEntry.query.filter_by(
            user_id=user_id,
            marketplace_item_id=item_id
        ).count()
        
        if existing_entries >= (item.raffle_entries_per_user or 1):
            return {'error': 'Maximum raffle entries reached for this item'}
        
        # Spend XP
        if not spend_xp(user_id, item.xp_cost, f"Raffle entry for {item.title}"):
            return {'error': 'Failed to process XP transaction'}
        
        # Create reward log
        reward_log = UserRewardLog(
            user_id=user_id,
            marketplace_item_id=item_id,
            xp_spent=item.xp_cost,
            reward_type='RAFFLE_ENTRY',
            status=RewardStatus.UNCONFIRMED.value,
            notes=f"Raffle entry for {item.title}"
        )
        db.session.add(reward_log)
        db.session.flush()
        
        # Create raffle entry record
        raffle_entry = RaffleEntry(
            user_id=user_id,
            marketplace_item_id=item_id,
            user_reward_log_id=reward_log.id
        )
        db.session.add(raffle_entry)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Successfully entered raffle for {item.title}!',
            'xp_spent': item.xp_cost,
            'remaining_xp': user.xp_balance,
            'entries_used': existing_entries + 1,
            'max_entries': item.raffle_entries_per_user or 1
        }
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def get_user_rewards(user_id):
    """
    Get user's reward history
    
    Args:
        user_id: ID of user
        
    Returns:
        list: List of reward log dictionaries
    """
    try:
        rewards = UserRewardLog.query.filter_by(user_id=user_id)\
            .order_by(UserRewardLog.redeemed_at.desc()).all()
        
        return [reward.to_dict() for reward in rewards]
        
    except Exception as e:
        return {'error': str(e)}

# Admin functions

def create_marketplace_item(item_data):
    """
    Create a new marketplace item.
    
    Args:
        item_data: Dictionary with item details
        
    Returns:
        dict: Created item or error
    """
    try:
        # Debug: log incoming files and fields
        print(f"[CREATE_MARKETPLACE_ITEM] request.files keys: {list(request.files.keys())}")
        print(f"[CREATE_MARKETPLACE_ITEM] image_url field received: {item_data.get('image_url')}")

        # Extract data with defaults
        title = item_data.get('title')
        if not title:
            return {'error': 'Title is required'}
        
        # Handle image upload or URL like the badge controller
        image_path = None
        if 'image' in request.files and request.files['image'].filename != '':
            from ..utils.file_helpers import save_uploaded_file
            try:
                # Subfolder for marketplace images
                image_path = save_uploaded_file(request.files['image'], subfolder='marketplace_images')
                print(f"[CREATE_MARKETPLACE_ITEM] Image saved to {image_path}")
            except Exception as e:
                current_app.logger.error(f"[CREATE_MARKETPLACE_ITEM] Image upload failed: {e}", exc_info=True)
                return {'error': f"Image upload failed: {str(e)}"}, 400
        elif 'image_url' in item_data and item_data['image_url']:
            image_path = item_data['image_url']
        
        new_item = MarketplaceItem(
            title=title,
            description=item_data.get('description'),
            image_url=image_path,
            xp_cost=int(item_data.get('xp_cost', 0)) if item_data.get('xp_cost') else 0,
            item_type=item_data.get('item_type', 'DIRECT'),
            stock=int(item_data['stock']) if item_data.get('stock') and item_data['stock'] != '' else None,
            redeem_limit_per_user=int(item_data['redeem_limit_per_user']) if item_data.get('redeem_limit_per_user') and item_data['redeem_limit_per_user'] != '' else None,
            raffle_entries_per_user=int(item_data.get('raffle_entries_per_user', 1)) if item_data.get('raffle_entries_per_user') else 1,
            raffle_end_date=datetime.fromisoformat(item_data['raffle_end_date']) if item_data.get('raffle_end_date') and item_data['raffle_end_date'] != '' else None,
            is_active=item_data.get('is_active', True)
        )
        
        db.session.add(new_item)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Marketplace item created successfully!',
            'item': new_item.to_dict()
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[CREATE_MARKETPLACE_ITEM] Error: {e}", exc_info=True)
        return {'error': str(e)}

def update_marketplace_item(item_id, item_data):
    """
    Update a marketplace item (Admin only)
    
    Args:
        item_id: ID of item to update
        item_data: Dictionary with updated information from form data or JSON
        
    Returns:
        dict: Success/error response with item data
    """
    try:
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {'error': 'Item not found'}
        
        # Debug: log incoming files and fields for update
        print(f"[UPDATE_MARKETPLACE_ITEM] request.files keys: {list(request.files.keys())}")
        print(f"[UPDATE_MARKETPLACE_ITEM] image_url field received: {item_data.get('image_url')}")

        # Update basic fields
        if 'title' in item_data:
            item.title = item_data['title']
        if 'description' in item_data:
            item.description = item_data['description']
        if 'xp_cost' in item_data:
            item.xp_cost = int(item_data['xp_cost'])
        if 'item_type' in item_data:
            item.item_type = item_data['item_type']
        if 'stock' in item_data:
            item.stock = int(item_data['stock']) if item_data['stock'] and item_data['stock'] != '' else None
        if 'redeem_limit_per_user' in item_data:
            item.redeem_limit_per_user = int(item_data['redeem_limit_per_user']) if item_data['redeem_limit_per_user'] and item_data['redeem_limit_per_user'] != '' else None
        if 'raffle_entries_per_user' in item_data:
            item.raffle_entries_per_user = int(item_data['raffle_entries_per_user']) if item_data['raffle_entries_per_user'] else 1
        if 'raffle_end_date' in item_data:
            item.raffle_end_date = datetime.fromisoformat(item_data['raffle_end_date']) if item_data['raffle_end_date'] and item_data['raffle_end_date'] != '' else None
        if 'is_active' in item_data:
            # Handle boolean conversion for is_active field
            if isinstance(item_data['is_active'], str):
                item.is_active = item_data['is_active'].lower() in ('true', '1', 'yes', 'on')
            else:
                item.is_active = bool(item_data['is_active'])
        
        # Handle image upload like the badge controller
        if 'image' in request.files and request.files['image'].filename != '':
            from ..utils.file_helpers import save_uploaded_file, remove_file
            # Remove old image if it exists and is not a URL
            if item.image_url and not item.image_url.startswith('http'):
                remove_file(item.image_url)
            try:
                item.image_url = save_uploaded_file(request.files['image'], subfolder='marketplace_images')
                print(f"[UPDATE_MARKETPLACE_ITEM] New image saved to {item.image_url}")
            except Exception as e:
                current_app.logger.error(f"[UPDATE_MARKETPLACE_ITEM] Image upload failed: {e}")
                return {'error': f"Image upload failed: {str(e)}"}, 400
        elif 'image_url' in item_data:
            if item_data['image_url'] == '' and item.image_url and not item.image_url.startswith('http'):
                # Remove image
                from ..utils.file_helpers import remove_file
                remove_file(item.image_url)
                item.image_url = None
            elif item_data['image_url']:
                item.image_url = item_data['image_url']
                
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Marketplace item updated successfully!',
            'item': item.to_dict()
        }
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[UPDATE_MARKETPLACE_ITEM] Error: {e}", exc_info=True)
        return {'error': str(e)}

def delete_marketplace_item(item_id):
    """
    Delete a marketplace item (Admin only)
    
    Args:
        item_id: ID of item to delete
        
    Returns:
        dict: Success/error response
    """
    try:
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {'error': 'Item not found'}
        
        db.session.delete(item)
        db.session.commit()
        
        return {'success': True}
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def get_all_marketplace_items():
    """
    Get all marketplace items (Admin only)
    
    Returns:
        list: List of all marketplace items
    """
    try:
        items = MarketplaceItem.query.order_by(MarketplaceItem.created_at.desc()).all()
        return [item.to_dict() for item in items]
        
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_MARKETPLACE_ITEMS_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def get_marketplace_item_by_id(item_id):
    """
    Get a single marketplace item by its ID (Admin only)
    
    Args:
        item_id: ID of the item
        
    Returns:
        dict: Item data or error
    """
    try:
        item = MarketplaceItem.query.get(item_id)
        if not item:
            return {'error': 'Item not found'}
        return {'item': item.to_dict()}
    except Exception as e:
        current_app.logger.error(f"[GET_MARKETPLACE_ITEM_BY_ID_ADMIN] Error: {e}", exc_info=True)
        return {'error': str(e)}

def get_marketplace_item_for_user(user_id, item_id):
    """
    Get a single marketplace item for a user with redemption/raffle data
    
    Args:
        user_id: ID of the user
        item_id: ID of the item
        
    Returns:
        dict: Item data with user redemption info or error
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
            
        item = MarketplaceItem.query.filter_by(id=item_id, is_active=True).first()
        if not item:
            return {'error': 'Item not found or inactive'}
        
        item_dict = item.to_dict()
        
        # Add user-specific data
        item_dict['user_xp'] = user.xp_balance
        
        # Check user redemption limits for DIRECT items
        if item.item_type == 'DIRECT' and item.redeem_limit_per_user is not None:
            user_redemption_count = UserRewardLog.query.filter_by(
                user_id=user_id,
                marketplace_item_id=item_id,
                reward_type='DIRECT_PURCHASE'
            ).count()
            item_dict['user_redemption_count'] = user_redemption_count
            item_dict['user_limit_reached'] = user_redemption_count >= item.redeem_limit_per_user
        else:
            item_dict['user_redemption_count'] = 0
            item_dict['user_limit_reached'] = False
        
        # Check user raffle entries for RAFFLE items
        if item.item_type == 'RAFFLE' and item.raffle_entries_per_user is not None:
            user_raffle_entries = UserRewardLog.query.filter_by(
                user_id=user_id,
                marketplace_item_id=item_id,
                reward_type='RAFFLE_ENTRY'
            ).count()
            item_dict['user_raffle_entries'] = user_raffle_entries
            item_dict['user_raffle_limit_reached'] = user_raffle_entries >= item.raffle_entries_per_user
        else:
            item_dict['user_raffle_entries'] = 0
            item_dict['user_raffle_limit_reached'] = False
        
        return {'item': item_dict}
        
    except Exception as e:
        current_app.logger.error(f"[GET_MARKETPLACE_ITEM_FOR_USER] Error: {e}", exc_info=True)
        return {'error': str(e)}

def get_reward_logs_for_admin():
    """
    Get all reward logs for admin management
    
    Returns:
        list: List of reward logs with user and item details
    """
    try:
        logs = db.session.query(UserRewardLog, User, MarketplaceItem)\
            .join(User, UserRewardLog.user_id == User.id)\
            .join(MarketplaceItem, UserRewardLog.marketplace_item_id == MarketplaceItem.id)\
            .order_by(UserRewardLog.redeemed_at.desc()).all()
        
        result = []
        for log, user, item in logs:
            log_dict = log.to_dict()
            log_dict['user_name'] = user.name
            log_dict['user_email'] = user.email
            result.append(log_dict)
        
        return result
        
    except Exception as e:
        return {'error': str(e)}

def update_reward_status(log_id, status, notes=None):
    """
    Update status of a reward redemption (Admin only)
    
    Args:
        log_id: ID of reward log
        status: New status
        notes: Optional admin notes
        
    Returns:
        dict: Success/error response
    """
    try:
        log = UserRewardLog.query.get(log_id)
        if not log:
            return {'error': 'Reward log not found'}
        
        log.status = status
        if notes:
            log.notes = notes
        
        db.session.commit()
        
        return {'success': True}
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)} 