# models/leaderboard_models.py
"""
Leaderboard Models
Database models for XP leaderboard caching and configuration.
"""

from app.extensions import db
from datetime import datetime


class LeaderboardSettings(db.Model):
    """
    Admin-configurable settings for the XP leaderboard display.
    Controls how many users to show and which timeframe to display.
    """
    __tablename__ = 'leaderboard_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    display_count = db.Column(db.Integer, nullable=False, default=25)  # How many top users to show
    active_timeframe = db.Column(db.String(20), nullable=False, default='ALL_TIME')  # ALL_TIME, MONTHLY, WEEKLY, DAILY
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)  # Enable/disable leaderboard
    last_cache_refresh = db.Column(db.DateTime, nullable=True)  # Track when cache was last refreshed
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'display_count': self.display_count,
            'active_timeframe': self.active_timeframe,
            'is_enabled': self.is_enabled,
            'last_cache_refresh': self.last_cache_refresh.isoformat() if self.last_cache_refresh else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class LeaderboardCache(db.Model):
    """
    Cached leaderboard entries for fast retrieval.
    Stores pre-calculated rankings for different timeframes to avoid expensive queries.
    """
    __tablename__ = 'leaderboard_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    rank = db.Column(db.Integer, nullable=False)  # User's position in leaderboard (1-based)
    total_xp = db.Column(db.Integer, nullable=False)  # XP total for this timeframe
    timeframe = db.Column(db.String(20), nullable=False, index=True)  # ALL_TIME, MONTHLY, WEEKLY, DAILY
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)  # When this cache entry was created
    
    # Relationships
    user = db.relationship('User', backref='leaderboard_entries')
    
    # Ensure one entry per user per timeframe
    __table_args__ = (
        db.UniqueConstraint('user_id', 'timeframe', name='uq_user_timeframe_leaderboard'),
        db.Index('idx_timeframe_rank', 'timeframe', 'rank'),  # Optimize for leaderboard queries
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'rank': self.rank,
            'total_xp': self.total_xp,
            'timeframe': self.timeframe,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'user': {
                'id': self.user.id,
                'username': self.user.username,
                'name': self.user.name,
                'profile_image_url': self.user.profile_image_url
            } if self.user else None
        }




