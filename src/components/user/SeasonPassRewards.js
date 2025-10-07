import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { seasonPassAPI } from '../../services/apiClient';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';

const SeasonPassRewards = () => {
    const navigate = useNavigate();
    const [seasonData, setSeasonData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [claimingReward, setClaimingReward] = useState(null);

    useEffect(() => {
        fetchSeasonData();
    }, []);

    const fetchSeasonData = async () => {
        try {
            setLoading(true);
            const response = await seasonPassAPI.getState();
            setSeasonData(response.data?.data || null);
        } catch (error) {
            console.error('Error fetching season data:', error);
            if (error.response?.status === 401) {
                toast.error('Please log in to view Season Pass rewards');
                navigate('/auth/login');
            } else {
                toast.error('Failed to load Season Pass data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClaimReward = async (rewardId) => {
        try {
            setClaimingReward(rewardId);
            const response = await seasonPassAPI.claimReward(rewardId);
            
            if (response.data?.success) {
                toast.success('Reward claimed successfully!');
                
                // Refresh data to update claim status
                await fetchSeasonData();
                
                // If it's an XP reward, trigger XP gained event
                const rewardResult = response.data?.data?.reward_result;
                if (rewardResult?.xp_awarded) {
                    window.dispatchEvent(new CustomEvent('xpGained', { 
                        detail: { amount: rewardResult.xp_awarded } 
                    }));
                    
                    // Update localStorage user balance
                    const userData = JSON.parse(localStorage.getItem('user') || '{}');
                    if (userData) {
                        userData.xp_balance = (userData.xp_balance || 0) + rewardResult.xp_awarded;
                        localStorage.setItem('user', JSON.stringify(userData));
                        window.dispatchEvent(new CustomEvent('userUpdated'));
                    }
                }
            }
        } catch (error) {
            console.error('Error claiming reward:', error);
            toast.error(error.response?.data?.error || 'Failed to claim reward');
        } finally {
            setClaimingReward(null);
        }
    };

    const getRewardIcon = (rewardType) => {
        switch (rewardType) {
            case 'XP': return '✨';
            case 'BADGE': return '🏆';
            case 'RAFFLE_ENTRY': return '🎁';
            case 'MARKETPLACE_ITEM': return '🛍️';
            case 'CUSTOM': return '🎯';
            default: return '❓';
        }
    };

    const getRewardDescription = (reward) => {
        switch (reward.reward_type) {
            case 'XP':
                return `${reward.xp_amount} XP`;
            case 'BADGE':
                return reward.badge?.name || 'Special Badge';
            case 'RAFFLE_ENTRY':
                return `Raffle Entry: ${reward.marketplace_item?.title || 'Premium Item'}`;
            case 'MARKETPLACE_ITEM':
                return reward.marketplace_item?.title || 'Premium Item';
            case 'CUSTOM':
                return reward.display_name || 'Custom Reward';
            default:
                return reward.display_name || 'Unknown Reward';
        }
    };

    const formatCountdown = (countdown) => {
        if (!countdown) return null;
        const { days, hours, minutes } = countdown;
        return `${days}d ${hours}h ${minutes}m`;
    };

    if (loading) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="loading-container">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Season Pass...</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!seasonData) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="empty-state">
                            <i className="ri-error-warning-line empty-state__icon"></i>
                            <h3 className="empty-state__title">Season Pass Data Unavailable</h3>
                            <p className="empty-state__message">
                                Unable to load Season Pass information. Please try again later.
                            </p>
                            <button 
                                className="button button--primary"
                                onClick={() => navigate('/user/home')}
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const { season_info, user_progress, user_pass, levels } = seasonData;
    const hasPass = !!user_pass;
    const passType = user_pass?.tier_type;

    return (
        <div className="app-layout">
            <main className="main-content12 full-height">
                <div className="page-inner-container">
                    <div className="rewards-header">
                        <button 
                            className="back-button"
                            onClick={() => navigate('/user/home')}
                        >
                            <i className="ri-arrow-left-line"></i>
                            Back to Home
                        </button>
                        
                        <div className="header-content">
                            <h1 className="page-title">
                                <i className="ri-gift-line" style={{ color: 'var(--color-primary)' }}></i>
                                Season Pass Rewards
                            </h1>
                            <p className="page-subtitle">
                                {season_info?.name || 'Current Season'}
                            </p>
                        </div>
                    </div>

                    {/* Season Overview */}
                    <div className="sp-rewards-overview-1">
                        <div className="sp-rewards-stats-grid-1">
                            <div className="sp-rewards-stat-card-1">
                                <div className="sp-rewards-stat-icon-1">
                                    <i className="ri-trophy-line"></i>
                                </div>
                                <div className="sp-rewards-stat-info-1">
                                    <span className="sp-rewards-stat-value-1">{user_progress?.current_level || 0}</span>
                                    <span className="sp-rewards-stat-label-1">Current Level</span>
                                </div>
                            </div>
                            
                            <div className="sp-rewards-stat-card-1">
                                <div className="sp-rewards-stat-icon-1">
                                    <i className="ri-star-line"></i>
                                </div>
                                <div className="sp-rewards-stat-info-1">
                                    <span className="sp-rewards-stat-value-1">{(user_progress?.current_xp_in_season || 0).toLocaleString()}</span>
                                    <span className="sp-rewards-stat-label-1">Season XP</span>
                                </div>
                            </div>
                            
                            <div className="sp-rewards-stat-card-1">
                                <div className="sp-rewards-stat-icon-1">
                                    <i className="ri-gift-line"></i>
                                </div>
                                <div className="sp-rewards-stat-info-1">
                                    <span className="sp-rewards-stat-value-1">{(user_progress?.claimed_rewards || []).length}</span>
                                    <span className="sp-rewards-stat-label-1">Rewards Claimed</span>
                                </div>
                            </div>
                            
                            {hasPass && (
                                <div className="sp-rewards-stat-card-1">
                                    <div className="sp-rewards-stat-icon-1">
                                        <i className="ri-vip-crown-line"></i>
                                    </div>
                                    <div className="sp-rewards-stat-info-1">
                                        <span className="sp-rewards-stat-value-1">
                                            {passType === 'LUNAR' ? '1.25x' : '2x'}
                                        </span>
                                        <span className="sp-rewards-stat-label-1">XP Multiplier</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {hasPass && (
                            <div className={`pass-status-banner ${passType?.toLowerCase()}`}>
                                <i className="ri-vip-crown-2-line"></i>
                                <span>{passType} Pass Active</span>
                            </div>
                        )}
                        
                        {!hasPass && (
                            <div className="no-pass-banner">
                                <i className="ri-information-line"></i>
                                <div className="banner-content">
                                    <span>Activate a Season Pass to unlock exclusive rewards</span>
                                    <button 
                                        className="activate-pass-btn"
                                        onClick={() => navigate('/user/season-pass/activate')}
                                    >
                                        Activate Pass
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {hasPass && passType === 'LUNAR' && (
                            <div className="upgrade-banner">
                                <i className="ri-arrow-up-circle-line"></i>
                                <div className="banner-content">
                                    <span>Upgrade to Totality Pass for 2x XP and exclusive rewards</span>
                                    <button 
                                        className="upgrade-pass-btn"
                                        onClick={() => navigate('/user/season-pass/activate')}
                                    >
                                        Upgrade to Totality
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {season_info?.countdown && (
                            <div className="countdown-banner">
                                <i className="ri-time-line"></i>
                                <span>Season ends in: {formatCountdown(season_info.countdown)}</span>
                            </div>
                        )}
                    </div>

                    {/* Rewards Grid */}
                    <div className="rewards-content">
                        <h2 className="section-title">All Season Levels</h2>
                        
                        <div className="levels-grid">
                            {levels?.map((level) => {
                                const isUnlocked = user_progress?.current_level >= level.level_number;
                                const lunarReward = level.lunar_reward;
                                const totalityReward = level.totality_reward;
                                
                                return (
                                    <div 
                                        key={level.level_number} 
                                        className={`level-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                                    >
                                        <div className="level-header">
                                            <div className="level-number">
                                                {level.level_number}
                                            </div>
                                            <div className="level-info">
                                                <h3>Level {level.level_number}</h3>
                                                {/* Hide exact XP requirement for better UX */}
                                            </div>
                                            <div className="level-status">
                                                {isUnlocked ? (
                                                    <i className="ri-check-circle-fill unlocked-icon"></i>
                                                ) : (
                                                    <i className="ri-lock-line locked-icon"></i>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="rewards-section">
                                            {/* Lunar Reward */}
                                            <div className="tier-rewards lunar">
                                                <div className="tier-header">
                                                    <div className="tier-icon">🌙</div>
                                                    <span className="tier-name">Lunar</span>
                                                </div>
                                                
                                                {lunarReward ? (
                                                    <div className={`reward-item ${lunarReward.can_claim ? 'claimable' : ''}`}>
                                                        <div className="reward-icon">
                                                            {getRewardIcon(lunarReward.reward_type)}
                                                        </div>
                                                        <div className="reward-info">
                                                            <span className="reward-name">
                                                                {lunarReward.display_name || getRewardDescription(lunarReward)}
                                                            </span>
                                                            {lunarReward.description && (
                                                                <span className="reward-description">
                                                                    {lunarReward.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {lunarReward.is_claimed ? (
                                                            <div className="claimed-badge">
                                                                <i className="ri-check-line"></i>
                                                                Claimed
                                                            </div>
                                                        ) : lunarReward.can_claim ? (
                                                            <button 
                                                                className="claim-button"
                                                                onClick={() => handleClaimReward(lunarReward.id)}
                                                                disabled={claimingReward === lunarReward.id}
                                                            >
                                                                {claimingReward === lunarReward.id ? (
                                                                    <div className="mini-loading-spinner"></div>
                                                                ) : (
                                                                    'Claim'
                                                                )}
                                                            </button>
                                                        ) : !hasPass || passType === 'TOTALITY' ? (
                                                            <div className="unavailable-badge">
                                                                {!hasPass ? 'Pass Required' : 'Locked'}
                                                            </div>
                                                        ) : (
                                                            <div className="unavailable-badge">
                                                                Locked
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="no-reward">
                                                        <span>No reward</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Totality Reward */}
                                            <div className="tier-rewards totality">
                                                <div className="tier-header">
                                                    <div className="tier-icon">🌟</div>
                                                    <span className="tier-name">Totality</span>
                                                </div>
                                                
                                                {totalityReward ? (
                                                    <div className={`reward-item ${totalityReward.can_claim ? 'claimable' : ''}`}>
                                                        <div className="reward-icon">
                                                            {getRewardIcon(totalityReward.reward_type)}
                                                        </div>
                                                        <div className="reward-info">
                                                            <span className="reward-name">
                                                                {totalityReward.display_name || getRewardDescription(totalityReward)}
                                                            </span>
                                                            {totalityReward.description && (
                                                                <span className="reward-description">
                                                                    {totalityReward.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {totalityReward.is_claimed ? (
                                                            <div className="claimed-badge">
                                                                <i className="ri-check-line"></i>
                                                                Claimed
                                                            </div>
                                                        ) : totalityReward.can_claim ? (
                                                            <button 
                                                                className="claim-button"
                                                                onClick={() => handleClaimReward(totalityReward.id)}
                                                                disabled={claimingReward === totalityReward.id}
                                                            >
                                                                {claimingReward === totalityReward.id ? (
                                                                    <div className="mini-loading-spinner"></div>
                                                                ) : (
                                                                    'Claim'
                                                                )}
                                                            </button>
                                                        ) : !hasPass || passType !== 'TOTALITY' ? (
                                                            <div className="unavailable-badge">
                                                                {!hasPass ? 'Totality Pass Required' : passType === 'LUNAR' ? 'Totality Pass Required' : 'Locked'}
                                                            </div>
                                                        ) : (
                                                            <div className="unavailable-badge">
                                                                Locked
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="no-reward">
                                                        <span>No reward</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
                .rewards-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .back-button {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-light);
                    padding: 12px 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    font-size: 0.9rem;
                    margin-top: 50px;
                }

                .back-button:hover {
                    background: var(--color-surface-alt);
                    transform: translateY(-1px);
                }

                .header-content {
                    flex: 1;
                }

                .page-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--color-text-light);
                    margin: 0 0 8px 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .page-subtitle {
                    color: var(--color-text-muted);
                    font-size: 1.1rem;
                    margin: 0;
                }

                .sp-rewards-overview-1 {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 30px;
                }

                .sp-rewards-stats-grid-1 {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }

                .sp-rewards-stat-card-1 {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .sp-rewards-stat-icon-1 {
                    color: var(--color-primary);
                    font-size: 1.5rem;
                }

                .sp-rewards-stat-info-1 {
                    display: flex;
                    flex-direction: column;
                }

                .sp-rewards-stat-value-1 {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: var(--color-text-light);
                    line-height: 1;
                }

                .sp-rewards-stat-label-1 {
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .pass-status-banner {
                    background: linear-gradient(135deg, #4a90e2, #357abd);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    margin-bottom: 16px;
                }

                .pass-status-banner.totality {
                    background: linear-gradient(135deg, #ffd700, #ff8c00);
                    color: #333;
                }

                .no-pass-banner {
                    background: linear-gradient(135deg, var(--color-surface-alt), var(--color-border));
                    color: var(--color-text-light);
                    padding: 16px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .banner-content {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                .activate-pass-btn {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .activate-pass-btn:hover {
                    background: var(--color-primary-dark);
                }

                .upgrade-banner {
                    background: linear-gradient(135deg, #ffd700, #ff8c00);
                    color: #333;
                    padding: 16px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .upgrade-pass-btn {
                    background: #333;
                    color: #ffd700;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .upgrade-pass-btn:hover {
                    background: #000;
                    transform: translateY(-1px);
                }

                .countdown-banner {
                    background: var(--color-primary);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    justify-content: center;
                }

                .section-title {
                    color: var(--color-text-light);
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 0 0 24px 0;
                }

                .levels-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                    gap: 20px;
                }

                .level-card {
                    background: #1a1a1a;
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.3s ease;
                }

                .level-card.unlocked {
                    border-color: var(--color-primary);
                    background: linear-gradient(135deg, #1a1a1a 0%, rgba(170, 46, 255, 0.2) 100%);
                }

                .level-card.locked {
                    opacity: 0.7;
                }

                .level-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(170, 46, 255, 0.1);
                }

                .level-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--color-border);
                }

                .level-number {
                    background: var(--color-primary);
                    color: white !important;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1.1rem;
                }

                .level-info {
                    flex: 1;
                }

                .level-info h3 {
                    color: var(--color-text-light);
                    margin: 0 0 4px 0;
                    font-size: 1.1rem;
                }

                .level-info p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .level-status {
                    font-size: 1.2rem;
                }

                .unlocked-icon {
                    color: var(--color-success);
                }

                .locked-icon {
                    color: var(--color-text-muted);
                }

                .rewards-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .tier-rewards {
                    background: #0f0f0f;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 16px;
                }

                .tier-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .tier-icon {
                    font-size: 1.2rem;
                }

                .tier-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-text-light);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .tier-rewards.lunar {
                    border-color: #4a90e2;
                }

                .tier-rewards.totality {
                    border-color: #ffd700;
                }

                .reward-item {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .reward-item.claimable {
                    animation: claimableGlow 2s ease-in-out infinite;
                }

                @keyframes claimableGlow {
                    0%, 100% { background: transparent; }
                    50% { background: rgba(170, 46, 255, 0.1); }
                }

                .reward-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .reward-icon {
                    font-size: 1.1rem;
                }

                .reward-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .reward-name {
                    color: var(--color-text-light);
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .reward-description {
                    color: var(--color-text-muted);
                    font-size: 0.8rem;
                }

                .claim-button {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 32px;
                }

                .claim-button:hover:not(:disabled) {
                    background: var(--color-primary-dark);
                    transform: translateY(-1px);
                }

                .claim-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .claimed-badge {
                    background: var(--color-success);
                    color: white;
                    padding: 6px 10px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    justify-content: center;
                }

                .unavailable-badge {
                    background: var(--color-surface-alt);
                    color: var(--color-text-muted);
                    padding: 6px 10px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    text-align: center;
                    border: 1px dashed var(--color-border);
                }

                .no-reward {
                    color: var(--color-text-muted);
                    font-size: 0.9rem;
                    text-align: center;
                    padding: 20px 8px;
                    font-style: italic;
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .rewards-header {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .page-title {
                        font-size: 1.5rem;
                    }

                    .sp-rewards-stats-grid-1 {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 16px;
                    }

                    .levels-grid {
                        grid-template-columns: 1fr;
                    }

                    .rewards-section {
                        grid-template-columns: 1fr;
                    }

                    .banner-content {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }

                    .activate-pass-btn {
                        align-self: center;
                    }
                }
            `}</style>
        </div>
    );
};

export default SeasonPassRewards;
