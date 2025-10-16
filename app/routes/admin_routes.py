# app/routes/admin_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.controllers.auth_controller import token_required, admin_required
from app.models import db, User, Admin, PointsLog
from sqlalchemy import or_

admin_routes_bp = Blueprint('admin_routes', __name__)

@admin_routes_bp.route('/admin/users', methods=['GET'])
@token_required
@admin_required
def list_all_users():
    """List all regular users and business admins (Super Admin only)"""
    try:
        current_app.logger.info(f"[LIST_ALL_USERS] Super admin {g.current_user.id} requesting all users")
        
        # Get query parameters for filtering and pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        search = request.args.get('search', '')
        role_filter = request.args.get('role', '')
        
        # Build query
        query = User.query
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    User.name.ilike(search_term),
                    User.username.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )
        
        # Apply role filter
        if role_filter:
            query = query.filter(User.role == role_filter)
        
        # Order by creation date (newest first)
        query = query.order_by(User.created_at.desc())
        
        # Get paginated results
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        users = []
        for user in pagination.items:
            user_dict = user.to_dict()
            # Add additional info for admin view
            user_dict['is_active'] = user.is_active if hasattr(user, 'is_active') else True
            users.append(user_dict)
        
        current_app.logger.info(f"[LIST_ALL_USERS] Returning {len(users)} users")
        
        return jsonify({
            'users': users,
            'pagination': {
                'page': pagination.page,
                'pages': pagination.pages,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[LIST_ALL_USERS] Error: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch users'}), 500

@admin_routes_bp.route('/admin/super-admins', methods=['GET'])
@token_required
@admin_required
def list_all_super_admins():
    """List all super admins (Super Admin only)"""
    try:
        current_app.logger.info(f"[LIST_ALL_SUPER_ADMINS] Super admin {g.current_user.id} requesting all super admins")
        
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        search = request.args.get('search', '')
        
        # Build query
        query = Admin.query
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Admin.name.ilike(search_term),
                    Admin.username.ilike(search_term),
                    Admin.email.ilike(search_term)
                )
            )
        
        # Order by creation date (newest first)
        query = query.order_by(Admin.created_at.desc())
        
        # Get paginated results
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        admins = []
        for admin in pagination.items:
            admin_dict = admin.to_dict()
            # Add creator info if available
            if admin.created_by_admin_id:
                creator = Admin.query.get(admin.created_by_admin_id)
                admin_dict['created_by'] = creator.username if creator else 'Unknown'
            else:
                admin_dict['created_by'] = 'System'
            admins.append(admin_dict)
        
        current_app.logger.info(f"[LIST_ALL_SUPER_ADMINS] Returning {len(admins)} super admins")
        
        return jsonify({
            'admins': admins,
            'pagination': {
                'page': pagination.page,
                'pages': pagination.pages,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"[LIST_ALL_SUPER_ADMINS] Error: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch super admins'}), 500

@admin_routes_bp.route('/admin/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(user_id):
    """Delete a regular user or business admin (Super Admin only)"""
    try:
        current_app.logger.info(f"[DELETE_USER] Super admin {g.current_user.id} attempting to delete user {user_id}")
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Store user info for logging
        user_info = f"{user.username} ({user.email})"
        user_role = user.role
        
        current_app.logger.info(f"[DELETE_USER] Deleting user {user_info} with role {user_role}")
        
        # Check for related records that might prevent deletion
        from app.models import Submission, Response, QuestCompletion, UserBadge, UserRewardLog, AIPointsUsageLog, StripeTransaction
        
        submissions_count = Submission.query.filter_by(user_id=user_id).count()
        quest_completions_count = QuestCompletion.query.filter_by(user_id=user_id).count()
        badges_count = UserBadge.query.filter_by(user_id=user_id).count()
        rewards_count = UserRewardLog.query.filter_by(user_id=user_id).count()
        ai_usage_count = AIPointsUsageLog.query.filter_by(user_id=user_id).count()
        stripe_transactions_count = StripeTransaction.query.filter_by(user_id=user_id).count()
        
        current_app.logger.info(f"[DELETE_USER] User {user_id} has {submissions_count} submissions, {quest_completions_count} quest completions, {badges_count} badges, {rewards_count} rewards, {ai_usage_count} AI usage logs, {stripe_transactions_count} stripe transactions")
        
        # For business admins, check if they created any surveys or quests
        if user.role == 'business_admin':
            from app.models import Survey, Quest, Item, BusinessActivity
            surveys_created = Survey.query.filter_by(business_id=user.business_id).count() if user.business_id else 0
            quests_created = Quest.query.filter_by(created_by_user_id=user_id).count()
            items_created = Item.query.filter_by(user_id=user_id).count()
            activities_created = BusinessActivity.query.filter_by(user_id=user_id).count()
            
            current_app.logger.info(f"[DELETE_USER] Business admin {user_id} created {surveys_created} surveys (for business), {quests_created} quests, {items_created} items, {activities_created} activities")
        
        # Manual cleanup of related records that might not have proper cascade delete
        try:
            # Clean up related records manually to ensure proper deletion
            from app.models import (Submission, Response, QuestCompletion, UserBadge, UserRewardLog, 
                                    AIPointsUsageLog, StripeTransaction, LinkedAccount, PasswordResetToken,
                                    EmailVerificationToken, TempAuthToken, UserDailyActivity, UserQuestProgress,
                                    DiscordServerMembership, OneTimePIN, Quest, Item, BusinessActivity, QuestLinkClick,
                                    FeatureRequest)
            
            current_app.logger.info(f"[DELETE_USER] Starting manual cleanup for user {user_id}")
            
            # 1. Delete all token-related records (these have CASCADE DELETE but delete explicitly for safety)
            PasswordResetToken.query.filter_by(user_id=user_id).delete()
            EmailVerificationToken.query.filter_by(user_id=user_id).delete()
            TempAuthToken.query.filter_by(user_id=user_id).delete()
            OneTimePIN.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted tokens for user {user_id}")
            
            # 2. Delete linked accounts (NOT NULL constraint - must delete, not nullify)
            LinkedAccount.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted linked accounts for user {user_id}")
            
            # 3. Delete user badges (NOT NULL constraint - must delete, not nullify)
            UserBadge.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted user badges for user {user_id}")
            
            # 4. Delete user reward logs (NOT NULL constraint - must delete, not nullify)
            UserRewardLog.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted user reward logs for user {user_id}")
            
            # 5. Delete quest completions (NOT NULL constraint - must delete, not nullify)
            QuestCompletion.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted quest completions for user {user_id}")
            
            # 6. Delete quest link clicks (NOT NULL constraint - must delete, not nullify)
            QuestLinkClick.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted quest link clicks for user {user_id}")
            
            # 7. Delete daily activities (has CASCADE DELETE but delete explicitly)
            UserDailyActivity.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted daily activities for user {user_id}")
            
            # 8. Delete quest progress (has CASCADE DELETE but delete explicitly)
            UserQuestProgress.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted quest progress for user {user_id}")
            
            # 9. Delete Discord memberships (has CASCADE DELETE but delete explicitly)
            DiscordServerMembership.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted Discord memberships for user {user_id}")
            
            # 10. Handle feature requests (NOT NULL constraint - must delete, not nullify)
            FeatureRequest.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted feature requests for user {user_id}")
            
            # 10.5. Handle items (bugs/features) - check if user_id has NOT NULL constraint
            items_to_delete = Item.query.filter_by(user_id=user_id).all()
            if items_to_delete:
                try:
                    # Try to nullify first (in case it's nullable)
                    for item in items_to_delete:
                        item.user_id = None
                    db.session.flush()  # Test if this works
                    current_app.logger.info(f"[DELETE_USER] Nullified user_id for {len(items_to_delete)} items")
                except Exception as item_error:
                    # If nullifying fails (NOT NULL constraint), delete the items
                    current_app.logger.info(f"[DELETE_USER] Cannot nullify items (NOT NULL constraint), deleting {len(items_to_delete)} items")
                    db.session.rollback()
                    Item.query.filter_by(user_id=user_id).delete()
            
            # 11. For business admin specific cleanup
            if user.role == 'business_admin':
                current_app.logger.info(f"[DELETE_USER] Cleaning up business admin specific records for user {user_id}")
                
                # Update or delete quests created by this admin (depending on business policy)
                quests_created = Quest.query.filter_by(created_by_user_id=user_id).all()
                for quest in quests_created:
                    # Option 1: Set to null (orphan the quest)
                    quest.created_by_user_id = None
                    # Option 2: Could also delete the quest entirely if business prefers
                    # db.session.delete(quest)
                current_app.logger.info(f"[DELETE_USER] Updated {len(quests_created)} quests created by user {user_id}")
                
                # Items are already handled in step 10.5 above
                
                # Update business activities - nullify user_id for historical records
                activities_created = BusinessActivity.query.filter_by(user_id=user_id).all()
                for activity in activities_created:
                    activity.user_id = None
                current_app.logger.info(f"[DELETE_USER] Updated {len(activities_created)} business activities by user {user_id}")
            
            # 12. Handle business logs that should preserve business records but nullify user reference
            # Update AI usage logs (keep for business records, just nullify user_id - this field is nullable)
            ai_logs_updated = AIPointsUsageLog.query.filter_by(user_id=user_id).update({'user_id': None})
            current_app.logger.info(f"[DELETE_USER] Updated {ai_logs_updated} AI usage logs for user {user_id}")
            
            # Update Stripe transactions (keep for business records, just nullify user_id - this field is nullable)
            stripe_logs_updated = StripeTransaction.query.filter_by(user_id=user_id).update({'user_id': None})
            current_app.logger.info(f"[DELETE_USER] Updated {stripe_logs_updated} Stripe transactions for user {user_id}")
            
            # Delete points logs (user_id is NOT NULL, so we must delete these records)
            points_logs_count = PointsLog.query.filter_by(user_id=user_id).count()
            PointsLog.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted {points_logs_count} points log entries for user {user_id}")
            
            # 13. Handle submissions and responses (these should have proper CASCADE but let's be explicit)
            # Delete responses related to user's submissions
            user_submission_ids = [s.id for s in Submission.query.filter_by(user_id=user_id).all()]
            if user_submission_ids:
                response_count = Response.query.filter(Response.submission_id.in_(user_submission_ids)).count()
                Response.query.filter(Response.submission_id.in_(user_submission_ids)).delete(synchronize_session=False)
                current_app.logger.info(f"[DELETE_USER] Deleted {response_count} responses for user {user_id}")
            
            # Delete user's submissions
            submission_count = Submission.query.filter_by(user_id=user_id).count()
            Submission.query.filter_by(user_id=user_id).delete()
            current_app.logger.info(f"[DELETE_USER] Deleted {submission_count} submissions for user {user_id}")
            
            # 14. Commit all the cleanup changes before deleting the user
            db.session.commit()
            current_app.logger.info(f"[DELETE_USER] Committed all cleanup changes for user {user_id}")
            
            # 15. Finally, delete the user
            db.session.delete(user)
            db.session.commit()
            
            current_app.logger.info(f"[DELETE_USER] Successfully deleted {user_role} user: {user_info} with comprehensive manual cleanup")
            
        except Exception as cleanup_error:
            current_app.logger.error(f"[DELETE_USER] Error during manual cleanup for user {user_id}: {cleanup_error}", exc_info=True)
            # Rollback any partial changes
            db.session.rollback()
            
            # Try a more aggressive direct deletion as absolute fallback
            try:
                current_app.logger.info(f"[DELETE_USER] Attempting direct deletion for user {user_id}")
                # Force delete all relationships first using raw SQL if needed
                from sqlalchemy import text
                db.session.execute(text("DELETE FROM quest_link_clicks WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM quest_completions WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM feature_requests WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM user_badges WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM user_reward_logs WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM linked_accounts WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("DELETE FROM items WHERE user_id = :user_id"), {"user_id": user_id})
                
                # Delete records with NOT NULL user_id constraints
                db.session.execute(text("DELETE FROM points_log WHERE user_id = :user_id"), {"user_id": user_id})
                
                # Update nullable fields
                db.session.execute(text("UPDATE ai_points_usage_logs SET user_id = NULL WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("UPDATE stripe_transactions SET user_id = NULL WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("UPDATE business_activities SET user_id = NULL WHERE user_id = :user_id"), {"user_id": user_id})
                db.session.execute(text("UPDATE quests SET created_by_user_id = NULL WHERE created_by_user_id = :user_id"), {"user_id": user_id})
                
                db.session.commit()
                
                # Now try to delete the user again
                user = User.query.get(user_id)
                if user:
                    db.session.delete(user)
                    db.session.commit()
                    current_app.logger.info(f"[DELETE_USER] Fallback deletion successful for {user_role} user: {user_info}")
                else:
                    current_app.logger.error(f"[DELETE_USER] User {user_id} not found during fallback deletion")
                    return jsonify({'error': 'User not found during deletion'}), 404
                    
            except Exception as fallback_error:
                current_app.logger.error(f"[DELETE_USER] Fallback deletion also failed for user {user_id}: {fallback_error}", exc_info=True)
                db.session.rollback()
                return jsonify({'error': f'Failed to delete user: {str(fallback_error)}'}), 500
        
        return jsonify({
            'message': f'User {user_info} deleted successfully',
            'deleted_user': {
                'id': user_id,
                'username': user.username,
                'email': user.email,
                'role': user_role
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[DELETE_USER] Error deleting user {user_id}: {e}", exc_info=True)
        # Provide more specific error information
        if "foreign key constraint" in str(e).lower():
            return jsonify({'error': 'Cannot delete user due to related data. Please contact support.'}), 400
        elif "integrity constraint" in str(e).lower():
            return jsonify({'error': 'Cannot delete user due to database constraints. Please contact support.'}), 400
        else:
            return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500

@admin_routes_bp.route('/admin/super-admins/<int:admin_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_super_admin(admin_id):
    """Delete a super admin (Super Admin only)"""
    try:
        current_app.logger.info(f"[DELETE_SUPER_ADMIN] Super admin {g.current_user.id} attempting to delete super admin {admin_id}")
        
        # Prevent self-deletion
        if admin_id == g.current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        admin = Admin.query.get(admin_id)
        if not admin:
            return jsonify({'error': 'Super admin not found'}), 404
        
        # Store admin info for logging
        admin_info = f"{admin.username} ({admin.email})"
        
        # Check if this is the last super admin
        total_admins = Admin.query.count()
        if total_admins <= 1:
            return jsonify({'error': 'Cannot delete the last super admin account'}), 400
        
        # Delete the admin
        db.session.delete(admin)
        db.session.commit()
        
        current_app.logger.info(f"[DELETE_SUPER_ADMIN] Successfully deleted super admin: {admin_info}")
        
        return jsonify({
            'message': f'Super admin {admin_info} deleted successfully',
            'deleted_admin': {
                'id': admin_id,
                'username': admin.username,
                'email': admin.email
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[DELETE_SUPER_ADMIN] Error deleting super admin {admin_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete super admin'}), 500

@admin_routes_bp.route('/admin/users/<int:user_id>/toggle-status', methods=['POST'])
@token_required
@admin_required
def toggle_user_status(user_id):
    """Toggle user active/inactive status (Super Admin only)"""
    try:
        current_app.logger.info(f"[TOGGLE_USER_STATUS] Super admin {g.current_user.id} toggling status for user {user_id}")
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Toggle the active status
        if hasattr(user, 'is_active'):
            user.is_active = not user.is_active
        else:
            # If is_active field doesn't exist, add it as True by default
            user.is_active = False
        
        db.session.commit()
        
        status = "activated" if user.is_active else "deactivated"
        current_app.logger.info(f"[TOGGLE_USER_STATUS] User {user.username} {status}")
        
        return jsonify({
            'message': f'User {user.username} {status} successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[TOGGLE_USER_STATUS] Error toggling status for user {user_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to toggle user status'}), 500

@admin_routes_bp.route('/admin/stats', methods=['GET'])
@token_required
@admin_required
def get_admin_stats():
    """Get platform statistics (Super Admin only)"""
    try:
        current_app.logger.info(f"[GET_ADMIN_STATS] Super admin {g.current_user.id} requesting platform stats")
        
        # Count users by role
        total_users = User.query.count()
        business_admins = User.query.filter_by(role='business_admin').count()
        regular_users = User.query.filter(
            or_(User.role == 'user', User.role.is_(None))
        ).count()
        
        # Count super admins
        total_super_admins = Admin.query.count()
        
        # Count active users (if is_active field exists)
        try:
            active_users = User.query.filter_by(is_active=True).count()
        except:
            active_users = total_users  # Fallback if is_active doesn't exist
        
        stats = {
            'total_users': total_users,
            'regular_users': regular_users,
            'business_admins': business_admins,
            'super_admins': total_super_admins,
            'active_users': active_users,
            'inactive_users': total_users - active_users
        }
        
        current_app.logger.info(f"[GET_ADMIN_STATS] Returning stats: {stats}")
        
        return jsonify({'stats': stats}), 200
        
    except Exception as e:
        current_app.logger.error(f"[GET_ADMIN_STATS] Error: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch statistics'}), 500 
@admin_routes_bp.route('/admin/dashboard-summary', methods=['GET'])
@token_required
@admin_required
def get_admin_dashboard_summary_route():
    """Get counts of pending tasks for the super admin dashboard."""
    from app.controllers.admin_dashboard_controller import get_admin_dashboard_summary
    result, status = get_admin_dashboard_summary()
    return jsonify(result), status
