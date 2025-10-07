// GenerateSurvey.js - Complete Implementation
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SurveyGenerator from './SurveyManagement/SurveyGenerator';
import aiService from '../services/aiService';
import { aiAPI } from 'services/apiClient';

// Make sure to update aiService.js to include regenerate_survey endpoint

const GenerateSurvey = () => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState(null);
  const [error, setError] = useState(null);
  const [aiImprovementPrompt, setAiImprovementPrompt] = useState('');
  const [conversationContext, setConversationContext] = useState({});
  const navigate = useNavigate();

  // Check for survey in localStorage on mount
  useEffect(() => {
    console.log('[AI DEBUG] GenerateSurvey component mounted');
    
    // Check if there's a current survey in localStorage
    const currentSurvey = localStorage.getItem('currentGeneratedSurvey');
    if (currentSurvey) {
      try {
        const surveyData = JSON.parse(currentSurvey);
        console.log('[AI DEBUG] Found current survey in localStorage');
        setGeneratedSurvey(surveyData);
      } catch (e) {
        console.error('[AI DEBUG] Error parsing currentGeneratedSurvey:', e);
      }
    } else {
      // Check for stored prompt
      const storedPrompt = localStorage.getItem('aiGenerationPrompt');
      if (storedPrompt) {
        setUserPrompt(storedPrompt);
      }
    }
    
    return () => {
      console.log('[AI DEBUG] GenerateSurvey component unmounted');
    };
  }, []);

  // Log whenever generatedSurvey changes
  useEffect(() => {
    if (generatedSurvey) {
      console.log('[AI DEBUG] Generated survey updated:');
      console.log(JSON.stringify(generatedSurvey, null, 2));
    }
  }, [generatedSurvey]);

  const handleGenerateSurvey = async () => {
    if (!userPrompt.trim()) {
      setError('Please enter a prompt to generate a survey');
      return;
    }
    
    console.log(`[AI DEBUG] Generating survey with prompt: "${userPrompt}"`);
    setIsLoading(true);
    setError(null);
    
    try {
      // Create a new chat thread before generating the survey
      await createNewChatThread();
      
      // Store the prompt in localStorage for persistence
      localStorage.setItem('aiGenerationPrompt', userPrompt);
      setConversationContext({ initialPrompt: userPrompt });
      
      // First, send the user's prompt as a message to establish context
      await aiService.chatWithAI(userPrompt);
      
      // Then generate the survey
      console.log('[AI DEBUG] Calling aiService.generateSurvey()');
      const data = await aiService.generateSurvey();
      console.log('[AI DEBUG] Survey generation completed, response:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data && data.survey) {
        console.log('[AI DEBUG] Survey data successfully extracted');
        setGeneratedSurvey(data.survey);
        
        // Store in localStorage for persistence
        localStorage.setItem('generatedSurvey', JSON.stringify(data.survey));
        localStorage.setItem('currentGeneratedSurvey', JSON.stringify(data.survey));
        
        // Validate survey structure
        validateSurveyStructure(data.survey);
      } else {
        console.error('[AI DEBUG] Invalid response format - survey data missing');
        throw new Error('Invalid response format - survey data missing');
      }
    } catch (err) {
      console.error("[AI DEBUG] Survey generation error:", err);
      setError(err.message || 'An error occurred while generating the survey');
      setGeneratedSurvey(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to create a new chat thread
  const createNewChatThread = async () => {
    try {
      console.log('[AI DEBUG] Creating new chat thread for survey generation');
      const response = await fetch('http://localhost:5000/api/ai/create_new_chat_thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create new thread: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[AI DEBUG] New chat thread created:', data);
      return data;
    } catch (error) {
      console.error('[AI DEBUG] Error creating new chat thread:', error);
      throw error;
    }
  };

  // Helper function to validate survey structure
  const validateSurveyStructure = (survey) => {
    console.log('[AI DEBUG] Validating survey structure');
    
    // Check essential fields
    if (!survey.title) {
      console.warn('[AI DEBUG] Survey missing title');
    }
    
    if (!survey.description) {
      console.warn('[AI DEBUG] Survey missing description');
    }
    
    if (!Array.isArray(survey.questions)) {
      console.error('[AI DEBUG] Survey questions is not an array');
      return;
    }
    
    console.log(`[AI DEBUG] Survey has ${survey.questions.length} questions`);
    
    // Validate each question
    survey.questions.forEach((question, index) => {
      console.log(`[AI DEBUG] Validating question ${index + 1}:`);
      
      if (!question.question_text) {
        console.warn(`[AI DEBUG] Question ${index + 1} missing question_text`);
      }
      
      if (!question.question_type) {
        console.warn(`[AI DEBUG] Question ${index + 1} missing question_type`);
      } else {
        const validTypes = [
          'multiple-choice', 'checkbox', 'dropdown', 'open-ended', 
          'rating-scale', 'nps', 'ranking', 'numerical-input', 
          'email-input', 'date-picker', 'signature', 
          'radio-grid', 'checkbox-grid', 'star-rating-grid'
        ];
        
        if (!validTypes.includes(question.question_type)) {
          console.warn(`[AI DEBUG] Question ${index + 1} has invalid question_type: ${question.question_type}`);
        }
      }
      
      // Check for required fields based on question type
      if (['multiple-choice', 'checkbox', 'dropdown', 'ranking'].includes(question.question_type)) {
        if (!Array.isArray(question.options) || question.options.length === 0) {
          console.warn(`[AI DEBUG] Question ${index + 1} (${question.question_type}) missing options array`);
        } else {
          console.log(`[AI DEBUG] Question ${index + 1} has ${question.options.length} options`);
        }
      }
      
      if (['rating-scale', 'nps'].includes(question.question_type)) {
        if (question.rating_start === undefined) {
          console.warn(`[AI DEBUG] Rating question ${index + 1} missing rating_start`);
        }
        if (question.rating_end === undefined) {
          console.warn(`[AI DEBUG] Rating question ${index + 1} missing rating_end`);
        }
        if (question.rating_step === undefined) {
          console.warn(`[AI DEBUG] Rating question ${index + 1} missing rating_step`);
        }
      }
      
      if (['radio-grid', 'checkbox-grid', 'star-rating-grid'].includes(question.question_type)) {
        if (!Array.isArray(question.grid_rows) || question.grid_rows.length === 0) {
          console.warn(`[AI DEBUG] Grid question ${index + 1} missing grid_rows array`);
        }
        if (!Array.isArray(question.grid_columns) || question.grid_columns.length === 0) {
          console.warn(`[AI DEBUG] Grid question ${index + 1} missing grid_columns array`);
        }
      }
    });
  };

  const handleEditSurvey = async () => {
    if (!aiImprovementPrompt.trim() || !generatedSurvey) return;
    
    console.log(`[AI DEBUG] Editing survey with prompt: "${aiImprovementPrompt}"`);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[AI DEBUG] Preparing to regenerate entire survey with edits');
      
      // Create a system prompt for complete survey regeneration
      const systemPrompt = `
You are a survey regeneration assistant. Your task is to:
1. Take the existing survey data and requested changes
2. Create a completely new version of the survey that incorporates all requested changes
3. Return a new complete survey JSON that includes:
   - The original survey title and description (possibly modified as requested)
   - ALL original questions (modified as needed)
   - ANY new questions as specified in the change request
   - Proper sequence numbers for all questions
   - All required question metadata (options, descriptions, etc.)

Your response MUST include a complete survey JSON with all fields and questions, not just the changes.
`;
      
      // Current state of the survey
      const currentSurveyState = {
        id: generatedSurvey.id,
        title: generatedSurvey.title,
        description: generatedSurvey.description,
        questions: generatedSurvey.questions.map(q => ({
          question_text: q.question_text || q.text,
          question_type: q.question_type || q.type,
          options: q.options || [],
          description: q.description || '',
          additional_text: q.additional_text || '',
          sequence_number: q.sequence_number,
          required: q.required || false
        }))
      };
      
      // Make API call to regenerate the entire survey
      const response = await aiAPI.regenerateSurvey({
        system_prompt: systemPrompt,
        user_prompt: aiImprovementPrompt,
        current_survey: currentSurveyState,
        conversation_context: conversationContext 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[AI DEBUG] Survey regeneration completed, response:', data);
      
      if (data.regenerated_survey) {
        console.log('[AI DEBUG] Setting regenerated survey data');
        
        // Transform the regenerated survey to match our expected format
        const updatedSurvey = {
          ...generatedSurvey,
          title: data.regenerated_survey.title || generatedSurvey.title,
          description: data.regenerated_survey.description || generatedSurvey.description,
          questions: data.regenerated_survey.questions.map((q, index) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            description: q.description || '',
            additional_text: q.additional_text || '',
            options: q.options || [],
            sequence_number: index + 1,
            required: q.required || false
          }))
        };
        
        setGeneratedSurvey(updatedSurvey);
        
        // Update localStorage
        localStorage.setItem('generatedSurvey', JSON.stringify(updatedSurvey));
        localStorage.setItem('currentGeneratedSurvey', JSON.stringify(updatedSurvey));
        
        setConversationContext({ ...conversationContext, lastImprovement: aiImprovementPrompt });
        
        // Validate updated survey structure
        validateSurveyStructure(updatedSurvey);
      } else if (data.survey_updates) {
        // Fallback to the old method if regenerated_survey is not available
        console.log('[AI DEBUG] Applying partial survey updates');
        
        const updatedSurvey = { ...generatedSurvey };
        
        // Update title and description if provided
        if (data.survey_updates.title) {
          updatedSurvey.title = data.survey_updates.title;
        }
        
        if (data.survey_updates.description) {
          updatedSurvey.description = data.survey_updates.description;
        }
        
        // Update existing questions if changes are provided
        if (data.survey_updates.question_updates && Array.isArray(data.survey_updates.question_updates)) {
          data.survey_updates.question_updates.forEach(update => {
            const index = update.index;
            if (index !== undefined && index >= 0 && index < updatedSurvey.questions.length) {
              updatedSurvey.questions[index] = {
                ...updatedSurvey.questions[index],
                question_text: update.question_text || updatedSurvey.questions[index].question_text,
                question_type: update.question_type || updatedSurvey.questions[index].question_type,
                description: update.description || updatedSurvey.questions[index].description,
                additional_text: update.additional_text || updatedSurvey.questions[index].additional_text,
                options: update.options || updatedSurvey.questions[index].options,
              };
            }
          });
        }
        
        // Add new questions if provided
        if (data.survey_updates.new_questions && Array.isArray(data.survey_updates.new_questions)) {
          const newQuestions = data.survey_updates.new_questions.map((q, i) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            description: q.description || '',
            additional_text: q.additional_text || '',
            options: q.options || [],
            sequence_number: updatedSurvey.questions.length + i + 1,
            required: q.required || false
          }));
          
          updatedSurvey.questions = [...updatedSurvey.questions, ...newQuestions];
        }
        
        setGeneratedSurvey(updatedSurvey);
        
        // Update localStorage
        localStorage.setItem('generatedSurvey', JSON.stringify(updatedSurvey));
        localStorage.setItem('currentGeneratedSurvey', JSON.stringify(updatedSurvey));
        
        setConversationContext({ ...conversationContext, lastImprovement: aiImprovementPrompt });
        
        // Validate updated survey structure
        validateSurveyStructure(updatedSurvey);
      } else {
        console.error('[AI DEBUG] Invalid response format - neither regenerated_survey nor survey_updates found');
        throw new Error('Invalid response format from the AI service');
      }
    } catch (err) {
      console.error("[AI DEBUG] Survey edit error:", err);
      setError(err.message || 'An error occurred during survey improvement');
    } finally {
      setIsLoading(false);
      setAiImprovementPrompt('');
    }
  };

  const handleProceedToEditor = () => {
    console.log('[AI DEBUG] Proceeding to survey editor with generated survey');
    if (!generatedSurvey) {
      setError('No survey has been generated yet');
      return;
    }
    
    // Ensure the survey is stored in localStorage for SurveyGenerator to access
    localStorage.setItem('currentGeneratedSurvey', JSON.stringify(generatedSurvey));
    navigate('/survey-editor');
  };

  const handleClose = () => {
    console.log('[AI DEBUG] Close button clicked');
    if (window.confirm('Are you sure you want to discard this survey?')) {
      console.log('[AI DEBUG] Discarding survey and resetting state');
      setGeneratedSurvey(null);
      setUserPrompt('');
      setConversationContext({});
      setError(null);
      
      // Clear localStorage
      localStorage.removeItem('generatedSurvey');
      localStorage.removeItem('currentGeneratedSurvey');
      localStorage.removeItem('aiGenerationPrompt');
      
      navigate('/dashboard');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {!generatedSurvey ? (
        <div>
          <h1 style={{ color: '#333', marginBottom: '20px' }}>Generate New Survey</h1>
          
          <div style={{ display: 'flex', marginBottom: '20px', alignItems: 'center' }}>
            <button 
              onClick={() => navigate('/ai-chat')}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#6200EA', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>💬</span> Use AI Chat Assistant
            </button>
            <div style={{ margin: '0 15px', display: 'flex', alignItems: 'center', color: '#666' }}>or</div>
            <div style={{ flex: 1 }}>Generate manually with the form below</div>
          </div>
          
          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Generate with a Prompt</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Describe what kind of survey you want to create. Be as specific as possible about the topic, 
              target audience, and types of questions you'd like to include.
            </p>
            
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="E.g., Create a customer satisfaction survey for a software product with 7 questions, including rating scales about user experience and open-ended questions about potential improvements."
              style={{ 
                width: '100%', 
                minHeight: '150px', 
                padding: '15px', 
                marginBottom: '15px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '16px',
                lineHeight: '1.5'
              }}
            />
            
            {error && (
              <div style={{ 
                color: '#721c24', 
                backgroundColor: '#f8d7da', 
                padding: '10px 15px', 
                borderRadius: '4px', 
                marginBottom: '15px',
                border: '1px solid #f5c6cb'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#666', fontSize: '14px' }}>
                <span>💡</span> Tip: The more details you provide, the better the survey will be.
              </div>
              
              <button 
                onClick={handleGenerateSurvey} 
                disabled={isLoading || !userPrompt.trim()} 
                style={{ 
                  padding: '12px 25px', 
                  backgroundColor: isLoading || !userPrompt.trim() ? '#ccc' : '#007bff', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: isLoading || !userPrompt.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isLoading ? '⏳ Generating...' : '✨ Generate Survey'}
              </button>
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: '#f0f7ff', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #cce5ff'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#004085' }}>Why Use AI for Survey Creation?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#0062cc', margin: '0 0 10px 0' }}>Save Time</h4>
                <p style={{ color: '#666', margin: 0 }}>
                  Generate complete surveys in seconds instead of spending hours creating questions from scratch.
                </p>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#0062cc', margin: '0 0 10px 0' }}>Best Practices</h4>
                <p style={{ color: '#666', margin: 0 }}>
                  AI incorporates survey design best practices, helping you get more reliable results.
                </p>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h4 style={{ color: '#0062cc', margin: '0 0 10px 0' }}>Customization</h4>
                <p style={{ color: '#666', margin: 0 }}>
                  Easily edit, add, or remove questions after generation to perfectly fit your needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* When survey is generated, we'll show two options */}
          <div style={{ marginBottom: '30px', textAlign: 'center' }}>
            <h2 style={{ color: '#333' }}>Survey Generated Successfully!</h2>
            <p style={{ color: '#666' }}>
              Your survey "{generatedSurvey.title}" has been created with {generatedSurvey.questions?.length || 0} questions.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
              <button
                onClick={handleProceedToEditor}
                style={{
                  padding: '12px 25px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>📝</span> Proceed to Survey Editor
              </button>
              
              <button
                onClick={handleClose}
                style={{
                  padding: '12px 25px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🗑️</span> Discard Survey
              </button>
            </div>
          </div>
          
          <div style={{ 
            marginBottom: '30px',
            backgroundColor: '#f5f0ff', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e1d5f5'
          }}>
            <h3 style={{ color: '#5000d0', margin: '0 0 15px 0' }}>Edit Survey with AI Before Proceeding</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
              Optionally, you can refine your survey with AI guidance before moving to the editor.
            </p>
            
            <textarea
              value={aiImprovementPrompt}
              onChange={(e) => setAiImprovementPrompt(e.target.value)}
              placeholder="Enter instructions for AI to update the entire survey (e.g., 'Make all questions about remote work', 'Add more rating scale questions', 'Simplify the language for a younger audience')"
              style={{ 
                width: '100%', 
                minHeight: '80px', 
                padding: '15px', 
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            
            <button 
              onClick={handleEditSurvey} 
              disabled={isLoading || !aiImprovementPrompt.trim()}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: isLoading || !aiImprovementPrompt.trim() ? '#ccc' : '#6200EA',
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isLoading || !aiImprovementPrompt.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? '⏳ Updating...' : '✨ Update Survey with AI'}
            </button>
          </div>
          
          {/* Survey Preview */}
          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ color: '#333', margin: '0 0 15px 0' }}>Survey Preview</h3>
            
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <h2 style={{ color: '#333', marginTop: 0 }}>{generatedSurvey.title}</h2>
              {generatedSurvey.description && (
                <p style={{ color: '#666' }}>{generatedSurvey.description}</p>
              )}
              
              <div style={{ marginTop: '20px' }}>
                {generatedSurvey.questions && generatedSurvey.questions.map((q, idx) => (
                  <div key={idx} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '4px' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>
                      Q{idx + 1}: {q.question_text || q.text}
                    </p>
                    <p style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>
                      Type: {q.question_type || q.type}
                    </p>
                    
                    {/* Show options if applicable */}
                    {(q.options || q.options) && Array.isArray(q.options || q.options) && (q.options || q.options).length > 0 && (
                      <div style={{ paddingLeft: '20px' }}>
                        <p style={{ margin: '5px 0', fontWeight: '500' }}>Options:</p>
                        <ul style={{ margin: '0', paddingLeft: '20px' }}>
                          {(q.options || q.options).map((opt, i) => (
                            <li key={i}>{typeof opt === 'string' ? opt : opt.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateSurvey;