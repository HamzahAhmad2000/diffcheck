import React from 'react';
import PropTypes from 'prop-types';
import './EnterStartButton.css';

/**
 * EnterStartButton - A reusable Enter/Start button component
 * Extracted from UserHomepage.js business cards and survey items
 */
const EnterStartButton = ({ 
  onClick, 
  text = "Start", 
  variant = "primary", 
  size = "medium",
  disabled = false,
  loading = false,
  completed = false,
  claimed = false,
  claimable = false,
  pending = false,
  className = "",
  icon = null,
  ...props 
}) => {
  
  const getButtonText = () => {
    if (completed) return "✓ Completed";
    if (claimed) return "✓ Claimed";
    if (pending) return "Pending Approval";
    if (claimable) return "Claim Reward";
    if (loading) return "Loading...";
    return text;
  };

  const getButtonClass = () => {
    let classes = `enter-start-button enter-start-button--${variant} enter-start-button--${size}`;
    
    if (completed || claimed) classes += ' enter-start-button--completed';
    if (claimable) classes += ' enter-start-button--claimable';
    if (pending) classes += ' enter-start-button--pending';
    if (disabled) classes += ' enter-start-button--disabled';
    if (loading) classes += ' enter-start-button--loading';
    
    return `${classes} ${className}`;
  };

  const handleClick = (e) => {
    if (!disabled && !loading && !completed && !claimed && !pending && onClick) {
      onClick(e);
    }
  };

  const isDisabled = disabled || loading || completed || claimed || pending;

  return (
    <button 
      className={getButtonClass()}
      onClick={handleClick}
      disabled={isDisabled}
      type="button"
      {...props}
    >
      {icon && !loading && <i className={icon}></i>}
      {loading && <div className="enter-start-button__spinner"></div>}
      <span>{getButtonText()}</span>
    </button>
  );
};

EnterStartButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'warning', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  completed: PropTypes.bool,
  claimed: PropTypes.bool,
  claimable: PropTypes.bool,
  pending: PropTypes.bool,
  className: PropTypes.string,
  icon: PropTypes.string
};

export default EnterStartButton;
