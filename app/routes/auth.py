# routes/auth.py
from flask import Blueprint, request, jsonify, g, current_app

from ..controllers.auth_controller import AuthController, token_required, admin_required, business_admin_required, business_admin_scoped_permission_required, enforce_survey_access, enforce_business_access
from ..models import db, Business, BusinessAudience, SurveyAudience, Survey, User, Admin
from datetime import datetime, timedelta
import uuid
from functools import wraps
import logging
from ..controllers.business_controller import BusinessController, _check_audience_rules

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# ===== AUTHENTICATION ROUTES =====

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    result, status = AuthController.register_user(data)
    return jsonify(result), status

@auth_bp.route('/users/business-admin', methods=['POST'])
@token_required
@business_admin_scoped_permission_required('can_manage_admins')
def handle_create_business_admin():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    creator = g.current_user

    # --- SEAT LIMIT CHECK ---
    # A super admin bypasses seat limits for any business
    if g.user_role != 'super_admin':
        # The creator is a business admin, so we need to check their business
        business_to_check = Business.query.get(creator.business_id)
        if not business_to_check:
            return jsonify({"error": "Business associated with creator not found."}), 404

        # Calculate total available seats
        tier_seat_limit = business_to_check.tier_info.admin_seat_limit if business_to_check.tier_info else 1
        total_seats = (tier_seat_limit if tier_seat_limit != -1 else float('inf')) + business_to_check.admin_seats_purchased

        # Calculate current used seats
        used_seats = User.query.filter_by(business_id=creator.business_id, role='business_admin').count()

        current_app.logger.info(f"[CREATE_BIZ_ADMIN] Business {creator.business_id} has {used_seats} used seats out of {total_seats} total.")

        if used_seats >= total_seats:
            return jsonify({
                "error": "Admin seat limit reached. Please remove an existing admin or purchase more seats to continue."
            }), 402 # Payment Required
    # --- END SEAT LIMIT CHECK ---
    result, status = AuthController.create_business_admin(data, creator)
    return jsonify(result), status

@auth_bp.route('/admin/register', methods=['POST'])
@token_required
@admin_required
def register_admin_route():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    admin_id = g.current_user.id 
    current_app.logger.info(f"[AUTH_ROUTES] Admin registration request from admin ID: {admin_id}")
    
    result, status = AuthController.register_admin(data, admin_id) 
    return jsonify(result), status

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    result, status = AuthController.login(data)
    return jsonify(result), status

@auth_bp.route('/login-passkey', methods=['POST'])
def login_passkey_route():
    data = request.json
    if not data or 'email' not in data or 'passkey' not in data:
        return jsonify({"error": "Email and passkey are required"}), 400
    result, status = AuthController.login_with_passkey(data)
    return jsonify(result), status

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_me():
    user = g.current_user
    role = g.user_role
    current_app.logger.info(f"[AUTH_ROUTES] /me endpoint - User ID: {user.id}, Role: {role}")
    
    # Return consistent role names
    if role == 'super_admin':
        return jsonify({
            "user": user.to_dict(),
            "role": "super_admin"  # Changed from "admin" to "super_admin"
        }), 200
    elif role in ['user', 'business_admin']:
        return jsonify({
            "user": user.to_dict(),
            "role": role
        }), 200
    else:
        current_app.logger.warning(f"[AUTH_ROUTES] Unknown role: {role}")
        return jsonify({
            "user": user.to_dict(),
            "role": role
        }), 200

@auth_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get current user's profile information"""
    user = g.current_user
    role = g.user_role
    current_app.logger.info(f"[AUTH_ROUTES] /profile endpoint - User ID: {user.id}, Role: {role}, Discord ID: {user.discord_id}")
    
    user_data = user.to_dict()
    user_data['role'] = role
    
    # Add business information for business admins
    if role == 'business_admin' and user.business_id:
        business = Business.query.get(user.business_id)
        if business:
            user_data['business_name'] = business.name
            user_data['business_tier'] = business.tier
            user_data['business_permissions'] = user.business_admin_permissions
        else:
            user_data['business_name'] = "N/A (Business not found)"
    
    return jsonify(user_data), 200
        
@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    try:
        # In a more robust implementation, you would invalidate the token
        # by adding it to a blacklist in your database
        
        # For now, just return a success message - client will handle
        # clearing local storage
        return jsonify({
            "message": "Successfully logged out"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/validate-token', methods=['GET'])
@token_required
def validate_token():
    """Validate the current token and return user info"""
    logger.info(f"[VALIDATE_TOKEN] ========== Token validation request ==========")
    logger.info(f"[VALIDATE_TOKEN] User: {getattr(g, 'current_user', 'None')}")
    logger.info(f"[VALIDATE_TOKEN] User Role: {getattr(g, 'user_role', 'None')}")
    
    try:
        user = g.current_user
        user_role = g.user_role
        if user:
            user_data = user.to_dict()
            user_data['role'] = user_role
            if user_role == 'business_admin' and user.business_id:
                business = Business.query.get(user.business_id)
                if business:
                    user_data['business_name'] = business.name
                    user_data['business_tier'] = business.tier
                    user_data['business_permissions'] = user.business_admin_permissions
                else:
                    user_data['business_name'] = "N/A (Business not found)"
            return jsonify({
                "message": "Token is valid",
                "user": user_data,
                "role": user_role
            }), 200
        return jsonify({"message": "Token is invalid or user not found"}), 401
        
    except Exception as e:
        logger.error(f"[VALIDATE_TOKEN] ❌ Error validating token: {e}", exc_info=True)
        return jsonify({'error': 'Token validation failed', 'valid': False}), 500

# ===== AUDIENCE CONTROL ROUTES =====

def check_user_access(user, audience_settings):
    """Check if a user has access based on audience settings"""
    if not audience_settings:
        return True  # No restrictions
        
    # Check specific email whitelist
    if audience_settings.specific_email_whitelist and user.email in audience_settings.specific_email_whitelist:
        return True
        
    # Check email domain whitelist
    if audience_settings.email_domain_whitelist:
        user_domain = user.email.split('@')[1]
        if user_domain in audience_settings.email_domain_whitelist:
            return True
            
    # Check Discord roles if user has discord_id
    if user.discord_id and audience_settings.discord_roles_allowed:
        # TODO: Implement Discord role check via Discord API
        pass
        
    return False

def generate_qr_code_token():
    """Generate a unique QR code token"""
    return str(uuid.uuid4())

@auth_bp.route('/businesses/<int:business_id>/audience', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_splash_page')
def update_business_audience(business_id):
    """Update business audience settings"""
    business = Business.query.get_or_404(business_id)
    data = request.get_json()
    
    # Get or create audience settings
    audience = BusinessAudience.query.filter_by(business_id=business_id).first()
    if not audience:
        audience = BusinessAudience(business_id=business_id)
        db.session.add(audience)
    
    # Update business audience type
    business.audience_type = data.get('audience_type', 'PUBLIC')
    
    # Update audience settings
    if business.audience_type == 'RESTRICTED':
        audience.email_domain_whitelist = data.get('email_domain_whitelist', [])
        audience.specific_email_whitelist = data.get('specific_email_whitelist', [])
        audience.discord_roles_allowed = data.get('discord_roles_allowed', [])
        
        # Generate new QR code if requested
        if data.get('generate_qr_code'):
            audience.qr_code_token = generate_qr_code_token()
            audience.qr_code_expires_at = datetime.utcnow() + timedelta(days=data.get('qr_code_validity_days', 30))
    
    db.session.commit()
    
    return jsonify({
        'message': 'Business audience settings updated successfully',
        'audience': audience.to_dict()
    }), 200

@auth_bp.route('/businesses/<int:business_id>/surveys/<int:survey_id>/audience', methods=['PUT'])
@token_required
@business_admin_scoped_permission_required('can_edit_surveys')
def update_survey_audience(business_id, survey_id):
    """Update survey audience settings"""
    survey = Survey.query.filter_by(id=survey_id, business_id=business_id).first_or_404()
    data = request.get_json()
    
    # Get or create survey audience settings
    audience = SurveyAudience.query.filter_by(survey_id=survey_id).first()
    if not audience:
        audience = SurveyAudience(survey_id=survey_id)
        db.session.add(audience)
    
    # Update access type
    audience.access_type = data.get('access_type', 'BUSINESS_AUDIENCE')
    
    # If using specific rules, update them
    if audience.access_type == 'SPECIFIC_RULES':
        audience.email_domain_whitelist = data.get('email_domain_whitelist', [])
        audience.specific_email_whitelist = data.get('specific_email_whitelist', [])
        audience.discord_roles_allowed = data.get('discord_roles_allowed', [])
        
        # Generate new QR code if requested
        if data.get('generate_qr_code'):
            audience.qr_code_token = generate_qr_code_token()
            audience.qr_code_expires_at = datetime.utcnow() + timedelta(days=data.get('qr_code_validity_days', 30))
    
    db.session.commit()
    
    return jsonify({
        'message': 'Survey audience settings updated successfully',
        'audience': audience.to_dict()
    }), 200

@auth_bp.route('/verify-qr-code/<token>', methods=['POST'])
@token_required
def verify_qr_code_access(token):
    """Verify QR code access and add user to whitelist if valid"""
    # Check business audience QR codes
    business_audience = BusinessAudience.query.filter_by(qr_code_token=token).first()
    if business_audience and (not business_audience.qr_code_expires_at or business_audience.qr_code_expires_at > datetime.utcnow()):
        # Add user to business whitelist
        if g.current_user.email not in business_audience.specific_email_whitelist:
            business_audience.specific_email_whitelist = business_audience.specific_email_whitelist or []
            business_audience.specific_email_whitelist.append(g.current_user.email)
            db.session.commit()
        return jsonify({'message': 'Access granted to business', 'type': 'business'}), 200
    
    # Check survey audience QR codes
    survey_audience = SurveyAudience.query.filter_by(qr_code_token=token).first()
    if survey_audience and (not survey_audience.qr_code_expires_at or survey_audience.qr_code_expires_at > datetime.utcnow()):
        # Add user to survey whitelist
        if g.current_user.email not in survey_audience.specific_email_whitelist:
            survey_audience.specific_email_whitelist = survey_audience.specific_email_whitelist or []
            survey_audience.specific_email_whitelist.append(g.current_user.email)
            db.session.commit()
        return jsonify({'message': 'Access granted to survey', 'type': 'survey'}), 200
    
    return jsonify({'message': 'Invalid or expired QR code'}), 404

@auth_bp.route('/businesses/<int:business_id>/access', methods=['GET'])
@token_required
def check_business_access(business_id):
    """Check if current user has access to a business"""
    business = Business.query.get_or_404(business_id)
    
    # Super admins and business admins always have access
    if g.user_role in ['super_admin', 'business_admin']:
        return jsonify({'has_access': True}), 200
    
    # If business is public, everyone has access
    if business.audience_type == 'PUBLIC':
        return jsonify({'has_access': True}), 200
    
    # Check restricted access
    audience = business.audience_settings
    if audience and check_user_access(g.current_user, audience):
        return jsonify({'has_access': True}), 200
    
    return jsonify({'has_access': False}), 403

@auth_bp.route('/surveys/<int:survey_id>/access', methods=['GET'])
@token_required
def check_survey_access(survey_id):
    """Check if current user has access to a survey"""
    survey = Survey.query.get_or_404(survey_id)
    
    # Super admins and business admins of this business always have access
    if g.user_role == 'super_admin' or (g.user_role == 'business_admin' and g.current_user.business_id == survey.business_id):
        return jsonify({'has_access': True}), 200
    
    # First check business access
    business = survey.business
    if business.audience_type == 'RESTRICTED':
        if not check_user_access(g.current_user, business.audience_settings):
            return jsonify({'has_access': False}), 403
    
    # Then check survey-specific access
    audience = survey.audience_settings
    if not audience or audience.access_type == 'PUBLIC_TO_BUSINESS_USERS':
        return jsonify({'has_access': True}), 200
    
    if audience.access_type == 'BUSINESS_AUDIENCE':
        # Already checked business access above
        return jsonify({'has_access': True}), 200
    
    if audience.access_type == 'SPECIFIC_RULES':
        if check_user_access(g.current_user, audience):
            return jsonify({'has_access': True}), 200
    
    return jsonify({'has_access': False}), 403

# New routes for Step 1 Registration
@auth_bp.route('/register/initiate', methods=['POST'])
def initiate_registration_step1_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    response, status_code = AuthController.initiate_registration_step1(data)
    return jsonify(response), status_code

@auth_bp.route('/register/verify-email', methods=['GET'])
def verify_email_for_registration_route():
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "Verification token is missing from query parameters"}), 400
    response, status_code = AuthController.verify_email_for_registration(token)
    # Based on the plan, this should return the temp_auth_token to the frontend.
    # The frontend would then redirect. If we want the backend to redirect,
    # we would use flask.redirect and url_for, but returning the token is more API-like.
    return jsonify(response), status_code

# ===== NEW REGISTRATION STEP ROUTES =====

@auth_bp.route('/register/profile', methods=['POST'])
# @token_required # This should use the temp_auth_token, not the standard JWT
def complete_registration_step2_profile_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # The tempAuthToken will be in the body, validated by the controller method
    # temp_token = data.get('tempAuthToken') 
    # if not temp_token:
    #     return jsonify({"error": "Temporary authentication token is required"}), 401
        
    response, status_code = AuthController.complete_registration_step2_profile(data)
    return jsonify(response), status_code

@auth_bp.route('/register/tags', methods=['POST'])
# @token_required # This also uses the temp_auth_token
def complete_registration_step3_tags_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # temp_token = data.get('tempAuthToken')
    # if not temp_token:
    #     return jsonify({"error": "Temporary authentication token is required"}), 401
        
    response, status_code = AuthController.complete_registration_step3_tags(data)
    return jsonify(response), status_code

# ===== FORGOT PASSWORD ROUTES =====

@auth_bp.route('/forgot-password/initiate-email', methods=['POST'])
def forgot_password_initiate_email_route():
    data = request.json
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400
    result, status = AuthController.forgot_password_initiate_email(data)
    return jsonify(result), status

@auth_bp.route('/forgot-password/get-questions', methods=['POST'])
def forgot_password_get_questions_route():
    data = request.json
    # Add validation for expected data: email
    if not data or 'email' not in data:
        return jsonify({"error": "Email is required"}), 400
    result, status = AuthController.get_security_questions_for_email(data)
    return jsonify(result), status

@auth_bp.route('/forgot-password/verify-questions', methods=['POST'])
def forgot_password_verify_questions_route():
    data = request.json
    # Add validation for expected data: email, answers
    if not data or 'email' not in data or 'answers' not in data:
        return jsonify({"error": "Email and answers are required"}), 400
    result, status = AuthController.forgot_password_verify_questions(data)
    return jsonify(result), status

@auth_bp.route('/forgot-password/verify-passkey', methods=['POST'])
def forgot_password_verify_passkey_route():
    data = request.json
    # Add validation for expected data: email, passkey
    if not data or 'email' not in data or 'passkey' not in data:
        return jsonify({"error": "Email and passkey are required"}), 400
    result, status = AuthController.forgot_password_verify_passkey(data)
    return jsonify(result), status

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password_with_token_route():
    data = request.json
    # Add validation for expected data: token, new_password
    if not data or 'token' not in data or 'new_password' not in data:
        return jsonify({"error": "Token and new password are required"}), 400
    result, status = AuthController.reset_password_with_token(data)
    return jsonify(result), status

# ===== END FORGOT PASSWORD ROUTES =====

# Placeholder for /auth/register/complete if it's not yet defined
# Ensure it's defined as per Section 2.1 of profile_implementation_plan_doc.md for Step 4 security

# New routes for security setup steps
@auth_bp.route('/security/questions/available', methods=['GET'])
# @token_required # This endpoint is public for registration forms
def get_available_security_questions_route():
    # This endpoint might not need a token if it's just providing a static list
    # If it's user-specific or needs temp_token validation, adjust decorator and controller
    return AuthController.get_available_security_questions()

@auth_bp.route('/security/mfa/setup', methods=['POST'])
@token_required
def setup_mfa_route():
    data = request.get_json()
    return AuthController.setup_mfa(data)

@auth_bp.route('/security/mfa/verify', methods=['POST'])
# @token_required # This will use the tempAuthToken logic inside the controller
def verify_mfa_route():
    data = request.get_json()
    return AuthController.verify_mfa_setup(data)

@auth_bp.route('/security/questions/set', methods=['POST'])
# @token_required # This will use the tempAuthToken logic inside the controller
def set_security_questions_route():
    data = request.get_json()
    return AuthController.set_security_questions_for_registration(data)

@auth_bp.route('/security/passkeys/generate', methods=['POST'])
# @token_required # This will use the tempAuthToken logic inside the controller
def generate_passkeys_route():
    data = request.get_json()
    return AuthController.generate_passkeys_for_registration(data)

@auth_bp.route('/register/complete', methods=['POST'])
def complete_registration_step4_security_route():
    data = request.get_json()
    # The controller method now returns a tuple: (response_dict, status_code)
    response, status_code = AuthController.complete_registration_step4_security(data)
    return jsonify(response), status_code

# --- Route for disabling MFA ---
@auth_bp.route('/security/mfa/disable', methods=['POST'])
@token_required # User must be logged in
def disable_mfa_for_user_route():
    user_id = g.current_user.id
    data = request.get_json()
    result, status_code = AuthController.disable_mfa_for_user(user_id, data)
    return jsonify(result), status_code
# --- End route for disabling MFA ---

# ===== OTP ROUTES =====

@auth_bp.route('/send-otp', methods=['POST'])
def send_otp_route():
    """
    POST /auth/send-otp
    Body: { "email": "user@example.com" }
    """
    data = request.get_json() or {}
    # Note: In the original plan, initiate_registration_step1 was meant to send the OTP.
    # This standalone endpoint is useful for other OTP purposes or for resending.
    # We are calling a new AuthController method here.
    # Ensure AuthController.send_otp_email is implemented.
    result, status_code = AuthController.send_otp_email(data)
    return jsonify(result), status_code

@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp_route():
    """
    POST /auth/resend-otp
    Body: { "email": "user@example.com" }
    This route is an alias for send_otp_route for frontend clarity.
    """
    data = request.get_json() or {}
    result, status_code = AuthController.send_otp_email(data)
    return jsonify(result), status_code
    
@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp_route():
    """
    POST /auth/verify-otp
    Body: { "email": "user@example.com", "pin": "123456" }
    """
    data = request.get_json() or {}
    # Ensure AuthController.verify_otp_email is implemented.
    result, status_code = AuthController.verify_otp_email(data)
    return jsonify(result), status_code

@auth_bp.route('/verify-mfa-login', methods=['POST'])
def verify_mfa_login_route():
    """
    POST /auth/verify-mfa-login
    Body: { "email": "user@example.com", "pin": "123456" }
    """
    data = request.get_json() or {}
    result, status_code = AuthController.verify_mfa_login(data)
    return jsonify(result), status_code

# ===== LEGAL COMPLIANCE ROUTES =====

@auth_bp.route('/accept-legal-terms', methods=['POST'])
@token_required
def accept_legal_terms_route():
    """
    POST /auth/accept-legal-terms
    Accepts all legal terms for the current user (business admin first login)
    """
    user_id = g.current_user.id
    result, status_code = AuthController.accept_legal_terms(user_id)
    return jsonify(result), status_code

@auth_bp.route('/accept-ai-policy', methods=['POST'])
@token_required
def accept_ai_policy_route():
    """
    POST /auth/accept-ai-policy
    Accepts AI policy for the current user (first AI feature use)
    """
    user_id = g.current_user.id
    result, status_code = AuthController.accept_ai_policy(user_id)
    return jsonify(result), status_code

@auth_bp.route('/legal-status', methods=['GET'])
@token_required
def get_legal_status_route():
    """
    GET /auth/legal-status
    Get the current user's legal acceptance status
    """
    user_id = g.current_user.id
    result, status_code = AuthController.get_legal_status(user_id)
    return jsonify(result), status_code