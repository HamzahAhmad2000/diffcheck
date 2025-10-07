# app/routes/item_routes.py
from flask import Blueprint, request, jsonify, g
from app.controllers.item_controller import ItemController
from app.controllers.auth_controller import (
    token_required, 
    business_admin_scoped_permission_required,
    enforce_business_access
)

item_bp = Blueprint('item', __name__)

# ===== BUSINESS-SCOPED ITEM ROUTES (Features/Bugs) =====

@item_bp.route('/businesses/<int:business_id>/items', methods=['GET'])
@token_required
@enforce_business_access
def list_items_for_business(business_id):
    """List all items (bugs/features) for a specific business"""
    args = request.args
    result, status = ItemController.list_items_for_business(business_id, args)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/items', methods=['POST'])
@token_required
@enforce_business_access
def create_item_for_business(business_id):
    """Create a new bug report or feature request"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.create_item(business_id, data, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/bugs', methods=['GET'])
@token_required
@enforce_business_access
def list_bugs_for_business(business_id):
    """List bug reports for a specific business"""
    args = request.args.copy()
    args['type'] = 'BUG'
    result, status = ItemController.list_items_for_business(business_id, args)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/features', methods=['GET'])
@token_required
@enforce_business_access
def list_features_for_business(business_id):
    """List feature requests for a specific business"""
    args = request.args.copy()
    args['type'] = 'FEATURE'
    result, status = ItemController.list_items_for_business(business_id, args)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/bugs', methods=['POST'])
@token_required
@enforce_business_access
def create_bug_report(business_id):
    """Create a new bug report"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Force item type to BUG
    data['item_type'] = 'BUG'
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.create_item(business_id, data, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/features', methods=['POST'])
@token_required
@enforce_business_access
def create_feature_request(business_id):
    """Create a new feature request"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Force item type to FEATURE
    data['item_type'] = 'FEATURE'
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.create_item(business_id, data, user_id, user_role)
    return jsonify(result), status

# ===== ITEM MANAGEMENT ROUTES =====

@item_bp.route('/items/<int:item_id>', methods=['GET'])
@token_required
def get_item(item_id):
    """Get item details"""
    result, status = ItemController.get_item(item_id)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>', methods=['PUT'])
@token_required
def update_item(item_id):
    """Update an item (title, description, image)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.update_item(item_id, data, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/status', methods=['PUT'])
@token_required
def update_item_status(item_id):
    """Update item status (admin only)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.update_item_status(item_id, data, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>', methods=['DELETE'])
@token_required
def delete_item(item_id):
    """Delete an item"""
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.delete_item(item_id, user_id, user_role)
    return jsonify(result), status

# ===== VOTING ROUTES =====

@item_bp.route('/items/<int:item_id>/vote', methods=['POST'])
@token_required
def vote_on_item(item_id):
    """Vote on an item (upvote or downvote)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = g.current_user.id
    
    result, status = ItemController.vote_on_item(item_id, data, user_id)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/vote', methods=['GET'])
@token_required
def get_user_vote(item_id):
    """Get user's vote on an item"""
    user_id = g.current_user.id
    
    result, status = ItemController.get_user_vote(item_id, user_id)
    return jsonify(result), status

# ===== BUSINESS ADMIN ITEM MANAGEMENT =====

@item_bp.route('/businesses/<int:business_id>/items/admin', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_manage_items')
def list_items_admin_view(business_id):
    """Admin view of all items for management"""
    args = request.args
    # Ensure admin_view is set for this endpoint
    args = args.copy()
    args['admin_view'] = 'true'
    result, status = ItemController.list_items_for_business(business_id, args)
    
    # Add additional admin information if needed
    if status == 200:
        result['admin_view'] = True
        
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/publish', methods=['PUT'])
@token_required
def publish_item(item_id):
    """Publish an item (admin only)"""
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.publish_item(item_id, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/unpublish', methods=['PUT'])
@token_required
def unpublish_item(item_id):
    """Unpublish an item (admin only)"""
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.unpublish_item(item_id, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/archive', methods=['PUT'])
@token_required
def archive_item(item_id):
    """Archive an item (admin only)"""
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.archive_item(item_id, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/items/<int:item_id>/unarchive', methods=['PUT'])
@token_required
def unarchive_item(item_id):
    """Unarchive an item (admin only)"""
    user_id = g.current_user.id
    user_role = g.user_role
    
    result, status = ItemController.unarchive_item(item_id, user_id, user_role)
    return jsonify(result), status

@item_bp.route('/businesses/<int:business_id>/items/bulk-status', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_manage_items')
def bulk_update_item_status(business_id):
    """Bulk update status for multiple items"""
    data = request.get_json()
    if not data or 'items' not in data or 'status' not in data:
        return jsonify({"error": "Must provide items list and status"}), 400
    
    user_id = g.current_user.id
    user_role = g.user_role
    
    results = []
    for item_id in data['items']:
        result, status = ItemController.update_item_status(
            item_id, 
            {'status': data['status']}, 
            user_id, 
            user_role
        )
        results.append({
            "item_id": item_id,
            "success": status == 200,
            "message": result.get('message', result.get('error', ''))
        })
    
    return jsonify({"results": results}), 200 