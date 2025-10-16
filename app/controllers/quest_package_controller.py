from flask import current_app, g
from app.models import db, QuestPackage, Business, User, Admin, StripeTransaction
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class QuestPackageController:
    """Controller for managing quest credit packages (Super Admin only)"""
    
    @staticmethod
    def get_all_packages(include_inactive=False):
        """Get all quest packages for super admin management"""
        try:
            query = QuestPackage.query
            
            if not include_inactive:
                query = query.filter_by(is_active=True)
            
            packages = query.order_by(QuestPackage.display_order, QuestPackage.created_at).all()
            
            return {
                "packages": [package.to_dict() for package in packages],
                "total_count": len(packages)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_QUEST_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest packages"}, 500
    
    @staticmethod
    def get_active_packages():
        """Get active quest packages for business purchase view"""
        try:
            packages = QuestPackage.query.filter_by(is_active=True).order_by(
                QuestPackage.display_order, 
                QuestPackage.created_at
            ).all()
            
            return {
                "packages": [package.to_dict() for package in packages]
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ACTIVE_QUEST_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest packages"}, 500
    
    @staticmethod
    def get_package_by_id(package_id):
        """Get specific quest package by ID"""
        try:
            package = QuestPackage.query.get(package_id)
            if not package:
                return {"error": "Quest package not found"}, 404
                
            return {"package": package.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_QUEST_PACKAGE_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve quest package"}, 500
    
    @staticmethod
    def create_package(package_data):
        """Create new quest package (Super Admin only)"""
        try:
            # Validate required fields
            required_fields = ['name', 'quest_credits', 'price']
            for field in required_fields:
                if field not in package_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Validate numeric fields
            try:
                quest_credits = int(package_data['quest_credits'])
                price = int(package_data['price'])
                bonus_credits = int(package_data.get('bonus_credits', 0))
                display_order = int(package_data.get('display_order', 0))
                
                if quest_credits <= 0:
                    return {"error": "Quest credits must be positive"}, 400
                if price < 0:
                    return {"error": "Price cannot be negative"}, 400
                if bonus_credits < 0:
                    return {"error": "Bonus credits cannot be negative"}, 400
                    
            except (ValueError, TypeError):
                return {"error": "Invalid numeric values"}, 400
            
            # Create new package
            package = QuestPackage(
                name=package_data['name'],
                description=package_data.get('description'),
                quest_credits=quest_credits,
                price=price,
                bonus_credits=bonus_credits,
                is_popular=package_data.get('is_popular', False),
                is_active=package_data.get('is_active', True),
                display_order=display_order
            )
            
            db.session.add(package)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_QUEST_PACKAGE] Created package: {package.name} (ID: {package.id})")
            
            return {"package": package.to_dict(), "message": "Quest package created successfully"}, 201
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "Package name already exists"}, 409
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_QUEST_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to create quest package"}, 500
    
    @staticmethod
    def update_package(package_id, package_data):
        """Update existing quest package (Super Admin only)"""
        try:
            package = QuestPackage.query.get(package_id)
            if not package:
                return {"error": "Quest package not found"}, 404
            
            # Update fields if provided
            if 'name' in package_data:
                package.name = package_data['name']
            if 'description' in package_data:
                package.description = package_data['description']
            if 'quest_credits' in package_data:
                try:
                    quest_credits = int(package_data['quest_credits'])
                    if quest_credits <= 0:
                        return {"error": "Quest credits must be positive"}, 400
                    package.quest_credits = quest_credits
                except (ValueError, TypeError):
                    return {"error": "Invalid quest credits value"}, 400
            
            if 'price' in package_data:
                try:
                    price = int(package_data['price'])
                    if price < 0:
                        return {"error": "Price cannot be negative"}, 400
                    package.price = price
                except (ValueError, TypeError):
                    return {"error": "Invalid price value"}, 400
            
            if 'bonus_credits' in package_data:
                try:
                    bonus_credits = int(package_data['bonus_credits'])
                    if bonus_credits < 0:
                        return {"error": "Bonus credits cannot be negative"}, 400
                    package.bonus_credits = bonus_credits
                except (ValueError, TypeError):
                    return {"error": "Invalid bonus credits value"}, 400
            
            if 'is_popular' in package_data:
                package.is_popular = bool(package_data['is_popular'])
            if 'is_active' in package_data:
                package.is_active = bool(package_data['is_active'])
            if 'display_order' in package_data:
                try:
                    package.display_order = int(package_data['display_order'])
                except (ValueError, TypeError):
                    return {"error": "Invalid display order value"}, 400
            
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_QUEST_PACKAGE] Updated package: {package.name} (ID: {package.id})")
            
            return {"package": package.to_dict(), "message": "Quest package updated successfully"}, 200
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "Package name already exists"}, 409
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_QUEST_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to update quest package"}, 500
    
    @staticmethod
    def delete_package(package_id):
        """Delete quest package (Super Admin only)"""
        try:
            package = QuestPackage.query.get(package_id)
            if not package:
                return {"error": "Quest package not found"}, 404
            
            # Soft delete by marking as inactive
            package.is_active = False
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_QUEST_PACKAGE] Deactivated package: {package.name} (ID: {package.id})")
            
            return {"message": "Quest package deactivated successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_QUEST_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to delete quest package"}, 500
    
    @staticmethod
    def purchase_package(business_id, package_id, stripe_charge_id, amount_paid):
        """Process quest package purchase for business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            package = QuestPackage.query.get(package_id)
            if not package or not package.is_active:
                return {"error": "Quest package not found or inactive"}, 404
            
            # Verify purchase amount matches package price
            if amount_paid != package.price:
                return {"error": "Payment amount does not match package price"}, 400
            
            # Calculate total credits including bonus
            total_credits = package.get_total_credits()
            
            # Update business quest credits
            business.quest_credits_purchased += total_credits
            
            # Create transaction record
            transaction = StripeTransaction(
                business_id=business_id,
                user_id=g.user.id if hasattr(g, 'user') and g.user else None,
                stripe_charge_id=stripe_charge_id,
                amount_paid=amount_paid,
                quest_credits_purchased=total_credits,  # New field to add to StripeTransaction
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            current_app.logger.info(f"[PURCHASE_QUEST_PACKAGE] Business {business_id} purchased {total_credits} quest credits for ${amount_paid/100}")
            
            return {
                "message": "Quest package purchased successfully",
                "credits_added": total_credits,
                "new_balance": business.quest_credits_purchased
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PURCHASE_QUEST_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to process quest package purchase"}, 500 