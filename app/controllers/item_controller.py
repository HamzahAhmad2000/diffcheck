# app/controllers/item_controller.py
from flask import current_app, g
from app.models import db, Business, Item, ItemVote, User, PointsLog, ActivityType
from app.controllers.activity_controller import ActivityController
from app.controllers.xp_badge_controller import award_xp
from sqlalchemy.exc import IntegrityError

class ItemController:

    @staticmethod
    def list_items_for_business(business_id, args):
        """List all items (bugs/features) for a specific business"""
        current_app.logger.info(f"[LIST_ITEMS] Query args: {args}")
        try:
            # Verify business exists
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404

            query = Item.query.filter_by(business_id=business_id)
            
            # Check if this is an admin view request
            include_unpublished = args.get('admin_view', 'false').lower() == 'true'
            
            # Filter by publication status unless admin view
            if not include_unpublished:
                query = query.filter_by(is_published=True, is_archived=False)
            else:
                # For admin view, only filter out archived unless specifically requested
                show_archived = args.get('show_archived', 'false').lower() == 'true'
                if not show_archived:
                    query = query.filter_by(is_archived=False)
            
            # Filter by item type
            item_type = args.get('type')
            if item_type and item_type.upper() in ['BUG', 'FEATURE']:
                query = query.filter_by(item_type=item_type.upper())
                
            # Filter by status
            status = args.get('status')
            if status and status.upper() in ['PENDING', 'COMPLETED', 'REJECTED', 'UNDER_REVIEW', 'PLANNED']:
                query = query.filter_by(status=status.upper())
                
            # Sort by most voted or newest
            sort_by = args.get('sort', 'newest')
            if sort_by == 'votes':
                query = query.order_by(Item.net_votes.desc(), Item.created_at.desc())
            else:
                query = query.order_by(Item.created_at.desc())
                
            # Get items
            items = query.all()
            
            current_app.logger.info(f"[LIST_ITEMS] Found {len(items)} items.")
            return {"items": [item.to_dict() for item in items], "business_name": business.name}, 200
            
        except Exception as e:
            current_app.logger.error(f"[LIST_ITEMS] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve items", "details": str(e)}, 500

    @staticmethod
    def create_item(business_id, data, user_id, user_role):
        """Create a new bug report, feature request, or custom post"""
        current_app.logger.info(f"[CREATE_ITEM] Incoming data: {data} by user {user_id} with role {user_role}")
        try:
            business = Business.query.get(business_id)
            if not business:
                return {"error": "Business not found"}, 404

            required_fields = ['title', 'item_type']
            for field in required_fields:
                if field not in data:
                    return {"error": f"Missing required field: {field}"}, 400
                    
            item_type = data['item_type'].upper()
            if item_type not in ['BUG', 'FEATURE', 'CUSTOM POST']:
                return {"error": "Invalid item_type. Must be 'BUG', 'FEATURE', or 'CUSTOM POST'"}, 400
            
            # Custom posts can only be created by admins
            if item_type == 'CUSTOM POST' and user_role != 'business_admin' and user_role != 'super_admin':
                return {"error": "Forbidden: Only admins can create custom posts"}, 403

            # Default is_published to False. Admins can override this.
            is_published = False
            if user_role in ['business_admin', 'super_admin']:
                is_published = data.get('is_published', False)

            item = Item(
                business_id=business_id,
                user_id=user_id,
                item_type=item_type,
                title=data['title'],
                description=data.get('description'),
                image_url=data.get('image_url'),
                status='PENDING',
                is_published=is_published,
                is_archived=False
            )
            
            db.session.add(item)
            db.session.commit()
            
            points_awarded = 0
            # Only award points for user-submitted bugs and features
            if user_role not in ['business_admin', 'super_admin']:
                points_awarded = 10 
                award_xp(
                    user_id=user_id,
                    points=points_awarded,
                    activity_type='BUG_REPORTED' if item_type == 'BUG' else 'FEATURE_REQUESTED',
                    related_item_id=item.id,
                    business_id=business_id
                )
            
            activity_type_enum = None
            if item_type == 'BUG':
                activity_type_enum = ActivityType.BUG_REPORTED
            elif item_type == 'FEATURE':
                activity_type_enum = ActivityType.FEATURE_REQUESTED
            elif item_type == 'CUSTOM POST':
                activity_type_enum = ActivityType.CUSTOM_POST

            if activity_type_enum:
                ActivityController.create_activity_log(
                    business_id=business_id,
                    activity_type=activity_type_enum,
                    title=f"New {item_type.lower().replace('_', ' ')}: '{item.title}'",
                    description=item.description or f"A new {item_type.lower().replace('_', ' ')} was posted.",
                    related_item_id=item.id,
                    related_item_url=f"/businesses/{business_id}/items/{item.id}",
                    user_id=user_id,
                    make_public_by_default=is_published # Log activity visibility based on item's published status
                )
            
            db.session.commit()
            
            current_app.logger.info(f"[CREATE_ITEM] {item_type} created successfully with ID {item.id}.")
            
            response = {
                "message": f"{item_type.capitalize().replace('_', ' ')} created successfully", 
                "item": item.to_dict(), 
            }
            if points_awarded > 0:
                response["points_awarded"] = points_awarded

            return response, 201
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_ITEM] Database integrity error: {e}")
            return {"error": "Database error: Could not create item."}, 500
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[CREATE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to create item", "details": str(e)}, 500

    @staticmethod
    def get_item(item_id):
        """Get item details"""
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            return {"item": item.to_dict()}, 200
            
        except Exception as e:
            current_app.logger.error(f"[GET_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to retrieve item", "details": str(e)}, 500

    @staticmethod
    def update_item(item_id, data, user_id, user_role):
        """Update an item (title, description, image)"""
        current_app.logger.info(f"[UPDATE_ITEM] Incoming data: {data}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can edit (item creator, business admin, or super admin)
            can_edit = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id) or
                item.user_id == user_id
            )
            
            if not can_edit:
                return {"error": "Forbidden: You don't have permission to edit this item"}, 403
                
            # Update fields
            if 'title' in data:
                item.title = data['title']
            if 'description' in data:
                item.description = data['description']
            if 'image_url' in data:
                item.image_url = data['image_url']
                
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_ITEM] Item updated successfully.")
            return {"message": "Item updated successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to update item", "details": str(e)}, 500

    @staticmethod
    def update_item_status(item_id, data, user_id, user_role):
        """Update item status (admin only)"""
        current_app.logger.info(f"[UPDATE_ITEM_STATUS] Incoming data: {data}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can change status (business admin or super admin)
            can_change_status = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id)
            )
            
            if not can_change_status:
                return {"error": "Forbidden: You don't have permission to change item status"}, 403
                
            # Validate new status
            new_status = data.get('status', '').upper()
            if new_status not in ['PENDING', 'COMPLETED', 'REJECTED', 'UNDER_REVIEW', 'PLANNED']:
                return {"error": "Invalid status. Must be one of: PENDING, COMPLETED, REJECTED, UNDER_REVIEW, PLANNED"}, 400
                
            old_status = item.status
            item.status = new_status
            
            # Award bonus points if item is completed
            if new_status == 'COMPLETED' and old_status != 'COMPLETED':
                bonus_points = 10  # Bonus for having item completed
                points_log = PointsLog(
                    user_id=item.user_id,
                    business_id=item.business_id,
                    item_id=item.id,
                    activity_type=f"{item.item_type}_COMPLETED",
                    points_awarded=bonus_points
                )
                db.session.add(points_log)
                
            db.session.commit()
            
            current_app.logger.info(f"[UPDATE_ITEM_STATUS] Item status updated successfully.")
            return {"message": "Item status updated successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UPDATE_ITEM_STATUS] Error: {e}", exc_info=True)
            return {"error": "Failed to update item status", "details": str(e)}, 500

    @staticmethod
    def vote_on_item(item_id, data, user_id):
        """Vote on an item (upvote or downvote)"""
        current_app.logger.info(f"[VOTE_ITEM] User {user_id} voting on item {item_id}: {data}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Validate vote type
            vote_type = data.get('vote')
            if vote_type not in [1, -1]:
                return {"error": "Invalid vote type. Must be 1 (upvote) or -1 (downvote)"}, 400
                
            # Check if user already voted
            existing_vote = ItemVote.query.filter_by(item_id=item_id, user_id=user_id).first()
            
            if existing_vote:
                if existing_vote.vote_type == vote_type:
                    # Remove vote (toggle off)
                    db.session.delete(existing_vote)
                    message = "Vote removed"
                else:
                    # Change vote
                    existing_vote.vote_type = vote_type
                    message = "Vote updated"
            else:
                # New vote
                new_vote = ItemVote(
                    item_id=item_id,
                    user_id=user_id,
                    vote_type=vote_type
                )
                db.session.add(new_vote)
                message = "Vote cast"
                
                # Award points for voting using new XP system
                award_xp(
                    user_id=user_id,
                    points=1,
                    activity_type='FEATURE_VOTED',
                    related_item_id=item.id,
                    business_id=item.business_id
                )
            
            # Update vote counts
            item.update_vote_counts()
            db.session.commit()
            
            current_app.logger.info(f"[VOTE_ITEM] Vote processed successfully.")
            return {
                "message": message, 
                "item": item.to_dict(),
                "user_vote": ItemVote.query.filter_by(item_id=item_id, user_id=user_id).first().vote_type if ItemVote.query.filter_by(item_id=item_id, user_id=user_id).first() else None
            }, 200
            
        except IntegrityError as e:
            db.session.rollback()
            current_app.logger.error(f"[VOTE_ITEM] Database integrity error: {e}")
            return {"error": "Database error: Could not process vote."}, 500
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[VOTE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to process vote", "details": str(e)}, 500

    @staticmethod
    def delete_item(item_id, user_id, user_role):
        """Delete an item"""
        current_app.logger.info(f"[DELETE_ITEM] Deleting item {item_id}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can delete (item creator, business admin, or super admin)
            can_delete = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id) or
                item.user_id == user_id
            )
            
            if not can_delete:
                return {"error": "Forbidden: You don't have permission to delete this item"}, 403
                
            db.session.delete(item)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_ITEM] Item deleted successfully.")
            return {"message": "Item deleted successfully"}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[DELETE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to delete item", "details": str(e)}, 500

    @staticmethod
    def get_user_vote(item_id, user_id):
        """Get user's vote on an item"""
        try:
            vote = ItemVote.query.filter_by(item_id=item_id, user_id=user_id).first()
            return {"vote": vote.vote_type if vote else None}, 200
        except Exception as e:
            current_app.logger.error(f"[GET_USER_VOTE] Error: {e}", exc_info=True)
            return {"error": "Failed to get user vote", "details": str(e)}, 500

    @staticmethod
    def publish_item(item_id, user_id, user_role):
        """Publish an item (make it visible to public)"""
        current_app.logger.info(f"[PUBLISH_ITEM] Publishing item {item_id}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can publish (business admin or super admin)
            can_publish = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id)
            )
            
            if not can_publish:
                return {"error": "Forbidden: You don't have permission to publish this item"}, 403
                
            item.is_published = True
            db.session.commit()
            
            current_app.logger.info(f"[PUBLISH_ITEM] Item published successfully.")
            return {"message": "Item published successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[PUBLISH_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to publish item", "details": str(e)}, 500

    @staticmethod
    def unpublish_item(item_id, user_id, user_role):
        """Unpublish an item (make it invisible to public)"""
        current_app.logger.info(f"[UNPUBLISH_ITEM] Unpublishing item {item_id}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can unpublish (business admin or super admin)
            can_unpublish = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id)
            )
            
            if not can_unpublish:
                return {"error": "Forbidden: You don't have permission to unpublish this item"}, 403
                
            item.is_published = False
            db.session.commit()
            
            current_app.logger.info(f"[UNPUBLISH_ITEM] Item unpublished successfully.")
            return {"message": "Item unpublished successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UNPUBLISH_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to unpublish item", "details": str(e)}, 500

    @staticmethod
    def archive_item(item_id, user_id, user_role):
        """Archive an item (keep but hide from active lists)"""
        current_app.logger.info(f"[ARCHIVE_ITEM] Archiving item {item_id}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can archive (business admin or super admin)
            can_archive = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id)
            )
            
            if not can_archive:
                return {"error": "Forbidden: You don't have permission to archive this item"}, 403
                
            item.is_archived = True
            item.is_published = False  # Also unpublish when archiving
            db.session.commit()
            
            current_app.logger.info(f"[ARCHIVE_ITEM] Item archived successfully.")
            return {"message": "Item archived successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[ARCHIVE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to archive item", "details": str(e)}, 500

    @staticmethod
    def unarchive_item(item_id, user_id, user_role):
        """Unarchive an item (bring back to active lists)"""
        current_app.logger.info(f"[UNARCHIVE_ITEM] Unarchiving item {item_id}")
        try:
            item = Item.query.get(item_id)
            if not item:
                return {"error": "Item not found"}, 404
                
            # Check if user can unarchive (business admin or super admin)
            can_unarchive = (
                user_role == 'super_admin' or
                (user_role == 'business_admin' and hasattr(g, 'current_user') and g.current_user.business_id == item.business_id)
            )
            
            if not can_unarchive:
                return {"error": "Forbidden: You don't have permission to unarchive this item"}, 403
                
            item.is_archived = False
            # Note: Unarchiving doesn't automatically publish - admins must explicitly publish
            db.session.commit()
            
            current_app.logger.info(f"[UNARCHIVE_ITEM] Item unarchived successfully.")
            return {"message": "Item unarchived successfully", "item": item.to_dict()}, 200
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"[UNARCHIVE_ITEM] Error: {e}", exc_info=True)
            return {"error": "Failed to unarchive item", "details": str(e)}, 500 