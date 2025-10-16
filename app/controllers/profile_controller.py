"""
Profile Controller
Handles user profile management and XP rewards for profile completion
"""

from flask import request, jsonify
from ..models import db, User, Admin, ProfileTag, TagCategory, LinkedAccount
from .xp_badge_controller import award_xp_no_commit, calculate_profile_completion_xp, award_xp
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from flask import current_app

def get_profile(user_id):
    """
    Get user's profile data, including resolved tag names.
    
    Args:
        user_id: ID of user
        
    Returns:
        dict: User profile data or error dictionary
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        user_data = user.to_dict()

        # Resolve tag IDs from all categories into a single list of names
        all_tag_ids = []
        if user.interests:
            all_tag_ids.extend(user.interests)
        if user.owned_devices:
            all_tag_ids.extend(user.owned_devices)
        if user.memberships:
            all_tag_ids.extend(user.memberships)

        if all_tag_ids:
            # Query tags, remove duplicates if any tag is in multiple lists
            unique_tag_ids = list(set(all_tag_ids))
            tags = ProfileTag.query.filter(ProfileTag.id.in_(unique_tag_ids)).all()
            # Sort tags alphabetically for consistent display
            user_data['selected_tags'] = sorted([tag.name for tag in tags])
        else:
            user_data['selected_tags'] = []
            
        return user_data
        
    except Exception as e:
        # Log the exception for debugging
        current_app.logger.error(f"Error in get_profile for user {user_id}: {str(e)}", exc_info=True)
        return {'error': 'An unexpected error occurred while fetching the profile.', 'details': str(e)}

def update_profile(user_id, data):
    """
    Update user's profile and award a one-time 500 XP bonus for setting up tags.
    
    Args:
        user_id: ID of user
        data: Dictionary with profile updates (from request.json)
        
    Returns:
        dict: Updated profile data and XP earned, or error dictionary
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}, 404

        # Initialize tracking field if it's null
        if user.xp_profile_completion is None:
            user.xp_profile_completion = {}

        xp_awarded_this_update = 0
        xp_award_details = {'tags_setup': 0}

        # --- Fields that can be updated ---
        updatable_fields = ['username', 'name', 'gender', 'country', 'region', 'location', 'company', 'occupation', 'profile_image_url']
        for field in updatable_fields:
            if field in data:
                # Special handling for username to check for uniqueness
                if field == 'username' and data[field] != user.username:
                    new_username = data['username']
                    if not new_username.strip():
                        return {'error': 'Username cannot be empty'}, 400
                    existing_user = User.query.filter(User.username == new_username, User.id != user.id).first()
                    if existing_user:
                        return {'error': 'Username already taken'}, 409
                    user.username = new_username
                else:
                    setattr(user, field, data[field])

        # Support camelCase for profileImageUrl
        if 'profileImageUrl' in data and 'profile_image_url' not in data:
            user.profile_image_url = data['profileImageUrl']

        if 'dateOfBirth' in data:
            dob_str = data['dateOfBirth']
            if dob_str:
                try:
                    user.date_of_birth = datetime.strptime(dob_str, '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    return {'error': 'Invalid date of birth format. Use YYYY-MM-DD.'}, 400
            else:
                user.date_of_birth = None
        
        # --- Handle tags and award XP based on tag count (50 XP per tag) ---
        tag_categories = {
            'interests': 'interests',
            'owned_devices': 'owned_devices',
            'memberships': 'memberships'
        }

        current_total_tags = 0
        for key in tag_categories.keys():
            if key in data and isinstance(data[key], list):
                # Always update the user's tags
                setattr(user, key, data[key])
                current_total_tags += len(data[key])

        # Award XP ONLY for brand-new tags that have never been counted before
        # Keep a list of tag IDs that have already granted XP in xp_profile_completion["tag_ids_awarded"]
        completion_data = user.xp_profile_completion.copy()
        previously_awarded_ids = set(completion_data.get('tag_ids_awarded', []))

        # Build set of all currently selected tag IDs (deduplicated)
        current_tag_ids_set = set()
        for key in tag_categories.keys():
            current_tag_ids_set.update(data.get(key, getattr(user, key) or []))

        # Determine which of the current selections are completely new (never awarded before)
        new_unique_tag_ids = current_tag_ids_set - previously_awarded_ids

        # Log for debugging XP award logic
        current_app.logger.info(f"User {user_id} tag XP check: previously_awarded={len(previously_awarded_ids)}, current_selected={len(current_tag_ids_set)}, new_unique={len(new_unique_tag_ids)}")

        if new_unique_tag_ids:
            xp_to_award = len(new_unique_tag_ids) * 50  # 50 XP per brand-new tag

            from app.controllers.xp_badge_controller import award_xp_no_commit
            award_result = award_xp_no_commit(user.id, xp_to_award, 'PROFILE_TAGS_UPDATED')
            if not award_result.get('error'):
                current_app.logger.info(f"User {user_id} awarded {xp_to_award} XP for {len(new_unique_tag_ids)} new tags: {list(new_unique_tag_ids)}")
                # Update xp_profile_completion tracking data
                completion_data['tag_ids_awarded'] = list(previously_awarded_ids.union(new_unique_tag_ids))
                completion_data['tags_total_count'] = current_total_tags  # Keep count for reference
                user.xp_profile_completion = completion_data

                xp_awarded_this_update += xp_to_award
                xp_award_details['tags_setup'] = xp_to_award
            else:
                current_app.logger.error(f"User {user_id} XP award failed: {award_result}")
        else:
            current_app.logger.info(f"User {user_id} no new tags for XP - all {len(current_tag_ids_set)} tags already awarded")
            # Always sync latest tag count even if no XP was awarded
            completion_data['tags_total_count'] = current_total_tags
            user.xp_profile_completion = completion_data
 
        user.updated_at = datetime.utcnow()

        # Flag the xp_profile_completion field as modified for JSON mutation tracking
        db.session.add(user)
        db.session.commit()

        updated_profile_dict = user.to_dict()

        response = {
            'message': 'Profile updated successfully',
            'user': updated_profile_dict,
            'xp_earned': xp_awarded_this_update,  # Always include this field (0 if no XP earned)
            'xp_award_details': xp_award_details
            # Note: xp_profile_completion is included in updated_profile_dict
        }
        
        return response, 200

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"IntegrityError updating profile for user {user_id}: {str(e)}")
        if "UNIQUE constraint failed" in str(e) or "Duplicate entry" in str(e):
            return {'error': 'A unique value you entered (like username) is already taken.'}, 409
        return {'error': 'Database error: Could not update profile due to a conflict.', 'details': str(e)}, 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating profile for user {user_id}: {str(e)}", exc_info=True)
        return {'error': 'An unexpected error occurred while updating the profile.', 'details': str(e)}, 500

def get_available_tags(category=None):
    """
    Get available profile tags for selectors
    
    Args:
        category: Optional category filter (INTEREST, OWNED_DEVICE, MEMBERSHIP)
        
    Returns:
        dict: Categorized tags or filtered tags
    """
    try:
        query = ProfileTag.query
        
        if category:
            query = query.filter_by(category=category)
            tags = query.order_by(ProfileTag.name.asc()).all()
            return [tag.to_dict() for tag in tags]
        else:
            # Return all tags categorized
            all_tags = query.order_by(ProfileTag.name.asc()).all()
            categorized = {
                'INTEREST': [],
                'OWNED_DEVICE': [],
                'MEMBERSHIP': []
            }
            
            for tag in all_tags:
                if tag.category in categorized:
                    categorized[tag.category].append(tag.to_dict())
            
            return categorized
        
    except Exception as e:
        return {'error': str(e)}

# Admin functions for tag management

def create_profile_tag(tag_data):
    """
    Create a new profile tag (Admin only)
    
    Args:
        tag_data: Dictionary with tag information
        
    Returns:
        dict: Success/error response
    """
    try:
        required_fields = ['name', 'category']
        for field in required_fields:
            if field not in tag_data:
                return {'error': f'Missing required field: {field}'}
        
        # Validate category
        if tag_data['category'] not in [cat.value for cat in TagCategory]:
            return {'error': 'Invalid category'}
        
        # Check if tag already exists
        existing = ProfileTag.query.filter_by(name=tag_data['name']).first()
        if existing:
            return {'error': 'Tag with this name already exists'}
        
        tag = ProfileTag(
            name=tag_data['name'],
            category=tag_data['category']
        )
        
        db.session.add(tag)
        db.session.commit()
        
        return {
            'success': True,
            'tag': tag.to_dict()
        }
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def update_profile_tag(tag_id, tag_data):
    """
    Update a profile tag (Admin only)
    
    Args:
        tag_id: ID of tag to update
        tag_data: Dictionary with updated information
        
    Returns:
        dict: Success/error response
    """
    try:
        tag = ProfileTag.query.get(tag_id)
        if not tag:
            return {'error': 'Tag not found'}
        
        # Validate category if provided
        if 'category' in tag_data and tag_data['category'] not in [cat.value for cat in TagCategory]:
            return {'error': 'Invalid category'}
        
        # Check if new name conflicts (if name is being changed)
        if 'name' in tag_data and tag_data['name'] != tag.name:
            existing = ProfileTag.query.filter_by(name=tag_data['name']).first()
            if existing:
                return {'error': 'Tag with this name already exists'}
        
        # Update fields
        for field in ['name', 'category']:
            if field in tag_data:
                setattr(tag, field, tag_data[field])
        
        db.session.commit()
        
        return {
            'success': True,
            'tag': tag.to_dict()
        }
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def delete_profile_tag(tag_id):
    """
    Delete a profile tag (Admin only)
    
    Args:
        tag_id: ID of tag to delete
        
    Returns:
        dict: Success/error response
    """
    try:
        tag = ProfileTag.query.get(tag_id)
        if not tag:
            return {'error': 'Tag not found'}
        
        db.session.delete(tag)
        db.session.commit()
        
        return {'success': True}
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def get_all_profile_tags():
    """
    Get all profile tags (Admin only)
    
    Returns:
        dict: Categorized tags
    """
    try:
        tags = ProfileTag.query.order_by(ProfileTag.category.asc(), ProfileTag.name.asc()).all()
        categorized = {
            'INTEREST': [],
            'OWNED_DEVICE': [],
            'MEMBERSHIP': []
        }
        
        for tag in tags:
            if tag.category in categorized:
                categorized[tag.category].append(tag.to_dict())
        
        return categorized
        
    except Exception as e:
        return {'error': str(e)}

def get_linked_accounts(user_id):
    """
    Get all linked social accounts for a user.

    Args:
        user_id: The ID of the user.

    Returns:
        list: A list of dictionaries, each representing a linked social account,
              or an error dictionary.
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}, 404

        # Use LinkedAccount model and its fields
        linked_accounts = LinkedAccount.query.filter_by(user_id=user_id).all()
        
        accounts_data = []
        for acc in linked_accounts:
            # LinkedAccount model has 'provider', 'name', 'email' fields directly
            account_info = {
                'provider': acc.provider,
                'name': acc.name, 
                'email': acc.email
            }
            # Fallback for name if it's None, using email or a generic placeholder
            if not account_info['name']:
                if account_info['email']:
                    account_info['name'] = account_info['email']
                else:
                    account_info['name'] = f"{acc.provider.capitalize() if acc.provider else 'Linked'} Account"

            accounts_data.append(account_info)
            
        return accounts_data, 200

    except Exception as e:
        current_app.logger.error(f"Error in get_linked_accounts for user {user_id}: {str(e)}")
        return {'error': 'Failed to retrieve linked accounts', 'details': str(e)}, 500

def change_password(user_id, data, principal_hint=None):
    current_app.logger.info(f"[PROFILE_CTRL] Principal {user_id} attempting password change.")
    # Try user first unless hint indicates admin
    principal = None
    principal_type = None
    if principal_hint == 'admin':
        principal = Admin.query.get(user_id)
        principal_type = 'admin' if principal else None
        if not principal:
            principal = User.query.get(user_id)
            principal_type = 'user' if principal else None
    else:
        principal = User.query.get(user_id)
        principal_type = 'user' if principal else None
        if not principal:
            principal = Admin.query.get(user_id)
            principal_type = 'admin' if principal else None
    if not principal:
        # If not a regular user, try Admin table (covers super_admins created via db_setup)
        principal = Admin.query.get(user_id)
        principal_type = 'admin' if principal else None
    if not principal:
        current_app.logger.warning(f"[PROFILE_CTRL] Principal {user_id} not found in User or Admin tables for password change.")
        return {"error": "User not found"}, 404

    # Accept both snake_case and camelCase for frontend compatibility
    current_password = data.get('current_password') or data.get('currentPassword')
    new_password = data.get('new_password') or data.get('newPassword')

    if not current_password or not new_password:
        return {"error": "Current password and new password are required"}, 400

    if not principal.check_password(current_password):
        current_app.logger.warning(f"[PROFILE_CTRL] {principal_type} {user_id} provided incorrect current password.")
        return {"error": "Incorrect current password"}, 403

    if len(new_password) < 8:
        return {"error": "New password must be at least 8 characters long"}, 400

    try:
        principal.set_password(new_password)
        db.session.commit()
        current_app.logger.info(f"[PROFILE_CTRL] {principal_type} {user_id} password changed successfully.")
        return {"message": "Password updated successfully"}, 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[PROFILE_CTRL] Error changing password for user {user_id}: {e}", exc_info=True)
        return {"error": "Failed to update password", "details": str(e)}, 500

def unlink_social_account(user_id, provider_name):
    current_app.logger.info(f"[PROFILE_CTRL] User {user_id} attempting to unlink provider: {provider_name}.")
    user = User.query.get(user_id)
    if not user:
        current_app.logger.warning(f"[PROFILE_CTRL] User {user_id} not found for unlinking provider {provider_name}.")
        return {"error": "User not found"}, 404

    # Assuming LinkedAccount model is used and related_name is 'linked_accounts' on User model
    linked_account_to_delete = None
    for acc in user.linked_accounts:
        if acc.provider.lower() == provider_name.lower():
            linked_account_to_delete = acc
            break
    
    # Fallback if using direct fields on User model (e.g., user.discord_id, user.google_id)
    # This part is less ideal if LinkedAccount model is the standard
    if not linked_account_to_delete:
        provider_field_map = {
            'discord': 'discord_id',
            'twitter': 'x_id', # Assuming x_id for twitter
            'google': 'google_id',
            'meta': 'meta_id'
        }
        field_to_nullify = provider_field_map.get(provider_name.lower())
        if field_to_nullify and hasattr(user, field_to_nullify):
            setattr(user, field_to_nullify, None)
            # No separate LinkedAccount record to delete in this case, just save the user
            try:
                db.session.commit()
                current_app.logger.info(f"[PROFILE_CTRL] User {user_id} unlinked provider {provider_name} (direct field method).")
                return {"message": f"Successfully unlinked {provider_name}"}, 200
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"[PROFILE_CTRL] Error unlinking {provider_name} for user {user_id} (direct field): {e}", exc_info=True)
                return {"error": f"Failed to unlink {provider_name}", "details": str(e)}, 500
        # If neither LinkedAccount nor direct field found for this provider
        current_app.logger.warning(f"[PROFILE_CTRL] No linked account or direct field found for provider {provider_name} for user {user_id}.")
        return {"error": f"Account for {provider_name} not linked or provider not supported for direct unlinking."}, 404

    if linked_account_to_delete:
        try:
            db.session.delete(linked_account_to_delete)
            db.session.commit()
            current_app.logger.info(f"[PROFILE_CTRL] User {user_id} successfully unlinked provider: {provider_name} (LinkedAccount method).")
            return {"message": f"Successfully unlinked {provider_name}"}, 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PROFILE_CTRL] Error unlinking {provider_name} for user {user_id} (LinkedAccount): {e}", exc_info=True)
            return {"error": f"Failed to unlink {provider_name}", "details": str(e)}, 500
    
    # Should not be reached if logic is correct, but as a safeguard:
    return {"error": "Provider not found or could not be unlinked"}, 404

def mark_welcome_popup_seen(user_id):
    """
    Mark that the user has seen the welcome popup
    
    Args:
        user_id: ID of user
        
    Returns:
        dict: Success/error response
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}, 404
        
        user.has_seen_welcome_popup = True
        user.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        current_app.logger.debug(f"User {user_id} marked welcome popup as seen")
        
        return {
            'success': True,
            'message': 'Welcome popup marked as seen'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking welcome popup as seen for user {user_id}: {str(e)}", exc_info=True)
        return {'error': 'Failed to mark welcome popup as seen', 'details': str(e)}, 500 