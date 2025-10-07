import React, { useState, useEffect } from 'react';
import AdvancedBranchEditor from './AdvancedBranchEditor';
import "../../styles/SavedQuestionPreview.css";

/**
 * Component for editing numerical branching logic.
 * Used for questions that have numerical responses (rating, nps, numerical input)
 */
const NumericalBranchEditor = ({
  branchData,
  onSave,
  onCancel,
  questionNumber,
  position
}) => {
  const [rules, setRules] = useState([]);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  const [currentBranchData, setCurrentBranchData] = useState(null);
  
  // Cleanup and set initial data when component mounts
  useEffect(() => {
    if (branchData) {
      // Extract branch rules from the provided branch data
      const extractedRules = branchData.rules || [{
        operator: '>',
        value: '',
        action: 'skip',
        target: '',
        id: Date.now()
      }];
      
      setRules(extractedRules);
      setCurrentBranchData(branchData);
    } else {
      // Initialize with default values if no branch data
      setRules([{
        operator: '>',
        value: '',
        action: 'skip',
        target: '',
        id: Date.now()
      }]);
      
      setCurrentBranchData({
        branchTitle: '',
        questions: [],
        branchEndAction: 'resume',
        jump_to_question: null,
        return_to_origin: true,
        rules: []
      });
    }
  }, [branchData]);

  const addRule = () => {
    const newRule = {
      operator: '>',
      value: '',
      action: 'skip',
      target: '',
      id: Date.now() // Unique ID for each rule
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (index) => {
    const updatedRules = [...rules];
    updatedRules.splice(index, 1);
    setRules(updatedRules);
  };

  const updateRule = (index, field, value) => {
    const updatedRules = [...rules];
    updatedRules[index] = {
      ...updatedRules[index],
      [field]: value
    };
    setRules(updatedRules);
  };

  const handleEditBranchQuestions = () => {
    setShowAdvancedEditor(true);
  };

  const handleAdvancedBranchSave = (advancedBranchData) => {
    setCurrentBranchData({
      ...currentBranchData,
      branchTitle: advancedBranchData.branchTitle,
      questions: advancedBranchData.questions,
      branchEndAction: advancedBranchData.branchEndAction,
      jump_to_question: advancedBranchData.jump_to_question,
      return_to_origin: advancedBranchData.return_to_origin
    });
    setShowAdvancedEditor(false);
  };

  const handleSave = () => {
    // Validate rules before saving
    const isValid = rules.every(rule => {
      // Check if rule has a valid value and target (if action is skip)
      const hasValue = rule.value !== '';
      const hasValidTarget = rule.action !== 'skip' || (rule.action === 'skip' && rule.target !== '');
      return hasValue && hasValidTarget;
    });

    if (!isValid) {
      alert('Please ensure all rules have values and targets are specified for skip actions.');
      return;
    }

    // Combine the rules with the branch data
    const finalBranchData = {
      ...currentBranchData,
      rules: rules
    };

    onSave(finalBranchData);
  };

  return (
    <div className="numerical-branch-editor">
      {showAdvancedEditor ? (
        <AdvancedBranchEditor
          initialBranch={currentBranchData}
          onSave={handleAdvancedBranchSave}
          onCancel={() => setShowAdvancedEditor(false)}
          questionNumber={questionNumber}
          position={position}
        />
      ) : (
        <div className="numerical-branch-editor__content">
          <h2 className="numerical-branch-editor__title">
            Numerical Branching Logic
          </h2>
         
          <p className="numerical-branch-editor__description">
            Define rules for branching based on numerical responses. For example, skip to question 5 if rating is greater than 8.
          </p>

          {/* Branch Questions Button */}
          <div>
            <button
              onClick={handleEditBranchQuestions}
              className="numerical-branch-editor__branch-btn"
            >
              <i className="ri-git-branch-line"></i>
              {currentBranchData && currentBranchData.questions && currentBranchData.questions.length > 0 
                ? `Edit Branch Questions (${currentBranchData.questions.length})` 
                : "Add Branch Questions"}
            </button>
          </div>

          {rules.map((rule, index) => (
            <div key={rule.id} className="numerical-branch-editor__rule">
              <div className="numerical-branch-editor__rule-header">
                <h4 className="numerical-branch-editor__rule-title">
                  Rule {index + 1}
                </h4>
                <button
                  onClick={() => removeRule(index)}
                  className="numerical-branch-editor__remove-btn"
                >
                  <i className="ri-delete-bin-line"></i>
                  Remove
                </button>
              </div>

              <div className="numerical-branch-editor__rule-content">
                <span className="numerical-branch-editor__rule-text">If answer is</span>
               
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(index, 'operator', e.target.value)}
                  className="numerical-branch-editor__select"
                >
                  <option value=">">greater than</option>
                  <option value=">=">greater than or equal to</option>
                  <option value="<">less than</option>
                  <option value="<=">less than or equal to</option>
                  <option value="==">equal to</option>
                  <option value="!=">not equal to</option>
                </select>
               
                <input
                  type="number"
                  value={rule.value}
                  onChange={(e) => updateRule(index, 'value', e.target.value)}
                  placeholder="Enter value"
                  className="numerical-branch-editor__input numerical-branch-editor__number-input"
                />
               
                <span className="numerical-branch-editor__rule-text">then</span>
               
                <select
                  value={rule.action}
                  onChange={(e) => updateRule(index, 'action', e.target.value)}
                  className="numerical-branch-editor__select"
                >
                  <option value="skip">skip to question</option>
                  <option value="end">end survey</option>
                  <option value="disqualify">disqualify</option>
                  <option value="branch">show branch questions</option>
                </select>
               
                {rule.action === 'skip' && (
                  <input
                    type="number"
                    value={rule.target}
                    onChange={(e) => updateRule(index, 'target', e.target.value)}
                    placeholder="Question #"
                    min="1"
                    className="numerical-branch-editor__input numerical-branch-editor__number-input"
                  />
                )}
               
                {rule.action === 'disqualify' && (
                  <div className="numerical-branch-editor__disqualify-container">
                    <label className="numerical-branch-editor__disqualify-label">Disqualification Message:</label>
                    <textarea
                      value={rule.message || 'Thank you for your time. Based on your answers, you do not qualify for this survey.'}
                      onChange={(e) => updateRule(index, 'message', e.target.value)}
                      className="numerical-branch-editor__textarea"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          <div>
            <button
              onClick={addRule}
              className="numerical-branch-editor__add-rule-btn"
            >
              <i className="ri-add-line"></i>
              Add Another Rule
            </button>
          </div>

          <div className="numerical-branch-editor__footer">
            <button
              onClick={onCancel}
              className="numerical-branch-editor__cancel-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="numerical-branch-editor__save-btn"
            >
              Save Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumericalBranchEditor;