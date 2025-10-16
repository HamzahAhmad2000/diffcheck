import requests
from flask import current_app
from ..extensions import db
from ..models import LinkedAccount, DiscordServerMembership
from . import token_service
import logging

logger = logging.getLogger(__name__)

def refresh_discord_token(linked_account: LinkedAccount):
    """Uses a refresh token to get a new access token from Discord."""
    decrypted_refresh_token = token_service.decrypt_token(linked_account.refresh_token)
    if not decrypted_refresh_token:
        logger.error(f"Could not decrypt refresh token for user {linked_account.user_id}")
        return None

    data = {
        'client_id': current_app.config['DISCORD_CLIENT_ID'],
        'client_secret': current_app.config['DISCORD_CLIENT_SECRET'],
        'grant_type': 'refresh_token',
        'refresh_token': decrypted_refresh_token,
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    r = requests.post("https://discord.com/api/v10/oauth2/token", data=data, headers=headers)

    if r.status_code != 200:
        error_data = r.text
        logger.error(f"Failed to refresh Discord token for user {linked_account.user_id}: {error_data}")
        
        # Handle specific "invalid_grant" error which indicates expired/revoked refresh token
        if "invalid_grant" in error_data:
            logger.warning(f"Discord refresh token expired for user {linked_account.user_id}. User needs to re-link their account.")
        
        return None
    
    new_token_data = r.json()
    new_access_token = new_token_data['access_token']
    new_refresh_token = new_token_data['refresh_token']
    
    linked_account.access_token = token_service.encrypt_token(new_access_token)
    linked_account.refresh_token = token_service.encrypt_token(new_refresh_token)
    db.session.commit()
    logger.info(f"Successfully refreshed Discord token for user {linked_account.user_id}")
    return new_access_token

def get_user_guild_member_info_with_cache(linked_account: LinkedAccount, server_id: str, force_refresh=False):
    """
    Fetches the user's member object for a specific server using cached data when possible.
    Falls back to Discord API when cache is expired or missing.
    """
    user_id = linked_account.user_id
    
    if not force_refresh:
        cached_membership = DiscordServerMembership.query.filter_by(
            user_id=user_id, discord_server_id=server_id
        ).first()
        
        if cached_membership and not cached_membership.is_expired():
            logger.info(f"Using cached Discord membership for user {user_id} in server {server_id}")
            if cached_membership.is_member:
                return {"data": {"roles": cached_membership.user_roles or [], "cached": True}}
            else:
                return {"error": "User is not a member of the required Discord server (cached)."}

    logger.info(f"Fetching Discord membership from API for user {user_id} in server {server_id}")
    access_token = token_service.decrypt_token(linked_account.access_token)
    if not access_token:
        return {"error": "Invalid access token state.", "status": 500}
    
    member_url = f"https://discord.com/api/v10/users/@me/guilds/{server_id}/member"
    headers = {'Authorization': f'Bearer {access_token}'}

    try:
        response = requests.get(member_url, headers=headers)
        
        if response.status_code == 401:
            logger.info(f"Access token expired for user {user_id}. Refreshing...")
            new_access_token = refresh_discord_token(linked_account)
            if not new_access_token:
                return {"error": "Authentication expired. Please link your account again.", "status": 401}
            headers['Authorization'] = f'Bearer {new_access_token}'
            response = requests.get(member_url, headers=headers)

        if response.status_code == 200:
            member_data = response.json()
            user_roles = member_data.get("roles", [])
            DiscordServerMembership.create_or_update(user_id, server_id, True, user_roles)
            db.session.commit()
            return {"data": {"roles": user_roles, "cached": False}}
            
        elif response.status_code == 404:
            DiscordServerMembership.create_or_update(user_id, server_id, False, [])
            db.session.commit()
            return {"error": "User is not a member of the required Discord server."}
        else:
            logger.error(f"Discord API Error for user {user_id} checking membership: {response.status_code} - {response.text}")
            response.raise_for_status()
            
    except Exception as e:
        logger.error(f"Unexpected error checking Discord membership for user {user_id}: {e}", exc_info=True)
        return {"error": "An unexpected error occurred while checking Discord roles."}

def get_server_roles(linked_account: LinkedAccount, server_id: str):
    """Fetches all roles from a server using an admin's OAuth token."""
    access_token = token_service.decrypt_token(linked_account.access_token)
    if not access_token:
        logger.error(f"Could not decrypt Discord access token for user {linked_account.user_id}")
        return None
    
    roles_url = f"https://discord.com/api/v10/guilds/{server_id}/roles"
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get(roles_url, headers=headers)

    # Handle expired user token by attempting refresh
    if response.status_code == 401:
        logger.info(f"Discord token expired for user {linked_account.user_id}, attempting refresh")
        new_access_token = refresh_discord_token(linked_account)
        if not new_access_token:
            logger.error(f"Failed to refresh Discord token for user {linked_account.user_id}")
        else:
            headers['Authorization'] = f'Bearer {new_access_token}'
            response = requests.get(roles_url, headers=headers)

    # If user-token request failed (403/404/401 etc.), attempt Bot token fallback if configured
    if not response.ok:
        user_response_status = response.status_code
        user_response_text = response.text
        logger.warning(
            f"User OAuth token could not fetch roles for server {server_id} (status {user_response_status}). "
            "Attempting bot token fallback if available."
        )
        bot_token = current_app.config.get('DISCORD_BOT_TOKEN')
        if bot_token:
            # Add .strip() to remove potential whitespace from the token in config
            bot_headers = {'Authorization': f'Bot {bot_token.strip()}'}
            bot_resp = requests.get(roles_url, headers=bot_headers)
            if bot_resp.ok:
                logger.info(f"Successfully fetched roles for server {server_id} using bot token fallback.")
                return bot_resp.json()
            else:
                logger.error(
                    f"CRITICAL: Bot token fallback also failed for server {server_id}: {bot_resp.status_code} - {bot_resp.text}"
                )
        else:
            logger.info("No DISCORD_BOT_TOKEN configured; cannot attempt bot fallback for role fetch.")

        # If we reach here, both user and bot attempts failed (or no bot token was available)
        logger.error(
            f"Ultimately failed to get roles for server {server_id}. Initial user token error was: {user_response_status} - {user_response_text}"
        )
        return None

    # Successful response with user token
    return response.json()

def check_user_discord_access(user, business, required_roles=None):
    """
    Optimized function to check if a user has Discord access to a business.
    Uses cached user role data for maximum performance.

    Args:
        user (User): The user to check.
        business (Business): The business context.
        required_roles (list, optional): List of required role IDs. Defaults to None.

    Returns:
        tuple: (has_access: bool, reason: str)
    """
    if not user:
        return False, "Anonymous user"
        
    # Check if user has linked Discord account and role data
    if not user.discord_id:
        return False, "Discord account not linked"
    
    # Check if business has Discord server configured
    server_id = business.discord_server
    if not server_id:
        return False, "Business Discord server not configured"
    
    # If no specific roles are required, just having Discord linked is enough
    if not required_roles:
        return True, "Access granted (Discord account linked)"

    # Use cached user role data for efficient access control
    if not user.discord_role_ids:
        return False, "No Discord role data available - please sync your Discord roles"
    
    user_roles = set(str(r) for r in user.discord_role_ids)
    required_role_set = set(str(r) for r in required_roles)

    if user_roles.intersection(required_role_set):
        return True, "Access granted (required role found in cached data)"
    else:
        return False, "Required Discord role not found in user's roles"

def get_user_guild_member_info(linked_account: LinkedAccount, server_id: str):
    """
    Legacy method - maintained for backward compatibility.
    Fetches the user's member object for a specific server using their OAuth token.
    Handles token refreshing.
    """
    return get_user_guild_member_info_with_cache(linked_account, server_id, force_refresh=True)

def sync_user_roles_for_all_guilds(linked_account: LinkedAccount):
    """Fetch and cache the user's roles for every guild they are a member of, and update User.discord_role_ids."""
    from ..models import User
    
    access_token = token_service.decrypt_token(linked_account.access_token)
    if not access_token:
        logger.error(
            f"Could not decrypt Discord access token for user {linked_account.user_id}"
        )
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    guilds_url = "https://discord.com/api/v10/users/@me/guilds"
    response = requests.get(guilds_url, headers=headers)

    if response.status_code == 401:
        logger.info(
            f"Access token expired for user {linked_account.user_id}. Refreshing..."
        )
        new_access_token = refresh_discord_token(linked_account)
        if not new_access_token:
            return False
        headers["Authorization"] = f"Bearer {new_access_token}"
        response = requests.get(guilds_url, headers=headers)

    if not response.ok:
        logger.error(
            f"Failed to fetch guild list for user {linked_account.user_id}: {response.status_code} - {response.text}"
        )
        return False

    guilds = response.json()
    all_user_role_ids = set()  # Use set to avoid duplicates
    
    for guild in guilds:
        server_id = str(guild.get("id"))
        if not server_id:
            continue
            
        # Get member info and cache it
        member_info = get_user_guild_member_info_with_cache(
            linked_account, server_id, force_refresh=True
        )
        
        # Extract role IDs from the member info
        if "data" in member_info and "roles" in member_info["data"]:
            user_roles = member_info["data"]["roles"]
            all_user_role_ids.update(user_roles)

    # Update the User model with all collected role IDs
    user = User.query.get(linked_account.user_id)
    if user:
        user.discord_role_ids = list(all_user_role_ids)
        logger.info(f"Updated user {linked_account.user_id} with {len(all_user_role_ids)} Discord role IDs")
    
    db.session.commit()
    return True

def extract_server_id_from_url(discord_url):
    """
    Extract Discord server ID from various Discord URL formats.
    
    Supported formats:
    - https://discord.gg/ABC123
    - https://discord.com/invite/ABC123
    - https://discordapp.com/invite/ABC123
    - Direct server ID: 1234567890123456789
    """
    if not discord_url:
        return None
    
    # If it's already a server ID (numeric string)
    if isinstance(discord_url, str) and discord_url.isdigit() and len(discord_url) >= 17:
        return discord_url
    
    # Handle URL formats
    if 'discord.gg/' in discord_url:
        invite_code = discord_url.split('discord.gg/')[-1].split('?')[0].split('#')[0]
        return resolve_invite_to_server_id(invite_code)
    elif 'discord.com/invite/' in discord_url:
        invite_code = discord_url.split('discord.com/invite/')[-1].split('?')[0].split('#')[0]
        return resolve_invite_to_server_id(invite_code)
    elif 'discordapp.com/invite/' in discord_url:
        invite_code = discord_url.split('discordapp.com/invite/')[-1].split('?')[0].split('#')[0]
        return resolve_invite_to_server_id(invite_code)
    
    return None

def resolve_invite_to_server_id(invite_code):
    """
    Resolve a Discord invite code to a server ID using Discord API.
    Note: This requires a bot token or user token with appropriate permissions.
    """
    try:
        # Use Discord API to resolve invite
        response = requests.get(f"https://discord.com/api/v10/invites/{invite_code}")
        if response.status_code == 200:
            invite_data = response.json()
            guild = invite_data.get('guild')
            if guild:
                return guild.get('id')
    except Exception as e:
        logger.error(f"Error resolving Discord invite {invite_code}: {str(e)}")
    
    return None 