# stripe_webhook_routes.py
import stripe
import json
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models import Business, User, StripeTransaction, BusinessTier, AIPointsPackage, ResponsePackage, QuestPackage, AdminSeatPackage
from app.controllers.business_controller import BusinessController
from app.controllers.ai_points_package_controller import AIPointsPackageController
from app.controllers.quest_package_controller import QuestPackageController
from app.controllers.admin_seat_package_controller import AdminSeatPackageController
from datetime import datetime
import os

stripe_webhook_bp = Blueprint('stripe_webhook', __name__)

# Get Stripe webhook secret from environment
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

@stripe_webhook_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')

    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        current_app.logger.info(f"[STRIPE_WEBHOOK] Received event: {event['type']}")
        
    except ValueError as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Invalid payload: {e}")
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Invalid signature: {e}")
        return jsonify({'error': 'Invalid signature'}), 400

    # Handle the event
    try:
        if event['type'] == 'payment_intent.succeeded':
            return handle_payment_succeeded(event['data']['object'])
        elif event['type'] == 'payment_intent.payment_failed':
            return handle_payment_failed(event['data']['object'])
        elif event['type'] == 'checkout.session.completed':
            return handle_checkout_completed(event['data']['object'])
        elif event['type'] == 'invoice.payment_succeeded':
            return handle_subscription_payment_succeeded(event['data']['object'])
        elif event['type'] == 'customer.subscription.created':
            return handle_subscription_created(event['data']['object'])
        elif event['type'] == 'customer.subscription.updated':
            return handle_subscription_updated(event['data']['object'])
        elif event['type'] == 'customer.subscription.deleted':
            return handle_subscription_cancelled(event['data']['object'])
        else:
            current_app.logger.info(f"[STRIPE_WEBHOOK] Unhandled event type: {event['type']}")
            return jsonify({'status': 'success'}), 200
            
    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing event {event['type']}: {e}", exc_info=True)
        return jsonify({'error': 'Webhook processing failed'}), 500

def handle_payment_succeeded(payment_intent):
    """Handle successful payment intent"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Processing payment success: {payment_intent['id']}")
        
        # Check if already processed
        existing_transaction = StripeTransaction.query.filter_by(
            stripe_charge_id=payment_intent['id']
        ).first()
        
        if existing_transaction:
            current_app.logger.info(f"[STRIPE_WEBHOOK] Payment {payment_intent['id']} already processed")
            return jsonify({'status': 'already_processed'}), 200

        metadata = payment_intent.get('metadata', {})
        business_id = metadata.get('business_id')
        user_id = metadata.get('user_id')
        
        if not business_id:
            current_app.logger.error(f"[STRIPE_WEBHOOK] No business_id in metadata for {payment_intent['id']}")
            return jsonify({'error': 'Missing business_id'}), 400

        business = Business.query.get(int(business_id))
        if not business:
            current_app.logger.error(f"[STRIPE_WEBHOOK] Business {business_id} not found")
            return jsonify({'error': 'Business not found'}), 404

        # Determine payment type and process accordingly
        if metadata.get('subscription_upgrade') == 'true':
            return process_subscription_upgrade(payment_intent, business, user_id)
        elif metadata.get('package_id'):
            return process_ai_points_purchase(payment_intent, business, user_id)
        elif metadata.get('response_quota_purchase') == 'true':
            return process_response_purchase(payment_intent, business, user_id)
        elif metadata.get('quest_package_id'):
            return process_quest_purchase(payment_intent, business, user_id)
        elif metadata.get('admin_seat_package_id'):
            return process_admin_seat_purchase(payment_intent, business, user_id)
        else:
            current_app.logger.error(f"[STRIPE_WEBHOOK] Unknown payment type for {payment_intent['id']}")
            return jsonify({'error': 'Unknown payment type'}), 400

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error in handle_payment_succeeded: {e}", exc_info=True)
        return jsonify({'error': 'Processing failed'}), 500

def process_subscription_upgrade(payment_intent, business, user_id):
    """Process business tier subscription upgrade"""
    try:
        metadata = payment_intent['metadata']
        target_tier_id = int(metadata['target_tier_id'])
        
        target_tier = BusinessTier.query.get(target_tier_id)
        if not target_tier:
            current_app.logger.error(f"[STRIPE_WEBHOOK] Target tier {target_tier_id} not found")
            return jsonify({'error': 'Target tier not found'}), 404

        # Update business tier
        old_tier_name = business.tier_info.name if business.tier_info else 'None'
        business.tier_id = target_tier_id
        
        # Reset billing cycle for new tier
        business.billing_cycle_start = datetime.utcnow()
        business.monthly_ai_points_quota = target_tier.ai_points_included
        business.ai_points_monthly = target_tier.ai_points_included
        
        # Update limits based on new tier
        business.monthly_response_limit = target_tier.monthly_response_limit
        business.monthly_quest_limit = target_tier.monthly_quest_limit
        business.admin_seat_limit = target_tier.admin_seat_limit

        # Create transaction record
        transaction = StripeTransaction(
            business_id=business.id,
            user_id=int(user_id) if user_id else None,
            stripe_charge_id=payment_intent['id'],
            amount_paid=payment_intent['amount'],
            points_purchased=0,
            status='succeeded'
        )
        
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_WEBHOOK] Business {business.id} upgraded from {old_tier_name} to {target_tier.name}")
        return jsonify({'status': 'subscription_upgraded'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing subscription upgrade: {e}", exc_info=True)
        return jsonify({'error': 'Subscription upgrade failed'}), 500

def process_ai_points_purchase(payment_intent, business, user_id):
    """Process AI points package purchase"""
    try:
        metadata = payment_intent['metadata']
        package_id = int(metadata['package_id'])
        points_to_add = int(metadata['points'])
        package_name = metadata.get('package_name', 'Unknown Package')

        # Add points to business
        success, message = BusinessController.add_ai_points(
            business.id,
            points_to_add,
            f"STRIPE_PURCHASE_{package_name.upper().replace(' ', '_')}",
            int(user_id) if user_id else None
        )

        if not success:
            current_app.logger.error(f"[STRIPE_WEBHOOK] Failed to add AI points: {message}")
            return jsonify({'error': f'Failed to add points: {message}'}), 500

        # Create transaction record
        transaction = StripeTransaction(
            business_id=business.id,
            user_id=int(user_id) if user_id else None,
            stripe_charge_id=payment_intent['id'],
            amount_paid=payment_intent['amount'],
            points_purchased=points_to_add,
            status='succeeded'
        )
        
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_WEBHOOK] Added {points_to_add} AI points to business {business.id}")
        return jsonify({'status': 'ai_points_added'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing AI points purchase: {e}", exc_info=True)
        return jsonify({'error': 'AI points purchase failed'}), 500

def process_response_purchase(payment_intent, business, user_id):
    """Process response quota purchase"""
    try:
        metadata = payment_intent['metadata']
        responses_to_add = int(metadata['responses'])
        package_key = metadata.get('package', 'UNKNOWN')

        # Add responses to business
        success, message = BusinessController.add_response_quota(
            business.id,
            responses_to_add,
            f"PURCHASE_{package_key.upper()}",
            int(user_id) if user_id else None
        )

        if not success:
            current_app.logger.error(f"[STRIPE_WEBHOOK] Failed to add responses: {message}")
            return jsonify({'error': f'Failed to add responses: {message}'}), 500

        # Create transaction record
        transaction = StripeTransaction(
            business_id=business.id,
            user_id=int(user_id) if user_id else None,
            stripe_charge_id=payment_intent['id'],
            amount_paid=payment_intent['amount'],
            responses_purchased=responses_to_add,
            status='succeeded'
        )
        
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_WEBHOOK] Added {responses_to_add} responses to business {business.id}")
        return jsonify({'status': 'responses_added'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing response purchase: {e}", exc_info=True)
        return jsonify({'error': 'Response purchase failed'}), 500

def process_quest_purchase(payment_intent, business, user_id):
    """Process quest package purchase"""
    try:
        metadata = payment_intent['metadata']
        quest_package_id = int(metadata['quest_package_id'])
        credits_to_add = int(metadata['quest_credits'])

        # Add quest credits to business
        business.quest_credits_purchased += credits_to_add

        # Create transaction record
        transaction = StripeTransaction(
            business_id=business.id,
            user_id=int(user_id) if user_id else None,
            stripe_charge_id=payment_intent['id'],
            amount_paid=payment_intent['amount'],
            quest_credits_purchased=credits_to_add,
            status='succeeded'
        )
        
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_WEBHOOK] Added {credits_to_add} quest credits to business {business.id}")
        return jsonify({'status': 'quest_credits_added'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing quest purchase: {e}", exc_info=True)
        return jsonify({'error': 'Quest purchase failed'}), 500

def process_admin_seat_purchase(payment_intent, business, user_id):
    """Process admin seat package purchase"""
    try:
        metadata = payment_intent['metadata']
        admin_seat_package_id = int(metadata['admin_seat_package_id'])
        seats_to_add = int(metadata['admin_seats'])

        # Add admin seats to business
        business.admin_seats_purchased += seats_to_add

        # Create transaction record
        transaction = StripeTransaction(
            business_id=business.id,
            user_id=int(user_id) if user_id else None,
            stripe_charge_id=payment_intent['id'],
            amount_paid=payment_intent['amount'],
            admin_seats_purchased=seats_to_add,
            status='succeeded'
        )
        
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_WEBHOOK] Added {seats_to_add} admin seats to business {business.id}")
        return jsonify({'status': 'admin_seats_added'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error processing admin seat purchase: {e}", exc_info=True)
        return jsonify({'error': 'Admin seat purchase failed'}), 500

def handle_payment_failed(payment_intent):
    """Handle failed payment intent"""
    try:
        current_app.logger.warning(f"[STRIPE_WEBHOOK] Payment failed: {payment_intent['id']}")
        
        # Create failed transaction record
        metadata = payment_intent.get('metadata', {})
        business_id = metadata.get('business_id')
        user_id = metadata.get('user_id')
        
        if business_id:
            transaction = StripeTransaction(
                business_id=int(business_id),
                user_id=int(user_id) if user_id else None,
                stripe_charge_id=payment_intent['id'],
                amount_paid=payment_intent['amount'],
                points_purchased=0,
                status='failed'
            )
            
            db.session.add(transaction)
            db.session.commit()

        return jsonify({'status': 'payment_failed_logged'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling payment failure: {e}", exc_info=True)
        return jsonify({'error': 'Failed to log payment failure'}), 500

def handle_checkout_completed(session):
    """Handle completed Stripe Checkout session"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Checkout completed: {session['id']}")
        
        # Retrieve the payment intent from the session
        payment_intent_id = session.get('payment_intent')
        if payment_intent_id:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return handle_payment_succeeded(payment_intent)
        
        return jsonify({'status': 'checkout_completed'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling checkout completion: {e}", exc_info=True)
        return jsonify({'error': 'Checkout completion failed'}), 500

def handle_subscription_payment_succeeded(invoice):
    """Handle successful subscription payment"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Subscription payment succeeded: {invoice['id']}")
        
        # For recurring subscription payments, we might want to:
        # 1. Reset monthly quotas
        # 2. Add monthly AI points
        # 3. Log the payment
        
        customer_id = invoice.get('customer')
        if customer_id:
            # Find business by Stripe customer ID (would need to add this field to Business model)
            # For now, we'll just log the event
            current_app.logger.info(f"[STRIPE_WEBHOOK] Recurring payment for customer {customer_id}")
        
        return jsonify({'status': 'subscription_payment_processed'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling subscription payment: {e}", exc_info=True)
        return jsonify({'error': 'Subscription payment processing failed'}), 500

def handle_subscription_created(subscription):
    """Handle new subscription creation"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Subscription created: {subscription['id']}")
        return jsonify({'status': 'subscription_created'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling subscription creation: {e}", exc_info=True)
        return jsonify({'error': 'Subscription creation failed'}), 500

def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Subscription updated: {subscription['id']}")
        return jsonify({'status': 'subscription_updated'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling subscription update: {e}", exc_info=True)
        return jsonify({'error': 'Subscription update failed'}), 500

def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    try:
        current_app.logger.info(f"[STRIPE_WEBHOOK] Subscription cancelled: {subscription['id']}")
        
        # Here you might want to:
        # 1. Downgrade business to free tier
        # 2. Notify business admins
        # 3. Set end-of-billing-period access
        
        return jsonify({'status': 'subscription_cancelled'}), 200

    except Exception as e:
        current_app.logger.error(f"[STRIPE_WEBHOOK] Error handling subscription cancellation: {e}", exc_info=True)
        return jsonify({'error': 'Subscription cancellation failed'}), 500

