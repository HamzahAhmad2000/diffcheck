# routes/referral_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from ..controllers.referral_controller import ReferralController, ReferralAdminController
from ..controllers.auth_controller import token_required, admin_required, super_admin_required
from ..models import db, User
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint
referral_bp = Blueprint('referral', __name__)

# ===== USER REFERRAL ROUTES =====

@referral_bp.route('/referral-link', methods=['GET'])
@token_required
def get_user_referral_link():
    """
    Get or create a referral link for the current user.
    
    Returns:
        dict: Referral link information including URL, stats, and XP earned
    """
    try:
        user = g.current_user
        result = ReferralController.get_or_create_user_link(user)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_user_referral_link: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/referrals', methods=['GET'])
@token_required
def get_user_referrals():
    """
    Get the current user's referral history with pagination.
    
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 20, max: 100)
    """
    try:
        user = g.current_user
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        result = ReferralController.get_user_referrals(user, page, per_page)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_user_referrals: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/stats', methods=['GET'])
@token_required
def get_referral_stats():
    """
    Get comprehensive referral statistics for the current user.
    
    Returns:
        dict: Comprehensive referral statistics including totals and caps
    """
    try:
        user = g.current_user
        result = ReferralController.get_referral_stats(user)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_referral_stats: {e}")
        return jsonify({"error": "Internal server error"}), 500

# ===== VALIDATION ROUTES (PUBLIC) =====

@referral_bp.route('/validate', methods=['POST'])
def validate_referral_code():
    """
    Validate a referral code without processing signup.
    Used during registration to show referrer information.
    
    Body:
        code (str): The referral code to validate
        type (str): 'referral' or 'affiliate' (default: 'referral')
    """
    try:
        data = request.get_json()
        if not data or 'code' not in data:
            return jsonify({"error": "Code is required"}), 400
            
        code = data['code']
        code_type = data.get('type', 'referral')
        
        if code_type == 'affiliate':
            result = ReferralController.validate_affiliate_code(code)
        else:
            result = ReferralController.validate_referral_code(code)
        
        if not result.get('valid'):
            return jsonify({
                "valid": False,
                "error": result.get('error', 'Invalid code')
            }), 400
            
        return jsonify({
            "valid": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in validate_referral_code: {e}")
        return jsonify({"error": "Internal server error"}), 500

# ===== SIGNUP PROCESSING ROUTES (INTERNAL USE) =====

@referral_bp.route('/process-signup', methods=['POST'])
def process_referral_signup():
    """
    Process a referral signup and award XP.
    This should be called internally during user registration.
    
    Body:
        user_id (int): The newly registered user's ID
        code (str): The referral code used
        type (str): 'referral' or 'affiliate' (default: 'referral')
    """
    try:
        data = request.get_json()
        if not data or 'user_id' not in data or 'code' not in data:
            return jsonify({"error": "User ID and code are required"}), 400
            
        user_id = data['user_id']
        code = data['code']
        code_type = data.get('type', 'referral')
        
        # Get the user
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Process the signup based on type
        if code_type == 'affiliate':
            result = ReferralController.process_affiliate_signup(user, code)
        else:
            result = ReferralController.process_signup(user, code)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in process_referral_signup: {e}")
        return jsonify({"error": "Internal server error"}), 500

# ===== ADMIN ROUTES =====

@referral_bp.route('/admin/settings', methods=['GET'])
@token_required
@admin_required
def get_referral_settings():
    """
    Get current referral system settings (admin only).
    """
    try:
        settings = ReferralController.get_or_create_referral_settings()
        if not settings:
            return jsonify({"error": "Failed to get settings"}), 500
            
        return jsonify({
            "success": True,
            "data": settings.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_referral_settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/settings', methods=['PUT'])
@token_required
@super_admin_required
def update_referral_settings():
    """
    Update referral system settings (super admin only).
    
    Body:
        user_reward_xp (int): XP awarded to referrer
        new_user_bonus_xp (int): XP awarded to new user
        user_xp_cap (int): Maximum XP from referrals
        is_active (bool): Whether referral system is active
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        result = ReferralAdminController.update_referral_settings(data)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error in update_referral_settings: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/analytics', methods=['GET'])
@token_required
@admin_required
def get_referral_analytics():
    """
    Get platform-wide referral analytics (admin only).
    
    Query Parameters:
        start_date (str): Start date filter (YYYY-MM-DD)
        end_date (str): End date filter (YYYY-MM-DD)
    """
    try:
        # Extract date range from query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        date_range = None
        if start_date and end_date:
            date_range = {
                'start_date': start_date,
                'end_date': end_date
            }
        
        result = ReferralAdminController.get_referral_analytics(date_range)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_referral_analytics: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/affiliate-links', methods=['POST'])
@token_required
@admin_required
def create_affiliate_link():
    """
    Create a new affiliate link (admin only).
    
    Body:
        name (str): Affiliate program name
        description (str): Optional description
        business_id (int): Optional business ID
        user_id (int): Optional user ID
        custom_user_reward_xp (int): Optional custom XP for affiliate
        custom_new_user_bonus_xp (int): Optional custom XP for new user
        commission_rate (float): Optional commission rate
        expires_at (str): Optional expiration date (ISO format)
    """
    try:
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({"error": "Name is required"}), 400
            
        result = ReferralAdminController.create_affiliate_link(data)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify(result), 201
        
    except Exception as e:
        logger.error(f"Error in create_affiliate_link: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/affiliate-links', methods=['GET'])
@token_required
@admin_required
def list_affiliate_links():
    """
    List, search, and filter all affiliate links (admin only).
    
    Query Parameters:
        page (int): Page number
        per_page (int): Items per page
        search (str): Search term for name or code
        status (str): 'active', 'inactive', 'expired'
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', None, type=str)
        status = request.args.get('status', None, type=str)

        result = ReferralAdminController.list_affiliate_links(page, per_page, search, status)
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({"success": True, "data": result}), 200
        
    except Exception as e:
        logger.error(f"Error in list_affiliate_links: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/affiliate-links/<int:link_id>', methods=['PUT'])
@token_required
@admin_required
def update_affiliate_link(link_id):
    """
    Update an existing affiliate link (admin only).
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        result = ReferralAdminController.update_affiliate_link(link_id, data)
        
        if "error" in result:
            return jsonify(result), 404 if "not found" in result["error"] else 400
            
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error in update_affiliate_link: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/affiliate-links/<int:link_id>', methods=['DELETE'])
@token_required
@super_admin_required  # Make deletion a super_admin action
def delete_affiliate_link(link_id):
    """
    Delete an affiliate link (super admin only).
    """
    try:
        result = ReferralAdminController.delete_affiliate_link(link_id)
        
        if "error" in result:
            return jsonify(result), 404 if "not found" in result["error"] else 400
            
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error in delete_affiliate_link: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/tag-analytics', methods=['GET'])
@token_required
@admin_required
def get_tag_analytics():
    """
    Get analytics for tags assigned through affiliate links (admin only).
    """
    try:
        result = ReferralAdminController.get_tag_analytics()
        
        if "error" in result:
            return jsonify(result), 400
            
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_tag_analytics: {e}")
        return jsonify({"error": "Internal server error"}), 500

@referral_bp.route('/admin/users/<int:user_id>/referrals', methods=['GET'])
@token_required
@admin_required
def get_user_referrals_admin(user_id):
    """
    Get referral information for a specific user (admin only).
    
    Parameters:
        user_id (int): The user ID to get referrals for
        
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 20, max: 100)
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        # Get referral link info
        link_result = ReferralController.get_or_create_user_link(user)
        
        # Get referral history
        referrals_result = ReferralController.get_user_referrals(user, page, per_page)
        
        # Get referral stats
        stats_result = ReferralController.get_referral_stats(user)
        
        return jsonify({
            "success": True,
            "data": {
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email
                },
                "referral_link": link_result,
                "referrals": referrals_result,
                "stats": stats_result
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_user_referrals_admin: {e}")
        return jsonify({"error": "Internal server error"}), 500

# ===== ERROR HANDLERS =====

@referral_bp.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

@referral_bp.errorhandler(401)
def unauthorized(error):
    return jsonify({"error": "Unauthorized"}), 401

@referral_bp.errorhandler(403)
def forbidden(error):
    return jsonify({"error": "Forbidden"}), 403

@referral_bp.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@referral_bp.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500



