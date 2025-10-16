"""
Season Pass Purchase Routes (New Stripe Integration)
Routes for creating Stripe checkout sessions for season pass purchases
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.auth_controller import token_required
from ..controllers.season_pass_payment_controller import SeasonPassPaymentController
from ..models import User
import logging

logger = logging.getLogger(__name__)

season_pass_purchase_bp = Blueprint('season_pass_purchase', __name__, url_prefix='/api/season-pass')


@season_pass_purchase_bp.route('/purchase/stripe', methods=['POST'])
@token_required
def create_stripe_checkout():
    """
    Create a Stripe Checkout Session for Season Pass purchase
    
    Body:
        tier_type: 'LUNAR' or 'TOTALITY'
        
    Returns:
        checkout_url: URL to redirect user to Stripe Checkout
        session_id: Stripe session ID
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        tier_type = data.get('tier_type')
        
        if not tier_type:
            return jsonify({'error': 'tier_type is required'}), 400
        
        # Create checkout session using new methodology
        result = SeasonPassPaymentController.create_checkout_session(
            user_id=current_user.id,
            user_email=current_user.email,
            user_name=current_user.name or current_user.username,
            tier_type=tier_type
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error creating Stripe checkout: {str(e)}")
        return jsonify({'error': 'Failed to create checkout session'}), 500


@season_pass_purchase_bp.route('/purchase/success', methods=['GET'])
@token_required
def season_pass_success():
    """
    Handle successful season pass purchase
    Called after user returns from Stripe Checkout
    This triggers eager fulfillment
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check and fulfill any pending purchases
        result = SeasonPassPaymentController.check_and_fulfill_purchase(current_user.id)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error processing season pass success: {str(e)}")
        return jsonify({'error': 'Failed to process purchase'}), 500


@season_pass_purchase_bp.route('/payment-methods', methods=['GET'])
def get_payment_methods():
    """
    Get available payment methods for season pass
    """
    try:
        result = SeasonPassPaymentController.get_payment_methods()
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting payment methods: {str(e)}")
        return jsonify({'error': 'Failed to get payment methods'}), 500

