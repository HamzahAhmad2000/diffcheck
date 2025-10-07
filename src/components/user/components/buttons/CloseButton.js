import React from 'react';
import PropTypes from 'prop-types';
import './CloseButton.css';

/**
 * CloseButton - A reusable close button component
 * Extracted from various user modals and overlays
 */
const CloseButton = ({ 
  onClick, 
  variant = "primary", 
  size = "medium",
  disabled = false,
  showIcon = true,
  icon = "ri-close-line",
  ariaLabel = "Close",
  className = "",
  ...props 
}) => {
  
  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  const getButtonClass = () => {
    let classes = `close-button close-button--${variant} close-button--${size}`;
    
    if (disabled) classes += ' close-button--disabled';
    
    return `${classes} ${className}`;
  };

  return (
    <button 
      className={getButtonClass()}
      onClick={handleClick}
      disabled={disabled}
      type="button"
      aria-label={ariaLabel}
      {...props}
    >
      {showIcon && <i className={icon}></i>}
    </button>
  );
};

CloseButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  showIcon: PropTypes.bool,
  icon: PropTypes.string,
  ariaLabel: PropTypes.string,
  className: PropTypes.string
};

export default CloseButton;
