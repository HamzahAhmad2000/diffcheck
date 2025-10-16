from flask import current_app, g
from app.models import db, Quest, QuestCompletion, QuestType, Business, User, Admin, ActivityType, QuestPackage, PointsLog, UserDailyActivity, UserQuestProgress
from app.controllers.activity_controller import ActivityController
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
from enum import Enum

class QuestController:
    """Controller for managing quests with support for both super admin and business admin operations"""
    
    @staticmethod
    def get_all_quest_types():
        """Get all available quest types for dropdown selection"""
        try:
            quest_types = []
            for quest_type in QuestType:
                quest_types.append({
                    "value": quest_type.value,
                    "label": quest_type.value.replace('_', ' ').title(),
                    "category": QuestController._get_quest_category(quest_type.value)
                })
            
            return {"quest_types": quest_types}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_QUEST_TYPES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest types"}, 500
    
    @staticmethod
    def _get_quest_category(quest_type):
        """Helper to categorize quest types"""
        if quest_type.startswith(('FOLLOW_X', 'RETWEET_X', 'LIKE_X', 'COMMENT_X')):
            return "Twitter/X"
        elif quest_type.startswith(('FOLLOW_INSTAGRAM', 'LIKE_INSTAGRAM', 'REPOST_INSTAGRAM', 'REPLY_INSTAGRAM')):
            return "Instagram"
        elif quest_type.startswith(('FOLLOW_LINKEDIN', 'LIKE_LINKEDIN', 'COMMENT_LINKEDIN', 'SHARE_LINKEDIN', 'REPOST_LINKEDIN', 'REACT_LINKEDIN')):
            return "LinkedIn"
        elif quest_type.startswith(('WATCH_YOUTUBE', 'SUBSCRIBE_YOUTUBE', 'LIKE_YOUTUBE', 'COMMENT_YOUTUBE')):
            return "YouTube"
        elif quest_type in ['JOIN_DISCORD_SERVER', 'JOIN_TELEGRAM']:
            return "Community"
        elif quest_type in ['DOWNLOAD_APP', 'DOWNLOAD_GAME']:
            return "Downloads"
        elif quest_type in ['COMPLETE_SURVEY', 'COMPLETE_X_SURVEYS', 'VISIT_LINK']:
            return "Internal"
        elif quest_type in ['COMPLETE_X_SURVEYS_DAILY', 'COMPLETE_X_SURVEYS_TOTAL', 'SELECT_X_TAGS', 'COMPLETE_X_QUESTS', 'VISIT_X_BRAND_PAGES', 'UPLOAD_PROFILE_PICTURE', 'COMPLETE_PROFILE_SECTION']:
            return "Eclipseer Quests"
        else:
            return "Other"
    
    @staticmethod
    def get_all_quests(business_id=None, include_archived=False, admin_only=False):
        """Get all quests, optionally filtered by business or admin access"""
        try:
            query = Quest.query
            
            # Filter by business if specified
            if business_id:
                query = query.filter_by(business_id=business_id)
            elif admin_only:
                # Super admin quests only (business_id is null)
                query = query.filter(Quest.business_id.is_(None))
            
            # Filter archived quests unless requested
            if not include_archived:
                query = query.filter_by(is_archived=False)
            
            quests = query.order_by(Quest.created_at.desc()).all()
            
            return {
                "quests": [quest.to_dict() for quest in quests],
                "total_count": len(quests)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_QUESTS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quests"}, 500
    
    @staticmethod
    def get_quest_by_id(quest_id, include_completions=False):
        """Get a specific quest by ID"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
                
            return {"quest": quest.to_dict(include_completions=include_completions)}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_QUEST_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest"}, 500
    
    @staticmethod
    def create_quest(quest_data, creator_role=None, creator_id=None, business_id=None):
        """Create a new quest"""
        try:
            # Validate required fields
            required_fields = ['title', 'quest_type', 'xp_reward']
            for field in required_fields:
                if field not in quest_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Validate quest type
            valid_quest_types = [qt.value for qt in QuestType]
            if quest_data['quest_type'] not in valid_quest_types:
                return {"error": f"Invalid quest type. Must be one of: {valid_quest_types}"}, 400
            
            # Validate XP reward
            try:
                xp_reward = int(quest_data['xp_reward'])
                if xp_reward < 0:
                    return {"error": "XP reward must be non-negative"}, 400
            except (ValueError, TypeError):
                return {"error": "XP reward must be a valid number"}, 400
            
            # SECURITY: For business admins, enforce the business_id from the route parameter
            # and ignore any business_id that might be in quest_data
            if creator_role == 'business_admin':
                if not business_id:
                    return {"error": "Business ID is required for business admin quest creation"}, 400
                
                # Override any business_id in quest_data for security
                if 'business_id' in quest_data and quest_data['business_id'] != business_id:
                    current_app.logger.warning(f"[CREATE_QUEST] Business admin {creator_id} attempted to create quest for business {quest_data['business_id']} but is restricted to business {business_id}")
                
                # Ensure the quest is created for the business admin's business
                quest_data['business_id'] = business_id
                
            elif creator_role == 'super_admin':
                # Super admin can specify business_id in quest_data or use the parameter
                if 'business_id' in quest_data and quest_data['business_id']:
                    business_id = quest_data['business_id']
                # If no business_id specified, it will be a platform-wide quest
            
            # Check business quest limits if this is a business quest
            if business_id:
                business = Business.query.get(business_id)
                if not business:
                    return {"error": "Business not found"}, 404
                
                # Only check limits for business admins, not super admins
                if creator_role == 'business_admin':
                    # Calculate current month's quests
                    current_month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    current_month_quests = Quest.query.filter(
                        Quest.business_id == business_id,
                        Quest.created_at >= current_month_start
                    ).count()
                    
                    # Check business tier-based limits
                    tier_info = business.tier_info
                    has_tier_limits = tier_info and tier_info.can_create_quests
                    
                    if has_tier_limits:
                        # Use tier-based monthly limit
                        tier_monthly_limit = tier_info.monthly_quest_limit
                        available_monthly = tier_monthly_limit - current_month_quests
                        
                        # Check if they have monthly credits available
                        if tier_monthly_limit != -1 and available_monthly <= 0:
                            # No monthly credits left, check purchased credits
                            if (business.quest_credits_purchased or 0) <= 0:
                                return {
                                    "error": f"Monthly quest limit reached ({tier_monthly_limit}). Please purchase additional quest credits.",
                                    "limit_reached": True,
                                    "monthly_limit": tier_monthly_limit,
                                    "current_usage": current_month_quests,
                                    "credits_remaining": 0
                                }, 402
                            else:
                                # Use purchased credit instead of monthly
                                pass
                        
                    else:
                        # Legacy fallback - use business.monthly_quest_limit
                        if current_month_quests >= business.monthly_quest_limit:
                            if (business.quest_credits_purchased or 0) <= 0:
                                return {
                                    "error": f"Monthly quest limit reached ({business.monthly_quest_limit}). Please upgrade your tier or purchase quest credits.",
                                    "limit_reached": True,
                                    "monthly_limit": business.monthly_quest_limit,
                                    "current_usage": current_month_quests,
                                    "credits_remaining": 0
                                }, 402
                        
                    # Check if they have any quest creation capability
                    can_create = False
                    credits_remaining = business.quest_credits_purchased or 0
                    
                    # Allow creation if they have purchased credits, regardless of tier
                    if credits_remaining > 0:
                        can_create = True
                    elif has_tier_limits and tier_info.can_create_quests:
                        # Check if they have monthly credits
                        if tier_monthly_limit == -1 or available_monthly > 0:
                            can_create = True
                    elif not has_tier_limits and business.monthly_quest_limit > 0:
                        # Legacy tier system
                        if current_month_quests < business.monthly_quest_limit:
                            can_create = True
                    
                    if not can_create:
                        # Provide detailed information about why creation is blocked
                        tier_can_create = False
                        if has_tier_limits and tier_info.can_create_quests:
                            tier_can_create = True
                        elif not has_tier_limits and business.monthly_quest_limit > 0:
                            tier_can_create = True
                        
                        if not tier_can_create and credits_remaining <= 0:
                            return {
                                "error": "Your tier does not allow quest creation. Please purchase quest credits or upgrade your tier to create quests.",
                                "tier_restricted": True,
                                "credits_remaining": credits_remaining,
                                "tier_allows_creation": False,
                                "reason": "tier_restricted"
                            }, 402
                        else:
                            return {
                                "error": "You have reached your monthly quest limit. Please purchase additional quest credits to continue creating quests.",
                                "limit_reached": True,
                                "monthly_limit": monthly_limit,
                                "current_usage": current_month_quests,
                                "credits_remaining": credits_remaining,
                                "tier_allows_creation": tier_can_create,
                                "reason": "limit_reached"
                            }, 402

            # For super-admin created quests not assigned to a business, assign to ECLIPSEER
            # This also means super admin bypasses credit checks
            if creator_role == 'super_admin' and not business_id:
                eclipseer_business = Business.query.filter_by(name="ECLIPSEER").first()
                if eclipseer_business:
                    business_id = eclipseer_business.id
                    current_app.logger.info(f"[CREATE_QUEST] Assigning super admin quest to 'ECLIPSEER' (ID: {business_id})")
                else:
                    current_app.logger.warning("[CREATE_QUEST] 'ECLIPSEER' business not found for super admin quest assignment.")
            elif creator_role == 'super_admin' and business_id:
                # Super admin creating for a specific business, bypass credit checks for them
                pass
            else:
                # This is a business admin creating a quest, so we proceed with credit deduction logic later.
                pass
            
            # Determine approval status based on creator role
            approval_status = 'APPROVED' if creator_role == 'super_admin' else 'PENDING'
            
            # Create new quest
            quest = Quest(
                business_id=business_id,
                created_by_admin_id=creator_id if creator_role == 'super_admin' else None,
                created_by_user_id=creator_id if creator_role == 'business_admin' else None,
                title=quest_data['title'],
                description=quest_data.get('description'),
                quest_type=quest_data['quest_type'],
                image_url=quest_data.get('image_url'),
                cover_image_url=quest_data.get('cover_image_url'),
                target_url=quest_data.get('target_url'),
                target_data=quest_data.get('target_data'),
                verification_method=quest_data.get('verification_method', 'CLICK_VERIFY'),
                xp_reward=xp_reward,
                has_raffle_prize=quest_data.get('has_raffle_prize', False),
                raffle_prize_description=quest_data.get('raffle_prize_description'),
                raffle_end_date=datetime.fromisoformat(quest_data['raffle_end_date']) if quest_data.get('raffle_end_date') else None,
                max_completions=quest_data.get('max_completions'),
                start_date=datetime.fromisoformat(quest_data['start_date']) if quest_data.get('start_date') else None,
                end_date=datetime.fromisoformat(quest_data['end_date']) if quest_data.get('end_date') else None,
                is_featured=quest_data.get('is_featured', False),
                approval_status=approval_status
            )
            
            db.session.add(quest)
            db.session.flush()  # Get the quest ID
            
            # Create activity log
            if business_id:
                ActivityController.create_activity_log(
                    business_id=business_id,
                    activity_type=ActivityType.QUEST_CREATED,
                    title=f"New Quest: {quest.title}",
                    description=f"Quest offering {xp_reward} XP has been created",
                    related_item_id=quest.id,
                    user_id=creator_id if creator_role == 'business_admin' else None,
                    make_public_by_default=False
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_QUEST] Created new quest: {quest.title} (ID: {quest.id}) by {creator_role} {creator_id} for business {business_id}")
            
            # Update business quest count and credits if applicable (and not a super admin)
            if business_id and creator_role == 'business_admin':
                business = Business.query.get(business_id) # Re-fetch to be safe
                if business:
                    credits_remaining = business.quest_credits_purchased or 0
                    
                    # Check if business has tier_info before accessing its properties
                    if not business.tier_info:
                        # If no tier_info, assume quest credits are required
                        business.quest_credits_purchased = max(0, credits_remaining - 1)
                    elif not business.tier_info.can_create_quests:
                        # Tier doesn't allow quest creation, use credits
                        business.quest_credits_purchased = max(0, credits_remaining - 1)
                    elif business.tier_info.monthly_quest_limit != -1:
                        # Check if we have monthly credits available
                        tier_monthly_limit = business.tier_info.monthly_quest_limit
                        available_quests_this_month = tier_monthly_limit - (business.monthly_quests_used or 0)
                        if available_quests_this_month > 0:
                            # Use monthly credit
                            business.monthly_quests_used = (business.monthly_quests_used or 0) + 1
                        else:
                            # Use purchased credit
                            business.quest_credits_purchased = max(0, credits_remaining - 1)
                    else:
                        # Unlimited monthly quests for this tier
                        pass
                
                # This count should be on publish, but it's okay to update here too.
                business.active_quest_count = Quest.query.filter_by(business_id=business_id, is_published=True, is_archived=False).count()
            
            return {
                "message": "Quest created successfully",
                "quest": quest.to_dict()
            }, 201
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_QUEST] Integrity error: {e}", exc_info=True)
            return {"error": "Database integrity error"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to create quest"}, 500
    
    @staticmethod
    def update_quest(quest_id, quest_data, user_role=None, user_id=None):
        """Update an existing quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Permission check
            if user_role == 'business_admin':
                # Business admin can only edit their own business quests
                if not quest.business_id or quest.created_by_user_id != user_id:
                    return {"error": "Permission denied. You can only edit your own quests."}, 403
            
            # Validate quest type if being changed
            if 'quest_type' in quest_data:
                valid_quest_types = [qt.value for qt in QuestType]
                if quest_data['quest_type'] not in valid_quest_types:
                    return {"error": f"Invalid quest type. Must be one of: {valid_quest_types}"}, 400
            
            # Validate XP reward if being changed
            if 'xp_reward' in quest_data:
                try:
                    xp_reward = int(quest_data['xp_reward'])
                    if xp_reward < 0:
                        return {"error": "XP reward must be non-negative"}, 400
                except (ValueError, TypeError):
                    return {"error": "XP reward must be a valid number"}, 400
            
            # Update fields
            updatable_fields = [
                'title', 'description', 'quest_type', 'image_url', 'cover_image_url',
                'target_url', 'target_data', 'verification_method', 'xp_reward',
                'has_raffle_prize', 'raffle_prize_description', 'max_completions',
                'is_featured'
            ]
            
            for field in updatable_fields:
                if field in quest_data:
                    if field == 'xp_reward':
                        setattr(quest, field, int(quest_data[field]))
                    else:
                        setattr(quest, field, quest_data[field])
            
            # Handle date fields separately
            if 'start_date' in quest_data:
                quest.start_date = datetime.fromisoformat(quest_data['start_date']) if quest_data['start_date'] else None
            
            if 'end_date' in quest_data:
                quest.end_date = datetime.fromisoformat(quest_data['end_date']) if quest_data['end_date'] else None
            
            if 'raffle_end_date' in quest_data:
                quest.raffle_end_date = datetime.fromisoformat(quest_data['raffle_end_date']) if quest_data['raffle_end_date'] else None
            
            quest.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_QUEST] Updated quest: {quest.title} (ID: {quest.id})")
            
            return {
                "message": "Quest updated successfully",
                "quest": quest.to_dict()
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_QUEST] Integrity error: {e}", exc_info=True)
            return {"error": "Database integrity error"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to update quest"}, 500
    
    @staticmethod
    def delete_quest(quest_id, user_role=None, user_id=None):
        """Delete a quest (soft delete by archiving)"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Permission check
            if user_role == 'business_admin':
                # Business admin can only delete their own business quests
                if not quest.business_id or quest.created_by_user_id != user_id:
                    return {"error": "Permission denied. You can only delete your own quests."}, 403
            
            # Soft delete by archiving
            quest.is_archived = True
            quest.is_published = False
            quest.updated_at = datetime.utcnow()
            
            # Update business quest count if applicable
            if quest.business_id:
                business = Business.query.get(quest.business_id)
                if business:
                    business.active_quest_count = Quest.query.filter(
                        Quest.business_id == quest.business_id,
                        Quest.is_published == True,
                        Quest.is_archived == False
                    ).count()
                
                # Create activity log
                ActivityController.create_activity_log(
                    business_id=quest.business_id,
                    activity_type=ActivityType.QUEST_ARCHIVED,
                    title=f"Quest Archived: {quest.title}",
                    description="Quest has been archived and is no longer available",
                    related_item_id=quest.id,
                    user_id=user_id if user_role == 'business_admin' else None,
                    make_public_by_default=False
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_QUEST] Archived quest: {quest.title} (ID: {quest.id})")
            
            return {"message": "Quest archived successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to delete quest"}, 500
    
    @staticmethod
    def publish_quest(quest_id, user_role=None, user_id=None):
        """Publish a quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Permission check
            if user_role == 'business_admin':
                return {"error": "Business admins cannot publish quests directly. Quests must be approved by super admin first."}, 403
            
            # Only super admins can publish quests
            if user_role != 'super_admin':
                return {"error": "Only super admins can publish quests"}, 403
            
            # Check if quest is approved before publishing
            if quest.approval_status != 'APPROVED':
                return {"error": "Quest must be approved before it can be published"}, 400
            
            quest.is_published = True
            quest.updated_at = datetime.utcnow()
            
            # Update business quest count if applicable
            if quest.business_id:
                business = Business.query.get(quest.business_id)
                if business:
                    business.active_quest_count = Quest.query.filter(
                        Quest.business_id == quest.business_id,
                        Quest.is_published == True,
                        Quest.is_archived == False
                    ).count()
                
                # Create activity log
                ActivityController.create_activity_log(
                    business_id=quest.business_id,
                    activity_type=ActivityType.QUEST_PUBLISHED,
                    title=f"Quest Published: {quest.title}",
                    description=f"New quest offering {quest.xp_reward} XP is now available",
                    related_item_id=quest.id,
                    user_id=user_id if user_role == 'business_admin' else None,
                    make_public_by_default=True
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[PUBLISH_QUEST] Published quest: {quest.title} (ID: {quest.id})")
            
            return {
                "message": "Quest published successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PUBLISH_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to publish quest"}, 500
    
    @staticmethod
    def unpublish_quest(quest_id, user_role=None, user_id=None):
        """Unpublish a quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Permission check
            if user_role == 'business_admin':
                return {"error": "Business admins cannot unpublish quests directly. Contact super admin for quest management."}, 403
            
            # Only super admins can unpublish quests
            if user_role != 'super_admin':
                return {"error": "Only super admins can unpublish quests"}, 403
            
            quest.is_published = False
            quest.updated_at = datetime.utcnow()
            
            # Update business quest count if applicable
            if quest.business_id:
                business = Business.query.get(quest.business_id)
                if business:
                    business.active_quest_count = Quest.query.filter(
                        Quest.business_id == quest.business_id,
                        Quest.is_published == True,
                        Quest.is_archived == False
                    ).count()
                
                # Create activity log
                ActivityController.create_activity_log(
                    business_id=quest.business_id,
                    activity_type=ActivityType.QUEST_UNPUBLISHED,
                    title=f"Quest Unpublished: {quest.title}",
                    description="Quest has been unpublished and is no longer available",
                    related_item_id=quest.id,
                    user_id=user_id if user_role == 'business_admin' else None,
                    make_public_by_default=False
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[UNPUBLISH_QUEST] Unpublished quest: {quest.title} (ID: {quest.id})")
            
            return {
                "message": "Quest unpublished successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UNPUBLISH_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to unpublish quest"}, 500
    
    @staticmethod
    def get_available_quests(business_id=None, user_id=None):
        """Get available quests for users to complete"""
        try:
            query = Quest.query.filter(
                Quest.is_published == True,
                Quest.is_archived == False
            )
            
            # Filter by business if specified
            if business_id:
                query = query.filter_by(business_id=business_id)
            
            # Get all published quests that are currently active
            all_active_quests = [quest for quest in query.all() if quest.is_active()]
            
            # The frontend will determine completion status, so we don't filter here.
            # This ensures that completed featured quests remain in the list.
            
            return {
                "quests": [quest.to_dict() for quest in all_active_quests],
                "total_count": len(all_active_quests)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_AVAILABLE_QUESTS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve available quests"}, 500
    
    @staticmethod
    def complete_quest(quest_id, user_id, verification_data=None):
        """Mark a quest as completed by a user"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Check if quest is available for completion
            if not quest.can_user_complete(user_id):
                return {"error": "Quest cannot be completed. It may be inactive or already completed."}, 400
            
            # Check if user already completed this quest
            existing_completion = QuestCompletion.query.filter_by(
                quest_id=quest_id,
                user_id=user_id
            ).first()
            
            if existing_completion:
                return {"error": "Quest already completed"}, 400
            
            # NEW: Handle Eclipseer quest completion validation
            if quest.quest_type in ['COMPLETE_X_SURVEYS_DAILY', 'COMPLETE_X_SURVEYS_TOTAL', 'SELECT_X_TAGS', 'COMPLETE_X_QUESTS', 'VISIT_X_BRAND_PAGES', 'UPLOAD_PROFILE_PICTURE', 'COMPLETE_PROFILE_SECTION']:
                validation_result = QuestController._validate_eclipseer_quest(quest, user_id)
                if not validation_result['valid']:
                    return {"error": validation_result['message']}, 400
            
            # NEW: Check if quest requires link click and verify user clicked the link
            if quest.target_url and quest.verification_method == 'CLICK_VERIFY':
                # Check the database for persistent link click record with error handling
                try:
                    from ..models import QuestLinkClick
                    link_click_record = QuestLinkClick.query.filter_by(
                        quest_id=quest_id,
                        user_id=user_id
                    ).first()
                    
                    if not link_click_record:
                        # Fallback: also check verification_data for link_clicked
                        link_clicked_fallback = verification_data.get('link_clicked', False) if verification_data else False
                        if not link_clicked_fallback:
                            return {"error": "You must visit the target link before completing this quest"}, 400
                except Exception as e:
                    current_app.logger.warning(f"Could not check link click table, falling back to verification_data: {e}")
                    # Fallback: check verification_data for link_clicked
                    link_clicked_fallback = verification_data.get('link_clicked', False) if verification_data else False
                    if not link_clicked_fallback:
                        return {"error": "You must visit the target link before completing this quest"}, 400
            
            # Get link click information for completion record
            link_clicked = False
            link_click_timestamp = None
            if quest.target_url and quest.verification_method == 'CLICK_VERIFY':
                try:
                    from ..models import QuestLinkClick
                    link_click_record = QuestLinkClick.query.filter_by(
                        quest_id=quest_id,
                        user_id=user_id
                    ).first()
                    if link_click_record:
                        link_clicked = True
                        link_click_timestamp = link_click_record.clicked_at
                    else:
                        # Fallback to verification_data
                        link_clicked = verification_data.get('link_clicked', False) if verification_data else False
                        link_click_timestamp = datetime.utcnow() if link_clicked else None
                except Exception as e:
                    current_app.logger.warning(f"Could not access link click table, using verification_data: {e}")
                    # Fallback to verification_data
                    link_clicked = verification_data.get('link_clicked', False) if verification_data else False
                    link_click_timestamp = datetime.utcnow() if link_clicked else None
            
            # Create quest completion record
            completion = QuestCompletion(
                quest_id=quest_id,
                user_id=user_id,
                verification_status='VERIFIED',  # For now, auto-verify
                verification_data=verification_data,
                link_clicked=link_clicked,
                link_click_timestamp=link_click_timestamp,
                xp_awarded=quest.xp_reward,
                raffle_entry_created=quest.has_raffle_prize
            )
            
            db.session.add(completion)
            
            # Update quest completion count
            quest.completion_count = (quest.completion_count or 0) + 1
            
            # Award XP to user using the central XP awarding system (includes Season Pass multiplier)
            from ..controllers.xp_badge_controller import award_xp_no_commit
            xp_result = award_xp_no_commit(
                user_id,
                quest.xp_reward,
                'QUEST_COMPLETED',
                related_item_id=quest_id,
                business_id=quest.business_id
            )

            # Extract actual XP awarded (including Season Pass multiplier)
            if 'error' in xp_result:
                current_app.logger.error(f"[COMPLETE_QUEST] XP awarding failed: {xp_result['error']}")
                xp_awarded = quest.xp_reward  # Fallback to base XP
            else:
                xp_awarded = xp_result['points_awarded']

            # Update quest completion count for user
            user = User.query.get(user_id)
            if user:
                user.quests_completed_count = (user.quests_completed_count or 0) + 1
            
            # NEW: Record quest completion activity for Eclipseer quest tracking
            UserDailyActivity.record_activity(user_id, 'QUEST_COMPLETED', quest_id=quest_id)
            
            # Note: Points/XP logging can be added later if needed
            
            # Update business completion count if applicable
            if quest.business_id:
                business = Business.query.get(quest.business_id)
                if business:
                    business.completed_quest_submission_count = (business.completed_quest_submission_count or 0) + 1
                
                # Create activity log
                ActivityController.create_activity_log(
                    business_id=quest.business_id,
                    activity_type=ActivityType.QUEST_COMPLETED,
                    title=f"Quest Completed: {quest.title}",
                    description=f"User completed quest and earned {quest.xp_reward} XP",
                    related_item_id=quest.id,
                    make_public_by_default=False
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[COMPLETE_QUEST] User {user_id} completed quest {quest_id}, earned {xp_awarded} XP (base: {quest.xp_reward})")
            
            return {
                "message": f"Quest completed successfully! You earned {xp_awarded} XP!",
                "xp_awarded": xp_awarded,
                "completion": completion.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[COMPLETE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to complete quest"}, 500
    
    @staticmethod
    def track_link_click(quest_id, user_id):
        """Track when a user clicks a quest link"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Check if quest has a target URL
            if not quest.target_url:
                return {"error": "Quest does not have a target URL"}, 400
            
            # Import the model here to avoid circular imports
            from ..models import QuestLinkClick
            
            # Check if user already clicked this quest link
            existing_click = QuestLinkClick.query.filter_by(
                quest_id=quest_id,
                user_id=user_id
            ).first()
            
            if existing_click:
                current_app.logger.info(f"[TRACK_LINK_CLICK] User {user_id} already clicked link for quest {quest_id}")
                return {
                    "message": "Link click already tracked",
                    "quest_id": quest_id,
                    "user_id": user_id,
                    "timestamp": existing_click.clicked_at.isoformat(),
                    "already_clicked": True
                }, 200
            
            # Create new link click record
            link_click = QuestLinkClick(
                quest_id=quest_id,
                user_id=user_id,
                target_url=quest.target_url
            )
            
            db.session.add(link_click)
            db.session.commit()
            
            current_app.logger.info(f"[TRACK_LINK_CLICK] User {user_id} clicked link for quest {quest_id}: {quest.target_url}")
            
            return {
                "message": "Link click tracked successfully",
                "quest_id": quest_id,
                "user_id": user_id,
                "timestamp": link_click.clicked_at.isoformat(),
                "already_clicked": False
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[TRACK_LINK_CLICK] Error: {e}", exc_info=True)
            return {"error": "Failed to track link click"}, 500
    
    @staticmethod
    def check_user_link_click(quest_id, user_id):
        """Check if a user has clicked a quest link"""
        try:
            from ..models import QuestLinkClick
            
            link_click = QuestLinkClick.query.filter_by(
                quest_id=quest_id,
                user_id=user_id
            ).first()
            
            return {
                "quest_id": quest_id,
                "user_id": user_id,
                "has_clicked": link_click is not None,
                "clicked_at": link_click.clicked_at.isoformat() if link_click else None
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[CHECK_USER_LINK_CLICK] Error: {e}", exc_info=True)
            return {"error": "Failed to check link click status"}, 500
    
    @staticmethod
    def get_quest_completions(quest_id, page=1, per_page=50):
        """Get completions for a specific quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            completions = QuestCompletion.query.filter_by(quest_id=quest_id)\
                .order_by(QuestCompletion.completed_at.desc())\
                .limit(per_page).offset((page - 1) * per_page).all()
            
            total_count = QuestCompletion.query.filter_by(quest_id=quest_id).count()
            
            return {
                "completions": [completion.to_dict() for completion in completions],
                "total_count": total_count,
                "page": page,
                "per_page": per_page
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_QUEST_COMPLETIONS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest completions"}, 500
    
    @staticmethod
    def get_user_quest_completions(user_id, business_id=None):
        """Get all quests completed by a specific user"""
        try:
            query = QuestCompletion.query.filter_by(user_id=user_id)
            
            if business_id:
                query = query.join(Quest).filter(Quest.business_id == business_id)
            
            completions = query.order_by(QuestCompletion.completed_at.desc()).all()
            
            return {
                "completions": [completion.to_dict() for completion in completions],
                "total_count": len(completions)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_USER_QUEST_COMPLETIONS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve user quest completions"}, 500
    
    @staticmethod
    def feature_quest(quest_id):
        """Feature a quest (super admin only)"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            quest.is_featured = True
            quest.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[FEATURE_QUEST] Featured quest: {quest.title} (ID: {quest.id})")
            
            return {
                "message": "Quest featured successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[FEATURE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to feature quest"}, 500
    
    @staticmethod
    def unfeature_quest(quest_id):
        """Unfeature a quest (super admin only)"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            quest.is_featured = False
            quest.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UNFEATURE_QUEST] Unfeatured quest: {quest.title} (ID: {quest.id})")
            
            return {
                "message": "Quest unfeatured successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UNFEATURE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to unfeature quest"}, 500
    
    # NEW: Quest Verification and Approval Workflow Methods
    
    @staticmethod
    def submit_quest_proof(quest_id, user_id, proof_data):
        """Submit proof for quest completion (user action)"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            # Check if quest is available for completion
            if not quest.can_user_complete(user_id):
                return {"error": "Quest cannot be completed. It may be inactive or already completed."}, 400
            
            # Check if user already completed this quest
            existing_completion = QuestCompletion.query.filter_by(
                quest_id=quest_id,
                user_id=user_id
            ).first()
            
            if existing_completion:
                return {"error": "Quest already completed"}, 400
            
            # Create quest completion record with proof
            completion = QuestCompletion(
                quest_id=quest_id,
                user_id=user_id,
                verification_status='PENDING',
                proof_submitted=True,
                proof_type=proof_data.get('proof_type', 'IMAGE'),
                proof_data=proof_data.get('proof_files', []),
                proof_text=proof_data.get('proof_text'),
                link_clicked=proof_data.get('link_clicked', False),
                link_click_timestamp=datetime.utcnow() if proof_data.get('link_clicked') else None,
                xp_status='PENDING'  # XP pending until verification
            )
            
            db.session.add(completion)
            
            # Update quest completion count for pending submissions
            quest.completion_count = (quest.completion_count or 0) + 1
            
            db.session.commit()
            
            current_app.logger.info(f"[SUBMIT_QUEST_PROOF] User {user_id} submitted proof for quest {quest_id}")
            
            return {
                "message": "Quest proof submitted successfully! Your submission is being reviewed.",
                "completion": completion.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[SUBMIT_QUEST_PROOF] Error: {e}", exc_info=True)
            return {"error": "Failed to submit quest proof"}, 500
    
    @staticmethod
    def get_pending_verifications(business_id, page=1, per_page=50):
        """Get pending quest verifications for business admin review"""
        try:
            # Get all pending quest completions for this business
            query = QuestCompletion.query.join(Quest).filter(
                Quest.business_id == business_id,
                QuestCompletion.verification_status == 'PENDING'
            ).order_by(QuestCompletion.completed_at.desc())
            
            total_count = query.count()
            completions = query.limit(per_page).offset((page - 1) * per_page).all()
            
            return {
                "pending_verifications": [completion.to_dict() for completion in completions],
                "total_count": total_count,
                "page": page,
                "per_page": per_page
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PENDING_VERIFICATIONS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve pending verifications"}, 500
    
    @staticmethod
    def verify_quest_completion(completion_id, admin_user_id, verification_decision, admin_notes=None):
        """Business admin verifies or rejects quest completion"""
        try:
            completion = QuestCompletion.query.get(completion_id)
            if not completion:
                return {"error": "Quest completion not found"}, 404
            
            if completion.verification_status != 'PENDING':
                return {"error": "Quest completion is not pending verification"}, 400
            
            if verification_decision not in ['VERIFIED', 'REJECTED']:
                return {"error": "Invalid verification decision. Must be 'VERIFIED' or 'REJECTED'"}, 400
            
            # Update completion record
            completion.verification_status = verification_decision
            completion.verified_by_admin_id = admin_user_id
            completion.admin_verification_notes = admin_notes
            completion.verified_at = datetime.utcnow()
            
            if verification_decision == 'VERIFIED':
                # Award XP to user using the central XP awarding system (includes Season Pass multiplier)
                user = User.query.get(completion.user_id)
                quest = Quest.query.get(completion.quest_id)

                if user and quest:
                    from ..controllers.xp_badge_controller import award_xp_no_commit
                    xp_result = award_xp_no_commit(
                        completion.user_id,
                        quest.xp_reward,
                        'QUEST_COMPLETED',
                        related_item_id=completion.quest_id,
                        business_id=quest.business_id
                    )

                    # Extract actual XP awarded (including Season Pass multiplier)
                    if 'error' in xp_result:
                        current_app.logger.error(f"[VERIFY_QUEST_COMPLETION] XP awarding failed: {xp_result['error']}")
                        actual_xp_awarded = quest.xp_reward  # Fallback to base XP
                    else:
                        actual_xp_awarded = xp_result['points_awarded']

                    completion.xp_awarded = actual_xp_awarded
                    completion.xp_status = 'AWARDED'
                    
                    # Create activity log
                    ActivityController.create_activity_log(
                        business_id=quest.business_id,
                        activity_type=ActivityType.QUEST_COMPLETED,
                        title=f"Quest Completed: {quest.title}",
                        description=f"Quest completion verified and {quest.xp_reward} XP awarded",
                        related_item_id=quest.id,
                        user_id=completion.user_id,
                        make_public_by_default=False
                    )
            else:
                completion.xp_status = 'REJECTED'
                # Decrease quest completion count for rejected submissions
                quest = Quest.query.get(completion.quest_id)
                if quest and quest.completion_count > 0:
                    quest.completion_count -= 1
            
            db.session.commit()
            
            status_msg = "verified and XP awarded" if verification_decision == 'VERIFIED' else "rejected"
            current_app.logger.info(f"[VERIFY_QUEST_COMPLETION] Completion {completion_id} {status_msg} by admin {admin_user_id}")
            
            return {
                "message": f"Quest completion {status_msg} successfully",
                "completion": completion.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[VERIFY_QUEST_COMPLETION] Error: {e}", exc_info=True)
            return {"error": "Failed to verify quest completion"}, 500
    
    @staticmethod
    def get_pending_quest_approvals(page=1, per_page=50):
        """Get pending quest approvals for super admin review"""
        try:
            # Get all quests pending approval
            query = Quest.query.filter_by(approval_status='PENDING').order_by(Quest.created_at.desc())
            
            total_count = query.count()
            quests = query.limit(per_page).offset((page - 1) * per_page).all()
            
            return {
                "pending_quests": [quest.to_dict() for quest in quests],
                "total_count": total_count,
                "page": page,
                "per_page": per_page
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PENDING_QUEST_APPROVALS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve pending quest approvals"}, 500
    
    @staticmethod
    def approve_quest(quest_id, admin_id, admin_notes=None):
        """Super admin approves a pending quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            if quest.approval_status != 'PENDING':
                return {"error": "Quest is not pending approval"}, 400
            
            quest.approval_status = 'APPROVED'
            quest.reviewed_by_admin_id = admin_id
            quest.admin_review_notes = admin_notes
            quest.reviewed_at = datetime.utcnow()
            quest.updated_at = datetime.utcnow()
            
            # Automatically publish the quest when approved
            quest.is_published = True
            
            # Update business quest count if applicable
            if quest.business_id:
                business = Business.query.get(quest.business_id)
                if business:
                    business.active_quest_count = Quest.query.filter(
                        Quest.business_id == quest.business_id,
                        Quest.is_published == True,
                        Quest.is_archived == False
                    ).count()
                
                # Create activity log for quest approval and publishing
                ActivityController.create_activity_log(
                    business_id=quest.business_id,
                    activity_type=ActivityType.QUEST_PUBLISHED,
                    title=f"Quest Approved & Published: {quest.title}",
                    description=f"Quest approved by super admin and published - offering {quest.xp_reward} XP",
                    related_item_id=quest.id,
                    user_id=None,  # No user_id for super admin actions
                    make_public_by_default=True
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[APPROVE_QUEST] Quest {quest_id} approved by super admin {admin_id}")
            
            return {
                "message": "Quest approved successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[APPROVE_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to approve quest"}, 500
    
    @staticmethod
    def reject_quest(quest_id, admin_id, admin_notes=None):
        """Super admin rejects a pending quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            if quest.approval_status != 'PENDING':
                return {"error": "Quest is not pending approval"}, 400
            
            quest.approval_status = 'REJECTED'
            quest.reviewed_by_admin_id = admin_id
            quest.admin_review_notes = admin_notes
            quest.reviewed_at = datetime.utcnow()
            quest.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            current_app.logger.info(f"[REJECT_QUEST] Quest {quest_id} rejected by super admin {admin_id}")
            
            return {
                "message": "Quest rejected successfully",
                "quest": quest.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[REJECT_QUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to reject quest"}, 500
    
    # NEW: Helper methods for Eclipseer quest validation and progress tracking
    
    @staticmethod
    def _validate_eclipseer_quest(quest, user_id):
        """Validate if user meets requirements for Eclipseer quest completion"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"valid": False, "message": "User not found"}
            
            target_data = quest.target_data or {}
            target_count = target_data.get('target_count', 1)
            
            if quest.quest_type == 'COMPLETE_X_SURVEYS_DAILY':
                # Check daily survey completions in last 24 hours
                daily_count = UserDailyActivity.get_rolling_24h_count(user_id, 'SURVEY_COMPLETED')
                if daily_count < target_count:
                    return {"valid": False, "message": f"Complete {target_count} surveys in 24 hours. Current: {daily_count}"}
            
            elif quest.quest_type == 'COMPLETE_X_SURVEYS_TOTAL':
                # Check total survey completions
                if user.surveys_completed_count < target_count:
                    return {"valid": False, "message": f"Complete {target_count} surveys total. Current: {user.surveys_completed_count}"}
            
            elif quest.quest_type == 'SELECT_X_TAGS':
                # Check tag selections
                if user.tags_selected_count < target_count:
                    return {"valid": False, "message": f"Select {target_count} profile tags. Current: {user.tags_selected_count}"}
            
            elif quest.quest_type == 'COMPLETE_X_QUESTS':
                # Check quest completions
                if user.quests_completed_count < target_count:
                    return {"valid": False, "message": f"Complete {target_count} quests. Current: {user.quests_completed_count}"}
            
            elif quest.quest_type == 'VISIT_X_BRAND_PAGES':
                # Check brand page visits
                if user.brand_pages_visited_count < target_count:
                    return {"valid": False, "message": f"Visit {target_count} brand pages. Current: {user.brand_pages_visited_count}"}
            
            elif quest.quest_type == 'UPLOAD_PROFILE_PICTURE':
                # Check if user has profile picture
                if not user.has_profile_picture:
                    return {"valid": False, "message": "Upload a profile picture to complete this quest"}
            
            elif quest.quest_type == 'COMPLETE_PROFILE_SECTION':
                # Check specific profile section completion
                section = target_data.get('section', 'basic')
                if section == 'basic' and not (user.name and user.location and user.occupation):
                    return {"valid": False, "message": "Complete basic profile information (name, location, occupation)"}
                elif section == 'interests' and not user.interests:
                    return {"valid": False, "message": "Add interests to your profile"}
                elif section == 'devices' and not user.owned_devices:
                    return {"valid": False, "message": "Add owned devices to your profile"}
                elif section == 'demographics' and not (user.age or user.date_of_birth):
                    return {"valid": False, "message": "Add age/date of birth to your profile"}
            
            return {"valid": True, "message": "Quest requirements met"}
            
        except Exception as e:
            current_app.logger.error(f"[VALIDATE_ECLIPSEER_QUEST] Error: {e}", exc_info=True)
            return {"valid": False, "message": "Failed to validate quest requirements"}
    
    @staticmethod
    def get_user_quest_progress(user_id, quest_id):
        """Get user's progress on a specific quest"""
        try:
            quest = Quest.query.get(quest_id)
            if not quest:
                return {"error": "Quest not found"}, 404
            
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}, 404
            
            # For non-Eclipseer quests, just return completion status
            if quest.quest_type not in ['COMPLETE_X_SURVEYS_DAILY', 'COMPLETE_X_SURVEYS_TOTAL', 'SELECT_X_TAGS', 'COMPLETE_X_QUESTS', 'VISIT_X_BRAND_PAGES']:
                is_completed = QuestCompletion.query.filter_by(quest_id=quest_id, user_id=user_id).first() is not None
                return {
                    "quest_id": quest_id,
                    "user_id": user_id,
                    "current_progress": 1 if is_completed else 0,
                    "target_count": 1,
                    "is_completed": is_completed,
                    "progress_percentage": 100 if is_completed else 0
                }, 200
            
            # For Eclipseer quests, calculate current progress
            target_data = quest.target_data or {}
            target_count = target_data.get('target_count', 1)
            current_progress = 0
            
            if quest.quest_type == 'COMPLETE_X_SURVEYS_DAILY':
                current_progress = UserDailyActivity.get_rolling_24h_count(user_id, 'SURVEY_COMPLETED')
            elif quest.quest_type == 'COMPLETE_X_SURVEYS_TOTAL':
                current_progress = user.surveys_completed_count
            elif quest.quest_type == 'SELECT_X_TAGS':
                current_progress = user.tags_selected_count
            elif quest.quest_type == 'COMPLETE_X_QUESTS':
                current_progress = user.quests_completed_count
            elif quest.quest_type == 'VISIT_X_BRAND_PAGES':
                current_progress = user.brand_pages_visited_count
            
            is_completed = current_progress >= target_count
            progress_percentage = min((current_progress / target_count * 100), 100) if target_count > 0 else 0
            
            return {
                "quest_id": quest_id,
                "user_id": user_id,
                "current_progress": current_progress,
                "target_count": target_count,
                "is_completed": is_completed,
                "progress_percentage": progress_percentage,
                "quest_type": quest.quest_type
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_USER_QUEST_PROGRESS] Error: {e}", exc_info=True)
            return {"error": "Failed to get quest progress"}, 500

    @staticmethod
    def get_business_quest_limits(business_id):
        """Get quest limit information for a business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            # Calculate current month's quests
            current_month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            current_month_quests = Quest.query.filter(
                Quest.business_id == business_id,
                Quest.created_at >= current_month_start
            ).count()
            
            tier_info = business.tier_info
            has_tier_limits = tier_info and tier_info.can_create_quests
            
            if has_tier_limits:
                monthly_limit = tier_info.monthly_quest_limit
                tier_name = tier_info.name
                can_create = tier_info.can_create_quests
            else:
                monthly_limit = business.monthly_quest_limit
                tier_name = "Legacy"
                can_create = business.monthly_quest_limit > 0
            
            credits_remaining = business.quest_credits_purchased or 0
            
            # Calculate available quests this month
            if monthly_limit == -1:
                available_monthly = -1  # Unlimited
                monthly_used = 0
            else:
                available_monthly = max(0, monthly_limit - current_month_quests)
                monthly_used = current_month_quests
            
            # Total available quests = monthly available + credits
            if available_monthly == -1:
                total_available = -1
            else:
                total_available = available_monthly + credits_remaining
            
            # Determine if business can create quests based on tier permissions
            can_create_based_on_tier = can_create
            
            # Check if they have any available capacity (monthly or credits)
            has_capacity = (available_monthly == -1) or (available_monthly > 0) or (credits_remaining > 0)
            
            # Final creation permission
            can_create_quests = can_create_based_on_tier and has_capacity
            
            return {
                "business_id": business_id,
                "tier_name": tier_name,
                "monthly_limit": monthly_limit,
                "monthly_used": monthly_used,
                "monthly_available": available_monthly,
                "credits_purchased": credits_remaining,
                "total_available": total_available,
                "can_create_quests": can_create_quests,
                "tier_allows_creation": can_create_based_on_tier,
                "has_available_capacity": has_capacity
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_QUEST_LIMITS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business quest limits"}, 500 