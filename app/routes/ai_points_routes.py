from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
from app.controllers.business_controller import BusinessController
from app.models import db, Business, StripeTransaction
import stripe
import os
from datetime import datetime

ai_points_bp = Blueprint('ai_points', __name__)

# Set Stripe API key
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Import dynamic package controller
from app.controllers.ai_points_package_controller import AIPointsPackageController

# Pricing configuration (responses pay-as-you-go)
RESPONSE_PACKAGES = {
    'small':  {'responses': 2000,  'price': 1999, 'name': 'Small Responses Package'},   # $19.99
    'medium': {'responses': 5000,  'price': 4499, 'name': 'Medium Responses Package'},  # $44.99
    'large':  {'responses': 10000, 'price': 7999, 'name': 'Large Responses Package'}   # $79.99
}

# Tier-based discount configuration
TIER_DISCOUNTS = {
    'Standard': 0.0,    # 0% discount (Starter tier)
    'Advanced': 0.20,   # 20% discount (Growth tier)
    'Super': 0.40       # 40% discount (Enterprise tier)
}

def get_tier_discount(business):
    """Get the discount percentage for a business based on their tier"""
    if not business or not business.tier_info:
        return 0.0
    
    tier_name = business.tier_info.name
    return TIER_DISCOUNTS.get(tier_name, 0.0)

def apply_tier_discount(original_price, discount_percentage):
    """Apply tier-based discount to a price"""
    if discount_percentage <= 0:
        return original_price
    
    discount_amount = int(original_price * discount_percentage)
    discounted_price = original_price - discount_amount
    
    return {
        'original_price': original_price,
        'discount_percentage': discount_percentage,
        'discount_amount': discount_amount,
        'final_price': discounted_price
    }

# Subscription tier pricing configuration
SUBSCRIPTION_TIERS = {
    'normal': {
        'price': 0, 
        'name': 'Normal Plan', 
        'features': {
            'monthly_response_limit': 10000, 
            'monthly_quest_limit': 5, 
            'admin_seat_limit': 1,
            'monthly_ai_points': 0  # No monthly AI points for normal tier
        }
    },
    'advanced': {
        'price': 4999, 
        'name': 'Advanced Plan', 
        'features': {
            'monthly_response_limit': 20000, 
            'monthly_quest_limit': 15, 
            'admin_seat_limit': 3,
            'monthly_ai_points': 100  # 100 monthly AI points for advanced tier
        }
    },  # $49.99
    'super': {
        'price': 9999, 
        'name': 'Super Plan', 
        'features': {
            'monthly_response_limit': 50000, 
            'monthly_quest_limit': -1, 
            'admin_seat_limit': -1,
            'monthly_ai_points': 200  # 200 monthly AI points for super tier
        }
    }  # $99.99
}

@ai_points_bp.route("/business/<int:business_id>/ai_points", methods=["GET"])
@token_required
@business_admin_required
def get_business_ai_points(business_id):
    """Get current AI points balance and usage log for a business"""
    try:
        # Check if user can access this business
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
        
        # Check for billing cycle reset before returning data
        business = Business.query.get(business_id)
        if business and business.is_billing_cycle_due():
            current_app.logger.info(f"[GET_AI_POINTS] Billing cycle due for business {business_id}, resetting monthly points")
            business.reset_monthly_points()
            business.ai_points = business.get_total_ai_points()  # Update legacy field
            db.session.commit()
            
        result, status = BusinessController.get_ai_points_usage_log(business_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AI_POINTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve AI points information"}), 500

@ai_points_bp.route("/business/<int:business_id>/ai_points/add", methods=["POST"])
@token_required
@admin_required
def add_ai_points_admin(business_id):
    """Admin endpoint to manually add AI points to a business"""
    try:
        data = request.get_json() or {}
        points_to_add = data.get('points')
        reason = data.get('reason', 'ADMIN_GRANT')
        
        if not isinstance(points_to_add, int) or points_to_add <= 0:
            return jsonify({"error": "Points must be a positive integer"}), 400
            
        success, message = BusinessController.add_ai_points(
            business_id, 
            points_to_add, 
            f"ADMIN_GRANT_{reason}", 
            g.current_user.id
        )
        
        if success:
            return jsonify({"message": message, "points_added": points_to_add}), 200
        else:
            return jsonify({"error": message}), 400
            
    except Exception as e:
        current_app.logger.error(f"[ADD_AI_POINTS_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to add AI points"}), 500

@ai_points_bp.route("/stripe/packages", methods=["GET"])
@token_required
def get_points_packages():
    """Get available AI points packages for purchase"""
    try:
        # Get dynamic packages from database
        result, status = AIPointsPackageController.get_all_packages(include_inactive=False)
        if status != 200:
            return jsonify(result), status
        
        # Convert to legacy format for compatibility
        packages = {}
        for package in result.get('packages', []):
            # Create a legacy-compatible key (lowercase name with spaces replaced by underscores)
            key = package['name'].lower().replace(' ', '_').replace('-', '_')
            packages[key] = {
                'id': package['id'],
                'points': package['total_points'],  # Use total points (including bonus)
                'price': package['price'],
                'name': package['name'],
                'description': package.get('description', ''),
                'is_popular': package.get('is_popular', False)
            }
        
        return jsonify({
            "packages": packages,
            "stripe_public_key": os.getenv('STRIPE_PUBLIC_KEY')
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[GET_POINTS_PACKAGES] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve AI points packages"}), 500

@ai_points_bp.route("/stripe/create_payment_intent", methods=["POST"])
@token_required
@business_admin_required
def create_payment_intent():
    """Create a Stripe payment intent for purchasing AI points"""
    try:
        data = request.get_json() or {}
        package_identifier = data.get('package')  # Can be either package_id or legacy key
        business_id = data.get('business_id') or g.current_user.business_id  # Use current user's business if not specified
        
        # Get all packages to find the right one
        packages_result, packages_status = AIPointsPackageController.get_all_packages(include_inactive=False)
        if packages_status != 200:
            return jsonify({"error": "Failed to retrieve available packages"}), 500
        
        package = None
        # Try to find package by ID first, then by legacy key
        try:
            package_id = int(package_identifier)
            package = next((p for p in packages_result['packages'] if p['id'] == package_id), None)
        except (ValueError, TypeError):
            # If not an integer, try legacy key matching
            legacy_key = str(package_identifier).lower()
            package = next((p for p in packages_result['packages'] 
                          if p['name'].lower().replace(' ', '_').replace('-', '_') == legacy_key), None)
        
        if not package:
            return jsonify({"error": "Invalid package selected"}), 400
            
        # Check if user can purchase for this business
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
            
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
        
        # Calculate tier-based discount
        original_price = package['price']
        discount_percentage = get_tier_discount(business)
        
        if discount_percentage > 0:
            pricing_info = apply_tier_discount(original_price, discount_percentage)
            final_price = pricing_info['final_price']
            current_app.logger.info(f"[AI_POINTS_DISCOUNT] Business {business_id} ({business.tier_info.name if business.tier_info else 'Unknown'}) gets {discount_percentage*100}% discount: ${original_price/100:.2f} -> ${final_price/100:.2f}")
        else:
            pricing_info = {
                'original_price': original_price,
                'discount_percentage': 0.0,
                'discount_amount': 0,
                'final_price': original_price
            }
            final_price = original_price
        
        # Create payment intent with Stripe using discounted price
        intent = stripe.PaymentIntent.create(
            amount=final_price,  # Amount in cents (after discount)
            currency='usd',
            metadata={
                'business_id': business_id,
                'user_id': g.current_user.id,
                'package_id': package['id'],
                'package_name': package['name'],
                'points': package['total_points'],
                'business_name': business.name,
                'original_price': original_price,
                'discount_percentage': discount_percentage,
                'discount_amount': pricing_info['discount_amount'],
                'final_price': final_price,
                'tier_name': business.tier_info.name if business.tier_info else 'Unknown'
            }
        )
        
        current_app.logger.info(f"[STRIPE_PAYMENT_INTENT] Created intent {intent.id} for business {business_id}, package {package['name']} with tier discount")
        
        return jsonify({
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "package": {
                "id": package['id'],
                "name": package['name'],
                "points": package['total_points'],
                "price": package['price'],
                "description": package.get('description', '')
            },
            "pricing": pricing_info,
            "tier_info": {
                "name": business.tier_info.name if business.tier_info else None,
                "discount_percentage": discount_percentage
            },
            "business_name": business.name
        }), 200
        
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_PAYMENT_INTENT] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        current_app.logger.error(f"[STRIPE_PAYMENT_INTENT] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create payment intent"}), 500

@ai_points_bp.route("/stripe/confirm_payment", methods=["POST"])
@token_required
@business_admin_required
def confirm_payment():
    """Confirm payment and add AI points to business"""
    try:
        data = request.get_json() or {}
        payment_intent_id = data.get('payment_intent_id')
        
        if not payment_intent_id:
            return jsonify({"error": "Payment intent ID is required"}), 400
            
        # Retrieve the payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status != 'succeeded':
            return jsonify({"error": "Payment not completed"}), 400
            
        # Extract metadata
        business_id = int(intent.metadata['business_id'])
        user_id = int(intent.metadata['user_id'])
        package_id = int(intent.metadata.get('package_id', 0))
        package_name = intent.metadata.get('package_name', 'Unknown Package')
        points_to_add = int(intent.metadata['points'])
        
        # Check if transaction already processed
        existing_transaction = StripeTransaction.query.filter_by(stripe_charge_id=payment_intent_id).first()
        if existing_transaction:
            return jsonify({"error": "Payment already processed"}), 400
            
        # Check access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied"}), 403
            
        # Add points to business
        success, message = BusinessController.add_ai_points(
            business_id,
            points_to_add,
            f"STRIPE_PURCHASE_{package_name.upper().replace(' ', '_')}",
            user_id
        )
        
        if not success:
            return jsonify({"error": f"Failed to add points: {message}"}), 500
            
        # Log the Stripe transaction
        transaction = StripeTransaction(
            business_id=business_id,
            user_id=user_id,
            stripe_charge_id=payment_intent_id,
            amount_paid=intent.amount,
            points_purchased=points_to_add,
            status='succeeded'
        )
        db.session.add(transaction)
        db.session.commit()
        
        current_app.logger.info(f"[STRIPE_CONFIRM] Successfully processed payment {payment_intent_id} for business {business_id}")
        
        return jsonify({
            "message": "Payment confirmed and points added successfully",
            "points_added": points_to_add,
            "transaction_id": transaction.id
        }), 200
        
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CONFIRM] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_CONFIRM] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to confirm payment"}), 500

@ai_points_bp.route("/business/<int:business_id>/transactions", methods=["GET"])
@token_required
@business_admin_required
def get_business_transactions(business_id):
    """Get Stripe transaction history for a business"""
    try:
        # Check access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
            
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
            
        transactions = StripeTransaction.query.filter_by(business_id=business_id)\
                                             .order_by(StripeTransaction.created_at.desc())\
                                             .limit(50).all()
        
        transaction_data = []
        for transaction in transactions:
            trans_dict = transaction.to_dict()
            # Add user information if available
            if transaction.user:
                trans_dict['user_info'] = {
                    'id': transaction.user.id,
                    'username': transaction.user.username,
                    'email': transaction.user.email
                }
            transaction_data.append(trans_dict)
        
        return jsonify({
            "business_id": business_id,
            "business_name": business.name,
            "transactions": transaction_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[GET_TRANSACTIONS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve transactions"}), 500

@ai_points_bp.route("/business/<int:business_id>/check_points", methods=["POST"])
@token_required
@business_admin_required
def check_points_availability(business_id):
    """Check if business has enough points for a specific action"""
    try:
        data = request.get_json() or {}
        points_needed = data.get('points_needed')
        
        if not isinstance(points_needed, int) or points_needed <= 0:
            return jsonify({"error": "Points needed must be a positive integer"}), 400
            
        # Check access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
            
        has_enough, current_points, message = BusinessController.check_ai_points_available(business_id, points_needed)
        
        return jsonify({
            "has_enough_points": has_enough,
            "current_points": current_points,
            "points_needed": points_needed,
            "message": message
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[CHECK_POINTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to check points availability"}), 500

@ai_points_bp.route("/stripe/simulate_payment", methods=["POST"])
@token_required
@business_admin_required
def simulate_stripe_payment():
    """Simulate a successful Stripe payment for sandbox/testing purposes"""
    try:
        data = request.get_json() or {}
        payment_intent_id = data.get('payment_intent_id')
        
        if not payment_intent_id:
            return jsonify({"error": "Payment intent ID is required"}), 400
            
        # Retrieve the payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        # Extract metadata
        business_id = int(intent.metadata['business_id'])
        user_id = int(intent.metadata['user_id'])
        package_key = intent.metadata['package']
        points_to_add = int(intent.metadata['points'])
        
        # Check if transaction already processed
        existing_transaction = StripeTransaction.query.filter_by(stripe_charge_id=payment_intent_id).first()
        if existing_transaction:
            return jsonify({"error": "Payment already processed"}), 400
            
        # Check access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied"}), 403
            
        # For sandbox simulation, we'll manually mark the payment as succeeded
        # In production, this would be done by Stripe webhooks
        current_app.logger.info(f"[STRIPE_SIMULATE] Simulating successful payment for intent {payment_intent_id}")
        
        # Add points to business
        success, message = BusinessController.add_ai_points(
            business_id,
            points_to_add,
            f"SIMULATED_STRIPE_PURCHASE_{package_key.upper()}",
            user_id
        )
        
        if not success:
            return jsonify({"error": f"Failed to add points: {message}"}), 500
            
        # Log the simulated Stripe transaction
        transaction = StripeTransaction(
            business_id=business_id,
            user_id=user_id,
            stripe_charge_id=payment_intent_id,
            amount_paid=intent.amount,
            points_purchased=points_to_add,
            status='succeeded'  # Mark as succeeded for simulation
        )
        db.session.add(transaction)
        db.session.commit()
        
        current_app.logger.info(f"[STRIPE_SIMULATE] Successfully simulated payment {payment_intent_id} for business {business_id}")
        
        return jsonify({
            "message": "Payment simulation successful and points added",
            "points_added": points_to_add,
            "transaction_id": transaction.id,
            "simulation": True
        }), 200
        
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_SIMULATE] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_SIMULATE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to simulate payment"}), 500

# ===== SUBSCRIPTION MANAGEMENT ENDPOINTS =====

@ai_points_bp.route("/subscription/tiers", methods=["GET"])
@token_required
def get_subscription_tiers():
    """Get available subscription tiers for businesses"""
    try:
        from app.models import BusinessTier
        
        # Get active business tiers from database
        tiers = BusinessTier.query.filter_by(is_active=True).order_by(
            BusinessTier.display_order.asc(), 
            BusinessTier.price.asc()
        ).all()
        
        tier_list = [tier.to_dict() for tier in tiers]
        
        return jsonify({
            "tiers": tier_list,
            "stripe_public_key": os.getenv('STRIPE_PUBLIC_KEY')
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[GET_SUBSCRIPTION_TIERS] Error: {e}", exc_info=True)
        # Fallback to legacy tiers if database fails
        return jsonify({
            "tiers": SUBSCRIPTION_TIERS,
            "stripe_public_key": os.getenv('STRIPE_PUBLIC_KEY')
        }), 200

@ai_points_bp.route("/subscription/create_intent", methods=["POST"])
@token_required
@business_admin_required
def create_subscription_intent():
    """Create a Stripe payment intent for subscription upgrade"""
    try:
        data = request.get_json() or {}
        target_tier_id = data.get('tier')  # Now expecting tier ID
        business_id = data.get('business_id')
        
        # Get the target tier from database
        from app.models import BusinessTier
        target_tier = BusinessTier.query.get(target_tier_id)
        if not target_tier or not target_tier.is_active:
            return jsonify({"error": "Invalid subscription tier selected"}), 400
            
        # Check if user can upgrade this business
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
            
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
            
        # Check if it's actually an upgrade (compare by price as proxy for tier level)
        current_tier_price = business.tier_info.price if business.tier_info else 0
        if target_tier.price <= current_tier_price:
            return jsonify({"error": "Can only upgrade to higher tiers. Contact support for downgrades."}), 400
        
        # For free tier, no payment needed
        if target_tier.price == 0:
            return jsonify({"error": "Cannot create payment intent for free tier"}), 400
        
        # Create payment intent with Stripe
        intent = stripe.PaymentIntent.create(
            amount=target_tier.price,  # Amount in cents
            currency='usd',
            metadata={
                'business_id': business_id,
                'user_id': g.current_user.id,
                'target_tier_id': target_tier.id,
                'target_tier_name': target_tier.name,
                'current_tier_id': business.tier_id,
                'current_tier_name': business.tier_info.name if business.tier_info else 'None',
                'business_name': business.name,
                'subscription_upgrade': 'true'
            }
        )
        
        current_app.logger.info(f"[SUBSCRIPTION_INTENT] Created intent {intent.id} for business {business_id}, tier {target_tier.name}")
        
        return jsonify({
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "subscription_info": {
                "target_tier": target_tier.to_dict(),
                "current_tier": business.tier_info.to_dict() if business.tier_info else None,
                "business_name": business.name
            }
        }), 200
        
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[SUBSCRIPTION_INTENT] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        current_app.logger.error(f"[SUBSCRIPTION_INTENT] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create subscription intent"}), 500

@ai_points_bp.route("/subscription/simulate_payment", methods=["POST"])
@token_required
@business_admin_required
def simulate_subscription_payment():
    """Simulate a successful subscription upgrade payment for sandbox/testing"""
    try:
        data = request.get_json() or {}
        payment_intent_id = data.get('payment_intent_id')
        
        if not payment_intent_id:
            return jsonify({"error": "Payment intent ID is required"}), 400
            
        # Retrieve the payment intent from Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        # Verify this is a subscription upgrade
        if intent.metadata.get('subscription_upgrade') != 'true':
            return jsonify({"error": "Invalid payment intent for subscription"}), 400
        
        # Extract metadata
        business_id = int(intent.metadata['business_id'])
        user_id = int(intent.metadata['user_id'])
        target_tier_id = int(intent.metadata['target_tier_id'])
        target_tier_name = intent.metadata['target_tier_name']
        
        # Check if subscription change already processed
        # We'll use a different table for subscription transactions if needed, 
        # for now we'll use StripeTransaction with subscription metadata
        existing_transaction = StripeTransaction.query.filter_by(stripe_charge_id=payment_intent_id).first()
        if existing_transaction:
            return jsonify({"error": "Subscription upgrade already processed"}), 400
            
        # Check access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied"}), 403
            
        # Update business tier and limits using the new method
        success, upgrade_message = BusinessController.upgrade_business_tier_by_id(business_id, target_tier_id, user_id)
        if not success:
            return jsonify({"error": f"Failed to upgrade tier: {upgrade_message}"}), 500
            
        business = Business.query.get(business_id)
        
        # For sandbox simulation, we'll manually mark as succeeded
        current_app.logger.info(f"[SUBSCRIPTION_SIMULATE] Simulating subscription upgrade to {target_tier_name} for business {business_id}")
        
        # Log the subscription transaction
        transaction = StripeTransaction(
            business_id=business_id,
            user_id=user_id,
            stripe_charge_id=payment_intent_id,
            amount_paid=intent.amount,
            points_purchased=0,  # No points for subscription upgrades
            status='succeeded'
        )
        db.session.add(transaction)
        db.session.commit()
        
        current_app.logger.info(f"[SUBSCRIPTION_SIMULATE] Successfully upgraded business {business_id} to {target_tier_name}")
        
        return jsonify({
            "message": "Subscription upgrade simulation successful",
            "tier_updated": True,
            "new_tier": business.tier_info.to_dict() if business.tier_info else None,
            "transaction_id": transaction.id,
            "simulation": True
        }), 200
        
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[SUBSCRIPTION_SIMULATE] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SUBSCRIPTION_SIMULATE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to simulate subscription upgrade"}), 500

@ai_points_bp.route("/subscription/change_tier", methods=["PUT"])
@token_required
@business_admin_required
def change_business_tier():
    """Change a business subscription tier without requiring a payment intent (allows downgrades)."""
    data = request.get_json() or {}
    new_tier_id = data.get('tier')  # Now expecting tier ID
    business_id = data.get('business_id')

    # Get the new tier from database
    from app.models import BusinessTier
    new_tier = BusinessTier.query.get(new_tier_id)
    if not new_tier or not new_tier.is_active:
        return jsonify({"error": "Invalid subscription tier specified"}), 400

    # Access control – make sure requester can modify this business
    if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
        return jsonify({"error": "Access denied to this business"}), 403

    business = Business.query.get(business_id)
    if not business:
        return jsonify({"error": "Business not found"}), 404

    # No-op if already on desired tier
    if business.tier_id == new_tier_id:
        return jsonify({"message": "Business already on the requested tier", "tier": new_tier.to_dict()}), 200

    # Perform tier change (BusinessController handles upgrade vs downgrade logic)
    success, message = BusinessController.upgrade_business_tier_by_id(business_id, new_tier_id, g.current_user.id)
    if not success:
        return jsonify({"error": message}), 500

    # Refresh business to get updated tier info
    business = Business.query.get(business_id)
    return jsonify({
        "message": message,
        "tier_updated": True,
        "new_tier": business.tier_info.to_dict() if business.tier_info else None,
    }), 200

# ===== MONTHLY POINTS MANAGEMENT ENDPOINTS =====

@ai_points_bp.route("/business/<int:business_id>/ai_points/reset_monthly", methods=["POST"])
@token_required
@admin_required
def reset_monthly_points_admin(business_id):
    """Admin endpoint to manually reset monthly points for a business"""
    try:
        success, message = BusinessController.reset_monthly_points_for_business(business_id)
        
        if success:
            return jsonify({"message": message}), 200
        else:
            return jsonify({"error": message}), 400
            
    except Exception as e:
        current_app.logger.error(f"[RESET_MONTHLY_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to reset monthly points"}), 500

@ai_points_bp.route("/business/<int:business_id>/billing_cycle/initialize", methods=["POST"])
@token_required
@admin_required
def initialize_billing_cycle_admin(business_id):
    """Admin endpoint to initialize billing cycle for a business"""
    try:
        success, message = BusinessController.initialize_billing_cycle(business_id)
        
        if success:
            return jsonify({"message": message}), 200
        else:
            return jsonify({"error": message}), 400
            
    except Exception as e:
        current_app.logger.error(f"[INIT_BILLING_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to initialize billing cycle"}), 500

@ai_points_bp.route("/business/<int:business_id>/tier/upgrade", methods=["PUT"])
@token_required
@admin_required
def upgrade_business_tier_admin(business_id):
    """Admin endpoint to upgrade business tier"""
    try:
        data = request.get_json() or {}
        new_tier = data.get('tier')
        
        if new_tier not in SUBSCRIPTION_TIERS:
            return jsonify({"error": "Invalid tier specified"}), 400
            
        success, message = BusinessController.upgrade_business_tier(business_id, new_tier, g.current_user.id)
        
        if success:
            return jsonify({"message": message, "new_tier": new_tier}), 200
        else:
            return jsonify({"error": message}), 400
            
    except Exception as e:
        current_app.logger.error(f"[UPGRADE_TIER_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to upgrade business tier"}), 500

@ai_points_bp.route("/stripe/response_packages", methods=["GET"])
@token_required
def get_response_packages():
    """Get available response quota packages"""
    return jsonify({
        "packages": RESPONSE_PACKAGES,
        "stripe_public_key": os.getenv('STRIPE_PUBLIC_KEY')
    }), 200

@ai_points_bp.route("/stripe/response/create_payment_intent", methods=["POST"])
@token_required
@business_admin_required
def create_response_payment_intent():
    """Create Stripe payment intent for purchasing extra response quota"""
    try:
        data = request.get_json() or {}
        package_key = data.get('package')
        business_id = data.get('business_id') or g.current_user.business_id  # Use current user's business if not specified

        if package_key not in RESPONSE_PACKAGES:
            return jsonify({"error": "Invalid package selected"}), 400
        # Access control
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404

        package = RESPONSE_PACKAGES[package_key]
        
        # Calculate tier-based discount for response packages
        original_price = package['price']
        discount_percentage = get_tier_discount(business)
        
        if discount_percentage > 0:
            pricing_info = apply_tier_discount(original_price, discount_percentage)
            final_price = pricing_info['final_price']
            current_app.logger.info(f"[RESPONSE_DISCOUNT] Business {business_id} ({business.tier_info.name if business.tier_info else 'Unknown'}) gets {discount_percentage*100}% discount: ${original_price/100:.2f} -> ${final_price/100:.2f}")
        else:
            pricing_info = {
                'original_price': original_price,
                'discount_percentage': 0.0,
                'discount_amount': 0,
                'final_price': original_price
            }
            final_price = original_price

        intent = stripe.PaymentIntent.create(
            amount=final_price,  # Amount in cents (after discount)
            currency='usd',
            metadata={
                'business_id': business_id,
                'user_id': g.current_user.id,
                'package': package_key,
                'responses': package['responses'],
                'business_name': business.name,
                'response_quota_purchase': 'true',
                'original_price': original_price,
                'discount_percentage': discount_percentage,
                'discount_amount': pricing_info['discount_amount'],
                'final_price': final_price,
                'tier_name': business.tier_info.name if business.tier_info else 'Unknown'
            }
        )
        current_app.logger.info(f"[STRIPE_RESP_INTENT] Created intent {intent.id} for business {business_id}, package {package_key} with tier discount")
        return jsonify({
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "package": package,
            "pricing": pricing_info,
            "tier_info": {
                "name": business.tier_info.name if business.tier_info else None,
                "discount_percentage": discount_percentage
            },
            "business_name": business.name
        }), 200
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_RESP_INTENT] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        current_app.logger.error(f"[STRIPE_RESP_INTENT] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create payment intent"}), 500

@ai_points_bp.route("/stripe/response/simulate_payment", methods=["POST"])
@token_required
@business_admin_required
def simulate_response_payment():
    """Simulate successful payment for response quota (sandbox)"""
    try:
        data = request.get_json() or {}
        payment_intent_id = data.get('payment_intent_id')
        if not payment_intent_id:
            return jsonify({"error": "Payment intent ID is required"}), 400
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.metadata.get('response_quota_purchase') != 'true':
            return jsonify({"error": "Invalid payment intent"}), 400

        business_id = int(intent.metadata['business_id'])
        user_id = int(intent.metadata['user_id'])
        package_key = intent.metadata['package']
        responses_to_add = int(intent.metadata['responses'])

        # Prevent duplicate processing
        existing_tx = StripeTransaction.query.filter_by(stripe_charge_id=payment_intent_id).first()
        if existing_tx:
            return jsonify({"error": "Payment already processed"}), 400

        # Access check
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied"}), 403

        # Add responses to business
        success, msg = BusinessController.add_response_quota(business_id, responses_to_add, f"PURCHASE_{package_key.upper()}", user_id)
        if not success:
            return jsonify({"error": msg}), 500
        business = Business.query.get(business_id)

        # Log transaction
        transaction = StripeTransaction(
            business_id=business_id,
            user_id=user_id,
            stripe_charge_id=payment_intent_id,
            amount_paid=intent.amount,
            points_purchased=0,
            responses_purchased=responses_to_add,
            status='succeeded'
        )
        db.session.add(transaction)
        db.session.commit()

        current_app.logger.info(f"[STRIPE_RESP_SIM] Added {responses_to_add} responses to business {business_id}")
        return jsonify({
            "message": "Payment simulation successful and responses added",
            "responses_added": responses_to_add,
            "transaction_id": transaction.id,
            "simulation": True
        }), 200
    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_RESP_SIM] Stripe error: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[STRIPE_RESP_SIM] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to simulate payment"}), 500 