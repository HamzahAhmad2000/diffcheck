// SurveyGenerator.js with modern visuals matching CreateSurvey
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import SurveySettingsModal from './SurveySettingsModal';
import QuestionEditorModal from './QuestionEditorModal';
import AdvancedBranchEditor from './AdvancedBranchEditor';
import QuestionBank from './QuestionBank';
import aiService from '../../services/aiService';
import { aiAPI, surveyAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';
import '../../styles/CreateSurvey.css';

const DESCRIPTION_WORD_LIMIT = 100;

/**
 * Helper to transform a generated survey question into the format expected by our creator UI.
 */
const transformQuestion = (q) => {
  let type = q.question_type;
  if (type === 'multiple_choice') type = 'multi-choice';
  if (type === 'short_text') type = 'open-ended';
  if (type === 'single_choice') type = 'single-choice';

  let options = [];
  if (q.options) {
    if (Array.isArray(q.options)) {
      if (q.options.length > 0 && typeof q.options[0] === 'string') {
        options = q.options.map(opt => ({ text: opt }));
      } else {
        options = q.options;
      }
    } else if (typeof q.options === 'object') {
      options = Object.values(q.options).map(opt => (typeof opt === 'string' ? { text: opt } : opt));
    }
  }

  return {
    id: q.id || `temp-${Date.now()}-${Math.random()}`,
    type,
    text: q.question_text || q.text || '',
    question_text_html: q.question_text_html || q.question_text || q.text || '',
    description: q.description || '',
    additional_text: q.additional_text || '',
    options,
    branch: q.branch || null,
    image_url: q.image_url || '',
    rating_start: q.rating_start || (type === 'rating' ? 1 : ''),
    rating_end: q.rating_end || (type === 'rating' ? 10 : ''),
    rating_step: q.rating_step || 1,
    rating_unit: q.rating_unit || '',
    required: q.required || false,
    sequence_number: q.sequence_number || 0,
    scale_points: q.scale_points || (type === 'scale' ? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] : []),
    show_na: q.show_na || false,
    not_applicable_text: q.not_applicable_text || 'Not Applicable',
    saved: true,
  };
};

const cleanGeneratedSurvey = (survey) => {
  if (!survey) return { title: '', description: '', questions: [] };
  
  const { id, questions, ...rest } = survey;
  return {
    ...rest,
    questions: questions ? questions.map(q => transformQuestion(q)) : [],
  };
};

const SurveyGenerator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State declarations
  const [surveyData, setSurveyData] = useState(null);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveySettings, setSurveySettings] = useState({
    description: '',
    endDate: '',
    participantMin: '',
    participantMax: '',
    brandingUrl: '',
  });
  const [questions, setQuestions] = useState([]);
  const [activeQuestionEditors, setActiveQuestionEditors] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [branchEditing, setBranchEditing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [continuationChat, setContinuationChat] = useState([]);
  const [continuationInput, setContinuationInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState(false);
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);
  const [participantErrors, setParticipantErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const chatEndRef = useRef(null);
  
  // Load survey data from location state or localStorage
  useEffect(() => {
    let data = location.state?.generatedSurvey;
    
    if (!data) {
      const currentSurvey = localStorage.getItem('currentGeneratedSurvey');
      if (currentSurvey) {
        try {
          data = JSON.parse(currentSurvey);
          localStorage.removeItem('currentGeneratedSurvey');
        } catch (e) {
          console.error("Error parsing current survey:", e);
        }
      }
      
      if (!data) {
        const storedSurvey = localStorage.getItem('generatedSurvey');
        if (storedSurvey) {
          try {
            data = JSON.parse(storedSurvey);
          } catch (e) {
            console.error("Error parsing stored survey:", e);
          }
        }
      }
    }
    
    setSurveyData(data);
    
    if (data) {
      const cleanedSurvey = cleanGeneratedSurvey(data);
      setSurveyTitle(cleanedSurvey.title || '');
      setSurveySettings({
        description: cleanedSurvey.description || '',
        endDate: cleanedSurvey.end_date || '',
        participantMin: '',
        participantMax: cleanedSurvey.participant_limit || '',
        brandingUrl: cleanedSurvey.branding || '',
      });
      setQuestions(cleanedSurvey.questions || []);
    }
  }, [location.state]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [continuationChat]);

  // Question type menu options
  const questionTypes = [
    { type: 'single-choice', label: 'Single Choice', icon: 'ri-radio-button-line' },
    { type: 'multi-choice', label: 'Multiple Choice', icon: 'ri-checkbox-multiple-line' },
    { type: 'open-ended', label: 'Open Ended', icon: 'ri-edit-box-line' },
    { type: 'rating', label: 'Rating Scale', icon: 'ri-star-line' },
    { type: 'scale', label: 'Scale', icon: 'ri-bar-chart-line' },
    { type: 'nps', label: 'NPS', icon: 'ri-thumb-up-line' },
    { type: 'dropdown', label: 'Dropdown', icon: 'ri-arrow-down-s-line' },
    { type: 'email-input', label: 'Email Input', icon: 'ri-mail-line' },
    { type: 'numerical-input', label: 'Number Input', icon: 'ri-hashtag' },
    { type: 'date-picker', label: 'Date Picker', icon: 'ri-calendar-line' },
  ];

  const validateParticipantLimits = (min, max) => {
    const errors = {};
    const minNum = parseInt(min);
    const maxNum = parseInt(max);
    
    if (min && minNum < 0) errors.min = "Minimum must be 0 or greater";
    if (max && maxNum < 0) errors.max = "Maximum must be 0 or greater";
    if (min && max && minNum > maxNum) errors.max = "Maximum must be greater than minimum";
    
    return errors;
  };

  const toggleQuestionTypeMenu = () => {
    if (!showQuestionTypeMenu) {
      setShowQuestionTypeMenu(true);
      setIsAddButtonHovered(true);
    } else {
      setShowQuestionTypeMenu(false);
      setIsAddButtonHovered(false);
    }
  };

  const handleSelectQuestionType = (questionType) => {
    setSelectedQuestionType(questionType);
    setShowQuestionTypeMenu(false);

    const newEditor = {
      id: Date.now(),
      type: questionType,
      index: null,
      position: activeQuestionEditors.length,
    };

    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
  };

  const handleSaveQuestion = (questionDataFromModal, editorIdOrAssociatedQuestionId) => {
    let existingQuestionIndex = -1;
    
    if (questionDataFromModal.id) {
      existingQuestionIndex = questions.findIndex(q => q.id === questionDataFromModal.id);
    }
    
    if (existingQuestionIndex === -1 && typeof editorIdOrAssociatedQuestionId === 'string') {
      existingQuestionIndex = questions.findIndex(q => q.id === editorIdOrAssociatedQuestionId);
    }

    let finalQuestionsArray;
    if (existingQuestionIndex !== -1) {
      finalQuestionsArray = [...questions];
      finalQuestionsArray[existingQuestionIndex] = {
        ...finalQuestionsArray[existingQuestionIndex],
        ...questionDataFromModal,
        saved: true,
      };
    } else {
      const newQuestion = {
        id: questionDataFromModal.id || `temp-${Date.now()}-${Math.random()}`,
        ...questionDataFromModal,
        saved: true,
      };
      finalQuestionsArray = [...questions, newQuestion];
    }

    const updatedQuestions = finalQuestionsArray.map((q, i) => ({
      ...q,
      sequence_number: i + 1,
    }));

    setQuestions(updatedQuestions);

    if (activeQuestionEditors.some(ed => ed.id === editorIdOrAssociatedQuestionId) && existingQuestionIndex === -1) {
      setActiveQuestionEditors(prevEditors => prevEditors.filter(ed => ed.id !== editorIdOrAssociatedQuestionId));
    }
  };

  const handleCancelQuestion = (editorId) => {
    const editorIndex = activeQuestionEditors.findIndex(ed => ed.id === editorId);
    if (editorIndex === -1) return;

    const updatedEditors = [...activeQuestionEditors];
    updatedEditors.splice(editorIndex, 1);
    updatedEditors.forEach((ed, idx) => {
      ed.position = idx;
    });

    setActiveQuestionEditors(updatedEditors);
    if (editingQuestionIndex !== null) {
      setEditingQuestionIndex(null);
    }
  };

  const moveQuestionUp = (index) => {
    if (index === 0) return;
    const newQuestions = [...questions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    const updatedQuestions = newQuestions.map((q, i) => ({ ...q, sequence_number: i + 1 }));
    setQuestions(updatedQuestions);
  };

  const moveQuestionDown = (index) => {
    if (index >= questions.length - 1) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    const updatedQuestions = newQuestions.map((q, i) => ({ ...q, sequence_number: i + 1 }));
    setQuestions(updatedQuestions);
  };

  const handleDeleteQuestion = (indexToDelete) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    const finalQuestionsArray = questions.filter((_, i) => i !== indexToDelete);
    const updatedQuestions = finalQuestionsArray.map((q, i) => ({ ...q, sequence_number: i + 1 }));
    setQuestions(updatedQuestions);
    toast.success('Question deleted successfully');
  };

  const handleContinueChatSubmit = async (e) => {
    e.preventDefault();
    
    if (!continuationInput.trim()) return;
    
    const userMessage = { role: 'user', content: continuationInput };
    setContinuationChat(prev => [...prev, userMessage]);
    setContinuationInput('');
    setIsChatLoading(true);
    
    try {
      const surveyId = surveyData?.id;
      
      const currentSurveyState = {
        title: surveyTitle,
        description: surveySettings.description,
        questions: questions.map(q => ({
          question_text: q.text,
          question_type: q.type,
          options: q.options,
          description: q.description,
          additional_text: q.additional_text,
          required: q.required,
          sequence_number: q.sequence_number
        }))
      };
      
      const response = await aiAPI.regenerateSurvey(currentSurveyState, continuationInput, surveyId);
      const data = response.data;
      
      setContinuationChat(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || 'Survey updated successfully!'
      }]);
      
      if (data.regenerated_survey) {
        const regenerated = data.regenerated_survey;
        setSurveyTitle(regenerated.title || surveyTitle);
        setSurveySettings(prev => ({
          ...prev,
          description: regenerated.description || prev.description
        }));
        
        if (regenerated.questions && Array.isArray(regenerated.questions)) {
          const transformedQuestions = regenerated.questions.map(q => transformQuestion(q));
          setQuestions(transformedQuestions);
        }
      }
      
      toast.success('Survey updated by AI!');
    } catch (error) {
      console.error("Error in survey regeneration:", error);
      setContinuationChat(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error while processing your request. Please try again.'
        }
      ]);
      toast.error('Failed to update survey with AI');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveSurvey = async () => {
    if (!surveyTitle.trim()) {
      toast.error('Please enter a survey title before saving.');
      return;
    }
    
    if (questions.length === 0) {
      toast.error('Please add at least one question to your survey.');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    const payload = {
      title: surveyTitle,
      description: surveySettings.description,
      end_date: surveySettings.endDate || null,
      participant_limit: surveySettings.participantMax ? Number(surveySettings.participantMax) : null,
      branding: surveySettings.brandingUrl,
      questions: questions.map((q) => ({
        question_text: q.text,
        description: q.description,
        additional_text: q.additional_text,
        question_type: q.type,
        options: q.options || null,
        branch: q.branch,
        image_url: q.image_url,
        rating_start: q.rating_start || null,
        rating_end: q.rating_end || null,
        rating_step: q.rating_step || null,
        rating_unit: q.rating_unit || '',
        required: q.required || false,
        sequence_number: q.sequence_number,
        scale_points: q.scale_points || null,
        show_na: q.show_na || false,
        not_applicable_text: q.not_applicable_text || '',
      })),
    };
    
    try {
      await surveyAPI.create(payload);
      
      localStorage.removeItem('generatedSurvey');
      localStorage.removeItem('currentGeneratedSurvey');
      
      setSaveSuccess(true);
      toast.success('Survey saved successfully!');
      
      setTimeout(() => {
        navigate('/surveys');
      }, 2000);

    } catch (error) {
      console.error("Error saving survey:", error);
      setSaveError("Failed to save survey. Please try again.");
      toast.error("Failed to save survey");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuestionBankToggle = (isVisible) => {
    setShowQuestionBank(isVisible);
  };

  const QuestionTypeMenu = () => (
    <div className={`question-type-container ${showQuestionTypeMenu ? 'show' : ''}`}>
      <button
        className={`add-question-button ${isAddButtonHovered ? 'hovered' : ''}`}
        onClick={toggleQuestionTypeMenu}
        onMouseEnter={() => setIsAddButtonHovered(true)}
        onMouseLeave={() => !showQuestionTypeMenu && setIsAddButtonHovered(false)}
      >
        <i className="ri-add-line"></i>
        <span>Add Question</span>
      </button>

      {showQuestionTypeMenu && (
        <div className="question-type-menu">
          <div className="question-type-grid">
            {questionTypes.map((type) => (
              <button
                key={type.type}
                className="question-type-option"
                onClick={() => handleSelectQuestionType(type.type)}
              >
                <i className={type.icon}></i>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAIChat = () => (
    <div className="ai-chat-section">
      <div className="ai-chat-header">
        <h3 className="ai-chat-title">
          <i className="ri-robot-line"></i>
          Continue Editing with AI
        </h3>
        <p className="ai-chat-subtitle">
          Ask the AI to modify questions, add new ones, or change the survey structure
        </p>
      </div>

      <div className="ai-chat-container">
        <div className="ai-chat-messages">
          {continuationChat.length === 0 ? (
            <div className="ai-chat-empty">
              <i className="ri-message-3-line"></i>
              <p>Start a conversation with AI to edit your survey</p>
            </div>
          ) : (
            continuationChat.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                <div className="message-content">
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="ai-message assistant loading">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleContinueChatSubmit} className="ai-chat-input-form">
          <div className="ai-chat-input-container">
            <input
              type="text"
              value={continuationInput}
              onChange={(e) => setContinuationInput(e.target.value)}
              placeholder="Ask AI to modify your survey..."
              className="ai-chat-input"
              disabled={isChatLoading}
            />
            <button
              type="submit"
              disabled={isChatLoading || !continuationInput.trim()}
              className="ai-chat-send"
            >
              <i className="ri-send-plane-line"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!surveyData && !location.state?.generatedSurvey) {
    // Check if there's any generated survey data in localStorage before showing empty state
    const currentSurvey = localStorage.getItem('currentGeneratedSurvey');
    const storedSurvey = localStorage.getItem('generatedSurvey');
    
    if (!currentSurvey && !storedSurvey) {
      return (
        <div className="page-container">
          <Sidebar />
          <div className="main-content">
            <div className="empty-state">
              <div className="empty-state-icon">
                <i className="ri-survey-line"></i>
              </div>
              <h2>No Survey Data Available</h2>
              <p>Please generate a survey using the AI Survey Builder first.</p>
              <div className="empty-state-actions">
                <button 
                  onClick={() => navigate('/survey-builder/guided')}
                  className="primary-button"
                >
                  <i className="ri-magic-line"></i>
                  Generate Survey with AI
                </button>
                <button 
                  onClick={() => navigate('/surveys')}
                  className="secondary-button"
                >
                  <i className="ri-arrow-left-line"></i>
                  Back to Surveys
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content">
        <div className="create-survey-container">
          {saveSuccess && (
            <div className="success-overlay">
              <div className="success-content">
                <div className="success-icon">
                  <i className="ri-check-line"></i>
                </div>
                <h2>Survey Saved Successfully!</h2>
                <p>Redirecting to your surveys...</p>
              </div>
            </div>
          )}

          <div className="header">
            <button className="back-button" onClick={() => navigate('/surveys')}>
              <i className="ri-arrow-left-line"></i>
              Leave
            </button>
            <h1 className="title">Edit AI Generated Survey</h1>
          </div>

          <div className="ai-generated-badge">
            <i className="ri-robot-line"></i>
            <span>This survey was generated with AI. You can edit any question by clicking on it.</span>
          </div>

          <div className="input-container">
            <label className="input-label">Survey Title (Visible to Participants)</label>
            <input
              type="text"
              value={surveyTitle}
              onChange={(e) => setSurveyTitle(e.target.value)}
              className="survey-input"
              placeholder="Enter a descriptive title for your survey"
            />
          </div>

          <div className="input-container">
            <label className="input-label">Survey Description (Visible to Participants, Optional)</label>
            <textarea
              value={surveySettings.description}
              onChange={(e) => {
                const words = e.target.value.split(/\s+/).filter(Boolean);
                const limited =
                  words.length > DESCRIPTION_WORD_LIMIT
                    ? words.slice(0, DESCRIPTION_WORD_LIMIT).join(" ")
                    : e.target.value;
                setSurveySettings({ ...surveySettings, description: limited });
              }}
              className="survey-textarea"
              placeholder="Provide context about your survey (optional)"
              rows={3}
            />
          </div>

          <div className="settings-row">
            <div className="settings-field-full">
              <label className="settings-label">Participant Number (Optional)</label>
              <div className="participant-number-inputs">
                <div>
                  <label className="settings-label">Min</label>
                  <input
                    type="number"
                    value={surveySettings.participantMin}
                    onChange={(e) => {
                      const newMin = e.target.value;
                      const errors = validateParticipantLimits(newMin, surveySettings.participantMax);
                      setParticipantErrors(errors);
                      setSurveySettings({ ...surveySettings, participantMin: newMin });
                    }}
                    min="0"
                    className={`settings-input ${participantErrors.min ? 'error' : ''}`}
                  />
                  {participantErrors.min && (
                    <div className="error-message">{participantErrors.min}</div>
                  )}
                </div>
                <div>
                  <label className="settings-label">Max</label>
                  <input
                    type="number"
                    value={surveySettings.participantMax}
                    onChange={(e) => {
                      const newMax = e.target.value;
                      const errors = validateParticipantLimits(surveySettings.participantMin, newMax);
                      setParticipantErrors(errors);
                      setSurveySettings({ ...surveySettings, participantMax: newMax });
                    }}
                    min="0"
                    className={`settings-input ${participantErrors.max ? 'error' : ''}`}
                  />
                  {participantErrors.max && (
                    <div className="error-message">{participantErrors.max}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <h2 className="survey-questions-heading">Survey Questions</h2>

          {questions.length === 0 ? (
            <div className="empty-questions-state">
              <h3>No Questions Added Yet</h3>
              <p>Click one of the options below to start adding to your survey</p>
            </div>
          ) : (
            <div className="questions-container">
              {questions.map((question, index) => (
                <QuestionEditorModal
                  key={question.id || `q-${index}`}
                  editorId={question.id || `question-${index}`}
                  isOpen={true}
                  initialQuestion={question}
                  onSave={(questionData) => handleSaveQuestion(questionData, question.id || `question-${index}`)}
                  allSurveyQuestions={questions}
                  questionNumber={index + 1}
                  totalQuestions={questions.length}
                  onMoveUp={() => moveQuestionUp(index)}
                  onMoveDown={() => moveQuestionDown(index)}
                  onDelete={() => handleDeleteQuestion(index)}
                  onCopy={(questionData) => {
                    const newQuestions = [...questions];
                    newQuestions.splice(index + 1, 0, {
                      ...questionData,
                      id: `temp-${Date.now()}-${Math.random()}`,
                      sequence_number: index + 2,
                      text: `${questionData.text} - Copy`,
                      question_text_html: questionData.question_text_html ? `${questionData.question_text_html} - Copy` : undefined,
                    });
                    const resequencedQuestions = newQuestions.map((q, idx) => ({ ...q, sequence_number: idx + 1 }));
                    setQuestions(resequencedQuestions);
                  }}
                  isFirst={index === 0}
                  isLast={index === questions.length - 1}
                  customStyles={{
                    overlay: "modal-overlay",
                    content: "modal-preview",
                    header: "modal-header",
                    title: "modal-title",
                    closeButton: "modal-close-button",
                    footer: "modal-footer",
                    cancelButton: "modal-cancel-button",
                    saveButton: "modal-save-button",
                    input: "survey-input",
                    textarea: "survey-textarea",
                    inputLabel: "input-label",
                  }}
                />
              ))}
            </div>
          )}

          <QuestionTypeMenu />

          {activeQuestionEditors.map((editor, idx) => (
            <QuestionEditorModal
              key={editor.id}
              editorId={editor.id}
              isOpen={true}
              initialQuestion={{
                text: "",
                description: "",
                additional_text: "",
                type: editor.type,
                options: editor.type === "single-choice" || editor.type === "multi-choice" ? [{ text: "Option 1" }, { text: "Option 2" }] : [],
                required: false,
                image_url: "",
                rating_start: editor.type === "rating" ? 0 : "",
                rating_end: editor.type === "rating" ? 10 : "",
                rating_step: 1,
                rating_unit: "",
                scale_points: editor.type === "scale" ? ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] : [],
                show_na: editor.type === "scale",
                not_applicable_text: "Not Applicable",
              }}
              onSave={(questionData) => handleSaveQuestion(questionData, editor.id)}
              onCancel={() => handleCancelQuestion(editor.id)}
              position={idx}
              questionNumber={questions.length + idx + 1}
              totalQuestions={questions.length + activeQuestionEditors.length}
              customStyles={{
                overlay: "modal-overlay",
                content: `modal modal-stacked-${editor.position}`,
                header: "modal-header",
                title: "modal-title",
                closeButton: "modal-close-button",
                footer: "modal-footer",
                cancelButton: "modal-cancel-button",
                saveButton: "modal-save-button",
                input: "survey-input",
                textarea: "survey-textarea",
                inputLabel: "input-label",
              }}
              allSurveyQuestions={questions}
            />
          ))}

          {renderAIChat()}

          <div className="add-content-options">
            <h3 className="add-content-title">Add to your survey</h3>
            <div className="add-content-buttons">
              <button
                className="add-content-button"
                onClick={() => setShowQuestionTypeMenu(true)}
              >
                <span className="content-option-text">Questions</span>
              </button>
              <button
                className="add-content-button"
                onClick={() => handleQuestionBankToggle(true)}
              >
                <span className="content-option-text">From Library</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveSurvey}
            className={`save-button ${questions.length === 0 ? 'save-button--disabled' : ''}`}
            disabled={questions.length === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Survey'}
          </button>

          {/* Question Bank Overlay */}
          <div 
            className={`question-bank-overlay ${showQuestionBank ? 'show' : ''}`}
            onClick={() => handleQuestionBankToggle(false)}
          ></div>

          {/* Question Bank Sidebar */}
          <div className={`question-bank-sidebar ${showQuestionBank ? 'show' : ''}`}>
            <div className="question-bank-header">
              <h3 className="question-bank-title">
                <i className="ri-stack-line"></i>
                Question Library
              </h3>
              <div className="question-bank-actions">
                <button
                  onClick={() => handleQuestionBankToggle(false)}
                  className="question-bank-close"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            </div>

            <div className="question-bank-content">
              <QuestionBank
                onCopyQuestion={(bankQ) => {
                  const transformed = {
                    text: bankQ.question_text,
                    type: bankQ.question_type,
                    options: bankQ.options || [],
                    image_url: bankQ.image_url || "",
                    rating_start: bankQ.rating_start || "",
                    rating_end: bankQ.rating_end || "",
                    rating_step: bankQ.rating_step || "",
                    rating_unit: bankQ.rating_unit || "",
                    required: false,
                  };
                  handleSaveQuestion(transformed);
                  handleQuestionBankToggle(false);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyGenerator;