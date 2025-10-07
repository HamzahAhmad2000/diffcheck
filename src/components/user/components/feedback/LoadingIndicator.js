import React from 'react';
import PropTypes from 'prop-types';
import './LoadingIndicator.css';

/**
 * LoadingIndicator - A reusable loading indicator component
 * Extracted from MarketplacePage.js loading states
 */
const LoadingIndicator = ({ 
  variant = "spinner", 
  size = "medium",
  color = "primary",
  text = "Loading...",
  showText = true,
  centered = true,
  fullHeight = false,
  className = "",
  ...props 
}) => {
  
  const getIndicatorClass = () => {
    let classes = `loading-indicator loading-indicator--${variant} loading-indicator--${size} loading-indicator--${color}`;
    
    if (centered) classes += ' loading-indicator--centered';
    if (fullHeight) classes += ' loading-indicator--full-height';
    
    return `${classes} ${className}`;
  };

  const renderSpinner = () => (
    <div className="loading-indicator__spinner">
      <div className="loading-indicator__spinner-circle"></div>
    </div>
  );

  const renderDots = () => (
    <div className="loading-indicator__dots">
      <div className="loading-indicator__dot"></div>
      <div className="loading-indicator__dot"></div>
      <div className="loading-indicator__dot"></div>
    </div>
  );

  const renderPulse = () => (
    <div className="loading-indicator__pulse">
      <div className="loading-indicator__pulse-circle"></div>
    </div>
  );

  const renderBar = () => (
    <div className="loading-indicator__bar">
      <div className="loading-indicator__bar-fill"></div>
    </div>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'bar':
        return renderBar();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  return (
    <div className={getIndicatorClass()} {...props}>
      <div className="loading-indicator__content">
        {renderVariant()}
        {showText && text && (
          <p className="loading-indicator__text">{text}</p>
        )}
      </div>
    </div>
  );
};

LoadingIndicator.propTypes = {
  variant: PropTypes.oneOf(['spinner', 'dots', 'pulse', 'bar']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.oneOf(['primary', 'secondary', 'white', 'dark']),
  text: PropTypes.string,
  showText: PropTypes.bool,
  centered: PropTypes.bool,
  fullHeight: PropTypes.bool,
  className: PropTypes.string
};

export default LoadingIndicator;
