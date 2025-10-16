# models/referral_security_models.py
"""
Enhanced referral security models for fraud prevention and audit logging.
Implements best practices from engineering checklist.
"""

from app.extensions import db
from datetime import datetime, timedelta
import hashlib


class ReferralSecurityLog(db.Model):
    """
    Comprehensive audit logging for referral signups.
    Tracks IP, device fingerprint, and other metadata for fraud detection.
    """
    __tablename__ = 'referral_security_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    referral_id = db.Column(db.Integer, db.ForeignKey('referrals.id', ondelete='CASCADE'), nullable=True)
    affiliate_conversion_id = db.Column(db.Integer, db.ForeignKey('affiliate_conversions.id', ondelete='CASCADE'), nullable=True)
    
    # User tracking
    referred_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    referrer_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Security metadata
    ip_address = db.Column(db.String(45), nullable=True)  # IPv4 or IPv6
    user_agent = db.Column(db.String(500), nullable=True)
    device_fingerprint = db.Column(db.String(64), nullable=True, index=True)  # Browser fingerprint hash
    
    # Email/domain analysis
    email_domain = db.Column(db.String(255), nullable=True, index=True)
    is_disposable_email = db.Column(db.Boolean, default=False)
    
    # Timing analysis
    link_clicked_at = db.Column(db.DateTime, nullable=True)
    signup_completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    time_to_signup_seconds = db.Column(db.Integer, nullable=True)  # Time from click to signup
    
    # Fraud flags
    fraud_score = db.Column(db.Integer, default=0, nullable=False)  # 0-100 risk score
    is_suspicious = db.Column(db.Boolean, default=False, nullable=False)
    fraud_reasons = db.Column(db.JSON, nullable=True)  # Array of fraud indicators
    
    # Verification status
    email_verified = db.Column(db.Boolean, default=False)
    phone_verified = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    referral = db.relationship('Referral', backref='security_log')
    affiliate_conversion = db.relationship('AffiliateConversion', backref='security_log')
    referred_user = db.relationship('User', foreign_keys=[referred_user_id], backref='referral_security_logs')
    referrer = db.relationship('User', foreign_keys=[referrer_user_id], backref='referred_security_logs')
    
    def calculate_fraud_score(self):
        """Calculate fraud risk score based on various factors."""
        score = 0
        reasons = []
        
        # Check if same IP as referrer
        referrer_recent_signup = ReferralSecurityLog.query.filter_by(
            referred_user_id=self.referrer_user_id
        ).order_by(ReferralSecurityLog.created_at.desc()).first()
        
        if referrer_recent_signup and referrer_recent_signup.ip_address == self.ip_address:
            score += 30
            reasons.append("SAME_IP_AS_REFERRER")
        
        # Check disposable email
        if self.is_disposable_email:
            score += 25
            reasons.append("DISPOSABLE_EMAIL")
        
        # Check rapid signup (< 30 seconds from click to signup)
        if self.time_to_signup_seconds and self.time_to_signup_seconds < 30:
            score += 20
            reasons.append("RAPID_SIGNUP")
        
        # Check device fingerprint collision
        if self.device_fingerprint:
            same_device_count = ReferralSecurityLog.query.filter_by(
                device_fingerprint=self.device_fingerprint
            ).filter(ReferralSecurityLog.id != self.id).count()
            
            if same_device_count > 0:
                score += 25
                reasons.append(f"DEVICE_REUSE_COUNT_{same_device_count}")
        
        self.fraud_score = min(score, 100)
        self.fraud_reasons = reasons
        self.is_suspicious = score >= 50
        
        return score
    
    def to_dict(self):
        return {
            'id': self.id,
            'referred_user_id': self.referred_user_id,
            'referrer_user_id': self.referrer_user_id,
            'ip_address': self.ip_address,
            'device_fingerprint': self.device_fingerprint,
            'email_domain': self.email_domain,
            'is_disposable_email': self.is_disposable_email,
            'fraud_score': self.fraud_score,
            'is_suspicious': self.is_suspicious,
            'fraud_reasons': self.fraud_reasons,
            'email_verified': self.email_verified,
            'phone_verified': self.phone_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ReferralRewardQueue(db.Model):
    """
    Queue for delayed reward distribution.
    Implements cooldown period before rewarding to prevent fraud.
    """
    __tablename__ = 'referral_reward_queue'
    
    id = db.Column(db.Integer, primary_key=True)
    referral_id = db.Column(db.Integer, db.ForeignKey('referrals.id', ondelete='CASCADE'), nullable=True)
    affiliate_conversion_id = db.Column(db.Integer, db.ForeignKey('affiliate_conversions.id', ondelete='CASCADE'), nullable=True)
    
    # User IDs
    referrer_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    referred_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Reward details
    referrer_xp_pending = db.Column(db.Integer, default=0)
    referred_xp_pending = db.Column(db.Integer, default=0)
    
    # Status
    status = db.Column(db.String(50), nullable=False, default='PENDING')  # PENDING, APPROVED, REJECTED, DISTRIBUTED
    distribution_scheduled_at = db.Column(db.DateTime, nullable=False)  # When to distribute
    distributed_at = db.Column(db.DateTime, nullable=True)
    
    # Trigger conditions
    requires_email_verification = db.Column(db.Boolean, default=True)
    requires_first_activity = db.Column(db.Boolean, default=True)  # First survey/quest completion
    first_activity_completed = db.Column(db.Boolean, default=False)
    
    # Security
    security_log_id = db.Column(db.Integer, db.ForeignKey('referral_security_logs.id'), nullable=True)
    fraud_check_passed = db.Column(db.Boolean, default=False)
    manual_review_required = db.Column(db.Boolean, default=False)
    reviewed_by_admin_id = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    referral = db.relationship('Referral', backref='reward_queue')
    affiliate_conversion = db.relationship('AffiliateConversion', backref='reward_queue')
    referrer = db.relationship('User', foreign_keys=[referrer_user_id], backref='referrer_reward_queue')
    referred_user = db.relationship('User', foreign_keys=[referred_user_id], backref='referred_reward_queue')
    security_log = db.relationship('ReferralSecurityLog', backref='reward_queue')
    reviewed_by = db.relationship('Admin', backref='reviewed_referral_rewards')
    
    @staticmethod
    def create_pending_reward(referral_id, referrer_id, referred_id, referrer_xp, referred_xp, 
                             cooldown_hours=48, affiliate_conversion_id=None, security_log_id=None):
        """Create a new pending reward with cooldown period."""
        reward = ReferralRewardQueue(
            referral_id=referral_id,
            affiliate_conversion_id=affiliate_conversion_id,
            referrer_user_id=referrer_id,
            referred_user_id=referred_id,
            referrer_xp_pending=referrer_xp,
            referred_xp_pending=referred_xp,
            distribution_scheduled_at=datetime.utcnow() + timedelta(hours=cooldown_hours),
            security_log_id=security_log_id,
            status='PENDING'
        )
        db.session.add(reward)
        return reward
    
    def can_distribute(self):
        """Check if reward can be distributed."""
        # Time-based check
        if datetime.utcnow() < self.distribution_scheduled_at:
            return False
        
        # Email verification check
        if self.requires_email_verification:
            from app.models import User
            user = User.query.get(self.referred_user_id)
            if not user or not user.email_verified:
                return False
        
        # Activity check
        if self.requires_first_activity and not self.first_activity_completed:
            return False
        
        # Fraud check
        if not self.fraud_check_passed:
            return False
        
        # Manual review check
        if self.manual_review_required and self.status != 'APPROVED':
            return False
        
        return True
    
    def to_dict(self):
        return {
            'id': self.id,
            'referrer_user_id': self.referrer_user_id,
            'referred_user_id': self.referred_user_id,
            'referrer_xp_pending': self.referrer_xp_pending,
            'referred_xp_pending': self.referred_xp_pending,
            'status': self.status,
            'distribution_scheduled_at': self.distribution_scheduled_at.isoformat() if self.distribution_scheduled_at else None,
            'distributed_at': self.distributed_at.isoformat() if self.distributed_at else None,
            'fraud_check_passed': self.fraud_check_passed,
            'manual_review_required': self.manual_review_required,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ReferralRateLimit(db.Model):
    """
    Rate limiting for referral rewards.
    Prevents abuse by limiting rewards per user per time period.
    """
    __tablename__ = 'referral_rate_limits'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Daily limits
    referrals_today = db.Column(db.Integer, default=0)
    last_referral_date = db.Column(db.Date, nullable=True)
    daily_limit = db.Column(db.Integer, default=10, nullable=False)
    
    # Weekly limits
    referrals_this_week = db.Column(db.Integer, default=0)
    week_start_date = db.Column(db.Date, nullable=True)
    weekly_limit = db.Column(db.Integer, default=50, nullable=False)
    
    # Violation tracking
    limit_violations = db.Column(db.Integer, default=0)
    is_blocked = db.Column(db.Boolean, default=False)
    blocked_until = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='referral_rate_limit')
    
    def can_refer(self):
        """Check if user can create a new referral."""
        from datetime import date
        
        if self.is_blocked and self.blocked_until and datetime.utcnow() < self.blocked_until:
            return False, "Account temporarily blocked from referring"
        
        today = date.today()
        
        # Reset daily counter if new day
        if not self.last_referral_date or self.last_referral_date < today:
            self.referrals_today = 0
            self.last_referral_date = today
        
        # Reset weekly counter if new week
        if not self.week_start_date or (today - self.week_start_date).days >= 7:
            self.referrals_this_week = 0
            self.week_start_date = today
        
        # Check daily limit
        if self.referrals_today >= self.daily_limit:
            self.limit_violations += 1
            return False, f"Daily referral limit reached ({self.daily_limit})"
        
        # Check weekly limit
        if self.referrals_this_week >= self.weekly_limit:
            self.limit_violations += 1
            return False, f"Weekly referral limit reached ({self.weekly_limit})"
        
        return True, None
    
    def increment_referral(self):
        """Increment referral counters."""
        self.referrals_today += 1
        self.referrals_this_week += 1
        
        # Auto-block if too many violations
        if self.limit_violations >= 5:
            self.is_blocked = True
            self.blocked_until = datetime.utcnow() + timedelta(days=7)
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'referrals_today': self.referrals_today,
            'referrals_this_week': self.referrals_this_week,
            'daily_limit': self.daily_limit,
            'weekly_limit': self.weekly_limit,
            'is_blocked': self.is_blocked,
            'blocked_until': self.blocked_until.isoformat() if self.blocked_until else None
        }




