import React, { useState, useEffect } from 'react';
import { authAPI, userProfileAPI, baseURL } from '../../services/apiClient';
import './UserXPBadgeDisplay.css';

const UserXPBadgeDisplay = ({ className = '', showFullDetails = false }) => {
  const [user, setUser] = useState(null);
  const [highestBadge, setHighestBadge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Try to get user from localStorage first for immediate display
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Fetch fresh data
        const [userResponse, badgesResponse] = await Promise.all([
          authAPI.getCurrentUserDetails(),
          userProfileAPI.getMyBadges()
        ]);

        const freshUser = userResponse.data.user;
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));

        const earnedBadges = badgesResponse.data || [];
        if (earnedBadges.length > 0) {
          // Find the badge with the highest xp_threshold (most recent achievement)
          const highest = earnedBadges.reduce((prev, current) => 
            (prev.badge.xp_threshold > current.badge.xp_threshold) ? prev : current
          );
          setHighestBadge(highest);
        }
      } catch (error) {
        console.error('Error fetching user XP/badge data:', error);
        // Still show stored user data even if fetch fails
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const getFullImageUrl = (relativeOrAbsoluteUrl) => {
    if (!relativeOrAbsoluteUrl) return null;
    return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${baseURL}${relativeOrAbsoluteUrl}`;
  };

  if (loading) {
    return (
      <div className={`user-xp-badge-display loading ${className}`}>
        <div className="loading-skeleton">
          <div className="skeleton-badge"></div>
          <div className="skeleton-content">
            <div className="skeleton-line short"></div>
            <div className="skeleton-line long"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`user-xp-badge-display ${className}`}>
      <div className="xp-badge-container">
        {/* Badge Display */}
        {highestBadge && (
          <div className="badge-section">
            <img 
              src={getFullImageUrl(highestBadge.badge.image_url)} 
              alt={highestBadge.badge.name}
              className="user-badge-icon"
              title={`${highestBadge.badge.name} - ${highestBadge.badge.description || 'Achievement unlocked!'}`}
            />
            {showFullDetails && (
              <div className="badge-details">
                <span className="badge-name">{highestBadge.badge.name}</span>
                <span className="badge-threshold">{highestBadge.badge.xp_threshold} XP</span>
              </div>
            )}
          </div>
        )}

        {/* XP Display */}
        <div className="xp-section">
          <div className="xp-display">
            <span className="xp-amount">{(user.xp_balance || 0).toLocaleString()}</span>
            <span className="xp-label">XP</span>
          </div>
          {showFullDetails && (
            <div className="xp-details">
              <div className="total-xp">
                <i className="ri-trophy-line"></i>
                <span>{(user.total_xp_earned || 0).toLocaleString()} Total XP</span>
              </div>
              <div className="surveys-completed">
                <i className="ri-questionnaire-line"></i>
                <span>{user.surveys_completed_count || 0} Surveys</span>
              </div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="user-info-section">
          <div className="user-greeting">
            <span className="greeting-text">Hi, {user.username || 'User'}!</span>
            {!showFullDetails && (
              <div className="compact-stats">
                <span className="stat-item">
                  <i className="ri-shield-star-line"></i>
                  {user.surveys_completed_count || 0}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserXPBadgeDisplay; 