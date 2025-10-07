import React, { useState, useEffect } from 'react';
import { shareAPI } from '../../../services/apiClient';
import ShareButton from './ShareButton';
import toast from 'react-hot-toast';
import './HomeShareBanner.css';

/**
 * HomeShareBanner - Welcome share prompt for new users
 * Displays for users within configured time window (default 72 hours)
 */
const HomeShareBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    try {
      const response = await shareAPI.getShareEligibility();
      
      if (response.data && response.data.join_share) {
        const joinShare = response.data.join_share;
        
        // Show banner if user is eligible and hasn't shared yet
        if (joinShare.eligible && !joinShare.has_shared) {
          setIsVisible(true);
          setEligibility(joinShare);
        }
      }
    } catch (error) {
      console.error('Error checking share eligibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in session storage so it doesn't reappear this session
    sessionStorage.setItem('homeShareBannerDismissed', 'true');
  };

  const handleShareSuccess = (data) => {
    setIsVisible(false);
    // Refresh user XP display
    window.dispatchEvent(new CustomEvent('xp-updated', { detail: data }));
  };

  // Don't render if loading or not visible
  if (loading || !isVisible) {
    return null;
  }

  // Check if dismissed this session
  if (sessionStorage.getItem('homeShareBannerDismissed') === 'true') {
    return null;
  }

  return (
    <div className="home-share-banner">
      <button 
        className="home-share-banner__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
      >
        <i className="ri-close-line"></i>
      </button>

      <div className="home-share-banner__content">
        <div className="home-share-banner__icon">
          <i className="ri-gift-line"></i>
        </div>

        <div className="home-share-banner__text">
          <h3 className="home-share-banner__title">
            Welcome to Eclipseer! Get a head start.
          </h3>
          <p className="home-share-banner__description">
            Share your journey with your friends on X and earn an instant {eligibility?.xp_reward || 500} XP.
          </p>
          {eligibility?.time_remaining && (
            <p className="home-share-banner__timer">
              <i className="ri-time-line"></i> 
              Offer expires in {eligibility.time_remaining}
            </p>
          )}
        </div>

        <div className="home-share-banner__action">
          <ShareButton
            shareType="join_share"
            variant="success"
            size="large"
            xpReward={eligibility?.xp_reward || 500}
            onShareSuccess={handleShareSuccess}
          />
        </div>
      </div>

      <div className="home-share-banner__decoration"></div>
    </div>
  );
};

export default HomeShareBanner;

