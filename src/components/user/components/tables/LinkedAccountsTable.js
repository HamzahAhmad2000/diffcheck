import React from 'react';
import PropTypes from 'prop-types';
import './LinkedAccountsTable.css';

/**
 * LinkedAccountsTable - A reusable linked accounts management component
 * Extracted from UserEditProfile.js social account management section
 */
const LinkedAccountsTable = ({ 
  linkedAccounts = [],
  onUnlink,
  onLink,
  loading = false,
  title = "Linked Social Accounts",
  subtitle = null,
  emptyMessage = "No social accounts linked yet.",
  linkSectionTitle = "Link New Account:",
  availableProviders = ['google', 'discord', 'twitter'],
  variant = "default",
  className = "",
  showLinkSection = true,
  ...props 
}) => {

  const getProviderIcon = (provider) => {
    switch (provider.toLowerCase()) {
      case 'discord':
        return 'ri-discord-fill';
      case 'google':
        return 'ri-google-fill';
      case 'twitter':
        return 'ri-twitter-fill';
      case 'facebook':
        return 'ri-facebook-fill';
      case 'github':
        return 'ri-github-fill';
      case 'linkedin':
        return 'ri-linkedin-fill';
      default:
        return 'ri-link';
    }
  };

  const getProviderDisplayName = (provider) => {
    switch (provider.toLowerCase()) {
      case 'twitter':
        return 'X (Twitter)';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  const getProviderColor = (provider) => {
    switch (provider.toLowerCase()) {
      case 'discord':
        return '#5865F2';
      case 'google':
        return '#EA4335';
      case 'twitter':
        return '#1DA1F2';
      case 'facebook':
        return '#1877F2';
      case 'github':
        return '#333';
      case 'linkedin':
        return '#0A66C2';
      default:
        return '#8b5cf6';
    }
  };

  const handleUnlink = async (provider) => {
    if (!window.confirm(`Are you sure you want to unlink your ${getProviderDisplayName(provider)} account?`)) {
      return;
    }
    
    if (onUnlink) {
      await onUnlink(provider);
    }
  };

  const handleLink = async (provider) => {
    if (onLink) {
      await onLink(provider);
    }
  };

  const isProviderLinked = (provider) => {
    return linkedAccounts.some(acc => acc.provider.toLowerCase() === provider.toLowerCase());
  };

  const getTableClass = () => {
    let classes = `linked-accounts-table linked-accounts-table--${variant}`;
    if (className) classes += ` ${className}`;
    return classes;
  };

  return (
    <div className={getTableClass()} {...props}>
      <div className="linked-accounts-table__header">
        <h2 className="linked-accounts-table__title">{title}</h2>
        {subtitle && (
          <p className="linked-accounts-table__subtitle">{subtitle}</p>
        )}
      </div>
      
      <div className="linked-accounts-table__content">
        {linkedAccounts.length > 0 ? (
          <div className="linked-accounts-table__list">
            {linkedAccounts.map(acc => (
              <div key={acc.provider} className="linked-account-item">
                <div className="linked-account-item__info">
                  <div className="linked-account-item__icon" style={{ color: getProviderColor(acc.provider) }}>
                    <i className={getProviderIcon(acc.provider)}></i>
                  </div>
                  <div className="linked-account-item__details">
                    <span className="linked-account-item__provider">
                      {getProviderDisplayName(acc.provider)}
                    </span>
                    <span className="linked-account-item__identifier">
                      {acc.name || acc.email || 'Linked'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUnlink(acc.provider)} 
                  className="linked-account-item__unlink"
                  disabled={loading}
                >
                  <i className="ri-link-unlink-m"></i>
                  Unlink
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="linked-accounts-table__empty">
            <i className="ri-link-line"></i>
            <p>{emptyMessage}</p>
          </div>
        )}
        
        {showLinkSection && (
          <>
            <div className="linked-accounts-table__divider"></div>
            <div className="linked-accounts-table__link-section">
              <h3 className="linked-accounts-table__link-title">{linkSectionTitle}</h3>
              <div className="linked-accounts-table__providers">
                {availableProviders.map(provider => (
                  <button 
                    key={provider}
                    onClick={() => handleLink(provider)} 
                    className="linked-accounts-table__provider-button"
                    disabled={loading || isProviderLinked(provider)}
                    style={{ 
                      '--provider-color': getProviderColor(provider),
                      opacity: isProviderLinked(provider) ? 0.5 : 1 
                    }}
                  >
                    <i className={getProviderIcon(provider)}></i>
                    Link {getProviderDisplayName(provider)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

LinkedAccountsTable.propTypes = {
  linkedAccounts: PropTypes.arrayOf(PropTypes.shape({
    provider: PropTypes.string.isRequired,
    name: PropTypes.string,
    email: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  })),
  onUnlink: PropTypes.func,
  onLink: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  emptyMessage: PropTypes.string,
  linkSectionTitle: PropTypes.string,
  availableProviders: PropTypes.arrayOf(PropTypes.string),
  variant: PropTypes.oneOf(['default', 'compact', 'card']),
  className: PropTypes.string,
  showLinkSection: PropTypes.bool
};

export default LinkedAccountsTable;
