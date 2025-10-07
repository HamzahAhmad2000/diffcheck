"""
Marketplace Routes
Handles marketplace items, redemptions, and user rewards API endpoints
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.marketplace_controller import (
    list_items_for_user, redeem_item, enter_raffle, get_user_rewards,
    create_marketplace_item, update_marketplace_item, delete_marketplace_item,
    get_all_marketplace_items, get_reward_logs_for_admin, update_reward_status,
    get_marketplace_item_by_id, get_marketplace_item_for_user, MarketplaceController
)
from ..controllers.auth_controller import token_required, admin_required, token_optional
import csv
import io
from flask import make_response
from flask import current_app

marketplace_bp = Blueprint('marketplace', __name__)
admin_marketplace_bp = Blueprint('admin_marketplace', __name__, url_prefix='/api/admin/marketplace')

logger = None # Initialize logger if needed: import logging; logger = logging.getLogger(__name__)

# User routes

@marketplace_bp.route('/marketplace/items', methods=['GET'])
@token_required
def get_marketplace_items():
    """Get marketplace items with optional filters"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        # Get filter parameters
        filters = {}
        if request.args.get('xp_min'):
            filters['xp_min'] = int(request.args.get('xp_min'))
        if request.args.get('xp_max'):
            filters['xp_max'] = int(request.args.get('xp_max'))
        if request.args.get('type'):
            filters['item_type'] = request.args.get('type')
        
        result = list_items_for_user(current_user.id, filters)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/marketplace/items/<int:item_id>', methods=['GET'])
@token_required
def get_marketplace_item_detail(item_id):
    """Get single marketplace item details for user"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result = get_marketplace_item_for_user(current_user.id, item_id)
        
        if 'error' in result:
            if result['error'] == 'Item not found or inactive':
                return jsonify({'error': result['error']}), 404
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/marketplace/items/<int:item_id>/redeem', methods=['POST'])
@token_required
def redeem_marketplace_item(item_id):
    """Initiate purchase flow for a direct marketplace item (redirects to delivery form)"""
    try:
        from ..controllers.purchase_controller import initiate_purchase
        
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = initiate_purchase(current_user.id, item_id)
        return jsonify(result), status_code
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/marketplace/items/<int:item_id>/enter-raffle', methods=['POST'])
@token_required
def enter_marketplace_raffle(item_id):
    """Enter a raffle for a marketplace item"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result = enter_raffle(current_user.id, item_id)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/marketplace/my-rewards', methods=['GET'])
@token_required
def get_my_rewards():
    """Get user's reward history"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result = get_user_rewards(current_user.id)
        
        if isinstance(result, dict) and 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({'rewards': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@marketplace_bp.route('/marketplace/my-rewards/export', methods=['GET'])
@token_required
def export_my_rewards():
    """Export user's reward history as CSV"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        rewards = get_user_rewards(current_user.id)
        
        if isinstance(rewards, dict) and 'error' in rewards:
            return jsonify({'error': rewards['error']}), 400
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['Reward', 'Type', 'XP Spent', 'Date', 'Status'])
        
        # Write data
        for reward in rewards:
            writer.writerow([
                reward['reward_title'],
                reward['reward_type'],
                reward['xp_spent'],
                reward['date'],
                reward['status']
            ])
        
        # Create response
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=my_rewards.csv'
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin routes

@admin_marketplace_bp.route('/items', methods=['GET'])
@token_required
@admin_required
def admin_get_all_marketplace_items():
    """Get all marketplace items (Admin only)"""
    try:
        result = get_all_marketplace_items()
        
        if isinstance(result, dict) and 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({'items': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/items/<int:item_id>', methods=['GET'])
@token_required
@admin_required
def admin_get_marketplace_item_by_id(item_id):
    """Get a single marketplace item by ID (Admin only)"""
    try:
        result = get_marketplace_item_by_id(item_id)
        if 'error' in result and result['error'] == 'Item not found':
            return jsonify(result), 404
        if 'error' in result:
            return jsonify(result), 500
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f"[ROUTE_ADMIN_GET_ITEM_BY_ID] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/items', methods=['POST'])
@token_required
@admin_required
def admin_create_marketplace_item():
    """Create a new marketplace item (Admin only)"""
    try:
        # Data will be in request.form and request.files due to FormData
        data = request.form.to_dict()
        result = create_marketplace_item(data) # Pass form data, controller handles files via request.files
        
        if 'error' in result:
            # Check for specific error types if necessary, e.g., validation errors
            if "Missing required field" in result['error'] or "Image upload failed" in result['error'] :
                 return jsonify(result), 400
            return jsonify(result), 500
        
        return jsonify(result), 201
        
    except Exception as e:
        current_app.logger.error(f"[ROUTE_ADMIN_CREATE_ITEM] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/items/<int:item_id>', methods=['PUT'])
@token_required
@admin_required
def admin_update_marketplace_item(item_id):
    """Update a marketplace item (Admin only)"""
    try:
        # Check if request has JSON data (for simple updates like toggling active status)
        if request.is_json:
            data = request.get_json()
        else:
            # Data will be in request.form and request.files due to FormData
            data = request.form.to_dict()
            
        result = update_marketplace_item(item_id, data) # Pass data, controller handles files
        
        if 'error' in result and result['error'] == 'Item not found':
            return jsonify(result), 404
        if 'error' in result:
            if "Image upload failed" in result['error']:
                return jsonify(result), 400
            return jsonify(result), 500
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f"[ROUTE_ADMIN_UPDATE_ITEM] Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/items/<int:item_id>/feature', methods=['PATCH'])
@token_required
@admin_required
def admin_feature_marketplace_item(item_id):
    """Feature/unfeature a marketplace item"""
    data = request.get_json() or {}
    featured_flag = bool(data.get('featured', True))
    result, status = MarketplaceController.set_item_featured(item_id, featured_flag, g.current_user.id if hasattr(g, 'current_user') else None)
    return jsonify(result), status

@admin_marketplace_bp.route('/items/<int:item_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_marketplace_item(item_id):
    """Delete a marketplace item (Admin only)"""
    try:
        result = delete_marketplace_item(item_id)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/rewards', methods=['GET'])
@token_required
@admin_required
def admin_get_all_rewards():
    """Get all reward logs for admin management"""
    try:
        result = get_reward_logs_for_admin()
        
        if isinstance(result, dict) and 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({'rewards': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_marketplace_bp.route('/rewards/<int:log_id>/status', methods=['PUT'])
@token_required
@admin_required
def admin_update_reward_status(log_id):
    """Update status of a reward redemption (Admin only)"""
    try:
        data = request.get_json()
        status = data.get('status')
        notes = data.get('notes')
        
        if not status:
            return jsonify({'error': 'Status is required'}), 400
        
        result = update_reward_status(log_id, status, notes)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 