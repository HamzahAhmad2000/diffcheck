# models/daily_reward_models.py
"""
Daily Reward System Models
Manages daily login calendar, weekly configurations, streaks, and user claims
"""

from app.extensions import db
from datetime import datetime, date, timedelta
from enum import Enum

class RewardType(Enum):
    """Types of rewards that can be awarded daily"""
    XP = "XP"
    RAFFLE_ENTRY = "RAFFLE_ENTRY"

class DailyRewardWeekConfiguration(db.Model):
    """
    Super admin configurable weekly reward layouts.
    Two configurations exist: active and next week for seamless transitions.
    """
    __tablename__ = 'daily_reward_week_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    week_identifier = db.Column(db.String(50), unique=True, nullable=False)  # e.g., "2024-W03", "template-A"
    is_active = db.Column(db.Boolean, default=False, nullable=False, index=True)
    
    # Week completion bonus reward
    bonus_reward_type = db.Column(db.Enum(RewardType), nullable=True)
    bonus_xp_amount = db.Column(db.Integer, nullable=True)
    bonus_raffle_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=True)
    
    # System settings
    recovery_xp_cost = db.Column(db.Integer, nullable=False, default=10)  # XP cost to recover missed days
    weekly_freeze_count = db.Column(db.Integer, nullable=False, default=2)  # Freeze streaks per week
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    daily_rewards = db.relationship('DailyReward', backref='week_config', cascade='all, delete-orphan')
    bonus_raffle_item = db.relationship('MarketplaceItem', foreign_keys=[bonus_raffle_item_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'week_identifier': self.week_identifier,
            'is_active': self.is_active,
            'bonus_reward': {
                'type': self.bonus_reward_type.value if self.bonus_reward_type else None,
                'xp_amount': self.bonus_xp_amount,
                'raffle_item_id': self.bonus_raffle_item_id,
                'raffle_item_title': self.bonus_raffle_item.title if self.bonus_raffle_item else None
            },
            'recovery_xp_cost': self.recovery_xp_cost,
            'weekly_freeze_count': self.weekly_freeze_count,
            'daily_rewards_count': len(self.daily_rewards),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DailyReward(db.Model):
    """
    Individual day rewards within a weekly configuration.
    Day 1-7 represents Monday through Sunday.
    """
    __tablename__ = 'daily_rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    week_config_id = db.Column(db.Integer, db.ForeignKey('daily_reward_week_configs.id', ondelete='CASCADE'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 1=Monday, 2=Tuesday, ..., 7=Sunday
    
    # Reward configuration
    reward_type = db.Column(db.Enum(RewardType), nullable=False)
    xp_amount = db.Column(db.Integer, nullable=True)  # For XP rewards
    raffle_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=True)  # For raffle entry rewards
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Constraints: one reward per day per week config
    __table_args__ = (
        db.UniqueConstraint('week_config_id', 'day_of_week', name='uq_week_day_reward'),
        db.CheckConstraint('day_of_week >= 1 AND day_of_week <= 7', name='check_valid_day_of_week'),
        db.CheckConstraint(
            "(reward_type = 'XP' AND xp_amount IS NOT NULL AND raffle_item_id IS NULL) OR "
            "(reward_type = 'RAFFLE_ENTRY' AND xp_amount IS NULL AND raffle_item_id IS NOT NULL)",
            name='check_reward_type_consistency'
        )
    )
    
    # Relationships
    raffle_item = db.relationship('MarketplaceItem', foreign_keys=[raffle_item_id])
    claims = db.relationship('UserDailyRewardClaim', backref='daily_reward', cascade='all, delete-orphan')
    
    def to_dict(self, reveal_reward=False):
        """
        Convert to dictionary. Only reveal reward details if explicitly requested.
        
        Args:
            reveal_reward: If True, includes reward details. If False, shows hidden reward.
        """
        if reveal_reward:
            reward_data = {
                'type': self.reward_type.value,
                'xp_amount': self.xp_amount,
                'raffle_item_id': self.raffle_item_id,
                'raffle_item_title': self.raffle_item.title if self.raffle_item else None,
                'raffle_item_image': self.raffle_item.image_url if self.raffle_item else None
            }
        else:
            reward_data = None  # Hidden until claimed
            
        return {
            'id': self.id,
            'week_config_id': self.week_config_id,
            'day_of_week': self.day_of_week,
            'reward': reward_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class UserStreak(db.Model):
    """
    Tracks user login streaks and freeze usage.
    One record per user, updated as streak progresses.
    """
    __tablename__ = 'user_streaks'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    current_streak = db.Column(db.Integer, default=0, nullable=False)
    last_claim_date = db.Column(db.Date, nullable=True)
    
    # Weekly streak protections
    weekly_freezes_left = db.Column(db.Integer, default=2, nullable=False)
    week_start_date = db.Column(db.Date, nullable=True)  # Track when current week started for freeze reset
    
    # Streak statistics
    longest_streak = db.Column(db.Integer, default=0, nullable=False)
    total_claims = db.Column(db.Integer, default=0, nullable=False)
    total_recoveries = db.Column(db.Integer, default=0, nullable=False)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('streak_info', uselist=False))
    
    def reset_weekly_freezes_if_needed(self):
        """Reset weekly freezes if a new week has started (Monday)"""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())  # Monday of current week
        
        if not self.week_start_date or self.week_start_date < start_of_week:
            self.weekly_freezes_left = 2  # Reset to default
            self.week_start_date = start_of_week
            
    def should_reset_streak(self, today):
        """
        Determine if streak should be reset based on missed days and available freezes.
        
        Args:
            today: Current date
            
        Returns:
            bool: True if streak should be reset
        """
        if not self.last_claim_date:
            return False  # No previous claim, don't reset
            
        days_missed = (today - self.last_claim_date).days - 1
        
        if days_missed <= 0:
            return False  # No missed days or claimed today
            
        # Reset weekly freezes if needed
        self.reset_weekly_freezes_if_needed()
        
        # If more than 2 days missed in a week, always reset
        if days_missed > 2:
            return True
            
        # Use freezes for missed days if available
        if days_missed <= self.weekly_freezes_left:
            self.weekly_freezes_left -= days_missed
            return False
            
        # Not enough freezes, reset streak
        return True
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'current_streak': self.current_streak,
            'last_claim_date': self.last_claim_date.isoformat() if self.last_claim_date else None,
            'weekly_freezes_left': self.weekly_freezes_left,
            'longest_streak': self.longest_streak,
            'total_claims': self.total_claims,
            'total_recoveries': self.total_recoveries,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UserDailyRewardClaim(db.Model):
    """
    Records when users claim daily rewards.
    One record per user per day claimed.
    """
    __tablename__ = 'user_daily_reward_claims'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    daily_reward_id = db.Column(db.Integer, db.ForeignKey('daily_rewards.id'), nullable=True)  # Allow null for default config
    claim_date = db.Column(db.Date, nullable=False, default=date.today)
    
    # Recovery tracking
    was_recovered = db.Column(db.Boolean, default=False, nullable=False)  # True if claimed using XP recovery
    recovery_xp_cost = db.Column(db.Integer, nullable=True)  # XP spent to recover this day
    
    # Reward tracking
    xp_awarded = db.Column(db.Integer, nullable=True)  # XP awarded for this claim
    raffle_entry_created = db.Column(db.Boolean, default=False, nullable=False)  # True if raffle entry was created
    
    # Metadata
    claimed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Constraints: one claim per user per day
    __table_args__ = (
        db.UniqueConstraint('user_id', 'claim_date', name='uq_user_claim_per_day'),
    )
    
    # Relationships
    user = db.relationship('User', backref='daily_reward_claims')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'daily_reward_id': self.daily_reward_id,
            'claim_date': self.claim_date.isoformat(),
            'was_recovered': self.was_recovered,
            'recovery_xp_cost': self.recovery_xp_cost,
            'xp_awarded': self.xp_awarded,
            'raffle_entry_created': self.raffle_entry_created,
            'claimed_at': self.claimed_at.isoformat() if self.claimed_at else None
        }

class WeekCompletionReward(db.Model):
    """
    Tracks when users complete full weeks and receive bonus rewards.
    """
    __tablename__ = 'week_completion_rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    week_config_id = db.Column(db.Integer, db.ForeignKey('daily_reward_week_configs.id'), nullable=False)
    week_start_date = db.Column(db.Date, nullable=False)  # Monday of the completed week
    
    # Reward tracking
    bonus_xp_awarded = db.Column(db.Integer, nullable=True)
    bonus_raffle_entry_created = db.Column(db.Boolean, default=False, nullable=False)
    
    # Metadata
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Constraints: one completion reward per user per week
    __table_args__ = (
        db.UniqueConstraint('user_id', 'week_start_date', name='uq_user_week_completion'),
    )
    
    # Relationships
    user = db.relationship('User', backref='week_completion_rewards')
    week_config = db.relationship('DailyRewardWeekConfiguration', backref='completion_rewards')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'week_config_id': self.week_config_id,
            'week_start_date': self.week_start_date.isoformat(),
            'bonus_xp_awarded': self.bonus_xp_awarded,
            'bonus_raffle_entry_created': self.bonus_raffle_entry_created,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class DailyRewardClaimAttempt(db.Model):
    """
    SECURITY: Immutable audit log of ALL daily reward claim attempts.
    Records both successful and failed attempts for fraud detection and monitoring.
    """
    __tablename__ = 'daily_reward_claim_attempts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Attempt details
    attempt_timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    claim_date = db.Column(db.Date, nullable=False)  # Date user was trying to claim
    was_successful = db.Column(db.Boolean, nullable=False)
    failure_reason = db.Column(db.String(200), nullable=True)
    
    # Security tracking
    ip_address = db.Column(db.String(45), nullable=True)  # IPv4 or IPv6
    user_agent = db.Column(db.String(500), nullable=True)
    
    # Reward details (if successful)
    reward_type = db.Column(db.String(20), nullable=True)  # 'XP' or 'RAFFLE_ENTRY'
    xp_awarded = db.Column(db.Integer, nullable=True)
    was_recovery = db.Column(db.Boolean, default=False, nullable=False)
    recovery_xp_spent = db.Column(db.Integer, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='daily_reward_claim_attempts')
    
    # Indexes for analytics and monitoring
    __table_args__ = (
        db.Index('idx_user_attempt_timestamp', 'user_id', 'attempt_timestamp'),
        db.Index('idx_failed_attempts', 'was_successful', 'attempt_timestamp'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'attempt_timestamp': self.attempt_timestamp.isoformat() if self.attempt_timestamp else None,
            'claim_date': self.claim_date.isoformat() if self.claim_date else None,
            'was_successful': self.was_successful,
            'failure_reason': self.failure_reason,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'reward_type': self.reward_type,
            'xp_awarded': self.xp_awarded,
            'was_recovery': self.was_recovery,
            'recovery_xp_spent': self.recovery_xp_spent
        }




