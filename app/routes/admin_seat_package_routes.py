from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
from app.controllers.admin_seat_package_controller import AdminSeatPackageController

# Create blueprint
admin_seat_package_bp = Blueprint('admin_seat_package', __name__)

# ===== ADMIN SEAT PACKAGE MANAGEMENT (SUPER ADMIN) =====

@admin_seat_package_bp.route('/admin/admin-seat-packages', methods=['GET'])
@token_required
@admin_required
def get_all_admin_seat_packages():
    """Get all admin seat packages for super admin management"""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    result, status_code = AdminSeatPackageController.get_all_packages(include_inactive=include_inactive)
    return jsonify(result), status_code

@admin_seat_package_bp.route('/admin/admin-seat-packages', methods=['POST'])
@token_required
@admin_required
def create_admin_seat_package():
    """Create new admin seat package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result, status_code = AdminSeatPackageController.create_package(data)
        return jsonify(result), status_code
        
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

@admin_seat_package_bp.route('/admin/admin-seat-packages/<int:package_id>', methods=['GET'])
@token_required
@admin_required
def get_admin_seat_package_by_id(package_id):
    """Get specific admin seat package by ID"""
    result, status_code = AdminSeatPackageController.get_package_by_id(package_id)
    return jsonify(result), status_code

@admin_seat_package_bp.route('/admin/admin-seat-packages/<int:package_id>', methods=['PUT'])
@token_required
@admin_required
def update_admin_seat_package(package_id):
    """Update existing admin seat package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        result, status_code = AdminSeatPackageController.update_package(package_id, data)
        return jsonify(result), status_code
        
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

@admin_seat_package_bp.route('/admin/admin-seat-packages/<int:package_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_admin_seat_package(package_id):
    """Delete admin seat package (Super Admin only)"""
    result, status_code = AdminSeatPackageController.delete_package(package_id)
    return jsonify(result), status_code

# ===== BUSINESS-FACING ENDPOINTS =====

@admin_seat_package_bp.route('/business/admin-seat-packages/available', methods=['GET'])
@token_required
@business_admin_required
def get_available_admin_seat_packages():
    """Get active admin seat packages for business purchase."""
    try:
        result, status_code = AdminSeatPackageController.get_all_packages(include_inactive=False)
        return jsonify(result), status_code
    except Exception as e:
        current_app.logger.error(f"Error getting available admin seat packages for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve packages"}), 500

@admin_seat_package_bp.route('/business/admin-seat-packages/<int:package_id>/purchase', methods=['POST'])
@token_required
@business_admin_required
def purchase_admin_seat_package(package_id):
    """Process admin seat package purchase for a business."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No payment data provided"}), 400
        
        business_id = g.current_user.business_id
        
        # For now, simulate successful payment by bypassing Stripe
        # In production, you would process the actual payment here
        import time
        stripe_charge_id = f"ch_mock_admin_{package_id}_{business_id}_{int(time.time())}"
        
        # Get package to determine amount
        package_result, package_status = AdminSeatPackageController.get_package_by_id(package_id)
        if package_status != 200:
            return jsonify({"error": "Package not found"}), 404
        
        amount_paid = package_result['package']['price']
        
        result, status_code = AdminSeatPackageController.purchase_package(
            business_id=business_id,
            package_id=package_id,
            stripe_charge_id=stripe_charge_id,
            amount_paid=amount_paid
        )
        return jsonify(result), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error purchasing admin seat package for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "An error occurred during purchase."}), 500

@admin_seat_package_bp.route('/business/admin-seats/info', methods=['GET'])
@token_required
@business_admin_required
def get_business_seat_info():
    """Get business admin seat usage information."""
    try:
        business_id = g.current_user.business_id
        result, status_code = AdminSeatPackageController.get_business_seat_info(business_id)
        return jsonify(result), status_code
    except Exception as e:
        current_app.logger.error(f"Error getting seat info for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve seat information"}), 500 