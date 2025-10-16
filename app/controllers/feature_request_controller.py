from flask import current_app
from app.models import db, FeatureRequest, Business, User, Admin, Survey
from sqlalchemy.exc import IntegrityError
from datetime import datetime

class FeatureRequestController:
    """Controller for managing feature requests from businesses for featured content"""
    
    @staticmethod
    def get_all_feature_requests(filters=None):
        """Get all feature requests with optional filtering (super admin only)"""
        try:
            query = FeatureRequest.query
            
            # Apply filters
            if filters:
                if filters.get('status'):
                    query = query.filter_by(status=filters['status'])
                if filters.get('business_id'):
                    query = query.filter_by(business_id=filters['business_id'])
                if filters.get('request_type'):
                    query = query.filter_by(request_type=filters['request_type'])
            
            feature_requests = query.order_by(FeatureRequest.created_at.desc()).all()
            
            return {
                "feature_requests": [request.to_dict() for request in feature_requests],
                "total_count": len(feature_requests)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ALL_FEATURE_REQUESTS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve feature requests"}, 500
    
    @staticmethod
    def get_feature_request_by_id(request_id):
        """Get a specific feature request by ID"""
        try:
            feature_request = FeatureRequest.query.get(request_id)
            if not feature_request:
                return {"error": "Feature request not found"}, 404
                
            return {"feature_request": feature_request.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_FEATURE_REQUEST_BY_ID] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve feature request"}, 500
    
    @staticmethod
    def create_feature_request(business_id, user_id, request_data):
        """Create a new feature request from a business"""
        try:
            # Validate required fields
            required_fields = ['request_type']
            for field in required_fields:
                if field not in request_data:
                    return {"error": f"Missing required field: {field}"}, 400
            
            # Validate request type
            valid_types = ['FEATURED_BUSINESS', 'FEATURED_SURVEY', 'FEATURED_QUEST']
            if request_data['request_type'] not in valid_types:
                return {"error": "Invalid request type"}, 400
            
            # Validate business exists
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404
            
            # Check if business tier allows feature requests
            if business.tier_info and not business.tier_info.can_request_featured:
                return {"error": "Your business tier does not allow feature requests"}, 403
            
            # For survey/quest requests, validate target item exists
            if request_data['request_type'] in ['FEATURED_SURVEY', 'FEATURED_QUEST']:
                if not request_data.get('target_item_id'):
                    return {"error": "Target item ID is required for survey/quest feature requests"}, 400
                
                if request_data['request_type'] == 'FEATURED_SURVEY':
                    survey = Survey.query.filter_by(
                        id=request_data['target_item_id'],
                        business_id=business_id
                    ).first()
                    if not survey:
                        return {"error": "Survey not found or does not belong to your business"}, 404
                    request_data['target_item_title'] = survey.title
                # TODO: Add quest validation when quest model is implemented
            
            # Create new feature request
            feature_request = FeatureRequest(
                business_id=business_id,
                user_id=user_id,
                request_type=request_data['request_type'],
                target_item_id=request_data.get('target_item_id'),
                target_item_title=request_data.get('target_item_title'),
                message=request_data.get('message'),
                status='PENDING'
            )
            
            db.session.add(feature_request)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_FEATURE_REQUEST] Created feature request: {feature_request.id} for business {business_id}")
            
            return {
                "message": "Feature request submitted successfully",
                "feature_request": feature_request.to_dict()
            }, 201
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_FEATURE_REQUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to create feature request"}, 500
    
    @staticmethod
    def review_feature_request(request_id, admin_id, review_data):
        """Review a feature request (approve/reject) - super admin only"""
        try:
            feature_request = FeatureRequest.query.get(request_id)
            if not feature_request:
                return {"error": "Feature request not found"}, 404
            
            # Validate status
            valid_statuses = ['APPROVED', 'REJECTED']
            if review_data.get('status') not in valid_statuses:
                return {"error": "Invalid status. Must be APPROVED or REJECTED"}, 400
            
            # Update feature request
            feature_request.status = review_data['status']
            feature_request.admin_response = review_data.get('admin_response')
            feature_request.reviewed_by_admin_id = admin_id
            feature_request.reviewed_at = datetime.utcnow()
            feature_request.updated_at = datetime.utcnow()
            
            # If approved, apply the featured status to the target item
            if review_data['status'] == 'APPROVED':
                success = FeatureRequestController._apply_featured_status(feature_request)
                if not success:
                    return {"error": "Failed to apply featured status to target item"}, 500
            
            db.session.commit()
            
            current_app.logger.info(f"[REVIEW_FEATURE_REQUEST] Admin {admin_id} {review_data['status'].lower()} feature request {request_id}")
            
            return {
                "message": f"Feature request {review_data['status'].lower()} successfully",
                "feature_request": feature_request.to_dict()
            }, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[REVIEW_FEATURE_REQUEST] Error: {e}", exc_info=True)
            return {"error": "Failed to review feature request"}, 500
    
    @staticmethod
    def _apply_featured_status(feature_request):
        """Apply featured status to the target item"""
        try:
            if feature_request.request_type == 'FEATURED_BUSINESS':
                business = Business.query.get(feature_request.business_id)
                if business:
                    business.is_featured = True
                    return True
                    
            elif feature_request.request_type == 'FEATURED_SURVEY':
                survey = Survey.query.get(feature_request.target_item_id)
                if survey:
                    survey.is_featured = True
                    return True
                    
            elif feature_request.request_type == 'FEATURED_QUEST':
                # TODO: Implement when quest model is available
                current_app.logger.info(f"[APPLY_FEATURED_STATUS] Quest featuring not yet implemented")
                return True
                
            return False
            
        except Exception as e:
            current_app.logger.error(f"[APPLY_FEATURED_STATUS] Error: {e}", exc_info=True)
            return False
    
    @staticmethod
    def get_business_feature_requests(business_id):
        """Get all feature requests for a specific business"""
        try:
            feature_requests = FeatureRequest.query.filter_by(business_id=business_id)\
                .order_by(FeatureRequest.created_at.desc()).all()
            
            return {
                "feature_requests": [request.to_dict() for request in feature_requests],
                "total_count": len(feature_requests)
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_BUSINESS_FEATURE_REQUESTS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve business feature requests"}, 500
    
    @staticmethod
    def get_feature_request_stats():
        """Get statistics about feature requests"""
        try:
            total_requests = FeatureRequest.query.count()
            pending_requests = FeatureRequest.query.filter_by(status='PENDING').count()
            approved_requests = FeatureRequest.query.filter_by(status='APPROVED').count()
            rejected_requests = FeatureRequest.query.filter_by(status='REJECTED').count()
            
            # Get requests by type
            business_requests = FeatureRequest.query.filter_by(request_type='FEATURED_BUSINESS').count()
            survey_requests = FeatureRequest.query.filter_by(request_type='FEATURED_SURVEY').count()
            quest_requests = FeatureRequest.query.filter_by(request_type='FEATURED_QUEST').count()
            
            return {
                "total_requests": total_requests,
                "pending_requests": pending_requests,
                "approved_requests": approved_requests,
                "rejected_requests": rejected_requests,
                "requests_by_type": {
                    "business": business_requests,
                    "survey": survey_requests,
                    "quest": quest_requests
                }
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_FEATURE_REQUEST_STATS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve feature request statistics"}, 500 