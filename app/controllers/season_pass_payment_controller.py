"""
Season Pass Payment Controller (REFACTORED)
Handles payment processing for Season Pass purchases using the centralized Stripe service
Following the "How I Stay Sane Implementing Stripe" methodology
"""

import os
import logging
from flask import current_app
from ..extensions import db
from ..models.season_pass_models import Season, UserSeasonPass, PassTierType
from ..controllers.season_pass_controller import SeasonPassController
from ..services.stripe_service import StripeService

logger = logging.getLogger(__name__)

class SeasonPassPaymentController:
    """Handles payment processing for Season Pass purchases"""
    
    @staticmethod
    def create_payment_intent(user_id, tier_type):
        """
        Create a Stripe Payment Intent for Season Pass purchase
        This is an alternative to checkout sessions for direct payment

        Args:
            user_id: ID of the user purchasing the pass
            tier_type: 'LUNAR' or 'TOTALITY'

        Returns:
            dict with payment intent details or error
        """
        try:
            from ..models import User

            # Get user info
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            # Validate tier type
            if tier_type not in [PassTierType.LUNAR.value, PassTierType.TOTALITY.value]:
                return {"error": "Invalid tier type"}

            # Get active season
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season available"}

            # Check if user already has a pass
            existing_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()

            is_upgrade = False
            if existing_pass:
                # Check if this is an upgrade request
                current_tier = existing_pass.tier_type
                if current_tier == PassTierType.TOTALITY.value:
                    return {"error": "You already have the highest tier Season Pass"}
                elif current_tier == PassTierType.LUNAR.value and tier_type == PassTierType.LUNAR.value:
                    return {"error": "You already have a Lunar Season Pass"}
                elif current_tier == PassTierType.LUNAR.value and tier_type == PassTierType.TOTALITY.value:
                    # This is an upgrade from LUNAR to TOTALITY - calculate price difference
                    price_cents = active_season.totality_pass_price - active_season.lunar_pass_price
                    if price_cents <= 0:
                        return {"error": "Invalid upgrade pricing"}
                    # Mark this as an upgrade
                    is_upgrade = True
                else:
                    return {"error": "Season pass already purchased for this season"}
            else:
                # Normal purchase
                price_cents = (active_season.lunar_pass_price if tier_type == PassTierType.LUNAR.value
                              else active_season.totality_pass_price)

            # CRITICAL STEP 1: Get or create Stripe customer
            stripe_customer_id = StripeService.get_or_create_stripe_customer(
                user_id=user_id,
                user_email=user.email,
                user_name=user.name or user.username
            )
            
            # CRITICAL STEP 2: Create Payment Intent WITH customer ID
            import stripe
            payment_intent = stripe.PaymentIntent.create(
                amount=price_cents,
                currency='usd',
                customer=stripe_customer_id,
                metadata={
                    'user_id': str(user_id),
                    'season_id': str(active_season.id),
                    'tier_type': tier_type,
                    'product_type': 'season_pass',
                    'is_upgrade': 'true' if is_upgrade else 'false'
                },
                description=f'{active_season.name} - {tier_type} Pass',
                automatic_payment_methods={
                    'enabled': True,
                },
            )
            
            return {
                "client_secret": payment_intent.client_secret,
                "payment_intent_id": payment_intent.id,
                "amount": price_cents,
                "currency": "usd",
                "customer_id": stripe_customer_id,
                "season": {
                    "id": active_season.id,
                    "name": active_season.name,
                    "tier_type": tier_type,
                    "price": price_cents
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating payment intent: {str(e)}")
            return {"error": f"Failed to create payment intent: {str(e)}"}
    
    @staticmethod
    def create_checkout_session(user_id, user_email, user_name, tier_type):
        """
        Create a Stripe Checkout Session for Season Pass purchase
        Following the new methodology: ALWAYS create/get customer first
        
        Args:
            user_id: ID of the user purchasing the pass
            user_email: User's email
            user_name: User's name
            tier_type: 'LUNAR' or 'TOTALITY'
            
        Returns:
            dict with checkout session details or error
        """
        try:
            # Validate tier type
            if tier_type not in [PassTierType.LUNAR.value, PassTierType.TOTALITY.value]:
                return {"error": "Invalid tier type"}
            
            # Get active season
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season available"}
            
            # Check if user already has a pass
            existing_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()

            is_upgrade = False
            if existing_pass:
                # Check if this is an upgrade request
                current_tier = existing_pass.tier_type
                if current_tier == PassTierType.TOTALITY.value:
                    return {"error": "You already have the highest tier Season Pass"}
                elif current_tier == PassTierType.LUNAR.value and tier_type == PassTierType.LUNAR.value:
                    return {"error": "You already have a Lunar Season Pass"}
                elif current_tier == PassTierType.LUNAR.value and tier_type == PassTierType.TOTALITY.value:
                    # This is an upgrade from LUNAR to TOTALITY - calculate price difference
                    price_cents = active_season.totality_pass_price - active_season.lunar_pass_price
                    if price_cents <= 0:
                        return {"error": "Invalid upgrade pricing"}
                    # Mark this as an upgrade
                    is_upgrade = True
                else:
                    return {"error": "Season pass already purchased for this season"}
            else:
                # Normal purchase
                price_cents = (active_season.lunar_pass_price if tier_type == PassTierType.LUNAR.value
                              else active_season.totality_pass_price)
            
            # CRITICAL STEP 1: Get or create Stripe customer
            stripe_customer_id = StripeService.get_or_create_stripe_customer(
                user_id=user_id,
                user_email=user_email,
                user_name=user_name
            )
            
            # Create Stripe Price if needed (or use existing price ID)
            # For now, we'll create a one-time price for this purchase
            import stripe
            price = stripe.Price.create(
                unit_amount=price_cents,
                currency='usd',
                product_data={
                    'name': f'{active_season.name} - {tier_type} Pass',
                    'description': f'Season Pass for {active_season.name}'
                }
            )
            
            # CRITICAL STEP 2: Create checkout session WITH customer ID
            # Success URL will redirect to our /api/stripe/success endpoint for eager sync
            success_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/season-pass/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/season-pass/activate"
            
            session = StripeService.create_checkout_session(
                customer_id=stripe_customer_id,
                price_id=price.id,
                success_url=success_url,
                cancel_url=cancel_url,
                mode='payment',  # One-time payment
                metadata={
                    'user_id': str(user_id),
                    'season_id': str(active_season.id),
                    'tier_type': tier_type,
                    'product_type': 'season_pass',
                    'is_upgrade': 'true' if is_upgrade else 'false'
                }
            )
            
            return {
                "success": True,
                "checkout_url": session.url,
                "session_id": session.id,
                "customer_id": stripe_customer_id,
                "season": {
                    "id": active_season.id,
                    "name": active_season.name,
                    "tier_type": tier_type,
                    "price": price_cents
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating checkout session: {str(e)}")
            return {"error": "Failed to create checkout session"}
    
    @staticmethod
    def confirm_stripe_payment(payment_intent_id):
        """
        Confirm a Stripe payment and fulfill the season pass purchase
        
        Args:
            payment_intent_id: Stripe Payment Intent ID
            
        Returns:
            dict with success status and pass details or error
        """
        try:
            import stripe
            
            # Retrieve the payment intent
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            # Check if payment was successful
            if payment_intent.status != 'succeeded':
                return {"error": f"Payment not successful. Status: {payment_intent.status}"}
            
            # Get metadata
            metadata = payment_intent.metadata
            if not metadata:
                return {"error": "Payment intent missing metadata"}
            
            # Fulfill the purchase
            result = SeasonPassPaymentController.fulfill_season_pass_purchase(
                payment_intent.customer,
                metadata
            )
            
            if result.get('success'):
                return {
                    "success": True,
                    "message": result.get('message', 'Season pass purchased successfully'),
                    "pass": result.get('pass'),
                    "payment_info": {
                        "payment_intent_id": payment_intent_id,
                        "amount": payment_intent.amount,
                        "currency": payment_intent.currency
                    }
                }
            else:
                return result
                
        except Exception as e:
            logger.error(f"Error confirming payment: {str(e)}")
            return {"error": f"Failed to confirm payment: {str(e)}"}
    
    @staticmethod
    def fulfill_season_pass_purchase(payment_reference, metadata, payment_method='STRIPE'):
        """
        Fulfill a season pass purchase after successful payment
        Called by webhook or after eager sync

        Args:
            payment_reference: Payment reference (Stripe customer ID or Coinbase charge ID)
            metadata: Metadata from checkout session containing user_id, season_id, tier_type
            payment_method: 'STRIPE' or 'COINBASE'

        Returns:
            dict with success status or error
        """
        try:
            user_id = int(metadata.get('user_id'))
            season_id = int(metadata.get('season_id'))
            tier_type = metadata.get('tier_type')

            # Verify season still exists and is active
            season = Season.query.filter_by(id=season_id, is_active=True).first()
            if not season:
                logger.error(f"Payment succeeded for inactive season {season_id}")
                return {"error": "Season no longer active"}

            # Check if this is an upgrade
            is_upgrade = metadata.get('is_upgrade', 'false').lower() == 'true'

            # Check if pass already exists
            existing_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=season_id
            ).first()

            if existing_pass and not is_upgrade:
                logger.warning(f"Season pass already exists for user {user_id}, season {season_id}")
                return {"success": True, "message": "Season pass already exists", "pass": existing_pass.to_dict()}
            elif existing_pass and is_upgrade:
                # Handle upgrade: update existing pass
                if existing_pass.tier_type == tier_type:
                    logger.warning(f"User {user_id} already has {tier_type} pass, no upgrade needed")
                    return {"success": True, "message": f"Already have {tier_type} pass", "pass": existing_pass.to_dict()}

                # Calculate upgrade price (difference between tiers)
                old_price = season.lunar_pass_price if existing_pass.tier_type == PassTierType.LUNAR.value else season.totality_pass_price
                new_price = season.lunar_pass_price if tier_type == PassTierType.LUNAR.value else season.totality_pass_price
                upgrade_price = new_price - old_price

                # Update the existing pass
                existing_pass.tier_type = tier_type
                existing_pass.purchase_price += upgrade_price  # Add upgrade cost to total
                existing_pass.payment_method = payment_method
                existing_pass.payment_reference = payment_reference
                existing_pass.updated_at = db.func.now()

                logger.info(f"Upgraded season pass for user {user_id} from {existing_pass.tier_type} to {tier_type}")
                db.session.commit()

                return {
                    "success": True,
                    "message": f"Season pass upgraded to {tier_type}",
                    "pass": existing_pass.to_dict(),
                    "upgrade": True
                }
            else:
                # Create new Season Pass
                purchase_price = season.lunar_pass_price if tier_type == PassTierType.LUNAR.value else season.totality_pass_price

                new_pass = UserSeasonPass(
                    user_id=user_id,
                    season_id=season_id,
                    tier_type=tier_type,
                    purchase_price=purchase_price,
                    payment_method=payment_method,
                    payment_reference=payment_reference  # Store payment reference for tracking
                )

                db.session.add(new_pass)
            db.session.commit()

            logger.info(f"Created season pass for user {user_id}, tier {tier_type}, payment_method: {payment_method}")

            return {
                "success": True,
                "message": "Season pass created successfully",
                "pass": new_pass.to_dict()
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling season pass purchase: {str(e)}")
            return {"error": "Failed to create season pass"}
    
    @staticmethod
    def check_and_fulfill_purchase(user_id):
        """
        Check Stripe for completed purchases and fulfill them
        Called from success endpoint for eager fulfillment
        
        Args:
            user_id: User ID to check
            
        Returns:
            dict with fulfillment status
        """
        try:
            # Get Stripe customer ID
            stripe_customer_id = StripeService.get_stripe_customer_by_user_id(user_id)
            
            if not stripe_customer_id:
                return {"error": "No Stripe customer found"}
            
            # Get subscription data from KV (already synced by eager sync)
            subscription_data = StripeService.get_stripe_customer_data(stripe_customer_id)
            
            if not subscription_data:
                return {"error": "No payment data found"}
            
            # Check if this was a successful one-time payment for season pass
            if subscription_data.get('status') == 'one_time_payment':
                payment_intent_id = subscription_data.get('paymentIntentId')
                
                if payment_intent_id:
                    # Fetch payment intent to get metadata
                    import stripe
                    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                    
                    if payment_intent.metadata.get('product_type') == 'season_pass':
                        # Fulfill the purchase
                        result = SeasonPassPaymentController.fulfill_season_pass_purchase(
                            stripe_customer_id,
                            payment_intent.metadata
                        )
                        return result
            
            return {"message": "No pending season pass purchase"}
            
        except Exception as e:
            logger.error(f"Error checking and fulfilling purchase: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def create_crypto_payment_session(user_id, tier_type):
        """
        Create a crypto payment session for season pass purchase
        This method determines which crypto provider to use and delegates

        Args:
            user_id: ID of the user purchasing
            tier_type: 'LUNAR' or 'TOTALITY'

        Returns:
            dict with payment session details or error
        """
        try:
            # Get active season to determine pricing
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season available"}

            # Get price for the tier
            price_cents = (active_season.lunar_pass_price if tier_type == PassTierType.LUNAR.value
                          else active_season.totality_pass_price)
            price_usd = price_cents / 100  # Convert cents to dollars

            # For now, default to Coinbase Commerce
            # In the future, this could check user preferences or A/B test different providers
            return CryptoPaymentController.create_coinbase_commerce_session(
                user_id, tier_type, price_usd
            )

        except Exception as e:
            logger.error(f"Error creating crypto payment session: {str(e)}")
            return {"error": f"Failed to create payment session: {str(e)}"}

    @staticmethod
    def get_payment_methods():
        """
        Get available payment methods
        
        Returns:
            dict with available payment methods
        """
        payment_methods = {
            "stripe": {
                "available": bool(os.environ.get('STRIPE_SECRET_KEY')),
                "currencies": ["USD"],
                "methods": ["card"]
            }
        }
        
        return {
            "success": True,
            "payment_methods": payment_methods
        }
    
    @staticmethod
    def refund_season_pass_payment(user_season_pass_id, reason=None):
        """
        Process a refund for a Season Pass purchase
        
        Args:
            user_season_pass_id: ID of the UserSeasonPass to refund
            reason: Optional reason for the refund
            
        Returns:
            dict with refund status or error
        """
        try:
            # Get the Season Pass
            user_pass = UserSeasonPass.query.get(user_season_pass_id)
            if not user_pass:
                return {"error": "Season pass not found"}
            
            # Only process refunds for Stripe payments
            if user_pass.payment_method != "STRIPE":
                return {"error": "Refunds only available for Stripe payments"}
            
            if not user_pass.payment_reference:
                return {"error": "No payment reference found"}
            
            # Get the payment intent from Stripe
            import stripe
            
            # The payment_reference contains the customer ID, need to find the actual charge
            # Get recent charges for this customer
            charges = stripe.Charge.list(customer=user_pass.payment_reference, limit=10)
            
            # Find the charge that matches this season pass
            matching_charge = None
            for charge in charges.data:
                if charge.metadata.get('season_id') == str(user_pass.season_id):
                    matching_charge = charge
                    break
            
            if not matching_charge:
                return {"error": "No matching charge found"}
            
            # Create refund
            refund = stripe.Refund.create(
                charge=matching_charge.id,
                reason='requested_by_customer',
                metadata={
                    'user_season_pass_id': str(user_season_pass_id),
                    'refund_reason': reason or 'Customer request'
                }
            )
            
            if refund.status == 'succeeded':
                # Delete the season pass
                db.session.delete(user_pass)
                db.session.commit()
                
                return {
                    "success": True,
                    "message": "Refund processed successfully",
                    "refund_id": refund.id,
                    "amount_refunded": refund.amount
                }
            else:
                return {"error": f"Refund failed with status: {refund.status}"}
                
        except Exception as e:
            logger.error(f"Error processing refund: {str(e)}")
            return {"error": "Refund failed"}


# Deprecated functions from old implementation
# These are kept for backward compatibility but should not be used

class CryptoPaymentController:
    """
    Handles crypto payment integration using Coinbase Commerce
    """

    @staticmethod
    def create_coinbase_commerce_session(user_id, tier_type, price_usd):
        """
        Create a Coinbase Commerce charge for season pass purchase

        Args:
            user_id: ID of the user purchasing
            tier_type: 'LUNAR' or 'TOTALITY'
            price_usd: Price in USD

        Returns:
            dict with charge details or error
        """
        try:
            from ..models import User

            # Validate inputs
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            if tier_type not in [PassTierType.LUNAR.value, PassTierType.TOTALITY.value]:
                return {"error": "Invalid tier type"}

            # Get active season for validation
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season available"}

            # Check if user already has a pass
            existing_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()

            if existing_pass:
                return {"error": "Season pass already purchased for this season"}

            # Get expected price for validation
            expected_price = (active_season.lunar_pass_price if tier_type == PassTierType.LUNAR.value
                            else active_season.totality_pass_price)
            expected_price_usd = expected_price / 100  # Convert cents to dollars

            # Validate price matches
            if abs(float(price_usd) - expected_price_usd) > 0.01:  # Allow 1 cent tolerance
                return {"error": f"Price mismatch. Expected: ${expected_price_usd}, got: ${price_usd}"}

            # Create Coinbase charge via API call
            import requests
            import os

            coinbase_api_key = os.environ.get("COINBASE_COMMERCE_API_KEY")
            if not coinbase_api_key:
                return {"error": "Coinbase Commerce API key not configured"}

            headers = {
                "Content-Type": "application/json",
                "X-CC-Api-Key": coinbase_api_key,
                "X-CC-Version": "2018-03-22"
            }

            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

            payload = {
                "name": f"{active_season.name} - {tier_type} Pass",
                "description": f"Season Pass purchase for {user.name or user.username}",
                "pricing_type": "fixed_price",
                "local_price": {
                    "amount": str(price_usd),
                    "currency": "USD"
                },
                "metadata": {
                    "user_id": str(user_id),
                    "season_id": str(active_season.id),
                    "tier_type": tier_type,
                    "product_type": "season_pass"
                },
                "redirect_url": f"{frontend_url}/season-pass/success?provider=coinbase",
                "cancel_url": f"{frontend_url}/season-pass/activate?provider=coinbase"
            }

            response = requests.post(
                "https://api.commerce.coinbase.com/charges",
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code != 201:
                logger.error(f"Coinbase charge creation failed: {response.status_code} - {response.text}")
                return {"error": "Failed to create Coinbase charge"}

            charge_data = response.json()["data"]

            return {
                "success": True,
                "charge_id": charge_data["id"],
                "hosted_url": charge_data["hosted_url"],
                "status": charge_data.get("timeline", [{}])[0].get("status", "PENDING"),
                "amount": price_usd,
                "currency": "USD",
                "tier_type": tier_type,
                "season_name": active_season.name
            }

        except Exception as e:
            logger.error(f"Error creating Coinbase Commerce session: {str(e)}")
            return {"error": f"Failed to create payment session: {str(e)}"}

    @staticmethod
    def create_nowpayments_session(user_id, tier_type, price_usd):
        """Future implementation for NOWPayments"""
        return {"error": "NOWPayments integration coming soon"}

    @staticmethod
    def verify_crypto_payment(payment_id, provider):
        """
        Verify crypto payment status (used for polling/manual verification)

        Args:
            payment_id: Charge ID or payment reference
            provider: 'coinbase' or 'nowpayments'

        Returns:
            dict with verification status
        """
        try:
            if provider == "coinbase":
                return CryptoPaymentController._verify_coinbase_payment(payment_id)
            elif provider == "nowpayments":
                return {"error": "NOWPayments verification not implemented"}
            else:
                return {"error": "Unknown payment provider"}

        except Exception as e:
            logger.error(f"Error verifying crypto payment: {str(e)}")
            return {"error": f"Verification failed: {str(e)}"}

    @staticmethod
    def _verify_coinbase_payment(charge_id):
        """
        Check Coinbase Commerce charge status

        Args:
            charge_id: Coinbase charge ID

        Returns:
            dict with charge status
        """
        try:
            import requests
            import os

            coinbase_api_key = os.environ.get("COINBASE_COMMERCE_API_KEY")
            if not coinbase_api_key:
                return {"error": "Coinbase Commerce API key not configured"}

            headers = {
                "Content-Type": "application/json",
                "X-CC-Api-Key": coinbase_api_key,
                "X-CC-Version": "2018-03-22"
            }

            response = requests.get(
                f"https://api.commerce.coinbase.com/charges/{charge_id}",
                headers=headers,
                timeout=30
            )

            if response.status_code != 200:
                return {"error": "Failed to retrieve charge status"}

            charge_data = response.json()["data"]

            # Check if payment was confirmed
            timeline = charge_data.get("timeline", [])
            confirmed = any(event.get("status") == "CONFIRMED" for event in timeline)

            return {
                "charge_id": charge_id,
                "status": "CONFIRMED" if confirmed else "PENDING",
                "confirmed": confirmed,
                "timeline": timeline,
                "metadata": charge_data.get("metadata", {})
            }

        except Exception as e:
            logger.error(f"Error verifying Coinbase payment: {str(e)}")
            return {"error": f"Verification failed: {str(e)}"}
