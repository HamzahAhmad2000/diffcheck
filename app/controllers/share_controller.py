"""
Share Controller
Handles the Share to Earn XP feature including social media sharing rewards
"""

from flask import request, jsonify, current_app
from datetime import datetime, timedelta
from ..models import (
    db, User, UserShare, ShareType, SystemConfiguration, ShareAnalytics,
    Badge, UserBadge, MarketplaceItem, UserRewardLog, Purchase, RaffleEntry
)
from .xp_badge_controller import award_xp_no_commit
from sqlalchemy.exc import IntegrityError
import urllib.parse

class ShareController:
    """Controller for managing share-to-earn XP functionality"""
    
    # Default share text templates
    DEFAULT_SHARE_TEXTS = {
        ShareType.JOIN_SHARE.value: "Just joined @EclipseerLabs — a platform where you earn XP and rewards by giving feedback to brands and games you love! Join me and get rewarded for your voice. #Eclipseer",
        ShareType.BADGE_SHARE.value: "Earned a new badge on @Eclipseer for contributing to great research! Join the movement and turn feedback into rewards. #Eclipseer",
        ShareType.REWARD_REDEMPTION_SHARE.value: "Just redeemed [Prize Name] on @EclipseerLabs using my XP! Giving feedback has never been this rewarding. Check it out and start earning too. #Eclipseer",
        ShareType.RAFFLE_WIN_SHARE.value: "I just won [Prize Name] in a raffle on @EclipseerLabs 🎉 All I did was give feedback and earn XP – now I'm winning real rewards! Join in 👉 #Eclipseer",
        ShareType.RAFFLE_ENTRY_SHARE.value: "Just entered a raffle on @EclipseerLabs for [Prize Name]! 🎲 Earning XP and getting chances to win amazing prizes. Join the fun! #Eclipseer"
    }
    
    # Default XP rewards
    DEFAULT_XP_REWARDS = {
        ShareType.JOIN_SHARE.value: 500,
        ShareType.BADGE_SHARE.value: 50,
        ShareType.REWARD_REDEMPTION_SHARE.value: 50,
        ShareType.RAFFLE_WIN_SHARE.value: 50,
        ShareType.RAFFLE_ENTRY_SHARE.value: 10
    }
    
    @staticmethod
    def initialize_default_configs():
        """Initialize default configuration values for share-to-earn feature"""
        try:
            # Feature toggle
            SystemConfiguration.set_config(
                'share_to_earn_enabled', True, 'boolean',
                'Enable or disable the share-to-earn XP feature globally',
                'share_to_earn'
            )
            
            # XP rewards
            for share_type, xp_amount in ShareController.DEFAULT_XP_REWARDS.items():
                SystemConfiguration.set_config(
                    f'xp_reward_{share_type.lower()}', xp_amount, 'integer',
                    f'XP reward for {share_type.replace("_", " ").title()}',
                    'share_to_earn'
                )
            
            # Share text templates
            for share_type, text in ShareController.DEFAULT_SHARE_TEXTS.items():
                SystemConfiguration.set_config(
                    f'share_text_{share_type.lower()}', text, 'string',
                    f'Share text template for {share_type.replace("_", " ").title()}',
                    'share_to_earn'
                )
            
            # Join share prompt duration
            SystemConfiguration.set_config(
                'join_share_prompt_duration_hours', 72, 'integer',
                'Duration in hours for which the join-share prompt is visible to new users',
                'share_to_earn'
            )
            
            current_app.logger.debug("Share-to-earn default configurations initialized successfully")
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error initializing share-to-earn configs: {str(e)}")
            return False
    
    @staticmethod
    def get_share_eligibility(user_id):
        """
        Get user's eligibility for different types of shares
        
        Args:
            user_id: ID of the user
            
        Returns:
            dict: Eligibility status for each share type
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return {'error': 'User not found'}
            
            # Check if feature is enabled
            if not SystemConfiguration.get_config('share_to_earn_enabled', True):
                return {
                    'feature_enabled': False,
                    'join_share_eligible': False,
                    'badge_shares_available': [],
                    'reward_shares_available': [],
                    'raffle_shares_available': []
                }
            
            eligibility = {'feature_enabled': True}
            
            # Check join share eligibility
            eligibility['join_share_eligible'] = ShareController._check_join_share_eligibility(user)
            
            # Check badge share eligibility
            eligibility['badge_shares_available'] = ShareController._get_available_badge_shares(user_id)
            
            # Check reward redemption shares
            eligibility['reward_shares_available'] = ShareController._get_available_reward_shares(user_id)
            
            # Check raffle win shares
            eligibility['raffle_shares_available'] = ShareController._get_available_raffle_shares(user_id)
            
            return eligibility
            
        except Exception as e:
            current_app.logger.error(f"Error getting share eligibility for user {user_id}: {str(e)}")
            return {'error': 'Failed to get share eligibility'}
    
    @staticmethod
    def _check_join_share_eligibility(user):
        """Check if user is eligible for join share"""
        # Check if already completed
        if user.has_completed_join_share:
            return False
        
        # Check if within time window
        join_duration_hours = SystemConfiguration.get_config('join_share_prompt_duration_hours', 72)
        cutoff_time = datetime.utcnow() - timedelta(hours=join_duration_hours)
        
        return user.created_at > cutoff_time
    
    @staticmethod
    def _get_available_badge_shares(user_id):
        """Get badges that user can share"""
        try:
            # Get user's badges that haven't been shared yet
            user_badges = db.session.query(UserBadge).filter_by(user_id=user_id).all()
            shared_badges = db.session.query(UserShare.related_object_id).filter(
                UserShare.user_id == user_id,
                UserShare.share_type == ShareType.BADGE_SHARE.value
            ).all()
            
            shared_badge_ids = {share.related_object_id for share in shared_badges}
            
            available_badges = []
            for user_badge in user_badges:
                if user_badge.badge_id not in shared_badge_ids:
                    available_badges.append({
                        'badge_id': user_badge.badge_id,
                        'badge_name': user_badge.badge.name if user_badge.badge else 'Unknown Badge',
                        'earned_at': user_badge.earned_at.isoformat() if user_badge.earned_at else None
                    })
            
            return available_badges
            
        except Exception as e:
            current_app.logger.error(f"Error getting available badge shares for user {user_id}: {str(e)}")
            return []
    
    @staticmethod
    def _get_available_reward_shares(user_id):
        """Get reward redemptions that user can share"""
        try:
            # Get user's reward redemptions that haven't been shared yet
            redemptions = db.session.query(UserRewardLog).filter_by(user_id=user_id).all()
            shared_rewards = db.session.query(UserShare.related_object_id).filter(
                UserShare.user_id == user_id,
                UserShare.share_type == ShareType.REWARD_REDEMPTION_SHARE.value
            ).all()
            
            shared_reward_ids = {share.related_object_id for share in shared_rewards}
            
            available_rewards = []
            for redemption in redemptions:
                if redemption.id not in shared_reward_ids:
                    available_rewards.append({
                        'redemption_id': redemption.id,
                        'item_name': redemption.marketplace_item.title if redemption.marketplace_item else 'Unknown Item',
                        'redeemed_at': redemption.redeemed_at.isoformat() if redemption.redeemed_at else None
                    })
            
            return available_rewards
            
        except Exception as e:
            current_app.logger.error(f"Error getting available reward shares for user {user_id}: {str(e)}")
            return []
    
    @staticmethod
    def _get_available_raffle_shares(user_id):
        """Get raffle wins that user can share"""
        try:
            # Get user's raffle wins that haven't been shared yet
            raffle_wins = db.session.query(RaffleEntry).filter(
                RaffleEntry.user_id == user_id,
                RaffleEntry.is_winner == True
            ).all()
            
            shared_raffles = db.session.query(UserShare.related_object_id).filter(
                UserShare.user_id == user_id,
                UserShare.share_type == ShareType.RAFFLE_WIN_SHARE.value
            ).all()
            
            shared_raffle_ids = {share.related_object_id for share in shared_raffles}
            
            available_raffles = []
            for raffle_win in raffle_wins:
                if raffle_win.id not in shared_raffle_ids:
                    available_raffles.append({
                        'raffle_entry_id': raffle_win.id,
                        'item_name': raffle_win.marketplace_item.title if raffle_win.marketplace_item else 'Unknown Item',
                        'selected_at': raffle_win.selected_at.isoformat() if raffle_win.selected_at else None
                    })
            
            return available_raffles
            
        except Exception as e:
            current_app.logger.error(f"Error getting available raffle shares for user {user_id}: {str(e)}")
            return []
    
    @staticmethod
    def generate_share_url(share_type, related_object_id=None, user_id=None):
        """
        Generate X (Twitter) share URL with pre-filled text
        
        Args:
            share_type: Type of share (from ShareType enum)
            related_object_id: ID of related object (badge, reward, etc.)
            user_id: ID of user (for personalization)
            
        Returns:
            dict: Share URL and text
        """
        try:
            # Get share text template
            text_key = f'share_text_{share_type.lower()}'
            share_text = SystemConfiguration.get_config(text_key, ShareController.DEFAULT_SHARE_TEXTS.get(share_type, ''))
            
            # Personalize text if needed
            if related_object_id and '[Prize Name]' in share_text:
                prize_name = ShareController._get_prize_name(share_type, related_object_id)
                share_text = share_text.replace('[Prize Name]', prize_name)
            
            # Add UTM parameters for tracking
            utm_params = "?utm_source=twitter&utm_medium=social&utm_campaign=share_to_earn"
            if share_type == ShareType.JOIN_SHARE.value:
                utm_params += "_join"
            elif share_type == ShareType.BADGE_SHARE.value:
                utm_params += "_badge"
            elif share_type == ShareType.REWARD_REDEMPTION_SHARE.value:
                utm_params += "_reward"
            elif share_type == ShareType.RAFFLE_WIN_SHARE.value:
                utm_params += "_raffle_win"
            
            # Add website URL to share text
            base_url = current_app.config.get('FRONTEND_URL', 'https://eclipseer.com')
            share_text += f" {base_url}{utm_params}"
            
            # Encode text for URL
            encoded_text = urllib.parse.quote(share_text)
            
            # Generate X intent URL
            share_url = f"https://twitter.com/intent/tweet?text={encoded_text}"
            
            return {
                'share_url': share_url,
                'share_text': share_text,
                'encoded_text': encoded_text
            }
            
        except Exception as e:
            current_app.logger.error(f"Error generating share URL: {str(e)}")
            return {'error': 'Failed to generate share URL'}
    
    @staticmethod
    def _get_prize_name(share_type, related_object_id):
        """Get the name of the prize/item being shared"""
        try:
            if share_type in [ShareType.REWARD_REDEMPTION_SHARE.value]:
                redemption = UserRewardLog.query.get(related_object_id)
                if redemption and redemption.marketplace_item:
                    return redemption.marketplace_item.title
            elif share_type in [ShareType.RAFFLE_WIN_SHARE.value, ShareType.RAFFLE_ENTRY_SHARE.value]:
                raffle_entry = RaffleEntry.query.get(related_object_id)
                if raffle_entry and raffle_entry.marketplace_item:
                    return raffle_entry.marketplace_item.title
            
            return "Amazing Prize"
            
        except Exception as e:
            current_app.logger.error(f"Error getting prize name: {str(e)}")
            return "Amazing Prize"
    
    @staticmethod
    def confirm_share(user_id, share_type, related_object_id=None, session_id=None, user_agent=None, ip_address=None):
        """
        Confirm a share action and award XP
        
        Args:
            user_id: ID of the user
            share_type: Type of share (from ShareType enum)
            related_object_id: ID of related object (optional)
            session_id: User session ID for analytics
            user_agent: User agent string
            ip_address: User IP address
            
        Returns:
            dict: Result of share confirmation
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return {'error': 'User not found'}, 404
            
            # Check if feature is enabled
            if not SystemConfiguration.get_config('share_to_earn_enabled', True):
                return {'error': 'Share to earn feature is disabled'}, 403
            
            # Validate share type
            if share_type not in [e.value for e in ShareType]:
                return {'error': 'Invalid share type'}, 400
            
            # Check if user is eligible for this share
            if not ShareController._validate_share_eligibility(user, share_type, related_object_id):
                return {'error': 'User not eligible for this share'}, 403
            
            # Check for duplicate share
            existing_share = UserShare.query.filter(
                UserShare.user_id == user_id,
                UserShare.share_type == share_type,
                UserShare.related_object_id == related_object_id
            ).first()
            
            if existing_share:
                return {'error': 'Share already completed', 'already_shared': True}, 409
            
            # Get XP reward amount
            xp_key = f'xp_reward_{share_type.lower()}'
            xp_amount = SystemConfiguration.get_config(xp_key, ShareController.DEFAULT_XP_REWARDS.get(share_type, 0))
            
            # Award XP
            xp_result = award_xp_no_commit(user_id, xp_amount, f'SHARE_{share_type}')
            if xp_result.get('error'):
                return {'error': f'Failed to award XP: {xp_result["error"]}'}, 500
            
            # Create share record
            user_share = UserShare(
                user_id=user_id,
                share_type=share_type,
                related_object_id=related_object_id,
                xp_earned=xp_amount
            )
            db.session.add(user_share)
            
            # Update user join share status if applicable
            if share_type == ShareType.JOIN_SHARE.value:
                user.has_completed_join_share = True
            
            # Record analytics
            ShareController._record_analytics(
                user_id, 'share_completed', share_type, related_object_id,
                session_id, user_agent, ip_address
            )
            
            db.session.commit()
            
            current_app.logger.debug(f"User {user_id} completed share {share_type} and earned {xp_amount} XP")
            
            return {
                'success': True,
                'xp_earned': xp_amount,
                'share_type': share_type,
                'related_object_id': related_object_id,
                'message': f'Share completed! You earned {xp_amount} XP.'
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"IntegrityError confirming share: {str(e)}")
            return {'error': 'Share already exists'}, 409
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error confirming share: {str(e)}")
            return {'error': 'Failed to confirm share'}, 500
    
    @staticmethod
    def _validate_share_eligibility(user, share_type, related_object_id):
        """Validate if user is eligible for the specific share"""
        try:
            if share_type == ShareType.JOIN_SHARE.value:
                return ShareController._check_join_share_eligibility(user)
            
            elif share_type == ShareType.BADGE_SHARE.value:
                if not related_object_id:
                    return False
                # Check if user has this badge
                user_badge = UserBadge.query.filter(
                    UserBadge.user_id == user.id,
                    UserBadge.badge_id == related_object_id
                ).first()
                return user_badge is not None
            
            elif share_type == ShareType.REWARD_REDEMPTION_SHARE.value:
                if not related_object_id:
                    return False
                # Check if user has this redemption
                redemption = UserRewardLog.query.filter(
                    UserRewardLog.user_id == user.id,
                    UserRewardLog.id == related_object_id
                ).first()
                return redemption is not None
            
            elif share_type == ShareType.RAFFLE_WIN_SHARE.value:
                if not related_object_id:
                    return False
                # Check if user won this raffle
                raffle_win = RaffleEntry.query.filter(
                    RaffleEntry.user_id == user.id,
                    RaffleEntry.id == related_object_id,
                    RaffleEntry.is_winner == True
                ).first()
                return raffle_win is not None
            
            elif share_type == ShareType.RAFFLE_ENTRY_SHARE.value:
                if not related_object_id:
                    return False
                # Check if user entered this raffle
                raffle_entry = RaffleEntry.query.filter(
                    RaffleEntry.user_id == user.id,
                    RaffleEntry.id == related_object_id
                ).first()
                return raffle_entry is not None
            
            return False
            
        except Exception as e:
            current_app.logger.error(f"Error validating share eligibility: {str(e)}")
            return False
    
    @staticmethod
    def _record_analytics(user_id, event_type, share_type, related_object_id=None, 
                         session_id=None, user_agent=None, ip_address=None):
        """Record analytics event for share actions"""
        try:
            analytics = ShareAnalytics(
                user_id=user_id,
                event_type=event_type,
                share_type=share_type,
                related_object_id=related_object_id,
                session_id=session_id,
                user_agent=user_agent,
                ip_address=ip_address
            )
            db.session.add(analytics)
            
        except Exception as e:
            current_app.logger.error(f"Error recording share analytics: {str(e)}")
    
    @staticmethod
    def record_share_prompt_shown(user_id, share_type, related_object_id=None, session_id=None):
        """Record when a share prompt is shown to user"""
        try:
            ShareController._record_analytics(
                user_id, 'prompt_shown', share_type, related_object_id, session_id
            )
            db.session.commit()
            
        except Exception as e:
            current_app.logger.error(f"Error recording share prompt shown: {str(e)}")
    
    @staticmethod
    def record_share_button_clicked(user_id, share_type, related_object_id=None, session_id=None):
        """Record when a share button is clicked"""
        try:
            ShareController._record_analytics(
                user_id, 'button_clicked', share_type, related_object_id, session_id
            )
            db.session.commit()
            
        except Exception as e:
            current_app.logger.error(f"Error recording share button clicked: {str(e)}")
    
    @staticmethod
    def get_user_share_history(user_id, page=1, per_page=20):
        """Get user's share history"""
        try:
            shares = UserShare.query.filter_by(user_id=user_id)\
                .order_by(UserShare.created_at.desc())\
                .paginate(page=page, per_page=per_page, error_out=False)
            
            return {
                'shares': [share.to_dict() for share in shares.items],
                'total': shares.total,
                'pages': shares.pages,
                'current_page': page,
                'per_page': per_page
            }
            
        except Exception as e:
            current_app.logger.error(f"Error getting user share history: {str(e)}")
            return {'error': 'Failed to get share history'}
    
    @staticmethod
    def get_share_analytics_summary(days=30):
        """Get analytics summary for share-to-earn feature"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Get total shares by type
            shares_by_type = db.session.query(
                UserShare.share_type,
                db.func.count(UserShare.id).label('count'),
                db.func.sum(UserShare.xp_earned).label('total_xp')
            ).filter(UserShare.created_at >= cutoff_date)\
             .group_by(UserShare.share_type).all()
            
            # Get analytics events
            events_by_type = db.session.query(
                ShareAnalytics.event_type,
                ShareAnalytics.share_type,
                db.func.count(ShareAnalytics.id).label('count')
            ).filter(ShareAnalytics.created_at >= cutoff_date)\
             .group_by(ShareAnalytics.event_type, ShareAnalytics.share_type).all()
            
            # Calculate completion rates
            completion_rates = {}
            for share_type in [e.value for e in ShareType]:
                clicks = sum(e.count for e in events_by_type 
                           if e.event_type == 'button_clicked' and e.share_type == share_type)
                completions = sum(s.count for s in shares_by_type if s.share_type == share_type)
                
                if clicks > 0:
                    completion_rates[share_type] = (completions / clicks) * 100
                else:
                    completion_rates[share_type] = 0
            
            return {
                'period_days': days,
                'shares_by_type': {s.share_type: {'count': s.count, 'total_xp': s.total_xp} 
                                 for s in shares_by_type},
                'events_by_type': {f"{e.event_type}_{e.share_type}": e.count for e in events_by_type},
                'completion_rates': completion_rates,
                'total_shares': sum(s.count for s in shares_by_type),
                'total_xp_distributed': sum(s.total_xp for s in shares_by_type)
            }
            
        except Exception as e:
            current_app.logger.error(f"Error getting share analytics summary: {str(e)}")
            return {'error': 'Failed to get analytics summary'}

# Configuration management functions for admin use

def get_share_config():
    """Get all share-to-earn configuration settings"""
    try:
        configs = SystemConfiguration.query.filter_by(category='share_to_earn').all()
        return {config.config_key: config.to_dict() for config in configs}
        
    except Exception as e:
        current_app.logger.error(f"Error getting share config: {str(e)}")
        return {'error': 'Failed to get configuration'}

def update_share_config(config_data):
    """Update share-to-earn configuration settings"""
    try:
        updated_configs = []
        
        for key, value in config_data.items():
            # Determine config type based on key
            if 'xp_reward' in key or 'duration_hours' in key:
                config_type = 'integer'
            elif 'enabled' in key:
                config_type = 'boolean'
            else:
                config_type = 'string'
            
            config = SystemConfiguration.set_config(
                key, value, config_type, category='share_to_earn'
            )
            updated_configs.append(config.to_dict())
        
        return {
            'success': True,
            'updated_configs': updated_configs,
            'message': f'Updated {len(updated_configs)} configuration settings'
        }
        
    except Exception as e:
        current_app.logger.error(f"Error updating share config: {str(e)}")
        return {'error': 'Failed to update configuration'}
