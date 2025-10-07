"""
Profile Routes
Handles user profile management and XP earning for profile completion
"""

from flask import Blueprint, request, jsonify, g
from ..controllers.profile_controller import (
    get_profile, update_profile, get_available_tags,
    create_profile_tag, get_all_profile_tags, update_profile_tag, delete_profile_tag,
    get_linked_accounts
)
from ..controllers.xp_badge_controller import get_user_badges, get_user_xp_summary, get_user_dashboard_overview, get_user_badge_overview, check_and_award_badges
from ..controllers.auth_controller import token_required, admin_required, AuthController
from ..controllers import profile_controller
from flask import current_app


profile_bp = Blueprint('profile', __name__)

# User routes

@profile_bp.route('/profile', methods=['GET'])
@token_required
def get_user_profile():
    """Get user's profile data"""
    try:
        # Ensure g.current_user is set by the @token_required decorator
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User context not found or user not authenticated properly'}), 401
        
        current_user = g.current_user # Get current_user from g
        result = get_profile(current_user.id)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
    
    except AttributeError:
        # This can happen if g.current_user is None or lacks an 'id' attribute.
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile', methods=['PUT'])
@token_required
def update_user_profile():
    """Update user's profile and award XP for completion"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        user_id = g.current_user.id
        profile_data = request.get_json()
        result = update_profile(user_id, profile_data)
        
        if isinstance(result, tuple):
            response_data, status_code = result
            if 'error' in response_data:
                 return jsonify(response_data), status_code
            return jsonify(response_data), status_code
        elif 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200
        
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/tags', methods=['GET'])
def get_profile_tags():
    """Get available profile tags for selectors"""
    try:
        category = request.args.get('category')
        tags = get_available_tags(category)
        
        if 'error' in tags:
            return jsonify(tags), 500
        
        return jsonify({'tags': tags}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/my-badges', methods=['GET'])
@token_required
def get_my_badges():
    """Get user's earned badges"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        user_id = g.current_user.id
        result = get_user_badges(user_id)
        
        if isinstance(result, dict) and 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({'badges': result}), 200
        
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/xp-summary', methods=['GET'])
@token_required
def get_xp_summary():
    """Get comprehensive XP summary for user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        current_user = g.current_user # Get current_user from g
        result = get_user_xp_summary(current_user.id)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200

    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/dashboard-overview', methods=['GET'])
@token_required
def get_dashboard_overview_route():
    """Get overview stats for the user dashboard."""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        user_id = g.current_user.id
        result = get_user_dashboard_overview(user_id)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve dashboard overview', 'details': str(e)}), 500

# Admin routes for tag management

# MODIFIED: This route is now public to allow tag fetching for registration/profile forms.
@profile_bp.route('/admin/profile-tags', methods=['GET'])
def admin_get_tags_route():
    """Get all profile tags. This is now a public endpoint. Can be filtered by category."""
    try:
        # This is now a public endpoint, so no authentication check is needed.
        category = request.args.get('category')
        tags = get_available_tags(category)

        if 'error' in tags:
            current_app.logger.error(f"Error fetching tags in public admin route: {tags['error']}")
            return jsonify(tags), 500
        
        # The frontend was calling the admin route, so it likely expects the data object directly,
        # not wrapped in a 'tags' key.
        return jsonify(tags), 200
        
    except Exception as e:
        current_app.logger.error(f"Exception in public /admin/profile-tags GET route: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve profile tags'}), 500

@profile_bp.route('/admin/profile-tags', methods=['POST'])
@token_required
@admin_required
def admin_add_tag_route():
    """Create a new profile tag (Admin only)"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'Admin user not authenticated'}), 401

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        result = create_profile_tag(data)
        
        if 'error' in result:
            if result.get('error') == 'Tag with this name already exists':
                return jsonify(result), 409
            return jsonify(result), 400
        
        return jsonify(result), 201
        
    except AttributeError:
        return jsonify({'error': 'Admin user context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/admin/profile-tags/<int:tag_id>', methods=['PUT'])
@token_required
@admin_required
def admin_update_tag_route(tag_id):
    """Update a profile tag (Admin only)"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'Admin user not authenticated'}), 401

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        result = update_profile_tag(tag_id, data)
        
        if 'error' in result:
            error_message = result.get('error')
            if error_message == 'Tag not found':
                return jsonify(result), 404
            if error_message == 'Tag with this name already exists':
                return jsonify(result), 409
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except AttributeError:
        return jsonify({'error': 'Admin user context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/admin/profile-tags/<int:tag_id>', methods=['DELETE'])
@token_required
@admin_required
def admin_delete_tag_route(tag_id):
    """Delete a profile tag (Admin only)"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'Admin user not authenticated'}), 401
            
        result = delete_profile_tag(tag_id)
        
        if 'error' in result:
            if result.get('error') == 'Tag not found':
                return jsonify(result), 404
            return jsonify(result), 500
        
        return jsonify(result), 200
        
    except AttributeError:
        return jsonify({'error': 'Admin user context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/change-password', methods=['POST'])
@token_required
def change_password_route():
    """Change password for the current user."""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        user_id = g.current_user.id
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Determine principal type based on token (super_admin/admin vs user)
        principal_hint = 'admin' if getattr(g, 'current_admin', None) is not None or getattr(g, 'user_role', '') == 'super_admin' else 'user'
        result, status_code = profile_controller.change_password(user_id, data, principal_hint)
        return jsonify(result), status_code
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'details': 'Error in change_password_route'}), 500

@profile_bp.route('/profile/linked-accounts', methods=['GET'])
@token_required
def get_user_linked_accounts_route():
    """Get all linked social accounts for the current user."""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        user_id = g.current_user.id
        
        result, status_code = profile_controller.get_linked_accounts(user_id)
        return jsonify(result), status_code
        
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': 'Failed to retrieve linked accounts', 'details': str(e)}), 500

@profile_bp.route('/profile/linked-accounts/<string:provider_name>', methods=['DELETE'])
@token_required
def unlink_social_account_route(provider_name):
    """Unlink a social account for the current user."""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User context not found or user not authenticated properly'}), 401
        
        current_user = g.current_user # Get current_user from g
        result, status_code = profile_controller.unlink_social_account(current_user.id, provider_name)
        return jsonify(result), status_code
    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'details': 'Error in unlink_social_account_route'}), 500

# ===== SECURITY ENDPOINTS =====

@profile_bp.route('/security/questions/available', methods=['GET'])
def get_available_security_questions_route():
    """Get available security questions for user setup"""
    try:
        return AuthController.get_available_security_questions()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/security/mfa/setup', methods=['POST'])
@token_required
def setup_mfa_route():
    """Setup MFA (email-based 2FA) for authenticated user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # For email-based 2FA, we'll send an OTP to the user's email
        user_email = g.current_user.email
        data = {'email': user_email}
        
        # Send OTP to user's email
        result, status_code = AuthController.send_otp_email(data)
        if status_code == 200:
            # Mark that MFA setup was initiated (you might want to add a field for this)
            return jsonify({
                'message': 'MFA setup initiated. Check your email for verification code.',
                'mfa_type': 'email_otp'
            }), 200
        else:
            return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/security/mfa/verify', methods=['POST'])
@token_required
def verify_mfa_route():
    """Verify MFA setup with email OTP"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        if not data or 'pin' not in data:
            return jsonify({'error': 'PIN is required'}), 400
        
        # Verify the OTP
        verify_data = {
            'email': g.current_user.email,
            'pin': data['pin']
        }
        
        result, status_code = AuthController.verify_otp_email(verify_data)
        if status_code == 200:
            # Enable MFA for the user
            from ..models import User, db
            user = User.query.get(g.current_user.id)
            if user:
                user.mfa_enabled = True
                db.session.commit()
                return jsonify({'message': 'MFA enabled successfully!'}), 200
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/security/mfa/disable', methods=['POST'])
@token_required
def disable_mfa_route():
    """Disable MFA for authenticated user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        result, status_code = AuthController.disable_mfa_for_user(g.current_user.id, data)
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/security/questions/set', methods=['POST'])
@token_required
def set_security_questions_route():
    """Set security questions for authenticated user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        if not data or 'security_questions' not in data:
            return jsonify({'error': 'Security questions are required'}), 400
        
        # Process security questions for logged-in user
        from ..models import User, db
        from werkzeug.security import generate_password_hash
        
        user = User.query.get(g.current_user.id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        security_questions_data = data['security_questions']
        if not isinstance(security_questions_data, list) or len(security_questions_data) < 2:
            return jsonify({'error': 'At least 2 security questions are required'}), 400
        
        hashed_questions = []
        for q_data in security_questions_data:
            question_id = q_data.get('question_id')
            answer = q_data.get('answer')
            if question_id and answer:
                hashed_answer = generate_password_hash(answer)
                hashed_questions.append({'question_id': str(question_id), 'answer_hash': hashed_answer})
        
        if len(hashed_questions) < 2:
            return jsonify({'error': 'At least 2 valid security questions with answers are required'}), 400
        
        user.security_questions = hashed_questions
        db.session.commit()
        
        return jsonify({'message': 'Security questions updated successfully!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/security/passkeys/generate', methods=['POST'])
@token_required
def generate_passkeys_route():
    """Generate passkeys for authenticated user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Generate passkeys for logged-in user
        from ..models import User, db
        from werkzeug.security import generate_password_hash
        import uuid
        from datetime import datetime
        
        user = User.query.get(g.current_user.id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate 10 passkeys
        num_passkeys = 10
        passkeys = [str(uuid.uuid4()) for _ in range(num_passkeys)]
        
        # Hash and store them
        hashed_passkeys = []
        for pk_raw in passkeys:
            hashed_passkeys.append({
                'key_hash': generate_password_hash(pk_raw), 
                'used': False, 
                'created_at': datetime.utcnow().isoformat()
            })
        
        user.passkeys = hashed_passkeys
        db.session.commit()
        
        return jsonify({
            'passkeys': passkeys,
            'message': 'Passkeys generated successfully. Please save them securely!'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/profile/badge-overview', methods=['GET'])
@token_required
def get_user_badge_overview_route():
    """Get comprehensive badge overview for user"""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401
        
        user_id = g.current_user.id
        result = get_user_badge_overview(user_id)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify(result), 200

    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500    
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@profile_bp.route('/profile/claim-badges', methods=['POST'])
@token_required
def claim_new_badges_route():
    """Claim any badges that the current user is now eligible for based on total XP."""
    try:
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'User not authenticated'}), 401

        user_id = g.current_user.id
        new_badges = check_and_award_badges(user_id)

        # If check_and_award_badges returns dict with error
        if isinstance(new_badges, dict) and 'error' in new_badges:
            return jsonify({'error': new_badges['error']}), 400

        return jsonify({'new_badges': new_badges, 'count': len(new_badges)}), 200

    except AttributeError:
        return jsonify({'error': 'User context is invalid or user ID is missing'}), 500    
    except Exception as e:
        return jsonify({'error': str(e)}), 500 