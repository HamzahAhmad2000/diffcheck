import json
import re
import time
import uuid # Add uuid import
from datetime import datetime

from flask import current_app, jsonify, g # Add jsonify import
import random
from app.controllers.response_controller import ResponseController  # Alias to avoid confusion
from app.controllers.survey_controller import SurveyController
from app.controllers.ai_usage_analytics_controller import AIUsageAnalyticsController
from app.utils.openai_cost_calculator import OpenAICostCalculator

def estimate_openai_cost(input_text, output_text, model='gpt-4o'):
    """
    Estimate OpenAI cost based on input/output text length.
    This is an approximation since assistants API doesn't provide exact token counts.
    """
    try:
        # Rough estimation: 1 token ≈ 4 characters for English text
        input_tokens = len(input_text) // 4 if input_text else 0
        output_tokens = len(output_text) // 4 if output_text else 0
        
        cost = OpenAICostCalculator.calculate_cost(model, input_tokens, output_tokens)
        
        return {
            'openai_cost_usd': cost,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'model_used': model,
            'estimated_tokens': input_tokens + output_tokens
        }
    except Exception as e:
        current_app.logger.error(f"Error estimating OpenAI cost: {e}")
        return {
            'openai_cost_usd': None,
            'input_tokens': None,
            'output_tokens': None,
            'model_used': model,
            'estimated_tokens': None
        }

from app.models import (
    AnalyticsThread,
    ChatThread,
    Question,
    Survey,
    SurveyThread,
    db,
)
from app.openai_client_setup import (
    analytics_asst_id,
    follow_up_question_asst_id,
    guided_survey_gen_asst_id,
    initialize_openai_client,
    openai_client,
    quick_survey_gen_asst_id,
    survey_update_asst_id,
)

MAX_QUESTIONS = 10  # Max questions for interactive chat generation
MAX_POLL_TIME = 150 # Increased timeout for potentially longer analytics runs
POLL_INTERVAL = 2
# Sample Size Thresholds
OPEN_ENDED_MIN_SAMPLE, OPEN_ENDED_CAUTION_SAMPLE = 30, 100
QUANTITATIVE_MIN_SAMPLE, QUANTITATIVE_CAUTION_SAMPLE = 50, 200

# --- Helper Functions ---
def _transform_analytics_to_ai_format(question, analytics_data, sample_size):
    """
    Transform analytics data into AI-friendly format based on question type.
    """
    question_type = question.question_type
    transformed_data = {
        "sample_size": sample_size
    }
    
    if question_type == "rating":
        if "distribution" in analytics_data:
            # Fix: Check if distribution is a dict before calling .items()
            distribution_data = analytics_data.get("distribution", {})
            if isinstance(distribution_data, dict):
                transformed_data.update({
                    "scale_min": question.rating_start or 1,
                    "scale_max": question.rating_end or 5,
                    "left_label": question.left_label or "",
                    "right_label": question.right_label or "",
                    "distribution": {str(k): v for k, v in distribution_data.items()}
                })
            else:
                # If distribution is not a dict, set basic info without distribution
                transformed_data.update({
                    "scale_min": question.rating_start or 1,
                    "scale_max": question.rating_end or 5,
                    "left_label": question.left_label or "",
                    "right_label": question.right_label or "",
                    "distribution": {}
                })
    
    elif question_type in ["single-choice", "multi-choice", "dropdown"]:
        if "options_distribution" in analytics_data:
            distribution = {}
            if isinstance(analytics_data["options_distribution"], list):
                for item in analytics_data["options_distribution"]:
                    if isinstance(item, dict):
                        distribution[item.get("option", "Unknown")] = item.get("count", 0)
            transformed_data["distribution"] = distribution
        elif "option_distribution" in analytics_data:
            distribution = {}
            if isinstance(analytics_data["option_distribution"], list):
                for item in analytics_data["option_distribution"]:
                    if isinstance(item, dict):
                        distribution[item.get("option", "Unknown")] = item.get("count", 0)
            transformed_data["distribution"] = distribution
    
    elif question_type == "open-ended":
        if "latest_10" in analytics_data and isinstance(analytics_data["latest_10"], list):
            transformed_data["sampled_responses"] = analytics_data["latest_10"]
        transformed_data["has_text_responses"] = True
        if "count_valid" in analytics_data:
            transformed_data["total_text_responses"] = analytics_data["count_valid"]
        
    elif question_type == "interactive-ranking":
        if "average_ranks" in analytics_data and isinstance(analytics_data["average_ranks"], list):
            transformed_data.update({
                "ranking_items": [item["item"] for item in analytics_data["average_ranks"] if isinstance(item, dict) and "item" in item],
                "average_ranks": {item["item"]: item["average_rank"] for item in analytics_data["average_ranks"] if isinstance(item, dict) and "item" in item and "average_rank" in item},
                "rank_distribution": analytics_data.get("rank_distribution_matrix", {}) if isinstance(analytics_data.get("rank_distribution_matrix"), dict) else {}
            })
    
    elif question_type == "star-rating-grid":
        if "average_ratings" in analytics_data:
            transformed_data.update({
                "grid_rows": analytics_data.get("rows", []) if isinstance(analytics_data.get("rows"), list) else [],
                "grid_columns": ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"],
                "row_averages": analytics_data.get("average_ratings", {}) if isinstance(analytics_data.get("average_ratings"), dict) else {},
                "column_averages": analytics_data.get("column_averages", {}) if isinstance(analytics_data.get("column_averages"), dict) else {}
            })
    
    elif question_type == "scale":
        if "options_distribution" in analytics_data and isinstance(analytics_data["options_distribution"], list):
            distribution = {}
            scale_points = []
            for item in analytics_data["options_distribution"]:
                if isinstance(item, dict):
                    option_text = item.get("option", "Unknown")
                    distribution[option_text] = item.get("count", 0)
                    scale_points.append(option_text)
            transformed_data.update({
                "scale_points": scale_points,
                "distribution": distribution
            })
    
    elif question_type == "nps":
        if "nps_segments" in analytics_data and isinstance(analytics_data["nps_segments"], dict):
            transformed_data.update({
                "nps_segments": analytics_data["nps_segments"],
                "nps_score": analytics_data.get("nps_score", 0)
            })
        if "distribution" in analytics_data:
            # Fix: Check if distribution is a dict before calling .items()
            distribution_data = analytics_data.get("distribution", {})
            if isinstance(distribution_data, dict):
                transformed_data["distribution"] = {str(k): v for k, v in distribution_data.items()}
            else:
                # If it's not a dict, set an empty dict as fallback
                transformed_data["distribution"] = {}
    
    return transformed_data

# --- ADDED: Common Generation Rules ---
GENERATION_RULES = """
Adhere STRICTLY to these rules for any generated or modified questions:
1.  Title: Generate a concise, relevant title. For full surveys, avoid generic placeholders if possible.
2.  Description: Keep descriptions brief or empty unless specified.
3.  Scale (`question_type`: "scale"): Use the `scale_points` array for labels (e.g., ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]). Default to 5 points unless specified. This type represents a labeled scale where the text label itself is the value. Do NOT use `rating_start/end/step` or `options` for this type. Ensure that scale_points are ordered from negative to positive (e.g., ["Never", "Rarely", "Sometimes", "Often", "Always"]). Do not start with positive options like "Always" unless explicitly specified. Do not use "Not Applicable" as a scale point. Always ensure that the question that you are going to ask is answerable using the scale points. 
4.  Rating (`question_type`: "rating"): Use `rating_start`, `rating_end`, `rating_step` for numerical scales like sliders or star ratings. ALWAYS default to slider range 1-10 (start=1, end=10, step=1) unless specifically requested otherwise. ALWAYS include contextually relevant `left_label` and `right_label` based on the question content (e.g., "Not at all satisfied" / "Extremely satisfied", "Poor" / "Excellent", "Never" / "Always"). Do NOT include `center_label` - leave it empty. Do *not* use `options` or `scale_points` for this type.
5.  Interactive Ranking (`question_type`: "interactive-ranking"): MUST include `ranking_items` array with format `[{"text": "Item 1"}, {"text": "Item 2"}, {"text": "Item 3"}]`. Generate 3-6 relevant items for users to rank. Do NOT use `options` or `scale_points` for this type. This creates a drag-and-drop ranking interface.
6.  Scale Direction: Ensure numerical scales (`rating`, `nps`) flow logically low-to-high / negative-to-positive (e.g., 1=Low, 10=High, 0=Not Likely, 10=Very Likely). Labeled scales (`scale`) should also generally follow a logical progression (e.g., Disagree to Agree).
7.  Not Applicable (`show_na` / `not_applicable` flags): If this flag is true for a scale/choice/grid question, ensure the 'Not Applicable' (or custom text from `not_applicable_text`) option is the *last* choice in `scale_points` or `options`, or the last column in `grid_columns`.
8.  NPS (`question_type`: "nps"): MUST use standard 0-10 scale. Set `rating_start`: 0, `rating_end`: 10, `rating_step`: 1. Add labels via `nps_left_label` ('Not at all likely') / `nps_right_label` ('Extremely likely'). Do *not* use `options` or `scale_points`.
9.  Open-Ended (`question_type`: "open-ended"): Include only if relevant to the prompt/request. Use for general text input.
10. JSON Format: Return ONLY valid JSON objects as requested (full survey, single question, or update structure). No extra text, explanations, apologies, or markdown formatting outside the JSON.
11. Question Structure: Ensure all required fields for the specific question type are present in the JSON ('question_text', 'question_type'). Include `sequence_number` and `required` (boolean). Include type-specific fields (`options`, `grid_rows`, `rating_start`, `image_options`, `ranking_items`, `scale_points`, `allowed_types`, etc.) *only* when necessary for the specified `question_type`. Set boolean flags correctly (e.g., `not_applicable`, `has_other_option`, `show_na`, `numerical_branch_enabled`, `disqualify_enabled`).
12. CRITICAL - Allowed Question Types: The 'question_type' field for every generated question MUST be one of the following exact strings: 'open-ended', 'single-choice', 'multi-choice', 'dropdown', 'rating', 'nps', 'numerical-input', 'email-input', 'date-picker', 'radio-grid', 'checkbox-grid', 'star-rating', 'star-rating-grid', 'signature', 'single-image-select', 'multiple-image-select', 'document-upload', 'interactive-ranking', 'scale', 'content-text', 'content-media'. Do NOT invent other types (e.g., 'yes/no', 'likert', 'rating-scale') or use variations.
13. Question Count: Generate a reasonable number of questions based on the context (e.g., 3-10 for quick, guided counts, respect edit requests).
14. Field Usage by Type:
    - `options` array (format `[{ "text": "string", ... }]`): Use ONLY for 'single-choice', 'multi-choice', 'dropdown'.
    - `scale_points` array (format `["string", ...]`) : Use ONLY for 'scale'.
    - `ranking_items` array (format `[{"text": "string"}, ...]`): Use ONLY for 'interactive-ranking'.
    - `rating_start/end/step`: Use ONLY for 'rating', 'nps', 'star-rating-grid', 'star-rating'.
    - `left_label/right_label`: Use for 'rating' questions with contextually relevant labels.
    - `grid_rows/columns`: Use ONLY for grid types ('radio-grid', 'checkbox-grid', 'star-rating-grid').
    - Do not mix these fields inappropriately (e.g., do not add `options` to an `nps` question).
15. A single question type should not be repeatedly used in a single survey unless specified ( maximum let a question type repeat twice ). For example, if the user requests a survey with 10 questions, do not generate 10 open-ended questions unless explicitly requested.
"""

def wait_for_run_completion(thread_id, run_id):
    """Waits for an OpenAI Assistant run to complete, handling errors and timeouts."""
    from app.openai_client_setup import get_openai_client
    
    # Get the dynamic client
    openai_client = get_openai_client()
    if openai_client is None:
        raise Exception("Failed to get OpenAI client - API key may be missing")
        
    start_time = time.time()
    while True:
        try:
            run = openai_client.beta.threads.runs.retrieve(
                thread_id=thread_id, run_id=run_id
            )
            current_app.logger.debug(f"Run {run_id} status: {run.status}")  # Added logging
            if run.status == "completed":
                return run
            # Handle terminal states
            if run.status in [
                "failed",
                "cancelled",
                "expired",
                "requires_action",
            ]:  # Added requires_action
                # Log error details if available
                error_details = (
                    run.last_error
                    if hasattr(run, "last_error") and run.last_error
                    else "No details provided."
                )
                current_app.logger.error(
                    f"[AI ERROR] Run {run_id} ended with status: {run.status}. Details: {error_details}"
                )
                # Handle 'requires_action' if using function calling later
                if run.status == "requires_action":
                    raise Exception(
                        f"Run requires action (Tool Call): {run.id}. Action details: {run.required_action}"
                    )  # Include details
                raise Exception(
                    f"Run ended with status: {run.status}. Details: {error_details}"
                )

            # Check for timeout
            if time.time() - start_time > MAX_POLL_TIME:
                current_app.logger.error(
                    f"[AI ERROR] Run {run_id} timed out after {MAX_POLL_TIME} seconds."
                )
                # Attempt to cancel the run
                try:
                    openai_client.beta.threads.runs.cancel(
                        thread_id=thread_id, run_id=run_id
                    )
                    current_app.logger.warning(
                        f"[AI WARN] Attempted to cancel timed-out run {run_id}"
                    )
                except Exception as cancel_err:
                    current_app.logger.warning(
                        f"[AI WARN] Could not cancel timed-out run {run_id}: {cancel_err}"
                    )
                raise TimeoutError(
                    f"Run timed out after {MAX_POLL_TIME} seconds"
                )  # Use specific error

            time.sleep(POLL_INTERVAL)
        except Exception as e:
            # Log any exception during polling and re-raise
            current_app.logger.error(
                f"[AI ERROR] Error during run retrieval/polling for {run_id}: {e}",
                exc_info=True,
            )
            raise e  # Re-raise to signal failure


# --- Helper to get or create generic chat thread ---
def _get_or_create_generic_thread():
    """Gets the first ChatThread ID or creates one if none exists."""
    from app.openai_client_setup import get_openai_client
    
    # Get the OpenAI client (will initialize if needed)
    current_app.logger.info("[AI DEBUG] Getting OpenAI client...")
    client = get_openai_client()
    
    if client is None:
        current_app.logger.error("[AI ERROR] Failed to get OpenAI client")
        raise Exception("Failed to initialize OpenAI client - API key may be missing")
    
    thread_rec = ChatThread.query.first()
    if not thread_rec:
        current_app.logger.info("[AI DEBUG] No generic ChatThread found, creating one.")
        try:
            new_thread = client.beta.threads.create()
            thread_rec = ChatThread(thread_id=new_thread.id)
            db.session.add(thread_rec)
            db.session.commit()
            current_app.logger.info(
                f"[AI DEBUG] Created generic ChatThread with ID: {thread_rec.thread_id}"
            )
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f"[AI ERROR] Failed to create generic ChatThread: {e}", exc_info=True
            )
            raise  # Re-raise after logging
    return thread_rec.thread_id


# --- Helper to parse JSON robustly ---
def _parse_json_from_response(raw_text):
    """Attempts to parse JSON from a string, handling markdown code blocks and extraction."""
    if not raw_text:
        current_app.logger.warning("[AI WARN] Received empty text for JSON parsing.")
        return None

    current_app.logger.info(f"[AI PARSE] Starting JSON parsing from text (length: {len(raw_text)})")
    current_app.logger.info(f"[AI PARSE] Raw text to parse:")
    current_app.logger.info("-" * 40)
    current_app.logger.info(raw_text)
    current_app.logger.info("-" * 40)

    # Remove potential markdown code blocks more robustly
    cleaned_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
    cleaned_text = re.sub(r"\s*```$", "", cleaned_text, flags=re.MULTILINE).strip()

    current_app.logger.info(f"[AI PARSE] Text after markdown removal:")
    current_app.logger.info("-" * 40)
    current_app.logger.info(cleaned_text)
    current_app.logger.info("-" * 40)

    if not cleaned_text:
        current_app.logger.warning("[AI WARN] Cleaned text is empty after removing markdown.")
        return None

    # Try direct parsing first
    try:
        current_app.logger.info("[AI PARSE] Attempting direct JSON parsing...")
        parsed = json.loads(cleaned_text)
        current_app.logger.info("[AI PARSE] ✓ Successfully parsed JSON directly!")
        current_app.logger.info(f"[AI PARSE] Parsed object type: {type(parsed)}")
        current_app.logger.info(f"[AI PARSE] Parsed object: {parsed}")
        return parsed
    except json.JSONDecodeError as e:
        current_app.logger.warning(f"[AI WARN] Direct JSON parsing failed: {e}. Trying extraction.")
        current_app.logger.info(f"[AI PARSE] JSON error at position {e.pos}: {e.msg}")
        
        # Try to find JSON objects in the text
        json_patterns = [
            r'\{[\s\S]*\}',  # Any object
            r'\[[\s\S]*\]',  # Any array
        ]
        
        for i, pattern in enumerate(json_patterns):
            current_app.logger.info(f"[AI PARSE] Trying pattern {i+1}: {pattern}")
            matches = re.finditer(pattern, cleaned_text, re.DOTALL)
            for j, match in enumerate(matches):
                try:
                    candidate = match.group(0)
                    current_app.logger.info(f"[AI PARSE] Pattern {i+1}, Match {j+1} candidate:")
                    current_app.logger.info(f"[AI PARSE] {candidate}")
                    parsed = json.loads(candidate)
                    current_app.logger.info(f"[AI PARSE] ✓ Successfully extracted JSON using pattern {pattern}")
                    current_app.logger.info(f"[AI PARSE] Extracted object: {parsed}")
                    return parsed
                except json.JSONDecodeError as extract_err:
                    current_app.logger.warning(f"[AI PARSE] Pattern {i+1}, Match {j+1} failed: {extract_err}")
                    continue
        
        current_app.logger.error("[AI ERROR] All JSON parsing attempts failed")
        current_app.logger.error(f"[AI ERROR] Final problematic text: {cleaned_text}")
        return None


# --- chat_controller (Interactive follow-up questions) ---
def chat_controller(data):
    """Handles the interactive chat for clarifying survey requirements."""
    user_message = data.get("message")
    if not user_message:
        return {"error": "No user message provided"}, 400

    try:
        from app.openai_client_setup import get_openai_client
        
        # Get the dynamic client
        openai_client = get_openai_client()
        if openai_client is None:
            return {"error": "Failed to initialize OpenAI client - API key may be missing"}, 500
            
        thread_id = _get_or_create_generic_thread()

        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=user_message
        )

        # Check message count (consider only assistant messages for limit?)
        all_msgs = openai_client.beta.threads.messages.list(thread_id=thread_id)
        asst_msgs = [m for m in all_msgs.data if m.role == "assistant"]

        if len(asst_msgs) >= MAX_QUESTIONS:
            current_app.logger.info(
                f"[AI CHAT] Max questions ({MAX_QUESTIONS}) reached for thread {thread_id}."
            )
            return {
                "response": "You've reached the maximum number of questions. Please generate your survey now.",
                "question_count": len(asst_msgs),
            }, 200

        # Instructions for the follow-up question assistant
        instructions = (
            "You are a survey conversation bot. Your goal is to help the user clarify their survey requirements by asking insightful questions. "
            "Analyze the conversation history. Ask ONE clear, concise follow-up question relevant to the user's latest message or the overall survey goals (e.g., about the survey's topic, target audience, desired question types, number of questions, specific details needed). "
            "Do NOT generate survey questions. Do NOT provide explanations, summaries, or conversational filler. "
            "Respond ONLY with the single question text."
        )
        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=follow_up_question_asst_id,
            instructions=instructions,
        )

        run = wait_for_run_completion(thread_id, run.id)

        # Fetch the latest message, which should be the assistant's response
        updated_msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not updated_msgs.data or updated_msgs.data[0].role != "assistant":
            current_app.logger.error("[AI ERROR] No assistant message found after chat run.")
            # Consider deleting the last user message if the run failed before assistant reply?
            return {"error": "AI assistant did not respond."}, 500

        asst_msg_content = updated_msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI ERROR] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        text_value = asst_msg_content[0].text.value

        # Recalculate assistant message count after successful run
        final_asst_msgs = [
            m
            for m in openai_client.beta.threads.messages.list(thread_id=thread_id).data
            if m.role == "assistant"
        ]
        return {"response": text_value, "question_count": len(final_asst_msgs)}, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] Chat controller run timed out: {e}", exc_info=True
        )
        return {"error": f"AI interaction timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Chat controller failed: {e}", exc_info=True
        )
        # Provide a more generic error to the user
        return {
            "error": f"An error occurred during AI interaction. Please try again."
        }, 500


# --- quick_generate_survey_ai (Generate from simple prompt) ---
def quick_generate_survey_ai(prompt, business_id=None):
    """Generates a full survey JSON from a single user prompt using AI."""
    if not prompt:
        return {"error": "Prompt is required for quick generation"}, 400
    
    # Start timing for analytics
    start_time = time.time()
    usage_log_id = None
    
    try:
        from app.openai_client_setup import get_openai_client
        
        # Get the dynamic client
        openai_client = get_openai_client()
        if openai_client is None:
            return {"error": "Failed to initialize OpenAI client - API key may be missing"}, 500
            
        thread_id = _get_or_create_generic_thread()
        current_app.logger.info(f"[AI QUICK GEN] Using thread ID: {thread_id}")
        current_app.logger.info(f"[AI QUICK GEN] User prompt: {prompt}")

        # Add the user's prompt as a message
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=prompt
        )

        # Use the centrally defined generation rules
        instructions = (
            f"Generate a complete survey JSON based ONLY on the latest user message (the prompt). {GENERATION_RULES}"
        )

        current_app.logger.info("[AI QUICK GEN] Creating run...")
        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=quick_survey_gen_asst_id,
            instructions=instructions,
        )
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(f"[AI QUICK GEN] Run completed: {run.status}")

        # Fetch the latest message (assistant's response)
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            raise ValueError("No assistant message found after quick generation run.")

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            raise ValueError(
                "Assistant message content is empty or invalid after quick generation run."
            )

        raw_response = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI QUICK GEN] Raw Response: {raw_response[:500]}...")

        survey_json = _parse_json_from_response(raw_response)

        if (
            not survey_json
            or not isinstance(survey_json, dict)
            or "questions" not in survey_json
        ):
            current_app.logger.error("[AI QUICK GEN] Failed to parse valid survey JSON.")
            # Try to extract explanation text (outside ```json blocks)
            explanation = re.sub(r"```json.*?```", "", raw_response, flags=re.DOTALL).strip()
            error_msg = "AI failed to generate valid JSON."
            if explanation and len(explanation) > 10:  # Avoid logging very short/irrelevant text
                error_msg += f" Assistant said: {explanation[:200]}..."  # Limit length
            raise ValueError(error_msg)

        # Apply default title/description rules if AI missed them
        if "title" not in survey_json or not survey_json.get("title"):
            survey_json["title"] = "Survey based on your prompt"
            current_app.logger.warning(
                "[AI QUICK GEN] AI did not provide a title, added default."
            )
        if "description" not in survey_json:
            survey_json["description"] = ""  # Ensure description key exists and is empty

        current_app.logger.info("[AI QUICK GEN] Generated survey JSON successfully.")
        
        # Estimate OpenAI cost
        cost_info = estimate_openai_cost(prompt, raw_response)
        
        # Log successful operation
        processing_time = time.time() - start_time
        usage_log_id = AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype='quick',
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=True,
            metadata={
                'prompt_length': len(prompt),
                'questions_generated': len(survey_json.get('questions', [])),
                'survey_title': survey_json.get('title', ''),
                'business_id': business_id
            },
            estimated_tokens=cost_info['estimated_tokens'],
            openai_cost_usd=cost_info['openai_cost_usd'],
            input_tokens=cost_info['input_tokens'],
            output_tokens=cost_info['output_tokens'],
            model_used=cost_info['model_used'],
            business_id=business_id
        )
        
        # Log detailed survey generation info
        if usage_log_id:
            AIUsageAnalyticsController.log_survey_generation(
                usage_log_id=usage_log_id,
                generation_type='quick',
                prompt_text=prompt[:500],  # Truncate for storage
                questions_generated=len(survey_json.get('questions', [])),
                survey_title=survey_json.get('title', '')
            )
            db.session.commit()
        
        return {"survey": survey_json}, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] Quick generation run timed out: {e}", exc_info=True
        )
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype='quick',
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e),
            business_id=business_id
        )
        db.session.commit()
        
        return {"error": f"Quick Survey generation timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Quick generation failed: {e}", exc_info=True
        )
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype='quick',
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e),
            business_id=business_id
        )
        db.session.commit()
        
        return {"error": f"Quick Survey generation failed: {str(e)}"}, 500


# --- guided_generate_survey_ai (Generate from structured inputs) ---
def guided_generate_survey_ai(industry, goal, description, tone_length, business_id=None):
    """Generates a tailored survey JSON based on guided user inputs."""
    if not all([industry, goal, description, tone_length]):
        return {"error": "Missing required inputs for guided generation"}, 400
    
    # Start timing for analytics
    start_time = time.time()
    usage_log_id = None
    
    # Determine subtype based on tone_length
    if "short" in tone_length.lower():
        operation_subtype = "guided_short"
    elif "balanced" in tone_length.lower():
        operation_subtype = "guided_medium"
    elif "deep dive" in tone_length.lower():
        operation_subtype = "guided_long"
    else:
        operation_subtype = "guided_medium"  # Default
    
    try:
        thread_id = _get_or_create_generic_thread()
        current_app.logger.info(f"[AI GUIDED GEN] Using thread ID: {thread_id}")
        current_app.logger.info(
            f"[AI GUIDED GEN] Inputs: Industry='{industry}', Goal='{goal}', Desc='{description[:50]}...', Tone='{tone_length}'"
        )

        # Construct the user message with context
        user_context = f"""
        Please generate a tailored survey based on the following requirements:
        - Industry / Context: {industry}
        - Primary Goal of the Survey: {goal}
        - Specific Feedback Focus / Description: {description}
        - Desired Survey Tone & Length: {tone_length}

        Return the complete survey as a single JSON object.
        """
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=user_context
        )

        # Determine question count based on tone/length for instructions
        if "short" in tone_length.lower():
            q_count_range = "3-5"
        elif "balanced" in tone_length.lower():
            q_count_range = "6-9"
        elif "deep dive" in tone_length.lower():
            q_count_range = "8-12"  # Limit deep dive
        else:
            q_count_range = "5-10"  # Default fallback

        # Prepare specific tailoring instruction to inject into GENERATION_RULES
        # Make rule 8 more specific
        tailoring_instruction = f"8. Tailoring: Questions MUST strongly reflect the specified Industry/Context ({industry}), Survey Goal ({goal}), and Feedback Focus ({description}). The overall survey should align with the '{tone_length}' request."
        # Make rule 10 more specific
        count_instruction = (
            f"10. Question Count: Generate approximately {q_count_range} questions relevant to the inputs."
        )

        # Replace placeholder rules with specific instructions
        specific_rules = GENERATION_RULES
        # Use regex for safer replacement, accounting for potential minor variations
        specific_rules = re.sub(
            r"8\.\s*Tailoring:.*", tailoring_instruction, specific_rules
        )
        specific_rules = re.sub(
            r"10\.\s*Question Count:.*", count_instruction, specific_rules
        )

        # Final instructions for the assistant run
        instructions = f"Generate a tailored survey JSON based ONLY on the latest user message inputs. {specific_rules}"

        current_app.logger.info("[AI GUIDED GEN] Creating run...")
        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=guided_survey_gen_asst_id,
            instructions=instructions,
        )
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(f"[AI GUIDED GEN] Run completed: {run.status}")

        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            raise ValueError("No assistant message found after guided generation run.")

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            raise ValueError(
                "Assistant message content is empty or invalid after guided generation run."
            )

        raw_response = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI GUIDED GEN] Raw Response: {raw_response[:500]}...")

        survey_json = _parse_json_from_response(raw_response)

        if (
            not survey_json
            or not isinstance(survey_json, dict)
            or "questions" not in survey_json
        ):
            current_app.logger.error("[AI GUIDED GEN] Failed to parse valid survey JSON.")
            explanation = re.sub(r"```json.*?```", "", raw_response, flags=re.DOTALL).strip()
            error_msg = "AI failed to generate valid JSON."
            if explanation and len(explanation) > 10:
                error_msg += f" Assistant said: {explanation[:200]}..."
            raise ValueError(error_msg)

        # Apply default title/description if missing or empty
        if "title" not in survey_json or not survey_json.get("title"):
            # Try to generate a more relevant default title
            survey_json["title"] = f"{industry} Survey - {goal}"
            current_app.logger.warning(
                "[AI GUIDED GEN] AI did not provide a title, added default."
            )
        if "description" not in survey_json:
            survey_json["description"] = ""  # Ensure description key exists

        current_app.logger.info("[AI GUIDED GEN] Generated survey JSON successfully.")
        
        # Estimate OpenAI cost
        cost_info = estimate_openai_cost(user_context, raw_response)
        
        # Log successful operation
        processing_time = time.time() - start_time
        usage_log_id = AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype=operation_subtype,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=True,
            metadata={
                'industry': industry,
                'goal': goal,
                'tone_length': tone_length,
                'questions_generated': len(survey_json.get('questions', [])),
                'survey_title': survey_json.get('title', ''),
                'business_id': business_id
            },
            estimated_tokens=cost_info['estimated_tokens'],
            openai_cost_usd=cost_info['openai_cost_usd'],
            input_tokens=cost_info['input_tokens'],
            output_tokens=cost_info['output_tokens'],
            model_used=cost_info['model_used'],
            business_id=business_id
        )
        
        # Log detailed survey generation info
        if usage_log_id:
            AIUsageAnalyticsController.log_survey_generation(
                usage_log_id=usage_log_id,
                generation_type='guided',
                industry=industry,
                goal=goal,
                tone_length=tone_length,
                questions_generated=len(survey_json.get('questions', [])),
                survey_title=survey_json.get('title', '')
            )
            db.session.commit()
        
        return {"survey": survey_json}, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] Guided generation run timed out: {e}", exc_info=True
        )
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype=operation_subtype,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e),
            business_id=business_id
        )
        db.session.commit()
        
        return {"error": f"Guided Survey generation timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Guided generation failed: {e}", exc_info=True
        )
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='survey_generation',
            operation_subtype=operation_subtype,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e),
            business_id=business_id
        )
        db.session.commit()
        
        return {"error": f"Guided Survey generation failed: {str(e)}"}, 500


# --- generate_ai_report_insights (Generate report from response data) ---

def generate_ai_report_insights(
    survey_id, selected_question_ids, filters, comparison_settings
):
    """
    Generates AI-driven insights with detailed analytics and trend analysis.
    """
    if not survey_id or not selected_question_ids:
        return {"error": "Survey ID and selected question IDs are required"}, 400

    # Start timing for analytics
    start_time = time.time()
    usage_log_id = None

    try:
        print("\n=== AI INSIGHTS START ===")
        print(f"Survey ID: {survey_id}")
        print(f"Selected Questions: {selected_question_ids}")
        print(f"Filters: {json.dumps(filters, indent=2)}")
        print(f"Comparison Settings: {json.dumps(comparison_settings, indent=2)}")
        print("========================\n")

        survey = Survey.query.get(survey_id)
        if not survey:
            return {"error": "Survey not found"}, 404

        # Get all questions for the survey to map IDs to types later
        survey_questions_map = {q.id: q for q in survey.questions}
        print(f"\nFound {len(survey_questions_map)} questions in survey")
        print("Question IDs:", list(survey_questions_map.keys()))

        warnings = {} # Stores backend calculated warnings { qid: message }
        analysis_statuses = {} # Stores backend calculated status { qid: status }
        question_analytics_data = {} # Stores fetched analytics { qid: data } or { qid: { segment: data } }
        open_ended_sample_sizes = {} # { segment_key or 'overall': count }
        trend_data = {} # Enhanced: stores trend analysis
        statistical_context = {} # Enhanced: stores statistical context

        is_comparison = (
            comparison_settings
            and comparison_settings.get("type") != "No Comparison"
            and len(comparison_settings.get("segments", [])) >= 2
        )
        print(f"\nComparison Mode: {is_comparison}")
        if is_comparison:
            print(f"Comparison Type: {comparison_settings.get('type')}")
            print(f"Segments: {comparison_settings.get('segments')}")

        # --- Data Fetching & Pre-computation ---
        total_filtered_responses = 0 # Overall count matching base filters

        if is_comparison:
            comp_type = comparison_settings["type"]
            segments = comparison_settings["segments"]
            segment_data_map = {} # Temp map for fetching { segment: { qid: analytics } }
            segment_sample_sizes = {} # { segment: total_responses }

            if not segments or len(segments) < 2:
                return {"error": "Comparison requires at least two valid segments"}, 400

            print("\n=== Processing Segments ===")
            for segment in segments:
                segment_key = str(segment) # Ensure key is string
                segment_filter = {**filters, comp_type: [segment]} # Apply segment filter on top of base
                print(f"\nProcessing Segment: {segment_key}")
                print(f"Applied Filters: {json.dumps(segment_filter, indent=2)}")

                # Get overall segment sample size (useful context, less reliable for per-Q check)
                segment_summary_data, status = ResponseController.get_multi_demographic_analytics(survey_id, segment_filter)
                segment_size = 0
                if status == 200 and segment_summary_data:
                     segment_size = segment_summary_data.get("total_responses", 0)
                segment_sample_sizes[segment_key] = segment_size
                total_filtered_responses += segment_size # Add to overall count (can overestimate if overlap)
                print(f"Segment Base Sample Size: {segment_size}")

                segment_data_map[segment_key] = {}
                segment_open_ended_count = 0

                # Fetch analytics per selected question for this segment
                print("\nProcessing Questions for Segment:")
                for qid in selected_question_ids:
                    question = survey_questions_map.get(qid)
                    if not question:
                        print(f"WARNING: Question ID {qid} not found in survey {survey_id}. Skipping.")
                        continue

                    q_analytics_resp, q_status = ResponseController.get_filtered_question_analytics(
                        survey_id, qid, segment_filter
                    )

                    if q_status == 200 and q_analytics_resp and "analytics" in q_analytics_resp:
                        segment_data_map[segment_key][qid] = q_analytics_resp["analytics"]
                        # Track open-ended count per segment
                        if question.question_type == "open-ended":
                             segment_open_ended_count += q_analytics_resp["analytics"].get("count_valid", 0)
                        print(f"Question {qid}: Successfully fetched analytics")
                    else:
                        print(f"ERROR: Failed to get analytics for QID {qid}, Segment '{segment_key}'. Status: {q_status}")
                        segment_data_map[segment_key][qid] = {"error": f"Fetch failed (Status: {q_status})"}

                open_ended_sample_sizes[segment_key] = segment_open_ended_count
                print(f"Open-ended responses for segment: {segment_open_ended_count}")

            # Restructure fetched data for easier access: { qid: { segment: analytics } }
            for qid in selected_question_ids:
                question_analytics_data[qid] = {}
                for segment_key in segment_data_map:
                    question_analytics_data[qid][segment_key] = segment_data_map[segment_key].get(qid, {"error": "Not fetched"})

        else: # No Comparison
            print("\n=== Processing Overall Data ===")
            overall_summary_data, status = ResponseController.get_multi_demographic_analytics(survey_id, filters)
            if status == 200 and overall_summary_data:
                total_filtered_responses = overall_summary_data.get("total_responses", 0)
            print(f"Overall Filtered Sample Size: {total_filtered_responses}")

            question_analytics_data["overall"] = {}
            overall_open_ended_count = 0

            print("\nProcessing Individual Questions:")
            for qid in selected_question_ids:
                question = survey_questions_map.get(qid)
                if not question:
                    print(f"WARNING: Question ID {qid} not found in survey {survey_id}. Skipping.")
                    continue

                q_analytics_resp, q_status = ResponseController.get_filtered_question_analytics(
                    survey_id, qid, filters
                )
                if q_status == 200 and q_analytics_resp and "analytics" in q_analytics_resp:
                    question_analytics_data["overall"][qid] = q_analytics_resp["analytics"]
                    if question.question_type == "open-ended":
                        overall_open_ended_count += q_analytics_resp["analytics"].get("count_valid", 0)
                    
                    # Enhanced: Calculate trend and statistical data
                    trend_data[qid] = _calculate_trend_metrics(survey_id, qid, q_analytics_resp["analytics"])
                    statistical_context[qid] = _calculate_statistical_context(question, q_analytics_resp["analytics"])
                    print(f"Question {qid}: Successfully processed analytics and trends")
                else:
                    print(f"ERROR: Failed to get analytics for QID {qid} (Overall). Status: {q_status}")
                    question_analytics_data["overall"][qid] = {"error": f"Fetch failed (Status: {q_status})"}

            open_ended_sample_sizes["overall"] = overall_open_ended_count
            print(f"Total open-ended responses: {overall_open_ended_count}")

        # --- Apply Sample Size Rules (Backend Calculation) ---
        print("\n=== Applying Sample Size Rules ===")
        for qid in selected_question_ids:
            question = survey_questions_map.get(qid)
            if not question: continue # Skip if question doesn't exist

            q_type = question.question_type
            min_thresh = OPEN_ENDED_MIN_SAMPLE if q_type == "open-ended" else QUANTITATIVE_MIN_SAMPLE
            caution_thresh = OPEN_ENDED_CAUTION_SAMPLE if q_type == "open-ended" else QUANTITATIVE_CAUTION_SAMPLE

            min_sample_in_comparison = float('inf')
            caution_triggered = False
            error_in_segment = False
            segment_with_min_sample = None
            segment_triggering_caution = None

            print(f"\nChecking Question {qid}:")
            print(f"Type: {q_type}")
            print(f"Minimum Threshold: {min_thresh}")
            print(f"Caution Threshold: {caution_thresh}")

            if is_comparison:
                for segment_key in comparison_settings["segments"]:
                    segment_analytics = question_analytics_data.get(qid, {}).get(segment_key, {})
                    if "error" in segment_analytics:
                        error_in_segment = True
                        warnings[qid] = f"Data unavailable for segment '{segment_key}'. Comparison skipped."
                        analysis_statuses[qid] = "Skipped_FetchError"
                        print(f"ERROR: Data unavailable for segment '{segment_key}'")
                        break # Skip further checks for this question if one segment failed

                    # Use 'count_valid' or a suitable metric from analyticsDetails
                    q_sample_size = _compute_sample_size(segment_analytics, q_type)
                    print(f"Segment '{segment_key}' sample size: {q_sample_size}")

                    if q_sample_size < min_sample_in_comparison:
                        min_sample_in_comparison = q_sample_size
                        segment_with_min_sample = segment_key

                    if q_sample_size < caution_thresh:
                        caution_triggered = True
                        segment_triggering_caution = segment_key # Store the first segment triggering caution

                if error_in_segment: continue # Already handled

                if min_sample_in_comparison < min_thresh:
                    analysis_statuses[qid] = "Skipped_SampleSize"
                    warnings[qid] = f"Sample size too small in segment '{segment_with_min_sample}' ({min_sample_in_comparison} < {min_thresh}). Comparison skipped."
                    print(f"WARNING: Sample size too small in segment '{segment_with_min_sample}'")
                elif caution_triggered:
                    analysis_statuses[qid] = "Caution_SampleSize"
                    # Generic comparison caution message is better here
                    warnings[qid] = f"One or more comparison groups have fewer than {caution_thresh} responses. Interpret results with caution."
                    print(f"CAUTION: Low sample size in segment '{segment_triggering_caution}'")
                else:
                    analysis_statuses[qid] = "Success"
                    warnings[qid] = None
                    print("Sample size checks passed")

            else: # No Comparison
                overall_analytics = question_analytics_data.get("overall", {}).get(qid, {})
                if "error" in overall_analytics:
                     analysis_statuses[qid] = "Skipped_FetchError"
                     warnings[qid] = f"Data unavailable for this question (Overall). Analysis skipped."
                     print("ERROR: Data unavailable for overall analysis")
                     continue

                q_sample_size = _compute_sample_size(overall_analytics, q_type)
                print(f"Overall sample size: {q_sample_size}")

                if q_sample_size < min_thresh:
                    analysis_statuses[qid] = "Skipped_SampleSize"
                    warnings[qid] = f"SKIP Analysis: Sample size ({q_sample_size}) too small (<{min_thresh})."
                    print(f"WARNING: Sample size too small")
                elif q_sample_size < caution_thresh:
                    analysis_statuses[qid] = "Caution_SampleSize"
                    warnings[qid] = f"Low sample size ({q_sample_size} < {caution_thresh}). Interpret with caution."
                    print("CAUTION: Low sample size")
                else:
                    analysis_statuses[qid] = "Success"
                    warnings[qid] = None
                    print("Sample size checks passed")

        # Determine overall status for open-ended analysis
        print("\n=== Open-ended Analysis Status ===")
        open_ended_status = "Success"
        open_ended_warning = None
        min_oe_sample = min(open_ended_sample_sizes.values()) if open_ended_sample_sizes else 0
        print(f"Minimum open-ended sample size: {min_oe_sample}")

        if min_oe_sample < OPEN_ENDED_MIN_SAMPLE:
             open_ended_status = "Skipped_SampleSize"
             open_ended_warning = "Sample size too small to analyze open-ended responses."
             print("WARNING: Sample size too small for open-ended analysis")
        elif min_oe_sample < OPEN_ENDED_CAUTION_SAMPLE:
             open_ended_status = "Caution_SampleSize"
             open_ended_warning = "Small sample size for open-ended responses. Interpret themes with caution."
             print("CAUTION: Low sample size for open-ended analysis")
        else:
             print("Open-ended sample size checks passed")

        # --- Construct Enhanced AI Input JSON Structure ---
        print("\n=== Constructing AI Input ===")
        
        # Build the questions array with enhanced data
        ai_questions = []
        open_ended_responses_collection = []
        
        for qid in selected_question_ids:
            question = survey_questions_map.get(qid)
            if not question: continue

            status = analysis_statuses.get(qid, "Error")
            warning = warnings.get(qid)

            # Skip questions that have fetch errors or insufficient data
            if "Skipped" in status:
                print(f"Skipping question {qid} due to status: {status}")
                continue
                
            print(f"\nProcessing question {qid} for AI input:")
            # Build question data based on type and comparison mode
            question_data = {
                "question_id": str(qid),
                "question_text": question.question_text,
                "question_type": question.question_type,
                "sequence_number": question.sequence_number,
                "sample_size": 0,  # Will be calculated below
            }
            
            if is_comparison:
                # For comparison mode, structure data by segments
                question_data["comparison_mode"] = True
                question_data["comparison_type"] = comp_type
                question_data["segments"] = {}
                
                for segment_key in comparison_settings["segments"]:
                    seg_data = question_analytics_data.get(qid, {}).get(segment_key, {})
                    if "error" not in seg_data:
                        question_data["segments"][segment_key] = _transform_analytics_to_ai_format(
                            question, seg_data, segment_sample_sizes.get(segment_key, 0)
                        )
                        print(f"Added segment data for '{segment_key}'")
                        
            else:
                # For overall analysis with enhanced context
                question_data["comparison_mode"] = False
                overall_data = question_analytics_data.get("overall", {}).get(qid, {})
                if "error" not in overall_data:
                    sample_size = _compute_sample_size(overall_data, question.question_type)
                    question_data["sample_size"] = sample_size
                    print(f"Sample size: {sample_size}")
                    
                    # Enhanced: Add trend and statistical context
                    # For open-ended, limit payload to avoid token bloat and include word frequencies only
                    if question.question_type == "open-ended":
                        oe_payload = {
                            "sample_size": sample_size,
                            "has_text_responses": True,
                        }
                        # Include top-N word frequencies if available
                        wf = overall_data.get("word_frequencies") or overall_data.get("word_frequencies_top")
                        if isinstance(wf, dict):
                            # Convert dict to sorted list
                            items = sorted(wf.items(), key=lambda x: x[1], reverse=True)[:30]
                            oe_payload["word_frequencies"] = [{"word": str(w), "frequency": int(c)} for w, c in items]
                        elif isinstance(wf, list):
                            # Already a list of objects
                            try:
                                top_items = sorted(wf, key=lambda x: x.get("frequency", x.get("count", 0)), reverse=True)[:30]
                            except Exception:
                                top_items = wf[:30]
                            # Normalize keys
                            norm = []
                            for it in top_items:
                                word = str(it.get("word") or it.get("term") or it.get("text") or "")
                                freq = int(it.get("frequency", it.get("count", 0)) or 0)
                                if word:
                                    norm.append({"word": word, "frequency": freq})
                            oe_payload["word_frequencies"] = norm
                        question_data["analytics_data"] = oe_payload
                    else:
                        question_data["analytics_data"] = _transform_analytics_to_ai_format(question, overall_data, sample_size)
                    question_data["trend_metrics"] = trend_data.get(qid, {})
                    question_data["statistical_context"] = statistical_context.get(qid, {})
                    print("Added enhanced analytics data")
                    
                    # Do not attach raw open-ended samples to reduce token usage
            
            ai_questions.append(question_data)
            print(f"Successfully processed question {qid} for AI input")

        # Build the enhanced AI input structure
        ai_input_json = {
            "survey_id": str(survey_id),
            "survey_title": survey.title or "Survey Analysis",
            "global_sample_size": total_filtered_responses,
            "analysis_focus": "trends_and_performance",
            "instructions": {
                "system_prompt": "You are an advanced data analyst AI specializing in trend analysis and performance metrics. Focus on statistical insights, performance changes, directional trends, and comparative analysis. Provide specific percentages, statistical significance, and actionable insights based on data patterns.",
                "analysis_type": "detailed_analytics_with_trends"
            },
            "questions": ai_questions
        }
        
        # Add open-ended responses if any exist
        if open_ended_responses_collection:
            ai_input_json["open_ended_responses"] = {
                "total_count": len(open_ended_responses_collection),
                "sampled_responses": open_ended_responses_collection[:50],  # Limit for AI processing
                "analysis_status": open_ended_status
            }
            print(f"\nAdded {len(open_ended_responses_collection[:50])} open-ended responses for analysis")
        
        # Helpful maps for later reconciliation and fallbacks
        ai_questions_map = {str(q.get("question_id")): q for q in ai_questions}

        # Convert to JSON string for the prompt
        ai_input_json_str = json.dumps(ai_input_json, indent=2, default=str)
        print("\nAI Input JSON Structure:")
        print(json.dumps(ai_input_json, indent=2, default=str))
        
        # Create a more robust prompt
        final_prompt = f"""Analyze the following survey data and provide comprehensive insights.

IMPORTANT GUIDELINES:
- Use professional, business-appropriate language only
- DO NOT include any emojis or emoticons in the response
- Focus on data-driven insights and actionable recommendations
- Use clear, concise statements

SURVEY DATA:
{ai_input_json_str}

REQUIRED OUTPUT FORMAT (return valid JSON only):
{{
  "executive_summary": [
    {{
      "headline": "Key finding with specific metrics",
      "detail": "Detailed explanation with data points"
    }}
  ],
  "question_insights": [
    {{
      "question_id": "1",
      "question_text": "Question text",
      "headline": "Primary finding for this question",
      "summary": "Detailed analysis of this question's data",
      "sample_size": 100,
      "statistics": {{
        "primary_metric": "Key metric value",
        "trend_direction": "increasing/decreasing/stable",
        "confidence_level": "High/Medium/Low"
      }},
      "insights": [
        "Specific insight about this question",
        "Another insight about patterns"
      ],
      "chart_data": {{
        "type": "bar",
        "data": [
          {{"category": "Option 1", "value": 50, "percentage": 25}}
        ],
        "title": "Chart title"
      }}
    }}
  ],
  "statistics": {{
    "total_responses": 100,
    "confidence_level": "95%",
    "data_quality_score": "High"
  }},
  "insights": [
    "Overall survey-level insight",
    "Strategic recommendation"
  ]
}}

Return ONLY the JSON object, no additional text."""

        print(f"\n=== Sending to OpenAI ===")
        print(f"Prompt length: {len(final_prompt)} characters")

        # Make the API call to OpenAI
        ai_generated_report = _generate_report_via_openai(final_prompt, survey_id)
        
        if not ai_generated_report:
            print("ERROR: No report received from OpenAI")
            return {"error": "Failed to generate AI insights - OpenAI returned no data"}, 500

        print("\n=== Processing AI Response ===")
        print(f"AI Report Keys: {list(ai_generated_report.keys()) if isinstance(ai_generated_report, dict) else 'Not a dict'}")

        # Build the initial final report structure from AI
        final_report = {
            "advanced_report": {
                "executive_summary": ai_generated_report.get("executive_summary", []),
                "question_insights": ai_generated_report.get("question_insights", []),
                "statistics": ai_generated_report.get("statistics", {}),
                "insights": ai_generated_report.get("insights", [])
            }
        }

        # Ensure we cover all selected questions deterministically: synthesize missing insights without extra AI calls
        try:
            returned_q_insights = final_report["advanced_report"].get("question_insights", []) or []
            # Normalize mapping by question_id (as string)
            insights_by_qid = {}
            for ins in returned_q_insights:
                qid_key = str(ins.get("question_id") or ins.get("id") or "")
                if qid_key:
                    insights_by_qid[qid_key] = ins

            # Determine which questions are analyzable (skip those marked Skipped)
            expected_qids = [str(qid) for qid in selected_question_ids if analysis_statuses.get(qid) in ("Success", "Caution_SampleSize")]
            if not expected_qids:
                # Fallback: if statuses missing for any reason, default to all selected
                expected_qids = [str(qid) for qid in selected_question_ids]
                print("[AI INSIGHTS] WARNING: expected_qids derived empty from statuses; defaulting to all selected questions")

            print(f"[AI INSIGHTS] Returned {len(returned_q_insights)} insights, expected {len(expected_qids)}. Synthesizing missing insights if any.")
            try:
                missing_dbg = [qid for qid in expected_qids if qid not in insights_by_qid]
                print(f"[AI INSIGHTS] Missing insights for QIDs: {missing_dbg}")
            except Exception:
                pass

            def build_minimal_insight(qid_str: str):
                qid_int = int(qid_str)
                q_obj = survey_questions_map.get(qid_int)
                chart = _build_enhanced_chart_data(q_obj, question_analytics_data, qid_int, is_comparison, comparison_settings)
                # Pull overall analytics payload if available to compute primary metric
                overall_payload = {}
                try:
                    if is_comparison:
                        # try first segment if exists
                        seg_map = question_analytics_data.get(qid_int, {})
                        if isinstance(seg_map, dict) and seg_map:
                            overall_payload = list(seg_map.values())[0]
                    else:
                        overall_payload = (question_analytics_data.get("overall", {}) or {}).get(qid_int, {})
                except Exception:
                    overall_payload = {}

                primary_metric = _extract_primary_metric(q_obj, overall_payload) if q_obj else None
                stats_ctx = statistical_context.get(qid_int, {})
                source_q = ai_questions_map.get(qid_str) or {}
                return {
                    "question_id": qid_str,
                    "question_text": getattr(q_obj, "question_text", ""),
                    "headline": "Automated analysis included",
                    "summary": "Synthesized from backend analytics due to AI response truncation.",
                    "sample_size": source_q.get("sample_size", 0),
                    "statistics": {
                        "primary_metric": primary_metric if primary_metric is not None else stats_ctx.get("dominant_choice_percentage", "N/A"),
                        "trend_direction": stats_ctx.get("trend_direction", "stable"),
                        "confidence_level": stats_ctx.get("confidence_level", "95%")
                    },
                    "insights": [],
                    "chart_data": chart
                }

            # Rebuild ordered insights list to cover all expected questions
            ordered_full_insights = []
            for qid in expected_qids:
                ins = insights_by_qid.get(qid)
                if not ins:
                    # Try to get AI insight for this single question with a compact prompt
                    try:
                        q_payload = ai_questions_map.get(qid, {})
                        compact = {
                            "survey_title": survey.title or "Survey Analysis",
                            "global_sample_size": total_filtered_responses,
                            "question": q_payload,
                        }
                        compact_str = json.dumps(compact, indent=2, default=str)
                        single_prompt = (
                            "Analyze this single survey question and return ONLY a JSON object with the fields: "
                            "question_id, question_text, headline, summary, sample_size, "
                            "statistics { primary_metric, trend_direction, confidence_level }, "
                            "insights (array of strings), and chart_data { type, data[{category,value,percentage?}], title }.\n\n"
                            f"DATA:\n{compact_str}\n\n"
                            "Return ONLY the JSON object for this question."
                        )
                        single_resp = _generate_report_via_openai(single_prompt, survey_id)
                        candidate = None
                        if isinstance(single_resp, dict):
                            if "question_id" in single_resp:
                                candidate = single_resp
                            elif "question_insights" in single_resp and isinstance(single_resp["question_insights"], list) and single_resp["question_insights"]:
                                candidate = single_resp["question_insights"][0]
                        if candidate:
                            # Enrich with backend chart/statistics
                            qid_int = int(qid)
                            q_obj = survey_questions_map.get(qid_int)
                            if not candidate.get("statistics"):
                                candidate["statistics"] = statistical_context.get(qid_int, {})
                            backend_chart = _build_enhanced_chart_data(q_obj, question_analytics_data, qid_int, is_comparison, comparison_settings)
                            if backend_chart:
                                candidate["chart_data"] = backend_chart
                            if "sample_size" not in candidate or not candidate.get("sample_size"):
                                candidate["sample_size"] = ai_questions_map.get(qid, {}).get("sample_size", 0)
                            ordered_full_insights.append(candidate)
                            continue
                    except Exception as single_err:
                        current_app.logger.warning(f"[AI INSIGHTS] Single-question AI generation failed for Q{qid}: {single_err}")
                    # Fallback to minimal synthesized insight
                    ordered_full_insights.append(build_minimal_insight(qid))
                else:
                    # Enrich existing insight if missing chart/statistics
                    try:
                        qid_int = int(qid)
                        q_obj = survey_questions_map.get(qid_int)
                        if not ins.get("statistics"):
                            ins["statistics"] = statistical_context.get(qid_int, {})
                        if not ins.get("chart_data"):
                            chart = _build_enhanced_chart_data(q_obj, question_analytics_data, qid_int, is_comparison, comparison_settings)
                            if chart:
                                ins["chart_data"] = chart
                        if "sample_size" not in ins or not ins.get("sample_size"):
                            ins["sample_size"] = ai_questions_map.get(qid, {}).get("sample_size", 0)
                        ordered_full_insights.append(ins)
                    except Exception:
                        ordered_full_insights.append(ins)

            # Replace with the ordered, complete list
            final_report["advanced_report"]["question_insights"] = ordered_full_insights
            print(f"[AI INSIGHTS] Final question_insights count: {len(ordered_full_insights)} (expected {len(expected_qids)})")
        except Exception as reconcile_err:
            print(f"[AI INSIGHTS] Reconciliation error: {reconcile_err}")

        # Ensure we have some content
        if not any([
            final_report["advanced_report"]["executive_summary"],
            final_report["advanced_report"]["question_insights"], 
            final_report["advanced_report"]["insights"]
        ]):
            print("WARNING: Generated report appears to be empty")
            # Provide a fallback report
            final_report["advanced_report"] = {
                "executive_summary": [
                    {
                        "headline": "Analysis completed",
                        "detail": "AI analysis was completed but generated minimal content. This may be due to limited data or processing constraints."
                    }
                ],
                "question_insights": [
                    {
                        "question_id": str(selected_question_ids[0]) if selected_question_ids else "1",
                        "question_text": "Survey question analysis",
                        "headline": "Data processed successfully",
                        "summary": "The question data was processed by the AI system.",
                        "sample_size": 0,
                        "statistics": {
                            "primary_metric": "Analysis completed",
                            "confidence_level": "Medium"
                        },
                        "insights": ["Analysis was completed"],
                        "chart_data": {
                            "type": "info",
                            "data": [],
                            "title": "Analysis Results"
                        }
                    }
                ],
                "statistics": {
                    "total_responses": 0,
                    "confidence_level": "Medium",
                    "data_quality_score": "Limited"
                },
                "insights": ["AI analysis completed with limited results"]
            }

        print(f"\n=== Final Report Generated ===")
        print("Report Structure:")
        print(json.dumps(final_report, indent=2, default=str))
        
        # Estimate OpenAI cost using final_report as proxy for response
        output_text = json.dumps(final_report, default=str)
        cost_info = estimate_openai_cost(final_prompt, output_text)
        
        # Log successful analytics operation
        processing_time = time.time() - start_time
        usage_log_id = AIUsageAnalyticsController.log_ai_operation(
            operation_type='analytics_report',
            operation_subtype='insights',
            survey_id=survey_id,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=True,
            metadata={
                'questions_analyzed': len(selected_question_ids),
                'has_comparison': is_comparison,
                'filters_applied': bool(filters),
                'insights_generated': len(final_report.get('advanced_report', {}).get('question_insights', []))
            },
            estimated_tokens=cost_info['estimated_tokens'],
            openai_cost_usd=cost_info['openai_cost_usd'],
            input_tokens=cost_info['input_tokens'],
            output_tokens=cost_info['output_tokens'],
            model_used=cost_info['model_used']
        )
        
        # Log detailed analytics generation info
        if usage_log_id:
            AIUsageAnalyticsController.log_analytics_generation(
                usage_log_id=usage_log_id,
                survey_id=survey_id,
                questions_analyzed=len(selected_question_ids),
                filters_applied=filters,
                comparison_mode=is_comparison,
                insights_generated=len(final_report.get('advanced_report', {}).get('question_insights', [])),
                charts_generated=sum(1 for insight in final_report.get('advanced_report', {}).get('question_insights', []) if insight.get('chart_data'))
            )
            db.session.commit()
        
        return final_report, 200

    except TimeoutError as e:
        print("\n=== ERROR ===")
        print(f"Enhanced insights generation timed out: {str(e)}")
        print(f"Full error: {e}")
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='analytics_report',
            operation_subtype='insights',
            survey_id=survey_id,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e)
        )
        db.session.commit()
        
        return {"error": f"Enhanced insights generation timed out: {str(e)}"}, 500
    except Exception as e:
        print("\n=== ERROR ===")
        print(f"Enhanced insights generation failed: {str(e)}")
        print(f"Full error: {e}")
        
        # Log failed operation
        processing_time = time.time() - start_time
        AIUsageAnalyticsController.log_ai_operation(
            operation_type='analytics_report',
            operation_subtype='insights',
            survey_id=survey_id,
            points_cost=getattr(g, 'points_needed', 0),
            processing_time=processing_time,
            success=False,
            error_message=str(e)
        )
        db.session.commit()
        
        return {"error": f"Enhanced insights generation failed: {str(e)}"}, 500


# --- Enhanced Helper Functions ---

def _calculate_trend_metrics(survey_id, question_id, current_analytics):
    """Calculate trend metrics and performance changes."""
    try:
        # For now, simulate trend data - in production, compare with historical data
        if "distribution" in current_analytics:
            total_responses = sum(current_analytics["distribution"].values()) if isinstance(current_analytics["distribution"], dict) else 0
        elif "options_distribution" in current_analytics:
            total_responses = sum(item.get("count", 0) for item in current_analytics["options_distribution"])
        else:
            total_responses = current_analytics.get("count_valid", 0)

        return {
            "response_trend": "increasing",  # simulate - would be calculated from historical data
            "response_rate_change": "+12%",  # simulate
            "satisfaction_trend": "stable",   # simulate
            "completion_rate": "89%",        # could be calculated from actual data
            "time_period": "last_30_days",
            "baseline_responses": max(0, total_responses - 50)  # simulate baseline
        }
    except Exception:
        return {}


def _calculate_statistical_context(question, analytics):
    """Calculate statistical context and significance."""
    try:
        context = {
            "confidence_level": "95%",
            "margin_of_error": "3.2%",
            "data_quality": "high"
        }
        
        if question.question_type in ["rating", "nps"]:
            if "distribution" in analytics and isinstance(analytics["distribution"], dict):
                values = list(analytics["distribution"].values())
                if values:
                    import statistics
                    context.update({
                        "standard_deviation": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
                        "variance": round(statistics.variance(values), 2) if len(values) > 1 else 0,
                        "distribution_type": "normal" if len(values) > 5 else "limited"
                    })
        
        elif question.question_type in ["single-choice", "multi-choice"]:
            if "options_distribution" in analytics:
                total = sum(item.get("count", 0) for item in analytics["options_distribution"])
                if total > 0:
                    percentages = [(item.get("count", 0) / total) * 100 for item in analytics["options_distribution"]]
                    context.update({
                        "response_concentration": "high" if max(percentages) > 60 else "balanced",
                        "dominant_choice_percentage": round(max(percentages), 1) if percentages else 0
                    })
        
        return context
    except Exception:
        return {"confidence_level": "95%", "data_quality": "standard"}



def _build_enhanced_chart_data(question, question_analytics_data, question_id, is_comparison, comparison_settings):
    """Build enhanced chart data with proper question-specific analytics."""
    try:
        if not question:
            return None
            
        question_id_int = int(question_id)
        
        # Get the appropriate analytics data based on comparison mode
        if is_comparison:
            # For comparison mode, get data from each segment
            segments_data = question_analytics_data.get(question_id_int, {})
            if not segments_data or all("error" in data for data in segments_data.values()):
                return None
                
            # Build comparison chart
            chart_data = {
                "type": "comparison_bar",
                "data": [],
                "x_axis_label": "Segments",
                "y_axis_label": _get_y_axis_label(question),
                "title": f"Comparison: {question.question_text[:50]}..."
            }
            
            for segment_key, seg_data in segments_data.items():
                if "error" in seg_data:
                    continue
                    
                segment_value = _extract_primary_metric(question, seg_data)
                if segment_value is not None:
                    chart_data["data"].append({
                        "category": str(segment_key),
                        "value": segment_value,
                        "percentage": _calculate_percentage(segment_value, seg_data)
                    })
            
            return chart_data
            
        else:
            # For overall analysis, get data from overall section
            overall_data = question_analytics_data.get("overall", {}).get(question_id_int, {})
            if not overall_data or "error" in overall_data:
                return None
                
            return _build_question_chart(question, overall_data)
            
    except Exception as e:
        current_app.logger.error(f"[CHART ERROR] Failed to build chart data for question {question_id}: {e}")
        return None


def _build_question_chart(question, analytics_data):
    """Build chart data for a specific question type."""
    if question.question_type == "rating":
        if "distribution" in analytics_data and isinstance(analytics_data["distribution"], dict):
            data = []
            # Fix: Ensure we're working with a dict before calling .items()
            distribution_data = analytics_data["distribution"]
            if isinstance(distribution_data, dict):
                for rating, count in sorted(distribution_data.items(), key=lambda x: int(x[0])):
                    data.append({
                        "category": f"Rating {rating}",
                        "value": count,
                        "percentage": round((count / max(1, sum(distribution_data.values()))) * 100, 1)
                    })
            
            return {
                "type": "bar",
                "data": data,
                "x_axis_label": "Rating Scale",
                "y_axis_label": "Number of Responses",
                "title": f"Rating Distribution: {question.question_text[:50]}...",
                "performance_zones": {
                    "excellent": [4, 5],
                    "good": [3],
                    "poor": [1, 2]
                }
            }
    
    elif question.question_type == "nps":
        if "distribution" in analytics_data and isinstance(analytics_data["distribution"], dict):
            data = []
            distribution_data = analytics_data["distribution"]
            if isinstance(distribution_data, dict):
                total_responses = sum(distribution_data.values())
                
                for score, count in sorted(distribution_data.items(), key=lambda x: int(x[0])):
                    data.append({
                        "category": f"Score {score}",
                        "value": count,
                        "percentage": round((count / max(1, total_responses)) * 100, 1)
                    })
            
            return {
                "type": "nps_chart",
                "data": data,
                "x_axis_label": "NPS Score",
                "y_axis_label": "Number of Responses",
                "title": f"NPS Distribution: {question.question_text[:50]}...",
                "nps_zones": {
                    "promoters": list(range(9, 11)),
                    "passives": list(range(7, 9)),
                    "detractors": list(range(0, 7))
                },
                "nps_score": analytics_data.get("nps_score", 0)
            }
    
    elif question.question_type in ["single-choice", "multi-choice", "dropdown"]:
        # Handle both options_distribution and option_distribution
        distribution_key = "options_distribution" if "options_distribution" in analytics_data else "option_distribution"
        if distribution_key in analytics_data:
            data = []
            total_responses = sum(item.get("count", 0) for item in analytics_data[distribution_key])
            
            for item in analytics_data[distribution_key]:
                count = item.get("count", 0)
                data.append({
                    "category": item.get("option", "Unknown"),
                    "value": count,
                    "percentage": round((count / max(1, total_responses)) * 100, 1)
                })
            
            return {
                "type": "pie" if len(data) <= 6 else "bar",
                "data": data,
                "x_axis_label": "Options",
                "y_axis_label": "Number of Responses",
                "title": f"Response Distribution: {question.question_text[:50]}...",
                "show_percentages": True
            }
    
    elif question.question_type == "interactive-ranking":
        if "average_ranks" in analytics_data:
            data = []
            for item in analytics_data["average_ranks"]:
                data.append({
                    "category": item.get("item", "Unknown"),
                    "value": item.get("average_rank", 0),
                    "percentage": None  # Not applicable for rankings
                })
            
            return {
                "type": "ranking_bar",
                "data": data,
                "x_axis_label": "Items",
                "y_axis_label": "Average Rank",
                "title": f"Average Rankings: {question.question_text[:50]}...",
                "lower_is_better": True
            }
    
    elif question.question_type == "scale":
        if "options_distribution" in analytics_data:
            data = []
            total_responses = sum(item.get("count", 0) for item in analytics_data["options_distribution"])
            
            for item in analytics_data["options_distribution"]:
                count = item.get("count", 0)
                data.append({
                    "category": item.get("option", "Unknown"),
                    "value": count,
                    "percentage": round((count / max(1, total_responses)) * 100, 1)
                })
            
            return {
                "type": "bar",
                "data": data,
                "x_axis_label": "Scale Points",
                "y_axis_label": "Number of Responses",
                "title": f"Scale Distribution: {question.question_text[:50]}..."
            }
    
    elif question.question_type == "star-rating-grid":
        if "average_ratings" in analytics_data:
            data = []
            for row, avg_rating in analytics_data["average_ratings"].items():
                data.append({
                    "category": row,
                    "value": avg_rating,
                    "percentage": round((avg_rating / 5.0) * 100, 1)  # Convert to percentage of max stars
                })
            
            return {
                "type": "bar",
                "data": data,
                "x_axis_label": "Grid Items",
                "y_axis_label": "Average Star Rating",
                "title": f"Star Rating Grid: {question.question_text[:50]}..."
            }
    
    elif question.question_type == "open-ended":
        # For open-ended questions, show response count
        total_responses = analytics_data.get("count_valid", 0)
        return {
            "type": "info_card",
            "data": [{"category": "Total Responses", "value": total_responses, "percentage": 100}],
            "title": f"Text Responses: {question.question_text[:50]}...",
            "info_text": f"{total_responses} text responses collected"
        }
    
    return None


def _get_y_axis_label(question):
    """Get appropriate Y-axis label based on question type."""
    if question.question_type == "rating":
        return "Average Rating"
    elif question.question_type == "nps":
        return "NPS Score"
    elif question.question_type in ["single-choice", "multi-choice", "dropdown", "scale"]:
        return "Response Count"
    elif question.question_type == "interactive-ranking":
        return "Average Rank"
    else:
        return "Value"


def _extract_primary_metric(question, analytics_data):
    """Extract the primary metric value for comparison charts."""
    if question.question_type == "rating":
        # Calculate average rating
        if "distribution" in analytics_data:
            distribution = analytics_data["distribution"]
            # Support both dict {rating: count} and list [{value,count}]
            if isinstance(distribution, dict):
                total_score = sum(int(rating) * count for rating, count in distribution.items())
                total_responses = sum(distribution.values())
                return round(total_score / max(1, total_responses), 2)
            elif isinstance(distribution, list):
                total_score = 0
                total_responses = 0
                for item in distribution:
                    try:
                        val = int(item.get("value"))
                        cnt = int(item.get("count", 0))
                    except Exception:
                        val = None
                        cnt = 0
                    if val is not None:
                        total_score += val * cnt
                        total_responses += cnt
                return round(total_score / max(1, total_responses), 2)
    
    elif question.question_type == "nps":
        return analytics_data.get("nps_score", 0)
    
    elif question.question_type in ["single-choice", "multi-choice", "dropdown"]:
        # Return the count of the most popular option
        distribution_key = "options_distribution" if "options_distribution" in analytics_data else "option_distribution"
        if distribution_key in analytics_data:
            max_count = max(item.get("count", 0) for item in analytics_data[distribution_key])
            return max_count
    
    return None


def _calculate_percentage(value, analytics_data):
    """Calculate percentage representation of a value."""
    try:
        if "distribution" in analytics_data:
            distribution = analytics_data["distribution"]
            if isinstance(distribution, dict):
                total = sum(distribution.values())
            elif isinstance(distribution, list):
                total = sum(int(item.get("count", 0)) for item in distribution)
            else:
                total = 0
            return round((float(value) / max(1, float(total))) * 100, 1)
        return 0
    except:
        return 0


# --- Helper function to generate report via OpenAI ---
def _generate_report_via_openai(prompt, survey_id):
    """Generate AI report via OpenAI API call."""
    try:
        current_app.logger.info("[AI INSIGHTS] Calling OpenAI Assistant...")
        from app.openai_client_setup import get_openai_client
        
        # Get the dynamic client
        openai_client = get_openai_client()
        if openai_client is None:
            current_app.logger.error("[AI INSIGHTS] Failed to initialize OpenAI client")
            return None
        
        # Get or create analytics thread - IMPROVED ERROR HANDLING
        thread_id = None
        try:
            thread_rec = AnalyticsThread.query.filter_by(survey_id=survey_id).first()
            if thread_rec: 
                thread_id = thread_rec.thread_id
                current_app.logger.info(f"[AI INSIGHTS] Using existing analytics thread: {thread_id}")
            else:
                # Create analytics thread properly
                current_app.logger.info(f"[AI INSIGHTS] Creating analytics thread for survey {survey_id}")
                result, status = create_analytics_thread(survey_id)
                if status in [200, 201]:
                    thread_id = result["thread_id"]
                    current_app.logger.info(f"[AI INSIGHTS] Created analytics thread: {thread_id}")
                else:
                    current_app.logger.error(f"[AI INSIGHTS] Failed to create analytics thread: {result}")
                    # Fall back to creating a simple thread
                    new_thread = openai_client.beta.threads.create()
                    thread_id = new_thread.id
                    current_app.logger.warning(f"[AI INSIGHTS] Using temporary thread: {thread_id}")

        except Exception as thread_err:
            current_app.logger.error(f"[AI INSIGHTS] Thread management error: {thread_err}", exc_info=True)
            # Fall back to creating a simple thread
            try:
                new_thread = openai_client.beta.threads.create()
                thread_id = new_thread.id
                current_app.logger.warning(f"[AI INSIGHTS] Using fallback temporary thread: {thread_id}")
            except Exception as fallback_err:
                current_app.logger.error(f"[AI INSIGHTS] Failed to create fallback thread: {fallback_err}")
                return None

        if not thread_id:
            current_app.logger.error("[AI INSIGHTS] Failed to get AI thread ID.")
            return None

        current_app.logger.info(f"[AI INSIGHTS] Adding prompt to thread {thread_id}")
        current_app.logger.info(f"[AI INSIGHTS] Prompt length: {len(prompt)} characters")
        current_app.logger.info(f"[AI INSIGHTS] COMPLETE PROMPT BEING SENT TO OPENAI:")
        current_app.logger.info("=" * 80)
        current_app.logger.info(prompt)
        current_app.logger.info("=" * 80)
        
        # Add message to thread
        try:
            openai_client.beta.threads.messages.create(
                thread_id=thread_id, role="user", content=prompt
            )
            current_app.logger.info("[AI INSIGHTS] Message added to thread successfully")
        except Exception as msg_err:
            current_app.logger.error(f"[AI INSIGHTS] Failed to add message to thread: {msg_err}")
            return None

        # Create and run assistant
        try:
            run = openai_client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=analytics_asst_id,
                instructions="You are an expert data analyst. Generate comprehensive insights based on the survey data provided."
            )
            current_app.logger.info(f"[AI INSIGHTS] Created run {run.id}")
            
            run = wait_for_run_completion(thread_id, run.id)
            current_app.logger.info(f"[AI INSIGHTS] Run completed with status: {run.status}")
        except Exception as run_err:
            current_app.logger.error(f"[AI INSIGHTS] Failed to create or complete run: {run_err}")
            return None

        # Get response
        try:
            msgs = openai_client.beta.threads.messages.list(
                thread_id=thread_id, order="desc", limit=1
            )
            
            if not msgs.data or msgs.data[0].role != "assistant":
                current_app.logger.error("[AI INSIGHTS] No assistant message found after insights generation run.")
                return None

            asst_msg_content = msgs.data[0].content
            if not asst_msg_content or not hasattr(asst_msg_content[0], "text") or not asst_msg_content[0].text.value:
                current_app.logger.error("[AI INSIGHTS] Assistant message content is empty or invalid.")
                return None

            raw_response = asst_msg_content[0].text.value
            current_app.logger.info(f"[AI INSIGHTS] Received AI response, length: {len(raw_response)} characters")
            current_app.logger.info(f"[AI INSIGHTS] COMPLETE RAW AI RESPONSE:")
            current_app.logger.info("=" * 80)
            current_app.logger.info(raw_response)
            current_app.logger.info("=" * 80)

        except Exception as response_err:
            current_app.logger.error(f"[AI INSIGHTS] Failed to get response: {response_err}")
            return None

        # Parse AI Response - IMPROVED ERROR HANDLING
        try:
            current_app.logger.info("[AI INSIGHTS] Starting JSON parsing...")
            ai_generated_report = _parse_json_from_response(raw_response)
            
            current_app.logger.info(f"[AI INSIGHTS] JSON parsing result type: {type(ai_generated_report)}")
            current_app.logger.info(f"[AI INSIGHTS] Parsed result: {ai_generated_report}")
            
            if not ai_generated_report or not isinstance(ai_generated_report, dict):
                current_app.logger.error("[AI INSIGHTS] Failed to parse valid JSON report structure from AI.")
                current_app.logger.error(f"[AI INSIGHTS] Parsed result was: {ai_generated_report}")
                
                # Try to extract any JSON from the response
                current_app.logger.info("[AI INSIGHTS] Attempting regex JSON extraction...")
                json_match = re.search(r'\{[\s\S]*\}', raw_response)
                if json_match:
                    try:
                        extracted_json = json_match.group()
                        current_app.logger.info(f"[AI INSIGHTS] Extracted JSON string: {extracted_json}")
                        ai_generated_report = json.loads(extracted_json)
                        current_app.logger.info("[AI INSIGHTS] Successfully extracted JSON using regex fallback")
                        current_app.logger.info(f"[AI INSIGHTS] Extracted report: {ai_generated_report}")
                    except Exception as extract_err:
                        current_app.logger.error(f"[AI INSIGHTS] Regex JSON extraction failed: {extract_err}")
                        return None
                else:
                    current_app.logger.error("[AI INSIGHTS] No JSON structure found in response")
                    return None
            
            current_app.logger.info("[AI INSIGHTS] Successfully parsed AI response JSON")
            current_app.logger.info(f"[AI INSIGHTS] Report keys: {list(ai_generated_report.keys()) if isinstance(ai_generated_report, dict) else 'Not a dict'}")
            current_app.logger.info(f"[AI INSIGHTS] PARSED AI REPORT STRUCTURE:")
            current_app.logger.info(json.dumps(ai_generated_report, indent=2, default=str))
            
            return ai_generated_report
            
        except Exception as parse_err:
            current_app.logger.error(f"[AI INSIGHTS] Error parsing AI response: {parse_err}")
            current_app.logger.debug(f"[AI INSIGHTS] Raw response for debugging: {raw_response[:1000]}...")
            return None
        
    except Exception as e:
        current_app.logger.error(f"[AI INSIGHTS] Error in OpenAI generation: {e}", exc_info=True)
        return None


# --- get_eligible_questions_for_ai (List questions suitable for AI analysis) ---
def get_eligible_questions_for_ai(survey_id):
    """
    Returns a list of questions from a survey eligible for AI analysis,
    sorted by sequence number.
    """
    try:
        current_app.logger.info(f"[AI ELIGIBLE Q] Fetching eligible questions for Survey ID: {survey_id}")
        survey = Survey.query.get(survey_id)
        if not survey:
            current_app.logger.warning(f"[AI ELIGIBLE Q] Survey not found: {survey_id}")
            return {"error": "Survey not found"}, 404

        # Define question types generally unsuitable for high-level AI summary/insights
        excluded_types = [
            "signature",
            "date-picker", # Often too specific unless trend analysis is requested
            "email-input",
            "document-upload",
            "payment", # Sensitive
            "location", # Potentially PII, less suitable for general summarization
            "content-text", # No user response data
            "content-media", # No user response data
            # Add other types if needed
        ]

        eligible_questions = []
        # Ensure questions are sorted by sequence number for consistent display
        # Handle potential None sequence numbers by putting them at the end
        sorted_questions = sorted(
            survey.questions,
            key=lambda q: q.sequence_number if q.sequence_number is not None else float('inf'),
        )

        for q in sorted_questions:
            # Check if the question type is NOT in the excluded list
            if q.question_type not in excluded_types:
                eligible_questions.append(
                    {
                        "id": q.id,
                        "question_text": q.question_text,
                        "question_type": q.question_type,
                        "sequence_number": q.sequence_number,
                    }
                )

        current_app.logger.info(f"[AI ELIGIBLE Q] Found {len(eligible_questions)} eligible questions for survey {survey_id}")
        return {"eligible_questions": eligible_questions}, 200

    except Exception as e:
        current_app.logger.error(
            f"[API ERROR] Failed to get eligible questions for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"Failed to get eligible questions: {str(e)}"}, 500

# --- ai_edit_question_controller (Edit a single question via AI) ---
def ai_edit_question_controller(data):
    """Edits a single survey question based on user prompt using AI."""
    current_app.logger.debug("[AI EDIT Q] Starting ai_edit_question_controller")
    current_app.logger.debug(f"[AI EDIT Q] Input data: {json.dumps(data, indent=2, default=str)}")

    original_question_json = data.get("original")  # The current JSON structure of the question
    edit_prompt = data.get("prompt")  # User's instruction for the edit
    survey_id = data.get("survey_id")  # Optional: For survey context / thread management

    if not original_question_json or not edit_prompt:
        current_app.logger.error("[AI EDIT Q] Missing 'original' question JSON or 'prompt'")
        return {"error": "Both original question data and prompt are required"}, 400

    # --- Thread Management ---
    thread_id = None
    if survey_id:
        current_app.logger.debug(f"[AI EDIT Q] Looking for thread for survey ID {survey_id}")
        thread_rec = SurveyThread.query.filter_by(survey_id=survey_id).first()
        if thread_rec:
            thread_id = thread_rec.thread_id
            current_app.logger.debug(f"[AI EDIT Q] Found existing survey thread: {thread_id}")
        else:  # Create thread if it doesn't exist for this survey
            current_app.logger.warning(
                f"[AI EDIT Q] Thread not found for survey {survey_id}, attempting creation."
            )
            try:
                result, status = create_survey_thread(
                    survey_id
                )  # Assumes this function exists and returns {"thread_id": ...}
                if status in [200, 201]:
                    thread_id = result["thread_id"]
                    current_app.logger.info(f"[AI EDIT Q] Created survey thread: {thread_id}")
                else:
                    current_app.logger.error(
                        f"[AI EDIT Q] Failed to create survey thread for edit: {result.get('error', 'Unknown error')}"
                    )
                    # Fallback to generic thread below
            except Exception as create_err:
                current_app.logger.error(
                    f"[AI EDIT Q] Exception creating survey thread: {create_err}",
                    exc_info=True,
                )
                # Fallback to generic thread below

    if not thread_id:  # Fallback to generic thread if survey thread not found/created
        try:
            thread_id = _get_or_create_generic_thread()
            current_app.logger.debug(f"[AI EDIT Q] Using generic chat thread: {thread_id}")
        except Exception as generic_err:
            current_app.logger.error(
                f"[AI ERROR] Failed to get or create generic thread: {generic_err}",
                exc_info=True,
            )
            return {"error": "Failed to obtain AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # Combine original question and edit request for the AI
    combined_content = (
        f"Original Question JSON:\n```json\n{json.dumps(original_question_json)}\n```\n\n"
        f"Edit Instructions: {edit_prompt}\n\n"
        "Based on the 'Original Question JSON' and the 'Edit Instructions', please provide the complete, updated JSON representation for this single question. "
        "Return ONLY the updated question JSON object."
    )
    current_app.logger.debug(f"[AI EDIT Q] Creating user message for thread {thread_id}")

    # Inject Generation Rules into the assistant's instructions
    instructions = (
        f"You are an expert survey question editor. Your task is to modify the 'Original Question JSON' based on the 'Edit Instructions' provided in the user's message. "
        f"Return ONLY the *complete* JSON object for the single updated question. Ensure the output is valid JSON. "
        f"Strictly adhere to the following rules for the updated question's structure and content:\n{GENERATION_RULES}"
    )
    current_app.logger.debug(
        "[AI EDIT Q] Creating run with edit instructions and generation rules"
    )

    try:
        # Add message to thread
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=combined_content
        )

        # Create and wait for run
        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=survey_update_asst_id,
            instructions=instructions,
        )
        current_app.logger.debug(f"[AI EDIT Q] Run created with ID {run.id}, waiting for completion")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.debug(f"[AI EDIT Q] Run completed with status: {run.status}")

        # Get the response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI EDIT Q] No assistant messages found after edit run")
            return {"error": "AI assistant did not respond."}, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI EDIT Q] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        raw_response = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI EDIT Q] Raw assistant response: {raw_response[:500]}...")

        # Parse the JSON response
        updated_question_json = _parse_json_from_response(raw_response)

        if (
            not updated_question_json
            or not isinstance(updated_question_json, dict)
        ):
            current_app.logger.error(
                "[AI EDIT Q] Failed to parse valid question JSON from AI edit response."
            )
            explanation = re.sub(r"```json.*?```", "", raw_response, flags=re.DOTALL).strip()
            error_msg = "AI failed to generate valid JSON for the edited question."
            if explanation and len(explanation) > 10:
                error_msg += f" Assistant may have said: {explanation[:200]}..."
            return {"error": error_msg}, 500

        # Basic validation of the returned JSON (ensure essential fields exist)
        if (
            "question_text" not in updated_question_json
            or "question_type" not in updated_question_json
        ):
            current_app.logger.warning(
                "[AI EDIT Q] Edited question JSON missing 'question_text' or 'question_type'. Frontend validation needed."
            )
            # Return the potentially incomplete JSON, let frontend decide. Could add stricter validation here.

        current_app.logger.info(
            "[AI EDIT Q] Successfully received and parsed updated question JSON."
        )
        current_app.logger.debug(
            f"[AI EDIT Q] Updated Question JSON: {json.dumps(updated_question_json, indent=2)}"
        )

        # Return the updated question JSON directly
        return updated_question_json, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI question edit run timed out: {e}", exc_info=True
        )
        return {"error": f"AI question edit timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error during AI question edit: {e}", exc_info=True
        )
        return {"error": f"Failed to process AI question edit: {str(e)}"}, 500


# --- create_survey_thread (Manage persistent threads for surveys) ---
def create_survey_thread(survey_id):
    """Creates or retrieves a dedicated OpenAI thread for a specific survey."""
    survey = Survey.query.get(survey_id)
    if not survey:
        current_app.logger.warning(
            f"[AI THREAD] Survey not found for ID: {survey_id} during thread creation."
        )
        return {"error": "Survey not found"}, 404

    existing_thread = SurveyThread.query.filter_by(survey_id=survey_id).first()
    if existing_thread:
        current_app.logger.info(
            f"[AI THREAD] Found existing thread {existing_thread.thread_id} for survey {survey_id}"
        )
        return {"thread_id": existing_thread.thread_id}, 200

    try:
        current_app.logger.info(
            f"[AI THREAD] Creating new thread for survey {survey_id} (Title: {survey.title})"
        )
        new_thread = openai_client.beta.threads.create()
        thread_id = new_thread.id
        thread_rec = SurveyThread(survey_id=survey_id, thread_id=thread_id)
        db.session.add(thread_rec)
        db.session.commit()
        current_app.logger.info(
            f"[AI THREAD] Successfully created and stored thread {thread_id} for survey {survey_id}"
        )

        # Add initial context about the survey to the thread
        try:
            survey_data, status = SurveyController.get_survey(
                survey_id
            )  # Fetch full survey data
            if status == 200:
                # Create a concise summary for context (avoid overly large messages)
                context_message = f"""
                Initial context for Survey ID {survey_id}:
                Title: {survey_data.get('title', 'N/A')}
                Description: {survey_data.get('description', 'N/A')}
                Number of Questions: {len(survey_data.get('questions', []))}
                Current Questions Summary (IDs and Text - first 5):
                """
                for i, q in enumerate(survey_data.get("questions", [])[:5]):
                    context_message += (
                        f"\n - Q{q.get('id', 'N/A')}: {q.get('question_text', 'N/A')[:100]}"
                    )  # Limit question text length
                if len(survey_data.get("questions", [])) > 5:
                    context_message += "\n - ... (more questions exist)"

                openai_client.beta.threads.messages.create(
                    thread_id=thread_id,
                    role="user",  # Use user role instead of system (OpenAI doesn't support system role for threads)
                    content=context_message,
                )
                current_app.logger.info(
                    f"[AI THREAD] Added initial context to new survey thread {thread_id}"
                )
            else:
                current_app.logger.warning(
                    f"[AI THREAD] Could not fetch survey data (Status: {status}) to add context for thread {thread_id}"
                )

        except Exception as context_err:
            current_app.logger.error(
                f"[AI THREAD] Error adding context to thread {thread_id}: {context_err}",
                exc_info=True,
            )

        return {"thread_id": thread_id, "message": "Survey thread created and context added."}, 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"[AI ERROR] Failed to create survey thread for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"Failed to create survey thread: {str(e)}"}, 500


# --- edit_survey_ai_controller (Edit entire survey via AI) ---
def edit_survey_ai_controller(data):
    """Applies edits to an entire survey based on instructions using AI."""
    survey_id = data.get("survey_id")
    edit_instructions = data.get("edit_instructions", "")

    if not survey_id or not edit_instructions:
        return {"error": "survey_id and edit_instructions are required"}, 400

    current_app.logger.info(f"[AI EDIT SURVEY] Starting full survey edit for ID: {survey_id}")
    current_app.logger.debug(f"[AI EDIT SURVEY] Edit instructions: {edit_instructions[:200]}...")

    # --- Thread Management ---
    thread_id = None
    try:
        # Get or create the dedicated thread for this survey
        thread_rec = SurveyThread.query.filter_by(survey_id=survey_id).first()
        if thread_rec:
            thread_id = thread_rec.thread_id
            current_app.logger.info(f"[AI EDIT SURVEY] Using existing thread: {thread_id}")
        else:
            result, status = create_survey_thread(survey_id)
            if status not in [200, 201]:
                current_app.logger.error(
                    f"Failed to get/create survey thread for full edit: {result.get('error', 'Unknown error')}"
                )
                return result, status  # Return error from thread creation
            thread_id = result["thread_id"]
            current_app.logger.info(f"[AI EDIT SURVEY] Created new thread: {thread_id}")
    except Exception as thread_err:
        current_app.logger.error(
            f"[AI ERROR] Failed to establish thread for survey edit: {thread_err}",
            exc_info=True,
        )
        return {"error": "Failed to establish AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # Add the edit instructions as a new user message to the thread
    # The initial survey context should already be in the thread from creation/previous interactions
    user_message_content = (
        f"Please apply the following edits to the survey associated with this thread:\n\n"
        f"Edit Instructions: {edit_instructions}\n\n"
        "Review the entire survey context in this thread and apply these changes comprehensively. "
        "Return the complete, updated survey structure as a single JSON object. Ensure all original questions (unless deleted by instructions) and any new questions are included."
    )

    # Define instructions for the assistant run, incorporating GENERATION_RULES
    instructions = (
        f"You are an expert survey editor. Your task is to update the survey associated with this thread based on the latest user 'Edit Instructions'. "
        f"Use the conversation history (especially the initial context) to understand the current state of the survey. "
        f"Apply the requested modifications (adding, deleting, changing questions, updating title/description). "
        f"Strictly adhere to the following rules for any modified or newly added questions:\n{GENERATION_RULES}\n\n"
        f"Your final response MUST be ONLY the complete, updated survey JSON, including all survey properties (title, description, etc.) and the full list of questions in the correct sequence. "
        f"Do not return only the changes or add explanatory text outside the JSON."
    )

    try:
        # Add user message and run the assistant
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=user_message_content
        )
        current_app.logger.info(
            f"[AI EDIT SURVEY] Added edit instructions to thread {thread_id}"
        )

        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=survey_update_asst_id,
            instructions=instructions,
        )
        current_app.logger.info(f"[AI EDIT SURVEY] Run created ({run.id}), waiting for completion...")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(
            f"[AI EDIT SURVEY] Run {run.id} completed with status: {run.status}"
        )

        # Get the assistant's response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI EDIT SURVEY] No assistant message found after edit run.")
            return {"error": "AI assistant did not respond to the edit request."}, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI EDIT SURVEY] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        raw_response = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI EDIT SURVEY] Raw response: {raw_response[:500]}...")

        # Parse the full survey JSON from the response
        updated_survey_json = _parse_json_from_response(raw_response)

        if (
            not updated_survey_json
            or not isinstance(updated_survey_json, dict)
            or "questions" not in updated_survey_json
        ):
            current_app.logger.error(
                "[AI EDIT SURVEY] Failed to parse valid full survey JSON from AI response."
            )
            explanation = re.sub(r"```json.*?```", "", raw_response, flags=re.DOTALL).strip()
            error_msg = "AI failed to generate valid JSON for the full survey update."
            if explanation and len(explanation) > 10:
                error_msg += f" Assistant may have said: {explanation[:200]}..."
            return {"error": error_msg}, 500

        current_app.logger.info(
            "[AI EDIT SURVEY] Successfully parsed updated survey JSON from AI."
        )
        current_app.logger.debug(
            f"[AI EDIT SURVEY] Updated survey structure (first few questions): {json.dumps(updated_survey_json.get('questions', [])[:3], indent=2)}"
        )

        # --- Update Survey in Database ---
        # Use the existing SurveyController to handle the update logic
        current_app.logger.info(
            f"[AI EDIT SURVEY] Attempting to update survey {survey_id} in database with AI-generated JSON."
        )
        update_result, update_status = SurveyController.update_survey(
            survey_id, updated_survey_json
        )

        # Return the result from the SurveyController update
        if update_status == 200:
            current_app.logger.info(
                f"[AI EDIT SURVEY] Successfully updated survey {survey_id} via AI."
            )
            # Optionally, fetch the updated survey to return the final state
            final_survey_data, final_status = SurveyController.get_survey(survey_id)
            if final_status == 200:
                return {
                    "survey": final_survey_data,
                    "message": "Survey updated successfully via AI.",
                }, 200
            else:
                # Update succeeded but fetch failed? Return success but no data.
                return {
                    "message": "Survey updated successfully via AI, but failed to fetch updated data."
                }, 200
        else:
            current_app.logger.error(
                f"[AI EDIT SURVEY] Failed to update survey {survey_id} in database after AI edit. Status: {update_status}, Error: {update_result}"
            )
            # Propagate the error from SurveyController update
            return update_result, update_status

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI survey edit run timed out for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"AI survey edit timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error during AI survey edit for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"Failed to process AI survey edit: {str(e)}"}, 500


# --- regenerate_survey_controller (Regenerate survey based on prompt) ---
def regenerate_survey_controller(data):
    """Regenerates an entire survey based on current state and user prompt using AI."""
    current_survey_data = data.get("survey")  # Current survey JSON from frontend
    regeneration_prompt = data.get("prompt")  # User's regeneration instructions
    survey_id = data.get("survey_id")  # Optional: ID for thread context

    if not current_survey_data or not regeneration_prompt:
        return {"error": "Both current survey data and regeneration prompt are required"}, 400
    if not isinstance(current_survey_data, dict) or "questions" not in current_survey_data:
        return {"error": "Invalid current survey data format provided"}, 400

    current_app.logger.info(f"[AI REGEN] Starting survey regeneration. Survey ID (if provided): {survey_id}")
    current_app.logger.debug(f"[AI REGEN] Regeneration prompt: {regeneration_prompt[:200]}...")

    # --- Thread Management ---
    thread_id = None
    try:
        if survey_id:
            thread_rec = SurveyThread.query.filter_by(survey_id=survey_id).first()
            if thread_rec:
                thread_id = thread_rec.thread_id
                current_app.logger.info(f"[AI REGEN] Using existing survey thread: {thread_id}")
            else:
                # If ID provided but no thread, create one to maintain context continuity
                result, status = create_survey_thread(survey_id)
                if status in [200, 201]:
                    thread_id = result["thread_id"]
                    current_app.logger.info(
                        f"[AI REGEN] Created survey thread for regeneration: {thread_id}"
                    )
                else:
                    current_app.logger.warning(
                        f"[AI REGEN] Failed to create survey thread ({status}), falling back to generic."
                    )
                    thread_id = _get_or_create_generic_thread()
        else:
            # No survey ID provided, use generic thread
            thread_id = _get_or_create_generic_thread()
            current_app.logger.info(f"[AI REGEN] Using generic thread: {thread_id}")
    except Exception as thread_err:
        current_app.logger.error(
            f"[AI ERROR] Failed to establish thread for survey regeneration: {thread_err}",
            exc_info=True,
        )
        return {"error": "Failed to establish AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # Create message with current survey state and regeneration request
    message_content = f"""
Current survey JSON state:
{json.dumps(current_survey_data)}
Regeneration Request: {regeneration_prompt}
Based on the 'Current survey JSON state' and the 'Regeneration Request', please generate a completely new version of the survey. Incorporate the requested changes, potentially adjusting the overall structure, questions, title, and description as implied by the request. Return ONLY the complete new survey JSON.
"""
    # Inject Generation Rules into assistant instructions
    instructions = f"""
You are a survey regeneration assistant. Your task is to take the 'Current survey JSON state' and the 'Regeneration Request' provided in the latest user message and create a completely new version of the survey.
Interpret the user's request and apply it comprehensively to the entire survey structure.
Strictly adhere to the following rules for all questions in the regenerated survey:
{GENERATION_RULES}
Your response MUST be ONLY the complete, new survey JSON object, including all survey properties (title, description, etc.) and all questions. Do not include explanations, apologies, or markdown formatting outside the JSON block.
"""

    try:
        # Add message and run assistant
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=message_content
        )
        current_app.logger.info(
            f"[AI REGEN] Added regeneration request to thread {thread_id}"
        )

        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=survey_update_asst_id,  # Using update assistant ID, suitable for generation/modification
            instructions=instructions,
        )
        current_app.logger.info(f"[AI REGEN] Run created ({run.id}), waiting for completion...")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(
            f"[AI REGEN] Run {run.id} completed with status: {run.status}"
        )

        # Get response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI REGEN] No assistant message found after regeneration run.")
            return {
                "error": "AI assistant did not respond to the regeneration request."
            }, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI REGEN] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        response_text = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI REGEN] Raw response: {response_text[:500]}...")

        # Parse the full regenerated survey JSON
        regenerated_survey_json = _parse_json_from_response(response_text)

        if (
            not regenerated_survey_json
            or not isinstance(regenerated_survey_json, dict)
            or "questions" not in regenerated_survey_json
        ):
            current_app.logger.error(
                "[AI REGEN] Failed to parse valid full survey JSON from AI regeneration response."
            )
            explanation = re.sub(r"```json.*?```", "", response_text, flags=re.DOTALL).strip()
            error_msg = "AI failed to generate valid JSON for the regenerated survey."
            if explanation and len(explanation) > 10:
                error_msg += f" Assistant may have said: {explanation[:200]}..."
            return {"error": error_msg}, 500

        current_app.logger.info("[AI REGEN] Successfully parsed regenerated survey JSON.")
        current_app.logger.debug(
            f"[AI REGEN] Regenerated survey structure (first few questions): {json.dumps(regenerated_survey_json.get('questions', [])[:3], indent=2)}"
        )

        # Return the full regenerated survey JSON for the frontend to handle (e.g., display diff, replace current)
        return {
            "regenerated_survey": regenerated_survey_json,
            "message": "Survey regenerated by AI. Review the changes carefully before saving.",
        }, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI regeneration run timed out: {e}", exc_info=True
        )
        return {"error": f"AI survey regeneration timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error in regenerate_survey_controller: {e}", exc_info=True
        )
        return {"error": f"Failed to regenerate survey: {str(e)}"}, 500


def create_new_chat_thread():
    """Deletes the existing generic chat thread and creates a new one."""
    try:
        current_app.logger.info("[AI CHAT] Attempting to create a new chat thread.")
        # Delete any existing generic chat thread(s) in the database
        # Use a loop in case multiple somehow exist (shouldn't happen with first())
        existing_threads = ChatThread.query.all()
        if existing_threads:
            for thread in existing_threads:
                current_app.logger.info(
                    f"[AI CHAT] Deleting existing chat thread record with DB ID {thread.id} (OpenAI ID: {thread.thread_id})"
                )
                db.session.delete(thread)
                db.session.flush()  # Ensure deletes are processed before adding new
            current_app.logger.info(
                f"[AI CHAT] Deleted {len(existing_threads)} existing chat thread records."
            )
        else:
            current_app.logger.info(
                "[AI CHAT] No existing chat thread records found to delete."
            )
        # Create a new thread with OpenAI
        new_thread = openai_client.beta.threads.create()
        current_app.logger.info(f"[AI CHAT] Created new OpenAI thread: {new_thread.id}")

        # Create a new chat thread record in the database
        thread_rec = ChatThread(thread_id=new_thread.id)
        db.session.add(thread_rec)
        db.session.commit()
        current_app.logger.info(
            f"[AI CHAT] Stored new chat thread record in DB with ID {thread_rec.id}"
        )

        return {
            "message": "New chat thread created successfully.",
            "thread_id": new_thread.id,
        }, 201
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error creating new chat thread: {e}", exc_info=True
        )
        db.session.rollback()  # Rollback database changes on error
        return {"error": f"Failed to create new chat thread: {str(e)}"}, 500


def continue_survey_conversation_controller(data):
    """Handles conversational interaction for editing/refining a survey."""
    prompt = data.get("prompt")  # User's conversational input/request
    survey_data = data.get("survey")  # Current survey JSON from frontend
    survey_id = data.get("survey_id")  # Optional: For thread context
    if not prompt or not survey_data:
        return {"error": "Both prompt and current survey data are required"}, 400
    if not isinstance(survey_data, dict) or "questions" not in survey_data:
        return {"error": "Invalid current survey data format provided"}, 400

    current_app.logger.info(
        f"[AI CONVO] Continuing survey conversation. Survey ID (if provided): {survey_id}"
    )
    current_app.logger.debug(f"[AI CONVO] User prompt: {prompt[:200]}...")

    # --- Thread Management (similar to regenerate/edit) ---
    thread_id = None
    try:
        if survey_id:
            thread_rec = SurveyThread.query.filter_by(survey_id=survey_id).first()
            if thread_rec:
                thread_id = thread_rec.thread_id
                current_app.logger.info(f"[AI CONVO] Using existing survey thread: {thread_id}")
            else:
                result, status = create_survey_thread(survey_id)
                if status in [200, 201]:
                    thread_id = result["thread_id"]
                    current_app.logger.info(
                        f"[AI CONVO] Created survey thread for conversation: {thread_id}"
                    )
                else:
                    current_app.logger.warning(
                        f"[AI CONVO] Failed to create survey thread ({status}), falling back to generic."
                    )
                    thread_id = _get_or_create_generic_thread()
        else:
            thread_id = _get_or_create_generic_thread()
            current_app.logger.info(f"[AI CONVO] Using generic thread: {thread_id}")
    except Exception as thread_err:
        current_app.logger.error(
            f"[AI ERROR] Failed to establish thread for survey conversation: {thread_err}",
            exc_info=True,
        )
        return {"error": "Failed to establish AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # Add current survey state and user's request to the message
    message_content = (
        f"Current survey state:\n```json\n{json.dumps(survey_data)}\n```\n\n"
        f"User request: {prompt}\n\n"
        "Analyze the user's request in the context of the current survey state. Respond conversationally to the user. "
        "If the request implies modifications to the survey (e.g., adding a question, changing text, updating options), explain the changes you are suggesting AND provide a specific JSON object named `survey_updates` containing ONLY the necessary changes. "
        "If no survey modifications are needed or possible based on the request, just provide a conversational text response without the `survey_updates` object."
    )

    # Instructions for the assistant, including GENERATION_RULES for potential updates
    instructions = f"""
You are a helpful survey design assistant. Your role is to engage in a conversation with the user about refining their survey.
Analyze: Understand the user's latest request (User request: ...) in the context of the Current survey state: ... provided in their message.
Respond Conversationally: Provide a clear, helpful, and conversational text response addressing the user's prompt.
Suggest Changes (If Applicable): If the user's request requires changes to the survey:
Clearly explain the modifications you propose in your conversational text.
Generate a JSON object strictly named survey_updates containing ONLY the changes. Follow this exact structure:
"survey_updates": {{
  "title": "(optional) updated title string",
  "description": "(optional) updated description string",
  "question_updates": [ // Array of questions to modify
    {{
      "index": <original_index_of_question_in_current_survey_data>,
      "updated_question": {{ <complete_updated_question_json_object> }}
    }}
  ],
  "new_questions": [ // Array of new questions to add
    {{ <complete_new_question_json_object> }}
    // Note: New questions don't need an index here; frontend handles insertion
  ]
}}
CRITICAL: Any updated_question or new_question JSON object within survey_updates MUST strictly adhere to the following rules:
{GENERATION_RULES}
No Changes Case: If the user's request doesn't require survey changes (e.g., asking for advice, clarification), provide only the conversational text response. DO NOT include an empty or placeholder survey_updates object in this case.
Format: Ensure the survey_updates JSON object, if present, is valid and correctly placed within your response, usually after the conversational text. Do not wrap it in markdown backticks unless it's part of the structure definition above.
"""

    try:
        # Add message and run assistant
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=message_content
        )
        current_app.logger.info(f"[AI CONVO] Added user request to thread {thread_id}")

        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=survey_update_asst_id,
            instructions=instructions,
        )
        current_app.logger.info(f"[AI CONVO] Run created ({run.id}), waiting for completion...")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(
            f"[AI CONVO] Run {run.id} completed with status: {run.status}"
        )

        # Get response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI CONVO] No assistant message found.")
            return {"error": "AI assistant did not respond."}, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI CONVO] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        response_text = asst_msg_content[0].text.value
        current_app.logger.debug(f"[AI CONVO] Raw response: {response_text[:500]}...")

        # --- Parse Response: Separate Conversational Text and JSON Updates ---
        survey_updates = None
        clean_response = response_text  # Default to full response

        # Try to find the specific "survey_updates": {...} block using regex
        # Make regex flexible for quotes and whitespace, capture the object content
        match = re.search(
            r'["\']?survey_updates["\']?\s*:\s*(\{[\s\S]*?\})(?:\s*,\s*|\s*$)',
            response_text,
            re.IGNORECASE | re.DOTALL,
        )

        if match:
            json_block_str = match.group(1)
            try:
                # Attempt to parse the captured JSON block
                survey_updates = json.loads(json_block_str)
                current_app.logger.info(
                    "[AI CONVO] Extracted 'survey_updates' JSON object from AI response."
                )
                current_app.logger.debug(
                    f"[AI CONVO] Parsed survey_updates: {json.dumps(survey_updates, indent=2)}"
                )

                # Try to remove the JSON block from the conversational response for cleaner text
                # Be careful not to remove too much if regex matched broadly
                full_match_str = match.group(0)
                # Find the start of the conversational text (assume it's before the json block)
                text_end_index = match.start()
                clean_response = response_text[:text_end_index].strip()

                # Fallback / alternative cleanup: remove any ```json blocks
                if not clean_response or len(
                    clean_response
                ) < 20:  # If removal left little text, try simpler cleanup
                    clean_response = re.sub(
                        r"```json.*?```", "", response_text, flags=re.DOTALL
                    ).strip()
                    # Also remove the specific update block text if possible after removing ```json
                    clean_response = clean_response.replace(full_match_str, "").strip()

            except json.JSONDecodeError as json_e:
                current_app.logger.error(
                    f"[AI CONVO] Error parsing extracted 'survey_updates' JSON block: {json_e}"
                )
                current_app.logger.debug(
                    f"[AI CONVO] Problematic JSON block: {json_block_str}"
                )
                # Keep survey_updates as None, return the full raw text as the response
                survey_updates = None
                clean_response = response_text  # Revert to raw text if JSON part fails parsing
        else:
            current_app.logger.info(
                "[AI CONVO] No 'survey_updates' JSON object found in the response."
            )
            # Clean potential markdown anyway
            clean_response = re.sub(
                r"```json.*?```", "", response_text, flags=re.DOTALL
            ).strip()

        return {"response": clean_response, "survey_updates": survey_updates}, 200
    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI survey conversation run timed out: {e}", exc_info=True
        )
        return {"error": f"AI survey conversation timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error in continue_survey_conversation: {e}", exc_info=True
        )
        return {"error": f"Failed to process survey conversation: {str(e)}"}, 500


def create_analytics_thread(survey_id):
    """Creates or retrieves a dedicated OpenAI thread for analytics of a specific survey."""
    survey = Survey.query.get(survey_id)
    if not survey:
        current_app.logger.warning(
            f"[AI ANALYTICS] Survey not found for ID: {survey_id} during thread creation."
        )
        return {"error": "Survey not found"}, 404
    existing_thread = AnalyticsThread.query.filter_by(survey_id=survey_id).first()
    if existing_thread:
        current_app.logger.info(
            f"[AI ANALYTICS] Found existing thread {existing_thread.thread_id} for survey {survey_id}"
        )
        return {"thread_id": existing_thread.thread_id}, 200

    try:
        current_app.logger.info(
            f"[AI ANALYTICS] Creating new thread for survey {survey_id} (Title: {survey.title})"
        )
        new_thread = openai_client.beta.threads.create()
        thread_id = new_thread.id
        thread_rec = AnalyticsThread(survey_id=survey_id, thread_id=thread_id)
        db.session.add(thread_rec)
        db.session.commit()
        current_app.logger.info(
            f"[AI ANALYTICS] Successfully created and stored thread {thread_id} for survey {survey_id}"
        )

        # Add initial context: Report Summary Data
        try:
            # Use the appropriate ResponseController method to get summary data
            raw_summary_data, status = ResponseController.get_report_summary(survey_id)
            if status == 200 and raw_summary_data:
                # Create a concise context message
                context_message = f"""
            Initial Context for Analytics on Survey ID {survey_id} (Title: {survey.title}):
            This thread is for analyzing the results of this survey.
            Initial Summary Data:
            ```json
            {json.dumps(raw_summary_data)}
            ```
            Base your analysis and responses on this data and any further data provided in the conversation.
            """
                # Limit context size if necessary (check raw_summary size)
                MAX_CONTEXT_CHARS = 20000  # Example limit
                if len(context_message) > MAX_CONTEXT_CHARS:
                    context_message = (
                        context_message[:MAX_CONTEXT_CHARS] + "\n... (Summary data truncated)"
                    )
                    current_app.logger.warning(
                        f"[AI ANALYTICS] Initial summary context truncated for thread {thread_id}"
                    )

                openai_client.beta.threads.messages.create(
                    thread_id=thread_id,
                    role="user",  # Use user role instead of system (OpenAI doesn't support system role for threads)
                    content=context_message,
                )
                current_app.logger.info(
                    f"[AI ANALYTICS] Added initial summary context to new analytics thread {thread_id}"
                )
            else:
                current_app.logger.warning(
                    f"[AI ANALYTICS] Could not get summary data (Status: {status}) to add context for analytics thread {thread_id}"
                )

        except Exception as context_err:
            current_app.logger.error(
                f"[AI ANALYTICS] Error adding summary context to thread {thread_id}: {context_err}",
                exc_info=True,
            )

        return {"thread_id": thread_id, "message": "Analytics thread created."}, 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"[AI ERROR] Failed to create analytics thread for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"Failed to create analytics thread: {str(e)}"}, 500


def get_ai_summary_controller(survey_id):
    """Gets an initial AI-generated summary report based on survey results."""
    if not survey_id:
        return {"error": "survey_id query parameter required"}, 400
    current_app.logger.info(f"[AI SUMMARY] Requesting AI summary for survey {survey_id}")

    # --- Thread Management & Context ---
    thread_id = None
    try:
        thread_rec = AnalyticsThread.query.filter_by(survey_id=survey_id).first()
        if thread_rec:
            thread_id = thread_rec.thread_id
            current_app.logger.info(f"[AI SUMMARY] Using existing analytics thread: {thread_id}")
            # Optional: Check if context needs refreshing? For now, assume create_analytics_thread added it.
        else:
            # Create thread (which also adds initial context)
            result, status = create_analytics_thread(survey_id)
            if status not in [200, 201]:
                return result, status  # Propagate error from thread creation
            thread_id = result["thread_id"]
            current_app.logger.info(
                f"[AI SUMMARY] Created new analytics thread for summary: {thread_id}"
            )

        # Get the latest raw summary data (even if context was added previously, it might be outdated)
        # This data isn't explicitly added to the prompt here, assuming the AI uses thread history.
        raw_summary_data, status = ResponseController.get_report_summary(survey_id)
        if status != 200:
            current_app.logger.warning(
                f"[AI SUMMARY] Failed to get latest raw summary data (Status: {status}). AI might use older context from thread."
            )
            # Decide whether to proceed or return error. Proceeding for now.
            raw_summary_data = {"warning": "Failed to fetch latest raw summary data."}
            # return raw_summary_data, status # Option: return error if data fetch fails

    except Exception as thread_err:
        current_app.logger.error(
            f"[AI ERROR] Failed to establish thread for AI summary: {thread_err}",
            exc_info=True,
        )
        return {"error": "Failed to establish AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # User message asking for the summary
    message_content = (
        "Please generate a comprehensive summary report based on the survey data provided in this thread's history (especially the initial context). "
        "Highlight key insights, significant trends across different questions or demographics (if available in the data), and potential areas of success or concern revealed by the results. "
        "The summary should be presented clearly in well-structured paragraphs or bullet points. Focus strictly on the provided data."
    )

    # Assistant instructions (can be simple as prompt is detailed)
    instructions = (
        "You are an expert data analyst. Your task is to synthesize the survey results data available in the thread history and generate a clear, insightful summary report in response to the user's latest request. "
        "Base your analysis strictly on the provided data."
    )

    try:
        # Add user message and run assistant
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=message_content
        )
        current_app.logger.info(
            f"[AI SUMMARY] Added summary request to thread {thread_id}"
        )

        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=analytics_asst_id,
            instructions=instructions,
        )
        current_app.logger.info(f"[AI SUMMARY] Run created ({run.id}), waiting for completion...")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(
            f"[AI SUMMARY] Run {run.id} completed with status: {run.status}"
        )

        # Get response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI SUMMARY] No assistant message found after summary run.")
            return {"error": "AI assistant did not generate a summary."}, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI SUMMARY] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        ai_summary_text = asst_msg_content[0].text.value
        current_app.logger.info(
            f"[AI SUMMARY] Successfully generated AI summary for survey {survey_id}."
        )
        current_app.logger.debug(
            f"[AI SUMMARY] AI Summary Text (first 200 chars): {ai_summary_text[:200]}..."
        )

        # Return both the latest raw data and the AI-generated summary text
        return {"raw_summary": raw_summary_data, "ai_summary": ai_summary_text}, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI summary run timed out for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"AI summary generation timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error getting AI summary for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"Failed to get AI summary: {str(e)}"}, 500


def converse_ai_summary_controller(data):
    """Handles conversational follow-up questions about survey analytics."""
    survey_id = data.get("survey_id")
    conversation_prompt = data.get("prompt")  # User's follow-up question
    if not survey_id or not conversation_prompt:
        return {"error": "Both survey_id and prompt are required"}, 400

    current_app.logger.info(
        f"[AI CONVERSE] Handling analytics conversation for survey {survey_id}"
    )
    current_app.logger.debug(f"[AI CONVERSE] User prompt: {conversation_prompt[:200]}...")

    # --- Thread Management ---
    thread_id = None
    try:
        # Must use the existing analytics thread for context
        thread_rec = AnalyticsThread.query.filter_by(survey_id=survey_id).first()
        if thread_rec:
            thread_id = thread_rec.thread_id
            current_app.logger.info(f"[AI CONVERSE] Using existing analytics thread: {thread_id}")
        else:
            # If thread doesn't exist, context is lost. Create it, but the conversation might lack depth initially.
            current_app.logger.warning(
                f"[AI CONVERSE] Analytics thread not found for survey {survey_id}. Creating new one, but context might be limited."
            )
            result, status = create_analytics_thread(survey_id)
            if status not in [200, 201]:
                return result, status  # Propagate error
            thread_id = result["thread_id"]
            # The user's first prompt might be less effective if context was just added.
    except Exception as thread_err:
        current_app.logger.error(
            f"[AI ERROR] Failed to establish thread for AI conversation: {thread_err}",
            exc_info=True,
        )
        return {"error": "Failed to establish AI communication thread."}, 500

    # --- Prepare Prompt and Instructions ---
    # The user's prompt is the main content
    message_content = conversation_prompt

    # Simple instructions: rely on thread history for context
    instructions = (
        "You are an analytics assistant. Answer the user's latest question based *only* on the survey data and conversation history contained within this thread. "
        "Be helpful and conversational, but stick strictly to the information available to you in this context. Do not make up data or speculate beyond the provided results."
    )

    try:
        # Add user message and run assistant
        openai_client.beta.threads.messages.create(
            thread_id=thread_id, role="user", content=message_content
        )
        current_app.logger.info(
            f"[AI CONVERSE] Added user question to thread {thread_id}"
        )

        run = openai_client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=analytics_asst_id,
            instructions=instructions,
        )
        current_app.logger.info(f"[AI CONVERSE] Run created ({run.id}), waiting for completion...")
        run = wait_for_run_completion(thread_id, run.id)
        current_app.logger.info(
            f"[AI CONVERSE] Run {run.id} completed with status: {run.status}"
        )

        # Get response
        msgs = openai_client.beta.threads.messages.list(
            thread_id=thread_id, order="desc", limit=1
        )
        if not msgs.data or msgs.data[0].role != "assistant":
            current_app.logger.error("[AI CONVERSE] No assistant message found.")
            return {"error": "AI assistant did not respond."}, 500

        asst_msg_content = msgs.data[0].content
        if (
            not asst_msg_content
            or not hasattr(asst_msg_content[0], "text")
            or not asst_msg_content[0].text.value
        ):
            current_app.logger.error(
                "[AI CONVERSE] Assistant message content is empty or invalid."
            )
            return {"error": "AI assistant provided an empty response."}, 500

        conversation_response_text = asst_msg_content[0].text.value
        current_app.logger.info(
            f"[AI CONVERSE] Successfully generated conversational response for survey {survey_id}."
        )
        current_app.logger.debug(
            f"[AI CONVERSE] AI Response (first 200 chars): {conversation_response_text[:200]}..."
        )

        # Return the AI's text response
        return {"conversation_response": conversation_response_text}, 200

    except TimeoutError as e:
        current_app.logger.error(
            f"[AI ERROR] AI conversation run timed out for survey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"AI conversation timed out: {str(e)}"}, 500
    except Exception as e:
        current_app.logger.error(
            f"[AI ERROR] Error during AI conversation for surscavey {survey_id}: {e}",
            exc_info=True,
        )
        return {"error": f"AI conversation failed: {str(e)}"}, 500

# --- NEW FUNCTION: auto_generate_survey_responses_ai ---
def auto_generate_survey_responses_ai(survey_id, num_responses_to_generate):
    current_app.logger.info(f"[AI AUTO-RESPONSE] Starting generation for survey_id: {survey_id}, num_responses: {num_responses_to_generate}")

    # Start timing for analytics
    start_time = time.time()
    usage_log_id = None

    # Check OpenAI client availability first
    from app.openai_client_setup import get_openai_client
    openai_client = get_openai_client()
    if openai_client is None:
        current_app.logger.error(f"[AI AUTO-RESPONSE] Failed to initialize OpenAI client - API key may be missing")
        return {"error": "Failed to initialize OpenAI client - API key may be missing"}, 500

    # 1. Fetch Survey Structure
    survey_data, status = SurveyController.get_survey(survey_id)
    if status != 200:
        current_app.logger.error(f"[AI AUTO-RESPONSE] Survey {survey_id} not found.")
        return {"error": f"Survey {survey_id} not found"}, 404
    
    survey_questions = survey_data.get("questions", [])
    if not survey_questions:
        current_app.logger.warning(f"[AI AUTO-RESPONSE] Survey {survey_id} has no questions.")
        return {"error": "Survey has no questions to respond to"}, 400

    try:
        thread_id = _get_or_create_generic_thread() 
    except Exception as e:
        current_app.logger.error(f"[AI AUTO-RESPONSE] Could not get/create OpenAI thread: {e}", exc_info=True)
        return {"error": "Failed to initialize AI context"}, 500

    assistant_id_for_answers = survey_update_asst_id 

    successful_submissions = 0
    failed_submissions = 0
    submission_details = []

    for i in range(num_responses_to_generate):
        current_app.logger.info(f"[AI AUTO-RESPONSE] Generating response set {i+1}/{num_responses_to_generate} for survey {survey_id}")
        
        responses_for_submission = {}
        all_answers_generated_for_this_submission = True

        persona_prompt_addition = (
            f" You are simulating survey respondent #{i+1}. "
            f"Try to provide varied and realistic answers as if you are a different person from previous responses. "
            f"If choices are available, pick randomly or based on a plausible persona. "
        )

        for q_idx, question in enumerate(survey_questions):
            seq_num_str = str(question.get("sequence_number", q_idx + 1))
            q_type = question.get("question_type") # Corrected from question.get("type") to question.get("question_type")
            q_text = question.get("question_text", "N/A") # Corrected from question.get("text", "N/A")
            q_options = question.get("options", []) 
            q_image_options = question.get("image_options", []) 
            q_ranking_items = question.get("ranking_items", []) 
            
            if q_type in ["content-text", "content-media"]:
                current_app.logger.info(f"[AI AUTO-RESPONSE] Skipping content block (Q {seq_num_str}): {q_type}")
                continue

            gpt_prompt_for_question = (
                f"You are an AI simulating a survey respondent answering a single question. "
                f"{persona_prompt_addition}"
                f"The question is: '{q_text}'. "
                f"The question type is: '{q_type}'. "
            )

            expected_json_output = False
            
            if q_type == "single-choice" or q_type == "dropdown":
                options_texts = [opt.get("text") if isinstance(opt, dict) else str(opt) for opt in q_options if (opt.get("text") if isinstance(opt, dict) else str(opt))]
                if not options_texts: 
                    responses_for_submission[seq_num_str] = "AI: No options provided"
                    continue
                gpt_prompt_for_question += f"Available options: {json.dumps(options_texts)}. Choose one. Return ONLY the chosen option text as a simple string."
            
            elif q_type == "multi-choice" or q_type == "checkbox":
                options_texts = [opt.get("text") if isinstance(opt, dict) else str(opt) for opt in q_options if (opt.get("text") if isinstance(opt, dict) else str(opt))]
                if not options_texts:
                    responses_for_submission[seq_num_str] = json.dumps([]) 
                    continue
                gpt_prompt_for_question += f"Available options: {json.dumps(options_texts)}. Choose one or more. Return your choices as a JSON array of strings. E.g., [\"Option A\", \"Option B\"]. If no choice, return []."
                expected_json_output = True 

            elif q_type == "open-ended":
                gpt_prompt_for_question += "Provide a brief, realistic text answer. Return ONLY the text string."

            elif q_type == "rating" or q_type == "nps" or q_type == "star-rating":
                min_val = question.get("rating_start", 0 if q_type == "nps" else 1)
                max_val = question.get("rating_end", 10 if q_type == "nps" else 5)
                gpt_prompt_for_question += f"Provide a rating between {min_val} and {max_val}. Return ONLY the number as a string or integer."

            elif q_type == "numerical-input":
                min_val = question.get("min_value", "-infinity")
                max_val = question.get("max_value", "+infinity")
                gpt_prompt_for_question += f"Provide a numerical answer. Min: {min_val}, Max: {max_val}. Return ONLY the number as a string or integer."
            
            elif q_type == "email-input":
                gpt_prompt_for_question += f"Provide a realistic but fake email address (e.g., user{random.randint(100,999)}@example.com). Return ONLY the email string."

            elif q_type == "date-picker":
                gpt_prompt_for_question += "Provide a realistic date in YYYY-MM-DD format. Return ONLY the date string."
            
            elif q_type == "single-image-select":
                options_hidden_labels = [opt.get("hidden_label") for opt in q_image_options if isinstance(opt, dict) and opt.get("hidden_label")]
                options_visible_labels = [opt.get("label", opt.get("hidden_label")) for opt in q_image_options if isinstance(opt, dict) and opt.get("hidden_label")]
                if not options_hidden_labels:
                    responses_for_submission[seq_num_str] = "AI: No image options"
                    continue
                gpt_prompt_for_question += f"Image options (visible labels): {json.dumps(options_visible_labels)}. Corresponding hidden internal IDs are: {json.dumps(options_hidden_labels)}. Choose one image option based on the visible labels. Return ONLY the chosen image's *hidden internal ID* as a simple string."

            elif q_type == "multiple-image-select":
                options_hidden_labels = [opt.get("hidden_label") for opt in q_image_options if isinstance(opt, dict) and opt.get("hidden_label")]
                options_visible_labels = [opt.get("label", opt.get("hidden_label")) for opt in q_image_options if isinstance(opt, dict) and opt.get("hidden_label")]
                if not options_hidden_labels:
                    responses_for_submission[seq_num_str] = json.dumps([])
                    continue
                gpt_prompt_for_question += f"Image options (visible labels): {json.dumps(options_visible_labels)}. Corresponding hidden internal IDs are: {json.dumps(options_hidden_labels)}. Choose one or more image options based on the visible labels. Return ONLY the chosen images' *hidden internal IDs* as a JSON array of strings. E.g., [\"imgopt_abc123\", \"imgopt_def456\"]."
                expected_json_output = True

            elif q_type == "interactive-ranking":
                item_texts = [item.get("text") for item in q_ranking_items if isinstance(item, dict) and item.get("text")]
                if not item_texts:
                    responses_for_submission[seq_num_str] = json.dumps({})
                    continue
                gpt_prompt_for_question += (
                    f"The items to rank are: {json.dumps(item_texts)}. "
                    f"Please rank all of them from 1 (most preferred) to {len(item_texts)} (least preferred). "
                    f"Return your ranking as a JSON object where keys are the item texts and values are their integer ranks. "
                    f"Example: {json.dumps({item_texts[0]: 1, item_texts[1]: 2})} if there were two items."
                )
                expected_json_output = True

            elif q_type == "scale": 
                scale_points_texts = question.get("scale_points", [])
                if not scale_points_texts:
                     responses_for_submission[seq_num_str] = "AI: No scale points provided"
                     continue
                gpt_prompt_for_question += f"Available scale points: {json.dumps(scale_points_texts)}. Choose one. Return ONLY the chosen scale point text as a simple string."
            
            elif q_type == "radio-grid":
                row_labels = [row.get("text") for row in question.get("grid_rows", []) if isinstance(row, dict) and row.get("text")]
                col_labels = [col.get("text") for col in question.get("grid_columns", []) if isinstance(col, dict) and col.get("text")]
                if not row_labels or not col_labels:
                    responses_for_submission[seq_num_str] = json.dumps({})
                    continue
                gpt_prompt_for_question += (
                    f"This is a radio grid. Rows: {json.dumps(row_labels)}. Columns: {json.dumps(col_labels)}. "
                    f"For each row, choose one column. "
                    f"Return your answers as a JSON object where keys are row labels and values are the chosen column labels. "
                    f"Example: {json.dumps({row_labels[0]: col_labels[0], row_labels[1]: col_labels[1]})} if there were two rows."
                )
                expected_json_output = True

            elif q_type == "checkbox-grid":
                row_labels = [row.get("text") for row in question.get("grid_rows", []) if isinstance(row, dict) and row.get("text")]
                col_labels = [col.get("text") for col in question.get("grid_columns", []) if isinstance(col, dict) and col.get("text")]
                if not row_labels or not col_labels:
                    responses_for_submission[seq_num_str] = json.dumps({})
                    continue
                gpt_prompt_for_question += (
                    f"This is a checkbox grid. Rows: {json.dumps(row_labels)}. Columns: {json.dumps(col_labels)}. "
                    f"For each row, choose one or more columns. "
                    f"Return your answers as a JSON object where keys are row labels and values are JSON arrays of chosen column labels. "
                    f"Example: {json.dumps({row_labels[0]: [col_labels[0], col_labels[1]], row_labels[1]: [col_labels[0]]})}."
                )
                expected_json_output = True
            
            elif q_type == "star-rating-grid":
                row_labels = [row.get("text") for row in question.get("grid_rows", []) if isinstance(row, dict) and row.get("text")]
                if not row_labels:
                    responses_for_submission[seq_num_str] = json.dumps({})
                    continue
                
                rating_col_label = "Rating" 
                
                gpt_prompt_for_question += (
                    f"This is a star rating grid. Rows: {json.dumps(row_labels)}. "
                    f"For each row, provide a star rating (e.g., from 1 to 5, or 'N/A' if not applicable). "
                    f"Return your answers as a JSON object. Keys are row labels. Values are *another* JSON object with a single key '{rating_col_label}' and its value being the star rating (number) or 'N/A' (string). "
                    f"Example: {json.dumps({row_labels[0]: {rating_col_label: 4}, row_labels[1]: {rating_col_label: 'N/A'}})} if 2 rows."
                )
                expected_json_output = True

            elif q_type == "signature":
                random_name = f"AI User {random.randint(100,999)}"
                random_font = random.choice(["Dancing Script", "Great Vibes", "Pacifico", "Satisfy", "Sacramento", "Allura"])
                signature_obj = {"type": "typed", "name": random_name, "font": random_font}
                responses_for_submission[seq_num_str] = json.dumps(signature_obj)
                current_app.logger.info(f"[AI AUTO-RESPONSE] Generated signature for Q {seq_num_str}: {responses_for_submission[seq_num_str]}")
                continue 

            elif q_type == "document-upload":
                num_docs = random.randint(1, min(2, question.get("max_files", 1) or 1) )
                docs_metadata = []
                allowed_exts = question.get("allowed_types", ["pdf", "doc", "png"]) 
                if isinstance(allowed_exts, str): allowed_exts = [ext.strip() for ext in allowed_exts.split(',')]
                
                for d_idx in range(num_docs):
                    ext = random.choice(allowed_exts) if allowed_exts else "dat"
                    mime_map = {"pdf": "application/pdf", "doc": "application/msword", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                                "png": "image/png", "jpg": "image/jpeg", "txt": "text/plain"}
                    docs_metadata.append({
                        "name": f"ai_gen_doc_{d_idx+1}.{ext}",
                        "url": f"placeholder/uploads/ai_gen_doc_{d_idx+1}_{uuid.uuid4().hex[:8]}.{ext}", 
                        "type": mime_map.get(ext, "application/octet-stream"),
                        "size": random.randint(50000, 5000000) 
                    })
                responses_for_submission[seq_num_str] = json.dumps(docs_metadata)
                current_app.logger.info(f"[AI AUTO-RESPONSE] Generated doc metadata for Q {seq_num_str}: {responses_for_submission[seq_num_str]}")
                continue 

            else:
                current_app.logger.warning(f"[AI AUTO-RESPONSE] Question type '{q_type}' (Q {seq_num_str}) not fully handled for AI generation. Using generic prompt.")
                gpt_prompt_for_question += "Provide a plausible answer. Return as a simple string."

            try:
                from app.openai_client_setup import get_openai_client
                
                # Get the dynamic client for each question
                openai_client = get_openai_client()
                if openai_client is None:
                    current_app.logger.error(f"[AI AUTO-RESPONSE] Failed to get OpenAI client for Q {seq_num_str}")
                    responses_for_submission[seq_num_str] = "AI_ERROR: No OpenAI client"
                    all_answers_generated_for_this_submission = False
                    continue
                    
                openai_client.beta.threads.messages.create(
                    thread_id=thread_id, role="user", content=gpt_prompt_for_question
                )
                run_instructions = (
                    "You are an AI answering a single survey question. "
                    "Follow the user's prompt precisely regarding the expected output format. "
                    "Return ONLY the answer in the specified format. Do not add any conversational text, explanations, or markdown."
                )
                run = openai_client.beta.threads.runs.create(
                    thread_id=thread_id,
                    assistant_id=assistant_id_for_answers, 
                    instructions=run_instructions
                )
                run = wait_for_run_completion(thread_id, run.id) 
                
                msgs = openai_client.beta.threads.messages.list(thread_id=thread_id, order="desc", limit=1)
                if not msgs.data or msgs.data[0].role != "assistant" or not msgs.data[0].content or not hasattr(msgs.data[0].content[0], 'text'):
                    current_app.logger.error(f"[AI AUTO-RESPONSE] No valid assistant response for Q {seq_num_str}.")
                    responses_for_submission[seq_num_str] = "AI_ERROR: No response"
                    all_answers_generated_for_this_submission = False
                    continue

                ai_answer_raw = msgs.data[0].content[0].text.value
                current_app.logger.debug(f"[AI AUTO-RESPONSE] Raw AI answer for Q {seq_num_str} ({q_type}): '{ai_answer_raw}'")

                if expected_json_output:
                    try:
                        json.loads(ai_answer_raw) 
                        responses_for_submission[seq_num_str] = ai_answer_raw
                    except json.JSONDecodeError:
                        current_app.logger.error(f"[AI AUTO-RESPONSE] Q {seq_num_str}: AI returned invalid JSON: '{ai_answer_raw}'. Storing as raw string.")
                        responses_for_submission[seq_num_str] = ai_answer_raw 
                else:
                    responses_for_submission[seq_num_str] = ai_answer_raw.strip("\"'") 

            except TimeoutError:
                current_app.logger.error(f"[AI AUTO-RESPONSE] Timeout generating answer for Q {seq_num_str}.")
                responses_for_submission[seq_num_str] = "AI_ERROR: Timeout"
                all_answers_generated_for_this_submission = False
            except Exception as e_gpt:
                current_app.logger.error(f"[AI AUTO-RESPONSE] Error generating answer for Q {seq_num_str}: {e_gpt}", exc_info=True)
                responses_for_submission[seq_num_str] = f"AI_ERROR: {str(e_gpt)[:50]}"
                all_answers_generated_for_this_submission = False
            
            current_app.logger.info(f"[AI AUTO-RESPONSE] Generated answer for Q {seq_num_str}: {str(responses_for_submission.get(seq_num_str, 'N/A'))[:100]}")

        submission_payload = {
            "survey_id": survey_id,
            "responses": responses_for_submission,
            "duration": random.randint(60, 600),  
            "survey_link_id": None, 
            "user_id": None, 
            "is_ai_generated": True, # Flag this as an AI-generated response
            "user_agent": {"userAgent": "AI Bot Survey Filler", "deviceType": "Desktop", "browserInfo": "Chrome"},
            "response_times": {seq: random.randint(5,30) for seq in responses_for_submission.keys()} 
        }

        current_app.logger.debug(f"[AI AUTO-RESPONSE] Payload for submission {i+1}: {json.dumps(submission_payload, indent=2, default=str)}")

        if all_answers_generated_for_this_submission:
            try:
                submit_result, submit_status = ResponseController.submit_responses(submission_payload)
                if submit_status == 201:
                    successful_submissions += 1
                    submission_details.append({"submission_index": i+1, "status": "success", "submission_id": submit_result.get("submission_id")})
                    current_app.logger.info(f"[AI AUTO-RESPONSE] Successfully submitted response set {i+1}. Submission ID: {submit_result.get('submission_id')}")
                else:
                    failed_submissions += 1
                    submission_details.append({"submission_index": i+1, "status": "failed", "error": submit_result.get("error", "Unknown submission error"), "details": submit_result.get("details")})
                    current_app.logger.error(f"[AI AUTO-RESPONSE] Failed to submit response set {i+1}. Status: {submit_status}, Error: {submit_result}")
            except Exception as e_submit:
                failed_submissions += 1
                submission_details.append({"submission_index": i+1, "status": "exception_on_submit", "error": str(e_submit)})
                current_app.logger.error(f"[AI AUTO-RESPONSE] Exception during submission of response set {i+1}: {e_submit}", exc_info=True)
        else:
            failed_submissions +=1
            submission_details.append({"submission_index": i+1, "status": "failed_generation", "error": "One or more answers failed to generate."})
            current_app.logger.warning(f"[AI AUTO-RESPONSE] Skipped submission for set {i+1} due to answer generation errors.")
        
        time.sleep(random.uniform(0.5, 2.0))

    final_message = (
        f"AI response generation complete. "
        f"Successfully submitted: {successful_submissions}. "
        f"Failed submissions: {failed_submissions}."
    )
    current_app.logger.info(f"[AI AUTO-RESPONSE] {final_message}")
    
    # Log the operation
    processing_time = time.time() - start_time
    success = successful_submissions > 0
    AIUsageAnalyticsController.log_ai_operation(
        operation_type='response_generation',
        operation_subtype='auto_responses',
        survey_id=survey_id,
        points_cost=getattr(g, 'points_needed', 0),
        processing_time=processing_time,
        success=success,
        metadata={
            'requested_responses': num_responses_to_generate,
            'successful_submissions': successful_submissions,
            'failed_submissions': failed_submissions,
            'questions_processed': len(survey_questions)
        }
    )
    db.session.commit()
    
    return {
        "message": final_message,
        "successful_submissions": successful_submissions,
        "failed_submissions": failed_submissions,
        "details": submission_details
    }, 200

# Helper: compute sample size from analytics dict
def _compute_sample_size(a_dict, qtype):
    if not isinstance(a_dict, dict):
        return 0
    # Preferred explicit fields
    if "count_valid" in a_dict:
        return a_dict.get("count_valid", 0)
    if "total_responses_considered" in a_dict:
        return a_dict.get("total_responses_considered", 0)
    # Derive from distribution-style data
    if "distribution" in a_dict and isinstance(a_dict["distribution"], dict):
        return sum(a_dict["distribution"].values())
    for key in ["options_distribution", "option_distribution"]:
        if key in a_dict and isinstance(a_dict[key], list):
            return sum(item.get("count", 0) for item in a_dict[key] if isinstance(item, dict))
    # Ranking grid sample count may equal row_averages length if not provided; fallback 0
    return 0