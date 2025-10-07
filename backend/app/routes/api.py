from flask import Blueprint, request, jsonify
from app.routes.auth import token_required, admin_required

api_bp = Blueprint('api', __name__)

# Chart settings routes are now handled by chart_settings.py exclusively
# Remove duplicate routes to avoid conflicts