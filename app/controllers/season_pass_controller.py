"""
Season Pass Controller
Handles all business logic for the Season Pass system including
progression, rewards, purchases, and admin management
"""

from flask import current_app
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
import logging

from ..extensions import db
from ..models import User, Badge, MarketplaceItem, PointsLog
from ..models.season_pass_models import (
    Season, SeasonLevel, SeasonReward, UserSeasonPass, 
    UserSeasonProgress, SeasonPassTransaction, PassTierType, SeasonRewardType
)
from ..controllers.xp_badge_controller import award_xp_no_commit
from ..controllers.marketplace_controller import MarketplaceController

logger = logging.getLogger(__name__)

class SeasonPassController:
    """Main controller for Season Pass functionality"""
    
    @staticmethod
    def get_active_season():
        """Get the currently active season"""
        return Season.query.filter_by(is_active=True).first()
    
    @staticmethod
    def get_user_season_state(user_id):
        """
        Get complete season pass state for a user including:
        - Season info
        - User progress
        - User pass (if purchased)
        - All levels and rewards
        - Countdown timer if applicable
        """
        try:
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season found"}
            
            # Get or create user progress
            progress = UserSeasonProgress.query.filter_by(
                user_id=user_id, 
                season_id=active_season.id
            ).first()
            
            if not progress:
                progress = UserSeasonProgress(
                    user_id=user_id,
                    season_id=active_season.id,
                    current_xp_in_season=0,
                    current_level=0,
                    claimed_rewards=[]
                )
                db.session.add(progress)
                db.session.commit()
            
            # Get user's season pass (if purchased)
            user_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()
            
            # Get all levels with rewards
            levels_data = SeasonPassController._build_levels_data(active_season.id, progress, user_pass)
            
            # Build response
            state = {
                "season_info": {
                    "id": active_season.id,
                    "name": active_season.name,
                    "description": active_season.description,
                    "end_date": active_season.end_date.isoformat() if active_season.end_date else None,
                    "countdown": active_season.get_countdown_time(),
                    "banner_image_url": active_season.banner_image_url,
                    "thumbnail_image_url": active_season.thumbnail_image_url,
                    "lunar_pass_price": active_season.lunar_pass_price,
                    "totality_pass_price": active_season.totality_pass_price,
                    "lunar_xp_multiplier": active_season.lunar_xp_multiplier,
                    "totality_xp_multiplier": active_season.totality_xp_multiplier
                },
                "user_progress": progress.to_dict(),
                "user_pass": user_pass.to_dict() if user_pass else None,
                "levels": levels_data,
                "pass_activation_available": user_pass is None
            }
            
            return state
            
        except Exception as e:
            logger.error(f"Error getting user season state: {str(e)}")
            return {"error": "Failed to retrieve season state"}
    
    @staticmethod
    def _build_levels_data(season_id, progress, user_pass):
        """Build comprehensive levels data with rewards and claim status"""
        levels = SeasonLevel.query.filter_by(season_id=season_id).order_by(SeasonLevel.level_number).all()
        unlocked_levels = progress.get_unlocked_levels()
        claimed_rewards = progress.claimed_rewards or []
        
        levels_data = []
        for level in levels:
            # Get rewards for this level
            lunar_reward = SeasonReward.query.filter_by(
                season_level_id=level.id,
                tier_type=PassTierType.LUNAR.value
            ).first()
            
            totality_reward = SeasonReward.query.filter_by(
                season_level_id=level.id,
                tier_type=PassTierType.TOTALITY.value
            ).first()
            
            level_data = {
                "level_number": level.level_number,
                "xp_required_for_level": level.xp_required_for_level,
                "cumulative_xp_required": level.get_cumulative_xp_required(),
                "is_unlocked": level.level_number in unlocked_levels,
                "lunar_reward": None,
                "totality_reward": None
            }
            
            # Add lunar reward data
            if lunar_reward:
                reward_data = lunar_reward.to_dict()
                reward_data["can_claim"] = (
                    user_pass and 
                    user_pass.tier_type in [PassTierType.LUNAR.value, PassTierType.TOTALITY.value] and
                    level.level_number in unlocked_levels and
                    lunar_reward.id not in claimed_rewards
                )
                reward_data["is_claimed"] = lunar_reward.id in claimed_rewards
                level_data["lunar_reward"] = reward_data
            
            # Add totality reward data
            if totality_reward:
                reward_data = totality_reward.to_dict()
                reward_data["can_claim"] = (
                    user_pass and 
                    user_pass.tier_type == PassTierType.TOTALITY.value and
                    level.level_number in unlocked_levels and
                    totality_reward.id not in claimed_rewards
                )
                reward_data["is_claimed"] = totality_reward.id in claimed_rewards
                level_data["totality_reward"] = reward_data
            
            levels_data.append(level_data)
        
        return levels_data
    
    @staticmethod
    def process_xp_gain(user_id, base_xp_amount, activity_type, related_item_id=None, business_id=None):
        """
        Process XP gain for season pass with multiplier application
        This should be called from the main XP awarding system
        """
        try:
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return  # No active season, no season pass progression
            
            # Get user's season pass
            user_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()
            
            # Determine multiplier
            # NOTE: Multiplier only applies to XP earned AFTER pass activation
            # The purchased_at timestamp ensures existing XP is not retroactively multiplied
            multiplier = 1.0
            if user_pass:
                # The pass exists and was purchased before this XP gain
                # So the multiplier applies to this new XP
                if user_pass.tier_type == PassTierType.LUNAR.value:
                    multiplier = active_season.lunar_xp_multiplier
                elif user_pass.tier_type == PassTierType.TOTALITY.value:
                    multiplier = active_season.totality_xp_multiplier
            
            # Calculate final XP amount
            final_xp_amount = int(base_xp_amount * multiplier)
            
            # Create transaction record
            transaction = SeasonPassTransaction(
                user_id=user_id,
                season_id=active_season.id,
                base_xp_amount=base_xp_amount,
                multiplier_applied=multiplier,
                final_xp_amount=final_xp_amount,
                activity_type=activity_type,
                related_item_id=related_item_id,
                business_id=business_id
            )
            db.session.add(transaction)
            
            # Get or create user progress
            progress = UserSeasonProgress.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()
            
            if not progress:
                progress = UserSeasonProgress(
                    user_id=user_id,
                    season_id=active_season.id,
                    current_xp_in_season=0,
                    current_level=0,
                    claimed_rewards=[]
                )
                db.session.add(progress)
            
            # Add XP to progress
            old_xp = progress.current_xp_in_season
            progress.current_xp_in_season += final_xp_amount
            
            # Check for level ups
            old_level = progress.current_level
            new_level = SeasonPassController._calculate_new_level(
                progress.current_xp_in_season, 
                active_season.id
            )
            progress.current_level = new_level
            
            db.session.commit()
            
            # Log level up if it occurred
            if new_level > old_level:
                logger.info(f"User {user_id} leveled up from {old_level} to {new_level} in season {active_season.id}")
            
            return {
                "xp_gained": final_xp_amount,
                "multiplier": multiplier,
                "old_level": old_level,
                "new_level": new_level,
                "total_season_xp": progress.current_xp_in_season
            }
            
        except Exception as e:
            logger.error(f"Error processing season pass XP gain: {str(e)}")
            db.session.rollback()
            return None
    
    @staticmethod
    def _calculate_new_level(current_xp, season_id):
        """Calculate what level the user should be at with given XP"""
        levels = SeasonLevel.query.filter_by(season_id=season_id).order_by(SeasonLevel.level_number).all()
        
        cumulative_xp = 0
        current_level = 0
        
        for level in levels:
            cumulative_xp += level.xp_required_for_level
            if current_xp >= cumulative_xp:
                current_level = level.level_number
            else:
                break
        
        return current_level
    
    @staticmethod
    def claim_reward(user_id, season_reward_id):
        """
        Claim a specific season reward
        """
        try:
            # Get the reward
            reward = SeasonReward.query.get(season_reward_id)
            if not reward:
                return {"error": "Reward not found"}
            
            # Get user's progress
            progress = UserSeasonProgress.query.filter_by(
                user_id=user_id,
                season_id=reward.level.season_id
            ).first()
            
            if not progress:
                return {"error": "No progress found for this season"}
            
            # Check if reward is already claimed
            claimed_rewards = progress.claimed_rewards or []
            if season_reward_id in claimed_rewards:
                return {"error": "Reward already claimed"}
            
            # Get user's season pass
            user_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=reward.level.season_id
            ).first()
            
            # Check if user has the right pass tier
            if not user_pass:
                return {"error": "Season pass required to claim rewards"}
            
            if reward.tier_type == PassTierType.TOTALITY.value and user_pass.tier_type != PassTierType.TOTALITY.value:
                return {"error": "Totality pass required for this reward"}
            
            # Check if level is unlocked
            unlocked_levels = progress.get_unlocked_levels()
            if reward.level.level_number not in unlocked_levels:
                return {"error": "Level not unlocked yet"}
            
            # Process the reward based on type
            result = SeasonPassController._process_reward_claim(user_id, reward)
            if "error" in result:
                return result
            
            # Mark reward as claimed
            claimed_rewards.append(season_reward_id)
            progress.claimed_rewards = claimed_rewards
            db.session.commit()
            
            return {
                "success": True,
                "message": "Reward claimed successfully",
                "reward": reward.to_dict(),
                "reward_result": result
            }
            
        except Exception as e:
            logger.error(f"Error claiming reward: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to claim reward"}
    
    @staticmethod
    def _process_reward_claim(user_id, reward):
        """Process the actual reward based on its type"""
        try:
            if reward.reward_type == SeasonRewardType.XP.value:
                # Award XP directly (not through season pass system to avoid loops)
                user = User.query.get(user_id)
                if user and reward.xp_amount:
                    user.xp_balance += reward.xp_amount
                    user.total_xp_earned += reward.xp_amount
                    
                    # Create points log entry
                    points_log = PointsLog(
                        user_id=user_id,
                        activity_type="SEASON_PASS_REWARD",
                        points_awarded=reward.xp_amount
                    )
                    db.session.add(points_log)
                    
                    return {"xp_awarded": reward.xp_amount}
            
            elif reward.reward_type == SeasonRewardType.BADGE.value:
                # Award badge
                if reward.badge_id:
                    from ..controllers.xp_badge_controller import award_badge_no_commit
                    result = award_badge_no_commit(user_id, reward.badge_id)
                    return {"badge_awarded": result}
            
            elif reward.reward_type == SeasonRewardType.RAFFLE_ENTRY.value:
                # Create raffle entry
                if reward.marketplace_item_id:
                    from ..controllers.marketplace_controller import MarketplaceController
                    result = MarketplaceController.create_raffle_entry(user_id, reward.marketplace_item_id)
                    return {"raffle_entry_created": result}
            
            elif reward.reward_type == SeasonRewardType.MARKETPLACE_ITEM.value:
                # Direct marketplace item reward - create a UserRewardLog entry
                if reward.marketplace_item_id:
                    # Import here to avoid circular imports
                    from ..controllers.marketplace_controller import redeem_item

                    # Create a reward log entry for the marketplace item
                    marketplace_reward_log = UserRewardLog(
                        user_id=user_id,
                        marketplace_item_id=reward.marketplace_item_id,
                        xp_spent=0,  # Free from season pass reward
                        reward_type='SEASON_PASS_ITEM',
                        status=RewardStatus.DELIVERED.value,  # Immediately delivered
                        notes=f"Season pass reward: {reward.display_name or 'Marketplace Item'}"
                    )
                    db.session.add(marketplace_reward_log)
                    db.session.commit()

                    return {
                        "marketplace_item_awarded": reward.marketplace_item_id,
                        "reward_log_id": marketplace_reward_log.id
                    }
            
            else:
                return {"custom_reward": reward.custom_data}
                
        except Exception as e:
            logger.error(f"Error processing reward claim: {str(e)}")
            return {"error": "Failed to process reward"}
    
    @staticmethod
    def purchase_season_pass(user_id, tier_type, payment_method=None, payment_reference=None):
        """
        Purchase a season pass for the current season
        """
        try:
            active_season = SeasonPassController.get_active_season()
            if not active_season:
                return {"error": "No active season available"}
            
            # Check if user already has a pass for this season
            existing_pass = UserSeasonPass.query.filter_by(
                user_id=user_id,
                season_id=active_season.id
            ).first()
            
            if existing_pass:
                return {"error": "Season pass already purchased for this season"}
            
            # Validate tier type
            if tier_type not in [PassTierType.LUNAR.value, PassTierType.TOTALITY.value]:
                return {"error": "Invalid tier type"}
            
            # Get price
            price = (active_season.lunar_pass_price if tier_type == PassTierType.LUNAR.value 
                    else active_season.totality_pass_price)
            
            # Create the pass
            user_pass = UserSeasonPass(
                user_id=user_id,
                season_id=active_season.id,
                tier_type=tier_type,
                purchase_price=price,
                payment_method=payment_method,
                payment_reference=payment_reference
            )
            db.session.add(user_pass)
            db.session.commit()
            
            # Log the purchase
            logger.info(f"User {user_id} purchased {tier_type} pass for season {active_season.id}")
            
            return {
                "success": True,
                "message": "Season pass purchased successfully",
                "pass": user_pass.to_dict()
            }
            
        except Exception as e:
            logger.error(f"Error purchasing season pass: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to purchase season pass"}

class SeasonPassAdminController:
    """Admin functions for managing seasons"""
    
    @staticmethod
    def create_season(admin_id, season_data):
        """Create a new season"""
        try:
            # Validate required fields
            required_fields = ['name']
            for field in required_fields:
                if field not in season_data:
                    return {"error": f"Missing required field: {field}"}
            
            # Create season
            season = Season(
                name=season_data['name'],
                description=season_data.get('description'),
                start_date=datetime.fromisoformat(season_data['start_date']) if season_data.get('start_date') and season_data['start_date'].strip() else datetime.utcnow(),
                end_date=datetime.fromisoformat(season_data['end_date']) if season_data.get('end_date') and season_data['end_date'].strip() else None,
                lunar_pass_price=season_data.get('lunar_pass_price', 1999),
                totality_pass_price=season_data.get('totality_pass_price', 3499),
                lunar_xp_multiplier=season_data.get('lunar_xp_multiplier', 1.25),
                totality_xp_multiplier=season_data.get('totality_xp_multiplier', 2.0),
                banner_image_url=season_data.get('banner_image_url'),
                thumbnail_image_url=season_data.get('thumbnail_image_url'),
                created_by_admin_id=admin_id
            )
            db.session.add(season)
            db.session.flush()  # Get the ID
            
            # Create default levels if provided
            if 'levels' in season_data:
                for level_data in season_data['levels']:
                    level = SeasonLevel(
                        season_id=season.id,
                        level_number=level_data['level_number'],
                        xp_required_for_level=level_data.get('xp_required_for_level', 250)
                    )
                    db.session.add(level)
            
            db.session.commit()
            
            return {
                "success": True,
                "season": season.to_dict()
            }
            
        except Exception as e:
            logger.error(f"Error creating season: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to create season"}
    
    @staticmethod
    def activate_season(season_id):
        """Activate a season (deactivates current active season)"""
        try:
            # Deactivate current active season
            current_active = Season.query.filter_by(is_active=True).first()
            if current_active:
                current_active.is_active = False
            
            # Activate new season
            season = Season.query.get(season_id)
            if not season:
                return {"error": "Season not found"}
            
            season.is_active = True
            season.is_next = False  # Remove from next if it was there
            
            db.session.commit()
            
            return {
                "success": True,
                "message": f"Season '{season.name}' activated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error activating season: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to activate season"}
    
    @staticmethod
    def set_next_season(season_id):
        """Set a season as the next season"""
        try:
            # Remove current next season status
            current_next = Season.query.filter_by(is_next=True).first()
            if current_next:
                current_next.is_next = False
            
            # Set new next season
            season = Season.query.get(season_id)
            if not season:
                return {"error": "Season not found"}
            
            season.is_next = True
            db.session.commit()
            
            return {
                "success": True,
                "message": f"Season '{season.name}' set as next season"
            }
            
        except Exception as e:
            logger.error(f"Error setting next season: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to set next season"}
    
    @staticmethod
    def update_xp_requirements(season_id, level_xp_map):
        """
        Update XP requirements for levels in a season
        level_xp_map: dict of {level_number: xp_required}
        """
        try:
            season = Season.query.get(season_id)
            if not season:
                return {"error": "Season not found"}
            
            updated_levels = []
            for level_number, xp_required in level_xp_map.items():
                level = SeasonLevel.query.filter_by(
                    season_id=season_id,
                    level_number=level_number
                ).first()
                
                if level:
                    level.xp_required_for_level = xp_required
                    updated_levels.append(level_number)
            
            db.session.commit()
            
            return {
                "success": True,
                "message": f"Updated XP requirements for levels: {updated_levels}"
            }
            
        except Exception as e:
            logger.error(f"Error updating XP requirements: {str(e)}")
            db.session.rollback()
            return {"error": "Failed to update XP requirements"}
    
    @staticmethod
    def get_season_analytics(season_id):
        """Get analytics for a specific season"""
        try:
            season = Season.query.get(season_id)
            if not season:
                return {"error": "Season not found"}
            
            # Count passes purchased
            total_passes = UserSeasonPass.query.filter_by(season_id=season_id).count()
            lunar_passes = UserSeasonPass.query.filter_by(
                season_id=season_id, 
                tier_type=PassTierType.LUNAR.value
            ).count()
            totality_passes = UserSeasonPass.query.filter_by(
                season_id=season_id, 
                tier_type=PassTierType.TOTALITY.value
            ).count()
            
            # Get revenue
            pass_purchases = UserSeasonPass.query.filter_by(season_id=season_id).all()
            total_revenue = sum(p.purchase_price for p in pass_purchases)
            
            # Get average progress
            avg_progress = db.session.query(
                func.avg(UserSeasonProgress.current_level),
                func.avg(UserSeasonProgress.current_xp_in_season)
            ).filter_by(season_id=season_id).first()
            
            # Get level distribution
            level_distribution = db.session.query(
                UserSeasonProgress.current_level,
                func.count(UserSeasonProgress.id)
            ).filter_by(season_id=season_id).group_by(UserSeasonProgress.current_level).all()
            
            return {
                "season": season.to_dict(),
                "pass_purchases": {
                    "total": total_passes,
                    "lunar": lunar_passes,
                    "totality": totality_passes,
                    "conversion_rate": (total_passes / max(1, UserSeasonProgress.query.filter_by(season_id=season_id).count())) * 100
                },
                "revenue": {
                    "total_cents": total_revenue,
                    "total_dollars": total_revenue / 100,
                    "average_per_user": total_revenue / max(1, total_passes)
                },
                "progression": {
                    "average_level": float(avg_progress[0] or 0),
                    "average_xp": float(avg_progress[1] or 0),
                    "level_distribution": {str(level): count for level, count in level_distribution}
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting season analytics: {str(e)}")
            return {"error": "Failed to get season analytics"}
    
    @staticmethod
    def _analyze_season_subscriptions(season, all_seasons):
        """Analyze subscription patterns for a specific season"""
        try:
            from datetime import timedelta
            
            # Basic season metrics
            season_passes = UserSeasonPass.query.filter_by(season_id=season.id).all()
            total_subscribers = len(season_passes)
            lunar_subscribers = len([p for p in season_passes if p.tier_type == PassTierType.LUNAR.value])
            totality_subscribers = len([p for p in season_passes if p.tier_type == PassTierType.TOTALITY.value])
            
            # Revenue metrics
            total_revenue = sum(p.purchase_price for p in season_passes)
            avg_revenue_per_user = total_revenue / max(1, total_subscribers)
            
            # Find previous season for comparison
            previous_season = None
            for i, s in enumerate(all_seasons):
                if s.id == season.id and i < len(all_seasons) - 1:
                    previous_season = all_seasons[i + 1]
                    break
            
            # Calculate retention and churn for this season
            returning_subscribers = 0
            new_subscribers = 0
            churned_from_previous = 0
            
            if previous_season:
                previous_subscribers = set(
                    p.user_id for p in UserSeasonPass.query.filter_by(season_id=previous_season.id).all()
                )
                current_subscribers = set(p.user_id for p in season_passes)
                
                returning_subscribers = len(current_subscribers.intersection(previous_subscribers))
                new_subscribers = len(current_subscribers - previous_subscribers)
                churned_from_previous = len(previous_subscribers - current_subscribers)
            else:
                new_subscribers = total_subscribers
            
            # Calculate engagement metrics
            active_users = UserSeasonProgress.query.filter_by(season_id=season.id).count()
            avg_level = db.session.query(func.avg(UserSeasonProgress.current_level)).filter_by(season_id=season.id).scalar() or 0
            avg_xp = db.session.query(func.avg(UserSeasonProgress.current_xp_in_season)).filter_by(season_id=season.id).scalar() or 0
            
            return {
                "season": {
                    "id": season.id,
                    "name": season.name,
                    "start_date": season.start_date.isoformat() if season.start_date else None,
                    "end_date": season.end_date.isoformat() if season.end_date else None,
                    "is_active": season.is_active
                },
                "subscription_metrics": {
                    "total_subscribers": total_subscribers,
                    "lunar_subscribers": lunar_subscribers,
                    "totality_subscribers": totality_subscribers,
                    "tier_distribution": {
                        "lunar_percentage": (lunar_subscribers / max(1, total_subscribers)) * 100,
                        "totality_percentage": (totality_subscribers / max(1, total_subscribers)) * 100
                    }
                },
                "revenue_metrics": {
                    "total_revenue_cents": total_revenue,
                    "total_revenue_dollars": total_revenue / 100,
                    "avg_revenue_per_user": avg_revenue_per_user / 100,
                    "lunar_revenue": sum(p.purchase_price for p in season_passes if p.tier_type == PassTierType.LUNAR.value) / 100,
                    "totality_revenue": sum(p.purchase_price for p in season_passes if p.tier_type == PassTierType.TOTALITY.value) / 100
                },
                "user_behavior": {
                    "returning_subscribers": returning_subscribers,
                    "new_subscribers": new_subscribers,
                    "churned_from_previous": churned_from_previous,
                    "retention_rate": (returning_subscribers / max(1, returning_subscribers + churned_from_previous)) * 100 if previous_season else 0,
                    "churn_rate": (churned_from_previous / max(1, returning_subscribers + churned_from_previous)) * 100 if previous_season else 0
                },
                "engagement_metrics": {
                    "active_users": active_users,
                    "conversion_rate": (total_subscribers / max(1, active_users)) * 100,
                    "avg_level_reached": float(avg_level),
                    "avg_xp_earned": float(avg_xp)
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing season subscriptions: {str(e)}")
            return {"error": "Failed to analyze season subscriptions"}
    
    @staticmethod
    def _calculate_retention_metrics(all_seasons):
        """Calculate overall retention metrics across seasons"""
        try:
            if len(all_seasons) < 2:
                return {"error": "Need at least 2 seasons for retention analysis"}
            
            # Sort seasons by start date
            sorted_seasons = sorted(all_seasons, key=lambda x: x.start_date or datetime.min)
            
            retention_data = {
                "season_to_season_retention": [],
                "overall_retention_rate": 0,
                "loyal_subscribers": 0,  # Users who subscribed to 3+ seasons
            }
            
            # Calculate season-to-season retention
            for i in range(len(sorted_seasons) - 1):
                current_season = sorted_seasons[i]
                next_season = sorted_seasons[i + 1]
                
                current_subscribers = set(
                    p.user_id for p in UserSeasonPass.query.filter_by(season_id=current_season.id).all()
                )
                next_subscribers = set(
                    p.user_id for p in UserSeasonPass.query.filter_by(season_id=next_season.id).all()
                )
                
                retained_users = current_subscribers.intersection(next_subscribers)
                retention_rate = (len(retained_users) / max(1, len(current_subscribers))) * 100
                
                retention_data["season_to_season_retention"].append({
                    "from_season": {"id": current_season.id, "name": current_season.name},
                    "to_season": {"id": next_season.id, "name": next_season.name},
                    "subscribers_retained": len(retained_users),
                    "total_previous_subscribers": len(current_subscribers),
                    "retention_rate": retention_rate
                })
            
            # Calculate overall retention rate
            if retention_data["season_to_season_retention"]:
                retention_data["overall_retention_rate"] = sum(
                    r["retention_rate"] for r in retention_data["season_to_season_retention"]
                ) / len(retention_data["season_to_season_retention"])
            
            # Find loyal subscribers (3+ seasons)
            user_season_counts = db.session.query(
                UserSeasonPass.user_id,
                func.count(UserSeasonPass.season_id).label('season_count')
            ).group_by(UserSeasonPass.user_id).all()
            
            retention_data["loyal_subscribers"] = len([
                u for u in user_season_counts if u.season_count >= 3
            ])
            
            return retention_data
            
        except Exception as e:
            logger.error(f"Error calculating retention metrics: {str(e)}")
            return {"error": "Failed to calculate retention metrics"}
    
    @staticmethod
    def _calculate_churn_metrics(all_seasons):
        """Calculate churn analysis across seasons"""
        try:
            if len(all_seasons) < 2:
                return {"error": "Need at least 2 seasons for churn analysis"}
            
            sorted_seasons = sorted(all_seasons, key=lambda x: x.start_date or datetime.min)
            
            churn_data = {
                "season_to_season_churn": [],
                "overall_churn_rate": 0,
                "churn_analysis": {
                    "never_returned": 0,  # Users who only bought 1 season pass ever
                    "tier_downgrades": 0,  # Users who went from Totality to Lunar
                    "tier_upgrades": 0     # Users who went from Lunar to Totality
                }
            }
            
            # Calculate season-to-season churn
            for i in range(len(sorted_seasons) - 1):
                current_season = sorted_seasons[i]
                next_season = sorted_seasons[i + 1]
                
                current_subscribers = UserSeasonPass.query.filter_by(season_id=current_season.id).all()
                next_subscribers = set(
                    p.user_id for p in UserSeasonPass.query.filter_by(season_id=next_season.id).all()
                )
                
                churned_users = []
                tier_changes = {"upgrades": 0, "downgrades": 0}
                
                for pass_obj in current_subscribers:
                    if pass_obj.user_id not in next_subscribers:
                        churned_users.append(pass_obj.user_id)
                    else:
                        # Check for tier changes
                        next_pass = UserSeasonPass.query.filter_by(
                            user_id=pass_obj.user_id,
                            season_id=next_season.id
                        ).first()
                        
                        if next_pass:
                            if (pass_obj.tier_type == PassTierType.LUNAR.value and 
                                next_pass.tier_type == PassTierType.TOTALITY.value):
                                tier_changes["upgrades"] += 1
                            elif (pass_obj.tier_type == PassTierType.TOTALITY.value and 
                                  next_pass.tier_type == PassTierType.LUNAR.value):
                                tier_changes["downgrades"] += 1
                
                churn_rate = (len(churned_users) / max(1, len(current_subscribers))) * 100
                
                churn_data["season_to_season_churn"].append({
                    "from_season": {"id": current_season.id, "name": current_season.name},
                    "to_season": {"id": next_season.id, "name": next_season.name},
                    "churned_users": len(churned_users),
                    "total_previous_subscribers": len(current_subscribers),
                    "churn_rate": churn_rate,
                    "tier_changes": tier_changes
                })
                
                # Add to overall tier change counters
                churn_data["churn_analysis"]["tier_upgrades"] += tier_changes["upgrades"]
                churn_data["churn_analysis"]["tier_downgrades"] += tier_changes["downgrades"]
            
            # Calculate overall churn rate
            if churn_data["season_to_season_churn"]:
                churn_data["overall_churn_rate"] = sum(
                    c["churn_rate"] for c in churn_data["season_to_season_churn"]
                ) / len(churn_data["season_to_season_churn"])
            
            # Analyze single-season users
            all_subscribers = db.session.query(UserSeasonPass.user_id).distinct().all()
            single_season_users = 0
            
            for user_tuple in all_subscribers:
                user_id = user_tuple[0]
                user_seasons = UserSeasonPass.query.filter_by(user_id=user_id).count()
                if user_seasons == 1:
                    single_season_users += 1
            
            churn_data["churn_analysis"]["never_returned"] = single_season_users
            
            return churn_data
            
        except Exception as e:
            logger.error(f"Error calculating churn metrics: {str(e)}")
            return {"error": "Failed to calculate churn metrics"}
    
    @staticmethod
    def _calculate_growth_metrics(all_seasons):
        """Calculate growth metrics across seasons"""
        try:
            sorted_seasons = sorted(all_seasons, key=lambda x: x.start_date or datetime.min)
            
            growth_data = {
                "subscriber_growth": [],
                "revenue_growth": [],
                "growth_trends": {
                    "avg_subscriber_growth_rate": 0,
                    "avg_revenue_growth_rate": 0,
                    "fastest_growing_season": None,
                    "highest_revenue_season": None
                }
            }
            
            previous_subscribers = 0
            previous_revenue = 0
            max_growth_rate = 0
            max_revenue = 0
            fastest_season = None
            highest_revenue_season = None
            
            for i, season in enumerate(sorted_seasons):
                season_passes = UserSeasonPass.query.filter_by(season_id=season.id).all()
                current_subscribers = len(season_passes)
                current_revenue = sum(p.purchase_price for p in season_passes) / 100  # Convert to dollars
                
                if i > 0:  # Skip first season for growth calculation
                    subscriber_growth_rate = ((current_subscribers - previous_subscribers) / max(1, previous_subscribers)) * 100
                    revenue_growth_rate = ((current_revenue - previous_revenue) / max(1, previous_revenue)) * 100
                    
                    growth_data["subscriber_growth"].append({
                        "season": {"id": season.id, "name": season.name},
                        "subscribers": current_subscribers,
                        "previous_subscribers": previous_subscribers,
                        "growth_rate": subscriber_growth_rate,
                        "net_growth": current_subscribers - previous_subscribers
                    })
                    
                    growth_data["revenue_growth"].append({
                        "season": {"id": season.id, "name": season.name},
                        "revenue": current_revenue,
                        "previous_revenue": previous_revenue,
                        "growth_rate": revenue_growth_rate,
                        "net_growth": current_revenue - previous_revenue
                    })
                    
                    # Track fastest growing season
                    if subscriber_growth_rate > max_growth_rate:
                        max_growth_rate = subscriber_growth_rate
                        fastest_season = season
                
                # Track highest revenue season
                if current_revenue > max_revenue:
                    max_revenue = current_revenue
                    highest_revenue_season = season
                
                previous_subscribers = current_subscribers
                previous_revenue = current_revenue
            
            # Calculate average growth rates
            if len(growth_data["subscriber_growth"]) > 0:
                growth_data["growth_trends"]["avg_subscriber_growth_rate"] = sum(
                    g["growth_rate"] for g in growth_data["subscriber_growth"]
                ) / len(growth_data["subscriber_growth"])
                
                growth_data["growth_trends"]["avg_revenue_growth_rate"] = sum(
                    g["growth_rate"] for g in growth_data["revenue_growth"]
                ) / len(growth_data["revenue_growth"])
            
            if fastest_season:
                growth_data["growth_trends"]["fastest_growing_season"] = {
                    "id": fastest_season.id,
                    "name": fastest_season.name,
                    "growth_rate": max_growth_rate
                }
            
            if highest_revenue_season:
                growth_data["growth_trends"]["highest_revenue_season"] = {
                    "id": highest_revenue_season.id,
                    "name": highest_revenue_season.name,
                    "revenue": max_revenue
                }
            
            return growth_data
            
        except Exception as e:
            logger.error(f"Error calculating growth metrics: {str(e)}")
            return {"error": "Failed to calculate growth metrics"}
    
    @staticmethod
    def get_subscription_analytics(season_id=None):
        """
        Get comprehensive subscription analytics including retention, churn, and new subscriptions
        If season_id is None, returns analytics for all seasons
        """
        try:
            # Get all seasons for comparison
            all_seasons = Season.query.order_by(Season.start_date.desc()).all()
            
            if season_id:
                target_seasons = [Season.query.get(season_id)]
                if not target_seasons[0]:
                    return {"error": "Season not found"}
            else:
                target_seasons = all_seasons[:5]  # Last 5 seasons for overview
            
            analytics_data = {
                "overview": {},
                "season_comparisons": [],
                "retention_analysis": {},
                "churn_analysis": {},
                "growth_metrics": {}
            }
            
            # Calculate overall metrics
            total_unique_subscribers = db.session.query(UserSeasonPass.user_id).distinct().count()
            current_active_season = Season.query.filter_by(is_active=True).first()
            current_subscribers = 0
            if current_active_season:
                current_subscribers = UserSeasonPass.query.filter_by(season_id=current_active_season.id).count()
            
            analytics_data["overview"] = {
                "total_unique_subscribers": total_unique_subscribers,
                "current_active_subscribers": current_subscribers,
                "total_seasons": len(all_seasons),
                "active_season_id": current_active_season.id if current_active_season else None
            }
            
            # Analyze each season
            for season in target_seasons:
                season_data = SeasonPassAdminController._analyze_season_subscriptions(season, all_seasons)
                analytics_data["season_comparisons"].append(season_data)
            
            # Calculate retention analysis (users who subscribed to multiple seasons)
            if len(all_seasons) >= 2:
                analytics_data["retention_analysis"] = SeasonPassAdminController._calculate_retention_metrics(all_seasons)
            
            # Calculate churn analysis
            analytics_data["churn_analysis"] = SeasonPassAdminController._calculate_churn_metrics(all_seasons)
            
            # Calculate growth metrics
            analytics_data["growth_metrics"] = SeasonPassAdminController._calculate_growth_metrics(all_seasons)
            
            return analytics_data
            
        except Exception as e:
            logger.error(f"Error getting subscription analytics: {str(e)}")
            return {"error": "Failed to get subscription analytics"}




