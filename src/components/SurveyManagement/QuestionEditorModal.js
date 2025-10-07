import React, { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import QuestionBank from "./QuestionBank";
//import JoditEditor from "jodit-react";
import SavedQuestionPreview from "./SavedQuestionPreview";
import "../../styles/QuestionEditorModal.css";
import AdvancedBranchEditor from "./AdvancedBranchEditor";
import { v4 as uuidv4 } from "uuid";
import NumericalBranchEditor from "./NumericalBranchEditor";
//import JoditEditor from 'jodit-react';
import CustomEditor from "../common/CustomEditor";
import { sanitizeHtml } from "utils/htmlFormatUtils";
import toast from "react-hot-toast";
import apiClient, {
  surveyAPI,
  questionBankAPI,
  uploadAPI,
  aiAPI,
  analyticsAPI,
  baseURL,
} from "../../services/apiClient";
import ConditionalLogicEditor from './ConditionalLogicEditor'; // Add this

// Add this default question structure
export const defaultQuestion = {
  type: "open-ended",
  text: "",
  question_text_html: "", // Added for rich text
  description: "",
  additional_text: "",
  options: [],
  image_options: [], // For image select
  grid_rows: [{ text: "Row 1" }, { text: "Row 2" }],
  grid_columns: [{ text: "Column 1" }, { text: "Column 2" }],
  ranking_items: [{ text: "Item 1" }, { text: "Item 2" }, { text: "Item 3" }],
  required: false,
  image_url: "",
  rating_start: 1,
  rating_end: 10,
  rating_step: 1,
  rating_unit: "",
  left_label: "Not at all",
  center_label: "Neutral",
  right_label: "Extremely",
  has_other_option: false,
  other_option_text: "Other (Please specify)",
  not_applicable: false,
  not_applicable_text: "Not Applicable",
  show_na: false, // Default for most types, scale might override
  disqualify_enabled: false,
  disqualify_message: "Sorry, you do not qualify for this survey.",
  disqualify_rules: [], // { option: "option text", message: "custom message" }
  numerical_branch_enabled: false,
  numerical_branch_rules: [], // { operator: 'gt', value: 10, target_question: 'next' or sequence_number }
  min_selection: null,
  max_selection: null,
  file_types: ["pdf", "doc", "docx", "png", "jpg"],
  max_file_size: 5, // MB
  max_files: 1,
  signature_options: { penColor: "black", backgroundColor: "white" },
  nps_left_label: "Not at all Likely",
  nps_right_label: "Extremely Likely",
  nps_reversed: false,
  nps_spacing: "normal",
  min_value: null,
  max_value: null,
  allowed_domains: null,
  min_date: null,
  max_date: null,
  scale_points: [
    "Not at all satisfied",
    "Slightly satisfied",
    "Moderately satisfied",
    "Very satisfied",
    "Extremely satisfied",
  ], // Sensible default for scale
  conditional_logic_rules: null, // Make sure this is present
  page_number: 1,
  report_sequence: null,
  // metadata
  saved: false, // Not part of the question model, but useful for UI
  isNew: true,    // Helper for CreateSurvey to know if it's a brand new add
};

const QuestionEditorModal = ({
  isOpen,
  initialQuestion,
  onSave,
  onCancel,
  customStyles,
  onAddButtonClick,
  onMoveUp,
  onMoveDown,
  onDragReorder, // Restore this prop
  onCopy, // Restore this prop
  editorId,
  position = 0,
  questionNumber, // Restore this prop
  isFirst = false,
  isLast = false,
  totalQuestions,
  isBranched = false,
  isQuickPoll = false, // Add this prop
  allSurveyQuestions, // <-- Add this prop
  onDelete, // <-- Add this prop
}) => {
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [questionText, setQuestionText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [ratingStart, setRatingStart] = useState("");
  const [ratingEnd, setRatingEnd] = useState("");
  const [ratingStep, setRatingStep] = useState("");
  const [ratingUnit, setRatingUnit] = useState("");
  const [minResponse, setMinResponse] = useState("");
  const [maxResponse, setMaxResponse] = useState("");
  const [required, setRequired] = useState(false);
  // New state for grid questions
  const [newRowText, setNewRowText] = useState("");
  const [newColumnText, setNewColumnText] = useState("");
  // New state for branch editing (per option)
  const [branchEditingIndex, setBranchEditingIndex] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const editor = useRef(null);
  // Move state declarations before isOpen check
  // Show in preview mode by default and allow editing on click
  const [isPreview, setIsPreview] = useState(true);
  const [questionData, setQuestionData] = useState(
    initialQuestion ? { ...initialQuestion } : { ...defaultQuestion, question_uuid: uuidv4() }
  );

  const [editingOptionIndex, setEditingOptionIndex] = useState(-1);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  // Add state for image preview
  const [imagePreview, setImagePreview] = useState(null);
  // Create a ref for the file input element
  const fileInputRef = useRef(null);

  // Add new state for nested editors
  const [nestedEditors, setNestedEditors] = useState([]);
  const [savedData, setSavedData] = useState(null);

  // Add state for tracking branched questions
  const [branchedQuestions, setBranchedQuestions] = useState({});

  // Add state for option-specific question type menu
  const [showTypeMenuForOption, setShowTypeMenuForOption] = useState(null);
  const [typeMenuPosition, setTypeMenuPosition] = useState({ x: 0, y: 0 });

  // Add these to existing state declarations
  const [showNotApplicable, setShowNotApplicable] = useState(
    initialQuestion?.not_applicable || false
  );
  const [showOther, setShowOther] = useState(
    initialQuestion?.has_other_option || false
  );
  const [otherOptionText, setOtherOptionText] = useState(
    initialQuestion?.other_option_text || "Other (Please specify)"
  );
  const [notApplicableText, setNotApplicableText] = useState(
    initialQuestion?.not_applicable_text || "Not Applicable"
  );

  const [branchingData, setBranchingData] = useState({
    branchEndAction: "resume",
    jump_to_question: null,
    questions: [],
  });

  // Add new state for editing specific option's branch
  const [editingBranchForOption, setEditingBranchForOption] = useState(null);

  const [showLogicFlow, setShowLogicFlow] = useState(false);

  // Add state for disqualification fields
  const [disqualifyEnabled, setDisqualifyEnabled] = useState(false);
  const [disqualifyMessage, setDisqualifyMessage] = useState("");
  const [disqualifyRules, setDisqualifyRules] = useState([]);

  // Add state for numerical branching
  const [editingNumericalBranchIndex, setEditingNumericalBranchIndex] =
    useState(null);
  const [numericalBranchData, setNumericalBranchData] = useState(null);

  // Add state for conditional logic
  const [activeConditionalLogic, setActiveConditionalLogic] = useState(null);
  const [showConditionalLogicEditor, setShowConditionalLogicEditor] = useState(false);

  // Move all useEffect hooks before any early returns
  useEffect(() => {
    if (isOpen && initialQuestion) {
      setQuestionType(initialQuestion.type || "multiple-choice");
      setQuestionText(initialQuestion.text || "");
      setImageUrl(initialQuestion.image_url || "");
      setMediaFile(null);
      setOptions(initialQuestion.options || []);
      setNewOptionText("");
      setRatingStart(initialQuestion.rating_start ?? "");
      setRatingEnd(initialQuestion.rating_end ?? "");
      setRatingStep(initialQuestion.rating_step ?? "");
      setRatingUnit(initialQuestion.rating_unit ?? "");
      setMinResponse(initialQuestion.min_response ?? "");
      setMaxResponse(initialQuestion.max_response ?? "");
      setRequired(initialQuestion.required ?? false);
      // Set grid data if available
      // This is now handled by questionData state initialization
      handleFieldChange("show_na", initialQuestion.not_applicable || false);
      setDisqualifyEnabled(initialQuestion.disqualify_enabled || false);
      setDisqualifyMessage(initialQuestion.disqualify_message || "");
      setDisqualifyRules(initialQuestion.disqualify_rules || []);
    } else if (isOpen && !initialQuestion) {
      setQuestionType("multiple-choice");
      setQuestionText("");
      setImageUrl("");
      setMediaFile(null);
      setOptions([]);
      setNewOptionText("");
      setRatingStart("");
      setRatingEnd("");
      setRatingStep("");
      setRatingUnit("");
      setMinResponse("");
      setMaxResponse("");
      setRequired(false);
      // Reset grid data
      // This is now handled by questionData state initialization
      setDisqualifyEnabled(false);
      setDisqualifyMessage("");
      setDisqualifyRules([]);
    }
  }, [isOpen, initialQuestion]);

  // Reset form when initialQuestion changes
  useEffect(() => {
    const currentInitial = initialQuestion
      ? { ...initialQuestion }
      : { ...defaultQuestion, question_uuid: uuidv4() };
    let dataToSet = { ...currentInitial };

    // Handle type-specific setup
    if (currentInitial.type === 'content-media') {
        // For content-media, caption is edited via questionData.text
        dataToSet.text = currentInitial.caption || "";

        // The editor uses questionData.image_url as its source for media.
        // When loading an existing content-media, this should come from currentInitial.media_url.
        const mediaSourceUrl = currentInitial.media_url || currentInitial.image_url || ""; // Prioritize media_url
        dataToSet.image_url = mediaSourceUrl; // This is what the editor's <input type="file"> and preview logic uses

        if (mediaSourceUrl && mediaSourceUrl.trim() !== "") {
            setImagePreview(mediaSourceUrl.startsWith('http') || mediaSourceUrl.startsWith('data:')
                ? mediaSourceUrl
                : `${baseURL}${mediaSourceUrl}`);
        } else {
            setImagePreview(null);
        }
    } else if (currentInitial.type === 'content-text') {
        // For content-text, text and question_text_html are primary
        dataToSet.text = currentInitial.text || "";
        dataToSet.question_text_html = currentInitial.question_text_html || currentInitial.text || "";
        // Non-content types might have a general cover image
        if (currentInitial.image_url && currentInitial.image_url.trim() !== "") {
          setImagePreview(currentInitial.image_url.startsWith('http') || currentInitial.image_url.startsWith('data:')
            ? currentInitial.image_url
            : `${baseURL}${currentInitial.image_url}`);
        } else {
          setImagePreview(null);
        }
    } else { // For all other question types (non-content)
        // They might have a general cover image_url
        if (currentInitial.image_url && currentInitial.image_url.trim() !== "") {
            setImagePreview(currentInitial.image_url.startsWith('http') || currentInitial.image_url.startsWith('data:')
            ? currentInitial.image_url
            : `${baseURL}${currentInitial.image_url}`);
        } else {
            setImagePreview(null);
        }
    }

    setQuestionData(dataToSet);
    setMediaFile(null); // Reset any pending file for upload
    setActiveConditionalLogic(currentInitial.conditional_logic_rules || null);
    setShowConditionalLogicEditor(false); // Ensure editor is closed initially

    if (initialQuestion?.saved) {
      setIsPreview(true);
    } else {
      setIsPreview(false);
    }
  }, [initialQuestion]);

  // Add useEffect to handle body class
  useEffect(() => {
    if (showQuestionBank) {
      document.body.classList.add("question-bank-open");
    } else {
      document.body.classList.remove("question-bank-open");
    }
    return () => {
      document.body.classList.remove("question-bank-open");
    };
  }, [showQuestionBank]);

  // When initialQuestion changes, update preview state
  useEffect(() => {
    if (initialQuestion?.saved) {
      setIsPreview(true);
    } else {
      setIsPreview(false);
    }
  }, [initialQuestion]);

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  // --- Updated handleAIEdit ---
  const handleAIEdit = async () => {
    const aiPrompt = window.prompt(
      "Enter your AI edit prompt for this question (e.g., 'Make this question clearer', 'Add an option for X'):"
    );
    if (!aiPrompt || !aiPrompt.trim()) return; // Check if prompt is empty

    const loadingToastId = toast.loading("AI is thinking..."); // Show loading toast

    try {
      // Prepare the original question data accurately for the API
      const originalData = {
        question_text: questionData.text || "", // Send current text
        question_type: questionData.type || "open-ended", // Send current type
        question_text_html:
          questionData.question_text_html || questionData.text || "",
        // Send options only if applicable to the current type
        ...((questionData.type === "single-choice" ||
          questionData.type === "multi-choice") && {
          options: questionData.options || [],
        }),
        // Include other relevant fields based on the CURRENT question type
        ...(questionData.type === "rating" && {
          rating_start: questionData.rating_start ?? "",
          rating_end: questionData.rating_end ?? "",
          rating_step: questionData.rating_step ?? "",
          rating_unit: questionData.rating_unit || "",
          left_label: questionData.left_label || "",
          center_label: questionData.center_label || "",
          right_label: questionData.right_label || "",
        }),
        ...(questionData.type === "scale" && {
          scale_points: questionData.scale_points || [],
        }),
        // Add other type-specific fields for context if needed by the AI
        description: questionData.description || "",
        additional_text: questionData.additional_text || "",
        image_url: questionData.image_url || "",
        required: questionData.required || false,
        // Grid data if applicable
        ...((questionData.type === "radio-grid" ||
          questionData.type === "checkbox-grid" ||
          questionData.type === "star-rating-grid") && {
          grid_rows: questionData.grid_rows || [],
          grid_columns: questionData.grid_columns || [],
        }),
        // Add more context as necessary
      };

      // Get surveyId if available (might be needed by backend for context)
      const surveyId = initialQuestion?.survey_id || null; // Assuming survey_id might be passed in initialQuestion

      console.log("Sending AI Edit request with:", {
        originalData,
        aiPrompt,
        surveyId,
      });

      // Call the AI edit endpoint using aiAPI from apiClient
      const response = await aiAPI.editQuestion(
        originalData,
        aiPrompt,
        surveyId
      );
      const editedData = response.data; // Access the data directly from Axios response
      console.log("AI edit response received:", editedData);

      // --- Update State Carefully ---
      // Create a new state object based on the AI response
      const newState = { ...questionData }; // Start with current state

      if (editedData.question_text !== undefined) {
        newState.text = editedData.question_text;
      }
      if (
        editedData.question_type !== undefined &&
        editedData.question_type !== questionData.type
      ) {
        // If type changes, reset type-specific fields carefully
        console.warn(
          `AI changed question type from ${questionData.type} to ${editedData.question_type}. Resetting specific fields.`
        );
        newState.type = editedData.question_type;
        // Reset fields based on the *new* type (using defaults)
        const defaultForNewType =
          defaultQuestion[editedData.question_type] || {};
        newState.options = defaultForNewType.options || [];
        newState.rating_start = defaultForNewType.rating_start || "";
        newState.rating_end = defaultForNewType.rating_end || "";
        // ... reset other fields ...
      }

      // Update options if present and valid for the (potentially new) type
      if (
        Array.isArray(editedData.options) &&
        ["single-choice", "multi-choice", "scale"].includes(newState.type)
      ) {
        newState.options = editedData.options.map((opt) =>
          typeof opt === "string"
            ? { text: opt, branch: null }
            : { ...opt, text: String(opt.text || "") }
        );
      } else if (
        newState.type === "scale" &&
        Array.isArray(editedData.scale_points)
      ) {
        newState.scale_points = editedData.scale_points.map(String);
        newState.options = []; // Ensure options are cleared for scale if scale_points are provided
      }

      // Update other common fields if returned
      if (editedData.description !== undefined)
        newState.description = editedData.description;
      if (editedData.additional_text !== undefined)
        newState.additional_text = editedData.additional_text;
      if (editedData.image_url !== undefined)
        newState.image_url = editedData.image_url;
      if (editedData.required !== undefined)
        newState.required = editedData.required;

      // Update type-specific fields if returned AND type matches
      if (newState.type === "rating") {
        if (editedData.rating_start !== undefined)
          newState.rating_start = editedData.rating_start;
        if (editedData.rating_end !== undefined)
          newState.rating_end = editedData.rating_end;
        // ... update other rating fields ...
      }
      if (newState.type.includes("grid")) {
        if (Array.isArray(editedData.grid_rows))
          newState.grid_rows = editedData.grid_rows;
        if (Array.isArray(editedData.grid_columns))
          newState.grid_columns = editedData.grid_columns;
      }
      // ... add updates for other question types ...

      // Apply the combined changes
      setQuestionData(newState);

      // Update image preview if URL changed
      setImagePreview(newState.image_url || null);

      toast.success("Question updated with AI suggestion!", {
        id: loadingToastId,
      });
    } catch (err) {
      console.error("AI edit error:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to apply AI edit.";
      toast.error(`AI Edit Error: ${errorMessage}`, { id: loadingToastId });
    }
  };

  // --- Updated saveToQuestionBank ---
  const saveToQuestionBank = async () => {
    try {
      // Get current state of the question
      const currentQuestionState = {
        question_text: questionData.text || "",
        question_text_html: questionData.question_text_html || questionData.text || "",
        description: questionData.description || "",
        additional_text: questionData.additional_text || "",
        question_type: questionData.type,
        options: questionData.options || [],
        image_url: questionData.image_url || "",
        rating_start: questionData.rating_start || null,
        rating_end: questionData.rating_end || null,
        rating_step: questionData.rating_step || null,
        rating_unit: questionData.rating_unit || "",
        grid_rows: questionData.grid_rows || [],
        grid_columns: questionData.grid_columns || [],
        scale_points: questionData.scale_points || [],
        image_options: questionData.image_options || []
      };

      console.log('Saving current question state to library:', currentQuestionState);
      const response = await questionBankAPI.createQuestion(currentQuestionState);
      console.log('Successfully saved to question library:', response);
      toast.success('Question added to library!');
    } catch (error) {
      console.error('Failed to save to question library:', error);
      toast.error('Failed to add question to library. Please try again.');
    }
  };

  // --- Updated handleSave (which handles image upload before calling parent's onSave) ---
  const handleSave = async (questionPayloadForSave) => {
    let finalPayload = { ...questionPayloadForSave }; // Copy payload to modify
    let primaryImageUploadSuccess = true; // Flag to track upload status

    // Upload the primary question image or media if 'mediaFile' (the File object) is set
    if (mediaFile) {
      const uploadToastId = toast.loading(finalPayload.type === 'content-media' ? "Uploading media..." : "Uploading question image...");
      try {
        console.log(`Uploading new ${finalPayload.type === 'content-media' ? "media" : "primary image"} in QuestionEditorModal...`);
        const response = await uploadAPI.uploadImage(mediaFile); // uploadAPI expects a File object
        const uploadedImageUrl = response.data.image_url; // This is the relative path from server

        if (!uploadedImageUrl) {
          throw new Error(`URL not returned after upload for ${finalPayload.type}.`);
        }

        // Update the correct field in finalPayload based on type
        if (finalPayload.type === 'content-media') {
            finalPayload.media_url = uploadedImageUrl; // Set the media_url for content-media
            finalPayload.image_url = ""; // Ensure general image_url is cleared
        } else {
            finalPayload.image_url = uploadedImageUrl; // For other types, this is the cover image
        }
        
        console.log(`${finalPayload.type === 'content-media' ? "Media" : "Image"} uploaded successfully, relative URL:`, uploadedImageUrl);
        toast.success(finalPayload.type === 'content-media' ? "Media uploaded!" : "Question image uploaded!", { id: uploadToastId });
        setMediaFile(null); // Clear the mediaFile state after successful upload
      } catch (err) {
        primaryImageUploadSuccess = false;
        console.error(`Failed to upload ${finalPayload.type === 'content-media' ? "media" : "question cover image"}:`, err);
        const errorMessage = err.response?.data?.error || err.message || `${finalPayload.type === 'content-media' ? "Media" : "Image"} upload failed.`;
        toast.error(`Upload Error: ${errorMessage}`, { id: uploadToastId });
        
        // Revert to original URLs if upload failed
        // questionPayloadForSave contains values set by handleSubmit based on questionData at that time
        if (finalPayload.type === 'content-media') {
            finalPayload.media_url = questionPayloadForSave.media_url || ""; 
        } else {
            finalPayload.image_url = questionPayloadForSave.image_url || "";
        }
      }
    } else {
      // No new file was selected for upload.
      // handleSubmit has already populated questionPayloadForSave.media_url (for content-media)
      // or questionPayloadForSave.image_url (for others) from questionData.
      // We just ensure they are not null/undefined and are empty strings if so.
      if (finalPayload.type === 'content-media') {
        if (finalPayload.media_url === null || finalPayload.media_url === undefined) {
          finalPayload.media_url = "";
        }
        finalPayload.image_url = ""; // Ensure general image_url is consistently clear for content-media
      } else {
        if (finalPayload.image_url === null || finalPayload.image_url === undefined) {
          finalPayload.image_url = "";
        }
      }
    }

    if (primaryImageUploadSuccess) {
      console.log("Calling parent onSave (handleSaveQuestion in CreateSurvey) with final question payload:", finalPayload);
      onSave(finalPayload);
      setIsPreview(true);
    } else {
      console.log("Question save aborted due to media/image upload failure.");
    }
  };

  // --- handleSubmit remains largely the same, prepares payload and calls handleSave ---
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prevent auto-submission on initial render - only allow manual submission
    if (isPreview) {
      console.log('[QuestionEditorModal] Preventing form submission while in preview mode');
      return;
    }

    // Basic validation: question text should not be empty unless it's a content type
    if (!questionData.type.startsWith('content-') && !questionData.text.trim() && !questionData.image_url && !questionData.video_url && !questionData.document_url) {
      toast.error("Question text cannot be empty.");
      return;
    }
    // Additional validation for options if question type requires them
    if (["multiple-choice", "dropdown", "single-choice"].includes(questionData.type)) {
      if (!questionData.options || questionData.options.length < 1) {
        toast.error("Please add at least one option for this question type.");
        return;
      }
      if (questionData.options.some(opt => !(typeof opt === 'string' ? opt.trim() : opt.text.trim()))) {
        toast.error("All options must have text.");
        return;
      }
    }
    if (["single-image-select", "multiple-image-select"].includes(questionData.type)) {
      if (!questionData.image_options || questionData.image_options.length < 1) {
        toast.error("Please add at least one image option.");
        return;
      }
      if (questionData.image_options.some(opt => !opt.image_url )) {
        toast.error("All image options must have an image ");
        return;
      }
    }

    let questionPayload = {
      // General fields
      type: questionData.type,
      text: "", // Default to empty, will be overridden for most types
      question_text_html: "", // Default to empty
      description: questionData.description || "",
      additional_text: questionData.additional_text || "",
      required: questionData.required || false,
      image_url: questionData.image_url || "", // Used for question cover and content-media
      video_url: questionData.video_url || "", 
      document_url: questionData.document_url || "",
      caption: "", // For content-media caption
      
      // Options-based questions (multiple-choice, dropdown, single-choice, scale)
      options: questionData.options ? questionData.options.map(opt => 
        (typeof opt === 'string' || typeof opt === 'number') ? { text: String(opt), branch: null } : 
        (opt && typeof opt.text !== 'undefined') ? { ...opt, text: String(opt.text) } : 
        { text: '', branch: null } // Fallback for malformed option
      ) : [],
      has_other_option: questionData.has_other_option || false,
      other_option_text: questionData.other_option_text || "Other (Please specify)",

      // Image select questions
      image_options: questionData.image_options ? questionData.image_options.map(opt => ({
        hidden_label: opt.hidden_label || `imgopt_${uuidv4().slice(0,8)}`,
        label: opt.label || "",
        image_url: opt.image_url || "",
        description: opt.description || "",
      })) : [],

      // Rating / Slider questions
      rating_start: questionData.rating_start !== undefined ? Number(questionData.rating_start) : null,
      rating_end: questionData.rating_end !== undefined ? Number(questionData.rating_end) : null,
      rating_step: questionData.rating_step !== undefined ? Number(questionData.rating_step) : null,
      rating_unit: questionData.rating_unit || "",
      left_label: questionData.left_label || "",
      center_label: questionData.center_label || "",
      right_label: questionData.right_label || "",

      // NPS questions
      nps_left_label: questionData.nps_left_label || "",
      nps_right_label: questionData.nps_right_label || "",
      nps_reversed: questionData.nps_reversed || false,
      nps_spacing: questionData.nps_spacing || "normal",
      
      // Scale questions
      scale_points: questionData.scale_points || [],
      not_applicable: questionData.not_applicable || false, // also used by show_na
      not_applicable_text: questionData.not_applicable_text || "Not Applicable",
      show_na: questionData.show_na || false,

      // Grid questions
      grid_rows: questionData.grid_rows ? questionData.grid_rows.map(r => ({ text: r.text || "" })) : [],
      grid_columns: questionData.grid_columns ? questionData.grid_columns.map(c => ({ text: c.text || "" })) : [],
      
      // Ranking questions
      ranking_items: questionData.ranking_items ? questionData.ranking_items.map(item => ({ text: item.text || ""})) : [],

      // Numerical Input questions
      min_value: questionData.min_value !== undefined ? Number(questionData.min_value) : null,
      max_value: questionData.max_value !== undefined ? Number(questionData.max_value) : null,

      // Email Input questions
      allowed_domains: questionData.allowed_domains || null, // string or null

      // Date Picker questions
      min_date: questionData.min_date || null, // ISO string or null
      max_date: questionData.max_date || null, // ISO string or null
      
      // File Upload questions
      file_types: questionData.file_types || [],
      max_file_size: questionData.max_file_size !== undefined ? Number(questionData.max_file_size) : null,
      max_files: questionData.max_files !== undefined ? Number(questionData.max_files) : null,
      
      // Signature questions
      signature_options: questionData.signature_options || { penColor: "black", backgroundColor: "white" },
      
      // Branching and Disqualification
      branch: questionData.branch || null,
      disqualify_enabled: questionData.disqualify_enabled || false,
      disqualify_message: questionData.disqualify_message || "",
      disqualify_rules: questionData.disqualify_rules || [],
      numerical_branch_enabled: questionData.numerical_branch_enabled || false,
      numerical_branch_rules: questionData.numerical_branch_rules || [],
      conditional_logic_rules: questionData.conditional_logic_rules, // <<<< THIS IS THE KEY

      // Selections for multi-choice/multiple-image-select
      min_selection: questionData.min_selection !== undefined ? Number(questionData.min_selection) : null,
      max_selection: questionData.max_selection !== undefined ? Number(questionData.max_selection) : null,
      
      // Metadata from backend if editing
      id: initialQuestion?.id, // Keep original ID if editing
      sequence_number: questionData.sequence_number, // Sequence number is managed by parent for new Qs
      page_number: questionData.page_number || 1,
      report_sequence: questionData.report_sequence || null,
      question_uuid: questionData.question_uuid || uuidv4(),

      saved: true, // Mark as saved for UI purposes
    };

    // Type-specific payload adjustments
    if (questionData.type === "content-text") {
      // For content-text, the text is in question_text_html.
      // 'text' can be the plain text version.
      questionPayload.text = questionData.text || ""; 
      questionPayload.question_text_html = questionData.question_text_html || questionData.text || "";
    } else if (questionData.type === "content-media") {
      // For content-media, the 'text' field from questionData (the CustomEditor input) becomes the caption.
      // questionData.image_url is the source for the media itself (set by file input or loaded initialQ.media_url)
      questionPayload.caption = questionData.text || "";
      questionPayload.media_url = questionData.image_url || ""; // This is the actual media link
      questionPayload.image_url = ""; // Clear general image_url field for content-media type
      
      // Set placeholder text for the main text fields of the question model, as they aren't primary for content-media
      questionPayload.text = "(Media Content)"; 
      questionPayload.question_text_html = "<p>(Media Content)</p>"; 
    } else {
      // For all other question types, 'text' and 'question_text_html' are primary.
      questionPayload.text = questionData.text || "";
      questionPayload.question_text_html = questionData.question_text_html || questionData.text || "";
    }

    // Remove null or undefined fields that backend might not expect or that are truly optional
    Object.keys(questionPayload).forEach(key => {
      if (questionPayload[key] === undefined) {
        delete questionPayload[key];
      }
    });

    console.log("[QEM] handleSubmit - Final Question Payload being sent to parent:", JSON.stringify(questionPayload, null, 2)); // DEBUG
    handleSave(questionPayload); // handleSave is the prop from parent (CreateSurvey -> onSave)
  };

  // Add function to save branch data for an option
  const handleSaveBranch = (branchData) => {
    if (editingBranchForOption === null) return;

    // Create branch structure based on branchEndAction
    let branchStructure = {
      branchTitle: "",
      questions: branchData.questions || [],
      branchEndAction: branchData.branchEndAction || "resume",
      jump_to_question: null,
      return_to_origin: false,
      action: "branch",
    };

    // Set specific properties based on branch end action
    if (branchData.branchEndAction === "jump") {
      branchStructure = {
        ...branchStructure,
        jump_to_question: parseInt(branchData.jump_to_question),
        return_to_origin: false,
        action: "skip", // Backend expects 'skip' for jump behavior
      };
    } else if (branchData.branchEndAction === "end") {
      branchStructure = {
        ...branchStructure,
        questions: [], // No questions needed for end action
        action: "end",
        return_to_origin: false,
      };
    } else if (branchData.branchEndAction === "resume") {
      branchStructure = {
        ...branchStructure,
        return_to_origin: true,
        action: "branch", // Use 'branch' for resume flow
      };
    }

    // Update both the option's branch data and the main branch property
    const updatedOptions = [...questionData.options];
    updatedOptions[editingBranchForOption] = {
      ...updatedOptions[editingBranchForOption],
      branch: branchStructure,
    };

    // Also update the main branch mapping
    const updatedBranch = {
      ...(questionData.branch || {}),
      [editingBranchForOption]: branchStructure,
    };

    setQuestionData((prev) => ({
      ...prev,
      options: updatedOptions,
      branch: updatedBranch,
      has_branches: true,
    }));

    setEditingBranchForOption(null);
    setBranchingData(null);
  };

  // Add this function to handle numerical branch editing
  // Add this function to handle numerical branch editing
  const handleEditNumericalBranch = (ruleIndex) => {
    if (ruleIndex === null || !questionData.numerical_branch_rules) return;

    const rule = questionData.numerical_branch_rules[ruleIndex];
    setEditingNumericalBranchIndex(ruleIndex);

    // Initialize branch data from existing branch or create new structure
    const existingBranch = rule.branch || {
      branchTitle: "",
      questions: [],
      branchEndAction: "resume",
      jump_to_question: null,
      return_to_origin: true,
      rules: [],
    };

    setNumericalBranchData(existingBranch);
    console.log(
      "Opening numerical branch editor for rule",
      ruleIndex,
      existingBranch
    );
  };

  // Add this function to save numerical branch data
  const handleSaveNumericalBranch = (branchData) => {
    if (editingNumericalBranchIndex === null) return;

    console.log("Saving numerical branch data:", branchData);

    // Update the branch data for this rule
    const updatedRules = [...(questionData.numerical_branch_rules || [])];
    updatedRules[editingNumericalBranchIndex].branch = branchData;

    // Mark the branch button as active by setting a class indicator
    if (branchData.questions && branchData.questions.length > 0) {
      updatedRules[editingNumericalBranchIndex].has_branch_questions = true;
    }

    handleFieldChange("numerical_branch_rules", updatedRules);
    setEditingNumericalBranchIndex(null);
    setNumericalBranchData(null);
  };

  const handleDragReorder = (fromIndex, toIndex) => {
    if (onDragReorder) {
      onDragReorder(fromIndex, toIndex);
    }
  };

  // Add a function to generate a human-readable summary of conditional logic
  const getConditionalLogicSummary = () => {
    if (!activeConditionalLogic) return null;
    const baseQuestionOriginalSeq = activeConditionalLogic.baseQuestionOriginalSequence;
    const baseUuid = activeConditionalLogic.baseQuestionUuid;
    const baseSeq = activeConditionalLogic.baseQuestionSequence;
    if (!baseQuestionOriginalSeq && !baseUuid && !baseSeq) return null;

    const baseQuestion = allSurveyQuestions.find((q) => {
      if (baseQuestionOriginalSeq && q.original_sequence_number === Number(baseQuestionOriginalSeq)) return true;
      if (baseSeq && q.sequence_number === Number(baseSeq)) return true;
      if (baseUuid && q.question_uuid === baseUuid) return true;
      return false;
    });

    if (!baseQuestion) return "Logic links to a deleted or invalid question.";

    const questionText = (baseQuestion.question_text || baseQuestion.text || 'Untitled').substring(0, 30);
    const conditionValue = activeConditionalLogic.conditionValue;
    let details = '';

    if (typeof conditionValue === 'string') {
      details = `is "${conditionValue}"`;
    } else if (typeof conditionValue === 'object' && conditionValue !== null) {
      if (conditionValue.options) { // multi-choice
        const match = conditionValue.matchType === 'all' ? 'ALL' : 'ANY';
        details = `has ${match} of "${conditionValue.options.join(', ')}" selected`;
      } else if (conditionValue.operator) { // numerical
        const opMap = { gt: '>', gte: '≥', eq: '=', lte: '≤', lt: '<', neq: '≠' };
        details = `has value ${opMap[conditionValue.operator] || ''} ${conditionValue.value}`;
      }
    }
    
    return `Visible if Q${baseQuestionOriginalSeq} ("${questionText}...") ${details}`;
  };

  // Update handleSaveConditionalLogic function to ensure proper data flow
  const handleSaveConditionalLogic = (newLogicRules) => {
    const updatedQuestionData = {
      ...questionData,
      conditional_logic_rules: newLogicRules,
    };
    setQuestionData(updatedQuestionData);
    setActiveConditionalLogic(newLogicRules);
    // Remove auto-close and notification
    // setShowConditionalLogicEditor(false);
    // Remove auto-save call to parent
    // onSave(updatedQuestionData);
    // Remove toast notifications
    // if (newLogicRules === null) {
    //   toast("Conditional logic cleared.");
    // } else {
    //   toast.success("Conditional logic saved!");
    // }
  };

  // Update handleCancelConditionalLogic to use activeConditionalLogic
  const handleCancelConditionalLogic = () => {
    // When cancelling, revert the editor's state to what's currently in questionData
    setActiveConditionalLogic(questionData.conditional_logic_rules || null);
    setShowConditionalLogicEditor(false);
    console.log("[QEM] Conditional logic editing cancelled.");
  };

  // Update handleToggleConditionalLogicEditor to use activeConditionalLogic
  const handleToggleConditionalLogicEditor = () => {
    // If there's existing logic and we're toggling off, don't actually toggle off
    // Instead just close the editor but keep the toggle active
    if (activeConditionalLogic && showConditionalLogicEditor) {
      setShowConditionalLogicEditor(false);
      return;
    }
    
    // If toggling on, open the editor
    setShowConditionalLogicEditor(!showConditionalLogicEditor);

    if (!showConditionalLogicEditor) {
      // When opening the editor, ensure 'activeConditionalLogic' is synced with the latest data
      console.log("[QEM] Opening ConditionalLogicEditor. Syncing from questionData.conditional_logic_rules:", 
        questionData.conditional_logic_rules);
      setActiveConditionalLogic(questionData.conditional_logic_rules || null);
    }
  };

  const handleFieldChange = (field, value) => {
    setQuestionData({ ...questionData, [field]: value });
  };

  const handleAddOption = () => {
    // Each new option includes a branch property (initially null)
    const newOptions = [...(questionData.options || []), { text: "", branch: null }];
    handleFieldChange("options", newOptions);
  };

  const handleOptionChange = (index, newText) => {
    const updated = [...questionData.options];
    const existingOption = updated[index] || {};
    updated[index] = {
      ...existingOption,
      text: newText,
      branch: existingOption.branch || null,
    };

    setQuestionData((prev) => ({
      ...prev,
      options: updated,
    }));
    setEditingOptionIndex(-1); // Add this to ensure we exit edit mode
  };

  const handleDeleteOption = (index) => {
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
  };

  const handleCopyOption = (index) => {
    const copied = { ...options[index] };
    const updated = [...options];
    updated.splice(index + 1, 0, copied);
    setOptions(updated);
  };

  const addOption = () => {
    const updatedOptions = [
      ...questionData.options,
      { text: "", branch: null }, // Changed to empty text instead of default text
    ];
    setQuestionData((prev) => ({
      ...prev,
      options: updatedOptions,
    }));
    setEditingOptionIndex(updatedOptions.length - 1);
  };

  const removeOption = (indexToRemove) => {
    const updatedOptions = questionData.options.filter(
      (_, index) => index !== indexToRemove
    );
    handleFieldChange("options", updatedOptions);
  };

  // New handlers for grid rows
  const handleAddRow = () => {
    // Just clear the input to prepare for next row
    setNewRowText("");
  };

  const handleRowChange = (index, newText) => {
    const updated = [...(questionData.grid_rows || [])];
    updated[index].text = newText;
    handleFieldChange("grid_rows", updated);
  };

  const handleDeleteRow = (index) => {
    const updated = (questionData.grid_rows || []).filter((_, i) => i !== index);
    handleFieldChange("grid_rows", updated);
  };

  const handleSaveNewRow = () => {
    if (newRowText.trim()) {
      const updated = [...(questionData.grid_rows || [])];
      // If we're editing an existing empty row, update it
      const emptyRowIndex = updated.findIndex(row => !row.text.trim());
      if (emptyRowIndex !== -1) {
        updated[emptyRowIndex] = { text: newRowText };
      } else {
        // Otherwise add as new row
        updated.push({ text: newRowText });
      }
      handleFieldChange("grid_rows", updated);
      setNewRowText(""); // Clear input after saving
    }
  };

  const handleSaveNewColumn = () => {
    if (newColumnText.trim()) {
      const updatedColumns = [...(questionData.grid_columns || [])];
      // If we're editing an existing empty column, update it
      const emptyColIndex = updatedColumns.findIndex(col => !col.text.trim());
      
      if (emptyColIndex !== -1) {
        updatedColumns[emptyColIndex] = { text: newColumnText };
      } else {
        // Find position to insert new column (before N/A if exists)
        const naIndex = updatedColumns.findIndex((col) => col.isNotApplicable);
        if (naIndex !== -1) {
          // Insert before N/A
          updatedColumns.splice(naIndex, 0, { text: newColumnText });
        } else {
          // Add to end if no N/A
          updatedColumns.push({ text: newColumnText });
        }
      }
      handleFieldChange("grid_columns", updatedColumns);
      setNewColumnText(""); // Clear input after saving
    }
  };

  // New handlers for grid columns
  const handleAddColumn = () => {
    handleSaveNewColumn();
  };

  const handleColumnChange = (index, newText) => {
    const updated = [...(questionData.grid_columns || [])];
    updated[index].text = newText;
    handleFieldChange("grid_columns", updated);
  };

  const handleDeleteColumn = (index) => {
    // Don't allow deletion of N/A option
    if (questionData.grid_columns[index].isNotApplicable) return;

    const updated = (questionData.grid_columns || []).filter((_, i) => i !== index);
    handleFieldChange("grid_columns", updated);
  };

  // Modified handler for N/A toggle
  const handleNotApplicableToggle = () => {
    const newShowNA = !showNotApplicable;
    setShowNotApplicable(newShowNA);

    let updatedColumns;
    if (newShowNA) {
      updatedColumns = [
        ...(questionData.grid_columns || []),
        {
          text: notApplicableText || "Not Applicable",
          isNotApplicable: true,
        },
      ];
    } else {
      updatedColumns = (questionData.grid_columns || []).filter(
        (col) => !col.isNotApplicable
      );
    }
    handleFieldChange("grid_columns", updatedColumns);
  };

  // Update handler for N/A text change
  const handleNotApplicableTextChange = (newText) => {
    setNotApplicableText(newText);
    // Update the N/A column text
    const updatedColumns = (questionData.grid_columns || []).map((col) =>
      col.isNotApplicable ? { ...col, text: newText } : col
    );
    handleFieldChange("grid_columns", updatedColumns);
  };

  // AI Edit handler - updated to use the new API endpoint
  // Update this function in QuestionEditorModal.js

  // AI Edit handler - updated to use the new API endpoint

  const isGridQuestion = () => {
    return ["radio-grid", "checkbox-grid", "star-rating-grid"].includes(
      questionType
    );
  };

  // Open branch editor for an option by index
  const openBranchEditor = (index) => {
    setBranchEditingIndex(index);
    const existing = options[index]?.branch;
    setBranchData(existing || null);
  };

  const handleAddImageOption = () => {
    const newOptions = [
      ...(questionData.image_options || []),
      // Add a default structure including hidden_label
      {
        image_url: "",
        label: "",
        hidden_label: `imgopt_new_${uuidv4().slice(0, 8)}`,
      },
    ];
    handleFieldChange("image_options", newOptions);
  };

  // Renamed to handlePrimaryImageFileSelect for clarity
  const handlePrimaryImageFileSelect = (event) => {
    const file = event.target.files[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Allow re-selecting the same file
    }
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type for question image.");
      return;
    }
    // Add size validation if desired
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds the ${maxSizeMB}MB limit.`);
      return;
    }

    setMediaFile(file); // IMPORTANT: Store the actual File object
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result); // Show local data URL for immediate preview
    };
    reader.readAsDataURL(file);
    // Clear any existing server URL from questionData, as a new local file takes precedence
    handleFieldChange("image_url", "");
  };
  
  // Maintain compatibility with option-specific image upload
  const handleImageUpload = async (event, optionIndex = null) => {
    if (optionIndex !== null) {
      const file = event.target.files[0];
      if (event.target) {
        event.target.value = null; // Allow re-selecting the same file
      }
      if (!file) return;

      // Client-side validation
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const maxSizeMB = 5;
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload JPG, PNG, GIF, or WEBP.");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`File size exceeds the ${maxSizeMB}MB limit.`);
        return;
      }

      // Store original URL to revert on failure.
      const originalImageUrl = questionData.image_options[optionIndex]?.image_url;

      // Show immediate preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        // Update preview for the specific option (temporarily uses dataUrl)
        const tempOptions = [...(questionData.image_options || [])];
        if (tempOptions[optionIndex]) {
          tempOptions[optionIndex] = {
            ...tempOptions[optionIndex],
            image_url: dataUrl,
            _previewing: true,
          }; // Mark as previewing
          handleFieldChange("image_options", tempOptions);
        }
      };
      reader.readAsDataURL(file);

      // Now upload to backend
      const uploadToast = toast.loading("Uploading option image…");
      uploadAPI.uploadImage(file)
        .then((response) => {
          const savedUrl = response.data.image_url; // e.g. "/uploads/images/…png"
          setQuestionData(prevData => {
            const newImageOptions = [...(prevData.image_options || [])];
            if (newImageOptions[optionIndex]) {
              newImageOptions[optionIndex] = {
                ...newImageOptions[optionIndex],
                image_url: savedUrl,    // replace Base64 preview with server path
                _previewing: false,
              };
            }
            return { ...prevData, image_options: newImageOptions };
          });
          toast.success("Option image uploaded!", { id: uploadToast });
        })
        .catch((err) => {
          console.error("Option image upload failed:", err);
          toast.error("Failed to upload option image.", { id: uploadToast });
          // Revert to previous state
          setQuestionData(prevData => {
            const revertedOptions = [...(prevData.image_options || [])];
            if (revertedOptions[optionIndex]) {
              revertedOptions[optionIndex] = {
                ...revertedOptions[optionIndex],
                image_url: originalImageUrl,
                _previewing: false,
              };
            }
            return { ...prevData, image_options: revertedOptions };
          });
        });
    } else {
      // For the main question image, use the new handler
      handlePrimaryImageFileSelect(event);
    }
  };

  // Updated function to remove image
  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImagePreview(null);    // Clear preview
    setMediaFile(null);       // Clear the pending File object
    handleFieldChange("image_url", ""); // Clear the relative server path in questionData
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    // If editing an existing question, restore original state and return to preview
    if (initialQuestion) {
      setQuestionData(initialQuestion);
      setIsPreview(true);
    } else {
      // Only call onCancel if this is a new question being added
      onCancel();
    }
  };

  // Update handleAddNewQuestion to prevent default event behavior
  const handleAddNewQuestion = (e) => {
    if (e) {
      e.preventDefault(); // Prevent form submission
      e.stopPropagation(); // Stop event bubbling
    }

    // If it's a quick poll and already has 3 questions/editors
    if (isQuickPoll && totalQuestions >= 3) {
      // Use react-hot-toast
      toast.error("Quick Polls are limited to 3 questions only", {
        duration: 3000,
        position: "top-center",
        style: {
          background: "#FF3B30",
          color: "#fff",
          fontFamily: "Poppins, sans-serif",
          fontSize: "14px",
          padding: "16px",
          borderRadius: "8px",
        },
        icon: "⚠️",
      });
      return;
    }

    // Call the parent component's function to open a new question modal
    if (onAddButtonClick) {
      onAddButtonClick();
    }
  };

  // Update handleCopyQuestion to use the parent's onCopy handler
  const handleCopyQuestion = () => {
    if (onCopy) {
      // Get current state of the question
      const currentQuestionState = {
        ...questionData,
        text: `${questionData.text} - Copy`,
        question_text_html: questionData.question_text_html ? `${questionData.question_text_html} - Copy` : undefined,
        id: undefined, // Clear ID for the copy
        // Deep copy arrays and objects
        options: Array.isArray(questionData.options) 
          ? questionData.options.map(opt => typeof opt === 'string' ? opt : { ...opt })
          : [],
        image_options: Array.isArray(questionData.image_options)
          ? questionData.image_options.map(opt => ({ ...opt }))
          : [],
        grid_rows: Array.isArray(questionData.grid_rows) ? [...questionData.grid_rows] : [],
        grid_columns: Array.isArray(questionData.grid_columns) ? [...questionData.grid_columns] : [],
        scale_points: Array.isArray(questionData.scale_points) ? [...questionData.scale_points] : [],
        ranking_items: Array.isArray(questionData.ranking_items) ? [...questionData.ranking_items] : [],
        branch: null, // Reset branch logic
        conditional_logic_rules: questionData.conditional_logic_rules, // Preserve conditional logic
      };

      console.log('Copying current question state:', currentQuestionState);
      onCopy(currentQuestionState);
      toast.success('Question copied!');
    }
  };

  // Update handleDeleteQuestion to remove duplicate confirmation
  const handleDeleteQuestion = () => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      console.log(
        "[QEM] handleDeleteQuestion called. Associated editorId:", editorId, 
        "questionData.id:", questionData.id,
        "Attempting to call props.onDelete."
      );
      if (typeof onDelete === 'function') { // 'onDelete' here refers to the prop passed TO QuestionEditorModal
        onDelete(questionData.id || editorId); // This calls the parent's (CreateSurvey's) onDelete
        if (typeof onCancel === 'function') {
          onCancel();
        }
      } else {
        console.error("[QEM] Error: onDelete prop is not a function. Props:", {isOpen, initialQuestion, onSave, onCancel, onDelete});
        toast.error("Deletion action is not properly configured.");
      }
    }
  };

  // Modify handleSubmit to properly handle branch data

  // Modify handleAddBranch to match CreateSurvey implementation
  const handleAddBranch = (optionIndex, event) => {
    // Get current position of the + button for menu placement
    const rect = event.currentTarget.getBoundingClientRect();
    setTypeMenuPosition({
      x: rect.right + 10,
      y: rect.top,
    });
    setShowTypeMenuForOption(optionIndex);
  };

  // Calculate nested width based on parent width and margins
  const NESTED_MARGIN = 65; // 45px left margin + 20px padding
  const getNestedWidth = () => {
    return isBranched ? 700 : 975; // Base width for container
  };

  const getInputWidth = () => {
    return isBranched ? 740 : 925; // Reduced width for inputs in nested questions
  };

  // Modify handleSelectBranchType to properly create branch structure
  const handleSelectBranchType = (type) => {
    if (showTypeMenuForOption === "branch-new") {
      // Handle new branch question
      setBranchingData({
        ...branchingData,
        questions: [
          ...branchingData.questions,
          {
            type: type,
            text: "",
            options: ["multiple-choice", "single-choice"].includes(type)
              ? [""]
              : [],
            required: false,
          },
        ],
      });
    } else {
      // Handle regular option branching
      const optionIndex = showTypeMenuForOption;
      if (optionIndex === null) return;

      const branchData = {
        questions: [
          {
            text: "",
            type: type,
            options: ["multiple-choice", "single-choice"].includes(type)
              ? [""]
              : [],
            required: false,
          },
        ],
        jump_to_question: null,
        return_to_origin: false,
      };

      setQuestionData((prev) => ({
        ...prev,
        branch: {
          ...(prev.branch || {}),
          [optionIndex]: branchData,
        },
      }));
    }

    // Reset menu state
    setShowTypeMenuForOption(null);
  };

  // Create QuestionTypeMenu component
  const QuestionTypeMenu = () => {
    if (showTypeMenuForOption === null) return null;

    const questionTypes = [
      { value: "single-choice", label: "Single Choice" },
      { value: "multi-choice", label: "Multiple Choice" },
      { value: "open-ended", label: "Open-Ended Textbox" },
      { value: "rating", label: "Slider" },
      { value: "star-rating", label: "Star Rating" },
      { value: "nps", label: "NPS (0–10)" },
      { value: "numerical-input", label: "Numerical Input" },
      { value: "email-input", label: "Email Input" },
      { value: "date-picker", label: "Date Selection" },
      // new question types
      { value: "radio-grid", label: "Grid Question" },
      { value: "star-rating-grid", label: "Star Rating Grid" },
      { value: "signature", label: "Signature" },
      { value: "scale-grid", label: "Scale Grid" },
      { value: "single-image-select", label: "Single Image Select" },
      { value: "multiple-image-select", label: "Multiple Image Select" },
      { value: "document-upload", label: "Document Upload" },
      { value: "interactive-ranking", label: "Interactive Ranking" },
      { value: "content-text", label: "Text Content", icon: "ri-text" },
      { value: "content-media", label: "Media Content", icon: "ri-image-line" },
      { value: "scale", label: "scale", icon: "ri-scale" },
    ];

    return (
      // --- Style moved to CSS: .question-editor__type-menu ---
      // --- Dynamic styles (left, top) remain inline ---
      <div
        className="question-editor__type-menu"
        style={{
          left: typeMenuPosition.x,
          top: typeMenuPosition.y,
        }}
      >
        {questionTypes.map((type, index) => (
          // --- Style moved to CSS: .question-editor__type-menu-item ---
          <button
            key={type.value}
            onClick={() => handleSelectBranchType(type.value)}
            className="question-editor__type-menu-item"
          >
            {type.label}
          </button>
        ))}
      </div>
    );
  };
  {
    /* Numerical Branch Editor - modal-style overlay */
  }

  // Modify styles for option row and branch button
  const renderTypeSpecificFields = () => {
    switch (questionData.type) {
      case "single-choice":
      case "multi-choice": // Combine similar cases where possible
        const isSingleChoice = questionData.type === "single-choice";
        return (
          // --- Removed inline style: marginBottom --- (Handled by parent or specific classes)
          <div className="question-editor__options-container">
            {questionData.options.map((option, index) => (
              <div key={index} className="question-editor__option-group">
                <div className="question-editor__option-row">
                  <div className="question-editor__option-number">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={option.text || ""}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="question-editor__option-input"
                    onBlur={() => {
                      if (!option.text?.trim()) {
                        handleOptionChange(index, `Option ${index + 1}`);
                      }
                    }}
                  />
                  <div className="question-editor__option-controls">
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="question-editor__btn question-editor__btn--icon"
                    >
                      <i className="ri-close-circle-line"></i>
                    </button>
                  </div>
                </div>

                {/* Inline Advanced Branch Editor - Only for single choice */}
                {isSingleChoice && editingBranchForOption === index && (
                  <div className="question-editor__branch-panel">
                    {/* Branch configuration */}
                    <div className="question-editor__branch-section">
                      <h4 className="question-editor__branch-title">
                        Branch Questions
                      </h4>
                      <div className="question-editor__branch-content">
                        {/* Branch questions list */}
                        {branchingData.questions.map(
                          (branchQuestion, qIndex) => (
                            <div
                              key={qIndex}
                              className="question-editor__branch-question"
                            >
                              <QuestionEditorModal
                                isOpen={true}
                                initialQuestion={branchQuestion}
                                onSave={(updatedQuestion) => {
                                  const updatedQuestions = [
                                    ...branchingData.questions,
                                  ];
                                  updatedQuestions[qIndex] = updatedQuestion;
                                  setBranchingData({
                                    ...branchingData,
                                    questions: updatedQuestions,
                                  });
                                }}
                                onCancel={() => {
                                  const updatedQuestions = [
                                    ...branchingData.questions,
                                  ];
                                  updatedQuestions.splice(qIndex, 1);
                                  setBranchingData({
                                    ...branchingData,
                                    questions: updatedQuestions,
                                  });
                                }}
                                isBranched={true}
                                position={position + 1}
                                questionNumber={`${questionNumber}.${
                                  index + 1
                                }.${qIndex + 1}`}
                              />
                            </div>
                          )
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setTypeMenuPosition({
                              x: rect.right + 10,
                              y: rect.top,
                            });
                            setShowTypeMenuForOption("branch-new");
                          }}
                          className="question-editor__branch-add-btn"
                        >
                          <i className="ri-add-line"></i>
                        </button>
                      </div>
                    </div>

                    <div className="question-editor__branch-section">
                      <h4 className="question-editor__branch-title">
                        Branch End Behavior
                      </h4>
                      <div className="question-editor__branch-content">
                        <select
                          value={branchingData.branchEndAction}
                          onChange={(e) =>
                            setBranchingData({
                              ...branchingData,
                              branchEndAction: e.target.value,
                              jump_to_question:
                                e.target.value === "jump"
                                  ? branchingData.jump_to_question
                                  : null,
                            })
                          }
                          className="question-editor__branch-select"
                        >
                          <option value="resume">
                            Resume main survey flow
                          </option>
                          <option value="jump">
                            Jump to specific question
                          </option>
                          <option value="end">End survey</option>
                        </select>

                        {branchingData.branchEndAction === "jump" && (
                          <div className="question-editor__branch-jump">
                            <label>Jump to question number:</label>
                            <input
                              type="number"
                              min="1"
                              value={branchingData.jump_to_question || ""}
                              onChange={(e) =>
                                setBranchingData({
                                  ...branchingData,
                                  jump_to_question:
                                    parseInt(e.target.value) || null,
                                })
                              }
                              className="question-editor__branch-input"
                              required
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="question-editor__branch-actions">
                      <button
                        onClick={() => {
                          handleSaveBranch(branchingData);
                          setEditingBranchForOption(null);
                        }}
                        className="question-editor__btn question-editor__btn--primary"
                      >
                        Save Branch Logic
                      </button>
                      <button
                        onClick={() => setEditingBranchForOption(null)}
                        className="question-editor__btn question-editor__btn--secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addOption}
              className="question-editor__btn question-editor__btn--primary question-editor__btn--add"
            >
              <i className="ri-add-line"></i>
              Add Option
            </button>

            {/* Selection Rules - Only for multi-choice */}
            {questionData.type === "multi-choice" && (
              <div className="question-editor__selection-rules">
                {/* ... Selection rules content ... */}
                <div className="question-editor__field question-editor__field--toggle">
                  <label className="question-editor__toggle-label">
                    Set Selection Rules
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      questionData.min_selection || questionData.max_selection
                        ? "question-editor__toggle--active"
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        questionData.min_selection ||
                        questionData.max_selection
                      ) {
                        handleFieldChange("min_selection", null);
                        handleFieldChange("max_selection", null);
                      } else {
                        handleFieldChange("min_selection", 1);
                        handleFieldChange(
                          "max_selection",
                          questionData.options.length
                        );
                      }
                    }}
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                </div>

                {(questionData.min_selection || questionData.max_selection) && (
                  <div className="question-editor__selection-rules-panel">
                    <div className="question-editor__selection-rules-inputs">
                      <div className="question-editor__selection-rule">
                        <label>Minimum selections:</label>
                        <input
                          type="number"
                          max={
                            questionData.max_selection ||
                            questionData.options.length
                          }
                          value={questionData.min_selection || ""}
                          onChange={(e) => {
                            const value = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            handleFieldChange("min_selection", value);
                          }}
                          placeholder="No minimum"
                          className="question-editor__selection-input"
                        />
                      </div>
                      <div className="question-editor__selection-rule">
                        <label>Maximum selections:</label>
                        <input
                          type="number"
                          min={questionData.min_selection || 1}
                          max={questionData.options.length}
                          value={questionData.max_selection || ""}
                          onChange={(e) => {
                            const value = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            handleFieldChange("max_selection", value);
                          }}
                          placeholder="No maximum"
                          className="question-editor__selection-input"
                        />
                      </div>
                    </div>
                    {questionData.options.length > 0 && (
                      <p className="question-editor__selection-hint">
                        Participants can select between{" "}
                        {questionData.min_selection || "0"} and{" "}
                        {questionData.max_selection ||
                          questionData.options.length}{" "}
                        options from {questionData.options.length} choices.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Special Options */}
            <div className="question-editor__special-options">
              {/* ... NA and Other options ... */}
              <div className="question-editor__special-option">
                <div className="question-editor__field--toggle">
                  <label className="question-editor__toggle-label">
                    Add "Not Applicable" Option
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      showNotApplicable ? "question-editor__toggle--active" : ""
                    }`}
                    onClick={() => {
                      setShowNotApplicable(!showNotApplicable);
                      handleFieldChange("not_applicable", !showNotApplicable);
                    }}
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                </div>
                {showNotApplicable && (
                  <input
                    type="text"
                    value={notApplicableText}
                    onChange={(e) => {
                      setNotApplicableText(e.target.value);
                      handleFieldChange("not_applicable_text", e.target.value);
                    }}
                    className="question-editor__special-input"
                    placeholder="Not Applicable"
                  />
                )}
              </div>

              <div className="question-editor__special-option">
                <div className="question-editor__field--toggle">
                  <label className="question-editor__toggle-label">
                    Add "Other" Option with Text Box
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      showOther ? "question-editor__toggle--active" : ""
                    }`}
                    onClick={() => {
                      setShowOther(!showOther);
                      handleFieldChange("has_other_option", !showOther);
                    }}
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                </div>
                {showOther && (
                  <input
                    type="text"
                    value={otherOptionText}
                    onChange={(e) => {
                      setOtherOptionText(e.target.value);
                      handleFieldChange("other_option_text", e.target.value);
                    }}
                    className="question-editor__special-input"
                    placeholder="Other (Please specify)"
                  />
                )}
              </div>
              
            </div>
          </div>
        );

      case "rating": // Slider type
        return (
          // --- Removed inline style: marginBottom ---
          <div className="question-editor__type-specific-fields">
            <div className="question-editor__slider-section">
              <div className="question-editor__slider-labels">
                {/* ... label groups ... */}
                <div className="question-editor__slider-label-group">
                  <label>Left Label</label>
                  <input
                    type="text"
                    value={questionData.left_label || ""}
                    onChange={(e) =>
                      handleFieldChange("left_label", e.target.value)
                    }
                    placeholder="e.g., Not at all likely"
                    className="question-editor__slider-input"
                  />
                </div>
                <div className="question-editor__slider-label-group">
                  <label>Center Label (Optional)</label>
                  <input
                    type="text"
                    value={questionData.center_label || ""}
                    onChange={(e) =>
                      handleFieldChange("center_label", e.target.value)
                    }
                    placeholder="e.g., Neutral"
                    className="question-editor__slider-input"
                  />
                </div>
                <div className="question-editor__slider-label-group">
                  <label>Right Label</label>
                  <input
                    type="text"
                    value={questionData.right_label || ""}
                    onChange={(e) =>
                      handleFieldChange("right_label", e.target.value)
                    }
                    placeholder="e.g., Extremely likely"
                    className="question-editor__slider-input"
                  />
                </div>
              </div>
              {/* END UPDATED */}

              <div className="question-editor__slider-range">
                {/* ... range groups ... */}
                <div className="question-editor__slider-range-group">
                  <label>Start Value</label>
                  <input
                    type="number"
                    value={questionData.rating_start || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "rating_start",
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="e.g., 0"
                    className="question-editor__slider-input"
                  />
                </div>
                <div className="question-editor__slider-range-group">
                  <label>End Value</label>
                  <input
                    type="number"
                    value={questionData.rating_end || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "rating_end",
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="e.g., 10"
                    className="question-editor__slider-input"
                  />
                </div>
                <div className="question-editor__slider-range-group">
                  <label>Step Size</label>
                  <input
                    type="number"
                    value={questionData.rating_step || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "rating_step",
                        e.target.value ? parseFloat(e.target.value) : ""
                      )
                    }
                    placeholder="e.g., 1"
                    className="question-editor__slider-input"
                  />
                </div>
              </div>

              <div className="question-editor__slider-preview">
                {/* ... preview elements ... */}
                <div className="question-editor__slider-preview-labels">
                  <span>{questionData.left_label || "Left Label"}</span>
                  {questionData.center_label && (
                    <span>{questionData.center_label}</span>
                  )}
                  <span>{questionData.right_label || "Right Label"}</span>
                </div>
                <div className="question-editor__slider-preview-track">
                  <div className="question-editor__slider-preview-handle"></div>
                </div>
                <div className="question-editor__slider-preview-values">
                  <span>{questionData.rating_start || "0"}</span>
                  {questionData.center_label && (
                    <span>
                      {Math.floor(
                        (parseInt(questionData.rating_start || 0) +
                          parseInt(questionData.rating_end || 10)) /
                          2
                      )}
                    </span>
                  )}
                  <span>{questionData.rating_end || "10"}</span>
                </div>
              </div>
              {/* END UPDATED */}

              {/* Not Applicable Toggle (Remains the same) */}
              <div className="question-editor__slider-na-toggle">
                <div className="question-editor__toggle-row">
                  <label className="question-editor__toggle-label">
                    Add "Not Applicable" Option
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      questionData.show_na // Use show_na from state
                        ? "question-editor__toggle--active"
                        : ""
                    }`}
                    onClick={
                      () => handleFieldChange("show_na", !questionData.show_na) // Update show_na
                    }
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                </div>
                {/* ADDED: Input for N/A text if shown */}
                {questionData.show_na && (
                  <input
                    type="text"
                    value={questionData.not_applicable_text || "Not Applicable"}
                    onChange={(e) =>
                      handleFieldChange("not_applicable_text", e.target.value)
                    }
                    className="question-editor__special-input" // Reuse style
                    placeholder="N/A option text"
                  />
                )}
              </div>
            </div>
          </div>
        );

      case "nps":
        return (
          // --- Removed inline style: marginBottom ---
          <div className="question-editor__type-specific-fields">
            {/* --- Removed inline style: display, flexDirection, gap, width --- */}
            {/* --- Assign class: question-editor__nps-controls --- */}
            <div className="question-editor__nps-controls">
              {/* --- Removed inline style: display, gap, marginBottom --- */}
              {/* --- Assign class: question-editor__nps-label-group --- */}
              <div className="question-editor__nps-label-group">
                {/* --- Removed inline style: flex --- */}
                {/* --- Assign class: question-editor__nps-label-container --- */}
                <div className="question-editor__nps-label-container">
                  {/* --- Removed inline style: display, marginBottom, color, fontSize --- */}
                  {/* --- Assign class: question-editor__label --- */}
                  <label className="question-editor__label">Left Label</label>
                  <input
                    type="text"
                    value={questionData.nps_left_label || "Not at all likely"}
                    onChange={(e) =>
                      handleFieldChange("nps_left_label", e.target.value)
                    }
                    // --- Removed inline style: width, padding, border, borderRadius, fontSize, backgroundColor ---
                    // --- Assign class: question-editor__input question-editor__input--small (or similar) ---
                    className="question-editor__input question-editor__input--nps-label"
                  />
                </div>
                {/* --- Removed inline style: flex --- */}
                {/* --- Assign class: question-editor__nps-label-container --- */}
                <div className="question-editor__nps-label-container">
                  {/* --- Assign class: question-editor__label --- */}
                  <label className="question-editor__label">Right Label</label>
                  <input
                    type="text"
                    value={questionData.nps_right_label || "Extremely likely"}
                    onChange={(e) =>
                      handleFieldChange("nps_right_label", e.target.value)
                    }
                    // --- Assign class: question-editor__input question-editor__input--nps-label ---
                    className="question-editor__input question-editor__input--nps-label"
                  />
                </div>
              </div>

              {/* --- Removed inline style: marginTop --- */}
              <div className="question-editor__nps-preview-container">
                {/* --- Removed inline style: display, justifyContent, marginBottom, padding, gap --- */}
                {/* --- Assign class: question-editor__nps-preview-labels --- */}
                <div className="question-editor__nps-preview-labels">
                  {/* --- Removed inline style: color, fontSize, fontFamily --- */}
                  {/* --- Assign class: question-editor__nps-preview-label --- */}
                  <span className="question-editor__nps-preview-label">
                    {questionData.nps_left_label || "Not at all likely"}
                  </span>
                  {/* --- Assign class: question-editor__nps-preview-label --- */}
                  <span className="question-editor__nps-preview-label">
                    {questionData.nps_right_label || "Extremely likely"}
                  </span>
                </div>

                {/* --- Removed inline style: display, justifyContent, gap, marginBottom --- */}
                {/* --- Assign class: question-editor__nps-preview-buttons --- */}
                <div className="question-editor__nps-preview-buttons">
                  {[...Array(11)].map((_, i) => (
                    <div
                      key={i}
                      className="question-editor__nps-preview-button"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                {/* Numerical Branching - Also applicable to NPS */}
                
              </div>
            </div>
          </div>
        );

      case "date-picker":
        return (
          // --- Removed inline style: marginBottom ---
          <div className="question-editor__type-specific-fields">
            {/* --- Removed inline style: display, gap, width, justifyContent --- */}
            {/* --- Assign class: question-editor__date-picker-controls --- */}
            <div className="question-editor__date-picker-controls">
              {/* --- Removed inline style: flex --- */}
              <div className="question-editor__date-picker-control">
                {/* --- Assign class: question-editor__label --- */}
                <label className="question-editor__label">
                  Minimum Date (Optional)
                </label>
                <DatePicker
                  selected={
                    questionData.min_date
                      ? new Date(questionData.min_date)
                      : null
                  }
                  onChange={(date) =>
                    handleFieldChange(
                      "min_date",
                      date ? date.toISOString() : ""
                    )
                  }
                  dateFormat="yyyy-MM-dd"
                  className="question-editor__date-field"
                />
              </div>
              {/* --- Removed inline style: flex --- */}
              <div className="question-editor__date-picker-control">
                {/* --- Assign class: question-editor__label --- */}
                <label className="question-editor__label">
                  Maximum Date (Optional)
                </label>
                <DatePicker
                  selected={
                    questionData.max_date
                      ? new Date(questionData.max_date)
                      : null
                  }
                  onChange={(date) =>
                    handleFieldChange(
                      "max_date",
                      date ? date.toISOString() : ""
                    )
                  }
                  dateFormat="yyyy-MM-dd"
                  className="question-editor__date-field"
                />
              </div>
            </div>

            <div className="question-editor__branch-section2">
              {/* ... Branching logic ... */}

              {questionData.numerical_branch_enabled && (
                <>
                  <div className="question-editor__field">
                    <label className="question-editor__label">
                      Date Branch Rules
                    </label>
                    <div className="question-editor__rules-container">
                      {(questionData.numerical_branch_rules || []).map(
                        (rule, ruleIndex) => (
                          <div
                            key={ruleIndex}
                            className="question-editor__rule numerical-rule" // Keep numerical-rule if specific styles exist
                          >
                            <div className="question-editor__rule-row">
                              <select
                                value={rule.condition}
                                onChange={(e) => {
                                  /* ... */
                                }}
                                className="question-editor__rule-select"
                              >
                                <option value="before">Before</option>
                                <option value="on">On</option>
                                <option value="after">After</option>
                              </select>
                              <DatePicker
                                selected={
                                  rule.value ? new Date(rule.value) : null
                                }
                                onChange={(date) => {
                                  /* ... */
                                }}
                                dateFormat="yyyy-MM-dd"
                                className="question-editor__date-field question-editor__date-field--rule" // Updated modifier class
                                placeholderText="Select date"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleEditNumericalBranch(ruleIndex)
                                }
                                className={`question-editor__branch-btn ${
                                  rule.branch
                                    ? "question-editor__branch-btn--active"
                                    : ""
                                }`}
                              >
                                <i className="ri-git-branch-line"></i>
                                {rule.branch ? "Edit Branch" : "Add Logic Flow"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  /* ... */
                                }}
                                className="question-editor__btn question-editor__btn--icon"
                              >
                                <i className="ri-close-circle-line"></i>
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      {(!questionData.numerical_branch_rules ||
                        questionData.numerical_branch_rules.length < 3) && ( // Limit rules if needed
                        <button
                          type="button"
                          onClick={() => {
                            // --- START: Logic to ADD a rule ---
                            const currentRules =
                              questionData.numerical_branch_rules || [];
                            const newRule = {
                              condition: "equal", // Default condition
                              value: null, // Default value (use null or '')
                              branch: null, // No branch initially
                              // Consider adding a temporary unique ID if needed for keys before saving
                              // id: `temp_${Date.now()}`
                            };
                            const updatedRules = [...currentRules, newRule];
                            // Use the existing state update function
                            handleFieldChange(
                              "numerical_branch_rules",
                              updatedRules
                            );
                            // Optional: Ensure the feature stays enabled
                            if (!questionData.numerical_branch_enabled) {
                              handleFieldChange(
                                "numerical_branch_enabled",
                                true
                              );
                            }
                            // --- END: Logic to ADD a rule ---
                          }}
                          className="question-editor__btn question-editor__btn--primary question-editor__btn--add"
                        >
                          <i className="ri-add-line"></i>
                          Add Logic Flow Rule
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case "email-input":
        return (
          // --- Removed inline style: marginBottom ---
          <div className="question-editor__type-specific-fields">
            {/* --- Removed inline style: display, flexDirection, gap, width --- */}
            {/* --- Assign class: question-editor__email-controls --- */}
            <div className="question-editor__email-controls">
              {/* --- Removed inline style: width --- */}
              <div className="question-editor__field question-editor__field--toggle">
                <label className="question-editor__toggle-label">
                  Verify domain exists
                </label>
                <div
                  className={`question-editor__toggle ${
                    questionData.verify_domain
                      ? "question-editor__toggle--active"
                      : ""
                  }`}
                  onClick={() =>
                    handleFieldChange(
                      "verify_domain",
                      !questionData.verify_domain
                    )
                  }
                >
                  <div className="question-editor__toggle-handle" />
                </div>
              </div>

              <div className="question-editor__field">
                {/* --- Assign class: question-editor__label --- */}
                <label className="question-editor__label">
                  Allowed Domains (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={questionData.allowed_domains || ""}
                  onChange={(e) =>
                    handleFieldChange("allowed_domains", e.target.value)
                  }
                  placeholder="e.g., gmail.com, outlook.com"
                  // --- Removed inline style: width, padding, border, borderRadius, fontSize, backgroundColor, boxSizing ---
                  // --- Assign class: question-editor__input ---
                  className="question-editor__input"
                />
              </div>
            </div>
          </div>
        );

      case "numerical-input":
      case "nps":
      case "star-rating":
        const isNumerical = questionData.type === "numerical-input";
        const isNps = questionData.type === "nps";
        const isStar = questionData.type === "star-rating";
        const valueType = isNps
          ? "NPS Score"
          : isStar
          ? "Star Rating"
          : "Value";

        return (
          <div className="question-editor__type-specific-fields">
            {/* Min/Max for numerical-input only */}
            {isNumerical && (
              <div className="question-editor__numerical-controls">
                <div className="question-editor__numerical-control">
                  <label className="question-editor__label">
                    Minimum Value (Optional)
                  </label>
                  <input
                    type="number"
                    // FIX: Remove min="0" to allow negative numbers by default
                    value={questionData.min_value || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "min_value",
                        parseFloat(e.target.value) || null
                      )
                    }
                    placeholder="Any number (e.g., -100)"
                    className="question-editor__input"
                  />
                </div>
                <div className="question-editor__numerical-control">
                  <label className="question-editor__label">
                    Maximum Value (Optional)
                  </label>
                  <input
                    type="number"
                    // FIX: Remove min="0" to allow negative numbers by default
                    value={questionData.max_value || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "max_value",
                        parseFloat(e.target.value) || null
                      )
                    }
                    placeholder="Any number (e.g., 100)"
                    className="question-editor__input"
                  />
                </div>
              </div>
            )}

            {/* Force Positive toggle for numerical-input only */}
            {isNumerical && (
              <div className="question-editor__field question-editor__field--toggle">
                <label className="question-editor__toggle-label">
                  Force Positive Number
                </label>
                <div
                  className={`question-editor__toggle ${
                    questionData.force_positive
                      ? "question-editor__toggle--active"
                      : ""
                  }`}
                  onClick={() =>
                    handleFieldChange(
                      "force_positive",
                      !questionData.force_positive
                    )
                  }
                >
                  <div className="question-editor__toggle-handle" />
                </div>
              </div>
            )}

            {/* Star Rating - grid preview and N/A section only for star-rating */}
            {isStar && (
  <div style={{ marginBottom: "16px" }}>
    <div className="question-editor__star-rating-section">
      {/* Grid Preview Section - simplified */}
      <div className="question-editor__grid-preview">
        <div className="star-rating-preview">
          {[...Array(5)].map((_, i) => (
            <i
              key={i}
              className="ri-star-line"
              style={{ color: "#AA2EFF", fontSize: "24px", margin: "0 4px" }}
            ></i>
          ))}
        </div>
        {questionData.show_na && (
          <div className="star-rating-na-option">
            <label className="star-rating-na-label">
              <input 
                type="checkbox" 
                className="star-rating-na-checkbox"
                disabled 
              />
              <span className="star-rating-na-text">
                {questionData.not_applicable_text || "Not Applicable"}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* N/A Option Toggle */}
      <div className="question-editor__not-applicable">
        <div className="question-editor__na-header">
          <label className="question-editor__toggle-label">
            Add a "Not Applicable" option
          </label>
          <div
            className={`question-editor__toggle ${
              questionData.show_na
                ? "question-editor__toggle--active"
                : ""
            }`}
            onClick={() => {
              handleFieldChange("show_na", !questionData.show_na);
            }}
          >
            <div className="question-editor__toggle-handle" />
          </div>
          <span className="question-editor__na-note">
            (Won't be included in average calculations)
          </span>
        </div>
        {questionData.show_na && (
          <input
            type="text"
            value={questionData.not_applicable_text || ""}
            onChange={(e) =>
              handleFieldChange("not_applicable_text", e.target.value)
            }
            className="question-editor__na-input"
            placeholder="Not Applicable"
          />
        )}
      </div>
    </div>
  </div>
)}

            {/* Shared branching logic */}
            
          </div>
        );
      // --- Other cases (grid, signature, image select, etc.) should follow the same pattern ---
      // --- Remove inline styles, assign classes, ensure classes exist in CSS ---

      // --- Example for Grid ---
      case "radio-grid":
      case "checkbox-grid":
        return (
          // --- Removed inline style: marginBottom ---
          <div className="question-editor__type-specific-fields">
            {/* Grid Rows Section */}
            <div className="question-editor__grid-section">
              <h4 className="question-editor__subtitle">Grid Rows</h4>
              {(questionData.grid_rows || []).map((row, rowIndex) => (
                <div key={rowIndex} className="question-editor__grid-item">
                  <input
                    type="text"
                    value={row.text}
                    onChange={(e) => handleRowChange(rowIndex, e.target.value)}
                    placeholder="Row text"
                    className="question-editor__grid-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="question-editor__btn question-editor__btn--icon"
                    title="Delete row"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              ))}

              <div className="question-editor__grid-add">
                <input
                  type="text"
                  value={newRowText}
                  onChange={(e) => setNewRowText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNewRow();
                    }
                  }}
                  onBlur={handleSaveNewRow}
                  placeholder="Enter row label and press Enter"
                  className="question-editor__grid-input"
                />
                <button
                  type="button"
                  onClick={handleSaveNewRow}
                  className="question2-editor__btn question2-editor__btn--primary"
                >
                  <i className="ri-add-line"></i> Add Row
                </button>
              </div>
            </div>

            {/* Grid Columns Section */}
            <div className="question-editor__grid-section">
              {/* ... columns mapping and add ... */}
              <h4 className="question-editor__subtitle">Grid Columns</h4>
              {(questionData.grid_columns || []).map((column, colIndex) => (
                <div key={colIndex} className="question-editor__grid-item">
                  <input
                    type="text"
                    value={column.text}
                    onChange={(e) =>
                      handleColumnChange(colIndex, e.target.value)
                    }
                    placeholder="Column text"
                    className="question-editor__grid-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(colIndex)}
                    className="question-editor__btn question-editor__btn--icon"
                    title="Delete column"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              ))}
              <div className="question-editor__grid-add">
                <input
                  type="text"
                  value={newColumnText}
                  onChange={(e) => setNewColumnText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNewColumn();
                    }
                  }}
                  onBlur={handleSaveNewColumn}
                  placeholder="Enter column label and press Enter"
                  className="question-editor__grid-input"
                />
                <button
                  type="button"
                  onClick={handleSaveNewColumn}
                  className="question2-editor__btn question2-editor__btn--primary"
                >
                  <i className="ri-add-line"></i> Add Column
                </button>
              </div>
            </div>

            {/* Grid Preview Section */}
            {(questionData.grid_rows || []).length > 0 && (questionData.grid_columns || []).length > 0 && (
              <div className="question-editor__grid-section">
                <h4 className="question-editor__subtitle">Grid Preview</h4>
                <div className="question-editor__grid-preview">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        {(questionData.grid_columns || []).map((col, idx) => (
                          <th key={idx}>{col.text}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(questionData.grid_rows || []).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td>{row.text || `Row ${rowIndex + 1}`}</td>
                          {(questionData.grid_columns || []).map((_, colIndex) => (
                            <td key={colIndex}>
                              <div
                                className={
                                  questionData.type === "radio-grid"
                                    ? "radio-preview"
                                    : "checkbox-preview"
                                }
                              >
                                <div
                                  className={
                                    questionData.type === "radio-grid"
                                      ? "radio-circle"
                                      : "checkbox-square"
                                  }
                                ></div>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* N/A Option Toggle */}
            <div className="question-editor__not-applicable">
              {/* ... N/A toggle and input ... */}
              <div className="question-editor__na-header">
                <label className="question-editor__toggle-label">
                  Add a "Not Applicable" option
                </label>
                <div
                  className={`question-editor__toggle ${
                    showNotApplicable ? "question-editor__toggle--active" : ""
                  }`}
                  onClick={handleNotApplicableToggle}
                >
                  <div className="question-editor__toggle-handle" />
                </div>
                <span className="question-editor__na-note">
                  (Won't be included in calculations)
                </span>
              </div>
              {showNotApplicable && (
                <input
                  type="text"
                  value={notApplicableText}
                  onChange={(e) => {
                    setNotApplicableText(e.target.value);
                    handleNotApplicableTextChange(e.target.value);
                  }}
                  className="question-editor__na-input"
                  placeholder="Not Applicable"
                />
              )}
            </div>
          </div>
        );

      case "star-rating-grid":
  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Grid Rows Section */}
      <div className="question-editor__grid-section">
        <h4 className="question-editor__subtitle">Grid Rows</h4>
        {(questionData.grid_rows || []).map((row, rowIndex) => (
          <div key={rowIndex} className="question-editor__grid-item">
            <input
              type="text"
              value={row.text}
              onChange={(e) => handleRowChange(rowIndex, e.target.value)}
              placeholder="Row text"
              className="question-editor__grid-input"
            />
            <button
              type="button"
              onClick={() => handleDeleteRow(rowIndex)}
              className="question-editor__btn question-editor__btn--icon"
              title="Delete row"
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        ))}

        {/* Add Row Input */}
        <div className="question-editor__grid-add">
          <input
            type="text"
            value={newRowText}
            onChange={(e) => setNewRowText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNewRow();
              }
            }}
            onBlur={handleSaveNewRow}
            placeholder="Enter row label and press Enter"
            className="question-editor__grid-input"
          />
          <button
            type="button"
            onClick={handleSaveNewRow}
            className="question2-editor__btn question2-editor__btn--primary"
          >
            <i className="ri-add-line"></i> Add Row
          </button>
        </div>
      </div>

      {/* Grid Preview */}
      {(questionData.grid_rows || []).length > 0 && (
        <div className="question-editor__grid-section">
          <h4 className="question-editor__subtitle">Grid Preview</h4>
          <div className="question-editor__grid-preview">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Rating</th>
                  {questionData.show_na && <th>{questionData.not_applicable_text || "Not Applicable"}</th>}
                </tr>
              </thead>
              <tbody>
                {(questionData.grid_rows || []).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>{row.text || `Row ${rowIndex + 1}`}</td>
                    <td>
                      <div className="star-rating-preview">
                        {[...Array(5)].map((_, i) => (
                          <i
                            key={i}
                            className="ri-star-line"
                            style={{ color: "#AA2EFF" }}
                          ></i>
                        ))}
                      </div>
                    </td>
                    {questionData.show_na && (
                      <td>
                        <div className="star-rating-na-preview">
                          <div className="checkbox-preview">
                            <div className="checkbox-square"></div>
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* N/A Option Toggle */}
      <div className="question-editor__not-applicable">
        <div className="question-editor__na-header">
          <label className="question-editor__toggle-label">
            Add a "Not Applicable" option
          </label>
          <div
            className={`question-editor__toggle ${
              questionData.show_na
                ? "question-editor__toggle--active"
                : ""
            }`}
            onClick={() => {
              handleFieldChange("show_na", !questionData.show_na);
            }}
          >
            <div className="question-editor__toggle-handle" />
          </div>
        </div>
        {questionData.show_na && (
          <input
            type="text"
            value={questionData.not_applicable_text || ""}
            onChange={(e) =>
              handleFieldChange("not_applicable_text", e.target.value)
            }
            className="question-editor__na-input"
            placeholder="Not Applicable"
          />
        )}
      </div>
    </div>
  );

      case "signature":
        // No specific fields needed for signature,
        // will use standard image, title, description, required toggle and extra info
        return null;

      case "star-rating":
  return (
    <div style={{ marginBottom: "16px" }}>
      <div className="question-editor__star-rating-section">
        {/* Remove the rating label input section */}

        {/* Grid Preview Section - simplified */}
        <div className="question-editor__grid-preview">
          <div className="star-rating-preview" style={{ textAlign: 'center' }}>
            {[...Array(5)].map((_, i) => (
              <i
                key={i}
                className="ri-star-line"
                style={{ color: "#AA2EFF", fontSize: "24px", margin: "0 4px" }}
              ></i>
            ))}
          </div>
          {questionData.show_na && (
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              {questionData.not_applicable_text || "Not Applicable"}
            </div>
          )}
        </div>
      </div>

      {/* N/A Option Toggle */}
      <div className="question-editor__not-applicable">
        <div className="question-editor__na-header">
          <label className="question-editor__toggle-label">
            Add a "Not Applicable" option
          </label>
          <div
            className={`question-editor__toggle ${
              questionData.show_na
                ? "question-editor__toggle--active"
                : ""
            }`}
            onClick={() => {
              handleFieldChange("show_na", !questionData.show_na);
            }}
          >
            <div className="question-editor__toggle-handle" />
          </div>
          <span className="question-editor__na-note">
            (Won't be included in average calculations)
          </span>
        </div>
        {questionData.show_na && (
          <input
            type="text"
            value={questionData.not_applicable_text || ""}
            onChange={(e) =>
              handleFieldChange("not_applicable_text", e.target.value)
            }
            className="question-editor__na-input"
            placeholder="Not Applicable"
          />
        )}
      </div>
    </div>
  );

      case "single-image-select":
      case "multiple-image-select":
        return (
          <div style={{ marginBottom: "16px" }}>
            <div className="question-editor__image-options">
              {questionData.image_options?.map((option, index) => (
                <div key={index} className="question-editor__image-option">
                  <div className="question-editor__image-option-number">
                    {index + 1}
                  </div>
                  <div className="question-editor__image-option-content">
                    {option.image_url ? (
                      <div className="question-editor__image-option-preview">
                        <img
                          src={option.image_url}
                          alt={`Option ${index + 1}`}
                        />
                      </div>
                    ) : (
                      <div className="question-editor__image-option-preview">
                        <img
                          src=""
                          alt={`Option ${index + 1}`}
                        />
                      </div>
                    )}
                   

                    <input
                      type="text"
                      value={option.label || ""}
                      onChange={(e) => {
                        const newOptions = [...questionData.image_options];
                        newOptions[index] = {
                          ...newOptions[index],
                          label: e.target.value,
                        };
                        handleFieldChange("image_options", newOptions);
                      }}
                      placeholder="Image label (optional)"
                      className="question-editor__image-label-input"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = questionData.image_options.filter(
                          (_, i) => i !== index
                        );
                        handleFieldChange("image_options", newOptions);
                      }}
                      className="question-editor__btn question-editor__btn--icon"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newOptions = [
                    ...(questionData.image_options || []),
                    { image_url: "", label: "" },
                  ];
                  handleFieldChange("image_options", newOptions);
                }}
                className="question-editor__btn question-editor__btn--primary question-editor__btn--add"
              >
                <i className="ri-add-line"></i>
                Add Image Option
              </button>

              {questionData.type === "multiple-image-select" && (
                <div className="question-editor__selection-rules">
                  <div className="question-editor__field question-editor__field--toggle">
                    <label className="question-editor__toggle-label">
                      Set Selection Rules
                    </label>
                    <div
                      className={`question-editor__toggle ${
                        questionData.min_selection || questionData.max_selection
                          ? "question-editor__toggle--active"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          questionData.min_selection ||
                          questionData.max_selection
                        ) {
                          handleFieldChange("min_selection", null);
                          handleFieldChange("max_selection", null);
                        } else {
                          handleFieldChange("min_selection", 1);
                          handleFieldChange(
                            "max_selection",
                            questionData.image_options?.length || 1
                          );
                        }
                      }}
                    >
                      <div className="question-editor__toggle-handle" />
                    </div>
                  </div>

                  {(questionData.min_selection ||
                    questionData.max_selection) && (
                    <div className="question-editor__selection-rules-panel">
                      <div className="question-editor__selection-rules-inputs">
                        <div className="question-editor__selection-rule">
                          <label>Minimum selections:</label>
                          <input
                            type="number"
                            max={
                              questionData.max_selection ||
                              questionData.options.length
                            }
                            value={questionData.min_selection || ""}
                            onChange={(e) => {
                              const value = e.target.value
                                ? parseInt(e.target.value)
                                : null;
                              handleFieldChange("min_selection", value);
                            }}
                            placeholder="No minimum"
                            className="question-editor__selection-input"
                          />
                        </div>
                        <div className="question-editor__selection-rule">
                          <label>Maximum selections:</label>
                          <input
                            type="number"
                            min={questionData.min_selection || 1}
                            max={questionData.image_options?.length}
                            value={questionData.max_selection || ""}
                            onChange={(e) => {
                              const value = e.target.value
                                ? parseInt(e.target.value)
                                : null;
                              handleFieldChange("max_selection", value);
                            }}
                            placeholder="No maximum"
                            className="question-editor__selection-input"
                          />
                        </div>
                      </div>
                      {questionData.image_options?.length > 0 && (
                        <p className="question-editor__selection-hint">
                          Participants can select between{" "}
                          {questionData.min_selection || "0"} and{" "}
                          {questionData.max_selection ||
                            questionData.image_options.length}{" "}
                          images from {questionData.image_options.length}{" "}
                          choices.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case "document-upload":
        return (
          <div style={{ marginBottom: "16px" }}>
            <div className="question-editor__file-upload-section">
              <div className="question-editor__field">
                <label className="question-editor__label">
                  Allowed File Types
                </label>
                <input
                  type="text"
                  value={
                    questionData.allowed_types ||
                    "png, gif, jpg, jpeg, doc, xls, docx, xlsx, pdf, txt"
                  }
                  onChange={(e) =>
                    handleFieldChange("allowed_types", e.target.value)
                  }
                  placeholder="png, gif, jpg, jpeg, doc, xls, docx, xlsx, pdf, txt"
                  className="question-editor__input"
                />
              </div>

              {/* Rest of document upload fields remain the same */}
              <div className="question-editor__field">
                <label className="question-editor__label">
                  Maximum File Size (MB)
                </label>
                <input
                  type="number"
                  value={questionData.max_file_size || ""}
                  onChange={(e) =>
                    handleFieldChange(
                      "max_file_size",
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  placeholder="5"
                  min="1"
                  max="50"
                  className="question-editor__input"
                />
              </div>

              <div className="question-editor__field">
                <label className="question-editor__label">
                  Maximum Number of Files
                </label>
                <input
                  type="number"
                  value={questionData.max_files || 1}
                  onChange={(e) =>
                    handleFieldChange(
                      "max_files",
                      e.target.value ? Number(e.target.value) : 1
                    )
                  }
                  min="1"
                  max="10"
                  className="question-editor__input"
                />
              </div>

              <div className="question-editor__upload-preview">
                <div className="question-editor__mock-upload">
                  <button
                    type="button"
                    className="question-editor__file-button"
                  >
                    Choose File
                  </button>
                  <span className="question-editor__file-label">
                    No file chosen
                  </span>
                </div>
                <p className="question-editor__upload-helper">
                  Participants will be able to upload up to{" "}
                  {questionData.max_files || 1} file
                  {questionData.max_files > 1 ? "s" : ""}
                  {questionData.max_file_size
                    ? ` with ${questionData.max_file_size}MB size each`
                    : ""}
                  .
                  {questionData.allowed_types
                    ? ` Allowed types: ${questionData.allowed_types}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        );

      case "interactive-ranking":
        return (
          <div style={{ marginBottom: "16px" }}>
            <div className="question-editor__ranking-section">
              <label className="question-editor__label">Ranking Items</label>

              <div className="question-editor__ranking-items">
                {questionData.ranking_items?.map((item, index) => (
                  <div
                    key={index}
                    className="question-editor__ranking-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", index.toString());
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add(
                        "question-editor__ranking-item--over"
                      );
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove(
                        "question-editor__ranking-item--over"
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove(
                        "question-editor__ranking-item--over"
                      );
                      const dragIndex = parseInt(
                        e.dataTransfer.getData("text/plain")
                      );
                      const dropIndex = index;

                      if (dragIndex === dropIndex) return;

                      const newItems = [...questionData.ranking_items];
                      const [removed] = newItems.splice(dragIndex, 1);
                      newItems.splice(dropIndex, 0, removed);
                      handleFieldChange("ranking_items", newItems);
                    }}
                  >
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const newItems = [...questionData.ranking_items];
                        newItems[index] = { ...item, text: e.target.value };
                        handleFieldChange("ranking_items", newItems);
                      }}
                      placeholder={`Item ${index + 1}`}
                      className="question-editor__ranking-input"
                    />
                    <div className="question-editor__ranking-controls">
                      <div className="question-editor__ranking-handle">
                        <i className="ri-drag-move-line"></i>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = questionData.ranking_items.filter(
                            (_, i) => i !== index
                          );
                          handleFieldChange("ranking_items", newItems);
                        }}
                        className="question-editor__btn question-editor__btn--icon"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const newItems = [
                    ...(questionData.ranking_items || []),
                    { text: "" },
                  ];
                  handleFieldChange("ranking_items", newItems);
                }}
                className="question-editor__btn question-editor__btn--primary question-editor__btn--add"
              >
                <i className="ri-add-line"></i>
                Add Item
              </button>

              <div className="question-editor__field question-editor__field--toggle"></div>
            </div>
          </div>
        );

      case "scale":
        return (
          <div style={{ marginBottom: "16px" }}>
            <div className="question-editor__scale-section">
              {/* Scale Points Section */}
              <div className="question-editor__scale-points">
                <h4 className="question-editor__subtitle">Scale Points</h4>
                {questionData.scale_points?.map((point, index) => (
                  <div key={index} className="question-editor__scale-item">
                    <div className="question-editor__scale-number">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => {
                        const newPoints = [...questionData.scale_points];
                        newPoints[index] = e.target.value;
                        handleFieldChange("scale_points", newPoints);
                      }}
                      placeholder={`Scale point ${index + 1}`}
                      className="question-editor__scale-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newPoints = questionData.scale_points.filter(
                          (_, i) => i !== index
                        );
                        handleFieldChange("scale_points", newPoints);
                      }}
                      className="question-editor__btn question-editor__btn--icon"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                ))}

                {/* Add Scale Point Button */}
                <button
                  type="button"
                  onClick={() => {
                    const newPoints = [
                      ...(questionData.scale_points || []),
                      "",
                    ];
                    handleFieldChange("scale_points", newPoints);
                  }}
                  className="question-editor__btn question-editor__btn--primary question-editor__btn--add"
                  disabled={questionData.scale_points?.length >= 5}
                >
                  <i className="ri-add-line"></i>
                  Add Scale Point
                </button>
              </div>

              {/* Scale Controls */}
              <div className="question-editor__scale-controls">
                <button
                  type="button"
                  onClick={() => {
                    const reversed = [...questionData.scale_points].reverse();
                    handleFieldChange("scale_points", reversed);
                  }}
                  className="question-editor__scale-btn"
                >
                  <i className="ri-arrow-up-down-line"></i>
                  Reverse Scale Order
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const shuffled = [...questionData.scale_points]
                      .map((value) => ({ value, sort: Math.random() }))
                      .sort((a, b) => a.sort - b.sort)
                      .map(({ value }) => value);
                    handleFieldChange("scale_points", shuffled);
                  }}
                  className="question-editor__scale-btn"
                >
                  <i className="ri-shuffle-line"></i>
                  Randomize Scale Order
                </button>
              </div>

              {/* Scale Presets */}
              <div className="question-editor__scale-presets">
                <h4 className="question-editor__subtitle">
                  Quick Scale Presets
                </h4>
                <div className="question-editor__scale-preset-buttons">
                  <button
                    type="button" // Add this
                    onClick={(e) => {
                      e.preventDefault(); // Add this
                      handleFieldChange("scale_points", [
                        "Not at all satisfied",
                        "Slightly satisfied",
                        "Moderately satisfied",
                        "Very satisfied",
                        "Extremely satisfied",
                      ]);
                    }}
                    className="question-editor__preset-btn"
                  >
                    Satisfaction Scale
                  </button>
                  <button
                    type="button" // Add this
                    onClick={(e) => {
                      e.preventDefault(); // Add this
                      handleFieldChange("scale_points", [
                        "Never",
                        "Rarely",
                        "Sometimes",
                        "Often",
                        "Always",
                      ]);
                    }}
                    className="question-editor__preset-btn"
                  >
                    Frequency Scale
                  </button>
                  <button
                    type="button" // Add this
                    onClick={(e) => {
                      e.preventDefault(); // Add this
                      handleFieldChange("scale_points", [
                        "Strongly disagree",
                        "Disagree",
                        "Neither agree nor disagree",
                        "Agree",
                        "Strongly agree",
                      ]);
                    }}
                    className="question-editor__preset-btn"
                  >
                    Agreement Scale
                  </button>
                </div>
              </div>

              {/* Not Applicable Toggle */}
              <div className="question-editor__not-applicable">
                <div className="question-editor__na-header">
                  <label className="question-editor__toggle-label">
                    Add "Not Applicable" option
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      showNotApplicable ? "question-editor__toggle--active" : ""
                    }`}
                    onClick={() => {
                      setShowNotApplicable(!showNotApplicable);
                      handleFieldChange("show_na", !showNotApplicable);
                    }}
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                  <span className="question-editor__na-note">
                    (Won't be included in calculations)
                  </span>
                </div>
                {showNotApplicable && (
                  <input
                    type="text"
                    value={notApplicableText}
                    onChange={(e) => {
                      setNotApplicableText(e.target.value);
                      handleFieldChange("not_applicable_text", e.target.value);
                    }}
                    className="question-editor__na-input"
                    placeholder="Not Applicable"
                  />
                )}
              </div>

              {/* Scale Preview */}
              <div className="question-editor__scale-preview">
                <h4 className="question-editor__subtitle">Scale Preview</h4>
                <div className="question-editor__scale-preview-points">
                  {questionData.scale_points?.map((point, index) => (
                    <div
                      key={index}
                      className="question-editor__scale-preview-point"
                    >
                      <div className="question-editor__scale-preview-radio" />
                      <span className="question-editor__scale-preview-label">
                        {point || `Point ${index + 1}`}
                      </span>
                    </div>
                  ))}
                  {showNotApplicable && (
                    <div className="question-editor__scale-preview-point">
                      <div className="question-editor__scale-preview-radio" />
                      <span className="question-editor__scale-preview-label">
                        {notApplicableText || "Not Applicable"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "content-text":
        return (
          <div className="content-editor">
            <textarea
              value={questionData.text || ""}
              onChange={(e) => handleFieldChange("text", e.target.value)}
              placeholder="Enter your text content here..."
              className="content-editor__textarea"
            />
            <div className="content-editor__format-toolbar">
              <button type="button" title="Bold">
                <i className="ri-bold"></i>
              </button>
              <button type="button" title="Italic">
                <i className="ri-italic"></i>
              </button>
              <button type="button" title="Underline">
                <i className="ri-underline"></i>
              </button>
              <button type="button" title="List">
                <i className="ri-list-unordered"></i>
              </button>
            </div>
            {/* Add sidebar pill menu */}
            <div
              style={{
                position: "absolute",
                top: "120px",
                right: "-90px",
                width: "52px",
                height: "160px", // Shorter height since fewer options
                borderRadius: "50px",
                backgroundColor: "#D9D9D9",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "15px 0 5px 0",
              }}
            >
              <button
                onClick={handleDeleteQuestion}
                className="question-editor__icon-btn question-editor__icon-btn--delete"
                title="Delete Content"
              >
                <i
                  className="ri-delete-bin-6-line"
                  style={{ fontSize: "22px" }}
                ></i>
              </button>

              <button
                onClick={handleCopyQuestion}
                className="question-editor__icon-btn question-editor__icon-btn--copy"
                title="Copy Content"
              >
                <i
                  className="ri-file-copy-line"
                  style={{ fontSize: "22px" }}
                ></i>
              </button>

              <button
                onClick={(e) => handleAddNewQuestion(e)}
                className="question-editor__add-btn"
                title="Add new content"
              >
                <i className="ri-add-line" style={{ fontSize: "25px" }}></i>
              </button>
            </div>
          </div>
        );

      case "content-media":
        return (
          <div className="content-editor content-editor--media">
            {/* Add text input at the top */}
            <textarea
              value={questionData.text || ""}
              onChange={(e) => handleFieldChange("text", e.target.value)}
              placeholder="Enter your text content here..."
              className="content-editor__textarea"
            />

            {/* Add sidebar pill menu */}
            <div
              style={{
                position: "absolute",
                top: "120px",
                right: "-90px",
                width: "52px",
                height: "160px", // Shorter height since fewer options
                borderRadius: "50px",
                backgroundColor: "#D9D9D9",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "15px 0 5px 0",
              }}
            >
              <button
                onClick={handleDeleteQuestion}
                className="question-editor__icon-btn question-editor__icon-btn--delete"
                title="Delete Content"
              >
                <i
                  className="ri-delete-bin-6-line"
                  style={{ fontSize: "22px" }}
                ></i>
              </button>

              <button
                onClick={handleCopyQuestion}
                className="question-editor__icon-btn question-editor__icon-btn--copy"
                title="Copy Content"
              >
                <i
                  className="ri-file-copy-line"
                  style={{ fontSize: "22px" }}
                ></i>
              </button>

              <button
                onClick={(e) => handleAddNewQuestion(e)}
                className="question-editor__add-btn"
                title="Add new content"
              >
                <i className="ri-add-line" style={{ fontSize: "25px" }}></i>
              </button>
            </div>

            {/* Existing media preview section */}
            <div className="content-editor__media-preview">
              {imagePreview ? (
                <div className="content-editor__media-container">
                  <img
                    src={imagePreview}
                    alt="Content"
                    className="content-editor__image"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveImage(e);
                    }}
                    className="content-editor__remove-btn"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Remove Media
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                  className="content-editor__upload-btn"
                >
                  <i className="ri-upload-2-line"></i>
                  Upload Media
                </button>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImageUpload}
              accept="image/*,video/*"
            />
          </div>
        );
    }
  };

  const renderDisqualificationSection = () => {
    // Only show disqualification for specific question types
    // FIX: Remove star-rating-grid as it's not functional with multiple rows
    const allowedTypes = [
      "single-choice",
      "multi-choice",
      "nps",
      "date-picker",
      "numerical-input",
      // "star-rating-grid", // REMOVED: Not functional with multiple rows
    ];

    if (!allowedTypes.includes(questionData.type)) {
      return null;
    }

    return (
      <div className="question-editor__disqualify-section">
        <div className="question-editor__field question-editor__field--toggle">
          <label className="question-editor__toggle-label">
            Enable Disqualification
          </label>
          <div
            className={`question-editor__toggle ${
              questionData.disqualify_enabled
                ? "question-editor__toggle--active"
                : ""
            }`}
            onClick={() =>
              handleFieldChange(
                "disqualify_enabled",
                !questionData.disqualify_enabled
              )
            }
          >
            <div className="question-editor__toggle-handle" />
          </div>
        </div>

        {questionData.disqualify_enabled && (
          <>
            <div className="question-editor__field">
              <label className="question-editor__label">
                Disqualification Message
              </label>
              <textarea
                value={questionData.disqualify_message}
                onChange={(e) =>
                  handleFieldChange("disqualify_message", e.target.value)
                }
                placeholder="Enter message to show when participant is disqualified"
                className="question-editor__textarea"
              />
            </div>

            <div className="question-editor__field">
              <label className="question-editor__label">
                Disqualification Rules
              </label>
              {questionData.type === "single-choice" ||
              questionData.type === "multi-choice" ? (
                <div className="question-editor__rules-container">
                  {questionData.options.map((option, index) => (
                    <div key={index} className="question-editor__rule">
                      <label>
                        <input
                          type="checkbox"
                          checked={questionData.disqualify_rules?.some(
                            (rule) =>
                              rule.type === "option" &&
                              rule.option === option.text
                          )}
                          onChange={(e) => {
                            const updatedRules = e.target.checked
                              ? [
                                  ...(questionData.disqualify_rules || []),
                                  {
                                    type: "option",
                                    option: option.text,
                                    condition: "selected",
                                  },
                                ]
                              : questionData.disqualify_rules?.filter(
                                  (rule) =>
                                    rule.type !== "option" ||
                                    rule.option !== option.text
                                ) || [];
                            handleFieldChange("disqualify_rules", updatedRules);
                          }}
                        />
                        Disqualify if "{option.text}" is selected
                      </label>
                    </div>
                  ))}
                </div>
              ) : questionData.type === "numerical-input" ||
                questionData.type === "nps" ? (
                <div className="question-editor__rules-container">
                  <div className="question-editor__rule-row">
                    <select
                      value={
                        questionData.disqualify_rules?.[0]?.condition || "less"
                      }
                      onChange={(e) => {
                        const updatedRules = [
                          {
                            type: "value",
                            condition: e.target.value,
                            value:
                              questionData.disqualify_rules?.[0]?.value || "",
                          },
                        ];
                        handleFieldChange("disqualify_rules", updatedRules);
                      }}
                      className="question-editor__rule-select"
                    >
                      <option value="less">Less than</option>
                      <option value="greater">Greater than</option>
                      <option value="equal">Equal to</option>
                    </select>
                    <input
                      type="number"
                      value={questionData.disqualify_rules?.[0]?.value || ""}
                      min={questionData.type === "nps" ? 0 : undefined}
                      max={questionData.type === "nps" ? 10 : undefined}
                      onChange={(e) => {
                        const updatedRules = [
                          {
                            type: "value",
                            condition:
                              questionData.disqualify_rules?.[0]?.condition ||
                              "less",
                            value: e.target.value,
                          },
                        ];
                        handleFieldChange("disqualify_rules", updatedRules);
                      }}
                      className="question-editor__rule-input"
                      placeholder="Enter value"
                    />
                  </div>
                </div>
              ) : questionData.type === "date-picker" ? (
                <div className="question-editor__rules-container">
                  <div className="question-editor__rule-row">
                    <select
                      value={
                        questionData.disqualify_rules?.[0]?.condition ||
                        "before"
                      }
                      onChange={(e) => {
                        const updatedRules = [
                          {
                            type: "date",
                            condition: e.target.value,
                            value:
                              questionData.disqualify_rules?.[0]?.value || "",
                          },
                        ];
                        handleFieldChange("disqualify_rules", updatedRules);
                      }}
                      className="question-editor__rule-select"
                    >
                      <option value="before">Before</option>
                      <option value="after">After</option>
                      <option value="on">On</option>
                    </select>
                    <input
                      type="date"
                      value={questionData.disqualify_rules?.[0]?.value || ""}
                      onChange={(e) => {
                        const updatedRules = [
                          {
                            type: "date",
                            condition:
                              questionData.disqualify_rules?.[0]?.condition ||
                              "before",
                            value: e.target.value,
                          },
                        ];
                        handleFieldChange("disqualify_rules", updatedRules);
                      }}
                      className="question-editor__rule-input"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  };

  // Style for the question bank sidebar - enhanced with your primary color
  const questionBankSidebarStyle = {
    position: "fixed",
    top: 0,
    right: showQuestionBank ? 0 : "-450px", // Slightly wider, slide in from right
    width: "450px",
    height: "100vh",
    backgroundColor: "#ffffff",
    boxShadow: "-4px 0 20px rgba(170, 46, 255, 0.2)", // Purple shadow for emphasis
    zIndex: 1000,
    padding: "0", // Removed padding to make header stretch fully
    boxSizing: "border-box",
    overflowY: "auto",
    transition: "right 0.3s ease-in-out",
    borderLeft: "4px solid #AA2EFF", // Add border with primary color
    zIndex: 99999,
    transform: "translateZ(0)",
    willChange: "transform",
  };

  // Style for the overlay when question bank is open
  const overlayStyle = {
    display: showQuestionBank ? "block" : "none",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 999,
    backdropFilter: "blur(2px)", // Add slight blur effect to overlay
    transition: "all 0.3s ease",
    zIndex: 99998,
    transform: "translateZ(0)",
    willChange: "opacity",
  };

  // Button styles for consistency
  const buttonStyles = {
    primary: {
      backgroundColor: "#AA2EFF",
      color: "white",
      border: "none",
      borderRadius: "25px", // Increased border radius for pill-shaped buttons
      padding: "8px 16px",
      fontSize: "14px",
      fontFamily: "Poppins, sans-serif",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      transition: "all 0.2s ease",
      boxShadow: "0 2px 4px rgba(170, 46, 255, 0.2)",
      ":hover": {
        backgroundColor: "#9429E0",
        transform: "translateY(-1px)",
      },
    },
    secondary: {
      backgroundColor: "rgba(170, 46, 255, 0.1)",
      color: "#AA2EFF",
      border: "1px solid #AA2EFF",
      borderRadius: "25px", // Increased border radius for pill-shaped buttons
      padding: "7px 15px",
      fontSize: "14px",
      fontFamily: "Poppins, sans-serif",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      transition: "all 0.2s ease",
      ":hover": {
        backgroundColor: "rgba(170, 46, 255, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    danger: {
      backgroundColor: "rgba(255, 59, 48, 0.1)",
      color: "#ff3b30",
      border: "1px solid #ff3b30",
      borderRadius: "25px", // Increased border radius for pill-shaped buttons
      padding: "7px 15px",
      fontSize: "14px",
      fontFamily: "Poppins, sans-serif",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      transition: "all 0.2s ease",
      ":hover": {
        backgroundColor: "rgba(255, 59, 48, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    refreshButton: {
      backgroundColor: "white",
      color: "#AA2EFF",
      border: "1px solid rgba(170, 46, 255, 0.3)",
      borderRadius: "50%",
      width: "36px",
      height: "36px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: "18px",
      transition: "all 0.3s ease",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      ":hover": {
        transform: "rotate(180deg)",
        backgroundColor: "rgba(170, 46, 255, 0.05)",
      },
    },
  };

  // Add this function to handle edit clicks
  const handleEdit = () => {
    setIsPreview(false);
  };

  const handleMoveUp = () => {
    if (!isFirst && onMoveUp) {
      onMoveUp();
    }
  };

  const handleMoveDown = () => {
    if (!isLast && onMoveDown) {
      onMoveDown();
    }
  };

  // Add this constant near the top of the component
  const questionTypes = [
    {
      value: "single-choice",
      label: "Single Choice",
      icon: "ri-radio-button-line",
    },
    {
      value: "multi-choice",
      label: "Multiple Choice",
      icon: "ri-checkbox-multiple-line",
    },
    { value: "open-ended", label: "Open-Ended", icon: "ri-text-line" },
    { value: "rating", label: "Slider", icon: "ri-star-line" },
    { value: "nps", label: "NPS", icon: "ri-number-0" },
    {
      value: "numerical-input",
      label: "Numerical Input",
      icon: "ri-numbers-line",
    },
    { value: "email-input", label: "Email Input", icon: "ri-mail-line" },
    { value: "date-picker", label: "Date Selection", icon: "ri-calendar-line" },
    { value: "radio-grid", label: "Grid Question", icon: "ri-grid-line" },
    { value: "star-rating", label: "Star Rating", icon: "ri-star-line" },
    {
      value: "star-rating-grid",
      label: "Star Rating Grid",
      icon: "ri-star-smile-line",
    },
    { value: "signature", label: "Signature", icon: "ri-edit-line" },
    {
      value: "single-image-select",
      label: "Single Image Select",
      icon: "ri-image-line",
    },
    {
      value: "multiple-image-select",
      label: "Multiple Image Select",
      icon: "ri-image-line",
    },
    {
      value: "document-upload",
      label: "Document Upload",
      icon: "ri-file-upload-line",
    },
    {
      value: "interactive-ranking",
      label: "Interactive Ranking",
      icon: "ri-sort-ascending-line",
    },
    { value: "content-text", label: "Text Content", icon: "ri-text" },
    { value: "content-media", label: "Media Content", icon: "ri-image-line" },
    { value: "scale", label: "Scale", icon: "ri-scale-line" },
  ];

  // Add this handler for question type change
  const handleQuestionTypeChange = (newType) => {
    // Preserve the question text and required status
    const preservedText = questionData.text;
    const preservedRequired = questionData.required;

    const keepImages =
      ["single-image-select", "multiple-image-select"].includes(
        questionData.type
      ) && ["single-image-select", "multiple-image-select"].includes(newType);

    setQuestionData({
      ...defaultQuestion,
      type: newType,
      text: preservedText,
      required: preservedRequired,
      image_options: keepImages ? questionData.image_options : [],
      conditional_logic_rules: questionData.conditional_logic_rules, // Preserve conditional logic
    });
  };

  const isContentType = questionData.type.startsWith("content-");

  // If in preview mode, render the SavedQuestionPreview
  if (isPreview) {
    return (
      <SavedQuestionPreview
        question={questionData}
        questionNumber={questionNumber}
        onEdit={handleEdit}
        onDelete={handleDeleteQuestion} // Changed from () => onCancel(true)
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onCopy={onCopy ? () => onCopy(questionData) : undefined}
        onAddToBank={saveToQuestionBank}
        onDragReorder={handleDragReorder}
        isFirst={isFirst}
        isLast={isLast}
        isBranched={isBranched} // Add this prop
      />
    );
  }

  // Update the main container style
  // --- Main container: Removed inline styles, use classes ---
  // --- Conditional styles for zIndex/boxShadow remain for simplicity ---
  return (
    <div
      className={`question-editor ${
        isBranched ? "question-editor--branched" : ""
      }`}
      style={{
        // Keep dynamic styles
        boxShadow:
          position > 0
            ? "0 4px 15px rgba(0,0,0,0.12)"
            : "0 2px 10px rgba(0,0,0,0.05)",
        zIndex: 900 + position,
      }}
    >
      {!isContentType && (
        <div className="question-editor__type-selector">
          <div className="question-editor__type-dropdown-container">
          <select
            value={questionData.type}
            onChange={(e) => handleQuestionTypeChange(e.target.value)}
            className="question-editor__type-dropdown"
          >
            {questionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {/* Changed text for clarity */}
                Type: {type.label}
              </option>
            ))}
          </select>
          </div>
          <span className="question-editor__number">{questionNumber}</span>
        </div>
      )}

      <div
        className={`question-editor__sidebar ${
          questionData.branch && Object.keys(questionData.branch).length > 0
            ? "question-editor__sidebar--branched"
            : ""
        }`}
      ></div>

      <button
        type="button"
        onClick={() => setIsPreview(true)}
        className="question-editor__close-btn"
      >
        <i className="ri-close-line"></i>
      </button>

      {/* --- Sidebar Icons: Style moved to CSS --- */}
      {!isBranched && !isContentType && (
        <div className="question-editor__icon-sidebar">
          <button
            onClick={handleDeleteQuestion}
            className="question-editor__icon-btn question-editor__icon-btn--delete"
            title="Delete Question"
          >
            {/* --- Style moved to CSS: .question-editor__icon--delete-icon --- */}
            <i className="ri-delete-bin-6-line question-editor__icon--delete-icon"></i>
          </button>

          <button
            onClick={saveToQuestionBank}
            className="question-editor__icon-btn question-editor__icon-btn--bank"
            title="Save to Question Library"
          >
            {/* --- Style moved to CSS: .question-editor__icon--bank-icon --- */}
            <i className="ri-archive-line question-editor__icon--bank-icon"></i>
          </button>

          <button
            onClick={() => setShowQuestionBank(!showQuestionBank)}
            className={`question-editor__icon-btn question-editor__icon-btn--show-bank ${
              showQuestionBank ? "question-editor__icon-btn--active" : ""
            }`}
            title="Show Question Library"
          >
            {/* --- Style moved to CSS: .question-editor__icon--show-bank-icon --- */}
            <i className="ri-stack-line question-editor__icon--show-bank-icon"></i>
          </button>

          <button
            onClick={handleCopyQuestion}
            className="question-editor__icon-btn question-editor__icon-btn--copy"
            title="Copy Question"
          >
            {/* --- Style moved to CSS: .question-editor__icon--copy-icon --- */}
            <i className="ri-file-copy-line question-editor__icon--copy-icon"></i>
          </button>

          {(!isQuickPoll || totalQuestions < 3) && (
            <button
              onClick={handleAddNewQuestion}
              className="question-editor__add-btn"
              title="Add another question"
            >
              {/* --- Style moved to CSS: .question-editor__icon--add-icon --- */}
              <i className="ri-add-line question-editor__icon--add-icon"></i>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="question-editor__form"> {/* onSubmit on the form */}
        {isContentType ? (
          questionData.type === "content-text" ? (
            <div className="content-editor">
              <CustomEditor
                initialValue={questionData.question_text_html || questionData.text || ""} // Use HTML if available, then text
                onBlur={({ html, text }) => {
                  handleFieldChange("text", text); // This correctly stores the plain text version
                  handleFieldChange("question_text_html", html); // CORRECTED field name
                }}
                placeholder="Enter your text content here..."
                height="150px" // Larger height for content blocks
              />
              {/* Remove the old format toolbar since CustomEditor has its own */}
            </div>
          ) : ( // This implies questionData.type === "content-media" because of the outer isContentType check
            <div className="content-editor content-editor--media">
              <CustomEditor
                initialValue={questionData.text || ""} // questionData.text holds the caption for media
                onBlur={({ html, text }) => {
                  // This editor's 'text' output becomes the caption
                  handleFieldChange("text", text); // This updates questionData.text, which is used for caption
                  // If caption could be HTML, you'd set a field like caption_html: html
                }}
                placeholder="Enter caption or description..."
                height="150px" // Smaller height for media captions
              />

              <div className="content-editor__media-preview">
                {imagePreview ? (
                  <div className="content-editor__media-container">
                    <img
                      src={imagePreview}
                      alt="Content"
                      className="content-editor__image"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveImage(e); // Use the existing handler for removing main image
                      }}
                      className="content-editor__remove-btn"
                    >
                      <i className="ri-delete-bin-line"></i>
                      Remove Media
                    </button>
                  </div>
                ) : (
                  <button
                    type="button" // Ensure type is button
                    onClick={(e) => {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }}
                    className="content-editor__upload-btn"
                  >
                    <i className="ri-upload-2-line"></i>
                    Upload Media
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef} // Make sure fileInputRef is defined (it is, higher up)
                style={{ display: "none" }}
                onChange={handlePrimaryImageFileSelect} // Use handlePrimaryImageFileSelect for main question image/media
                accept="image/*,video/*"
              />
            </div>
          )
        ) : (
          // Regular question form
          <>
            {/* Fix 3: Only show image section for image select question types */}
            {(questionData.type === "single-image-select" || questionData.type === "multiple-image-select") && (
            <div className="question-editor__image-section">
            </div>
            )}

            {/* Conditionally render the main Question Text editor */}
            {!questionData.type.startsWith('content-') && (
              <div className="question-editor__field">
                <label className="question-editor__label">
                  Question Text (Use toolbar to format)
                </label>
                <CustomEditor
                  initialValue={questionData.question_text_html || ""}
                  onBlur={({ html, text }) => {
                    // Only update text/html from the main editor if NOT a content type
                    if (!questionData.type.startsWith('content-')) {
                      setQuestionData((prev) => ({
                        ...prev,
                        question_text_html: html,
                        text: text,
                      }));
                    }
                  }}
                  placeholder="Enter your question here..."
                  height="150px"
                />
              </div>
            )}

            {/* --- Removed inline style: width --- */}
            <div className="question-editor__field question-editor__field--toggle">
              <label className="question-editor__toggle-label">Required</label>
              <div
                className={`question-editor__toggle ${
                  questionData.required ? "question-editor__toggle--active" : ""
                }`}
                onClick={() =>
                  handleFieldChange("required", !questionData.required)
                }
              >
                <div className="question-editor__toggle-handle" />
              </div>
            </div>

            {renderTypeSpecificFields()}
            {renderDisqualificationSection()}

            {/* CONDITIONAL LOGIC SECTION */}
            {!questionData.type.startsWith('content-') && ( // Only show for non-content types
              <div className="question-editor__conditional-logic-section">
                <div className="question-editor__field question-editor__field--toggle question-editor__conditional-logic-toggle-container">
                  <label className="question-editor__toggle-label">
                    Conditional Logic (Show/Hide this question based on another answer)
                  </label>
                  <div
                    className={`question-editor__toggle ${
                      // The toggle switch is active if there is logic, regardless of editor state
                      activeConditionalLogic ? "question-editor__toggle--active" : ""
                    }`}
                    onClick={handleToggleConditionalLogicEditor}
                  >
                    <div className="question-editor__toggle-handle" />
                  </div>
                </div>

                {/* Display Summary if logic exists AND editor is closed */}
                {activeConditionalLogic && !showConditionalLogicEditor && (
                  <div className="question-editor__conditional-logic-summary">
                    <p>{getConditionalLogicSummary()}</p>
                    <button
                      type="button"
                      className="question-editor__btn question-editor__btn--secondary question-editor__btn--modify-logic"
                      onClick={() => setShowConditionalLogicEditor(true)} // This will open the editor
                    >
                      Modify Logic
                    </button>
                  </div>
                )}

                {/* Show Editor Form if toggled on */}
                {showConditionalLogicEditor && (
                  <ConditionalLogicEditor
                    allSurveyQuestions={allSurveyQuestions || []}
                    currentQuestionSequence={questionNumber}
                    existingLogic={activeConditionalLogic} // Pass the 'activeConditionalLogic' state
                    onSaveLogic={handleSaveConditionalLogic}
                    onCancelLogic={handleCancelConditionalLogic}
                  />
                )}
              </div>
            )}
            {/* END CONDITIONAL LOGIC SECTION */}
          </>
        )}

        <div className="question-editor__form-actions"> {/* This div should be AFTER conditional logic */}
          <button
            type="button"
            onClick={handleCancel}
            className="question-editor__btn question-editor__btn--secondary"
          >
            Cancel
          </button>
          <button
            type="submit" // Changed to submit to trigger form's onSubmit
            onClick={handleSubmit} // Keep onClick handler too
            className="question-editor__btn question-editor__btn--primary"
          >
            Save {isContentType ? "Content" : "Question"}
          </button>
        </div>
      </form>

      {/* --- Question Bank Overlay: Use classes --- */}
      <div
        className={`question-editor__bank-overlay ${
          showQuestionBank ? "" : "question-editor__bank-overlay--hidden"
        }`}
        onClick={() => setShowQuestionBank(false)}
      ></div>

      {/* --- Question Bank Sidebar: Use classes --- */}
      <div
        className={`question-editor__bank ${
          showQuestionBank
            ? "question-editor__bank--open"
            : "question-editor__bank--closed"
        }`}
      >
        {/* --- Use class: question-editor__bank-header --- */}
        <div className="question-editor__bank-header">
          {/* --- Use class: question-editor__bank-title --- */}
          <h3 className="question-editor__bank-title">
            {/* --- Use class: question-editor__bank-title-icon --- */}
            <i className="ri-stack-line question-editor__bank-title-icon"></i>
            Question Library
          </h3>
          {/* --- Use class: question-editor__bank-header-actions --- */}
          <div className="question-editor__bank-header-actions">
            {/* --- Use class: question-editor__bank-refresh-btn --- */}
            {/* --- Removed JS hover handlers --- */}
            <button
              type="button" // Added type
              onClick={() => {
                console.log("Refreshing question library");
              }}
              className="question-editor__bank-refresh-btn"
              title="Refresh question library"
            >
              <i className="ri-refresh-line"></i>
            </button>
            {/* --- Use class: question-editor__bank-close-btn --- */}
            <button
              type="button" // Added type
              onClick={() => setShowQuestionBank(false)}
              className="question-editor__bank-close-btn"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        </div>

        {/* --- Use class: question-editor__bank-content --- */}
        <div className="question-editor__bank-content">
          <QuestionBank
            onCopyQuestion={(bankQ) => {
              console.log("Copying question from bank:", bankQ);
              // Convert bank question to survey question format
              const questionToAdd = {
                ...bankQ,
                isNew: false, // Mark as not new since it's from bank
                saved: true,  // Mark as saved since it's from bank
                type: bankQ.question_type || 'multiple-choice', // Ensure type is set
                question_type: bankQ.question_type || 'multiple-choice' // Keep both for compatibility
              };
              
              // Call the parent's onSave with the copied question
              onSave(questionToAdd);
              
              // Close the question bank
              setShowQuestionBank(false);
              
              // Show success toast
              toast.success("Question copied to survey successfully!");
            }}
            renderButtons={(question, removeFromBank) => (
              <div className="question-editor__bank-item-actions">
                <button
                  type="button"
                  onClick={() => {
                    console.log("Copying question to survey:", question);
                    // Convert bank question to survey question format
                    const questionToAdd = {
                      ...question,
                      isNew: false,
                      saved: true,
                      type: question.question_type || 'multiple-choice', // Ensure type is set
                      question_type: question.question_type || 'multiple-choice' // Keep both for compatibility
                    };
                    
                    // Call the parent's onSave with the copied question
                    onSave(questionToAdd);
                    
                    // Close the question bank
                    setShowQuestionBank(false);
                    
                    // Show success toast
                    toast.success("Question copied to survey successfully!");
                  }}
                  className="question-editor__btn question-editor__btn--primary question-editor__bank-copy-btn"
                >
                  <i className="ri-file-copy-line"></i> Copy to Survey
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    console.log("Removing question from bank:", question);
                    if (window.confirm('Are you sure you want to remove this question from the library?')) {
                      try {
                        await questionBankAPI.deleteQuestion(question.id);
                        // Call removeFromBank to refresh the list
                        removeFromBank(question.id);
                        toast.success("Question removed from library successfully!");
                      } catch (error) {
                        console.error('Error removing question:', error);
                        toast.error("Failed to remove question from library");
                      }
                    }
                  }}
                  className="question-editor__btn question-editor__btn--danger question-editor__bank-remove-btn"
                >
                  <i className="ri-delete-bin-line"></i> Remove
                </button>
              </div>
            )}
          />
        </div>
      </div>

      <QuestionTypeMenu />

      {/* --- Modals/Overlays remain the same, assumed styled by classes --- */}
      {editingNumericalBranchIndex !== null && numericalBranchData !== null && (
        <div className="question-editor__overlay">
          <div className="question-editor__modal-panel">
            {/* ... NumericalBranchEditor ... */}
            <NumericalBranchEditor
              branchData={numericalBranchData}
              onSave={handleSaveNumericalBranch}
              onCancel={() => {
                setEditingNumericalBranchIndex(null);
                setNumericalBranchData(null);
              }}
              questionNumber={questionNumber}
              position={position}
            />
          </div>
        </div>
      )}

      {editingBranchForOption !== null && (
        <div className="question-editor__overlay">
          <div className="question-editor__modal-panel">
            {/* ... AdvancedBranchEditor ... */}
            <AdvancedBranchEditor
              initialBranch={branchingData}
              onSave={handleSaveBranch}
              onCancel={() => setEditingBranchForOption(null)}
              questionNumber={questionNumber}
              optionIndex={editingBranchForOption}
              position={position}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionEditorModal;
