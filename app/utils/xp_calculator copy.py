"""
XP and Time Calculation Utilities

This module provides functions to calculate XP rewards and estimated completion times
for surveys and other activities based on the platform requirements:
- XP is calculated dynamically based on question count (more questions = more XP per question)
- 1 question = 30 seconds (0.5 minutes) instead of 1 minute
"""

def calculate_survey_xp(question_count, xp_per_question=5):
    """
    Calculate XP based on number of questions.
    Default: 5 XP per question (configurable)
    
    Args:
        question_count (int): Number of questions in the survey
        xp_per_question (int): XP reward per question (default: 5)
        
    Returns:
        int: XP reward amount
    """
    if not isinstance(question_count, int) or question_count < 0:
        return 0
    
    return question_count * xp_per_question

def calculate_survey_time(question_count):
    """
    Calculate estimated time: 1 question = 30 seconds, rounded up to 1 minute minimum
    
    Args:
        question_count (int): Number of questions in the survey
        
    Returns:
        int: Estimated time in minutes (rounded up)
    """
    if not isinstance(question_count, int) or question_count < 0:
        return 0
    
    import math
    time_in_minutes = question_count * 0.5  # 30 seconds per question
    return math.ceil(time_in_minutes)  # Always round up

def calculate_business_total_xp(business_id):
    """
    Calculate total available XP from a business (surveys + quests)
    
    Args:
        business_id (int): ID of the business
        
    Returns:
        int: Total XP available from this business
    """
    try:
        from app.models import Business, Survey
        
        business = Business.query.get(business_id)
        if not business:
            return 0
        
        # Sum XP from active surveys
        survey_xp = 0
        for survey in business.surveys.filter_by(published=True, is_archived=False):
            question_count = survey.questions.count()
            survey_xp += calculate_survey_xp(question_count)
        
        # Sum XP from active quests (when implemented)
        quest_xp = 0
        # TODO: Implement when Quest model is available
        # for quest in business.quests.filter_by(is_active=True):
        #     quest_xp += quest.xp_reward
        
        return survey_xp + quest_xp
        
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Error calculating business total XP: {e}")
        return 0

def calculate_business_total_time(business_id):
    """
    Calculate total estimated time for all activities from a business
    
    Args:
        business_id (int): ID of the business
        
    Returns:
        int: Total estimated time in minutes
    """
    try:
        from app.models import Business, Survey
        
        business = Business.query.get(business_id)
        if not business:
            return 0
        
        # Sum time from active surveys
        survey_time = 0
        for survey in business.surveys.filter_by(published=True, is_archived=False):
            question_count = survey.questions.count()
            survey_time += calculate_survey_time(question_count)
        
        # Sum time from active quests (when implemented)
        quest_time = 0
        # TODO: Implement when Quest model is available
        # for quest in business.quests.filter_by(is_active=True):
        #     quest_time += quest.estimated_time or 5  # Default 5 minutes
        
        return survey_time + quest_time
        
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Error calculating business total time: {e}")
        return 0

def calculate_activity_xp(activity_type, **kwargs):
    """
    Calculate XP for various platform activities
    
    Args:
        activity_type (str): Type of activity ('survey_completion', 'quest_completion', etc.)
        **kwargs: Additional parameters specific to each activity type
        
    Returns:
        int: XP reward for the activity
    """
    if activity_type == 'survey_completion':
        question_count = kwargs.get('question_count', 0)
        return calculate_survey_xp(question_count)
    
    elif activity_type == 'quest_completion':
        # For quests, XP is predefined in the quest definition
        return kwargs.get('quest_xp', 0)
    
    elif activity_type == 'bug_report':
        # Fixed XP for bug reports
        return 10
    
    elif activity_type == 'feature_request':
        # Fixed XP for feature requests
        return 5
    
    elif activity_type == 'profile_completion':
        # XP for completing profile sections
        return kwargs.get('section_xp', 20)
    
    else:
        # Unknown activity type
        return 0

def format_time_display(minutes):
    """
    Format time in minutes to a user-friendly display string
    
    Args:
        minutes (int): Time in minutes
        
    Returns:
        str: Formatted time string (e.g., "5 min", "1 hr 30 min")
    """
    if minutes < 60:
        return f"{minutes} min"
    
    hours = minutes // 60
    remaining_minutes = minutes % 60
    
    if remaining_minutes == 0:
        return f"{hours} hr"
    
    return f"{hours} hr {remaining_minutes} min"

def validate_xp_calculation(question_count, expected_xp):
    """
    Validate that XP calculation is correct
    
    Args:
        question_count (int): Number of questions
        expected_xp (int): Expected XP amount
        
    Returns:
        bool: True if calculation is correct
    """
    calculated_xp = calculate_survey_xp(question_count)
    return calculated_xp == expected_xp

def validate_time_calculation(question_count, expected_time):
    """
    Validate that time calculation is correct
    
    Args:
        question_count (int): Number of questions
        expected_time (int): Expected time in minutes
        
    Returns:
        bool: True if calculation is correct
    """
    calculated_time = calculate_survey_time(question_count)
    return calculated_time == expected_time 