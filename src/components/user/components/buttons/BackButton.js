import React from 'react';
import PropTypes from 'prop-types';
import './BackButton.css';

/**
 * BackButton - A reusable back navigation button component
 * Extracted from UserEditTags.js and other user pages
 */
const BackButton = ({ 
  onClick, 
  text = "Back", 
  variant = "primary", 
  size = "medium",
  disabled = false,
  showIcon = true,
  icon = "ri-arrow-left-s-line",
  className = "",
  ...props 
}) => {
  
  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  const getButtonClass = () => {
    let classes = `back-button back-button--${variant} back-button--${size}`;
    
    if (disabled) classes += ' back-button--disabled';
    
    return `${classes} ${className}`;
  };

  return (
    <button 
      className={getButtonClass()}
      onClick={handleClick}
      disabled={disabled}
      type="button"
      {...props}
    >
      {showIcon && <i className={icon}></i>}
      <span>{text}</span>
    </button>
  );
};

BackButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'outline']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  showIcon: PropTypes.bool,
  icon: PropTypes.string,
  className: PropTypes.string
};

export default BackButton;
