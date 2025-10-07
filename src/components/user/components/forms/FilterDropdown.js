import React from 'react';
import PropTypes from 'prop-types';
import './FilterDropdown.css';

/**
 * FilterDropdown - A reusable filter dropdown component
 * Extracted from QuestDashboard.js category filter functionality
 */
const FilterDropdown = ({ 
  value = '', 
  onChange, 
  options = [],
  placeholder = "Select...", 
  label = null,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  clearable = true,
  className = "",
  name = "",
  id = "",
  ...props 
}) => {
  
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value, e);
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange('');
    }
  };

  const getDropdownClass = () => {
    let classes = `filter-dropdown filter-dropdown--${variant} filter-dropdown--${size}`;
    
    if (disabled) classes += ' filter-dropdown--disabled';
    if (loading) classes += ' filter-dropdown--loading';
    if (value) classes += ' filter-dropdown--has-value';
    
    return `${classes} ${className}`;
  };

  return (
    <div className={getDropdownClass()}>
      {label && (
        <label className="filter-dropdown__label" htmlFor={id || name}>
          {label}
        </label>
      )}
      
      <div className="filter-dropdown__wrapper">
        <select
          className="filter-dropdown__select"
          value={value}
          onChange={handleChange}
          disabled={disabled || loading}
          name={name}
          id={id || name}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option, index) => (
            <option 
              key={option.value || option.key || index} 
              value={option.value || option.key || option}
              disabled={option.disabled}
            >
              {option.label || option.text || option}
            </option>
          ))}
        </select>
        
        <div className="filter-dropdown__icon">
          {loading ? (
            <div className="filter-dropdown__spinner"></div>
          ) : (
            <i className="ri-arrow-down-s-line"></i>
          )}
        </div>
        
        {clearable && value && !loading && (
          <button
            type="button"
            className="filter-dropdown__clear"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            <i className="ri-close-line"></i>
          </button>
        )}
      </div>
    </div>
  );
};

FilterDropdown.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        label: PropTypes.string,
        text: PropTypes.string,
        key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        disabled: PropTypes.bool
      })
    ])
  ),
  placeholder: PropTypes.string,
  label: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'dark', 'light']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  clearable: PropTypes.bool,
  className: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string
};

export default FilterDropdown;
