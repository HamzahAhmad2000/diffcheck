from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
from app.controllers.response_package_controller import ResponsePackageController

response_package_bp = Blueprint('response_package', __name__)

@response_package_bp.route('/admin/response-packages', methods=['GET'])
@token_required
@admin_required
def admin_get_all_response_packages():
    """Get all response packages (Super Admin only)"""
    try:
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        result, status_code = ResponsePackageController.get_all_packages(include_inactive)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages/<int:package_id>', methods=['GET'])
@token_required
@admin_required
def admin_get_response_package(package_id):
    """Get a specific response package (Super Admin only)"""
    try:
        result, status_code = ResponsePackageController.get_package_by_id(package_id)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages', methods=['POST'])
@token_required
@admin_required
def admin_create_response_package():
    """Create a new response package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        result, status_code = ResponsePackageController.create_package(data)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages/<int:package_id>', methods=['PUT'])
@token_required
@admin_required
def admin_update_response_package(package_id):
    """Update a response package (Super Admin only)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        result, status_code = ResponsePackageController.update_package(package_id, data)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages/<int:package_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_response_package(package_id):
    """Delete a response package (Super Admin only)"""
    try:
        result, status_code = ResponsePackageController.delete_package(package_id)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages/<int:package_id>/toggle-popular', methods=['PUT'])
@token_required
@admin_required
def admin_toggle_response_package_popular(package_id):
    """Toggle popular status of a response package (Super Admin only)"""
    try:
        result, status_code = ResponsePackageController.toggle_popular_status(package_id)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@response_package_bp.route('/admin/response-packages/stats', methods=['GET'])
@token_required
@admin_required
def admin_get_response_package_stats():
    """Get response package statistics (Super Admin only)"""
    try:
        result, status_code = ResponsePackageController.get_package_stats()
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== BUSINESS-FACING ENDPOINTS =====
@response_package_bp.route('/business/response-packages/available', methods=['GET'])
@token_required
@business_admin_required
def get_available_response_packages():
    """Get available response packages for purchase by Business Admins"""
    try:
        result, status_code = ResponsePackageController.get_all_packages(include_inactive=False)
        return jsonify(result), status_code
    except Exception as e:
        current_app.logger.error(f"Error fetching response packages for business {g.current_user.business_id}: {e}", exc_info=True)
        return jsonify({'error': "Failed to retrieve response packages"}), 500 