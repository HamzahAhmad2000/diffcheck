import React from 'react';
import PropTypes from 'prop-types';
import { CloseButton } from '../components';
import ShareButton from './ShareButton';
import './SharePromptModal.css';

/**
 * SharePromptModal - Modal prompt for reward redemption and raffle wins
 * Displays after user completes an action worthy of sharing
 */
const SharePromptModal = ({
  isOpen = false,
  onClose,
  shareType,
  entityId = null,
  entityName = null,
  title = "Congratulations!",
  message = "",
  skipButtonText = "No thanks",
  xpReward = 50,
  icon = "ri-gift-line",
  onShareSuccess = null
}) => {
  if (!isOpen) return null;

  const handleShareSuccess = (data) => {
    if (onShareSuccess) {
      onShareSuccess(data);
    }
    // Auto-close after successful share
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="share-prompt-modal-overlay" onClick={onClose}>
      <div 
        className="share-prompt-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton
          onClick={onClose}
          variant="ghost"
          className="share-prompt-modal__close"
        />

        <div className="share-prompt-modal__content">
          <div className="share-prompt-modal__icon">
            <i className={icon}></i>
          </div>

          <h2 className="share-prompt-modal__title">
            {title}
          </h2>

          <p className="share-prompt-modal__message">
            {message}
          </p>

          <div className="share-prompt-modal__share-section">
            <p className="share-prompt-modal__share-text">
              Share the news and earn an extra {xpReward} XP!
            </p>

            <ShareButton
              shareType={shareType}
              entityId={entityId}
              entityName={entityName}
              variant="success"
              size="large"
              xpReward={xpReward}
              onShareSuccess={handleShareSuccess}
              className="share-prompt-modal__share-button"
            />
          </div>

          <button
            className="share-prompt-modal__skip"
            onClick={onClose}
          >
            {skipButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

SharePromptModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  shareType: PropTypes.oneOf([
    'reward_redemption',
    'raffle_win',
    'raffle_entry'
  ]).isRequired,
  entityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  entityName: PropTypes.string,
  title: PropTypes.string,
  message: PropTypes.string,
  skipButtonText: PropTypes.string,
  xpReward: PropTypes.number,
  icon: PropTypes.string,
  onShareSuccess: PropTypes.func
};

export default SharePromptModal;

