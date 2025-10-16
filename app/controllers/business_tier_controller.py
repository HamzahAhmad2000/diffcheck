from flask import current_app
from app.models import db, BusinessTier, Business
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class BusinessTierController:
    """Controller for managing business subscription tiers"""
    
    @staticmethod
    def get_all_tiers(include_inactive=False):
        """Get all business tiers, optionally including inactive ones"""
        try:
            query = BusinessTier.query
            if not include_inactive:
                query = query.filter_by(is_active=True)
            
            tiers = query.order_by(BusinessTier.display_order.asc(), BusinessTier.price.asc()).all()
            
            return {
                "tiers": [tier.to_dict() for tier in tiers],
                "total_count": len(tiers)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_TIERS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business tiers"}, 500
    
    @staticmethod
    def get_tier_by_id(tier_id):
        """Get a specific business tier by ID"""
        try:
            tier = BusinessTier.query.get(tier_id)
            if not tier:
                return {"error": "Business tier not found"}, 404
                
            return {"tier": tier.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_TIER_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business tier"}, 500
    
    @staticmethod
    def create_tier(tier_data):
        """Create a new business tier"""
        try:
            # Validate required fields
            required_fields = ['name', 'price', 'monthly_response_limit', 'monthly_quest_limit', 'admin_seat_limit']
            for field in required_fields:
                if field not in tier_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Check for duplicate name
            existing_tier = BusinessTier.query.filter_by(name=tier_data['name']).first()
            if existing_tier:
                return {"error": "A tier with this name already exists"}, 400
            
            # Create new tier
            tier = BusinessTier(
                name=tier_data['name'],
                description=tier_data.get('description'),
                price=int(tier_data['price']),
                monthly_response_limit=int(tier_data['monthly_response_limit']),
                monthly_quest_limit=int(tier_data['monthly_quest_limit']),
                admin_seat_limit=int(tier_data['admin_seat_limit']),
                ai_points_included=int(tier_data.get('ai_points_included', 0)),
                can_use_ai_builder=tier_data.get('can_use_ai_builder', True),
                can_use_ai_insights=tier_data.get('can_use_ai_insights', True),
                can_create_surveys=tier_data.get('can_create_surveys', True),
                can_generate_responses=tier_data.get('can_generate_responses', True),
                can_request_featured=tier_data.get('can_request_featured', False),
                additional_features=tier_data.get('additional_features'),
                display_order=int(tier_data.get('display_order', 0)),
                is_active=tier_data.get('is_active', True)
            )
            
            db.session.add(tier)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_TIER] Created new business tier: {tier.name} (ID: {tier.id})")
            
            return {
                "message": "Business tier created successfully",
                "tier": tier.to_dict()
            }, 201
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_TIER] Integrity error: {e}", exc_info=True)
            return {"error": "A tier with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_TIER] Error: {e}", exc_info=True)
            return {"error": "Failed to create business tier"}, 500
    
    @staticmethod
    def update_tier(tier_id, tier_data):
        """Update an existing business tier"""
        try:
            tier = BusinessTier.query.get(tier_id)
            if not tier:
                return {"error": "Business tier not found"}, 404
            
            # Check for duplicate name if name is being changed
            if 'name' in tier_data and tier_data['name'] != tier.name:
                existing_tier = BusinessTier.query.filter_by(name=tier_data['name']).first()
                if existing_tier:
                    return {"error": "A tier with this name already exists"}, 400
            
            # Update fields
            updatable_fields = [
                'name', 'description', 'price', 'monthly_response_limit', 
                'monthly_quest_limit', 'admin_seat_limit', 'ai_points_included',
                'can_use_ai_builder', 'can_use_ai_insights', 'can_create_surveys',
                'can_generate_responses', 'can_request_featured', 'additional_features',
                'display_order', 'is_active'
            ]
            
            for field in updatable_fields:
                if field in tier_data:
                    if field in ['price', 'monthly_response_limit', 'monthly_quest_limit', 
                               'admin_seat_limit', 'ai_points_included', 'display_order']:
                        setattr(tier, field, int(tier_data[field]))
                    else:
                        setattr(tier, field, tier_data[field])
            
            tier.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_TIER] Updated business tier: {tier.name} (ID: {tier.id})")
            
            return {
                "message": "Business tier updated successfully",
                "tier": tier.to_dict()
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_TIER] Integrity error: {e}", exc_info=True)
            return {"error": "A tier with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_TIER] Error: {e}", exc_info=True)
            return {"error": "Failed to update business tier"}, 500
    
    @staticmethod
    def delete_tier(tier_id):
        """Delete a business tier (soft delete by marking inactive)"""
        try:
            tier = BusinessTier.query.get(tier_id)
            if not tier:
                return {"error": "Business tier not found"}, 404
            
            # Check if any businesses are using this tier
            businesses_count = Business.query.filter_by(tier_id=tier_id).count()
            if businesses_count > 0:
                return {
                    "error": f"Cannot delete tier. {businesses_count} business(es) are currently using this tier. Please reassign them to another tier first."
                }, 400
            
            # Soft delete by marking inactive
            tier.is_active = False
            tier.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_TIER] Soft deleted business tier: {tier.name} (ID: {tier.id})")
            
            return {"message": "Business tier deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_TIER] Error: {e}", exc_info=True)
            return {"error": "Failed to delete business tier"}, 500
    
    @staticmethod
    def get_tier_stats():
        """Get statistics about tier usage"""
        try:
            # Get tier usage statistics
            tier_stats = db.session.query(
                BusinessTier.id,
                BusinessTier.name,
                db.func.count(Business.id).label('business_count')
            ).outerjoin(Business, Business.tier_id == BusinessTier.id)\
             .filter(BusinessTier.is_active == True)\
             .group_by(BusinessTier.id, BusinessTier.name)\
             .order_by(BusinessTier.display_order.asc()).all()
            
            stats = []
            total_businesses = 0
            
            for tier_id, tier_name, business_count in tier_stats:
                stats.append({
                    "tier_id": tier_id,
                    "tier_name": tier_name,
                    "business_count": business_count
                })
                total_businesses += business_count
            
            return {
                "tier_statistics": stats,
                "total_businesses": total_businesses
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_TIER_STATS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve tier statistics"}, 500

    @staticmethod
    def purchase_quest_credits(business_id, amount, payment_method=None):
        """Purchase additional quest credits for a business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            try:
                credits_to_add = int(amount)
                if credits_to_add <= 0:
                    return {"error": "Invalid credit amount"}, 400
            except (ValueError, TypeError):
                return {"error": "Credit amount must be a valid number"}, 400
            
            # Update business quest credits
            current_credits = business.quest_credits_purchased or 0
            business.quest_credits_purchased = current_credits + credits_to_add
            
            # Create activity log for credit purchase
            from app.controllers.activity_controller import ActivityController
            from app.models import ActivityType
            
            ActivityController.create_activity_log(
                business_id=business_id,
                activity_type=ActivityType.QUEST_CREDITS_PURCHASED,
                title=f"Quest Credits Purchased",
                description=f"Purchased {credits_to_add} additional quest credits",
                related_item_id=None,
                user_id=None,
                make_public_by_default=False
            )
            
            db.session.commit()
            
            current_app.logger.info(f"[PURCHASE_QUEST_CREDITS] Business {business_id} purchased {credits_to_add} quest credits")
            
            return {
                "message": f"Successfully purchased {credits_to_add} quest credits",
                "credits_added": credits_to_add,
                "total_credits": business.quest_credits_purchased,
                "business_id": business_id
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PURCHASE_QUEST_CREDITS] Error: {e}", exc_info=True)
            return {"error": "Failed to purchase quest credits"}, 500 