"""
Admin Share Routes
Admin-specific routes for managing the Share to Earn XP feature
"""

from flask import Blueprint, request, jsonify, render_template_string
from ..controllers.share_controller import ShareController, get_share_config, update_share_config
from ..models import SystemConfiguration, ShareAnalytics, UserShare, ShareType
from ..controllers.auth_controller import admin_required, token_required
from flask import current_app
from datetime import datetime, timedelta
from sqlalchemy import func

# Create blueprint
admin_share_bp = Blueprint('admin_share', __name__)

@admin_share_bp.route('/admin/shares/dashboard', methods=['GET'])
@token_required
@admin_required
def share_dashboard():
    """Admin dashboard for share-to-earn feature with analytics"""
    try:
        # Get current configuration
        config = get_share_config()
        
        # Get analytics summary for last 30 days
        analytics = ShareController.get_share_analytics_summary(30)
        
        # Get recent shares
        recent_shares = UserShare.query.order_by(UserShare.created_at.desc()).limit(10).all()
        
        # Get top performing share types
        share_performance = {}
        for share_type in [e.value for e in ShareType]:
            shares_count = UserShare.query.filter_by(share_type=share_type).count()
            total_xp = UserShare.query.filter_by(share_type=share_type)\
                .with_entities(func.sum(UserShare.xp_earned)).scalar() or 0
            
            share_performance[share_type] = {
                'count': shares_count,
                'total_xp': total_xp,
                'avg_xp': total_xp / shares_count if shares_count > 0 else 0
            }
        
        dashboard_data = {
            'config': config,
            'analytics': analytics,
            'recent_shares': [share.to_dict() for share in recent_shares],
            'share_performance': share_performance,
            'feature_enabled': SystemConfiguration.get_config('share_to_earn_enabled', True)
        }
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in share dashboard: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/config/bulk-update', methods=['PUT'])
@token_required
@admin_required
def bulk_update_config():
    """Bulk update share configuration settings"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Configuration data is required'}), 400
        
        updated_configs = []
        errors = []
        
        # Define allowed config keys and their types
        allowed_configs = {
            'share_to_earn_enabled': 'boolean',
            'join_share_prompt_duration_hours': 'integer',
            'xp_reward_join_share': 'integer',
            'xp_reward_badge_share': 'integer',
            'xp_reward_reward_redemption_share': 'integer',
            'xp_reward_raffle_win_share': 'integer',
            'xp_reward_raffle_entry_share': 'integer',
            'share_text_join_share': 'string',
            'share_text_badge_share': 'string',
            'share_text_reward_redemption_share': 'string',
            'share_text_raffle_win_share': 'string',
            'share_text_raffle_entry_share': 'string'
        }
        
        for key, value in data.items():
            if key not in allowed_configs:
                errors.append(f"Unknown configuration key: {key}")
                continue
            
            try:
                config_type = allowed_configs[key]
                
                # Validate value based on type
                if config_type == 'integer' and not isinstance(value, int):
                    errors.append(f"Invalid value for {key}: must be an integer")
                    continue
                elif config_type == 'boolean' and not isinstance(value, bool):
                    errors.append(f"Invalid value for {key}: must be a boolean")
                    continue
                elif config_type == 'string' and not isinstance(value, str):
                    errors.append(f"Invalid value for {key}: must be a string")
                    continue
                
                # Additional validation for specific keys
                if key.startswith('xp_reward_') and value < 0:
                    errors.append(f"XP reward values must be non-negative: {key}")
                    continue
                
                if key == 'join_share_prompt_duration_hours' and (value < 1 or value > 168):  # Max 1 week
                    errors.append(f"Join share prompt duration must be between 1 and 168 hours")
                    continue
                
                # Update configuration
                config = SystemConfiguration.set_config(
                    key, value, config_type, category='share_to_earn'
                )
                updated_configs.append(config.to_dict())
                
            except Exception as e:
                errors.append(f"Error updating {key}: {str(e)}")
        
        if errors:
            return jsonify({
                'success': False,
                'errors': errors,
                'updated_configs': updated_configs
            }), 400
        
        return jsonify({
            'success': True,
            'updated_configs': updated_configs,
            'message': f'Successfully updated {len(updated_configs)} configuration settings'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in bulk config update: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/analytics/detailed', methods=['GET'])
@token_required
@admin_required
def get_detailed_analytics():
    """Get detailed analytics for share-to-earn feature"""
    try:
        days = request.args.get('days', 30, type=int)
        share_type = request.args.get('share_type')
        
        # Limit days to prevent excessive queries
        days = min(days, 365)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Base query for analytics
        analytics_query = ShareAnalytics.query.filter(ShareAnalytics.created_at >= cutoff_date)
        shares_query = UserShare.query.filter(UserShare.created_at >= cutoff_date)
        
        # Filter by share type if specified
        if share_type:
            analytics_query = analytics_query.filter(ShareAnalytics.share_type == share_type)
            shares_query = shares_query.filter(UserShare.share_type == share_type)
        
        # Get daily breakdown
        daily_analytics = analytics_query.with_entities(
            func.date(ShareAnalytics.created_at).label('date'),
            ShareAnalytics.event_type,
            ShareAnalytics.share_type,
            func.count(ShareAnalytics.id).label('count')
        ).group_by(
            func.date(ShareAnalytics.created_at),
            ShareAnalytics.event_type,
            ShareAnalytics.share_type
        ).all()
        
        daily_shares = shares_query.with_entities(
            func.date(UserShare.created_at).label('date'),
            UserShare.share_type,
            func.count(UserShare.id).label('count'),
            func.sum(UserShare.xp_earned).label('total_xp')
        ).group_by(
            func.date(UserShare.created_at),
            UserShare.share_type
        ).all()
        
        # Get user engagement metrics
        unique_users = shares_query.with_entities(
            func.count(func.distinct(UserShare.user_id)).label('unique_users')
        ).scalar()
        
        repeat_sharers = shares_query.with_entities(
            UserShare.user_id,
            func.count(UserShare.id).label('share_count')
        ).group_by(UserShare.user_id).having(func.count(UserShare.id) > 1).all()
        
        # Format daily data
        daily_data = {}
        for record in daily_analytics:
            date_str = record.date.isoformat()
            if date_str not in daily_data:
                daily_data[date_str] = {}
            
            key = f"{record.event_type}_{record.share_type}"
            daily_data[date_str][key] = record.count
        
        for record in daily_shares:
            date_str = record.date.isoformat()
            if date_str not in daily_data:
                daily_data[date_str] = {}
            
            daily_data[date_str][f"shares_{record.share_type}"] = record.count
            daily_data[date_str][f"xp_{record.share_type}"] = record.total_xp
        
        return jsonify({
            'period_days': days,
            'share_type_filter': share_type,
            'daily_data': daily_data,
            'unique_users': unique_users,
            'repeat_sharers_count': len(repeat_sharers),
            'avg_shares_per_user': len(repeat_sharers) / unique_users if unique_users > 0 else 0
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in detailed analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/users/top-sharers', methods=['GET'])
@token_required
@admin_required
def get_top_sharers():
    """Get top users by share activity"""
    try:
        limit = request.args.get('limit', 10, type=int)
        days = request.args.get('days', 30, type=int)
        
        # Limit to prevent abuse
        limit = min(limit, 100)
        days = min(days, 365)
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get top sharers
        top_sharers = UserShare.query.filter(UserShare.created_at >= cutoff_date)\
            .with_entities(
                UserShare.user_id,
                func.count(UserShare.id).label('share_count'),
                func.sum(UserShare.xp_earned).label('total_xp_earned')
            ).group_by(UserShare.user_id)\
            .order_by(func.count(UserShare.id).desc())\
            .limit(limit).all()
        
        # Get user details
        from ..models import User
        top_sharers_data = []
        for sharer in top_sharers:
            user = User.query.get(sharer.user_id)
            if user:
                top_sharers_data.append({
                    'user_id': sharer.user_id,
                    'username': user.username,
                    'name': user.name,
                    'share_count': sharer.share_count,
                    'total_xp_earned': sharer.total_xp_earned,
                    'user_created_at': user.created_at.isoformat() if user.created_at else None
                })
        
        return jsonify({
            'top_sharers': top_sharers_data,
            'period_days': days,
            'limit': limit
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting top sharers: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/config/reset-defaults', methods=['POST'])
@token_required
@admin_required
def reset_to_defaults():
    """Reset share configuration to default values"""
    try:
        success = ShareController.initialize_default_configs()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Share configuration reset to default values'
            }), 200
        else:
            return jsonify({
                'error': 'Failed to reset configuration'
            }), 500
        
    except Exception as e:
        current_app.logger.error(f"Error resetting config: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/test-share-url', methods=['POST'])
@token_required
@admin_required
def test_share_url():
    """Test share URL generation for different share types"""
    try:
        data = request.get_json()
        
        if not data or 'share_type' not in data:
            return jsonify({'error': 'share_type is required'}), 400
        
        share_type = data['share_type']
        related_object_id = data.get('related_object_id')
        
        # Generate test URL
        result = ShareController.generate_share_url(share_type, related_object_id)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'success': True,
            'test_result': result,
            'share_type': share_type,
            'related_object_id': related_object_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error testing share URL: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_share_bp.route('/admin/shares/export/analytics', methods=['GET'])
@token_required
@admin_required
def export_analytics():
    """Export share analytics data as CSV"""
    try:
        days = request.args.get('days', 30, type=int)
        days = min(days, 365)
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all shares in the period
        shares = UserShare.query.filter(UserShare.created_at >= cutoff_date)\
            .order_by(UserShare.created_at.desc()).all()
        
        # Format as CSV data
        csv_data = []
        csv_data.append(['Date', 'User ID', 'Share Type', 'Related Object ID', 'XP Earned'])
        
        for share in shares:
            csv_data.append([
                share.created_at.isoformat() if share.created_at else '',
                share.user_id,
                share.share_type,
                share.related_object_id or '',
                share.xp_earned
            ])
        
        return jsonify({
            'csv_data': csv_data,
            'total_records': len(shares),
            'period_days': days
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error exporting analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# HTML template for admin dashboard (if needed for direct access)
ADMIN_DASHBOARD_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Share to Earn XP - Admin Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .config-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f5f5f5; }
        input, textarea { margin: 5px; padding: 5px; }
        button { padding: 10px 15px; margin: 5px; }
    </style>
</head>
<body>
    <h1>Share to Earn XP - Admin Dashboard</h1>
    
    <div class="config-section">
        <h2>Feature Status</h2>
        <p>Feature Enabled: <strong>{{ feature_enabled }}</strong></p>
    </div>
    
    <div class="config-section">
        <h2>Analytics Summary (Last 30 Days)</h2>
        <div class="metric">Total Shares: {{ analytics.total_shares or 0 }}</div>
        <div class="metric">Total XP Distributed: {{ analytics.total_xp_distributed or 0 }}</div>
    </div>
    
    <div class="config-section">
        <h2>Configuration</h2>
        <p>Use the API endpoints to manage configuration settings.</p>
        <ul>
            <li>GET /api/admin/shares/config - Get current config</li>
            <li>PUT /api/admin/shares/config/bulk-update - Update config</li>
            <li>POST /api/admin/shares/config/reset-defaults - Reset to defaults</li>
        </ul>
    </div>
</body>
</html>
"""

@admin_share_bp.route('/admin/shares/dashboard-html', methods=['GET'])
@token_required
@admin_required
def share_dashboard_html():
    """HTML dashboard for share-to-earn feature (for direct browser access)"""
    try:
        # Get basic data
        feature_enabled = SystemConfiguration.get_config('share_to_earn_enabled', True)
        analytics = ShareController.get_share_analytics_summary(30)
        
        return render_template_string(ADMIN_DASHBOARD_HTML, 
                                    feature_enabled=feature_enabled,
                                    analytics=analytics)
        
    except Exception as e:
        current_app.logger.error(f"Error in HTML dashboard: {str(e)}")
        return f"Error loading dashboard: {str(e)}", 500
