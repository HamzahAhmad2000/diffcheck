import React from 'react';
import PropTypes from 'prop-types';
import './SearchBar.css';

/**
 * SearchBar - A reusable search input component
 * Extracted from UserHomepage.js brands page search functionality
 */
const SearchBar = ({ 
  value = '', 
  onChange, 
  placeholder = "Search", 
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  clearable = true,
  className = "",
  onClear = null,
  onSubmit = null,
  icon = "ri-search-line",
  ...props 
}) => {
  
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value, e);
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(value, e);
    }
  };

  const getSearchBarClass = () => {
    let classes = `search-bar search-bar--${variant} search-bar--${size}`;
    
    if (disabled) classes += ' search-bar--disabled';
    if (loading) classes += ' search-bar--loading';
    if (value) classes += ' search-bar--has-value';
    
    return `${classes} ${className}`;
  };

  return (
    <div className={getSearchBarClass()}>
      <div className="search-bar__wrapper">
        {icon && (
          <i className={`search-bar__icon ${icon} ${loading ? 'search-bar__icon--loading' : ''}`}></i>
        )}
        
        <input
          type="text"
          className="search-bar__input"
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          {...props}
        />
        
        {clearable && value && !loading && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <i className="ri-close-line"></i>
          </button>
        )}
        
        {loading && (
          <div className="search-bar__spinner"></div>
        )}
      </div>
    </div>
  );
};

SearchBar.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'dark', 'light']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  clearable: PropTypes.bool,
  className: PropTypes.string,
  onClear: PropTypes.func,
  onSubmit: PropTypes.func,
  icon: PropTypes.string
};

export default SearchBar;
