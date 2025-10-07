import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './SecurityQuestionsTable.css';

/**
 * SecurityQuestionsTable - A reusable security questions management component
 * Extracted from UserEditProfile.js security questions section
 */
const SecurityQuestionsTable = ({ 
  availableQuestions = [],
  onSave,
  loading = false,
  title = "Security Questions",
  subtitle = "Set up security questions for account recovery. Choose 2 questions.",
  saveButtonText = "Save Security Questions",
  variant = "default",
  className = "",
  maxQuestions = 2,
  ...props 
}) => {
  const [userSecurityQuestions, setUserSecurityQuestions] = useState(
    Array(maxQuestions).fill(null).map(() => ({ question_id: '', answer: '' }))
  );

  const handleSecurityQuestionChange = (index, field, value) => {
    const updatedQuestions = [...userSecurityQuestions];
    updatedQuestions[index][field] = value;
    setUserSecurityQuestions(updatedQuestions);
  };

  const handleSubmit = async () => {
    const questionsToSet = userSecurityQuestions.filter(q => q.question_id && q.answer);
    if (questionsToSet.length < maxQuestions) {
      return { 
        success: false, 
        error: `Please select at least ${maxQuestions} questions and provide answers.` 
      };
    }
    
    if (onSave) {
      return await onSave(questionsToSet);
    }
    
    return { success: true };
  };

  const getTableClass = () => {
    let classes = `security-questions-table security-questions-table--${variant}`;
    if (className) classes += ` ${className}`;
    return classes;
  };

  return (
    <div className={getTableClass()} {...props}>
      <div className="security-questions-table__header">
        <h2 className="security-questions-table__title">{title}</h2>
        {subtitle && (
          <p className="security-questions-table__subtitle">{subtitle}</p>
        )}
      </div>
      
      <div className="security-questions-table__content">
        <div className="security-questions-table__grid">
          {userSecurityQuestions.map((sq, index) => (
            <div key={index} className="security-questions-table__row">
              <div className="security-questions-table__question-group">
                <label 
                  htmlFor={`question-${index}`}
                  className="security-questions-table__label"
                >
                  Question {index + 1}
                </label>
                <select 
                  id={`question-${index}`} 
                  value={sq.question_id} 
                  onChange={(e) => handleSecurityQuestionChange(index, 'question_id', e.target.value)} 
                  className="security-questions-table__select"
                  required
                  disabled={loading}
                >
                  <option value="">Select a question</option>
                  {availableQuestions.map(q => (
                    <option key={q.id} value={q.id}>{q.question}</option>
                  ))}
                </select>
              </div>
              
              <div className="security-questions-table__answer-group">
                <label 
                  htmlFor={`answer-${index}`}
                  className="security-questions-table__label"
                >
                  Answer {index + 1}
                </label>
                <input 
                  type="password"
                  id={`answer-${index}`} 
                  value={sq.answer} 
                  onChange={(e) => handleSecurityQuestionChange(index, 'answer', e.target.value)} 
                  placeholder="Enter your answer"
                  className="security-questions-table__input"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="security-questions-table__actions">
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={loading} 
            className="security-questions-table__button security-questions-table__button--primary"
          >
            {loading ? 'Saving Questions...' : saveButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

SecurityQuestionsTable.propTypes = {
  availableQuestions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    question: PropTypes.string.isRequired
  })).isRequired,
  onSave: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  saveButtonText: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'compact', 'card']),
  className: PropTypes.string,
  maxQuestions: PropTypes.number
};

export default SecurityQuestionsTable;
