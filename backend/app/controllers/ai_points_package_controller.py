from flask import current_app
from app.models import db, AIPointsPackage, StripeTransaction
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class AIPointsPackageController:
    """Controller for managing AI points pricing packages"""
    
    @staticmethod
    def get_all_packages(include_inactive=False):
        """Get all AI points packages, optionally including inactive ones"""
        try:
            query = AIPointsPackage.query
            if not include_inactive:
                query = query.filter_by(is_active=True)
            
            packages = query.order_by(AIPointsPackage.display_order.asc(), AIPointsPackage.price.asc()).all()
            
            return {
                "packages": [package.to_dict() for package in packages],
                "total_count": len(packages)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve AI points packages"}, 500
    
    @staticmethod
    def get_package_by_id(package_id):
        """Get a specific AI points package by ID"""
        try:
            package = AIPointsPackage.query.get(package_id)
            if not package:
                return {"error": "AI points package not found"}, 404
                
            return {"package": package.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PACKAGE_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve AI points package"}, 500
    
    @staticmethod
    def create_package(package_data):
        """Create a new AI points package"""
        try:
            # Validate required fields
            required_fields = ['name', 'points', 'price']
            for field in required_fields:
                if field not in package_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Validate points and price are positive
            if int(package_data['points']) <= 0:
                return {"error": "Points must be greater than 0"}, 400
            if int(package_data['price']) < 0:
                return {"error": "Price cannot be negative"}, 400
            
            # Check for duplicate name
            existing_package = AIPointsPackage.query.filter_by(name=package_data['name']).first()
            if existing_package:
                return {"error": "A package with this name already exists"}, 400
            
            # Create new package
            package = AIPointsPackage(
                name=package_data['name'],
                description=package_data.get('description'),
                points=int(package_data['points']),
                price=int(package_data['price']),
                bonus_points=int(package_data.get('bonus_points', 0)),
                is_popular=package_data.get('is_popular', False),
                display_order=int(package_data.get('display_order', 0)),
                is_active=package_data.get('is_active', True)
            )
            
            db.session.add(package)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_PACKAGE] Created new AI points package: {package.name} (ID: {package.id})")
            
            return {
                "message": "AI points package created successfully",
                "package": package.to_dict()
            }, 201
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_PACKAGE] Integrity error: {e}", exc_info=True)
            return {"error": "A package with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to create AI points package"}, 500
    
    @staticmethod
    def update_package(package_id, package_data):
        """Update an existing AI points package"""
        try:
            package = AIPointsPackage.query.get(package_id)
            if not package:
                return {"error": "AI points package not found"}, 404
            
            # Check for duplicate name if name is being changed
            if 'name' in package_data and package_data['name'] != package.name:
                existing_package = AIPointsPackage.query.filter_by(name=package_data['name']).first()
                if existing_package:
                    return {"error": "A package with this name already exists"}, 400
            
            # Validate numeric fields
            if 'points' in package_data and int(package_data['points']) <= 0:
                return {"error": "Points must be greater than 0"}, 400
            if 'price' in package_data and int(package_data['price']) < 0:
                return {"error": "Price cannot be negative"}, 400
            
            # Update fields
            updatable_fields = [
                'name', 'description', 'points', 'price', 'bonus_points',
                'is_popular', 'display_order', 'is_active'
            ]
            
            for field in updatable_fields:
                if field in package_data:
                    if field in ['points', 'price', 'bonus_points', 'display_order']:
                        # Handle empty strings and None values
                        value = package_data[field]
                        if value == '' or value is None:
                            continue  # Skip empty values
                        try:
                            setattr(package, field, int(value))
                        except (ValueError, TypeError):
                            return {"error": f"Invalid {field} value: must be a number"}, 400
                    else:
                        setattr(package, field, package_data[field])
            
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_PACKAGE] Updated AI points package: {package.name} (ID: {package.id})")
            
            return {
                "message": "AI points package updated successfully",
                "package": package.to_dict()
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_PACKAGE] Integrity error: {e}", exc_info=True)
            return {"error": "A package with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to update AI points package"}, 500
    
    @staticmethod
    def delete_package(package_id):
        """Delete an AI points package (soft delete by marking inactive)"""
        try:
            package = AIPointsPackage.query.get(package_id)
            if not package:
                return {"error": "AI points package not found"}, 404
            
            # Soft delete by marking inactive
            package.is_active = False
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_PACKAGE] Soft deleted AI points package: {package.name} (ID: {package.id})")
            
            return {"message": "AI points package deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to delete AI points package"}, 500
    
    @staticmethod
    def toggle_popular_status(package_id):
        """Toggle the popular status of a package"""
        try:
            package = AIPointsPackage.query.get(package_id)
            if not package:
                return {"error": "AI points package not found"}, 404
            
            package.is_popular = not package.is_popular
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            status = "popular" if package.is_popular else "not popular"
            current_app.logger.info(f"[TOGGLE_POPULAR] Set package {package.name} as {status}")
            
            return {
                "message": f"Package marked as {status}",
                "package": package.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[TOGGLE_POPULAR] Error: {e}", exc_info=True)
            return {"error": "Failed to update package status"}, 500
    
    @staticmethod
    def get_package_stats():
        """Get statistics about package usage and sales"""
        try:
            # Basic package statistics
            active_packages_count = AIPointsPackage.query.filter_by(is_active=True).count()
            popular_packages_count = AIPointsPackage.query.filter_by(is_active=True, is_popular=True).count()

            # Transaction-based statistics – count successful Stripe purchases that included AI points
            total_purchases = StripeTransaction.query.filter(StripeTransaction.points_purchased > 0).count()

            return {
                # For new frontend components
                "active_packages": active_packages_count,
                "total_purchases": total_purchases,

                # Legacy / backwards-compatibility keys
                "total_active_packages": active_packages_count,
                "popular_packages": popular_packages_count
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PACKAGE_STATS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve package statistics"}, 500 