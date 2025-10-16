"""
Simple Rate Limiter for Daily Rewards
Uses database-backed tracking without external dependencies
"""

from functools import wraps
from flask import g, jsonify, request
from datetime import datetime, timedelta
from app.extensions import db
import logging

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass

def rate_limit(max_attempts=10, window_minutes=60, key_prefix='rate_limit'):
    """
    Rate limiting decorator using database audit log.
    
    Args:
        max_attempts: Maximum number of attempts allowed
        window_minutes: Time window in minutes
        key_prefix: Prefix for the rate limit key
        
    Usage:
        @rate_limit(max_attempts=10, window_minutes=60)
        def my_endpoint():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get user from g (set by @token_required decorator)
            user = getattr(g, 'current_user', None)
            if not user:
                # If no user context, skip rate limiting (shouldn't happen with @token_required)
                return f(*args, **kwargs)
            
            # Check rate limit using audit log table
            try:
                from app.models.daily_reward_models import DailyRewardClaimAttempt
                
                # Calculate the time window
                window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
                
                # Count attempts in the window
                attempt_count = DailyRewardClaimAttempt.query.filter(
                    DailyRewardClaimAttempt.user_id == user.id,
                    DailyRewardClaimAttempt.attempt_timestamp >= window_start
                ).count()
                
                if attempt_count >= max_attempts:
                    logger.warning(
                        f"Rate limit exceeded for user {user.id}: "
                        f"{attempt_count} attempts in {window_minutes} minutes"
                    )
                    return jsonify({
                        'error': f'Too many claim attempts. Please try again in a few minutes.',
                        'rate_limit_exceeded': True
                    }), 429
                
            except Exception as e:
                logger.error(f"Rate limit check failed: {e}")
                # On error, allow the request to proceed (fail open for availability)
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def get_rate_limit_status(user_id, window_minutes=60):
    """
    Get the current rate limit status for a user.
    
    Args:
        user_id: User ID to check
        window_minutes: Time window in minutes
        
    Returns:
        dict: Status information
    """
    try:
        from app.models.daily_reward_models import DailyRewardClaimAttempt
        
        window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        attempt_count = DailyRewardClaimAttempt.query.filter(
            DailyRewardClaimAttempt.user_id == user_id,
            DailyRewardClaimAttempt.attempt_timestamp >= window_start
        ).count()
        
        return {
            'attempts': attempt_count,
            'window_minutes': window_minutes,
            'window_start': window_start.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get rate limit status: {e}")
        return {
            'attempts': 0,
            'window_minutes': window_minutes,
            'error': str(e)
        }




