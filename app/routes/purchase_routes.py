"""
Purchase Routes
Handles marketplace purchase flow, delivery information, and order management
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.purchase_controller import (
    initiate_purchase, submit_delivery_info, get_purchase_details,
    get_user_purchases, get_raffle_entries, select_raffle_winner,
    get_admin_purchases, update_purchase_status
)
from ..controllers.auth_controller import token_required, admin_required
import logging

logger = logging.getLogger(__name__)

purchase_bp = Blueprint('purchase', __name__)
admin_purchase_bp = Blueprint('admin_purchase', __name__, url_prefix='/api/admin/purchase')

# User purchase routes

@purchase_bp.route('/marketplace/purchase/<int:item_id>', methods=['POST'])
@token_required
def initiate_marketplace_purchase(item_id):
    """Initiate a direct purchase for a marketplace item"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = initiate_purchase(current_user.id, item_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error initiating purchase: {e}")
        return jsonify({'error': str(e)}), 500

@purchase_bp.route('/marketplace/delivery-info/<int:purchase_id>', methods=['POST'])
@token_required
def submit_marketplace_delivery_info(purchase_id):
    """Submit delivery information for a purchase"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        delivery_data = request.get_json()
        if not delivery_data:
            return jsonify({'error': 'Missing delivery information.'}), 400

        result, status_code = submit_delivery_info(current_user.id, purchase_id, delivery_data)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error submitting delivery info: {e}")
        return jsonify({'error': str(e)}), 500

@purchase_bp.route('/marketplace/purchase/<int:purchase_id>', methods=['GET'])
@token_required
def get_marketplace_purchase_details(purchase_id):
    """Get purchase details for confirmation screen"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = get_purchase_details(current_user.id, purchase_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error getting purchase details: {e}")
        return jsonify({'error': str(e)}), 500

@purchase_bp.route('/marketplace/my-purchases', methods=['GET'])
@token_required
def get_my_purchases():
    """Get all purchases for the current user"""
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result, status_code = get_user_purchases(current_user.id)
        return jsonify({'purchases': result}), status_code
        
    except Exception as e:
        logger.error(f"Error getting user purchases: {e}")
        return jsonify({'error': str(e)}), 500

# Admin routes for raffle and purchase management

@admin_purchase_bp.route('/raffle-entries', methods=['GET'])
@token_required
@admin_required
def admin_get_raffle_entries():
    """Get all raffle entries for admin management"""
    try:
        current_admin = g.current_user
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        item_id = request.args.get('item_id', type=int)
        result, status_code = get_raffle_entries(current_admin.id, item_id)
        return jsonify({'raffle_entries': result}), status_code
        
    except Exception as e:
        logger.error(f"Error getting raffle entries: {e}")
        return jsonify({'error': str(e)}), 500

@admin_purchase_bp.route('/raffle-winner/<int:item_id>', methods=['POST'])
@token_required
@admin_required
def admin_select_raffle_winner(item_id):
    """Randomly select a raffle winner for an item"""
    try:
        current_admin = g.current_user
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        result, status_code = select_raffle_winner(current_admin.id, item_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error selecting raffle winner: {e}")
        return jsonify({'error': str(e)}), 500

@admin_purchase_bp.route('/purchases', methods=['GET'])
@token_required
@admin_required
def admin_get_all_purchases():
    """Get all purchases for admin management"""
    try:
        current_admin = g.current_user
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        result, status_code = get_admin_purchases(current_admin.id)
        return jsonify({'purchases': result}), status_code
        
    except Exception as e:
        logger.error(f"Error getting admin purchases: {e}")
        return jsonify({'error': str(e)}), 500

@admin_purchase_bp.route('/purchases/<int:purchase_id>/status', methods=['PUT'])
@token_required
@admin_required
def admin_update_purchase_status(purchase_id):
    """Update purchase status (admin only)"""
    try:
        current_admin = g.current_user
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Missing status field.'}), 400

        new_status = data['status']
        notes = data.get('notes')

        result, status_code = update_purchase_status(current_admin.id, purchase_id, new_status, notes)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error updating purchase status: {e}")
        return jsonify({'error': str(e)}), 500 

# ---- Legacy/Admin Alias Blueprints for Frontend Compatibility ----

admin_purchases_bp = Blueprint('admin_purchases', __name__, url_prefix='/api/admin/purchases')
admin_raffles_bp = Blueprint('admin_raffles', __name__, url_prefix='/api/admin/raffles')

# ---------------------- Purchase Status Update ----------------------
@admin_purchases_bp.route('/<int:purchase_id>/status', methods=['PUT'])
@token_required
@admin_required
def admin_update_purchase_status_alias(purchase_id):
    """Update purchase status (admin only) - Frontend compatibility alias"""
    try:
        current_admin = g.current_user
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Missing status field.'}), 400

        new_status = data['status']
        notes = data.get('notes')

        result, status_code = update_purchase_status(current_admin.id, purchase_id, new_status, notes)
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error updating purchase status: {e}")
        return jsonify({'error': str(e)}), 500

# ---------------------- Purchases (Delivery Info) ----------------------
@admin_purchases_bp.route('/delivery-info', methods=['GET'])
@token_required
@admin_required
def admin_get_purchases_delivery_info():
    """Fetch purchases filtered by delivery status for admin dashboards (alias endpoint)."""
    try:
        current_admin = getattr(g, 'current_user', None)
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        # Query params
        limit = request.args.get('limit', default=20, type=int)
        page = request.args.get('page', default=1, type=int)
        status_filter = request.args.get('status')  # e.g. "PENDING_DELIVERY_INFO" / "PENDING" etc.
        search = request.args.get('search', '')

        # Re-use existing controller logic
        result, status_code = get_admin_purchases(current_admin.id)
        if status_code != 200:
            return jsonify(result), status_code

        # Apply search filter if provided
        if search:
            search_lower = search.lower()
            result = [p for p in result if (
                search_lower in str(p.get('user_name', '')).lower() or
                search_lower in str(p.get('user_email', '')).lower() or
                search_lower in str(p.get('marketplace_item', {}).get('name', '')).lower()
            )]

        # Optional status filtering
        if status_filter:
            result = [p for p in result if str(p.get('purchase_status')) == status_filter]

        # Simple pagination
        total_items = len(result)
        start = (page - 1) * limit
        end = start + limit
        paginated = result[start:end]

        return jsonify({
            'delivery_info': paginated,  # Match frontend expectation
            'total': total_items,
            'total_pages': (total_items + limit - 1) // limit,
            'page': page,
            'limit': limit
        }), 200

    except Exception as e:
        logger.error(f"Error getting delivery info: {e}")
        return jsonify({'error': str(e)}), 500

# --------------------------- Raffles -----------------------------------
@admin_raffles_bp.route('/entries', methods=['GET'])
@token_required
@admin_required
def admin_get_raffle_entries_alias():
    """Alias endpoint: GET /api/admin/raffles/entries maps to existing raffle entries logic."""
    try:
        current_admin = getattr(g, 'current_user', None)
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        # Query params
        item_id = request.args.get('item_id', type=int)
        limit = request.args.get('limit', default=20, type=int)
        page = request.args.get('page', default=1, type=int)
        status_filter = request.args.get('status')
        search = request.args.get('search', '')
        
        result, status_code = get_raffle_entries(current_admin.id, item_id)
        if status_code != 200:
            return jsonify({'error': result.get('error', 'Failed to get raffle entries')}), status_code

        # Apply filters if provided
        entries = result
        if status_filter:
            entries = [e for e in entries if e.get('status') == status_filter]
        
        if search:
            search_lower = search.lower()
            entries = [e for e in entries if (
                search_lower in str(e.get('user', {}).get('username', '')).lower() or
                search_lower in str(e.get('user', {}).get('email', '')).lower()
            )]

        # Simple pagination
        total_items = len(entries)
        start = (page - 1) * limit
        end = start + limit
        paginated = entries[start:end]

        return jsonify({
            'entries': paginated,
            'total': total_items,
            'total_pages': (total_items + limit - 1) // limit,
            'page': page,
            'limit': limit
        }), 200
    except Exception as e:
        logger.error(f"Error getting raffle entries (alias): {e}")
        return jsonify({'error': str(e)}), 500

@admin_raffles_bp.route('/<int:item_id>/select-winner', methods=['POST'])
@token_required
@admin_required
def admin_select_raffle_winner_alias(item_id):
    """Alias endpoint: POST /api/admin/raffles/<item_id>/select-winner maps to existing raffle winner logic."""
    try:
        current_admin = getattr(g, 'current_user', None)
        if not current_admin:
            return jsonify({'error': 'Admin authentication required.'}), 401

        result, status_code = select_raffle_winner(current_admin.id, item_id)
        return jsonify(result), status_code
    except Exception as e:
        logger.error(f"Error selecting raffle winner (alias): {e}")
        return jsonify({'error': str(e)}), 500 