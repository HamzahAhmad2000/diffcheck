from flask import current_app
from app.models import db, ResponsePackage, Business
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class ResponsePackageController:
    """Controller for managing response packages"""
    
    @staticmethod
    def get_all_packages(include_inactive=False):
        """Get all response packages, optionally including inactive ones"""
        try:
            query = ResponsePackage.query
            if not include_inactive:
                query = query.filter_by(is_active=True)
            
            packages = query.order_by(ResponsePackage.display_order.asc(), ResponsePackage.price.asc()).all()
            
            return {
                "packages": [package.to_dict() for package in packages],
                "total_count": len(packages)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_PACKAGES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve response packages"}, 500
    
    @staticmethod
    def get_package_by_id(package_id):
        """Get a specific response package by ID"""
        try:
            package = ResponsePackage.query.get(package_id)
            if not package:
                return {"error": "Response package not found"}, 404
                
            return {"package": package.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PACKAGE_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve response package"}, 500
    
    @staticmethod
    def create_package(package_data):
        """Create a new response package"""
        try:
            # Validate required fields
            required_fields = ['name', 'responses', 'price']
            for field in required_fields:
                if field not in package_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Check for duplicate name
            existing_package = ResponsePackage.query.filter_by(name=package_data['name']).first()
            if existing_package:
                return {"error": "A response package with this name already exists"}, 400
            
            # Create new package
            package = ResponsePackage(
                name=package_data['name'],
                description=package_data.get('description'),
                responses=int(package_data['responses']),
                price=int(package_data['price']),
                display_order=int(package_data.get('display_order', 0)),
                is_popular=package_data.get('is_popular', False),
                is_active=package_data.get('is_active', True)
            )
            
            db.session.add(package)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_PACKAGE] Created response package: {package.name} (ID: {package.id})")
            
            return {
                "message": "Response package created successfully",
                "package": package.to_dict()
            }, 201
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "A response package with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to create response package"}, 500
    
    @staticmethod
    def update_package(package_id, package_data):
        """Update an existing response package"""
        try:
            package = ResponsePackage.query.get(package_id)
            if not package:
                return {"error": "Response package not found"}, 404
            
            # Check for duplicate name if name is being changed
            if 'name' in package_data and package_data['name'] != package.name:
                existing_package = ResponsePackage.query.filter_by(name=package_data['name']).first()
                if existing_package:
                    return {"error": "A response package with this name already exists"}, 400
            
            # Update fields
            updatable_fields = [
                'name', 'description', 'responses', 'price', 
                'display_order', 'is_popular', 'is_active'
            ]
            
            for field in updatable_fields:
                if field in package_data:
                    if field in ['responses', 'price', 'display_order']:
                        setattr(package, field, int(package_data[field]))
                    else:
                        setattr(package, field, package_data[field])
            
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_PACKAGE] Updated response package: {package.name} (ID: {package.id})")
            
            return {
                "message": "Response package updated successfully",
                "package": package.to_dict()
            }, 200
            
        except IntegrityError:
            db.session.rollback()
            return {"error": "A response package with this name already exists"}, 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to update response package"}, 500
    
    @staticmethod
    def delete_package(package_id):
        """Delete a response package"""
        try:
            package = ResponsePackage.query.get(package_id)
            if not package:
                return {"error": "Response package not found"}, 404
            
            package_name = package.name
            db.session.delete(package)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_PACKAGE] Deleted response package: {package_name} (ID: {package_id})")
            
            return {"message": "Response package deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_PACKAGE] Error: {e}", exc_info=True)
            return {"error": "Failed to delete response package"}, 500
    
    @staticmethod
    def toggle_popular_status(package_id):
        """Toggle the popular status of a response package"""
        try:
            package = ResponsePackage.query.get(package_id)
            if not package:
                return {"error": "Response package not found"}, 404
            
            # If making this package popular, remove popular status from others
            if not package.is_popular:
                ResponsePackage.query.filter_by(is_popular=True).update({'is_popular': False})
            
            package.is_popular = not package.is_popular
            package.updated_at = datetime.utcnow()
            db.session.commit()
            
            status = "popular" if package.is_popular else "not popular"
            current_app.logger.info(f"[TOGGLE_POPULAR] Package {package.name} is now {status}")
            
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
        """Get statistics about response package usage"""
        try:
            # Basic package statistics
            total_packages = ResponsePackage.query.count()
            active_packages = ResponsePackage.query.filter_by(is_active=True).count()
            
            # Package usage could be tracked via purchase logs if implemented
            # For now, return basic stats
            
            return {
                "total_packages": total_packages,
                "active_packages": active_packages,
                "inactive_packages": total_packages - active_packages
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_PACKAGE_STATS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve package statistics"}, 500 