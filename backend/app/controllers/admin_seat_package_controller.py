from flask import current_app, g
from app.models import db, AdminSeatPackage, Business, User, Admin, StripeTransaction
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class AdminSeatPackageController:
    """Controller for managing admin seat packages (Super Admin only)"""
    
    @staticmethod
    def get_all_packages(include_inactive=False):
        """Get all admin seat packages for super admin management"""
        try:
            query = AdminSeatPackage.query
            
            if not include_inactive:
                query = query.filter_by(is_active=True)
            
            packages = query.order_by(AdminSeatPackage.display_order, AdminSeatPackage.created_at).all()
            
            return {
                "packages": [package.to_dict() for package in packages],
                "total_count": len(packages)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_ADMIN_SEAT_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve admin seat packages"}, 500
    
    @staticmethod
    def get_active_packages():
        """Get active admin seat packages for business purchase view"""
        try:
            packages = AdminSeatPackage.query.filter_by(is_active=True).order_by(
                AdminSeatPackage.display_order, 
                AdminSeatPackage.created_at
            ).all()
            
            return {
                "packages": [package.to_dict() for package in packages]
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ACTIVE_ADMIN_SEAT_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve admin seat packages"}, 500
    
    @staticmethod
    def get_package_by_id(package_id):
        """Get specific admin seat package by ID"""
        try:
            package = AdminSeatPackage.query.get(package_id)
            if not package:
                return {"error": "Admin seat package not found"}, 404
                
            return {"package": package.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ADMIN_SEAT_PACKAGE_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve admin seat package"}, 500
    
    @staticmethod
    def create_package(package_data):
        """Create new admin seat package (Super Admin only)"""
        try:
            # Validate required fields
            required_fields = ['name', 'seat_count', 'price']
            for field in required_fields:
                if field not in package_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Validate numeric fields
            try:
                seat_count = int(package_data['seat_count'])
                price = int(package_data['price'])
                bonus_seats = int(package_data.get('bonus_seats', 0))
                display_order = int(package_data.get('display_order', 0))
                
                if seat_count <= 0:
                    return {"error": "Seat count must be positive"}, 400
                if price < 0:
                    return {"error": "Price cannot be negative"}, 400
                if bonus_seats < 0:
                    return {"error": "Bonus seats cannot be negative"}, 400
                    
            except (ValueError, TypeError):
                return {"error": "Invalid numeric values"}, 400
            
            # Create new package
            package = AdminSeatPackage(
                name=package_data['name'],
                description=package_data.get('description'),
                seat_count=seat_count,
                price=price,
                bonus_seats=bonus_seats,
                is_popular=package_data.get('is_popular', False),
                is_active=package_data.get('is_active', True),
                display_order=display_order
            )
            
            db.session.add(package)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_ADMIN_SEAT_PACKAGE] Created package: {package.name} (ID: {package.id})")
            
            return {"package": package.to_dict(), "message": "Admin seat package created successfully"}, 201
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "Package name already exists"}, 409
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_ADMIN_SEAT_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to create admin seat package"}, 500
    
    @staticmethod
    def update_package(package_id, package_data):
        """Update existing admin seat package (Super Admin only)"""
        try:
            package = AdminSeatPackage.query.get(package_id)
            if not package:
                return {"error": "Admin seat package not found"}, 404
            
            # Update fields if provided
            if 'name' in package_data:
                package.name = package_data['name']
            if 'description' in package_data:
                package.description = package_data['description']
            if 'seat_count' in package_data:
                try:
                    seat_count = int(package_data['seat_count'])
                    if seat_count <= 0:
                        return {"error": "Seat count must be positive"}, 400
                    package.seat_count = seat_count
                except (ValueError, TypeError):
                    return {"error": "Invalid seat count value"}, 400
            
            if 'price' in package_data:
                try:
                    price = int(package_data['price'])
                    if price < 0:
                        return {"error": "Price cannot be negative"}, 400
                    package.price = price
                except (ValueError, TypeError):
                    return {"error": "Invalid price value"}, 400
            
            if 'bonus_seats' in package_data:
                try:
                    bonus_seats = int(package_data['bonus_seats'])
                    if bonus_seats < 0:
                        return {"error": "Bonus seats cannot be negative"}, 400
                    package.bonus_seats = bonus_seats
                except (ValueError, TypeError):
                    return {"error": "Invalid bonus seats value"}, 400
            
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
            
            current_app.logger.info(f"[UPDATE_ADMIN_SEAT_PACKAGE] Updated package: {package.name} (ID: {package.id})")
            
            return {"package": package.to_dict(), "message": "Admin seat package updated successfully"}, 200
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "Package name already exists"}, 409
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_ADMIN_SEAT_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to update admin seat package"}, 500
    
    @staticmethod
    def delete_package(package_id):
        """Delete admin seat package (Super Admin only)"""
        try:
            package = AdminSeatPackage.query.get(package_id)
            if not package:
                return {"error": "Admin seat package not found"}, 404
            
            # Soft delete by marking as inactive
            package.is_active = False
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_ADMIN_SEAT_PACKAGE] Deactivated package: {package.name} (ID: {package.id})")
            
            return {"message": "Admin seat package deactivated successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_ADMIN_SEAT_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to delete admin seat package"}, 500
    
    @staticmethod
    def purchase_package(business_id, package_id, stripe_charge_id, amount_paid):
        """Process admin seat package purchase for business"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            package = AdminSeatPackage.query.get(package_id)
            if not package or not package.is_active:
                return {"error": "Admin seat package not found or inactive"}, 404
            
            # Verify purchase amount matches package price
            if amount_paid != package.price:
                return {"error": "Payment amount does not match package price"}, 400
            
            # Calculate total seats including bonus
            total_seats = package.get_total_seats()
            
            # Update business admin seats
            business.admin_seats_purchased += total_seats
            
            # Create transaction record
            transaction = StripeTransaction(
                business_id=business_id,
                user_id=g.current_user.id if hasattr(g, 'current_user') and g.current_user else None,
                stripe_charge_id=stripe_charge_id,
                amount_paid=amount_paid,
                admin_seats_purchased=total_seats,  # New field to add to StripeTransaction
                status='succeeded'
            )
            
            db.session.add(transaction)
            db.session.commit()
            
            current_app.logger.info(f"[PURCHASE_ADMIN_SEAT_PACKAGE] Business {business_id} purchased {total_seats} admin seats for ${amount_paid/100}")
            
            return {
                "message": "Admin seat package purchased successfully",
                "seats_added": total_seats,
                "new_balance": business.admin_seats_purchased
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PURCHASE_ADMIN_SEAT_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to process admin seat package purchase"}, 500
    
    @staticmethod
    def get_business_seat_info(business_id):
        """Get business admin seat usage information"""
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            # Count current admin users
            current_admin_count = User.query.filter_by(
                business_id=business_id,
                role='business_admin'
            ).count()
            
            # Calculate total available seats
            tier_seats = business.tier_info.admin_seat_limit if business.tier_info else 1
            purchased_seats = business.admin_seats_purchased or 0
            total_seats = tier_seats + purchased_seats
            
            # Calculate available seats
            available_seats = total_seats - current_admin_count
            
            return {
                "business_id": business_id,
                "current_admin_count": current_admin_count,
                "tier_seats": tier_seats,
                "purchased_seats": purchased_seats,
                "total_seats": total_seats,
                "available_seats": available_seats,
                "can_add_admin": available_seats > 0
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_SEAT_INFO] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve seat information"}, 500 