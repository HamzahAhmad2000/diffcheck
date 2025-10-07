from flask import Blueprint, request, jsonify, redirect, current_app, session,g
from app.models import db, User, LinkedAccount
from app.controllers.auth_controller import AuthController # For token generation and _validate_temp_auth_token
from datetime import datetime, timedelta
import requests
import logging
import base64
import json
import jwt

logger = logging.getLogger(__name__)
google_bp = Blueprint('google_auth', __name__)

# Configuration keys (ensure these are in your Flask app config, loaded from .env)
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# GOOGLE_REDIRECT_URI_BACKEND (e.g., http://localhost:5000/linking/google/callback)
# JWT_SECRET_KEY (used by AuthController.generate_token)
# FRONTEND_URL (e.g., http://localhost:3000)

@google_bp.route('/linking/google/initiate', methods=['GET'])
def google_initiate_oauth():
    """
    Initiate Google OAuth flow
    """
    logger.info("[GOOGLE_OAUTH_INIT] Starting OAuth initiation")
    
    # Token is optional. If present, it's a linking flow. If not, it's a login/signup flow.
    token = request.args.get('token')
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if token:
        # This is a linking flow for an already logged-in user
        user_data = validate_token(token)
        if not user_data:
            logger.error("[GOOGLE_OAUTH_INIT] Invalid token for linking flow")
            return jsonify({"error": "Invalid authentication token"}), 401
            
        user = User.query.get(user_data['user_id'])
        if not user:
            logger.error(f"[GOOGLE_OAUTH_INIT] User not found for ID {user_data['user_id']}")
            return jsonify({"error": "User not found"}), 404
            
        g.current_user = user
        session['user_id'] = user.id
        session['auth_token'] = token
        logger.info(f"[GOOGLE_OAUTH_INIT] Authenticated linking flow for user: {user.email}")
    else:
        logger.info("[GOOGLE_OAUTH_INIT] Unauthenticated flow (Login/Signup with Google)")

    try:
        GOOGLE_CLIENT_ID = current_app.config['GOOGLE_CLIENT_ID']
        GOOGLE_REDIRECT_URI_BACKEND = current_app.config['GOOGLE_REDIRECT_URI_BACKEND']
        FRONTEND_URL = current_app.config['FRONTEND_URL']
    except KeyError as e:
        logger.error(f"[GOOGLE_OAUTH_INIT] Missing Google OAuth configuration: {str(e)}")
        return jsonify({"error": "Google OAuth not configured correctly on server."}), 500
    
    client_callback_url_after_success = request.args.get('client_callback_url', current_app.config['FRONTEND_URL'])
    session['oauth_client_callback_url'] = client_callback_url_after_success
    logger.info(f"[GOOGLE_OAUTH_INIT] Stored client_callback_url in session: {client_callback_url_after_success}")

    scope = "openid email profile"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI_BACKEND}&scope={scope}&"
        f"access_type=offline&prompt=consent"
    )
    logger.info(f"[GOOGLE_OAUTH_INIT] Redirecting to Google auth URL: {auth_url}")
    return redirect(auth_url)

def validate_token(token):
    try:
        secret_key = current_app.config['SECRET_KEY']
        data = jwt.decode(token, secret_key, algorithms=['HS256'])
        if 'user_id' not in data:
            return None
        return data
    except jwt.ExpiredSignatureError:
        logger.warning(f"[GOOGLE_OAUTH_INIT] Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[GOOGLE_OAUTH_INIT] Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"[GOOGLE_OAUTH_INIT] Token validation error: {str(e)}")
        return None

@google_bp.route('/linking/google/callback', methods=['GET'])
def google_oauth_callback():
    try:
        FRONTEND_URL = current_app.config['FRONTEND_URL']
        # Try to get user from session first
        user_id = session.get('user_id')
        logger.info(f"[GOOGLE_OAUTH_CB] Retrieved user_id from session: {user_id}")
        
        if user_id:
            user = User.query.get(user_id)
            if user:
                g.current_user = user
                logger.info(f"[GOOGLE_OAUTH_CB] Found user in session: {user.email}")
            else:
                logger.error(f"[GOOGLE_OAUTH_CB] User with ID {user_id} not found")
        
        # If no user in session, try auth token
        if not hasattr(g, 'current_user') or not g.current_user:
            auth_token = session.get('auth_token')
            logger.info(f"[GOOGLE_OAUTH_CB] No user in session, trying auth_token: {auth_token is not None}")
            if auth_token:
                user_data = validate_token(auth_token)
                if user_data and 'user_id' in user_data:
                    g.current_user = User.query.get(user_data['user_id'])
                    logger.info(f"[GOOGLE_OAUTH_CB] Found user from auth token: {g.current_user.email if g.current_user else 'None'}")

        if not hasattr(g, 'current_user') or not g.current_user:
            logger.error("[GOOGLE_OAUTH_CB] No authenticated user found")
            client_cb = session.pop('oauth_client_callback_url', current_app.config['FRONTEND_URL'])
            return redirect(f"{client_cb}?error=not_authenticated&platform=google")

        GOOGLE_CLIENT_ID = current_app.config['GOOGLE_CLIENT_ID']
        GOOGLE_CLIENT_SECRET = current_app.config['GOOGLE_CLIENT_SECRET']
        GOOGLE_REDIRECT_URI_BACKEND = current_app.config['GOOGLE_REDIRECT_URI_BACKEND']
    except KeyError as e:
        FRONTEND_URL = current_app.config.get('FRONTEND_URL', '/')
        logger.error(f"[GOOGLE_OAUTH_CB] Missing Google OAuth configuration: {str(e)}")
        # Redirect to a generic error page on frontend if possible
        client_cb_error = session.pop('oauth_client_callback_url', current_app.config['FRONTEND_URL'])
        return redirect(f"{client_cb_error}?error=oauth_config_error&platform=google")

    error = request.args.get('error')
    if error:
        logger.error(f"[GOOGLE_OAUTH_CB] OAuth error from Google: {error}")
        client_cb = session.pop('oauth_client_callback_url', current_app.config['FRONTEND_URL'])
        return redirect(f"{client_cb}?error=google_oauth_failed&details={error}&platform=google")

    code = request.args.get('code')
    if not code:
        logger.error("[GOOGLE_OAUTH_CB] No authorization code received from Google.")
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
        return redirect(f"{client_cb}?error=google_missing_code&platform=google")

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI_BACKEND,
        "grant_type": "authorization_code",
    }

    try:
        token_r = requests.post(token_url, data=token_data)
        token_r.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        token_json = token_r.json()
        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token") # Store this encrypted if needed for long-term API access
        id_token = token_json.get("id_token")

        if not access_token or not id_token:
            logger.error(f"[GOOGLE_OAUTH_CB] Failed to get access_token or id_token: {token_json}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
            return redirect(f"{client_cb}?error=google_token_retrieval_failed&platform=google")

        # Decode and verify ID token (in production, use a library like google-auth to verify signature)
        try:
            # Simplified decoding for demonstration; VERIFY SIGNATURE IN PRODUCTION
            id_token_parts = id_token.split('.')
            if len(id_token_parts) != 3:
                 raise ValueError("Invalid ID token format")
            payload_str = base64.urlsafe_b64decode(id_token_parts[1] + '==').decode('utf-8')
            user_info = json.loads(payload_str)
            
            # Basic validation of aud (audience) claim
            # if user_info.get('aud') != GOOGLE_CLIENT_ID:
            #     logger.error("[GOOGLE_OAUTH_CB] ID token audience (aud) does not match client ID.")
            #     raise ValueError("ID token audience mismatch")
            # Basic validation of iss (issuer) claim
            # if user_info.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
            #     logger.error("[GOOGLE_OAUTH_CB] ID token issuer (iss) is invalid.")
            #     raise ValueError("ID token issuer invalid")

        except Exception as e:
            logger.error(f"[GOOGLE_OAUTH_CB] Invalid ID token: {e}", exc_info=True)
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
            return redirect(f"{client_cb}?error=google_invalid_id_token&platform=google")


        google_user_id = user_info.get("sub")
        email = user_info.get("email")
        name = user_info.get("name")
        # picture = user_info.get("picture")
        email_verified = user_info.get("email_verified", False)

        if not google_user_id or not email:
            logger.error(f"[GOOGLE_OAUTH_CB] google_user_id or email missing from user_info: {user_info}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
            return redirect(f"{client_cb}?error=google_missing_user_info&platform=google")

        target_user = None
        is_registration_flow = False
        final_redirect_url = session.pop('oauth_client_callback_url', FRONTEND_URL)
        registration_token_from_session = session.pop('oauth_registration_token', None)

        # --- Determine target_user ---
        # 1. Registration Flow: User identified by temp_auth_token
        if registration_token_from_session:
            is_registration_flow = True
            # _validate_temp_auth_token returns (user, error_response, status_code)
            user_candidate, error_resp, _ = AuthController._validate_temp_auth_token(registration_token_from_session)
            if user_candidate:
                target_user = user_candidate
                logger.info(f"[GOOGLE_OAUTH_CB] Registration flow: Temp user {target_user.email} identified.")
            else:
                logger.warning(f"[GOOGLE_OAUTH_CB] Registration flow: Invalid or expired registration_token. Error: {error_resp}")
                return redirect(f"{final_redirect_url}?error=invalid_registration_session&platform=google&reg_token_status={error_resp.get('message', 'failed') if error_resp else 'failed'}")
        
        # 2. Logged-in User Flow (Linking from settings page)
        elif hasattr(g, 'current_user') and g.current_user:
            target_user = g.current_user # User is already logged in and linking their account
            logger.info(f"[GOOGLE_OAUTH_CB] Logged-in user flow: User {target_user.email} linking Google account.")
            final_redirect_url = f"{FRONTEND_URL}/user/profile/edit" # Or specific settings page

        # --- Debounce & Link/Create Account ---
        # Check if this Google account (google_user_id) is already linked to ANY user
        existing_link_by_provider_id = LinkedAccount.query.filter_by(provider='google', provider_user_id=google_user_id).first()

        if existing_link_by_provider_id:
            # Google account is already linked.
            if target_user and existing_link_by_provider_id.user_id == target_user.id:
                # Already linked to the correct current/registering user. Update tokens.
                existing_link_by_provider_id.access_token = access_token # Encrypt in production
                existing_link_by_provider_id.refresh_token = refresh_token # Encrypt in production
                existing_link_by_provider_id.name = name or existing_link_by_provider_id.name
                existing_link_by_provider_id.email = email or existing_link_by_provider_id.email
                db.session.commit()
                logger.info(f"[GOOGLE_OAUTH_CB] Google ID {google_user_id} already linked to target user {target_user.email}. Tokens updated.")
                return redirect(f"{final_redirect_url}?oauth_success=google_already_linked&platform=google" + (f"&registration_token={registration_token_from_session}" if is_registration_flow and registration_token_from_session else ""))

            else:
                # Linked to a DIFFERENT user. This is a conflict.
                logger.warning(f"[GOOGLE_OAUTH_CB] Conflict: Google ID {google_user_id} already linked to a different user (ID: {existing_link_by_provider_id.user_id}). Current target user ID: {target_user.id if target_user else 'None'}.")
                return redirect(f"{final_redirect_url}?error=google_account_conflict_other_user&platform=google")

        # If not existing_link_by_provider_id, proceed to link.
        # First, ensure we have a target_user.
        if not target_user:
            # This case means: Not registration flow, not logged-in user linking.
            # This could be a "Login with Google" attempt for an existing user.
            # Try to find user by email, if that email is verified by Google.
            if email_verified:
                user_by_email = User.query.filter(User.email == email, User.is_active == True).first()
                if user_by_email:
                    # Check if this email user already has a *different* google account linked.
                    conflicting_link = LinkedAccount.query.filter(LinkedAccount.user_id == user_by_email.id, LinkedAccount.provider == 'google').first()
                    if conflicting_link and conflicting_link.provider_user_id != google_user_id:
                        logger.warning(f"[GOOGLE_OAUTH_CB] User {email} exists but is linked to a different Google ID.")
                        return redirect(f"{FRONTEND_URL}/login?error=email_linked_different_google&platform=google")
                    target_user = user_by_email
                    logger.info(f"[GOOGLE_OAUTH_CB] 'Login with Google': Found existing user by email {email}.")
                    final_redirect_url = f"{FRONTEND_URL}/dashboard" # Or wherever login redirects
                else:
                    # No existing user by this verified email. This could be a "Sign up with Google" case.
                    # As per plan, registration is multi-step. So, direct signup here is not covered.
                    # Redirect to registration, possibly pre-filling email.
                    logger.info(f"[GOOGLE_OAUTH_CB] 'Sign up with Google': No user for verified email {email}. Redirecting to registration.")
                    return redirect(f"{FRONTEND_URL}/register/step1?email={email}&name={name}&oauth_source=google")
            else:
                # Email not verified by Google, cannot reliably use it to find existing user for login.
                logger.warning(f"[GOOGLE_OAUTH_CB] Google email {email} not verified. Cannot use for 'Login with Google'.")
                return redirect(f"{FRONTEND_URL}/login?error=google_email_not_verified_for_login&platform=google")
        
        # If we still don't have a target_user by now (e.g. registration_token invalid and not logged in)
        if not target_user:
            logger.error(f"[GOOGLE_OAUTH_CB] Critical: Could not determine target_user for Google ID {google_user_id}.")
            return redirect(f"{FRONTEND_URL}?error=oauth_internal_error&platform=google")

        # --- Link the account ---
        target_user.google_id = google_user_id # Main User table field for quick checks
        if not target_user.username and name: # If username is empty, try to prefill from Google name
            # Ensure username uniqueness if prefilling
            temp_username = "".join(filter(str.isalnum, name)).lower()
            counter = 0
            unique_username = temp_username
            while User.query.filter_by(username=unique_username).first():
                counter += 1
                unique_username = f"{temp_username}{counter}"
            target_user.username = unique_username

        if email_verified and target_user.email.lower() == email.lower() and not target_user.email_verified:
            target_user.email_verified = True # Mark email as verified if Google says so

        # Create the LinkedAccount entry
        new_link = LinkedAccount(
            user_id=target_user.id,
            provider='google',
            provider_user_id=google_user_id,
            email=email,
            name=name,
            access_token=access_token,  # Encrypt in production
            refresh_token=refresh_token # Encrypt in production
        )
        db.session.add(new_link)
        db.session.commit()
        logger.info(f"[GOOGLE_OAUTH_CB] Successfully linked Google ID {google_user_id} to user {target_user.email} (ID: {target_user.id}).")

        # Redirect based on flow
        if is_registration_flow:
            # Append success and the original registration_token for frontend state continuity
            return redirect(f"{final_redirect_url}?oauth_success=google&platform=google&registration_token={registration_token_from_session}")
        else: # Logged-in user linking or "Login with Google"
            # For "Login with Google", generate main auth token
            if not (hasattr(g, 'current_user') and g.current_user): # If it was a login attempt
                token_payload = {'user_id': target_user.id, 'role': target_user.role}
                if target_user.role == 'business_admin' and target_user.business_id:
                    token_payload['business_id'] = target_user.business_id
                auth_token = AuthController.generate_token(payload=token_payload)
                return redirect(f"{final_redirect_url}?oauth_success=google_login&platform=google&token={auth_token}")
            else: # Linking from settings
                return redirect(f"{final_redirect_url}?oauth_success=google_linked&platform=google")

    except requests.exceptions.RequestException as e:
        FRONTEND_URL = current_app.config.get('FRONTEND_URL', '/') 
        logger.error(f"[GOOGLE_OAUTH_CB] HTTP request error during token exchange or user info fetch: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
        return redirect(f"{client_cb}?error=google_communication_error&platform=google")
    except Exception as e:
        FRONTEND_URL = current_app.config.get('FRONTEND_URL', '/')
        db.session.rollback()
        logger.error(f"[GOOGLE_OAUTH_CB] General error during Google OAuth callback: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_URL)
        return redirect(f"{client_cb}?error=google_internal_error&platform=google") 