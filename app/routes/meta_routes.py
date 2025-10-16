from flask import Blueprint, request, jsonify, redirect, current_app, session, g
from app.models import db, User, LinkedAccount
from app.controllers.auth_controller import AuthController
from datetime import datetime
import requests
import logging

logger = logging.getLogger(__name__)
meta_bp = Blueprint('meta_auth', __name__)

# Config keys for Meta (Facebook):
# META_CLIENT_ID
# META_CLIENT_SECRET
# META_REDIRECT_URI_BACKEND (e.g., http://localhost:5000/linking/meta/callback)

# META_OAUTH2_AUTHORIZE_URL = "https://www.facebook.com/v18.0/dialog/oauth" # Check latest API version
# META_OAUTH2_TOKEN_URL = "https://graph.facebook.com/v18.0/oauth/access_token"
# META_USER_INFO_URL = "https://graph.facebook.com/me"
# META_SCOPES = "email public_profile" # Add other scopes as needed

FRONTEND_BASE_URL = 'http://localhost:3000'

@meta_bp.route('/linking/meta/initiate', methods=['GET'])
def meta_initiate_oauth():
    try:
        META_CLIENT_ID = current_app.config['META_CLIENT_ID']
        META_REDIRECT_URI_BACKEND = current_app.config['META_REDIRECT_URI_BACKEND']
        META_OAUTH2_AUTHORIZE_URL = current_app.config.get('META_OAUTH2_AUTHORIZE_URL', "https://www.facebook.com/dialog/oauth") # Simpler base URL
        META_SCOPES = current_app.config.get('META_SCOPES', "email,public_profile")
    except KeyError as e:
        logger.error(f"[META_OAUTH_INIT] Missing Meta OAuth configuration: {str(e)}")
        return jsonify({"error": "Meta (Facebook) OAuth not configured correctly on server."}), 500

    registration_token = request.args.get('registration_token')
    if registration_token:
        session['oauth_registration_token'] = registration_token
        logger.info(f"[META_OAUTH_INIT] Stored registration_token in session for Meta.")

    client_callback_url_after_success = request.args.get('client_callback_url', FRONTEND_BASE_URL)
    session['oauth_client_callback_url'] = client_callback_url_after_success
    logger.info(f"[META_OAUTH_INIT] Stored client_callback_url in session for Meta: {client_callback_url_after_success}")

    # state = secrets.token_urlsafe(16)
    # session['meta_oauth_state'] = state

    auth_url = (
        f"{META_OAUTH2_AUTHORIZE_URL}?client_id={META_CLIENT_ID}"
        f"&redirect_uri={META_REDIRECT_URI_BACKEND}&scope={META_SCOPES}"
        # f"&state={state}"
        f"&response_type=code"
    )
    logger.info(f"[META_OAUTH_INIT] Redirecting to Meta (Facebook) auth URL.")
    return redirect(auth_url)

@meta_bp.route('/linking/meta/callback', methods=['GET'])
def meta_oauth_callback():
    try:
        META_CLIENT_ID = current_app.config['META_CLIENT_ID']
        META_CLIENT_SECRET = current_app.config['META_CLIENT_SECRET']
        META_REDIRECT_URI_BACKEND = current_app.config['META_REDIRECT_URI_BACKEND']
        META_OAUTH2_TOKEN_URL = current_app.config.get('META_OAUTH2_TOKEN_URL', "https://graph.facebook.com/oauth/access_token")
        META_USER_INFO_URL = current_app.config.get('META_USER_INFO_URL', "https://graph.facebook.com/me")
    except KeyError as e:
        logger.error(f"[META_OAUTH_CB] Missing Meta OAuth configuration: {str(e)}")
        client_cb_error = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb_error}?error=oauth_config_error&platform=meta")

    # Verify state if used
    error = request.args.get('error')
    if error:
        logger.error(f"[META_OAUTH_CB] OAuth error from Meta: {error} - {request.args.get('error_description')}")
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=meta_oauth_failed&details={error}&platform=meta")

    code = request.args.get('code')
    if not code:
        logger.error("[META_OAUTH_CB] No authorization code received from Meta.")
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=meta_missing_code&platform=meta")

    token_params = {
        'client_id': META_CLIENT_ID,
        'client_secret': META_CLIENT_SECRET,
        'code': code,
        'redirect_uri': META_REDIRECT_URI_BACKEND
    }

    try:
        token_r = requests.get(META_OAUTH2_TOKEN_URL, params=token_params)
        token_r.raise_for_status()
        token_json = token_r.json()
        access_token = token_json.get("access_token")

        if not access_token:
            logger.error(f"[META_OAUTH_CB] Failed to get access_token from Meta: {token_json}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=meta_token_retrieval_failed&platform=meta")

        # Fetch user info
        user_info_params = {
            'fields': 'id,name,email,picture', # Add more fields if permissions are granted
            'access_token': access_token
        }
        userinfo_r = requests.get(META_USER_INFO_URL, params=user_info_params)
        userinfo_r.raise_for_status()
        user_info = userinfo_r.json()

        meta_user_id = str(user_info.get("id"))
        name = user_info.get("name")
        email = user_info.get("email") # Email might be missing if user didn't grant permission or no primary email
        # profile_picture_url = user_info.get("picture", {}).get("data", {}).get("url")

        if not meta_user_id:
            logger.error(f"[META_OAUTH_CB] meta_user_id missing from Meta user_info: {user_info}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=meta_missing_user_id&platform=meta")
        
        # --- Standard Linking Logic ---
        target_user = None
        is_registration_flow = False
        final_redirect_url = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        registration_token_from_session = session.pop('oauth_registration_token', None)

        if registration_token_from_session:
            is_registration_flow = True
            user_candidate, error_resp, _ = AuthController._validate_temp_auth_token(registration_token_from_session)
            if user_candidate:
                target_user = user_candidate
                logger.info(f"[META_OAUTH_CB] Registration flow: Temp user {target_user.email} identified for Meta linking.")
            else:
                logger.warning(f"[META_OAUTH_CB] Registration flow: Invalid or expired registration_token for Meta. Error: {error_resp}")
                return redirect(f"{final_redirect_url}?error=invalid_registration_session&platform=meta&reg_token_status={error_resp.get('message', 'failed') if error_resp else 'failed'}")
        
        elif hasattr(g, 'current_user') and g.current_user:
            target_user = g.current_user
            logger.info(f"[META_OAUTH_CB] Logged-in user flow: User {target_user.email} linking Meta account.")
            final_redirect_url = f"{FRONTEND_BASE_URL}/user/profile/edit"

        existing_link_by_provider_id = LinkedAccount.query.filter_by(provider='meta', provider_user_id=meta_user_id).first()

        if existing_link_by_provider_id:
            if target_user and existing_link_by_provider_id.user_id == target_user.id:
                existing_link_by_provider_id.access_token = access_token # Encrypt
                existing_link_by_provider_id.name = name or existing_link_by_provider_id.name
                existing_link_by_provider_id.email = email or existing_link_by_provider_id.email
                db.session.commit()
                logger.info(f"[META_OAUTH_CB] Meta ID {meta_user_id} already linked to target user {target_user.email}. Tokens updated.")
                return redirect(f"{final_redirect_url}?oauth_success=meta_already_linked&platform=meta" + (f"&registration_token={registration_token_from_session}" if is_registration_flow and registration_token_from_session else ""))
            else:
                logger.warning(f"[META_OAUTH_CB] Conflict: Meta ID {meta_user_id} already linked to a different user (ID: {existing_link_by_provider_id.user_id}).")
                return redirect(f"{final_redirect_url}?error=meta_account_conflict_other_user&platform=meta")

        if not target_user: # Attempting login with Meta
            if email: # Meta may or may not provide email
                user_by_email = User.query.filter(User.email == email, User.is_active == True).first()
                if user_by_email:
                    conflicting_link = LinkedAccount.query.filter(LinkedAccount.user_id == user_by_email.id, LinkedAccount.provider == 'meta').first()
                    if conflicting_link and conflicting_link.provider_user_id != meta_user_id:
                        logger.warning(f"[META_OAUTH_CB] User {email} exists but is linked to a different Meta ID.")
                        return redirect(f"{FRONTEND_BASE_URL}/login?error=email_linked_different_meta&platform=meta")
                    target_user = user_by_email
                    logger.info(f"[META_OAUTH_CB] 'Login with Meta': Found existing user by email {email}.")
                    final_redirect_url = f"{FRONTEND_BASE_URL}/dashboard"
                else:
                    logger.info(f"[META_OAUTH_CB] 'Sign up with Meta': No user for email {email}. Redirecting to registration.")
                    return redirect(f"{FRONTEND_BASE_URL}/register/step1?email={email}&name={name}&oauth_source=meta")
            else:
                logger.warning(f"[META_OAUTH_CB] Meta email not provided. Cannot use for 'Login with Meta' by email match. User must register or link manually.")
                return redirect(f"{FRONTEND_BASE_URL}/login?error=meta_user_not_found_link_first&platform=meta")

        if not target_user:
            logger.error(f"[META_OAUTH_CB] Critical: Could not determine target_user for Meta ID {meta_user_id}.")
            return redirect(f"{FRONTEND_BASE_URL}?error=oauth_internal_error&platform=meta")

        target_user.meta_id = meta_user_id
        if not target_user.username and name:
            from app.models import User
            temp_m_username = "".join(filter(str.isalnum, name)).lower()
            counter = 0
            unique_m_username = temp_m_username
            while User.query.filter_by(username=unique_m_username).first():
                counter += 1
                unique_m_username = f"{temp_m_username}{counter}"
            target_user.username = unique_m_username
        
        # If Meta provides an email and it matches the target_user's email, consider verifying it if not already.
        if email and target_user.email.lower() == email.lower() and not target_user.email_verified:
            # Facebook email verification status is implicit if you get the email via graph API
            target_user.email_verified = True

        new_link = LinkedAccount(
            user_id=target_user.id,
            provider='meta',
            provider_user_id=meta_user_id,
            name=name,
            email=email,
            access_token=access_token, # Encrypt
            refresh_token=None # Facebook graph API access tokens are typically short-lived, long-lived, or extended. True refresh tokens are less common in basic client-side flows.
        )
        db.session.add(new_link)
        db.session.commit()
        logger.info(f"[META_OAUTH_CB] Successfully linked Meta ID {meta_user_id} to user {target_user.email} (ID: {target_user.id}).")

        if is_registration_flow:
            return redirect(f"{final_redirect_url}?oauth_success=meta&platform=meta&registration_token={registration_token_from_session}")
        else:
            if not (hasattr(g, 'current_user') and g.current_user):
                token_payload = {'user_id': target_user.id, 'role': target_user.role}
                if target_user.role == 'business_admin' and target_user.business_id:
                    token_payload['business_id'] = target_user.business_id
                auth_token = AuthController.generate_token(payload=token_payload)
                return redirect(f"{final_redirect_url}?oauth_success=meta_login&platform=meta&token={auth_token}")
            else:
                return redirect(f"{final_redirect_url}?oauth_success=meta_linked&platform=meta")

    except requests.exceptions.RequestException as e:
        logger.error(f"[META_OAUTH_CB] HTTP request error for Meta: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=meta_communication_error&platform=meta")
    except Exception as e:
        db.session.rollback()
        logger.error(f"[META_OAUTH_CB] General error during Meta OAuth callback: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=meta_internal_error&platform=meta") 