"""
Stripe Routes
Handles webhook events and success redirects
"""

from flask import Blueprint, request, jsonify, redirect, url_for, g
from ..services.stripe_service import StripeService
from ..controllers.auth_controller import token_required
import logging

logger = logging.getLogger(__name__)

stripe_bp = Blueprint('stripe', __name__, url_prefix='/api/stripe')

@stripe_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Central Stripe webhook handler
    SOLE PURPOSE: Verify signature, extract customer ID, call sync
    
    This endpoint receives ALL Stripe events and processes them uniformly
    """
    try:
        # Get raw body and signature
        payload = request.data
        signature = request.headers.get('Stripe-Signature')
        
        if not signature:
            logger.warning("Webhook received without Stripe-Signature header")
            return jsonify({"error": "Missing signature"}), 400
        
        # Verify signature and construct event
        try:
            event = StripeService.verify_webhook_signature(payload, signature)
        except ValueError as e:
            logger.error(f"Webhook signature verification failed: {str(e)}")
            return jsonify({"error": "Invalid signature"}), 400
        
        # Process the event (this will call sync if it's a tracked event)
        StripeService.process_webhook_event(event)
        
        # Always return 200 to acknowledge receipt
        return jsonify({"received": True}), 200
        
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        # Still return 200 to prevent Stripe from retrying
        return jsonify({"received": True, "error": str(e)}), 200


@stripe_bp.route('/success', methods=['GET'])
@token_required
def stripe_success():
    """
    Success endpoint - handles redirect after successful Stripe checkout
    
    CRITICAL: Eagerly syncs Stripe data to prevent race conditions
    The user might arrive here before the webhook, so we sync immediately
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            logger.warning("Success endpoint called without authenticated user")
            return redirect('/')
        
        # Get Stripe customer ID for this user
        stripe_customer_id = StripeService.get_stripe_customer_by_user_id(current_user.id)
        
        if not stripe_customer_id:
            logger.warning(f"No Stripe customer found for user {current_user.id}")
            return redirect('/')
        
        # EAGER SYNC: Fetch latest data from Stripe immediately
        StripeService.sync_stripe_data_to_kv(stripe_customer_id)
        
        logger.info(f"Successfully synced Stripe data for user {current_user.id} after checkout")
        
        # Get redirect URL from query params or default to dashboard
        redirect_url = request.args.get('redirect', '/')
        
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"Error in success endpoint: {str(e)}")
        return redirect('/')


@stripe_bp.route('/customer-portal', methods=['POST'])
@token_required
def create_customer_portal_session():
    """
    Create a Stripe Customer Portal session for managing subscriptions
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401
        
        # Get Stripe customer ID
        stripe_customer_id = StripeService.get_stripe_customer_by_user_id(current_user.id)
        
        if not stripe_customer_id:
            return jsonify({"error": "No Stripe customer found"}), 404
        
        import stripe
        from flask import current_app
        
        # Create portal session
        return_url = request.json.get('return_url', request.host_url)
        
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=return_url
        )
        
        return jsonify({
            "success": True,
            "url": session.url
        }), 200
        
    except Exception as e:
        logger.error(f"Error creating customer portal session: {str(e)}")
        return jsonify({"error": str(e)}), 500


@stripe_bp.route('/subscription-status', methods=['GET'])
@token_required
def get_subscription_status():
    """
    Get current subscription status from KV store (single source of truth)
    """
    try:
        current_user = g.current_user
        
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401
        
        # Get Stripe customer ID
        stripe_customer_id = StripeService.get_stripe_customer_by_user_id(current_user.id)
        
        if not stripe_customer_id:
            return jsonify({
                "success": True,
                "status": "none",
                "hasStripeCustomer": False
            }), 200
        
        # Get cached data from KV
        subscription_data = StripeService.get_stripe_customer_data(stripe_customer_id)
        
        if not subscription_data:
            # No cached data, sync from Stripe
            subscription_data = StripeService.sync_stripe_data_to_kv(stripe_customer_id)
        
        return jsonify({
            "success": True,
            "hasStripeCustomer": True,
            "subscription": subscription_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        return jsonify({"error": str(e)}), 500


@stripe_bp.route('/sync/<int:user_id>', methods=['POST'])
@token_required
def manual_sync_user(user_id):
    """
    Manually trigger a sync for a user (admin only)
    Useful for debugging or forcing a refresh
    """
    try:
        current_user = g.current_user
        
        # Only allow admins or the user themselves
        from ..models import Admin
        is_admin = Admin.query.filter_by(id=current_user.id).first() is not None
        
        if not is_admin and current_user.id != user_id:
            return jsonify({"error": "Unauthorized"}), 403
        
        # Get Stripe customer ID
        stripe_customer_id = StripeService.get_stripe_customer_by_user_id(user_id)
        
        if not stripe_customer_id:
            return jsonify({"error": "No Stripe customer found for user"}), 404
        
        # Trigger sync
        subscription_data = StripeService.sync_stripe_data_to_kv(stripe_customer_id)
        
        return jsonify({
            "success": True,
            "message": "Sync completed",
            "subscription": subscription_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error in manual sync: {str(e)}")
        return jsonify({"error": str(e)}), 500

