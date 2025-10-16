"""
Analytics Controller
Handles analytics data for Super Admin and Business Admin dashboards
"""

from flask import request, jsonify
from sqlalchemy import func, text, desc
from datetime import datetime, timedelta
from ..models import (
    db, User, Business, Survey, Submission, Item, ItemVote, 
    PointsLog, MarketplaceItem, UserRewardLog, Badge, UserBadge, 
    BusinessActivity, Quest # Import Quest
)

class AnalyticsController:
    
    @staticmethod
    def get_super_admin_analytics():
        """
        Get comprehensive analytics for Super Admin Dashboard
        Based on the mockup requirements
        """
        try:
            # Get time ranges
            current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
            
            # Basic counts
            admin_count = User.query.filter_by(role='super_admin').count()
            user_count = User.query.filter(User.role.in_(['user', 'business_admin'])).count()
            business_count = Business.query.count()
            
            # Monthly new additions
            new_businesses_this_month = Business.query.filter(
                Business.created_at >= current_month_start
            ).count()
            
            new_users_this_month = User.query.filter(
                User.created_at >= current_month_start,
                User.role.in_(['user', 'business_admin'])
            ).count()
            
            # Survey and Item data (Items are used for feature requests/bugs)
            unattended_queries = Item.query.filter_by(status='PENDING').count()
            active_surveys = Survey.query.filter_by(published=True, is_archived=False).count()
            
            # Calculate average users per survey
            survey_user_data = db.session.query(
                Survey.id,
                func.count(Submission.id).label('submission_count')
            ).outerjoin(Submission).group_by(Survey.id).all()
            
            total_submissions = sum(row.submission_count for row in survey_user_data)
            avg_users_per_survey = round(total_submissions / active_surveys, 1) if active_surveys > 0 else 0
            
            # Get active quests count
            active_quests = Quest.query.filter_by(
                is_published=True, is_archived=False
            ).count()
            
            # User and Business distribution by categories
            business_distribution = AnalyticsController._get_business_category_distribution()
            
            # XP and engagement metrics
            xp_stats = AnalyticsController._get_xp_engagement_stats()
            
            # Marketplace analytics
            marketplace_stats = AnalyticsController._get_marketplace_analytics()
            
            # User activity chart data (last 30 days)
            activity_chart_data = AnalyticsController._get_user_activity_chart_data()
            
            return {
                'overview_metrics': {
                    'admins': admin_count,
                    'users': user_count,
                    'businesses': business_count,
                    'new_businesses_this_month': new_businesses_this_month,
                    'new_users_this_month': new_users_this_month,
                    'unattended_queries': unattended_queries,
                    'active_surveys': active_surveys,
                    'average_users_per_survey': avg_users_per_survey,
                    'active_quests': active_quests # Add active quests
                },
                'business_distribution': business_distribution,
                'xp_engagement': xp_stats,
                'marketplace_analytics': marketplace_stats,
                'user_activity_chart': activity_chart_data
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def get_business_admin_analytics(business_id):
        """
        Get analytics for Business Admin Dashboard
        """
        try:
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                return {'error': 'Business not found'}
            
            current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Basic business metrics
            surveys_published = Survey.query.filter_by(
                business_id=business_id, 
                published=True
            ).count()
            
            quests_published = Quest.query.filter_by(
                business_id=business_id,
                is_published=True
            ).count()
            
            # Survey completion data
            survey_completion_data = AnalyticsController._get_business_survey_completion(business_id)
            
            # Bug reports and feature requests for this business
            unfinished_surveys = Survey.query.filter_by(
                business_id=business_id,
                published=False,
                is_archived=False
            ).count()
            
            unfinished_quests = Quest.query.filter_by(
                business_id=business_id,
                is_published=False,
                status='PENDING'
            ).count()
            
            # Business-specific user engagement
            business_engagement = AnalyticsController._get_business_user_engagement(business_id)
            
            # Survey categories distribution for this business
            survey_categories = AnalyticsController._get_business_survey_categories(business_id)
            
            # Monthly metrics
            surveys_filled_last_7_days = Submission.query.join(Survey).filter(
                Survey.business_id == business_id,
                Submission.submitted_at >= datetime.now() - timedelta(days=7)
            ).count()

            # Import QuestCompletion if not already imported
            from ..models import QuestCompletion
            quests_filled_last_7_days = db.session.query(QuestCompletion).join(Quest).filter(
                 Quest.business_id == business_id,
                 QuestCompletion.completed_at >= datetime.now() - timedelta(days=7)).count()
            
            # User activity chart for this business
            business_activity_chart = AnalyticsController._get_business_activity_chart(business_id)
            
            return {
                'overview_metrics': {
                    'surveys_published': surveys_published,
                    'quests_published': quests_published,
                    'surveys_filled_last_7_days': surveys_filled_last_7_days,
                    'quests_filled_last_7_days': quests_filled_last_7_days,
                    'unfinished_surveys': unfinished_surveys,
                    'unfinished_quests': unfinished_quests,
                    'average_users_per_survey': business_engagement.get('avg_users_per_survey', 0)
                },
                'survey_categories': survey_categories,
                'user_engagement': business_engagement,
                'activity_chart': business_activity_chart,
                'completion_data': survey_completion_data
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def get_user_management_analytics():
        """
        Get analytics for User Management dashboard
        """
        try:
            current_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Total user counts
            total_users = User.query.filter(User.role.in_(['user', 'business_admin'])).count()
            new_users_this_month = User.query.filter(
                User.created_at >= current_month_start,
                User.role.in_(['user', 'business_admin'])
            ).count()
            
            deleted_users = User.query.filter_by(is_active=False).count()
            
            # User type breakdown
            google_users = User.query.filter(User.email.like('%@gmail.com')).count()
            banned_users = User.query.filter_by(is_active=False).count()
            
            # Calculate average users per day (last 30 days)
            thirty_days_ago = datetime.now() - timedelta(days=30)
            users_last_30_days = User.query.filter(
                User.created_at >= thirty_days_ago,
                User.role.in_(['user', 'business_admin'])
            ).count()
            avg_users_per_day = users_last_30_days // 30 if users_last_30_days > 0 else 0
            
            # XP and engagement metrics
            xp_leaderboard = AnalyticsController._get_xp_leaderboard()
            badge_distribution = AnalyticsController._get_badge_distribution()
            profile_completion_rate = AnalyticsController._get_profile_completion_rate()
            
            return {
                'overview_metrics': {
                    'total_users': total_users,
                    'new_users_this_month': new_users_this_month,
                    'users_deleted': deleted_users,
                    'google_users': google_users,
                    'banned_users': banned_users,
                    'average_users_per_day': avg_users_per_day
                },
                'xp_leaderboard': xp_leaderboard,
                'badge_distribution': badge_distribution,
                'profile_completion_rate': profile_completion_rate
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def _get_business_category_distribution():
        """Get business distribution by categories (for pie chart)"""
        try:
            # Simulate business categories based on naming patterns
            categories = {
                'Technology': Business.query.filter(
                    Business.name.ilike('%tech%') | 
                    Business.name.ilike('%software%') |
                    Business.name.ilike('%digital%')
                ).count(),
                'Energy': Business.query.filter(
                    Business.name.ilike('%energy%') |
                    Business.name.ilike('%power%') |
                    Business.name.ilike('%electric%')
                ).count(),
                'Airlines': Business.query.filter(
                    Business.name.ilike('%air%') |
                    Business.name.ilike('%flight%') |
                    Business.name.ilike('%airline%')
                ).count(),
                'Car Brands': Business.query.filter(
                    Business.name.ilike('%car%') |
                    Business.name.ilike('%auto%') |
                    Business.name.ilike('%motor%')
                ).count()
            }
            
            # Get remaining businesses
            categorized_count = sum(categories.values())
            total_businesses = Business.query.count()
            categories['Other'] = max(0, total_businesses - categorized_count)
            
            return categories
            
        except Exception as e:
            return {}
    
    @staticmethod
    def _get_xp_engagement_stats():
        """Get XP and engagement statistics"""
        try:
            # Total XP distributed
            total_xp_distributed = db.session.query(
                func.sum(PointsLog.points_awarded)
            ).scalar() or 0
            
            # Average XP per user
            active_users = User.query.filter(
                User.role.in_(['user', 'business_admin']),
                User.total_xp_earned > 0
            ).count()
            
            avg_xp_per_user = total_xp_distributed // active_users if active_users > 0 else 0
            
            # XP earning distribution by activity type
            xp_by_activity = db.session.query(
                PointsLog.activity_type,
                func.sum(PointsLog.points_awarded).label('total_xp')
            ).group_by(PointsLog.activity_type).all()
            
            return {
                'total_xp_distributed': total_xp_distributed,
                'average_xp_per_user': avg_xp_per_user,
                'active_users_with_xp': active_users,
                'xp_by_activity': {row.activity_type: row.total_xp for row in xp_by_activity}
            }
            
        except Exception as e:
            return {}
    
    @staticmethod
    def _get_marketplace_analytics():
        """Get marketplace performance metrics"""
        try:
            # Total items and redemptions
            total_items = MarketplaceItem.query.filter_by(is_active=True).count()
            total_redemptions = UserRewardLog.query.count()
            
            # XP spent in marketplace
            total_xp_spent = db.session.query(
                func.sum(UserRewardLog.xp_spent)
            ).scalar() or 0
            
            # Popular items (by redemption count)
            popular_items = db.session.query(
                MarketplaceItem.title,
                func.count(UserRewardLog.id).label('redemption_count')
            ).outerjoin(UserRewardLog).group_by(MarketplaceItem.id, MarketplaceItem.title)\
             .order_by(desc('redemption_count')).limit(5).all()
            
            # Redemption status distribution
            status_distribution = db.session.query(
                UserRewardLog.status,
                func.count(UserRewardLog.id).label('count')
            ).group_by(UserRewardLog.status).all()
            
            return {
                'total_items': total_items,
                'total_redemptions': total_redemptions,
                'total_xp_spent': total_xp_spent,
                'popular_items': [{'title': row.title, 'redemptions': row.redemption_count} for row in popular_items],
                'status_distribution': {row.status: row.count for row in status_distribution}
            }
            
        except Exception as e:
            return {}
    
    @staticmethod
    def _get_user_activity_chart_data():
        """Get user activity data for charts (last 30 days)"""
        try:
            # Get daily user registrations for last 30 days
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            activity_data = []
            for i in range(30):
                day = thirty_days_ago + timedelta(days=i)
                day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                # New users that day
                new_users = User.query.filter(
                    User.created_at >= day_start,
                    User.created_at < day_end,
                    User.role.in_(['user', 'business_admin'])
                ).count()
                
                # Survey submissions that day
                submissions = Submission.query.filter(
                    Submission.submitted_at >= day_start,
                    Submission.submitted_at < day_end
                ).count()
                
                activity_data.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'new_users': new_users,
                    'submissions': submissions,
                    'day_of_month': day.day
                })
            
            return activity_data
            
        except Exception as e:
            return []
    
    @staticmethod
    def _get_business_survey_completion(business_id):
        """Get survey completion data for a specific business"""
        try:
            surveys = Survey.query.filter_by(business_id=business_id, published=True).all()
            
            completion_data = []
            for survey in surveys:
                total_submissions = Submission.query.filter_by(survey_id=survey.id).count()
                completed_submissions = Submission.query.filter_by(
                    survey_id=survey.id, 
                    is_complete=True
                ).count()
                
                completion_rate = (completed_submissions / total_submissions * 100) if total_submissions > 0 else 0
                
                completion_data.append({
                    'survey_title': survey.title,
                    'total_submissions': total_submissions,
                    'completed_submissions': completed_submissions,
                    'completion_rate': round(completion_rate, 2)
                })
            
            return completion_data
            
        except Exception as e:
            return []
    
    @staticmethod
    def _get_business_user_engagement(business_id):
        """Get user engagement metrics for a business"""
        try:
            # Get surveys for this business
            surveys = Survey.query.filter_by(business_id=business_id, published=True).all()
            survey_ids = [s.id for s in surveys]
            
            if not survey_ids:
                return {'avg_users_per_survey': 0, 'total_unique_users': 0}
            
            # Get unique users who participated
            unique_users = db.session.query(
                func.count(func.distinct(Submission.user_id))
            ).filter(Submission.survey_id.in_(survey_ids)).scalar() or 0
            
            # Calculate average
            avg_users_per_survey = unique_users // len(surveys) if surveys else 0
            
            return {
                'avg_users_per_survey': avg_users_per_survey,
                'total_unique_users': unique_users,
                'total_surveys': len(surveys)
            }
            
        except Exception as e:
            return {'avg_users_per_survey': 0, 'total_unique_users': 0}
    
    @staticmethod
    def _get_business_survey_categories(business_id):
        """Get survey categories distribution for a business (simulated)"""
        try:
            surveys = Survey.query.filter_by(business_id=business_id).all()
            
            # Simulate categories based on survey titles
            categories = {
                'Technology': 0,
                'Energy': 0,
                'Airlines': 0,
                'Car Brands': 0,
                'Other': 0
            }
            
            for survey in surveys:
                title_lower = survey.title.lower()
                if any(word in title_lower for word in ['tech', 'software', 'digital', 'app']):
                    categories['Technology'] += 1
                elif any(word in title_lower for word in ['energy', 'power', 'electric']):
                    categories['Energy'] += 1
                elif any(word in title_lower for word in ['air', 'flight', 'travel']):
                    categories['Airlines'] += 1
                elif any(word in title_lower for word in ['car', 'auto', 'vehicle']):
                    categories['Car Brands'] += 1
                else:
                    categories['Other'] += 1
            
            return categories
            
        except Exception as e:
            return {}
    
    @staticmethod
    def _get_business_activity_chart(business_id):
        """Get activity chart data for a specific business"""
        try:
            # Get last 30 days of activity
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            activity_data = []
            for i in range(30):
                day = thirty_days_ago + timedelta(days=i)
                day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                # Submissions for this business
                submissions = db.session.query(Submission).join(Survey).filter(
                    Survey.business_id == business_id,
                    Submission.submitted_at >= day_start,
                    Submission.submitted_at < day_end
                ).count()

                # Quest completions for this business
                quest_completions = db.session.query(QuestCompletion).join(Quest).filter(
                    Quest.business_id == business_id, QuestCompletion.completed_at >= day_start, QuestCompletion.completed_at < day_end).count()
                
                activity_data.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'submissions': submissions,
                    'quest_completions': quest_completions, # Add quest completions
                    'day_of_month': day.day
                })
            
            return activity_data
            
        except Exception as e:
            return []
    
    @staticmethod
    def _get_xp_leaderboard(limit=10):
        """Get top users by XP"""
        try:
            top_users = User.query.filter(
                User.role.in_(['user', 'business_admin']),
                User.total_xp_earned > 0
            ).order_by(desc(User.total_xp_earned)).limit(limit).all()
            
            return [
                {
                    'user_name': user.name or user.username,
                    'user_email': user.email,
                    'total_xp': user.total_xp_earned,
                    'xp_balance': user.xp_balance,
                    'rank': i + 1
                }
                for i, user in enumerate(top_users)
            ]
            
        except Exception as e:
            return []
    
    @staticmethod
    def _get_badge_distribution():
        """Get badge achievement distribution"""
        try:
            badge_stats = db.session.query(
                Badge.name,
                Badge.xp_threshold,
                func.count(UserBadge.id).label('user_count')
            ).outerjoin(UserBadge).group_by(Badge.id, Badge.name, Badge.xp_threshold)\
             .order_by(Badge.xp_threshold.asc()).all()
            
            return [
                {
                    'badge_name': row.name,
                    'xp_threshold': row.xp_threshold,
                    'users_earned': row.user_count
                }
                for row in badge_stats
            ]
            
        except Exception as e:
            return []
    
    @staticmethod
    def _get_profile_completion_rate():
        """Calculate profile completion rate"""
        try:
            total_users = User.query.filter(User.role.in_(['user', 'business_admin'])).count()
            
            # Count users with completed profiles (basic criteria)
            completed_profiles = User.query.filter(
                User.role.in_(['user', 'business_admin']),
                User.age.isnot(None),
                User.gender.isnot(None),
                User.country.isnot(None)
            ).count()
            
            completion_rate = (completed_profiles / total_users * 100) if total_users > 0 else 0
            
            return {
                'total_users': total_users,
                'completed_profiles': completed_profiles,
                'completion_rate': round(completion_rate, 2)
            }
            
        except Exception as e:
            return {'total_users': 0, 'completed_profiles': 0, 'completion_rate': 0} 