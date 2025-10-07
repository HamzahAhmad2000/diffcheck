# app/routes/activity_routes.py
from flask import Blueprint, request, jsonify, g
from app.controllers.activity_controller import ActivityController
from app.controllers.auth_controller import token_required # Ensure this sets g.current_user and g.user_role

activity_bp = Blueprint('activity_bp', __name__)

# --- Business Admin / Super Admin managing activities for a SPECIFIC business ---
@activity_bp.route('/businesses/<int:business_id>/activities', methods=['GET'])
@token_required 
def list_activities_for_business(business_id):
    # Further permission check might be needed here if BAs can only see their own business activities
    # For now, assuming token_required + specific controller logic is enough.
    # SuperAdmins can see any, BAs only their own.
    if g.user_role == 'business_admin' and g.current_user.business_id != business_id:
        return jsonify({"error": "Forbidden: You can only view activities for your assigned business."}), 403
        
    args = request.args
    result, status = ActivityController.list_business_activities(business_id, args)
    return jsonify(result), status

@activity_bp.route('/businesses/<int:business_id>/activities/custom-post', methods=['POST'])
@token_required
def create_custom_post_for_business(business_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ActivityController.create_custom_business_post(business_id, data, user_id, user_role)
    return jsonify(result), status


@activity_bp.route('/activities/<int:activity_id>/visibility', methods=['PUT'])
@token_required
def update_activity_visibility_route(activity_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ActivityController.update_activity_visibility(activity_id, data, user_id, user_role)
    return jsonify(result), status

@activity_bp.route('/activities/<int:activity_id>', methods=['DELETE'])
@token_required
def delete_activity_route(activity_id):
    user_id = g.current_user.id
    user_role = g.user_role
    result, status = ActivityController.delete_activity_by_id(activity_id, user_id, user_role)
    return jsonify(result), status

# --- Public route to get public activities for a business wall ---
@activity_bp.route('/public/businesses/<int:business_id>/feed', methods=['GET'])
def get_public_business_feed(business_id):
    # This route is public, no token_required.
    # Controller should filter for is_public=True
    args = request.args.copy() # Make a mutable copy
    args['is_public'] = 'true' # Force is_public filter
    
    result, status = ActivityController.list_business_activities(business_id, args)
    if status == 200: # Only return the activities array for public feed
        return jsonify(result.get("activities", [])), 200
    return jsonify(result), status 