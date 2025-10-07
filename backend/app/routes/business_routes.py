# app/routes/business_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from ..controllers.business_controller import BusinessController
from ..controllers.activity_controller import ActivityController
from ..controllers.item_controller import ItemController
from ..controllers.auth_controller import (
    token_required, 
    admin_required, 
    business_admin_scoped_permission_required,
    enforce_business_access,
    token_optional,
    enforce_survey_access
)
from ..models import db, Business, Survey, User, DiscordServerRoleCache
import json

business_bp = Blueprint('business_bp', __name__)

# ===== ADMIN ROUTES (Protected) =====

@business_bp.route('/businesses', methods=['GET'])
@token_required
@admin_required  # Only super admins can list all businesses
def list_businesses():
    """List all businesses with filtering options (Admin only)"""
    args = request.args
    result, status = BusinessController.list_businesses(args)
    return jsonify(result), status

@business_bp.route('/businesses/names', methods=['POST'])
@token_required
@admin_required
def get_business_names():
    """Get business names for a list of IDs. Used by User Management."""
    data = request.get_json()
    if not data or 'ids' not in data or not isinstance(data['ids'], list):
        return jsonify({"error": "A list of 'ids' is required in the request body."}), 400
    
    business_ids = data['ids']
    result, status = BusinessController.get_business_names_by_ids(business_ids)
    return jsonify(result), status

@business_bp.route('/businesses', methods=['POST'])
@token_required
@admin_required  # Only super admins can create businesses directly
def create_business():
    """Create a new business (Super Admin only)"""
    if request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        # Handle JSON-like string for permissions
        if 'permissions' in data and isinstance(data['permissions'], str):
            try:
                data['permissions'] = json.loads(data['permissions'])
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid format for permissions."}), 400
    else:
        data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    creating_admin_id = g.current_user.id
    result, status = BusinessController.create_business(data, creating_admin_id)
    return jsonify(result), status

# ===== NEW BUSINESS REQUEST WORKFLOW ROUTES =====

@business_bp.route('/businesses/request', methods=['POST'])
@token_required  # Any authenticated user can request
def request_new_business():
    """Allow users to request a new business (pending approval)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Ensure the requesting user is not a super_admin (they should use direct creation)
    if g.user_role == 'super_admin':
        return jsonify({"error": "Super admins should use the direct creation route."}), 403

    requesting_user_id = g.current_user.id
    result, status = BusinessController.request_business_creation(data, requesting_user_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/approve', methods=['PUT'])
@token_required
@admin_required  # Only super admins can approve
def approve_business_request(business_id):
    """Approve a pending business request (Super Admin only)"""
    admin_id = g.current_user.id
    result, status = BusinessController.approve_business_request(business_id, admin_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/request', methods=['DELETE'])
@token_required
@admin_required  # Only super admins can reject
def reject_business_request(business_id):
    """Reject and delete a pending business request (Super Admin only)"""
    admin_id = g.current_user.id
    result, status = BusinessController.reject_business_request(business_id, admin_id)
    return jsonify(result), status

# ===== BUSINESS BRANDING MANAGEMENT =====

@business_bp.route('/businesses/<int:business_id>/branding', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def update_business_branding(business_id):
    """Update branding for a specific business (Super Admin or Business Admin with permission)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    business = Business.query.get(business_id)
    if not business:
        return jsonify({"error": "Business not found"}), 404

    try:
        # Update logo URL if provided
        if 'logo_url' in data:
            business.logo_url = data['logo_url']

        # Legacy fields like cover_image_url and color_theme are ignored
        # NEW: Splash layout configuration
        splash_template = data.get('splash_template')
        splash_blocks = data.get('splash_blocks')

        if splash_template is not None:
            # Validate allowed templates (expanded to 1–10)
            try:
                tpl = int(splash_template)
            except (TypeError, ValueError):
                return jsonify({"error": "splash_template must be an integer between 1 and 10"}), 400
            if tpl < 1 or tpl > 10:
                return jsonify({"error": "splash_template must be between 1 and 10"}), 400
            business.splash_template = tpl

        if splash_blocks is not None:
            if not isinstance(splash_blocks, list):
                return jsonify({"error": "splash_blocks must be an ordered array"}), 400
            # store as-is; frontend ensures correct slot count per template
            business.splash_blocks = splash_blocks
        
        db.session.commit()
        
        return jsonify({
            "message": "Business branding updated successfully",
            "business": business.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to update business branding",
            "details": str(e)
        }), 500

# ===== BUSINESS-SPECIFIC SURVEY MANAGEMENT =====

@business_bp.route('/businesses/<int:business_id>/surveys', methods=['GET'])
@token_required
@enforce_business_access
def list_surveys_for_business(business_id):
    """List all surveys for a specific business"""
    result, status = BusinessController.list_surveys_for_business(business_id)
    
    # Filter surveys based on access
    if g.user_role not in ['super_admin', 'business_admin']:
        filtered_surveys = []
        for survey in result.get('surveys', []):
            if BusinessController.check_survey_access(g.current_user, survey['id']):
                filtered_surveys.append(survey)
        result['surveys'] = filtered_surveys
    
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/admin/surveys', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_view_survey_analytics')
def list_admin_surveys_for_business(business_id):
    """List all surveys for business admin use (AI data generation, analytics, etc.)"""
    try:
        # This will only show surveys belonging to the business
        surveys = Survey.query.filter_by(business_id=business_id, is_archived=False).all()
        
        survey_list = []
        for survey in surveys:
            survey_data = {
                "id": survey.id,
                "title": survey.title,
                "description": survey.description,
                "published": survey.published,
                "created_at": survey.created_at.isoformat() if survey.created_at else None,
                "question_count": survey.questions.count(),
                "response_count": survey.submissions.filter_by(is_complete=True).count(),
                "is_archived": survey.is_archived
            }
            survey_list.append(survey_data)
        
        return jsonify({
            "surveys": survey_list,
            "business_id": business_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[LIST_ADMIN_SURVEYS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to retrieve surveys"}), 500

# ===== EXISTING ROUTES =====

@business_bp.route('/businesses/<int:business_id>', methods=['GET'])
@token_required
def get_business_details(business_id):
    """Get detailed business information (Admin access)"""
    # This will be used by both super admins and business admins
    # Business admins can only access their own business
    if g.user_role == 'business_admin' and g.current_user.business_id != business_id:
        return jsonify({"error": "Forbidden: You can only view your assigned business."}), 403
    
    result, status = BusinessController.get_business_details(business_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>', methods=['PUT'])
@token_required
def update_business_details(business_id):
    """Update business details (Super Admin or Business Admin for their own business)"""
    # Check permissions: Super admin can update any business, Business admin can update their own
    if g.user_role == 'business_admin' and g.current_user.business_id != business_id:
        return jsonify({"error": "Forbidden: You can only update your assigned business."}), 403
    elif g.user_role not in ['super_admin', 'business_admin']:
        return jsonify({"error": "Access denied. Insufficient permissions."}), 403
    
    if request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        # Handle JSON-like string for permissions
        if 'permissions' in data and isinstance(data['permissions'], str):
            try:
                data['permissions'] = json.loads(data['permissions'])
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid format for permissions."}), 400
    else:
        data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    updating_admin_id = g.current_user.id
    result, status = BusinessController.update_business_details(business_id, data, updating_admin_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>', methods=['DELETE'])
@token_required
@admin_required  # Only super admins can delete
def delete_business(business_id):
    """Delete business permanently (Super Admin only)"""
    deleting_admin_id = g.current_user.id
    result, status = BusinessController.delete_business_permanently(business_id, deleting_admin_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/permissions', methods=['PUT'])
@token_required
@admin_required  # Only super admins can update permissions
def update_business_permissions(business_id):
    """Update business permissions (Super Admin only)"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    permissions = data.get('permissions')
    if not isinstance(permissions, dict):
        return jsonify({"error": "Permissions must be a JSON object"}), 400
    
    try:
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
            
        business.permissions = permissions
        db.session.commit()
        
        current_app.logger.info(f"[UPDATE_PERMISSIONS] Updated permissions for business {business.name}")
        
        return jsonify({
            "message": "Business permissions updated successfully",
            "business": business.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[UPDATE_PERMISSIONS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to update permissions", "details": str(e)}), 500

@business_bp.route('/businesses/<int:business_id>/activities', methods=['GET'])
@token_required
@enforce_business_access
def list_business_activities_admin(business_id):
    """Get business activities for admin view"""
    args = request.args
    result, status = ActivityController.list_business_activities(business_id, args)
    return jsonify(result), status

# ===== PUBLIC ROUTES (With Audience Control) =====

@business_bp.route('/public/businesses', methods=['GET'])
@token_optional
def list_public_businesses_route():
    """List all public and accessible businesses."""
    args = request.args
    result, status = BusinessController.list_public_businesses(args)
    return jsonify(result), status

@business_bp.route('/public/businesses/<int:business_id>', methods=['GET'])
@token_optional
@enforce_business_access
def get_public_business_details_route(business_id):
    """Public endpoint to get business details for splash page"""
    # First get the business details
    result, status = BusinessController.get_public_business_details(business_id)
    if status != 200:
        return jsonify(result), status
        
    # If business is public, allow access
    if result.get('audience_type') == 'PUBLIC':
        return jsonify(result), 200
        
    # If user is not authenticated, deny access to restricted businesses
    if not hasattr(g, 'current_user') or not g.current_user:
        return jsonify({"error": "Authentication required for this business"}), 401
        
    # Check if user has access
    if not BusinessController.check_user_access(g.current_user, business_id):
        return jsonify({"error": "Access denied"}), 403
        
    return jsonify(result), 200

@business_bp.route('/public/businesses/<int:business_id>/feed', methods=['GET'])
def get_public_business_feed(business_id):
    """Public endpoint to get business activity feed"""
    # First check business access
    if not BusinessController.check_public_access(business_id):
        return jsonify({"error": "Business not found or not public"}), 404
        
    # If business is restricted, check user access
    business = BusinessController.get_business(business_id)
    if business.audience_type == 'RESTRICTED':
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({"error": "Authentication required for this business"}), 401
            
        if not BusinessController.check_user_access(g.current_user, business_id):
            return jsonify({"error": "Access denied"}), 403
    
    # Get activities
    args = request.args.copy()
    args['is_public'] = 'true'  # Force public activities only
    
    result, status = ActivityController.list_business_activities(business_id, args)
    if status == 200:
        # Return only the activities array for public consumption
        return jsonify(result.get("activities", [])), 200
    return jsonify(result), status

# ===== BUSINESS ACTIVITY MANAGEMENT =====

@business_bp.route('/businesses/<int:business_id>/activities', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def create_business_activity(business_id):
    """Create a custom activity post"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    # Set defaults for activity
    data['activity_type'] = 'CUSTOM_POST'
    data['is_public'] = data.get('is_public', False)  # Default to private
    
    result, status = ActivityController.create_activity(business_id, data, g.current_user.id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/activities/<int:activity_id>', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def update_business_activity(business_id, activity_id):
    """Update activity visibility"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    result, status = ActivityController.update_activity(business_id, activity_id, data)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/activities/<int:activity_id>', methods=['DELETE'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def delete_business_activity(business_id, activity_id):
    """Delete an activity"""
    result, status = ActivityController.delete_activity(business_id, activity_id)
    return jsonify(result), status

# ===== BUSINESS AUDIENCE MANAGEMENT =====

@business_bp.route('/businesses/<int:business_id>/audience', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def get_business_audience_settings(business_id):
    """Get audience settings for a business"""
    result, status = BusinessController.get_business_audience(business_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/audience', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def update_business_audience_settings(business_id):
    """Update audience settings for a business"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    result, status = BusinessController.update_business_audience(business_id, data)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/audience/qr-code', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def generate_business_qr_code(business_id):
    """Generate QR code for business access"""
    data = request.get_json() or {}
    result, status = BusinessController.generate_business_qr_code(business_id, data)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/audience/qr-code', methods=['DELETE'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def revoke_business_qr_code(business_id):
    """Revoke QR code for business access"""
    result, status = BusinessController.revoke_business_qr_code(business_id)
    return jsonify(result), status

# ===== QR CODE ACCESS ROUTES (Public) =====

@business_bp.route('/access/business/<qr_token>', methods=['GET'])
def access_business_via_qr(qr_token):
    """Access business via QR code token"""
    result, status = BusinessController.access_business_via_qr(qr_token)
    
    # If successful, redirect to business splash page
    if status == 200:
        business_id = result.get('business_id')
        # Could redirect to frontend route or return business data
        return jsonify({
            "message": "Access granted",
            "business_id": business_id,
            "redirect_url": f"/business/{business_id}"
        }), 200
    
    return jsonify(result), status

@business_bp.route('/access/business/<qr_token>/join', methods=['POST'])
@token_required
def join_business_via_qr(qr_token):
    """Join business audience via QR code (authenticated users)"""
    user_email = g.current_user.email
    result, status = BusinessController.join_business_via_qr(qr_token, user_email)
    return jsonify(result), status

# ===== FEEDBACK ITEM STATUS UPDATE =====

@business_bp.route('/businesses/<int:business_id>/items/<int:item_id>/status', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('manage_feedback') 
def update_feedback_item_status_route(business_id, item_id):
    """Update the status of a specific feedback item (bug or feature)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # g.current_user and g.user_role are available from decorators
    # The business_id context is verified by business_admin_scoped_permission_required
    # Call ItemController method instead
    result, status = ItemController.update_item_status(item_id, data, g.current_user.id, g.user_role)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/survey-count', methods=['GET'])
@token_required
# @enforce_business_access # Potentially add this if only users with some access to the business can see the count
def get_business_survey_count_route(business_id):
    """Get the count of published surveys for a specific business."""
    # If we want the count of surveys accessible *to the current user* for this business:
    # result, status = BusinessController.get_business_survey_count(business_id, user_for_access_check=g.current_user)
    # For now, let's return the total published surveys for the business, access to this count itself is controlled by token_required.
    # The frontend will use list_public_businesses which does user-specific filtering for display.
    result, status = BusinessController.get_business_survey_count(business_id)
    return jsonify(result), status

# New public route for listing surveys for a business
@business_bp.route('/public/businesses/<int:business_id>/surveys', methods=['GET'])
@token_optional  # Allow both authenticated and anonymous users
@enforce_business_access # Ensures user has access to the business itself
def public_list_surveys_for_business(business_id):
    """Public endpoint to list accessible surveys for a specific business."""
    try:
        from app.models import Business, Survey, Submission
        
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
        
        # Check if business is active and approved
        if not business.is_active or not business.is_approved:
            return jsonify({"error": "Business is not available"}), 404
        
        # Get user information for access checking
        current_user = getattr(g, 'current_user', None)
        user_role = getattr(g, 'user_role', 'user')
        
        # Get all published, non-archived surveys for the business
        all_surveys = Survey.query.filter_by(
            business_id=business_id, 
            published=True, 
            is_archived=False
        ).order_by(Survey.created_at.desc()).all()
        
        current_app.logger.info(f"[PUBLIC_SURVEYS] Found {len(all_surveys)} published surveys for business {business_id}")
        
        accessible_surveys = []
        for survey in all_surveys:
            # Apply survey-level access control
            if not BusinessController.check_survey_access(current_user, survey.id):
                current_app.logger.debug(f"[PUBLIC_SURVEYS] User access denied to survey {survey.id} for business {business_id}")
                continue
            
            # Get response count
            response_count = Submission.query.filter_by(survey_id=survey.id, is_complete=True).count()
            
            # Check if current user has completed this survey
            completed_by_user = False
            if current_user:
                try:
                    # For admin users, we don't mark surveys as completed to allow multiple responses
                    if user_role in ['super_admin', 'business_admin']:
                        completed_by_user = False  # Always allow admin access regardless of completion
                    else:
                        completed_by_user = Submission.query.filter_by(
                            survey_id=survey.id,
                            user_id=current_user.id,
                            is_complete=True
                        ).first() is not None
                except Exception as e:
                    current_app.logger.warning(f"Error checking completion status for survey {survey.id}: {e}")
                    completed_by_user = False
            
            # Calculate XP reward and estimated time using utility functions
            from app.utils.xp_calculator import calculate_survey_xp, calculate_survey_time
            question_count = survey.questions.count()
            xp_reward = calculate_survey_xp(question_count)
            estimated_time = calculate_survey_time(question_count)
            
            survey_dict = {
                "id": survey.id,
                "title": survey.title,
                "description": survey.description,
                "created_at": survey.created_at.isoformat() if survey.created_at else None,
                "updated_at": survey.updated_at.isoformat() if survey.updated_at else None,
                "published": survey.published,
                "participant_limit": survey.participant_limit,
                "is_quickpoll": survey.is_quickpoll,
                "branding": survey.branding,
                "business_id": survey.business_id,
                "response_count": response_count,
                "question_count": question_count,
                "is_archived": survey.is_archived,
                "completed_by_user": completed_by_user,
                "xp_reward": xp_reward,
                "estimated_time": estimated_time,
                "is_restricted": survey.is_restricted  # Include restriction status for frontend awareness
            }
            accessible_surveys.append(survey_dict)
        
        current_app.logger.info(f"[PUBLIC_SURVEYS] Returning {len(accessible_surveys)} accessible surveys for business {business_id}")
        return jsonify({"surveys": accessible_surveys, "business_name": business.name}), 200
        
    except Exception as e:
        current_app.logger.error(f"[PUBLIC_SURVEYS] Error: {e}", exc_info=True)
        return jsonify({"error": "Failed to list surveys", "details": str(e)}), 500

# NEW: Business Analytics Route
@business_bp.route('/businesses/<int:business_id>/analytics', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_view_survey_analytics')
def get_business_analytics(business_id):
    """Get overall analytics for a specific business."""
    analytics_data, status_code = BusinessController.get_business_analytics_summary(business_id)
    return jsonify(analytics_data), status_code

@business_bp.route('/businesses/<int:business_id>/admins', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_manage_admins')
def list_business_admins(business_id):
    """List business admins for a specific business."""
    result, status = BusinessController.list_business_admins(business_id)
    return jsonify(result), status

@business_bp.route('/businesses/<int:business_id>/admins/<int:admin_id>', methods=['DELETE'])
@token_required
@business_admin_scoped_permission_required('can_manage_admins')
def delete_business_admin(business_id, admin_id):
    """Delete a business admin from a specific business."""
    deleting_user_id = g.current_user.id
    result, status = BusinessController.delete_business_admin(business_id, admin_id, deleting_user_id)
    return jsonify(result), status

