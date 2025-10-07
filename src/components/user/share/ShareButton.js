import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { shareAPI } from '../../../services/apiClient';
import toast from 'react-hot-toast';
import './ShareButton.css';

/**
 * ShareButton - Reusable button for Share-to-Earn XP functionality
 * Handles X (Twitter) sharing with XP rewards
 */
const ShareButton = ({
  shareType,
  entityId = null,
  entityName = null,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  hasShared = false,
  xpReward = 50,
  onShareSuccess = null,
  className = '',
  ...props
}) => {
  const [isShared, setIsShared] = useState(hasShared);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isShared || isSharing || disabled) return;

    try {
      setIsSharing(true);

      // Generate share URL from backend
      const response = await shareAPI.generateShareUrl({
        share_type: shareType,
        entity_id: entityId,
        entity_name: entityName
      });

      if (!response.data || !response.data.share_url) {
        throw new Error('Failed to generate share URL');
      }

      // Open Twitter in new window
      const twitterWindow = window.open(
        response.data.share_url,
        '_blank',
        'width=550,height=420'
      );

      // Wait a moment, then confirm the share
      setTimeout(async () => {
        try {
          // Confirm share and award XP
          const confirmResponse = await shareAPI.confirmShare({
            share_type: shareType,
            entity_id: entityId,
            entity_name: entityName
          });

          if (confirmResponse.data && confirmResponse.data.xp_awarded) {
            setIsShared(true);
            toast.success(`+${confirmResponse.data.xp_awarded} XP for sharing!`, {
              icon: '🎉',
              duration: 4000
            });

            if (onShareSuccess) {
              onShareSuccess(confirmResponse.data);
            }
          }
        } catch (confirmError) {
          console.error('Error confirming share:', confirmError);
          toast.error(confirmError.response?.data?.error || 'Failed to award XP. Please try again.');
        }
      }, 1500);

    } catch (error) {
      console.error('Error sharing:', error);
      toast.error(error.response?.data?.error || 'Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const getButtonText = () => {
    if (isShared) return 'Shared ✔️';
    if (isSharing) return 'Opening...';
    return `Share to X`;
  };

  const getButtonClass = () => {
    let classes = `share-button share-button--${variant} share-button--${size}`;
    if (isShared) classes += ' share-button--shared';
    if (isSharing) classes += ' share-button--loading';
    if (disabled) classes += ' share-button--disabled';
    if (className) classes += ` ${className}`;
    return classes;
  };

  return (
    <button
      className={getButtonClass()}
      onClick={handleShare}
      disabled={disabled || isShared || isSharing}
      type="button"
      {...props}
    >
      <i className="ri-twitter-x-line share-button__icon"></i>
      <span className="share-button__text">{getButtonText()}</span>
      {!isShared && !isSharing && xpReward && (
        <span className="share-button__xp">+{xpReward} XP</span>
      )}
    </button>
  );
};

ShareButton.propTypes = {
  shareType: PropTypes.oneOf([
    'join_share',
    'badge_share',
    'reward_redemption',
    'raffle_win',
    'raffle_entry'
  ]).isRequired,
  entityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  entityName: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'minimal']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  hasShared: PropTypes.bool,
  xpReward: PropTypes.number,
  onShareSuccess: PropTypes.func,
  className: PropTypes.string
};

export default ShareButton;

