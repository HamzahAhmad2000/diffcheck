"""
Referral Security Controller
Implements fraud prevention, rate limiting, and delayed reward distribution.
"""

from flask import current_app, request
from ..models import db, User
from ..models.referral_models import ReferralSettings, ReferralLink, Referral, AffiliateLink, AffiliateConversion
from ..models.referral_security_models import (
    ReferralSecurityLog, 
    ReferralRewardQueue, 
    ReferralRateLimit
)
from datetime import datetime, timedelta
import hashlib
import re
import logging

logger = logging.getLogger(__name__)

# List of common disposable email domains
DISPOSABLE_EMAIL_DOMAINS = [
    'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
    'throwaway.email', 'maildrop.cc', 'temp-mail.org', 'getnada.com'
]


class ReferralSecurityController:
    """Enhanced referral controller with security and fraud prevention."""
    
    @staticmethod
    def generate_device_fingerprint(user_agent, ip_address):
        """
        Generate a device fingerprint from user agent and IP.
        In production, use a more sophisticated client-side fingerprinting library.
        """
        if not user_agent or not ip_address:
            return None
        
        combined = f"{user_agent}:{ip_address}"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    @staticmethod
    def is_disposable_email(email):
        """Check if email is from a disposable email service."""
        if not email:
            return False
        
        domain = email.split('@')[-1].lower()
        return domain in DISPOSABLE_EMAIL_DOMAINS
    
    @staticmethod
    def extract_email_domain(email):
        """Extract domain from email address."""
        if not email or '@' not in email:
            return None
        return email.split('@')[-1].lower()
    
    @staticmethod
    def check_rate_limit(user_id):
        """
        Check if user has exceeded referral rate limits.
        Returns (can_refer: bool, error_message: str or None)
        """
        rate_limit = ReferralRateLimit.query.filter_by(user_id=user_id).first()
        
        if not rate_limit:
            # Create new rate limit record
            rate_limit = ReferralRateLimit(user_id=user_id)
            db.session.add(rate_limit)
            db.session.commit()
            return True, None
        
        can_refer, error = rate_limit.can_refer()
        if not can_refer:
            return False, error
        
        return True, None
    
    @staticmethod
    def process_referral_with_security(new_user, referral_code, link_clicked_at=None):
        """
        Process referral signup with comprehensive security checks.
        
        Args:
            new_user: The newly registered User object
            referral_code: The referral code used
            link_clicked_at: When the referral link was clicked (from session)
        
        Returns:
            dict: Result with success status and security info
        """
        try:
            # Find referral link
            link = ReferralLink.query.filter_by(code=referral_code, is_active=True).first()
            if not link:
                return {"error": "Invalid or inactive referral code"}
            
            referrer = link.user
            settings = ReferralSettings.query.first()
            
            if not settings or not settings.is_active:
                return {"error": "Referral system is currently inactive"}
            
            # Check if user already referred
            existing_referral = Referral.query.filter_by(referred_user_id=new_user.id).first()
            if existing_referral:
                return {"error": "User has already been referred"}
            
            # Check referrer rate limits
            can_refer, rate_error = ReferralSecurityController.check_rate_limit(referrer.id)
            if not can_refer:
                logger.warning(f"Rate limit exceeded for referrer {referrer.id}: {rate_error}")
                return {"error": "Referral limit reached. Please try again later."}
            
            # Get request metadata
            ip_address = request.remote_addr if request else None
            user_agent = request.headers.get('User-Agent') if request else None
            device_fingerprint = ReferralSecurityController.generate_device_fingerprint(user_agent, ip_address)
            
            # Email analysis
            email_domain = ReferralSecurityController.extract_email_domain(new_user.email)
            is_disposable = ReferralSecurityController.is_disposable_email(new_user.email)
            
            # Calculate time to signup
            time_to_signup = None
            if link_clicked_at:
                try:
                    clicked_time = datetime.fromisoformat(link_clicked_at)
                    time_to_signup = int((datetime.utcnow() - clicked_time).total_seconds())
                except:
                    pass
            
            # Create security log
            security_log = ReferralSecurityLog(
                referred_user_id=new_user.id,
                referrer_user_id=referrer.id,
                ip_address=ip_address,
                user_agent=user_agent,
                device_fingerprint=device_fingerprint,
                email_domain=email_domain,
                is_disposable_email=is_disposable,
                link_clicked_at=link_clicked_at,
                signup_completed_at=datetime.utcnow(),
                time_to_signup_seconds=time_to_signup,
                email_verified=new_user.email_verified if hasattr(new_user, 'email_verified') else False
            )
            
            # Calculate fraud score
            fraud_score = security_log.calculate_fraud_score()
            
            db.session.add(security_log)
            db.session.flush()  # Get security_log.id
            
            # Calculate XP amounts
            current_referral_xp = sum(r.xp_awarded_to_referrer for r in link.referrals)
            remaining_cap = max(0, settings.user_xp_cap - current_referral_xp)
            xp_awarded_to_referrer = min(settings.user_reward_xp, remaining_cap)
            xp_awarded_to_referred = settings.new_user_bonus_xp
            
            # Create referral record (WITHOUT awarding XP yet)
            referral_record = Referral(
                referral_link_id=link.id,
                referred_user_id=new_user.id,
                xp_awarded_to_referrer=0,  # Will be awarded after verification
                xp_awarded_to_referred=0   # Will be awarded after verification
            )
            db.session.add(referral_record)
            db.session.flush()  # Get referral_record.id
            
            # Link security log to referral
            security_log.referral_id = referral_record.id
            
            # Determine cooldown period based on fraud score
            cooldown_hours = 48  # Default
            if fraud_score >= 75:
                cooldown_hours = 168  # 7 days for high-risk
            elif fraud_score >= 50:
                cooldown_hours = 96  # 4 days for medium-risk
            
            # Create reward queue entry with delayed distribution
            reward_queue = ReferralRewardQueue.create_pending_reward(
                referral_id=referral_record.id,
                referrer_id=referrer.id,
                referred_id=new_user.id,
                referrer_xp=xp_awarded_to_referrer,
                referred_xp=xp_awarded_to_referred,
                cooldown_hours=cooldown_hours,
                security_log_id=security_log.id
            )
            
            # Set verification requirements
            reward_queue.requires_email_verification = True
            reward_queue.requires_first_activity = True
            
            # Fraud handling
            if fraud_score >= 50:
                reward_queue.manual_review_required = True
                reward_queue.fraud_check_passed = False
                logger.warning(f"High fraud score ({fraud_score}) for referral {referral_record.id}")
            else:
                reward_queue.fraud_check_passed = True
            
            # Update rate limit
            rate_limit = ReferralRateLimit.query.filter_by(user_id=referrer.id).first()
            if rate_limit:
                rate_limit.increment_referral()
            
            db.session.commit()
            
            logger.info(f"Referral processed with security: {new_user.id} referred by {referrer.id}, fraud_score={fraud_score}")
            
            return {
                "success": True,
                "referrer_id": referrer.id,
                "referrer_name": referrer.name,
                "reward_status": "PENDING_VERIFICATION",
                "distribution_scheduled_at": reward_queue.distribution_scheduled_at.isoformat(),
                "requires_email_verification": True,
                "requires_first_activity": True,
                "fraud_score": fraud_score,
                "manual_review_required": reward_queue.manual_review_required,
                "cooldown_hours": cooldown_hours
            }
            
        except Exception as e:
            logger.error(f"Error processing secure referral: {e}")
            db.session.rollback()
            return {"error": "Failed to process referral"}
    
    @staticmethod
    def distribute_pending_rewards():
        """
        Background job to distribute pending rewards that are ready.
        Should be run periodically (e.g., every hour via Celery/cron).
        """
        from ..controllers.xp_badge_controller import award_xp
        from ..models import ActivityType
        
        ready_rewards = ReferralRewardQueue.query.filter_by(
            status='PENDING'
        ).filter(
            ReferralRewardQueue.distribution_scheduled_at <= datetime.utcnow()
        ).all()
        
        distributed_count = 0
        
        for reward in ready_rewards:
            try:
                if not reward.can_distribute():
                    continue
                
                # Award XP to both users
                if reward.referrer_xp_pending > 0:
                    award_xp(
                        reward.referrer_user_id, 
                        reward.referrer_xp_pending, 
                        ActivityType.USER_REFERRAL.value
                    )
                
                if reward.referred_xp_pending > 0:
                    award_xp(
                        reward.referred_user_id, 
                        reward.referred_xp_pending, 
                        ActivityType.REFERRAL_BONUS.value
                    )
                
                # Update referral record
                if reward.referral_id:
                    referral = Referral.query.get(reward.referral_id)
                    if referral:
                        referral.xp_awarded_to_referrer = reward.referrer_xp_pending
                        referral.xp_awarded_to_referred = reward.referred_xp_pending
                
                # Mark as distributed
                reward.status = 'DISTRIBUTED'
                reward.distributed_at = datetime.utcnow()
                
                distributed_count += 1
                logger.info(f"Distributed referral reward {reward.id}")
                
            except Exception as e:
                logger.error(f"Error distributing reward {reward.id}: {e}")
                continue
        
        if distributed_count > 0:
            db.session.commit()
            logger.info(f"Distributed {distributed_count} referral rewards")
        
        return distributed_count
    
    @staticmethod
    def mark_first_activity_completed(user_id):
        """
        Mark user's first activity as completed (e.g., first survey completion).
        This enables reward distribution for referrals requiring first activity.
        """
        pending_rewards = ReferralRewardQueue.query.filter_by(
            referred_user_id=user_id,
            status='PENDING',
            requires_first_activity=True,
            first_activity_completed=False
        ).all()
        
        for reward in pending_rewards:
            reward.first_activity_completed = True
        
        if pending_rewards:
            db.session.commit()
            logger.info(f"Marked first activity completed for user {user_id}, unlocked {len(pending_rewards)} rewards")
        
        return len(pending_rewards)
    
    @staticmethod
    def get_pending_rewards_for_user(user_id):
        """Get all pending rewards for a user (as referrer or referred)."""
        as_referrer = ReferralRewardQueue.query.filter_by(
            referrer_user_id=user_id,
            status='PENDING'
        ).all()
        
        as_referred = ReferralRewardQueue.query.filter_by(
            referred_user_id=user_id,
            status='PENDING'
        ).all()
        
        return {
            'as_referrer': [r.to_dict() for r in as_referrer],
            'as_referred': [r.to_dict() for r in as_referred]
        }
    
    @staticmethod
    def get_security_analytics():
        """Get fraud detection analytics for admin dashboard."""
        total_referrals = ReferralSecurityLog.query.count()
        suspicious_referrals = ReferralSecurityLog.query.filter_by(is_suspicious=True).count()
        
        # High fraud score referrals
        high_risk = ReferralSecurityLog.query.filter(
            ReferralSecurityLog.fraud_score >= 75
        ).count()
        
        # Pending manual reviews
        pending_reviews = ReferralRewardQueue.query.filter_by(
            manual_review_required=True,
            status='PENDING'
        ).count()
        
        # Blocked users
        blocked_users = ReferralRateLimit.query.filter_by(is_blocked=True).count()
        
        # Recent suspicious patterns
        recent_suspicious = ReferralSecurityLog.query.filter_by(
            is_suspicious=True
        ).order_by(ReferralSecurityLog.created_at.desc()).limit(10).all()
        
        return {
            'total_referrals': total_referrals,
            'suspicious_referrals': suspicious_referrals,
            'suspicious_percentage': round((suspicious_referrals / total_referrals * 100) if total_referrals > 0 else 0, 2),
            'high_risk_referrals': high_risk,
            'pending_reviews': pending_reviews,
            'blocked_users': blocked_users,
            'recent_suspicious': [r.to_dict() for r in recent_suspicious]
        }




