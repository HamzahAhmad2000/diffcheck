"""
XP and Badge Management Controller
Handles XP awarding, badge checking, and gamification logic
"""

from flask import request, jsonify
from ..models import db, User, Badge, UserBadge, PointsLog, MarketplaceItem, UserRewardLog, RewardStatus
from datetime import datetime
from sqlalchemy import func

def award_xp_no_commit(user_id, points, activity_type, related_item_id=None, business_id=None):
    """
    Award XP without committing the transaction - for use within existing transactions
    
    Args:
        user_id: ID of user receiving XP
        points: Amount of XP to award
        activity_type: Type of activity (e.g., 'SURVEY_COMPLETED', 'BUG_REPORTED')
        related_item_id: Optional ID of related item (survey, item, etc.)
        business_id: Optional business context
    
    Returns:
        dict: {
            'points_awarded': int,
            'new_badges': list of badge dicts,
            'total_xp': int,
            'xp_balance': int,
            'user': User object (for reference)
        }
    """
    try:
        # Get user
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        # Create PointsLog entry
        points_log = PointsLog(
            user_id=user_id,
            business_id=business_id,
            survey_id=related_item_id if activity_type.startswith('SURVEY') else None,
            item_id=related_item_id if activity_type in ['BUG_REPORTED', 'FEATURE_REQUESTED'] else None,
            activity_type=activity_type,
            points_awarded=points
        )
        db.session.add(points_log)
        
        # Update user XP
        user.xp_balance += points
        user.total_xp_earned += points
        
        # Process Season Pass XP gain FIRST (to get the correct multiplier)
        season_pass_result = None
        actual_xp_awarded = points
        try:
            # Import here to avoid circular imports
            from ..controllers.season_pass_controller import SeasonPassController
            season_pass_result = SeasonPassController.process_xp_gain(
                user_id, points, activity_type, related_item_id, business_id
            )
            # If Season Pass processing was successful, use the actual XP awarded (with multiplier)
            if season_pass_result and 'xp_gained' in season_pass_result:
                actual_xp_awarded = season_pass_result['xp_gained']
        except ImportError:
            # Season Pass system not available
            pass
        except Exception as e:
            # Log error but don't fail the main XP award
            import logging
            logging.getLogger(__name__).warning(f"Season Pass XP processing failed: {str(e)}")
        
        # Update PointsLog with actual XP awarded (including multiplier)
        points_log.points_awarded = actual_xp_awarded
        
        # Update user XP with actual amount (including Season Pass multiplier)
        user.xp_balance = user.xp_balance - points + actual_xp_awarded  # Adjust for the difference
        user.total_xp_earned = user.total_xp_earned - points + actual_xp_awarded
        
        # Check for new badges (without committing)
        new_badges = check_and_award_badges_no_commit(user_id)
        
        return {
            'points_awarded': actual_xp_awarded,
            'base_points': points,
            'new_badges': new_badges,
            'total_xp': user.total_xp_earned,
            'xp_balance': user.xp_balance,
            'user': user,
            'season_pass_result': season_pass_result
        }
        
    except Exception as e:
        return {'error': str(e)}

def award_xp(user_id, points, activity_type, related_item_id=None, business_id=None):
    """
    Central function to award XP and check for new badges (with commit)
    
    Args:
        user_id: ID of user receiving XP
        points: Amount of XP to award
        activity_type: Type of activity (e.g., 'SURVEY_COMPLETED', 'BUG_REPORTED')
        related_item_id: Optional ID of related item (survey, item, etc.)
        business_id: Optional business context
    
    Returns:
        dict: {
            'points_awarded': int,
            'new_badges': list of badge dicts,
            'total_xp': int,
            'xp_balance': int
        }
    """
    try:
        result = award_xp_no_commit(user_id, points, activity_type, related_item_id, business_id)
        
        if 'error' in result:
            return result
        
        db.session.commit()
        
        # Remove user object from result before returning (not JSON serializable)
        result.pop('user', None)
        return result
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}

def check_and_award_badges_no_commit(user_id):
    """
    Check if user has earned any new badges and award them (without committing)
    
    Args:
        user_id: ID of user to check
        
    Returns:
        list: List of newly awarded badge dictionaries
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return []
        
        # Get all badges user is eligible for
        eligible_badges = Badge.query.filter(
            Badge.xp_threshold <= user.total_xp_earned
        ).all()
        
        # Get badges user already has
        existing_badge_ids = {ub.badge_id for ub in UserBadge.query.filter_by(user_id=user_id).all()}
        
        # Award new badges
        new_badges = []
        for badge in eligible_badges:
            if badge.id not in existing_badge_ids:
                user_badge = UserBadge(
                    user_id=user_id,
                    badge_id=badge.id
                )
                db.session.add(user_badge)
                
                badge_dict = badge.to_dict()
                
                # Add share prompt data for newly earned badges
                try:
                    from .share_controller import ShareController
                    from ..models import ShareType, SystemConfiguration
                    
                    # Check if share-to-earn feature is enabled
                    if SystemConfiguration.get_config('share_to_earn_enabled', True):
                        # Check if user hasn't already shared this badge
                        from ..models import UserShare
                        existing_share = UserShare.query.filter(
                            UserShare.user_id == user_id,
                            UserShare.share_type == ShareType.BADGE_SHARE.value,
                            UserShare.related_object_id == badge.id
                        ).first()
                        
                        if not existing_share:
                            # Generate share URL for this badge
                            share_url_result = ShareController.generate_share_url(
                                ShareType.BADGE_SHARE.value, 
                                badge.id, 
                                user_id
                            )
                            
                            if 'error' not in share_url_result:
                                badge_dict['share_prompt'] = {
                                    'eligible_for_share': True,
                                    'share_type': ShareType.BADGE_SHARE.value,
                                    'related_object_id': badge.id,
                                    'share_url': share_url_result['share_url'],
                                    'share_text': share_url_result['share_text'],
                                    'xp_reward': SystemConfiguration.get_config('xp_reward_badge_share', 50)
                                }
                        
                except Exception as e:
                    # Don't fail badge awarding if share prompt fails
                    import logging
                    logging.getLogger(__name__).error(f"Error generating share prompt for badge {badge.id}: {e}")
                
                new_badges.append(badge_dict)
        
        return new_badges
        
    except Exception as e:
        print(f"Error checking badges: {str(e)}")
        return []

def check_and_award_badges(user_id):
    """
    Check if user has earned any new badges and award them (with commit)
    
    Args:
        user_id: ID of user to check
        
    Returns:
        list: List of newly awarded badge dictionaries
    """
    try:
        new_badges = check_and_award_badges_no_commit(user_id)
        db.session.commit()
        return new_badges
        
    except Exception as e:
        db.session.rollback()
        print(f"Error checking badges: {str(e)}")
        return []

def get_user_badges(user_id):
    """Get all badges earned by a user"""
    try:
        user_badges = db.session.query(UserBadge, Badge).join(Badge).filter(
            UserBadge.user_id == user_id
        ).order_by(UserBadge.earned_at.desc()).all()
        
        return [
            {
                "badge": badge.to_dict(),
                "earned_at": user_badge.earned_at.isoformat()
            }
            for user_badge, badge in user_badges
        ]
        
    except Exception as e:
        return {'error': str(e)}

def get_user_xp_summary(user_id):
    """Get comprehensive XP summary for a user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        # Get recent XP activities
        recent_activities = PointsLog.query.filter_by(user_id=user_id)\
            .order_by(PointsLog.created_at.desc())\
            .limit(10).all()
        
        # Get user badges
        badges = get_user_badges(user_id)
        
        # Get next badge threshold
        next_badge = Badge.query.filter(
            Badge.xp_threshold > user.total_xp_earned
        ).order_by(Badge.xp_threshold.asc()).first()
        
        return {
            'xp_balance': user.xp_balance,
            'total_xp_earned': user.total_xp_earned,
            'badges': badges if not isinstance(badges, dict) else [],
            'next_badge': next_badge.to_dict() if next_badge else None,
            'recent_activities': [activity.to_dict() for activity in recent_activities]
        }
        
    except Exception as e:
        return {'error': str(e)}

def calculate_profile_completion_xp(user_data):
    """
    Calculate XP earned from profile completion
    
    Args:
        user_data: Dictionary of user profile data
        
    Returns:
        int: XP points earned
    """
    xp_earned = 0
    
    # 10 XP for each demographic field
    # Ensure user_data keys match the User model fields or .to_dict() output keys
    demographic_fields = {
        'date_of_birth': 10, # Changed from 'age'
        'gender': 10,
        'country': 10,
        'region': 10,
        # 'location': 5, # Example: if location is a general text field, might be harder to score
        # 'company': 5, 
        # 'occupation': 5
    }
    for field, points in demographic_fields.items():
        if user_data.get(field): # Checks for presence and non-empty for strings, non-None for others
            xp_earned += points
    
    # 10 XP if at least one tag is selected across all categories
    tag_fields = ['interests', 'owned_devices', 'memberships']
    has_any_tags = any(
        user_data.get(field) and len(user_data.get(field, [])) > 0 
        for field in tag_fields
    )
    if has_any_tags:
        xp_earned += 10
    
    return xp_earned

def spend_xp(user_id, amount, description="XP spent"):
    """
    Deduct XP from user's balance
    
    Args:
        user_id: ID of user
        amount: Amount of XP to deduct (should be positive)
        description: Description of what XP was spent on
        
    Returns:
        bool: True if successful, False if insufficient balance or error
    """
    try:
        user = User.query.get(user_id)
        if not user:
            # Consider logging this: current_app.logger.error(f"[SPEND_XP] User not found: {user_id}")
            return False
        
        if amount <= 0: # Prevent spending zero or negative XP
            # Consider logging this: current_app.logger.warning(f"[SPEND_XP] Attempted to spend non-positive XP amount: {amount} for user {user_id}")
            return False

        if user.xp_balance < amount:
            # current_app.logger.info(f"[SPEND_XP] Insufficient XP for user {user_id}. Has: {user.xp_balance}, Needs: {amount}")
            return False
        
        user.xp_balance -= amount
        
        # Create PointsLog entry for spending
        points_log_entry = PointsLog(
            user_id=user_id,
            points_awarded=(-1 * amount),  # Store as negative for spending
            activity_type='XP_SPENT_MARKETPLACE', # Or a more generic 'XP_SPENT'
            # description=description # PointsLog model does not have a description field, but activity_type can be descriptive
            # Consider adding related_item_id if applicable, e.g., marketplace_item_id
        )
        db.session.add(points_log_entry)
        
        db.session.commit()
        # current_app.logger.info(f"[SPEND_XP] Successfully spent {amount} XP for user {user_id}. New balance: {user.xp_balance}")
        return True
        
    except Exception as e:
        db.session.rollback()
        # Consider logging this: current_app.logger.error(f"[SPEND_XP] Error spending XP for user {user_id}: {e}", exc_info=True)
        return False

def get_user_dashboard_overview(user_id):
    """
    Get overview stats for the user dashboard.
    
    Args:
        user_id: ID of the user
        
    Returns:
        dict: {
            'surveys_completed_count': int,
            'completedQuests': int,
            'total_xp_earned': int,
            'xp_balance': int
        }
        or {'error': str} on failure
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}

        # Use the new counter from the User model
        completed_surveys_count = user.surveys_completed_count

        # Placeholder for completed quests
        completed_quests_count = 0 
        # TODO: Implement quest completion tracking when quests are live
        # Example: completed_quests_count = PointsLog.query.filter_by(user_id=user_id, activity_type='QUEST_COMPLETED').count()

        # Return field names that match frontend expectations
        return {
            'surveys_completed_count': completed_surveys_count,
            'completedQuests': completed_quests_count,
            'total_xp_earned': user.total_xp_earned,
            'xp_balance': user.xp_balance,
            # Also include legacy names for backward compatibility
            'completedSurveys': completed_surveys_count,
            'totalPoints': user.total_xp_earned,
            'xpBalance': user.xp_balance
        }
    except Exception as e:
        # Log the error e.g., current_app.logger.error(f"Error in get_user_dashboard_overview: {e}")
        return {'error': str(e)}

def get_user_badge_overview(user_id):
    """
    Get comprehensive badge overview including earned badges and upcoming badges with progress
    
    Args:
        user_id: ID of the user
        
    Returns:
        dict: {
            'earned_badges': list of earned badge objects with earned_at timestamps,
            'upcoming_badges': list of unearned badge objects with progress info,
            'user_stats': dict with user XP and survey completion stats,
            'total_badges_available': int,
            'total_badges_earned': int
        }
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return {'error': 'User not found'}
        
        # Get all badges
        all_badges = Badge.query.order_by(Badge.xp_threshold.asc()).all()
        
        # Get badges user already has
        user_badges_query = db.session.query(UserBadge, Badge).join(Badge).filter(
            UserBadge.user_id == user_id
        ).order_by(UserBadge.earned_at.desc()).all()
        
        earned_badge_ids = {ub.badge_id for ub, _ in user_badges_query}
        
        # Format earned badges
        earned_badges = []
        for user_badge, badge in user_badges_query:
            earned_badges.append({
                "badge": badge.to_dict(),
                "earned_at": user_badge.earned_at.isoformat()
            })
        
        # Format upcoming badges (not yet earned)
        upcoming_badges = []
        for badge in all_badges:
            if badge.id not in earned_badge_ids:
                # Calculate progress percentage
                progress_percentage = min(100, (user.total_xp_earned / badge.xp_threshold) * 100) if badge.xp_threshold > 0 else 100
                xp_needed = max(0, badge.xp_threshold - user.total_xp_earned)
                
                upcoming_badges.append({
                    "badge": badge.to_dict(),
                    "progress_percentage": round(progress_percentage, 1),
                    "xp_needed": xp_needed,
                    "is_achievable": user.total_xp_earned >= badge.xp_threshold
                })
        
        # User stats for display
        user_stats = {
            'total_xp_earned': user.total_xp_earned,
            'xp_balance': user.xp_balance,
            'surveys_completed_count': user.surveys_completed_count,
            'join_date': user.created_at.isoformat() if user.created_at else None,
            'username': user.username or user.email.split('@')[0] if user.email else 'User'
        }
        
        return {
            'earned_badges': earned_badges,
            'upcoming_badges': upcoming_badges,
            'user_stats': user_stats,
            'total_badges_available': len(all_badges),
            'total_badges_earned': len(earned_badges)
        }
        
    except Exception as e:
        return {'error': str(e)} 