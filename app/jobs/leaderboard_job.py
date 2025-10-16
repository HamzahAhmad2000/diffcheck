# jobs/leaderboard_job.py
"""
Leaderboard Cache Refresh Job
Scheduled task to calculate and cache leaderboard data for all timeframes.
This job should be run periodically (e.g., every hour) via cron or task scheduler.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import func, text
from app.extensions import db
from app.models import User, PointsLog, Badge, UserBadge
from app.models.leaderboard_models import LeaderboardCache, LeaderboardSettings

logger = logging.getLogger(__name__)


def update_leaderboard_cache_job(app=None):
    """
    Calculates and caches the leaderboard for all timeframes.
    
    Args:
        app: Flask application instance (required for app context)
    """
    if app is None:
        logger.error("Flask app instance required for leaderboard cache job")
        return False
    
    with app.app_context():
        try:
            logger.info("Starting leaderboard cache refresh job")
            
            # Get or create settings
            settings = LeaderboardSettings.query.first()
            if not settings:
                settings = LeaderboardSettings()
                db.session.add(settings)
                db.session.commit()
            
            # Define timeframes with their date cutoffs
            timeframes = {
                'ALL_TIME': None,
                'MONTHLY': datetime.utcnow() - timedelta(days=30),
                'WEEKLY': datetime.utcnow() - timedelta(days=7),
                'DAILY': datetime.utcnow() - timedelta(days=1)
            }
            
            # Clear old cache entries
            logger.info("Clearing old leaderboard cache")
            LeaderboardCache.query.delete()
            
            total_entries_created = 0
            
            for timeframe_name, start_date in timeframes.items():
                logger.info(f"Processing timeframe: {timeframe_name}")
                
                # Build query for this timeframe
                if timeframe_name == 'ALL_TIME':
                    # For all-time, use total_xp_earned from User table for better performance
                    query = db.session.query(
                        User.id.label('user_id'),
                        User.total_xp_earned.label('total_xp')
                    ).filter(
                        User.total_xp_earned > 0  # Only include users with XP
                    ).order_by(User.total_xp_earned.desc())
                else:
                    # For time-limited periods, sum from PointsLog
                    query = db.session.query(
                        User.id.label('user_id'),
                        func.coalesce(func.sum(PointsLog.points_awarded), 0).label('total_xp')
                    ).outerjoin(PointsLog, User.id == PointsLog.user_id)
                    
                    if start_date:
                        query = query.filter(PointsLog.created_at >= start_date)
                    
                    query = query.group_by(User.id).having(
                        func.coalesce(func.sum(PointsLog.points_awarded), 0) > 0
                    ).order_by(func.sum(PointsLog.points_awarded).desc())
                
                # Limit to top 500 users for performance (cache more than we display)
                results = query.limit(500).all()
                
                # Create cache entries
                cache_entries = []
                for rank, result in enumerate(results, 1):
                    cache_entry = LeaderboardCache(
                        user_id=result.user_id,
                        rank=rank,
                        total_xp=int(result.total_xp),
                        timeframe=timeframe_name,
                        generated_at=datetime.utcnow()
                    )
                    cache_entries.append(cache_entry)
                
                # Bulk insert for better performance
                if cache_entries:
                    db.session.bulk_save_objects(cache_entries)
                    total_entries_created += len(cache_entries)
                    logger.info(f"Created {len(cache_entries)} cache entries for {timeframe_name}")
            
            # Update settings with last refresh time
            settings.last_cache_refresh = datetime.utcnow()
            
            # Commit all changes
            db.session.commit()
            
            logger.info(f"Leaderboard cache refresh completed successfully. Total entries: {total_entries_created}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating leaderboard cache: {str(e)}", exc_info=True)
            db.session.rollback()
            return False


def get_user_highest_badge(user_id):
    """
    Efficiently get a user's highest badge based on their total XP.
    
    Args:
        user_id: ID of the user
        
    Returns:
        dict: Highest badge info or None
    """
    try:
        # Get user's total XP
        user = User.query.filter_by(id=user_id).first()
        if not user:
            return None
        
        # Find highest badge user is eligible for
        highest_badge = Badge.query.filter(
            Badge.xp_threshold <= user.total_xp_earned
        ).order_by(Badge.xp_threshold.desc()).first()
        
        if highest_badge:
            return {
                'id': highest_badge.id,
                'name': highest_badge.name,
                'image_url': highest_badge.image_url,
                'xp_threshold': highest_badge.xp_threshold
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting highest badge for user {user_id}: {str(e)}")
        return None


def create_leaderboard_cli_command(app):
    """
    Create a CLI command for running the leaderboard cache refresh.
    This can be called from manage.py or run via flask command.
    
    Args:
        app: Flask application instance
    """
    @app.cli.command('refresh-leaderboard')
    def refresh_leaderboard_command():
        """Refresh the leaderboard cache."""
        success = update_leaderboard_cache_job(app)
        if success:
            print("Leaderboard cache refreshed successfully!")
        else:
            print("Failed to refresh leaderboard cache. Check logs for details.")
            
    return refresh_leaderboard_command


# For manual execution or cron jobs
if __name__ == "__main__":
    # This allows the job to be run directly as a script
    print("Leaderboard cache refresh job - Run via Flask CLI or import into your app")
    print("Usage: flask refresh-leaderboard")




