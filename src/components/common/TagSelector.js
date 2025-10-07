import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { userProfileAPI } from '../../services/apiClient';
import toast from '../../utils/toast';
import '../../styles/TagSelector.css';

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
}) => {
  const [internalTags, setInternalTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);

  // Debugging: Log props
  useEffect(() => {
    console.log('[TagSelector] Props received:', {
      availableTags: availableTags?.length || 0,
      category,
      selectedTagIds
    });
  }, [availableTags?.length, category, selectedTagIds?.length]);

  // Fetch tags only if not provided via props
  const fetchTags = useCallback(async () => {
    if (availableTags && availableTags.length > 0) {
      console.log('[TagSelector] Using provided tags:', availableTags.length);
      return;
    }
    
    if (!category) {
      console.warn('TagSelector: No category provided and no availableTags passed');
      return;
    }

    console.log('[TagSelector] Fetching tags for category:', category);
    setLoadingTags(true);
    try {
      const response = await userProfileAPI.adminGetProfileTags({ category });
      const tags = response.data || [];
      console.log('[TagSelector] Fetched tags:', tags);
      setInternalTags(Array.isArray(tags) ? tags : []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Failed to load tags. Please try again.");
      setInternalTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [category]);

  useEffect(() => {
    // Only fetch if we don't have provided tags
    if (!availableTags || availableTags.length === 0) {
      fetchTags();
    }
  }, [category]);

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
  
  console.log('[TagSelector] Tags to use:', tagsToUse?.length || 0);
  
  const filteredTags = tagsToUse.filter(tag =>
    tag.name && tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingTags || parentLoading) {
    return <div className="tag-selector-loading">Loading tags...</div>;
  }

  const selectedCount = selectedTagIds.length;

  return (
    <div className={`tag-selector-container tag-selector-${theme}`}>
      {title && <h3 className="tag-selector-title">{title}</h3>}
      
      <input
        type="text"
        placeholder="Search tags..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="tag-selector-search-input"
        disabled={isLoading}
      />
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
                className={`tag-chip ${isSelected ? 'selected' : ''}`}
                disabled={isLoading}
                type="button"
              >
                {tag.name}
              </button>
            );
          })
        ) : (
          <p className="tag-selector-no-tags">No tags found. {allowCreate && 'You can suggest new ones!'}</p>
        )}
      </div>
      {allowCreate && (
        <div className="tag-selector-create-new">
          <input type="text" placeholder="Suggest a new tag" disabled={isLoading} />
          <button disabled={isLoading}>Suggest</button>
        </div>
      )}
      {!hideActions && (onSave || onSkip) && (
        <div className="tag-selector-actions">
          {onSkip && (
            <button onClick={onSkip} className="tag-selector-button skip" disabled={isLoading}>
              {skipButtonText}
            </button>
          )}
          {onSave && (
            <button 
              onClick={() => onSave(selectedTagIds)} 
              className="tag-selector-button save" 
              disabled={isLoading || selectedCount === 0}
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
  })).isRequired,
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
  theme: PropTypes.oneOf(['light', 'dark']), // NEW: theme prop
};

export default TagSelector; 