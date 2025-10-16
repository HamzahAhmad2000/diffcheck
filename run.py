import os
from flask import Flask,request, jsonify , send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate  
from app.routes.survey import survey_bp
from app.routes.upload import upload_bp
from app.routes.question_bank import question_bank_bp
from app.routes.response import response_bp
from app.routes.live_responses import live_responses_bp
# from app.routes.chart import chart_bp
from app.routes.comparison import comparison_bp
from app.routes.survey_distribution import distribution_bp
from app.routes.access_restriction import access_bp
from app.routes.enforcement import enforcement_bp
from app.routes.ai_routes import ai_bp
from app.routes.ai_usage_analytics_routes import ai_usage_analytics_bp
from app.models import db
from dotenv import load_dotenv
from app.routes.auth import auth_bp
from app.routes.chart_settings import chart_settings_bp
from app.routes.pdf_reporting_routes import pdf_reporting_bp
# Import the API blueprint
from app.extensions import mail
from app.routes.api import api_bp




# Load env variables from .env file
load_dotenv()

def create_app():
    app = Flask(__name__)
    frontend_origins_str = os.environ.get('FRONTEND_ORIGINS', 'http://98.86.84.2,http://localhost:3000,http://localhost:3002,http://172.16.110.39:3001')
    frontend_origins = [origin.strip() for origin in frontend_origins_str.split(',') if origin.strip()]
    
    # Configure CORS with all necessary headers including ngrok-skip-browser-warning
    CORS(app, 
         origins=frontend_origins,
         supports_credentials=True,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "ngrok-skip-browser-warning"],
         expose_headers=["Content-Type", "Authorization"]
    )
    
    # Add explicit CORS header handling to ensure credentials work properly
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin and (origin in frontend_origins):
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH')
        response.headers.set('Access-Control-Allow-Headers', 
                           'Content-Type,Authorization,X-Requested-With,Accept,Origin,ngrok-skip-browser-warning')
        return response

    # Load configuration from config.py
    from config import Config
    app.config.from_object(Config)
    app.config["GPT_API_KEY"] = os.environ.get("GPT_API_KEY")
    app.config["GPT_API_URL"] = os.environ.get("GPT_API_URL", "https://api.openai.com/v1/chat/completions")
    
    # Mail is now configured via Config and environment variables
    mail.init_app(app)
    
    
    # Set upload folder path and ensure directories exist
    app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'images'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'documents'), exist_ok=True)
    # Create additional upload directories for badges and marketplace
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'badges'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'marketplace_images'), exist_ok=True)


    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
        

    
    # Initialize the SQLAlchemy instance once.
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Initialize Redis for KV store (Stripe state management)
    import redis
    try:
        redis_client = redis.from_url(
            app.config.get('REDIS_URL', 'redis://localhost:6379/0'),
            decode_responses=True
        )
        # Test the connection immediately
        redis_client.ping()
        app.redis = redis_client
        print("SUCCESS: Redis connected successfully")
    except Exception as e:
        print(f"WARNING: Redis not available ({str(e)}), using MockRedis for development")
        # Create a mock Redis client for development without Redis
        class MockRedis:
            def __init__(self):
                self.store = {}
            def get(self, key):
                return self.store.get(key)
            def set(self, key, value):
                self.store[key] = value
                return True
            def delete(self, key):
                if key in self.store:
                    del self.store[key]
                return True
            def ping(self):
                return True
        app.redis = MockRedis()
    
    # Initialize WebSocket for real-time notifications
    from app.websocket_manager import init_socketio
    socketio = init_socketio(app)

    # Register blueprints
    app.register_blueprint(response_bp, url_prefix='/api')
    app.register_blueprint(survey_bp, url_prefix='/api')
    app.register_blueprint(upload_bp,url_prefix='/upload')
    app.register_blueprint(question_bank_bp, url_prefix='/api')
    app.register_blueprint(live_responses_bp, url_prefix='/api')
    # app.register_blueprint(chart_bp)
    app.register_blueprint(comparison_bp, url_prefix='/api')
    app.register_blueprint(pdf_reporting_bp , url_prefix='/pdf-reporting')
    app.register_blueprint(distribution_bp)  # This already has /api prefix in its definition
    app.register_blueprint(access_bp)  # This already has /api prefix in its definition
    app.register_blueprint(enforcement_bp)
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(ai_usage_analytics_bp, url_prefix='/api/ai/analytics')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(chart_settings_bp, url_prefix='/api')
    
    # Register AI points and Stripe integration routes
    from app.routes.ai_points_routes import ai_points_bp
    app.register_blueprint(ai_points_bp, url_prefix='/api')
    
    # Register business tier management routes
    from app.routes.business_tier_routes import business_tier_bp
    app.register_blueprint(business_tier_bp, url_prefix='/api')
    
    # Register AI points package management routes
    from app.routes.ai_points_package_routes import ai_points_package_bp
    app.register_blueprint(ai_points_package_bp, url_prefix='/api')
    
    # Register response package management routes
    from app.routes.response_package_routes import response_package_bp
    app.register_blueprint(response_package_bp, url_prefix='/api')
    
    # Ensure business_bp is registered if not handled by api_bp
    from app.routes.business_routes import business_bp
    app.register_blueprint(business_bp, url_prefix='/api')
    
    # Register admin routes for user management
    from app.routes.admin_routes import admin_routes_bp
    app.register_blueprint(admin_routes_bp, url_prefix='/api')
    
    # Register item routes for feedback management
    from app.routes.item_routes import item_bp
    app.register_blueprint(item_bp, url_prefix='/api')
    
    # Register idea routes for co-create idea management
    from app.routes.idea_routes import idea_blueprint
    app.register_blueprint(idea_blueprint, url_prefix='')
    
    # Register quest routes for quest management
    from app.routes.quest_routes import quest_bp
    app.register_blueprint(quest_bp, url_prefix='/api')
    
    # Register quest package routes for quest credit management
    from app.routes.quest_package_routes import quest_package_bp
    app.register_blueprint(quest_package_bp, url_prefix='/api')
    
    # Register admin seat package routes for admin seat management
    from app.routes.admin_seat_package_routes import admin_seat_package_bp
    app.register_blueprint(admin_seat_package_bp, url_prefix='/api')

    

    from app.routes.marketplace_routes import marketplace_bp, admin_marketplace_bp
    from app.routes.badge_routes import badge_bp, admin_badge_bp
    from app.routes.profile_routes import profile_bp
    from app.routes.discord_routes import discord_bp, discord_api_bp
    from app.routes.twitter_routes import twitter_bp
    from app.routes.google_routes import google_bp
    from app.routes.meta_routes import meta_bp
    
    # Register new purchase and notification routes
    from app.routes.purchase_routes import purchase_bp, admin_purchase_bp
    from app.routes.notification_routes import notification_bp, admin_notification_bp
    
    # Register referral system routes
    from app.routes.referral_routes import referral_bp
    
    # Register season pass routes
    from app.routes.season_pass_routes import season_pass_bp, admin_season_pass_bp
    
    # Register share to earn XP routes
    from app.routes.share_routes import share_api
    from app.routes.admin_share_routes import admin_share_bp
    
    # Register centralized Stripe routes (webhook + success)
    from app.routes.stripe_routes import stripe_bp

    # Register Coinbase crypto payment routes
    from app.routes.coinbase_blueprint import coinbase_bp

    app.register_blueprint(marketplace_bp, url_prefix='/api')
    app.register_blueprint(admin_marketplace_bp)  # Already has /api/admin/marketplace prefix
    
    app.register_blueprint(purchase_bp, url_prefix='/api')
    app.register_blueprint(admin_purchase_bp)  # Already has /api/admin/purchase prefix
    
    app.register_blueprint(notification_bp, url_prefix='/api')
    app.register_blueprint(admin_notification_bp)  # Already has /api/admin/notification prefix

    app.register_blueprint(referral_bp, url_prefix='/api/referrals')
    
    # Season Pass routes
    app.register_blueprint(season_pass_bp)  # Already has /api/season-pass prefix
    app.register_blueprint(admin_season_pass_bp)  # Already has /api/admin/season-pass prefix
    
    # Stripe routes (centralized webhook and success handler)
    app.register_blueprint(stripe_bp)  # Already has /api/stripe prefix

    # Coinbase crypto payment routes
    app.register_blueprint(coinbase_bp)
    
    # New Stripe purchase routes
    from app.routes.season_pass_purchase_routes import season_pass_purchase_bp
    from app.routes.business_purchase_routes import business_purchase_bp as business_purchase_stripe_bp
    app.register_blueprint(season_pass_purchase_bp)  # Already has /api/season-pass prefix
    app.register_blueprint(business_purchase_stripe_bp)  # Already has /api/business prefix

    app.register_blueprint(profile_bp, url_prefix='/api')

    app.register_blueprint(badge_bp, url_prefix='/api')
    app.register_blueprint(admin_badge_bp)  # Already has /api/admin/badges prefix

    app.register_blueprint(discord_bp) # Handles /linking/discord... routes
    app.register_blueprint(discord_api_bp) # Handles /api/discord... routes
    app.register_blueprint(twitter_bp)
    app.register_blueprint(google_bp)
    app.register_blueprint(meta_bp)
    
    # Register share to earn XP routes
    app.register_blueprint(share_api, url_prefix='/api')
    app.register_blueprint(admin_share_bp, url_prefix='/api')

    # Register CLI commands
    from app.jobs.leaderboard_job import create_leaderboard_cli_command
    create_leaderboard_cli_command(app)

    return app, socketio

app, socketio = create_app()

# === Additional Blueprint Registrations for Frontend Compatibility ===
from app.routes.purchase_routes import (
    admin_purchases_bp,
    admin_raffles_bp
)
from app.routes.feature_request_routes import feature_request_bp
from app.routes.daily_reward_routes import daily_reward_bp, admin_daily_reward_bp

# Register blueprints that were previously missing (avoid duplicates)
app.register_blueprint(admin_purchases_bp)  # /api/admin/purchases
app.register_blueprint(admin_raffles_bp)    # /api/admin/raffles
app.register_blueprint(feature_request_bp, url_prefix='/api')

# Register daily reward system routes
app.register_blueprint(daily_reward_bp, url_prefix='/api')  # /api/daily-rewards/*
app.register_blueprint(admin_daily_reward_bp)  # /api/admin/daily-rewards/*

# Register leaderboard system routes
from app.routes.leaderboard_routes import leaderboard_bp, admin_leaderboard_bp
app.register_blueprint(leaderboard_bp)  # /api/leaderboard/*
app.register_blueprint(admin_leaderboard_bp)  # /api/admin/leaderboard/*

# Referral system routes already registered above (line 190)

# === End additional blueprints ===

if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    # Suppress Flask/Werkzeug logging for cleaner output
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    # Use socketio.run for WebSocket support
    socketio.run(app, debug=debug, host=host, port=port, log_output=False)