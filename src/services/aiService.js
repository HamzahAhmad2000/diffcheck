import axios from 'axios';

// Enhanced aiService.js with debugging, now using Axios
const baseURL = process.env.REACT_APP_AI_API_BASE_URL ||'http://localhost:5000/api/ai' ; // Default to localhost for local development
const API_BASE_URL = process.env.REACT_APP_AI_API_BASE_URL || 'http://localhost:5000/api/ai'; // Default to localhost for local development


// const baseURL = 'http://localhost:5000/api/ai' ; // Default to localhost for local development
// const API_BASE_URL = 'http://localhost:5000/api/ai'; // Default to localhost for local development

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Optional: Configure Axios instance if needed (e.g., default headers, timeout)
// const apiClient = axios.create({
//   baseURL: API_BASE_URL,
//   headers: { 'Content-Type': 'application/json' }
// });
// Then use apiClient.post, apiClient.get etc. instead of axios.post, axios.get

export const aiService = {
  // Initialize threads for a survey when it's created or opened
  async initializeThreads(surveyId) {
    console.log(`[AI DEBUG] Initializing threads for survey ID: ${surveyId}`);
    try {
      const url = `${API_BASE_URL}/create_survey_thread`;
      const payload = { survey_id: surveyId };
      console.log(`[AI DEBUG] Creating survey thread for survey ID: ${surveyId} at ${url}`);

      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log('[AI DEBUG] Survey thread created successfully:', response.data);
      return true; // Axios resolves on success (2xx status)
    } catch (error) {
      console.error('[AI DEBUG] Exception initializing AI threads:', error);
      // Log detailed Axios error info if available
      if (error.response) {
        console.error('[AI DEBUG] Error response data:', error.response.data);
        console.error('[AI DEBUG] Error response status:', error.response.status);
        console.error('[AI DEBUG] Error response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('[AI DEBUG] Error request:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('[AI DEBUG] Error message:', error.message);
      }
      return false;
    }
  },

  // Generate a survey based on a conversation
  async generateSurvey() {
    console.log('[AI DEBUG] Starting survey generation process');
    const url = `${API_BASE_URL}/generate_survey`;
    try {
      console.log(`[AI DEBUG] Sending generate_survey request to ${url}`);
      const response = await axios.post(url, {}, { // Sending empty object as body if required, or null
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] Generate survey response status: ${response.status}`);
      console.log('[AI DEBUG] Survey generation successful. Response data:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error generating survey:', error);
      if (error.response) {
        const errorMsg = error.response.data?.error || `HTTP error ${error.response.status}`;
        console.error('[AI DEBUG] API error:', errorMsg);
        throw new Error(errorMsg);
      } else {
        // Network or other setup error
        throw error;
      }
    }
  },

  // Edit an entire survey using AI
  async editSurvey(surveyId, instructions) {
    console.log(`[AI DEBUG] Editing survey ${surveyId} with instructions: ${instructions}`);
    const url = `${API_BASE_URL}/edit_survey_ai`;
    const payload = {
      survey_id: surveyId,
      edit_instructions: instructions
    };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] Edit survey response status: ${response.status}`);
      console.log('[AI DEBUG] Survey edit successful, updated data:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error editing survey with AI:', error);
      if (error.response) {
        console.error('[AI DEBUG] Edit survey error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to edit survey with AI');
      } else {
        throw error;
      }
    }
  },

  // Regenerate a survey with changes
  async regenerateSurvey(surveyData, prompt, systemPrompt) {
    console.log(`[AI DEBUG] Regenerating survey with prompt: "${prompt}"`);
    const url = `${API_BASE_URL}/regenerate_survey`;
    const payload = {
      survey: surveyData,
      prompt: prompt,
      survey_id: surveyData.id, // Assuming surveyData has an id property
      system_prompt: systemPrompt
    };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] Regenerate survey response status: ${response.status}`);
      console.log('[AI DEBUG] Survey regeneration successful, updated data:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error regenerating survey with AI:', error);
      if (error.response) {
        console.error('[AI DEBUG] Regenerate survey error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to regenerate survey with AI');
      } else {
        throw error;
      }
    }
  },

  // Edit a specific question using AI
  async editQuestion(questionData, promptText, surveyId) {
    console.log(`[AI DEBUG] Editing question with AI for survey ${surveyId}`);
    console.log('[AI DEBUG] Original question data:', JSON.stringify(questionData, null, 2));
    console.log(`[AI DEBUG] Prompt: ${promptText}`);

    const url = `${API_BASE_URL}/ai_edit_question`;
    const payload = {
      original: questionData,
      prompt: promptText,
      survey_id: surveyId
    };
    console.log('[AI DEBUG] Request payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] Edit question response status: ${response.status}`);
      console.log('[AI DEBUG] Question edit successful, updated data:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error editing question with AI:', error);
      if (error.response) {
        console.error('[AI DEBUG] Edit question error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to edit question with AI');
      } else {
        throw error;
      }
    }
  },

  // Get AI- analytics summary
  async getAnalyticsSummary(surveyId) {
    console.log(`[AI DEBUG] Getting AI analytics summary for survey ${surveyId}`);
    const url = `${API_BASE_URL}/ai_summary`; // Base URL for the endpoint
    try {
      // Pass survey_id as a URL parameter using the 'params' config option
      const response = await axios.get(url, {
        params: { survey_id: surveyId },
        headers: getAuthHeaders()
      });

      console.log(`[AI DEBUG] AI summary response status: ${response.status}`);
      console.log('[AI DEBUG] Analytics summary successful:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error getting AI analytics summary:', error);
      if (error.response) {
        console.error('[AI DEBUG] AI summary error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to get AI analytics summary');
      } else {
        throw error;
      }
    }
  },

  // Converse with the AI about analytics
  async converseSummary(surveyId, prompt) {
    console.log(`[AI DEBUG] Starting analytics conversation for survey ${surveyId}`);
    console.log(`[AI DEBUG] Prompt: ${prompt}`);

    const url = `${API_BASE_URL}/converse_ai_summary`;
    const payload = {
      survey_id: surveyId,
      prompt
    };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] Converse summary response status: ${response.status}`);
      console.log('[AI DEBUG] Analytics conversation successful:');
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error conversing with AI about analytics:', error);
      if (error.response) {
        console.error('[AI DEBUG] Converse summary error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to converse with AI about analytics');
      } else {
        throw error;
      }
    }
  },

  // Chat with AI to refine survey requirements
  async chatWithAI(message) {
    console.log(`[AI DEBUG] Sending message to AI chat: ${message}`);
    const url = `${API_BASE_URL}/chat`;
    const payload = { message };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });

      console.log(`[AI DEBUG] AI chat response status: ${response.status}`);
      console.log('[AI DEBUG] AI chat response:', response.data);

      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error chatting with AI:', error);
      if (error.response) {
        console.error('[AI DEBUG] AI chat error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to chat with AI');
      } else {
        throw error;
      }
    }
  },

  async createNewChatThread() {
    console.log('[AI DEBUG] Creating new chat thread via aiService');
    const url = `${API_BASE_URL}/create_new_chat_thread`;
    try {
      const response = await axios.post(url, {}, {
        headers: getAuthHeaders(),
      });
      console.log('[AI DEBUG] New chat thread created successfully:', response.data);
      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error creating new chat thread:', error);
      if (error.response) {
        console.error('[AI DEBUG] Error response data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to create new chat thread');
      } else {
        throw error;
      }
    }
  },

  // Generate a guided survey
  async generateGuidedSurvey(surveyData) {
    console.log('[AI DEBUG] Generating guided survey with data:', surveyData);
    const url = `${API_BASE_URL}/guided_generate_survey`;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Format the request body according to API spec
      const requestBody = {
        industry: surveyData.industry,
        goal: mapGoalToApiFormat(surveyData.goal),
        description: surveyData.subject,
        tone_length: mapToneLength(surveyData.surveyLength)
      };

      console.log('[AI DEBUG] Sending request with body:', requestBody);

      const response = await axios.post(url, requestBody, {
        headers: getAuthHeaders()
      });

      // Axios handles non-2xx as errors, so we only need to check response.data here
      const data = response.data;
      return {
        survey: {
          ...data.survey,
          id: data.survey.id || Date.now().toString(),
          title: data.survey.title || 'New Survey',
          description: data.survey.description || '',
          questions: Array.isArray(data.survey.questions) ? data.survey.questions : []
        }
      };
    } catch (error) {
      console.error('[AI DEBUG] Error generating guided survey:', error);
      if (error.response) {
          // Handle specific HTTP errors like 401 Unauthorized
          if (error.response.status === 401) {
            throw new Error('Unauthorized - Please log in again');
          }
          // Use server's error message if available
          throw new Error(error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
          // Network error (no response received)
          if (!navigator.onLine) {
            throw new Error('You appear to be offline. Please check your internet connection.');
          }
          throw new Error('Cannot connect to server. Please ensure the backend is running.');
      } else {
          // Other errors (e.g., setup issues, coding errors before request)
          throw error;
      }
    }
  },

  // Get list of questions eligible for AI analysis
  async getEligibleQuestions(surveyId) {
    console.log(`[AI DEBUG] Getting AI-eligible questions for survey ${surveyId}`);
    // Note: Adjusted URL based on typical REST patterns (confirm with your backend)
    const url = `${API_BASE_URL}/surveys/${surveyId}/ai_eligible_questions`;
    try {
      const response = await axios.get(url, {
        headers: getAuthHeaders()
      });

      console.log('[AI DEBUG] Got eligible questions:', response.data);
      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error getting eligible questions:', error);
      if (error.response) {
        console.error('[AI DEBUG] Eligible questions error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to get AI-eligible questions');
      } else {
        throw error;
      }
    }
  },

  // Generate AI insights report
  async generateInsightsReport(surveyId, selectedQuestionIds, filters = {}, comparisonSettings = {}) {
    console.log('[AI DEBUG] Generating enhanced insights report with trends:', {
      surveyId,
      selectedQuestionIds,
      filters,
      comparisonSettings
    });

    const url = `${API_BASE_URL}/generate_report_insights`;
    const payload = {
      survey_id: surveyId,
      selected_question_ids: selectedQuestionIds,
      filters,
      comparison_settings: comparisonSettings
    };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
        timeout: 120000, // Extended timeout for enhanced processing
      });

      console.log('[AI DEBUG] Generated enhanced insights report:', response.data);
      
      // Validate the enhanced report structure
      if (response.data && response.data.advanced_report) {
        console.log('[AI DEBUG] Enhanced report structure validated');
        console.log('[AI DEBUG] Executive summary items:', response.data.advanced_report.executive_summary?.length || 0);
        console.log('[AI DEBUG] Question insights:', response.data.advanced_report.question_insights?.length || 0);
      } else {
        console.warn('[AI DEBUG] Enhanced report structure not found, checking legacy format');
      }
      
      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error generating enhanced insights report:', error);
      if (error.response) {
        console.error('[AI DEBUG] Enhanced insights report error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to generate enhanced insights report');
      } else {
        throw error;
      }
    }
  },

  autoGenerateSurveyResponses: async (surveyId, numResponses) => {
    console.log(`[AI DEBUG] Requesting AI to generate ${numResponses} responses for survey ${surveyId}`);
    const url = `${API_BASE_URL}/surveys/${surveyId}/auto_generate_responses`; // Matches new route
    const payload = { num_responses: numResponses };

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });
      console.log('[AI DEBUG] Auto-generation response:', response.data);
      return response; // Return the full Axios response object
    } catch (error) {
      console.error('[AI DEBUG] Error auto-generating survey responses:', error);
      if (error.response) {
        console.error('[AI DEBUG] Auto-generation error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to auto-generate responses');
      } else {
        throw error;
      }
    }
  },

  async quickGenerateSurvey(payload) {
    console.log(`[AI DEBUG] Requesting quick survey generation`);
    const url = `${API_BASE_URL}/quick_generate_survey`;

    try {
      const response = await axios.post(url, payload, {
        headers: getAuthHeaders(),
      });
      console.log('[AI DEBUG] Quick survey generation response:', response.data);
      return response;
    } catch (error) {
      console.error('[AI DEBUG] Error during quick survey generation:', error);
      if (error.response) {
        console.error('[AI DEBUG] Quick survey generation error data:', error.response.data);
        throw new Error(error.response.data?.error || 'Failed to generate survey');
      } else {
        throw error;
      }
    }
  }
};

// Helper functions remain the same
function mapGoalToApiFormat(goal) {
  const goalMap = {
    'feature_feedback': 'Feature Feedback',
    'ux': 'User Experience (UX)',
    'satisfaction': 'Satisfaction Check',
    'nps': 'Net Promoter Score',
    'onboarding': 'Onboarding Feedback',
    // ... add other mappings as needed
  };
  return goalMap[goal] || goal;
}

function mapToneLength(length) {
  const lengthMap = {
    'short': 'Short (3-5 questions)',
    'balanced': 'Balanced (5-8 questions)',
    'deep': 'Deep Dive (10+ questions)'
  };
  return lengthMap[length] || length;
}

export default aiService;