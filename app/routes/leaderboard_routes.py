# routes/leaderboard_routes.py
"""
Leaderboard Routes
API endpoints for XP leaderboard display and administration.
"""

from flask import Blueprint, request, jsonify, current_app, g
from app.controllers.auth_controller import token_required, admin_required
from app.controllers.leaderboard_controller import LeaderboardController
import logging

logger = logging.getLogger(__name__)

# Public leaderboard routes
leaderboard_bp = Blueprint('leaderboard', __name__, url_prefix='/api/leaderboard')

# Admin leaderboard routes
admin_leaderboard_bp = Blueprint('admin_leaderboard', __name__, url_prefix='/api/admin/leaderboard')


# PUBLIC ROUTES

@leaderboard_bp.route('', methods=['GET'])
@token_required
def get_leaderboard():
    """
    Get the current leaderboard with top users and current user's rank.
    
    Returns:
        200: Leaderboard data
        400: Bad request
        500: Internal server error
    """
    try:
        user_id = g.current_user.id
        data = LeaderboardController.get_formatted_leaderboard(user_id)
        
        if 'error' in data:
            if 'is_enabled' in data and not data['is_enabled']:
                return jsonify({'message': data['error'], 'is_enabled': False}), 200
            else:
                return jsonify({'error': data['error']}), 500
        
        return jsonify(data), 200
        
    except Exception as e:
        logger.error(f"Error in get_leaderboard: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving the leaderboard',
            'details': str(e) if current_app.debug else None
        }), 500


@leaderboard_bp.route('/my-rank', methods=['GET'])
@token_required
def get_my_rank():
    """
    Get the current user's rank in the leaderboard.
    
    Query Parameters:
        timeframe (optional): Specific timeframe to check (ALL_TIME, MONTHLY, WEEKLY, DAILY)
    
    Returns:
        200: User's rank data or null if not ranked
        500: Internal server error
    """
    try:
        user_id = g.current_user.id
        timeframe = request.args.get('timeframe', None)
        
        rank_data = LeaderboardController.get_user_rank(user_id, timeframe)
        
        return jsonify({
            'user_rank': rank_data,
            'timeframe': timeframe
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_my_rank: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving your rank',
            'details': str(e) if current_app.debug else None
        }), 500


@leaderboard_bp.route('/status', methods=['GET'])
def get_leaderboard_status():
    """
    Get leaderboard status information (no authentication required).
    
    Returns:
        200: Leaderboard status
        500: Internal server error
    """
    try:
        settings = LeaderboardController.get_leaderboard_settings()
        
        if 'error' in settings:
            return jsonify({'error': settings['error']}), 500
        
        # Return public status information
        public_status = {
            'is_enabled': settings.get('is_enabled', True),
            'active_timeframe': settings.get('active_timeframe', 'ALL_TIME'),
            'display_count': settings.get('display_count', 25),
            'last_updated': settings.get('last_cache_refresh')
        }
        
        return jsonify(public_status), 200
        
    except Exception as e:
        logger.error(f"Error in get_leaderboard_status: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving leaderboard status',
            'details': str(e) if current_app.debug else None
        }), 500


# ADMIN ROUTES

@admin_leaderboard_bp.route('/settings', methods=['GET'])
@token_required
@admin_required
def admin_get_settings():
    """
    Get detailed leaderboard settings (admin only).
    
    Returns:
        200: Leaderboard settings
        403: Forbidden (not admin)
        500: Internal server error
    """
    try:
        settings = LeaderboardController.get_leaderboard_settings()
        
        if 'error' in settings:
            return jsonify({'error': settings['error']}), 500
        
        return jsonify(settings), 200
        
    except Exception as e:
        logger.error(f"Error in admin_get_settings: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving settings',
            'details': str(e) if current_app.debug else None
        }), 500


@admin_leaderboard_bp.route('/settings', methods=['PUT'])
@token_required
@admin_required
def admin_update_settings():
    """
    Update leaderboard settings (admin only).
    
    Body Parameters:
        display_count (int, optional): Number of users to display (1-100)
        active_timeframe (str, optional): Active timeframe (ALL_TIME, MONTHLY, WEEKLY, DAILY)
        is_enabled (bool, optional): Enable/disable leaderboard
    
    Returns:
        200: Updated settings
        400: Bad request (validation error)
        403: Forbidden (not admin)
        500: Internal server error
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        result = LeaderboardController.update_leaderboard_settings(data)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'message': 'Leaderboard settings updated successfully',
            'settings': result
        }), 200
        
    except Exception as e:
        logger.error(f"Error in admin_update_settings: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while updating settings',
            'details': str(e) if current_app.debug else None
        }), 500


@admin_leaderboard_bp.route('/refresh', methods=['POST'])
@token_required
@admin_required
def admin_refresh_cache():
    """
    Manually refresh the leaderboard cache (admin only).
    
    Returns:
        200: Cache refresh successful
        403: Forbidden (not admin)
        500: Internal server error
    """
    try:
        result = LeaderboardController.refresh_leaderboard_cache()
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 500
        
    except Exception as e:
        logger.error(f"Error in admin_refresh_cache: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while refreshing the cache',
            'details': str(e) if current_app.debug else None
        }), 500


@admin_leaderboard_bp.route('/cache-status', methods=['GET'])
@token_required
@admin_required
def admin_get_cache_status():
    """
    Get detailed cache status information (admin only).
    
    Returns:
        200: Cache status information
        403: Forbidden (not admin)
        500: Internal server error
    """
    try:
        status = LeaderboardController.get_cache_status()
        
        if 'error' in status:
            return jsonify({'error': status['error']}), 500
        
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"Error in admin_get_cache_status: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving cache status',
            'details': str(e) if current_app.debug else None
        }), 500


@admin_leaderboard_bp.route('/user/<int:user_id>/rank', methods=['GET'])
@token_required
@admin_required
def admin_get_user_rank(user_id):
    """
    Get a specific user's rank in all timeframes (admin only).
    
    Path Parameters:
        user_id (int): ID of the user to check
    
    Returns:
        200: User's rank data across all timeframes
        403: Forbidden (not admin)
        404: User not found
        500: Internal server error
    """
    try:
        timeframes = ['ALL_TIME', 'MONTHLY', 'WEEKLY', 'DAILY']
        user_ranks = {}
        
        for timeframe in timeframes:
            rank_data = LeaderboardController.get_user_rank(user_id, timeframe)
            user_ranks[timeframe] = rank_data
        
        # Check if user exists (if at least one timeframe has data)
        has_data = any(rank_data is not None for rank_data in user_ranks.values())
        
        if not has_data:
            # Check if user exists in database
            from app.models import User
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user_id': user_id,
            'ranks': user_ranks
        }), 200
        
    except Exception as e:
        logger.error(f"Error in admin_get_user_rank: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'An error occurred while retrieving user rank',
            'details': str(e) if current_app.debug else None
        }), 500


# Error handlers for leaderboard routes
@leaderboard_bp.errorhandler(404)
def leaderboard_not_found(error):
    """Handle 404 errors for leaderboard routes."""
    return jsonify({'error': 'Leaderboard endpoint not found'}), 404


@admin_leaderboard_bp.errorhandler(404)
def admin_leaderboard_not_found(error):
    """Handle 404 errors for admin leaderboard routes."""
    return jsonify({'error': 'Admin leaderboard endpoint not found'}), 404
