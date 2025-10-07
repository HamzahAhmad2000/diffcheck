import React from 'react';
import PropTypes from 'prop-types';
import './ViewAllButton.css';

/**
 * ViewAllButton - A reusable "View All" button component
 * Extracted from UserHomepage.js dashboard sections
 */
const ViewAllButton = ({ 
  onClick, 
  text = "View All", 
  variant = "primary", 
  disabled = false,
  className = "",
  ...props 
}) => {
  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  return (
    <button 
      className={`view-all-button view-all-button--${variant} ${className} ${disabled ? 'view-all-button--disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      type="button"
      {...props}
    >
      {text}
    </button>
  );
};

ViewAllButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline']),
  disabled: PropTypes.bool,
  className: PropTypes.string
};

export default ViewAllButton;
