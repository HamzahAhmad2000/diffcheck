import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfileAPI, baseURL, shareAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import ShareButton from './share/ShareButton';
import './UserBadges.css';
import '../../styles/userStyles.css';

const UserBadges = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('earned'); // 'earned' or 'upcoming'
  const [sharedBadges, setSharedBadges] = useState(new Set());

  useEffect(() => {
    fetchBadgeOverview();
    checkSharedBadges();
    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchBadgeOverview = async () => {
    try {
      setLoading(true);
      const response = await userProfileAPI.getBadgeOverview();
      console.log('[BADGE_DEBUG] Badge overview response:', response.data);
      console.log('[BADGE_DEBUG] Upcoming badges structure:', response.data?.upcoming_badges);
      setBadgeData(response.data);
    } catch (error) {
      console.error('Error fetching badge overview:', error);
      toast.error('Failed to load badge information');
    } finally {
      setLoading(false);
    }
  };

  const checkSharedBadges = async () => {
    try {
      const response = await shareAPI.getAvailableBadgeShares();
      if (response.data?.available_badges) {
        // Create a set of badge IDs that have already been shared
        const sharedIds = new Set();
        response.data.available_badges.forEach(badge => {
          if (badge.already_shared) {
            sharedIds.add(badge.badge_id);
          }
        });
        setSharedBadges(sharedIds);
      }
    } catch (error) {
      console.error('Error checking shared badges:', error);
    }
  };

  const handleBadgeShareSuccess = (badgeId, shareData) => {
    // Mark badge as shared
    setSharedBadges(prev => new Set([...prev, badgeId]));
    
    // Update user's XP balance in localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && shareData.xp_awarded) {
      userData.xp_balance = (userData.xp_balance || 0) + shareData.xp_awarded;
      localStorage.setItem('user', JSON.stringify(userData));
      window.dispatchEvent(new CustomEvent('userUpdated'));
      window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: shareData.xp_awarded } }));
    }
  };

  const handleClaimBadges = async () => {
    try {
      setLoading(true);
      const res = await userProfileAPI.claimBadges();
      if (res.data && res.data.new_badges && res.data.new_badges.length > 0) {
        toast.success(`🎉 You claimed ${res.data.new_badges.length} badge${res.data.new_badges.length > 1 ? 's' : ''}!`);
      } else {
        toast('No new badges to claim right now.');
      }
      await fetchBadgeOverview(); // Refresh state
    } catch (err) {
      console.error('Error claiming badges:', err);
      toast.error(err.response?.data?.error || 'Failed to claim badges');
    } finally {
      setLoading(false);
    }
  };

  const getFullImageUrl = (relativeOrAbsoluteUrl) => {
    if (!relativeOrAbsoluteUrl) {
      // Return a default SVG badge image as data URL
      return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNGRkQ3MDAiLz4KPHN0YXIgY3g9IjQwIiBjeT0iNDAiIHI9IjIwIiBmaWxsPSIjRkZGRkZGIi8+Cjx0ZXh0IHg9IjQwIiB5PSI0NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn4+FPC90ZXh0Pgo8L3N2Zz4K";
    }
    // Handle full URLs
    if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
      return relativeOrAbsoluteUrl;
    }
    // Handle relative URLs - ensure they start with /
    const cleanPath = relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
    return `${baseURL}${cleanPath}`;
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatJoinDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="main-content12">
        <div className="user-loading-indicator">
          <div className="user-loading-spinner"></div>
          <p>Loading your achievements...</p>
        </div>
      </div>
    );
  }

  if (!badgeData) {
    return (
      <div className="main-content12">
        <div className="user-error-message">
          <p>Unable to load badge information</p>
          <button onClick={fetchBadgeOverview} className="button button--primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleBackToProfile = () => {
    navigate('/user/profile');
  };

  const { earned_badges, upcoming_badges, user_stats, total_badges_available, total_badges_earned } = badgeData;

  return (
    <div className="main-content12">
      <div className="page-inner-container">
        {/* Back button - only for mobile */}
        {isMobile && (
          <div className="surveys-subheader">
            <button
              className="page-header__back-button page-header__back-button--primary"
              onClick={handleBackToProfile}
            >
              <i className="ri-arrow-left-s-line"></i> Back
            </button>
          </div>
        )}

        <div className="user-badges-container">
          {/* Header Section with XP and Current Badge */}
          <div className="badges-header">
            <div className="xp-summary-section">
              <div className="xp-display-main">
                <div className="xp-current">
                  <div className="xp-coin-icon">
                    <i className="ri-copper-coin-line"></i>
                  </div>
                  <div className="xp-amounts">
                    <div className="current-xp">
                      <span className="xp-number">{(user_stats.xp_balance || 0).toLocaleString()}</span>
                      <span className="xp-label">Current XP Balance</span>
                    </div>
                    <div className="lifetime-xp">
                      <span className="xp-number">{(user_stats.total_xp_earned || 0).toLocaleString()}</span>
                      <span className="xp-label">Lifetime XP Earnings</span>
                    </div>
                  </div>
                </div>
                
                {/* Current Badge Display */}
                {earned_badges.length > 0 && (() => {
                  const highestBadge = earned_badges.reduce((prev, current) => 
                    (prev.badge.xp_threshold > current.badge.xp_threshold) ? prev : current
                  );
                  return (
                    <div className="current-badge-display">
                      <div className="current-badge-title">Current Badge</div>
                      <div className="current-badge-card">
                        <img 
                          src={getFullImageUrl(highestBadge.badge.image_url)} 
                          alt={highestBadge.badge.name}
                          className="current-badge-image"
                          onError={(e) => { 
                            e.target.src = getFullImageUrl(null);
                          }}
                        />
                        <div className="current-badge-info">
                          <h3 className="current-badge-name">{highestBadge.badge.name}</h3>
                          <p className="current-badge-desc">{highestBadge.badge.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <div className="achievement-summary">
                <div className="summary-grid">
                  <div className="summary-card">
                    <div className="summary-icon">
                      <i className="ri-medal-line"></i>
                    </div>
                    <div className="summary-content">
                      <div className="summary-number">{total_badges_earned}</div>
                      <div className="summary-label">Badges Earned</div>
                    </div>
                  </div>
                  
                  <div className="summary-card">
                    <div className="summary-icon">
                      <i className="ri-trophy-line"></i>
                    </div>
                    <div className="summary-content">
                      <div className="summary-number">
                        {total_badges_available - total_badges_earned}
                      </div>
                      <div className="summary-label">Badges to Unlock</div>
                    </div>
                  </div>
                  
                  <div className="summary-card">
                    <div className="summary-icon">
                      <i className="ri-calendar-line"></i>
                    </div>
                    <div className="summary-content">
                      <div className="summary-number">
                        {user_stats.join_date ? formatJoinDate(user_stats.join_date) : 'N/A'}
                      </div>
                      <div className="summary-label">Member Since</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="encouragement-text">
              <p>Keep completing surveys and activities to earn more badges and increase your XP!</p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="badges-tabs">
            <button 
              className={`tab-button ${activeTab === 'earned' ? 'active' : ''}`}
              onClick={() => setActiveTab('earned')}
            >
              <i className="ri-medal-fill"></i>
              Earned Badges ({total_badges_earned})
            </button>
            <button 
              className={`tab-button ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              <i className="ri-focus-3-line"></i>
              Upcoming Badges ({upcoming_badges.length})
            </button>
            {upcoming_badges.some(b => b.is_achievable) && (
              <button
                className="tab-button claim-button"
                onClick={handleClaimBadges}
              >
                <i className="ri-check-double-line"></i>
                Claim Achievable Badges
              </button>
            )}
          </div>

          {/* Badges Content */}
          <div className="badges-content">
            {activeTab === 'earned' && (
              <div className="earned-badges-section">
                {earned_badges.length > 0 ? (
                  <div className="badges-grid">
                    {earned_badges.map((item, index) => {
                      const isLatestBadge = index === 0; // First badge is the latest
                      const hasShared = sharedBadges.has(item.badge.id);
                      
                      return (
                        <div key={item.badge.id} className={`badge-card earned-badge ${isLatestBadge ? 'latest-badge' : ''}`}>
                          <div className="badge-image-container">
                            <img 
                              src={getFullImageUrl(item.badge.image_url)} 
                              alt={item.badge.name}
                              className="badge-image"
                              onError={(e) => { 
                                e.target.src = getFullImageUrl(null); // Use default badge image on error
                              }}
                            />
                            <div className="earned-overlay">
                              <i className="ri-check-line"></i>
                            </div>
                            {isLatestBadge && !hasShared && (
                              <div className="latest-badge-indicator">
                                <span>Latest</span>
                              </div>
                            )}
                          </div>
                          <div className="badge-info">
                            <h3 className="badge-name">{item.badge.name}</h3>
                            <p className="badge-description">{item.badge.description}</p>
                            <div className="badge-meta">
                              <div className="badge-xp">
                                <i className="ri-flashlight-line"></i>
                                {item.badge.xp_threshold} XP Required
                              </div>
                              <div className="earned-date">
                                <i className="ri-calendar-check-line"></i>
                                Earned {formatDate(item.earned_at)}
                              </div>
                            </div>
                            {isLatestBadge && (
                              <div className="badge-share-section">
                                <ShareButton
                                  shareType="badge_share"
                                  entityId={item.badge.id}
                                  entityName={item.badge.name}
                                  variant="primary"
                                  size="small"
                                  xpReward={50}
                                  hasShared={hasShared}
                                  onShareSuccess={(shareData) => handleBadgeShareSuccess(item.badge.id, shareData)}
                                  className="badge-share-button"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <i className="ri-medal-line"></i>
                    </div>
                    <h3>No Badges Earned Yet</h3>
                    <p>Complete surveys and activities to start earning badges!</p>
                    <button 
                      className="button button--primary"
                      onClick={() => setActiveTab('upcoming')}
                    >
                      View Available Badges
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'upcoming' && (
              <div className="upcoming-badges-section">
                {upcoming_badges.length > 0 ? (
                  <div className="badges-grid">
                    {upcoming_badges.map((badgeItem) => {
                      const currentUserXP = user_stats.total_xp_earned || 0;
                      const badge = badgeItem.badge; // Extract the nested badge object
                      const xpNeeded = badgeItem.xp_needed; // Use backend-calculated XP needed
                      const progressPercentage = badgeItem.progress_percentage; // Use backend-calculated progress
                      const isAchievable = badgeItem.is_achievable || xpNeeded <= 0; // Use backend-calculated achievable status
                      
                      console.log(`[BADGE_DEBUG] Badge: ${badge.name}, Current XP: ${currentUserXP}, Required: ${badge.xp_threshold}, Needed: ${xpNeeded}, Progress: ${progressPercentage}%`);
                      
                      return (
                        <div key={badge.id} className={`badge-card upcoming-badge ${isAchievable ? 'achievable' : ''}`}>
                          <div className="badge-image-container">
                            <img 
                              src={getFullImageUrl(badge.image_url)} 
                              alt={badge.name}
                              className="badge-image"
                              onError={(e) => { 
                                e.target.src = getFullImageUrl(null); // Use default badge image on error
                              }}
                            />
                            {isAchievable && (
                              <div className="achievable-overlay">
                                <i className="ri-flashlight-line"></i>
                              </div>
                            )}
                          </div>
                          <div className="badge-info">
                            <h3 className="badge-name">{badge.name}</h3>
                            <p className="badge-description">{badge.description}</p>
                            <div className="badge-meta">
                              <div className="badge-xp">
                                <i className="ri-flashlight-line"></i>
                                {badge.xp_threshold} XP Required
                              </div>
                              <div className={`xp-needed ${isAchievable ? 'ready-to-claim' : ''}`}>
                                <i className="ri-arrow-up-line"></i>
                                {isAchievable 
                                  ? 'Ready to claim!' 
                                  : `${xpNeeded} XP needed`
                                }
                              </div>
                            </div>
                            <div className="progress-section">
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill" 
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                              <div className="progress-text">
                                <span>{currentUserXP} XP</span>
                                <span>{badge.xp_threshold} XP</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <i className="ri-trophy-line"></i>
                    </div>
                    <h3>All Badges Earned!</h3>
                    <p>Congratulations! You've earned every badge available.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    );
  };

export default UserBadges; 