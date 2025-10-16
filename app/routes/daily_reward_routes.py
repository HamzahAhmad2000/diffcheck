"""
Daily Reward Routes
API endpoints for the daily login calendar and streak system
"""

from flask import Blueprint, request, jsonify, g
from app.controllers.daily_reward_controller import DailyRewardController
from app.controllers.auth_controller import token_required, admin_required
from app.utils.rate_limiter import rate_limit
from app.extensions import db
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)

# Create blueprints
daily_reward_bp = Blueprint('daily_reward', __name__)
admin_daily_reward_bp = Blueprint('admin_daily_reward', __name__, url_prefix='/api/admin/daily-rewards')

# User endpoints

@daily_reward_bp.route('/daily-rewards/state', methods=['GET'])
@token_required
def get_daily_reward_state():
    """
    Get the complete state needed to render the daily reward calendar for the user.
    
    Returns:
        JSON: {
            "streak_info": {
                "current_streak": int,
                "freezes_left": int,
                "longest_streak": int,
                "total_claims": int
            },
            "calendar_slots": [
                {
                    "day": int (1-7, Monday-Sunday),
                    "date": "YYYY-MM-DD",
                    "status": "CLAIMED|MISSED|CLAIMABLE|FUTURE", 
                    "reward": {"type": "XP|RAFFLE_ENTRY", "amount": int} or null,
                    "can_recover": bool
                }
            ],
            "week_info": {
                "start_date": "YYYY-MM-DD",
                "all_days_claimed": bool,
                "completion_reward": {...} or null,
                "recovery_xp_cost": int
            },
            "user_xp_balance": int
        }
    """
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        state = DailyRewardController.get_user_calendar_state(current_user)
        
        if "error" in state:
            return jsonify({'error': state['error']}), 400
        
        return jsonify(state), 200
        
    except Exception as e:
        logger.error(f"Error getting daily reward state: {e}")
        return jsonify({'error': 'Failed to get daily reward state.'}), 500

@daily_reward_bp.route('/daily-rewards/claim', methods=['POST'])
@token_required
@rate_limit(max_attempts=10, window_minutes=60)  # SECURITY: Max 10 attempts per hour
def claim_daily_reward():
    """
    Claim the reward for the current day.
    
    Request Body (optional):
        {
            "date": "YYYY-MM-DD"  // Optional: for recovering missed days
        }
    
    Returns:
        JSON: {
            "success": true,
            "revealed_reward": {
                "type": "XP|RAFFLE_ENTRY",
                "xp_amount": int or null,
                "raffle_item": {
                    "id": int,
                    "title": string,
                    "image_url": string
                } or null
            },
            "new_streak": int,
            "was_recovery": bool,
            "recovery_xp_cost": int,
            "new_xp_balance": int,
            "week_completion_bonus": {...} or null
        }
    """
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        # Parse optional target date for recovery
        target_date = None
        data = request.get_json() or {}
        if 'date' in data:
            try:
                target_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400
            
            # Validate date is not in the future (use UTC)
            today_utc = datetime.utcnow().date()
            if target_date > today_utc:
                return jsonify({'error': 'Cannot claim rewards for future dates.'}), 400

        result = DailyRewardController.claim_daily_reward(current_user, target_date)
        
        if "error" in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error claiming daily reward: {e}")
        return jsonify({'error': 'Failed to claim daily reward.'}), 500

@daily_reward_bp.route('/daily-rewards/streak', methods=['GET'])
@token_required
def get_user_streak():
    """
    Get detailed streak information for the current user.
    
    Returns:
        JSON: {
            "current_streak": int,
            "freezes_left": int,
            "longest_streak": int,
            "total_claims": int,
            "total_recoveries": int,
            "last_claim_date": "YYYY-MM-DD" or null
        }
    """
    try:
        current_user = g.current_user
        if not current_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result = DailyRewardController.get_user_streak_info(current_user.id)
        
        if "error" in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting user streak: {e}")
        return jsonify({'error': 'Failed to get streak information.'}), 500

# Admin endpoints

@admin_daily_reward_bp.route('/configurations', methods=['GET'])
@token_required
@admin_required
def get_week_configurations():
    """
    Get all week configurations for admin management.
    
    Returns:
        JSON: {
            "success": true,
            "configurations": [
                {
                    "id": int,
                    "week_identifier": string,
                    "is_active": bool,
                    "bonus_reward": {...},
                    "recovery_xp_cost": int,
                    "weekly_freeze_count": int,
                    "daily_rewards_count": int,
                    "created_at": "ISO timestamp",
                    "updated_at": "ISO timestamp"
                }
            ]
        }
    """
    try:
        result = DailyRewardController.get_week_configurations()
        
        if "error" in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting week configurations: {e}")
        return jsonify({'error': 'Failed to get configurations.'}), 500

@admin_daily_reward_bp.route('/configurations', methods=['POST'])
@token_required
@admin_required
def create_week_configuration():
    """
    Create a new week configuration.
    
    Request Body:
        {
            "week_identifier": string,
            "bonus_reward_type": "XP|RAFFLE_ENTRY" or null,
            "bonus_xp_amount": int or null,
            "bonus_raffle_item_id": int or null,
            "recovery_xp_cost": int (default: 10),
            "weekly_freeze_count": int (default: 2),
            "daily_rewards": [
                {
                    "day_of_week": int (1-7),
                    "reward_type": "XP|RAFFLE_ENTRY",
                    "xp_amount": int or null,
                    "raffle_item_id": int or null
                }
            ]
        }
    
    Returns:
        JSON: {
            "success": true,
            "config": {...}
        }
    """
    try:
        admin_user = g.current_user
        if not admin_user:
            return jsonify({'error': 'Authentication required.'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required.'}), 400

        # Validate required fields
        if not data.get('week_identifier'):
            return jsonify({'error': 'week_identifier is required.'}), 400

        # Validate daily rewards if provided
        daily_rewards = data.get('daily_rewards', [])
        if daily_rewards:
            for reward in daily_rewards:
                if not (1 <= reward.get('day_of_week', 0) <= 7):
                    return jsonify({'error': 'day_of_week must be between 1 and 7.'}), 400
                
                reward_type = reward.get('reward_type')
                if reward_type not in ['XP', 'RAFFLE_ENTRY']:
                    return jsonify({'error': 'reward_type must be XP or RAFFLE_ENTRY.'}), 400
                
                # Validate reward type consistency
                if reward_type == 'XP' and not reward.get('xp_amount'):
                    return jsonify({'error': 'xp_amount required for XP rewards.'}), 400
                
                if reward_type == 'RAFFLE_ENTRY' and not reward.get('raffle_item_id'):
                    return jsonify({'error': 'raffle_item_id required for RAFFLE_ENTRY rewards.'}), 400

        result = DailyRewardController.create_week_configuration(data, admin_user.id)
        
        if "error" in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 201
        
    except Exception as e:
        logger.error(f"Error creating week configuration: {e}")
        return jsonify({'error': 'Failed to create configuration.'}), 500

@admin_daily_reward_bp.route('/configurations/<int:config_id>/activate', methods=['PUT'])
@token_required
@admin_required
def activate_week_configuration(config_id):
    """
    Activate a week configuration.
    
    Path Parameters:
        config_id: ID of the configuration to activate
    
    Returns:
        JSON: {
            "success": true,
            "message": "Configuration activated successfully"
        }
    """
    try:
        admin_user = g.current_user
        if not admin_user:
            return jsonify({'error': 'Authentication required.'}), 401

        result = DailyRewardController.activate_week_configuration(config_id, admin_user.id)
        
        if "error" in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error activating week configuration: {e}")
        return jsonify({'error': 'Failed to activate configuration.'}), 500

@admin_daily_reward_bp.route('/analytics', methods=['GET'])
@token_required
@admin_required  
def get_daily_reward_analytics():
    """
    Get analytics for the daily reward system.
    
    Query Parameters:
        start_date: Start date for analytics (YYYY-MM-DD)
        end_date: End date for analytics (YYYY-MM-DD)
    
    Returns:
        JSON: Analytics data for admin dashboard
    """
    try:
        from app.models.daily_reward_models import UserDailyRewardClaim, UserStreak
        from app.models import User
        from sqlalchemy import func, and_
        
        # Parse date parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD.'}), 400
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD.'}), 400
        
        # Build query filters
        filters = []
        if start_date:
            filters.append(UserDailyRewardClaim.claim_date >= start_date)
        if end_date:
            filters.append(UserDailyRewardClaim.claim_date <= end_date)
        
        # Get basic stats
        total_claims = UserDailyRewardClaim.query.filter(*filters).count()
        unique_users = UserDailyRewardClaim.query.filter(*filters).distinct(UserDailyRewardClaim.user_id).count()
        recovery_claims = UserDailyRewardClaim.query.filter(
            and_(UserDailyRewardClaim.was_recovered == True, *filters)
        ).count()
        
        # Get streak distribution
        streak_stats = db.session.query(
            func.avg(UserStreak.current_streak).label('avg_streak'),
            func.max(UserStreak.current_streak).label('max_streak'),
            func.count(UserStreak.user_id).label('total_users_with_streaks')
        ).first()
        
        # Get daily claim counts (if date range specified)
        daily_claims = []
        if start_date and end_date:
            daily_data = db.session.query(
                UserDailyRewardClaim.claim_date,
                func.count(UserDailyRewardClaim.id).label('claim_count')
            ).filter(*filters).group_by(UserDailyRewardClaim.claim_date).order_by(UserDailyRewardClaim.claim_date).all()
            
            daily_claims = [
                {
                    'date': claim_date.isoformat(),
                    'count': claim_count
                }
                for claim_date, claim_count in daily_data
            ]
        
        analytics = {
            'total_claims': total_claims,
            'unique_users': unique_users,
            'recovery_claims': recovery_claims,
            'recovery_rate': (recovery_claims / total_claims * 100) if total_claims > 0 else 0,
            'streak_stats': {
                'average_streak': float(streak_stats.avg_streak) if streak_stats.avg_streak else 0,
                'max_streak': streak_stats.max_streak or 0,
                'total_users_with_streaks': streak_stats.total_users_with_streaks or 0
            },
            'daily_claims': daily_claims
        }
        
        return jsonify({
            'success': True,
            'analytics': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting daily reward analytics: {e}")
        return jsonify({'error': 'Failed to get analytics.'}), 500

# Error handlers for the blueprints
@daily_reward_bp.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@daily_reward_bp.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405

@admin_daily_reward_bp.errorhandler(404)
def admin_not_found(error):
    return jsonify({'error': 'Admin endpoint not found'}), 404

@admin_daily_reward_bp.errorhandler(405)
def admin_method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405
