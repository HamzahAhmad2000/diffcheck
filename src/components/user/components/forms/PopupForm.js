import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CloseButton from '../buttons/CloseButton';
import { toast } from 'react-hot-toast';
import './PopupForm.css';

/**
 * PopupForm - A reusable popup form component
 * Extracted from BrandDetailPage.js IdeaSubmissionModal
 */
const PopupForm = ({ 
  isOpen = false,
  onClose,
  onSubmit,
  title = "Submit Form",
  subtitle = null,
  submitButtonText = "Submit",
  cancelButtonText = "Cancel",
  fields = [],
  loading = false,
  size = "medium",
  variant = "default",
  className = "",
  showCancelButton = true,
  maxFiles = 5,
  acceptedFileTypes = "image/*",
  ...props 
}) => {
  const [formData, setFormData] = useState({});
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleFileChange = (e, fieldName) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    if (fieldName) {
      // Single file field
      setFormData(prev => ({
        ...prev,
        [fieldName]: selectedFiles[0]
      }));
    } else {
      // Multiple files
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index, fieldName = null) => {
    if (fieldName) {
      setFormData(prev => ({
        ...prev,
        [fieldName]: null
      }));
    } else {
      setFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = fields.filter(field => field.required);
    const missingFields = requiredFields.filter(field => 
      !formData[field.name] || (typeof formData[field.name] === 'string' && !formData[field.name].trim())
    );
    
    if (missingFields.length > 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSubmitting(true);
    try {
      const submitData = { ...formData };
      if (files.length > 0) {
        submitData.files = files;
      }
      
      await onSubmit(submitData);
      
      // Reset form
      setFormData({});
      setFiles([]);
      
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!submitting) {
      setFormData({});
      setFiles([]);
      onClose();
    }
  };

  const getModalClass = () => {
    let classes = `popup-form-overlay popup-form--${variant} popup-form--${size}`;
    if (className) classes += ` ${className}`;
    return classes;
  };

  const renderField = (field) => {
    const { name, type, label, placeholder, required, options, rows, maxLength, multiple } = field;
    const value = formData[name] || '';

    switch (type) {
      case 'text':
      case 'email':
      case 'password':
      case 'url':
        return (
          <input
            type={type}
            placeholder={placeholder || label}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            className="popup-form__input"
            required={required}
            maxLength={maxLength}
          />
        );

      case 'textarea':
        return (
          <textarea
            placeholder={placeholder || label}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            className="popup-form__textarea"
            required={required}
            rows={rows || 4}
            maxLength={maxLength}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            className="popup-form__select"
            required={required}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options?.map((option, index) => (
              <option key={option.value || index} value={option.value || option}>
                {option.label || option}
              </option>
            ))}
          </select>
        );

      case 'file':
        return (
          <div className="popup-form__file-input-container">
            <label className="popup-form__file-input-label">
              <input
                type="file"
                accept={acceptedFileTypes}
                multiple={multiple}
                onChange={(e) => handleFileChange(e, multiple ? null : name)}
                className="popup-form__file-input"
              />
              📎 {placeholder || `Attach ${label}`} {multiple ? `(max ${maxFiles})` : ''}
            </label>
            
            {/* Show selected files */}
            {multiple && files.length > 0 && (
              <div className="popup-form__files-preview">
                {files.map((file, index) => (
                  <div key={index} className="popup-form__file-preview-item">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={`Preview ${index + 1}`}
                      className="popup-form__file-preview-image"
                    />
                    <span className="popup-form__file-name">
                      {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => removeFile(index)}
                      className="popup-form__file-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {!multiple && formData[name] && (
              <div className="popup-form__file-preview">
                <span>{formData[name].name}</span>
                <button type="button" onClick={() => removeFile(0, name)}>×</button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={getModalClass()} onClick={handleCancel} {...props}>
      <div 
        className="popup-form__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-form__header">
          <div className="popup-form__title-section">
            <h3 className="popup-form__title">
              {title}
            </h3>
            {subtitle && (
              <p className="popup-form__subtitle">{subtitle}</p>
            )}
          </div>
          <CloseButton 
            onClick={handleCancel}
            disabled={submitting}
            variant="ghost"
            className="popup-form__close"
          />
        </div>

        <div className="popup-form__body">
          <form onSubmit={handleSubmit} className="popup-form__form">
            {fields.map((field, index) => (
              <div key={field.name || index} className="popup-form__field">
                {field.label && (
                  <label className="popup-form__label">
                    {field.label} {field.required && <span className="popup-form__required">*</span>}
                  </label>
                )}
                {renderField(field)}
              </div>
            ))}
            
            <div className="popup-form__actions">
              {showCancelButton && (
                <button 
                  type="button" 
                  className="popup-form__button popup-form__button--secondary" 
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  {cancelButtonText}
                </button>
              )}
              <button 
                type="submit" 
                className="popup-form__button popup-form__button--primary" 
                disabled={submitting || loading}
              >
                {submitting ? 'Submitting...' : submitButtonText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

PopupForm.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  submitButtonText: PropTypes.string,
  cancelButtonText: PropTypes.string,
  fields: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['text', 'email', 'password', 'url', 'textarea', 'select', 'file']).isRequired,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    required: PropTypes.bool,
    options: PropTypes.array, // For select fields
    rows: PropTypes.number, // For textarea
    maxLength: PropTypes.number,
    multiple: PropTypes.bool // For file inputs
  })).isRequired,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['default', 'dark', 'light']),
  className: PropTypes.string,
  showCancelButton: PropTypes.bool,
  maxFiles: PropTypes.number,
  acceptedFileTypes: PropTypes.string
};

export default PopupForm;
