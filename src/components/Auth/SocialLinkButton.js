import React from 'react';
import PropTypes from 'prop-types';

// Basic styling, can be expanded in a dedicated CSS file or using existing classes
const buttonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 15px',
  border: '1px solid #AA2EFF', // Use accent color
  borderRadius: '4px',
  backgroundColor: 'transparent', // Dark theme friendly
  color: '#FFFFFF', // White text
  cursor: 'pointer',
  fontSize: '0.9rem',
  gap: '8px',
  width: '100%', // Make it full width of its container by default
  transition: 'background-color 0.2s ease-in-out',
};

const iconStyle = {
  width: '20px',
  height: '20px',
  // If icons are dark, this filter can help make them visible on a dark background
  // filter: 'brightness(0) invert(1)', 
};

const SocialLinkButton = ({ platform, onClick, icon, disabled }) => {
  // A real implementation would call an OAuth flow, 
  // e.g., window.location.href = `/api/auth/oauth/${platform.toLowerCase()}/initiate?registration_token=YOUR_TEMP_TOKEN_IF_NEEDED`;
  const handleClick = () => {
    if (onClick) {
      onClick(platform);
    } else {
      // This else block should ideally not be reached if onClick is required
      console.error(`SocialLinkButton: onClick handler is required for ${platform}.`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={buttonStyle}
      className="social-link-button primaryfont" // Add primaryfont if needed
      disabled={disabled}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(170, 46, 255, 0.1)'} // Accent color with alpha
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {icon && <img src={icon} alt={`${platform} icon`} style={iconStyle} />}
      Link with {platform}
    </button>
  );
};

SocialLinkButton.propTypes = {
  platform: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired, // Make onClick required
  icon: PropTypes.string,   // Path to an icon image
  disabled: PropTypes.bool,
};

export default SocialLinkButton; 