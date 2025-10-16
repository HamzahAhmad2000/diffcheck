from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.quest_package_controller import QuestPackageController
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
import time

# Create blueprint
quest_package_bp = Blueprint('quest_package', __name__)

# Super Admin Routes for Quest Package Management

@quest_package_bp.route('/admin/quest-packages', methods=['GET'])
@token_required
@admin_required
def get_all_quest_packages():
    """Get all quest packages for super admin management"""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    result, status_code = QuestPackageController.get_all_packages(include_inactive=include_inactive)
    return jsonify(result), status_code

@quest_package_bp.route('/admin/quest-packages', methods=['POST'])
@token_required
@admin_required
def create_quest_package():
    """Create new quest package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result, status_code = QuestPackageController.create_package(data)
        return jsonify(result), status_code
        
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

@quest_package_bp.route('/admin/quest-packages/<int:package_id>', methods=['GET'])
@token_required
@admin_required
def get_quest_package_by_id(package_id):
    """Get specific quest package by ID"""
    result, status_code = QuestPackageController.get_package_by_id(package_id)
    return jsonify(result), status_code

@quest_package_bp.route('/admin/quest-packages/<int:package_id>', methods=['PUT'])
@token_required
@admin_required
def update_quest_package(package_id):
    """Update existing quest package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result, status_code = QuestPackageController.update_package(package_id, data)
        return jsonify(result), status_code
        
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

@quest_package_bp.route('/admin/quest-packages/<int:package_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_quest_package(package_id):
    """Delete quest package (Super Admin only)"""
    result, status_code = QuestPackageController.delete_package(package_id)
    return jsonify(result), status_code

# Business Routes for Quest Package Purchase

@quest_package_bp.route('/business/quest-packages/available', methods=['GET'])
@token_required
@business_admin_required
def get_available_quest_packages():
    """Get all active quest packages for business purchase."""
    try:
        result, status = QuestPackageController.get_all_packages(include_inactive=False)
        return jsonify(result), status
    except Exception as e:
        current_app.logger.error(f"[GET_AVAILABLE_QUEST_PACKAGES] Error for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve available quest packages"}), 500

@quest_package_bp.route('/business/quest-packages', methods=['GET'])
@token_required
@business_admin_required
def get_active_quest_packages():
    """Get active quest packages for business purchase view"""
    result, status_code = QuestPackageController.get_active_packages()
    return jsonify(result), status_code

@quest_package_bp.route('/business/quest-packages/<int:package_id>/purchase', methods=['POST'])
@token_required
@business_admin_required
def purchase_quest_package(package_id):
    """Process quest package purchase for a business."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No payment data provided"}), 400

        business_id = g.current_user.business_id

        # For now, simulate successful payment by bypassing Stripe
        # In production, you would process the actual payment here
        stripe_charge_id = f"ch_mock_{package_id}_{business_id}_{int(time.time())}"
        
        # Get package to determine amount
        package_result, package_status = QuestPackageController.get_package_by_id(package_id)
        if package_status != 200:
            return jsonify({"error": "Package not found"}), 404
        
        amount_paid = package_result['package']['price']
        
        result, status_code = QuestPackageController.purchase_package(
            business_id=business_id,
            package_id=package_id,
            stripe_charge_id=stripe_charge_id,
            amount_paid=amount_paid
        )
        return jsonify(result), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error purchasing quest package for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "An error occurred during purchase."}), 500 