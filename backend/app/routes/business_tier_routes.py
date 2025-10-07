from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required
from app.controllers.business_tier_controller import BusinessTierController

business_tier_bp = Blueprint('business_tier', __name__)

# ===== BUSINESS TIER MANAGEMENT ENDPOINTS =====

@business_tier_bp.route("/admin/business-tiers", methods=["GET"])
@token_required
@admin_required
def get_all_business_tiers():
    """Get all business tiers (super admin only)"""
    try:
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        result, status = BusinessTierController.get_all_tiers(include_inactive=include_inactive)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_BUSINESS_TIERS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business tiers"}), 500

@business_tier_bp.route("/admin/business-tiers/<int:tier_id>", methods=["GET"])
@token_required
@admin_required
def get_business_tier(tier_id):
    """Get a specific business tier by ID (super admin only)"""
    try:
        result, status = BusinessTierController.get_tier_by_id(tier_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_TIER] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business tier"}), 500

@business_tier_bp.route("/admin/business-tiers", methods=["POST"])
@token_required
@admin_required
def create_business_tier():
    """Create a new business tier (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[CREATE_BUSINESS_TIER] Super admin {g.current_user.id} creating new business tier: {data.get('name')}")
        
        result, status = BusinessTierController.create_tier(data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CREATE_BUSINESS_TIER] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create business tier"}), 500

@business_tier_bp.route("/admin/business-tiers/<int:tier_id>", methods=["PUT"])
@token_required
@admin_required
def update_business_tier(tier_id):
    """Update an existing business tier (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[UPDATE_BUSINESS_TIER] Super admin {g.current_user.id} updating business tier {tier_id}")
        
        result, status = BusinessTierController.update_tier(tier_id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UPDATE_BUSINESS_TIER] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update business tier"}), 500

@business_tier_bp.route("/admin/business-tiers/<int:tier_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_business_tier(tier_id):
    """Delete a business tier (super admin only)"""
    try:
        current_app.logger.info(f"[DELETE_BUSINESS_TIER] Super admin {g.current_user.id} deleting business tier {tier_id}")
        
        result, status = BusinessTierController.delete_tier(tier_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[DELETE_BUSINESS_TIER] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete business tier"}), 500

@business_tier_bp.route("/admin/business-tiers/statistics", methods=["GET"])
@token_required
@admin_required
def get_business_tier_stats():
    """Get business tier usage statistics (super admin only)"""
    try:
        result, status = BusinessTierController.get_tier_stats()
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_TIER_STATS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve tier statistics"}), 500

# ===== PUBLIC ENDPOINTS FOR BUSINESS CREATION/MODIFICATION =====

@business_tier_bp.route("/business-tiers", methods=["GET"])
def get_available_business_tiers():
    """Get available business tiers for business creation/subscription (public endpoint)"""
    try:
        result, status = BusinessTierController.get_all_tiers(include_inactive=False)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AVAILABLE_BUSINESS_TIERS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve available business tiers"}), 500


@business_tier_bp.route("/business-tiers/custom-request", methods=["POST"])
def request_custom_business_tier():
    """Handle custom business tier requests from businesses"""
    try:
        data = request.get_json() or {}
        contact_email = data.get("email")
        message = data.get("message", "")
        business_name = data.get("business_name", "Unknown Business")

        if not contact_email:
            return jsonify({"error": "Email is required"}), 400

        current_app.logger.info(
            f"[CUSTOM_TIER_REQUEST] {business_name} ({contact_email})")

        # Send email notification to super admin
        from flask_mail import Message
        from app.extensions import mail

        admin_email = current_app.config.get(
            "MAIL_USERNAME", "galvanaisolutions@gmail.com")

        msg = Message(
            subject="New Custom Package Request",
            recipients=[admin_email]
        )
        msg.body = (
            f"Business: {business_name}\n"
            f"Email: {contact_email}\n\n"
            f"Message:\n{message}"
        )
        try:
            mail.send(msg)
        except Exception as e:
            current_app.logger.error(f"Failed to send custom package email: {e}")

        return jsonify({"message": "Request submitted"}), 200

    except Exception as e:
        current_app.logger.error(f"[CUSTOM_TIER_REQUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to submit request"}), 500
