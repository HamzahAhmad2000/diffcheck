import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/ConditionalLogicEditor.css'; // We'll create this CSS file

const ConditionalLogicEditor = ({
  allSurveyQuestions, // All questions in the current survey
  currentQuestionSequence, // Sequence number of the question this logic is for
  existingLogic, // The current conditional_logic_rules for this question
  onSaveLogic,
  onCancelLogic,
}) => {
  const [baseQuestionSequence, setBaseQuestionSequence] = useState('');
  const [conditionConfig, setConditionConfig] = useState({}); // Holds specific condition values
  const [validationError, setValidationError] = useState('');

  const availableBaseQuestions = useMemo(() => {
    return allSurveyQuestions.filter(
      (q) =>
        (q.original_sequence_number || q.sequence_number) < (currentQuestionSequence) &&
        [
          'single-choice',
          'multi-choice',
          'nps',
          'rating', // for slider
          'star-rating',
          'numerical-input',
        ].includes(q.type || q.question_type)
    );
  }, [allSurveyQuestions, currentQuestionSequence]);

  const selectedBaseQuestion = useMemo(() => {
    if (!baseQuestionSequence) return null;
    // Find question by original_sequence_number first, then fall back to sequence_number
    return allSurveyQuestions.find(
      (q) => (q.original_sequence_number || q.sequence_number) === parseInt(baseQuestionSequence)
    );
  }, [baseQuestionSequence, allSurveyQuestions]);

  useEffect(() => {
    if (existingLogic) {
      // Use baseQuestionOriginalSequence if available, otherwise fall back to sequence
      if (existingLogic.baseQuestionOriginalSequence) {
        setBaseQuestionSequence(existingLogic.baseQuestionOriginalSequence.toString());
      } else if (existingLogic.baseQuestionSequence) {
        setBaseQuestionSequence(existingLogic.baseQuestionSequence.toString());
      } else {
        setBaseQuestionSequence('');
      }
      setConditionConfig(existingLogic.conditionValue || {});
    } else {
      setBaseQuestionSequence('');
      setConditionConfig({});
    }
    setValidationError(''); // Clear any validation errors when component mounts or logic changes
  }, [existingLogic]);

  const handleBaseQuestionChange = (e) => {
    const newBaseSeq = e.target.value;
    setBaseQuestionSequence(newBaseSeq);
    setConditionConfig({}); // Reset condition config when base question changes
    setValidationError(''); // Clear validation errors
  };

  const handleConditionChange = (field, value) => {
    setConditionConfig((prev) => ({ ...prev, [field]: value }));
    setValidationError(''); // Clear validation errors when user makes changes
  };

  const getConditionType = () => {
    if (!selectedBaseQuestion) return null;
    switch (selectedBaseQuestion.type) {
      case 'single-choice':
        return 'single_choice_option_selected';
      case 'multi-choice':
        return conditionConfig.matchType === 'all'
          ? 'multi_choice_all_selected'
          : 'multi_choice_any_selected';
      case 'nps':
      case 'rating': // slider
      case 'star-rating':
      case 'numerical-input':
        return `numerical_${conditionConfig.operator || 'eq'}`;
      default:
        return null;
    }
  };

  const validateCondition = () => {
    if (!selectedBaseQuestion) {
      setValidationError('Please select a question to base the logic on.');
      return false;
    }

    switch (selectedBaseQuestion.type) {
      case 'single-choice':
        if (!conditionConfig.selectedOption) {
          setValidationError('Please select an option for the condition.');
          return false;
        }
        break;
      case 'multi-choice':
        if (!conditionConfig.selectedOptions || conditionConfig.selectedOptions.length === 0) {
          setValidationError('Please select at least one option for the condition.');
          return false;
        }
        break;
      case 'nps':
      case 'rating':
      case 'star-rating':
      case 'numerical-input':
        if (!conditionConfig.operator) {
          setValidationError('Please select an operator for the condition.');
          return false;
        }
        if (conditionConfig.value === '' || conditionConfig.value === undefined || conditionConfig.value === null) {
          setValidationError('Please enter a value for the condition.');
          return false;
        }
        
        // Validate NPS/Star Rating range
        if (selectedBaseQuestion.type === 'nps' && (conditionConfig.value < 0 || conditionConfig.value > 10)) {
          setValidationError('NPS value must be between 0 and 10.');
          return false;
        }
        if (selectedBaseQuestion.type === 'star-rating' && 
            (conditionConfig.value < (selectedBaseQuestion.rating_start || 1) || 
             conditionConfig.value > (selectedBaseQuestion.rating_end || 5))) {
          setValidationError(`Star rating value must be between ${selectedBaseQuestion.rating_start || 1} and ${selectedBaseQuestion.rating_end || 5}.`);
          return false;
        }
        break;
      default:
        break;
    }
    
    setValidationError('');
    return true;
  };

  const handleSave = () => {
    if (!validateCondition()) {
      return;
    }

    if (!selectedBaseQuestion) {
      onSaveLogic(null); // Clear logic if no base question selected
      return;
    }

    const conditionType = getConditionType();
    if (!conditionType) {
      setValidationError('Invalid condition type for the selected base question.');
      return;
    }
    
    let finalConditionValue = { ...conditionConfig };

    // Final value prep
    if (selectedBaseQuestion.type === 'single-choice') {
      finalConditionValue = conditionConfig.selectedOption; // Store only the option text
    } else if (selectedBaseQuestion.type === 'multi-choice') {
      finalConditionValue = {
        options: conditionConfig.selectedOptions,
        matchType: conditionConfig.matchType || 'any',
      };
    } else if (['nps', 'rating', 'star-rating', 'numerical-input'].includes(selectedBaseQuestion.type)) {
      finalConditionValue = {
        operator: conditionConfig.operator,
        value: parseFloat(conditionConfig.value),
      };
    }

    const newLogic = {
      conditionType: conditionType,
      conditionValue: finalConditionValue,
    };

    // Store using original_sequence_number for stable references
    const originalSequence = selectedBaseQuestion.original_sequence_number || selectedBaseQuestion.sequence_number;
    newLogic.baseQuestionOriginalSequence = originalSequence;

    // Store unique question UUID for reliable references after reordering
    if (selectedBaseQuestion.question_uuid) {
      newLogic.baseQuestionUuid = selectedBaseQuestion.question_uuid;
    }

    // Also store current sequence for backward compatibility during transition
    newLogic.baseQuestionSequence = selectedBaseQuestion.sequence_number;
    
    onSaveLogic(newLogic);
  };

  // Removed auto-save logic to prevent automatic closing of editor

  const handleClearLogic = () => {
    // Confirm before clearing
    if (window.confirm('Are you sure you want to clear all conditional logic?')) {
      onSaveLogic(null);
    }
  };

  const renderConditionFields = () => {
    if (!selectedBaseQuestion) {
      return (
        <div className="conditional-logic-editor__placeholder">
          <p>Select a question to base the logic on.</p>
          <p className="conditional-logic-editor__help-text">
            This question will only be shown when the selected question meets the condition you specify.
          </p>
        </div>
      );
    }

    switch (selectedBaseQuestion.type) {
      case 'single-choice':
        return (
          <div className="conditional-logic-editor__condition-group">
            <label htmlFor="selectedOption" className="conditional-logic-editor__condition-label">
              If option selected is:
            </label>
            <select
              id="selectedOption"
              value={conditionConfig.selectedOption || ''}
              onChange={(e) => handleConditionChange('selectedOption', e.target.value)}
              className="conditional-logic-editor__select"
            >
              <option value="">-- Select Option --</option>
              {selectedBaseQuestion.options.map((opt, idx) => (
                <option key={idx} value={typeof opt === 'string' ? opt : opt.text}>
                  {typeof opt === 'string' ? opt : opt.text}
                </option>
              ))}
            </select>
          </div>
        );
      case 'multi-choice':
        return (
          <div className="conditional-logic-editor__condition-group">
            <label className="conditional-logic-editor__condition-label">
              If options selected are:
            </label>
            <div className="conditional-logic-editor__checkbox-group">
              {(selectedBaseQuestion.options || []).map((opt, idx) => (
                <label key={idx} className="conditional-logic-editor__checkbox-label">
                  <input
                    type="checkbox"
                    value={typeof opt === 'string' ? opt : opt.text}
                    checked={(conditionConfig.selectedOptions || []).includes(typeof opt === 'string' ? opt : opt.text)}
                    onChange={(e) => {
                      const optValue = typeof opt === 'string' ? opt : opt.text;
                      const currentSelected = conditionConfig.selectedOptions || [];
                      if (e.target.checked) {
                        handleConditionChange('selectedOptions', [...currentSelected, optValue]);
                      } else {
                        handleConditionChange('selectedOptions', currentSelected.filter((o) => o !== optValue));
                      }
                    }}
                  />
                  {typeof opt === 'string' ? opt : opt.text}
                </label>
              ))}
            </div>
            <div className="conditional-logic-editor__radio-group">
              <label className="conditional-logic-editor__radio-label">
                <input
                  type="radio"
                  name="matchType"
                  value="any"
                  checked={(conditionConfig.matchType || 'any') === 'any'}
                  onChange={(e) => handleConditionChange('matchType', e.target.value)}
                />
                Match ANY of the selected options
              </label>
              <label className="conditional-logic-editor__radio-label">
                <input
                  type="radio"
                  name="matchType"
                  value="all"
                  checked={conditionConfig.matchType === 'all'}
                  onChange={(e) => handleConditionChange('matchType', e.target.value)}
                />
                Match ALL of the selected options
              </label>
            </div>
          </div>
        );
      case 'nps':
      case 'rating': // slider
      case 'star-rating':
      case 'numerical-input':
        let minVal, maxVal, stepVal = 1;
        let valueLabel = 'Value';
        
        if (selectedBaseQuestion.type === 'nps') {
            minVal = 0; maxVal = 10;
            valueLabel = 'NPS Score';
        } else if (selectedBaseQuestion.type === 'star-rating') {
            minVal = selectedBaseQuestion.rating_start || 1;
            maxVal = selectedBaseQuestion.rating_end || 5;
            valueLabel = 'Star Rating';
        } else if (selectedBaseQuestion.type === 'rating') { // slider
            minVal = selectedBaseQuestion.rating_start !== undefined ? selectedBaseQuestion.rating_start : undefined;
            maxVal = selectedBaseQuestion.rating_end !== undefined ? selectedBaseQuestion.rating_end : undefined;
            stepVal = selectedBaseQuestion.rating_step || 1;
            valueLabel = 'Slider Value';
        } else {
            valueLabel = 'Numerical Value';
        }
        // Numerical input might have its own min/max from questionData.min_value/max_value
        if (selectedBaseQuestion.type === 'numerical-input') {
            minVal = selectedBaseQuestion.min_value !== undefined ? selectedBaseQuestion.min_value : undefined;
            maxVal = selectedBaseQuestion.max_value !== undefined ? selectedBaseQuestion.max_value : undefined;
        }

        return (
          <div className="conditional-logic-editor__condition-group">
            <label htmlFor="numericalOperator" className="conditional-logic-editor__condition-label">
              If {valueLabel} is:
            </label>
            <div className="conditional-logic-editor__numerical-row">
              <select
                id="numericalOperator"
                value={conditionConfig.operator || 'eq'}
                onChange={(e) => handleConditionChange('operator', e.target.value)}
                className="conditional-logic-editor__select conditional-logic-editor__select--operator"
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater than or equal to (&ge;)</option>
                <option value="eq">Equal to (=)</option>
                <option value="lte">Less than or equal to (&le;)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="neq">Not equal to (≠)</option>
              </select>
              <input
                type="number"
                value={conditionConfig.value || ''}
                onChange={(e) => handleConditionChange('value', e.target.value)}
                className="conditional-logic-editor__input conditional-logic-editor__input--number"
                min={minVal}
                max={maxVal}
                step={stepVal}
                placeholder={valueLabel}
              />
            </div>
            {(minVal !== undefined || maxVal !== undefined) && (
              <div className="conditional-logic-editor__range-hint">
                {minVal !== undefined && maxVal !== undefined ? 
                  `Valid range: ${minVal} to ${maxVal}` : 
                  minVal !== undefined ? 
                    `Minimum value: ${minVal}` : 
                    `Maximum value: ${maxVal}`}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="conditional-logic-editor__error">
            Unsupported question type: {selectedBaseQuestion.type}
          </div>
        );
    }
  };

  const renderConditionSummary = () => {
    if (!selectedBaseQuestion) return null;

    let summary = '';
    switch (selectedBaseQuestion.type) {
      case 'single-choice':
        if (!conditionConfig.selectedOption) return null;
        const questionText = selectedBaseQuestion.question_text || selectedBaseQuestion.text || '';
        summary = `Show this question when "${questionText.substring(0, 30)}${questionText.length > 30 ? '...' : ''}" has answer "${conditionConfig.selectedOption}"`;
        break;
      case 'multi-choice':
        if (!conditionConfig.selectedOptions?.length) return null;
        const options = conditionConfig.selectedOptions.join('", "');
        const matchType = conditionConfig.matchType === 'all' ? 'ALL of' : 'ANY of';
        const questionTextMulti = selectedBaseQuestion.question_text || selectedBaseQuestion.text || '';
        summary = `Show this question when "${questionTextMulti.substring(0, 30)}${questionTextMulti.length > 30 ? '...' : ''}" has ${matchType} options "${options}" selected`;
        break;
      case 'nps':
      case 'rating':
      case 'star-rating':
      case 'numerical-input':
        if (!conditionConfig.operator || conditionConfig.value === undefined) return null;
        const opMap = { gt: '>', gte: '≥', eq: '=', lte: '≤', lt: '<', neq: '≠' };
        const questionTextNum = selectedBaseQuestion.question_text || selectedBaseQuestion.text || '';
        summary = `Show this question when "${questionTextNum.substring(0, 30)}${questionTextNum.length > 30 ? '...' : ''}" has value ${opMap[conditionConfig.operator]} ${conditionConfig.value}`;
        break;
      default:
        return null;
    }
    
    return (
      <div className="conditional-logic-editor__summary">
        <h4>Preview:</h4>
        <p>{summary}</p>
      </div>
    );
  };

  return (
    <div className="conditional-logic-editor">
      <h3 className="conditional-logic-editor__title">Conditional Logic</h3>
      <div className="conditional-logic-editor__rule">
        <span className="conditional-logic-editor__static-text">Show this question IF</span>
        <select
          value={baseQuestionSequence}
          onChange={handleBaseQuestionChange}
          className="conditional-logic-editor__select"
        >
          <option value="">-- Select a Question --</option>
          {availableBaseQuestions.map((q) => (
            <option key={q.sequence_number} value={(q.original_sequence_number || q.sequence_number).toString()}>
              Q{q.original_sequence_number || q.sequence_number}: {(q.question_text || q.text || 'Untitled Question').substring(0, 50)}...
            </option>
          ))}
        </select>
      </div>

      <div className="conditional-logic-editor__conditions">
        {renderConditionFields()}
      </div>

      {renderConditionSummary()}

      {validationError && (
        <div className="conditional-logic-editor__error">
          {validationError}
        </div>
      )}

      <div className="conditional-logic-editor__actions">
        {existingLogic && (
          <button
            type="button"
            onClick={handleClearLogic}
            className="conditional-logic-editor__btn conditional-logic-editor__btn--clear"
          >
            Clear Logic
          </button>
        )}
        <button
          type="button"
          onClick={onCancelLogic}
          className="conditional-logic-editor__btn conditional-logic-editor__btn--cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ConditionalLogicEditor;