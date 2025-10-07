import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { v4 as uuidv4 } from 'uuid';
import QuestionEditorModal, { defaultQuestion } from './QuestionEditorModal';
import SurveySettingsModal from './SurveySettingsModal';
import AdvancedBranchEditor from './AdvancedBranchEditor';
import QuestionBank from './QuestionBank';
import SavedQuestionPreview from './SavedQuestionPreview';
import Sidebar from '../common/Sidebar';
import "../../styles/QuestionBank.css";
import "../../styles/CreateSurvey.css";

const DESCRIPTION_WORD_LIMIT = 100;
import { surveyAPI, questionBankAPI, aiAPI } from 'services/apiClient';
import EditSurvey from './EditSurvey';
import '../../styles/fonts.css';
import { toast } from 'react-hot-toast';
import { businessAPI } from 'services/apiClient';
import { useBusiness } from '../../services/BusinessContext';

const resequenceWithLogic = (questions) => {
  const sequenceMapping = {};
  questions.forEach((q, idx) => {
    if (q.sequence_number !== undefined) {
      sequenceMapping[q.sequence_number] = idx + 1;
    }
  });

  return questions.map((q, idx) => {
    const newSeq = idx + 1;
    let updatedLogic = q.conditional_logic_rules;

    if (updatedLogic && updatedLogic.baseQuestionSequence !== undefined) {
      const mapped = sequenceMapping[updatedLogic.baseQuestionSequence];
      if (mapped !== undefined) {
        updatedLogic = { ...updatedLogic, baseQuestionSequence: mapped };
      }
    }

    return { ...q, sequence_number: newSeq, conditional_logic_rules: updatedLogic };
  });
};

const QuickPoll = () => {
  const { business, loading: bizLoading } = useBusiness();
  const navigate = useNavigate();
  const location = useLocation();

  // User role and user object loaded once per mount
  const userRole = localStorage.getItem('userRole');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Because this is QuickPoll, we only allow up to 3 questions.
  const MAX_QUESTIONS = 3;

  // Decide if we're editing or creating:
  const [isEditMode, setIsEditMode] = useState(false);

  // Survey/QuickPoll Title
  const [surveyTitle, setSurveyTitle] = useState('');

  // Quick Poll settings (same structure as Survey but reused):
  const [showSettings, setShowSettings] = useState(false);
  const [surveySettings, setSurveySettings] = useState({
    startDate: '',
    endDate: '',
    participantLimit: '',
    description: '',
    participantMin: '',
    participantMax: '',
  });

  // The array of questions
  const [questions, setQuestions] = useState([]);

  // For question editor modals
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);

  // For multiple open question editors
  const [activeQuestionEditors, setActiveQuestionEditors] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [branchEditing, setBranchEditing] = useState(null);

  // Hover states for "add question" button and question type menu
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [isMenuHovered, setIsMenuHovered] = useState(false);

  // (Optional) For AI features, if you have them
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [continuationChat, setContinuationChat] = useState([]);
  const [continuationInput, setContinuationInput] = useState('');
  const [isFromAI, setIsFromAI] = useState(false);
  const chatEndRef = useRef(null);

  // Check if the user has reached 3 questions
  const isMaxQuestionsReached = questions.length >= MAX_QUESTIONS;

  // Load data if we're in edit mode
  useEffect(() => {
    const loadSurveyData = async () => {
      if (location.state?.editMode && location.state?.surveyId) {
        setIsEditMode(true);
        try {
          const res = await surveyAPI.getById(location.state.surveyId);
          
          const data = res.data;
          // Set the Quick Poll title & settings
          setSurveyTitle(data.title || '');
          setSurveySettings({
            description: data.description || '',
            endDate: data.end_date ? data.end_date.split('T')[0] : '',
            participantMin: data.participant_min ? data.participant_min.toString() : '',
            participantMax: data.participant_max ? data.participant_max.toString() : '',
          });

          // Transform question array
          if (Array.isArray(data.questions)) {
            const transformedQuestions = data.questions.map((q, index) => ({
              ...defaultQuestion,
              ...q,
              type: transformQuestionType(q.question_type),
              text: q.question_text || '',
              question_text_html: q.question_text_html || q.question_text || '',
              options: Array.isArray(q.options) ? q.options : [],
              image_options: Array.isArray(q.image_options) ? q.image_options : [],
              sequence_number: q.sequence_number !== undefined ? q.sequence_number : index + 1,
              question_uuid: q.question_uuid || uuidv4(),
              saved: true,
              isNew: false,
              conditional_logic_rules: q.conditional_logic_rules || null,
            }));
            setQuestions(transformedQuestions);
          }
        } catch (error) {
          console.error('Error loading Quick Poll:', error);
          alert('Failed to load data');
          navigate('/surveys');
        }
      }
    };
    loadSurveyData();
  }, [location.state, navigate]);

  // If you have AI-generation logic, handle it here:
  useEffect(() => {
    if (location.state?.fromAiGeneration) {
      setIsFromAI(true);
      const generatedData = location.state.generatedSurvey;
      setSurveyTitle(generatedData.title || '');
      setSurveySettings(prev => ({
        ...prev,
        description: generatedData.description || ''
      }));
      // Only allow 3 questions if from AI
      if (Array.isArray(generatedData.questions)) {
        const transformedQuestions = generatedData.questions
          .slice(0, MAX_QUESTIONS)
          .map((q, index) => ({
            ...defaultQuestion,
            ...q,
            type: transformQuestionType(q.type || q.question_type),
            text: q.text || q.question_text || '',
            question_text_html: q.question_text_html || q.question_text || '',
            options: Array.isArray(q.options) ? q.options : [],
            image_options: Array.isArray(q.image_options) ? q.image_options : [],
            sequence_number: index + 1,
            question_uuid: q.question_uuid || uuidv4(),
            saved: true,
          }));
        setQuestions(transformedQuestions);
      }
    }
  }, [location.state]);

  // Make sure chat view always scrolls to the bottom:
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [continuationChat]);

  // If you have a function to transform AI question types, define it:
const transformQuestionType = (type) => {
    const typeMap = {
      multiple_choice: 'multiple-choice',
      single_choice:   'single-choice',
      short_text:      'open-ended',
      long_text:       'open-ended',
      rating_scale:    'slider',
      radio_grid:      'radio-grid',
      checkbox_grid:   'checkbox-grid',
      star_rating_grid:'star-rating-grid',
    };
    return typeMap[type] || type || 'open-ended';
  };

  // ------------------------------------------------
  // Survey Settings Handlers (same as in create)
  // ------------------------------------------------
  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);
  const handleSaveSettings = (settings) => {
    setSurveySettings(settings);
    setShowSettings(false);
  };

  // ------------------------------------------------
  // Question Editor Modals
  // ------------------------------------------------
  const [menuRef, setMenuRef] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef && !menuRef.contains(event.target)) {
        setShowQuestionTypeMenu(false);
        setIsAddButtonHovered(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef]);

  const toggleQuestionTypeMenu = () => {
    if (isMaxQuestionsReached) {
      alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    setShowQuestionTypeMenu(!showQuestionTypeMenu);
    setIsAddButtonHovered(!showQuestionTypeMenu);
  };

  const handleSelectQuestionType = (questionType) => {
    if (isMaxQuestionsReached) {
        toast.error(`Quick Polls are limited to ${MAX_QUESTIONS} questions.`);
        setShowQuestionTypeMenu(false);
        return;
    }
    setShowQuestionTypeMenu(false);

    const newQuestion = {
        ...defaultQuestion,
        id: uuidv4(), // A unique ID for the component key and save handler
        type: questionType,
        saved: false, // This ensures it opens in edit mode
        isNew: true,
    };

    if (['single-choice', 'multi-choice'].includes(questionType)) {
        newQuestion.options = [{ text: '' }, { text: '' }];
    }

    setQuestions([...questions, newQuestion]);
  };



  const openAddQuestionModal = () => {
    if (isMaxQuestionsReached) {
      alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    setEditingQuestionIndex(null);
    setIsQuestionModalOpen(true);
  };

  const handleAddFromEditor = (questionType) => {
    if (isMaxQuestionsReached) {
      alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    const newEditor = {
      id: Date.now(),
      type: questionType || 'open-ended',
      index: null,
      position: activeQuestionEditors.length
    };
    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
  };

  const handleSaveQuestion = (questionData, questionId) => {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    
    let newQuestions;
    if (questionIndex !== -1) {
      // Editing an existing question or finalizing a new one
      newQuestions = [...questions];
      newQuestions[questionIndex] = { 
        ...newQuestions[questionIndex], // Preserve existing properties like UUID
        ...questionData,               // Apply changes from the editor
        saved: true,                   // Mark as saved to show preview
        isNew: false,
      };
    } else {
      // This path is for adding a question from the question bank
      if (isMaxQuestionsReached) {
        toast.error(`Quick Polls are limited to ${MAX_QUESTIONS} questions.`);
        return;
      }
      newQuestions = [...questions, { ...questionData, id: uuidv4(), saved: true }];
    }
    
    setQuestions(resequenceWithLogic(newQuestions));
  };

  // Cancel question from a specific editor
  const handleCancelQuestion = (editorId) => {
    const editorIndex = activeQuestionEditors.findIndex(ed => ed.id === editorId);
    if (editorIndex === -1) return;
    const updatedEditors = [...activeQuestionEditors];
    updatedEditors.splice(editorIndex, 1);
    updatedEditors.forEach((ed, idx) => { ed.position = idx; });
    setActiveQuestionEditors(updatedEditors);

    if (editingQuestionIndex !== null) {
      setEditingQuestionIndex(null);
    }
  };

  // ------------------------------------------------
  // Question List Handlers
  // ------------------------------------------------
  const updateSequenceNumbers = (qs) => {
    // Create a mapping of old sequence numbers to new sequence numbers
    const sequenceMapping = {};
    qs.forEach((q, i) => {
      if (q.sequence_number !== undefined) {
        sequenceMapping[q.sequence_number] = i + 1;
      }
    });

    return qs.map((q, i) => {
      let updatedQuestion = {
        ...q,
        sequence_number: i + 1,
      };

      // Update conditional logic references if they exist
      if (updatedQuestion.conditional_logic_rules &&
          updatedQuestion.conditional_logic_rules.baseQuestionSequence !== undefined) {
        const oldBaseSequence = updatedQuestion.conditional_logic_rules.baseQuestionSequence;
        const newBaseSequence = sequenceMapping[oldBaseSequence];

        if (newBaseSequence !== undefined) {
          updatedQuestion.conditional_logic_rules = {
            ...updatedQuestion.conditional_logic_rules,
            baseQuestionSequence: newBaseSequence
          };
          console.log(`[QUICKPOLL_REORDER] Updated conditional logic for Q${i + 1}: base question reference changed from Q${oldBaseSequence} to Q${newBaseSequence}`);
        } else {
          // If the base question was deleted, clear the conditional logic
          console.log(`[QUICKPOLL_REORDER] Clearing conditional logic for Q${i + 1}: base question Q${oldBaseSequence} no longer exists`);
          updatedQuestion.conditional_logic_rules = null;
        }
      }

      if (updatedQuestion.conditional_logic_rules && updatedQuestion.conditional_logic_rules.baseQuestionUuid) {
        // UUID reference remains valid; nothing to update
      }

      return updatedQuestion;
    });
  };

  const moveQuestionUp = (index) => {
    if (index === 0) return;
    const newQuestions = [...questions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    setQuestions(resequenceWithLogic(newQuestions));
  };

  const moveQuestionDown = (index) => {
    if (index >= questions.length - 1) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    setQuestions(resequenceWithLogic(newQuestions));
  };

  const handleCopyQuestion = (index, questionData) => {
    console.log(`[QuickPoll] handleCopyQuestion called with index: ${index}, questionData:`, questionData);
    if (questions.length >= MAX_QUESTIONS) {
      alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    
    // If questionData is passed (from SavedQuestionPreview), use it directly
    if (questionData) {
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, {
        ...questionData,
        id: undefined,
        question_uuid: uuidv4(),
        text: questionData.text, // SavedQuestionPreview already adds " - Copy"
        sequence_number: questions.length + 1
      });
      setQuestions(resequenceWithLogic(newQuestions));
    } else if (typeof index === 'object') {
      // Legacy: direct with question data (when index is actually questionData)
      questionData = index;
      const newQuestions = [...questions];
      newQuestions.push({
        ...questionData,
        id: undefined,
        question_uuid: uuidv4(),
        text: `${questionData.text} (Copy)`,
        sequence_number: questions.length + 1
      });
      setQuestions(resequenceWithLogic(newQuestions));
    } else {
      // Legacy: called with index only
      const toCopy = questions[index];
      const copy = {
        ...toCopy,
        id: undefined,
        question_uuid: uuidv4(),
        text: `${toCopy.text} (Copy)`,
        sequence_number: questions.length + 1
      };
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, copy);
      setQuestions(resequenceWithLogic(newQuestions));
    }
  };

  const handleDeleteQuestion = (index) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updateSequenceNumbers(newQuestions));
  };

  // Handle deletion from QuestionEditorModal - for both saved questions and active editors
  const handleDeleteQuestionFromEditor = (questionIdOrEditorId) => {
    console.log("[QuickPoll] handleDeleteQuestionFromEditor called with:", questionIdOrEditorId);

    // First check if this is an active editor (unsaved question)
    const editorIndex = activeQuestionEditors.findIndex(editor => 
      editor.id === questionIdOrEditorId
    );
    
    if (editorIndex !== -1) {
      // Remove from active editors
      const newEditors = activeQuestionEditors.filter((_, i) => i !== editorIndex);
      setActiveQuestionEditors(newEditors);
      console.log("[QuickPoll] Removed active editor:", questionIdOrEditorId);
      return;
    }

    // If not an active editor, check if it's a saved question
    const questionIndex = questions.findIndex(q => 
      q.id === questionIdOrEditorId || q.editorId === questionIdOrEditorId
    );
    
    if (questionIndex !== -1) {
      // Remove from saved questions
      handleDeleteQuestion(questionIndex);
      console.log("[QuickPoll] Deleted saved question at index:", questionIndex);
    } else {
      console.warn("[QuickPoll] Could not find question to delete:", questionIdOrEditorId);
    }
  };

  // Branching logic

  const handleBranchEdit = (questionIndex, optionIndex) => {
    setBranchEditing({ questionIndex, optionIndex });
  };
  const handleSaveBranch = (branchData) => {
    if (branchEditing) {
      const { questionIndex, optionIndex } = branchEditing;
      const updated = [...questions];
      const curBranch = updated[questionIndex].branch || {};
      updated[questionIndex].branch = { ...curBranch, [optionIndex]: branchData };
      setQuestions(updated);
      setBranchEditing(null);
    }
  };

  // Add question to question bank
  const handleAddToBank = async (question) => {
    try {
      const payload = {
        question_text: question.text,
        description: question.description,
        additional_text: question.additional_text,
        question_type: question.type,
        options: question.options,
        image_url: question.image_url,
        rating_start: question.rating_start,
        rating_end: question.rating_end,
        rating_step: question.rating_step,
        rating_unit: question.rating_unit,
      };
      const res = await questionBankAPI.addQuestionToBank(payload);
    } catch (error) {
      console.error('Error adding question to the bank:', error);
      alert('Error adding question to the bank.');
    }
  };

  // ------------------------------------------------
  // Save Quick Poll
  // ------------------------------------------------
  const handleSaveSurvey = async () => {
    if (!surveyTitle.trim()) {
      alert('Please provide a Quick Poll title.');
      return;
    }
    if (questions.length === 0) {
      alert('A Quick Poll must have at least one question.');
      return;
    }
    if (questions.length > MAX_QUESTIONS) {
      alert(`A Quick Poll can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }

    const transformedQuestions = questions.map((q, index) => {
      const processedOptions = (Array.isArray(q.options) ? q.options : []).map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return { ...opt, text: String(opt.text || '') };
        }
        if (typeof opt === 'string') {
          return { text: opt, branch: null };
        }
        return { text: '', branch: null };
      });

      return {
        question_text: String(q.text || ''),
        question_text_html: q.question_text_html || q.text || '',
        question_type: q.type || 'open-ended',
        description: String(q.description || ''),
        additional_text: String(q.additional_text || ''),
        options: ['single-choice', 'multi-choice', 'dropdown', 'ranking', 'scale'].includes(q.type)
          ? processedOptions
          : q.options || [],
        image_options: Array.isArray(q.image_options) ? q.image_options : null,
        branch: q.branch || null,
        sequence_number: index + 1,
        image_url: q.image_url || '',
        rating_start: q.rating_start !== '' && q.rating_start !== null ? Number(q.rating_start) : null,
        rating_end: q.rating_end !== '' && q.rating_end !== null ? Number(q.rating_end) : null,
        rating_step: q.rating_step !== '' && q.rating_step !== null ? Number(q.rating_step) : null,
        rating_unit: q.rating_unit || '',
        left_label: q.left_label || null,
        center_label: q.center_label || null,
        right_label: q.right_label || null,
        required: Boolean(q.required),
        not_applicable: Boolean(q.not_applicable),
        has_other_option: Boolean(q.has_other_option),
        other_option_text: q.other_option_text || 'Other (Please specify)',
        grid_rows: q.grid_rows || [],
        grid_columns: q.grid_columns || [],
        disqualify_enabled: q.disqualify_enabled || false,
        disqualify_message: q.disqualify_message || '',
        disqualify_rules: q.disqualify_rules || [],
        numerical_branch_enabled: q.numerical_branch_enabled || false,
        numerical_branch_rules: q.numerical_branch_rules || [],
        min_selection: q.min_selection !== undefined && q.min_selection !== null ? Number(q.min_selection) : null,
        max_selection: q.max_selection !== undefined && q.max_selection !== null ? Number(q.max_selection) : null,
        file_types: q.file_types || [],
        max_file_size: q.max_file_size || null,
        max_files: q.max_files || null,
        ranking_items: q.ranking_items || [],
        signature_options: q.signature_options || {},
        nps_left_label: q.nps_left_label || null,
        nps_right_label: q.nps_right_label || null,
        nps_reversed: Boolean(q.nps_reversed),
        nps_spacing: q.nps_spacing || null,
        min_value: q.min_value !== undefined && q.min_value !== null ? Number(q.min_value) : null,
        max_value: q.max_value !== undefined && q.max_value !== null ? Number(q.max_value) : null,
        allowed_domains: q.allowed_domains || null,
        min_date: q.min_date || null,
        max_date: q.max_date || null,
        show_na: Boolean(q.show_na),
        not_applicable_text: q.not_applicable_text || 'Not Applicable',
        scale_points: q.scale_points || [],
        conditional_logic_rules: q.conditional_logic_rules || null,
      };
    });

    const payload = {
      title: surveyTitle.trim(),
      description: surveySettings.description || '',
      start_date: surveySettings.startDate || null,
      end_date: surveySettings.endDate || null,
      participant_limit: surveySettings.participantLimit
        ? parseInt(surveySettings.participantLimit)
        : null,
      questions: transformedQuestions,
      // CRUCIAL: set is_quick_poll to true for the backend
      is_quick_poll: true 
    };

    try {
      if (isEditMode) {
        if (userRole === 'business_admin' && user.business_id) {
          await businessAPI.updateSurveyForBusiness(user.business_id, location.state.surveyId, payload);
        } else {
          await surveyAPI.update(location.state.surveyId, payload);
        }
      } else {
        if (userRole === 'business_admin' && user.business_id) {
          await businessAPI.createSurveyForBusiness(user.business_id, payload);
        } else {
          await surveyAPI.create(payload);
        }
      }
      
      alert(`Quick Poll ${isEditMode ? 'updated' : 'created'} successfully!`);
      
      // Get user role and user data for proper redirect
      const redirectUserRole = localStorage.getItem('userRole');
      const redirectUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Navigate based on user role
      if (redirectUserRole === 'super_admin' || redirectUserRole === 'admin') {
        navigate('/savedsurveys'); // Super admin goes to general surveys page
      } else if (redirectUserRole === 'business_admin' && redirectUser.business_id) {
        navigate(`/admin/business/${redirectUser.business_id}/surveys/manage`);
      } else {
        navigate('/surveys'); // Fallback to general surveys page
      }
    } catch (error) {
      console.error('Error saving Quick Poll:', error);
      alert(`Error ${isEditMode ? 'updating' : 'creating'} Quick Poll: ${error.message}`);
    }
  };

  // Additional logic if you have an EditSurvey modal or question bank
  const [editingSurvey, setEditingSurvey] = useState(null);
  const handleEditSurvey = (id) => setEditingSurvey(id);
  const handleCloseEdit = () => setEditingSurvey(null);
  const [showQuestionBank, setShowQuestionBank] = useState(false);

  // Simple drag and drop logic
  const handleDragReorder = (fromIndex, toIndex) => {
    const updatedQuestions = [...questions];
    const [movedItem] = updatedQuestions.splice(fromIndex, 1);
    updatedQuestions.splice(toIndex, 0, movedItem);
    const reorderedQuestions = resequenceWithLogic(updatedQuestions);
    setQuestions(reorderedQuestions);
  };

  // Hover logic for the question-type-floating-button
  const handleButtonHover = (hovering) => {
    setIsAddButtonHovered(hovering);
    if (hovering) setShowQuestionTypeMenu(true);
    else handleMouseLeave();
  };
  const handleMenuHover = (hovering) => {
    setIsMenuHovered(hovering);
    if (!hovering) handleMouseLeave();
  };
  const handleMouseLeave = () => {
    setTimeout(() => {
      if (!isAddButtonHovered && !isMenuHovered) {
        setShowQuestionTypeMenu(false);
      }
    }, 100);
  };

  // Handle adding content (text, media, etc.)
  const handleAddContent = (contentType) => {
    if (questions.length >= MAX_QUESTIONS) {
      alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    
    const newEditor = {
      id: Date.now(),
      type: contentType,
      index: null,
      position: activeQuestionEditors.length,
    };

    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
  };

  // (Optional) AI Chat to regenerate questions
  const handleContinueChatSubmit = async (e) => {
    e.preventDefault();
    // Implementation is the same logic as in your CreateSurvey
  };
  const renderAIChat = () => {
    if (!isFromAI) return null;
    return (
      <div className="ai-chat-section">
        {/* your custom AI UI here */}
      </div>
    );
  };

  // Pre-fill title for business admins when creating
  useEffect(() => {
    if (!isEditMode && userRole === 'business_admin' && business && !surveyTitle) {
      setSurveyTitle(`${business.name} Quick Poll`);
    }
  }, [isEditMode, userRole, business]);

  // When business admin, wait for context before rendering main UI
  if (userRole === 'business_admin' && (bizLoading || !business)) {
    return (
      <div className="survey-management"><Sidebar /><div className="create-content"><p>Loading...</p></div></div>
    );
  }

  return (
    <div className="survey-management">
      <div className="sidebarhello">
      <Sidebar />
      </div>
      <div className="create-content">
        <div className="create-header">
          <h1 className="create-title">
            {isEditMode ? 'Edit Quick Poll' : 'Create Quick Poll'}
          </h1>
        </div>

        <div className="create-input-container">
          <label className="create-input-label">
            Quick Poll Title (Visible to Participants)
          </label>
          <input
            type="text"
            value={surveyTitle}
            onChange={(e) => setSurveyTitle(e.target.value)}
            className="survey-input"
          />
        </div>

        <div className="create-input-container">
          <label className="create-input-label">
            Quick Poll Description (Visible to Participants, Optional)
          </label>
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
            style={{ minHeight: "80px" }}
            className="survey-textarea"
          />
        </div>

        <div className="settings-row">
          <div className="settings-field-full">
            <label className="settings-label">
              Participant Number (Optional)
            </label>
            <div className="participant-number-inputs">
              <div>
                <label className="settings-label">Min</label>
                <input
                  type="number"
                  value={surveySettings.participantMin || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSurveySettings((prev) => ({
                      ...prev,
                      participantMin: value,
                    }));
                  }}
                  placeholder="No minimum"
                  className="settings-input"
                />
              </div>
              <div>
                <label className="settings-label">Max</label>
                <input
                  type="number"
                  value={surveySettings.participantMax || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSurveySettings((prev) => ({
                      ...prev,
                      participantMax: value,
                    }));
                  }}
                  placeholder="No maximum"
                  className="settings-input"
                />
              </div>
            </div>
          </div>
        </div>

        <h2 className="survey-questions-heading">Quick Poll Questions</h2>

        {questions.length === 0 ? (
          <div className="empty-questions-state">
            <h3>No Questions Added Yet</h3>
            <p>Click the button below to add a question.</p>
          </div>
        ) : (
          <div className="questions-container">
            {questions.map((question, index) => (
              <QuestionEditorModal
                key={question.id || `q-${index}`}
                editorId={question.id || `q-${index}`}
                isOpen={true}
                initialQuestion={question}
                onSave={(questionData) => handleSaveQuestion(questionData, question.id)}
                allSurveyQuestions={questions}
                questionNumber={index + 1}
                totalQuestions={questions.length}
                onMoveUp={() => moveQuestionUp(index)}
                onMoveDown={() => moveQuestionDown(index)}
                onDelete={() => handleDeleteQuestion(index)}
                onCopy={(questionData) => handleCopyQuestion(index, questionData)}
                isFirst={index === 0}
                isLast={index === questions.length - 1}
                onDragReorder={handleDragReorder}
                isQuickPoll={true}
              />
            ))}
          </div>
        )}

        {showQuestionTypeMenu && (
          <div
            ref={setMenuRef}
            className="newquestion-type-menu"
            onMouseEnter={() => handleMenuHover(true)}
            onMouseLeave={() => handleMouseLeave()}
          >
            {[
              { value: "single-choice", label: "Single Choice" },
              { value: "multi-choice", label: "Multiple Choice" },
              { value: "open-ended", label: "Open-Ended Textbox" },
              { value: "rating", label: "Slider" },
              { value: "nps", label: "NPS (0–10)" },
              { value: "radio-grid", label: "Grid Question" },
              { value: "star-rating", label: "Star Rating" },
              { value: "star-rating-grid", label: "Star Rating Grid" },
              { value: "single-image-select", label: "Single Image Select" },
              { value: "multiple-image-select", label: "Multiple Image Select" },
              { value: "interactive-ranking", label: "Interactive Ranking" }
            ].map((type, index, array) => (
              <button
                key={type.value}
                className={`newquestion-type-option ${index % 2 === 1 ? 'alt' : ''} ${
                  index === 0 ? 'first' : ''
                } ${index === array.length - 1 ? 'last' : ''}`}
                style={{ 
                  height: `${450 / array.length}px`,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '14px',
                  fontWeight: '400'
                }}
                onClick={() => handleSelectQuestionType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        )}



        {branchEditing && (
          <AdvancedBranchEditor
            initialBranch={
              questions[branchEditing.questionIndex].branch
                ? questions[branchEditing.questionIndex].branch[
                    branchEditing.optionIndex
                  ]
                : null
            }
            onSave={handleSaveBranch}
            onCancel={() => setBranchEditing(null)}
            customStyles={{
              overlay: "modal-overlay",
              content: "modal",
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
        )}

        {editingSurvey && (
          <EditSurvey
            surveyId={editingSurvey}
            onClose={handleCloseEdit}
            customStyles={{
              overlay: "modal-overlay",
              content: "modal",
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
        )}

        {renderAIChat()}

        {/* Add content options section - Only show if we haven't reached max questions */}
        {questions.length < MAX_QUESTIONS && (
          <div className="add-content-options">
            <h3 className="add-content-title">
              {isFromAI ? "Manually Add:" : "Add to your Quick Poll"}
            </h3>
            <div className="add-content-buttons">
              <button
                className="add-content-button"
                onClick={() => setShowQuestionTypeMenu(true)}
              >
                <span className="content-option-text">Questions</span>
              </button>
              <button
                className="add-content-button"
                onClick={() => setShowQuestionBank(true)}
              >
                <span className="content-option-text">From Library</span>
              </button>
            </div>
          </div>
        )}

        {/* Show message when max questions reached */}
        {questions.length >= MAX_QUESTIONS && (
          <div className="max-questions-message">
            <div className="max-questions-icon">
              <i className="ri-information-line"></i>
            </div>
            <div className="max-questions-content">
              <p className="max-questions-primary">Maximum number of questions reached ({MAX_QUESTIONS})</p>
              <p className="max-questions-secondary">You can edit or delete existing questions.</p>
            </div>
          </div>
        )}

        <div className="newsave-button-container">
          <button
            onClick={handleSaveSurvey}
            className={`newsave-button ${
              questions.length === 0 ? "save-button--disabled" : ""
            }`}
            disabled={questions.length === 0}
          >
            {isEditMode ? "Update Quick Poll" : "Save Quick Poll"}
          </button>
        </div>

        {/* Question Bank Overlay */}
        <div 
          className={`question-bank-overlay ${showQuestionBank ? 'show' : ''}`}
          onClick={() => setShowQuestionBank(false)}
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
                onClick={() => {
                  console.log("Refreshing question library");
                }}
                className="question-bank-refresh"
                title="Refresh question library"
              >
                <i className="ri-refresh-line"></i>
              </button>
              <button
                onClick={() => setShowQuestionBank(false)}
                className="question-bank-close"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>

          <div className="question-bank-content">
            <QuestionBank
              onCopyQuestion={(bankQ) => {
                if (questions.length >= MAX_QUESTIONS) {
                  alert(`Quick Polls can only have up to ${MAX_QUESTIONS} questions.`);
                  return;
                }
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
                setShowQuestionBank(false);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const buildInitialQuestion = (type) => {
  const base = { ...defaultQuestion, type };
  if (type === 'single-choice' || type === 'multi-choice') {
    base.options = [{ text: '' }, { text: '' }];
  }
  if (type === 'rating') {
    base.rating_start = 1;
    base.rating_end = 10;
    base.rating_step = 1;
    // Let the default labels from QuestionEditorModal be used
  }
  if (type === 'nps') {
    base.rating_start = 0;
    base.rating_end = 10;
    base.rating_step = 1;
  }
  return base;
};

export default QuickPoll;