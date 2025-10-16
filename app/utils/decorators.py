from functools import wraps
from flask import request, jsonify, g, current_app
from app.models import User, Admin, BusinessPermissionKey

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        # Fallback to a different header for broader compatibility if needed
        if not api_key:
            api_key = request.headers.get('Authorization-Key')

        # It is recommended to use a more secure key management system in production
        valid_key = current_app.config.get('SYSTEM_API_KEY')
        
        if not valid_key:
             # Failsafe if the key is not configured, to avoid leaving a backdoor open.
            return jsonify(message="API key is not configured on the server."), 500

        if not api_key or api_key != valid_key:
            return jsonify(message="Invalid or missing API key."), 403
            
        return f(*args, **kwargs)
    return decorated_function

def is_super_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_role') or g.user_role != 'super_admin':
            return jsonify(message="This action requires super admin privileges."), 403
        return f(*args, **kwargs)
    return decorated_function

def check_business_permissions(required_permissions):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'current_user') or not g.current_user:
                return jsonify(message="Authentication required."), 401

            # Super admin bypasses all permission checks
            if hasattr(g, 'user_role') and g.user_role == 'super_admin':
                return f(*args, **kwargs)

            # Ensure the user is a business admin
            if not hasattr(g, 'user_role') or g.user_role != 'business_admin':
                return jsonify(message="This action requires business admin privileges."), 403

            user = g.current_user
            
            # Check if user is properly associated with a business
            if not user.business_id:
                return jsonify(message="Business admin is not associated with any business."), 403

            # Check permissions from user's record
            user_permissions = user.business_admin_permissions or {}
            
            # Normalize required_permissions to a list
            perms_to_check = required_permissions if isinstance(required_permissions, list) else [required_permissions]
            
            missing_permissions = []
            for perm in perms_to_check:
                # The permission can be an enum member or a string representation
                perm_key = perm.value if isinstance(perm, BusinessPermissionKey) else str(perm)
                if not user_permissions.get(perm_key, False):
                    missing_permissions.append(perm_key)

            if missing_permissions:
                return jsonify(message=f"Missing required permissions: {', '.join(missing_permissions)}"), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator 