from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required, business_admin_required
from app.controllers.quest_controller import QuestController

quest_bp = Blueprint('quest', __name__)

# ===== QUEST TYPE MANAGEMENT ENDPOINTS =====

@quest_bp.route("/quest-types", methods=["GET"])
def get_quest_types():
    """Get all available quest types for dropdown selection (public endpoint)"""
    try:
        result, status = QuestController.get_all_quest_types()
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_QUEST_TYPES] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest types"}), 500

# ===== SUPER ADMIN QUEST MANAGEMENT ENDPOINTS =====

@quest_bp.route("/admin/quests", methods=["GET"])
@token_required
@admin_required
def get_all_quests_admin():
    """Get all quests (super admin only)"""
    try:
        include_archived = request.args.get('include_archived', 'false').lower() == 'true'
        admin_only = request.args.get('admin_only', 'false').lower() == 'true'
        
        result, status = QuestController.get_all_quests(
            business_id=None,
            include_archived=include_archived,
            admin_only=admin_only
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_ALL_QUESTS_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quests"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>", methods=["GET"])
@token_required
@admin_required
def get_quest_admin(quest_id):
    """Get a specific quest by ID (super admin only)"""
    try:
        include_completions = request.args.get('include_completions', 'false').lower() == 'true'
        result, status = QuestController.get_quest_by_id(quest_id, include_completions=include_completions)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest"}), 500

@quest_bp.route("/admin/quests", methods=["POST"])
@token_required
@admin_required
def create_quest_admin():
    """Create a new quest (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[CREATE_QUEST_ADMIN] Super admin {g.current_user.id} creating new quest: {data.get('title')}")
        
        result, status = QuestController.create_quest(
            quest_data=data,
            creator_role='super_admin',
            creator_id=g.current_user.id,
            business_id=data.get('business_id')  # Allow super admin to create quests for specific businesses
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CREATE_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>", methods=["PUT"])
@token_required
@admin_required
def update_quest_admin(quest_id):
    """Update an existing quest (super admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[UPDATE_QUEST_ADMIN] Super admin {g.current_user.id} updating quest {quest_id}")
        
        result, status = QuestController.update_quest(
            quest_id=quest_id,
            quest_data=data,
            user_role='super_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UPDATE_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_quest_admin(quest_id):
    """Delete a quest (super admin only)"""
    try:
        current_app.logger.info(f"[DELETE_QUEST_ADMIN] Super admin {g.current_user.id} deleting quest {quest_id}")
        
        result, status = QuestController.delete_quest(
            quest_id=quest_id,
            user_role='super_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[DELETE_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/publish", methods=["PATCH"])
@token_required
@admin_required
def publish_quest_admin(quest_id):
    """Publish a quest (super admin only)"""
    try:
        current_app.logger.info(f"[PUBLISH_QUEST_ADMIN] Super admin {g.current_user.id} publishing quest {quest_id}")
        
        result, status = QuestController.publish_quest(
            quest_id=quest_id,
            user_role='super_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[PUBLISH_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to publish quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/unpublish", methods=["PATCH"])
@token_required
@admin_required
def unpublish_quest_admin(quest_id):
    """Unpublish a quest (super admin only)"""
    try:
        current_app.logger.info(f"[UNPUBLISH_QUEST_ADMIN] Super admin {g.current_user.id} unpublishing quest {quest_id}")
        
        result, status = QuestController.unpublish_quest(
            quest_id=quest_id,
            user_role='super_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UNPUBLISH_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to unpublish quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/feature", methods=["PATCH"])
@token_required
@admin_required
def feature_quest_admin(quest_id):
    """Feature/unfeature a quest (super admin only)"""
    try:
        data = request.get_json() or {}
        featured = data.get('featured', True)
        
        current_app.logger.info(f"[FEATURE_QUEST_ADMIN] Super admin {g.current_user.id} {'featuring' if featured else 'unfeaturing'} quest {quest_id}")
        
        if featured:
            result, status = QuestController.feature_quest(quest_id)
        else:
            result, status = QuestController.unfeature_quest(quest_id)
            
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[FEATURE_QUEST_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to feature/unfeature quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/completions", methods=["GET"])
@token_required
@admin_required
def get_quest_completions_admin(quest_id):
    """Get completions for a specific quest (super admin only)"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        result, status = QuestController.get_quest_completions(quest_id, page=page, per_page=per_page)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_QUEST_COMPLETIONS_ADMIN] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest completions"}), 500

# ===== BUSINESS ADMIN QUEST MANAGEMENT ENDPOINTS =====

@quest_bp.route("/businesses/<int:business_id>/quests", methods=["GET"])
@token_required
@business_admin_required
def get_business_quests(business_id):
    """Get all quests for a specific business (business admin only)"""
    try:
        include_archived = request.args.get('include_archived', 'false').lower() == 'true'
        
        result, status = QuestController.get_all_quests(
            business_id=business_id,
            include_archived=include_archived,
            admin_only=False
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_QUESTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business quests"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>", methods=["GET"])
@token_required
@business_admin_required
def get_business_quest(business_id, quest_id):
    """Get a specific quest for a business (business admin only)"""
    try:
        include_completions = request.args.get('include_completions', 'false').lower() == 'true'
        result, status = QuestController.get_quest_by_id(quest_id, include_completions=include_completions)
        
        # Verify quest belongs to this business
        if status == 200 and result.get('quest', {}).get('business_id') != business_id:
            return jsonify({"error": "Quest not found for this business"}), 404
            
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests", methods=["POST"])
@token_required
@business_admin_required
def create_business_quest(business_id):
    """Create a new quest for a business (business admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[CREATE_BUSINESS_QUEST] Business admin {g.current_user.id} creating quest for business {business_id}")
        
        result, status = QuestController.create_quest(
            quest_data=data,
            creator_role='business_admin',
            creator_id=g.current_user.id,
            business_id=business_id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CREATE_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to create quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>", methods=["PUT"])
@token_required
@business_admin_required
def update_business_quest(business_id, quest_id):
    """Update a quest for a business (business admin only)"""
    try:
        data = request.get_json() or {}
        
        current_app.logger.info(f"[UPDATE_BUSINESS_QUEST] Business admin {g.current_user.id} updating quest {quest_id}")
        
        result, status = QuestController.update_quest(
            quest_id=quest_id,
            quest_data=data,
            user_role='business_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UPDATE_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>", methods=["DELETE"])
@token_required
@business_admin_required
def delete_business_quest(business_id, quest_id):
    """Delete a quest for a business (business admin only)"""
    try:
        current_app.logger.info(f"[DELETE_BUSINESS_QUEST] Business admin {g.current_user.id} deleting quest {quest_id}")
        
        result, status = QuestController.delete_quest(
            quest_id=quest_id,
            user_role='business_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[DELETE_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>/publish", methods=["PATCH"])
@token_required
@business_admin_required
def publish_business_quest(business_id, quest_id):
    """Publish a quest for a business (business admin only)"""
    try:
        current_app.logger.info(f"[PUBLISH_BUSINESS_QUEST] Business admin {g.current_user.id} publishing quest {quest_id}")
        
        result, status = QuestController.publish_quest(
            quest_id=quest_id,
            user_role='business_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[PUBLISH_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to publish quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>/unpublish", methods=["PATCH"])
@token_required
@business_admin_required
def unpublish_business_quest(business_id, quest_id):
    """Unpublish a quest for a business (business admin only)"""
    try:
        current_app.logger.info(f"[UNPUBLISH_BUSINESS_QUEST] Business admin {g.current_user.id} unpublishing quest {quest_id}")
        
        result, status = QuestController.unpublish_quest(
            quest_id=quest_id,
            user_role='business_admin',
            user_id=g.current_user.id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[UNPUBLISH_BUSINESS_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to unpublish quest"}), 500

@quest_bp.route("/businesses/<int:business_id>/quests/<int:quest_id>/completions", methods=["GET"])
@token_required
@business_admin_required
def get_business_quest_completions(business_id, quest_id):
    """Get completions for a business quest (business admin only)"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        result, status = QuestController.get_quest_completions(quest_id, page=page, per_page=per_page)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_QUEST_COMPLETIONS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest completions"}), 500

# ===== PUBLIC QUEST ENDPOINTS FOR USERS =====

@quest_bp.route("/quests/available", methods=["GET"])
@token_required
def get_available_quests():
    """Get available quests for users to complete"""
    try:
        business_id = request.args.get('business_id', type=int)
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        
        result, status = QuestController.get_available_quests(business_id=business_id, user_id=user_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_AVAILABLE_QUESTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve available quests"}), 500

@quest_bp.route("/quests/<int:quest_id>", methods=["GET"])
def get_public_quest(quest_id):
    """Get a specific quest by ID (public endpoint)"""
    try:
        include_completions = request.args.get('include_completions', 'false').lower() == 'true'
        result, status = QuestController.get_quest_by_id(quest_id, include_completions=include_completions)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_PUBLIC_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve quest"}), 500

@quest_bp.route("/quests/<int:quest_id>/track-link-click", methods=["POST"])
@token_required
def track_quest_link_click(quest_id):
    """Track when a user clicks a quest link (user endpoint)"""
    try:
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not user_id:
            return jsonify({"error": "User authentication required"}), 401
        
        current_app.logger.info(f"[TRACK_LINK_CLICK] User {user_id} clicked link for quest {quest_id}")
        
        result, status = QuestController.track_link_click(
            quest_id=quest_id,
            user_id=user_id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[TRACK_LINK_CLICK] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to track link click"}), 500

@quest_bp.route("/quests/<int:quest_id>/check-link-click", methods=["GET"])
@token_required
def check_quest_link_click(quest_id):
    """Check if a user has clicked a quest link (user endpoint)"""
    try:
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not user_id:
            return jsonify({"error": "User authentication required"}), 401
        
        current_app.logger.info(f"[CHECK_LINK_CLICK] Checking link click status for user {user_id} on quest {quest_id}")
        
        result, status = QuestController.check_user_link_click(
            quest_id=quest_id,
            user_id=user_id
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[CHECK_LINK_CLICK] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to check link click status"}), 500

@quest_bp.route("/quests/<int:quest_id>/complete", methods=["POST"])
@token_required
def complete_quest(quest_id):
    """Complete a quest (user endpoint)"""
    try:
        data = request.get_json() or {}
        verification_data = data.get('verification_data')
        
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not user_id:
            return jsonify({"error": "User authentication required"}), 401
        
        current_app.logger.info(f"[COMPLETE_QUEST] User {user_id} attempting to complete quest {quest_id}")
        
        result, status = QuestController.complete_quest(
            quest_id=quest_id,
            user_id=user_id,
            verification_data=verification_data
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[COMPLETE_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to complete quest"}), 500

@quest_bp.route("/users/<int:user_id>/quest-completions", methods=["GET"])
@token_required
def get_user_quest_completions(user_id):
    """Get quest completions for a specific user"""
    try:
        # Users can only view their own completions unless admin
        if hasattr(g, 'current_user') and g.current_user:
            if g.current_user.id != user_id and g.current_user.role != 'super_admin':
                return jsonify({"error": "Permission denied"}), 403
        
        business_id = request.args.get('business_id', type=int)
        
        result, status = QuestController.get_user_quest_completions(user_id, business_id=business_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_USER_QUEST_COMPLETIONS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve user quest completions"}), 500

# ===== PUBLIC BUSINESS QUEST ENDPOINTS =====

@quest_bp.route("/public/businesses/<int:business_id>/quests", methods=["GET"])
def get_public_business_quests(business_id):
    """Get published quests for a specific business (public endpoint)"""
    try:
        user_id = None
        # Get user_id if authenticated (optional for this endpoint)
        if hasattr(g, 'current_user') and g.current_user:
            user_id = g.current_user.id
        
        result, status = QuestController.get_available_quests(business_id=business_id, user_id=user_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_PUBLIC_BUSINESS_QUESTS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business quests"}), 500

# ===== NEW: QUEST VERIFICATION AND APPROVAL WORKFLOW ENDPOINTS =====

# User endpoints for proof submission
@quest_bp.route("/quests/<int:quest_id>/submit-proof", methods=["POST"])
@token_required
def submit_quest_proof(quest_id):
    """Submit proof for quest completion (user endpoint)"""
    try:
        data = request.get_json() or {}
        
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not user_id:
            return jsonify({"error": "User authentication required"}), 401
        
        current_app.logger.info(f"[SUBMIT_QUEST_PROOF] User {user_id} submitting proof for quest {quest_id}")
        
        result, status = QuestController.submit_quest_proof(
            quest_id=quest_id,
            user_id=user_id,
            proof_data=data
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[SUBMIT_QUEST_PROOF] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to submit quest proof"}), 500

# Business admin endpoints for verification
@quest_bp.route("/businesses/<int:business_id>/quest-verifications", methods=["GET"])
@token_required
@business_admin_required
def get_pending_verifications(business_id):
    """Get pending quest verifications for business admin review"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        result, status = QuestController.get_pending_verifications(
            business_id=business_id,
            page=page,
            per_page=per_page
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_PENDING_VERIFICATIONS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve pending verifications"}), 500

@quest_bp.route("/quest-completions/<int:completion_id>/verify", methods=["POST"])
@token_required
@business_admin_required
def verify_quest_completion(completion_id):
    """Verify or reject quest completion (business admin only)"""
    try:
        data = request.get_json() or {}
        
        verification_decision = data.get('decision')  # 'VERIFIED' or 'REJECTED'
        admin_notes = data.get('notes')
        
        if not verification_decision:
            return jsonify({"error": "Verification decision is required"}), 400
        
        admin_user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not admin_user_id:
            return jsonify({"error": "Admin authentication required"}), 401
        
        current_app.logger.info(f"[VERIFY_QUEST_COMPLETION] Admin {admin_user_id} verifying completion {completion_id}")
        
        result, status = QuestController.verify_quest_completion(
            completion_id=completion_id,
            admin_user_id=admin_user_id,
            verification_decision=verification_decision,
            admin_notes=admin_notes
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[VERIFY_QUEST_COMPLETION] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to verify quest completion"}), 500

# Super admin endpoints for quest approval
@quest_bp.route("/admin/quest-approvals", methods=["GET"])
@token_required
@admin_required
def get_pending_quest_approvals():
    """Get pending quest approvals for super admin review"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        result, status = QuestController.get_pending_quest_approvals(
            page=page,
            per_page=per_page
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_PENDING_QUEST_APPROVALS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve pending quest approvals"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/approve", methods=["POST"])
@token_required
@admin_required
def approve_quest(quest_id):
    """Approve a pending quest (super admin only)"""
    try:
        data = request.get_json() or {}
        admin_notes = data.get('notes')
        
        admin_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not admin_id:
            return jsonify({"error": "Admin authentication required"}), 401
        
        current_app.logger.info(f"[APPROVE_QUEST] Super admin {admin_id} approving quest {quest_id}")
        
        result, status = QuestController.approve_quest(
            quest_id=quest_id,
            admin_id=admin_id,
            admin_notes=admin_notes
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[APPROVE_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to approve quest"}), 500

@quest_bp.route("/admin/quests/<int:quest_id>/reject", methods=["POST"])
@token_required
@admin_required
def reject_quest(quest_id):
    """Reject a pending quest (super admin only)"""
    try:
        data = request.get_json() or {}
        admin_notes = data.get('notes')
        
        admin_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not admin_id:
            return jsonify({"error": "Admin authentication required"}), 401
        
        current_app.logger.info(f"[REJECT_QUEST] Super admin {admin_id} rejecting quest {quest_id}")
        
        result, status = QuestController.reject_quest(
            quest_id=quest_id,
            admin_id=admin_id,
            admin_notes=admin_notes
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[REJECT_QUEST] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to reject quest"}), 500

# NEW: Quest Progress Tracking Endpoints

@quest_bp.route("/quests/<int:quest_id>/progress", methods=["GET"])
@token_required
def get_quest_progress(quest_id):
    """Get user's progress on a specific quest"""
    try:
        user_id = g.current_user.id if hasattr(g, 'current_user') and g.current_user else None
        if not user_id:
            return jsonify({"error": "User authentication required"}), 401
        
        result, status = QuestController.get_user_quest_progress(user_id, quest_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_QUEST_PROGRESS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to get quest progress"}), 500

@quest_bp.route("/users/<int:user_id>/activity-summary", methods=["GET"])
@token_required
def get_user_activity_summary(user_id):
    """Get user's activity summary for Eclipseer quests"""
    try:
        # Users can only view their own activity unless admin
        if hasattr(g, 'current_user') and g.current_user:
            if g.current_user.id != user_id and g.current_user.role != 'super_admin':
                return jsonify({"error": "Permission denied"}), 403
        
        from app.models import User, UserDailyActivity
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Get rolling 24-hour counts
        daily_surveys = UserDailyActivity.get_rolling_24h_count(user_id, 'SURVEY_COMPLETED')
        daily_quests = UserDailyActivity.get_rolling_24h_count(user_id, 'QUEST_COMPLETED')
        daily_brand_visits = UserDailyActivity.get_rolling_24h_count(user_id, 'BRAND_PAGE_VISITED')
        
        activity_summary = {
            "user_id": user_id,
            "total_surveys_completed": user.surveys_completed_count,
            "total_quests_completed": user.quests_completed_count,
            "total_brand_pages_visited": user.brand_pages_visited_count,
            "total_tags_selected": user.tags_selected_count,
            "has_profile_picture": user.has_profile_picture,
            "daily_counts": {
                "surveys_completed_24h": daily_surveys,
                "quests_completed_24h": daily_quests,
                "brand_pages_visited_24h": daily_brand_visits
            }
        }
        
        return jsonify(activity_summary), 200
        
    except Exception as e:
        current_app.logger.error(f"[GET_USER_ACTIVITY_SUMMARY] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to get user activity summary"}), 500

# ===== BUSINESS QUEST LIMITS AND CREDITS MANAGEMENT =====

@quest_bp.route("/businesses/<int:business_id>/quest-limits", methods=["GET"])
@token_required
@business_admin_required
def get_business_quest_limits(business_id):
    """Get quest limit information for a business (business admin only)"""
    try:
        result, status = QuestController.get_business_quest_limits(business_id)
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[GET_BUSINESS_QUEST_LIMITS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve business quest limits"}), 500

@quest_bp.route("/businesses/<int:business_id>/quest-credits/purchase", methods=["POST"])
@token_required
@business_admin_required
def purchase_quest_credits(business_id):
    """Purchase additional quest credits for a business (business admin only)"""
    try:
        data = request.get_json() or {}
        amount = data.get('amount')
        payment_method = data.get('payment_method')
        
        if not amount:
            return jsonify({"error": "Credit amount is required"}), 400
        
        from app.controllers.business_tier_controller import BusinessTierController
        result, status = BusinessTierController.purchase_quest_credits(
            business_id=business_id,
            amount=amount,
            payment_method=payment_method
        )
        return jsonify(result), status
        
    except Exception as e:
        current_app.logger.error(f"[PURCHASE_QUEST_CREDITS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to purchase quest credits"}), 500 