from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
from app.controllers.ai_points_package_controller import AIPointsPackageController

ai_points_package_bp = Blueprint('ai_points_package', __name__)

# ===== AI POINTS PACKAGE MANAGEMENT ENDPOINTS (SUPER ADMIN) =====

@ai_points_package_bp.route("/admin/ai-points-packages", methods=["GET"])
@ai_points_package_bp.route("/admin/ai-points-packages/all", methods=["GET"])
@token_required
@admin_required
def get_all_ai_points_packages():
    """Get all AI points packages (super admin only)"""
    try:
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        result, status = AIPointsPackageController.get_all_packages(include_inactive=include_inactive)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_AI_POINTS_PACKAGES] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve AI points packages"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages/<int:package_id>", methods=["GET"])
@token_required
@admin_required
def get_ai_points_package(package_id):
    """Get a specific AI points package by ID (super admin only)"""
    try:
        result, status = AIPointsPackageController.get_package_by_id(package_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AI_POINTS_PACKAGE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve AI points package"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages", methods=["POST"])
@token_required
@admin_required
def create_ai_points_package():
    """Create a new AI points package (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[CREATE_AI_POINTS_PACKAGE] Super admin {g.current_user.id} creating new AI points package: {data.get('name')}")
        
        result, status = AIPointsPackageController.create_package(data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CREATE_AI_POINTS_PACKAGE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create AI points package"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages/<int:package_id>", methods=["PUT"])
@token_required
@admin_required
def update_ai_points_package(package_id):
    """Update an existing AI points package (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[UPDATE_AI_POINTS_PACKAGE] Super admin {g.current_user.id} updating AI points package {package_id}")
        
        result, status = AIPointsPackageController.update_package(package_id, data)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UPDATE_AI_POINTS_PACKAGE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update AI points package"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages/<int:package_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_ai_points_package(package_id):
    """Delete an AI points package (super admin only)"""
    try:
        current_app.logger.info(f"[DELETE_AI_POINTS_PACKAGE] Super admin {g.current_user.id} deleting AI points package {package_id}")
        
        result, status = AIPointsPackageController.delete_package(package_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[DELETE_AI_POINTS_PACKAGE] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete AI points package"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages/<int:package_id>/toggle-popular", methods=["POST"])
@token_required
@admin_required
def toggle_package_popular_status(package_id):
    """Toggle the popular status of an AI points package (super admin only)"""
    try:
        current_app.logger.info(f"[TOGGLE_PACKAGE_POPULAR] Super admin {g.current_user.id} toggling popular status for package {package_id}")
        
        result, status = AIPointsPackageController.toggle_popular_status(package_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[TOGGLE_PACKAGE_POPULAR] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update package status"}), 500

@ai_points_package_bp.route("/admin/ai-points-packages/statistics", methods=["GET"])
@token_required
@admin_required
def get_ai_points_package_stats():
    """Get AI points package statistics (super admin only)"""
    try:
        result, status = AIPointsPackageController.get_package_stats()
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AI_POINTS_PACKAGE_STATS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve package statistics"}), 500

# ===== BUSINESS-FACING ENDPOINTS FOR AI POINTS PURCHASE =====

@ai_points_package_bp.route("/business/ai-points-packages/available", methods=["GET"])
@token_required
@business_admin_required
def get_available_ai_points_packages_for_business():
    """Get available AI points packages for purchase by a business admin."""
    try:
        result, status = AIPointsPackageController.get_all_packages(include_inactive=False)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AVAILABLE_AI_POINTS_PACKAGES_FOR_BUSINESS] Error for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve available AI points packages"}), 500 