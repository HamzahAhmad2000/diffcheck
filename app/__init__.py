# app/__init__.py
from flask import Flask, send_from_directory, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from .extensions import db, migrate, mail

# Load environment variables from .env file
load_dotenv()

#db = SQLAlchemy()
#migrate = Migrate()
#mail = Mail()

def create_app():
    app = Flask(__name__)
    
    # Configure CORS with proper origins
    frontend_origins_str = os.environ.get('FRONTEND_ORIGINS', 'http://98.86.84.2,http://localhost:3000,http://localhost:3002')
    frontend_origins = frontend_origins_str.split(',') if frontend_origins_str else []
    
    CORS(app, 
         origins=frontend_origins,
         supports_credentials=True,
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "ngrok-skip-browser-warning"],
         expose_headers=["Content-Type", "Authorization"]
    )
    
    @app.after_request
    def after_request_func(response):
        origin = request.headers.get('Origin')
        if origin and (origin in frontend_origins):
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response

    # App configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///survey.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'replace-with-a-secret-key-CHANGE-ME')
    app.config["GPT_API_KEY"] = os.environ.get("GPT_API_KEY")
    app.config["GPT_API_URL"] = os.environ.get("GPT_API_URL", "https://api.openai.com/v1/chat/completions")
    
    # Discord OAuth Configuration
    app.config['DISCORD_CLIENT_ID'] = os.environ.get('DISCORD_CLIENT_ID')
    app.config['DISCORD_CLIENT_SECRET'] = os.environ.get('DISCORD_CLIENT_SECRET')
    app.config['DISCORD_REDIRECT_URI_BACKEND'] = os.environ.get('DISCORD_REDIRECT_URI_BACKEND', 'http://98.86.84.2:5000/linking/discord/callback')
    app.config['ENCRYPTION_KEY'] = os.environ.get('ENCRYPTION_KEY')
    app.config['FRONTEND_URL'] = os.environ.get('FRONTEND_URL', 'http://98.86.84.2')
    
    # Mail settings are now sourced from environment via Config in top-level app

    # Upload folder configuration
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

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)

    with app.app_context():
        # Import all blueprints
        from .routes.auth import auth_bp
        from .routes.survey import survey_bp
        from .routes.response import response_bp
        from .routes.question_bank import question_bank_bp
        from .routes.business_routes import business_bp
        from .routes.upload import upload_bp
        from .routes.ai_routes import ai_bp
        from .routes.admin_routes import admin_routes_bp
        from .routes.chart_settings import chart_settings_bp
        from .routes.live_responses import live_responses_bp
        from .routes.comparison import comparison_bp
        from .routes.survey_distribution import distribution_bp
        from .routes.access_restriction import access_bp
        from .routes.enforcement import enforcement_bp
        from .routes.pdf_reporting_routes import pdf_reporting_bp
        from .routes.item_routes import item_bp
        from .routes.discord_routes import discord_bp, discord_api_bp
        from .routes.twitter_routes import twitter_bp
        # from .routes.test_route import test_bp  # Commented out - missing module
        
        # Register blueprints
        app.register_blueprint(auth_bp, url_prefix='/auth')
        app.register_blueprint(survey_bp, url_prefix='/api')
        app.register_blueprint(response_bp, url_prefix='/api')
        app.register_blueprint(question_bank_bp, url_prefix='/api')
        app.register_blueprint(business_bp, url_prefix='/api')
        app.register_blueprint(upload_bp, url_prefix='/upload')
        app.register_blueprint(ai_bp, url_prefix='/api/ai')
        app.register_blueprint(admin_routes_bp, url_prefix='/api')
        app.register_blueprint(item_bp, url_prefix='/api')
        app.register_blueprint(chart_settings_bp, url_prefix='/api')
        app.register_blueprint(live_responses_bp, url_prefix='/api/surveys')
        app.register_blueprint(comparison_bp, url_prefix='/api')
        app.register_blueprint(pdf_reporting_bp, url_prefix='/pdf-reporting')
        app.register_blueprint(enforcement_bp, url_prefix='/api')
        
        # Register OAuth blueprints
        app.register_blueprint(discord_bp)  # No prefix, routes are defined with full paths
        app.register_blueprint(discord_api_bp)  # Register API prefix routes for Discord integration
        app.register_blueprint(twitter_bp)  # No prefix, routes are defined with full paths
        # app.register_blueprint(test_bp)  # For testing - commented out, missing module
        
        # These already have /api prefix in their blueprint definitions
        app.register_blueprint(distribution_bp)
        app.register_blueprint(access_bp)
        
        # Import and register optional blueprints
        from .routes.marketplace_routes import marketplace_bp, admin_marketplace_bp
        from .routes.profile_routes import profile_bp
        from .routes.badge_routes import badge_bp
        from .routes.activity_routes import activity_bp
        from .routes.quest_routes import quest_bp
        
        app.register_blueprint(marketplace_bp, url_prefix='/api')
        app.register_blueprint(admin_marketplace_bp)  # Admin marketplace already has /api/admin prefix
        app.register_blueprint(profile_bp, url_prefix='/api')
        app.register_blueprint(badge_bp, url_prefix='/api')
        app.register_blueprint(activity_bp, url_prefix='/api')
        app.register_blueprint(quest_bp, url_prefix='/api')

        # Database creation (for development only)
        if app.debug or os.environ.get('FLASK_ENV') == 'development':
            db_path_in_init = os.path.join(os.getcwd(), 'survey.db')
            if os.path.exists(db_path_in_init):
                try:
                    os.remove(db_path_in_init)
                    app.logger.info(f"Removed old database: {db_path_in_init}")
                except Exception as e:
                    app.logger.error(f"Error removing database {db_path_in_init}: {e}")
        
        
        
        # Additional configuration
        app.config['CHART_EXPORT_FOLDER'] = os.path.join(os.getcwd(), 'exports', 'charts')
        os.makedirs(app.config['CHART_EXPORT_FOLDER'], exist_ok=True)
        
        # Add a test route directly to the app for debugging
        @app.route('/test-direct')
        def test_direct():
            return "Direct test route works!"
            
    return app
