import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dailyRewardAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './DailyRewards.css';
import '../../styles/userStyles.css';

const DailyRewards = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const [calendarState, setCalendarState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [revealedReward, setRevealedReward] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryDate, setRecoveryDate] = useState(null);

  useEffect(() => {
    fetchCalendarState();
    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchCalendarState = async () => {
    try {
      setLoading(true);
      console.log('[DAILY_REWARDS] Fetching calendar state...');
      const response = await dailyRewardAPI.getDailyRewardState();
      console.log('[DAILY_REWARDS] Calendar state response:', response.data);
      setCalendarState(response.data);
    } catch (error) {
      console.error('[DAILY_REWARDS] Error fetching calendar state:', error);
      console.error('[DAILY_REWARDS] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Show specific error message based on error type
      if (error.response?.status === 404) {
        toast.error('Daily rewards system not configured. Please contact administrator.');
      } else if (error.response?.status === 500) {
        toast.error('Server error loading daily rewards. Please try again later.');
      } else if (error.message.includes('Network Error')) {
        toast.error('Cannot connect to server. Please check your internet connection.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to load daily rewards calendar');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (targetDate = null) => {
    if (claiming) return;
    
    try {
      setClaiming(true);
      const response = await dailyRewardAPI.claimDailyReward(targetDate);
      
      if (response.data.success) {
        setRevealedReward(response.data);
        setShowRewardModal(true);
        
        // Show success message based on reward type
        const reward = response.data.revealed_reward;
        if (reward.type === 'XP') {
          toast.success(`🎉 You earned ${reward.xp_amount} XP!`);
        } else if (reward.type === 'RAFFLE_ENTRY' && reward.raffle_item) {
          toast.success(`🎫 You got a raffle entry for ${reward.raffle_item.title}!`);
        }
        
        // Check for week completion bonus
        if (response.data.week_completion_bonus) {
          const bonus = response.data.week_completion_bonus;
          if (bonus.type === 'XP') {
            toast.success(`🏆 Week completed! Bonus: ${bonus.xp_amount} XP!`, {
              duration: 5000,
              style: {
                background: '#FFD700',
                color: '#000'
              }
            });
          }
        }
        
        // Refresh calendar state
        await fetchCalendarState();
      }
    } catch (error) {
      console.error('Error claiming daily reward:', error);
      toast.error(error.response?.data?.error || 'Failed to claim reward');
    } finally {
      setClaiming(false);
      setShowRecoveryModal(false);
    }
  };

  const handleRecoveryClick = (date) => {
    setRecoveryDate(date);
    setShowRecoveryModal(true);
  };

  const confirmRecovery = () => {
    handleClaimReward(recoveryDate);
  };

  const getDayName = (dayNumber) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber - 1];
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSlotIcon = (slot) => {
    switch (slot.status) {
      case 'CLAIMED':
        return 'ri-check-double-line';
      case 'CLAIMABLE':
        return 'ri-gift-line';
      case 'MISSED':
        return 'ri-time-line';
      case 'FUTURE':
        return 'ri-lock-line';
      default:
        return 'ri-question-line';
    }
  };

  const getSlotColor = (slot) => {
    switch (slot.status) {
      case 'CLAIMED':
        return '#4CAF50'; // Green
      case 'CLAIMABLE':
        return '#FFD700'; // Gold
      case 'MISSED':
        return '#FF6B6B'; // Red
      case 'FUTURE':
        return '#666'; // Gray
      default:
        return '#999';
    }
  };

  if (loading) {
    return (
      <div className="main-content12">
        <div className="page-inner-container">
          <div className="user-loading-indicator">
            <div className="user-loading-spinner"></div>
            <p>Loading your daily rewards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!calendarState) {
    return (
      <div className="main-content12">
        <div className="page-inner-container">
          <div className="daily-rewards-container">
            <div className="daily-rewards-header">
              <div className="header-content">
                <div className="header-left">
                  <h1 className="page-title">
                    <i className="ri-calendar-check-line"></i>
                    Daily Rewards
                  </h1>
                  <p className="page-subtitle">
                    Daily login calendar system
                  </p>
                </div>
              </div>
            </div>

            <div className="error-state-container">
              <div className="error-icon">
                <i className="ri-error-warning-line"></i>
              </div>
              <h3>Daily Rewards Not Available</h3>
              <p>The daily rewards system is not currently configured or available.</p>

              <div className="error-actions">
                <button onClick={fetchCalendarState} className="button button--primary">
                  <i className="ri-refresh-line"></i>
                  Try Again
                </button>
              </div>

              <div className="setup-info">
                <h4>For Administrators:</h4>
                <p>To enable the daily rewards system, please:</p>
                <ol>
                  <li>Ensure the backend daily reward routes are registered</li>
                  <li>Run the database setup script for daily rewards</li>
                  <li>Create initial week configurations</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { streak_info, calendar_slots, week_info, user_xp_balance } = calendarState;
  const todaySlot = calendar_slots.find(slot => slot.status === 'CLAIMABLE');

  return (
    <div className="main-content12">
      <div className="page-inner-container">
        <div className="daily-rewards-container">
        
        {/* Header Section with Streak Info */}
        <div className="daily-rewards-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="page-title">
                <i className="ri-calendar-check-line"></i>
                Daily Rewards
              </h1>
              <p className="page-subtitle">
                Claim your daily surprise rewards and build your streak!
              </p>
            </div>
            
            <div className="streak-display">
              <div className="streak-counter">
                <div className="streak-icon">
                  <i className="ri-fire-line"></i>
                </div>
                <div className="streak-info">
                  <span className="streak-number">{streak_info.current_streak}</span>
                  <span className="streak-label">Day Streak</span>
                </div>
              </div>
              
              <div className="streak-stats">
                <div className="stat-item">
                  <span className="stat-value">{streak_info.longest_streak}</span>
                  <span className="stat-label">Best</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{streak_info.freezes_left}</span>
                  <span className="stat-label">Freezes</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* XP Balance Display */}
          <div className="xp-balance-display">
            <div className="xp-coin-icon">
              <i className="ri-copper-coin-line"></i>
            </div>
            <span className="xp-amount">{user_xp_balance.toLocaleString()}</span>
            <span className="xp-label">XP</span>
          </div>
        </div>

        {/* Main Calendar Section */}
        <div className="calendar-section">
          <div className="calendar-header">
            <h2>This Week's Rewards</h2>
            <div className="week-progress">
              <span>Week: {formatDate(week_info.start_date)} - {formatDate(new Date(new Date(week_info.start_date).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString())}</span>
              {week_info.all_days_claimed && (
                <div className="week-completed">
                  <i className="ri-trophy-line"></i>
                  Week Completed!
                </div>
              )}
            </div>
          </div>
          
          <div className="calendar-grid">
            {calendar_slots.map((slot) => (
              <div
                key={slot.day}
                className={`calendar-slot ${slot.status.toLowerCase()}`}
                style={{ '--slot-color': getSlotColor(slot) }}
              >
                <div className="slot-header">
                  <span className="day-name">{getDayName(slot.day)}</span>
                  <span className="day-date">{formatDate(slot.date)}</span>
                </div>
                
                <div className="slot-content">
                  <div className="slot-icon-container">
                    <i className={getSlotIcon(slot)} style={{ color: getSlotColor(slot) }}></i>
                  </div>
                  
                  {slot.status === 'CLAIMED' && slot.reward && (
                    <div className="revealed-reward">
                      {slot.reward.type === 'XP' && (
                        <div className="reward-xp">
                          <i className="ri-copper-coin-line"></i>
                          <span>{slot.reward.xp_amount} XP</span>
                        </div>
                      )}
                      {slot.reward.type === 'RAFFLE_ENTRY' && (
                        <div className="reward-raffle">
                          <i className="ri-ticket-line"></i>
                          <span>Raffle Entry</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {slot.status === 'CLAIMABLE' && (
                    <button 
                      className="claim-button"
                      onClick={() => handleClaimReward()}
                      disabled={claiming}
                    >
                      {claiming ? (
                        <div className="button-spinner"></div>
                      ) : (
                        <>
                          <i className="ri-gift-line"></i>
                          Claim Reward
                        </>
                      )}
                    </button>
                  )}
                  
                  {slot.status === 'MISSED' && (
                    <div className="missed-content">
                      <span className="missed-text">Missed</span>
                      {slot.can_recover ? (
                        <button 
                          className="recovery-button"
                          onClick={() => handleRecoveryClick(slot.date)}
                          disabled={claiming}
                        >
                          <i className="ri-refresh-line"></i>
                          Recover ({week_info.recovery_xp_cost} XP)
                        </button>
                      ) : (
                        <div className="recovery-unavailable">
                          <i className="ri-lock-line"></i>
                          <span className="recovery-unavailable-text">Cannot recover</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {slot.status === 'FUTURE' && (
                    <div className="future-content">
                      <i className="ri-lock-line"></i>
                      <span>Locked</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Information Section */}
        <div className="info-section">
          <div className="info-cards">
            <div className="info-card">
              <div className="info-icon">
                <i className="ri-question-line"></i>
              </div>
              <h3>How it Works</h3>
              <ul>
                <li>Visit daily to claim surprise rewards</li>
                <li>Rewards are hidden until you claim them</li>
                <li>Build streaks for better rewards</li>
                <li>Get 2 freeze protections per week</li>
              </ul>
            </div>
            
            <div className="info-card">
              <div className="info-icon">
                <i className="ri-refresh-line"></i>
              </div>
              <h3>Recovery System</h3>
              <ul>
                <li>Missed a day? Spend {week_info.recovery_xp_cost} XP to recover</li>
                <li>Can only recover days within your current streak</li>
                <li>Recovery maintains your streak continuity</li>
                <li>Requires sufficient XP balance</li>
              </ul>
            </div>
            
            <div className="info-card">
              <div className="info-icon">
                <i className="ri-trophy-line"></i>
              </div>
              <h3>Week Completion</h3>
              <ul>
                <li>Complete all 7 days for bonus rewards</li>
                <li>Calendar resets every Monday</li>
                <li>Your streak continues across weeks</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Reward Reveal Modal */}
      {showRewardModal && revealedReward && (
        <div className="modal-overlay" onClick={() => setShowRewardModal(false)}>
          <div className="reward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-gift-line"></i>Reward Claimed!</h3>
              <button 
                className="modal-close"
                onClick={() => setShowRewardModal(false)}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="reward-animation">
                {revealedReward.revealed_reward.type === 'XP' && (
                  <div className="xp-reward-display">
                    <div className="xp-coin-large">
                      <i className="ri-copper-coin-line"></i>
                    </div>
                    <div className="xp-amount-large">
                      +{revealedReward.revealed_reward.xp_amount} XP
                    </div>
                  </div>
                )}
                
                {revealedReward.revealed_reward.type === 'RAFFLE_ENTRY' && (
                  <div className="raffle-reward-display">
                    <div className="raffle-ticket-large">
                      <i className="ri-ticket-line"></i>
                    </div>
                    <div className="raffle-text">
                      <h4>Raffle Entry Earned!</h4>
                      {revealedReward.revealed_reward.raffle_item && (
                        <p>{revealedReward.revealed_reward.raffle_item.title}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="streak-update">
                <div className="streak-info-modal">
                  <i className="ri-fire-line"></i>
                  <span>Streak: {revealedReward.new_streak} days</span>
                </div>
                <div className="xp-balance-modal">
                  <i className="ri-copper-coin-line"></i>
                  <span>Balance: {revealedReward.new_xp_balance.toLocaleString()} XP</span>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="button button--primary"
                onClick={() => setShowRewardModal(false)}
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Confirmation Modal */}
      {showRecoveryModal && (
        <div className="modal-overlay" onClick={() => setShowRecoveryModal(false)}>
          <div className="recovery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Recover Missed Day</h3>
              <button 
                className="modal-close"
                onClick={() => setShowRecoveryModal(false)}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <p>
                Spend <strong>{week_info.recovery_xp_cost} XP</strong> to claim the reward for {formatDate(recoveryDate)}?
              </p>
              <p className="recovery-note">
                This will reveal the surprise reward and maintain your streak.
              </p>
              <div className="xp-check">
                <span>Your XP: {user_xp_balance.toLocaleString()}</span>
                <span>After recovery: {(user_xp_balance - week_info.recovery_xp_cost).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="button button--secondary"
                onClick={() => setShowRecoveryModal(false)}
              >
                Cancel
              </button>
              <button 
                className="button button--primary"
                onClick={confirmRecovery}
                disabled={claiming || user_xp_balance < week_info.recovery_xp_cost}
              >
                {claiming ? 'Processing...' : `Spend ${week_info.recovery_xp_cost} XP`}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DailyRewards;



