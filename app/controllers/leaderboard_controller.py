# controllers/leaderboard_controller.py
"""
Leaderboard Controller
Handles leaderboard data retrieval, user ranking, and admin management.
"""

import logging
from flask import current_app
from app.models import db, User, Badge
from app.models.leaderboard_models import LeaderboardCache, LeaderboardSettings
from app.jobs.leaderboard_job import get_user_highest_badge, update_leaderboard_cache_job
from datetime import datetime

logger = logging.getLogger(__name__)


class LeaderboardController:
    """Controller class for leaderboard operations."""
    
    @staticmethod
    def get_formatted_leaderboard(current_user_id=None):
        """
        Get the formatted leaderboard data for display.
        
        Args:
            current_user_id: ID of the current user (optional)
            
        Returns:
            dict: Formatted leaderboard data with top users and current user rank
        """
        try:
            # Get leaderboard settings
            settings = LeaderboardSettings.query.first()
            if not settings:
                # Create default settings if none exist
                settings = LeaderboardSettings()
                db.session.add(settings)
                db.session.commit()
            
            # Check if leaderboard is enabled
            if not settings.is_enabled:
                return {
                    'error': 'Leaderboard is currently disabled',
                    'is_enabled': False
                }
            
            timeframe = settings.active_timeframe
            limit = settings.display_count
            
            # Get top users from cache
            top_users_query = LeaderboardCache.query.filter_by(
                timeframe=timeframe
            ).order_by(LeaderboardCache.rank).limit(limit).all()
            
            # Check if cache is empty or stale - if so, refresh it automatically
            if not top_users_query:
                logger.warning(f"No cached leaderboard data found for timeframe: {timeframe}. Refreshing cache now...")
                
                # Attempt to refresh the cache immediately
                try:
                    refresh_success = update_leaderboard_cache_job(current_app._get_current_object())
                    
                    if refresh_success:
                        logger.info("Leaderboard cache refreshed successfully")
                        
                        # Try to fetch the data again after refresh
                        top_users_query = LeaderboardCache.query.filter_by(
                            timeframe=timeframe
                        ).order_by(LeaderboardCache.rank).limit(limit).all()
                        
                        # Update settings with refresh time
                        settings.last_cache_refresh = datetime.utcnow()
                        db.session.commit()
                        
                        if not top_users_query:
                            # Still no data after refresh - likely no users with XP
                            logger.warning("No users with XP found after cache refresh")
                            return {
                                'error': 'No users on the leaderboard yet. Be the first to earn XP!',
                                'timeframe': timeframe,
                                'cache_status': 'empty_after_refresh',
                                'top_users': [],
                                'current_user_rank': None,
                                'total_users_ranked': 0,
                                'is_enabled': settings.is_enabled
                            }
                    else:
                        logger.error("Failed to refresh leaderboard cache")
                        return {
                            'error': 'Failed to generate leaderboard data. Please try again later.',
                            'timeframe': timeframe,
                            'cache_status': 'refresh_failed'
                        }
                        
                except Exception as refresh_error:
                    logger.error(f"Error refreshing leaderboard cache: {str(refresh_error)}", exc_info=True)
                    return {
                        'error': 'Leaderboard data is being updated. Please try again in a moment.',
                        'timeframe': timeframe,
                        'cache_status': 'refresh_error'
                    }
            
            # Format top users with badge information
            formatted_top_users = []
            for entry in top_users_query:
                if entry.user:  # Ensure user still exists
                    # Get user's highest badge
                    highest_badge = get_user_highest_badge(entry.user_id)
                    
                    user_data = {
                        "rank": entry.rank,
                        "user": {
                            "id": entry.user.id,
                            "username": entry.user.username,
                            "name": entry.user.name,
                            "profile_image_url": entry.user.profile_image_url,
                            "highest_badge": highest_badge
                        },
                        "total_xp": entry.total_xp
                    }
                    formatted_top_users.append(user_data)
            
            # Get current user's rank if provided
            current_user_rank = None
            if current_user_id:
                current_user_entry = LeaderboardCache.query.filter_by(
                    timeframe=timeframe, 
                    user_id=current_user_id
                ).first()
                
                if current_user_entry and current_user_entry.user:
                    highest_badge = get_user_highest_badge(current_user_id)
                    current_user_rank = {
                        "rank": current_user_entry.rank,
                        "user": {
                            "id": current_user_entry.user.id,
                            "username": current_user_entry.user.username,
                            "name": current_user_entry.user.name,
                            "profile_image_url": current_user_entry.user.profile_image_url,
                            "highest_badge": highest_badge
                        },
                        "total_xp": current_user_entry.total_xp
                    }
            
            return {
                "timeframe": timeframe,
                "top_users": formatted_top_users,
                "current_user_rank": current_user_rank,
                "total_users_ranked": len(formatted_top_users),
                "last_updated": settings.last_cache_refresh.isoformat() if settings.last_cache_refresh else None,
                "is_enabled": settings.is_enabled
            }
            
        except Exception as e:
            logger.error(f"Error getting formatted leaderboard: {str(e)}", exc_info=True)
            return {
                'error': 'An error occurred while retrieving leaderboard data',
                'details': str(e) if current_app.debug else None
            }
    
    @staticmethod
    def get_user_rank(user_id, timeframe=None):
        """
        Get a specific user's rank and position in the leaderboard.
        
        Args:
            user_id: ID of the user
            timeframe: Specific timeframe or None for active timeframe
            
        Returns:
            dict: User's rank information or None if not found
        """
        try:
            if timeframe is None:
                settings = LeaderboardSettings.query.first()
                timeframe = settings.active_timeframe if settings else 'ALL_TIME'
            
            user_entry = LeaderboardCache.query.filter_by(
                timeframe=timeframe,
                user_id=user_id
            ).first()
            
            if user_entry and user_entry.user:
                highest_badge = get_user_highest_badge(user_id)
                return {
                    "rank": user_entry.rank,
                    "total_xp": user_entry.total_xp,
                    "timeframe": timeframe,
                    "user": {
                        "id": user_entry.user.id,
                        "username": user_entry.user.username,
                        "name": user_entry.user.name,
                        "profile_image_url": user_entry.user.profile_image_url,
                        "highest_badge": highest_badge
                    },
                    "last_updated": user_entry.generated_at.isoformat() if user_entry.generated_at else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user rank for user {user_id}: {str(e)}", exc_info=True)
            return None
    
    @staticmethod
    def get_leaderboard_settings():
        """
        Get current leaderboard settings.
        
        Returns:
            dict: Leaderboard settings
        """
        try:
            settings = LeaderboardSettings.query.first()
            if not settings:
                settings = LeaderboardSettings()
                db.session.add(settings)
                db.session.commit()
            
            return settings.to_dict()
            
        except Exception as e:
            logger.error(f"Error getting leaderboard settings: {str(e)}", exc_info=True)
            return {'error': str(e)}
    
    @staticmethod
    def update_leaderboard_settings(data):
        """
        Update leaderboard settings (admin only).
        
        Args:
            data: Dictionary containing settings to update
            
        Returns:
            dict: Updated settings or error
        """
        try:
            settings = LeaderboardSettings.query.first()
            if not settings:
                settings = LeaderboardSettings()
                db.session.add(settings)
            
            # Update allowed fields
            if 'display_count' in data:
                if isinstance(data['display_count'], int) and 1 <= data['display_count'] <= 100:
                    settings.display_count = data['display_count']
                else:
                    return {'error': 'Display count must be between 1 and 100'}
            
            if 'active_timeframe' in data:
                valid_timeframes = ['ALL_TIME', 'MONTHLY', 'WEEKLY', 'DAILY']
                if data['active_timeframe'] in valid_timeframes:
                    settings.active_timeframe = data['active_timeframe']
                else:
                    return {'error': f'Invalid timeframe. Must be one of: {valid_timeframes}'}
            
            if 'is_enabled' in data:
                if isinstance(data['is_enabled'], bool):
                    settings.is_enabled = data['is_enabled']
                else:
                    return {'error': 'is_enabled must be a boolean value'}
            
            settings.updated_at = datetime.utcnow()
            db.session.commit()
            
            logger.info(f"Leaderboard settings updated: {data}")
            return settings.to_dict()
            
        except Exception as e:
            logger.error(f"Error updating leaderboard settings: {str(e)}", exc_info=True)
            db.session.rollback()
            return {'error': str(e)}
    
    @staticmethod
    def refresh_leaderboard_cache():
        """
        Manually trigger leaderboard cache refresh (admin only).
        
        Returns:
            dict: Success/failure status
        """
        try:
            success = update_leaderboard_cache_job(current_app._get_current_object())
            
            if success:
                return {
                    'success': True,
                    'message': 'Leaderboard cache refreshed successfully',
                    'refreshed_at': datetime.utcnow().isoformat()
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to refresh leaderboard cache. Check server logs for details.'
                }
                
        except Exception as e:
            logger.error(f"Error manually refreshing leaderboard cache: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def get_cache_status():
        """
        Get information about the leaderboard cache status.
        
        Returns:
            dict: Cache status information
        """
        try:
            settings = LeaderboardSettings.query.first()
            
            # Count cache entries by timeframe
            cache_counts = {}
            timeframes = ['ALL_TIME', 'MONTHLY', 'WEEKLY', 'DAILY']
            
            for timeframe in timeframes:
                count = LeaderboardCache.query.filter_by(timeframe=timeframe).count()
                cache_counts[timeframe] = count
            
            return {
                'last_refresh': settings.last_cache_refresh.isoformat() if settings and settings.last_cache_refresh else None,
                'cache_counts': cache_counts,
                'total_cached_entries': sum(cache_counts.values()),
                'active_timeframe': settings.active_timeframe if settings else 'ALL_TIME',
                'is_enabled': settings.is_enabled if settings else True
            }
            
        except Exception as e:
            logger.error(f"Error getting cache status: {str(e)}", exc_info=True)
            return {'error': str(e)}
