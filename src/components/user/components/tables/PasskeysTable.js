import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './PasskeysTable.css';

/**
 * PasskeysTable - A reusable passkeys management component
 * Extracted from UserEditProfile.js passkeys section
 */
const PasskeysTable = ({ 
  passkeys = [],
  onGenerate,
  loading = false,
  title = "Passkeys (Recovery Codes)",
  subtitle = "Generate a set of one-time passkeys to use for account recovery if you lose access to your MFA device. Store these securely.",
  generateButtonText = "Generate New Passkeys",
  warningText = "Please copy these codes and store them in a safe place. You will not be able to see them again after leaving this page.",
  variant = "default",
  className = "",
  showConfirmation = true,
  confirmationText = "Are you sure you want to generate new passkeys? This will invalidate any old ones you might have saved.",
  ...props 
}) => {
  const [showPasskeys, setShowPasskeys] = useState(false);

  const handleGenerate = async () => {
    if (showConfirmation && !window.confirm(confirmationText)) {
      return;
    }
    
    if (onGenerate) {
      const result = await onGenerate();
      if (result && result.success) {
        setShowPasskeys(true);
      }
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyAllPasskeys = async () => {
    const allPasskeys = passkeys.join('\n');
    await copyToClipboard(allPasskeys);
  };

  const getTableClass = () => {
    let classes = `passkeys-table passkeys-table--${variant}`;
    if (className) classes += ` ${className}`;
    return classes;
  };

  return (
    <div className={getTableClass()} {...props}>
      <div className="passkeys-table__header">
        <h2 className="passkeys-table__title">{title}</h2>
        {subtitle && (
          <p className="passkeys-table__subtitle">{subtitle}</p>
        )}
      </div>
      
      <div className="passkeys-table__content">
        <div className="passkeys-table__actions">
          <button 
            onClick={handleGenerate} 
            disabled={loading} 
            className="passkeys-table__button passkeys-table__button--primary"
          >
            {loading ? 'Generating...' : generateButtonText}
          </button>
        </div>
        
        {passkeys.length > 0 && showPasskeys && (
          <div className="passkeys-table__container">
            <div className="passkeys-table__warning">
              <div className="passkeys-table__warning-icon">
                <i className="ri-alert-line"></i>
              </div>
              <div className="passkeys-table__warning-content">
                <h3 className="passkeys-table__warning-title">Your New Passkeys:</h3>
                <p className="passkeys-table__warning-text">
                  {warningText}
                </p>
              </div>
              <button
                onClick={copyAllPasskeys}
                className="passkeys-table__copy-all"
                title="Copy all passkeys"
              >
                <i className="ri-file-copy-line"></i>
                Copy All
              </button>
            </div>
            
            <div className="passkeys-table__grid">
              {passkeys.map((key, index) => (
                <div key={index} className="passkey-item">
                  <span className="passkey-number">{index + 1}.</span>
                  <code className="passkey-code">{key}</code>
                  <button
                    onClick={() => copyToClipboard(key)}
                    className="passkey-copy"
                    title="Copy passkey"
                  >
                    <i className="ri-file-copy-line"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

PasskeysTable.propTypes = {
  passkeys: PropTypes.arrayOf(PropTypes.string),
  onGenerate: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  generateButtonText: PropTypes.string,
  warningText: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'compact', 'card']),
  className: PropTypes.string,
  showConfirmation: PropTypes.bool,
  confirmationText: PropTypes.string
};

export default PasskeysTable;
