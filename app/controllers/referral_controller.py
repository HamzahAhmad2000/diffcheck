"""
Referral Controller
Handles user referral system and affiliate link management
"""

from ..models import db, User, ActivityType
from ..models.referral_models import ReferralSettings, ReferralLink, Referral, AffiliateLink, AffiliateConversion
from .xp_badge_controller import award_xp
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReferralController:
    """Controller for managing the referral and affiliate system."""
    
    @staticmethod
    def get_or_create_referral_settings():
        """
        Get or create default referral settings.
        
        Returns:
            ReferralSettings: The system referral settings
        """
        try:
            settings = ReferralSettings.query.first()
            if not settings:
                settings = ReferralSettings(
                    user_reward_xp=50,
                    new_user_bonus_xp=50,
                    user_xp_cap=5000,
                    is_active=True
                )
                db.session.add(settings)
                db.session.commit()
                logger.info("Created default referral settings")
            return settings
        except Exception as e:
            logger.error(f"Error getting/creating referral settings: {e}")
            return None

    @staticmethod
    def get_or_create_user_link(user):
        """
        Get or create a referral link for a user.

        Args:
            user (User): The user to get/create a link for

        Returns:
            dict: Contains link URL, referral count, and XP earned
        """
        try:
            # Check if user already has a referral link
            # Handle case where multiple links exist (shouldn't happen but can due to data issues)
            link = user.referral_link
            if not link or not isinstance(link, ReferralLink):
                # Query for existing link or create new one
                existing_link = ReferralLink.query.filter_by(user_id=user.id).first()
                if existing_link:
                    link = existing_link
                else:
                    link = ReferralLink(user_id=user.id)
                    db.session.add(link)
                    db.session.commit()
                    logger.info(f"Created referral link for user {user.id}")

            # Ensure we have a valid ReferralLink object
            if not isinstance(link, ReferralLink):
                logger.error(f"Invalid link type for user {user.id}: {type(link)}")
                return {"error": "Invalid referral link data"}

            # Calculate stats
            total_referrals = len(link.referrals) if hasattr(link, 'referrals') else 0
            settings = ReferralController.get_or_create_referral_settings()
            xp_earned = 0

            if settings:
                # Calculate actual XP earned (sum from referral records, respecting cap)
                xp_earned = sum(referral.xp_awarded_to_referrer for referral in link.referrals) if hasattr(link, 'referrals') else 0

            # Construct full URL - using localhost for testing
            base_url = 'http://localhost:3000'  # Using localhost for testing
            full_link = f"{base_url}/join?ref={link.code}"

            return {
                "link": full_link,
                "code": link.code,
                "referral_count": total_referrals,
                "xp_earned": xp_earned,
                "is_active": link.is_active,
                "created_at": link.created_at.isoformat() if link.created_at else None
            }

        except Exception as e:
            logger.error(f"Error getting/creating user referral link: {e}")
            return {"error": "Failed to get referral link"}

    @staticmethod
    def get_user_referrals(user, page=1, per_page=20):
        """
        Get a user's referral history with pagination.
        
        Args:
            user (User): The user to get referrals for
            page (int): Page number
            per_page (int): Items per page
            
        Returns:
            dict: Paginated referral data
        """
        try:
            link = user.referral_link
            if not link or not isinstance(link, ReferralLink):
                # Try to get link directly from database
                link = ReferralLink.query.filter_by(user_id=user.id).first()
                if not link:
                    return {
                        "referrals": [],
                        "total": 0,
                        "page": page,
                        "per_page": per_page,
                        "total_pages": 0
                    }

            # Get paginated referrals
            referrals_query = Referral.query.filter_by(
                referral_link_id=link.id
            ).order_by(Referral.created_at.desc())
            
            paginated = referrals_query.paginate(
                page=page, per_page=per_page, error_out=False
            )

            return {
                "referrals": [referral.to_dict() for referral in paginated.items],
                "total": paginated.total,
                "page": page,
                "per_page": per_page,
                "total_pages": paginated.pages
            }
            
        except Exception as e:
            logger.error(f"Error getting user referrals: {e}")
            return {"error": "Failed to get referrals"}

    @staticmethod
    def process_signup(new_user, referral_code):
        """
        Process a referral signup and award XP to both users.
        
        Args:
            new_user (User): The newly registered user
            referral_code (str): The referral code used
            
        Returns:
            dict: Success status and referrer information
        """
        try:
            # Find the referral link
            link = ReferralLink.query.filter_by(code=referral_code, is_active=True).first()
            if not link:
                logger.warning(f"Invalid referral code used: {referral_code}")
                return {"error": "Invalid or inactive referral code"}

            # Check if this user was already referred
            existing_referral = Referral.query.filter_by(referred_user_id=new_user.id).first()
            if existing_referral:
                logger.warning(f"User {new_user.id} already has a referral record")
                return {"error": "User has already been referred"}

            referrer = link.user
            settings = ReferralController.get_or_create_referral_settings()
            
            if not settings or not settings.is_active:
                logger.info("Referral system is not active")
                return {"error": "Referral system is currently inactive"}

            # Calculate current XP earned by referrer from referrals
            current_referral_xp = sum(r.xp_awarded_to_referrer for r in link.referrals)
            xp_awarded_to_referrer = 0
            
            # Check if referrer has reached their XP cap
            if current_referral_xp < settings.user_xp_cap:
                # Calculate how much XP we can still award
                remaining_cap = settings.user_xp_cap - current_referral_xp
                xp_awarded_to_referrer = min(settings.user_reward_xp, remaining_cap)
                
                if xp_awarded_to_referrer > 0:
                    # Award XP to referrer
                    award_xp(referrer.id, xp_awarded_to_referrer, ActivityType.USER_REFERRAL.value)
                    logger.info(f"Awarded {xp_awarded_to_referrer} XP to referrer {referrer.id}")

            # Always award bonus XP to new user
            xp_awarded_to_referred = settings.new_user_bonus_xp
            award_xp(new_user.id, xp_awarded_to_referred, ActivityType.REFERRAL_BONUS.value)
            logger.info(f"Awarded {xp_awarded_to_referred} XP to new user {new_user.id}")

            # Create the referral tracking record
            referral_record = Referral(
                referral_link_id=link.id,
                referred_user_id=new_user.id,
                xp_awarded_to_referrer=xp_awarded_to_referrer,
                xp_awarded_to_referred=xp_awarded_to_referred
            )
            db.session.add(referral_record)
            db.session.commit()
            
            logger.info(f"Created referral record: {new_user.id} referred by {referrer.id}")
            
            return {
                "success": True,
                "referrer_id": referrer.id,
                "referrer_name": referrer.name,
                "xp_awarded_to_referrer": xp_awarded_to_referrer,
                "xp_awarded_to_referred": xp_awarded_to_referred,
                "referrer_capped": xp_awarded_to_referrer < settings.user_reward_xp
            }
            
        except Exception as e:
            logger.error(f"Error processing referral signup: {e}")
            db.session.rollback()
            return {"error": "Failed to process referral"}

    @staticmethod
    def process_affiliate_signup(new_user, affiliate_code):
        """
        Process an affiliate signup and award XP/commission.
        
        Args:
            new_user (User): The newly registered user
            affiliate_code (str): The affiliate code used
            
        Returns:
            dict: Success status and affiliate information
        """
        try:
            # Find the affiliate link
            affiliate_link = AffiliateLink.query.filter_by(
                code=affiliate_code, 
                is_active=True
            ).first()
            
            if not affiliate_link:
                logger.warning(f"Invalid affiliate code used: {affiliate_code}")
                return {"error": "Invalid or inactive affiliate code"}

            # Check if affiliate link has expired
            if affiliate_link.is_expired:
                logger.warning(f"Expired affiliate code used: {affiliate_code}")
                return {"error": "Affiliate code has expired"}

            # Check if this user was already converted
            existing_conversion = AffiliateConversion.query.filter_by(
                converted_user_id=new_user.id
            ).first()
            if existing_conversion:
                logger.warning(f"User {new_user.id} already has an affiliate conversion record")
                return {"error": "User has already been converted through affiliate"}

            settings = ReferralController.get_or_create_referral_settings()
            if not settings or not settings.is_active:
                logger.info("Referral system is not active")
                return {"error": "Affiliate system is currently inactive"}

            # Determine XP rewards (use custom amounts if set, otherwise defaults)
            affiliate_xp = (affiliate_link.custom_user_reward_xp 
                          if affiliate_link.custom_user_reward_xp is not None 
                          else settings.user_reward_xp)
            
            user_bonus_xp = (affiliate_link.custom_new_user_bonus_xp 
                           if affiliate_link.custom_new_user_bonus_xp is not None 
                           else settings.new_user_bonus_xp)

            # Determine who receives the XP (assigned user or link owner)
            xp_recipient_id = affiliate_link.assigned_xp_user_id or affiliate_link.user_id
            
            # Award XP to designated user
            if xp_recipient_id:
                award_xp(xp_recipient_id, affiliate_xp, ActivityType.AFFILIATE_CONVERSION.value)
                logger.info(f"Awarded {affiliate_xp} XP to user {xp_recipient_id}")

            # Award bonus XP to new user
            award_xp(new_user.id, user_bonus_xp, ActivityType.AFFILIATE_BONUS.value)
            logger.info(f"Awarded {user_bonus_xp} XP to new user {new_user.id}")

            # Assign tag to new user if specified
            if affiliate_link.assigned_tag:
                # Get or create the user's selected_tags list
                if not new_user.selected_tags:
                    new_user.selected_tags = []
                
                # Add the tag if it's not already present
                if affiliate_link.assigned_tag not in new_user.selected_tags:
                    new_user.selected_tags.append(affiliate_link.assigned_tag)
                    logger.info(f"Assigned tag '{affiliate_link.assigned_tag}' to user {new_user.id}")

            # Create the affiliate conversion record
            conversion_record = AffiliateConversion(
                affiliate_link_id=affiliate_link.id,
                converted_user_id=new_user.id,
                xp_awarded_to_affiliate=affiliate_xp if xp_recipient_id else 0,
                xp_awarded_to_user=user_bonus_xp,
                commission_earned=0.0  # For future implementation
            )
            db.session.add(conversion_record)
            db.session.commit()
            
            logger.info(f"Created affiliate conversion: {new_user.id} via {affiliate_link.name}")
            
            return {
                "success": True,
                "affiliate_name": affiliate_link.name,
                "affiliate_id": affiliate_link.user_id,
                "business_id": affiliate_link.business_id,
                "assigned_tag": affiliate_link.assigned_tag,
                "xp_awarded_to_affiliate": affiliate_xp if xp_recipient_id else 0,
                "xp_awarded_to_user": user_bonus_xp
            }
            
        except Exception as e:
            logger.error(f"Error processing affiliate signup: {e}")
            db.session.rollback()
            return {"error": "Failed to process affiliate conversion"}

    @staticmethod
    def validate_referral_code(code):
        """
        Validate a referral code without processing signup.
        
        Args:
            code (str): The referral code to validate
            
        Returns:
            dict: Validation result with referrer info if valid
        """
        try:
            link = ReferralLink.query.filter_by(code=code, is_active=True).first()
            if not link:
                return {"valid": False, "error": "Invalid referral code"}

            return {
                "valid": True,
                "referrer_name": link.user.name,
                "referrer_id": link.user.id
            }
            
        except Exception as e:
            logger.error(f"Error validating referral code: {e}")
            return {"valid": False, "error": "Validation failed"}

    @staticmethod
    def validate_affiliate_code(code):
        """
        Validate an affiliate code without processing signup.
        
        Args:
            code (str): The affiliate code to validate
            
        Returns:
            dict: Validation result with affiliate info if valid
        """
        try:
            affiliate_link = AffiliateLink.query.filter_by(code=code, is_active=True).first()
            if not affiliate_link:
                return {"valid": False, "error": "Invalid affiliate code"}

            if affiliate_link.is_expired:
                return {"valid": False, "error": "Affiliate code has expired"}

            return {
                "valid": True,
                "affiliate_name": affiliate_link.name,
                "affiliate_id": affiliate_link.user_id,
                "business_id": affiliate_link.business_id
            }
            
        except Exception as e:
            logger.error(f"Error validating affiliate code: {e}")
            return {"valid": False, "error": "Validation failed"}

    @staticmethod
    def get_referral_stats(user):
        """
        Get comprehensive referral statistics for a user.

        Args:
            user (User): The user to get stats for

        Returns:
            dict: Comprehensive referral statistics
        """
        try:
            link = user.referral_link
            if not link or not isinstance(link, ReferralLink):
                # Try to get link directly from database
                link = ReferralLink.query.filter_by(user_id=user.id).first()
                if not link:
                    return {
                        "total_referrals": 0,
                        "total_xp_earned": 0,
                        "referrals_this_month": 0,
                        "xp_this_month": 0,
                        "is_capped": False,
                        "remaining_cap": 0
                    }

            settings = ReferralController.get_or_create_referral_settings()

            # Total stats
            total_referrals = len(link.referrals) if hasattr(link, 'referrals') else 0
            total_xp_earned = sum(r.xp_awarded_to_referrer for r in link.referrals) if hasattr(link, 'referrals') else 0

            # This month stats
            from datetime import date
            first_day_of_month = date.today().replace(day=1)
            monthly_referrals = [r for r in link.referrals
                               if hasattr(link, 'referrals') and r.created_at.date() >= first_day_of_month]
            referrals_this_month = len(monthly_referrals)
            xp_this_month = sum(r.xp_awarded_to_referrer for r in monthly_referrals)
            
            # Cap information
            is_capped = False
            remaining_cap = 0
            if settings:
                is_capped = total_xp_earned >= settings.user_xp_cap
                remaining_cap = max(0, settings.user_xp_cap - total_xp_earned)

            return {
                "total_referrals": total_referrals,
                "total_xp_earned": total_xp_earned,
                "referrals_this_month": referrals_this_month,
                "xp_this_month": xp_this_month,
                "is_capped": is_capped,
                "remaining_cap": remaining_cap,
                "user_xp_cap": settings.user_xp_cap if settings else 0,
                "user_reward_xp": settings.user_reward_xp if settings else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting referral stats: {e}")
            return {"error": "Failed to get referral statistics"}

# Admin functions for managing the referral system

class ReferralAdminController:
    """Controller for admin management of the referral system."""
    
    @staticmethod
    def update_referral_settings(settings_data):
        """
        Update referral system settings (admin only).
        
        Args:
            settings_data (dict): New settings values
            
        Returns:
            dict: Updated settings or error
        """
        try:
            settings = ReferralSettings.query.first()
            if not settings:
                settings = ReferralSettings()
                db.session.add(settings)

            # Update fields if provided
            if 'user_reward_xp' in settings_data:
                settings.user_reward_xp = settings_data['user_reward_xp']
            if 'new_user_bonus_xp' in settings_data:
                settings.new_user_bonus_xp = settings_data['new_user_bonus_xp']
            if 'user_xp_cap' in settings_data:
                settings.user_xp_cap = settings_data['user_xp_cap']
            if 'is_active' in settings_data:
                settings.is_active = settings_data['is_active']

            settings.updated_at = datetime.utcnow()
            db.session.commit()
            
            logger.info("Updated referral settings")
            return {"success": True, "settings": settings.to_dict()}
            
        except Exception as e:
            logger.error(f"Error updating referral settings: {e}")
            db.session.rollback()
            return {"error": "Failed to update settings"}

    @staticmethod
    def get_referral_analytics(date_range=None):
        """
        Get platform-wide referral analytics (admin only).
        
        Args:
            date_range (dict): Optional date range filter
            
        Returns:
            dict: Comprehensive analytics data
        """
        try:
            # Basic queries
            total_links = ReferralLink.query.filter_by(is_active=True).count()
            total_referrals = Referral.query.count()
            
            # Get settings
            settings = ReferralSettings.query.first()
            
            # Calculate total XP awarded
            total_xp_awarded = db.session.query(
                db.func.sum(Referral.xp_awarded_to_referrer + Referral.xp_awarded_to_referred)
            ).scalar() or 0

            # Top referrers
            top_referrers = db.session.query(
                ReferralLink.user_id,
                User.name,
                User.email,
                db.func.count(Referral.id).label('referral_count'),
                db.func.sum(Referral.xp_awarded_to_referrer).label('xp_earned')
            ).join(User, ReferralLink.user_id == User.id)\
             .join(Referral, ReferralLink.id == Referral.referral_link_id)\
             .group_by(ReferralLink.user_id, User.name, User.email)\
             .order_by(db.text('referral_count DESC'))\
             .limit(10).all()

            return {
                "total_active_links": total_links,
                "total_referrals": total_referrals,
                "total_xp_awarded": total_xp_awarded,
                "current_settings": settings.to_dict() if settings else None,
                "top_referrers": [{
                    "user_id": r.user_id,
                    "name": r.name,
                    "email": r.email,
                    "referral_count": r.referral_count,
                    "xp_earned": r.xp_earned or 0
                } for r in top_referrers]
            }
            
        except Exception as e:
            logger.error(f"Error getting referral analytics: {e}")
            return {"error": "Failed to get analytics"}

    @staticmethod
    def get_tag_analytics():
        """
        Get analytics for tags assigned through affiliate links (admin only).
        
        Returns:
            dict: Tag analytics data
        """
        try:
            # Get all affiliate links with assigned tags
            affiliate_links = AffiliateLink.query.filter(
                AffiliateLink.assigned_tag.isnot(None)
            ).all()
            
            # Build tag statistics
            tag_stats = {}
            for link in affiliate_links:
                tag = link.assigned_tag
                if tag not in tag_stats:
                    tag_stats[tag] = {
                        'tag': tag,
                        'total_conversions': 0,
                        'total_xp_awarded': 0,
                        'affiliate_links': []
                    }
                
                # Count conversions for this link
                conversions = len(link.conversions)
                xp_awarded = sum(c.xp_awarded_to_user for c in link.conversions)
                
                tag_stats[tag]['total_conversions'] += conversions
                tag_stats[tag]['total_xp_awarded'] += xp_awarded
                tag_stats[tag]['affiliate_links'].append({
                    'name': link.name,
                    'code': link.code,
                    'conversions': conversions
                })
            
            # Count users with each tag
            for tag in tag_stats.keys():
                user_count = User.query.filter(
                    User.selected_tags.contains([tag])
                ).count()
                tag_stats[tag]['user_count'] = user_count
            
            # Convert to list and sort by user count
            tag_list = list(tag_stats.values())
            tag_list.sort(key=lambda x: x.get('user_count', 0), reverse=True)
            
            return {
                "tags": tag_list,
                "total_tags": len(tag_list)
            }
            
        except Exception as e:
            logger.error(f"Error getting tag analytics: {e}")
            return {"error": "Failed to get tag analytics"}

    @staticmethod
    def create_affiliate_link(link_data):
        """
        Create a new affiliate link (admin only).
        
        Args:
            link_data (dict): Affiliate link configuration
            
        Returns:
            dict: Created link or error
        """
        try:
            # Parse expires_at if provided as string
            expires_at = None
            if link_data.get('expires_at'):
                if isinstance(link_data['expires_at'], str):
                    from datetime import datetime
                    expires_at = datetime.fromisoformat(link_data['expires_at'].replace('Z', '+00:00'))
                else:
                    expires_at = link_data['expires_at']
            
            affiliate_link = AffiliateLink(
                business_id=link_data.get('business_id'),
                user_id=link_data.get('user_id'),
                name=link_data['name'],
                description=link_data.get('description'),
                custom_user_reward_xp=link_data.get('custom_user_reward_xp'),
                custom_new_user_bonus_xp=link_data.get('custom_new_user_bonus_xp'),
                assigned_tag=link_data.get('assigned_tag'),
                assigned_xp_user_id=link_data.get('assigned_xp_user_id'),
                commission_rate=link_data.get('commission_rate', 0.0),
                expires_at=expires_at
            )
            
            db.session.add(affiliate_link)
            db.session.commit()
            
            logger.info(f"Created affiliate link: {affiliate_link.name}")
            return {"success": True, "affiliate_link": affiliate_link.to_dict()}
            
        except Exception as e:
            logger.error(f"Error creating affiliate link: {e}")
            db.session.rollback()
            return {"error": "Failed to create affiliate link"}

    @staticmethod
    def list_affiliate_links(page=1, per_page=20, search=None, status=None):
        """
        List, search, and filter affiliate links (admin only).
        
        Args:
            page (int): Page number
            per_page (int): Items per page
            search (str): Search term for name or code
            status (str): Filter by status ('active', 'inactive', 'expired')
            
        Returns:
            dict: Paginated affiliate links data
        """
        try:
            query = AffiliateLink.query.order_by(AffiliateLink.created_at.desc())

            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    db.or_(
                        AffiliateLink.name.ilike(search_term),
                        AffiliateLink.code.ilike(search_term)
                    )
                )

            if status:
                if status == 'active':
                    query = query.filter(AffiliateLink.is_active,
                                         db.or_(AffiliateLink.expires_at.is_(None),
                                                AffiliateLink.expires_at > datetime.utcnow()))
                elif status == 'inactive':
                    query = query.filter(~AffiliateLink.is_active)
                elif status == 'expired':
                    query = query.filter(AffiliateLink.is_active, 
                                         AffiliateLink.expires_at <= datetime.utcnow())

            paginated = query.paginate(page=page, per_page=per_page, error_out=False)
            
            # Enhance each link with additional data
            enhanced_links = []
            for link in paginated.items:
                link_dict = link.to_dict()
                
                # Add owner information
                if link.user_id:
                    user = User.query.get(link.user_id)
                    link_dict['owner'] = f"{user.name} (User)" if user else "Unknown User"
                elif link.business_id:
                    from ..models import Business
                    business = Business.query.get(link.business_id)
                    link_dict['owner'] = f"{business.name} (Business)" if business else "Unknown Business"
                else:
                    link_dict['owner'] = "No Owner"
                
                enhanced_links.append(link_dict)
            
            return {
                "links": enhanced_links,
                "total": paginated.total,
                "page": page,
                "per_page": per_page,
                "total_pages": paginated.pages
            }
        except Exception as e:
            logger.error(f"Error listing affiliate links: {e}")
            return {"error": "Failed to list affiliate links"}

    @staticmethod
    def update_affiliate_link(link_id, update_data):
        """
        Update an existing affiliate link (admin only).
        
        Args:
            link_id (int): The affiliate link ID
            update_data (dict): Fields to update
            
        Returns:
            dict: Updated link or error
        """
        try:
            link = AffiliateLink.query.get(link_id)
            if not link:
                return {"error": "Affiliate link not found"}

            # Parse expires_at if provided as string
            if 'expires_at' in update_data and update_data['expires_at']:
                if isinstance(update_data['expires_at'], str):
                    from datetime import datetime
                    update_data['expires_at'] = datetime.fromisoformat(update_data['expires_at'].replace('Z', '+00:00'))

            # Update fields
            for key, value in update_data.items():
                if hasattr(link, key):
                    setattr(link, key, value)
            
            link.updated_at = datetime.utcnow()
            db.session.commit()
            
            logger.info(f"Updated affiliate link {link_id}")
            return {"success": True, "affiliate_link": link.to_dict()}
        except Exception as e:
            logger.error(f"Error updating affiliate link {link_id}: {e}")
            db.session.rollback()
            return {"error": "Failed to update affiliate link"}

    @staticmethod
    def delete_affiliate_link(link_id):
        """
        Delete an affiliate link (admin only).
        
        Args:
            link_id (int): The affiliate link ID
            
        Returns:
            dict: Success message or error
        """
        try:
            link = AffiliateLink.query.get(link_id)
            if not link:
                return {"error": "Affiliate link not found"}

            db.session.delete(link)
            db.session.commit()
            
            logger.info(f"Deleted affiliate link {link_id}")
            return {"success": True, "message": "Affiliate link deleted"}
        except Exception as e:
            logger.error(f"Error deleting affiliate link {link_id}: {e}")
            db.session.rollback()
            return {"error": "Failed to delete affiliate link"}



