"""
Stripe Service
Central Stripe integration following the "How I Stay Sane" methodology
- Single source of truth: KV store (Redis)
- Central sync function: syncStripeDataToKV
- Simplified webhooks
- Eager sync on success
"""

import os
import logging
from typing import Optional, Dict, Any, Literal
from datetime import datetime
import stripe
from ..extensions import db
from flask import current_app

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Allowed events that trigger sync
ALLOWED_EVENTS = [
    # Covers one-time payments and initial subscription sign-ups
    "checkout.session.completed",
    
    # Core subscription lifecycle
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "customer.subscription.pending_update_applied",
    "customer.subscription.pending_update_expired",
    "customer.subscription.trial_will_end",
    
    # All billing and payment outcomes for subscriptions
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.payment_action_required",
    "invoice.upcoming",
    "invoice.marked_uncollectible",
    "invoice.payment_succeeded",

    # Redundant but safe underlying payment events
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
]


class StripeService:
    """Central Stripe service for all payment operations"""
    
    @staticmethod
    def _get_redis():
        """Get Redis connection from app context"""
        from flask import current_app, has_app_context

        # Check if we have app context and redis is available
        if has_app_context() and hasattr(current_app, 'redis'):
            return current_app.redis
        else:
            # Fallback - create mock Redis for development (no Redis server needed)
            logger.warning("Redis not available in app context, using MockRedis fallback")
            class MockRedis:
                def __init__(self):
                    self.store = {}
                def get(self, key):
                    return self.store.get(key)
                def set(self, key, value):
                    self.store[key] = value
                    return True
                def delete(self, key):
                    if key in self.store:
                        del self.store[key]
                    return True
            return MockRedis()
    
    @staticmethod
    def get_or_create_stripe_customer(user_id: int, user_email: str, user_name: str = None) -> str:
        """
        Get existing Stripe customer ID or create a new one
        This is the critical step - ALWAYS have a customer before checkout
        
        Args:
            user_id: Internal user ID
            user_email: User's email
            user_name: User's name (optional)
            
        Returns:
            Stripe customer ID
        """
        try:
            redis = StripeService._get_redis()
            kv_key = f"stripe:user:{user_id}"
            
            # Check if customer already exists in KV
            stripe_customer_id = redis.get(kv_key)
            
            if stripe_customer_id:
                # Verify the customer still exists in Stripe
                try:
                    stripe.Customer.retrieve(stripe_customer_id)
                    return stripe_customer_id
                except stripe.error.InvalidRequestError:
                    # Customer was deleted, need to create new one
                    logger.warning(f"Stripe customer {stripe_customer_id} no longer exists, creating new one")
                    redis.delete(kv_key)
            
            # Create new Stripe customer
            customer_data = {
                "email": user_email,
                "metadata": {
                    "userId": str(user_id),  # CRITICAL: Store userId in metadata
                }
            }
            
            if user_name:
                customer_data["name"] = user_name
            
            new_customer = stripe.Customer.create(**customer_data)
            
            # Store mapping in KV
            redis.set(kv_key, new_customer.id)
            
            logger.info(f"Created Stripe customer {new_customer.id} for user {user_id}")
            return new_customer.id
            
        except Exception as e:
            logger.error(f"Error getting/creating Stripe customer for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def sync_stripe_data_to_kv(customer_id: str) -> Dict[str, Any]:
        """
        THE CENTRAL SYNC FUNCTION
        Fetches latest data from Stripe and overwrites KV store
        This is the ONLY function that updates Stripe state in our system
        
        Args:
            customer_id: Stripe customer ID
            
        Returns:
            Dictionary with subscription/payment data
        """
        try:
            redis = StripeService._get_redis()
            kv_key = f"stripe:customer:{customer_id}"
            
            # Fetch latest subscription data from Stripe
            subscriptions = stripe.Subscription.list(
                customer=customer_id,
                limit=1,
                status='all',
                expand=['data.default_payment_method']
            )
            
            # No active subscriptions - check for one-time payments
            if len(subscriptions.data) == 0:
                # Check for successful payment intents (one-time purchases)
                payment_intents = stripe.PaymentIntent.list(
                    customer=customer_id,
                    limit=1
                )
                
                if len(payment_intents.data) > 0:
                    latest_payment = payment_intents.data[0]
                    
                    sub_data = {
                        "status": "one_time_payment",
                        "subscriptionId": None,
                        "priceId": None,
                        "paymentIntentId": latest_payment.id,
                        "paymentStatus": latest_payment.status,
                        "amountPaid": latest_payment.amount,
                        "currency": latest_payment.currency,
                        "created": latest_payment.created,
                        "currentPeriodEnd": None,
                        "currentPeriodStart": None,
                        "cancelAtPeriodEnd": False,
                        "paymentMethod": None
                    }
                else:
                    # No subscriptions or payments
                    sub_data = {"status": "none"}
                
                redis.set(kv_key, str(sub_data))
                logger.info(f"Synced Stripe data for customer {customer_id}: no active subscription")
                return sub_data
            
            # Get the subscription (limiting to one per customer as per pro tip)
            subscription = subscriptions.data[0]
            
            # Extract payment method info if available
            payment_method_info = None
            if subscription.default_payment_method:
                pm = subscription.default_payment_method
                if isinstance(pm, str):
                    # Need to expand it
                    pm = stripe.PaymentMethod.retrieve(pm)
                
                if pm.card:
                    payment_method_info = {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4
                    }
            
            # Build complete subscription state
            sub_data = {
                "subscriptionId": subscription.id,
                "status": subscription.status,
                "priceId": subscription.items.data[0].price.id if len(subscription.items.data) > 0 else None,
                "currentPeriodEnd": subscription.current_period_end,
                "currentPeriodStart": subscription.current_period_start,
                "cancelAtPeriodEnd": subscription.cancel_at_period_end,
                "paymentMethod": payment_method_info,
                "trialEnd": subscription.trial_end if hasattr(subscription, 'trial_end') else None,
                "canceledAt": subscription.canceled_at if hasattr(subscription, 'canceled_at') else None,
            }
            
            # Store in KV (convert to string for Redis)
            redis.set(kv_key, str(sub_data))
            
            logger.info(f"Synced Stripe data for customer {customer_id}: {sub_data['status']}")
            return sub_data
            
        except Exception as e:
            logger.error(f"Error syncing Stripe data for customer {customer_id}: {str(e)}")
            raise
    
    @staticmethod
    def get_stripe_customer_data(customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached Stripe customer data from KV store
        This is what the application should use to check subscription status
        
        Args:
            customer_id: Stripe customer ID
            
        Returns:
            Dictionary with subscription data or None
        """
        try:
            redis = StripeService._get_redis()
            kv_key = f"stripe:customer:{customer_id}"
            data = redis.get(kv_key)
            
            if data:
                # Parse back to dict (stored as string)
                import ast
                return ast.literal_eval(data)
            return None
            
        except Exception as e:
            logger.error(f"Error getting Stripe customer data from KV: {str(e)}")
            return None
    
    @staticmethod
    def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str = None,
        mode: Literal['payment', 'subscription'] = 'payment',
        metadata: Dict[str, Any] = None,
        line_items: list = None
    ) -> stripe.checkout.Session:
        """
        Create a Stripe Checkout Session
        ALWAYS uses a customer ID (no ephemeral customers)
        
        Args:
            customer_id: Stripe customer ID (required)
            price_id: Stripe price ID
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if user cancels
            mode: 'payment' for one-time, 'subscription' for recurring
            metadata: Additional metadata to store
            line_items: Custom line items (optional, overrides price_id)
            
        Returns:
            Stripe checkout session object
        """
        try:
            session_data = {
                "customer": customer_id,  # CRITICAL: Always set customer
                "mode": mode,
                "success_url": success_url,
                "cancel_url": cancel_url or success_url,
                "payment_method_types": ["card"],  # ✅ FIX 1: Explicitly set payment method types
            }
            
            if line_items:
                session_data["line_items"] = line_items
            elif price_id:
                session_data["line_items"] = [{
                    "price": price_id,
                    "quantity": 1
                }]
            
            if metadata:
                session_data["metadata"] = metadata
            
            # ✅ FIX 2 & 3: Handle payment method collection based on mode
            if mode == "subscription":
                # For subscriptions, always collect payment method
                session_data["payment_method_collection"] = "always"
                session_data["subscription_data"] = {
                    "metadata": metadata or {},
                    "trial_settings": {
                        "end_behavior": {"missing_payment_method": "cancel"}  # Safety net
                    }
                }
            else:
                # For one-time payments, store card for future use
                session_data["payment_intent_data"] = {
                    "setup_future_usage": "off_session"  # Store card for future payments
                }
            
            # Create the checkout session
            session = stripe.checkout.Session.create(**session_data)
            
            logger.info(f"Created checkout session {session.id} for customer {customer_id}")
            return session
            
        except Exception as e:
            logger.error(f"Error creating checkout session: {str(e)}")
            raise
    
    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str) -> stripe.Event:
        """
        Verify Stripe webhook signature and construct event
        
        Args:
            payload: Raw request body (bytes)
            signature: Stripe-Signature header value
            
        Returns:
            Verified Stripe event
            
        Raises:
            ValueError: If signature verification fails
        """
        webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
        
        if not webhook_secret:
            raise ValueError("STRIPE_WEBHOOK_SECRET not configured")
        
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                webhook_secret
            )
            return event
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Webhook signature verification failed: {str(e)}")
            raise ValueError("Invalid signature")
    
    @staticmethod
    def process_webhook_event(event: stripe.Event) -> bool:
        """
        Process a verified Stripe webhook event
        Simply extracts customer ID and calls sync
        
        Args:
            event: Verified Stripe event
            
        Returns:
            True if processed successfully
        """
        try:
            # Skip if not an event we care about
            if event.type not in ALLOWED_EVENTS:
                logger.info(f"Skipping untracked event type: {event.type}")
                return True
            
            # Extract customer ID from event
            event_object = event.data.object
            customer_id = getattr(event_object, 'customer', None)
            
            if not customer_id or not isinstance(customer_id, str):
                logger.warning(f"No customer ID found in event {event.type}")
                return False
            
            # ✅ FIX 4: Handle payment failures gracefully
            if event.type == "payment_intent.payment_failed":
                intent = event_object
                reason = getattr(intent.last_payment_error, 'message', 'Unknown error') if hasattr(intent, 'last_payment_error') and intent.last_payment_error else 'Unknown error'
                logger.warning(f"Payment failed for customer {customer_id}: {reason}")
                # Continue to sync to update KV with failed state
            
            if event.type == "invoice.payment_failed":
                invoice = event_object
                logger.warning(f"Invoice payment failed for customer {customer_id}: Invoice {invoice.id}")
                # Continue to sync to update KV with failed state
            
            # THE MAGIC: Just sync the data
            StripeService.sync_stripe_data_to_kv(customer_id)
            
            logger.info(f"Processed webhook event {event.type} for customer {customer_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing webhook event {event.type}: {str(e)}")
            raise
    
    @staticmethod
    def get_stripe_customer_by_user_id(user_id: int) -> Optional[str]:
        """
        Get Stripe customer ID from user ID
        
        Args:
            user_id: Internal user ID
            
        Returns:
            Stripe customer ID or None
        """
        try:
            redis = StripeService._get_redis()
            kv_key = f"stripe:user:{user_id}"
            return redis.get(kv_key)
        except Exception as e:
            logger.error(f"Error getting Stripe customer by user ID: {str(e)}")
            return None
    
    @staticmethod
    def create_billing_portal_session(customer_id: str, return_url: str) -> stripe.billing_portal.Session:
        """
        ✅ FIX 5: Create a billing portal session for customers to update payment methods
        Use this when a payment fails and the customer needs to update their card
        
        Args:
            customer_id: Stripe customer ID
            return_url: URL to redirect back to after managing billing
            
        Returns:
            Stripe billing portal session object
        """
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            
            logger.info(f"Created billing portal session for customer {customer_id}")
            return session
            
        except Exception as e:
            logger.error(f"Error creating billing portal session: {str(e)}")
            raise

