// WordCloudViewer.js
import React, { useState, useEffect, useRef } from 'react';
import ReactWordcloud from 'react-wordcloud';
import './GridAnalytics.css';
import { analyticsAPI, surveyAPI } from 'services/apiClient';

const WordCloudViewer = ({ surveyId, questionId }) => {
  const [responses, setResponses] = useState([]);
  const [wordCloudData, setWordCloudData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPdfMode, setIsPdfMode] = useState(false);
  const rootRef = useRef(null);
  
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    // Detect if rendered inside a PDF card clone
    try {
      const el = rootRef.current;
      if (el) {
        let p = el.parentElement;
        let found = false;
        let guard = 0;
        while (p && guard < 20) {
          if (p.classList && p.classList.contains('pdf-card')) { found = true; break; }
          p = p.parentElement; guard++;
        }
        setIsPdfMode(found);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const fetchOpenEndedData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Use the enhanced endpoint for open-ended responses
        const response = await surveyAPI.getOpenEndedWithUsers(surveyId, questionId);
        
        
        
        const data = response.data;
        console.log('Open-ended data:', data);
        
        if (data.responses) {
          // Limit responses to 5 most recent
          const limitedResponses = data.responses.slice(0, 5);
          setResponses(limitedResponses);
        }
        
        if (data.word_cloud_data) {
          // Process word cloud data to ensure proper format
          const processedData = data.word_cloud_data.map(item => ({
            text: item.text || '',
            value: item.value || 0
          })).filter(item => item.text && item.value > 0);
          
          setWordCloudData(processedData);
        }
      } catch (err) {
        console.error('Error fetching open-ended responses:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (surveyId && questionId) {
      fetchOpenEndedData();
    }
  }, [surveyId, questionId, token]);

  const formatResponseText = (text, wordsPerLine = 8) => {
    if (!text || typeof text !== 'string') return '';
    const words = text.trim().split(/\s+/);
    const lines = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }
    return lines.join('\n');
  };

  const wordcloudOptions = {
    rotations: 2,
    rotationAngles: [0, 90],
    fontSizes: [15, 60],
    fontFamily: 'Arial',
    colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
    enableTooltip: true,
    deterministic: true,
    padding: 2,
    fontWeight: 'bold',
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        Loading open-ended responses...
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded">
        <p>Error: {error}</p>
      </div>
    );
  }
  
  if (wordCloudData.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500" style={{color: '#000'}}>
        No word cloud data available for this question.
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-4">Word Cloud Analysis</h4>
        <div style={{
          height: isPdfMode ? '200px' : '260px',
          maxHeight: isPdfMode ? '200px' : '260px',
          width: isPdfMode ? '70%' : '100%',
          overflow: 'hidden',
          margin: isPdfMode ? '0' : undefined,
          textAlign: isPdfMode ? 'left' : 'center'
        }}>
          <ReactWordcloud words={wordCloudData} options={wordcloudOptions} />
        </div>
      </div>
      
      <div className="mt-6">
        <h4 className="text-lg font-medium mb-4">Recent Responses</h4>
        {responses.length > 0 ? (
          <div className="space-y-4">
            {responses.map((response, index) => (
              <div key={index} className="p-4 border rounded bg-gray-50">
                <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                  {formatResponseText(response.response_text, 8)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">No responses available.</p>
        )}
      </div>
    </div>
  );
};

export default WordCloudViewer;