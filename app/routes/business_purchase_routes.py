"""
Business Purchase Routes (New Stripe Integration)
Routes for creating Stripe checkout sessions for business purchases
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.auth_controller import token_required
from ..controllers.business_purchase_controller import BusinessPurchaseController
from ..models import User, Business
import logging

logger = logging.getLogger(__name__)

business_purchase_bp = Blueprint('business_purchase', __name__, url_prefix='/api/business')


@business_purchase_bp.route('/purchase/stripe', methods=['POST'])
@token_required
def create_stripe_checkout():
    """
    Create a Stripe Checkout Session for any business package purchase
    
    Body:
        business_id: ID of the business
        package_type: 'ai_points', 'responses', 'quests', or 'admin_seats'
        package_id: ID of the specific package
        
    Returns:
        checkout_url: URL to redirect user to Stripe Checkout
        session_id: Stripe session ID
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        business_id = data.get('business_id')
        package_type = data.get('package_type')
        package_id = data.get('package_id')
        
        if not all([business_id, package_type, package_id]):
            return jsonify({'error': 'business_id, package_type, and package_id are required'}), 400
        
        # Verify user has access to this business
        business = Business.query.get(business_id)
        if not business:
            return jsonify({'error': 'Business not found'}), 404
        
        # Check if user is a business admin
        if current_user.role != 'business_admin' or current_user.business_id != business_id:
            # Also check if user is super admin
            from ..models import Admin
            is_admin = Admin.query.filter_by(id=current_user.id).first() is not None
            if not is_admin:
                return jsonify({'error': 'Unauthorized'}), 403
        
        # Create checkout session using new methodology
        result = BusinessPurchaseController.create_checkout_session_for_package(
            user_id=current_user.id,
            user_email=current_user.email,
            user_name=current_user.name or current_user.username,
            business_id=business_id,
            package_type=package_type,
            package_id=package_id
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error creating Stripe checkout: {str(e)}")
        return jsonify({'error': 'Failed to create checkout session'}), 500


@business_purchase_bp.route('/purchase/success', methods=['GET'])
@token_required
def business_purchase_success():
    """
    Handle successful business purchase
    Called after user returns from Stripe Checkout
    This triggers eager fulfillment
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check and fulfill any pending purchases
        result = BusinessPurchaseController.check_and_fulfill_purchase(current_user.id)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error processing business purchase success: {str(e)}")
        return jsonify({'error': 'Failed to process purchase'}), 500


# Convenient wrappers for specific package types

@business_purchase_bp.route('/purchase/ai-points', methods=['POST'])
@token_required
def purchase_ai_points():
    """
    Convenient endpoint for AI Points purchases
    
    Body:
        business_id: ID of the business
        package_id: ID of the AI Points package
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        data['package_type'] = 'ai_points'
        
        # Reuse the main endpoint logic
        request._cached_json = data  # Update request data
        return create_stripe_checkout()
        
    except Exception as e:
        logger.error(f"Error purchasing AI points: {str(e)}")
        return jsonify({'error': 'Failed to purchase AI points'}), 500


@business_purchase_bp.route('/purchase/responses', methods=['POST'])
@token_required
def purchase_responses():
    """
    Convenient endpoint for Response purchases
    
    Body:
        business_id: ID of the business
        package_id: ID of the Response package
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        data['package_type'] = 'responses'
        
        request._cached_json = data
        return create_stripe_checkout()
        
    except Exception as e:
        logger.error(f"Error purchasing responses: {str(e)}")
        return jsonify({'error': 'Failed to purchase responses'}), 500


@business_purchase_bp.route('/purchase/quests', methods=['POST'])
@token_required
def purchase_quests():
    """
    Convenient endpoint for Quest purchases
    
    Body:
        business_id: ID of the business
        package_id: ID of the Quest package
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        data['package_type'] = 'quests'
        
        request._cached_json = data
        return create_stripe_checkout()
        
    except Exception as e:
        logger.error(f"Error purchasing quests: {str(e)}")
        return jsonify({'error': 'Failed to purchase quests'}), 500


@business_purchase_bp.route('/purchase/admin-seats', methods=['POST'])
@token_required
def purchase_admin_seats():
    """
    Convenient endpoint for Admin Seat purchases
    
    Body:
        business_id: ID of the business
        package_id: ID of the Admin Seat package
    """
    try:
        current_user = g.current_user
        data = request.get_json()
        
        data['package_type'] = 'admin_seats'
        
        request._cached_json = data
        return create_stripe_checkout()
        
    except Exception as e:
        logger.error(f"Error purchasing admin seats: {str(e)}")
        return jsonify({'error': 'Failed to purchase admin seats'}), 500

