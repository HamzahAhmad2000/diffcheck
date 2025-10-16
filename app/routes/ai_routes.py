# app/routes/ai_routes.py
from flask import Blueprint, request, jsonify, g
from app.controllers.ai_controller import (
    chat_controller,
    # generate_survey_controller, # REMOVED
    edit_survey_ai_controller,
    ai_edit_question_controller,
    get_ai_summary_controller,
    converse_ai_summary_controller,
    create_survey_thread,
    create_analytics_thread,
    continue_survey_conversation_controller,
    create_new_chat_thread,
    regenerate_survey_controller,
    # --- ADD NEW IMPORTS ---
    quick_generate_survey_ai,
    guided_generate_survey_ai,
    generate_ai_report_insights,
    get_eligible_questions_for_ai,
    auto_generate_survey_responses_ai,
    # --- END NEW IMPORTS ---
)
from app.controllers.auth_controller import token_required, admin_required, check_business_ai_points, get_points_for_response_generation, get_points_for_survey_creation, get_points_for_ai_chat_edit, get_points_for_ai_insights
from app.controllers.business_controller import BusinessController
import logging

logger = logging.getLogger(__name__)

ai_bp = Blueprint('ai_bp', __name__)

# --- Existing chat routes remain ---
@ai_bp.route("/chat", methods=["POST"])
@token_required
def chat_route():
    data = request.get_json() or {}
    result, status = chat_controller(data)
    return jsonify(result), status

@ai_bp.route("/create_new_chat_thread", methods=["POST"])
@token_required
def create_new_chat_thread_route():
    result, status = create_new_chat_thread()
    return jsonify(result), status

# --- REMOVE old generate_survey route ---
# @ai_bp.route("/generate_survey", methods=["POST"])
# def generate_survey_route():
#     result, status = generate_survey_controller()
#     return jsonify(result), status

# --- ADD NEW Survey Builder Routes ---
@ai_bp.route("/quick_generate_survey", methods=["POST"])
@token_required
@check_business_ai_points(get_points_for_survey_creation)
def quick_generate_survey_route():
    """Quick survey generation using Celery async task"""
    from app.tasks.ai_tasks import generate_survey_quick_task
    from app.controllers.ai_tracking_controller import create_ai_usage_log
    from app.models_ai_tracking import AIOperationType

    data = request.get_json() or {}
    prompt = data.get("prompt")
    business_id = data.get("business_id")  # Extract business_id from request

    # If no business_id in payload, try to get from current user
    if not business_id and hasattr(g, 'current_user') and hasattr(g.current_user, 'business_id'):
        business_id = g.current_user.business_id

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    if not business_id:
        return jsonify({"error": "Business ID is required"}), 400
    
    # Create AI usage log
    log = create_ai_usage_log(
        operation_type=AIOperationType.QUICK_SURVEY_CREATE,
        user_id=g.current_user.id,
        business_id=business_id,
        input_data={'prompt': prompt}
    )

    # Trigger Celery task
    task = generate_survey_quick_task.delay(
        prompt=prompt,
        user_id=g.current_user.id,
        business_id=business_id,
        log_id=log.id
    )

    # Deduct points after task starts
    if g.user_role != 'super_admin':
        points_needed = g.points_needed
        action_str = "QUICK_SURVEY_CREATE"
        success, message = BusinessController.deduct_ai_points(
            business_id,
            points_needed,
            action_str,
            g.current_user.id
        )
        if not success:
            logger.warning(f"Point deduction warning: {message}")
    
    return jsonify({
        'task_id': task.id,
        'log_id': log.id,
        'status': 'processing',
        'message': 'Survey generation started. You will be notified when complete.'
    }), 202

@ai_bp.route("/guided_generate_survey", methods=["POST"])
@token_required
@check_business_ai_points(get_points_for_survey_creation)
def guided_generate_survey_route():
    """Guided survey generation using Celery async task"""
    from app.tasks.ai_tasks import generate_survey_guided_task
    from app.controllers.ai_tracking_controller import create_ai_usage_log
    from app.models_ai_tracking import AIOperationType

    data = request.get_json() or {}
    industry = data.get("industry")
    goal = data.get("goal")
    description = data.get("description")
    tone_length = data.get("tone_length")
    business_id = data.get("business_id")  # Extract business_id from request

    # If no business_id in payload, try to get from current user
    if not business_id and hasattr(g, 'current_user') and hasattr(g.current_user, 'business_id'):
        business_id = g.current_user.business_id

    if not all([industry, goal, description, tone_length]):
        return jsonify({"error": "Missing required fields"}), 400

    if not business_id:
        return jsonify({"error": "Business ID is required"}), 400
    
    # Determine operation type based on tone/length
    if "short" in tone_length.lower():
        operation_type = AIOperationType.GUIDED_SHORT_SURVEY
    elif "deep" in tone_length.lower() or "long" in tone_length.lower():
        operation_type = AIOperationType.GUIDED_DEEP_SURVEY
    else:
        operation_type = AIOperationType.GUIDED_BALANCED_SURVEY
    
    # Create AI usage log
    log = create_ai_usage_log(
        operation_type=operation_type,
        user_id=g.current_user.id,
        business_id=business_id,
        input_data={
            'industry': industry,
            'goal': goal,
            'description': description,
            'tone_length': tone_length
        }
    )

    # Trigger Celery task
    task = generate_survey_guided_task.delay(
        industry=industry,
        goal=goal,
        description=description,
        tone_length=tone_length,
        user_id=g.current_user.id,
        business_id=business_id,
        log_id=log.id
    )

    # Deduct points after task starts
    if g.user_role != 'super_admin':
        points_needed = g.points_needed
        action_str = f"GUIDED_SURVEY_CREATE_{tone_length.upper()}"
        success, message = BusinessController.deduct_ai_points(
            business_id,
            points_needed,
            action_str,
            g.current_user.id
        )
        if not success:
            logger.warning(f"Point deduction warning: {message}")
    
    return jsonify({
        'task_id': task.id,
        'log_id': log.id,
        'status': 'processing',
        'message': 'Survey generation started. You will be notified when complete.'
    }), 202
# --- END NEW Survey Builder Routes ---

# --- Existing Edit/Regenerate Routes ---
@ai_bp.route("/edit_survey_ai", methods=["POST"])
@token_required
def edit_survey_ai_route():
    data = request.get_json() or {}
    result, status = edit_survey_ai_controller(data)
    return jsonify(result), status

@ai_bp.route("/ai_edit_question", methods=["POST"])
@token_required
def ai_edit_question_route():
    data = request.get_json() or {}
    result, status = ai_edit_question_controller(data)
    return jsonify(result), status

@ai_bp.route("/continue_survey_conversation", methods=["POST"])
@token_required
@check_business_ai_points(get_points_for_ai_chat_edit)
def continue_survey_conversation_route():
    data = request.get_json() or {}
    result, status = continue_survey_conversation_controller(data)
    
    # Deduct points on success (only if it made changes)
    if status == 200 and g.user_role != 'super_admin' and result.get("survey_updates"):
        points_needed = g.points_needed
        action_str = "AI_CHAT_EDIT"
        success, message = BusinessController.deduct_ai_points(
            g.current_user.business_id, 
            points_needed, 
            action_str, 
            g.current_user.id
        )
        if not success:
            return jsonify({"error": f"Point deduction failed: {message}"}), 500
    
    return jsonify(result), status

@ai_bp.route("/regenerate_survey", methods=["POST"])
@token_required
def regenerate_survey_route():
    data = request.get_json() or {}
    result, status = regenerate_survey_controller(data)
    return jsonify(result), status
# --- END Existing Edit/Regenerate Routes ---

# --- Existing AI Summary/Analytics Routes ---
@ai_bp.route("/ai_summary", methods=["GET"])
@token_required
def ai_summary_route():
    survey_id = request.args.get("survey_id", type=int)
    result, status = get_ai_summary_controller(survey_id)
    return jsonify(result), status

@ai_bp.route("/converse_ai_summary", methods=["POST"])
@token_required
def converse_ai_summary_route():
    data = request.get_json() or {}
    result, status = converse_ai_summary_controller(data)
    return jsonify(result), status

@ai_bp.route("/create_analytics_thread", methods=["POST"])
@token_required
def create_analytics_thread_route():
    data = request.get_json() or {}
    survey_id = data.get("survey_id")
    if not survey_id: return jsonify({"error": "survey_id is required"}), 400
    result, status = create_analytics_thread(survey_id)
    return jsonify(result), status
# --- END Existing AI Summary/Analytics Routes ---

# --- ADD NEW AI Insights Routes ---
@ai_bp.route("/generate_report_insights", methods=["POST"])
@token_required
@check_business_ai_points(get_points_for_ai_insights)
def generate_report_insights_route():
    """AI insights generation using Celery async task"""
    from app.tasks.ai_tasks import generate_ai_insights_task
    from app.controllers.ai_tracking_controller import create_ai_usage_log
    from app.models_ai_tracking import AIOperationType
    
    data = request.get_json() or {}
    survey_id = data.get("survey_id")
    selected_question_ids = data.get("selected_question_ids", [])
    filters = data.get("filters", {})
    comparison_settings = data.get("comparison_settings", {})
    
    if not survey_id or not selected_question_ids:
        return jsonify({"error": "survey_id and selected_question_ids are required"}), 400
    
    # Create AI usage log
    log = create_ai_usage_log(
        operation_type=AIOperationType.AI_INSIGHTS_REPORT,
        user_id=g.current_user.id,
        business_id=g.current_user.business_id,
        survey_id=survey_id,
        input_data={
            'survey_id': survey_id,
            'selected_question_ids': selected_question_ids,
            'filters': filters,
            'comparison_settings': comparison_settings
        }
    )
    
    # Trigger Celery task
    task = generate_ai_insights_task.delay(
        survey_id=survey_id,
        selected_question_ids=selected_question_ids,
        filters=filters,
        comparison_settings=comparison_settings,
        user_id=g.current_user.id,
        business_id=g.current_user.business_id,
        log_id=log.id
    )
    
    # Deduct points after task starts
    if g.user_role != 'super_admin':
        points_needed = g.points_needed
        action_str = "AI_INSIGHTS_REPORT"
        success, message = BusinessController.deduct_ai_points(
            g.current_user.business_id, 
            points_needed, 
            action_str, 
            g.current_user.id
        )
        if not success:
            logger.warning(f"Point deduction warning: {message}")
    
    return jsonify({
        'task_id': task.id,
        'log_id': log.id,
        'status': 'processing',
        'message': 'AI insights generation started. You will be notified when complete.'
    }), 202

@ai_bp.route("/surveys/<int:survey_id>/ai_eligible_questions", methods=["GET"])
@token_required
def get_eligible_questions_route(survey_id):
    result, status = get_eligible_questions_for_ai(survey_id)
    return jsonify(result), status

@ai_bp.route("/surveys/<int:survey_id>/auto_generate_responses", methods=["POST"])
@token_required
@check_business_ai_points(get_points_for_response_generation)
def auto_generate_responses_route(survey_id):
    """
    Triggers AI to generate and submit a specified number of responses for a survey using Celery.
    Expects JSON body: { "num_responses": <integer> }
    Requires token authentication and AI points checking.
    """
    from app.tasks.ai_tasks import generate_survey_responses_task
    from app.controllers.ai_tracking_controller import create_ai_usage_log
    from app.models_ai_tracking import AIOperationType
    
    logger.info(f"[AI_ROUTE] Auto-generate responses for survey {survey_id}")
    
    data = request.get_json() or {}
    num_responses = data.get("num_responses")

    if not isinstance(num_responses, int) or num_responses <= 0:
        return jsonify({"error": "num_responses must be a positive integer"}), 400
    
    # Create AI usage log
    log = create_ai_usage_log(
        operation_type=AIOperationType.RESPONSE_GENERATION,
        user_id=g.current_user.id,
        business_id=g.current_user.business_id,
        survey_id=survey_id,
        input_data={
            'survey_id': survey_id,
            'num_responses': num_responses
        }
    )
    
    # Trigger Celery task
    task = generate_survey_responses_task.delay(
        survey_id=survey_id,
        num_responses=num_responses,
        user_id=g.current_user.id,
        business_id=g.current_user.business_id,
        log_id=log.id
    )
    
    # Deduct points after task starts
    if g.user_role != 'super_admin':
        points_needed = g.points_needed
        action_str = f"GENERATE_{num_responses}_RESPONSES"
        success, message = BusinessController.deduct_ai_points(
            g.current_user.business_id, 
            points_needed, 
            action_str, 
            g.current_user.id
        )
        if not success:
            logger.warning(f"Point deduction warning: {message}")
    
    return jsonify({
        'task_id': task.id,
        'log_id': log.id,
        'status': 'processing',
        'message': f'Generating {num_responses} AI responses. You will be notified when complete.'
    }), 202
# --- END NEW AI Insights Routes ---

# --- Task Status Route ---
@ai_bp.route("/task_status/<task_id>", methods=["GET"])
@token_required
def get_task_status(task_id):
    """Get the status of a Celery task"""
    from celery.result import AsyncResult
    from celery_config import celery_app
    
    try:
        task_result = AsyncResult(task_id, app=celery_app)
        
        response = {
            'task_id': task_id,
            'status': task_result.state,
            'ready': task_result.ready(),
            'successful': task_result.successful() if task_result.ready() else None
        }
        
        if task_result.ready():
            if task_result.successful():
                response['result'] = task_result.result
            else:
                response['error'] = str(task_result.info)
        elif task_result.state == 'PROGRESS':
            response['progress'] = task_result.info
        
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return jsonify({'error': str(e)}), 500

# --- Existing Survey Thread Route ---
@ai_bp.route("/create_survey_thread", methods=["POST"])
@token_required
def create_survey_thread_route():
    data = request.get_json() or {}
    survey_id = data.get("survey_id")
    if not survey_id: return jsonify({"error": "survey_id is required"}), 400
    result, status = create_survey_thread(survey_id)
    return jsonify(result), status

# --- Debug Route ---
@ai_bp.route("/debug/reinit", methods=["POST"])
@token_required
@admin_required
def debug_reinit_openai():
    """Debug endpoint to reinitialize OpenAI client"""
    try:
        from app.openai_client_setup import initialize_openai_client
        success = initialize_openai_client()
        if success:
            return jsonify({"message": "OpenAI client reinitialized successfully"}), 200
        else:
            return jsonify({"error": "Failed to reinitialize OpenAI client"}), 500
    except Exception as e:
        return jsonify({"error": f"Exception during reinitialization: {str(e)}"}), 500

@ai_bp.route("/debug/set_api_key", methods=["POST"])
@token_required
@admin_required  
def debug_set_api_key():
    """Debug endpoint to set OpenAI API key in runtime"""
    import os
    try:
        data = request.get_json() or {}
        api_key = data.get("api_key")
        
        if not api_key:
            return jsonify({"error": "api_key is required"}), 400
            
        # Set the environment variable
        os.environ["OPENAI_API_KEY"] = api_key
        
        # Reinitialize the client
        from app.openai_client_setup import initialize_openai_client
        success = initialize_openai_client()
        
        if success:
            return jsonify({"message": "OpenAI API key set and client initialized successfully"}), 200
        else:
            return jsonify({"error": "Failed to initialize client with provided API key"}), 500
            
    except Exception as e:
        return jsonify({"error": f"Exception during API key setup: {str(e)}"}), 500