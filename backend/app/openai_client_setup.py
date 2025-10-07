import os
from openai import OpenAI
import pathlib
from dotenv import load_dotenv

# Instead of going three parents up, go two parents up.
project_root = pathlib.Path(__file__).parent.parent  # This should point to 'backend/'
env_path = project_root / '.env'

load_dotenv(dotenv_path=env_path)

# Get API key with fallback for direct debugging
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize client as None first to avoid import errors
openai_client = None

def initialize_openai_client():
    """Initialize or reinitialize the OpenAI client"""
    global openai_client, OPENAI_API_KEY
    
    # Try to reload environment variables
    load_dotenv(dotenv_path=env_path)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    if not OPENAI_API_KEY:
        print(f"Warning: Could not load OpenAI API key from environment or .env file at {env_path}")
        print(f"Working directory: {os.getcwd()}")
        return False
    
    try:
        # Initialize the OpenAI client with the API key.
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print(f"✅ OpenAI client initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize OpenAI client: {e}")
        return False

def get_openai_client():
    """Get the OpenAI client, initializing if necessary"""
    global openai_client
    if openai_client is None:
        initialize_openai_client()
    return openai_client

# Try to initialize on import
initialize_openai_client()

# Load assistant IDs from environment variables.
# These should be set in the .env file in the backend directory.
follow_up_question_asst_id = os.getenv("FOLLOW_UP_QUESTION_ASST_ID")
survey_update_asst_id = os.getenv("SURVEY_UPDATE_ASST_ID")
analytics_asst_id = os.getenv("ANALYTICS_ASST_ID")
quick_survey_gen_asst_id = os.getenv("QUICK_SURVEY_GEN_ASST_ID")
guided_survey_gen_asst_id = os.getenv("GUIDED_SURVEY_GEN_ASST_ID")


essential_ids = {
    "follow_up_question_asst_id": follow_up_question_asst_id,
    "survey_update_asst_id": survey_update_asst_id,
    "analytics_asst_id": analytics_asst_id,
    "quick_survey_gen_asst_id": quick_survey_gen_asst_id,
    "guided_survey_gen_asst_id": guided_survey_gen_asst_id,
}

# Verify that all assistant IDs were loaded from the environment
assistant_env_vars = {
    "follow_up_question_asst_id": "FOLLOW_UP_QUESTION_ASST_ID",
    "survey_update_asst_id": "SURVEY_UPDATE_ASST_ID",
    "analytics_asst_id": "ANALYTICS_ASST_ID",
    "quick_survey_gen_asst_id": "QUICK_SURVEY_GEN_ASST_ID",
    "guided_survey_gen_asst_id": "GUIDED_SURVEY_GEN_ASST_ID",
}

for key, env_var in assistant_env_vars.items():
    if not essential_ids.get(key):
        print(
            f"⚠️ Warning: Environment variable '{env_var}' is not set. AI features depending on this assistant ID will fail."
        )