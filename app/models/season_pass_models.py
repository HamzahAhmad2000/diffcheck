"""
Season Pass System Models
Handles seasonal progression, rewards, and user pass purchases
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from enum import Enum
import json
from ..extensions import db

class PassTierType(Enum):
    """Season Pass tier types"""
    LUNAR = "LUNAR"
    TOTALITY = "TOTALITY"

class SeasonRewardType(Enum):
    """Types of rewards available in season pass"""
    XP = "XP"
    BADGE = "BADGE"
    RAFFLE_ENTRY = "RAFFLE_ENTRY"
    MARKETPLACE_ITEM = "MARKETPLACE_ITEM"
    CUSTOM = "CUSTOM"

class Season(db.Model):
    """Season Pass seasons with configurable progression"""
    __tablename__ = 'seasons'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Season timing
    start_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_date = db.Column(db.DateTime, nullable=True)  # Can be null for indefinite seasons
    
    # Season status (only one active and one next at a time)
    is_active = db.Column(db.Boolean, default=False, nullable=False, index=True)
    is_next = db.Column(db.Boolean, default=False, nullable=False, index=True)
    
    # Display settings
    banner_image_url = db.Column(db.String(500), nullable=True)
    thumbnail_image_url = db.Column(db.String(500), nullable=True)
    
    # Pass pricing (in cents)
    lunar_pass_price = db.Column(db.Integer, nullable=False, default=1999)  # $19.99
    totality_pass_price = db.Column(db.Integer, nullable=False, default=3499)  # $34.99
    
    # XP multipliers
    lunar_xp_multiplier = db.Column(db.Float, nullable=False, default=1.25)
    totality_xp_multiplier = db.Column(db.Float, nullable=False, default=2.0)
    
    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)
    
    # Relationships
    levels = db.relationship('SeasonLevel', backref='season', lazy='dynamic', cascade='all, delete-orphan', order_by='SeasonLevel.level_number')
    user_passes = db.relationship('UserSeasonPass', backref='season', lazy='dynamic', cascade='all, delete-orphan')
    user_progress = db.relationship('UserSeasonProgress', backref='season', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_countdown_time(self):
        """Get countdown time if within 72 hours of end date"""
        if not self.end_date:
            return None
        
        time_remaining = self.end_date - datetime.utcnow()
        total_hours = time_remaining.total_seconds() / 3600
        
        if total_hours <= 72 and total_hours > 0:
            days = int(total_hours // 24)
            hours = int(total_hours % 24)
            minutes = int((time_remaining.total_seconds() % 3600) // 60)
            return {
                "days": days,
                "hours": hours,
                "minutes": minutes,
                "total_seconds": int(time_remaining.total_seconds())
            }
        return None
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "is_active": self.is_active,
            "is_next": self.is_next,
            "banner_image_url": self.banner_image_url,
            "thumbnail_image_url": self.thumbnail_image_url,
            "lunar_pass_price": self.lunar_pass_price,
            "totality_pass_price": self.totality_pass_price,
            "lunar_xp_multiplier": self.lunar_xp_multiplier,
            "totality_xp_multiplier": self.totality_xp_multiplier,
            "countdown": self.get_countdown_time(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class SeasonLevel(db.Model):
    """Individual levels within a season with XP requirements"""
    __tablename__ = 'season_levels'
    
    id = db.Column(db.Integer, primary_key=True)
    season_id = db.Column(db.Integer, db.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False)
    level_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3, etc.
    
    # XP required to reach this level (not cumulative)
    xp_required_for_level = db.Column(db.Integer, nullable=False, default=250)
    
    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    rewards = db.relationship('SeasonReward', backref='level', lazy='dynamic', cascade='all, delete-orphan')
    
    # Unique constraint
    __table_args__ = (db.UniqueConstraint('season_id', 'level_number', name='unique_season_level'),)
    
    def get_cumulative_xp_required(self):
        """Calculate total XP required to reach this level"""
        levels = SeasonLevel.query.filter(
            SeasonLevel.season_id == self.season_id,
            SeasonLevel.level_number <= self.level_number
        ).order_by(SeasonLevel.level_number).all()
        
        return sum(level.xp_required_for_level for level in levels)
    
    def to_dict(self):
        return {
            "id": self.id,
            "level_number": self.level_number,
            "xp_required_for_level": self.xp_required_for_level,
            "cumulative_xp_required": self.get_cumulative_xp_required(),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class SeasonReward(db.Model):
    """Rewards available at each level for each tier"""
    __tablename__ = 'season_rewards'
    
    id = db.Column(db.Integer, primary_key=True)
    season_level_id = db.Column(db.Integer, db.ForeignKey('season_levels.id', ondelete='CASCADE'), nullable=False)
    tier_type = db.Column(db.String(20), nullable=False)  # LUNAR or TOTALITY
    
    # Reward configuration
    reward_type = db.Column(db.String(50), nullable=False)  # XP, BADGE, RAFFLE_ENTRY, etc.
    
    # Specific reward data (only one should be filled based on reward_type)
    xp_amount = db.Column(db.Integer, nullable=True)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=True)
    marketplace_item_id = db.Column(db.Integer, db.ForeignKey('marketplace_items.id'), nullable=True)
    
    # Custom reward data (for future flexibility)
    custom_data = db.Column(db.JSON, nullable=True)
    
    # Display
    display_name = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    
    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    badge = db.relationship('Badge', backref='season_rewards')
    marketplace_item = db.relationship('MarketplaceItem', backref='season_rewards')
    
    # Unique constraint - one reward per level per tier
    __table_args__ = (db.UniqueConstraint('season_level_id', 'tier_type', name='unique_level_tier_reward'),)
    
    def to_dict(self):
        reward_data = {
            "id": self.id,
            "tier_type": self.tier_type,
            "reward_type": self.reward_type,
            "display_name": self.display_name,
            "description": self.description,
            "image_url": self.image_url,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
        # Add specific reward data
        if self.reward_type == SeasonRewardType.XP.value:
            reward_data["xp_amount"] = self.xp_amount
        elif self.reward_type == SeasonRewardType.BADGE.value and self.badge:
            reward_data["badge"] = self.badge.to_dict()
        elif self.reward_type == SeasonRewardType.RAFFLE_ENTRY.value and self.marketplace_item:
            reward_data["marketplace_item"] = self.marketplace_item.to_dict()
        elif self.reward_type == SeasonRewardType.MARKETPLACE_ITEM.value and self.marketplace_item:
            reward_data["marketplace_item"] = self.marketplace_item.to_dict()
        elif self.custom_data:
            reward_data["custom_data"] = self.custom_data
            
        return reward_data

class UserSeasonPass(db.Model):
    """User's purchased season pass for a specific season"""
    __tablename__ = 'user_season_passes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    season_id = db.Column(db.Integer, db.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False)
    tier_type = db.Column(db.String(20), nullable=False)  # LUNAR or TOTALITY
    
    # Purchase information
    purchase_price = db.Column(db.Integer, nullable=False)  # Price paid in cents
    purchased_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Payment information
    payment_method = db.Column(db.String(50), nullable=True)  # STRIPE, CRYPTO, etc.
    payment_reference = db.Column(db.String(200), nullable=True)  # Stripe charge ID, crypto tx hash, etc.
    
    # Relationships
    user = db.relationship('User')
    
    # Unique constraint - one pass per user per season
    __table_args__ = (db.UniqueConstraint('user_id', 'season_id', name='unique_user_season_pass'),)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "season_id": self.season_id,
            "tier_type": self.tier_type,
            "purchase_price": self.purchase_price,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None,
            "payment_method": self.payment_method,
            "payment_reference": self.payment_reference
        }

class UserSeasonProgress(db.Model):
    """User's progress through a specific season"""
    __tablename__ = 'user_season_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    season_id = db.Column(db.Integer, db.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False)
    
    # Progress tracking
    current_xp_in_season = db.Column(db.Integer, default=0, nullable=False)
    current_level = db.Column(db.Integer, default=0, nullable=False)  # 0 means no levels unlocked yet
    
    # Reward claiming - stores list of claimed season_reward IDs
    claimed_rewards = db.Column(db.JSON, nullable=True, default=list)
    
    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User')
    
    # Unique constraint - one progress record per user per season
    __table_args__ = (db.UniqueConstraint('user_id', 'season_id', name='unique_user_season_progress'),)
    
    def get_unlocked_levels(self):
        """Get list of levels the user has unlocked"""
        levels = SeasonLevel.query.filter_by(season_id=self.season_id).order_by(SeasonLevel.level_number).all()
        unlocked = []
        cumulative_xp = 0
        
        for level in levels:
            cumulative_xp += level.xp_required_for_level
            if self.current_xp_in_season >= cumulative_xp:
                unlocked.append(level.level_number)
            else:
                break
                
        return unlocked
    
    def get_xp_to_next_level(self):
        """Get XP needed to reach the next level"""
        current_cumulative = 0
        next_level = None
        
        levels = SeasonLevel.query.filter_by(season_id=self.season_id).order_by(SeasonLevel.level_number).all()
        
        for level in levels:
            current_cumulative += level.xp_required_for_level
            if self.current_xp_in_season < current_cumulative:
                next_level = level
                break
        
        if next_level:
            return current_cumulative - self.current_xp_in_season
        return 0  # Already at max level
    
    def get_progress_percentage_to_next_level(self):
        """Get progress percentage to next level (0-100)"""
        if self.current_level == 0:
            # Special case for level 0 to level 1
            first_level = SeasonLevel.query.filter_by(season_id=self.season_id, level_number=1).first()
            if first_level:
                return min(100, (self.current_xp_in_season / first_level.xp_required_for_level) * 100)
            return 0
        
        # Calculate progress to next level
        levels = SeasonLevel.query.filter_by(season_id=self.season_id).order_by(SeasonLevel.level_number).all()
        current_cumulative = 0
        
        # Find current level's cumulative XP
        for level in levels:
            if level.level_number <= self.current_level:
                current_cumulative += level.xp_required_for_level
            else:
                # This is the next level
                xp_into_next_level = self.current_xp_in_season - current_cumulative
                return min(100, (xp_into_next_level / level.xp_required_for_level) * 100)
        
        return 100  # At max level
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "season_id": self.season_id,
            "current_xp_in_season": self.current_xp_in_season,
            "current_level": self.current_level,
            "claimed_rewards": self.claimed_rewards or [],
            "unlocked_levels": self.get_unlocked_levels(),
            "xp_to_next_level": self.get_xp_to_next_level(),
            "progress_percentage": self.get_progress_percentage_to_next_level(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class SeasonPassTransaction(db.Model):
    """Track XP transactions that contribute to season progress"""
    __tablename__ = 'season_pass_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    season_id = db.Column(db.Integer, db.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False)
    
    # XP information
    base_xp_amount = db.Column(db.Integer, nullable=False)  # XP before multiplier
    multiplier_applied = db.Column(db.Float, nullable=False, default=1.0)
    final_xp_amount = db.Column(db.Integer, nullable=False)  # XP after multiplier
    
    # Activity context
    activity_type = db.Column(db.String(100), nullable=False)
    related_item_id = db.Column(db.Integer, nullable=True)  # Survey, quest, etc.
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id'), nullable=True)
    
    # Meta
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User')
    business = db.relationship('Business')
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "season_id": self.season_id,
            "base_xp_amount": self.base_xp_amount,
            "multiplier_applied": self.multiplier_applied,
            "final_xp_amount": self.final_xp_amount,
            "activity_type": self.activity_type,
            "related_item_id": self.related_item_id,
            "business_id": self.business_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }




