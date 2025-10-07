// components/Analytics/AIFilterAnalytics.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import aiService from '../../services/aiService';
import { baseURL } from '../../services/apiClient';

const AIFilterAnalytics = () => {
  const { surveyId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [filterOptions, setFilterOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [filteredData, setFilteredData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load survey questions for filtering
  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const response = await fetch(`${baseURL}/surveys/${surveyId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch survey');
        }
        const data = await response.json();
        // Filter for questions that can be used for filtering (multiple choice, dropdown, etc.)
        const filterable = data.questions.filter(q => 
          ['multiple-choice', 'dropdown', 'checkbox', 'radio-grid'].includes(q.question_type)
        );
        setQuestions(filterable);
      } catch (err) {
        setError('Error loading survey questions');
        console.error(err);
      }
    };
    
    fetchSurvey();
  }, [surveyId]);
  
  // When a question is selected, load its options
  useEffect(() => {
    if (!selectedQuestion) {
      setFilterOptions([]);
      return;
    }
    
    const question = questions.find(q => q.sequence_number === parseInt(selectedQuestion));
    if (question) {
      if (question.options) {
        setFilterOptions(question.options);
      } else if (question.grid_columns) {
        setFilterOptions(question.grid_columns);
      } else {
        setFilterOptions([]);
      }
    }
  }, [selectedQuestion, questions]);
  
  const handleFilterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQuestion || !selectedOption) {
      setError('Please select both a question and an option for filtering');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${baseURL}/responses/analytics/filtered?survey_id=${surveyId}&filter_question_seq=${selectedQuestion}&filter_option=${selectedOption}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch filtered analytics');
      }
      
      const data = await response.json();
      setFilteredData(data);
      
      // Now get AI insights on this filtered data
      try {
        const aiResponse = await aiService.converseSummary(
          surveyId,
          `Analyze the data filtered by question #${selectedQuestion} with option "${selectedOption}". What unique insights can you provide about this segment?`
        );
        
        if (aiResponse && aiResponse.conversation_response) {
          setFilteredData(prev => ({
            ...prev,
            ai_insights: aiResponse.conversation_response
          }));
        }
      } catch (aiErr) {
        console.error('Error getting AI insights:', aiErr);
        // Don't block the main data flow if AI insights fail
      }
      
    } catch (err) {
      setError('Error loading filtered analytics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div style={styles.container}>
      <h2>AI Filter Analytics</h2>
      
      <div style={styles.filterSection}>
        <form onSubmit={handleFilterSubmit}>
          <div style={styles.formGroup}>
            <label>Filter by Question:</label>
            <select 
              value={selectedQuestion} 
              onChange={(e) => setSelectedQuestion(e.target.value)}
              style={styles.select}
            >
              <option value="">Select a question...</option>
              {questions.map(q => (
                <option key={q.id} value={q.sequence_number}>
                  Q{q.sequence_number}: {q.question_text}
                </option>
              ))}
            </select>
          </div>
          
          <div style={styles.formGroup}>
            <label>Select Option:</label>
            <select 
              value={selectedOption} 
              onChange={(e) => setSelectedOption(e.target.value)}
              style={styles.select}
              disabled={!selectedQuestion || filterOptions.length === 0}
            >
              <option value="">Select an option...</option>
              {filterOptions.map((opt, index) => (
                <option key={index} value={opt.text}>
                  {opt.text}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            type="submit" 
            style={styles.button}
            disabled={!selectedQuestion || !selectedOption || isLoading}
          >
            {isLoading ? 'Loading...' : 'Apply Filter'}
          </button>
        </form>
        
        {error && <div style={styles.error}>{error}</div>}
      </div>
      
      {filteredData && (
        <div style={styles.resultsSection}>
          <h3>Filtered Results</h3>
          
          {filteredData.ai_insights && (
            <div style={styles.aiInsights}>
              <h4>AI Insights</h4>
              <div style={styles.aiText}>
                {filteredData.ai_insights.split('\n').map((paragraph, i) => (
                  paragraph ? <p key={i}>{paragraph}</p> : <br key={i} />
                ))}
              </div>
            </div>
          )}
          
          <div style={styles.stats}>
            <div style={styles.statCard}>
              <h4>Total Responses</h4>
              <p>{filteredData.total_responses}</p>
            </div>
            
            {filteredData.average_time && (
              <div style={styles.statCard}>
                <h4>Average Time</h4>
                <p>{Math.round(filteredData.average_time)} seconds</p>
              </div>
            )}
          </div>
          
          {filteredData.mcq_stats && Object.keys(filteredData.mcq_stats).length > 0 && (
            <div style={styles.mcqStats}>
              <h4>Multiple Choice Questions</h4>
              {Object.values(filteredData.mcq_stats).map((stat, i) => (
                <div key={i} style={styles.statItem}>
                  <h5>{stat.question_text}</h5>
                  <p>Most selected: {stat.most_selected}</p>
                  <p>Least selected: {stat.least_selected}</p>
                </div>
              ))}
            </div>
          )}
          
          {filteredData.numerical_stats && Object.keys(filteredData.numerical_stats).length > 0 && (
            <div style={styles.numericalStats}>
              <h4>Numerical Questions</h4>
              {Object.values(filteredData.numerical_stats).map((stat, i) => (
                <div key={i} style={styles.statItem}>
                  <h5>{stat.question_text}</h5>
                  <p>Mean: {stat.mean.toFixed(2)}</p>
                  <p>Median: {stat.median}</p>
                  {stat.mode !== null && <p>Mode: {stat.mode}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  filterSection: {
    backgroundColor: '#f5f5f5',
    padding: '20px',
    borderRadius: '5px',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#6200EA',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  error: {
    color: 'red',
    marginTop: '10px',
  },
  resultsSection: {
    marginTop: '30px',
  },
  aiInsights: {
    backgroundColor: '#f0f7ff',
    padding: '15px',
    borderRadius: '5px',
    marginBottom: '20px',
    border: '1px solid #d0e3ff',
  },
  aiText: {
    lineHeight: '1.5',
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '20px',
  },
  statCard: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '5px',
    border: '1px solid #eee',
    minWidth: '150px',
    textAlign: 'center',
  },
  mcqStats: {
    marginBottom: '20px',
  },
  numericalStats: {
    marginBottom: '20px',
  },
  statItem: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '5px',
    marginBottom: '10px',
    border: '1px solid #eee',
  },
};

export default AIFilterAnalytics;