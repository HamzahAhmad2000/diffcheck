import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/ChartDisplay.css';

// Reusable chart display component that can be used independently
const ChartDisplay = ({ surveyId, questionId, chartType = 'bar', height = '400px' }) => {
  const [imgUrl, setImgUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);

  // Fetch chart image
  useEffect(() => {
    if (!surveyId || !questionId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Fetch chart image
    axios.get(`/api/surveys/${surveyId}/questions/${questionId}/chart?type=${chartType}`, { responseType: 'blob' })
      .then(response => {
        const url = URL.createObjectURL(response.data);
        setImgUrl(url);
      })
      .catch(err => {
        console.error('Error fetching chart:', err);
        setError('Error loading chart visualization.');
      })
      .finally(() => setIsLoading(false));
      
    // Fetch question details to show title
    axios.get(`/surveys/${surveyId}`)
      .then(response => {
        const question = response.data.questions.find(q => q.id === questionId);
        if (question) {
          setQuestionDetails(question);
        }
      })
      .catch(err => {
        console.error('Error fetching question details:', err);
      });
      
    // Clean up URL object on unmount
    return () => {
      if (imgUrl) {
        URL.revokeObjectURL(imgUrl);
      }
    };
  }, [surveyId, questionId, chartType]);

  // Handle different chart types for different question types
  const getChartTypeEndpoint = () => {
    // If question type is known, return specific endpoint
    if (questionDetails) {
      if (questionDetails.question_type === 'open-ended') {
        return `/api/surveys/${surveyId}/questions/${questionId}/wordcloud`;
      } else if (['radio-grid', 'checkbox-grid', 'star-rating-grid'].includes(questionDetails.question_type)) {
        return `/api/surveys/${surveyId}/questions/${questionId}/grid-chart`;
      } else if (['rating-scale', 'nps', 'numerical-input'].includes(questionDetails.question_type)) {
        return `/api/surveys/${surveyId}/questions/${questionId}/statistics`;
      }
    }
    
    // Default to standard chart
    return `/api/surveys/${surveyId}/questions/${questionId}/chart?type=${chartType}`;
  };

  const handleDownload = () => {
    if (imgUrl) {
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = `chart-${questionId}-${chartType}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return <div className="chart-loading">Loading chart...</div>;
  }

  if (error) {
    return <div className="chart-error">{error}</div>;
  }

  return (
    <div className="chart-display">
      <div className="chart-header">
        <h3>{questionDetails ? questionDetails.question_text : `Chart for Question ${questionId}`}</h3>
        <div className="chart-controls">
          <button onClick={handleDownload} className="download-button">
            Download Chart
          </button>
        </div>
      </div>
      
      <div className="chart-container" style={{ height }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`Chart for question ${questionId}`}
            className="chart-image"
            onError={() => setError('Failed to load chart image.')}
          />
        ) : (
          <div className="chart-placeholder">No chart available</div>
        )}
      </div>
      
      <div className="chart-footer">
        <p>Chart Type: {chartType}</p>
        {questionDetails && (
          <p>Question Type: {questionDetails.question_type}</p>
        )}
      </div>
    </div>
  );
};

export default ChartDisplay;