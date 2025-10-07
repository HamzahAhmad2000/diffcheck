# app/controllers/activity_controller.py
from flask import current_app, g
from app.models import db, Business, BusinessActivity, User, Survey, ActivityType
from sqlalchemy.exc import IntegrityError

class ActivityController:

    @staticmethod
    def create_activity_log(business_id, activity_type: ActivityType, title, description=None, 
                            related_item_id=None, related_item_url=None, 
                            user_id=None, make_public_by_default=False):
        try:
            # Ensure business exists
            business = Business.query.get(business_id)
            if not business:
                current_app.logger.error(f"[ACTIVITY_LOG] Business ID {business_id} not found for logging activity.")
                return None # Or raise error

            # Determine the user performing the action
            actor_user_id = user_id
            if not actor_user_id and hasattr(g, 'current_user') and g.current_user:
                 # Check if g.current_user is Admin (super_admin) or User (business_admin, user)
                if hasattr(g.current_user, 'role'): # Covers business_admin and regular users
                    actor_user_id = g.current_user.id
                else:
                    # For super admin, we might not always log them as the direct user of the activity
                    # unless they are explicitly acting on behalf of a business.
                    # This part might need refinement based on how SA actions are tracked.
                    # For now, if SA creates an activity FOR a business, let's log SA.
                     actor_user_id = g.current_user.id # Or None if SA actions for business are "system"

            activity = BusinessActivity(
                business_id=business_id,
                user_id=actor_user_id, # User who performed the action
                activity_type=activity_type.value,  # Use .value to get the string from enum
                title=title,
                description=description,
                related_item_id=related_item_id,
                related_item_url=related_item_url,
                is_public=make_public_by_default 
            )
            db.session.add(activity)
            db.session.commit()
            current_app.logger.info(f"[ACTIVITY_LOG] Activity '{title}' (Type: {activity_type.value}) created for Business ID {business_id}.")
            return activity
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[ACTIVITY_LOG] Error creating activity log: {e}", exc_info=True)
            return None

    @staticmethod
    def list_business_activities(business_id, args):
        """List activities for a business"""
        current_app.logger.info(f"[LIST_ACTIVITIES] Query args: {args}")
        try:
            query = BusinessActivity.query.filter_by(business_id=business_id)
            
            # Filter by public/private
            is_public_str = args.get('is_public')
            if is_public_str is not None:
                is_public = is_public_str.lower() == 'true'
                query = query.filter_by(is_public=is_public)
                
            # Filter by activity type
            activity_type = args.get('type')
            if activity_type:
                query = query.filter_by(activity_type=activity_type)
                
            # Get activities
            activities = query.order_by(BusinessActivity.created_at.desc()).all()
            
            current_app.logger.info(f"[LIST_ACTIVITIES] Found {len(activities)} activities.")
            return {"activities": [a.to_dict() for a in activities]}, 200
            
        except Exception as e:
            current_app.logger.error(f"[LIST_ACTIVITIES] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve activities", "details": str(e)}, 500

    @staticmethod
    def create_activity(business_id, data, user_id):
        """Create a new activity"""
        current_app.logger.info(f"[CREATE_ACTIVITY] Incoming data: {data}")
        try:
            # Validate required fields
            required_fields = ['title', 'activity_type']
            for field in required_fields:
                if field not in data:
                    return {"error": f"Missing required field: {field}"}, 400
                    
            # Create activity
            activity = BusinessActivity(
                business_id=business_id,
                user_id=user_id,
                title=data['title'],
                description=data.get('description'),
                activity_type=data['activity_type'],
                is_public=data.get('is_public', False),
                is_pinned=data.get('is_pinned', False),
                related_item_id=data.get('related_item_id'),
                related_item_url=data.get('related_item_url')
            )
            
            db.session.add(activity)
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_ACTIVITY] Activity created successfully.")
            return {"message": "Activity created successfully", "activity": activity.to_dict()}, 201
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_ACTIVITY] Database integrity error: {e}")
            return {"error": "Database error: Could not create activity."}, 500
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_ACTIVITY] Error: {e}", exc_info=True)
            return {"error": "Failed to create activity", "details": str(e)}, 500

    @staticmethod
    def update_activity(business_id, activity_id, data):
        """Update an activity"""
        current_app.logger.info(f"[UPDATE_ACTIVITY] Incoming data: {data}")
        try:
            activity = BusinessActivity.query.filter_by(id=activity_id, business_id=business_id).first()
            if not activity:
                return {"error": "Activity not found"}, 404
                
            # Update fields
            if 'is_public' in data:
                activity.is_public = data['is_public']
            if 'is_pinned' in data:
                activity.is_pinned = data['is_pinned']
            if 'title' in data:
                activity.title = data['title']
            if 'description' in data:
                activity.description = data['description']
                
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_ACTIVITY] Activity updated successfully.")
            return {"message": "Activity updated successfully", "activity": activity.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_ACTIVITY] Error: {e}", exc_info=True)
            return {"error": "Failed to update activity", "details": str(e)}, 500

    @staticmethod
    def delete_activity(business_id, activity_id):
        """Delete an activity"""
        current_app.logger.info(f"[DELETE_ACTIVITY] Deleting activity {activity_id}")
        try:
            activity = BusinessActivity.query.filter_by(id=activity_id, business_id=business_id).first()
            if not activity:
                return {"error": "Activity not found"}, 404
                
            db.session.delete(activity)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_ACTIVITY] Activity deleted successfully.")
            return {"message": "Activity deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_ACTIVITY] Error: {e}", exc_info=True)
            return {"error": "Failed to delete activity", "details": str(e)}, 500

    @staticmethod
    def create_custom_business_post(business_id, data, user_id, user_role):
        current_app.logger.info(f"[CUSTOM_POST] Business ID: {business_id}, Data: {data} by User ID: {user_id}, Role: {user_role}")
        
        business = Business.query.get(business_id)
        if not business:
            return {"error": "Business not found"}, 404

        # Permission check
        is_super_admin = user_role == 'super_admin'
        is_ba_of_this_business = (user_role == 'business_admin' and 
                                  hasattr(g, 'current_user') and 
                                  g.current_user and 
                                  g.current_user.business_id == business_id)

        if not (is_super_admin or is_ba_of_this_business):
            return {"error": "Forbidden. You do not have permission to post for this business."}, 403

        if is_ba_of_this_business:
            ba_perms = g.current_user.business_admin_permissions or {}
            business_perms = business.permissions or {}
            # Needs a permission like 'can_create_custom_posts' or reuse 'can_edit_splash_page'
            if not (ba_perms.get('can_edit_splash_page', False) and business_perms.get('can_edit_splash_page', False)):
                 return {"error": "Forbidden. Your role does not permit creating custom posts for this business."}, 403
        
        title = data.get('title')
        description = data.get('description')

        if not title or not title.strip():
            return {"error": "Title is required for a custom post."}, 400
        
        # Use the generic activity log creator
        activity = ActivityController.create_activity_log(
            business_id=business_id,
            activity_type=ActivityType.CUSTOM_POST,
            title=title,
            description=description,
            user_id=user_id, # The acting user
            make_public_by_default=data.get('is_public', False) # Allow BA to set initial public status
        )
        if activity:
            return {"message": "Custom post created successfully", "activity": activity.to_dict()}, 201
        else:
            return {"error": "Failed to create custom post"}, 500 

    # NEW helper to update visibility / pinned state via activity_id
    @staticmethod
    def update_activity_visibility(activity_id, data, user_id=None, user_role=None):
        """Update is_public / is_pinned or title/description for a single activity using its ID only (route convenience)."""
        try:
            activity = BusinessActivity.query.get(activity_id)
            if not activity:
                return {"error": "Activity not found"}, 404

            business_id = activity.business_id

            # Permission check – super admins always allowed; business admins only for their own business.
            if user_role == 'business_admin':
                if not (hasattr(g, 'current_user') and g.current_user and g.current_user.business_id == business_id):
                    return {"error": "Forbidden: You do not have access to this activity."}, 403

            # Re-use existing update_activity for the heavy lifting
            return ActivityController.update_activity(business_id, activity_id, data)
        except Exception as e:
            current_app.logger.error(f"[UPDATE_ACTIVITY_VISIBILITY] Error: {e}", exc_info=True)
            return {"error": "Failed to update activity", "details": str(e)}, 500

    # NEW wrapper to delete activity via ID only
    @staticmethod
    def delete_activity_by_id(activity_id, user_id=None, user_role=None):
        """Delete an activity by ID with permission checks."""
        try:
            activity = BusinessActivity.query.get(activity_id)
            if not activity:
                return {"error": "Activity not found"}, 404

            business_id = activity.business_id

            # Permission check similar to above
            if user_role == 'business_admin':
                if not (hasattr(g, 'current_user') and g.current_user and g.current_user.business_id == business_id):
                    return {"error": "Forbidden: You do not have access to delete this activity."}, 403

            return ActivityController.delete_activity(business_id, activity_id)
        except Exception as e:
            current_app.logger.error(f"[DELETE_ACTIVITY] Error wrapper: {e}", exc_info=True)
            return {"error": "Failed to delete activity", "details": str(e)}, 500