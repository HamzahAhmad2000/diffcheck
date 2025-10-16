# models/referral_models.py
from app.extensions import db
from datetime import datetime
import secrets

class ReferralSettings(db.Model):
    """
    Admin-configurable settings for the referral system.
    Stores XP rewards and caps for referrals.
    """
    __tablename__ = 'referral_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    user_reward_xp = db.Column(db.Integer, nullable=False, default=50)  # XP for referrer
    new_user_bonus_xp = db.Column(db.Integer, nullable=False, default=50)  # XP for new user
    user_xp_cap = db.Column(db.Integer, nullable=False, default=5000)  # Max XP from referrals
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # System enable/disable
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_reward_xp': self.user_reward_xp,
            'new_user_bonus_xp': self.new_user_bonus_xp,
            'user_xp_cap': self.user_xp_cap,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ReferralLink(db.Model):
    """
    Unique referral links for users.
    Each user can have one referral link.
    """
    __tablename__ = 'referral_links'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    code = db.Column(db.String(32), unique=True, nullable=False, index=True)
    link_type = db.Column(db.String(20), nullable=False, default='USER')  # USER, AFFILIATE, BUSINESS
    tag = db.Column(db.String(100), nullable=True)  # Optional tag for tracking
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='referral_link', uselist=False)
    referrals = db.relationship('Referral', backref='link', cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super(ReferralLink, self).__init__(**kwargs)
        if not self.code:
            self.code = self.generate_unique_code()

    @staticmethod
    def generate_unique_code():
        """Generate a unique referral code."""
        while True:
            code = secrets.token_urlsafe(8)
            if not ReferralLink.query.filter_by(code=code).first():
                return code

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'code': self.code,
            'link_type': self.link_type,
            'tag': self.tag,
            'is_active': self.is_active,
            'referral_count': len(self.referrals),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Referral(db.Model):
    """
    Tracks successful referrals.
    Links referral links to new users who signed up.
    """
    __tablename__ = 'referrals'
    
    id = db.Column(db.Integer, primary_key=True)
    referral_link_id = db.Column(db.Integer, db.ForeignKey('referral_links.id', ondelete='CASCADE'), nullable=False)
    referred_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    xp_awarded_to_referrer = db.Column(db.Integer, default=0)  # Track XP given to referrer
    xp_awarded_to_referred = db.Column(db.Integer, default=0)  # Track XP given to new user
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    referred_user = db.relationship('User', foreign_keys=[referred_user_id], backref='referral_record')

    def to_dict(self):
        return {
            'id': self.id,
            'referral_link_id': self.referral_link_id,
            'referred_user_id': self.referred_user_id,
            'xp_awarded_to_referrer': self.xp_awarded_to_referrer,
            'xp_awarded_to_referred': self.xp_awarded_to_referred,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'referred_user': {
                'id': self.referred_user.id,
                'name': self.referred_user.name,
                'email': self.referred_user.email
            } if self.referred_user else None
        }

class AffiliateLink(db.Model):
    """
    Special affiliate links for business partnerships.
    These can have custom XP rewards and tracking.
    """
    __tablename__ = 'affiliate_links'
    
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    code = db.Column(db.String(32), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)  # Affiliate program name
    description = db.Column(db.Text, nullable=True)
    custom_user_reward_xp = db.Column(db.Integer, nullable=True)  # Override default XP
    custom_new_user_bonus_xp = db.Column(db.Integer, nullable=True)  # Override default XP
    assigned_tag = db.Column(db.String(100), nullable=True)  # Tag to assign to new users
    assigned_xp_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)  # User who receives XP
    commission_rate = db.Column(db.Float, default=0.0)  # For future monetization
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = db.relationship('Business', backref='affiliate_links')
    user = db.relationship('User', foreign_keys=[user_id], backref='affiliate_links')
    assigned_xp_user = db.relationship('User', foreign_keys=[assigned_xp_user_id], backref='xp_recipient_links')
    conversions = db.relationship('AffiliateConversion', backref='affiliate_link', cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super(AffiliateLink, self).__init__(**kwargs)
        if not self.code:
            self.code = self.generate_unique_code()

    @staticmethod
    def generate_unique_code():
        """Generate a unique affiliate code."""
        while True:
            code = secrets.token_urlsafe(10)
            if not AffiliateLink.query.filter_by(code=code).first():
                return code

    @property
    def is_expired(self):
        """Check if affiliate link has expired."""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False

    def to_dict(self):
        return {
            'id': self.id,
            'business_id': self.business_id,
            'user_id': self.user_id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'custom_user_reward_xp': self.custom_user_reward_xp,
            'custom_new_user_bonus_xp': self.custom_new_user_bonus_xp,
            'assigned_tag': self.assigned_tag,
            'assigned_xp_user_id': self.assigned_xp_user_id,
            'assigned_xp_user_name': self.assigned_xp_user.name if self.assigned_xp_user else None,
            'commission_rate': self.commission_rate,
            'is_active': self.is_active,
            'is_expired': self.is_expired,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'conversion_count': len(self.conversions),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AffiliateConversion(db.Model):
    """
    Tracks conversions from affiliate links.
    Similar to Referral but for affiliate programs.
    """
    __tablename__ = 'affiliate_conversions'
    
    id = db.Column(db.Integer, primary_key=True)
    affiliate_link_id = db.Column(db.Integer, db.ForeignKey('affiliate_links.id', ondelete='CASCADE'), nullable=False)
    converted_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    xp_awarded_to_affiliate = db.Column(db.Integer, default=0)
    xp_awarded_to_user = db.Column(db.Integer, default=0)
    commission_earned = db.Column(db.Float, default=0.0)  # For future monetization
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    converted_user = db.relationship('User', foreign_keys=[converted_user_id], backref='affiliate_conversion_record')

    def to_dict(self):
        return {
            'id': self.id,
            'affiliate_link_id': self.affiliate_link_id,
            'converted_user_id': self.converted_user_id,
            'xp_awarded_to_affiliate': self.xp_awarded_to_affiliate,
            'xp_awarded_to_user': self.xp_awarded_to_user,
            'commission_earned': self.commission_earned,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'converted_user': {
                'id': self.converted_user.id,
                'name': self.converted_user.name,
                'email': self.converted_user.email
            } if self.converted_user else None
        }



