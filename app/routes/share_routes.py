"""
Share Routes
API endpoints for the Share to Earn XP feature
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.share_controller import ShareController, get_share_config, update_share_config
from ..controllers.auth_controller import token_required, admin_required, business_admin_required
from flask import current_app

# Create blueprint
share_api = Blueprint('share_api', __name__)

@share_api.route('/shares/eligibility', methods=['GET'])
@token_required
def get_share_eligibility():
    """Get user's eligibility for different types of shares"""
    try:
        user_id = g.current_user.id
        eligibility = ShareController.get_share_eligibility(user_id)
        
        if 'error' in eligibility:
            return jsonify(eligibility), 400
        
        return jsonify(eligibility), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_share_eligibility: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/generate-url', methods=['POST'])
@token_required
def generate_share_url():
    """Generate X (Twitter) share URL with pre-filled text"""
    try:
        data = request.get_json()
        
        if not data or 'share_type' not in data:
            return jsonify({'error': 'share_type is required'}), 400
        
        share_type = data['share_type']
        related_object_id = data.get('related_object_id')
        user_id = g.current_user.id
        
        result = ShareController.generate_share_url(share_type, related_object_id, user_id)
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Record analytics - button clicked
        session_id = request.headers.get('X-Session-ID')
        ShareController.record_share_button_clicked(
            user_id, share_type, related_object_id, session_id
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in generate_share_url: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/confirm', methods=['POST'])
@token_required
def confirm_share():
    """Confirm a share action and award XP"""
    try:
        data = request.get_json()
        
        if not data or 'share_type' not in data:
            return jsonify({'error': 'share_type is required'}), 400
        
        share_type = data['share_type']
        related_object_id = data.get('related_object_id')
        user_id = g.current_user.id
        
        # Get request metadata for analytics
        session_id = request.headers.get('X-Session-ID')
        user_agent = request.headers.get('User-Agent')
        ip_address = request.remote_addr
        
        result, status_code = ShareController.confirm_share(
            user_id, share_type, related_object_id, 
            session_id, user_agent, ip_address
        )
        
        return jsonify(result), status_code
        
    except Exception as e:
        current_app.logger.error(f"Error in confirm_share: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/prompt-shown', methods=['POST'])
@token_required
def record_prompt_shown():
    """Record when a share prompt is shown to user"""
    try:
        data = request.get_json()
        
        if not data or 'share_type' not in data:
            return jsonify({'error': 'share_type is required'}), 400
        
        share_type = data['share_type']
        related_object_id = data.get('related_object_id')
        user_id = g.current_user.id
        session_id = request.headers.get('X-Session-ID')
        
        ShareController.record_share_prompt_shown(
            user_id, share_type, related_object_id, session_id
        )
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in record_prompt_shown: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/history', methods=['GET'])
@token_required
def get_share_history():
    """Get user's share history"""
    try:
        user_id = g.current_user.id
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Limit per_page to prevent abuse
        per_page = min(per_page, 100)
        
        history = ShareController.get_user_share_history(user_id, page, per_page)
        
        if 'error' in history:
            return jsonify(history), 400
        
        return jsonify(history), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_share_history: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Admin routes

@share_api.route('/admin/shares/config', methods=['GET'])
@token_required
@admin_required
def get_admin_share_config():
    """Get share-to-earn configuration settings (Admin only)"""
    try:
        config = get_share_config()
        
        if 'error' in config:
            return jsonify(config), 400
        
        return jsonify(config), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_admin_share_config: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/admin/shares/config', methods=['PUT'])
@token_required
@admin_required
def update_admin_share_config():
    """Update share-to-earn configuration settings (Admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Configuration data is required'}), 400
        
        result = update_share_config(data)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in update_admin_share_config: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/admin/shares/analytics', methods=['GET'])
@token_required
@admin_required
def get_share_analytics():
    """Get share analytics summary (Admin only)"""
    try:
        days = request.args.get('days', 30, type=int)
        
        # Limit days to prevent excessive queries
        days = min(days, 365)
        
        analytics = ShareController.get_share_analytics_summary(days)
        
        if 'error' in analytics:
            return jsonify(analytics), 400
        
        return jsonify(analytics), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_share_analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/admin/shares/initialize-config', methods=['POST'])
@token_required
@admin_required
def initialize_share_config():
    """Initialize default share-to-earn configuration (Admin only)"""
    try:
        success = ShareController.initialize_default_configs()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Share-to-earn configuration initialized successfully'
            }), 200
        else:
            return jsonify({
                'error': 'Failed to initialize configuration'
            }), 500
        
    except Exception as e:
        current_app.logger.error(f"Error in initialize_share_config: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Helper routes for frontend integration

@share_api.route('/shares/check-status/<share_type>', methods=['GET'])
@token_required
def check_share_status(share_type):
    """Check if user has already shared for a specific type and object"""
    try:
        user_id = g.current_user.id
        related_object_id = request.args.get('related_object_id', type=int)
        
        from ..models import UserShare
        
        existing_share = UserShare.query.filter(
            UserShare.user_id == user_id,
            UserShare.share_type == share_type,
            UserShare.related_object_id == related_object_id
        ).first()
        
        return jsonify({
            'already_shared': existing_share is not None,
            'share_date': existing_share.created_at.isoformat() if existing_share else None,
            'xp_earned': existing_share.xp_earned if existing_share else None
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in check_share_status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/available-badges', methods=['GET'])
@token_required
def get_available_badge_shares():
    """Get badges that user can share"""
    try:
        user_id = g.current_user.id
        badges = ShareController._get_available_badge_shares(user_id)
        
        return jsonify({'available_badges': badges}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_available_badge_shares: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/available-rewards', methods=['GET'])
@token_required
def get_available_reward_shares():
    """Get reward redemptions that user can share"""
    try:
        user_id = g.current_user.id
        rewards = ShareController._get_available_reward_shares(user_id)
        
        return jsonify({'available_rewards': rewards}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_available_reward_shares: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@share_api.route('/shares/available-raffles', methods=['GET'])
@token_required
def get_available_raffle_shares():
    """Get raffle wins that user can share"""
    try:
        user_id = g.current_user.id
        raffles = ShareController._get_available_raffle_shares(user_id)
        
        return jsonify({'available_raffles': raffles}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_available_raffle_shares: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Business admin routes (if needed for business-specific share settings)

@share_api.route('/business/<int:business_id>/shares/config', methods=['GET'])
@business_admin_required
def get_business_share_config(business_id):
    """Get business-specific share configuration (if implemented)"""
    try:
        # For now, return global config
        # This could be extended to support business-specific settings
        config = get_share_config()
        
        if 'error' in config:
            return jsonify(config), 400
        
        return jsonify({
            'business_id': business_id,
            'config': config,
            'note': 'Currently using global configuration'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_business_share_config: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
