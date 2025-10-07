from flask import Blueprint, request, jsonify, g
from app.controllers.idea_controller import IdeaController
from app.controllers.auth_controller import token_required, business_admin_required, token_optional
import logging

idea_blueprint = Blueprint('ideas', __name__)

@idea_blueprint.route('/api/businesses/<int:business_id>/ideas/top', methods=['GET'])
@token_optional
def get_top_ideas(business_id):
    """Get top ideas for a business (public endpoint)"""
    try:
        limit = request.args.get('limit', '5')
        limit = min(int(limit), 20)  # Cap at 20
        
        current_user_id = getattr(g, 'current_user', None)
        current_user_id = current_user_id.id if current_user_id else None
        ideas = IdeaController.list_top_ideas(business_id, limit, current_user_id)
        return jsonify({"data": ideas}), 200
        
    except ValueError:
        return jsonify({"error": "Invalid limit parameter"}), 400
    except Exception as e:
        logging.error(f"Error getting top ideas: {e}")
        return jsonify({"error": "Failed to get top ideas"}), 500

@idea_blueprint.route('/api/businesses/<int:business_id>/ideas/public', methods=['GET'])
@token_optional
def get_public_ideas(business_id):
    """Get public ideas for a business with filtering"""
    try:
        # Get query parameters
        params = {
            'search': request.args.get('search', ''),
            'sort': request.args.get('sort', 'newest'),
            'min_likes': request.args.get('min_likes'),
            'max_likes': request.args.get('max_likes'),
            'days_left_filter': request.args.get('days_left_filter', 'all')
        }
        
        # Clean up None values and convert numbers
        cleaned_params = {}
        for key, value in params.items():
            if value is not None and value != '':
                if key in ['min_likes', 'max_likes']:
                    try:
                        cleaned_params[key] = int(value)
                    except (ValueError, TypeError):
                        pass
                else:
                    cleaned_params[key] = value
        
        current_user_id = getattr(g, 'current_user', None)
        current_user_id = current_user_id.id if current_user_id else None
        ideas, status_code = IdeaController.list_public_ideas(business_id, cleaned_params, current_user_id)
        return jsonify(ideas), status_code
        
    except Exception as e:
        logging.error(f"Error getting public ideas: {e}")
        return jsonify({"error": "Failed to get ideas"}), 500

@idea_blueprint.route('/api/ideas/<int:idea_id>', methods=['GET'])
@token_optional
def get_idea_details(idea_id):
    """Get detailed idea information"""
    try:
        current_user_id = getattr(g, 'current_user', None)
        current_user_id = current_user_id.id if current_user_id else None
        idea_data, status_code = IdeaController.get_public_idea(idea_id, current_user_id)
        return jsonify(idea_data), status_code
        
    except Exception as e:
        logging.error(f"Error getting idea details: {e}")
        return jsonify({"error": "Failed to get idea details"}), 500

@idea_blueprint.route('/api/businesses/<int:business_id>/ideas', methods=['POST'])
@token_required
def create_idea(business_id):
    """Create a new idea (requires authentication)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        if not data.get('title'):
            return jsonify({"error": "Title is required"}), 400
            
        # Create idea
        result, status_code = IdeaController.create_idea(business_id, data, g.current_user)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error creating idea: {e}")
        return jsonify({"error": "Failed to create idea"}), 500

@idea_blueprint.route('/api/ideas/<int:idea_id>/like', methods=['POST'])
@token_required
def like_idea(idea_id):
    """Like or unlike an idea"""
    try:
        result, status_code = IdeaController.like_idea(idea_id, g.current_user)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error liking idea: {e}")
        return jsonify({"error": "Failed to like idea"}), 500

@idea_blueprint.route('/api/ideas/<int:idea_id>/comments', methods=['GET'])
def get_idea_comments(idea_id):
    """Get comments for an idea"""
    try:
        result, status_code = IdeaController.list_comments(idea_id)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error getting comments: {e}")
        return jsonify({"error": "Failed to get comments"}), 500

@idea_blueprint.route('/api/ideas/<int:idea_id>/comments', methods=['POST'])
@token_required
def add_idea_comment(idea_id):
    """Add a comment to an idea"""
    try:
        data = request.get_json()
        if not data or not data.get('body'):
            return jsonify({"error": "Comment body is required"}), 400
            
        result, status_code = IdeaController.add_comment(idea_id, g.current_user, data)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error adding comment: {e}")
        return jsonify({"error": "Failed to add comment"}), 500

# Admin endpoints
@idea_blueprint.route('/api/admin/businesses/<int:business_id>/ideas', methods=['GET'])
@token_required
@business_admin_required
def get_admin_ideas(business_id):
    """Get ideas for admin management"""
    try:
        # Check if user can access this business
        if g.user_role == 'business_admin' and g.current_user.business_id != business_id:
            return jsonify({"error": "Access denied"}), 403
            
        params = {
            'status': request.args.get('status'),
            'sort': request.args.get('sort', 'newest')
        }
        
        # Clean up None values
        cleaned_params = {k: v for k, v in params.items() if v is not None}
        
        result, status_code = IdeaController.list_admin_ideas(business_id, cleaned_params)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error getting admin ideas: {e}")
        return jsonify({"error": "Failed to get ideas"}), 500

@idea_blueprint.route('/api/admin/ideas/<int:idea_id>/review', methods=['PUT'])
@token_required
@business_admin_required
def review_idea(idea_id):
    """Review an idea (approve, reject, etc.)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Map frontend status to backend action
        status_to_action = {
            'PUBLISHED': 'APPROVE',
            'REJECTED': 'REJECT',
            'ARCHIVED': 'ARCHIVE',
            'UNDER_REVIEW': 'UPDATE'  # For updating milestones/support while keeping under review
        }
        
        status = data.get('status')
        if status not in status_to_action:
            return jsonify({"error": "Invalid status"}), 400
            
        # Prepare payload
        payload = {
            'action': status_to_action[status],
            'reason': data.get('review_notes', ''),
            'milestones': data.get('milestones', []),
            'status': status  # Pass the requested status to the controller
        }
        
        # Add support duration if provided
        if data.get('support_days'):
            payload['support_duration_days'] = data['support_days']
        elif data.get('support_duration_days'):
            payload['support_duration_days'] = data['support_duration_days']
        elif data.get('support_ends_at'):
            payload['support_ends_at'] = data['support_ends_at']
        
        result, status_code = IdeaController.review_idea(idea_id, g.current_user, payload)
        return jsonify(result), status_code
        
    except Exception as e:
        logging.error(f"Error reviewing idea: {e}")
        return jsonify({"error": "Failed to review idea"}), 500