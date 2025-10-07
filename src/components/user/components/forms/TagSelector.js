import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { userProfileAPI } from '../../../../services/apiClient';
import { toast } from 'react-hot-toast';
import './TagSelector.css';

/**
 * TagSelector - A reusable tag selection component
 * Extracted from common/TagSelector.js for user component library
 */
const TagSelector = ({
  availableTags = [], // Accept pre-fetched tags
  category,
  selectedTagIds = [], // Now a controlled prop
  onChange, // Replaces onSave
  isLoading = false,
  allowCreate = false,
  selectionMode = 'multiple',
  maxSelection,
  title, // Title is now optional and managed by parent
  parentLoading = false,
  hideActions = false, // Prop to hide action buttons
  onSave, // Kept for backward compatibility e.g. SignupStep3
  onSkip, // Kept for backward compatibility
  saveButtonText = 'Save & Continue',
  skipButtonText = 'Skip',
  theme = 'dark', // NEW: theme prop, default to dark
  variant = 'default',
  size = 'medium',
  className = '',
  placeholder = 'Search tags...',
  showCount = false,
  ...props
}) => {
  const [internalTags, setInternalTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);

  // Fetch tags only if not provided via props
  const fetchTags = useCallback(async () => {
    if (availableTags && availableTags.length > 0) {
      return;
    }
    
    if (!category) {
      console.warn('TagSelector: No category provided and no availableTags passed');
      return;
    }

    setLoadingTags(true);
    try {
      const response = await userProfileAPI.adminGetProfileTags({ category });
      const tags = response.data || [];
      setInternalTags(Array.isArray(tags) ? tags : []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags. Please try again.");
      setInternalTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [category, availableTags]);

  useEffect(() => {
    // Only fetch if we don't have provided tags
    if (!availableTags || availableTags.length === 0) {
      fetchTags();
    }
  }, [fetchTags]);

  const handleTagClick = (tagId) => {
    const newSelectedTagIds = new Set(selectedTagIds);

    if (newSelectedTagIds.has(tagId)) {
      newSelectedTagIds.delete(tagId);
    } else {
      if (selectionMode === 'single') {
        newSelectedTagIds.clear();
        newSelectedTagIds.add(tagId);
      } else if (maxSelection && newSelectedTagIds.size >= maxSelection) {
        toast.error(`You can select a maximum of ${maxSelection} tags.`);
        return;
      } else {
        newSelectedTagIds.add(tagId);
      }
    }

    if (onChange) {
      onChange(Array.from(newSelectedTagIds)); // Notify parent of change
    }
  };

  // Use provided tags if available, otherwise use internally fetched tags
  const tagsToUse = availableTags && availableTags.length > 0 ? availableTags : internalTags;
  
  const filteredTags = tagsToUse.filter(tag =>
    tag.name && tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = selectedTagIds.length;

  const getContainerClass = () => {
    let classes = `tag-selector-container tag-selector-${theme} tag-selector--${variant} tag-selector--${size}`;
    if (className) classes += ` ${className}`;
    return classes;
  };

  if (loadingTags || parentLoading) {
    return (
      <div className={getContainerClass()}>
        <div className="tag-selector-loading">
          <div className="tag-selector-spinner"></div>
          <p>Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClass()} {...props}>
      {title && <h3 className="tag-selector-title">{title}</h3>}
      
      <div className="tag-selector-search">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="tag-selector-search-input"
          disabled={isLoading}
        />
        <i className="ri-search-line tag-selector-search-icon"></i>
      </div>
      
      <div className="tag-selector-list">
        {filteredTags.length > 0 ? (
          filteredTags.map(tag => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={(e) => {
                  e.preventDefault();
                  handleTagClick(tag.id);
                }}
                className={`tag-chip ${isSelected ? 'tag-chip--selected' : ''}`}
                disabled={isLoading}
                type="button"
              >
                <span className="tag-chip__name">{tag.name}</span>
                {showCount && tag.count && (
                  <span className="tag-chip__count">({tag.count})</span>
                )}
                {isSelected && <i className="ri-check-line tag-chip__check"></i>}
              </button>
            );
          })
        ) : (
          <div className="tag-selector-empty">
            <i className="ri-price-tag-3-line"></i>
            <p>No tags found. {allowCreate && 'You can suggest new ones!'}</p>
          </div>
        )}
      </div>
      
      {allowCreate && (
        <div className="tag-selector-create">
          <input 
            type="text" 
            placeholder="Suggest a new tag" 
            disabled={isLoading}
            className="tag-selector-create-input"
          />
          <button 
            disabled={isLoading}
            className="tag-selector-create-button"
            type="button"
          >
            <i className="ri-add-line"></i>
            Suggest
          </button>
        </div>
      )}
      
      {!hideActions && (onSave || onSkip) && (
        <div className="tag-selector-actions">
          {onSkip && (
            <button 
              onClick={onSkip} 
              className="tag-selector-button tag-selector-button--secondary" 
              disabled={isLoading}
              type="button"
            >
              {skipButtonText}
            </button>
          )}
          {onSave && (
            <button 
              onClick={() => onSave(selectedTagIds)} 
              className="tag-selector-button tag-selector-button--primary" 
              disabled={isLoading || selectedCount === 0}
              type="button"
            >
              {saveButtonText} {selectedCount > 0 && `(${selectedCount})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

TagSelector.propTypes = {
  availableTags: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    count: PropTypes.number,
  })),
  category: PropTypes.string,
  selectedTagIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  onChange: PropTypes.func, // The primary way to handle updates
  onSave: PropTypes.func, // For flows that need an explicit save button
  onSkip: PropTypes.func,
  isLoading: PropTypes.bool,
  parentLoading: PropTypes.bool,
  allowCreate: PropTypes.bool,
  selectionMode: PropTypes.oneOf(['single', 'multiple']),
  maxSelection: PropTypes.number,
  title: PropTypes.string,
  hideActions: PropTypes.bool, // New prop to control button visibility
  saveButtonText: PropTypes.string,
  skipButtonText: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
  variant: PropTypes.oneOf(['default', 'compact', 'card']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  className: PropTypes.string,
  placeholder: PropTypes.string,
  showCount: PropTypes.bool
};

export default TagSelector;
