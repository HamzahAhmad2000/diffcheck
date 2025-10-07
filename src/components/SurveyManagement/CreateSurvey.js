import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import QuestionEditorModal, { defaultQuestion } from "./QuestionEditorModal";
import SurveySettingsModal from "./SurveySettingsModal";
import AdvancedBranchEditor from "./AdvancedBranchEditor";
import QuestionBank from "./QuestionBank";
import { v4 as uuidv4 } from "uuid";
import QuestionList from "./QuestionList";
import toast from "react-hot-toast";
import SavedQuestionPreview from "./SavedQuestionPreview";
import Sidebar from "../common/Sidebar";
import apiClient, {
  surveyAPI,
  questionBankAPI,
  uploadAPI,
  aiAPI,
  analyticsAPI,
} from "../../services/apiClient";

import EditSurvey from "./EditSurvey";
import "../../styles/fonts.css";
import "../../styles/CreateSurvey.css";

const DESCRIPTION_WORD_LIMIT = 100;

const resequenceWithLogic = (questions, oldQuestions) => {
  const sequenceMapping = {};
  questions.forEach((q, idx) => {
    if (q.sequence_number !== undefined) {
      sequenceMapping[q.sequence_number] = idx + 1;
    }
  });

  return questions.map((question, index) => {
    const newSeq = index + 1;
    let updatedLogic = question.conditional_logic_rules;

    if (updatedLogic && updatedLogic.baseQuestionSequence !== undefined) {
      const oldBaseSeq = updatedLogic.baseQuestionSequence;
      const mapped = sequenceMapping[oldBaseSeq];
      if (mapped !== undefined) {
        updatedLogic = { ...updatedLogic, baseQuestionSequence: mapped };
      }
    }

    return { ...question, sequence_number: newSeq, conditional_logic_rules: updatedLogic };
  });
};

const CreateSurvey = ({ initialState }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditMode, setIsEditMode] = useState(false);

  // Extract business context from route state OR props (for business-specific survey creation)
  const locationState = location.state || {};
  const effectiveState = initialState || locationState;
  const { businessId, businessName, fromAiGeneration, generatedSurvey } = effectiveState;

  const [surveyTitle, setSurveyTitle] = useState(
    businessName ? `Survey for ${businessName}` : ""
  );
  const [showSettings, setShowSettings] = useState(false);
  const [surveySettings, setSurveySettings] = useState({
    participantMin: "",
    participantMax: "",
    description: "",
  });

  const [questions, setQuestions] = useState([]);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);
  const [activeQuestionEditors, setActiveQuestionEditors] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [branchEditing, setBranchEditing] = useState(null);
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [isMenuHovered, setIsMenuHovered] = useState(false);
  const [participantErrors, setParticipantErrors] = useState({
    min: "",
    max: "",
  });
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [continuationChat, setContinuationChat] = useState([]);
  const [continuationInput, setContinuationInput] = useState("");
  const [isFromAI, setIsFromAI] = useState(false);
  const chatEndRef = useRef(null);

  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedOverItem, setDraggedOverItem] = useState(null);

  const [menuRef] = useState(useRef(null));

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
      @import url('https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css');
      
      .survey-management * {
        font-family: 'Poppins', sans-serif;
      }
      
      .survey-management h1, 
      .survey-management h2, 
      .survey-management h3, 
      .survey-management h4 {
        font-family: 'Clash Display', sans-serif;
      }

      .survey-management input::placeholder,
      .survey-management textarea::placeholder {
        color: #000 !important;
        font-size: 15px !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // --- Updated useEffect for loading survey data ---
  useEffect(() => {
    const loadSurveyData = async () => {
      // Handle AI Generation Flow first
      if (effectiveState?.fromAiGeneration && effectiveState?.generatedSurvey) {
        console.log("[CreateSurvey] Loading from AI Generation state:", effectiveState.generatedSurvey);
        setIsFromAI(true); // Set this flag if you have specific UI for AI-generated surveys
        setIsEditMode(false); // It's a new survey, even if pre-filled by AI

        const aiSurvey = effectiveState.generatedSurvey;
        setSurveyTitle(aiSurvey.title || (businessName ? `AI Survey for ${businessName}` : "AI Generated Survey"));
        setSurveySettings(prev => ({
          ...prev,
          description: aiSurvey.description || "",
          // Potentially other settings if AI provides them
        }));

        if (Array.isArray(aiSurvey.questions)) {
          const transformedAiQuestions = aiSurvey.questions.map((q, index) => ({
            ...defaultQuestion, // Start with defaults
            ...q, // Spread AI question data
            id: uuidv4(), // Generate new frontend ID
            question_uuid: q.question_uuid || uuidv4(),
            type: transformQuestionType(q.type || q.question_type), // Ensure type is standardized
            text: String(q.text || q.question_text || ''),
            question_text_html: q.question_text_html || q.question_text || q.text || '',
            // Ensure all relevant fields from 'defaultQuestion' are considered and mapped/defaulted
            options: Array.isArray(q.options) ? q.options.map(opt =>
              typeof opt === 'string' ? { text: opt, branch: null } : { ...opt, text: String(opt.text || '') }
            ) : [],
            ranking_items: Array.isArray(q.ranking_items) ? q.ranking_items.map(item =>
              typeof item === 'string' ? { text: item } : { ...item, text: String(item.text || '') }
            ) : defaultQuestion.ranking_items,
            scale_points: q.type === 'scale' ? (Array.isArray(q.scale_points) ? q.scale_points.map(String) : defaultQuestion.scale_points) : [],
            // Add rating/slider defaults for AI generated questions
            rating_start: q.rating_start !== undefined ? q.rating_start : (q.type === 'rating' ? 1 : q.rating_start),
            rating_end: q.rating_end !== undefined ? q.rating_end : (q.type === 'rating' ? 10 : q.rating_end),
            rating_step: q.rating_step !== undefined ? q.rating_step : (q.type === 'rating' ? 1 : q.rating_step),
            left_label: q.left_label || (q.type === 'rating' ? "Low" : ""),
            right_label: q.right_label || (q.type === 'rating' ? "High" : ""),
            center_label: q.center_label || "",
            show_na: q.type === 'scale' ? (q.show_na !== undefined ? q.show_na : defaultQuestion.show_na) : (q.show_na !== undefined ? q.show_na : false),
            not_applicable_text: q.type === 'scale' ? (q.not_applicable_text || defaultQuestion.not_applicable_text) : (q.not_applicable_text || ''),
            saved: false, // Mark as unsaved initially, user needs to hit "Save Survey"
            isNew: true,  // Mark as new
            sequence_number: index + 1,
            conditional_logic_rules: q.conditional_logic_rules || null, // Handle conditional logic
          }));
          setQuestions(transformedAiQuestions);
        }
        // Clear the AI generation state from location to prevent re-processing on refresh/navigation
        // navigate(location.pathname, { replace: true, state: { ...location.state, fromAiGeneration: false, generatedSurvey: null } });
        // Better yet, the parent component (CreateSurveyForBusiness or direct route) should manage this.

      } else if (effectiveState?.editMode && effectiveState?.surveyId) {
        // Existing logic for loading a survey for editing
        setIsEditMode(true);
        setIsFromAI(false); // Not from AI flow
        const loadingToast = toast.loading("Loading survey data..."); // Show loading indicator
        try {
          // Ensure this part correctly gets `businessId` if needed for the API call
          const surveyIdToLoad = effectiveState.surveyId;
          const businessIdForEdit = effectiveState.businessId || businessId; // Get businessId if passed for edit

          console.log(`[CreateSurvey] Editing survey ID: ${surveyIdToLoad}, Business ID: ${businessIdForEdit}`);
          const response = businessIdForEdit
            ? await apiClient.get(`/api/businesses/${businessIdForEdit}/surveys/${surveyIdToLoad}`)
            : await surveyAPI.getById(surveyIdToLoad);
          
          const data = response.data.survey || response.data; // Adapt based on API response structure
          console.log("Survey data loaded:", data);

          // --- State Setting Logic ---
          setSurveyTitle(data.title || "");
          setSurveySettings({
            description: data.description || "",
            participantMin: data.participant_min ?? "", // Use ?? for nullish coalescing
            participantMax: data.participant_max ?? "",
          });

          if (Array.isArray(data.questions)) {
            const transformedQuestions = data.questions.map((q, index) => ({
              ...defaultQuestion,
              ...q,
              id: q.id || uuidv4(),
              type: transformQuestionType(q.question_type),
              text: q.question_text || '',
              question_text_html: q.question_text_html || q.question_text || '',
              options: Array.isArray(q.options) ? q.options.map(opt => {
                // Fix the options processing to prevent data corruption
                if (typeof opt === 'string') {
                  return { text: opt, branch: null };
                } else if (typeof opt === 'object' && opt !== null) {
                  return { 
                    text: String(opt.text || ''), 
                    branch: opt.branch || null 
                  };
                } else {
                  return { text: '', branch: null };
                }
              }) : [],
              // ... map ALL other relevant fields from backend to frontend question structure
              saved: true,
              isNew: false,
              sequence_number: q.sequence_number !== undefined ? q.sequence_number : index + 1,
              conditional_logic_rules: q.conditional_logic_rules || null,
            }));
            setQuestions(transformedQuestions);
          } else {
            setQuestions([]);
          }
          toast.success("Survey loaded for editing!", { id: loadingToast });

        } catch (error) {
          console.error("Error loading survey:", error);
          const errorMessage =
            error.response?.data?.error ||
            error.message ||
            "Failed to load survey data.";
          toast.error(`Error: ${errorMessage}`, { id: loadingToast });
          // ... error handling ...
          toast.error("Failed to load survey for editing.", { id: loadingToast });
        }
      } else {
        // This is a new, manual survey creation
        setIsEditMode(false);
        setIsFromAI(false);
        // Remove the automatic question creation
        setQuestions([]);
      }
    };

    loadSurveyData();
    // Ensure dependencies are correct, avoid unnecessary re-renders
  }, [effectiveState?.editMode, effectiveState?.surveyId, effectiveState?.fromAiGeneration, effectiveState?.generatedSurvey, businessName, businessId]); // Update dependencies

  // --- Updated handleAddToBank ---
  const handleAddToBank = async (question) => {
    const savingToast = toast.loading("Adding to library...");
    try {
      // Prepare payload, ensuring all relevant fields are included
      const payload = {
        question_text: question.text || "Untitled Question", // Add fallback
        question_text_html: question.question_text_html || question.text || "",
        description: question.description || "",
        additional_text: question.additional_text || "",
        question_type: question.type || "open-ended", // Fallback type
        // Ensure options are correctly formatted if they exist
        options: Array.isArray(question.options)
          ? question.options.map((opt) =>
              typeof opt === "string"
                ? { text: opt, branch: null }
                : { ...opt, text: String(opt.text || "") }
            )
          : [],
        image_url: question.image_url || "",
        rating_start: question.rating_start ?? null,
        rating_end: question.rating_end ?? null,
        rating_step: question.rating_step ?? null,
        rating_unit: question.rating_unit || "",
        grid_rows: question.grid_rows || [],
        grid_columns: question.grid_columns || [],
        // Add any other fields your question bank schema requires
      };
      console.log("Adding to bank payload:", payload);
      await questionBankAPI.createQuestion(payload); // Use questionBankAPI from apiClient
      toast.success("Question added to library!", { id: savingToast });
    } catch (error) {
      console.error("Error adding question to bank:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Could not add question to library.";
      toast.error(`Error: ${errorMessage}`, { id: savingToast });
    }
  };

  // --- Updated handleSaveSurvey ---
  const handleSaveSurvey = async () => {
    // 1. Validate Title
    if (!surveyTitle.trim()) {
      toast.error("Please provide a survey title.");
      return;
    }

    // 2. Validate Participant Limits
    const participantLimitErrors = validateParticipantLimits(
      surveySettings.participantMin,
      surveySettings.participantMax
    );
    if (participantLimitErrors.min || participantLimitErrors.max) {
      setParticipantErrors(participantLimitErrors); // Update state to show inline errors
      toast.error("Please fix the participant limit errors before saving.");
      return;
    } else {
      setParticipantErrors({ min: "", max: "" }); // Clear errors if valid
    }

    // 3. Validate Questions (Optional but good practice)
    if (questions.length === 0) {
      toast.error("Please add at least one question to the survey.");
      // Maybe don't return, allow saving empty surveys depending on requirements
      // return;
    }
    // Add more question-specific validation if needed (e.g., check for empty required questions)

    const savingToast = toast.loading(
      isEditMode ? "Updating survey..." : "Creating survey..."
    );

    // 4. Prepare ad
    const transformedQuestions = questions.map((q, index) => {
      // Ensure options have string 'text' property
      const processedOptions = (Array.isArray(q.options) ? q.options : []).map(
        (opt) => {
          if (typeof opt === "object" && opt !== null) {
            return { ...opt, text: String(opt.text || "") };
          }
          if (typeof opt === "string") {
            return { text: opt, branch: null };
          }
          return { text: "", branch: null };
        }
      );

      // Handle image options for image select types
      let processedImageOptions = null;
      if (["single-image-select", "multiple-image-select"].includes(q.type)) {
        processedImageOptions = (
          Array.isArray(q.image_options) ? q.image_options : []
        ).map((imgOpt) => ({
          hidden_label:
            imgOpt.hidden_label || `imgopt_save_${uuidv4().slice(0, 8)}_${index}`,
          label: String(imgOpt.label || ""),
          image_url: String(imgOpt.image_url || ""),
          description: String(imgOpt.description || ""),
        }));
      }

      return {
        question_text: String(q.text || ""),
        question_text_html: q.question_text_html || q.text || "",
        question_type: q.type || "open-ended",
        description: String(q.description || ""),
        additional_text: String(q.additional_text || ""),
        options: [
          "single-choice",
          "multi-choice",
          "dropdown",
          "ranking",
          "scale",
        ].includes(q.type)
          ? processedOptions
          : q.options || [],
        image_options: processedImageOptions,
        branch: q.branch || null,
        sequence_number: index + 1,
        image_url: q.image_url || "",
        rating_start:          q.rating_start !== "" && q.rating_start !== null            ? Number(q.rating_start)            : null,
        rating_end:          q.rating_end !== "" && q.rating_end !== null            ? Number(q.rating_end)            : null,
        rating_step:          q.rating_step !== "" && q.rating_step !== null            ? Number(q.rating_step)            : null,
        rating_unit: q.rating_unit || "",
        left_label: q.left_label || null,
        center_label: q.center_label || null,
        right_label: q.right_label || null,
        required: Boolean(q.required),
        not_applicable: Boolean(q.not_applicable),
        has_other_option: Boolean(q.has_other_option),
        other_option_text: q.other_option_text || "Other (Please specify)",
        grid_rows: q.grid_rows || [],
        grid_columns: q.grid_columns || [],
        disqualify_enabled: q.disqualify_enabled || false,
        disqualify_message: q.disqualify_message || "",
        disqualify_rules: q.disqualify_rules || [],
        numerical_branch_enabled: q.numerical_branch_enabled || false,
        numerical_branch_rules: q.numerical_branch_rules || [],
        min_selection:          q.min_selection !== undefined && q.min_selection !== null            ? Number(q.min_selection)            : null,
        max_selection:          q.max_selection !== undefined && q.max_selection !== null            ? Number(q.max_selection)            : null,
        file_types: q.file_types || [],
        max_file_size: q.max_file_size || null,
        max_files: q.max_files || null,
        ranking_items: q.ranking_items || [],
        signature_options: q.signature_options || {},
        nps_left_label: q.nps_left_label || null,
        nps_right_label: q.nps_right_label || null,
        nps_reversed: Boolean(q.nps_reversed),
        nps_spacing: q.nps_spacing || null,
        min_value:          q.min_value !== undefined && q.min_value !== null            ? Number(q.min_value)            : null,
        max_value:          q.max_value !== undefined && q.max_value !== null            ? Number(q.max_value)            : null,
        allowed_domains: q.allowed_domains || null,
        min_date: q.min_date || null,
        max_date: q.max_date || null,
        show_na: Boolean(q.show_na),
        not_applicable_text: q.not_applicable_text || "Not Applicable",
        scale_points: q.scale_points || [],
        conditional_logic_rules: q.conditional_logic_rules || null,
        saved: true,
      };
    });

    const payload = {
      title: surveyTitle.trim(),
      description: String(surveySettings.description || ""),
      participant_min:
        surveySettings.participantMin !== ""
          ? parseInt(surveySettings.participantMin)
          : null,
      participant_max:
        surveySettings.participantMax !== ""
          ? parseInt(surveySettings.participantMax)
          : null,
      questions: transformedQuestions,
      ...(businessId && { business_id: businessId }) // Include business_id if present
    };

    console.log("FINAL PAYLOAD TO BACKEND (handleSaveSurvey):", JSON.stringify(payload, null, 2));
    console.log("Business context:", { businessId, businessName });

    // 5. Make API Call
    try {
      let response;
      if (isEditMode) {
        console.log(`Updating survey ID: ${location.state.surveyId}`);
        if (businessId) {
          // Use business-scoped update endpoint
          response = await apiClient.put(`/api/businesses/${businessId}/surveys/${location.state.surveyId}`, payload);
        } else {
          // Use general update endpoint
          response = await surveyAPI.update(location.state.surveyId, payload);
        }
      } else {
        console.log("Creating new survey");
        if (businessId) {
          // Use business-scoped creation endpoint
          response = await apiClient.post(`/api/businesses/${businessId}/surveys`, payload);
        } else {
          // Use general creation endpoint (for Super Admin)
          response = await surveyAPI.create(payload);
        }
      }

      const responseData = response.data; // Access data directly
      console.log("Server response:", responseData);

      toast.success(
        `Survey ${isEditMode ? "updated" : "created"} successfully!`,
        { id: savingToast }
      );
      
      // Navigate based on business context
      if (businessId) {
        // If created for a specific business, redirect to business surveys management
        navigate(`/admin/business/${businessId}/surveys/manage`);
      } else {
        // Otherwise, redirect to general surveys page
        navigate("/savedsurveys");
      }
    } catch (error) {
      console.error("Error saving survey:", error);
      let errorMessage =
        error.response?.data?.error ||
        error.message ||
        `Failed to ${isEditMode ? "update" : "create"} survey.`;

      // Check for detailed validation errors from the backend
      if (error.response?.data?.errors) {
        console.error("Validation Errors:", error.response.data.errors);
        // Format validation errors for a more informative message
        const validationMessages = Object.entries(error.response.data.errors)
          .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
          .join("\n");
        errorMessage = `Please fix the following errors:\n${validationMessages}`;
        alert(errorMessage); // Use alert for detailed validation errors maybe?
      }

      toast.error(`Error: ${errorMessage}`, { id: savingToast });
      // Potentially set specific error states here if needed for UI feedback
    }
  };

  // Image and logo upload handlers removed

  // --- Updated handleContinueChatSubmit ---
  const handleContinueChatSubmit = async (e) => {
    e.preventDefault();
    const userMessage = continuationInput.trim();
    if (!userMessage || isChatLoading) return; // Prevent empty or duplicate submissions

    setContinuationChat((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    setIsChatLoading(true);
    const chatToast = toast.loading("AI is processing your request...");

    try {
      // Prepare current survey state for the API
      const currentSurveyState = {
        title: surveyTitle,
        description: surveySettings.description,
        // Map questions to the format expected by the backend regeneration endpoint
        questions: questions.map((q) => ({
          question_text: q.text,
          question_type: q.type,
          description: q.description || "",
          options: q.options || [], // Send current options
          // Include other relevant fields like grid_rows, grid_columns, etc.
          grid_rows: q.grid_rows || [],
          grid_columns: q.grid_columns || [],
          // Ensure all necessary fields are included
        })),
      };
      const surveyId = location.state?.surveyId || null; // Pass survey ID if available

      console.log(
        "Sending regeneration request with state:",
        currentSurveyState,
        "and prompt:",
        userMessage
      );

      // Call the AI API endpoint for regeneration
      const response = await aiAPI.regenerateSurvey(
        currentSurveyState,
        userMessage,
        surveyId,
        businessId // Pass businessId for business context in AI regeneration
      ); // Use aiAPI from apiClient
      const data = response.data; // Access data directly
      console.log("AI regeneration response:", data);

      // Add AI response to the chat display
      setContinuationChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.response || "I've updated the survey based on your request.",
        },
      ]);

      // Update the survey state if regeneration was successful and data returned
      if (data.regenerated_survey) {
        const regenerated = data.regenerated_survey;
        console.log("Applying regenerated survey data:", regenerated);

        setSurveyTitle(regenerated.title || surveyTitle); // Update title
        setSurveySettings((prev) => ({
          ...prev,
          description: regenerated.description ?? prev.description, // Update description
        }));

        if (regenerated.questions && Array.isArray(regenerated.questions)) {
          // Transform regenerated questions back into the frontend format
          const transformedQuestions = regenerated.questions.map((q, index) => {
            const questionType = transformQuestionType(
              q.question_type || q.type
            );
            const processedOptions = (
              Array.isArray(q.options) ? q.options : []
            ).map((opt) =>
              typeof opt === "string"
                ? { text: opt, branch: null }
                : { ...opt, text: String(opt.text || "") }
            );
            let scalePoints = [];
            if (questionType === "scale") {
              // Logic to handle scale_points from AI response
              scalePoints = Array.isArray(q.scale_points)
                ? q.scale_points.map(String)
                : defaultQuestion.scale_points || [];
            }

            return {
              ...q, // Spread raw data first
              type: questionType,
              text: String(q.question_text || q.text || ""),
              question_text_html: q.question_text_html || q.question_text || "",
              options: processedOptions,
              scale_points: scalePoints,
              // Add all other fields needed by QuestionEditorModal, defaulting if necessary
              description: String(q.description || ""),
              additional_text: String(q.additional_text || ""),
              image_url: q.image_url || "",
              rating_start: q.rating_start ?? "",
              rating_end: q.rating_end ?? "",
              rating_step: q.rating_step ?? "",
              rating_unit: q.rating_unit || "",
              required: q.required || false,
              sequence_number: index + 1, // Re-sequence
              grid_rows: q.grid_rows || [],
              grid_columns: q.grid_columns || [],
              branch: q.branch || null,
              disqualify_enabled: q.disqualify_enabled || false,
              disqualify_message: q.disqualify_message || "",
              disqualify_rules: q.disqualify_rules || [],
              numerical_branch_enabled: q.numerical_branch_enabled || false,
              numerical_branch_rules: q.numerical_branch_rules || [],
              min_selection: q.min_selection ?? null,
              max_selection: q.max_selection ?? null,
              // --- Add the processed scale_points ---
              scale_points: scalePoints,
              // --- Add show_na and not_applicable_text for scale ---
              show_na:
                questionType === "scale"
                  ? q.show_na !== undefined
                    ? q.show_na
                    : defaultQuestion.show_na
                  : q.show_na !== undefined
                  ? q.show_na
                  : false,
              not_applicable_text:
                questionType === "scale"
                  ? q.not_applicable_text || defaultQuestion.not_applicable_text
                  : q.not_applicable_text || "",
              saved: true, // Mark as saved for initial preview
              conditional_logic_rules: q.conditional_logic_rules || null,
            };
          });
          console.log(
            "Transformed questions after regeneration:",
            transformedQuestions
          );
          setQuestions(transformedQuestions);
        }
        toast.success("Survey updated by AI!", { id: chatToast });
      } else {
        // Handle case where AI responds but doesn't return survey data
        console.warn(
          "AI responded but did not return regenerated survey data."
        );
        toast.success("AI processed the request.", { id: chatToast }); // Still acknowledge processing
      }

      setContinuationInput(""); // Clear input field
    } catch (error) {
      console.error("Error continuing chat with AI:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to process your request with AI.";
      // Add error message to chat
      setContinuationChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, an error occurred: ${errorMessage}. Please try again.`,
        },
      ]);
      toast.error(`Error: ${errorMessage}`, { id: chatToast });
    } finally {
      setIsChatLoading(false); // Ensure loading state is turned off
      // Scroll chat to bottom after update
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    }
  };

  useEffect(() => {
    if (location.state?.fromAiGeneration) {
      setIsFromAI(true);
      const generatedData = location.state.generatedSurvey;

      setSurveyTitle(generatedData.title || "");
      setSurveySettings((prev) => ({
        ...prev,
        description: generatedData.description || "",
      }));

      if (Array.isArray(generatedData.questions)) {
        const transformedQuestions = generatedData.questions.map((q, index) => {
          const questionType = transformQuestionType(q.type || q.question_type); // Determine type first

          // --- Start: Processing Options (keep your existing logic) ---
          const processedOptions = (
            Array.isArray(q.options) ? q.options : []
          ).map((opt) => {
            // ... (your existing option processing logic) ...
            if (typeof opt === "string") {
              return { text: opt, branch: null };
            }
            if (typeof opt === "object" && opt !== null) {
              return { ...opt, text: String(opt.text || "") };
            }
            return { text: "", branch: null };
          });
          // --- End: Processing Options ---

          // --- Start: Explicitly handle scale_points ---
          let scalePoints = []; // Default to empty if not a scale question

          if (questionType === "scale") {
            if (Array.isArray(q.scale_points) && q.scale_points.length > 0) {
              // Use scale_points if provided by AI and valid
              scalePoints = q.scale_points.map(String); // Ensure elements are strings
              console.log(
                `[AI DEBUG] Found scale_points for Q${index + 1}:`,
                scalePoints
              );
            } else if (
              Array.isArray(q.options) &&
              q.options.length > 0 &&
              q.options.every((opt) => typeof opt === "string")
            ) {
              // Fallback: AI might have put scale labels in 'options' as strings
              console.warn(
                `[AI DEBUG] Using 'options' as scale_points for scale Q${
                  index + 1
                }. AI Data:`,
                q
              );
              scalePoints = q.options.map(String);
            } else {
              // Fallback: AI didn't provide valid scale_points or options, use default
              console.warn(
                `[AI DEBUG] No valid scale_points/options found for scale Q${
                  index + 1
                }. Using default. AI Data:`,
                q
              );
              scalePoints = defaultQuestion.scale_points; // Use imported default
            }
          }
          // --- End: Explicitly handle scale_points ---

          return {
            ...q, // Spread existing AI data first
            type: questionType, // Overwrite with standardized type
            text: String(q.text || q.question_text || ""),
            question_text_html: q.question_text_html || q.question_text || "",
            description: String(q.description || ""),
            additional_text: String(q.additional_text || ""),
            options: processedOptions, // Use processed options
            // Ensure other fields are mapped correctly...
            image_url: q.image_url || "",
            rating_start: q.rating_start || "",
            rating_end: q.rating_end || "",
            rating_step: q.rating_step || "",
            rating_unit: q.rating_unit || "",
            required: q.required || false,
            sequence_number: index + 1,
            grid_rows: q.grid_rows || [],
            grid_columns: q.grid_columns || [],
            branch: q.branch || null,
            disqualify_enabled: q.disqualify_enabled || false,
            disqualify_message: q.disqualify_message || "",
            disqualify_rules: q.disqualify_rules || [],
            numerical_branch_enabled: q.numerical_branch_enabled || false,
            numerical_branch_rules: q.numerical_branch_rules || [],
            min_selection: q.min_selection || null,
            max_selection: q.max_selection || null,
            // --- Add the processed scale_points ---
            scale_points: scalePoints,
            // --- Add show_na and not_applicable_text for scale ---
            show_na:
              questionType === "scale"
                ? q.show_na !== undefined
                  ? q.show_na
                  : defaultQuestion.show_na
                : q.show_na !== undefined
                ? q.show_na
                : false,
            not_applicable_text:
              questionType === "scale"
                ? q.not_applicable_text || defaultQuestion.not_applicable_text
                : q.not_applicable_text || "",
            saved: true, // Mark as saved for initial preview
            conditional_logic_rules: q.conditional_logic_rules || null,
          };
        });
        console.log(
          "[AI DEBUG] Transformed AI Questions:",
          transformedQuestions
        );
        setQuestions(transformedQuestions);
      }
    }
  }, [location.state]); // Keep dependencies as they are

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [continuationChat]);

  const transformQuestionType = (type) => {
    const typeMap = {
      multiple_choice: "multiple-choice",
      single_choice: "single-choice",
      scale: "scale",
      short_text: "open-ended",
      long_text: "open-ended",
      rating_scale: "rating",
      slider: "rating",
      radio_grid: "radio-grid",
      checkbox_grid: "checkbox-grid",
      star_rating_grid: "star-rating-grid",
      ranking: "interactive-ranking",
      interactive_ranking: "interactive-ranking",
    };

    return typeMap[type] || type || "open-ended";
  };

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  const handleSaveSettings = (settings) => {
    setSurveySettings(settings);
    setShowSettings(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowQuestionTypeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleQuestionTypeMenu = () => {
    setShowQuestionTypeMenu(prev => !prev);
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

  const openEditQuestionModal = (index) => {
    setEditingQuestionIndex(index);

    const newEditor = {
      id: Date.now(),
      type: questions[index].type,
      index: index,
      position: activeQuestionEditors.length,
    };

    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
  };

  const openAddQuestionModal = () => {
    setEditingQuestionIndex(null);
    setIsQuestionModalOpen(true);
  };

  const handleAddFromEditor = (questionType) => {
    const newEditor = {
      id: Date.now(),
      type: questionType || "open-ended",
      index: null,
      position: activeQuestionEditors.length,
    };

    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
  };

  const getDependentQuestionsInfo = (baseQuestionSequence, allQuestions) => {
    if (baseQuestionSequence === undefined || baseQuestionSequence === null) return [];
    return allQuestions
      .filter(q =>
        q.sequence_number !== baseQuestionSequence && // Don't count itself
        q.conditional_logic_rules &&
        q.conditional_logic_rules.baseQuestionSequence === baseQuestionSequence
      )
      .map(q => ({ sequence: q.sequence_number, text: q.text })); // Return sequence and text for better messages
  };

  const handleSaveQuestion = (questionDataFromModal, editorIdOrAssociatedQuestionId) => {
    console.log("[CS] handleSaveQuestion received:", JSON.stringify(questionDataFromModal, null, 2), "for editor/question ID:", editorIdOrAssociatedQuestionId);

    let existingQuestionIndex = -1;
    let originalQuestion = null; // Store the state of the question before this edit

    // --- Find the existing question and its original state ---
    if (questionDataFromModal.id) { // If the modal data has an ID (meaning it was an existing question)
      existingQuestionIndex = questions.findIndex(q => q.id === questionDataFromModal.id);
    }
    // Fallback if ID wasn't in modal data but editorId implies an existing question
    if (existingQuestionIndex === -1 && typeof editorIdOrAssociatedQuestionId === 'string' && !editorIdOrAssociatedQuestionId.startsWith('TEMP-')) {
      existingQuestionIndex = questions.findIndex(
        (q) => q.id === editorIdOrAssociatedQuestionId
      );
    }
    // Further fallback for index-based or older editorId conventions
    if (existingQuestionIndex === -1 && editorIdOrAssociatedQuestionId !== null && editorIdOrAssociatedQuestionId !== undefined) {
       const foundIndexBasedOnEditorId = questions.findIndex(
        (q, idx) => (q.id || `question-${idx}`) === editorIdOrAssociatedQuestionId
      );
      if (foundIndexBasedOnEditorId !== -1) {
        existingQuestionIndex = foundIndexBasedOnEditorId;
      }
    }

    if (existingQuestionIndex !== -1) {
      originalQuestion = questions[existingQuestionIndex];
    }
    // --- End Finding Existing Question ---

    let proceedWithSave = true;
    let tempQuestionsState = [...questions]; // Use a temporary state for modifications

    // --- Conditional Logic Dependency Check for EXISTING questions being EDITED ---
    // isEditMode refers to the survey, originalQuestion refers to an existing question within that survey.
    if (isEditMode && originalQuestion && originalQuestion.sequence_number !== undefined) {
      const initialLogicRelevantParts = {
        options: originalQuestion.options?.map(opt => (typeof opt === 'string' ? opt : opt.text)).sort(),
        type: originalQuestion.type,
        // Add other fields if logic can depend on them (e.g., rating scale points, numerical ranges if they change)
      };
      const currentLogicRelevantParts = {
        options: questionDataFromModal.options?.map(opt => (typeof opt === 'string' ? opt : opt.text)).sort(),
        type: questionDataFromModal.type,
      };

      let criticalChangeMade = false;
      if (initialLogicRelevantParts.type !== currentLogicRelevantParts.type) {
        criticalChangeMade = true;
        console.log(`[CS] Critical change: Type changed from ${initialLogicRelevantParts.type} to ${currentLogicRelevantParts.type} for Q${originalQuestion.sequence_number}`);
      } else if (
        (originalQuestion.type === 'single-choice' || originalQuestion.type === 'multi-choice') &&
        JSON.stringify(initialLogicRelevantParts.options) !== JSON.stringify(currentLogicRelevantParts.options)
      ) {
        criticalChangeMade = true;
        console.log(`[CS] Critical change: Options changed for Q${originalQuestion.sequence_number}`);
      }
      // TODO: Add more checks:
      // - For numerical/NPS/rating/star-rating: if the range or fundamental scale changes significantly.
      // - This depends on how specific your `conditionType`s are. If they are generic (e.g., "numerical_value_is"), then range changes might not break them.
      // - If conditionType can be "nps_score_is_promoter" and you change NPS scale, it could break.

      if (criticalChangeMade) {
        const dependents = getDependentQuestionsInfo(originalQuestion.sequence_number, tempQuestionsState);
        if (dependents.length > 0) {
          const dependentTexts = dependents.map(d => `Q${d.sequence} ("${d.text ? d.text.substring(0, 20) : 'Untitled Question'}...")`).join(', ');
          const confirmed = window.confirm(
            `WARNING: Modifying Q${originalQuestion.sequence_number} ("${originalQuestion.text ? originalQuestion.text.substring(0, 20) : 'Untitled Question'}...") may break existing conditional logic for the following question(s): ${dependentTexts}.\n\nIf you proceed, the conditional logic on these dependent questions will be removed. Do you want to continue?`
          );
          if (confirmed) {
            const dependentSequencesToClear = dependents.map(d => d.sequence);
            tempQuestionsState = tempQuestionsState.map(q => {
              if (dependentSequencesToClear.includes(q.sequence_number)) {
                toast.warn(`Conditional logic for Q${q.sequence_number} was cleared due to critical changes in its base question (Q${originalQuestion.sequence_number}).`, { duration: 7000 });
                return { ...q, conditional_logic_rules: null };
              }
              return q;
            });
          } else {
            proceedWithSave = false;
            toast.info("Changes to question were not saved to protect conditional logic.", { duration: 4000 });
          }
        }
      }
    }
    // --- End Conditional Logic Dependency Check ---

    if (!proceedWithSave) {
      // If user cancelled the confirmation, we don't save.
      // The QuestionEditorModal will remain open with the unsaved changes.
      // The user can then explicitly cancel the modal or try saving again.
      return;
    }

    // --- Updated Save Logic to ensure proper ID handling ---
    let finalQuestionsArray;
    if (existingQuestionIndex !== -1) { // Existing question being updated
      finalQuestionsArray = [...tempQuestionsState]; // Start from the (potentially modified by logic clearing) array
      
      // Ensure we preserve the ID and handle the update properly
      const updatedQuestion = {
        ...finalQuestionsArray[existingQuestionIndex], // Keep existing properties from the (potentially modified) question
        ...questionDataFromModal, // Apply new data from modal
        id: originalQuestion.id || uuidv4(), // Ensure ID is preserved
        saved: true,
      };
      
      finalQuestionsArray[existingQuestionIndex] = updatedQuestion;
      console.log("[CS] Updated existing question at index", existingQuestionIndex, ":", finalQuestionsArray[existingQuestionIndex]);
       // Log if conditional_logic_rules was preserved or updated correctly
      if ('conditional_logic_rules' in questionDataFromModal) {
          console.log("[CS] Conditional logic rules for the edited question itself:", 
            JSON.stringify(questionDataFromModal.conditional_logic_rules, null, 2));
      } else if (finalQuestionsArray[existingQuestionIndex].conditional_logic_rules){
          console.log("[CS] Edited question retained its existing conditional logic rules:",
            JSON.stringify(finalQuestionsArray[existingQuestionIndex].conditional_logic_rules, null, 2));
      }

    } else { // New question being added
      const newQuestion = {
        id: questionDataFromModal.id || uuidv4(),
        ...questionDataFromModal,
        saved: true,
      };
      // If it was a new question from an active editor, add it
      const tempEditorIndex = activeQuestionEditors.findIndex(ed => ed.id === editorIdOrAssociatedQuestionId);
      if (tempEditorIndex !== -1) {
          finalQuestionsArray = [...tempQuestionsState, newQuestion];
          console.log("[CS] Added new question from active editor:", newQuestion);
      } else { // Default: append as a new question (e.g. from question bank copy)
          finalQuestionsArray = [...tempQuestionsState, newQuestion];
          console.log("[CS] Added new question (default append path):", newQuestion);
      }
       // Log if conditional_logic_rules was included for new question
      if ('conditional_logic_rules' in questionDataFromModal && questionDataFromModal.conditional_logic_rules) {
          console.log("[CS] Conditional logic rules included in new question:", 
              JSON.stringify(questionDataFromModal.conditional_logic_rules, null, 2));
      }
    }

    // Update questions state with proper sequence numbers
    const updatedQuestions = resequenceWithLogic(finalQuestionsArray, questions);
    setQuestions(updatedQuestions);
    
    // Force re-render to ensure changes are visible
    console.log("[CS] Questions updated, new count:", updatedQuestions.length);

    // Close the modal editor instance *only if it was for a brand new question*
    // Existing questions are edited "in-place" as previews, so no active editor to remove for them.
    if (activeQuestionEditors.some(ed => ed.id === editorIdOrAssociatedQuestionId) && existingQuestionIndex === -1) {
      console.log("[CS] Removing active editor for new question:", editorIdOrAssociatedQuestionId);
      setActiveQuestionEditors(prevEditors => prevEditors.filter(ed => ed.id !== editorIdOrAssociatedQuestionId));
    }
  };

  const handleCancelQuestion = (editorId) => {
    const editorIndex = activeQuestionEditors.findIndex(
      (ed) => ed.id === editorId
    );
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

  const updateSequenceNumbers = (questions) => {
    // Create a mapping of old sequence numbers to new sequence numbers
    const sequenceMapping = {};
    questions.forEach((q, i) => {
      if (q.sequence_number !== undefined) {
        sequenceMapping[q.sequence_number] = i + 1;
      }
    });

    return questions.map((q, i) => {
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
          console.log(`[REORDER] Updated conditional logic for Q${i + 1}: base question reference changed from Q${oldBaseSequence} to Q${newBaseSequence}`);
        } else {
          // If the base question was deleted, clear the conditional logic
          console.log(`[REORDER] Clearing conditional logic for Q${i + 1}: base question Q${oldBaseSequence} no longer exists`);
          updatedQuestion.conditional_logic_rules = null;
        }
      }

      // Ensure UUID reference stays untouched
      if (updatedQuestion.conditional_logic_rules && updatedQuestion.conditional_logic_rules.baseQuestionUuid) {
        // nothing to update for UUID-based reference
      }

      return updatedQuestion;
    });
  };

  const moveQuestionUp = (index) => {
    if (index === 0) return;
    const newQuestions = [...questions];
    [newQuestions[index - 1], newQuestions[index]] = [
      newQuestions[index],
      newQuestions[index - 1],
    ];
    setQuestions(resequenceWithLogic(newQuestions, questions));
  };

  const moveQuestionDown = (index) => {
    if (index >= questions.length - 1) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index + 1]] = [
      newQuestions[index + 1],
      newQuestions[index],
    ];
    setQuestions(resequenceWithLogic(newQuestions, questions));
  };

  const handleCopyQuestion = (index, questionData) => {
    if (typeof index === "object") {
      questionData = index;
      const newQuestions = [...questions];
      newQuestions.push({
        ...questionData,
        id: undefined,
        question_uuid: uuidv4(),
        text: `${questionData.text} (Copy)`,
        sequence_number: questions.length + 1,
      });
      setQuestions(resequenceWithLogic(newQuestions, questions));
    } else {
      const toCopy = questions[index];
      const copy = {
        ...toCopy,
        id: undefined,
        question_uuid: uuidv4(),
        text: `${toCopy.text} (Copy)`,
        sequence_number: questions.length + 1,
      };
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, copy);
      setQuestions(resequenceWithLogic(newQuestions, questions));
    }
  };

  const handleDeleteQuestion = (indexToDelete) => {
    const questionToDelete = questions[indexToDelete];
    if (!questionToDelete) return;

    let tempQuestionsState = [...questions];
    let proceedWithDelete = true;

    // Check for dependents only if we are in survey edit mode and the question has a sequence
    if (isEditMode && questionToDelete.sequence_number !== undefined) {
      const dependents = getDependentQuestionsInfo(questionToDelete.sequence_number, tempQuestionsState);
      if (dependents.length > 0) {
        const dependentTexts = dependents.map(d => `Q${d.sequence} ("${d.text ? d.text.substring(0, 20) : 'Untitled Question'}...")`).join(', ');
        const confirmed = window.confirm(
          `WARNING: Deleting Q${questionToDelete.sequence_number} ("${questionToDelete.text ? questionToDelete.text.substring(0, 20) : 'Untitled Question'}...") will also remove existing conditional logic from the following dependent question(s): ${dependentTexts}.\n\nDo you want to continue?`
        );
        if (confirmed) {
          const dependentSequencesToClear = dependents.map(d => d.sequence);
          tempQuestionsState = tempQuestionsState.map(q => {
            if (dependentSequencesToClear.includes(q.sequence_number)) {
              toast.warn(`Conditional logic for Q${q.sequence_number} was cleared because its base question (Q${questionToDelete.sequence_number}) was deleted.`, { duration: 7000 });
              return { ...q, conditional_logic_rules: null };
            }
            return q;
          });
        } else {
          proceedWithDelete = false;
          toast.info("Question deletion cancelled to protect conditional logic.", { duration: 4000 });
        }
      }
    }

    if (!proceedWithDelete) {
      return;
    }

    // Filter out the question to be deleted from the (potentially modified) tempQuestionsState
    const finalQuestionsArray = tempQuestionsState.filter((_, i) => i !== indexToDelete);
    setQuestions(resequenceWithLogic(finalQuestionsArray, questions));
    //toast.success(`Question Q${questionToDelete.sequence_number || indexToDelete + 1} deleted.`);
  };

  // Handle deletion from QuestionEditorModal - for both saved questions and active editors
  const handleDeleteQuestionFromEditor = (questionIdOrEditorId) => {
    console.log("[CreateSurvey] handleDeleteQuestionFromEditor called with:", questionIdOrEditorId);

    // First check if this is an active editor (unsaved question)
    const editorIndex = activeQuestionEditors.findIndex(editor => 
      editor.id === questionIdOrEditorId
    );
    
    if (editorIndex !== -1) {
      // Remove from active editors
      const newEditors = activeQuestionEditors.filter((_, i) => i !== editorIndex);
      setActiveQuestionEditors(newEditors);
      console.log("[CreateSurvey] Removed active editor:", questionIdOrEditorId);
      return;
    }

    // If not an active editor, check if it's a saved question
    const questionIndex = questions.findIndex(q => 
      q.id === questionIdOrEditorId || q.editorId === questionIdOrEditorId
    );
    
    if (questionIndex !== -1) {
      // Remove from saved questions
      handleDeleteQuestion(questionIndex);
      console.log("[CreateSurvey] Deleted saved question at index:", questionIndex);
    } else {
      console.warn("[CreateSurvey] Could not find question to delete:", questionIdOrEditorId);
    }
  };

  const handleBranchEdit = (questionIndex, optionIndex) => {
    setBranchEditing({ questionIndex, optionIndex });
  };

  const handleSaveBranch = (branchData) => {
    if (branchEditing) {
      const { questionIndex, optionIndex } = branchEditing;
      const updated = [...questions];
      const curBranch = updated[questionIndex].branch || {};
      updated[questionIndex].branch = {
        ...curBranch,
        [optionIndex]: branchData,
      };
      setQuestions(updated);
      setBranchEditing(null);
    }
  };

  const validateParticipantLimits = (min, max) => {
    const errors = {
      min: "",
      max: "",
    };

    const minNum = parseInt(min);
    const maxNum = parseInt(max);

    if (minNum < 0) {
      errors.min = "Minimum participants cannot be negative";
    }

    if (maxNum < 0) {
      errors.max = "Maximum participants cannot be negative";
    }

    if (!errors.min && !errors.max && maxNum < minNum) {
      errors.max = "Maximum participants cannot be less than minimum";
    }

    return errors;
  };

  const [editingSurvey, setEditingSurvey] = useState(null);

  const handleEditSurvey = (id) => {
    setEditingSurvey(id);
  };

  const handleCloseEdit = () => {
    setEditingSurvey(null);
  };

  // Add a dedicated function for toggling the question bank visibility
  const handleQuestionBankToggle = (isVisible) => {
    setShowQuestionBank(isVisible);
    // If opening the question bank, we want to close the question type menu
    if (isVisible) {
      setShowQuestionTypeMenu(false);
    }
  };

  const handleDragAndDrop = () => {
    if (draggedItem === null || draggedOverItem === null) return;

    if (draggedItem === draggedOverItem) {
      setDraggedItem(null);
      setDraggedOverItem(null);
      return;
    }

    const updatedQuestions = [...questions];

    const draggedItemContent = updatedQuestions[draggedItem];

    const newArray = updatedQuestions.filter(
      (_, index) => index !== draggedItem
    );

    newArray.splice(draggedOverItem, 0, draggedItemContent);

    const resequenced = resequenceWithLogic(newArray, questions);
    setQuestions(resequenced);

    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  const handleDragReorder = (fromIndex, toIndex) => {
    const updatedQuestions = [...questions];
    const [movedItem] = updatedQuestions.splice(fromIndex, 1);
    updatedQuestions.splice(toIndex, 0, movedItem);

    const reorderedQuestions = resequenceWithLogic(updatedQuestions, questions);
    setQuestions(reorderedQuestions);
  };

  const StyledQuestionList = () => {
    if (questions.length === 0) return null;

    return (
      <div className="question-list">
        <h3 className="question-list-title">Survey Questio</h3>
        <div>
          {questions.map((q, index) => (
            <div
              key={index}
              className={`question-card ${
                draggedItem === index ? "dragging" : ""
              } ${draggedOverItem === index ? "dragged-over" : ""}`}
              draggable="true"
              onDragStart={() => setDraggedItem(index)}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggedOverItem(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDragAndDrop();
              }}
              onDragEnd={() => {
                setDraggedItem(null);
                setDraggedOverItem(null);
              }}
            >
              <div className="drag-handle" title="Drag to reorder">
                <i className="ri-drag-move-line"></i>
              </div>
              <p className="question-text">
                <strong>Q{index + 1}:</strong> {q.text || "(No text)"}
              </p>
              <div className="question-button-group">
                <button
                  onClick={() => moveQuestionUp(index)}
                  className="question-button"
                  disabled={index === 0}
                  title="Move Up"
                >
                  <i className="ri-arrow-up-s-line"></i> Up
                </button>
                <button
                  onClick={() => moveQuestionDown(index)}
                  className="question-button"
                  disabled={index >= questions.length - 1}
                  title="Move Down"
                >
                  <i className="ri-arrow-down-s-line"></i> Down
                </button>
                <button
                  onClick={() => openEditQuestionModal(index)}
                  className="question-button edit"
                  title="Edit Question"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleCopyQuestion(index)}
                  className="question-button"
                  title="Copy Question"
                >
                  Copy
                </button>
                <button
                  onClick={() => handleDeleteQuestion(index)}
                  className="question-button delete"
                  title="Delete Question"
                >
                  Delete
                </button>
                <button
                  onClick={() => handleAddToBank(q)}
                  className="question-button add-to-bank"
                  title="Add to Question Library"
                >
                  Add to Bank
                </button>
              </div>

              {q.options &&
                Array.isArray(q.options) &&
                q.options.length > 0 && (
                  <div className="question-options">
                    <strong className="options-title">Options:</strong>
                    <ul className="options-list">
                      {q.options.map((opt, optIndex) => (
                        <li key={optIndex} className="option-item">
                          {opt}{" "}
                          <button
                            onClick={() => handleBranchEdit(index, optIndex)}
                            className="question-button branch-button"
                          >
                            Set Branch
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const StyledQuestionBank = () => {
    if (!showQuestionBank) return null;

    return (
      <div className="question-bank">
        <h3 className="question-bank-title">Question Library</h3>
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
    );
  };

  const QuestionTypeMenu = () => {
    if (!showQuestionTypeMenu) return null;

    const questionTypes = [
      { value: "single-choice", label: "Single Choice" },
      { value: "multi-choice", label: "Multiple Choice" },
      { value: "open-ended", label: "Open-Ended Textbox" },
      { value: "rating", label: "Slider" },
      { value: "nps", label: "NPS (0–10)" },
      { value: "numerical-input", label: "Numerical Input" },
      { value: "email-input", label: "Email Input" },
      { value: "date-picker", label: "Date Selection" },
      { value: "radio-grid", label: "Grid Question" },
      { value: "star-rating", label: "Star Rating" },
      { value: "star-rating-grid", label: "Star Rating Grid" },
      { value: "signature", label: "Signature" },
      { value: "single-image-select", label: "Single Image Select" },
      { value: "multiple-image-select", label: "Multiple Image Select" },
      { value: "document-upload", label: "Document Upload" },
      { value: "interactive-ranking", label: "Interactive Ranking" },
      { value: "scale", label: "Scale", icon: "ri-scales-lines" },
    ];

    return (
      <div
        ref={menuRef}
        className="newquestion-type-menu"
        onMouseEnter={() => handleMenuHover(true)}
        onMouseLeave={() => handleMouseLeave()}
      >
        {questionTypes.map((type, index) => (
          <button
            key={type.value}
            className={`newquestion-type-option ${index % 2 === 1 ? "alt" : ""} ${
              index === 0 ? "first" : ""
            } ${index === questionTypes.length - 1 ? "last" : ""}`}
            style={{ height: `${139 / questionTypes.length}px` }}
            onClick={() => handleSelectQuestionType(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>
    );
  };

  const handleButtonHover = (hovering) => {
    setIsAddButtonHovered(hovering);
    if (hovering) {
      setShowQuestionTypeMenu(true);
    } else {
      handleMouseLeave();
    }
  };

  const handleMenuHover = (hovering) => {
    setIsMenuHovered(hovering);
    if (!hovering) {
      handleMouseLeave();
    }
  };

  const handleMouseLeave = () => {
    setTimeout(() => {
      if (!isAddButtonHovered && !isMenuHovered) {
        setShowQuestionTypeMenu(false);
      }
    }, 100);
  };

  const renderAIChat = () => {
    if (!isFromAI) return null;

    return (
      <div className="ai-chat-section">
        <div className="chat-card">
          <div className="chat-header">
            <h2 className="chat-title">Modify Survey with AI</h2>
            <p className="chat-subtitle">
              Let AI help you enhance this survey by adding or modifying
              questions.
            </p>
          </div>

          <form
            onSubmit={handleContinueChatSubmit}
            className="input-container2"
          >
            <input
              type="text"
              value={continuationInput}
              onChange={(e) => setContinuationInput(e.target.value)}
              placeholder="Tell AI how to improve your survey (e.g., 'Add more questions about customer satisfaction')"
              className="chat-input"
              disabled={isChatLoading}
            />
            <button
              type="submit"
              className={`send-button ${
                isChatLoading || !continuationInput.trim() ? "disabled" : ""
              }`}
              disabled={isChatLoading || !continuationInput.trim()}
            >
              <i
                className={`ri-${
                  isChatLoading ? "loader-2-line spinning" : "send-plane-fill"
                }`}
              ></i>
            </button>
          </form>
        </div>
      </div>
    );
  };

  const handleAddContent = (contentType) => {
    const newEditor = {
      id: Date.now(),
      type: contentType,
      index: null,
      position: activeQuestionEditors.length,
    };

    setActiveQuestionEditors([...activeQuestionEditors, newEditor]);
    if (contentType === "content-text") {
      setShowTextEditor(false);
    } else if (contentType === "content-media") {
      setShowMediaUploader(false);
    }
  };

  return (
    <div className="survey-management">
      <div className="sidebarhello">
      <Sidebar />
      </div>
      <div className="create-content">


        <div className="create-header">

          <h1 className="create-title">
            {isEditMode ? "Edit Survey" : "Create Survey"}
          </h1>
        </div>

        <div className="create-input-container">
          <label className="create-input-label">
            Survey Title (Visible to Participants)
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
            Survey Description (Visible to Participants, Optional)
          </label>
          <textarea
            value={surveySettings.description}
            onChange={(e) => {
              const words = e.target.value.split(/\s+/).filter(Boolean);
              const limited =
                words.length > DESCRIPTION_WORD_LIMIT
                  ? words.slice(0, DESCRIPTION_WORD_LIMIT).join(" ")
                  : e.target.value;
              setSurveySettings({
                ...surveySettings,
                description: limited,
              });
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
                  value={surveySettings.participantMin}
                  onChange={(e) => {
                    const newMin = e.target.value;
                    const errors = validateParticipantLimits(
                      newMin,
                      surveySettings.participantMax
                    );
                    setParticipantErrors(errors);
                    setSurveySettings({
                      ...surveySettings,
                      participantMin: newMin,
                    });
                  }}
                  min="0"
                  className={`settings-input ${
                    participantErrors.min ? "error" : ""
                  }`}
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
                    const errors = validateParticipantLimits(
                      surveySettings.participantMin,
                      newMax
                    );
                    setParticipantErrors(errors);
                    setSurveySettings({
                      ...surveySettings,
                      participantMax: newMax,
                    });
                  }}
                  min="0"
                  className={`settings-input ${
                    participantErrors.max ? "error" : ""
                  }`}
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
                onSave={(questionData) =>
                  handleSaveQuestion(questionData, question.id || `question-${index}`)
                }
                allSurveyQuestions={questions}
                questionNumber={index + 1}
                totalQuestions={questions.length}
                onMoveUp={() => moveQuestionUp(index)}
                onMoveDown={() => moveQuestionDown(index)}
                onDelete={() => handleDeleteQuestion(index)}
                onCopy={(questionData) => {
                  console.log('Copying question:', questionData);
                  const newQuestions = [...questions];
                  // Insert the copy right after the current question
                  newQuestions.splice(index + 1, 0, {
                    ...questionData,
                    id: undefined, // Clear ID for new question
                    sequence_number: index + 2, // Place it after current question
                    text: `${questionData.text} - Copy`,
                    question_text_html: questionData.question_text_html ? `${questionData.question_text_html} - Copy` : undefined,
                  });
                  // Update sequence numbers for all questions after this
                  const resequencedQuestions = newQuestions.map((q, idx) => ({
                    ...q,
                    sequence_number: idx + 1
                  }));
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
                onDragReorder={handleDragReorder}
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
              options:
                editor.type === "scale"
                  ? []
                  : editor.type === "single-choice" ||
                    editor.type === "multi-choice"
                  ? ["Option 1", "Option 2"]
                  : [],
              required: false,
              image_url: "",
              rating_start: editor.type === "scale" ? 1 : 0,
              rating_end: editor.type === "scale" ? 5 : 5,
              rating_step: 1,
              rating_unit: "",
              scale_points:
                editor.type === "scale"
                  ? [
                      "Not at all satisfied",
                      "Slightly satisfied",
                      "Moderately satisfied",
                      "Very satisfied",
                      "Extremely satisfied",
                    ]
                  : [],
              show_na: editor.type === "scale",
              not_applicable_text: "Not Applicable",
            }}
            onSave={(questionData) =>
              handleSaveQuestion(questionData, editor.id)
            }
            onCancel={() => handleCancelQuestion(editor.id)}
            onAddButtonClick={() => setShowQuestionTypeMenu(true)}
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
            onDelete={handleDeleteQuestionFromEditor}
          />
        ))}

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

        <div className="add-content-options">
            <h3 className="add-content-title">
              {isFromAI ? "Manually Add:" : "Add to your survey"}
            </h3>
          <div className="add-content-buttons">
            <button
              className="add-content-button"
              onClick={() => {
                setShowQuestionTypeMenu(true);
              }}
            >
              <span className="content-option-text">Questions</span>
            </button>
            <button
              className="add-content-button"
              onClick={() => handleAddContent("content-text")}
            >
              <span className="content-option-text">Text</span>
            </button>
            <button
              className="add-content-button"
              onClick={() => handleAddContent("content-media")}
            >
              <span className="content-option-text">Media</span>
            </button>
            <button
              className="add-content-button"
              onClick={() => handleQuestionBankToggle(true)}
            >
              <span className="content-option-text">From Library</span>
            </button>
          </div>
        </div>

        <div className="newsave-button-container">
        <button
          onClick={handleSaveSurvey}
          className={`newsave-button ${
            questions.length === 0 ? "save-button--disabled" : ""
          }`}
          disabled={questions.length === 0}
        >
          {isEditMode ? "Update Survey" : "Save Survey"}
        </button>
      </div>


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
                onClick={() => {
                  console.log("Refreshing question library");
                }}
                className="question-bank-refresh"
                title="Refresh question library"
              >
                <i className="ri-refresh-line"></i>
              </button>
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
  );
};

export default CreateSurvey;
