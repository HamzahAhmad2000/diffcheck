from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_scoped_permission_required, enforce_business_access
from app.controllers.feature_request_controller import FeatureRequestController

feature_request_bp = Blueprint('feature_request', __name__)

# ===== SUPER ADMIN FEATURE REQUEST MANAGEMENT ENDPOINTS =====

@feature_request_bp.route("/admin/feature-requests", methods=["GET"])
@token_required
@admin_required
def get_all_feature_requests():
    """Get all feature requests with optional filtering (super admin only)"""
    try:
        filters = {}
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('business_id'):
            filters['business_id'] = int(request.args.get('business_id'))
        if request.args.get('request_type'):
            filters['request_type'] = request.args.get('request_type')
        
        result, status = FeatureRequestController.get_all_feature_requests(filters)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_FEATURE_REQUESTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve feature requests"}), 500

@feature_request_bp.route("/admin/feature-requests/<int:request_id>", methods=["GET"])
@token_required
@admin_required
def get_feature_request(request_id):
    """Get a specific feature request by ID (super admin only)"""
    try:
        result, status = FeatureRequestController.get_feature_request_by_id(request_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_FEATURE_REQUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve feature request"}), 500

@feature_request_bp.route("/admin/feature-requests/<int:request_id>/review", methods=["POST"])
@token_required
@admin_required
def review_feature_request(request_id):
    """Review a feature request (approve/reject) - super admin only"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[REVIEW_FEATURE_REQUEST] Super admin {g.current_user.id} reviewing feature request {request_id}")
        
        result, status = FeatureRequestController.review_feature_request(request_id, g.current_user.id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[REVIEW_FEATURE_REQUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to review feature request"}), 500

@feature_request_bp.route("/admin/feature-requests/statistics", methods=["GET"])
@token_required
@admin_required
def get_feature_request_stats():
    """Get feature request statistics (super admin only)"""
    try:
        result, status = FeatureRequestController.get_feature_request_stats()
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_FEATURE_REQUEST_STATS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve feature request statistics"}), 500

# ===== BUSINESS ADMIN FEATURE REQUEST ENDPOINTS =====

@feature_request_bp.route("/businesses/<int:business_id>/feature-requests", methods=["GET"])
@token_required
@enforce_business_access
def get_business_feature_requests(business_id):
    """Get all feature requests for a specific business"""
    try:
        result, status = FeatureRequestController.get_business_feature_requests(business_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_FEATURE_REQUESTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business feature requests"}), 500

@feature_request_bp.route("/businesses/<int:business_id>/feature-requests", methods=["POST"])
@token_required
@enforce_business_access
def create_feature_request(business_id):
    """Create a new feature request from a business"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[CREATE_FEATURE_REQUEST] User {g.current_user.id} creating feature request for business {business_id}")
        
        result, status = FeatureRequestController.create_feature_request(business_id, g.current_user.id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CREATE_FEATURE_REQUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create feature request"}), 500

# ===== BUSINESS SPECIFIC FEATURE REQUEST TYPES =====

@feature_request_bp.route("/businesses/<int:business_id>/request-featured-business", methods=["POST"])
@token_required
@enforce_business_access
def request_featured_business(business_id):
    """Request to feature the business itself"""
    try:
        data = request.get_json() or {}
        data['request_type'] = 'FEATURED_BUSINESS'
        
        current_app.logger.info(f"[REQUEST_FEATURED_BUSINESS] User {g.current_user.id} requesting to feature business {business_id}")
        
        result, status = FeatureRequestController.create_feature_request(business_id, g.current_user.id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[REQUEST_FEATURED_BUSINESS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create featured business request"}), 500

@feature_request_bp.route("/businesses/<int:business_id>/request-featured-survey", methods=["POST"])
@token_required
@enforce_business_access
def request_featured_survey(business_id):
    """Request to feature a specific survey"""
    try:
        data = request.get_json() or {}
        data['request_type'] = 'FEATURED_SURVEY'
        
        if not data.get('target_item_id'):
            return jsonify({"error": "Survey ID (target_item_id) is required"}), 400
        
        current_app.logger.info(f"[REQUEST_FEATURED_SURVEY] User {g.current_user.id} requesting to feature survey {data['target_item_id']} for business {business_id}")
        
        result, status = FeatureRequestController.create_feature_request(business_id, g.current_user.id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[REQUEST_FEATURED_SURVEY] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create featured survey request"}), 500

@feature_request_bp.route("/businesses/<int:business_id>/request-featured-quest", methods=["POST"])
@token_required
@enforce_business_access
def request_featured_quest(business_id):
    """Request to feature a specific quest"""
    try:
        data = request.get_json() or {}
        data['request_type'] = 'FEATURED_QUEST'
        
        if not data.get('target_item_id'):
            return jsonify({"error": "Quest ID (target_item_id) is required"}), 400
        
        current_app.logger.info(f"[REQUEST_FEATURED_QUEST] User {g.current_user.id} requesting to feature quest {data['target_item_id']} for business {business_id}")
        
        result, status = FeatureRequestController.create_feature_request(business_id, g.current_user.id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[REQUEST_FEATURED_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create featured quest request"}), 500 