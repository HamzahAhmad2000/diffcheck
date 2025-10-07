from flask import current_app, request, jsonify, g
from app.models import (
    db, Business, User, BusinessAudience, DiscordServerRoleCache, 
    LinkedAccount, Survey, SurveyAudience, Submission, Item, AIPointsUsageLog
)
from app.services import discord_service
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from datetime import datetime
import re
import logging

# Function moved from auth_controller.py
def _check_audience_rules(user_obj, audience_settings_obj, entity_type="Business"):
    """
    Helper to check audience rules.
    user_obj: The current user object (from g.current_user).
    audience_settings_obj: Instance of BusinessAudience or SurveyAudience.
    entity_type: "Business" or "Survey" for logging.
    """
    if not user_obj: # Anonymous user
        current_app.logger.debug(f"[{entity_type.upper()}_AUDIENCE] Anonymous user attempting access.")
        return False # Generally, anonymous users fail restricted access.

    if not audience_settings_obj:
        current_app.logger.debug(f"[{entity_type.upper()}_AUDIENCE] No audience settings defined for the entity. Access granted by default for this check.")
        return True # No specific rules, so access is permitted by this check

    user_email = user_obj.email.lower()
    # Explicitly lowercase the extracted domain as well
    raw_user_email_domain = user_email.split('@')[1] if '@' in user_email else None
    user_email_domain = raw_user_email_domain.lower() if raw_user_email_domain else None
    user_discord_id = user_obj.discord_id

    # 1. Specific Email Whitelist
    if audience_settings_obj.specific_email_whitelist and \
       user_email in [e.lower() for e in audience_settings_obj.specific_email_whitelist]:
        current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_email} access GRANTED via specific email whitelist.")
        return True

    # 2. Email Domain Whitelist
    # user_email_domain is already lowercased here
    if audience_settings_obj.email_domain_whitelist and \
       user_email_domain and \
       user_email_domain in [d.lower() for d in audience_settings_obj.email_domain_whitelist]:
        current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_email} access GRANTED via email domain whitelist ({user_email_domain}).")
        return True

    # 3. Discord Server Members Only Check
    if hasattr(audience_settings_obj, 'discord_server_members_only') and audience_settings_obj.discord_server_members_only:
        # Check if user is a member of the Discord server
        if not user_discord_id:
            current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User has no Discord account linked, access DENIED (Discord server members only).")
            return False
        
        # Get business to access discord_server field
        business = None
        if entity_type == "Business" and hasattr(g, 'target_business'):
            business = g.target_business
        elif entity_type == "Business" and hasattr(audience_settings_obj, 'business_id'):
            business = Business.query.get(audience_settings_obj.business_id)
        elif entity_type == "Survey" and hasattr(audience_settings_obj, 'survey_id'):
            survey = Survey.query.get(audience_settings_obj.survey_id)
            business = survey.business if survey else None
        elif entity_type == "Survey":
            business = audience_settings_obj.survey.business if hasattr(audience_settings_obj, 'survey') and audience_settings_obj.survey else None
        
        if business and business.discord_server:
            from app.services.discord_service import check_user_discord_access
            is_member, reason = check_user_discord_access(user_obj, business)
            if not is_member:
                current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_discord_id} access DENIED - {reason}")
                return False
            current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_discord_id} access GRANTED via Discord server membership.")
            # Don't return True here; let it check other conditions too
        else:
            current_app.logger.warning(f"[{entity_type.upper()}_AUDIENCE] Could not find business or Discord server for Discord server check.")
            return False
    
    # 4. Discord Roles Allowed - use the new user.discord_role_ids field for efficiency
    if audience_settings_obj.discord_roles_allowed and user_discord_id and user_obj.discord_role_ids:
        # Check if user has any of the required roles using the stored role IDs
        required_role_set = set(str(r) for r in audience_settings_obj.discord_roles_allowed)
        user_role_set = set(str(r) for r in user_obj.discord_role_ids)
        
        if user_role_set.intersection(required_role_set):
            current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_discord_id} access GRANTED via Discord role (cached).")
            return True
        else:
            current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_discord_id} access DENIED - required Discord role not found (cached check).")

    current_app.logger.info(f"[{entity_type.upper()}_AUDIENCE] User {user_email} access DENIED based on explicit rules.")
    return False

class BusinessController:
    @staticmethod
    def _parse_discord_server_id_from_string(value: str):
        """Extracts a Discord Server ID from a string. Now expects a direct ID."""
        if value and isinstance(value, str) and value.isdigit():
            return value
        
        # Optionally, you could still try to parse from a full channel URL as a fallback
        if value and isinstance(value, str):
            import re
            match = re.search(r'/channels/(\d+)', value)
            if match:
                return match.group(1)

        return None # Return None if it's not a valid ID format

    @staticmethod
    def _sync_discord_roles_for_business(business_id: int, acting_admin: User):
        """
        Fetches roles from Discord for a given business and caches them.
        This action can be performed by any admin with a linked Discord account
        that has administrator permissions on the target server.
        """
        business = Business.query.get(business_id)
        if not business:
            current_app.logger.warning(f"[SYNC_ROLES] Business {business_id} not found.")
            return False, "Business not found."
            
        if not business.discord_server:
            current_app.logger.warning(f"[SYNC_ROLES] Business {business_id} has no Discord server ID configured. Skipping sync.")
            return False, "Business has no Discord server ID configured."

        # Find the acting admin's linked Discord account
        linked_account = LinkedAccount.query.filter_by(user_id=acting_admin.id, provider='discord').first()
        if not linked_account:
            current_app.logger.error(f"[SYNC_ROLES] Admin {acting_admin.id} attempting to sync Business {business_id} does not have a linked Discord account.")
            return False, "Your Discord account is not linked. Please go to your profile settings and link your Discord account."

        try:
            current_app.logger.info(f"[SYNC_ROLES] Attempting to fetch roles for Discord server {business.discord_server} using admin {acting_admin.id}")
            
            # Use the discord_service to fetch roles using the admin's token (with bot fallback)
            roles = discord_service.get_server_roles(linked_account, business.discord_server)
            if roles is None:
                current_app.logger.error(f"[SYNC_ROLES] Failed to fetch roles for server {business.discord_server}. discord_service.get_server_roles returned None.")

                # Create a more detailed and helpful error message for the admin.
                error_message = (
                    "Failed to fetch Discord roles. This can happen for several reasons: "
                    "1) Your linked Discord account's authorization may have expired (try re-linking it in your profile). "
                    "2) The provided Discord Server ID may be incorrect. "
                    "3) The application's Discord Bot may not be in the server or may lack 'Administrator' permissions. "
                    "4) The backend configuration for the Discord Bot (DISCORD_BOT_TOKEN) might be invalid or misconfigured. "
                    "Please verify these points and try again. Check server logs for more specific details."
                )
                return False, error_message

            current_app.logger.info(f"[SYNC_ROLES] Successfully fetched {len(roles)} roles from Discord server {business.discord_server}")

            # Format and filter roles (exclude @everyone which doesn't provide meaningful access control)
            formatted_roles = []
            for role in roles:
                if role.get('name') != '@everyone':
                    formatted_role = {
                        "id": str(role["id"]), 
                        "name": role["name"], 
                        "color": role.get("color", 0), 
                        "position": role.get("position", 0)
                    }
                    formatted_roles.append(formatted_role)

            current_app.logger.info(f"[SYNC_ROLES] Formatted {len(formatted_roles)} roles (excluding @everyone)")

            # Upsert into the cache
            cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()
            if not cache_entry:
                cache_entry = DiscordServerRoleCache(business_id=business_id)
                db.session.add(cache_entry)
                current_app.logger.info(f"[SYNC_ROLES] Created new role cache entry for business {business_id}")
            else:
                current_app.logger.info(f"[SYNC_ROLES] Updating existing role cache entry for business {business_id}")
            
            cache_entry.roles_data = formatted_roles
            db.session.commit()
            
            current_app.logger.info(f"[SYNC_ROLES] Successfully synced {len(formatted_roles)} roles for Business ID {business_id}.")
            return True, f"Successfully synced {len(formatted_roles)} Discord roles."
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[SYNC_ROLES] Exception during role sync for Business ID {business_id}: {e}", exc_info=True)
            return False, f"An unexpected error occurred during role synchronization: {str(e)}"

    @staticmethod
    def create_business(data, creating_admin_id): # Assuming creating_admin_id is passed
        current_app.logger.info(f"[CREATE_BUSINESS] Incoming data: {data}, creating_admin_id: {creating_admin_id}")
        required_fields = ['name', 'tier']
        for field in required_fields:
            if field not in data or not data[field]:
                current_app.logger.warning(f"[CREATE_BUSINESS] Missing required field: {field}")
                return {"error": f"Missing required field: {field}"}, 400

        if Business.query.filter_by(name=data['name']).first():
            current_app.logger.warning(f"[CREATE_BUSINESS] Duplicate business name: {data['name']}")
            return {"error": "A business with this name already exists."}, 409 # Conflict

        try:
            # Look up the tier_id based on tier name
            tier_id = None
            if data['tier']:
                from app.models import BusinessTier
                tier_obj = BusinessTier.query.filter_by(name=data['tier'].capitalize()).first()
                if tier_obj:
                    tier_id = tier_obj.id
                else:
                    current_app.logger.warning(f"[CREATE_BUSINESS] Tier '{data['tier']}' not found in BusinessTier table, creating without tier_id")
            
            new_business = Business(
                name=data['name'],
                location=data.get('location'),
                tier=data['tier'],
                tier_id=tier_id,  # Set the foreign key relationship
                website=data.get('website'),
                permissions=data.get('permissions', {}), # Expecting a JSON object
                is_approved=True, # Super admin created businesses are auto-approved
                is_active=True
            )
            db.session.add(new_business)
            db.session.flush()  # Flush to get the ID before initializing billing
            
            # Initialize billing cycle if tier has monthly points
            if new_business.tier in ['advanced', 'super']:
                success, billing_message = BusinessController.initialize_billing_cycle(new_business.id)
                if not success:
                    current_app.logger.warning(f"[CREATE_BUSINESS] Failed to initialize billing cycle: {billing_message}")
                    # Continue anyway, billing cycle can be initialized later
            
            db.session.commit()
            current_app.logger.info(f"[CREATE_BUSINESS] Business '{new_business.name}' created successfully by admin ID {creating_admin_id}.")
            current_app.logger.debug(f"[CREATE_BUSINESS] Business object: {new_business.to_dict()}")
            return {"message": "Business created successfully", "business": new_business.to_dict()}, 201
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_BUSINESS] Database integrity error: {e}")
            return {"error": "Database error: Could not create business due to integrity constraint. Check unique fields."}, 500
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_BUSINESS] Unexpected error: {e}", exc_info=True)
            return {"error": "An unexpected error occurred while creating the business.", "details": str(e)}, 500

    @staticmethod
    def list_businesses(args):
        current_app.logger.info(f"[LIST_BUSINESSES] Query args: {args}")
        try:
            query = Business.query
            search_name = args.get('name')
            if search_name:
                current_app.logger.info(f"[LIST_BUSINESSES] Filtering by name: {search_name}")
                query = query.filter(Business.name.ilike(f"%{search_name}%"))
            tier = args.get('tier')
            if tier:
                current_app.logger.info(f"[LIST_BUSINESSES] Filtering by tier: {tier}")
                query = query.filter_by(tier=tier)
            is_approved_str = args.get('is_approved')
            if is_approved_str is not None:
                is_approved = is_approved_str.lower() == 'true'
                current_app.logger.info(f"[LIST_BUSINESSES] Filtering by is_approved: {is_approved}")
                query = query.filter_by(is_approved=is_approved)
            businesses = query.order_by(Business.created_at.desc()).all()
            current_app.logger.info(f"[LIST_BUSINESSES] Found {len(businesses)} businesses.")
            return [b.to_dict() for b in businesses], 200
        except Exception as e:
            current_app.logger.error(f"[LIST_BUSINESSES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve businesses", "details": str(e)}, 500

    @staticmethod
    def check_user_access(user, business_id):
        """Check if a user has access to a business - admins get complete bypass"""
        business = Business.query.get(business_id)
        if not business:
            return False

        # ADMIN BYPASS - Check admin status FIRST before any other checks
        from flask import g
        user_role = getattr(g, 'user_role', None)
        if user_role == 'super_admin':
            current_app.logger.info(f"[BUSINESS_ACCESS] ✅ Super admin bypass granted for business {business_id}")
            return True
        elif user_role == 'business_admin' and user:
            # Business admin can access their own business regardless of audience settings
            if user.business_id == business_id:
                current_app.logger.info(f"[BUSINESS_ACCESS] ✅ Business admin bypass granted for own business {business_id}")
                return True
            else:
                current_app.logger.warning(f"[BUSINESS_ACCESS] ❌ Business admin {user.id} cannot access different business")
                return False
            
        # If business is public, everyone has access
        if business.audience_type == 'PUBLIC':
            return True
            
        # For restricted business, use the _check_audience_rules helper
        return _check_audience_rules(user, business.audience_settings, "Business")

    @staticmethod
    def check_survey_access(user, survey_id):
        """
        Checks if a user has access to a survey based on its restrictions and audience settings.
        Returns a tuple (bool, str) where bool indicates access and str provides the reason.
        Admins get complete bypass of audience restrictions.
        """
        survey = Survey.query.get(survey_id)
        if not survey:
            return False, "Survey not found."

        # ADMIN BYPASS - Check admin status FIRST before any other checks
        from flask import g
        user_role = getattr(g, 'user_role', None)
        if user_role == 'super_admin':
            current_app.logger.info(f"[SURVEY_ACCESS] ✅ Super admin bypass granted in BusinessController for survey {survey_id}")
            return True, "Super admin bypass - full access granted."
        elif user_role == 'business_admin' and user:
            # Business admin can access surveys from their business regardless of audience settings
            if user.business_id == survey.business_id:
                current_app.logger.info(f"[SURVEY_ACCESS] ✅ Business admin bypass granted in BusinessController for own business survey {survey_id}")
                return True, "Business admin bypass - access granted for own business survey."
            else:
                current_app.logger.warning(f"[SURVEY_ACCESS] ❌ Business admin {user.id} cannot access survey from different business")
                return False, "Business admin can only access surveys from their own business."

        # If survey is not restricted, access is granted
        if not survey.is_restricted:
            return True, "Survey is not restricted."
        
        # If survey is restricted, proceed with detailed audience checks
        # Unlinked survey - if restricted, apply its specific rules directly
        if not survey.business:
            if survey.audience_settings and survey.audience_settings.access_type == 'SPECIFIC_RULES':
                has_access = _check_audience_rules(user, survey.audience_settings, "Survey (unlinked)")
                return has_access, "Checked against specific rules for unlinked survey."
            # If restricted without valid rules, deny access
            return False, "Unlinked survey is restricted with no applicable rules."
            
        # For business surveys, first check business access
        if not BusinessController.check_user_access(user, survey.business_id):
            return False, f"You do not have access to the business that owns this survey."

        # Check survey-specific audience settings
        survey_audience = survey.audience_settings
        if not survey_audience:
            return False, "Restricted survey is misconfigured (no audience settings)."

        # Handle different access types
        if survey_audience.access_type == 'BUSINESS_AUDIENCE':
            return True, "Access granted via business audience settings."
        
        if survey_audience.access_type == 'PUBLIC_TO_BUSINESS_USERS':
            return True, "Access granted to all users of the business."
        
        # Tag-based restriction check
        if survey_audience.required_tags:
            if not user or not hasattr(user, 'interests') or not user.interests:
                return False, "This survey requires specific profile tags which you do not have."

            user_interest_tags = set(user.interests)
            required_tags_set = set(survey_audience.required_tags)

            if survey_audience.tag_matching_logic == 'ALL':
                if not required_tags_set.issubset(user_interest_tags):
                    return False, "You must have all required profile tags to access this survey."
            elif survey_audience.tag_matching_logic == 'ANY':
                if not user_interest_tags.intersection(required_tags_set):
                    return False, "You do not have any of the required profile tags to access this survey."
            else:
                return False, "Survey has an invalid tag matching configuration."

        # Check specific rules if applicable
        if survey_audience.access_type == 'SPECIFIC_RULES':
            has_access = _check_audience_rules(user, survey_audience, "Survey")
            return has_access, "Checked against specific survey rules."

        # Default deny if no rule matched
        return False, "No applicable audience rule was met."

    @staticmethod
    def check_public_access(business_id):
        """Check if a business is public and active"""
        business = Business.query.get(business_id)
        if not business:
            return False
            
        return business.is_active and business.is_approved

    @staticmethod
    def get_business(business_id):
        """Get a business by ID"""
        return Business.query.get(business_id)

    @staticmethod
    def list_public_businesses(args):
        """List public businesses with filtering, considering user access for survey counts and visibility."""
        current_app.logger.info(f"[LIST_PUBLIC_BUSINESSES] Query args: {args}")
        # Rely on g.current_user and g.user_role set by @token_optional decorator in the route
        current_user = g.get('current_user', None) 
        user_role = g.get('user_role', None)

        current_app.logger.info(f"[LIST_PUBLIC_BUSINESSES] Authenticated User: {current_user.username if current_user else 'Anonymous'}, Role: {user_role}")

        try:
            query = Business.query.filter_by(is_active=True, is_approved=True)

            search_name = args.get('name')
            if search_name:
                query = query.filter(Business.name.ilike(f"%{search_name}%"))

            # Optional filtering by tier
            tier = args.get('tier')
            if tier:
                query = query.filter(Business.tier == tier)

            # Optional filtering by featured flag
            is_featured_param = args.get('is_featured')
            if is_featured_param is not None:
                str_val = str(is_featured_param).lower()
                if str_val in ['true', '1', 'yes']:
                    query = query.filter(Business.is_featured.is_(True))
                elif str_val in ['false', '0', 'no']:
                    query = query.filter(Business.is_featured.is_(False))
                
            all_businesses_matching_filter = query.order_by(Business.created_at.desc()).all()
            
            result_businesses = []
            for business in all_businesses_matching_filter:
                # Check if the current user (if any) can access this business
                if current_user:
                    if not BusinessController.check_user_access(current_user, business.id):
                        current_app.logger.debug(f"[LIST_PUBLIC_BUSINESSES] User {current_user.id} does not have access to business {business.id} ('{business.name}'). Skipping.")
                        continue # Skip this business if user cannot access it
                elif business.audience_type == 'RESTRICTED':
                    # Anonymous user trying to access a restricted business, skip it
                    current_app.logger.debug(f"[LIST_PUBLIC_BUSINESSES] Anonymous user cannot access restricted business {business.id} ('{business.name}'). Skipping.")
                    continue

                business_dict = business.to_dict()
                if business.audience_settings:
                    business_dict['audience_settings'] = business.audience_settings.to_dict()

                # Calculate accessible survey count and total questions for XP calculation
                accessible_survey_count = 0
                total_survey_questions = 0
                
                # Fetch published, non-archived surveys for this business
                surveys_for_business = Survey.query.filter_by(
                    business_id=business.id, 
                    published=True, 
                    is_archived=False
                ).all()

                if current_user: # If a user is logged in, check access for each survey
                    for survey in surveys_for_business:
                        has_access, reason = BusinessController.check_survey_access(current_user, survey.id)
                        if has_access:
                            accessible_survey_count += 1
                            total_survey_questions += (survey.questions.count() or 0)
                else: # For anonymous users, also check access for each survey
                    for survey in surveys_for_business:
                        has_access, reason = BusinessController.check_survey_access(None, survey.id) # Pass None for anonymous user
                        if has_access:
                            accessible_survey_count += 1
                            total_survey_questions += (survey.questions.count() or 0)
                
                # Calculate total earnable XP
                total_quest_xp = 0  # Placeholder for when quest system is implemented
                total_earnable_xp = (total_survey_questions * 30) + total_quest_xp
                
                business_dict['survey_count'] = accessible_survey_count # This now means accessible surveys
                business_dict['total_survey_questions'] = total_survey_questions
                business_dict['total_quest_xp'] = total_quest_xp
                business_dict['total_earnable_xp'] = total_earnable_xp
                
                current_app.logger.debug(f"[LIST_PUBLIC_BUSINESSES] Business '{business.name}' accessible_survey_count: {accessible_survey_count}")
                result_businesses.append(business_dict)
                
            current_app.logger.info(f"[LIST_PUBLIC_BUSINESSES] Found {len(result_businesses)} accessible businesses for the user.")
            return {"businesses": result_businesses}, 200
            
        except Exception as e:
            current_app.logger.error(f"[LIST_PUBLIC_BUSINESSES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve businesses", "details": str(e)}, 500

    @staticmethod
    def get_public_business_details(business_id):
        """Get public details of a business with total earnable XP calculation"""
        try:
            business = Business.query.get(business_id)
            if not business or not business.is_active or not business.is_approved:
                return {"error": "Business not found or not accessible"}, 404
                
            result = business.to_dict()
            if business.audience_settings:
                result['audience_settings'] = business.audience_settings.to_dict()

            # Calculate total earnable XP
            from app.models import Survey
            from app.controllers.idea_controller import IdeaController

            # Get total questions from all published surveys
            surveys = Survey.query.filter(
                Survey.business_id == business_id,
                Survey.published == True,
                Survey.is_archived == False
            ).all()
            
            total_survey_questions = 0
            for survey in surveys:
                total_survey_questions += survey.questions.count()
            
            # For now, set quest XP to 0 since quests aren't fully implemented
            # When quest system is ready, calculate: sum(Quest.xp_reward) for active quests
            total_quest_xp = 0
            
            result['total_survey_questions'] = total_survey_questions
            result['total_quest_xp'] = total_quest_xp
            result['total_earnable_xp'] = (total_survey_questions * 30) + total_quest_xp

            # Attach top ideas summary
            try:
                current_user = getattr(g, 'current_user', None)
                current_user_id = current_user.id if current_user else None
                result['top_ideas'] = IdeaController.list_top_ideas(
                    business_id,
                    current_user_id=current_user_id,
                )
            except Exception as summary_err:
                current_app.logger.error(f"[GET_PUBLIC_BUSINESS] Failed to load top ideas: {summary_err}")
                result['top_ideas'] = []

            return result, 200

        except Exception as e:
            current_app.logger.error(f"[GET_PUBLIC_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business details", "details": str(e)}, 500

    # ===== BUSINESS AUDIENCE MANAGEMENT METHODS =====

    @staticmethod
    def get_business_audience(business_id):
        """Get audience settings for a business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            audience = business.audience_settings
            if audience:
                result = audience.to_dict()
                result['audience_type'] = business.audience_type
                return result, 200
            else:
                # Return default settings
                return {
                    "business_id": business_id,
                    "audience_type": business.audience_type,
                    "email_domain_whitelist": [],
                    "specific_email_whitelist": [],
                    "discord_roles_allowed": [],
                    "qr_code_token": None,
                    "qr_code_expires_at": None
                }, 200
                
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_AUDIENCE] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve audience settings", "details": str(e)}, 500

    @staticmethod
    def update_business_audience(business_id, data):
        """Update audience settings for a business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            # Update business audience type
            if 'audience_type' in data:
                if data['audience_type'] in ['PUBLIC', 'RESTRICTED']:
                    business.audience_type = data['audience_type']
                else:
                    return {"error": "Invalid audience_type. Must be 'PUBLIC' or 'RESTRICTED'"}, 400
                    
            # Get or create business audience settings
            audience = business.audience_settings
            if not audience:
                audience = BusinessAudience(business_id=business_id)
                db.session.add(audience)
                
            # Update audience settings

            audience.email_domain_whitelist = data['email_domain_whitelist']
            
            audience.specific_email_whitelist = data['specific_email_whitelist']
            audience.discord_roles_allowed = data['discord_roles_allowed']
            audience.discord_server_members_only = data.get('discord_server_members_only', False)
                
            db.session.commit()
            
            result = audience.to_dict()
            result['audience_type'] = business.audience_type
            
            return {"message": "Business audience updated successfully", "audience": result}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_BUSINESS_AUDIENCE] Error: {e}", exc_info=True)
            return {"error": "Failed to update audience settings", "details": str(e)}, 500

    @staticmethod
    def generate_business_qr_code(business_id, data):
        """Generate QR code for business access"""
        try:
            import secrets
            
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            # Get or create business audience settings
            audience = business.audience_settings
            if not audience:
                audience = BusinessAudience(business_id=business_id)
                db.session.add(audience)
                
            # Generate new QR code token
            audience.qr_code_token = secrets.token_urlsafe(32)
            
            # Set expiry if provided
            if 'expires_at' in data and data['expires_at']:
                from datetime import datetime
                try:
                    audience.qr_code_expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
                except ValueError:
                    return {"error": "Invalid expires_at format. Use ISO format."}, 400
            else:
                audience.qr_code_expires_at = None
                
            db.session.commit()
            
            return {
                "qr_code_token": audience.qr_code_token,
                "qr_code_url": f"/access/business/{audience.qr_code_token}",
                "expires_at": audience.qr_code_expires_at.isoformat() if audience.qr_code_expires_at else None
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[GENERATE_BUSINESS_QR] Error: {e}", exc_info=True)
            return {"error": "Failed to generate QR code", "details": str(e)}, 500

    @staticmethod
    def revoke_business_qr_code(business_id):
        """Revoke QR code for business access"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            audience = business.audience_settings
            if audience and audience.qr_code_token:
                audience.qr_code_token = None
                audience.qr_code_expires_at = None
                db.session.commit()
                return {"message": "QR code revoked successfully"}, 200
            else:
                return {"error": "No QR code found to revoke"}, 404
                
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[REVOKE_BUSINESS_QR] Error: {e}", exc_info=True)
            return {"error": "Failed to revoke QR code", "details": str(e)}, 500

    @staticmethod
    def access_business_via_qr(qr_token):
        """Access business via QR code token"""
        try:
            from datetime import datetime
            
            audience = BusinessAudience.query.filter_by(qr_code_token=qr_token).first()
            if not audience:
                return {"error": "Invalid QR code"}, 404
                
            # Check if QR code has expired
            if audience.qr_code_expires_at and audience.qr_code_expires_at < datetime.utcnow():
                return {"error": "QR code has expired"}, 410  # Gone
                
            business = audience.business
            if not business or not business.is_active or not business.is_approved:
                return {"error": "Business not accessible"}, 404
                
            return {
                "business_id": business.id,
                "business_name": business.name,
                "business": business.to_dict()
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[ACCESS_BUSINESS_VIA_QR] Error: {e}", exc_info=True)
            return {"error": "Failed to access business", "details": str(e)}, 500

    @staticmethod
    def join_business_via_qr(qr_token, user_email):
        """Join business audience via QR code (for authenticated users)"""
        try:
            from datetime import datetime
            
            audience = BusinessAudience.query.filter_by(qr_code_token=qr_token).first()
            if not audience:
                return {"error": "Invalid QR code"}, 404
                
            # Check if QR code has expired
            if audience.qr_code_expires_at and audience.qr_code_expires_at < datetime.utcnow():
                return {"error": "QR code has expired"}, 410
                
            business = audience.business
            if not business or not business.is_active or not business.is_approved:
                return {"error": "Business not accessible"}, 404
                
            # Add user email to specific whitelist if not already there
            if not audience.specific_email_whitelist:
                audience.specific_email_whitelist = []
                
            if user_email not in audience.specific_email_whitelist:
                audience.specific_email_whitelist.append(user_email)
                db.session.commit()
                
                return {
                    "message": "Successfully joined business audience",
                    "business_id": business.id,
                    "business_name": business.name
                }, 200
            else:
                return {
                    "message": "You already have access to this business",
                    "business_id": business.id,
                    "business_name": business.name
                }, 200
                
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[JOIN_BUSINESS_VIA_QR] Error: {e}", exc_info=True)
            return {"error": "Failed to join business", "details": str(e)}, 500

    # ===== ADDITIONAL BUSINESS MANAGEMENT METHODS =====

    @staticmethod
    def get_business_details(business_id):
        """Get detailed business information (Admin access)"""
        try:
            business = Business.query.options(db.joinedload(Business.tier_info)).get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            result = business.to_dict()
            
            # Include audience settings for admin view
            if business.audience_settings:
                result['audience_settings'] = business.audience_settings.to_dict()
                
            # Include additional admin information
            result['total_surveys'] = business.surveys.count()
            # result['total_quests'] = business.quests.count() if hasattr(business, 'quests') else 0
            
            # Include current admin count for seat management
            current_admin_count = User.query.filter_by(
                business_id=business_id, 
                role='business_admin'
            ).count()
            result['current_admin_count'] = current_admin_count
            
            # Handle items count safely
            try:
                if hasattr(business, 'items') and business.items is not None:
                    # Check if it's a query object or a list
                    if hasattr(business.items, 'count') and callable(business.items.count):
                        result['total_items'] = business.items.count()
                    else:
                        result['total_items'] = len(business.items) if business.items else 0
                else:
                    result['total_items'] = 0
            except Exception as e:
                current_app.logger.warning(f"[GET_BUSINESS_DETAILS] Could not get items count: {e}")
                result['total_items'] = 0
                
            try:
                if hasattr(business, 'activities') and business.activities is not None:
                    # Check if it's a query object or a list
                    if hasattr(business.activities, 'count') and callable(business.activities.count):
                        result['total_activities'] = business.activities.count()
                    else:
                        result['total_activities'] = len(business.activities) if business.activities else 0
                else:
                    result['total_activities'] = 0
            except Exception as e:
                current_app.logger.warning(f"[GET_BUSINESS_DETAILS] Could not get activities count: {e}")
                result['total_activities'] = 0
            
            return result, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_DETAILS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business details", "details": str(e)}, 500

    @staticmethod
    def update_business_details(business_id, data, updating_admin_id):
        """Update business details (Super Admin or assigned Business Admin)"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404

            original_discord_server = business.discord_server
            
            # --- MODIFICATION START ---
            # Allow Business Admins to update certain fields of their own business
            user_role = getattr(g, 'user_role', None)
            is_super_admin = user_role == 'super_admin'
            is_owner_admin = user_role == 'business_admin' and g.current_user.business_id == business_id

            if not (is_super_admin or is_owner_admin):
                 return {"error": "Access denied."}, 403
            # --- MODIFICATION END ---
                
            # Update basic fields
            if 'name' in data and is_super_admin: # Only super admin can change name
                existing = Business.query.filter(Business.name == data['name'], Business.id != business_id).first()
                if existing:
                    return {"error": "A business with this name already exists"}, 409
                business.name = data['name']
            
            # Fields updatable by both super admin and owner admin
            updatable_by_owner = ['location', 'website'] # discord_server handled separately
            for field in updatable_by_owner:
                if field in data:
                    setattr(business, field, data[field])
            
            new_discord_server_id = None
            if 'discord_server' in data:
                new_discord_server_id = BusinessController._parse_discord_server_id_from_string(data['discord_server'])

            # Fields updatable only by super admin
            if is_super_admin:
                if 'tier' in data: business.tier = data['tier']
                if 'permissions' in data: business.permissions = data['permissions']
                if 'is_active' in data: business.is_active = data['is_active']
                if 'is_approved' in data: business.is_approved = data['is_approved']
                if 'is_featured' in data: business.is_featured = data['is_featured']
            
            if 'audience_type' in data: business.audience_type = data['audience_type']
            if 'default_public_on_wall' in data: business.default_public_on_wall = data['default_public_on_wall']
                
            # --- MODIFICATION START ---
            # If discord server is being changed, attempt to sync before committing all changes.
            if new_discord_server_id != original_discord_server:
                updating_admin = User.query.get(updating_admin_id)
                
                if new_discord_server_id: # If a new server ID is provided
                    current_app.logger.info(f"Discord server ID changed for business {business_id}. Attempting role sync before saving.")
                    if updating_admin and (is_super_admin or is_owner_admin):
                        # Temporarily set the new server ID on the business object for the sync function to use
                        business.discord_server = new_discord_server_id
                        sync_success, sync_message = BusinessController._sync_discord_roles_for_business(business_id, updating_admin)
                        if not sync_success:
                            # Log the warning but don't fail the entire update - sync can be done later
                            current_app.logger.warning(f"Discord sync failed but continuing with business update: {sync_message}")
                            # Don't revert the server ID change, just log the sync failure
                    else:
                        current_app.logger.warning(f"User {updating_admin_id} doesn't have permission to sync Discord roles, but business update will continue.")
                else: # If server ID is being cleared
                    current_app.logger.info(f"Discord server ID cleared for business {business_id}. Removing cached roles.")
                    cache_entry = DiscordServerRoleCache.query.filter_by(business_id=business_id).first()
                    if cache_entry:
                        db.session.delete(cache_entry)
                    business.discord_server = None
            # --- MODIFICATION END ---
            
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_BUSINESS] Business {business_id} updated by admin {updating_admin_id}")
            return {"message": "Business updated successfully", "business": business.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to update business", "details": str(e)}, 500

    @staticmethod
    def delete_business_permanently(business_id, deleting_admin_id):
        """Delete business permanently (Super Admin only)"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            business_name = business.name
            db.session.delete(business)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_BUSINESS] Business '{business_name}' (ID: {business_id}) deleted by admin {deleting_admin_id}")
            return {"message": f"Business '{business_name}' deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to delete business", "details": str(e)}, 500

    # ===== BUSINESS REQUEST WORKFLOW METHODS =====

    @staticmethod
    def request_business_creation(data, requesting_user_id):
        """Allow users to request a new business (pending approval)"""
        try:
            required_fields = ['name', 'tier']
            for field in required_fields:
                if field not in data or not data[field]:
                    return {"error": f"Missing required field: {field}"}, 400

            if Business.query.filter_by(name=data['name']).first():
                return {"error": "A business with this name already exists or is pending approval"}, 409

            new_business = Business(
                name=data['name'],
                location=data.get('location'),
                tier=data['tier'],
                website=data.get('website'),
                permissions=data.get('permissions', {}),
                is_approved=False,  # Pending approval
                is_active=False,    # Not active until approved
                requested_by_user_id=requesting_user_id
            )
            
            db.session.add(new_business)
            db.session.commit()
            
            current_app.logger.info(f"[REQUEST_BUSINESS] Business request '{new_business.name}' submitted by user {requesting_user_id}")
            return {"message": "Business request submitted successfully. Awaiting admin approval.", "business": new_business.to_dict()}, 201
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[REQUEST_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to submit business request", "details": str(e)}, 500

    @staticmethod
    def approve_business_request(business_id, approving_admin_id):
        """Approve a pending business request (Super Admin only)"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            if business.is_approved:
                return {"error": "Business is already approved"}, 400
                
            business.is_approved = True
            business.is_active = True
            db.session.commit()
            
            current_app.logger.info(f"[APPROVE_BUSINESS] Business '{business.name}' (ID: {business_id}) approved by admin {approving_admin_id}")
            return {"message": f"Business '{business.name}' approved successfully", "business": business.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[APPROVE_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to approve business", "details": str(e)}, 500

    @staticmethod
    def reject_business_request(business_id, rejecting_admin_id):
        """Reject and delete a pending business request (Super Admin only)"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
                
            if business.is_approved:
                return {"error": "Cannot reject an already approved business"}, 400
                
            business_name = business.name
            db.session.delete(business)
            db.session.commit()
            
            current_app.logger.info(f"[REJECT_BUSINESS] Business request '{business_name}' (ID: {business_id}) rejected by admin {rejecting_admin_id}")
            return {"message": f"Business request '{business_name}' rejected and removed"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[REJECT_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to reject business request", "details": str(e)}, 500

    @staticmethod
    def list_surveys_for_business(business_id):
        """List surveys for a specific business with user completion status and proper access control"""
        try:
            from app.models import Business, Survey, Submission
            from flask import g
            
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            # Check if business is active and approved
            if not business.is_active or not business.is_approved:
                return {"error": "Business is not available"}, 404
            
            # Get user information for completion checking
            current_user = getattr(g, 'current_user', None)
            user_role = getattr(g, 'user_role', 'user')
            
            # Get surveys for the business
            all_surveys = Survey.query.filter_by(
                business_id=business_id, 
                published=True, 
                is_archived=False
            ).order_by(Survey.created_at.desc()).all()
            
            current_app.logger.info(f"[LIST_SURVEYS_FOR_BUSINESS] Found {len(all_surveys)} published surveys for business {business_id}")
            
            accessible_survey_list = []
            for survey in all_surveys:
                # Apply survey-level access control
                has_access, reason = BusinessController.check_survey_access(current_user, survey.id)
                if not has_access:
                    current_app.logger.debug(f"[LIST_SURVEYS_FOR_BUSINESS] User access denied to survey {survey.id} for business {business_id}. Reason: {reason}")
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
                    "image_url": survey.branding, # Legacy field for backward compatibility
                    "completed_by_user": completed_by_user,
                    "xp_reward": xp_reward,
                    "estimated_time": estimated_time,
                    "is_restricted": survey.is_restricted,  # Include restriction status for frontend awareness
                    "is_featured": survey.is_featured  # Include featured status
                }
                accessible_survey_list.append(survey_dict)
            
            current_app.logger.info(f"[LIST_SURVEYS_FOR_BUSINESS] Returning {len(accessible_survey_list)} accessible surveys for business {business_id}")
            return {"surveys": accessible_survey_list, "business_name": business.name}, 200
            
        except Exception as e:
            current_app.logger.error(f"[LIST_SURVEYS_FOR_BUSINESS] Error: {e}", exc_info=True)
            return {"error": "Failed to list surveys", "details": str(e)}, 500

    @staticmethod
    def update_feedback_item_status(business_id, item_id, data, current_user):
        """Update the status of a feedback item (bug or feature) for a business."""
        current_app.logger.info(f"[UPDATE_FEEDBACK_ITEM_STATUS] Attempting to update item {item_id} for business {business_id} by user {current_user.id}. Data: {data}")
        try:
            item = Item.query.filter_by(id=item_id, business_id=business_id).first()

            if not item:
                current_app.logger.warning(f"[UPDATE_FEEDBACK_ITEM_STATUS] Item {item_id} not found or does not belong to business {business_id}.")
                return {"error": "Feedback item not found or access denied."}, 404

            new_status = data.get('status')
            if not new_status:
                current_app.logger.warning(f"[UPDATE_FEEDBACK_ITEM_STATUS] 'status' not provided in request data for item {item_id}.")
                return {"error": "New status not provided."}, 400

            # Optional: Validate if new_status is a valid status
            valid_statuses = ['PENDING', 'UNDER_REVIEW', 'PLANNED', 'COMPLETED', 'REJECTED'] # Example valid statuses
            if new_status.upper() not in valid_statuses:
                current_app.logger.warning(f"[UPDATE_FEEDBACK_ITEM_STATUS] Invalid status '{new_status}' for item {item_id}.")
                return {"error": f"Invalid status value. Must be one of: {', '.join(valid_statuses)}"}, 400

            item.status = new_status.upper()
            db.session.commit()

            current_app.logger.info(f"[UPDATE_FEEDBACK_ITEM_STATUS] Item {item_id} status updated to {new_status} successfully.")
            return {"message": "Feedback item status updated successfully", "item": item.to_dict()}, 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_FEEDBACK_ITEM_STATUS] Error updating item {item_id} status: {e}", exc_info=True)
            return {"error": "Failed to update feedback item status", "details": str(e)}, 500

    @staticmethod
    def get_business_survey_count(business_id, user_for_access_check=None):
        """Get the count of active, non-archived, published surveys for a business, optionally checking user access."""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404

            query = business.surveys.filter_by(is_archived=False, published=True)
            
            # No active flag on survey model, published implies active for users.
            # If we need to check survey-specific access for the count:
            if user_for_access_check:
                accessible_surveys_count = 0
                for survey in query.all():
                    if BusinessController.check_survey_access(user_for_access_check, survey.id):
                        accessible_surveys_count += 1
                count = accessible_surveys_count
            else:
                # Raw count of published surveys for the business
                count = query.count()

            return {"business_id": business_id, "name": business.name, "survey_count": count}, 200

        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_SURVEY_COUNT] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve survey count", "details": str(e)}, 500

    @staticmethod
    def get_business_analytics_summary(business_id):
        """Get analytics summary for a specific business."""
        current_app.logger.info(f"[BUSINESS_ANALYTICS] Fetching analytics for business_id: {business_id}")
        business = Business.query.get(business_id)
        if not business:
            current_app.logger.warning(f"[BUSINESS_ANALYTICS] Business {business_id} not found.")
            return {"error": "Business not found"}, 404

        try:
            # Direct counters from the model
            analytics_data = {
                "businessName": business.name,
                "totalSurveys": business.active_survey_count or 0,
                "totalQuests": business.active_quest_count or 0, # Assuming future quest implementation
                "totalPointsEarnable": business.cumulative_earnable_points or 0,
                "completedSurveyRespondents": business.total_submission_count or 0, # This is total submissions, not unique respondents
                "completedQuestUsers": business.completed_quest_submission_count or 0, # Assuming future quest implementation
                "splashPageVisitors": business.splash_page_visit_count or 0,
                
                # Placeholder for trend data - to be implemented properly later
                "surveyResponseTrend": [], # e.g., [{ "date": "2023-01-01", "responses": 10 }, ...]
                "questCompletionTrend": [], # e.g., [{ "date": "2023-01-01", "completions": 5 }, ...]
                "visitorTrend": [] # e.g., [{ "date": "2023-01-01", "visitors": 20 }, ...]
            }
            
            current_app.logger.info(f"[BUSINESS_ANALYTICS] Successfully compiled analytics for business {business_id}.")
            return analytics_data, 200
            
        except Exception as e:
            current_app.logger.error(f"[BUSINESS_ANALYTICS] Error fetching analytics for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to retrieve business analytics", "details": str(e)}, 500

    @staticmethod
    def get_business_names_by_ids(business_ids):
        """Get a mapping of business IDs to business names."""
        if not business_ids:
            return {}, 200
        
        try:
            # Ensure IDs are integers and unique
            clean_ids = list(set(int(id) for id in business_ids))
            businesses = Business.query.filter(Business.id.in_(clean_ids)).all()
            name_map = {b.id: b.name for b in businesses}
            current_app.logger.info(f"[GET_BUSINESS_NAMES] Found names for {len(name_map)} out of {len(clean_ids)} requested IDs.")
            return {"names": name_map}, 200
        except (ValueError, TypeError) as e:
            current_app.logger.error(f"[GET_BUSINESS_NAMES] Invalid ID format in list: {business_ids}. Error: {e}")
            return {"error": "Invalid format for business IDs. Must be a list of integers."}, 400
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_NAMES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business names", "details": str(e)}, 500

    @staticmethod
    def deduct_ai_points(business_id, points_to_deduct, action, user_id):
        """
        Deduct AI points from a business and log the usage.
        Uses monthly points first, then purchased points.
        
        Args:
            business_id: ID of the business
            points_to_deduct: Number of points to deduct
            action: Description of the action (e.g., 'CREATE_SURVEY_MEDIUM', 'GENERATE_15_RESPONSES')
            user_id: ID of the user who triggered the action
            
        Returns:
            tuple: (success: bool, message: str)
        """
        current_app.logger.info(f"[DEDUCT_AI_POINTS] Deducting {points_to_deduct} points from business {business_id} for action '{action}' by user {user_id}")
        
        try:
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.error(f"[DEDUCT_AI_POINTS] Business {business_id} not found")
                return False, "Business not found"

            # Check if billing cycle reset is due
            if business.is_billing_cycle_due():
                current_app.logger.info(f"[DEDUCT_AI_POINTS] Billing cycle due for business {business_id}, resetting monthly points")
                business.reset_monthly_points()

            total_available = business.get_total_ai_points()
            if total_available < points_to_deduct:
                current_app.logger.warning(f"[DEDUCT_AI_POINTS] Insufficient points - Business {business_id} has {total_available} but needs {points_to_deduct}")
                return False, "Insufficient points"

            # Track before state
            monthly_before = business.ai_points_monthly
            purchased_before = business.ai_points_purchased
            total_before = total_available

            # Deduct monthly points first
            monthly_used = min(points_to_deduct, business.ai_points_monthly)
            business.ai_points_monthly -= monthly_used
            remaining_to_deduct = points_to_deduct - monthly_used

            # Deduct remaining from purchased points
            purchased_used = remaining_to_deduct
            business.ai_points_purchased -= purchased_used

            # Track after state
            monthly_after = business.ai_points_monthly
            purchased_after = business.ai_points_purchased
            total_after = business.get_total_ai_points()

            # Update legacy field for backward compatibility
            business.ai_points = total_after

            # Log the usage with detailed breakdown
            usage_log = AIPointsUsageLog(
                business_id=business_id,
                user_id=user_id,
                action=action,
                points_deducted=points_to_deduct,
                monthly_points_used=monthly_used,
                purchased_points_used=purchased_used,
                monthly_points_before=monthly_before,
                monthly_points_after=monthly_after,
                purchased_points_before=purchased_before,
                purchased_points_after=purchased_after,
                points_before=total_before,
                points_after=total_after
            )
            db.session.add(usage_log)
            db.session.commit()
            
            current_app.logger.info(f"[DEDUCT_AI_POINTS] Successfully deducted {points_to_deduct} points from business {business.name}. Monthly: {monthly_before}->{monthly_after}, Purchased: {purchased_before}->{purchased_after}")
            return True, "Points deducted successfully"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DEDUCT_AI_POINTS] Error deducting points: {e}", exc_info=True)
            return False, f"Error deducting points: {str(e)}"

    @staticmethod
    def add_ai_points(business_id, points_to_add, action="POINTS_PURCHASE", user_id=None):
        """
        Add purchased AI points to a business (e.g., after purchase).
        This adds to the purchased points balance, not monthly quota.
        
        Args:
            business_id: ID of the business
            points_to_add: Number of points to add
            action: Description of the action (e.g., 'STRIPE_PURCHASE_100_POINTS')
            user_id: ID of the user who triggered the action (optional)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        current_app.logger.info(f"[ADD_AI_POINTS] Adding {points_to_add} purchased points to business {business_id} for action '{action}' by user {user_id}")
        
        try:
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.error(f"[ADD_AI_POINTS] Business {business_id} not found")
                return False, "Business not found"

            # Track before state
            monthly_before = business.ai_points_monthly
            purchased_before = business.ai_points_purchased
            total_before = business.get_total_ai_points()

            # Add to purchased points
            business.ai_points_purchased += points_to_add

            # Track after state
            monthly_after = business.ai_points_monthly
            purchased_after = business.ai_points_purchased
            total_after = business.get_total_ai_points()

            # Update legacy field for backward compatibility
            business.ai_points = total_after

            # Log the addition (negative deduction to show addition)
            usage_log = AIPointsUsageLog(
                business_id=business_id,
                user_id=user_id,
                action=action,
                points_deducted=-points_to_add,  # Negative to indicate addition
                monthly_points_used=0,  # No monthly points involved
                purchased_points_used=-points_to_add,  # Negative to show addition
                monthly_points_before=monthly_before,
                monthly_points_after=monthly_after,
                purchased_points_before=purchased_before,
                purchased_points_after=purchased_after,
                points_before=total_before,
                points_after=total_after
            )
            db.session.add(usage_log)
            db.session.commit()
            
            current_app.logger.info(f"[ADD_AI_POINTS] Successfully added {points_to_add} purchased points to business {business.name}. Purchased: {purchased_before} -> {purchased_after}")
            return True, f"Added {points_to_add} points successfully"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[ADD_AI_POINTS] Error adding points: {e}", exc_info=True)
            return False, f"Error adding points: {str(e)}"

    @staticmethod
    def get_ai_points_usage_log(business_id, limit=50):
        """
        Get AI points usage log for a business.
        
        Args:
            business_id: ID of the business
            limit: Maximum number of log entries to return
            
        Returns:
            tuple: (log_entries: list, status_code: int)
        """
        current_app.logger.info(f"[GET_AI_POINTS_LOG] Fetching AI points usage log for business {business_id}")
        
        try:
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.error(f"[GET_AI_POINTS_LOG] Business {business_id} not found")
                return {"error": "Business not found"}, 404

            usage_logs = AIPointsUsageLog.query.filter_by(business_id=business_id)\
                                               .order_by(AIPointsUsageLog.created_at.desc())\
                                               .limit(limit).all()
            
            log_data = []
            for log in usage_logs:
                log_entry = log.to_dict()
                # Add user information if available
                if log.user:
                    log_entry['user_info'] = {
                        'id': log.user.id,
                        'username': log.user.username,
                        'email': log.user.email
                    }
                log_data.append(log_entry)
            
            current_app.logger.info(f"[GET_AI_POINTS_LOG] Retrieved {len(log_data)} log entries for business {business_id}")
            return {
                "business_id": business_id,
                "business_name": business.name,
                "business_tier": business.tier,
                "current_ai_points": business.get_total_ai_points(),
                "ai_points_purchased": business.ai_points_purchased,
                "ai_points_monthly": business.ai_points_monthly,
                "monthly_ai_points_quota": business.monthly_ai_points_quota,
                "billing_cycle_start": business.billing_cycle_start.isoformat() if business.billing_cycle_start else None,
                "next_billing_date": business.next_billing_date.isoformat() if business.next_billing_date else None,
                "days_until_reset": business.days_until_reset(),
                "usage_log": log_data
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_AI_POINTS_LOG] Error fetching usage log: {e}", exc_info=True)
            return {"error": "Failed to retrieve AI points usage log", "details": str(e)}, 500

    @staticmethod
    def check_ai_points_available(business_id, points_needed):
        """
        Check if a business has enough AI points for an action.
        Considers both monthly and purchased points after checking for billing cycle reset.
        
        Args:
            business_id: ID of the business
            points_needed: Number of points required
            
        Returns:
            tuple: (has_enough: bool, current_points: int, message: str)
        """
        try:
            business = Business.query.get(business_id)
            if not business:
                return False, 0, "Business not found"
            
            # Check if billing cycle reset is due
            if business.is_billing_cycle_due():
                current_app.logger.info(f"[CHECK_AI_POINTS] Billing cycle due for business {business_id}, resetting monthly points")
                business.reset_monthly_points()
                db.session.commit()
            
            total_points = business.get_total_ai_points()
            has_enough = total_points >= points_needed
            return has_enough, total_points, "Check completed"
            
        except Exception as e:
            current_app.logger.error(f"[CHECK_AI_POINTS] Error checking points: {e}", exc_info=True)
            return False, 0, f"Error checking points: {str(e)}"

    @staticmethod
    def initialize_billing_cycle(business_id):
        """
        Initialize billing cycle for a business (called when creating or upgrading business).
        
        Args:
            business_id: ID of the business
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            business = Business.query.get(business_id)
            if not business:
                return False, "Business not found"
            
            from datetime import datetime, timedelta
            
            # Set billing cycle dates
            business.billing_cycle_start = datetime.utcnow()
            business.next_billing_date = datetime.utcnow() + timedelta(days=30)
            
            # Set monthly points based on tier
            monthly_quota = business.get_monthly_points_for_tier()
            business.ai_points_monthly = monthly_quota
            business.monthly_ai_points_quota = monthly_quota
            
            # Update legacy field
            business.ai_points = business.get_total_ai_points()
            
            db.session.commit()
            
            current_app.logger.info(f"[INIT_BILLING] Initialized billing cycle for business {business.name} with {monthly_quota} monthly points")
            return True, "Billing cycle initialized successfully"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[INIT_BILLING] Error initializing billing cycle: {e}", exc_info=True)
            return False, f"Error initializing billing cycle: {str(e)}"

    @staticmethod
    def upgrade_business_tier(business_id, new_tier, user_id=None):
        """
        Upgrade business tier with proper points transition logic.
        
        Args:
            business_id: ID of the business
            new_tier: New tier ('normal', 'advanced', 'super')
            user_id: ID of the user performing the upgrade (optional)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            business = Business.query.get(business_id)
            if not business:
                return False, "Business not found"
            
            old_tier = business.tier
            if old_tier == new_tier:
                return True, "No tier change needed"
            
            # Track before state for logging
            monthly_before = business.ai_points_monthly
            purchased_before = business.ai_points_purchased
            
            # Apply tier upgrade logic
            business.upgrade_tier(new_tier)
            
            # Track after state
            monthly_after = business.ai_points_monthly
            purchased_after = business.ai_points_purchased
            
            # Update tier-based limits
            from app.routes.ai_points_routes import SUBSCRIPTION_TIERS

            tier_order = ['normal', 'advanced', 'super']
            is_upgrade = tier_order.index(new_tier) > tier_order.index(old_tier)

            if is_upgrade:
                # Apply new (higher) limits immediately
                tier_features = SUBSCRIPTION_TIERS[new_tier]['features']
                business.monthly_response_limit = tier_features['monthly_response_limit']
                business.monthly_quest_limit = tier_features['monthly_quest_limit']
                business.admin_seat_limit = tier_features['admin_seat_limit']
            else:
                # Downgrade: keep current limits until the next billing cycle.
                # The Business.upgrade_tier method already set monthly_ai_points_quota for next cycle.
                # Here we simply log that limits will change later.
                tier_features = SUBSCRIPTION_TIERS[new_tier]['features']
                current_app.logger.info(f"[TIER_DOWNGRADE] Downgrade scheduled: limits will change on next billing cycle for business {business_id} -> {tier_features}")
            
            # Update legacy field
            business.ai_points = business.get_total_ai_points()
            
            # Log the tier change
            usage_log = AIPointsUsageLog(
                business_id=business_id,
                user_id=user_id,
                action=f"TIER_UPGRADE_{old_tier.upper()}_TO_{new_tier.upper()}",
                points_deducted=0,  # No points deducted for tier upgrade
                monthly_points_used=0,
                purchased_points_used=0,
                monthly_points_before=monthly_before,
                monthly_points_after=monthly_after,
                purchased_points_before=purchased_before,
                purchased_points_after=purchased_after,
                points_before=monthly_before + purchased_before,
                points_after=monthly_after + purchased_after
            )
            db.session.add(usage_log)
            db.session.commit()
            
            current_app.logger.info(f"[TIER_UPGRADE] Upgraded business {business.name} from {old_tier} to {new_tier}. Monthly points: {monthly_before}->{monthly_after}")
            return True, f"Successfully upgraded from {old_tier} to {new_tier}"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[TIER_UPGRADE] Error upgrading tier: {e}", exc_info=True)
            return False, f"Error upgrading tier: {str(e)}"

    @staticmethod
    def upgrade_business_tier_by_id(business_id, new_tier_id, user_id=None):
        """
        Upgrade business tier using tier ID instead of tier name.
        
        Args:
            business_id: ID of the business
            new_tier_id: ID of the new BusinessTier
            user_id: ID of the user performing the upgrade (optional)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            from app.models import BusinessTier
            
            business = Business.query.get(business_id)
            if not business:
                return False, "Business not found"
            
            new_tier = BusinessTier.query.get(new_tier_id)
            if not new_tier or not new_tier.is_active:
                return False, "Invalid tier specified"
            
            old_tier_id = business.tier_id
            old_tier_name = business.tier_info.name if business.tier_info else 'None'
            
            if old_tier_id == new_tier_id:
                return True, "No tier change needed"
            
            # Track before state for logging
            monthly_before = business.ai_points_monthly
            purchased_before = business.ai_points_purchased
            
            # Update tier
            business.tier_id = new_tier_id
            business.tier = new_tier.name.lower()  # Update legacy field for backward compatibility
            
            # Update tier-based monthly AI points quota
            business.monthly_ai_points_quota = new_tier.ai_points_included
            
            # Reset monthly points to the new tier's included amount
            business.ai_points_monthly = new_tier.ai_points_included
            
            # Update tier-based limits
            business.monthly_response_limit = new_tier.monthly_response_limit
            business.monthly_quest_limit = new_tier.monthly_quest_limit
            business.admin_seat_limit = new_tier.admin_seat_limit
            
            # Track after state
            monthly_after = business.ai_points_monthly
            purchased_after = business.ai_points_purchased
            
            # Update legacy field
            business.ai_points = business.get_total_ai_points()
            
            # Log the tier change
            usage_log = AIPointsUsageLog(
                business_id=business_id,
                user_id=user_id,
                action=f"TIER_UPGRADE_{old_tier_name.upper()}_TO_{new_tier.name.upper()}",
                points_deducted=0,  # No points deducted for tier upgrade
                monthly_points_used=0,
                purchased_points_used=0,
                monthly_points_before=monthly_before,
                monthly_points_after=monthly_after,
                purchased_points_before=purchased_before,
                purchased_points_after=purchased_after,
                points_before=monthly_before + purchased_before,
                points_after=monthly_after + purchased_after
            )
            db.session.add(usage_log)
            db.session.commit()
            
            current_app.logger.info(f"[TIER_UPGRADE_BY_ID] Upgraded business {business.name} from {old_tier_name} to {new_tier.name}. Monthly points: {monthly_before}->{monthly_after}")
            return True, f"Successfully upgraded from {old_tier_name} to {new_tier.name}"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[TIER_UPGRADE_BY_ID] Error upgrading tier: {e}", exc_info=True)
            return False, f"Error upgrading tier: {str(e)}"

    @staticmethod
    def reset_monthly_points_for_business(business_id):
        """
        Manually reset monthly points for a business (useful for testing or admin actions).
        
        Args:
            business_id: ID of the business
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            business = Business.query.get(business_id)
            if not business:
                return False, "Business not found"
            
            old_monthly = business.ai_points_monthly
            business.reset_monthly_points()
            new_monthly = business.ai_points_monthly
            
            # Update legacy field
            business.ai_points = business.get_total_ai_points()
            
            db.session.commit()
            
            current_app.logger.info(f"[RESET_MONTHLY] Reset monthly points for business {business.name}: {old_monthly} -> {new_monthly}")
            return True, f"Monthly points reset: {old_monthly} -> {new_monthly}"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[RESET_MONTHLY] Error resetting monthly points: {e}", exc_info=True)
            return False, f"Error resetting monthly points: {str(e)}"

    @staticmethod
    def add_response_quota(business_id, responses_to_add, action="RESPONSES_PURCHASE", user_id=None):
        """
        Add additional survey response quota to a business (pay-as-you-go).

        Args:
            business_id (int): Business ID
            responses_to_add (int): Number of additional responses to add
            action (str): Log action string (e.g., 'PURCHASE_2000_RESPONSES')
            user_id (int, optional): User triggering the purchase

        Returns:
            tuple(bool, str): success flag and informational message
        """
        try:
            business = Business.query.get(business_id)
            if not business:
                return False, "Business not found"

            # Track before state
            purchased_before = business.responses_purchased or 0
            total_before = (business.monthly_response_limit or 0) + purchased_before

            # Update quota
            business.responses_purchased = purchased_before + responses_to_add
            total_after = (business.monthly_response_limit or 0) + business.responses_purchased

            # Optionally, we could create a dedicated log model. For now, reuse StripeTransaction meta (handled in routes).
            db.session.commit()

            current_app.logger.info(f"[ADD_RESPONSE_QUOTA] Added {responses_to_add} responses to business {business_id}. {total_before} -> {total_after}")
            return True, f"Added {responses_to_add} additional responses successfully"
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[ADD_RESPONSE_QUOTA] Error adding responses: {e}", exc_info=True)
            return False, f"Error adding additional responses: {str(e)}"

    @staticmethod
    def list_business_admins(business_id):
        """
        List all business admins for a specific business.
        """
        try:
            current_app.logger.info(f"[LIST_BUSINESS_ADMINS] Fetching admins for business {business_id}")
            
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.warning(f"[LIST_BUSINESS_ADMINS] Business {business_id} not found")
                return {"error": "Business not found"}, 404
            
            # Get all business admins for this business
            admins = User.query.filter_by(
                business_id=business_id, 
                role='business_admin'
            ).order_by(User.created_at.desc()).all()
            
            # Format admin data
            admin_list = []
            for admin in admins:
                admin_data = {
                    "id": admin.id,
                    "name": admin.name,
                    "email": admin.email,
                    "username": admin.username,
                    "created_at": admin.created_at.isoformat() if admin.created_at else None,
                    "is_active": getattr(admin, 'is_active', True),
                    "business_admin_permissions": admin.business_admin_permissions or {}
                }
                admin_list.append(admin_data)
            
            current_app.logger.info(f"[LIST_BUSINESS_ADMINS] Found {len(admin_list)} admins for business {business_id}")
            
            return {
                "admins": admin_list,
                "business_id": business_id,
                "business_name": business.name,
                "total_admins": len(admin_list)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[LIST_BUSINESS_ADMINS] Error listing admins for business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to list business admins"}, 500

    @staticmethod
    def delete_business_admin(business_id, admin_id, deleting_user_id):
        """
        Delete a business admin from a specific business.
        """
        try:
            current_app.logger.info(f"[DELETE_BUSINESS_ADMIN] User {deleting_user_id} deleting admin {admin_id} from business {business_id}")
            
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.warning(f"[DELETE_BUSINESS_ADMIN] Business {business_id} not found")
                return {"error": "Business not found"}, 404
            
            # Find the admin to delete
            admin = User.query.filter_by(
                id=admin_id, 
                business_id=business_id, 
                role='business_admin'
            ).first()
            
            if not admin:
                current_app.logger.warning(f"[DELETE_BUSINESS_ADMIN] Admin {admin_id} not found in business {business_id}")
                return {"error": "Business admin not found"}, 404
            
            # Store admin info for logging
            admin_info = f"{admin.name} ({admin.email})"
            
            # Delete the admin
            db.session.delete(admin)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_BUSINESS_ADMIN] Successfully deleted business admin: {admin_info}")
            
            return {
                "message": f"Business admin {admin_info} deleted successfully",
                "deleted_admin": {
                    "id": admin_id,
                    "name": admin.name,
                    "email": admin.email
                }
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_BUSINESS_ADMIN] Error deleting admin {admin_id} from business {business_id}: {e}", exc_info=True)
            return {"error": "Failed to delete business admin"}, 500

   
