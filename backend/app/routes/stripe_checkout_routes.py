# stripe_checkout_routes.py
import stripe
import os
from flask import Blueprint, request, jsonify, current_app, g
from app.extensions import db
from app.models import Business, BusinessTier, AIPointsPackage, ResponsePackage, QuestPackage, AdminSeatPackage
from app.controllers.business_controller import BusinessController
from app.controllers.ai_points_package_controller import AIPointsPackageController
from app.controllers.quest_package_controller import QuestPackageController
from app.controllers.admin_seat_package_controller import AdminSeatPackageController
from app.controllers.auth_controller import token_required, business_admin_required

stripe_checkout_bp = Blueprint('stripe_checkout', __name__)

# Set Stripe API key
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

@stripe_checkout_bp.route('/create-checkout-session', methods=['POST'])
@token_required
@business_admin_required
def create_checkout_session():
    """Create a Stripe Checkout session for various purchase types"""
    try:
        data = request.get_json() or {}
        purchase_type = data.get('type')  # 'subscription', 'ai_points', 'responses', 'quests', 'admin_seats'
        business_id = data.get('business_id') or g.current_user.business_id
        
        # Verify business access
        if g.user_role != 'super_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied to this business"}), 403
            
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404

        # Route to appropriate checkout session creation
        if purchase_type == 'subscription':
            return create_subscription_checkout(data, business)
        elif purchase_type == 'ai_points':
            return create_ai_points_checkout(data, business)
        elif purchase_type == 'responses':
            return create_responses_checkout(data, business)
        elif purchase_type == 'quests':
            return create_quests_checkout(data, business)
        elif purchase_type == 'admin_seats':
            return create_admin_seats_checkout(data, business)
        else:
            return jsonify({"error": "Invalid purchase type"}), 400

    except Exception as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Error creating checkout session: {e}", exc_info=True)
        return jsonify({"error": "Failed to create checkout session"}), 500

def create_subscription_checkout(data, business):
    """Create checkout session for business tier subscription"""
    try:
        tier_id = data.get('tier_id')
        if not tier_id:
            return jsonify({"error": "Tier ID is required"}), 400

        target_tier = BusinessTier.query.get(tier_id)
        if not target_tier or not target_tier.is_active:
            return jsonify({"error": "Invalid or inactive tier"}), 404

        # Check if it's an upgrade
        current_tier_price = business.tier_info.price if business.tier_info else 0
        if target_tier.price <= current_tier_price:
            return jsonify({"error": "Use direct API for downgrades or same tier"}), 400

        # Create Stripe Checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{target_tier.name} Subscription',
                        'description': target_tier.description or f'Upgrade to {target_tier.name} plan',
                    },
                    'unit_amount': target_tier.price,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/business/subscription/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/business/subscription/cancel',
            metadata={
                'business_id': business.id,
                'user_id': g.current_user.id,
                'target_tier_id': target_tier.id,
                'target_tier_name': target_tier.name,
                'current_tier_id': business.tier_id,
                'current_tier_name': business.tier_info.name if business.tier_info else 'None',
                'business_name': business.name,
                'subscription_upgrade': 'true',
                'purchase_type': 'subscription'
            },
            customer_email=g.current_user.email if hasattr(g.current_user, 'email') else None,
        )

        current_app.logger.info(f"[STRIPE_CHECKOUT] Created subscription checkout session {session.id} for business {business.id}")
        
        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Stripe error creating subscription checkout: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500

def create_ai_points_checkout(data, business):
    """Create checkout session for AI points package"""
    try:
        package_id = data.get('package_id')
        if not package_id:
            return jsonify({"error": "Package ID is required"}), 400

        # Get package details
        packages_result, packages_status = AIPointsPackageController.get_all_packages(include_inactive=False)
        if packages_status != 200:
            return jsonify({"error": "Failed to retrieve available packages"}), 500

        package = next((p for p in packages_result['packages'] if p['id'] == package_id), None)
        if not package:
            return jsonify({"error": "Invalid package selected"}), 400

        # Calculate tier-based discount
        from app.routes.ai_points_routes import get_tier_discount, apply_tier_discount
        
        original_price = package['price']
        discount_percentage = get_tier_discount(business)
        
        if discount_percentage > 0:
            pricing_info = apply_tier_discount(original_price, discount_percentage)
            final_price = pricing_info['final_price']
        else:
            pricing_info = {
                'original_price': original_price,
                'discount_percentage': 0.0,
                'discount_amount': 0,
                'final_price': original_price
            }
            final_price = original_price

        # Create Stripe Checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{package["name"]} - AI Points',
                        'description': f'{package["total_points"]} AI points for your business',
                    },
                    'unit_amount': final_price,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/business/ai-points/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/business/ai-points/cancel',
            metadata={
                'business_id': business.id,
                'user_id': g.current_user.id,
                'package_id': package['id'],
                'package_name': package['name'],
                'points': package['total_points'],
                'business_name': business.name,
                'original_price': original_price,
                'discount_percentage': discount_percentage,
                'discount_amount': pricing_info['discount_amount'],
                'final_price': final_price,
                'tier_name': business.tier_info.name if business.tier_info else 'Unknown',
                'purchase_type': 'ai_points'
            },
            customer_email=g.current_user.email if hasattr(g.current_user, 'email') else None,
        )

        current_app.logger.info(f"[STRIPE_CHECKOUT] Created AI points checkout session {session.id} for business {business.id}")
        
        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id,
            "pricing_info": pricing_info
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Stripe error creating AI points checkout: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500

def create_responses_checkout(data, business):
    """Create checkout session for response packages"""
    try:
        package_id = data.get('package_id')
        package_key = data.get('package_key')
        
        if package_id:
            # Use new ResponsePackage model
            from app.controllers.response_package_controller import ResponsePackageController
            result, status = ResponsePackageController.get_package_by_id(package_id)
            if status != 200:
                return jsonify({"error": "Invalid response package"}), 400
            package = result['package']
        elif package_key:
            # Use legacy RESPONSE_PACKAGES for backward compatibility
            from app.routes.ai_points_routes import RESPONSE_PACKAGES
            package_data = RESPONSE_PACKAGES.get(package_key)
            if not package_data:
                return jsonify({"error": "Invalid response package"}), 400
            # Convert to expected format
            package = {
                'id': package_key,
                'name': package_data['name'],
                'responses': package_data['responses'],
                'price': package_data['price']
            }
        else:
            return jsonify({"error": "Package ID or key is required"}), 400

        # Create Stripe Checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{package["name"]} - Response Quota',
                        'description': f'{package["responses"]} additional survey responses',
                    },
                    'unit_amount': package['price'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/business/responses/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/business/responses/cancel',
            metadata={
                'business_id': business.id,
                'user_id': g.current_user.id,
                'package': package.get('id', package_key),
                'responses': package['responses'],
                'business_name': business.name,
                'response_quota_purchase': 'true',
                'purchase_type': 'responses'
            },
            customer_email=g.current_user.email if hasattr(g.current_user, 'email') else None,
        )

        current_app.logger.info(f"[STRIPE_CHECKOUT] Created response checkout session {session.id} for business {business.id}")
        
        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Stripe error creating response checkout: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500

def create_quests_checkout(data, business):
    """Create checkout session for quest packages"""
    try:
        package_id = data.get('package_id')
        if not package_id:
            return jsonify({"error": "Package ID is required"}), 400

        # Get quest package
        result, status = QuestPackageController.get_all_packages()
        if status != 200:
            return jsonify({"error": "Failed to retrieve quest packages"}), 500

        package = next((p for p in result['packages'] if p['id'] == package_id), None)
        if not package:
            return jsonify({"error": "Invalid quest package"}), 400

        # Create Stripe Checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{package["name"]} - Quest Credits',
                        'description': f'{package["total_credits"]} quest credits for your business',
                    },
                    'unit_amount': package['price'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/business/quests/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/business/quests/cancel',
            metadata={
                'business_id': business.id,
                'user_id': g.current_user.id,
                'quest_package_id': package['id'],
                'quest_credits': package['total_credits'],
                'business_name': business.name,
                'purchase_type': 'quests'
            },
            customer_email=g.current_user.email if hasattr(g.current_user, 'email') else None,
        )

        current_app.logger.info(f"[STRIPE_CHECKOUT] Created quest checkout session {session.id} for business {business.id}")
        
        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Stripe error creating quest checkout: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500

def create_admin_seats_checkout(data, business):
    """Create checkout session for admin seat packages"""
    try:
        package_id = data.get('package_id')
        if not package_id:
            return jsonify({"error": "Package ID is required"}), 400

        # Get admin seat package
        result, status = AdminSeatPackageController.get_all_packages()
        if status != 200:
            return jsonify({"error": "Failed to retrieve admin seat packages"}), 500

        package = next((p for p in result['packages'] if p['id'] == package_id), None)
        if not package:
            return jsonify({"error": "Invalid admin seat package"}), 400

        # Create Stripe Checkout session
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{package["name"]} - Admin Seats',
                        'description': f'{package["total_seats"]} additional admin seats',
                    },
                    'unit_amount': package['price'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/business/admin-seats/success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/business/admin-seats/cancel',
            metadata={
                'business_id': business.id,
                'user_id': g.current_user.id,
                'admin_seat_package_id': package['id'],
                'admin_seats': package['total_seats'],
                'business_name': business.name,
                'purchase_type': 'admin_seats'
            },
            customer_email=g.current_user.email if hasattr(g.current_user, 'email') else None,
        )

        current_app.logger.info(f"[STRIPE_CHECKOUT] Created admin seats checkout session {session.id} for business {business.id}")
        
        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Stripe error creating admin seats checkout: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500

@stripe_checkout_bp.route('/session-status/<session_id>', methods=['GET'])
@token_required
def get_session_status(session_id):
    """Get the status of a Stripe Checkout session"""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        return jsonify({
            "status": session.status,
            "payment_status": session.payment_status,
            "customer_email": session.customer_email,
            "metadata": session.metadata
        }), 200

    except stripe.error.StripeError as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Error retrieving session status: {e}", exc_info=True)
        return jsonify({"error": f"Payment service error: {str(e)}"}), 500
    except Exception as e:
        current_app.logger.error(f"[STRIPE_CHECKOUT] Error retrieving session status: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve session status"}), 500
