// AIChat.js with enhanced debugging and new thread creation
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import aiService from '../../services/aiService';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import apiClient, { surveyAPI, questionBankAPI, uploadAPI, aiAPI, analyticsAPI } from "../../services/apiClient";
import { toast } from 'react-hot-toast';
import { baseURL } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';

import '../../styles/AIChat.css';

const AIChat = () => {
  const navigate = useNavigate();
  const location = useLocation(); // To get state passed from navigation
  
  // Get business context for AI points and permissions - safely handle null context
  const businessContext = useBusiness();
  
  // businessId and businessName might come from route state if navigating from a business-specific context
  const { businessId, businessName } = location.state || {};
  
  const [messages, setMessages] = useState([{ 
    role: 'assistant', 
    content: `Hello! I can help you create a survey${businessName ? ` for ${businessName}` : ''}. What kind of survey would you like to make?` 
  }]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [loadingText, setLoadingText] = useState("Thinking...");
  const messagesEndRef = useRef(null);

  // Log component mount and initialization
  useEffect(() => {
    console.log('[AI DEBUG] AIChat component mounted');
    console.log('[AI DEBUG] Initial question count:', questionCount);
    
    // Create a new thread when the component mounts
    const initializeNewThread = async () => {
      try {
        console.log('[AI DEBUG] Initializing new chat thread');
        
        // Call the backend to create a new thread
        const response = await fetch(`${baseURL}/api/ai/create_new_chat_thread`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          console.error('[AI DEBUG] Failed to create new thread:', response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log('[AI DEBUG] New thread created:', data);
        
        // Reset the question count
        setQuestionCount(0);
      } catch (error) {
        console.error('[AI DEBUG] Error creating new thread:', error);
      }
    };
    
    initializeNewThread();
    
    return () => {
      console.log('[AI DEBUG] AIChat component unmounted');
    };
  }, []);

// --- Updated useEffect for initialization ---
useEffect(() => {
  console.log('[AI DEBUG] AIChat component mounted');
  console.log('[AI DEBUG] Initial question count:', questionCount);

  const initializeNewThread = async () => {
    setIsLoading(true); // Indicate loading during initialization
    setLoadingText("Initializing...");
    try {
      console.log('[AI DEBUG] Initializing new chat thread via aiService');
      const response = await aiService.createNewChatThread(); // Use aiService
      const data = response.data; // Access data directly
      console.log('[AI DEBUG] New thread created:', data);

      // Reset the question count
      setQuestionCount(0);
    } catch (error) {
      console.error('[AI DEBUG] Error creating new thread:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to start survey generation session.';
      // Show error message to user
      toast.error(`Error: ${errorMessage}`); // Show toast
    } finally {
      setIsLoading(false);
      setLoadingText("Thinking..."); // Reset loading text
    }
  };

  initializeNewThread();

  // Cleanup function (optional, depending on backend session handling)
  return () => {
    console.log('[AI DEBUG] AIChat component unmounted');
    // Consider calling a backend endpoint to clean up the thread if necessary
  };
}, []); // Empty dependency array ensures this runs only once on mount

// --- Updated handleSendMessage ---
const handleSendMessage = async (e) => {
  e.preventDefault();
  if (!userInput.trim() || isLoading) return; // Prevent sending while loading

  console.log(`[AI DEBUG] Sending user message: "${userInput}"`);

  const newMessage = { role: 'user', content: userInput };
  setMessages(prev => [...prev, newMessage]);
  const currentInput = userInput; // Capture userInput before clearing state
  setUserInput('');
  setIsLoading(true);
  setLoadingText("Thinking..."); // Reset loading text

  // Scroll immediately
  setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);


  try {
    console.log('[AI DEBUG] Calling aiService.chatWithAI()');
    const response = await aiService.chatWithAI(currentInput); // Use aiService
    const responseData = response.data; // Access data directly
    console.log('[AI DEBUG] AI chat response received:', responseData);

    if (responseData.response) {
      console.log(`[AI DEBUG] Adding assistant response: "${responseData.response}"`);
      setMessages(prev => [...prev, { role: 'assistant', content: responseData.response }]);

      // Update question count from response if available
      if (responseData.question_count !== undefined) {
        console.log(`[AI DEBUG] Updating question count from response: ${responseData.question_count}`);
        setQuestionCount(responseData.question_count);
      } else {
        // Fallback if question_count is not in the response
        console.warn('[AI DEBUG] No question_count in response. Behavior might be unexpected.');
        // Decide on fallback behavior: increment, do nothing, or log warning.
        // Incrementing might not be accurate if the AI didn't ask a question.
        // setQuestionCount(prev => prev + 1); // Example: Increment anyway
      }
    } else {
      console.warn('[AI DEBUG] Response missing "response" field:', responseData);
      // Provide a clearer message if the response format is wrong
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I received an unexpected response format. Please try again.' }]);
    }
  } catch (error) {
    console.error('[AI DEBUG] Error in AI conversation:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to communicate with the AI assistant.';
    setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, an error occurred: ${errorMessage}. Please try again.` }]);
    toast.error(`Chat Error: ${errorMessage}`); // Show toast
  } finally {
    console.log('[AI DEBUG] Chat request completed');
    setIsLoading(false);
    // Scroll again after response and loading state change
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
};

// --- Updated handleGenerateSurvey ---
const handleGenerateSurvey = async () => {
  if (!userInput.trim() || isLoading) return; // Prevent sending if input is empty or while loading

  console.log('[AI DEBUG] Starting quick survey generation with input:', userInput);
  console.log('[AI DEBUG] Business context:', { businessId, businessName });
  setIsLoading(true);
  setLoadingText("Generating survey...");

  try {
    console.log(`[AI DEBUG] Using prompt for generation: "${userInput}"`);

    // Prepare the payload with business context
    const payload = { prompt: userInput };
    if (businessId) {
      payload.business_id = businessId;
      console.log('[AI DEBUG] Including business_id in payload:', businessId);
    }

    // Call the API to generate a survey
    const response = await aiService.quickGenerateSurvey(payload);
    const result = response.data;

    if (result.survey) {
      console.log('[AI DEBUG] Survey data received:', result.survey);

      // Transform the survey data
      const transformedSurvey = {
          ...result.survey,
          business_id: businessId, // Ensure business_id is included in the survey data
          questions: result.survey.questions.map(q => ({
              ...q,
              type: transformQuestionType(q.type || q.question_type),
              text: q.text || q.question_text,
              description: q.description || '',
              additional_text: q.additional_text || '',
              options: Array.isArray(q.options) ? q.options : [],
              ranking_items: Array.isArray(q.ranking_items) ? q.ranking_items : [],
              image_url: q.image_url || '',
              required: q.required || false,
              sequence_number: q.sequence_number || 0,
              branch: q.branch || null,
              grid_rows: q.grid_rows || [],
              grid_columns: q.grid_columns || [],
              rating_start: q.rating_start || (q.type === 'rating' ? 1 : ''),
              rating_end: q.rating_end || (q.type === 'rating' ? 10 : ''),
              rating_step: q.rating_step || (q.type === 'rating' ? 1 : ''),
              rating_unit: q.rating_unit || '',
              left_label: q.left_label || '',
              right_label: q.right_label || '',
              center_label: q.center_label || ''
          }))
      };

      localStorage.setItem('currentGeneratedSurvey', JSON.stringify(transformedSurvey));

      // Navigate to CreateSurvey based on business context
      const navigationState = {
        fromAiGeneration: true,
        generatedSurvey: transformedSurvey,
        businessId: businessId,
        businessName: businessName
      };

      if (businessId) {
        // If business context exists, navigate to the business-specific creation route
        // This route loads CreateSurveyForBusiness, which then loads CreateSurvey
        navigate(`/admin/business/${businessId}/surveys/new`, { state: navigationState });
      } else {
        // For general surveys (e.g., by super_admin without specific business context initially)
        navigate('/create-survey', { state: navigationState });
      }

    } else {
      // Handle cases where the API returns success but no survey data
      console.error('[AI DEBUG] No survey data found in the response:', result);
      throw new Error('Survey generation completed, but no survey data was returned.');
    }
  } catch (error) {
    console.error('[AI DEBUG] Error generating survey:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to generate the survey.';
    toast.error(`Generation Error: ${errorMessage}`); // Show toast
  } finally {
    setIsLoading(false);
    setLoadingText("Thinking..."); // Reset loading text
  }
};

  // Scroll to bottom when messages change
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [messages, isLoading]); // Added isLoading as dependency

  useEffect(() => {
    let timeoutId;
    if (isLoading) {
      const texts = ["Thinking...", "Crafting response...", "Processing...", "Almost there...", "Finalizing..."];
      let index = 0;
      
      const updateText = () => {
        setLoadingText(texts[index]);
        index = (index + 1) % texts.length;
        timeoutId = setTimeout(updateText, 2000);
      };
      
      timeoutId = setTimeout(updateText, 2000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  // Add this helper function at the top level of your component
  const transformQuestionType = (type) => {
    // Map API question types to frontend types consistently with CreateSurvey.js
    const typeMap = {
      'multiple_choice': 'multiple-choice',
      'single_choice': 'single-choice',
      'short_text': 'open-ended',
      'long_text': 'open-ended',
      'scale': 'scale',
      'rating_scale': 'rating',
      'slider': 'rating',
      'radio_grid': 'radio-grid', 
      'star_rating_grid': 'star-rating-grid',
      'ranking': 'interactive-ranking',
      'interactive_ranking': 'interactive-ranking',
    };

    return typeMap[type] || type;
  };

  const isMaxQuestionsReached = questionCount >= 10;
  
  console.log('[AI DEBUG] Current state:', {
    userInput,
    questionCount,
    isLoading
  });

  return (
    <div className="page-container">
      <Sidebar businessContext={businessContext} />
      <div className="main-content3">
        <div className="survey-entry-container">
          <div className="chat-card">
            <div className="chat-header">
              <h2 className="chat-title">AI Survey Builder</h2>
              <p className="chat-subtitle">Chat with me to create your perfect survey. The more details you provide, the better!</p>
            </div>

            <div className="simple-input-container">
              <div className="input-guidance">
                <h3 className="guidance-title">Describe what you want feedback on</h3>
                <p className="guidance-text">Try to be specific—include the product name, feature, or topic if possible.</p>
                <div className="example-box">
                  <span className="example-label">Example:</span> "Give me some survey questions about progression, pace and rewards for progression in the game Sea of Thieves."
                </div>
              </div>
              
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="I want feedback on..."
                className="sentence-input"
                disabled={isLoading}
              />

              <button 
                onClick={handleGenerateSurvey} 
                className={`generate-button ${(isLoading || !userInput.trim()) ? 'disabled' : ''}`}
                disabled={isLoading || !userInput.trim()}
              >
                {isLoading ? (
                  <>
                    <i className="ri-loader-2-line spinning"></i>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="ri-file-chart-line"></i>
                    Generate Survey
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="tip-card">
            <div className="tip-header">
              <i className="ri-lightbulb-flash-line"></i>
              <span>Tips for Better Surveys</span>
            </div>
            <ul className="tip-list">
              <li className="tip-item">
                <i className="ri-user-search-line"></i>
                Be specific about your target audience
              </li>
              <li className="tip-item">
                <i className="ri-list-check"></i>
                Mention if you need specific question types (multiple choice, ratings, etc.)
              </li>
              <li className="tip-item">
                <i className="ri-focus-2-line"></i>
                Specify the purpose of your survey (customer feedback, research, etc.)
              </li>
              <li className="tip-item">
                <i className="ri-information-line"></i>
                Share any context that might influence question design
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;