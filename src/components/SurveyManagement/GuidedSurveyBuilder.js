import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import aiService from '../../services/aiService';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/AIChat.css';

const GuidedSurveyBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation(); // To get state passed from navigation
  
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
  
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    industry: '',
    goal: '',
    subject: '',
    surveyLength: ''
  });

  // businessId and businessName might come from route state if navigating from a business-specific context
  const { businessId, businessName } = location.state || {};

  const [animationIndex, setAnimationIndex] = useState(0);
  const animationMessages = [
    { title: "AI is Generating Your Survey...", subtitle: "Hang tight — we're creating a set of smart, tailored questions based on everything you shared." },
    { title: "Assembling Your Questions...", subtitle: "You'll be able to preview, edit, and fine-tune the survey in the next step." }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationIndex((prevIndex) => (prevIndex + 1) % animationMessages.length);
    }, 6000); // Change text every 2 second
    return () => clearInterval(interval);
  }, []);

  const industries = [
    'Tech / Software / SaaS',
    'Entertainment (Games, TV, Streaming, Music)',
    'Ecommerce / Marketplace',
    'Travel & Hospitality',
    'Other'
  ];

  const surveyGoals = [
    { value: 'feature_feedback', label: 'Feature Feedback', description: 'Understand how users feel about a specific feature or tool.' },
    { value: 'ux', label: 'User Experience (UX)', description: 'Learn how easy and intuitive something is to use.' },
    { value: 'satisfaction', label: 'Satisfaction Check', description: 'Measure how happy users are with a product or service.' },
    { value: 'nps', label: 'Net Promoter Score (NPS)', description: 'Gauge how likely users are to recommend you (0-10 scale).' },
    { value: 'onboarding', label: 'Onboarding Feedback', description: 'Find out if users had a smooth first-time experience.' },
    { value: 'concept', label: 'Concept Testing', description: 'Get reactions to new ideas, designs, or content.' },
    { value: 'pricing', label: 'Price Perception', description: 'See how users feel about your pricing or value.' },
    { value: 'purchase', label: 'Purchase Drivers', description: 'Understand what motivates people to buy or convert.' },
    { value: 'post_experience', label: 'Post-Experience Feedback', description: 'Capture feedback right after an interaction.' },
    { value: 'motivation', label: 'Motivation & Behavior', description: 'Explore what users want, expect, or avoid.' },
    { value: 'community', label: 'Community & Loyalty', description: 'Learn what makes users feel loyal or connected to your brand.' },
    { value: 'churn', label: 'Churn Insight', description: 'Discover why users stop using or returning.' },
    { value: 'other', label: 'Other (Custom Goal)', description: 'Describe your goal in the next step — we\'ll tailor the survey to fit.' }
  ];

  const surveyLengths = [
    { value: 'short', label: 'Conversational & Short (3-5 questions)', description: 'Quick pulse with a friendly tone.', cost: 1 },
    { value: 'balanced', label: 'Balanced & Structured (6-9 questions)', description: 'Still brief but covers key insight areas.', cost: 2 },
    { value: 'deep', label: 'Deep Dive (10+ questions)', description: 'For comprehensive or strategic feedback.', cost: 3 }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Choose Your Industry</h2>
            <p className="step-description">
              This helps us tailor the tone, wording, and examples for your survey. 
              If you're not sure, just choose 'Other'.
            </p>
            <div className="options-grid">
              {industries.map(industry => (
                <button
                  key={industry}
                  className={`option-button ${formData.industry === industry ? 'selected' : ''}`}
                  onClick={() => handleInputChange('industry', industry)}
                >
                  {industry}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h2>What's Your Survey Goal?</h2>
            <p className="step-description">
              Choose the option that best fits your goal. If you're not sure, 
              pick the closest match — or select 'Other' to describe your own.
            </p>
            <div className="options-list">
              {surveyGoals.map(goal => (
                <button
                  key={goal.value}
                  className={`option-button list ${formData.goal === goal.value ? 'selected' : ''}`}
                  onClick={() => handleInputChange('goal', goal.value)}
                >
                  <div className="option-header">
                    <span className="option-label">{goal.label}</span>
                  </div>
                  <p className="option-description">{goal.description}</p>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h2>What Are You Getting Feedback On?</h2>
            <p className="step-description">
              Tell us what you're getting feedback on and what you'd like to learn.
              This could include your business name, a product, a feature, a page, 
              a service, or even a creative concept.
            </p>
            <div className="text-input-container">
              <textarea
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Example: We want to know what users think of our new checkout flow on Eclipseer."
                rows={4}
                className="survey-textarea"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h2>Choose Tone & Survey Length</h2>
            {/* AI Points Display for Business Admin only */}
            {isBusinessAdmin && !isSuperAdmin && (
              <div className="ai-points-info">
                <div className="points-balance-inline">
                  <i className="ri-cpu-line"></i>
                  <span>Available AI Points: <strong>{aiPoints}</strong></span>
                </div>
                <small className="points-note-inline">
                  Each survey creation costs AI points based on complexity.
                </small>
              </div>
            )}
            
            {/* Super Admin Notice */}
            {isSuperAdmin && (
              <div className="ai-points-info">
                <div className="points-balance-inline">
                  <i className="ri-vip-crown-line"></i>
                  <span>Super Admin: <strong>Unlimited AI Access</strong></span>
                </div>
                <small className="points-note-inline">
                  As a super admin, you have unlimited access to all AI features.
                </small>
              </div>
            )}
            
            <div className="options-list">
              {surveyLengths.map(length => {
                // Super admin can always use any option, business admin is limited by points
                const isDisabled = isBusinessAdmin && !isSuperAdmin && aiPoints < length.cost;
                
                return (
                  <button
                    key={length.value}
                    className={`option-button list ${formData.surveyLength === length.value ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handleInputChange('surveyLength', length.value)}
                    disabled={isDisabled}
                    title={isDisabled ? `Requires ${length.cost} AI points` : ''}
                  >
                    <div className="option-header">
                      <span className="option-label">{length.label}</span>
                      <span className="option-cost">{length.cost} Point{length.cost > 1 ? 's' : ''}</span>
                      {isDisabled && <i className="ri-lock-line lock-icon"></i>}
                    </div>
                    <p className="option-description">{length.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content generating">
            <div className="generating-animation">
              <div className="generating-spinner"></div>
              <h2 className="animated-title">
                {animationMessages[animationIndex].title}
              </h2>
              <p className="generating-subtitle">
                {animationMessages[animationIndex].subtitle}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!formData.industry;
      case 2: return !!formData.goal;
      case 3: return formData.subject.length >= 10;
      case 4: return !!formData.surveyLength;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 4) {
      await generateSurvey();
    } else if (step < 5) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const generateSurvey = async () => {
    setIsGenerating(true);
    setError('');
    setStep(5);

    try {
      // Check for authentication
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to generate a survey');
      }

      // Check AI points for business admin (super admin bypasses this)
      const selectedLength = surveyLengths.find(l => l.value === formData.surveyLength);
      const pointsNeeded = selectedLength?.cost || 1;

      if (isBusinessAdmin && !isSuperAdmin) {
        // Only check for business admin who is not a super admin
        if (!canUseAIFeature('CAN_USE_AI_BUILDER', pointsNeeded)) {
          if (!hasPermission('CAN_USE_AI_BUILDER')) {
            throw new Error('Your business does not have permission to use the AI Survey Builder.');
          }
          if (aiPoints < pointsNeeded) {
            throw new Error(`Insufficient AI points. You have ${aiPoints} points but need ${pointsNeeded} to create this survey.`);
          }
        }
      }

      const surveyData = {
        ...formData,
        type: 'guided',
        metadata: {
          creation_method: 'guided',
          industry: formData.industry,
          goal: formData.goal,
          target_length: formData.surveyLength,
          version: '1.0',
          business_id: businessId,
          business_name: businessName
        }
      };

      console.log('[AI DEBUG] Sending survey data:', surveyData);
      const result = await aiService.generateGuidedSurvey(surveyData);

      if (result && result.survey) {
        const transformedSurvey = {
          ...result.survey,
          business_id: businessId,
          questions: result.survey.questions.map(q => ({
            ...q,
            type: transformQuestionType(q.type || q.question_type),
            text: q.text || q.question_text,
            description: q.description || '',
            additional_text: q.additional_text || '',
            options: Array.isArray(q.options) ? q.options : [],
            image_url: q.image_url || '',
            required: q.required || false,
            sequence_number: q.sequence_number || 0
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
      }
    } catch (error) {
      console.error('[AI DEBUG] Survey generation error:', error);
      let errorMessage = 'Failed to generate survey. ';
      
      // More specific error messages
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage += 'Please log in again.';
        navigate('/login'); // Redirect to login if unauthorized
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      setError(errorMessage);
      setStep(4);
    } finally {
      setIsGenerating(false);
    }
  };

  const transformQuestionType = (type) => {
    const typeMap = {
      'multiple_choice': 'multi-choice',
      'multiple-choice': 'multi-choice',
      'single_choice': 'single-choice',
      'single-choice': 'single-choice',
      'short_text': 'open-ended',
      'long_text': 'open-ended',
      'open_ended': 'open-ended',
      'rating_scale': 'rating',
      'Slider': 'rating',
      'rating': 'rating',
      'Slider': 'rating',
      'scale': 'scale',
      'Scale': 'scale',
      'radio_grid': 'radio-grid',
      'radio-grid': 'radio-grid',
      'star_rating_grid': 'star-rating-grid',
      'star-rating-grid': 'star-rating-grid',
      'nps': 'nps',
      'numerical_input': 'numerical-input',
      'numerical-input': 'numerical-input',
      'email_input': 'email-input',
      'email-input': 'email-input',
      'date_picker': 'date-picker',
      'date-picker': 'date-picker',
      'star_rating': 'star-rating',
      'signature': 'signature',
      'single_image_select': 'single-image-select',
      'single-image-select': 'single-image-select',
      'multiple_image_select': 'multiple-image-select',
      'multiple-image-select': 'multiple-image-select',
      'document_upload': 'document-upload',
      'document-upload': 'document-upload',
      'interactive_ranking': 'interactive-ranking',
      'interactive-ranking': 'interactive-ranking'
    };
    return typeMap[type] || type;
  };

  return (
    <div className="page-container">
      <Sidebar businessContext={businessContext} />
      <div className="main-content3">
        <div className="guided-survey-container">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          <div className="progress-header">
            <div className="steps-progress" data-step={step}>
              {[1, 2, 3, 4].map(stepNumber => (
                <div
                  key={stepNumber}
                  className={`step-indicator ${stepNumber === step ? 'active' : ''} ${stepNumber < step ? 'completed' : ''}`}
                >
                  {stepNumber < step ? '' : stepNumber}
                </div>
              ))}
            </div>
          </div>

          <div className="step-container">
            {renderStepContent()}
          </div>

          <div className="step-navigation">
            {step > 1 && step < 5 && (
              <button onClick={handleBack} className="nav-button back">
                Back
              </button>
            )}
            {step < 5 && (
              <button
                onClick={handleNext}
                className={`nav-button next ${!canProceed() ? 'disabled' : ''}`}
                disabled={!canProceed()}
              >
                {step === 4 ? 'Generate Survey' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedSurveyBuilder;
