# config.py
import os
from dotenv import load_dotenv
from datetime import timedelta

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    # Ensure instance directory exists - use project root instance directory
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    instance_dir = os.path.join(project_root, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    
    # Use absolute path for SQLite database to avoid path issues
    default_db_path = os.path.join(instance_dir, 'survey.db')
    # Prefer SQLite for local development. Only honor DATABASE_URL if it explicitly points to a SQLite DB.
    env_db_url = os.environ.get('DATABASE_URL')
    if env_db_url and env_db_url.strip().lower().startswith('sqlite'):
        SQLALCHEMY_DATABASE_URI = env_db_url
    else:
        # Fallback to project-level SQLite file (default and recommended for dev)
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.abspath(default_db_path)}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    
    # System-wide API key for protecting certain internal or high-privilege APIs
    SYSTEM_API_KEY = os.environ.get('SYSTEM_API_KEY')

    # Upload settings
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads'))
    MAX_CONTENT_LENGTH = os.environ.get('MAX_CONTENT_LENGTH', 15 * 1024 * 1024)  # 15MB default max upload size
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'csv'}

    # Google OAuth Settings
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI_BACKEND = os.environ.get('GOOGLE_REDIRECT_URI_BACKEND', 'http://localhost:5000/linking/google/callback')

    # Discord OAuth settings
    DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID')  # This is your Application ID
    DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET')  # Get this from Discord Developer Portal
    DISCORD_BOT_TOKEN = os.environ.get('DISCORD_BOT_TOKEN')  # Bot token for server role management
    DISCORD_REDIRECT_URI_BACKEND = os.environ.get('DISCORD_REDIRECT_URI_BACKEND', 'http://98.86.84.2:5000/linking/discord/callback')
    DISCORD_OAUTH2_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize"
    DISCORD_OAUTH2_TOKEN_URL = "https://discord.com/api/oauth2/token"
    DISCORD_USER_INFO_URL = "https://discord.com/api/users/@me"
    DISCORD_SCOPES = "identify email guilds guilds.members.read"  # Updated scopes for role checking
    
    # Encryption settings for storing tokens securely
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY')
    
    # Frontend URL for redirects
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://98.86.84.2')

    # Twitter OAuth settings
    TWITTER_CLIENT_ID = os.environ.get('TWITTER_CLIENT_ID')  # API Key from Twitter Developer Portal
    TWITTER_CLIENT_SECRET = os.environ.get('TWITTER_CLIENT_SECRET')  # API Key Secret from Twitter Developer Portal
    TWITTER_REDIRECT_URI = os.environ.get('TWITTER_REDIRECT_URI', 'http://localhost:5000/linking/twitter/callback')
    
    # Stripe settings
    STRIPE_PUBLIC_KEY = os.environ.get('STRIPE_PUBLIC_KEY')
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

    # Google reCAPTCHA settings
    RECAPTCHA_SECRET_KEY = os.environ.get('RECAPTCHA_SECRET_KEY', '6LfqJeArAAAAAKtxirn6Sm49c7XG42wxpzL3SPQQ')  # Production secret key
    RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

    # Mail settings (Flask-Mail)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    # Ensure PORT is an int
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')

    # Allow flexible truthy values
    _use_tls = os.environ.get('MAIL_USE_TLS', 'true')
    _use_ssl = os.environ.get('MAIL_USE_SSL', 'false')
    MAIL_USE_TLS = str(_use_tls).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}
    MAIL_USE_SSL = str(_use_ssl).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}
    
    # Additional mail settings for better reliability
    MAIL_TIMEOUT = int(os.environ.get('MAIL_TIMEOUT', 30))  # 30 second timeout
    MAIL_SUPPRESS_SEND = os.environ.get('MAIL_SUPPRESS_SEND', 'false').lower() == 'true'

    # Default sender: prefer split name/email; fall back to single string if provided
    _default_sender_name = os.environ.get('MAIL_DEFAULT_SENDER_NAME')
    _default_sender_email = os.environ.get('MAIL_DEFAULT_SENDER_EMAIL')
    _default_sender = os.environ.get('MAIL_DEFAULT_SENDER')
    if _default_sender_name and _default_sender_email:
        MAIL_DEFAULT_SENDER = (_default_sender_name, _default_sender_email)
    else:
        MAIL_DEFAULT_SENDER = _default_sender