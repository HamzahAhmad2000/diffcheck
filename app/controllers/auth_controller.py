import jwt
import datetime
import uuid
from flask import current_app, jsonify, request, Blueprint, g
from functools import wraps
from ..models import User, Admin, Business, db, BusinessAudience, SurveyAudience, Survey, PasswordResetToken, EmailVerificationToken, TempAuthToken, ProfileTag, LinkedAccount, OneTimePIN, AIPointsUsageLog
from sqlalchemy.exc import IntegrityError
import requests
import logging
from .business_controller import BusinessController, _check_audience_rules 
from .survey_controller import SurveyController
from ..services import discord_service
from .xp_badge_controller import award_xp, calculate_profile_completion_xp
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
from datetime import datetime, timedelta
from flask_mail import Message
from ..extensions import mail
from ..utils.captcha_utils import verify_recaptcha, is_captcha_required, validate_captcha_token_format
# Assume pyotp is available; if not, this part needs manual installation
try:
    import pyotp
    import qrcode
    import io
    import base64
except ImportError:
    pyotp = None
    qrcode = None
    io = None
    base64 = None

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        g.current_admin = None

        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            secret_key = current_app.config.get('SECRET_KEY')
            data = jwt.decode(token, secret_key, algorithms=['HS256'])

            if 'admin_id' in data:
                admin_id = data['admin_id']
                from ..models import Admin
                admin = Admin.query.get(admin_id)
                if admin:
                    g.current_user = admin
                    g.current_admin = admin
                    g.user_role = 'super_admin'
                else:
                    return jsonify({'message': 'Invalid admin token - user not found!'}), 401

            elif 'user_id' in data:
                user_id = data['user_id']
                from ..models import User
                user = User.query.get(user_id)
                if user:
                    g.current_user = user
                    g.user_role = user.role
                else:
                    return jsonify({'message': 'Invalid user token - user not found!'}), 401
            else:
                return jsonify({'message': 'Invalid token payload - missing user identification!'}), 401

            result = f(*args, **kwargs)
            return result

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'message': f'Token is invalid: {str(e)}'}), 401
        except Exception as e:
            return jsonify({'message': f'Authentication error: {str(e)}'}), 401

    return decorated

def token_optional(f):
    @wraps(f)
    def decorated_optional(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        g.current_user = None
        g.current_admin = None
        g.user_role = None

        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]

        if token:
            try:
                secret_key = current_app.config.get('SECRET_KEY')
                data = jwt.decode(token, secret_key, algorithms=['HS256'])

                if 'admin_id' in data:
                    admin = Admin.query.get(data['admin_id'])
                    if admin:
                        g.current_user = admin
                        g.current_admin = admin
                        g.user_role = 'super_admin'
                elif 'user_id' in data:
                    user = User.query.get(data['user_id'])
                    if user:
                        g.current_user = user
                        g.user_role = user.role

            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                pass

        return f(*args, **kwargs)
    return decorated_optional

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_role') or g.user_role != 'super_admin':
            return jsonify(message="Super admin access required for this resource."), 403
        return f(*args, **kwargs)
    return decorated_function

def super_admin_required(f):
    """Decorator enforcing super admin access."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_role') or g.user_role != 'super_admin':
            return jsonify(message="Super admin access required for this resource."), 403
        return f(*args, **kwargs)

    return decorated_function

def business_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_role'):
            return jsonify(message="Authentication context error."), 403

        # Super admins bypass business admin requirements
        if g.user_role == 'super_admin':
            return f(*args, **kwargs)

        if g.user_role != 'business_admin':
            return jsonify(message="Business admin or super admin access required for this resource."), 403

        if not hasattr(g, 'current_user') or not g.current_user.business_id:
            return jsonify(message="Business admin is not associated with a business."), 403

        return f(*args, **kwargs)
    return decorated_function

def business_admin_scoped_permission_required(required_permission=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'current_user') or not g.current_user or not hasattr(g, 'user_role'):
                return jsonify(message="Authentication required."), 401

            user = g.current_user
            role = g.user_role
            target_business_id_from_route = kwargs.get('business_id')

            if target_business_id_from_route is None:
                if request.is_json and isinstance(request.json, dict):
                    target_business_id_from_route = request.json.get('business_id')
                elif kwargs.get('survey_id'):
                    survey = Survey.query.get(kwargs.get('survey_id'))
                    if survey:
                        target_business_id_from_route = survey.business_id

                if target_business_id_from_route is None:
                    return jsonify(message="Target business context is unclear for this operation."), 400

            try:
                target_business_id = int(target_business_id_from_route)
            except ValueError:
                return jsonify(message="Invalid business ID format."), 400

            if role == 'super_admin':
                g.target_business = Business.query.get(target_business_id)
                return f(*args, **kwargs)

            if role != 'business_admin':
                return jsonify(message="Access denied. Business admin or super admin role required."), 403

            assigned_business_id = user.business_id
            if assigned_business_id != target_business_id:
                return jsonify(message="Access denied. You can only manage your assigned business."), 403

            g.target_business = Business.query.get(target_business_id)

            if required_permission:
                business_obj = g.target_business
                if not business_obj or not business_obj.permissions or not business_obj.permissions.get(required_permission, False):
                    return jsonify(message=f"Access denied. The business itself does not have the permission: '{required_permission}'."), 403

                admin_permissions = user.business_admin_permissions if user.business_admin_permissions else {}
                if not admin_permissions.get(required_permission, False):
                    return jsonify(message=f"Access denied. You do not have the required permission: '{required_permission}'."), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def enforce_business_access(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        business_id = kwargs.get('business_id')
        if not business_id:
            return jsonify(message="Business ID missing from request."), 400

        business = Business.query.get(business_id)
        if not business:
            return jsonify(message="Business not found."), 404

        g.target_business = business

        if hasattr(g, 'user_role') and g.user_role == 'super_admin':
            return f(*args, **kwargs)

        if hasattr(g, 'user_role') and g.user_role == 'business_admin':
            if hasattr(g, 'current_user') and g.current_user and g.current_user.business_id == business.id:
                return f(*args, **kwargs)
            else:
                return jsonify(message="Access denied. You can only access your assigned business."), 403

        if business.audience_type == 'PUBLIC':
            return f(*args, **kwargs)

        if business.audience_type == 'RESTRICTED':
            if hasattr(g, 'current_user') and g.current_user and hasattr(g, 'user_role') and g.user_role == 'user':
                if BusinessController.check_user_access(g.current_user, business.id):
                    return f(*args, **kwargs)
                else:
                    return jsonify(message="Access denied. You do not have permission to access this business."), 403
            else:
                return jsonify(message="Authentication required to access this business."), 401

        return jsonify(message="Access denied."), 403
            
    return decorated_function

def enforce_survey_access(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            survey_id = kwargs.get('survey_id')
            if not survey_id:
                return jsonify({'error': 'Survey ID required'}), 400
            
            # Check for direct access token first
            direct_token = request.args.get('direct_token')
            if direct_token:
                from .survey_controller import SurveyController
                if SurveyController.check_direct_access(survey_id, direct_token):
                    g.direct_access = True
                    return f(*args, **kwargs)
                else:
                    return jsonify({'error': 'Invalid direct access token'}), 403
            
            # Regular audience-based access check
            current_user = g.current_user
            user_role = getattr(g, 'user_role', None)
            if not current_user:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Get survey with audience settings
            survey = Survey.query.options(
                db.joinedload(Survey.audience_settings)
            ).filter(Survey.id == survey_id).first()
            
            if not survey:
                return jsonify({'error': 'Survey not found'}), 404
            
            # ADMIN BYPASS - Admins get complete bypass of audience restrictions
            if user_role == 'super_admin':
                g.direct_access = False
                return f(*args, **kwargs)
            elif user_role == 'business_admin':
                # Business admin can access surveys from their business regardless of audience settings
                if current_user and current_user.business_id == survey.business_id:
                    g.direct_access = False
                    return f(*args, **kwargs)
                else:
                    return jsonify({'error': 'Access denied: Survey belongs to a different business'}), 403
            
            # For regular users, check if survey is published
            if not survey.published:
                return jsonify({'error': 'Survey not published'}), 403
            
            # Use BusinessController for proper access check for regular users only
            from .business_controller import BusinessController
            has_access, reason = BusinessController.check_survey_access(current_user, survey_id)
            if not has_access:
                return jsonify({'error': f'Access to this survey is restricted. {reason}'}), 403
            
            g.direct_access = False
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Error in enforce_survey_access: {str(e)}", exc_info=True)
            return jsonify({'error': f'An unexpected error occurred during access check.'}), 500
    
    return decorated

def check_user_access(user, audience_settings):
    if not audience_settings:
        return True

    if audience_settings.specific_email_whitelist and user.email.lower() in [e.lower() for e in audience_settings.specific_email_whitelist]:
        return True

    if audience_settings.email_domain_whitelist:
        user_domain = user.email.split('@')[1].lower() if '@' in user.email else None
        if user_domain and user_domain in [d.lower() for d in audience_settings.email_domain_whitelist]:
            return True

    if user.discord_id and audience_settings.discord_roles_allowed:
        # Find linked account
        linked_account = LinkedAccount.query.filter_by(user_id=user.id, provider='discord').first()
        if linked_account:
            from ..services import discord_service
            # We need the business server ID, which we can get from the survey
            survey = Survey.query.filter(Survey.audience_settings == audience_settings).first()
            if survey and survey.business and survey.business.discord_server:
                server_id = survey.business.discord_server
                required_roles = audience_settings.discord_roles_allowed

                # Use the optimized cached function instead of the legacy one
                member_info = discord_service.get_user_guild_member_info_with_cache(linked_account, server_id)
                if "error" not in member_info:
                    user_roles = set(member_info.get("data", {}).get("roles", []))
                    required_role_set = set(str(r) for r in required_roles)  # Ensure comparison is with strings
                    if user_roles.intersection(required_role_set):
                        return True

    return False

def check_business_ai_points(points_required_func):
    """
    Decorator to check if business has sufficient AI points before executing an action.
    Super admins bypass this check completely.

    Args:
        points_required_func: Function that takes request and returns required points count
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Super admins bypass ALL AI points and permission checks
            if g.user_role == 'super_admin':
                g.business = None
                g.points_needed = 0
                return f(*args, **kwargs)

            # Only business admins are subject to AI points checking
            if g.user_role != 'business_admin':
                return jsonify({"error": "This action requires a business account"}), 403

            business_id = getattr(g.current_user, 'business_id', None)
            if not business_id:
                return jsonify({"error": "User is not associated with a business"}), 403

            business = Business.query.get(business_id)
            if not business:
                return jsonify({"error": "Business not found"}), 404

            # Calculate required points based on request data
            try:
                points_needed = points_required_func(request)
            except Exception as e:
                return jsonify({"error": "Error calculating required points"}), 500

            # Check AI points permission
            permissions = business.permissions or {}

            # Allow AI Builder usage if either explicit AI permission is granted OR the business can create surveys
            has_ai_builder_perm = permissions.get('CAN_USE_AI_BUILDER', None)
            # Default to True when key missing (backward compatibility) unless explicitly false
            if has_ai_builder_perm is None:
                has_ai_builder_perm = True

            can_create_surveys = permissions.get('can_create_surveys', False)

            if not (has_ai_builder_perm or can_create_surveys):
                return jsonify({
                    "error": "Your business does not have permission to use AI features",
                    "code": "PERMISSION_DENIED"
                }), 403

            if business.ai_points < points_needed:
                return jsonify({
                    "error": "Insufficient AI points to perform this action",
                    "required_points": points_needed,
                    "available_points": business.ai_points,
                    "code": "INSUFFICIENT_POINTS"
                }), 403

            # Store business object for use in the route
            g.business = business
            g.points_needed = points_needed
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def check_business_permission(permission_key):
    """
    Decorator to check if business has a specific permission.
    Super admins bypass this check.
    
    Args:
        permission_key: String key to check in business.permissions JSON
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Super admins bypass permission checks
            if g.user_role == 'super_admin':
                return f(*args, **kwargs)

            # Only business admins are subject to permission checking
            if g.user_role != 'business_admin':
                return jsonify({"error": "This action requires a business account"}), 403

            business_id = getattr(g.current_user, 'business_id', None)
            if not business_id:
                return jsonify({"error": "User is not associated with a business"}), 403

            business = Business.query.get(business_id)
            if not business:
                return jsonify({"error": "Business not found"}), 404

            # Check permission
            permissions = business.permissions or {}
            if not permissions.get(permission_key, False):
                return jsonify({
                    "error": f"Your business does not have permission to {permission_key.lower().replace('_', ' ')}",
                    "code": "PERMISSION_DENIED",
                    "missing_permission": permission_key
                }), 403

            # Store business object for use in the route
            g.business = business
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Point calculation functions for different AI actions
def get_points_for_response_generation(request):
    """Calculate points needed for AI response generation"""
    data = request.get_json() or {}
    num_responses = data.get("num_responses", 0)
    return max(num_responses, 0)  # 1 point per response

def get_points_for_survey_creation(request):
    """Calculate points needed for survey creation"""
    data = request.get_json() or {}
    
    # Check for guided survey builder tone_length
    tone_length = data.get("tone_length")
    if tone_length:
        size_map = {"short": 1, "balanced": 2, "deep": 3}
        return size_map.get(tone_length.lower(), 2)
    
    # Check for quick generate (usually medium complexity)
    if data.get("quick_generate", False):
        return 2
    
    # Default for other survey creation methods
    return 2

def get_points_for_ai_chat_edit(request):
    """Calculate points needed for AI chat edits"""
    return 1  # Simple 1 point deduction for chat edits

def get_points_for_ai_insights(request):
    """Calculate points needed for AI insights/analytics"""
    data = request.get_json() or {}
    # Could be variable based on complexity, for now it's 1 point
    return 1

class AuthController:
    @staticmethod
    def check_discord_role_access(user, survey):
        """
        Checks if a user has the required Discord roles for a survey.
        Returns (bool, reason_string).
        Uses optimized caching for performance.
        """
        # Get business and audience settings
        business = survey.business
        audience = survey.audience_settings
        
        # Ensure the business has a server configured
        if not business or not business.discord_server:
            return False, "The business has not configured a Discord server."
        
        # Get required roles from audience settings
        required_roles = audience.discord_roles_allowed if audience else None
            
        # Use the optimized Discord access check with caching
        has_access, reason = discord_service.check_user_discord_access(user, business, required_roles)
        
        return has_access, reason

    @staticmethod
    def generate_token(user_id=None, admin_id=None, role=None, expires_delta=None):
        if not expires_delta:
            expires_delta = timedelta(days=1)
            
        now = datetime.utcnow()
        
        payload = {
            'exp': now + expires_delta,
            'iat': now,
        }
        
        if admin_id:
            payload['admin_id'] = admin_id
            payload['role_generated_for'] = 'super_admin'
            logger.info(f"[GENERATE_TOKEN] Generating token for ADMIN_ID: {admin_id}")
        elif user_id:
            payload['user_id'] = user_id
            payload['role_generated_for'] = role
            logger.info(f"[GENERATE_TOKEN] Generating token for USER_ID: {user_id}, Role: {role}")
        else:
            logger.error("[GENERATE_TOKEN] CRITICAL: Neither user_id nor admin_id provided.")
            raise ValueError("Either user_id or admin_id must be provided for token generation")
            
        token = jwt.encode(
            payload,
            current_app.config.get('SECRET_KEY'),
            algorithm='HS256'
        )
        logger.info(f"[GENERATE_TOKEN] Generated token payload: {payload}")
        return token

    @staticmethod
    def register_user(data):
        try:
            logger.info(f"[REGISTER_USER] Attempting to register user: {data.get('username')}")
            
            existing_user = User.query.filter(
                (User.username == data.get('username')) | 
                (User.email == data.get('email'))
            ).first()
            
            if existing_user:
                if existing_user.username == data.get('username'):
                    logger.warning(f"[REGISTER_USER] Username '{data.get('username')}' already exists")
                    return {"error": "Username already exists"}, 400
                logger.warning(f"[REGISTER_USER] Email '{data.get('email')}' already exists")
                return {"error": "Email already exists"}, 400
            
            age = data.get('age')
            if age and isinstance(age, str) and age.strip():
                try:
                    age = int(age)
                except (ValueError, TypeError):
                    age = None
            
            new_user = User(
                username=data.get('username'),
                email=data.get('email'),
                name=data.get('name', ''),
                age=age,
                company=data.get('company', ''),
                gender=data.get('gender', ''),
                education=data.get('education', ''),
                location=data.get('location', ''),
                occupation=data.get('occupation', '')
            )
            new_user.set_password(data.get('password'))
            
            db.session.add(new_user)
            db.session.commit()
            
            logger.info(f"[REGISTER_USER] User '{new_user.username}' registered successfully with ID: {new_user.id}")
            
            # Process referral code if provided (from user's pending_referral_code field)
            referral_result = None
            referral_code = new_user.pending_referral_code  # Get from user's stored referral code
            affiliate_code = data.get('affiliate_code')

            if referral_code:
                try:
                    from .referral_controller import ReferralController
                    referral_result = ReferralController.process_signup(new_user, referral_code)
                    if referral_result.get('success'):
                        logger.info(f"[REGISTER_USER] Referral processed successfully for user {new_user.id}")
                        # Clear the pending referral code after successful processing
                        new_user.pending_referral_code = None
                    else:
                        logger.warning(f"[REGISTER_USER] Referral processing failed: {referral_result.get('error')}")
                except Exception as e:
                    logger.error(f"[REGISTER_USER] Error processing referral: {e}")
            elif affiliate_code:
                try:
                    from .referral_controller import ReferralController
                    referral_result = ReferralController.process_affiliate_signup(new_user, affiliate_code)
                    if referral_result.get('success'):
                        logger.info(f"[REGISTER_USER] Affiliate conversion processed successfully for user {new_user.id}")
                    else:
                        logger.warning(f"[REGISTER_USER] Affiliate processing failed: {referral_result.get('error')}")
                except Exception as e:
                    logger.error(f"[REGISTER_USER] Error processing affiliate: {e}")
            
            token = AuthController.generate_token(
                user_id=new_user.id,
                role='user'
            )
            
            response_data = {
                'message': 'User registered successfully', 
                'token': token,
                'user': new_user.to_dict()
            }
            
            # Include referral information in response if available
            if referral_result and referral_result.get('success'):
                response_data['referral'] = referral_result
            
            return response_data, 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"[REGISTER_USER] Exception during registration: {e}", exc_info=True)
            return {"error": str(e)}, 500
    
    @staticmethod
    def register_admin(data, creating_super_admin_id):
        try:
            logger.info(f"[REGISTER_ADMIN] Attempting to register admin: {data.get('username')} by super admin ID: {creating_super_admin_id}")
            
            creator_admin = Admin.query.get(creating_super_admin_id)
            if not creator_admin:
                logger.warning(f"[REGISTER_ADMIN] Creating super admin ID {creating_super_admin_id} not found")
                return {"error": "Unauthorized - Only existing super admins can create new super admin accounts"}, 403
            
            existing_admin = Admin.query.filter(
                (Admin.username == data.get('username')) | 
                (Admin.email == data.get('email'))
            ).first()
            
            if existing_admin:
                logger.warning(f"[REGISTER_ADMIN] Admin with username '{data.get('username')}' or email '{data.get('email')}' already exists")
                return {"error": "Super admin with this username or email already exists"}, 409
            
            new_admin = Admin(
                username=data.get('username'),
                email=data.get('email'),
                name=data.get('name', ''),
                created_by_admin_id=creating_super_admin_id 
            )
            new_admin.set_password(data.get('password'))
            
            db.session.add(new_admin)
            db.session.commit()
            
            logger.info(f"[REGISTER_ADMIN] Super admin '{new_admin.username}' registered successfully with ID: {new_admin.id}")
            
            return {
                'message': 'Super Admin registered successfully', 
                'admin': new_admin.to_dict()
            }, 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"[REGISTER_ADMIN] Error registering super admin: {e}", exc_info=True)
            return {"error": str(e)}, 500

    @staticmethod
    def determine_registration_next_step(user):
        """Return the next registration step for a partially registered user."""
        # Business admins always skip registration steps
        if user.role == 'business_admin':
            return 'complete'
            
        if not user.email_verified:
            return 'verify_email'
        if user.username.startswith('pending_reg_') or not user.date_of_birth or not user.country:
            return 'profile'
        # Steps 3 (tags) and 4 (security/activation) are removed from the mandatory sign-up flow.
        # If profile is complete, registration is considered complete.
        # The user will be activated at the end of the profile step.
        return 'complete'

    @staticmethod
    def login(data):
        try:
            username = data.get('username')
            password = data.get('password')
            logger.info(f"[AUTH_LOGIN] Attempting login for identifier: {username}")

            admin = Admin.query.filter_by(username=username).first()
            if admin and admin.check_password(password):
                logger.info(f"[AUTH_LOGIN] Admin user '{username}' found and password verified.")
                token = AuthController.generate_token(
                    admin_id=admin.id,
                    role='super_admin'
                )
                user_data = admin.to_dict()
                user_data['role_assigned'] = 'super_admin'
                return {
                    'token': token,
                    'user': user_data,
                    'role': 'super_admin'
                }, 200
            
            user = User.query.filter((User.username == username) | (User.email == username)).first()
            if user and user.check_password(password):
                logger.info(f"[AUTH_LOGIN] User '{username}' (DB role: {user.role}) found and password verified.")
                
                # Check if MFA is enabled for this user
                if getattr(user, 'mfa_enabled', False):
                    logger.info(f"[AUTH_LOGIN] MFA is enabled for user {username}. Sending OTP.")
                    # Send OTP to user's email
                    otp_result, otp_status = AuthController.send_otp_email({'email': user.email})
                    if otp_status == 200:
                        return {
                            'mfa_required': True,
                            'message': 'MFA required. Check your email for verification code.',
                            'email': user.email
                        }, 200
                    else:
                        logger.error(f"[AUTH_LOGIN] Failed to send MFA OTP for user {username}")
                        return {"error": "Failed to send MFA code. Please try again."}, 500
                
                # No MFA required, proceed with normal login or continuation of registration

                # Business admins should skip profile completion requirements
                if user.role == 'business_admin':
                    logger.info(f"[AUTH_LOGIN] Business admin {username} login - skipping profile completion checks")
                    token = AuthController.generate_token(
                        user_id=user.id,
                        role=user.role
                    )
                    user_data = user.to_dict()
                    user_data['role_assigned'] = user.role
                    return {
                        'token': token,
                        'user': user_data,
                        'role': user.role
                    }, 200

                next_step = AuthController.determine_registration_next_step(user)
                if next_step != 'complete':
                    temp_token_obj = TempAuthToken.generate(user_id=user.id, purpose="REGISTRATION_MULTI_STEP", expires_in_seconds=7200)
                    db.session.commit()
                    return {
                        'registration_incomplete': True,
                        'next_step': next_step,
                        'tempAuthToken': temp_token_obj.token,
                        'email': user.email
                    }, 200

                token = AuthController.generate_token(
                    user_id=user.id,
                    role=user.role
                )
                user_data = user.to_dict()
                user_data['role_assigned'] = user.role
                return {
                    'token': token,
                    'user': user_data,
                    'role': user.role
                }, 200
            
            logger.warning(f"[AUTH_LOGIN] Invalid credentials for username: {username}")
            return {"error": "Invalid username or password"}, 401
        except Exception as e:
            logger.error(f"[AUTH_LOGIN] Exception during login: {e}", exc_info=True)
            return {"error": str(e)}, 500
    
    @staticmethod
    def refresh_token():
        token = None
        auth_header = request.headers.get('Authorization')
        logger.info(f"[REFRESH_TOKEN] Attempting to refresh token")
        
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
                
        if not token:
            logger.warning("[REFRESH_TOKEN] Authentication token is missing")
            return {"error": "Authentication token is missing"}, 401
            
        try:
            data = jwt.decode(token, current_app.config.get('SECRET_KEY'), algorithms=['HS256'])
            logger.info(f"[REFRESH_TOKEN] Decoded payload: {data}")
            
            if 'user_id' in data:
                user = User.query.get(data['user_id'])
                if not user:
                    logger.warning(f"[REFRESH_TOKEN] User ID {data['user_id']} not found")
                    return {"error": "User not found"}, 404
                    
                new_token = AuthController.generate_token(
                    user_id=user.id,
                    role=user.role
                )
                
                logger.info(f"[REFRESH_TOKEN] Token refreshed for user ID: {user.id}")
                return {
                    'token': new_token,
                    'user': user.to_dict(),
                    'role': user.role
                }, 200
                
            elif 'admin_id' in data:
                admin = Admin.query.get(data['admin_id'])
                if not admin:
                    logger.warning(f"[REFRESH_TOKEN] Admin ID {data['admin_id']} not found")
                    return {"error": "Admin not found"}, 404
                    
                new_token = AuthController.generate_token(
                    admin_id=admin.id,
                    role='super_admin'
                )
                
                logger.info(f"[REFRESH_TOKEN] Token refreshed for admin ID: {admin.id}")
                return {
                    'token': new_token,
                    'user': admin.to_dict(),
                    'role': 'super_admin'
                }, 200
                
            else:
                logger.error(f"[REFRESH_TOKEN] Invalid token payload - missing user/admin ID: {data}")
                return {"error": "Invalid token payload"}, 400
                
        except jwt.ExpiredSignatureError:
            logger.warning("[REFRESH_TOKEN] Token has expired")
            return {"error": "Token has expired, please log in again"}, 401
        except (jwt.InvalidTokenError, Exception) as e:
            logger.error(f"[REFRESH_TOKEN] Invalid token error: {e}", exc_info=True)
            return {"error": f"Invalid token: {str(e)}"}, 401
            
    @staticmethod
    def get_current_user(token):
        try:
            data = jwt.decode(token, current_app.config.get('SECRET_KEY'), algorithms=['HS256'])
            logger.info(f"[GET_CURRENT_USER] Decoded payload for app/routes/auth.py: {data}")
            
            if 'admin_id' in data:
                admin = Admin.query.get(data['admin_id'])
                if admin:
                    return admin, 'super_admin'
                logger.warning(f"[GET_CURRENT_USER] Admin ID {data['admin_id']} in token, but not found in DB.")
                return None, None
            
            if 'user_id' in data:
                user = User.query.get(data['user_id'])
                if user:
                    return user, user.role
                logger.warning(f"[GET_CURRENT_USER] User ID {data['user_id']} in token, but not found in DB.")
                return None, None
            
            logger.warning("[GET_CURRENT_USER] Token payload missing 'admin_id' and 'user_id'.")
            return None, None
        except jwt.ExpiredSignatureError:
            logger.warning("[GET_CURRENT_USER] Token expired.")
            return None, 'expired'
        except jwt.InvalidTokenError:
            logger.warning("[GET_CURRENT_USER] Token invalid.")
            return None, 'invalid'
        except Exception as e:
            logger.error(f"[GET_CURRENT_USER] Exception: {e}", exc_info=True)
            return None, 'error'

    @staticmethod
    def create_business_admin(data, creator):
        logger.info(f"[CREATE_BUSINESS_ADMIN] Attempt to create business admin by {g.user_role} ID: {creator.id}")

        # Determine target business ID based on creator's role
        target_business_id = None
        if g.user_role == 'super_admin':
            target_business_id = data.get('business_id')
            if not target_business_id:
                logger.warning(f"[CREATE_BUSINESS_ADMIN] Super Admin {creator.id} must provide a business_id in payload.")
                return {"error": "Super admins must specify a business_id."}, 400
        elif g.user_role == 'business_admin':
            target_business_id = creator.business_id
            if 'business_id' in data and int(data.get('business_id')) != target_business_id:
                logger.warning(f"[CREATE_BUSINESS_ADMIN] Business Admin {creator.id} attempted to create admin for another business ({data.get('business_id')}). Overriding with their own business ID: {target_business_id}.")
        
        if not target_business_id:
            logger.error(f"[CREATE_BUSINESS_ADMIN] Could not determine target_business_id for creator {creator.id}.")
            return {"error": "Could not determine target business for admin creation."}, 400

        # Required fields check
        required_fields = ['name', 'email', 'password', 'role', 'business_admin_permissions']
        for field in required_fields:
            if field not in data:
                logger.warning(f"[CREATE_BUSINESS_ADMIN] Missing required field: {field}")
                return {"error": f"Missing required field: {field}"}, 400
        
        if data['role'] != 'business_admin':
            logger.warning(f"[CREATE_BUSINESS_ADMIN] Invalid role specified: {data['role']}")
            return {"error": "Invalid role specified for business admin creation."}, 400

        username = data.get('username', data['email']) 

        existing_user = User.query.filter(
            (User.username == username) | (User.email == data['email'])
        ).first()
        if existing_user:
            logger.warning(f"[CREATE_BUSINESS_ADMIN] User with username '{username}' or email '{data['email']}' already exists")
            return {"error": "User with this username or email already exists."}, 409

        business = Business.query.get(target_business_id)
        if not business:
            logger.warning(f"[CREATE_BUSINESS_ADMIN] Business ID {target_business_id} not found")
            return {"error": "Assigned business not found."}, 404
        if not business.is_approved or not business.is_active:
            logger.warning(f"[CREATE_BUSINESS_ADMIN] Business ID {target_business_id} is not approved or active")
            return {"error": "Cannot assign admin to an inactive or unapproved business."}, 400

        validated_admin_permissions = {}
        business_perms = business.permissions if business.permissions else {}
        
        for perm_key, perm_value in data.get('business_admin_permissions', {}).items():
            if perm_value is True and business_perms.get(perm_key) is True:
                validated_admin_permissions[perm_key] = True
            elif perm_value is True and business_perms.get(perm_key) is not True:
                logger.warning(
                    f"[CREATE_BUSINESS_ADMIN] Attempt to grant Business Admin permission '{perm_key}' which is not enabled for Business ID {business.id}."
                )
        
        if not validated_admin_permissions and any(data.get('business_admin_permissions', {}).values()):
            logger.info(f"[CREATE_BUSINESS_ADMIN] No permissions granted to Business Admin for Business ID {business.id} as business itself lacks those permissions.")

        try:
            new_ba_user = User(
                name=data['name'],
                username=username,
                email=data['email'],
                role='business_admin',
                business_id=target_business_id, 
                business_admin_permissions=validated_admin_permissions, 
                discord_id=data.get('discord_id'),
                is_active=True,
                email_verified=True,  # Business admins don't need email verification
                # Set minimal required fields to prevent profile completion requirements
                country=data.get('country', 'N/A'),  # Default for business admins
                interests=['business_management']  # Default interest for business admins
            )
            new_ba_user.set_password(data['password'])
            
            db.session.add(new_ba_user)
            db.session.commit()
            
            # Send credentials email
            email_sent = AuthController._send_business_admin_credentials_email(
                email=new_ba_user.email,
                username=new_ba_user.username,
                password=data['password']
            )
            if not email_sent:
                logger.warning(f"[CREATE_BUSINESS_ADMIN] Business Admin {new_ba_user.username} was created, but failed to send credentials email.")
            
            logger.info(
                f"[CREATE_BUSINESS_ADMIN] Business Admin '{new_ba_user.username}' created with ID {new_ba_user.id} for Business ID {business.id} "
                f"by {g.user_role} ID {creator.id}."
            )
            return {"message": "Business Admin created successfully", "user": new_ba_user.to_dict()}, 201
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"[CREATE_BUSINESS_ADMIN] Database integrity error: {e}")
            if "UNIQUE constraint failed: users.username" in str(e):
                 return {"error": "Username already exists."}, 409
            if "UNIQUE constraint failed: users.email" in str(e):
                 return {"error": "Email already exists."}, 409
            return {"error": "Database error: Could not create business admin."}, 500
        except Exception as e:
            db.session.rollback()
            logger.error(f"[CREATE_BUSINESS_ADMIN] Error creating business admin: {e}", exc_info=True)
            return {"error": "An unexpected error occurred.", "details": str(e)}, 500

    @staticmethod
    def _send_business_admin_credentials_email(email, username, password):
        """Sends an email with the username and password to a new business admin."""
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
        login_link = f"{frontend_url}/login"
        
        try:
            msg = Message(
                "Your New Eclipseer Business Admin Account",
                recipients=[email]
            )
            msg.body = (
                f"Hello {username},\n\n"
                f"An account has been created for you on the Eclipseer platform.\n\n"
                f"You can log in using these credentials:\n"
                f"Username: {username}\n"
                f"Password: {password}\n\n"
                f"Please log in here: {login_link}\n\n"
                f"For security, we strongly recommend changing your password after you log in for the first time.\n\n"
                f"Important: Upon your first login, you will be required to review and accept our legal documents. "
                f"Please familiarize yourself with our policies:\n\n"
                f"Legal Documents:\n"
                f"• Terms & Conditions: {frontend_url}/legal#terms\n"
                f"• Privacy Policy: {frontend_url}/legal#privacy\n"
                f"• Cookie Policy: {frontend_url}/legal#cookies\n"
                f"• Community Guidelines: {frontend_url}/legal#community\n"
                f"• Data Processing Agreement (DPA): {frontend_url}/legal#dpa\n"
                f"• End User License Agreement (EULA): {frontend_url}/legal#eula\n"
                f"• Service Level Agreement (SLA): {frontend_url}/legal#sla\n"
                f"• AI Use Policy: {frontend_url}/legal#ai\n"
                f"• Reward & Raffle Terms: {frontend_url}/legal#rewards\n\n"
                f"These documents outline the terms of service, data handling practices, and user responsibilities on our platform.\n\n"
                f"Welcome aboard,\n"
                f"The GalvanAI Team"
            )
            mail.send(msg)
            logger.info(f"Successfully sent business admin credentials email to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send business admin credentials email to {email}: {str(e)}", exc_info=True)
            return False

    @staticmethod
    def _validate_temp_auth_token(temp_token_value, purpose="REGISTRATION_MULTI_STEP"):
        if not temp_token_value:
            logger.warning("[VALIDATE_TEMP_TOKEN] Temp token missing.")
            return None, {"error": "Temporary authentication token is required."}, 401
        
        temp_token_obj = TempAuthToken.query.filter_by(token=temp_token_value).first()
        
        if not temp_token_obj:
            logger.warning(f"[VALIDATE_TEMP_TOKEN] Invalid temp token provided: {temp_token_value[:15]}...")
            return None, {"error": "Invalid or expired temporary authentication token."}, 401
            
        if temp_token_obj.is_used:
            logger.warning(f"[VALIDATE_TEMP_TOKEN] Temp token {temp_token_value[:15]} for user {temp_token_obj.user_id} has already been used.")
            return None, {"error": "Temporary authentication token has already been used."}, 401

        if temp_token_obj.expires_at < datetime.utcnow():
            logger.warning(f"[VALIDATE_TEMP_TOKEN] Temp token {temp_token_value[:15]} for user {temp_token_obj.user_id} has expired.")
            # Optionally mark as used or delete expired tokens
            # temp_token_obj.is_used = True 
            # db.session.delete(temp_token_obj)
            # db.session.commit()
            return None, {"error": "Temporary authentication token has expired. Please restart registration."}, 401
        
        if temp_token_obj.purpose != purpose:
            logger.warning(f"[VALIDATE_TEMP_TOKEN] Temp token {temp_token_value[:15]} for user {temp_token_obj.user_id} has incorrect purpose. Expected '{purpose}', got '{temp_token_obj.purpose}'.")
            return None, {"error": "Invalid temporary token for this operation."}, 403

        user = User.query.get(temp_token_obj.user_id)
        if not user:
            logger.error(f"[VALIDATE_TEMP_TOKEN] User ID {temp_token_obj.user_id} associated with temp token {temp_token_value[:15]} not found.")
            # This case should ideally not happen if DB integrity is maintained.
            return None, {"error": "User for token not found. Critical error."}, 500
            
        if not user.email_verified and purpose == "REGISTRATION_MULTI_STEP": # Only check email_verified for registration tokens after step 1
             # This check might be redundant if step 1 marks email_verified=True due to bypass.
             # However, if bypass is off, this is important.
            logger.warning(f"[VALIDATE_TEMP_TOKEN] User {user.email}'s email not verified, though temp token exists for registration.")
            # return None, {"error": "Email not verified. Please complete email verification first."}, 403


        logger.info(f"[VALIDATE_TEMP_TOKEN] Temp token validated for user {user.email} (ID: {user.id}).")
        return user, None, 200 # Return user, no error, and HTTP status for consistency if needed elsewhere

    @staticmethod
    def initiate_registration_step1(data):
        logger.info(f"[AUTH_CTRL] Initiating Registration Step 1: {data.get('email')}")
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirmPassword')
        captcha_token = data.get('captchaToken')
        referral_code = data.get('referral_code')

        if not email or not password or not confirm_password:
            return {"error": "Email, password, and confirmPassword are required"}, 400
        if password != confirm_password:
            return {"error": "Passwords do not match"}, 400
        if len(password) < 8: # Basic password policy
            return {"error": "Password must be at least 8 characters long"}, 400

        # CAPTCHA verification for bot prevention - temporarily disabled but keeping code structure
        # if is_captcha_required():
        #     if not captcha_token:
        #         logger.warning(f"[AUTH_CTRL] CAPTCHA token missing for registration attempt: {email}")
        #         return {"error": "CAPTCHA verification is required"}, 400
        #
        #     if not validate_captcha_token_format(captcha_token):
        #         logger.warning(f"[AUTH_CTRL] Invalid CAPTCHA token format for: {email}")
        #         return {"error": "Invalid CAPTCHA token format"}, 400
        #
        #     # Get user's IP address for additional security
        #     user_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
        #
        #     # Verify CAPTCHA with Google's API
        #     captcha_success, captcha_error = verify_recaptcha(captcha_token, user_ip)
        #     if not captcha_success:
        #         logger.warning(f"[AUTH_CTRL] CAPTCHA verification failed for: {email} - {captcha_error}")
        #         return {"error": f"CAPTCHA verification failed: {captcha_error}"}, 400
        #
        #     logger.info(f"[AUTH_CTRL] CAPTCHA verification successful for: {email}")
        # else:
        #     logger.info(f"[AUTH_CTRL] CAPTCHA verification skipped (not required)")

        logger.info(f"[AUTH_CTRL] CAPTCHA verification temporarily disabled for signup")

        # Check if ANY user already exists with this email
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            # Check if the existing user has completed registration
            next_step = AuthController.determine_registration_next_step(existing_user)
            if next_step == 'complete':
                logger.warning(f"[INITIATE_REG_S1] Email '{email}' already has a complete account.")
                return {"error": "An account with this email already exists and is fully registered. Please use the login page to access your account."}, 409
            else:
                logger.info(f"[INITIATE_REG_S1] Found incomplete registration for '{email}', next step: {next_step}. Cleaning up for fresh start.")
                # Delete the incomplete user to allow fresh registration
                db.session.delete(existing_user)
                db.session.commit()

        try:
            # Create a new inactive user record
            # Username will be set in Step 2. A temporary one can be used or allow null if schema permits.
            temp_username = f"pending_reg_{secrets.token_hex(4)}_{email.split('@')[0]}"
            
            new_user = User(
                email=email,
                username=temp_username,
                email_verified=False, # Set to False, verification will happen via OTP
                is_active=False,
                pending_referral_code=referral_code  # Store referral code for later processing
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()
    
            # Call the send_otp_email method to handle OTP generation and sending
            otp_response, otp_status_code = AuthController.send_otp_email({'email': email})

            if otp_status_code != 200:
                # If OTP sending fails, rollback the user creation
                db.session.rollback()
                logger.error(f"[INITIATE_REG_S1] Failed to send OTP for {email}, rolling back user creation.")
                return otp_response, otp_status_code

            # Generate a TempAuthToken for the next steps
            temp_auth_token_obj = TempAuthToken.generate(
                user_id=new_user.id,
                purpose="REGISTRATION_MULTI_STEP",
                expires_in_seconds=7200
            )
            
            db.session.commit()
            logger.info(f"[INITIATE_REG_S1] OTP sent to {email}. User ID {new_user.id} created (inactive).")
            
            return {
                "message": "Registration initiated! An OTP has been sent to your email.",
                "tempAuthToken": temp_auth_token_obj.token,
                "email": email 
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"[INITIATE_REG_S1] IntegrityError for {email}: {str(e)}")
            # This might happen if the temp_username conflicts, though unlikely with secrets.token_hex
            # Or if deletion of previous user somehow failed and then add conflicted.
            return {"error": "Database conflict during registration initiation. Please try again."}, 409
        except Exception as e:
            db.session.rollback()
            logger.error(f"[INITIATE_REG_S1] Exception for {email}: {str(e)}", exc_info=True)
            return {"error": "Could not initiate registration step 1."}, 500

    @staticmethod
    def verify_email_for_registration(verification_token_from_url):
        # This method is largely bypassed. If called, it might be with a temp_auth_token.
        logger.info(f"[VERIFY_EMAIL_REG] Attempting to 'verify email' with token: {verification_token_from_url[:10]}...")

        # Check if the token is a valid TempAuthToken (from step 1 bypass)
        temp_token_obj = TempAuthToken.query.filter_by(token=verification_token_from_url, purpose="REGISTRATION_MULTI_STEP").first()
        
        if temp_token_obj and temp_token_obj.is_valid():
            user = User.query.get(temp_token_obj.user_id)
            if user and user.email_verified and not user.is_active: # User already marked as verified in bypass
                logger.info(f"[VERIFY_EMAIL_REG] Bypass mode: Email for user {user.email} already considered verified. Temp token still valid.")
                return {
                    "message": "Email verification bypassed. Proceed to profile setup.",
                    "tempAuthToken": temp_token_obj.token,
                    "email": user.email
                }, 200
            else:
                logger.warning(f"[VERIFY_EMAIL_REG] Bypass mode: Token matched TempAuthToken but user state is unexpected (User: {user}, Verified: {user.email_verified if user else 'N/A'}, Active: {user.is_active if user else 'N/A'}).")
        
        # Fallback to checking EmailVerificationToken model if not bypassing or if bypass flow changes
        email_verification_token_obj = EmailVerificationToken.query.filter_by(token=verification_token_from_url).first()
        if email_verification_token_obj and email_verification_token_obj.is_valid():
            user = User.query.get(email_verification_token_obj.user_id)
            if user and not user.is_active:
                user.email_verified = True
                email_verification_token_obj.is_used = True
                
                # Generate a new TempAuthToken for subsequent steps
                temp_auth_token_obj_new = TempAuthToken.generate(
                    user_id=user.id,
                    purpose="REGISTRATION_MULTI_STEP",
                    expires_in_seconds=7200
                )
                try:
                    db.session.commit()
                    logger.info(f"[VERIFY_EMAIL_REG] Email for user {user.email} verified via EmailVerificationToken. New TempAuthToken generated.")
                    return {
                        "message": "Email verified successfully. Proceed to profile setup.",
                        "tempAuthToken": temp_auth_token_obj_new.token,
                        "email": user.email
                    }, 200
                except Exception as e_commit:
                    db.session.rollback()
                    logger.error(f"[VERIFY_EMAIL_REG] Error committing after email verification for {user.email}: {e_commit}", exc_info=True)
                    return {"error": "Failed to finalize email verification."}, 500
            else:
                 logger.warning(f"[VERIFY_EMAIL_REG] EmailVerificationToken matched, but user state invalid (User: {user}, Active: {user.is_active if user else 'N/A'}).")


        logger.warning(f"[VERIFY_EMAIL_REG] Invalid or expired verification token provided: {verification_token_from_url[:10]}...")
        return {"error": "Invalid or expired verification token."}, 400

    @staticmethod
    def complete_registration_step2_profile(data):
        temp_token = data.get('tempAuthToken')
        user, error_response, status_code = AuthController._validate_temp_auth_token(temp_token, purpose="REGISTRATION_MULTI_STEP")
        if error_response:
            return error_response, status_code

        username = data.get('username')
        date_of_birth_str = data.get('dateOfBirth') # Expected format: YYYY-MM-DD
        country = data.get('country')

        if not username or not date_of_birth_str or not country:
            logger.warning(f"[REG_STEP2_PROFILE] Missing required fields for user {user.email}. Username: {username}, DOB: {date_of_birth_str}, Country: {country}")
            return {"error": "Username, Date of Birth, and Country are required."}, 400
        
        # Validate username uniqueness (ensure it's not taken by another *active* user, or any user if being strict)
        existing_user_with_username = User.query.filter(User.username == username, User.id != user.id).first()
        if existing_user_with_username:
            logger.warning(f"[REG_STEP2_PROFILE] Username '{username}' already taken by user ID {existing_user_with_username.id}.")
            return {"error": "Username already taken. Please choose a different one."}, 409

        try:
            date_of_birth_obj = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
        except ValueError:
            logger.warning(f"[REG_STEP2_PROFILE] Invalid dateOfBirth format for user {user.email}: {date_of_birth_str}")
            return {"error": "Invalid Date of Birth format. Use YYYY-MM-DD."}, 400
        
        # Age validation (16+)
        today = datetime.today().date()
        age = today.year - date_of_birth_obj.year - ((today.month, today.day) < (date_of_birth_obj.month, date_of_birth_obj.day))
        if age < 16:
            logger.warning(f"[REG_STEP2_PROFILE] User {user.email} age {age} is less than 16.")
            return {"error": "You must be at least 16 years old to register."}, 400


        user.username = username # Set the actual username
        user.name = data.get('name', user.name) # Optional name field
        user.date_of_birth = date_of_birth_obj
        user.country = country
        user.gender = data.get('gender')
        user.region = data.get('region') 
        # user.city = data.get('city') # Assuming 'city' is part of 'location' field or separate
        user.location = data.get('city', data.get('location')) # Use city if provided, else location
        user.company = data.get('company')
        user.occupation = data.get('occupation')
        
        # --- FINALIZATION LOGIC (MOVED FROM STEP 4) ---
        # Activate the user and ensure email is marked as verified
        user.is_active = True
        user.email_verified = True  # Ensure this is set for complete registration

        # Award XP for completing registration
        award_xp(user.id, 25, "REGISTRATION_COMPLETED")

        # Award XP for profile completion fields
        profile_xp = calculate_profile_completion_xp(user.to_dict())
        if profile_xp > 0:
            award_xp(user.id, profile_xp, "PROFILE_COMPLETION")

        # Process referral code if provided during registration
        referral_result = None
        referral_code = user.pending_referral_code  # Get from user's stored referral code
        if referral_code:
            try:
                from .referral_controller import ReferralController
                referral_result = ReferralController.process_signup(user, referral_code)
                if referral_result.get('success'):
                    logger.info(f"[REG_STEP2_PROFILE] Referral processed successfully for user {user.id}")
                    # Clear the pending referral code after successful processing
                    user.pending_referral_code = None
                else:
                    logger.warning(f"[REG_STEP2_PROFILE] Referral processing failed: {referral_result.get('error')}")
            except Exception as e:
                logger.error(f"[REG_STEP2_PROFILE] Error processing referral: {e}")

        logger.info(f"[REG_STEP2_PROFILE] User {user.id} ({user.email}) successfully activated and registration completed.")

        # Social IDs (discord_id, x_id, google_id, meta_id) would typically be set 
        # by their respective OAuth callback handlers, not directly in this payload,
        # unless frontend is collecting them manually (not recommended for provider IDs).
        # Example: if Discord was linked, its callback would update user.discord_id.

        try:
            db.session.commit()
            logger.info(f"[REG_STEP2_PROFILE] Profile data saved for user {user.email} (ID: {user.id}). Username: {user.username}")
            
            # Only invalidate the temp token AFTER successful commit
            temp_auth_token_obj = TempAuthToken.query.filter_by(token=temp_token, user_id=user.id).first()
            if temp_auth_token_obj:
                temp_auth_token_obj.is_used = True
                db.session.commit()
            
            # Generate final authentication token
            final_jwt_token = AuthController.generate_token(user_id=user.id, role=user.role)
            
            return {
                'message': 'Registration complete! Your account is now active.',
                'token': final_jwt_token,
                'user': user.to_dict()
            }, 200
        except IntegrityError as ie:
            db.session.rollback()
            logger.error(f"[REG_STEP2_PROFILE] IntegrityError saving profile for {user.email}: {str(ie)}", exc_info=True)
            if "UNIQUE constraint failed: users.username" in str(ie) or "Duplicate entry" in str(ie) and "for key 'users.username'" in str(ie):
                 return {"error": "Username already taken. Please choose a different one (race condition)."}, 409
            return {"error": "Database error updating profile.", "details": str(ie)}, 500
        except Exception as e:
            db.session.rollback()
            logger.error(f"[REG_STEP2_PROFILE] Exception saving profile for {user.email}: {str(e)}", exc_info=True)
            return {"error": "An unexpected error occurred while saving profile information.", "details": str(e)}, 500
            
    @staticmethod
    def complete_registration_step3_tags(data):
        temp_token = data.get('tempAuthToken')
        user, error_response, status_code = AuthController._validate_temp_auth_token(temp_token, purpose="REGISTRATION_MULTI_STEP")
        if error_response:
            return error_response, status_code

        try:
            interests = data.get('interests', [])
            owned_devices = data.get('owned_devices', [])
            memberships = data.get('memberships', [])

            # Basic validation: ensure they are lists
            if not isinstance(interests, list) or \
               not isinstance(owned_devices, list) or \
               not isinstance(memberships, list):
                logger.warning(f"[REG_STEP3_TAGS] Invalid tag data format for user {user.email}. Not lists.")
                return {"error": "Invalid format for tag data. Expected lists."}, 400

            # Further validation can be added here to check if tag IDs/names are valid against ProfileTag model
            # For now, we directly assign assuming frontend sends appropriate identifiers.
            user.interests = interests
            user.owned_devices = owned_devices
            user.memberships = memberships

            # Initialize tracking field if needed
            if user.xp_profile_completion is None:
                user.xp_profile_completion = {}

            # Award XP for adding tags (50 XP per tag selected)
            total_tags_selected = len(interests or []) + len(owned_devices or []) + len(memberships or [])
            
            if total_tags_selected > 0:
                xp_award_amount = total_tags_selected * 50  # 50 XP per tag
                activity_description = "PROFILE_TAGS_ADDED_REGISTRATION"
                award_xp_result = award_xp(user.id, xp_award_amount, activity_description)
                if award_xp_result.get('error'):
                    logger.error(f"[REG_STEP3_TAGS] Failed to award XP for tags to user {user.email}: {award_xp_result['error']}")
                else:
                    logger.info(f"[REG_STEP3_TAGS] Awarded {xp_award_amount} XP to user {user.email} for adding {total_tags_selected} tags during registration.")

                # Mark XP as claimed for tags (track total count to prevent duplicate awards)
                if not user.xp_profile_completion.get('tags_initial_count'):
                    user.xp_profile_completion['tags_initial_count'] = total_tags_selected


            db.session.add(user)
            db.session.commit()
            logger.info(f"[REG_STEP3_TAGS] Tags saved for user {user.email} (ID: {user.id}).")
            
            return {"message": "Tags saved successfully."}, 200

        except Exception as e:
            db.session.rollback()
            logger.error(f"[REG_STEP3_TAGS] Exception saving tags for user {user.email}: {str(e)}", exc_info=True)
            return {"error": "An unexpected error occurred while saving tags.", "details": str(e)}, 500

    @staticmethod
    def _send_password_reset_email(user_email, token):
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/reset-password?token={token}"
        
        logger.info(f"====== PASSWORD RESET EMAIL (SIMULATED) ======")
        logger.info(f"To: {user_email}")
        logger.info(f"Subject: Reset Your Password")
        logger.info(f"Body: Please click the following link to reset your password: {reset_link}")
        logger.info(f"Link is valid for 1 hour.")
        logger.info(f"==============================================")
        return True

    @staticmethod
    def forgot_password_initiate_email(data):
        email = data.get('email')
        user = User.query.filter_by(email=email).first()

        if user and user.is_active:
            token = secrets.token_urlsafe(32)
            user.password_reset_token = token
            user.password_reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
            try:
                db.session.commit()
                if AuthController._send_password_reset_email(user.email, token):
                    logger.info(f"[FORGOT_PWD_EMAIL] Password reset email initiated for {email}")
                    return {"message": "Password reset email sent. Please check your inbox."}, 200
                else:
                    logger.error(f"[FORGOT_PWD_EMAIL] Failed to send password reset email for {email}")
                    return {"message": "If your email is registered, you will receive a password reset link." }, 200
            except Exception as e:
                db.session.rollback()
                logger.error(f"[FORGOT_PWD_EMAIL] Error initiating password reset for {email}: {e}", exc_info=True)
                return {"error": "Could not process password reset request."}, 500
        
        logger.warning(f"[FORGOT_PWD_EMAIL] Attempt to reset password for non-existent or inactive user: {email}")
        return {"message": "If your email is registered and active, you will receive a password reset link shortly."}, 200

    @staticmethod
    def forgot_password_verify_questions(data):
        logger.info("[AUTH_CTRL] Attempting password recovery via security questions.")
        email = data.get('email')
        submitted_answers_list = data.get('answers') # Expected: [{question_id: "1", answer: "..."}, ...]

        if not email or not submitted_answers_list:
            return {"error": "Email and answers are required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user:
            logger.warning(f"[FORGOT_PW_SQ] User not found for email: {email}")
            return {"error": "Invalid email or answers"}, 404 # Generic error for security

        if not user.security_questions or not isinstance(user.security_questions, list) or not user.is_active:
            logger.warning(f"[FORGOT_PW_SQ] User {email} has no security questions set up or is inactive.")
            return {"error": "Security questions not set up for this account or account inactive."}, 403

        # Create a dictionary of submitted answers for easy lookup by question_id
        submitted_answers_dict = {sa['question_id']: sa['answer'] for sa in submitted_answers_list if 'question_id' in sa and 'answer' in sa}
        
        matches_found = 0
        required_matches = len(user.security_questions) # Require all stored questions to be answered correctly
        
        if not required_matches:
            logger.warning(f"[FORGOT_PW_SQ] User {email} has an empty list of security_questions.")
            return {"error": "Security questions configuration error for this account."}, 403

        for stored_q_data in user.security_questions:
            question_id = stored_q_data.get('question_id')
            stored_answer_hash = stored_q_data.get('answer_hash')
            
            submitted_answer_text = submitted_answers_dict.get(str(question_id)) # Ensure question_id is string if stored as such
            
            if submitted_answer_text and stored_answer_hash:
                if check_password_hash(stored_answer_hash, submitted_answer_text):
                    matches_found += 1
                else:
                    logger.warning(f"[FORGOT_PW_SQ] Answer mismatch for user {email}, question_id {question_id}")
                    # Optionally, break here or continue to see if other answers match for logging, but ultimately fail
            else:
                logger.warning(f"[FORGOT_PW_SQ] Submitted answer not found for question_id {question_id} or stored hash missing for user {email}")

        if matches_found == required_matches and required_matches > 0:
            logger.info(f"[FORGOT_PW_SQ] Security questions verified for user {email}.")
            # Generate a short-lived password reset token
            reset_token_obj = PasswordResetToken.generate(user_id=user.id)
            
            # No email is sent here, token is returned directly as per plan for Q/A method
            return {
                "message": "Security questions verified. Use the provided token to reset your password.",
                "reset_token": reset_token_obj.token
            }, 200
        else:
            logger.warning(f"[FORGOT_PW_SQ] Security questions verification failed for user {email}. Matches: {matches_found}/{required_matches}")
            return {"error": "Invalid email or answers"}, 401

    @staticmethod
    def forgot_password_verify_passkey(data):
        logger.info("[AUTH_CTRL] Attempting password recovery via passkey.")
        email = data.get('email')
        passkey_provided = data.get('passkey')

        if not email or not passkey_provided:
            return {"error": "Email and passkey are required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user:
            logger.warning(f"[FORGOT_PW_PK] User not found for email: {email}")
            return {"error": "Invalid email or passkey"}, 404 # Generic error for security

        if not user.passkeys or not isinstance(user.passkeys, list) or not user.is_active:
            logger.warning(f"[FORGOT_PW_PK] User {email} has no passkeys set up or is inactive.")
            return {"error": "Passkeys not set up for this account or account inactive."}, 403

        passkey_found_and_valid = False
        updated_passkeys_list = list(user.passkeys) # Create a mutable copy
        passkey_to_invalidate_index = -1

        for index, pk_data in enumerate(updated_passkeys_list):
            stored_key_hash = pk_data.get('key_hash')
            is_used = pk_data.get('used', False)

            if stored_key_hash and not is_used:
                if check_password_hash(stored_key_hash, passkey_provided):
                    passkey_found_and_valid = True
                    passkey_to_invalidate_index = index
                    break # Found a valid, unused passkey
        
        if passkey_found_and_valid and passkey_to_invalidate_index != -1:
            logger.info(f"[FORGOT_PW_PK] Passkey verified for user {email}.")
            
            # Mark the passkey as used
            updated_passkeys_list[passkey_to_invalidate_index]['used'] = True
            user.passkeys = updated_passkeys_list # Assign the modified list back
            
            # Generate a short-lived password reset token
            reset_token_obj = PasswordResetToken.generate(user_id=user.id)
            try:
                db.session.commit()
                logger.info(f"[FORGOT_PW_PK] Passkey marked as used for user {email}.")
                return {
                    "message": "Passkey verified. Use the provided token to reset your password.",
                    "reset_token": reset_token_obj.token
                }, 200
            except Exception as e:
                db.session.rollback()
                logger.error(f"[FORGOT_PW_PK] Error updating passkey status for user {email}: {e}", exc_info=True)
                return {"error": "Failed to process passkey. Please try again."}, 500
        else:
            logger.warning(f"[FORGOT_PW_PK] Passkey verification failed for user {email}.")
            return {"error": "Invalid email or passkey"}, 401

    @staticmethod
    def login_with_passkey(data):
        """Authenticate a user using a single-use passkey."""
        logger.info("[AUTH_CTRL] Attempting login via passkey.")
        email = data.get('email')
        passkey_provided = data.get('passkey')

        if not email or not passkey_provided:
            return {"error": "Email and passkey are required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user or not user.is_active:
            logger.warning(f"[PASSKEY_LOGIN] User not found or inactive: {email}")
            return {"error": "Invalid email or passkey"}, 401

        if not user.passkeys or not isinstance(user.passkeys, list):
            logger.warning(f"[PASSKEY_LOGIN] No passkeys configured for user {email}.")
            return {"error": "Passkey login not available for this account."}, 403

        updated_passkeys = list(user.passkeys)
        matched_index = -1
        for idx, pk_data in enumerate(updated_passkeys):
            stored_hash = pk_data.get('key_hash')
            used = pk_data.get('used', False)
            if stored_hash and not used and check_password_hash(stored_hash, passkey_provided):
                matched_index = idx
                break

        if matched_index == -1:
            logger.warning(f"[PASSKEY_LOGIN] Invalid passkey for user {email}.")
            return {"error": "Invalid email or passkey"}, 401

        updated_passkeys[matched_index]['used'] = True
        user.passkeys = updated_passkeys

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"[PASSKEY_LOGIN] Error updating passkey for {email}: {e}", exc_info=True)
            return {"error": "Failed to process passkey"}, 500

        token = AuthController.generate_token(user_id=user.id, role=user.role)
        user_data = user.to_dict()
        user_data['role_assigned'] = user.role

        logger.info(f"[PASSKEY_LOGIN] Login successful for {email}")
        return {
            'token': token,
            'user': user_data,
            'role': user.role,
            'message': 'Login successful'
        }, 200

    @staticmethod
    def reset_password_with_token(data):
        token = data.get('token')
        new_password = data.get('new_password')

        if not token or not new_password:
            return {"error": "Token and new password are required."}, 400
        
        if len(new_password) < 8:
             return {"error": "Password must be at least 8 characters long."}, 400

        user = User.query.filter_by(password_reset_token=token).first()

        if not user:
            logger.warning(f"[RESET_PWD] Invalid reset token used: {token[:10]}...")
            return {"error": "Invalid or expired password reset token."}, 400
        
        if user.password_reset_token_expires_at < datetime.utcnow():
            logger.warning(f"[RESET_PWD] Expired reset token used for user {user.email}. Token: {token[:10]}...")
            user.password_reset_token = None
            user.password_reset_token_expires_at = None
            db.session.commit()
            return {"error": "Password reset token has expired."}, 400

        user.set_password(new_password)
        user.password_reset_token = None
        user.password_reset_token_expires_at = None
        
        try:
            db.session.commit()
            logger.info(f"[RESET_PWD] Password reset successful for user {user.email}")
            return {"message": "Password has been reset successfully."}, 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"[RESET_PWD] DB error during password reset for user {user.email}: {e}", exc_info=True)
            return {"error": "Failed to reset password."}, 500

    @staticmethod
    def complete_registration_step4_security(data):
        logger.info(f"[AUTH_CTRL] Attempting to complete registration step 4: Security Setup for temp_token: {data.get('tempAuthToken')}")
        temp_token_value = data.get('tempAuthToken')
        
        user, error_response, status_code = AuthController._validate_temp_auth_token(temp_token_value, purpose="REGISTRATION_MULTI_STEP")
        if error_response:
            return error_response, status_code

        logger.info(f"[AUTH_CTRL] Step 4: Temp token validated for user ID: {user.id}, Email: {user.email}")

        try:
            # Security Questions
            security_questions_data = data.get('security_questions') # Expects [{question_id: "...", answer: "..."}, ...]
            if security_questions_data and isinstance(security_questions_data, list):
                hashed_questions = []
                for q_data in security_questions_data:
                    question_id = q_data.get('question_id')
                    answer = q_data.get('answer')
                    if question_id and answer: # Ensure both are present
                        hashed_answer = generate_password_hash(answer)
                        # Storing question_id, not question_text, to align with recovery logic
                        hashed_questions.append({'question_id': str(question_id), 'answer_hash': hashed_answer})
                if hashed_questions: # Only assign if valid questions were processed
                    user.security_questions = hashed_questions
                    logger.info(f"[AUTH_CTRL] Step 4: Security questions set for user {user.id}")

            # Passkeys (Recovery Keys)
            passkeys_data = data.get('passkeys') # Expects a list of plain passkeys
            if passkeys_data and isinstance(passkeys_data, list) and len(passkeys_data) > 0:
                hashed_passkeys = []
                for pk_raw in passkeys_data:
                    if pk_raw and isinstance(pk_raw, str) and pk_raw.strip(): # Ensure it's a non-empty string
                        hashed_passkeys.append({'key_hash': generate_password_hash(pk_raw), 'used': False, 'created_at': datetime.utcnow().isoformat()})
                if hashed_passkeys:
                    user.passkeys = hashed_passkeys
                    logger.info(f"[AUTH_CTRL] Step 4: Passkeys stored for user {user.id}")
                else:
                    user.passkeys = None
            else:
                user.passkeys = None

            # Handle tags from the payload
            interests = data.get('interests', [])
            owned_devices = data.get('owned_devices', [])
            memberships = data.get('memberships', [])
            
            if isinstance(interests, list) and isinstance(owned_devices, list) and isinstance(memberships, list):
                user.interests = interests
                user.owned_devices = owned_devices
                user.memberships = memberships
                logger.info(f"[AUTH_CTRL] Step 4: Tags data included and processed for user {user.id}")
                # Award XP if tags were added
                if interests or owned_devices or memberships:
                    award_xp(
                        user.id, 
                        points=10, 
                        activity_type='PROFILE_TAGS_ADDED_REGISTRATION'
                    )
                    logger.info(f"[AUTH_CTRL] Step 4: Awarded 10 XP for tags for user {user.id}")
            else:
                logger.warning(f"[AUTH_CTRL] Step 4: Tags data was present but in an invalid format for user {user.id}")


            user.is_active = True # Activate the user
            # user.email_verified = True # Should already be true from step 1 bypass

            # Invalidate the TempAuthToken
            temp_auth_token_obj = TempAuthToken.query.filter_by(token=temp_token_value, user_id=user.id).first()
            if temp_auth_token_obj:
                temp_auth_token_obj.is_used = True
                # Optionally, db.session.delete(temp_auth_token_obj) if you prefer to remove used tokens
            
            # Award XP for completing registration (e.g., final step bonus)
            xp_award_amount_final = 25 
            activity_description_final = "REGISTRATION_COMPLETED"
            award_xp_result_final = award_xp(user.id, xp_award_amount_final, activity_description_final)
            if award_xp_result_final.get('error'):
                logger.error(f"[AUTH_CTRL] Step 4: Failed to award final registration XP to user {user.email}: {award_xp_result_final['error']}")
            else:
                logger.info(f"[AUTH_CTRL] Step 4: Awarded {xp_award_amount_final} XP to user {user.email} for completing registration.")


            db.session.commit()
            logger.info(f"[AUTH_CTRL] User {user.id} ({user.email}) successfully activated and registration step 4 completed.")

            # Generate main authentication token
            main_auth_token_payload = {'user_id': user.id, 'role': user.role}
            # If business_admin, include business_id
            if user.role == 'business_admin' and user.business_id:
                main_auth_token_payload['business_id'] = user.business_id
                
            # Generate token using the class method that handles payload structure
            final_jwt_token = AuthController.generate_token(user_id=user.id, role=user.role) # Simpler call
            
            logger.info(f"[AUTH_CTRL] Final JWT generated for user {user.id}")
            
            user_data_for_response = user.to_dict() # Assuming to_dict is safe and doesn't expose password_hash etc.
            
            return {
                'message': 'Registration complete! Your account is now active.',
                'token': final_jwt_token, # Use the generated token
                'user': user_data_for_response
            }, 200

        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"[AUTH_CTRL] Step 4: IntegrityError for user {user.id if user else 'unknown'}. Error: {str(e)}", exc_info=True)
            # This should ideally not happen here if username was set and validated in Step 2.
            return {"error": "A database conflict occurred. Please try again or contact support if the issue persists."}, 409
        except Exception as e:
            db.session.rollback()
            logger.error(f"[AUTH_CTRL] Step 4: Exception for user {user.id if user else 'unknown'}. Error: {str(e)}", exc_info=True)
            return {"error": f'An unexpected error occurred: {str(e)}'}, 500

    @staticmethod
    def get_available_security_questions():
        # This should return a list of predefined questions.
        # For example:
        predefined_questions = [
            {"id": "1", "question": "What was your first pet's name?"},
            {"id": "2", "question": "What is your mother's maiden name?"},
            {"id": "3", "question": "What was the name of your elementary school?"},
            {"id": "4", "question": "In what city were you born?"},
            {"id": "5", "question": "What is your favorite book?"}
        ]
        # In a real application, these might come from a config file or a database table.
        return jsonify(predefined_questions), 200

    @staticmethod
    def get_security_questions_for_email(data):
        """Fetch security questions for a user by email for password recovery"""
        logger.info("[AUTH_CTRL] Fetching security questions for password recovery.")
        email = data.get('email')

        if not email:
            return {"error": "Email is required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user:
            logger.warning(f"[GET_SEC_Q] User not found for email: {email}")
            # Return generic message for security
            return {"error": "No security questions found for this email, or email does not exist."}, 404

        if not user.security_questions or not isinstance(user.security_questions, list) or not user.is_active:
            logger.warning(f"[GET_SEC_Q] User {email} has no security questions set up or is inactive.")
            return {"error": "No security questions found for this email, or email does not exist."}, 404

        # Get available questions to map question IDs to question text
        predefined_questions = {
            "1": "What was your first pet's name?",
            "2": "What is your mother's maiden name?",
            "3": "What was the name of your elementary school?",
            "4": "In what city were you born?",
            "5": "What is your favorite book?"
        }

        # Extract question text for user's security questions
        user_questions = []
        for stored_q_data in user.security_questions:
            question_id = stored_q_data.get('question_id')
            if question_id and str(question_id) in predefined_questions:
                user_questions.append({
                    "question_id": question_id,
                    "question_text": predefined_questions[str(question_id)]
                })

        if not user_questions:
            logger.warning(f"[GET_SEC_Q] User {email} has security questions but none match predefined questions.")
            return {"error": "No security questions found for this email, or email does not exist."}, 404

        logger.info(f"[GET_SEC_Q] Found {len(user_questions)} security questions for user {email}")
        return {"questions": user_questions}, 200

    @staticmethod
    def setup_mfa(data):
        logger.info(f"[AUTH_CTRL] Initiating MFA setup.")
        
        user = None
        # Determine if this is during registration (via tempAuthToken) or for an existing logged-in user
        temp_token_value = data.get('tempAuthToken')
        if temp_token_value:
            user_candidate, error_response, status_code = AuthController._validate_temp_auth_token(temp_token_value, purpose="REGISTRATION_MULTI_STEP")
            if error_response:
                logger.warning(f"[AUTH_CTRL] MFA Setup: Invalid or expired temp auth token: {temp_token_value}")
                return jsonify(error_response), status_code # Use jsonify here for blueprint context
            user = user_candidate
            logger.info(f"[AUTH_CTRL] MFA Setup: Temp token validated for registration flow user ID: {user.id}")
        elif hasattr(g, 'current_user') and g.current_user:
            user = User.query.get(g.current_user.id) # Fetch full User object if g.current_user is a proxy or partial
            if not user: # Should not happen if token_required worked
                 logger.error("[AUTH_CTRL] MFA Setup: g.current_user set but User object not found in DB.")
                 return jsonify({'message': 'User not found.'}), 404
            logger.info(f"[AUTH_CTRL] MFA Setup: Initiated by logged-in user ID: {user.id}")
        else:
            logger.warning("[AUTH_CTRL] MFA Setup: No tempAuthToken and no logged-in user session found.")
            return jsonify({'message': 'Authentication required to set up MFA.'}), 401


        if not pyotp or not qrcode or not base64 or not io:
            logger.error("[AUTH_CTRL] MFA Setup: pyotp or qrcode library not available.")
            return jsonify({'message': 'MFA functionality is currently unavailable.'}), 503
        
        mfa_secret = pyotp.random_base32()
        issuer_name = current_app.config.get("MFA_ISSUER_NAME", "Eclipseer Survey")
        provisioning_uri = pyotp.totp.TOTP(mfa_secret).provisioning_uri(
            name=user.email,
            issuer_name=issuer_name
        )
        
        img = qrcode.make(provisioning_uri)
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        qr_code_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        logger.info(f"[AUTH_CTRL] MFA secret and QR code generated for user {user.id}. Secret (first 5 chars): {mfa_secret[:5]}...")
        
        # For registration flow, frontend will hold this secret and send it back in Step 4.
        # For logged-in user, if they don't verify immediately, this secret might be lost unless stored temporarily (e.g., session).
        # Best is for frontend to immediately proceed to verification.
        return jsonify({
            'message': 'MFA setup initiated. Scan QR or enter secret.',
            'mfa_secret': mfa_secret, 
            'qr_code_data_url': f'data:image/png;base64,{qr_code_base64}',
            # 'provisioning_uri': provisioning_uri # Optional for client
        }), 200

    @staticmethod
    def verify_mfa_setup(data):
        logger.info(f"[AUTH_CTRL] Verifying MFA setup code.")
        mfa_code = data.get('mfaCode') # Corrected from 'mfa_code' to match frontend user request
        mfa_secret_from_frontend = data.get('mfaSecret') # Corrected from 'mfa_secret'

        if not mfa_code or not mfa_secret_from_frontend:
            logger.warning("[AUTH_CTRL] MFA Verify: mfaCode or mfaSecret missing from request.")
            return jsonify({"error": "MFA code and secret are required."}), 400

        user = None
        temp_token_value = data.get('tempAuthToken')
        if temp_token_value:
            user_candidate, error_response, status_code = AuthController._validate_temp_auth_token(temp_token_value, purpose="REGISTRATION_MULTI_STEP")
            if error_response:
                logger.warning(f"[AUTH_CTRL] MFA Verify: Invalid temp_token: {temp_token_value}")
                return jsonify(error_response), status_code
            user = user_candidate
            logger.info(f"[AUTH_CTRL] MFA Verify: Temp token validated for registration flow user ID: {user.id if user else 'None'}")
        elif hasattr(g, 'current_user') and g.current_user:
            user = User.query.get(g.current_user.id)
            if not user:
                 logger.error("[AUTH_CTRL] MFA Verify: g.current_user set but User object not found in DB.")
                 return jsonify({'message': 'User not found.'}), 404
            logger.info(f"[AUTH_CTRL] MFA Verify: Initiated by logged-in user ID: {user.id}")
        else:
            logger.warning("[AUTH_CTRL] MFA Verify: No tempAuthToken and no logged-in user session found.")
            return jsonify({"error": "Authentication required."}), 401
        
        if not pyotp:
            logger.error("[AUTH_CTRL] MFA Verify: pyotp library not available.")
            return jsonify({"error": "MFA functionality is currently unavailable."}), 500

        totp = pyotp.TOTP(mfa_secret_from_frontend)
        if totp.verify(mfa_code):
            # For registration flow (temp_token_value is present):
            #   The frontend now knows the (mfa_secret, mfa_code) pair is valid.
            #   It will send mfa_secret and mfa_enabled=true in the final Step 4 /complete payload.
            # For logged-in user enabling MFA (temp_token_value is NOT present):
            #   This is where we would persist the mfa_secret and mfa_enabled=True.
            if not temp_token_value and user: # Logged-in user flow
                user.mfa_secret = mfa_secret_from_frontend # Store encrypted if necessary
            # Do not save mfa_secret or enable mfa_enabled here.
            # This endpoint only VERIFIES the code.
            # The actual enabling and storing of the secret should happen in:
            # 1. complete_registration_step4_security (if during registration)
            # 2. A dedicated user profile update endpoint for enabling MFA post-registration.
            logger.info(f"[AUTH_CTRL] MFA code verified successfully for user {user.id} (or prospective user).")
            return jsonify({"message": "MFA code verified successfully. Proceed to save settings."}), 200
        else:
            logger.warning(f"[AUTH_CTRL] MFA Verify: Invalid MFA code for user {user.id} (or prospective user).")
            return jsonify({"error": "Invalid MFA code."}), 400

    @staticmethod
    def set_security_questions_for_registration(data):
        logger.info(f"[AUTH_CTRL] Setting security questions during registration.")
        temp_token_value = data.get('tempAuthToken')
        questions_data = data.get('security_questions')

        if not questions_data or not isinstance(questions_data, list) or len(questions_data) == 0:
            return jsonify({"error": "Security questions data is missing or invalid."}), 400

        user, error_response, status_code = AuthController._validate_temp_auth_token(temp_token_value)
        if error_response:
            return error_response, status_code
        
        logger.info(f"[AUTH_CTRL] Set SecQ: Temp token validated for user ID: {user.id}")

        # This method is part of the registration flow (Step 4).
        # The actual saving will happen in `complete_registration_step4_security`.
        # This endpoint can be used by the frontend to validate structure or choices if needed,
        # but primarily the data is collected and sent to the final Step 4 endpoint.
        # For now, we just acknowledge receipt if token is valid.
        # The frontend will bundle this data with other Step 4 data.
        
        # Example validation (can be expanded):
        for q_data in questions_data:
            if not q_data.get('question_id') and not q_data.get('question'):
                return jsonify({"error": "Each security question must have an identifier."}), 400
            if not q_data.get('answer'):
                return jsonify({"error": "Each security question must have an answer."}), 400
        
        logger.info(f"[AUTH_CTRL] Security questions data received for user {user.id} to be finalized in step 4.")
        return jsonify({"message": "Security questions data received. Proceed to final registration step."}), 200
        
    @staticmethod
    def generate_passkeys_for_registration(data):
        logger.info(f"[AUTH_CTRL] Generating passkeys for registration.")
        temp_token_value = data.get('tempAuthToken')

        user, error_response, status_code = AuthController._validate_temp_auth_token(temp_token_value)
        if error_response:
            return error_response, status_code
        
        logger.info(f"[AUTH_CTRL] Gen Passkeys: Temp token validated for user ID: {user.id}")

        # Generate, e.g., 10 passkeys
        num_passkeys = data.get('count', 10)
        passkeys = [str(uuid.uuid4()) for _ in range(num_passkeys)] # Plain text passkeys
        
        # Passkeys are returned to the user to save.
        # Hashed versions will be stored ONLY when the user confirms and submits them
        # as part of complete_registration_step4_security.
        logger.info(f"[AUTH_CTRL] Generated {len(passkeys)} passkeys for user {user.id} to save.")
        return jsonify({"passkeys": passkeys, "message": "Please save these passkeys securely. They will be stored once you complete registration."}), 200

    # --- New method for disabling MFA ---
    @staticmethod
    def disable_mfa_for_user(user_id, data):
        user = User.query.get(user_id)
        if not user:
            logger.warning(f"[DISABLE_MFA] User not found: {user_id}")
            return {"error": "User not found"}, 404

        if not user.mfa_enabled:
            logger.info(f"[DISABLE_MFA] MFA already disabled for user {user.id}")
            return {"message": "MFA is already disabled."}, 200

        current_password = data.get('password')
        mfa_code_provided = data.get('mfa_code') # Optional: user might provide current MFA code instead of password

        if mfa_code_provided and pyotp and user.mfa_secret:
            # IMPORTANT: mfa_secret would need to be decrypted here if stored encrypted
            totp = pyotp.TOTP(user.mfa_secret) 
            if not totp.verify(mfa_code_provided):
                logger.warning(f"[DISABLE_MFA] Invalid MFA code for user {user.id}")
                # Fall through to check password if MFA code is wrong, or return error immediately
                # return {"error": "Invalid MFA code provided."}, 401 
        elif not current_password or not user.check_password(current_password):
            logger.warning(f"[DISABLE_MFA] Invalid password for user {user.id}")
            return {"error": "Invalid password or MFA code provided."}, 401
        
        # If we reach here, either password was correct, or MFA code was correct (if that path was taken and not returned early)
        # For simplicity, let's assume password check is the primary mechanism if MFA code wasn't primary / failed silently
        if not (user.check_password(current_password) if current_password else False):
             # Re-check password if mfa_code path was attempted but didn't authenticate
            if not (mfa_code_provided and pyotp and user.mfa_secret and pyotp.TOTP(user.mfa_secret).verify(mfa_code_provided)):
                 logger.warning(f"[DISABLE_MFA] Final auth check failed for user {user.id}")
                 return {"error": "Invalid credentials provided."}, 401


        user.mfa_enabled = False
        user.mfa_secret = None # Clear the secret (should be cleared after decryption if encrypted)
        try:
            db.session.commit()
            logger.info(f"[DISABLE_MFA] MFA disabled for user {user.id}")
            return {"message": "MFA disabled successfully."}, 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"[DISABLE_MFA] Error disabling MFA for user {user.id}: {e}", exc_info=True)
            return {"error": "Failed to disable MFA."}, 500

    @staticmethod
    def send_otp_email(data):
        """
        Expects JSON payload: { "email": "user@example.com" }
        Generates a 6-digit PIN, saves it to OneTimePIN for that user (creating the User row if necessary),
        emails the PIN, and returns a JSON response.
        """
        email = data.get('email')
        if not email:
            return {"error": "Email is required"}, 400

        # 1) Look up the User by email. If no user exists, create an inactive user stub.
        user = User.query.filter_by(email=email).first()
        if not user:
            # Create a new user stub with email_verified False and is_active False.
            # This path is usually for things like "subscribe without account" or first step of a new flow.
            # For registration, `initiate_registration_step1` should have already created the user.
            try:
                user = User(
                    email=email,
                    username=f"{email.split('@')[0]}_{secrets.token_hex(4)}",  # Ensure username is unique
                    email_verified=False,
                    is_active=False
                    # No password is set here.
                )
                db.session.add(user)
                db.session.flush()  # flush to get user.id
            except IntegrityError:
                db.session.rollback()
                # This can happen if the generated username collides, though unlikely.
                # Or if email was added by another thread. We re-query.
                user = User.query.filter_by(email=email).first()
                if not user: # If still no user, something is wrong.
                    return {"error": "Could not create or find user for this email."}, 500
        
        # 2) Invalidate any previous unused OTPs for this user
        OneTimePIN.query.filter_by(user_id=user.id, is_used=False).update({"is_used": True})


        # 3) Generate and persist a new PIN (expires in 5 minutes)
        otp_obj = OneTimePIN.generate(user_id=user.id, validity_seconds=300)
        

        # 4) Send the email via Flask-Mail
        try:
            msg = Message(
                subject="Your One-Time Verification PIN",
                recipients=[email]
            )
            msg.body = (
                f"Hello,\n\n"
                f"Your verification PIN is: {otp_obj.pin}\n\n"
                f"This PIN will expire in 5 minutes. "
                f"If you did not request this, please ignore this email.\n\n"
                f"Thank you,\n"
                f"The GalvanAI Team"
            )
            mail.send(msg)
        except Exception as e:
            # If sending fails, clean up the OTP entry we just added
            db.session.rollback() # Rollback the OTP creation
            current_app.logger.error(f"[SEND_OTP_EMAIL] Failed to send OTP to {email}: {e}", exc_info=True)
            return {"error": "Failed to send OTP email. Please try again."}, 500

        db.session.commit()  # commit the new user (if created) and new PIN
        return {"message": "OTP sent successfully", "email": email}, 200

    @staticmethod
    def verify_otp_email(data):
        """
        Expects JSON payload: { "email": "user@example.com", "pin": "123456" }
        Looks up the OneTimePIN row, checks validity, marks it as used, then marks user.email_verified = True.
        """
        email = data.get('email')
        pin = data.get('pin')
        if not email or not pin:
            return {"error": "Both email and PIN are required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return {"error": "No such user found"}, 404

        # Find the OTP row that matches user_id & pin, and is still valid
        otp_obj = OneTimePIN.query.filter_by(user_id=user.id, pin=pin, is_used=False).first()
        
        if not otp_obj:
             return {"error": "Invalid PIN provided."}, 400 # Generic to avoid PIN guessing
        
        if not otp_obj.is_valid():
            return {"error": "Invalid or expired PIN"}, 400

        # Mark this PIN as used
        otp_obj.is_used = True

        # Mark user as verified (and—you can choose to activate them now if appropriate)
        user.email_verified = True
        # Registration flow will handle activating the user at the right step.
        # user.is_active = True

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[VERIFY_OTP_EMAIL] DB commit failed for {email}: {e}", exc_info=True)
            return {"error": "Failed to verify PIN. Please try again."}, 500

        return {"message": "Email verified successfully", "email": email}, 200

    @staticmethod
    def verify_mfa_login(data):
        """
        Verify MFA code during login and complete authentication
        Expects: { "email": "user@example.com", "pin": "123456" }
        """
        email = data.get('email')
        pin = data.get('pin')
        
        if not email or not pin:
            return {"error": "Email and PIN are required"}, 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return {"error": "User not found"}, 404

        # Verify the OTP
        otp_obj = OneTimePIN.query.filter_by(user_id=user.id, pin=pin, is_used=False).first()
        
        if not otp_obj or not otp_obj.is_valid():
            return {"error": "Invalid or expired PIN"}, 400

        # Mark PIN as used
        otp_obj.is_used = True

        try:
            db.session.commit()
            
            # Business admins always get full login access regardless of profile completion
            if user.role == 'business_admin':
                logger.info(f"[AUTH_MFA_LOGIN] Business admin {user.email} MFA login - skipping profile completion checks")
                token = AuthController.generate_token(
                    user_id=user.id,
                    role=user.role
                )
                user_data = user.to_dict()
                user_data['role_assigned'] = user.role
                return {
                    'token': token,
                    'user': user_data,
                    'role': user.role,
                    'message': 'Login successful'
                }, 200
            
            # For regular users, check if registration is complete
            next_step = AuthController.determine_registration_next_step(user)
            if next_step != 'complete':
                temp_token_obj = TempAuthToken.generate(user_id=user.id, purpose="REGISTRATION_MULTI_STEP", expires_in_seconds=7200)
                db.session.commit()
                return {
                    'registration_incomplete': True,
                    'next_step': next_step,
                    'tempAuthToken': temp_token_obj.token,
                    'email': user.email
                }, 200
            
            # Generate authentication token for complete registrations
            token = AuthController.generate_token(
                user_id=user.id,
                role=user.role
            )
            
            user_data = user.to_dict()
            user_data['role_assigned'] = user.role
            
            logger.info(f"[AUTH_MFA_LOGIN] MFA verification successful for user {user.email}")
            
            return {
                'token': token,
                'user': user_data,
                'role': user.role,
                'message': 'Login successful'
            }, 200
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"[AUTH_MFA_LOGIN] Error completing MFA login for {email}: {e}", exc_info=True)
            return {"error": "Failed to complete login. Please try again."}, 500

    @staticmethod
    def accept_legal_terms(user_id):
        """Accept all legal terms for a user (business admin first login)"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}, 404

            user.has_accepted_legal_terms = True
            user.legal_terms_accepted_at = datetime.utcnow()
            db.session.commit()

            logger.info(f"[LEGAL_TERMS] User {user.email} accepted legal terms at {user.legal_terms_accepted_at}")
            return {"message": "Legal terms accepted successfully", "accepted_at": user.legal_terms_accepted_at.isoformat()}, 200

        except Exception as e:
            db.session.rollback()
            logger.error(f"[LEGAL_TERMS] Error accepting legal terms for user {user_id}: {e}", exc_info=True)
            return {"error": "Failed to accept legal terms"}, 500

    @staticmethod
    def accept_ai_policy(user_id):
        """Accept AI policy for a user (first AI feature use)"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}, 404

            user.has_seen_ai_policy = True
            user.ai_policy_accepted_at = datetime.utcnow()
            db.session.commit()

            logger.info(f"[AI_POLICY] User {user.email} accepted AI policy at {user.ai_policy_accepted_at}")
            return {"message": "AI policy accepted successfully", "accepted_at": user.ai_policy_accepted_at.isoformat()}, 200

        except Exception as e:
            db.session.rollback()
            logger.error(f"[AI_POLICY] Error accepting AI policy for user {user_id}: {e}", exc_info=True)
            return {"error": "Failed to accept AI policy"}, 500

    @staticmethod
    def get_legal_status(user_id):
        """Get user's legal acceptance status"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}, 404

            return {
                "has_accepted_legal_terms": user.has_accepted_legal_terms,
                "legal_terms_accepted_at": user.legal_terms_accepted_at.isoformat() if user.legal_terms_accepted_at else None,
                "has_seen_ai_policy": user.has_seen_ai_policy,
                "ai_policy_accepted_at": user.ai_policy_accepted_at.isoformat() if user.ai_policy_accepted_at else None
            }, 200

        except Exception as e:
            logger.error(f"[LEGAL_STATUS] Error getting legal status for user {user_id}: {e}", exc_info=True)
            return {"error": "Failed to get legal status"}, 500

# --- End new method ---

