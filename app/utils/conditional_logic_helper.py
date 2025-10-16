"""
Helper functions for managing conditional logic with UUIDs
"""
import json
from typing import Dict, List, Optional, Any


def migrate_conditional_logic_to_uuid(questions: List[Dict]) -> List[Dict]:
    """
    Migrate conditional logic rules from sequence numbers to UUIDs
    
    Args:
        questions: List of question dictionaries
        
    Returns:
        Updated list of questions with UUID-based conditional logic
    """
    # Create mapping from sequence number to UUID
    sequence_to_uuid = {q.get('sequence_number'): q.get('question_uuid') for q in questions if q.get('question_uuid')}
    
    for question in questions:
        if question.get('conditional_logic_rules'):
            question['conditional_logic_rules'] = convert_logic_rules_to_uuid(
                question['conditional_logic_rules'], 
                sequence_to_uuid
            )
    
    return questions


def convert_logic_rules_to_uuid(logic_rules: Dict, sequence_to_uuid_map: Dict) -> Dict:
    """
    Convert conditional logic rules from sequence-based to UUID-based
    
    Args:
        logic_rules: The conditional logic rules object
        sequence_to_uuid_map: Mapping of sequence numbers to UUIDs
        
    Returns:
        Updated logic rules with UUIDs
    """
    if not logic_rules or not isinstance(logic_rules, dict):
        return logic_rules
    
    updated_rules = logic_rules.copy()
    
    # Handle single conditional logic rule
    if 'baseQuestionSequence' in updated_rules:
        base_sequence = updated_rules['baseQuestionSequence']
        if base_sequence in sequence_to_uuid_map:
            updated_rules['baseQuestionUuid'] = sequence_to_uuid_map[base_sequence]
            # Keep baseQuestionSequence for backward compatibility during transition
    
    return updated_rules


def update_question_sequence_with_logic_preservation(survey_id: int, question_mappings: List[Dict]) -> bool:
    """
    Update question sequences while preserving conditional logic relationships.
    This function now handles sequence-based logic by updating the sequence
    numbers in the logic rules when questions are reordered.
    
    Args:
        survey_id: ID of the survey
        question_mappings: List of {id: question_id, new_sequence: sequence_number}
        
    Returns:
        True if successful, False otherwise
    """
    from ..models import Question, db
    
    try:
        with db.session.no_autoflush:
            # Get all questions for this survey
            questions = Question.query.filter_by(survey_id=survey_id).order_by(Question.sequence_number).all()
            
            # Create a map from question ID to its original sequence number
            id_to_old_sequence = {q.id: q.sequence_number for q in questions}
            
            # Create a map from question ID to its new sequence number from the input
            id_to_new_sequence = {mapping['id']: mapping['new_sequence'] for mapping in question_mappings}
            
            # Create a map from the original sequence number to the new sequence number
            old_seq_to_new_seq = {
                id_to_old_sequence[q_id]: new_seq 
                for q_id, new_seq in id_to_new_sequence.items() 
                if q_id in id_to_old_sequence
            }

            # Update conditional logic rules before changing sequences
            for question in questions:
                if not question.conditional_logic_rules:
                    continue
                
                # Make a mutable copy of the rules
                rules = dict(question.conditional_logic_rules)
                is_updated = False

                # Handle original sequence-based logic (preferred) - this should remain stable
                if 'baseQuestionOriginalSequence' in rules:
                    # Original sequence logic should NOT change during reordering
                    # But update the baseQuestionSequence for backward compatibility
                    original_seq = rules['baseQuestionOriginalSequence']
                    target_q = next((q for q in questions if q.original_sequence_number == original_seq), None)
                    if target_q and target_q.id in id_to_new_sequence:
                        new_current_seq = id_to_new_sequence[target_q.id]
                        if rules.get('baseQuestionSequence') != new_current_seq:
                            rules['baseQuestionSequence'] = new_current_seq
                            is_updated = True

                # Handle legacy sequence-based logic (update to current sequence)
                elif 'baseQuestionSequence' in rules:
                    old_base_seq = rules['baseQuestionSequence']
                    
                    # Find the question ID that had this old sequence
                    target_q_id = next((q.id for q in questions if q.sequence_number == old_base_seq), None)
                    
                    if target_q_id and target_q_id in id_to_new_sequence:
                        new_base_seq = id_to_new_sequence[target_q_id]
                        if rules['baseQuestionSequence'] != new_base_seq:
                            rules['baseQuestionSequence'] = new_base_seq
                            is_updated = True

                if is_updated:
                    question.conditional_logic_rules = rules
                    db.session.add(question)

            # Update sequences of the questions themselves
            for question in questions:
                if question.id in id_to_new_sequence:
                    question.sequence_number = id_to_new_sequence[question.id]
                    db.session.add(question)
        
        # Commit all changes at once
        db.session.commit()
        
        return True
        
    except Exception as e:
        db.session.rollback()
        # Use a logger in a real application
        print(f"Error updating question sequences with logic preservation: {e}")
        return False


def validate_conditional_logic_integrity(survey_id: int) -> List[str]:
    """
    Validate that all conditional logic references point to valid questions
    
    Args:
        survey_id: ID of the survey to validate
        
    Returns:
        List of validation errors (empty if valid)
    """
    from ..models import Question
    
    questions = Question.query.filter_by(survey_id=survey_id).all()
    question_uuids = {q.question_uuid for q in questions}
    errors = []
    
    for question in questions:
        if question.conditional_logic_rules:
            logic_rules = question.conditional_logic_rules
            
            # Check if using UUID-based reference
            if 'baseQuestionUuid' in logic_rules:
                base_uuid = logic_rules['baseQuestionUuid']
                if base_uuid not in question_uuids:
                    errors.append(
                        f"Question {question.sequence_number} references invalid UUID {base_uuid}"
                    )
            
            # Check if still using sequence-based reference (warn for migration)
            elif 'baseQuestionSequence' in logic_rules:
                base_sequence = logic_rules['baseQuestionSequence']
                base_question = next(
                    (q for q in questions if q.sequence_number == base_sequence), 
                    None
                )
                if not base_question:
                    errors.append(
                        f"Question {question.sequence_number} references invalid sequence {base_sequence}"
                    )
    
    return errors


def should_question_be_visible(question: Dict, responses: Dict, all_questions: List[Dict]) -> bool:
    """
    Determine if a question should be visible based on conditional logic
    
    Args:
        question: The question to evaluate
        responses: Current user responses (keyed by question_uuid or sequence_number)
        all_questions: All questions in the survey
        
    Returns:
        True if question should be visible, False if hidden
    """
    logic_rules = question.get('conditional_logic_rules')
    if not logic_rules:
        return True  # No conditional logic, always visible
    
    base_question = None
    
    # Check for original sequence-based logic first (preferred)
    if 'baseQuestionOriginalSequence' in logic_rules:
        base_original_sequence = logic_rules['baseQuestionOriginalSequence']
        base_question = next((q for q in all_questions if q.get('original_sequence_number') == base_original_sequence), None)
        if base_question:
            # Check response using original sequence number
            response = responses.get(f"original_{base_original_sequence}") or responses.get(str(base_original_sequence)) or responses.get(base_original_sequence)
    
    # Fallback to UUID-based logic
    elif 'baseQuestionUuid' in logic_rules:
        base_uuid = logic_rules['baseQuestionUuid']
        base_question = next((q for q in all_questions if q.get('question_uuid') == base_uuid), None)
        if base_question:
            # Check response using UUID
            response = responses.get(base_uuid)
    
    # Fallback to sequence-based logic (backward compatibility)
    elif 'baseQuestionSequence' in logic_rules:
        base_sequence = logic_rules['baseQuestionSequence']
        base_question = next((q for q in all_questions if q.get('sequence_number') == base_sequence), None)
        if base_question:
            # Check response using sequence number
            response = responses.get(str(base_sequence)) or responses.get(base_sequence)
    
    if not base_question:
        return True  # Invalid reference, show question
    
    # If base question not answered, hide dependent question
    if response is None or response == '' or (isinstance(response, list) and len(response) == 0):
        return False
    
    # Evaluate condition based on question type and response
    return evaluate_condition(base_question, response, logic_rules)


def evaluate_condition(base_question: Dict, response: Any, logic_rules: Dict) -> bool:
    """
    Evaluate if the condition is met for showing the dependent question
    
    Args:
        base_question: The base question that the condition depends on
        response: The user's response to the base question
        logic_rules: The conditional logic rules
        
    Returns:
        True if condition is met (show question), False otherwise
    """
    condition_value = logic_rules.get('conditionValue')
    question_type = base_question.get('question_type') or base_question.get('type')
    
    if question_type == 'single-choice':
        return str(response) == str(condition_value)
    
    elif question_type == 'multi-choice':
        if not isinstance(response, list) or not isinstance(condition_value, dict):
            return False
        
        required_options = condition_value.get('options', [])
        match_type = condition_value.get('matchType', 'any')
        
        if match_type == 'all':
            return all(opt in response for opt in required_options)
        else:  # 'any'
            return any(opt in response for opt in required_options)
    
    elif question_type in ['nps', 'rating', 'star-rating', 'numerical-input']:
        if not isinstance(condition_value, dict):
            return False
        
        try:
            actual_value = float(response)
            target_value = float(condition_value.get('value', 0))
            operator = condition_value.get('operator', 'eq')
            
            operators = {
                'eq': lambda a, t: a == t,
                'neq': lambda a, t: a != t,
                'gt': lambda a, t: a > t,
                'gte': lambda a, t: a >= t,
                'lt': lambda a, t: a < t,
                'lte': lambda a, t: a <= t,
            }
            
            return operators.get(operator, operators['eq'])(actual_value, target_value)
            
        except (ValueError, TypeError):
            return False
    
    return False 