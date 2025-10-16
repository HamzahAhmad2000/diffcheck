"""
Celery tasks for referral system automation.
Handles delayed reward distribution and fraud monitoring.
"""

from celery import shared_task
from app.extensions import db
from app.controllers.referral_security_controller import ReferralSecurityController
from app.models.referral_security_models import ReferralRewardQueue, ReferralSecurityLog
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(name='distribute_pending_referral_rewards')
def distribute_pending_referral_rewards():
    """
    Celery task to distribute pending referral rewards.
    Run this task hourly via celery beat.
    
    Schedule in celery_config.py:
        beat_schedule = {
            'distribute-referral-rewards': {
                'task': 'distribute_pending_referral_rewards',
                'schedule': crontab(minute=0),  # Every hour
            },
        }
    """
    try:
        count = ReferralSecurityController.distribute_pending_rewards()
        logger.info(f"Referral reward distribution task completed. Distributed: {count}")
        return {
            'success': True,
            'distributed_count': count,
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in referral reward distribution task: {e}")
        return {
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


@shared_task(name='monitor_referral_fraud')
def monitor_referral_fraud():
    """
    Celery task to monitor and alert on suspicious referral patterns.
    Run this task every 6 hours.
    
    Schedule in celery_config.py:
        beat_schedule = {
            'monitor-referral-fraud': {
                'task': 'monitor_referral_fraud',
                'schedule': crontab(hour='*/6'),  # Every 6 hours
            },
        }
    """
    try:
        # Get high-risk referrals from last 24 hours
        since = datetime.utcnow() - timedelta(hours=24)
        
        high_risk = ReferralSecurityLog.query.filter(
            ReferralSecurityLog.created_at >= since,
            ReferralSecurityLog.fraud_score >= 75
        ).all()
        
        if len(high_risk) > 10:  # Alert threshold
            logger.warning(f"ALERT: {len(high_risk)} high-risk referrals detected in last 24 hours")
            
            # Here you could send email/Slack notification to admins
            # send_admin_alert('referral_fraud', {'count': len(high_risk), 'referrals': [r.to_dict() for r in high_risk]})
        
        # Check for IP clustering (same IP creating multiple accounts)
        ip_clusters = db.session.query(
            ReferralSecurityLog.ip_address,
            db.func.count(ReferralSecurityLog.id).label('count')
        ).filter(
            ReferralSecurityLog.created_at >= since,
            ReferralSecurityLog.ip_address.isnot(None)
        ).group_by(
            ReferralSecurityLog.ip_address
        ).having(
            db.func.count(ReferralSecurityLog.id) > 5
        ).all()
        
        if ip_clusters:
            logger.warning(f"ALERT: {len(ip_clusters)} IP addresses with 5+ referrals in 24h")
        
        return {
            'success': True,
            'high_risk_count': len(high_risk),
            'ip_clusters': len(ip_clusters),
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in fraud monitoring task: {e}")
        return {
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


@shared_task(name='cleanup_expired_security_logs')
def cleanup_expired_security_logs(days_to_keep=90):
    """
    Clean up old security logs to manage database size.
    Keep logs for 90 days (configurable).
    
    Schedule in celery_config.py:
        beat_schedule = {
            'cleanup-security-logs': {
                'task': 'cleanup_expired_security_logs',
                'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
            },
        }
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Don't delete logs for suspicious referrals
        deleted = ReferralSecurityLog.query.filter(
            ReferralSecurityLog.created_at < cutoff_date,
            ReferralSecurityLog.is_suspicious == False
        ).delete()
        
        db.session.commit()
        
        logger.info(f"Cleaned up {deleted} security logs older than {days_to_keep} days")
        
        return {
            'success': True,
            'deleted_count': deleted,
            'cutoff_date': cutoff_date.isoformat(),
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in security log cleanup task: {e}")
        db.session.rollback()
        return {
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


@shared_task(name='auto_approve_low_risk_rewards')
def auto_approve_low_risk_rewards():
    """
    Automatically approve rewards with low fraud scores that have passed cooldown.
    Run this task every hour.
    """
    try:
        # Get pending rewards with low fraud score
        pending = ReferralRewardQueue.query.join(
            ReferralSecurityLog,
            ReferralRewardQueue.security_log_id == ReferralSecurityLog.id
        ).filter(
            ReferralRewardQueue.status == 'PENDING',
            ReferralRewardQueue.fraud_check_passed == False,
            ReferralSecurityLog.fraud_score < 50,
            ReferralRewardQueue.distribution_scheduled_at <= datetime.utcnow()
        ).all()
        
        approved_count = 0
        for reward in pending:
            reward.fraud_check_passed = True
            approved_count += 1
        
        if approved_count > 0:
            db.session.commit()
            logger.info(f"Auto-approved {approved_count} low-risk rewards")
        
        return {
            'success': True,
            'approved_count': approved_count,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in auto-approval task: {e}")
        db.session.rollback()
        return {
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }




