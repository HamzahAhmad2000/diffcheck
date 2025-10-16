# app/routes/survey.py
from flask import Blueprint, request, jsonify, g
from ..controllers.survey_controller import SurveyController
from ..models import Survey
from ..controllers.auth_controller import (
    token_required, 
    business_admin_scoped_permission_required,
    enforce_survey_access,
    token_optional
)
from flask_cors import cross_origin
import logging

survey_bp = Blueprint('survey', __name__)

# ===== BUSINESS-SCOPED SURVEY ROUTES =====

@survey_bp.route('/businesses/<int:business_id>/surveys', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_create_surveys')
def create_survey_for_business(business_id):
    """Create a new survey for a specific business"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Ensure business_id is set in the survey data
    data['business_id'] = business_id
    
    result, status = SurveyController.create_survey(data)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_view_survey_analytics')
def list_surveys_for_business(business_id):
    """List all surveys for a specific business (Admin view)"""
    result, status = SurveyController.list_surveys_for_business(business_id)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_view_survey_analytics')
def get_survey_for_business(business_id, survey_id):
    """Get survey details for admin (must belong to the business)"""
    # Verify survey belongs to business
    survey_data, status = SurveyController.get_survey_for_business(survey_id, business_id)
    return jsonify(survey_data), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def update_survey_for_business(business_id, survey_id):
    """Update survey for a specific business"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Verify survey belongs to business and update
    result, status = SurveyController.update_survey_for_business(survey_id, business_id, data)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>', methods=['DELETE'])
@token_required
@business_admin_scoped_permission_required('can_delete_surveys')
def delete_survey_for_business(business_id, survey_id):
    """Delete/archive survey for a specific business"""
    result, status = SurveyController.delete_survey_for_business(survey_id, business_id)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/copy', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_create_surveys')
def copy_survey_for_business(business_id, survey_id):
    """Copy a survey within the same business"""
    data = request.get_json()
    if not data:
        data = {}
    
    result, status = SurveyController.copy_survey_for_business(survey_id, business_id, data)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/publish', methods=['PATCH'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def publish_survey_for_business(business_id, survey_id):
    """Publish a survey for a specific business"""
    result, status = SurveyController.publish_survey_for_business(survey_id, business_id)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/unpublish', methods=['PATCH'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def unpublish_survey_for_business(business_id, survey_id):
    """Unpublish a survey for a specific business"""
    result, status = SurveyController.unpublish_survey_for_business(survey_id, business_id)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/questions/<int:question_id>/branch', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def create_branch_for_business(business_id, survey_id, question_id):
    """Create branching logic for a question"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    result, status = SurveyController.create_branch_for_business(survey_id, business_id, question_id, data)
    return jsonify(result), status

# ===== SURVEY AUDIENCE MANAGEMENT =====

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/audience', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def get_survey_audience(business_id, survey_id):
    """Get audience settings for a survey"""
    result, status = SurveyController.get_survey_audience(survey_id, business_id)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/audience', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def update_survey_audience(business_id, survey_id):
    """Update audience settings for a survey"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    result, status = SurveyController.update_survey_audience(survey_id, business_id, data)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/audience/qr-code', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def generate_survey_qr_code(business_id, survey_id):
    """Generate QR code for survey access"""
    result, status = SurveyController.generate_survey_qr_code(survey_id, business_id)
    return jsonify(result), status

# ===== PUBLIC SURVEY ACCESS (For Panelists) =====

@survey_bp.route('/surveys/<int:survey_id>', methods=['GET'])
@cross_origin()
@token_required
@enforce_survey_access
def get_public_survey(survey_id):
    """
    Public access to survey for taking (with audience control).
    Note: Super admins and business admins bypass all audience restrictions.
    """
    logger = logging.getLogger(__name__)
    
    logger.info(f"[PUBLIC_SURVEY] ========== Starting public survey fetch ==========")
    logger.info(f"[PUBLIC_SURVEY] Survey ID: {survey_id}")
    logger.info(f"[PUBLIC_SURVEY] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[PUBLIC_SURVEY] User Role: {getattr(g, 'user_role', 'None')}")
    logger.info(f"[PUBLIC_SURVEY] Request Method: {request.method}")
    logger.info(f"[PUBLIC_SURVEY] Request URL: {request.url}")
    logger.info(f"[PUBLIC_SURVEY] Request Headers: {dict(request.headers)}")
    logger.info(f"[PUBLIC_SURVEY] Request Args: {dict(request.args)}")
    
    if hasattr(g, 'current_user') and g.current_user:
        logger.debug(f"[PUBLIC_SURVEY] Authenticated user details:")
        logger.debug(f"[PUBLIC_SURVEY] - User ID: {g.current_user.id}")
        logger.debug(f"[PUBLIC_SURVEY] - Username: {g.current_user.username}")
        logger.debug(f"[PUBLIC_SURVEY] - Email: {getattr(g.current_user, 'email', 'N/A')}")
        logger.debug(f"[PUBLIC_SURVEY] - Role: {getattr(g, 'user_role', 'N/A')}")

    try:
        logger.info(f"[PUBLIC_SURVEY] Calling SurveyController.get_public_survey({survey_id})")
        survey_data, status = SurveyController.get_public_survey(survey_id)
        
        logger.info(f"[PUBLIC_SURVEY] Controller returned status: {status}")
        if status == 200:
            survey_title = survey_data.get('title', 'Unknown') if isinstance(survey_data, dict) else 'Unknown'
            logger.info(f"[PUBLIC_SURVEY] ✅ Successfully fetched survey: '{survey_title}'")
            logger.debug(f"[PUBLIC_SURVEY] Survey data keys: {list(survey_data.keys()) if isinstance(survey_data, dict) else 'Not a dict'}")
        else:
            logger.warning(f"[PUBLIC_SURVEY] ❌ Controller returned error: {survey_data}")
            
        logger.info(f"[PUBLIC_SURVEY] ========== Public survey fetch completed ==========")
        return jsonify(survey_data), status
        
    except Exception as e:
        logger.error(f"[PUBLIC_SURVEY] ❌ Exception in get_public_survey: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while fetching survey"}), 500

@survey_bp.route('/surveys/<int:survey_id>/analytics', methods=['GET'])
@token_required
def get_survey_analytics(survey_id):
    """Get survey analytics (enforces business ownership)"""
    # This endpoint checks if the user has permission to view analytics for this survey
    # by verifying the survey belongs to a business the user can access
    result, status = SurveyController.get_survey_analytics_secure(survey_id, g.current_user, g.user_role)
    return jsonify(result), status

# ===== USER SURVEY ACCESS =====

@survey_bp.route('/surveys/accessible-optimized', methods=['GET'])
@token_required
def get_accessible_surveys_optimized():
    """Get surveys accessible to current user using optimized filtering"""
    try:
        current_user = g.current_user
        user_role = g.user_role
        business_id = request.args.get('business_id', type=int)
        
        result = SurveyController.get_accessible_surveys_for_user_optimized(
            current_user, user_role, business_id
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'surveys': [], 'total_count': 0}), 500

@survey_bp.route('/surveys/available', methods=['GET'])
@token_required
def get_available_surveys():
    """Get all surveys available to current user with XP and time calculations (NEW FLOW)"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[AVAILABLE_SURVEYS] ========== Starting available surveys fetch ==========")
    logger.info(f"[AVAILABLE_SURVEYS] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[AVAILABLE_SURVEYS] User Role: {getattr(g, 'user_role', 'None')}")
    
    try:
        logger.info(f"[AVAILABLE_SURVEYS] Calling SurveyController.get_available_surveys")
        survey_data, status = SurveyController.get_available_surveys()
        
        logger.info(f"[AVAILABLE_SURVEYS] Controller returned status: {status}")
        if status == 200:
            logger.info(f"[AVAILABLE_SURVEYS] ✅ Successfully fetched {len(survey_data)} available surveys")
        else:
            logger.warning(f"[AVAILABLE_SURVEYS] ❌ Controller returned error: {survey_data}")
            
        logger.info(f"[AVAILABLE_SURVEYS] ========== Available surveys fetch completed ==========")
        return jsonify(survey_data), status
        
    except Exception as e:
        logger.error(f"[AVAILABLE_SURVEYS] ❌ Exception in get_available_surveys: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while fetching available surveys"}), 500

@survey_bp.route('/surveys/public', methods=['GET'])
@token_optional
def get_public_surveys():
    """Get public surveys including super admin surveys"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[PUBLIC_SURVEYS] ========== Starting public surveys fetch ==========")
    
    try:
        logger.info(f"[PUBLIC_SURVEYS] Calling SurveyController.get_public_surveys")
        survey_data, status = SurveyController.get_public_surveys()
        
        logger.info(f"[PUBLIC_SURVEYS] Controller returned status: {status}")
        if status == 200:
            logger.info(f"[PUBLIC_SURVEYS] ✅ Successfully fetched {len(survey_data)} public surveys")
        else:
            logger.warning(f"[PUBLIC_SURVEYS] ❌ Controller returned error: {survey_data}")
            
        logger.info(f"[PUBLIC_SURVEYS] ========== Public surveys fetch completed ==========")
        return jsonify(survey_data), status
        
    except Exception as e:
        logger.error(f"[PUBLIC_SURVEYS] ❌ Exception in get_public_surveys: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while fetching public surveys"}), 500

# ===== LEGACY SUPPORT (Deprecated - redirects to business-scoped) =====

@survey_bp.route('/surveys', methods=['POST'])
@token_required
def create_survey_legacy():
    """Legacy endpoint - now supports Super Admin survey creation"""
    # Allow Super Admin to create general surveys
    if g.user_role == 'super_admin':
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Create survey without business restriction for Super Admin
        result, status = SurveyController.create_survey(data)
        return jsonify(result), status
    else:
        # For other roles, redirect to business-scoped creation
        return jsonify({
            "error": "This endpoint is deprecated for your role. Use /businesses/{business_id}/surveys instead.",
            "message": "Survey creation must be business-scoped."
        }), 410  # Gone

@survey_bp.route('/surveys', methods=['GET'])
@token_required
def list_surveys_legacy():
    """Legacy endpoint - returns surveys from user's business only"""
    if g.user_role == 'business_admin':
        business_id = g.current_user.business_id
        if business_id:
            result, status = SurveyController.list_surveys_for_business(business_id)
            return jsonify(result), status
    elif g.user_role == 'super_admin':
        # Super admin can see all surveys
        survey_list = SurveyController.list_all_surveys_for_super_admin()
        return jsonify({"surveys": survey_list}), 200
    
    return jsonify({"error": "Access denied"}), 403

@survey_bp.route('/surveys/<int:survey_id>/admin', methods=['GET'])
@token_required
def get_survey_legacy(survey_id):
    """Get survey details - Super Admin can access any survey"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[LEGACY_ADMIN_SURVEY] ========== Starting admin survey fetch ==========")
    logger.info(f"[LEGACY_ADMIN_SURVEY] Survey ID: {survey_id}")
    logger.info(f"[LEGACY_ADMIN_SURVEY] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[LEGACY_ADMIN_SURVEY] User Role: {getattr(g, 'user_role', 'None')}")
    logger.info(f"[LEGACY_ADMIN_SURVEY] Request Method: {request.method}")
    logger.info(f"[LEGACY_ADMIN_SURVEY] Request URL: {request.url}")
    logger.info(f"[LEGACY_ADMIN_SURVEY] Request Headers: {dict(request.headers)}")
    
    if hasattr(g, 'current_user') and g.current_user:
        logger.debug(f"[LEGACY_ADMIN_SURVEY] Authenticated user details:")
        logger.debug(f"[LEGACY_ADMIN_SURVEY] - User ID: {g.current_user.id}")
        logger.debug(f"[LEGACY_ADMIN_SURVEY] - Username: {g.current_user.username}")
        logger.debug(f"[LEGACY_ADMIN_SURVEY] - Email: {getattr(g.current_user, 'email', 'N/A')}")
        logger.debug(f"[LEGACY_ADMIN_SURVEY] - Role: {getattr(g, 'user_role', 'N/A')}")
    
    try:
        if g.user_role == 'super_admin':
            logger.info(f"[LEGACY_ADMIN_SURVEY] ✅ Super admin access - calling get_survey({survey_id})")
            result, status = SurveyController.get_survey(survey_id)
            
            logger.info(f"[LEGACY_ADMIN_SURVEY] Super admin get_survey returned status: {status}")
            if status == 200:
                survey_title = result.get('title', 'Unknown') if isinstance(result, dict) else 'Unknown'
                logger.info(f"[LEGACY_ADMIN_SURVEY] ✅ Super admin successfully fetched: '{survey_title}'")
            else:
                logger.warning(f"[LEGACY_ADMIN_SURVEY] ❌ Super admin get_survey error: {result}")
                
            return jsonify(result), status
            
        elif g.user_role == 'business_admin':
            business_id = getattr(g.current_user, 'business_id', None)
            logger.info(f"[LEGACY_ADMIN_SURVEY] Business admin access - business_id: {business_id}")
            
            if business_id:
                logger.info(f"[LEGACY_ADMIN_SURVEY] Calling get_survey_for_business({survey_id}, {business_id})")
                result, status = SurveyController.get_survey_for_business(survey_id, business_id)
                
                logger.info(f"[LEGACY_ADMIN_SURVEY] Business admin returned status: {status}")
                if status == 200:
                    survey_title = result.get('title', 'Unknown') if isinstance(result, dict) else 'Unknown'
                    logger.info(f"[LEGACY_ADMIN_SURVEY] ✅ Business admin successfully fetched: '{survey_title}'")
                else:
                    logger.warning(f"[LEGACY_ADMIN_SURVEY] ❌ Business admin error: {result}")
                    
                return jsonify(result), status
            else:
                logger.error(f"[LEGACY_ADMIN_SURVEY] ❌ Business admin {g.current_user.username if hasattr(g, 'current_user') else 'Unknown'} has no business_id")
                return jsonify({"error": "Business admin not associated with a business"}), 403
        else:
            logger.warning(f"[LEGACY_ADMIN_SURVEY] ❌ Access denied for role: {g.user_role}")
            return jsonify({"error": "Access denied"}), 403
            
    except Exception as e:
        logger.error(f"[LEGACY_ADMIN_SURVEY] ❌ Exception in get_survey_legacy: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while fetching survey"}), 500

@survey_bp.route('/surveys/<int:survey_id>/admin', methods=['PUT'])
@token_required
def update_survey_legacy(survey_id):
    """Update survey - Super Admin can update any survey"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    if g.user_role == 'super_admin':
        result, status = SurveyController.update_survey(survey_id, data)
        return jsonify(result), status
    elif g.user_role == 'business_admin':
        business_id = g.current_user.business_id
        if business_id:
            result, status = SurveyController.update_survey_for_business(survey_id, business_id, data)
            return jsonify(result), status
    
    return jsonify({"error": "Access denied"}), 403

@survey_bp.route('/surveys/<int:survey_id>/admin', methods=['DELETE'])
@token_required
def delete_survey_legacy(survey_id):
    """Delete survey - Super Admin can delete any survey"""
    if g.user_role == 'super_admin':
        result, status = SurveyController.delete_survey(survey_id)
        return jsonify(result), status
    elif g.user_role == 'business_admin':
        business_id = g.current_user.business_id
        if business_id:
            result, status = SurveyController.delete_survey_for_business(survey_id, business_id)
            return jsonify(result), status
    
    return jsonify({"error": "Access denied"}), 403

@survey_bp.route('/surveys/<int:survey_id>/admin/copy', methods=['POST'])
@token_required
def copy_survey_legacy(survey_id):
    """Copy a survey - Super Admin can copy any survey"""
    data = request.get_json()
    if not data:
        data = {} # Default to empty dict if no data provided for copy
    
    if g.user_role == 'super_admin':
        result, status = SurveyController.copy_survey(survey_id, data)
        return jsonify(result), status
    elif g.user_role == 'business_admin':
        business_id = g.current_user.business_id
        if business_id:
            result, status = SurveyController.copy_survey_for_business(survey_id, business_id, data)
            return jsonify(result), status
            
    return jsonify({"error": "Access denied"}), 403

@survey_bp.route('/surveys/<int:survey_id>/admin/publish', methods=['PATCH'])
@token_required
def publish_survey_legacy(survey_id):
    """Publish survey - Super Admin can publish any survey"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[LEGACY_PUBLISH_SURVEY] ========== Starting survey publish ==========")
    logger.info(f"[LEGACY_PUBLISH_SURVEY] Survey ID: {survey_id}")
    logger.info(f"[LEGACY_PUBLISH_SURVEY] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[LEGACY_PUBLISH_SURVEY] User Role: {getattr(g, 'user_role', 'None')}")
    logger.info(f"[LEGACY_PUBLISH_SURVEY] Request Method: {request.method}")
    logger.info(f"[LEGACY_PUBLISH_SURVEY] Request URL: {request.url}")
    
    if hasattr(g, 'current_user') and g.current_user:
        logger.debug(f"[LEGACY_PUBLISH_SURVEY] Authenticated user details:")
        logger.debug(f"[LEGACY_PUBLISH_SURVEY] - User ID: {g.current_user.id}")
        logger.debug(f"[LEGACY_PUBLISH_SURVEY] - Username: {g.current_user.username}")
        logger.debug(f"[LEGACY_PUBLISH_SURVEY] - Role: {getattr(g, 'user_role', 'N/A')}")
    
    # Check current survey state before operation
    try:
        survey_check = Survey.query.get(survey_id)
        if survey_check:
            logger.info(f"[LEGACY_PUBLISH_SURVEY] PRE-OPERATION: Survey '{survey_check.title}' published={survey_check.published}")
        else:
            logger.error(f"[LEGACY_PUBLISH_SURVEY] ❌ Survey {survey_id} not found in database")
    except Exception as e:
        logger.error(f"[LEGACY_PUBLISH_SURVEY] Error checking survey state: {e}")
    
    try:
        if g.user_role == 'super_admin':
            logger.info(f"[LEGACY_PUBLISH_SURVEY] ✅ Super admin access - calling publish_survey({survey_id})")
            result, status = SurveyController.publish_survey(survey_id)
            
            logger.info(f"[LEGACY_PUBLISH_SURVEY] Publish result status: {status}")
            if status == 200:
                logger.info(f"[LEGACY_PUBLISH_SURVEY] ✅ Survey {survey_id} published successfully")
                logger.info(f"[LEGACY_PUBLISH_SURVEY] Response data: {result}")
            else:
                logger.warning(f"[LEGACY_PUBLISH_SURVEY] ❌ Failed to publish survey {survey_id}: {result}")
                
            # Check final state after operation
            try:
                survey_final = Survey.query.get(survey_id)
                if survey_final:
                    logger.info(f"[LEGACY_PUBLISH_SURVEY] POST-OPERATION: Survey '{survey_final.title}' published={survey_final.published}")
                else:
                    logger.error(f"[LEGACY_PUBLISH_SURVEY] Survey {survey_id} not found after operation")
            except Exception as e:
                logger.error(f"[LEGACY_PUBLISH_SURVEY] Error checking final survey state: {e}")
                
            return jsonify(result), status
            
        elif g.user_role == 'business_admin':
            business_id = getattr(g.current_user, 'business_id', None)
            logger.info(f"[LEGACY_PUBLISH_SURVEY] Business admin access - business_id: {business_id}")
            
            if business_id:
                logger.info(f"[LEGACY_PUBLISH_SURVEY] Calling publish_survey_for_business({survey_id}, {business_id})")
                result, status = SurveyController.publish_survey_for_business(survey_id, business_id)
                
                logger.info(f"[LEGACY_PUBLISH_SURVEY] Business admin publish result status: {status}")
                if status == 200:
                    logger.info(f"[LEGACY_PUBLISH_SURVEY] ✅ Business admin published survey {survey_id}")
                    logger.info(f"[LEGACY_PUBLISH_SURVEY] Response data: {result}")
                else:
                    logger.warning(f"[LEGACY_PUBLISH_SURVEY] ❌ Business admin failed to publish: {result}")
                    
                # Check final state after operation
                try:
                    survey_final = Survey.query.get(survey_id)
                    if survey_final:
                        logger.info(f"[LEGACY_PUBLISH_SURVEY] POST-OPERATION: Survey '{survey_final.title}' published={survey_final.published}")
                    else:
                        logger.error(f"[LEGACY_PUBLISH_SURVEY] Survey {survey_id} not found after operation")
                except Exception as e:
                    logger.error(f"[LEGACY_PUBLISH_SURVEY] Error checking final survey state: {e}")
                    
                return jsonify(result), status
            else:
                logger.error(f"[LEGACY_PUBLISH_SURVEY] ❌ Business admin has no business_id")
                return jsonify({"error": "Business admin not associated with a business"}), 403

        else:
            logger.warning(f"[LEGACY_PUBLISH_SURVEY] ❌ Access denied for role: {g.user_role}")
            return jsonify({"error": "Access denied"}), 403
            
    except Exception as e:
        logger.error(f"[LEGACY_PUBLISH_SURVEY] ❌ Exception in publish_survey_legacy: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while publishing survey"}), 500

@survey_bp.route('/surveys/<int:survey_id>/admin/unpublish', methods=['PATCH'])
@token_required
def unpublish_survey_legacy(survey_id):
    """Unpublish survey - Super Admin can unpublish any survey"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] ========== Starting survey unpublish ==========")
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Survey ID: {survey_id}")
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] User Role: {getattr(g, 'user_role', 'None')}")
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Request Method: {request.method}")
    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Request URL: {request.url}")
    
    if hasattr(g, 'current_user') and g.current_user:
        logger.debug(f"[LEGACY_UNPUBLISH_SURVEY] Authenticated user details:")
        logger.debug(f"[LEGACY_UNPUBLISH_SURVEY] - User ID: {g.current_user.id}")
        logger.debug(f"[LEGACY_UNPUBLISH_SURVEY] - Username: {g.current_user.username}")
        logger.debug(f"[LEGACY_UNPUBLISH_SURVEY] - Role: {getattr(g, 'user_role', 'N/A')}")
    
    # Check current survey state before operation
    try:
        survey_check = Survey.query.get(survey_id)
        if survey_check:
            logger.info(f"[LEGACY_UNPUBLISH_SURVEY] PRE-OPERATION: Survey '{survey_check.title}' published={survey_check.published}")
        else:
            logger.error(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Survey {survey_id} not found in database")
    except Exception as e:
        logger.error(f"[LEGACY_UNPUBLISH_SURVEY] Error checking survey state: {e}")
    
    try:
        if g.user_role == 'super_admin':
            logger.info(f"[LEGACY_UNPUBLISH_SURVEY] ✅ Super admin access - calling unpublish_survey({survey_id})")
            result, status = SurveyController.unpublish_survey(survey_id)
            
            logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Unpublish result status: {status}")
            if status == 200:
                logger.info(f"[LEGACY_UNPUBLISH_SURVEY] ✅ Survey {survey_id} unpublished successfully")
                logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Response data: {result}")
            else:
                logger.warning(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Failed to unpublish survey {survey_id}: {result}")
                
            # Check final state after operation
            try:
                survey_final = Survey.query.get(survey_id)
                if survey_final:
                    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] POST-OPERATION: Survey '{survey_final.title}' published={survey_final.published}")
                else:
                    logger.error(f"[LEGACY_UNPUBLISH_SURVEY] Survey {survey_id} not found after operation")
            except Exception as e:
                logger.error(f"[LEGACY_UNPUBLISH_SURVEY] Error checking final survey state: {e}")
                
            return jsonify(result), status
            
        elif g.user_role == 'business_admin':
            business_id = getattr(g.current_user, 'business_id', None)
            logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Business admin access - business_id: {business_id}")
            
            if business_id:
                logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Calling unpublish_survey_for_business({survey_id}, {business_id})")
                result, status = SurveyController.unpublish_survey_for_business(survey_id, business_id)
                
                logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Business admin unpublish result status: {status}")
                if status == 200:
                    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] ✅ Business admin unpublished survey {survey_id}")
                    logger.info(f"[LEGACY_UNPUBLISH_SURVEY] Response data: {result}")
                else:
                    logger.warning(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Business admin failed to unpublish: {result}")
                    
                # Check final state after operation
                try:
                    survey_final = Survey.query.get(survey_id)
                    if survey_final:
                        logger.info(f"[LEGACY_UNPUBLISH_SURVEY] POST-OPERATION: Survey '{survey_final.title}' published={survey_final.published}")
                    else:
                        logger.error(f"[LEGACY_UNPUBLISH_SURVEY] Survey {survey_id} not found after operation")
                except Exception as e:
                    logger.error(f"[LEGACY_UNPUBLISH_SURVEY] Error checking final survey state: {e}")
                    
                return jsonify(result), status
            else:
                logger.error(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Business admin has no business_id")
                return jsonify({"error": "Business admin not associated with a business"}), 403

        else:
            logger.warning(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Access denied for role: {g.user_role}")
            return jsonify({"error": "Access denied"}), 403
            
    except Exception as e:
        logger.error(f"[LEGACY_UNPUBLISH_SURVEY] ❌ Exception in unpublish_survey_legacy: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while unpublishing survey"}), 500

@survey_bp.route('/surveys/<int:survey_id>/questions/<int:question_id>/admin/branch', methods=['POST'])
@token_required
def create_branch_legacy(survey_id, question_id):
    # This legacy branch creation was not scoped by business in its original flexible form.
    # It implies Super Admin or a direct check within SurveyController if it was more open.
    # For now, let's restrict to Super Admin for this /admin path.
    if g.user_role != 'super_admin':
        return jsonify({"error": "Access denied for branching via this legacy admin path"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Direct call, assuming SurveyController.create_branch handles its own survey/question existence checks.
    result, status = SurveyController.create_branch(survey_id, question_id, data)
    return jsonify(result), status

@survey_bp.route('/surveys/<int:survey_id>/admin/toggle-publish', methods=['PATCH'])
@token_required
def toggle_publish_survey_legacy(survey_id):
    """Toggle survey publish status - Smart toggle based on current state"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"[TOGGLE_PUBLISH] ========== Starting toggle publish ==========")
    logger.info(f"[TOGGLE_PUBLISH] Survey ID: {survey_id}")
    logger.info(f"[TOGGLE_PUBLISH] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[TOGGLE_PUBLISH] User Role: {getattr(g, 'user_role', 'None')}")
    
    try:
        # First get the current survey state
        survey = Survey.query.get(survey_id)
        if not survey:
            logger.error(f"[TOGGLE_PUBLISH] ❌ Survey {survey_id} not found")
            return jsonify({"error": "Survey not found"}), 404
            
        logger.info(f"[TOGGLE_PUBLISH] Found survey: '{survey.title}'")
        logger.info(f"[TOGGLE_PUBLISH] Current published status: {survey.published}")
        
        # Determine which operation to perform
        if survey.published:
            logger.info(f"[TOGGLE_PUBLISH] Survey is published, calling unpublish...")
            if g.user_role == 'super_admin':
                result, status = SurveyController.unpublish_survey(survey_id)
            elif g.user_role == 'business_admin':
                business_id = getattr(g.current_user, 'business_id', None)
                if business_id and business_id == survey.business_id:
                    result, status = SurveyController.unpublish_survey_for_business(survey_id, business_id)
                else:
                    logger.error(f"[TOGGLE_PUBLISH] ❌ Business admin access denied")
                    return jsonify({"error": "Access denied"}), 403
            else:
                logger.error(f"[TOGGLE_PUBLISH] ❌ Access denied for role: {g.user_role}")
                return jsonify({"error": "Access denied"}), 403
        else:
            logger.info(f"[TOGGLE_PUBLISH] Survey is unpublished, calling publish...")
            if g.user_role == 'super_admin':
                result, status = SurveyController.publish_survey(survey_id)
            elif g.user_role == 'business_admin':
                business_id = getattr(g.current_user, 'business_id', None)
                if business_id and business_id == survey.business_id:
                    result, status = SurveyController.publish_survey_for_business(survey_id, business_id)
                else:
                    logger.error(f"[TOGGLE_PUBLISH] ❌ Business admin access denied")
                    return jsonify({"error": "Access denied"}), 403
            else:
                logger.error(f"[TOGGLE_PUBLISH] ❌ Access denied for role: {g.user_role}")
                return jsonify({"error": "Access denied"}), 403
        
        logger.info(f"[TOGGLE_PUBLISH] Operation completed with status: {status}")
        logger.info(f"[TOGGLE_PUBLISH] Result: {result}")
        
        return jsonify(result), status
        
    except Exception as e:
        logger.error(f"[TOGGLE_PUBLISH] ❌ Exception in toggle_publish: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error while toggling survey status"}), 500

@survey_bp.route('/surveys/public-feed', methods=['GET'])
@token_optional
def get_public_survey_feed_route():
    args = request.args
    return SurveyController.get_public_survey_feed(args)

# Utility route for checking if a survey is a quickpoll
@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/questions/reorder', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def reorder_questions_for_business(business_id, survey_id):
    """Reorder questions while preserving conditional logic"""
    data = request.get_json()
    if not data or 'question_mappings' not in data:
        return jsonify({"error": "question_mappings data required"}), 400
    
    question_mappings = data.get('question_mappings', [])
    result, status = SurveyController.reorder_questions(survey_id, question_mappings)
    return jsonify(result), status

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/conditional-logic/validate', methods=['GET'])
@token_required
@business_admin_scoped_permission_required('can_view_survey_analytics')
def validate_conditional_logic_for_business(business_id, survey_id):
    """Validate conditional logic integrity for a business survey"""
    result, status = SurveyController.validate_conditional_logic(survey_id)
    return jsonify(result), status

# ===== LEGACY ADMIN ROUTES (Super Admin) =====

@survey_bp.route('/surveys/<int:survey_id>/questions/reorder', methods=['POST'])
@token_required
def reorder_questions_legacy(survey_id):
    """Reorder questions while preserving conditional logic (Super Admin)"""
    data = request.get_json()
    if not data or 'question_mappings' not in data:
        return jsonify({"error": "question_mappings data required"}), 400
    
    question_mappings = data.get('question_mappings', [])
    result, status = SurveyController.reorder_questions(survey_id, question_mappings)
    return jsonify(result), status

@survey_bp.route('/surveys/<int:survey_id>/conditional-logic/validate', methods=['GET'])
@token_required
def validate_conditional_logic_legacy(survey_id):
    """Validate conditional logic integrity (Super Admin)"""
    result, status = SurveyController.validate_conditional_logic(survey_id)
    return jsonify(result), status

@survey_bp.route('/surveys/<int:survey_id>/is_quickpoll', methods=['GET'])
@token_required
@enforce_survey_access
def is_quickpoll(survey_id):
    """Check if a survey is a quickpoll"""
    result, status = SurveyController.is_quickpoll(survey_id)
    return jsonify(result), status

@survey_bp.route('/surveys/<int:survey_id>/admin/feature', methods=['PATCH'])
@token_required
def feature_survey_legacy(survey_id):
    """Feature or unfeature a survey (super/admin access). Expect JSON {"featured": true/false}."""
    data = request.get_json() or {}
    featured_flag = bool(data.get('featured', True))
    result, status = SurveyController.set_featured(survey_id, featured_flag)
    return jsonify(result), status

@survey_bp.route('/surveys/<int:survey_id>/test-discord-access', methods=['GET'])
@token_required  
def test_discord_access(survey_id):
    """Test endpoint to verify Discord role filtering is working"""
    from app.controllers.business_controller import BusinessController
    from app.services.discord_service import check_user_discord_access
    
    survey = Survey.query.get_or_404(survey_id)
    current_user = g.current_user
    
    # Test Discord access using BusinessController
    has_access = BusinessController.check_survey_access(current_user, survey_id)
    
    # Also test using direct discord service
    discord_result = {"has_access": False, "reason": "No Discord check performed"}
    
    if survey.business and survey.business.discord_server and survey.audience_settings and survey.audience_settings.discord_roles_allowed:
        discord_has_access, discord_reason = check_user_discord_access(
            current_user, 
            survey.business, 
            survey.audience_settings.discord_roles_allowed
        )
        discord_result = {
            "has_access": discord_has_access,
            "reason": discord_reason
        }
    
    return jsonify({
        "survey_id": survey_id,
        "survey_title": survey.title,
        "is_restricted": survey.is_restricted,
        "business_has_discord_server": bool(survey.business and survey.business.discord_server),
        "has_audience_settings": bool(survey.audience_settings),
        "required_roles": survey.audience_settings.discord_roles_allowed if survey.audience_settings else [],
        "user_discord_id": current_user.discord_id,
        "business_controller_check": has_access,
        "direct_discord_check": discord_result,
        "business_discord_server": survey.business.discord_server if survey.business else None
    }), 200

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/discord-roles', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def update_survey_discord_roles(business_id, survey_id):
    """Update Discord role mappings for a survey"""
    try:
        data = request.get_json()
        discord_role_ids = data.get('discord_role_ids', [])
        
        result = SurveyController.update_survey_discord_roles(
            survey_id, business_id, discord_role_ids
        )
        
        if result['success']:
            return jsonify({'message': 'Discord roles updated successfully'}), 200
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@survey_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/direct-access', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def generate_direct_access_link(business_id, survey_id):
    """Generate a direct access link for a survey"""
    try:
        result = SurveyController.generate_direct_access_link(survey_id, business_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@survey_bp.route('/surveys/<int:survey_id>/direct', methods=['GET'])
@cross_origin()
@token_required
def get_survey_with_direct_access(survey_id):
    """Access survey using direct access token"""
    try:
        direct_token = request.args.get('direct_token')
        
        if not direct_token:
            return jsonify({'error': 'Direct access token required'}), 400
        
        # Check if direct access token is valid
        if not SurveyController.check_direct_access(survey_id, direct_token):
            return jsonify({'error': 'Invalid or expired direct access token'}), 403
        
        # Get survey without audience restrictions
        survey = Survey.query.filter(
            Survey.id == survey_id,
            Survey.published == True,
            Survey.is_archived == False
        ).first()
        
        if not survey:
            return jsonify({'error': 'Survey not found or not published'}), 404
        
        return jsonify({
            'survey': survey.to_dict(include_questions=True),
            'direct_access': True,
            'message': 'Direct access granted'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

