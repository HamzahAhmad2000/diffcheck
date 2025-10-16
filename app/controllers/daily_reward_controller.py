"""
Daily Reward Controller
Handles daily login calendar, streak management, and reward claiming logic
"""

from flask import current_app
from app.extensions import db
from app.models import User, MarketplaceItem, RaffleEntry, UserRewardLog, PointsLog, ActivityType
from app.models.daily_reward_models import (
    DailyRewardWeekConfiguration, DailyReward, UserStreak, 
    UserDailyRewardClaim, WeekCompletionReward, RewardType, DailyRewardClaimAttempt
)
from app.controllers.xp_badge_controller import award_xp_no_commit, spend_xp
from datetime import date, timedelta, datetime
import logging

logger = logging.getLogger(__name__)

class DailyRewardController:

    @staticmethod
    def _get_default_week_config():
        """
        Return a default week configuration when no active configuration exists.
        This ensures the system always works even without admin setup.
        """
        return {
            'id': None,  # No database ID for default config
            'week_identifier': 'default-60xp',
            'is_active': True,
            'bonus_reward': {
                'type': None,
                'xp_amount': None,
                'raffle_item_id': None,
                'raffle_item_title': None
            },
            'recovery_xp_cost': 10,
            'weekly_freeze_count': 2,
            'daily_rewards_count': 7,
            'is_default': True,  # Flag to identify this is a default config
            # Default rewards: 60 XP for each day
            'daily_rewards': [
                {'day_of_week': i, 'reward_type': 'XP', 'xp_amount': 60, 'raffle_item_id': None}
                for i in range(1, 8)  # Monday (1) to Sunday (7)
            ]
        }

    @staticmethod
    def _get_server_utc_date():
        """
        Get current date in UTC timezone.
        SECURITY: Always use this instead of date.today() to prevent timezone exploits.
        """
        return datetime.utcnow().date()
    
    @staticmethod
    def _validate_claim_timing(user_id, claim_date):
        """
        Validate 23-hour minimum window between consecutive daily claims.
        SECURITY: Prevents rapid-fire claims by changing system time.
        
        Args:
            user_id: User ID
            claim_date: Date being claimed
            
        Returns:
            tuple: (is_valid, hours_remaining)
        """
        # Get the most recent successful claim
        last_claim = DailyRewardClaimAttempt.query.filter_by(
            user_id=user_id,
            was_successful=True
        ).order_by(DailyRewardClaimAttempt.attempt_timestamp.desc()).first()
        
        if not last_claim:
            return True, 0  # No previous claims, allow
        
        # If claiming a different date, check 23-hour window
        if last_claim.claim_date != claim_date:
            hours_since_last = (datetime.utcnow() - last_claim.attempt_timestamp).total_seconds() / 3600
            
            if hours_since_last < 23:
                hours_remaining = 23 - hours_since_last
                return False, hours_remaining
        
        return True, 0
    
    @staticmethod
    def _log_claim_attempt(user_id, claim_date, was_successful, failure_reason=None, 
                          reward_type=None, xp_awarded=None, was_recovery=False, 
                          recovery_xp_spent=None, ip_address=None, user_agent=None):
        """
        Log a claim attempt to the audit trail.
        SECURITY: This creates an immutable record for fraud detection.
        """
        try:
            attempt = DailyRewardClaimAttempt(
                user_id=user_id,
                claim_date=claim_date,
                was_successful=was_successful,
                failure_reason=failure_reason,
                reward_type=reward_type,
                xp_awarded=xp_awarded,
                was_recovery=was_recovery,
                recovery_xp_spent=recovery_xp_spent,
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.session.add(attempt)
            # Note: Commit happens in parent transaction
        except Exception as e:
            logger.error(f"Failed to log claim attempt: {e}")
            # Don't fail the main operation if audit logging fails
    
    @staticmethod
    def get_user_calendar_state(user):
        """
        Get the complete state needed to render the daily reward calendar for the user.
        
        Args:
            user: User object
            
        Returns:
            dict: Calendar state with streak info and daily slots
        """
        try:
            today = DailyRewardController._get_server_utc_date()
            # Find the start of the week (Monday is day 0)
            start_of_week = today - timedelta(days=today.weekday())

            # Get active week config, or use default if none exists
            active_week = DailyRewardWeekConfiguration.query.filter_by(is_active=True).first()
            if not active_week:
                active_week = DailyRewardController._get_default_week_config()
                logger.info("Using default 60 XP daily reward configuration (no active config found)")

            # Get or create user streak info
            streak_info = user.streak_info
            if not streak_info:
                streak_info = UserStreak(user_id=user.id)
                db.session.add(streak_info)
                db.session.flush()  # Get the ID without committing
            
            # Update streak based on missed days
            DailyRewardController._update_user_streak(streak_info, today)
            
            # Get claims for this week
            claims = UserDailyRewardClaim.query.filter(
                UserDailyRewardClaim.user_id == user.id,
                UserDailyRewardClaim.claim_date >= start_of_week,
                UserDailyRewardClaim.claim_date < start_of_week + timedelta(days=7)
            ).all()
            claimed_dates = {c.claim_date for c in claims}
            
            # Build calendar slots for the week
            calendar_slots = []
            for i in range(7):  # Monday (0) to Sunday (6)
                day_date = start_of_week + timedelta(days=i)
                day_of_week = i + 1  # Convert to 1-7 for database
                
                # Get the reward configuration for this day
                reward_config = None
                if not active_week.get('is_default'):
                    reward_config = DailyReward.query.filter_by(
                        week_config_id=active_week.id,
                        day_of_week=day_of_week
                    ).first()

                # Determine slot status
                status = DailyRewardController._determine_slot_status(day_date, today, claimed_dates)

                # Handle reward data (use default or database config)
                if active_week.get('is_default'):
                    # For default config, always show 60 XP reward details
                    reveal_reward = (status == "CLAIMED")
                    reward_data = {
                        'reward': {
                            'type': 'XP',
                            'xp_amount': 60
                        } if reveal_reward else None
                    }
                else:
                    # Only reveal reward details if claimed
                    reveal_reward = (status == "CLAIMED")
                    reward_data = reward_config.to_dict(reveal_reward=reveal_reward) if reward_config else None
                
                # Determine if this missed day can be recovered
                can_recover = False
                if status == "MISSED" and user.xp_balance >= (active_week['recovery_xp_cost'] if isinstance(active_week, dict) else active_week.recovery_xp_cost):
                    can_recover = DailyRewardController._can_recover_missed_day(
                        user, day_date, streak_info
                    )
                
                calendar_slots.append({
                    "day": day_of_week,
                    "date": day_date.isoformat(),
                    "status": status,
                    "reward": reward_data['reward'] if reward_data else None,
                    "can_recover": can_recover
                })
            
            # Check if week is complete
            all_days_claimed = len(claimed_dates) >= 7
            week_completion_reward = None
            if all_days_claimed:
                completion = WeekCompletionReward.query.filter_by(
                    user_id=user.id,
                    week_start_date=start_of_week
                ).first()
                if completion:
                    week_completion_reward = {
                        "xp_awarded": completion.bonus_xp_awarded,
                        "raffle_entry_created": completion.bonus_raffle_entry_created,
                        "completed_at": completion.completed_at.isoformat()
                    }
            
            db.session.commit()  # Commit any streak updates
            
            return {
                "streak_info": {
                    "current_streak": streak_info.current_streak,
                    "freezes_left": streak_info.weekly_freezes_left,
                    "longest_streak": streak_info.longest_streak,
                    "total_claims": streak_info.total_claims
                },
                "calendar_slots": calendar_slots,
                "week_info": {
                    "start_date": start_of_week.isoformat(),
                    "all_days_claimed": all_days_claimed,
                    "completion_reward": week_completion_reward,
                    "recovery_xp_cost": active_week['recovery_xp_cost'] if isinstance(active_week, dict) else active_week.recovery_xp_cost
                },
                "user_xp_balance": user.xp_balance
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error getting calendar state for user {user.id}: {e}")
            return {"error": f"Failed to get calendar state: {str(e)}"}
    
    @staticmethod
    def claim_daily_reward(user, target_date=None):
        """
        Claim the daily reward for today or a specified date.
        
        Args:
            user: User object
            target_date: Optional date to claim (for recovery). Defaults to today.
            
        Returns:
            dict: Result of claim operation with revealed reward
        """
        try:
            today_utc = DailyRewardController._get_server_utc_date()
            claim_date = target_date if target_date else today_utc
            
            # SECURITY: Lock user's streak record to prevent race conditions
            # This creates a SELECT FOR UPDATE query in PostgreSQL/MySQL
            streak_info = UserStreak.query.filter_by(
                user_id=user.id
            ).with_for_update().first()
            
            if not streak_info:
                # Create new streak record if doesn't exist
                streak_info = UserStreak(user_id=user.id)
                db.session.add(streak_info)
                db.session.flush()
            
            # SECURITY: Validate 23-hour minimum claim window (prevents rapid-fire claims)
            is_valid_timing, hours_remaining = DailyRewardController._validate_claim_timing(
                user.id, claim_date
            )
            
            if not is_valid_timing:
                # Log failed attempt
                DailyRewardController._log_claim_attempt(
                    user.id, claim_date, False, 
                    failure_reason=f"23-hour cooldown not met ({hours_remaining:.1f}h remaining)"
                )
                db.session.commit()
                return {"error": f"Please wait {hours_remaining:.1f} hours before claiming the next reward."}
            
            # Check if already claimed for this date (double-check with lock held)
            existing_claim = UserDailyRewardClaim.query.filter_by(
                user_id=user.id,
                claim_date=claim_date
            ).first()
            
            if existing_claim:
                # Log failed attempt
                DailyRewardController._log_claim_attempt(
                    user.id, claim_date, False, 
                    failure_reason="Already claimed for this date"
                )
                db.session.commit()  # Commit audit log
                return {"error": "Reward already claimed for this date."}
            
            # Get active week config, or use default if none exists
            active_week = DailyRewardWeekConfiguration.query.filter_by(is_active=True).first()
            if not active_week:
                active_week = DailyRewardController._get_default_week_config()
                logger.info("Using default 60 XP daily reward configuration for claim (no active config found)")

            # Calculate day of week (1=Monday, 7=Sunday)
            day_of_week = claim_date.weekday() + 1

            # Get reward configuration for this day
            reward_config = None
            if not active_week.get('is_default'):
                reward_config = DailyReward.query.filter_by(
                    week_config_id=active_week.id,
                    day_of_week=day_of_week
                ).first()
                if not reward_config:
                    return {"error": "No reward configured for this day."}
            else:
                # For default config, create a mock reward config object
                reward_config = type('MockRewardConfig', (), {
                    'reward_type': RewardType.XP,
                    'xp_amount': 60,
                    'raffle_item_id': None,
                    'raffle_item': None,
                    'id': f"default-{day_of_week}"  # Mock ID for logging
                })()
            
            # Check if this is a recovery (past date)
            is_recovery = claim_date < today_utc
            recovery_cost = 0
            
            if is_recovery:
                recovery_cost = active_week['recovery_xp_cost'] if isinstance(active_week, dict) else active_week.recovery_xp_cost
                if user.xp_balance < recovery_cost:
                    # Log failed attempt
                    DailyRewardController._log_claim_attempt(
                        user.id, claim_date, False, 
                        failure_reason="Insufficient XP for recovery"
                    )
                    db.session.commit()
                    return {"error": f"Insufficient XP for recovery. Need {recovery_cost} XP."}
                
                # Validate that this day can be recovered (use already-locked streak_info)
                if not DailyRewardController._can_recover_missed_day(user, claim_date, streak_info):
                    # Log failed attempt
                    DailyRewardController._log_claim_attempt(
                        user.id, claim_date, False, 
                        failure_reason="Cannot recover - outside streak period"
                    )
                    db.session.commit()
                    return {"error": "This day cannot be recovered. You can only recover missed days within your current streak period."}
                
                # Deduct recovery cost
                if not spend_xp(user.id, recovery_cost, "Daily reward recovery"):
                    # Log failed attempt
                    DailyRewardController._log_claim_attempt(
                        user.id, claim_date, False, 
                        failure_reason="Failed to deduct recovery XP"
                    )
                    db.session.commit()
                    return {"error": "Failed to deduct recovery XP."}
            
            # Process the reward
            result = DailyRewardController._process_reward_claim(
                user, reward_config, claim_date, is_recovery, recovery_cost, active_week
            )
            
            if "error" in result:
                # If there was an error and we deducted XP, we should refund it
                # Note: The spend_xp function already committed, so we'd need to add XP back
                if is_recovery:
                    award_xp_no_commit(user.id, recovery_cost, "Daily reward recovery refund")
                    db.session.commit()
                return result
            
            # Update streak and statistics (use already-locked streak_info from above)
            DailyRewardController._update_streak_on_claim(streak_info, claim_date, is_recovery)
            
            # Check for week completion bonus (skip for default config since it has no bonus)
            week_completion_result = None
            if not active_week.get('is_default'):
                week_completion_result = DailyRewardController._check_week_completion_bonus(
                    user, claim_date, active_week
                )
            
            # Log successful claim attempt
            DailyRewardController._log_claim_attempt(
                user.id, 
                claim_date, 
                True,
                reward_type=result["reward_data"]["type"],
                xp_awarded=result["reward_data"].get("xp_amount"),
                was_recovery=is_recovery,
                recovery_xp_spent=recovery_cost if is_recovery else None
            )
            
            db.session.commit()
            
            # Prepare response
            response = {
                "success": True,
                "revealed_reward": result["reward_data"],
                "new_streak": streak_info.current_streak,
                "was_recovery": is_recovery,
                "recovery_xp_cost": recovery_cost if is_recovery else 0,
                "new_xp_balance": user.xp_balance
            }
            
            if week_completion_result:
                response["week_completion_bonus"] = week_completion_result
            
            return response
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error claiming daily reward for user {user.id}: {e}")
            return {"error": f"Failed to claim reward: {str(e)}"}
    
    @staticmethod
    def _determine_slot_status(day_date, today, claimed_dates):
        """Determine the status of a calendar slot"""
        if day_date in claimed_dates:
            return "CLAIMED"
        elif day_date < today:
            return "MISSED"
        elif day_date == today:
            return "CLAIMABLE"
        else:
            return "FUTURE"
    
    @staticmethod
    def _can_recover_missed_day(user, missed_date, streak_info):
        """
        Determine if a missed day can be recovered based on streak freeze logic.
        
        A day can only be recovered if:
        1. The user has an active streak (current_streak > 0)
        2. The missed day is within the current streak period
        3. The missed day is after the streak started
        
        Args:
            user: User object
            missed_date: Date that was missed
            streak_info: UserStreak object
            
        Returns:
            bool: True if the day can be recovered
        """
        if not streak_info or streak_info.current_streak == 0:
            # No active streak, cannot recover any days
            return False
        
        if not streak_info.last_claim_date:
            # No previous claims, cannot recover
            return False
        
        # Calculate when the current streak started
        streak_start_date = streak_info.last_claim_date - timedelta(days=streak_info.current_streak - 1)
        
        # Can only recover days that are:
        # 1. After or on the streak start date
        # 2. Before the last claim date (to maintain streak continuity)
        return streak_start_date <= missed_date < streak_info.last_claim_date
    
    @staticmethod
    def _update_user_streak(streak_info, today):
        """Update user streak based on missed days and available freezes"""
        if streak_info.should_reset_streak(today):
            streak_info.current_streak = 0
            logger.info(f"Reset streak for user {streak_info.user_id} due to missed days")
    
    @staticmethod
    def _process_reward_claim(user, reward_config, claim_date, is_recovery, recovery_cost, active_week):
        """Process the actual reward claiming"""
        try:
            xp_awarded = 0
            raffle_entry_created = False
            
            # Award the reward based on type
            if reward_config.reward_type == RewardType.XP:
                xp_result = award_xp_no_commit(
                    user.id, 
                    reward_config.xp_amount,
                    "DAILY_REWARD_CLAIMED",
                    related_item_id=reward_config.id
                )
                if "error" in xp_result:
                    return {"error": f"Failed to award XP: {xp_result['error']}"}
                xp_awarded = reward_config.xp_amount
                
            elif reward_config.reward_type == RewardType.RAFFLE_ENTRY:
                # Create raffle entry
                raffle_entry = RaffleEntry(
                    user_id=user.id,
                    marketplace_item_id=reward_config.raffle_item_id
                )
                db.session.add(raffle_entry)
                raffle_entry_created = True
            
            # Create claim record (skip daily_reward_id for default config)
            claim_data = {
                'user_id': user.id,
                'claim_date': claim_date,
                'was_recovered': is_recovery,
                'recovery_xp_cost': recovery_cost if is_recovery else None,
                'xp_awarded': xp_awarded,
                'raffle_entry_created': raffle_entry_created
            }

            # Only add daily_reward_id if not using default config
            if not active_week.get('is_default'):
                claim_data['daily_reward_id'] = reward_config.id

            claim = UserDailyRewardClaim(**claim_data)
            db.session.add(claim)
            
            # Prepare reward data for response
            reward_data = {
                "type": reward_config.reward_type.value,
                "xp_amount": reward_config.xp_amount,
                "raffle_item": None
            }
            
            if reward_config.raffle_item:
                reward_data["raffle_item"] = {
                    "id": reward_config.raffle_item.id,
                    "title": reward_config.raffle_item.title,
                    "image_url": reward_config.raffle_item.image_url
                }
            
            return {"reward_data": reward_data}
            
        except Exception as e:
            logger.error(f"Error processing reward claim: {e}")
            return {"error": f"Failed to process reward: {str(e)}"}
    
    @staticmethod
    def _update_streak_on_claim(streak_info, claim_date, is_recovery):
        """Update streak information when a claim is made"""
        today = DailyRewardController._get_server_utc_date()
        
        # Update total claims
        streak_info.total_claims += 1
        
        if is_recovery:
            streak_info.total_recoveries += 1
            # Don't update streak for recoveries of past days
            return
        
        # Update streak for current day claims
        if not streak_info.last_claim_date:
            # First ever claim
            streak_info.current_streak = 1
        elif (claim_date - streak_info.last_claim_date).days == 1:
            # Consecutive day
            streak_info.current_streak += 1
        else:
            # Gap in claims, start new streak
            streak_info.current_streak = 1
        
        # Update longest streak record
        if streak_info.current_streak > streak_info.longest_streak:
            streak_info.longest_streak = streak_info.current_streak
        
        # Update last claim date
        streak_info.last_claim_date = claim_date
    
    @staticmethod
    def _check_week_completion_bonus(user, claim_date, active_week):
        """Check if user completed the week and award bonus"""
        try:
            # Calculate start of week for the claim date
            start_of_week = claim_date - timedelta(days=claim_date.weekday())
            
            # Check if all 7 days of this week are claimed
            claims_this_week = UserDailyRewardClaim.query.filter(
                UserDailyRewardClaim.user_id == user.id,
                UserDailyRewardClaim.claim_date >= start_of_week,
                UserDailyRewardClaim.claim_date < start_of_week + timedelta(days=7)
            ).count()
            
            if claims_this_week >= 7:
                # Check if bonus already awarded
                existing_bonus = WeekCompletionReward.query.filter_by(
                    user_id=user.id,
                    week_start_date=start_of_week
                ).first()
                
                if not existing_bonus:
                    # Award week completion bonus
                    bonus_xp = 0
                    bonus_raffle_entry = False
                    
                    if active_week.bonus_reward_type == RewardType.XP and active_week.bonus_xp_amount:
                        award_xp_no_commit(
                            user.id,
                            active_week.bonus_xp_amount,
                            "WEEKLY_COMPLETION_BONUS"
                        )
                        bonus_xp = active_week.bonus_xp_amount
                        
                    elif active_week.bonus_reward_type == RewardType.RAFFLE_ENTRY and active_week.bonus_raffle_item_id:
                        raffle_entry = RaffleEntry(
                            user_id=user.id,
                            marketplace_item_id=active_week.bonus_raffle_item_id
                        )
                        db.session.add(raffle_entry)
                        bonus_raffle_entry = True
                    
                    # Record the completion
                    completion_reward = WeekCompletionReward(
                        user_id=user.id,
                        week_config_id=active_week.id,
                        week_start_date=start_of_week,
                        bonus_xp_awarded=bonus_xp,
                        bonus_raffle_entry_created=bonus_raffle_entry
                    )
                    db.session.add(completion_reward)
                    
                    return {
                        "type": active_week.bonus_reward_type.value if active_week.bonus_reward_type else None,
                        "xp_amount": bonus_xp,
                        "raffle_item": {
                            "id": active_week.bonus_raffle_item_id,
                            "title": active_week.bonus_raffle_item.title if active_week.bonus_raffle_item else None
                        } if bonus_raffle_entry else None
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking week completion bonus: {e}")
            return None

    # Admin methods for managing configurations
    @staticmethod
    def create_week_configuration(data, admin_id):
        """Create a new week configuration (admin only)"""
        try:
            config = DailyRewardWeekConfiguration(
                week_identifier=data.get('week_identifier'),
                bonus_reward_type=RewardType(data.get('bonus_reward_type')) if data.get('bonus_reward_type') else None,
                bonus_xp_amount=data.get('bonus_xp_amount'),
                bonus_raffle_item_id=data.get('bonus_raffle_item_id'),
                recovery_xp_cost=data.get('recovery_xp_cost', 10),
                weekly_freeze_count=data.get('weekly_freeze_count', 2)
            )
            
            db.session.add(config)
            db.session.flush()  # Get ID
            
            # Create daily rewards if provided
            daily_rewards = data.get('daily_rewards', [])
            for reward_data in daily_rewards:
                daily_reward = DailyReward(
                    week_config_id=config.id,
                    day_of_week=reward_data['day_of_week'],
                    reward_type=RewardType(reward_data['reward_type']),
                    xp_amount=reward_data.get('xp_amount'),
                    raffle_item_id=reward_data.get('raffle_item_id')
                )
                db.session.add(daily_reward)
            
            db.session.commit()
            logger.info(f"Admin {admin_id} created week configuration {config.id}")
            
            return {"success": True, "config": config.to_dict()}
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating week configuration: {e}")
            return {"error": f"Failed to create configuration: {str(e)}"}
    
    @staticmethod
    def activate_week_configuration(config_id, admin_id):
        """Activate a week configuration (admin only)"""
        try:
            # Deactivate current active config
            current_active = DailyRewardWeekConfiguration.query.filter_by(is_active=True).first()
            if current_active:
                current_active.is_active = False
            
            # Activate new config
            new_config = DailyRewardWeekConfiguration.query.get(config_id)
            if not new_config:
                return {"error": "Configuration not found"}
            
            new_config.is_active = True
            db.session.commit()
            
            logger.info(f"Admin {admin_id} activated week configuration {config_id}")
            return {"success": True, "message": "Configuration activated successfully"}
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error activating week configuration: {e}")
            return {"error": f"Failed to activate configuration: {str(e)}"}
    
    @staticmethod
    def get_week_configurations():
        """Get all week configurations (admin only)"""
        try:
            configs = DailyRewardWeekConfiguration.query.order_by(
                DailyRewardWeekConfiguration.is_active.desc(),
                DailyRewardWeekConfiguration.created_at.desc()
            ).all()
            
            return {
                "success": True,
                "configurations": [config.to_dict() for config in configs]
            }
            
        except Exception as e:
            logger.error(f"Error getting week configurations: {e}")
            return {"error": f"Failed to get configurations: {str(e)}"}

    @staticmethod
    def get_user_streak_info(user_id):
        """Get detailed streak information for a user"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}
            
            streak_info = user.streak_info
            if not streak_info:
                return {
                    "current_streak": 0,
                    "freezes_left": 2,
                    "longest_streak": 0,
                    "total_claims": 0,
                    "total_recoveries": 0
                }
            
            return streak_info.to_dict()
            
        except Exception as e:
            logger.error(f"Error getting streak info for user {user_id}: {e}")
            return {"error": f"Failed to get streak info: {str(e)}"}




