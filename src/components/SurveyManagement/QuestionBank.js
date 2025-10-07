import React, { useState, useEffect } from 'react';
import { questionBankAPI } from 'services/apiClient';
import "../../styles/QuestionBank.css";

const QuestionBank = ({ onCopyQuestion, customStyles, renderButtons }) => {
  const [bankQuestions, setBankQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Define available question types
  const questionTypes = [
    { id: 'all', label: 'All' },
    { id: 'multiple-choice', label: 'Multiple Choice' },
    { id: 'single-choice', label: 'Single Choice' },
    { id: 'open-ended', label: 'Open Ended' }
  ];

  const fetchBankQuestions = async () => {
    try {
      setLoading(true);
      const response = await questionBankAPI.getAll();
      
      const data = response.data;
      console.log("Fetched bank questions:", data); // Debug log
      setBankQuestions(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching question library:', error);
      setLoading(false);
    }
  };

  const removeFromBank = async (questionId) => {
    try {
      const response = await questionBankAPI.deleteQuestion(questionId);
      fetchBankQuestions();
    } catch (error) {
      console.error('Error removing from bank:', error);
    }
  };

  useEffect(() => {
    // Fetch bank questions on mount
    fetchBankQuestions();
  }, []);

  // Function to get the question type icon
  const getQuestionTypeIcon = (type) => {
    switch (type) {
      case 'single-choice':
        return 'ri-radio-button-line';
      case 'multi-choice':
        return 'ri-checkbox-multiple-line';
      case 'open-ended':
        return 'ri-text-line';
      case 'rating':
        return 'ri-star-line';
      case 'nps':
        return 'ri-scales-line';
      default:
        return 'ri-question-line';
    }
  };

  // Filter questions based on type and search query
  const filteredQuestions = bankQuestions.filter(question => {
    if (!question) return false;
    const matchesType = activeFilter === 'all' || question.question_type === activeFilter;
    const matchesSearch = (question.question_text || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="question-bank-container">
      {/* Search bar */}
      <input
        type="text"
        placeholder="Search questions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="search-bar"
      />

      {/* Filter buttons */}
      <div className="filter-buttons-container">
        {questionTypes.map(type => (
          <button
            key={type.id}
            onClick={() => setActiveFilter(type.id)}
            className={`filter-button ${activeFilter === type.id ? 'active' : ''}`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Refresh button */}
      <button 
        onClick={fetchBankQuestions} 
        className="refresh-button"
      >
        <i className="ri-refresh-line"></i>
        Refresh Question Library
      </button>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          Loading questions...
        </div>
      ) : filteredQuestions.length > 0 ? (
        <div>
          {filteredQuestions.map((question) => (
            <div key={question.id} className="question-item">
              <div className="question-text">
                {question.question_text}
              </div>
              <div className="question-type">
                <i className={`${getQuestionTypeIcon(question.question_type)} question-type-icon`}></i>
                {(question.question_type || 'text')
                  .charAt(0)
                  .toUpperCase() + 
                  (question.question_type || 'text')
                    .slice(1)
                    .replace('-', ' ')}
              </div>
              
              {/* If custom renderButtons is provided, use it and pass the removeFromBank function */}
              {renderButtons ? (
                renderButtons(question, removeFromBank)
              ) : (
                <div className="buttons-container">
                  <button 
                    onClick={() => onCopyQuestion(question)} 
                    className="copy-button"
                  >
                    <i className="ri-file-copy-line"></i> Copy to Survey
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to remove this question from the library?')) {
                        removeFromBank(question.id);
                      }
                    }} 
                    className="remove-button"
                  >
                    <i className="ri-delete-bin-line"></i> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="ri-question-answer-line empty-state-icon"></i>
          <p className="empty-state-text">
            No questions found in the library. Add questions using the "Add to Library" button.
          </p>
          <div className="empty-state-info">
            <i className="ri-information-line"></i>
            Save questions to reuse them in multiple surveys.
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
