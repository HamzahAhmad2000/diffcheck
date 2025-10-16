"""
Business Purchase Controller (REFACTORED)
Handles all business-related purchases (AI Points, Responses, Quests, Admin Seats)
Following the "How I Stay Sane Implementing Stripe" methodology
"""

import os
import logging
from flask import current_app
from ..extensions import db
from ..models import (
    Business, AIPointsPackage, ResponsePackage, QuestPackage, AdminSeatPackage,
    StripeTransaction, AIPointsUsageLog
)
from ..services.stripe_service import StripeService
from datetime import datetime

logger = logging.getLogger(__name__)


class BusinessPurchaseController:
    """Unified controller for all business purchases"""
    
    @staticmethod
    def create_checkout_session_for_package(
        user_id,
        user_email,
        user_name,
        business_id,
        package_type,  # 'ai_points', 'responses', 'quests', 'admin_seats'
        package_id
    ):
        """
        Create a Stripe Checkout Session for any business package purchase
        
        Args:
            user_id: ID of the user making purchase
            user_email: User's email
            user_name: User's name
            business_id: ID of the business
            package_type: Type of package ('ai_points', 'responses', 'quests', 'admin_seats')
            package_id: ID of the specific package
            
        Returns:
            dict with checkout session details or error
        """
        try:
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}
            
            # Get the package based on type
            package = None
            package_name = ""
            price_cents = 0
            
            if package_type == 'ai_points':
                package = AIPointsPackage.query.get(package_id)
                if not package or not package.is_active:
                    return {"error": "AI Points package not found or inactive"}
                package_name = f"{package.name} - {package.get_total_points()} AI Points"
                price_cents = package.price
                
            elif package_type == 'responses':
                package = ResponsePackage.query.get(package_id)
                if not package or not package.is_active:
                    return {"error": "Response package not found or inactive"}
                package_name = f"{package.name} - {package.responses} Responses"
                price_cents = package.price
                
            elif package_type == 'quests':
                package = QuestPackage.query.get(package_id)
                if not package or not package.is_active:
                    return {"error": "Quest package not found or inactive"}
                package_name = f"{package.name} - {package.get_total_credits()} Quest Credits"
                price_cents = package.quest_credits
                
            elif package_type == 'admin_seats':
                package = AdminSeatPackage.query.get(package_id)
                if not package or not package.is_active:
                    return {"error": "Admin Seat package not found or inactive"}
                package_name = f"{package.name} - {package.get_total_seats()} Admin Seats"
                price_cents = package.price
            else:
                return {"error": "Invalid package type"}
            
            # CRITICAL STEP 1: Get or create Stripe customer
            stripe_customer_id = StripeService.get_or_create_stripe_customer(
                user_id=user_id,
                user_email=user_email,
                user_name=user_name
            )
            
            # Create Stripe Price for this purchase
            import stripe
            price = stripe.Price.create(
                unit_amount=price_cents,
                currency='usd',
                product_data={
                    'name': package_name,
                    'description': f'Business purchase for {business.name}'
                }
            )
            
            # CRITICAL STEP 2: Create checkout session WITH customer ID
            success_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/admin/purchase/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/admin/purchases"
            
            session = StripeService.create_checkout_session(
                customer_id=stripe_customer_id,
                price_id=price.id,
                success_url=success_url,
                cancel_url=cancel_url,
                mode='payment',  # One-time payment
                metadata={
                    'user_id': str(user_id),
                    'business_id': str(business_id),
                    'package_type': package_type,
                    'package_id': str(package_id),
                    'product_type': 'business_purchase'
                }
            )
            
            return {
                "success": True,
                "checkout_url": session.url,
                "session_id": session.id,
                "customer_id": stripe_customer_id,
                "package": {
                    "type": package_type,
                    "name": package_name,
                    "price": price_cents
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating checkout session for business purchase: {str(e)}")
            return {"error": "Failed to create checkout session"}
    
    @staticmethod
    def fulfill_business_purchase(stripe_customer_id, metadata):
        """
        Fulfill a business purchase after successful payment
        Called by webhook or after eager sync
        
        Args:
            stripe_customer_id: Stripe customer ID
            metadata: Metadata from checkout session
            
        Returns:
            dict with success status or error
        """
        try:
            user_id = int(metadata.get('user_id'))
            business_id = int(metadata.get('business_id'))
            package_type = metadata.get('package_type')
            package_id = int(metadata.get('package_id'))
            
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                logger.error(f"Business {business_id} not found")
                return {"error": "Business not found"}
            
            # Process based on package type
            if package_type == 'ai_points':
                result = BusinessPurchaseController._fulfill_ai_points_purchase(
                    business, package_id, user_id, stripe_customer_id
                )
            elif package_type == 'responses':
                result = BusinessPurchaseController._fulfill_response_purchase(
                    business, package_id, user_id, stripe_customer_id
                )
            elif package_type == 'quests':
                result = BusinessPurchaseController._fulfill_quest_purchase(
                    business, package_id, user_id, stripe_customer_id
                )
            elif package_type == 'admin_seats':
                result = BusinessPurchaseController._fulfill_admin_seat_purchase(
                    business, package_id, user_id, stripe_customer_id
                )
            else:
                return {"error": "Invalid package type"}
            
            return result
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling business purchase: {str(e)}")
            return {"error": "Failed to fulfill purchase"}
    
    @staticmethod
    def _fulfill_ai_points_purchase(business, package_id, user_id, stripe_customer_id):
        """Fulfill AI Points package purchase"""
        try:
            package = AIPointsPackage.query.get(package_id)
            if not package:
                return {"error": "Package not found"}
            
            total_points = package.get_total_points()
            
            # Add points to business (purchased points)
            business.ai_points_purchased += total_points
            
            # Record the transaction
            transaction = StripeTransaction(
                business_id=business.id,
                user_id=user_id,
                stripe_charge_id=stripe_customer_id,  # Will be updated with actual charge ID later
                amount_paid=package.price,
                points_purchased=total_points,
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            logger.info(f"Fulfilled AI Points purchase: {total_points} points for business {business.id}")
            
            return {
                "success": True,
                "message": f"Added {total_points} AI points",
                "points_added": total_points,
                "new_balance": business.get_total_ai_points()
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling AI points purchase: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def _fulfill_response_purchase(business, package_id, user_id, stripe_customer_id):
        """Fulfill Response package purchase"""
        try:
            package = ResponsePackage.query.get(package_id)
            if not package:
                return {"error": "Package not found"}
            
            # Add responses to business
            business.responses_purchased += package.responses
            
            # Record the transaction
            transaction = StripeTransaction(
                business_id=business.id,
                user_id=user_id,
                stripe_charge_id=stripe_customer_id,
                amount_paid=package.price,
                responses_purchased=package.responses,
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            logger.info(f"Fulfilled Response purchase: {package.responses} responses for business {business.id}")
            
            return {
                "success": True,
                "message": f"Added {package.responses} responses",
                "responses_added": package.responses,
                "new_total": business.get_total_response_quota()
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling response purchase: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def _fulfill_quest_purchase(business, package_id, user_id, stripe_customer_id):
        """Fulfill Quest package purchase"""
        try:
            package = QuestPackage.query.get(package_id)
            if not package:
                return {"error": "Package not found"}
            
            total_credits = package.get_total_credits()
            
            # Add quest credits to business
            business.quest_credits_purchased += total_credits
            
            # Record the transaction
            transaction = StripeTransaction(
                business_id=business.id,
                user_id=user_id,
                stripe_charge_id=stripe_customer_id,
                amount_paid=package.price,
                quest_credits_purchased=total_credits,
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            logger.info(f"Fulfilled Quest purchase: {total_credits} credits for business {business.id}")
            
            return {
                "success": True,
                "message": f"Added {total_credits} quest credits",
                "credits_added": total_credits,
                "new_total": business.quest_credits_purchased
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling quest purchase: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def _fulfill_admin_seat_purchase(business, package_id, user_id, stripe_customer_id):
        """Fulfill Admin Seat package purchase"""
        try:
            package = AdminSeatPackage.query.get(package_id)
            if not package:
                return {"error": "Package not found"}
            
            total_seats = package.get_total_seats()
            
            # Add admin seats to business
            business.admin_seats_purchased += total_seats
            
            # Record the transaction
            transaction = StripeTransaction(
                business_id=business.id,
                user_id=user_id,
                stripe_charge_id=stripe_customer_id,
                amount_paid=package.price,
                admin_seats_purchased=total_seats,
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            logger.info(f"Fulfilled Admin Seat purchase: {total_seats} seats for business {business.id}")
            
            return {
                "success": True,
                "message": f"Added {total_seats} admin seats",
                "seats_added": total_seats,
                "new_total": business.admin_seat_limit + business.admin_seats_purchased
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error fulfilling admin seat purchase: {str(e)}")
            return {"error": str(e)}
    
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
            
            # Check if this was a successful one-time payment for business purchase
            if subscription_data.get('status') == 'one_time_payment':
                payment_intent_id = subscription_data.get('paymentIntentId')
                
                if payment_intent_id:
                    # Fetch payment intent to get metadata
                    import stripe
                    payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                    
                    if payment_intent.metadata.get('product_type') == 'business_purchase':
                        # Fulfill the purchase
                        result = BusinessPurchaseController.fulfill_business_purchase(
                            stripe_customer_id,
                            payment_intent.metadata
                        )
                        return result
            
            return {"message": "No pending business purchase"}
            
        except Exception as e:
            logger.error(f"Error checking and fulfilling purchase: {str(e)}")
            return {"error": str(e)}

