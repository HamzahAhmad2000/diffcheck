import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { publicBusinessAPI, baseURL, userProfileAPI, marketplaceAPI, surveyAPI, questAPI, seasonPassAPI, authAPI, SeasonPassTierManager, shareAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import QuestModal from '../quests/QuestModal';
import ScreenshotQuestInterface from '../quests/ScreenshotQuestInterface';
import WelcomePopup from './WelcomePopup';
import XPDisplay from '../common/XPDisplay';
import ShareButton from './share/ShareButton';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';
import '../../styles/SeasonPass.css';

const BusinessCard = ({ business, onNavigate }) => {
    // Calculate total earnable XP: 30 XP per question across all surveys + quest XP
    const totalEarnableXP = (business.total_survey_questions || 0) * 30 + (business.total_quest_xp || 0);
    
    const stats = {
        totalSurveys: business.survey_count || 0,
        totalEarnableXP: totalEarnableXP,
    };

    return (
        <div className="dashboard-item dashboard-brand-item">
            <div className="dashboard-item__logo">
                {business.logo_url ? (
                    <img 
                        src={business.logo_url.startsWith('http') ? business.logo_url : `${baseURL}${business.logo_url}`}
                        alt={`${business.name} logo`}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div className="dashboard-item__logo-fallback" style={{ display: business.logo_url ? 'none' : 'flex' }}>
                    {business.name.substring(0, 2).toUpperCase()}
                </div>
            </div>

            <div className="dashboard-item__info">
                <h4>{business.name}</h4>
                <XPDisplay baseXP={stats.totalEarnableXP} className="xp-highlight" />
            </div>

            <button 
                className="dashboard-item__cta"
                onClick={() => onNavigate(business.id)}
            >
                Enter
            </button>
        </div>
    );
};

// Season Pass Component - Updated to match user component styling
const SeasonPassSection = ({ seasonPassData, loading, user, navigate, claimReward }) => {
    console.log('[SEASON_PASS_COMPONENT] Rendering with:', { 
        hasData: !!seasonPassData, 
        loading, 
        hasUser: !!user,
        dataKeys: seasonPassData ? Object.keys(seasonPassData) : 'no data'
    });
    
    if (loading) {
        return (
            <div className="dashboard-section season-pass-section">
                <div className="dashboard-section__loading">
                    <div className="mini-loading-spinner"></div>
                    <p>Loading Season Pass...</p>
                </div>
            </div>
        );
    }

    if (!seasonPassData) {
        // Show a fallback UI if no season data or user not logged in
        return (
            <div className="dashboard-section season-pass-section">
                <div className="dashboard-section__header">
                    <div className="dashboard-section__title">
                        <i className="ri-vip-crown-line" style={{ color: '#aa2eff' }}></i>
                        <h3>Season Pass</h3>
                    </div>
                    <button 
                        className="dashboard-section__view-all"
                        onClick={() => navigate('/auth/login')}
                    >
                        Login to Access
                    </button>
                </div>
                <div className="dashboard-section__content">
                    <div className="season-pass-preview">
                        <div className="preview-info">
                            <p style={{ color: 'var(--color-text-muted)' }}>
                                Log in to view your Season Pass progress and activate premium tiers
                            </p>
                        </div>
                        <div className="tier-previews">
                            <div className="tier-preview-card lunar">
                                <div className="tier-icon">🌙</div>
                                <h4>Lunar Pass</h4>
                                <p className="tier-price">$19.99</p>
                                <p className="tier-benefit">1.25x XP Multiplier</p>
                            </div>
                            <div className="tier-preview-card totality">
                                <div className="tier-icon">🌟</div>
                                <h4>Totality Pass</h4>
                                <p className="tier-price">$34.99</p>
                                <p className="tier-benefit">2x XP Multiplier</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const { season_info, user_progress, user_pass, levels } = seasonPassData;
    const hasPass = !!user_pass;
    const passType = user_pass?.tier_type || null;

    // Calculate progress to next level
    const currentLevel = user_progress?.current_level || 0;
    const currentXP = user_progress?.current_xp_in_season || 0;
    const progressPercentage = user_progress?.progress_percentage || 0;
    const xpToNext = user_progress?.xp_to_next_level || 0;

    // Format countdown timer
    const formatCountdown = (countdown) => {
        if (!countdown) return null;
        const { days, hours, minutes } = countdown;
        return `${days}d ${hours}h ${minutes}m`;
    };

    // Get next level reward info
    const nextLevel = currentLevel + 1;
    const nextLevelData = levels?.find(level => level.level_number === nextLevel);
    const nextReward = nextLevelData ? (
        hasPass && passType === 'TOTALITY' ? nextLevelData.totality_reward : nextLevelData.lunar_reward
    ) : null;

    return (
        <div className="dashboard-section season-pass-section">
            <div className="dashboard-section__header">
                <div className="dashboard-section__title">
                    <i className="ri-vip-crown-line" style={{ color: '#aa2eff' }}></i>
                    <h3>{season_info?.name || 'Season Pass'}</h3>
                </div>
                <div className="season-pass-actions">
                    <button 
                        className="dashboard-section__view-all"
                        onClick={() => navigate('/user/season-pass/rewards')}
                    >
                        View All Rewards
                    </button>
                    {!hasPass ? (
                        <button 
                            className="dashboard-section__view-all activate-pass"
                            onClick={() => navigate('/user/season-pass/activate')}
                        >
                            <i className="ri-shopping-cart-line"></i>
                            Activate Pass
                        </button>
                    ) : passType === 'LUNAR' ? (
                        <button 
                            className="dashboard-section__view-all upgrade-pass"
                            onClick={() => navigate('/user/season-pass/activate')}
                        >
                            <i className="ri-arrow-up-line"></i>
                            Upgrade to Totality
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="dashboard-section__content">
                <div className="season-info-minimal">
                    {/* Current Pass Status */}
                    <div className="pass-info">
                        <div className="pass-status">
                            {hasPass ? (
                                <span className={`pass-name ${passType?.toLowerCase()}`}>
                                    {passType === 'LUNAR' ? '🌙' : '🌟'} {passType} Pass
                                </span>
                            ) : (
                                <span className="no-pass">No Pass Active</span>
                            )}
                        </div>
                        <div className="level-display">
                            <span className="current-level-text">Level {currentLevel}</span>
                        </div>
                    </div>

                    {/* Progress to Next Level */}
                    <div className="progress-info">
                        <div className="progress-header">
                            <span className="progress-label">Progress to Level {nextLevel}</span>
                            <span className="progress-percent">{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ 
                                    width: `${Math.min(progressPercentage, 100)}%`,
                                    background: hasPass 
                                        ? (passType === 'TOTALITY' ? 'linear-gradient(90deg, #ffd700, #ff8c00)' : 'linear-gradient(90deg, #4a90e2, #357abd)')
                                        : 'linear-gradient(90deg, #666, #999)'
                                }}
                            ></div>
                        </div>
                        {/* Hide exact XP values, show only progress bar */}
                    </div>

                    {/* Next Reward Preview */}
                    {nextReward && (
                        <div className="next-reward">
                            <div className="next-reward-header">
                                <span className="next-reward-label">Next Reward (Level {nextLevel})</span>
                            </div>
                            <div className="reward-preview">
                                <div className="reward-icon">
                                    {nextReward.reward_type === 'XP' && '✨'}
                                    {nextReward.reward_type === 'BADGE' && '🏆'}
                                    {nextReward.reward_type === 'RAFFLE_ENTRY' && '🎁'}
                                    {nextReward.reward_type === 'MARKETPLACE_ITEM' && '🛍️'}
                                    {nextReward.reward_type === 'CUSTOM' && '🎯'}
                                </div>
                                <div className="reward-details">
                                    <span className="xp-highlight">
                                        {nextReward.display_name || 
                                         (nextReward.reward_type === 'XP' ? `${nextReward.xp_amount} XP` : nextReward.reward_type)}
                                    </span>
                                    {hasPass && (
                                        <span className="reward-tier">{passType} Tier</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Dashboard Section Components
const DashboardSection = ({ icon, title, items, loading, navigate, link, emptyMessage, renderItem }) => (
    <div className="dashboard-section" style={{ margin: '3px' }}>
        <div className="dashboard-section__header">
            <div className="dashboard-section__title">
                <i className={icon}></i>
                <h3>{title}</h3>
            </div>
            <button 
                className="dashboard-section__view-all"
                onClick={() => navigate(link)}
            >
                View All
            </button>
        </div>
        <div className="dashboard-section__content">
            {loading ? (
                <div className="dashboard-section__loading">
                    <div className="mini-loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            ) : items.length > 0 ? (
                <div className="dashboard-section__items">
                    {items.slice(0, 10).map((item, index) => renderItem(item, index))}
                </div>
            ) : (
                <div className="dashboard-section__empty">
                    <p>{emptyMessage}</p>
                </div>
            )}
        </div>
    </div>
);

const UserHomepage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [businesses, setBusinesses] = useState([]);
    const [surveys, setSurveys] = useState([]);
    const [quests, setQuests] = useState([]);
    const [marketplaceItems, setMarketplaceItems] = useState([]);

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedQuest, setSelectedQuest] = useState(null);
    const [selectedScreenshotQuest, setSelectedScreenshotQuest] = useState(null);
    // Track quests that have had their verification link clicked and are awaiting reward claim
    const [claimableQuests, setClaimableQuests] = useState([]);
    const [userCompletions, setUserCompletions] = useState([]);
    const [userCompletedSurveys, setUserCompletedSurveys] = useState([]);
    
    // Season Pass state
    const [seasonPassData, setSeasonPassData] = useState(null);
    const [seasonPassLoading, setSeasonPassLoading] = useState(false);
    
    // Welcome popup state
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);
    
    // Join share prompt state
    const [showJoinSharePrompt, setShowJoinSharePrompt] = useState(false);
    const [hasSharedJoin, setHasSharedJoin] = useState(false);

    // Determine if this is dashboard or brands page
    const isDashboard = location.pathname === '/user/home';
    const isBrands = location.pathname === '/user/brands';
    
    // Debug logging for page detection
    useEffect(() => {
        console.log('[USERHOMEPAGE] Current path:', location.pathname);
        console.log('[USERHOMEPAGE] isDashboard:', isDashboard);
        console.log('[USERHOMEPAGE] isBrands:', isBrands);
    }, [location.pathname]);

    // Force reload dashboard data every time the component mounts or path changes
    useEffect(() => {
        console.log('[USERHOMEPAGE] useEffect triggered, path:', location.pathname);
        console.log('[USERHOMEPAGE] isDashboard:', isDashboard, 'isBrands:', isBrands);
        
        // Fetch fresh user data from backend to get accurate has_seen_welcome_popup status
        const fetchUserData = async () => {
            try {
                const response = await authAPI.getCurrentUserDetails();
                const freshUserData = response.data.user;
                localStorage.setItem('user', JSON.stringify(freshUserData));
                setUser(freshUserData);
                
                console.log('[USERHOMEPAGE] Fresh user data loaded, has_seen_welcome_popup:', freshUserData.has_seen_welcome_popup);
                
                // Check if user should see welcome popup (only for dashboard and logged in users)
                if (isDashboard && freshUserData && !freshUserData.has_seen_welcome_popup) {
                    console.log('[USERHOMEPAGE] User has not seen welcome popup, showing it');
                    setShowWelcomePopup(true);
                }
                
                // Load dashboard/brands data after user data is loaded
                if (isDashboard) {
                    console.log('[USERHOMEPAGE] Loading dashboard data...');
                    fetchDashboardData();
                    fetchSeasonPassData();
                    if (freshUserData?.id) {
                        fetchUserCompletions(freshUserData.id);
                        checkJoinShareEligibility(freshUserData);
                    }
                } else if (isBrands) {
                    console.log('[USERHOMEPAGE] Loading brands data...');
                    fetchBusinesses();
                }
            } catch (error) {
                console.error('[USERHOMEPAGE] Error fetching user data:', error);
                // Fallback to localStorage
                const localUserData = JSON.parse(localStorage.getItem('user'));
                setUser(localUserData);
                
                if (isDashboard && localUserData && !localUserData.has_seen_welcome_popup) {
                    setShowWelcomePopup(true);
                }
                
                // Load dashboard/brands data even if user fetch fails
                if (isDashboard) {
                    fetchDashboardData();
                    fetchSeasonPassData();
                    if (localUserData?.id) {
                        fetchUserCompletions(localUserData.id);
                        checkJoinShareEligibility(localUserData);
                    }
                } else if (isBrands) {
                    fetchBusinesses();
                }
            }
        };
        
        fetchUserData();
    }, [location.pathname, isDashboard, isBrands]); // Include computed values as dependencies for reliability

    // Cleanup effect to ensure fresh data on every visit
    useEffect(() => {
        // Reset state when leaving this component
        return () => {
            console.log('[USERHOMEPAGE] Component unmounting, resetting loading state');
            setLoading(false);
        };
    }, []);

    const fetchDashboardData = async () => {
        console.log('[DASHBOARD] Starting fresh dashboard data fetch...');
        setLoading(true);
        
        // Reset all data first to ensure clean state
        setBusinesses([]);
        setSurveys([]);
        setQuests([]);
        setMarketplaceItems([]);
        
        try {
            console.log('[DASHBOARD] Starting to fetch dashboard data...');
            
            // Fetch all data for dashboard sections in parallel
            const [businessesRes, surveysRes, questsRes, marketplaceRes] = await Promise.all([
                // Fetch only featured businesses
                publicBusinessAPI.listBusinesses({ is_featured: true }),
                // Fetch available surveys
                surveyAPI.getAvailableSurveys(),
                // Fetch available quests
                questAPI.getAvailableQuests(),
                // Fetch marketplace items
                marketplaceAPI.getItems().catch(() => ({ data: { items: [] } }))
            ]);

            // Process businesses data with sorting (latest first)
            let businessesData = businessesRes.data?.businesses || businessesRes.data || [];
            // First get all businesses, then filter and sort (fallback to all if no featured)
            const featuredBusinesses = businessesData.filter(b => b.is_featured);
            businessesData = (featuredBusinesses.length > 0 ? featuredBusinesses : businessesData.slice(0, 10))
                .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
            console.log('[DASHBOARD] Featured businesses (sorted by latest):', businessesData.length);

            // Process surveys data with sorting (latest first)
            let surveysData = surveysRes.data || surveysRes || [];
            // First get all surveys, then filter and sort (fallback to all if no featured)
            const featuredSurveys = surveysData.filter(s => s.is_featured);
            surveysData = (featuredSurveys.length > 0 ? featuredSurveys : surveysData.slice(0, 10))
                .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
            console.log('[DASHBOARD] Available surveys (sorted by latest):', surveysData.length);
            
            // Track completed surveys
            const completedSurveyIds = surveysData
                .filter(survey => survey.completed_by_user)
                .map(survey => survey.id);
            setUserCompletedSurveys(completedSurveyIds);

            // Process quests data with sorting (latest first)
            let questsData = questsRes.data?.quests || questsRes.data || [];
            // First get all quests, then filter and sort (fallback to all if no featured)
            const featuredQuests = questsData.filter(q => q.is_featured);
            questsData = (featuredQuests.length > 0 ? featuredQuests : questsData.slice(0, 10))
                .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
            console.log('[DASHBOARD] Available quests (sorted by latest):', questsData.length);

            // Process marketplace data
            const marketplaceData = marketplaceRes.data?.items || [];
            console.log('[DASHBOARD] Marketplace items:', marketplaceData.length);

            console.log('[DASHBOARD] Final data:', {
                businesses: businessesData.length,
                surveys: surveysData.length,
                quests: questsData.length,
                marketplace: marketplaceData.length
            });

            // Set all data at once to prevent render thrashing
            setBusinesses(businessesData);
            setSurveys(surveysData);
            setQuests(questsData);
            setMarketplaceItems(marketplaceData);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Failed to load dashboard data.');
        } finally {
            setLoading(false);
            console.log('[DASHBOARD] Data fetch completed, loading set to false');
        }
    };

    const fetchBusinesses = async () => {
        console.log('[BRANDS] Starting fresh brands data fetch...');
        setLoading(true);
        
        // Reset businesses data first to ensure clean state
        setBusinesses([]);
        
        try {
            console.log('[BRANDS] Fetching all businesses for brands page...');
            // For brands page, fetch all businesses (not just super tier)
            const response = await publicBusinessAPI.listBusinesses();
            let businessesData = response.data?.businesses || response.data || [];
            
            // Sort businesses by latest created first for consistency
            businessesData = businessesData.sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
            
            console.log('[BRANDS] Loaded businesses (sorted by latest):', businessesData.length);
            setBusinesses(businessesData);
        } catch (error) {
            console.error('Error fetching businesses:', error);
            toast.error('Failed to load businesses.');
        } finally {
            setLoading(false);
            console.log('[BRANDS] Brands fetch completed, loading set to false');
        }
    };

    const fetchUserCompletions = async (userId) => {
        try {
            const response = await questAPI.getUserQuestCompletions(userId);
            setUserCompletions(response.data?.completions || []);
        } catch (err) {
            console.error('Error fetching user completions:', err);
        }
    };

    const fetchSeasonPassData = async () => {
        try {
            setSeasonPassLoading(true);
            console.log('[SEASON_PASS] Fetching season pass data...');
            
            // Fetch user's season pass state if logged in
            const userData = JSON.parse(localStorage.getItem('user'));
            console.log('[SEASON_PASS] User data:', userData ? 'Found' : 'Not found');
            
            if (userData) {
                console.log('[SEASON_PASS] Fetching authenticated user state...');
                const response = await seasonPassAPI.getState();
                console.log('[SEASON_PASS] Authenticated response:', response);
                
                // Update SeasonPassTierManager with the response
                SeasonPassTierManager.updateFromAPIResponse(response);
                
                setSeasonPassData(response.data?.data || null);
            } else {
                console.log('[SEASON_PASS] Fetching public preview...');
                const response = await seasonPassAPI.getPreview();
                console.log('[SEASON_PASS] Public preview response:', response);
                
                // Clear tier data for non-authenticated users
                SeasonPassTierManager.clearTier();
                
                setSeasonPassData(response.data?.data || null);
            }
        } catch (err) {
            console.error('[SEASON_PASS] Error fetching season pass data:', err);
            console.error('[SEASON_PASS] Error details:', err.response?.data);
            // Set empty data so component still shows
            setSeasonPassData({});
        } finally {
            setSeasonPassLoading(false);
            console.log('[SEASON_PASS] Loading completed');
        }
    };

    const claimReward = async (seasonRewardId) => {
        try {
            console.log(`[SEASON_PASS] Claiming reward ${seasonRewardId}`);
            const response = await seasonPassAPI.claimReward(seasonRewardId);
            
            if (response.data?.success) {
                toast.success(response.data.message || 'Reward claimed successfully!');
                
                // Refresh season pass data to update claim status
                await fetchSeasonPassData();
                
                // If it's an XP reward, trigger XP gained event and update user balance
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
        } catch (err) {
            console.error('Error claiming season pass reward:', err);
            const errorMessage = err.response?.data?.error || 'Failed to claim reward';
            toast.error(errorMessage);
        }
    };
    
    const filteredBusinesses = businesses.filter(business => 
        business.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleViewSurveys = (businessId) => {
        navigate(`/user/brand/${businessId}`);
    };

    // Enhanced quest start handler:
    // 1. Supports CLICK_VERIFY quests (immediate XP claim after link click).
    // 2. Keeps legacy support for TWITTER_POST / DISCORD_JOIN quest types.
    // 3. Falls back to QuestModal for quests that require extra verification (e.g., screenshots).
    const handleStartQuest = async (quest) => {
        const isClaimable = claimableQuests.includes(quest.id);

        // CLICK_VERIFY or social link quests
        const isClickVerifyQuest =
            quest.verification_method === 'CLICK_VERIFY' ||
            quest.quest_type === 'TWITTER_POST' ||
            quest.quest_type === 'DISCORD_JOIN';

        if (isClickVerifyQuest) {
            if (isClaimable) {
                // User is claiming the reward
                const success = await handleQuestComplete(quest.id, { link_clicked: true });
                if (success?.success) {
                    // Remove from claimable list upon successful completion
                    setClaimableQuests(prev => prev.filter(id => id !== quest.id));
                }
            } else {
                // First click – track link and mark as claimable
                const link = quest.target_url || quest.target_link;
                if (link) {
                    try {
                        await questAPI.trackLinkClick(quest.id);
                    } catch (error) {
                        console.error('Error tracking link click:', error);
                    }

                    window.open(link, '_blank');
                    setClaimableQuests(prev => [...prev, quest.id]);
                    toast.success('Great! Once you\'re done, click "Claim Reward" to receive your XP.');
                }
            }
            return; // Exit – handled click-verify flow
        }

        // For screenshot verification quests, use the dedicated screenshot interface
        if (quest.verification_method === 'SCREENSHOT_VERIFY') {
            setSelectedScreenshotQuest(quest);
            return;
        }

        // For other quests requiring additional verification, open modal
        setSelectedQuest(quest);
    };

    const handleQuestComplete = async (questId, verificationData = {}) => {
        try {
            const response = await questAPI.completeQuest(questId, verificationData);
            
            // Refresh user completions
            if (user?.id) {
                const completionsResponse = await questAPI.getUserQuestCompletions(user.id);
                setUserCompletions(completionsResponse.data?.completions || []);
            }

            // Show success message
            const xpAwarded = response.data?.xp_awarded || 0;
            toast.success(`Quest completed! You earned ${xpAwarded} XP!`);

            // Trigger global XP gained event for UI feedback (TopNavbar glow, sound, etc.)
            window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpAwarded } }));

            // Optimistically update localStorage user balance so UI stays in sync
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData) {
              userData.xp_balance = (userData.xp_balance || 0) + xpAwarded;
              localStorage.setItem('user', JSON.stringify(userData));
              window.dispatchEvent(new CustomEvent('userUpdated'));
            }
            
            return { success: true, data: response.data };
        } catch (err) {
            console.error('Error completing quest:', err);
            const errorMessage = err.response?.data?.error || 'Failed to complete quest';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    const isQuestCompleted = (questId) => {
        return userCompletions.some(completion => 
            completion.quest_id === questId || completion.quest_id === String(questId)
        );
    };

    const isSurveyCompleted = (surveyId) => {
        return userCompletedSurveys.includes(surveyId);
    };

    const checkJoinShareEligibility = async (userData) => {
        try {
            // Check if user joined within last 72 hours and hasn't shared yet
            const joinDate = new Date(userData.created_at);
            const now = new Date();
            const hoursSinceJoin = (now - joinDate) / (1000 * 60 * 60);
            
            if (hoursSinceJoin <= 72) {
                // Check if user has already shared
                const response = await shareAPI.checkShareStatus('join_share');
                if (!response.data.already_shared) {
                    setShowJoinSharePrompt(true);
                }
            }
        } catch (error) {
            console.error('[USERHOMEPAGE] Error checking join share eligibility:', error);
        }
    };

    const handleJoinShareSuccess = (shareData) => {
        setHasSharedJoin(true);
        setShowJoinSharePrompt(false);
        
        // Update user's XP balance in localStorage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData && shareData.xp_awarded) {
            userData.xp_balance = (userData.xp_balance || 0) + shareData.xp_awarded;
            localStorage.setItem('user', JSON.stringify(userData));
            window.dispatchEvent(new CustomEvent('userUpdated'));
            window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: shareData.xp_awarded } }));
        }
    };

    const handleCloseWelcomePopup = async () => {
        setShowWelcomePopup(false);
        
        try {
            // Call backend API to mark popup as seen
            await userProfileAPI.markWelcomePopupSeen();
            console.log('[USERHOMEPAGE] Successfully marked welcome popup as seen on backend');
            
            // Fetch fresh user data from backend to ensure consistency
            const response = await authAPI.getCurrentUserDetails();
            const freshUserData = response.data.user;
            localStorage.setItem('user', JSON.stringify(freshUserData));
            setUser(freshUserData);
            
            console.log('[USERHOMEPAGE] User data refreshed, has_seen_welcome_popup:', freshUserData.has_seen_welcome_popup);
        } catch (error) {
            console.error('[USERHOMEPAGE] Error marking welcome popup as seen:', error);
            // Still update localStorage even if API call fails
            const userData = JSON.parse(localStorage.getItem('user'));
            if (userData) {
                userData.has_seen_welcome_popup = true;
                localStorage.setItem('user', JSON.stringify(userData));
                setUser(userData);
            }
        }
    };

    // Get full image URL with proper error handling
    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) {
            return '/default-item-placeholder.png';
        }
        
        // Handle full URLs (external images or data URLs)
        if (relativeOrAbsoluteUrl.startsWith('http://') || 
            relativeOrAbsoluteUrl.startsWith('https://') || 
            relativeOrAbsoluteUrl.startsWith('data:')) {
            return relativeOrAbsoluteUrl;
        }
        
        // Handle relative URLs - construct full path
        let cleanPath = relativeOrAbsoluteUrl;
        if (!cleanPath.startsWith('/')) {
            cleanPath = `/${cleanPath}`;
        }
        
        return `${baseURL}${cleanPath}`;
    };

    // Dashboard View
    if (isDashboard) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        {loading ? (
                            <div className="loading-surveys">
                                <div className="user-loading-indicator">
                                    <div className="user-loading-spinner"></div>
                                    <p>Loading Dashboard...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="dashboard-content">
                                {/* Join Share Prompt Banner - Above Season Pass */}
                                {showJoinSharePrompt && !hasSharedJoin && (
                                    <div className="join-share-prompt">
                                        <button 
                                            className="join-share-prompt__close"
                                            onClick={() => setShowJoinSharePrompt(false)}
                                            aria-label="Close"
                                        >
                                            <i className="ri-close-line"></i>
                                        </button>
                                        <div className="join-share-prompt__content">
                                            <div className="join-share-prompt__icon">🎉</div>
                                            <div className="join-share-prompt__text">
                                                <h3>Welcome to Eclipseer!</h3>
                                                <p>Share your journey on X and earn <strong>500 XP</strong> instantly!</p>
                                            </div>
                                            <ShareButton
                                                shareType="join_share"
                                                variant="success"
                                                size="medium"
                                                xpReward={500}
                                                hasShared={hasSharedJoin}
                                                onShareSuccess={handleJoinShareSuccess}
                                                className="join-share-prompt__button"
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Season Pass - First thing visible */}
                                <SeasonPassSection 
                                    seasonPassData={seasonPassData}
                                    loading={seasonPassLoading}
                                    user={user}
                                    navigate={navigate}
                                    claimReward={claimReward}
                                />
                                
                                <div className="dashboard-grid">
                                    {/* Top Row: Brands & Surveys */}
                                    <DashboardSection
                                    icon="ri-building-2-line"
                                    title="Featured Brands"
                                    items={businesses}
                                    loading={loading}
                                    navigate={navigate}
                                    link="/user/brands"
                                    emptyMessage="No featured brands available"
                                    renderItem={(business, index) => {
                                        const totalEarnableXP = (business.total_survey_questions || 0) * 30 + (business.total_quest_xp || 0);
                                        return (
                                        <div key={business.id} className="dashboard-item dashboard-brand-item" onClick={() => navigate(`/user/brand/${business.id}`)}>
                                            <div className="dashboard-item__logo">
                                                {business.logo_url ? (
                                                    <img 
                                                        src={business.logo_url.startsWith('http') ? business.logo_url : `${baseURL}${business.logo_url}`}
                                                        alt={`${business.name} logo`}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className="dashboard-item__logo-fallback" style={{ display: business.logo_url ? 'none' : 'flex' }}>
                                                    {business.name.substring(0, 2).toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="dashboard-item__info">
                                                <h4>{business.name}</h4>
                                                <XPDisplay baseXP={totalEarnableXP} className="xp-highlight" />
                                            </div>

                                            <button 
                                                className="dashboard-item__cta"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/user/brand/${business.id}`);
                                                }}
                                            >
                                                Enter
                                            </button>
                                        </div>
                                    )}}
                                />
                                <DashboardSection
                                    icon="ri-questionnaire-line"
                                    title="Featured Surveys"
                                    items={surveys}
                                    loading={loading}
                                    navigate={navigate}
                                    link="/user/surveys"
                                    emptyMessage="No featured surveys available"
                                    renderItem={(survey, index) => {
                                        // Calculate time: 1 question = 30 seconds = 0.5 minutes
                                        const estimatedTimeMinutes = Math.ceil((survey.question_count || 1) * 0.5);
                                        const xpReward = survey.xp_reward || (survey.question_count || 1) * 30;
                                        const completed = isSurveyCompleted(survey.id);
                                        
                                        return (
                                            <div key={`${survey.business_id}-${survey.id}`} className="dashboard-item dashboard-survey-item">
                                                <div className="dashboard-item__info">
                                                    <h4>{survey.title}</h4>
                                                    <div className="dashboard-item__details">
                                                        <span><i className="ri-time-line"></i> {estimatedTimeMinutes} min</span>
                                                        <XPDisplay baseXP={xpReward} className="xp-highlight" />
                                                    </div>
                                                </div>
                                                <button 
                                                    className={`dashboard-item__cta ${completed ? 'claimed' : ''}`}
                                                    onClick={() => navigate(`/survey/${survey.id}`)}
                                                    disabled={completed}
                                                >
                                                    {completed ? (
                                                        <><i className="ri-check-line"></i> Completed</>
                                                    ) : 'Start'}
                                                </button>
                                            </div>
                                        );
                                    }}
                                />
                                
                                {/* Bottom Row: Quests & XP Store */}
                                <DashboardSection
                                    icon="ri-trophy-line"
                                    title="Featured Quests"
                                    items={quests}
                                    loading={loading}
                                    navigate={navigate}
                                    link="/user/quests"
                                    emptyMessage="No featured quests available"
                                    renderItem={(quest, index) => {
                                        const completed = isQuestCompleted(quest.id);
                                        return (
                                        <div key={quest.id} className="dashboard-item dashboard-quest-item">
                                            {quest.image_url && (
                                                <div className="dashboard-item__image">
                                                    <img 
                                                        src={quest.image_url.startsWith('http') ? quest.image_url : `${baseURL}${quest.image_url}`}
                                                        alt={quest.title || 'Quest image'}
                                                        style={{
                                                            width: '100%',
                                                            height: '100px',
                                                            objectFit: 'contain',
                                                            borderRadius: '8px 8px 0 0',
                                                            marginBottom: '8px',
                                                            backgroundColor: '#f5f5f5'
                                                        }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="dashboard-item__info">
                                                <h4>{quest.title}</h4>
                                                <div className="dashboard-item__details">
                                                    <XPDisplay baseXP={quest.xp_reward || quest.reward} className="xp-highlight" />
                                                </div>
                                                {quest.progress !== undefined && (
                                                    <div className="dashboard-item__progress">
                                                        <div className="progress-bar">
                                                            <div className="progress-fill" style={{ width: `${quest.progress}%` }}></div>
                                                        </div>
                                                        <span className="progress-percent">{quest.progress}%</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                className={`dashboard-item__cta ${completed ? 'claimed' : claimableQuests.includes(quest.id) ? 'claimable' : ''}`}
                                                onClick={() => !completed && handleStartQuest(quest)}
                                                disabled={completed}
                                            >
                                                {completed ? (
                                                    <><i className="ri-check-line"></i> Completed</>
                                                ) : claimableQuests.includes(quest.id) ? 'Claim Reward' : 'Complete'}
                                            </button>
                                        </div>
                                    )}}
                                />
                                <div className="dashboard-section"  style={{ margin: '3px' }}>
                                    <div className="dashboard-section__header">
                                        <div className="dashboard-section__title">
                                            <i className="ri-store-2-line"></i>
                                            <h3>XP Store</h3>
                                        </div>
                                        <button 
                                            className="dashboard-section__view-all"
                                            onClick={() => navigate('/user/marketplace')}
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="dashboard-section__content">
                                        {loading ? (
                                            <div className="dashboard-section__loading">
                                                <div className="mini-loading-spinner"></div>
                                                <p>Loading...</p>
                                            </div>
                                        ) : marketplaceItems.length > 0 ? (
                                            <div className="dashboard-section__items marketplace-grid">
                                                {marketplaceItems.slice(0, 6).map((item, index) => (
                                                    <div key={item.id} className="dashboard-item dashboard-marketplace-item">
                                                        <div className="dashboard-item__image-container">
                                                            <img 
                                                                src={getFullImageUrl(item.image_url)}
                                                                alt={item.title || 'Marketplace Item'}
                                                                className="dashboard-item__image"
                                                                onError={(e) => {
                                                                    if (e.target.src !== '/default-item-placeholder.png') {
                                                                        e.target.src = '/default-item-placeholder.png';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="dashboard-item__info">
                                                            <h4 style={{ marginTop: '-5px', marginBottom: '-15px' }}>{item.title}</h4>
                                                            <div className="dashboard-item__details" >
                                                                <span className="xp-highlight" style={{ marginTop: '-35px' }}>💎 {item.xp_cost} XP</span>
                                                            </div>
                                                        </div>
                                                        <button className="dashboard-item__cta" onClick={() => navigate(`/user/marketplace`)} style={{ marginTop: '-15px' }}>
                                                            View
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="dashboard-section__empty">
                                                <p>No items available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>
                </main>
                
                {/* Quest Detail Modal */}
                {selectedQuest && (
                    <QuestModal
                        quest={selectedQuest}
                        questType={selectedQuest.quest_type}
                        isCompleted={isQuestCompleted(selectedQuest.id)}
                        onClose={() => setSelectedQuest(null)}
                        onComplete={user ? (verificationData) => handleQuestComplete(selectedQuest.id, verificationData) : null}
                        user={user}
                    />
                )}
                
                {/* Screenshot Quest Interface */}
                {selectedScreenshotQuest && (
                    <ScreenshotQuestInterface
                        quest={selectedScreenshotQuest}
                        onClose={() => setSelectedScreenshotQuest(null)}
                        onComplete={() => {
                            // Refresh user completions after screenshot submission
                            if (user?.id) {
                                questAPI.getUserQuestCompletions(user.id).then(response => {
                                    setUserCompletions(response.data?.completions || []);
                                }).catch(error => {
                                    console.error('Error refreshing completions:', error);
                                });
                            }
                        }}
                        user={user}
                    />
                )}
                
                {/* Welcome Popup for first-time users */}
                {showWelcomePopup && (
                    <WelcomePopup onClose={handleCloseWelcomePopup} />
                )}
            </div>
        );
    }

    // Brands View (existing functionality)
    return (
        <div className="app-layout">
            <main className="main-content12">
                <div className="page-inner-container">
                    <div className="surveys-header">
                        <div className="surveys-header__left">
                            <div className="surveys-header__search">
                                <i className="ri-search-line"></i>
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="surveys-separator"></div>
                    
                    {loading ? (
                        <div className="loading-surveys">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Brands...</p>
                            </div>
                        </div>
                    ) : filteredBusinesses.length > 0 ? (
                        <section className="brands-grid">
                            {filteredBusinesses.map((business) => (
                                <BusinessCard
                                    key={business.id}
                                    business={business}
                                    onNavigate={handleViewSurveys}
                                />
                            ))}
                        </section>
                    ) : (
                        <div className="empty-state">
                            <i className="ri-building-line empty-state__icon"></i>
                            <h3 className="empty-state__title">No Brands Available</h3>
                            <p className="empty-state__message">
                                There are currently no brands with surveys available for you.
                            </p>
                            <button 
                                className="button button--primary"
                                onClick={() => navigate('/request-business')}
                            >
                                Request a New Business
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UserHomepage; 