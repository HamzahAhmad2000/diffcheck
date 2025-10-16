import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { referralAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import '../../styles/userStyles.css';
import '../../styles/UserReferrals.css';

const UserReferrals = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [referralHistory, setReferralHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchReferralData = async () => {
      setLoading(true);
      try {
        // Fetch referral link, stats, and history in parallel
        const [linkResponse, statsResponse, historyResponse] = await Promise.all([
          referralAPI.getUserReferralLink(),
          referralAPI.getReferralStats(),
          referralAPI.getUserReferrals({ page: 1, per_page: 20 })
        ]);

        setReferralLink(linkResponse.data.data);
        setReferralStats(statsResponse.data.data);
        setReferralHistory(historyResponse.data.data.referrals || []);
        
      } catch (error) {
        console.error('Error fetching referral data:', error);
        const errorMessage = error.response?.data?.error || 'Failed to load referral data';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();

    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleBack = () => {
    navigate('/user/profile');
  };

  const handleCopyLink = async () => {
    if (!referralLink?.link) return;
    
    try {
      await navigator.clipboard.writeText(referralLink.link);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralLink.link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Eclipseer with my referral link!',
        text: 'Sign up for Eclipseer using my referral link and we both get bonus XP!',
        url: referralLink.link
      }).catch(console.error);
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="app-layout">
        <main className="main-content12" style={{ marginLeft: '100px' }}>
          <div className="page-inner-container">
            <div className="user-loading-indicator">
              <div className="user-loading-spinner"></div>
              <p>Loading Referral Data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <main className="main-content12" style={{ marginLeft: '100px' }}>
        <div className="page-inner-container">
          {isMobile && (
            <div className="surveys-subheader">
              <button
                className="page-header__back-button page-header__back-button--primary"
                onClick={handleBack}
              >
                <i className="ri-arrow-left-s-line"></i> Back
              </button>
            </div>
          )}
          
          <header className="page-header dark-theme">
            <h1 className="page-header__title">My Referrals</h1>
            <p className="page-header__subtitle">
              Share your referral link and earn XP when friends join Eclipseer!
            </p>
          </header>

          {/* Tab Navigation */}
          <div className="referral-tabs">
            <button
              className={`referral-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="ri-dashboard-3-line"></i>
              Overview
            </button>
            <button
              className={`referral-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <i className="ri-history-line"></i>
              History
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="referral-overview">
              {/* Stats Cards */}
              <div className="referral-stats-grid">
                <div className="referral-stat-card">
                  <div className="stat-icon">
                    <i className="ri-user-add-line"></i>
                  </div>
                  <div className="stat-content">
                    <h3>{referralStats?.total_referrals || 0}</h3>
                    <p>Total Referrals</p>
                  </div>
                </div>

                <div className="referral-stat-card">
                  <div className="stat-icon">
                    <i className="ri-copper-coin-line"></i>
                  </div>
                  <div className="stat-content">
                    <h3>{(referralStats?.total_xp_earned || 0).toLocaleString()}</h3>
                    <p>XP Earned</p>
                  </div>
                </div>

                <div className="referral-stat-card">
                  <div className="stat-icon">
                    <i className="ri-calendar-line"></i>
                  </div>
                  <div className="stat-content">
                    <h3>{referralStats?.referrals_this_month || 0}</h3>
                    <p>This Month</p>
                  </div>
                </div>

                <div className="referral-stat-card">
                  <div className="stat-icon">
                    <i className="ri-bar-chart-line"></i>
                  </div>
                  <div className="stat-content">
                    <h3>{(referralStats?.remaining_cap || 0).toLocaleString()}</h3>
                    <p>XP Cap Remaining</p>
                  </div>
                </div>
              </div>

              {/* Referral Link Section */}
              <div className="referral-link-section">
                <h2>Your Referral Link</h2>
                <p className="referral-description">
                  Share this link with friends to earn <strong>{referralStats?.user_reward_xp || 50} XP</strong> for each successful signup!
                  New users get <strong>{referralStats?.user_reward_xp || 50} XP</strong> bonus too.
                </p>
                
                <div className="referral-link-container">
                  <div className="referral-link-input">
                    <input
                      type="text"
                      value={referralLink?.link || ''}
                      readOnly
                      className="link-input"
                      placeholder="Loading..."
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`copy-button ${copied ? 'copied' : ''}`}
                      disabled={!referralLink?.link}
                    >
                      {copied ? (
                        <>
                          <i className="ri-check-line"></i> Copied!
                        </>
                      ) : (
                        <>
                          <i className="ri-file-copy-line"></i> Copy
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="share-buttons">
                    <button onClick={handleShareLink} className="share-button">
                      <i className="ri-share-line"></i>
                      Share
                    </button>
                  </div>
                </div>

                {referralStats?.is_capped && (
                  <div className="referral-cap-warning">
                    <i className="ri-alert-line"></i>
                    You've reached your XP earning cap ({(referralStats.user_xp_cap || 0).toLocaleString()} XP). 
                    New users will still get bonus XP when they sign up!
                  </div>
                )}
              </div>

              {/* Quick Tips */}
              <div className="referral-tips">
                <h3>💡 How to Maximize Your Referrals</h3>
                <ul>
                  <li>Share your link on social media platforms</li>
                  <li>Send it directly to friends via messaging apps</li>
                  <li>Include it in your email signature</li>
                  <li>Post in relevant online communities (respectfully)</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="referral-history">
              <h2>Referral History</h2>
              
              {referralHistory.length > 0 ? (
                <div className="referral-table-container">
                  <table className="referral-table">
                    <thead>
                      <tr>
                        <th>Friend</th>
                        <th>Date Joined</th>
                        <th>XP Earned</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralHistory.map((referral) => (
                        <tr key={referral.id}>
                          <td>
                            <div className="referred-user">
                              <div className="user-avatar">
                                {referral.referred_user?.name ? 
                                  referral.referred_user.name[0].toUpperCase() : 
                                  'U'
                                }
                              </div>
                              <div className="user-info">
                                <span className="user-name">
                                  {referral.referred_user?.name || 'User'}
                                </span>
                                <span className="user-email">
                                  {referral.referred_user?.email || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{formatDate(referral.created_at)}</td>
                          <td>
                            <span className="xp-earned">
                              +{referral.xp_awarded_to_referrer || 0} XP
                            </span>
                          </td>
                          <td>
                            <span className="status-badge success">
                              <i className="ri-check-line"></i>
                              Confirmed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <i className="ri-user-add-line"></i>
                  </div>
                  <h3>No referrals yet</h3>
                  <p>Start sharing your referral link to see your friend referrals here!</p>
                  <button 
                    onClick={() => setActiveTab('overview')}
                    className="get-started-button"
                  >
                    Get Your Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserReferrals;





