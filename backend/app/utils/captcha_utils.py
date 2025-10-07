"""
CAPTCHA verification utilities for bot prevention
"""
import requests
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def verify_recaptcha(captcha_token, remote_ip=None):
    """
    Verify Google reCAPTCHA v2 token with Google's API
    
    Args:
        captcha_token (str): The reCAPTCHA response token from the frontend
        remote_ip (str, optional): The user's IP address for additional verification
        
    Returns:
        tuple: (success: bool, error_message: str or None)
    """
    if not captcha_token:
        logger.warning("[CAPTCHA] No CAPTCHA token provided")
        return False, "CAPTCHA token is required"
    
    # Get reCAPTCHA configuration from Flask config
    secret_key = current_app.config.get('RECAPTCHA_SECRET_KEY')
    verify_url = current_app.config.get('RECAPTCHA_VERIFY_URL')
    
    if not secret_key:
        logger.error("[CAPTCHA] RECAPTCHA_SECRET_KEY not configured")
        return False, "CAPTCHA service not properly configured"
    
    if not verify_url:
        logger.error("[CAPTCHA] RECAPTCHA_VERIFY_URL not configured")
        return False, "CAPTCHA service not properly configured"
    
    # Prepare verification data
    verification_data = {
        'secret': secret_key,
        'response': captcha_token
    }
    
    # Add remote IP if provided for additional security
    if remote_ip:
        verification_data['remoteip'] = remote_ip
    
    try:
        logger.info(f"[CAPTCHA] Verifying reCAPTCHA token with Google API")
        
        # Make request to Google's reCAPTCHA verification API
        response = requests.post(
            verify_url,
            data=verification_data,
            timeout=10,  # 10 second timeout
            headers={
                'User-Agent': 'Survey-App-Backend/1.0',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        
        # Check if request was successful
        if response.status_code != 200:
            logger.error(f"[CAPTCHA] Google API returned status {response.status_code}")
            return False, "CAPTCHA verification service temporarily unavailable"
        
        # Parse JSON response
        result = response.json()
        logger.debug(f"[CAPTCHA] Google API response: {result}")
        
        # Check if verification was successful
        if result.get('success', False):
            logger.info("[CAPTCHA] reCAPTCHA verification successful")
            
            # Optional: Check score for reCAPTCHA v3 (not used in v2, but good to handle)
            score = result.get('score')
            if score is not None:
                logger.info(f"[CAPTCHA] reCAPTCHA score: {score}")
                # For reCAPTCHA v3, you might want to check if score > 0.5
                # But for v2, this is not applicable
            
            return True, None
        else:
            # Get error codes from response
            error_codes = result.get('error-codes', [])
            logger.warning(f"[CAPTCHA] reCAPTCHA verification failed. Error codes: {error_codes}")
            
            # Map error codes to user-friendly messages
            error_message = _map_recaptcha_error_codes(error_codes)
            return False, error_message
            
    except requests.exceptions.Timeout:
        logger.error("[CAPTCHA] Timeout while verifying reCAPTCHA")
        return False, "CAPTCHA verification timed out. Please try again."
    
    except requests.exceptions.ConnectionError:
        logger.error("[CAPTCHA] Connection error while verifying reCAPTCHA")
        return False, "CAPTCHA verification service unavailable. Please try again."
    
    except requests.exceptions.RequestException as e:
        logger.error(f"[CAPTCHA] Request error while verifying reCAPTCHA: {str(e)}")
        return False, "CAPTCHA verification failed. Please try again."
    
    except ValueError as e:
        logger.error(f"[CAPTCHA] Invalid JSON response from Google API: {str(e)}")
        return False, "CAPTCHA verification service returned invalid response."
    
    except Exception as e:
        logger.error(f"[CAPTCHA] Unexpected error during reCAPTCHA verification: {str(e)}", exc_info=True)
        return False, "CAPTCHA verification failed due to an unexpected error."

def _map_recaptcha_error_codes(error_codes):
    """
    Map Google reCAPTCHA error codes to user-friendly messages
    
    Args:
        error_codes (list): List of error codes from Google's API
        
    Returns:
        str: User-friendly error message
    """
    # Common error code mappings
    error_mapping = {
        'missing-input-secret': 'CAPTCHA configuration error',
        'invalid-input-secret': 'CAPTCHA configuration error',
        'missing-input-response': 'Please complete the CAPTCHA verification',
        'invalid-input-response': 'Invalid CAPTCHA response. Please try again.',
        'bad-request': 'Invalid CAPTCHA request',
        'timeout-or-duplicate': 'CAPTCHA has expired or was already used. Please try again.'
    }
    
    # Return the first mapped error, or a generic message
    for error_code in error_codes:
        if error_code in error_mapping:
            return error_mapping[error_code]
    
    # If no specific mapping found, return generic message
    if error_codes:
        logger.warning(f"[CAPTCHA] Unmapped error codes: {error_codes}")
        return "CAPTCHA verification failed. Please try again."
    
    return "CAPTCHA verification failed for unknown reason."

def is_captcha_required():
    """
    Check if CAPTCHA verification is required based on configuration
    
    Returns:
        bool: True if CAPTCHA is required, False otherwise
    """
    # Check if reCAPTCHA is properly configured
    secret_key = current_app.config.get('RECAPTCHA_SECRET_KEY')
    return bool(secret_key and secret_key != 'disabled')

def validate_captcha_token_format(token):
    """
    Basic validation of CAPTCHA token format
    
    Args:
        token (str): The CAPTCHA token to validate
        
    Returns:
        bool: True if token format appears valid, False otherwise
    """
    if not token or not isinstance(token, str):
        return False
    
    # reCAPTCHA tokens are typically long strings with specific characteristics
    # This is a basic check - the real validation happens with Google's API
    if len(token) < 20:  # reCAPTCHA tokens are much longer than this
        return False
    
    # Check for obvious invalid characters (basic sanity check)
    if any(char in token for char in [' ', '\n', '\r', '\t']):
        return False
    
    return True

