import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../common/Sidebar'; // Assuming you have a Sidebar component
import { surveyAPI, businessAPI } from '../../services/apiClient'; // To fetch surveys
import { aiService } from '../../services/aiService';   // To call the new AI generation service
import { useBusiness } from '../../services/BusinessContext';

import '../../styles/fonts.css'; // Common fonts
import './AITestDataGenerator.css'; // Specific styles for this page

const AITestDataGenerator = () => {
  const navigate = useNavigate();

  // Get business context for AI points and permissions - safely handle null context
  const businessContext = useBusiness();
  const { 
    business = null, 
    aiPoints = 0, 
    hasPermission = () => false, 
    canUseAIFeature = () => false, 
    isSuperAdmin = false, 
    isBusinessAdmin = false 
  } = businessContext || {};

  const [allSurveys, setAllSurveys] = useState([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [numResponses, setNumResponses] = useState(10); // Default to 10 responses

  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch surveys based on user role on component mount
  useEffect(() => {
    const fetchSurveys = async () => {
      if (isBusinessAdmin && !isSuperAdmin && !business?.id) {
        return; // Wait for business context to load for business admin
      }

      setIsLoadingSurveys(true);
      try {
        let response;
        
        if (isSuperAdmin) {
          // Super admin can see all surveys
          response = await surveyAPI.getAll();
        } else if (isBusinessAdmin && business?.id) {
          // Business admin can only see their business surveys
          response = await businessAPI.getSurveysForBusiness(business.id);
        } else {
          throw new Error('Access denied: insufficient permissions');
        }

        let surveyList = [];
        
        // Handle different response structures
        if (response.data && Array.isArray(response.data.surveys)) {
          // Super admin response format: { surveys: [...] }
          surveyList = response.data.surveys;
        } else if (response.data && Array.isArray(response.data)) {
          // Alternative response format: [...]
          surveyList = response.data;
        } else {
          console.error('Could not load surveys. Unexpected data format:', response.data);
          toast.error('Could not load surveys. Unexpected data format.');
        }
        
        setAllSurveys(surveyList.filter(survey => !survey.is_archived)); // Filter out archived surveys
      } catch (error) {
        console.error('Error fetching surveys:', error);
        toast.error(error.message || 'Failed to load surveys.');
        setAllSurveys([]);
      } finally {
        setIsLoadingSurveys(false);
      }
    };

    fetchSurveys();
  }, [isSuperAdmin, isBusinessAdmin, business?.id]);

  const handleSurveyChange = (e) => {
    setSelectedSurveyId(e.target.value);
  };

  const handleNumResponsesChange = (e) => {
    const value = parseInt(e.target.value, 10);
    const maxAllowed = isSuperAdmin ? 100 : aiPoints; // Super admin can generate up to 100, business admin limited by points
    
    if (value > 0 && value <= maxAllowed) {
      setNumResponses(value);
    } else if (e.target.value === '') {
      setNumResponses(''); // Allow clearing the input
    } else if (value > maxAllowed) {
      setNumResponses(maxAllowed);
      if (!isSuperAdmin) {
        toast.warning(`You only have ${aiPoints} AI points available.`);
      }
    }
  };

  // Helper to decide if current user can generate given numResponses
  const canGenerateResponses = () => {
    if (isSuperAdmin) return true;
    if (!isBusinessAdmin) return false;

    return canUseAIFeature('CAN_GENERATE_RESPONSES', numResponses);
  };

  const handleSubmitGeneration = async () => {
    if (!selectedSurveyId) {
      toast.error('Please select a survey.');
      return;
    }
    if (!numResponses || numResponses <= 0) {
      toast.error('Please enter a valid number of responses to generate (must be > 0).');
      return;
    }

    if (!canGenerateResponses()) {
      if (!isSuperAdmin) {
        if (aiPoints < numResponses) {
          toast.error(`Insufficient AI points. You have ${aiPoints} points but need ${numResponses}.`);
        } else {
          toast.error('Your business does not have permission to generate AI responses.');
        }
      }
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(`AI is generating ${numResponses} responses for survey ID ${selectedSurveyId}... This may take a while.`);

    try {
      const response = await aiService.autoGenerateSurveyResponses(selectedSurveyId, numResponses);
      // The backend returns a response object with message, successful_submissions, failed_submissions
      if (response.data) {
        const { message, successful_submissions, failed_submissions, details } = response.data;
        toast.success(
          `Generation complete! ${successful_submissions || 0} successful, ${failed_submissions || 0} failed. ${message || ''}`,
          { id: toastId, duration: 6000 }
        );
        console.log("Generation details:", details); // Log details for debugging
        // Optionally, you could display these details in the UI
      } else {
        toast.error('AI response generation completed, but no clear status was returned.', { id: toastId });
      }
    } catch (error) {
      console.error('Error during AI response generation:', error);
      toast.error(error.message || 'Failed to generate AI responses.', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content3 ai-test-generator-page"> {/* Added specific page class */}
        <div className="ai-test-generator-container">
          <div className="generator-card">
            <div className="generator-header">
              <h1 className="generator-title">AI Survey Response Generator</h1>
              <p className="generator-subtitle">
                Select a survey and specify how many unique responses you want the AI to generate and submit.
                This is useful for testing survey flows and populating analytics with sample data.
              </p>
              
              {/* AI Points Display for Business Admin only */}
              {isBusinessAdmin && !isSuperAdmin && (
                <div className="ai-points-display">
                  <div className="points-info">
                    <i className="ri-cpu-line"></i>
                    <span>Available AI Points: <strong>{aiPoints}</strong></span>
                    {aiPoints < 10 && (
                      <button 
                        className="buy-points-btn-small"
                        onClick={() => navigate('/business/purchase-points')}
                      >
                        Buy More
                      </button>
                    )}
                  </div>
                  <small className="points-note">
                    Each response generation costs 1 AI point. You can generate up to {aiPoints} responses.
                  </small>
                </div>
              )}
              
              {/* Super Admin Notice */}
              {isSuperAdmin && (
                <div className="ai-points-display">
                  <div className="points-info">
                    <i className="ri-vip-crown-line"></i>
                    <span>Super Admin: <strong>Unlimited AI Access</strong></span>
                  </div>
                  <small className="points-note">
                    As a super admin, you have unlimited access to AI response generation (up to 100 per batch).
                  </small>
                </div>
              )}
            </div>

            <div className="generator-form">
              <div className="newform-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="survey-select" className="newform-label">
                  <i className="ri-list-check-2"></i> Select Survey:
                </label>
                {isLoadingSurveys ? (
                  <p className="loading-text">Loading surveys...</p>
                ) : (
                  <select
                    id="survey-select"
                    value={selectedSurveyId}
                    onChange={handleSurveyChange}
                    disabled={isGenerating || allSurveys.length === 0}
                    className="newform-select"
                  >
                    <option value="">-- Select a Survey --</option>
                    {allSurveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title} (ID: {survey.id})
                      </option>
                    ))}
                  </select>
                )}
                {allSurveys.length === 0 && !isLoadingSurveys && (
                  <p className="info-text">No active surveys found. Please create a survey first.</p>
                )}
              </div>

              <div className="newform-group">
                <label htmlFor="num-responses" className="form-label">
                  <i className="ri-numbers-line"></i> Number of Responses to Generate:
                </label>
                <input
                  type="number"
                  id="num-responses"
                  value={numResponses}
                  onChange={handleNumResponsesChange}
                  min="1"
                  max={isSuperAdmin ? 100 : aiPoints} // Super admin can generate up to 100, business admin limited by points
                  disabled={isGenerating}
                  className="form-input-number"
                  placeholder="e.g., 10"
                />
                {isBusinessAdmin && !isSuperAdmin && numResponses > aiPoints && (
                  <p className="error-text">You only have {aiPoints} AI points available.</p>
                )}
              </div>

              <div className="newform-actions">
                <button
                  onClick={handleSubmitGeneration}
                  disabled={
                    !selectedSurveyId || 
                    !numResponses || 
                    numResponses <= 0 || 
                    isGenerating ||
                    !canGenerateResponses()
                  }
                  className={`generator-button ${isGenerating || !canGenerateResponses() ? 'disabled' : ''}`}
                >
                  {isGenerating ? (
                    <>
                      <i className="ri-loader-4-line spinning"></i> Generating Responses...
                    </>
                  ) : (
                    <>
                      <i className="ri-robot-line"></i> Generate & Submit AI Responses
                    </>
                  )}
                </button>
              </div>
            </div>
            {isGenerating && (
                 <div className="generation-progress-notice">
                    <i className="ri-time-line"></i>
                    <span>AI response generation is in progress. You can navigate away; the process will continue in the background. Check server logs for detailed progress.</span>
                </div>
            )}
          </div>

          <div className="tip-card-generator"> {/* Unique class for tips on this page */}
            <div className="tip-header">
              <i className="ri-lightbulb-flash-line"></i>
              <span>How it Works & Tips</span>
            </div>
            <ul className="tip-list">
              <li className="tip-item">
                <i className="ri-sound-module-line"></i>
                The AI analyzes the selected survey's questions (type, options, constraints).
              </li>
              <li className="tip-item">
                <i className="ri-user-voice-line"></i>
                It simulates diverse respondents to generate realistic, varied answers for each question.
              </li>
              <li className="tip-item">
                <i className="ri-send-plane-2-line"></i>
                Each complete set of answers is submitted as a new response to your survey's backend.
              </li>
              <li className="tip-item">
                <i className="ri-scales-3-line"></i>
                Start with a small number of responses (e.g., 5-10) to test, then increase if needed. Large numbers can take time.
              </li>
              <li className="tip-item">
                <i className="ri-shield-check-line"></i>
                Ensure your survey is saved and has questions before generating responses.
              </li>
               <li className="tip-item">
                <i className="ri-bar-chart-grouped-line"></i>
                Generated data will appear in your survey analytics and response exports.
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AITestDataGenerator; 