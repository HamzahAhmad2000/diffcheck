from flask import Blueprint, request, jsonify, redirect, current_app, session, g
from app.models import db, User, LinkedAccount
from app.controllers.auth_controller import AuthController
from datetime import datetime
import os
import requests
import logging
import jwt
import secrets
import base64
import urllib.parse

logger = logging.getLogger(__name__)
twitter_bp = Blueprint('twitter_auth', __name__)

# Config keys for Twitter/X:
# TWITTER_CLIENT_ID (API Key)
# TWITTER_CLIENT_SECRET (API Key Secret)
# TWITTER_REDIRECT_URI (e.g., http://localhost:5000/linking/twitter/callback)

FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL')

def validate_token(token):
    try:
        secret_key = current_app.config.get('SECRET_KEY')
        data = jwt.decode(token, secret_key, algorithms=['HS256'])
        if 'user_id' not in data:
            return None
        return data
    except jwt.ExpiredSignatureError:
        logger.warning(f"[TWITTER_OAUTH_INIT] Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[TWITTER_OAUTH_INIT] Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"[TWITTER_OAUTH_INIT] Token validation error: {str(e)}")
        return None

@twitter_bp.route('/linking/twitter/initiate', methods=['GET'])
def twitter_initiate_oauth():
    """
    Initiate Twitter OAuth2.0 flow
    """
    logger.info("[TWITTER_OAUTH_INIT] Starting OAuth initiation")
    
    # Get token from URL parameter or Authorization header
    token = request.args.get('token')
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        logger.error("[TWITTER_OAUTH_INIT] No authentication token provided")
        return jsonify({"error": "Authentication required"}), 401
        
    # Validate token and get user
    user_data = validate_token(token)
    if not user_data:
        logger.error("[TWITTER_OAUTH_INIT] Invalid token")
        return jsonify({"error": "Invalid authentication token"}), 401
        
    user = User.query.get(user_data['user_id'])
    if not user:
        logger.error(f"[TWITTER_OAUTH_INIT] User not found for ID {user_data['user_id']}")
        return jsonify({"error": "User not found"}), 404
        
    g.current_user = user

    try:
        TWITTER_CLIENT_ID = current_app.config['TWITTER_CLIENT_ID']
        TWITTER_REDIRECT_URI = current_app.config['TWITTER_REDIRECT_URI']
    except KeyError as e:
        logger.error(f"[TWITTER_OAUTH_INIT] Missing Twitter OAuth configuration: {str(e)}")
        return jsonify({"error": "Twitter OAuth not configured correctly on server."}), 500

    # Generate and store state parameter to prevent CSRF
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['user_id'] = user.id
    session['auth_token'] = token

    # Store callback URL
    client_callback_url_after_success = request.args.get('client_callback_url', FRONTEND_BASE_URL)
    session['oauth_client_callback_url'] = client_callback_url_after_success
    logger.info(f"[TWITTER_OAUTH_INIT] Stored client_callback_url in session for Twitter: {client_callback_url_after_success}")

    # Construct Twitter OAuth URL
    scopes = ["users.read", "tweet.read"]
    auth_url = (
        "https://twitter.com/i/oauth2/authorize"
        f"?response_type=code"
        f"&client_id={TWITTER_CLIENT_ID}"
        f"&redirect_uri={urllib.parse.quote(TWITTER_REDIRECT_URI)}"
        f"&scope={'+'.join(scopes)}"
        f"&state={state}"
        f"&code_challenge=challenge"  # For simplicity, using a static challenge
        f"&code_challenge_method=plain"
    )

    logger.info(f"[TWITTER_OAUTH_INIT] Redirecting to Twitter auth URL")
    return redirect(auth_url)

@twitter_bp.route('/linking/twitter/callback', methods=['GET'])
def twitter_oauth_callback():
    """
    Handle Twitter OAuth2.0 callback
    """
    try:
        # Verify state parameter
        state = request.args.get('state')
        stored_state = session.get('oauth_state')
        if not state or not stored_state or state != stored_state:
            logger.error("[TWITTER_OAUTH_CB] State parameter mismatch or missing")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=invalid_state&platform=twitter")

        # Get user from session
        user_id = session.get('user_id')
        if user_id:
            user = User.query.get(user_id)
            if user:
                g.current_user = user
            else:
                logger.error(f"[TWITTER_OAUTH_CB] User with ID {user_id} not found")
                client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
                return redirect(f"{client_cb}?error=user_not_found&platform=twitter")
        else:
            logger.error("[TWITTER_OAUTH_CB] No user_id in session")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=no_user_session&platform=twitter")

        error = request.args.get('error')
        if error:
            logger.error(f"[TWITTER_OAUTH_CB] OAuth error from Twitter: {error}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=twitter_oauth_failed&details={error}&platform=twitter")

        code = request.args.get('code')
        if not code:
            logger.error("[TWITTER_OAUTH_CB] No authorization code received from Twitter")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=twitter_missing_code&platform=twitter")

        # Exchange code for token
        TWITTER_CLIENT_ID = current_app.config['TWITTER_CLIENT_ID']
        TWITTER_CLIENT_SECRET = current_app.config['TWITTER_CLIENT_SECRET']
        TWITTER_REDIRECT_URI = current_app.config['TWITTER_REDIRECT_URI']

        # Create Basic Auth header
        auth_header = base64.b64encode(
            f"{TWITTER_CLIENT_ID}:{TWITTER_CLIENT_SECRET}".encode('utf-8')
        ).decode('utf-8')

        token_url = "https://api.twitter.com/2/oauth2/token"
        token_data = {
            'code': code,
            'grant_type': 'authorization_code',
            'client_id': TWITTER_CLIENT_ID,
            'redirect_uri': TWITTER_REDIRECT_URI,
            'code_verifier': 'challenge'  # Matching the challenge from initiate
        }
        token_headers = {
            'Authorization': f'Basic {auth_header}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        token_response = requests.post(token_url, data=token_data, headers=token_headers)
        token_response.raise_for_status()
        token_json = token_response.json()

        access_token = token_json.get('access_token')
        if not access_token:
            logger.error("[TWITTER_OAUTH_CB] No access token in response")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=twitter_no_access_token&platform=twitter")

        # Get user info from Twitter
        user_info_url = "https://api.twitter.com/2/users/me"
        user_headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        user_response = requests.get(
            user_info_url,
            headers=user_headers,
            params={'user.fields': 'id,name,username'}
        )
        user_response.raise_for_status()
        twitter_user_info = user_response.json().get('data', {})

        twitter_user_id = str(twitter_user_info.get('id'))
        username = twitter_user_info.get('username')

        if not twitter_user_id:
            logger.error(f"[TWITTER_OAUTH_CB] Twitter user ID missing from response: {twitter_user_info}")
            client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
            return redirect(f"{client_cb}?error=twitter_missing_user_id&platform=twitter")

        # Check if this Twitter account is already linked
        existing_link = LinkedAccount.query.filter_by(
            provider='twitter',
            provider_user_id=twitter_user_id
        ).first()

        if existing_link:
            if existing_link.user_id == g.current_user.id:
                # Update existing link
                existing_link.access_token = access_token
                existing_link.name = username
                db.session.commit()
                logger.info(f"[TWITTER_OAUTH_CB] Updated existing Twitter link for user {g.current_user.email}")
                client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
                return redirect(f"{client_cb}?oauth_success=twitter_already_linked&platform=twitter")
            else:
                logger.warning(f"[TWITTER_OAUTH_CB] Twitter account already linked to different user")
                client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
                return redirect(f"{client_cb}?error=twitter_account_conflict_other_user&platform=twitter")

        # Create new link
        new_link = LinkedAccount(
            user_id=g.current_user.id,
            provider='twitter',
            provider_user_id=twitter_user_id,
            name=username,
            access_token=access_token
        )
        db.session.add(new_link)
        
        # Update user's x_id field
        g.current_user.x_id = twitter_user_id
        
        db.session.commit()
        logger.info(f"[TWITTER_OAUTH_CB] Successfully linked Twitter account for user {g.current_user.email}")

        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?oauth_success=twitter&platform=twitter")

    except requests.exceptions.RequestException as e:
        logger.error(f"[TWITTER_OAUTH_CB] HTTP request error for Twitter: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=twitter_communication_error&platform=twitter")
    except Exception as e:
        db.session.rollback()
        logger.error(f"[TWITTER_OAUTH_CB] General error during Twitter OAuth callback: {e}", exc_info=True)
        client_cb = session.pop('oauth_client_callback_url', FRONTEND_BASE_URL)
        return redirect(f"{client_cb}?error=twitter_internal_error&platform=twitter") 