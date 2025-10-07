import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ShareButton from './ShareButton';
import { shareAPI } from '../../../services/apiClient';

/**
 * BadgeShareIntegration - Example component showing how to add share buttons to badges
 * This can be integrated into existing badge display components
 */
const BadgeShareIntegration = ({ badge, onShareSuccess = null }) => {
  const [hasShared, setHasShared] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkShareStatus();
  }, [badge.id]);

  const checkShareStatus = async () => {
    try {
      const response = await shareAPI.getShareEligibility();
      
      if (response.data && response.data.badge_share) {
        const badgeShare = response.data.badge_share;
        
        // Check if this specific badge has been shared
        const sharedBadgeIds = badgeShare.shared_badge_ids || [];
        setHasShared(sharedBadgeIds.includes(badge.id));
      }
    } catch (error) {
      console.error('Error checking badge share status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleShareSuccess = (data) => {
    setHasShared(true);
    if (onShareSuccess) {
      onShareSuccess(data);
    }
  };

  if (checking) {
    return null; // Or a small loader
  }

  return (
    <div className="badge-share-integration">
      <ShareButton
        shareType="badge_share"
        entityId={badge.id}
        entityName={badge.name}
        variant="primary"
        size="medium"
        hasShared={hasShared}
        xpReward={50}
        onShareSuccess={handleShareSuccess}
      />
    </div>
  );
};

BadgeShareIntegration.propTypes = {
  badge: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired
  }).isRequired,
  onShareSuccess: PropTypes.func
};

export default BadgeShareIntegration;

