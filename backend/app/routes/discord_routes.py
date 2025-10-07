from flask import Blueprint, request, jsonify, redirect, current_app, session, g
from app.models import db, User, LinkedAccount, Business, Survey, DiscordServerRoleCache
from app.controllers.auth_controller import AuthController, token_required, admin_required, business_admin_scoped_permission_required
from ..controllers.business_controller import BusinessController
from datetime import datetime
import requests
import logging
from functools import wraps
import jwt
from urllib.parse import quote
from ..services import token_service, discord_service

logger = logging.getLogger(__name__)

# Helper to dynamically resolve the correct redirect URI for Discord callbacks

def _get_discord_redirect_uri():
    """Return the Discord redirect URI.

    Always use the configured DISCORD_REDIRECT_URI_BACKEND from environment/config.
    This ensures consistent behavior across all environments.
    """
    env_uri = current_app.config.get('DISCORD_REDIRECT_URI_BACKEND')
    if env_uri:
        return env_uri
    # Fallback – derive from the incoming request host only if no config is set
    return f"{request.url_root.rstrip('/')}/linking/discord/callback"

# OAuth Discord routes (for linking accounts)
discord_bp = Blueprint('discord_linking', __name__, url_prefix='/linking')

# API Discord routes (for frontend integration) 
discord_api_bp = Blueprint('discord_api', __name__, url_prefix='/api')

# Config keys for Discord:
# DISCORD_CLIENT_ID
# DISCORD_CLIENT_SECRET
# DISCORD_REDIRECT_URI_BACKEND (configured via environment variable)
# DISCORD_BOT_TOKEN (Optional, if needed for guild/role checks beyond user identification)

# DISCORD_OAUTH2_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize"
# DISCORD_OAUTH2_TOKEN_URL = "https://discord.com/api/oauth2/token"
# DISCORD_USER_INFO_URL = "https://discord.com/api/users/@me"
# DISCORD_SCOPES = "identify email guilds.join" # guilds.join if you want to add user to a server. `guilds` for guild list.

# Remove hardcoded frontend URL - use current_app.config['FRONTEND_URL'] instead

def validate_token(token):
    try:
        secret_key = current_app.config.get('SECRET_KEY')
        data = jwt.decode(token, secret_key, algorithms=['HS256'])
        if 'user_id' not in data:
            return None
        return data
    except jwt.ExpiredSignatureError:
        logger.warning(f"[DISCORD_OAUTH_INIT] Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[DISCORD_OAUTH_INIT] Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"[DISCORD_OAUTH_INIT] Token validation error: {str(e)}")
        return None

def get_user_from_session():
    """Get the authenticated user from the token in Authorization header."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split('Bearer ')[1]
    token_data = validate_token(token)
    if not token_data:
        return None

    user = User.query.get(token_data['user_id'])
    return user

def business_context_required(decorated_function):
    @wraps(decorated_function)
    def decorator(*args, **kwargs):
        business_id = kwargs.get('business_id')
        if not business_id:
            return jsonify({"error": "Business ID is required"}), 400
        business = Business.query.get(business_id)
        if not business:
            return jsonify({"error": "Business not found"}), 404
        
        kwargs['business'] = business
        return decorated_function(*args, **kwargs)
    return decorator

# OAuth Routes (under /linking prefix)
@discord_bp.route('/discord/initiate', methods=['GET'])
@token_required
def discord_initiate_oauth():
    """Initiates the User Install OAuth flow for linking a Discord account."""
    user = g.current_user
    session['discord_oauth_user_id'] = user.id

    DISCORD_CLIENT_ID = current_app.config['DISCORD_CLIENT_ID']
    DISCORD_REDIRECT_URI_BACKEND = _get_discord_redirect_uri()
    # Include guilds.members.read to fetch user's role data within guilds
    # This allows us to get the user's role IDs for each guild they're in
    scope = "identify email guilds guilds.members.read"
    
    auth_url = (
        f"https://discord.com/api/oauth2/authorize?client_id={DISCORD_CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={quote(DISCORD_REDIRECT_URI_BACKEND)}"
        f"&scope={quote(scope)}"
    )
    logger.info(f"Redirecting user {user.id} to Discord for linking: {auth_url}")
    return jsonify({"redirect_url": auth_url})

@discord_bp.route('/discord/bot-invite', methods=['GET'])
@token_required
def discord_bot_invite():
    """Generates the bot invitation URL with proper permissions for server integration."""
    user = g.current_user
    business_id = request.args.get('business_id')
    
    # Store context for callback handling
    session['discord_bot_invite_user_id'] = user.id
    if business_id:
        session['discord_bot_invite_business_id'] = business_id

    DISCORD_CLIENT_ID = current_app.config['DISCORD_CLIENT_ID']
    DISCORD_REDIRECT_URI_BACKEND = _get_discord_redirect_uri()
    
    # Bot invitation with required permissions.
    # We combine the bot invitation with a user OAuth flow (using `response_type=code` and user scopes)
    # to ensure a `code` is returned to our callback, which simplifies the logic and makes it consistent.
    permissions = "8"  # Administrator permission (includes Manage Roles)
    
    # Combine scopes to create a single authorization flow for both bot and user.
    # Include guilds.members.read to get user role data when bot is added
    scope = "bot identify guilds.members.read"
    
    # Build the bot invite URL with OAuth2 code flow parameters
    bot_invite_url = (
        f"https://discord.com/api/oauth2/authorize?client_id={DISCORD_CLIENT_ID}"
        f"&permissions={permissions}"
        f"&scope={quote(scope)}"
        f"&redirect_uri={DISCORD_REDIRECT_URI_BACKEND}"
        f"&response_type=code"
    )
    
    logger.info(f"Generated bot invite URL for user {user.id}, business {business_id}: {bot_invite_url}")
    return jsonify({
        "bot_invite_url": bot_invite_url,
        "message": "Use this URL to invite the bot and authorize the app."
    })

@discord_bp.route('/discord/callback', methods=['GET'])
def discord_oauth_callback():
    """Handles the callback from Discord after user authorization or bot invitation."""
    logger.info(f"[DISCORD_CALLBACK] Starting Discord OAuth callback processing")
    logger.info(f"[DISCORD_CALLBACK] Request args: {request.args}")
    logger.info(f"[DISCORD_CALLBACK] Session data: {dict(session)}")
    
    # Check if this is a bot invitation callback or user OAuth callback
    user_id = session.get('discord_oauth_user_id') or session.get('discord_bot_invite_user_id')
    business_id = session.get('discord_bot_invite_business_id')
    is_bot_invite = 'discord_bot_invite_user_id' in session
    
    if not user_id:
        logger.error("Discord callback received without a user_id in session.")
        return redirect(f"{current_app.config['FRONTEND_URL']}/user/profile/edit?error=session_expired")
    
    user = User.query.get(user_id)
    if not user:
        logger.error(f"User with ID {user_id} from session not found in DB during Discord callback.")
        return redirect(f"{current_app.config['FRONTEND_URL']}/user/profile/edit?error=user_not_found")
    
    logger.info(f"[DISCORD_CALLBACK] Processing callback for user {user.id} ({user.email}), bot_invite={is_bot_invite}")
    
    # Determine redirect URL based on user role and callback type
    if is_bot_invite and business_id:
        if user.role == 'business_admin':
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/business-admin/dashboard"
        elif user.role == 'super_admin':
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/admin/business/edit/{business_id}"
        else:
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/user/profile/edit"
    else:
        if user.role == 'business_admin':
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/business-admin/dashboard"
        elif user.role == 'super_admin':
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/admin"
        else:
            frontend_redirect_url = f"{current_app.config['FRONTEND_URL']}/user/profile/edit"
    
    code = request.args.get('code')
    guild_id = request.args.get('guild_id')  # Present when bot is successfully added to server
    
    if not code:
        logger.error("No authorization code in Discord callback.")
        return redirect(f"{frontend_redirect_url}?error=discord_no_code")

    logger.info(f"[DISCORD_CALLBACK] Authorization code received: {code[:10]}...")
    if guild_id:
        logger.info(f"[DISCORD_CALLBACK] Bot added to guild: {guild_id}")

    token_data = {
        'client_id': current_app.config['DISCORD_CLIENT_ID'],
        'client_secret': current_app.config['DISCORD_CLIENT_SECRET'],
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': _get_discord_redirect_uri()
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}

    try:
        logger.info(f"[DISCORD_CALLBACK] Exchanging code for token...")
        token_r = requests.post("https://discord.com/api/v10/oauth2/token", data=token_data, headers=headers)
        token_r.raise_for_status()
        token_json = token_r.json()
        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token")
        
        logger.info(f"[DISCORD_CALLBACK] Token exchange successful, access_token: {access_token[:10] if access_token else 'None'}...")

        user_headers = {'Authorization': f'Bearer {access_token}'}
        userinfo_r = requests.get("https://discord.com/api/v10/users/@me", headers=user_headers)
        userinfo_r.raise_for_status()
        discord_user_info = userinfo_r.json()
        
        logger.info(f"[DISCORD_CALLBACK] Discord user info retrieved: {discord_user_info}")

        discord_id = str(discord_user_info.get("id"))
        logger.info(f"[DISCORD_CALLBACK] Discord ID: {discord_id}")
        
        existing_link = LinkedAccount.query.filter(
            LinkedAccount.provider == 'discord',
            LinkedAccount.provider_user_id == discord_id,
            LinkedAccount.user_id != user.id
        ).first()
        if existing_link:
            logger.warning(f"[DISCORD_CALLBACK] Discord ID {discord_id} already linked to another user")
            return redirect(f"{frontend_redirect_url}?error=discord_account_in_use")

        current_user_link = LinkedAccount.query.filter_by(user_id=user.id, provider='discord').first()
        if not current_user_link:
            logger.info(f"[DISCORD_CALLBACK] Creating new LinkedAccount for user {user.id}")
            current_user_link = LinkedAccount(user_id=user.id, provider='discord')
            db.session.add(current_user_link)
        else:
            logger.info(f"[DISCORD_CALLBACK] Updating existing LinkedAccount for user {user.id}")
        
        current_user_link.provider_user_id = discord_id
        current_user_link.name = discord_user_info.get("username")
        current_user_link.email = discord_user_info.get("email")
        current_user_link.access_token = token_service.encrypt_token(access_token)
        current_user_link.refresh_token = token_service.encrypt_token(refresh_token)
        
        logger.info(f"[DISCORD_CALLBACK] Setting user.discord_id from {user.discord_id} to {discord_id}")
        user.discord_id = discord_id
        
        # Cache the user's roles from all Discord servers they are in
        try:
            discord_service.sync_user_roles_for_all_guilds(current_user_link)
        except Exception as role_sync_err:
            logger.error(
                f"[DISCORD_CALLBACK] Error caching user roles: {role_sync_err}",
                exc_info=True,
            )

        # If this was a bot invite and we got a guild_id, update the business with the server ID
        if is_bot_invite and guild_id and business_id:
            business = Business.query.get(business_id)
            if business:
                logger.info(f"[DISCORD_CALLBACK] Bot invited to guild {guild_id}, updating business {business_id}")
                business.discord_server = guild_id
                
                # Commit the business update immediately so the link is saved even if sync fails
                db.session.commit()
                logger.info(f"[DISCORD_CALLBACK] Business {business.id} successfully linked to Discord server {guild_id}")
                
                # Clean up session variables early since the primary goal is achieved
                session.pop('discord_bot_invite_user_id', None)
                session.pop('discord_bot_invite_business_id', None)
                
                # Now attempt to sync roles - this is a secondary action
                try:
                    success, message = BusinessController._sync_discord_roles_for_business(business_id, user)
                    if success:
                        logger.info(f"[DISCORD_CALLBACK] Successfully synced roles after bot invite: {message}")
                        return redirect(f"{frontend_redirect_url}?success=discord_bot_added&guild_id={guild_id}")
                    else:
                        logger.warning(f"[DISCORD_CALLBACK] Role sync failed after bot invite: {message}")
                        # Redirect with parameter indicating sync failure, but bot was still added successfully
                        return redirect(f"{frontend_redirect_url}?success=discord_bot_added&sync_failed=true&guild_id={guild_id}")
                except Exception as sync_error:
                    logger.error(f"[DISCORD_CALLBACK] Role sync error after bot invite: {sync_error}")
                    # Still redirect successfully since the bot was added, just note the sync failure
                    return redirect(f"{frontend_redirect_url}?success=discord_bot_added&sync_failed=true&guild_id={guild_id}")
        
        logger.info(f"[DISCORD_CALLBACK] Committing database changes...")
        db.session.commit()
        
        # Clean up session variables
        session.pop('discord_oauth_user_id', None)
        session.pop('discord_bot_invite_user_id', None)
        session.pop('discord_bot_invite_business_id', None)
        
        logger.info(f"[DISCORD_CALLBACK] Successfully linked Discord ID {discord_id} for user {user.id}")
        
        if is_bot_invite:
            return redirect(f"{frontend_redirect_url}?success=discord_bot_invited")
        else:
            return redirect(f"{frontend_redirect_url}?success=discord_linked")

    except Exception as e:
        db.session.rollback()
        logger.error(f"[DISCORD_CALLBACK] Error during Discord callback: {e}", exc_info=True)
        return redirect(f"{frontend_redirect_url}?error=discord_callback_failed")

# API endpoints for frontend integration (under /api prefix)
@discord_api_bp.route('/businesses/<int:business_id>/discord-roles', methods=['GET'])
@token_required
@business_admin_scoped_permission_required(None)  # More robust permission check
def get_cached_discord_roles(business_id):
    """
    Fetches the cached list of Discord roles for a business.
    If the cache is empty, it attempts to sync the roles using the current admin's credentials.
    """
    # The decorator handles permissions and loads the business object into g.target_business
    business = g.target_business
    
    cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()

    # If cache is missing or empty, AND a discord server is configured, try to sync.
    if (not cache_entry or not cache_entry.roles_data) and business.discord_server:
        current_app.logger.info(f"Discord role cache empty for business {business_id}. Attempting a sync now with user {g.current_user.id}.")
        
        success, message = BusinessController._sync_discord_roles_for_business(business_id, g.current_user)
        
        if not success:
            # The sync failed, return the specific error message from the sync function.
            return jsonify({
                "error": message,
                "roles": []
            }), 400

        # If sync was successful, re-query the cache.
        cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()

    # Final check after potential sync
    if not cache_entry or not cache_entry.roles_data:
        error_message = "Discord roles could not be found or synced. "
        if not business.discord_server:
            error_message += "Please configure a Discord Server ID for this business first."
        else:
            error_message += "Please check the server ID and ensure the bot is invited with 'Administrator' permissions."
        
        return jsonify({"error": error_message, "roles": []}), 404

    return jsonify(cache_entry.to_dict()), 200

@discord_api_bp.route('/surveys/<int:survey_id>/discord-access-check', methods=['GET'])
@token_required
def check_survey_discord_access(survey_id):
    """Check if the current user has Discord access to a survey."""
    survey = Survey.query.get_or_404(survey_id)
    
    if not survey.is_restricted or not survey.audience_settings or not survey.audience_settings.discord_roles_allowed:
        return jsonify({"has_access": True, "reason": "No Discord role requirement."}), 200
    
    required_roles = survey.audience_settings.discord_roles_allowed
    has_access, reason = discord_service.check_user_discord_access(g.current_user, survey.business, required_roles)
    
    return jsonify({"has_access": has_access, "reason": reason}), 200

@discord_api_bp.route('/businesses/<int:business_id>/discord/membership', methods=['GET'])
@token_required
@business_context_required
def get_discord_membership(business_id, business):
    """Get user's Discord membership status for a business."""

    # Check if user has Discord linked
    linked_account = LinkedAccount.query.filter_by(user_id=g.current_user.id, provider='discord').first()
    if not linked_account:
        return jsonify({"is_member": False, "reason": "Discord account not linked"}), 200

    member_info = discord_service.get_user_guild_member_info_with_cache(linked_account, business.discord_server)

    if "error" in member_info:
        return jsonify({"is_member": False, "reason": member_info["error"]}), 200

    user_roles = member_info.get("data", {}).get("roles", [])
    return jsonify({
        "is_member": True,
        "user_roles": user_roles,
        "cached": member_info.get("data", {}).get("cached", False)
    }), 200

# --- CONSOLIDATED DISCORD MANAGEMENT ROUTES (from business_routes.py) ---

@discord_api_bp.route('/businesses/<int:business_id>/discord-roles/sync', methods=['POST'])
@token_required
@business_context_required
@business_admin_scoped_permission_required(None)  # Just need business access
def sync_discord_roles_manually(business_id, business):
    """
    Manually trigger Discord role synchronization for a business.
    This can be called by business admins to refresh the role cache.
    """
    try:
        success, message = BusinessController._sync_discord_roles_for_business(business_id, g.current_user)

        if success:
            return jsonify({
                "message": message,
                "success": True
            }), 200
        else:
            return jsonify({
                "error": message,
                "success": False
            }), 400
    except Exception as e:
        current_app.logger.error(f"[MANUAL_DISCORD_SYNC] Error: {e}", exc_info=True)
        return jsonify({
            "error": "An unexpected error occurred during role synchronization.",
            "success": False
        }), 500

@discord_api_bp.route('/user/discord-info', methods=['GET'])
@token_required
def get_user_discord_info():
    """
    Get the current user's Discord connection and role information.
    Useful for frontend display and debugging.
    """
    try:
        user = g.current_user
        
        # Check if user has Discord linked
        linked_account = LinkedAccount.query.filter_by(user_id=user.id, provider='discord').first()
        
        response_data = {
            "discord_linked": bool(linked_account),
            "discord_id": user.discord_id,
            "discord_role_ids": user.discord_role_ids or [],
            "role_count": len(user.discord_role_ids or []),
            "last_sync": linked_account.updated_at.isoformat() if linked_account else None
        }
        
        if linked_account:
            response_data["discord_username"] = linked_account.name
            response_data["discord_email"] = linked_account.email
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching user Discord info: {e}", exc_info=True)
        return jsonify({
            "error": "Failed to fetch Discord information.",
            "discord_linked": False,
            "discord_role_ids": []
        }), 500

@discord_api_bp.route('/businesses/<int:business_id>/discord-status', methods=['GET'])
@token_required
@business_context_required
@business_admin_scoped_permission_required(None)  # Just need business access
def check_discord_status(business_id, business):
    """
    Check the Discord connection status for a business and current user.
    Helpful for debugging Discord integration issues.
    """
    # Check user's Discord account linking
    linked_account = LinkedAccount.query.filter_by(user_id=g.current_user.id, provider='discord').first()
    has_linked_account = bool(linked_account)
    
    # Check if Discord token can be decrypted
    token_valid = False
    if linked_account:
        try:
            token_valid = bool(token_service.decrypt_token(linked_account.access_token))
        except:
            token_valid = False
    
    # Check role cache
    role_cache = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()
    has_cached_roles = bool(role_cache and role_cache.roles_data)
    
    status = {
        "has_discord_server": bool(business.discord_server),
        "user_has_linked_discord": has_linked_account,
        "discord_token_valid": token_valid,
        "has_cached_roles": has_cached_roles,
    }
    
    return jsonify(status), 200

@discord_api_bp.route('/businesses/<int:business_id>/discord-roles-for-audience', methods=['GET'])
@token_required
@business_context_required
@business_admin_scoped_permission_required(None)  # Just need business access
def get_discord_roles_for_audience_selection(business_id, business):
    """
    Get Discord roles for a business formatted for audience selection in surveys.
    Returns role names with their IDs for easy selection in the frontend.
    """
    try:
        cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()
        
        # If cache is missing or empty, AND a discord server is configured, try to sync.
        if (not cache_entry or not cache_entry.roles_data) and business.discord_server:
            current_app.logger.info(f"Discord role cache empty for business {business_id}. Attempting a sync now.")
            
            success, message = BusinessController._sync_discord_roles_for_business(business_id, g.current_user)
            
            if not success:
                return jsonify({
                    "error": message,
                    "roles": []
                }), 400
            
            # Re-query the cache after sync
            cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()
        
        # Final check after potential sync
        if not cache_entry or not cache_entry.roles_data:
            error_message = "Discord roles could not be found or synced. "
            if not business.discord_server:
                error_message += "Please configure a Discord Server ID for this business first."
            else:
                error_message += "Please check the server ID and ensure the bot is invited with 'Administrator' permissions."
            
            return jsonify({"error": error_message, "roles": []}), 404
        
        # Format roles for audience selection (with both name and ID)
        formatted_roles = []
        for role in cache_entry.roles_data:
            formatted_roles.append({
                "id": role["id"],  # Role ID for storage
                "name": role["name"],  # Role name for display
                "color": role.get("color", 0),
                "position": role.get("position", 0)
            })
        
        # Sort by position (higher position = more important role)
        formatted_roles.sort(key=lambda x: x["position"], reverse=True)
        
        return jsonify({
            "roles": formatted_roles,
            "total_count": len(formatted_roles)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching Discord roles for audience selection: {e}", exc_info=True)
        return jsonify({
            "error": "An unexpected error occurred while fetching Discord roles.",
            "roles": []
        }), 500

@discord_api_bp.route('/user/discord-roles/sync', methods=['POST'])
@token_required
def sync_user_discord_roles():
    """
    Manually sync the current user's Discord roles across all guilds.
    Updates the User.discord_role_ids field with current role data.
    """
    try:
        # Check if user has Discord linked
        linked_account = LinkedAccount.query.filter_by(user_id=g.current_user.id, provider='discord').first()
        if not linked_account:
            return jsonify({
                "error": "Discord account not linked. Please link your Discord account first.",
                "success": False
            }), 400
        
        # Perform the role sync
        success = discord_service.sync_user_roles_for_all_guilds(linked_account)
        
        if success:
            # Get updated user data to return
            updated_user = User.query.get(g.current_user.id)
            return jsonify({
                "message": "Discord roles successfully synchronized.",
                "success": True,
                "role_count": len(updated_user.discord_role_ids or []),
                "discord_role_ids": updated_user.discord_role_ids or []
            }), 200
        else:
            return jsonify({
                "error": "Failed to sync Discord roles. Please check your Discord account connection.",
                "success": False
            }), 400
            
    except Exception as e:
        current_app.logger.error(f"Error syncing user Discord roles: {e}", exc_info=True)
        return jsonify({
            "error": "An unexpected error occurred during role synchronization.",
            "success": False
        }), 500 