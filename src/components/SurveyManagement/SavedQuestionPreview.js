import React from "react";
import "../../styles/SavedQuestionPreview.css";
import { baseURL } from "../../services/apiClient";
import toast from 'react-hot-toast';

const SavedQuestionPreview = ({
  question,
  questionNumber,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddToBank,
  onCopy,
  onDragReorder, // Add this new prop
  isFirst,
  isLast,
  isBranched = false, // Add this prop with default value
}) => {
  const handleCopy = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log('[SavedQuestionPreview] handleCopy called'); // Add debug log
    
    // Add confirmation to prevent accidental copying
    if (!window.confirm("Are you sure you want to duplicate this question?")) {
      return;
    }
    
    if (onCopy) {
      // Create a deep copy of the question with all its properties
      const questionCopy = {
        ...question,
        id: undefined, // Clear the ID so a new one will be generated
        text: `${question.text} - Copy`,
        question_text_html: question.question_text_html ? `${question.question_text_html} - Copy` : undefined,
        // Deep copy arrays and objects to avoid reference issues
        options: Array.isArray(question.options) 
          ? question.options.map(opt => typeof opt === 'string' ? opt : { ...opt })
          : [],
        image_options: Array.isArray(question.image_options)
          ? question.image_options.map(opt => ({ ...opt }))
          : [],
        grid_rows: Array.isArray(question.grid_rows)
          ? [...question.grid_rows]
          : [],
        grid_columns: Array.isArray(question.grid_columns)
          ? [...question.grid_columns]
          : [],
        scale_points: Array.isArray(question.scale_points)
          ? [...question.scale_points]
          : [],
        ranking_items: Array.isArray(question.ranking_items)
          ? [...question.ranking_items]
          : [],
        // Copy other important fields but reset certain ones
        branch: null, // Reset branch logic for the copy
        conditional_logic_rules: null, // Reset conditional logic for the copy
        disqualify_rules: Array.isArray(question.disqualify_rules)
          ? [...question.disqualify_rules]
          : [],
        numerical_branch_rules: Array.isArray(question.numerical_branch_rules)
          ? [...question.numerical_branch_rules]
          : [],
        // Preserve all other settings
        rating_start: question.rating_start,
        rating_end: question.rating_end,
        rating_step: question.rating_step,
        rating_unit: question.rating_unit,
        left_label: question.left_label,
        center_label: question.center_label,
        right_label: question.right_label,
        required: question.required,
        show_na: question.show_na,
        not_applicable_text: question.not_applicable_text,
        has_other_option: question.has_other_option,
        other_option_text: question.other_option_text,
        min_selection: question.min_selection,
        max_selection: question.max_selection,
        file_types: Array.isArray(question.file_types) ? [...question.file_types] : [],
        max_file_size: question.max_file_size,
        max_files: question.max_files,
        signature_options: question.signature_options ? { ...question.signature_options } : {},
        nps_left_label: question.nps_left_label,
        nps_right_label: question.nps_right_label,
        nps_reversed: question.nps_reversed,
        nps_spacing: question.nps_spacing,
        min_value: question.min_value,
        max_value: question.max_value,
        allowed_domains: Array.isArray(question.allowed_domains) ? [...question.allowed_domains] : null,
        min_date: question.min_date,
        max_date: question.max_date,
        image_url: question.image_url,
        description: question.description,
        additional_text: question.additional_text
      };

      onCopy(questionCopy);
      console.log('Question copied:', questionCopy);
      toast.success('Question duplicated successfully!');
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent card click from triggering edit
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        if (typeof onDelete === 'function') {
          onDelete();
          toast.success('Question deleted successfully');
        } else {
          console.error("SavedQuestionPreview Error: onDelete prop was expected to be a function but received:", onDelete);
          toast.error("Cannot delete: Delete action is not configured correctly.");
        }
      } catch (error) {
        console.error('Error deleting question:', error);
        toast.error('Failed to delete question. Please try again.');
      }
    }
  };

  const handleMoveUp = (e) => {
    e.stopPropagation(); // Add this to prevent event bubbling
    if (!isFirst && onMoveUp) {
      onMoveUp(questionNumber - 1); // Add index parameter
    }
  };

  const handleMoveDown = (e) => {
    e.stopPropagation(); // Add this to prevent event bubbling
    if (!isLast && onMoveDown) {
      onMoveDown(questionNumber - 1); // Add index parameter
    }
  };

  const handleAddToBank = async (e) => {
    e.stopPropagation();
    if (onAddToBank) {
      try {
        const payload = {
          question_text: question.text,
          description: question.description || "",
          additional_text: question.additional_text || "",
          question_type: question.type,
          options: question.options || [],
          image_url: question.image_url || "",
          rating_start: question.rating_start || null,
          rating_end: question.rating_end || null,
          rating_step: question.rating_step || null,
          rating_unit: question.rating_unit || "",
        };
        
        console.log('Adding question to bank:', payload);
        await onAddToBank(payload);
        console.log('Successfully added question to bank, showing success toast');
        
      } catch (error) {
        console.log('Failed to add question to bank, showing error toast');
        console.error('Failed to add question to library:', error);
      
      }
    }
  };

  const handleEdit = (e) => {
    // e may be undefined if handleEdit is invoked without an event (e.g. via onEdit prop)
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation(); // Prevent card click from triggering other handlers
    }
    console.log('[SavedQuestionPreview] handleEdit called'); // Add debug log
    if (typeof onEdit === 'function') {
      onEdit();
    }
  };

  const handleDragStart = (e) => {
    e.stopPropagation(); // Add this to prevent event bubbling
    e.dataTransfer.setData("text/plain", questionNumber.toString());
    e.currentTarget.classList.add("dragging");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Add this to prevent event bubbling
    const draggedNumber = parseInt(e.dataTransfer.getData("text/plain"));
    const dropNumber = parseInt(questionNumber);

    if (draggedNumber !== dropNumber && onDragReorder) {
      // Convert from question numbers to array indices (subtract 1)
      onDragReorder(draggedNumber - 1, dropNumber - 1);
    }

    e.currentTarget.classList.remove("drag-over");
    document.querySelector(".dragging")?.classList.remove("dragging");
  };

  const renderQuestionDetails = (question) => {
    if (!question) return null;

    let details = null;

    // First show question cover image if it exists
    const coverImage = question.image_url && (
      <div className="saved-question__cover-image">
        <img 
          src={question.image_url.startsWith('http') ? question.image_url : `${baseURL}${question.image_url}`}
          alt="Question visual" 
        />
      </div>
    );

    // Then show description if it exists
    const description = question.description && (
      <div className="saved-question__description">{question.description}</div>
    );

    switch (question.type) {
      case "open-ended":
        details = (
          <>
            {coverImage}
            {description}
            <div className="saved-question__input-preview">
              <div className="saved-question__input-field">
                <textarea
                  placeholder="User will type here..."
                  disabled
                  rows={3}
                />
              </div>
            </div>
          </>
        );
        break;

      case "single-choice":
      case "multi-choice":
      case "dropdown":
        details = (
          <>
            {coverImage}
            {description}
            <div className="saved-question__options">
              {question.options?.map((option, index) => (
                <div key={index} className="saved-question__option">
                  <i
                    className={`ri-${
                      question.type === "multi-choice"
                        ? "checkbox-line"
                        : "radio-button-line"
                    }`}
                  />
                  <span>
                    {typeof option === "object" ? option.text : option}
                  </span>
                  {question.branch?.[index] && (
                    <i
                      className="ri-git-branch-line"
                      title="Has branch logic"
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        );
        break;

      case "single-image-select":
      case "multiple-image-select":
        details = (
          <>
            {description}
            <div className="saved-question__image-options">
              {question.image_options?.map((option, index) => (
                <div key={index} className="saved-question__image-option">
                  <div className="saved-question__image-container">
                    {option.image_url ? (
                      <img
                        src={option.image_url.startsWith('http') ? option.image_url : `${baseURL}${option.image_url}`}
                        alt={option.label || `Option ${index + 1}`}
                      />
                    ) : (
                      <div className="saved-question__image-placeholder">
                        <i className="ri-image-line"></i>
                      </div>
                    )}
                    <div
                      className={`saved-question__image-select ${
                        question.type === "multi-image-select"
                          ? "checkbox"
                          : "radio"
                      }`}
                    >
                      <i
                        className={`ri-${
                          question.type === "multi-image-select"
                            ? "checkbox-blank-line"
                            : "radio-button-line"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="saved-question__image-label">
                    {option.label || `Option ${index + 1}`}
                    {question.branch?.[index] && (
                      <i
                        className="ri-git-branch-line"
                        title="Has branch logic"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
        break;

      case "document-upload":
        details = (
          <>
            {description}
            <div className="saved-question__document-upload">
              <div className="saved-question__upload-area">
                <i className="ri-upload-cloud-line"></i>
                <p>Drag and drop files here or click to upload</p>
                <span className="saved-question__upload-info">
                  {question.file_types
                    ? `Allowed file types: ${question.file_types.join(", ")}`
                    : "All file types accepted"}
                  {question.max_file_size &&
                    ` • Max size: ${question.max_file_size}MB`}
                  {question.max_files && ` • Max files: ${question.max_files}`}
                </span>
              </div>
            </div>
          </>
        );
        break;

      case "interactive-ranking":
        details = (
          <>
            {description}
            <div className="saved-question__ranking">
              <div className="saved-question__ranking-instructions">
                Drag items to rank them in order of preference
              </div>
              <div className="saved-question__ranking-list">
                {question.ranking_items?.map((item, index) => (
                  <div key={index} className="saved-question__ranking-item">
                    <div className="saved-question__ranking-number">
                      {index + 1}
                    </div>
                    <div className="saved-question__ranking-handle">
                      <i className="ri-drag-move-line"></i>
                    </div>
                    <div className="saved-question__ranking-text">
                      {typeof item === "object" ? item.text : item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
        break;

      case "numerical-input":
        details = (
          <>
            {description}
            <div className="saved-question__input-preview">
              <div className="saved-question__input-field">
                <textarea
                  placeholder="User will enter number here..."
                  disabled
                  rows={1}
                />
              </div>
            </div>
          </>
        );
        break;

      case "email-input":
        details = (
          <>
            {description}
            <div className="saved-question__input-preview">
              <div className="saved-question__input-field">
                <textarea
                  placeholder="User will enter email here..."
                  disabled
                  rows={1}
                />
              </div>
            </div>
            <div className="saved-question__details">
              {question.verify_domain && (
                <span>
                  <i className="ri-shield-check-line"></i>
                  Domain verification enabled
                </span>
              )}
              {question.allowed_domains && (
                <span>
                  <i className="ri-mail-check-line"></i>
                  Allowed domains: {question.allowed_domains.join(", ")}
                </span>
              )}
            </div>
          </>
        );
        break;

      case "radio-grid":
        details = (
          <>
            {description}
            <div className="saved-question__grid-preview">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {question.grid_columns?.map((col, i) => (
                      <th key={i}>
                        {typeof col === "object" ? col.text : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {question.grid_rows?.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td>{typeof row === "object" ? row.text : row}</td>
                      {question.grid_columns?.map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className="saved-question__radio-cell"
                        >
                          <div className="saved-question__radio-preview">
                            <div className="saved-question__radio-circle"></div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
        break;
      case "checkbox-grid":
      case "star-rating-grid":
  details = (
    <>
      {description}
      <div className="saved-question__grid-preview">
        <table>
          <thead>
  
          </thead>
          <tbody>
            {question.grid_rows?.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="saved-question__grid-text">{typeof row === "object" ? row.text : row}</td>
                <td>
                  <div className="saved-question__star-preview">
                    {[...Array(5)].map((_, i) => (
                      <i
                        key={i}
                        className="ri-star-line"
                        style={{ color: "#AA2EFF" }}
                      ></i>
                    ))}
                  </div>
                </td>
                {question.show_na && (
                  <td>
                    <div className="saved-question__na-option">
                      <div className="saved-question__na-checkbox-preview">
                        <i className="ri-checkbox-blank-line"></i>
                        <span>Not Applicable</span>
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
  break;

      case "star-rating":
        details = (
          <>
            {description}
            <div className="saved-question__star-rating-preview">
              <div className="saved-question__star-rating-container">
                {/* Stars */}
                <div className="saved-question__stars">
                  {[...Array(5)].map((_, i) => (
                    <i
                      key={i}
                      className="ri-star-line"
                      style={{ color: "#AA2EFF" }}
                    ></i>
                  ))}
                </div>
                {/* N/A Checkbox below stars */}
                {question.show_na && (
                  <div className="saved-question__star-rating-na">
                    <div className="saved-question__na-checkbox-preview">
                      <i className="ri-checkbox-blank-line"></i>
                      <span>
                        {question.not_applicable_text || "Not Applicable"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
        break;

      case "rating":
        const start = question.rating_start || 0;
        const end = question.rating_end || 10;
        const step = question.rating_step || 1;
        const totalSteps = Math.floor((end - start) / step);

        details = (
          <>
            {description}
            <div className="saved-question__details">
              <div className="saved-question__rating-preview">
                {/* Labels container */}
                <div className="saved-question__rating-labels">
                  <span className="saved-question__rating-label left">
                    {question.left_label || "Not at all"}{" "}
                    {/* Changed fallback */}
                  </span>
                  {question.center_label && (
                    <span className="saved-question__rating-label center">
                      {question.center_label}{" "}
                    </span>
                  )}
                  <span className="saved-question__rating-label right">
                    {question.right_label || "Extremely"}{" "}
                    {/* Changed fallback */}
                  </span>
                </div>
                <div className="saved-question__rating-track">
                  <div className="saved-question__rating-start">{start}</div>
                  <div className="saved-question__rating-marks">
                    {[...Array(totalSteps - 1)].map((_, i) => (
                      <div
                        key={i}
                        className="saved-question__rating-tick"
                        style={{
                          left: `${((i + 1) / totalSteps) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="saved-question__rating-end">{end}</div>
                </div>
                {question.rating_unit && (
                  <div className="saved-question__rating-unit">
                    Unit: {question.rating_unit}
                  </div>
                )}
                 {question.show_na && (
                  <div className="saved-question__na-option">
                    <div className="saved-question__na-checkbox-preview">
                      <i className="ri-checkbox-blank-line"></i>
                      <span>
                        {question.not_applicable_text || "Not Applicable"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
        break;

      case "nps":
        details = (
          <>
            {description}
            <div className="saved-question__details">
              <div className="saved-question__nps-preview">
                {/* Labels */}
                <div className="saved-question__nps-labels">
                  <span>{question.nps_left_label || "Not at all likely"}</span>
                  <span>{question.nps_right_label || "Extremely likely"}</span>
                </div>
                {/* NPS Scale */}
                <div className="saved-question__nps-scale">
                  {[...Array(11)].map((_, i) => (
                    <div key={i} className="saved-question__nps-button">
                      {i}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
        break;

      case "date-picker":
        details = (
          <>
            {description}
            <div className="saved-question__input-preview">
              <div className="saved-question__input-field">
                <textarea
                  placeholder="User will enter date here..."
                  disabled
                  rows={1}
                />
              </div>
            </div>
          </>
        );
        break;

      case "scale":
        details = (
          <>
            {description}
            <div className="saved-question__scale-preview">
              <div className="saved-question__scale-points">
                {question.scale_points?.map((point, index) => (
                  <div key={index} className="saved-question__scale-point">
                    <div className="saved-question__scale-radio" />
                    <span className="saved-question__scale-label">
                      {point || `Point ${index + 1}`}
                    </span>
                  </div>
                ))}
                {question.show_na && (
                  <div className="saved-question__scale-point">
                    <div className="saved-question__scale-radio" />
                    <span className="saved-question__scale-label">
                      {question.not_applicable_text || "Not Applicable"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        );
        break;

      case "signature":
        details = (
          <>
            {description}
            <div className="saved-question__signature-preview">
              <div className="saved-question__signature-options">
                <button className="saved-question__signature-option active">
                  <i className="ri-pencil-line"></i>
                  Draw
                </button>
                <button className="saved-question__signature-option">
                  <i className="ri-text"></i>
                  Type
                </button>
              </div>
              <div className="saved-question__input-field signature-box">
                <textarea
                  placeholder="User will draw/type here..."
                  disabled
                  rows={3}
                />
              </div>
              <div className="saved-question__details">
                {question.signature_options?.showFullName && (
                  <span>
                    <i className="ri-user-line"></i>
                    Requires full name
                  </span>
                )}
              </div>
            </div>
          </>
        );
        break;

      case "content-text":
        details = (
          <div className="saved-question__content-text-preview">
            <div 
              className="saved-question__content-text-container"
              dangerouslySetInnerHTML={{
                __html: question.question_text_html || question.text || ""
              }}
            />
          </div>
        );
        break;

      case "content-media":
        details = (
          <div className="saved-question__content-media-preview">
            <div className="saved-question__content-media-container">
              {question.media_url ? (
                <img
                  src={question.media_url.startsWith('http') || question.media_url.startsWith('data:') ? question.media_url : `${baseURL}${question.media_url}`}
                  alt={question.caption || "Content media"}
                  className="saved-question__content-media-image"
                />
              ) : (
                <div className="saved-question__content-media-placeholder">
                  <i className="ri-image-line"></i>
                </div>
              )}
              {question.caption && (
                <div className="saved-question__content-media-caption">
                  {question.caption}
                </div>
              )}
            </div>
          </div>
        );
        break;

      default:
        details = description;
        break;
    }

    return details ? (
      <div className="saved-question__details-container">
        <div className="saved-question__details-content">{details}</div>
      </div>
    ) : null;
  };

  return (
    <div
      className={`saved-question ${
        isBranched ? "saved-question--branched" : ""
      }`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={(e) => {
        e.stopPropagation();
        e.currentTarget.classList.remove("dragging");
      }}
      onClick={(e) => {
        e.stopPropagation();
        handleEdit();
      }}
      style={{
        animation: "slideIn 0.3s ease-out",
        cursor: "grab",
      }}
    >
      <div className="saved-question__content">
        <div className="saved-question__header">
          <div className="saved-question__number">{questionNumber}</div>
          <div className="saved-question__text">
            <div
              dangerouslySetInnerHTML={{
                __html: question.question_text_html || question.text || "(Untitled Question)"
              }}
            />
            {question.required && (
              <span className="saved-question__required">*</span>
            )}
          </div>
          <div className="saved-question__type">
            {question.type === "nps"
              ? "NPS"
              : question.type === "rating"
              ? "Slider"
              : question.type.replace("-", " ")}
          </div>
        </div>
        {renderQuestionDetails(question)}
      </div>

      <div className="saved-question__actions">
        <button
          className="saved-question__action-btn"
          onClick={handleMoveUp}
          disabled={isFirst}
          title="Move Up"
        >
          <i className="ri-arrow-up-s-line"></i>
        </button>

        <button
          className="saved-question__action-btn"
          onClick={handleMoveDown}
          disabled={isLast}
          title="Move Down"
        >
          <i className="ri-arrow-down-s-line"></i>
        </button>

        <button
          className="saved-question__action-btn"
          onClick={handleCopy}
          title="Duplicate Question (Create a Copy)"
        >
          <i className="ri-file-copy-line"></i>
        </button>

        <button
          className="saved-question__action-btn"
          onClick={handleAddToBank}
          title="Save to Question Library"
        >
          <i className="ri-bank-line"></i>
        </button>

        <button
          className="saved-question__action-btn"
          onClick={handleEdit}
          title="Edit Question"
        >
          <i className="ri-edit-line"></i>
        </button>

        <button
          className="saved-question__action-btn saved-question__action-btn--delete"
          onClick={handleDelete}
          title="Delete Question"
        >
          <i className="ri-delete-bin-line"></i>
        </button>
      </div>
      <div className="drag-indicator">
        <i className="ri-drag-move-fill" />
      </div>
    </div>
  );
};

export default SavedQuestionPreview;
