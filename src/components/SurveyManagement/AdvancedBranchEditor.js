// AdvancedBranchEditor.js
import React, { useState, useEffect } from 'react';
import QuestionEditorModal from './QuestionEditorModal';
import QuestionList from './QuestionList';
import "../../styles/SavedQuestionPreview.css";
import { questionBankAPI } from 'services/apiClient';

/**
 * Merged AdvancedBranchEditor with full functionality:
 * - Create/edit a "branch" that can contain multiple questions of any type.
 * - Nested branches for multiple-choice options.
 * - Branch termination: resume after the parent question, jump to a specific question, or end the survey.
 *
 * Props:
 *   - initialBranch: {
 *       title?: string,
 *       questions?: array,
 *       branchEndAction?: 'resume' | 'jump' | 'end',
 *       jump_to_question?: number,
 *     } or null
 *   - onSave(branchObj) -> merges the final branch data
 *   - onCancel() -> closes/cancels editing
 *   - branchTitlePlaceholder?: string (optional UI text)
 *   - questionPlaceholder?: string (optional UI text)
 *   - customStyles?: object (optional styles)
 */
const AdvancedBranchEditor = ({
  initialBranch,
  onSave,
  onCancel,
  branchTitlePlaceholder = 'Branch Title',
  questionPlaceholder = 'Enter question...',
  customStyles = {}
}) => {
  // --------- Branch-level metadata ---------
  const [branchTitle, setBranchTitle] = useState('');
  const [branchQuestions, setBranchQuestions] = useState([]);
  const [branchEndAction, setBranchEndAction] = useState('resume');
  const [jumpToQuestion, setJumpToQuestion] = useState(null);

  // --------- For controlling the question editor modal ---------
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);

  // --------- For nested sub-branch editing ---------
  const [nestedBranchEditing, setNestedBranchEditing] = useState(null); // { questionIndex, optionIndex }
  const [nestedBranchData, setNestedBranchData] = useState(null);

  const [branchData, setBranchData] = useState({
    targetQuestion: initialBranch?.targetQuestion || '',
    action: initialBranch?.action || 'skip',
    optionIndex: initialBranch?.optionIndex || 0
  });

  const [validationError, setValidationError] = useState(null);

  // Load from initialBranch on mount or update
  useEffect(() => {
    if (initialBranch) {
      setBranchTitle(initialBranch.title || '');
      setBranchQuestions(Array.isArray(initialBranch.questions) ? initialBranch.questions : []);
      setJumpToQuestion(
        initialBranch.jump_to_question !== undefined && initialBranch.jump_to_question !== null
          ? parseInt(initialBranch.jump_to_question, 10)
          : null
      );
      setBranchData({
        targetQuestion: initialBranch.targetQuestion || '',
        action: initialBranch.action || 'skip',
        optionIndex: initialBranch.optionIndex || 0
      });
      setBranchEndAction(initialBranch.branchEndAction || 'resume');
      if (initialBranch.jump_to_question !== undefined && initialBranch.jump_to_question !== null) {
        setJumpToQuestion(parseInt(initialBranch.jump_to_question, 10));
      } else {
        setJumpToQuestion(null);
      }
    } else {
      setBranchTitle('');
      setBranchQuestions([]);
      setBranchEndAction('resume');
      setJumpToQuestion(null);
      setBranchData({
        targetQuestion: '',
        action: 'skip',
        optionIndex: 0
      });
    }
  }, [initialBranch]);

  // Add form validation and error handling
  useEffect(() => {
    if (branchEndAction === 'jump') {
      if (!jumpToQuestion) {
        setValidationError('Please specify a question number to jump to');
      } else if (jumpToQuestion < 1) {
        setValidationError('Question number must be positive');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [branchEndAction, jumpToQuestion]);

  // -----------------------------
  // Question Editor Modal logic
  // -----------------------------
  const openAddQuestionModal = () => {
    setEditingQuestionIndex(null);
    setIsQuestionModalOpen(true);
  };
  const openEditQuestionModal = (index) => {
    setEditingQuestionIndex(index);
    setIsQuestionModalOpen(true);
  };
  const handleSaveQuestion = (questionData) => {
    if (editingQuestionIndex !== null) {
      const updated = [...branchQuestions];
      questionData.sequence_number =
        updated[editingQuestionIndex].sequence_number || editingQuestionIndex + 1;
      questionData.branch = updated[editingQuestionIndex].branch || questionData.branch || {};
      updated[editingQuestionIndex] = { ...updated[editingQuestionIndex], ...questionData };
      setBranchQuestions(updated);
    } else {
      questionData.sequence_number = branchQuestions.length + 1;
      setBranchQuestions([...branchQuestions, questionData]);
    }
    setIsQuestionModalOpen(false);
    setEditingQuestionIndex(null);
  };
  const handleCancelQuestionEdit = () => {
    setIsQuestionModalOpen(false);
    setEditingQuestionIndex(null);
  };

  // -----------------------------
  // Question List handlers
  // -----------------------------
  const moveQuestionUp = (index) => {
    if (index === 0) return;
    const updated = [...branchQuestions];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((q, i) => (q.sequence_number = i + 1));
    setBranchQuestions(updated);
  };
  const moveQuestionDown = (index) => {
    if (index >= branchQuestions.length - 1) return;
    const updated = [...branchQuestions];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((q, i) => (q.sequence_number = i + 1));
    setBranchQuestions(updated);
  };
  const handleCopyQuestion = (index) => {
    const toCopy = branchQuestions[index];
    const copy = { ...toCopy, sequence_number: branchQuestions.length + 1 };
    const updated = [...branchQuestions];
    updated.splice(index + 1, 0, copy);
    updated.forEach((q, i) => (q.sequence_number = i + 1));
    setBranchQuestions(updated);
  };
  const handleDeleteQuestion = (index) => {
    if (!window.confirm('Delete this branch question?')) return;
    const updated = branchQuestions.filter((_, i) => i !== index);
    updated.forEach((q, i) => (q.sequence_number = i + 1));
    setBranchQuestions(updated);
  };

  // -----------------------------
  // Add to / copy from Question Bank
  // -----------------------------
  const handleAddToBank = async (question) => {
    try {
      const payload = {
        question_text: question.text || '',
        description: question.description || '',
        additional_text: question.additional_text || '',
        question_type: question.type || 'open-ended',
        options: question.options || null,
        image_url: question.image_url || '',
        rating_start: question.rating_start || null,
        rating_end: question.rating_end || null,
        rating_step: question.rating_step || null,
        rating_unit: question.rating_unit || '',
      };
      const res = await questionBankAPI.createQuestion(payload);

    } catch (error) {
      console.error('Error adding question to bank:', error);
      alert('Error adding question to bank.');
    }
  };
  const handleCopyFromBank = (bankQ) => {
    const newQ = {
      text: bankQ.question_text || '',
      type: bankQ.question_type || 'open-ended',
      description: bankQ.description || '',
      additional_text: bankQ.additional_text || '',
      options: bankQ.options || [],
      image_url: bankQ.image_url || '',
      rating_start: bankQ.rating_start || null,
      rating_end: bankQ.rating_end || null,
      rating_step: bankQ.rating_step || null,
      rating_unit: bankQ.rating_unit || '',
      required: false,
      sequence_number: branchQuestions.length + 1,
      branch: {}
    };
    setBranchQuestions([...branchQuestions, newQ]);
  };

  // -----------------------------
  // Nested sub-branch editing
  // -----------------------------
  const handleCreateOrEditNestedBranch = (qIndex, optIndex) => {
    const questionToEdit = branchQuestions[qIndex];
    if (!questionToEdit || !questionToEdit.options) return;
    setNestedBranchEditing({ questionIndex: qIndex, optionIndex: optIndex });
    const optionBranchData = questionToEdit.options[optIndex].branch || {
      title: '',
      questions: [],
      branchEndAction: 'resume',
      jump_to_question: null
    };
    setNestedBranchData(optionBranchData);
  };
  const handleSaveNestedBranch = (nestedData) => {
    if (!nestedBranchEditing) return;
    const { questionIndex, optionIndex } = nestedBranchEditing;
    const updated = [...branchQuestions];
    if (!updated[questionIndex].options) updated[questionIndex].options = [];
    updated[questionIndex].options[optionIndex].branch = nestedData;
    setBranchQuestions(updated);
    setNestedBranchEditing(null);
    setNestedBranchData(null);
  };
  const handleCancelNestedBranch = () => {
    setNestedBranchEditing(null);
    setNestedBranchData(null);
  };

  // Add validations for branch end settings
  const validateBranchSettings = () => {
    if (branchEndAction === 'jump' && !jumpToQuestion) {
      return false;
    }
    return true;
  };

  // -----------------------------
  // Final "Save Branch"
  // -----------------------------
  const handleSaveBranch = (branchData) => {
    const finalBranch = {
      branchTitle: branchTitle,
      questions: branchQuestions,
      branchEndAction: branchEndAction,
      jump_to_question: branchEndAction === 'jump' ? jumpToQuestion : null,
      return_to_origin: branchEndAction === 'resume',  // Add this flag
      targetQuestion: branchData.targetQuestion,
      optionIndex: branchData.optionIndex,
      action: branchData.action
    };

    onSave(finalBranch);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBranchData({ ...branchData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(branchData);
  };

  const styles = customStyles || {
    overlay: { background: 'rgba(0,0,0,0.5)' },
    content: { padding: '20px' },
    header: {},
    title: {},
    closeButton: {},
    footer: {},
    cancelButton: {},
    saveButton: {},
    input: {},
    textarea: {},
    inputLabel: {},
  };

  return (
    <div className="advanced-branch-editor-overlay">
      <div className="advanced-branch-editor-content">
        <div className="advanced-branch-editor-header">
          <h3 className="advanced-branch-editor-title">Configure Logic Flow</h3>
          <button className="advanced-branch-editor-close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="advanced-branch-editor-wrapper">
          <h3 className="advanced-branch-editor-title">Edit Logic Flow</h3>
          {/* Branch Title */}
          <div className="advanced-branch-editor-section">
            <input
              type="text"
              placeholder={branchTitlePlaceholder}
              value={branchTitle}
              onChange={(e) => setBranchTitle(e.target.value)}
              className="advanced-branch-editor-input"
            />
          </div>
          {/* Branch End Action */}
          <label className="advanced-branch-editor-label">How should this Logic Flow end?</label>
          <div className="advanced-branch-editor-section">
            <select
              value={branchEndAction}
              onChange={(e) => setBranchEndAction(e.target.value)}
              className="advanced-branch-editor-select"
            >
              <option value="resume">Resume survey flow (after parent question)</option>
              <option value="jump">Jump to a specific question number</option>
              <option value="end">End the survey</option>
            </select>
            {branchEndAction === 'jump' && (
              <div className="advanced-branch-editor-jump-container">
                <label className="advanced-branch-editor-jump-label">Jump to Q#:</label>
                <input
                  type="number"
                  value={jumpToQuestion === null ? '' : jumpToQuestion}
                  onChange={(e) =>
                    setJumpToQuestion(e.target.value === '' ? null : parseInt(e.target.value, 10))
                  }
                  className="advanced-branch-editor-jump-input"
                />
              </div>
            )}
          </div>
          {validationError && (
            <div className="advanced-branch-editor-validation-error">{validationError}</div>
          )}
          {/* Branch Questions */}
          <QuestionList
            questions={branchQuestions}
            onEditQuestion={openEditQuestionModal}
            onDeleteQuestion={handleDeleteQuestion}
            onCopyQuestion={handleCopyQuestion}
            onMoveQuestionUp={moveQuestionUp}
            onMoveQuestionDown={moveQuestionDown}
            onAddToBank={handleAddToBank}
            onBranchEdit={handleCreateOrEditNestedBranch}
          />
          {/* Buttons: Add question or copy from bank */}
          <div className="advanced-branch-editor-add-btn-container">
            <button className="advanced-branch-editor-add-btn" onClick={openAddQuestionModal}>
              +
            </button>
          </div>
          {/* Save / Cancel buttons */}
          <div className="advanced-branch-editor-footer">
            <button onClick={handleSaveBranch} className="advanced-branch-editor-save-btn">
              Save Branch
            </button>
            <button onClick={onCancel} className="advanced-branch-editor-cancel-btn">
              Cancel
            </button>
          </div>
          {/* Question Editor Modal */}
          {isQuestionModalOpen && (
            <QuestionEditorModal
              isOpen={isQuestionModalOpen}
              initialQuestion={
                editingQuestionIndex !== null ? branchQuestions[editingQuestionIndex] : null
              }
              onSave={handleSaveQuestion}
              onCancel={handleCancelQuestionEdit}
            />
          )}
          {/* Nested Branch Editor (for sub-branches) */}
          {nestedBranchEditing && nestedBranchData && (
            <div className="advanced-branch-editor-nested">
              <h4 className="advanced-branch-editor-nested-title">Nested Logic Flow Editor</h4>
              <AdvancedBranchEditor
                initialBranch={nestedBranchData}
                onSave={handleSaveNestedBranch}
                onCancel={handleCancelNestedBranch}
                branchTitlePlaceholder="Nested Branch Title"
                questionPlaceholder="Nested question..."
                customStyles={{
                  wrapper: {
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    borderColor: '#888',
                  },
                }}
              />
            </div>
          )}
          <form onSubmit={handleSubmit} className="advanced-branch-editor-form">
            <div className="advanced-branch-editor-form-group">
              <label className="advanced-branch-editor-label">Option Index</label>
              <input
                type="number"
                name="optionIndex"
                value={branchData.optionIndex}
                onChange={handleChange}
                placeholder="Enter option index (0-based)"
                className="advanced-branch-editor-input"
                min="0"
                required
              />
            </div>
            <div className="advanced-branch-editor-form-group">
              <label className="advanced-branch-editor-label">Action</label>
              <select
                name="action"
                value={branchData.action}
                onChange={handleChange}
                className="advanced-branch-editor-select"
              >
                <option value="skip">Skip to Question</option>
                <option value="end">End Survey</option>
              </select>
            </div>
            {branchData.action === 'skip' && (
              <div className="advanced-branch-editor-form-group">
                <label className="advanced-branch-editor-label">Target Question Number</label>
                <input
                  type="number"
                  name="targetQuestion"
                  value={branchData.targetQuestion}
                  onChange={handleChange}
                  placeholder="Enter question number"
                  className="advanced-branch-editor-input"
                  required
                />
              </div>
            )}
            <div className="advanced-branch-editor-footer">
              <button type="button" onClick={onCancel} className="advanced-branch-editor-cancel-btn">
                Cancel
              </button>
              <button type="submit" className="advanced-branch-editor-save-btn">
                Save Logic
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdvancedBranchEditor;