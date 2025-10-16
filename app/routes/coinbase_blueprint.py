import os
import hmac
import hashlib
import requests
from flask import Blueprint, request, jsonify, current_app
from app.models import db, CryptoPayment, User

coinbase_bp = Blueprint("coinbase", __name__, url_prefix="/api/coinbase")

COINBASE_API_KEY = os.environ.get("COINBASE_COMMERCE_API_KEY")
COINBASE_SHARED_SECRET = os.environ.get("COINBASE_SHARED_SECRET")

BASE_URL = "https://api.commerce.coinbase.com/charges"
HEADERS = {
    "Content-Type": "application/json",
    "X-CC-Api-Key": COINBASE_API_KEY,
    "X-CC-Version": "2018-03-22"
}

def verify_webhook_signature(request_body, signature):
    """
    Verify Coinbase Commerce webhook signature using HMAC-SHA256

    Args:
        request_body: Raw request body as bytes
        signature: X-CC-Webhook-Signature header value

    Returns:
        bool: True if signature is valid
    """
    if not COINBASE_SHARED_SECRET:
        current_app.logger.error("COINBASE_SHARED_SECRET not configured")
        return False

    # Create expected signature
    expected_signature = hmac.new(
        COINBASE_SHARED_SECRET.encode('utf-8'),
        request_body,
        hashlib.sha256
    ).hexdigest()

    # Coinbase sends signature in format: sha256=<signature>
    if not signature.startswith('sha256='):
        return False

    received_signature = signature[7:]  # Remove 'sha256=' prefix

    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, received_signature)

@coinbase_bp.route("/create_charge", methods=["POST"])
def create_charge():
    """
    Create a Coinbase Commerce charge for crypto payment
    """
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        amount = data.get("amount")
        product_type = data.get("product_type", "general")
        metadata = data.get("metadata", {})

        if not all([user_id, amount]):
            return jsonify({"error": "Missing required fields: user_id, amount"}), 400

        # Validate amount
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({"error": "Amount must be greater than 0"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid amount format"}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check API key configuration
        if not COINBASE_API_KEY:
            return jsonify({"error": "Coinbase Commerce API key not configured"}), 500

        # Prepare metadata
        charge_metadata = {
            "user_id": str(user.id),
            "user_email": user.email,
            "product_type": product_type,
            **metadata
        }

        # Get frontend URL for redirects
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

        payload = {
            "name": f"Purchase {product_type.replace('_', ' ').title()}",
            "description": f"Crypto payment for {user.name or user.username}",
            "pricing_type": "fixed_price",
            "local_price": {
                "amount": str(amount),
                "currency": "USD"
            },
            "metadata": charge_metadata,
            "redirect_url": f"{frontend_url}/payment/success?provider=coinbase",
            "cancel_url": f"{frontend_url}/payment/cancel?provider=coinbase"
        }

        current_app.logger.info(f"Creating Coinbase charge for user {user_id}, amount: ${amount}")

        response = requests.post(BASE_URL, headers=HEADERS, json=payload, timeout=30)
        response_data = response.json()

        if response.status_code != 201:
            current_app.logger.error(f"Coinbase charge creation failed: {response.status_code} - {response_data}")
            return jsonify({
                "error": "Failed to create Coinbase charge",
                "details": response_data.get('error', {}).get('message', 'Unknown error')
            }), 400

        charge_data = response_data["data"]

        # Save payment record
        new_payment = CryptoPayment(
            user_id=user.id,
            charge_id=charge_data["id"],
            hosted_url=charge_data["hosted_url"],
            amount=amount,
            currency="USD",
            product_type=product_type,
            status="PENDING"
        )

        db.session.add(new_payment)
        db.session.commit()

        current_app.logger.info(f"Created Coinbase charge {charge_data['id']} for user {user_id}")

        return jsonify({
            "success": True,
            "charge_id": charge_data["id"],
            "hosted_url": charge_data["hosted_url"],
            "status": charge_data["timeline"][0]["status"] if charge_data.get("timeline") else "PENDING",
            "amount": amount,
            "currency": "USD"
        })

    except Exception as e:
        current_app.logger.error(f"Error creating Coinbase charge: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@coinbase_bp.route("/webhook", methods=["POST"])
def webhook():
    """
    Handle Coinbase Commerce webhooks with signature verification
    """
    try:
        # Get raw request data and signature
        request_body = request.get_data()
        signature = request.headers.get('X-CC-Webhook-Signature')

        # Verify webhook signature if shared secret is configured
        if COINBASE_SHARED_SECRET and signature:
            if not verify_webhook_signature(request_body, signature):
                current_app.logger.warning("Invalid Coinbase webhook signature")
                return jsonify({"error": "Invalid signature"}), 401
        elif COINBASE_SHARED_SECRET:
            current_app.logger.warning("Coinbase webhook received without signature header")
            return jsonify({"error": "Missing signature"}), 400

        # Parse webhook payload
        try:
            event = request.get_json()
        except Exception as e:
            current_app.logger.error(f"Failed to parse webhook JSON: {str(e)}")
            return jsonify({"error": "Invalid JSON"}), 400

        event_type = event.get("event", {}).get("type")
        charge_data = event.get("event", {}).get("data", {})

        if not event_type or not charge_data:
            return jsonify({"error": "Invalid webhook payload"}), 400

        charge_id = charge_data.get("id")
        if not charge_id:
            return jsonify({"error": "Missing charge ID"}), 400

        current_app.logger.info(f"Received Coinbase webhook: {event_type} for charge {charge_id}")

        # Find the payment record
        payment = CryptoPayment.query.filter_by(charge_id=charge_id).first()
        if not payment:
            current_app.logger.warning(f"Payment not found for charge {charge_id}")
            return jsonify({"error": "Payment not found"}), 404

        # Update payment status based on event type
        old_status = payment.status

        if event_type == "charge:confirmed":
            payment.status = "CONFIRMED"
            # Handle successful payment fulfillment
            handle_successful_payment(payment, charge_data)

        elif event_type == "charge:failed":
            payment.status = "FAILED"
            current_app.logger.warning(f"Payment failed for charge {charge_id}")

        elif event_type == "charge:pending":
            payment.status = "PENDING"

        elif event_type == "charge:delayed":
            payment.status = "DELAYED"
            current_app.logger.info(f"Payment delayed for charge {charge_id}")

        elif event_type == "charge:resolved":
            payment.status = "RESOLVED"
            current_app.logger.info(f"Payment resolved for charge {charge_id}")

        # Commit status change
        db.session.commit()

        current_app.logger.info(f"Updated payment {payment.id} status from {old_status} to {payment.status}")

        return jsonify({"success": True})

    except Exception as e:
        current_app.logger.error(f"Error processing Coinbase webhook: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


def handle_successful_payment(payment, charge_data):
    """
    Handle fulfillment logic for successful crypto payments

    Args:
        payment: CryptoPayment model instance
        charge_data: Charge data from webhook
    """
    try:
        # For season pass purchases, trigger fulfillment
        if payment.product_type == "season_pass":
            from app.controllers.season_pass_payment_controller import SeasonPassPaymentController

            metadata = charge_data.get("metadata", {})
            fulfillment_result = SeasonPassPaymentController.fulfill_season_pass_purchase(
                payment.charge_id,  # Using charge_id as payment reference
                metadata,
                payment_method='COINBASE'
            )

            if fulfillment_result.get('success'):
                current_app.logger.info(f"Successfully fulfilled season pass for payment {payment.id}")
            else:
                current_app.logger.error(f"Failed to fulfill season pass for payment {payment.id}: {fulfillment_result.get('error')}")

        # Add more product type handling here as needed
        # elif payment.product_type == "ai_points":
        #     handle_ai_points_purchase(payment, charge_data)
        # elif payment.product_type == "response_package":
        #     handle_response_package_purchase(payment, charge_data)

    except Exception as e:
        current_app.logger.error(f"Error in payment fulfillment: {str(e)}")
        # Don't raise exception - webhook should still return success
