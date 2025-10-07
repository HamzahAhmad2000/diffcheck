import React, { useState, useEffect } from 'react';
import { questAPI, userProfileAPI } from '../../services/apiClient';
import ScreenshotQuestInterface from './ScreenshotQuestInterface';
import { toast } from 'react-hot-toast';

import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';
import '../../styles/QuestCard.css';

const QuestCard = ({ quest, onStart, onStartScreenshot, isCompleted, isPending }) => {
    const [questState, setQuestState] = useState(isPending ? 'pending' : 'initial'); // 'initial', 'completed', 'claimable', 'pending'
    const [questProgress, setQuestProgress] = useState(null);
    const [hasClickedLink, setHasClickedLink] = useState(false);
    const xpReward = quest.xp_reward || 0;

    // Fetch quest progress for Eclipseer quests
    useEffect(() => {
        const fetchProgress = async () => {
            if (isEclipseerQuest(quest.quest_type) && !isCompleted) {
                try {
                    const response = await questAPI.getQuestProgress(quest.id);
                    setQuestProgress(response);
                } catch (error) {
                    console.error('Error fetching quest progress:', error);
                }
            }
        };
        fetchProgress();
    }, [quest.id, quest.quest_type, isCompleted]);

    // Keep questState in sync if pending prop changes (e.g., after refresh)
    useEffect(() => {
        if (isPending) setQuestState('pending');
    }, [isPending]);

    // Check if user has clicked the link for this quest
    useEffect(() => {
        const checkLinkClickStatus = async () => {
            if (quest.target_url && !isCompleted) {
                try {
                    const response = await questAPI.checkLinkClick(quest.id);
                    if (response.data?.has_clicked) {
                        setHasClickedLink(true);
                        setQuestState('claimable');
                    }
                } catch (error) {
                    console.error('Error checking link click status:', error);
                }
            }
        };
        checkLinkClickStatus();
    }, [quest.id, quest.target_url, isCompleted]);

    const isEclipseerQuest = (questType) => {
        return ['COMPLETE_X_SURVEYS_DAILY', 'COMPLETE_X_SURVEYS_TOTAL', 'SELECT_X_TAGS', 
               'COMPLETE_X_QUESTS', 'VISIT_X_BRAND_PAGES', 'UPLOAD_PROFILE_PICTURE', 
               'COMPLETE_PROFILE_SECTION'].includes(questType);
    };

    const getQuestTypeIcon = (type) => {
        if (type.includes('TWITTER') || type.includes('X_')) return '🐦';
        if (type.includes('INSTAGRAM')) return '📷';
        if (type.includes('LINKEDIN')) return '💼';
        if (type.includes('YOUTUBE')) return '📺';
        if (type.includes('DISCORD')) return '🎮';
        if (type.includes('TELEGRAM')) return '💬';
        if (type.includes('SURVEY')) return '📋';
        if (type.includes('VISIT')) return '🔗';
        return '🎯';
    };

    // Truncate text with character limits
    const truncateText = (text, limit) => {
        if (!text) return '';
        return text.length > limit ? text.substring(0, limit) + '...' : text;
    };

    const handleQuestAction = async () => {
        if (isCompleted) return;
        
        if (questState === 'initial') {
            // Check if quest requires screenshot verification first
            if (quest.verification_method === 'SCREENSHOT_VERIFY') {
                onStartScreenshot && onStartScreenshot(quest);
                return;
            }
            
            // If quest has target URL and uses open link verification, redirect to it and track the click
            if (quest.target_url && quest.verification_method === 'CLICK_VERIFY') {
                try {
                    await questAPI.trackLinkClick(quest.id);
                    setHasClickedLink(true);
                } catch (error) {
                    console.error('Error tracking link click:', error);
                }
                
                // Open link in new tab
                window.open(quest.target_url, '_blank');
                
                // Change button to "Claim"
                setQuestState('claimable');
                return;
            }
            
            // For quests without target URL, complete directly
            await handleQuestComplete();
        } else if (questState === 'claimable') {
            // Claim the quest
            await handleQuestComplete();
        }
    };

    const handleQuestComplete = async () => {
        try {
            const result = await onStart(quest);
            if (result && result.success) {
                setQuestState('completed');
                toast.success(`Quest completed! You earned ${xpReward} XP!`);
            }
        } catch (error) {
            console.error('Error completing quest:', error);
            toast.error('Failed to complete quest');
        }
    };

    const getButtonText = () => {
        if (isCompleted) return '✓ Completed';
        if (quest.verification_method === 'SCREENSHOT_VERIFY' && questState === 'pending') {
            return 'Pending Approval';
        }
        if (quest.verification_method === 'SCREENSHOT_VERIFY') {
            return 'Complete Quest';
        }
        
        if (quest.verification_method === 'CLICK_VERIFY') {
            if (questState === 'claimable') return 'Claim Reward';
            if (quest.target_url) return 'Visit Link';
        }
        
        return 'Complete Quest';
    };

    const getButtonClass = () => {
        if (isCompleted) return 'dashboard-item__cta claimed';
        if (questState === 'claimable') return 'dashboard-item__cta claimable';
        if (questState === 'pending') return 'dashboard-item__cta pending';
        return 'dashboard-item__cta';
    };

    const formatDeadline = (endDate) => {
        if (!endDate) return null;
        const now = new Date();
        const deadline = new Date(endDate);
        const hoursLeft = Math.ceil((deadline - now) / (1000 * 60 * 60));
        
        if (hoursLeft <= 0) return 'Expired';
        if (hoursLeft <= 24) return `${hoursLeft}h left`;
        const daysLeft = Math.ceil(hoursLeft / 24);
        return `${daysLeft}d left`;
    };

    return (
        <>
            <div className={`card ${isEclipseerQuest(quest.quest_type) ? 'eclipseer-quest' : ''}`}>
                {quest.image_url && (
                    <div className="card-image">
                        <img 
                            src={quest.image_url.startsWith('http') ? quest.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${quest.image_url}`}
                            alt={quest.title || 'Quest image'}
                            style={{
                                width: '100%',
                                height: '120px',
                                objectFit: 'contain',
                                borderRadius: '8px 8px 0 0',
                                backgroundColor: '#f5f5f5'
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                )}
                <div className="card-content">
                    <h3 className="card-title">{truncateText(quest.title || 'Untitled Quest', 50)}</h3>
                    {quest.description && !quest.image_url && (
                        <p className="card-subtitle">
                            {truncateText(quest.description, 100)}
                        </p>
                    )}
                    
                    {/* Progress Bar for Eclipseer Quests */}
                    {isEclipseerQuest(quest.quest_type) && questProgress && !isCompleted && (
                        <div className="quest-progress-section">
                            <div className="quest-progress">
                                <div 
                                    className="quest-progress-bar" 
                                    style={{ width: `${questProgress.progress_percentage}%` }}
                                ></div>
                            </div>
                            <div className="quest-progress-text">
                                {questProgress.current_progress} / {questProgress.target_count}
                                {questProgress.quest_type === 'COMPLETE_X_SURVEYS_DAILY' && ' (24h)'}
                            </div>
                        </div>
                    )}

                    <div className="card-info">
                        <span className="xp-highlight">✨ {xpReward} XP</span>
                    </div>

                    {/* Deadline Display */}
                    {quest.end_date && (
                        <div className={`quest-deadline ${formatDeadline(quest.end_date) === 'Expired' || 
                            (formatDeadline(quest.end_date) && formatDeadline(quest.end_date).includes('h left')) ? 'urgent' : ''}`}>
                            ⏰ {formatDeadline(quest.end_date)}
                        </div>
                    )}

                    <button 
                        className={getButtonClass()}
                        onClick={handleQuestAction}
                        disabled={isCompleted || questState === 'pending' || (quest.end_date && new Date(quest.end_date) < new Date())}
                        style={{
                            marginTop: '1rem',
                            cursor: (isCompleted || questState === 'pending' || (quest.end_date && new Date(quest.end_date) < new Date())) ? 'not-allowed' : 'pointer',
                            opacity: (isCompleted || questState === 'pending' || (quest.end_date && new Date(quest.end_date) < new Date())) ? 0.6 : 1,
                            width: '100%'
                        }}
                    >
                        {quest.end_date && new Date(quest.end_date) < new Date() ? 'Expired' : getButtonText()}
                    </button>
                </div>
            </div>

            {/* Screenshot upload handled by shared ScreenshotQuestInterface at parent level */}
        </>
    );
};

const QuestDashboard = () => {
    const [quests, setQuests] = useState([]);
    const [questTypes, setQuestTypes] = useState([]);
    const [userCompletions, setUserCompletions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('available');
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        category: ''
    });
    const [user, setUser] = useState(null);
    const [selectedScreenshotQuest, setSelectedScreenshotQuest] = useState(null);

    useEffect(() => {
        // Get user data from localStorage
        const userData = JSON.parse(localStorage.getItem('user'));
        setUser(userData);
        
        fetchQuestTypes();
        if (userData) {
            fetchQuests(userData);
            fetchUserCompletions(userData.id);
        }
    }, []);

    // Add listener for user updates (similar to TopNavbar)
    useEffect(() => {
        const handleUserUpdate = () => {
            const userData = JSON.parse(localStorage.getItem('user'));
            setUser(userData);
            if (userData) {
                fetchQuests(userData);
                fetchUserCompletions(userData.id);
            }
        };

        window.addEventListener('userUpdated', handleUserUpdate);
        return () => window.removeEventListener('userUpdated', handleUserUpdate);
    }, []);

    const fetchQuests = async (userData = user) => {
        setLoading(true);
        try {
            // Fetch both available quests and user completions
            const [questsResponse, completionsResponse] = await Promise.all([
                questAPI.getAvailableQuests(),
                userData?.id ? questAPI.getUserQuestCompletions(userData.id) : Promise.resolve({ data: { completions: [] } })
            ]);

            const availableQuests = questsResponse.data.quests || [];
            const userCompletions = completionsResponse.data?.completions || [];
            
            // Create a Set of completed quest IDs for quick lookup
            const completedQuestIds = new Set(userCompletions.map(completion => completion.quest_id));
            
            // Find completed quest IDs that are not in the available quests list
            const missingCompletedQuestIds = userCompletions
                .filter(completion => !availableQuests.find(quest => quest.id === completion.quest_id))
                .map(completion => completion.quest_id);
            
            // Fetch details for missing completed quests
            const missingQuestDetails = [];
            if (missingCompletedQuestIds.length > 0) {
                console.log('[QUEST_DASHBOARD] Fetching details for missing completed quests:', missingCompletedQuestIds);
                
                // Fetch each quest's details individually
                const questDetailsPromises = missingCompletedQuestIds.map(async (questId) => {
                    try {
                        const response = await questAPI.getPublicQuest(questId);
                        
                        // Extract quest data from nested response structure
                        const questData = response.data?.quest || response.quest || response.data || response;
                        return questData;
                    } catch (error) {
                        console.error(`[QUEST_DASHBOARD] Failed to fetch quest ${questId}:`, error);
                        return null;
                    }
                });
                
                const fetchedDetails = await Promise.all(questDetailsPromises);
                missingQuestDetails.push(...fetchedDetails.filter(quest => quest !== null));
                console.log('[QUEST_DASHBOARD] Successfully fetched quest details for completed quests');
            }
            
            // Create quest objects for completed quests using fetched details
            const completedQuestObjects = userCompletions
                .filter(completion => !availableQuests.find(quest => quest.id === completion.quest_id))
                .map(completion => {
                    const questDetails = missingQuestDetails.find(quest => quest.id === completion.quest_id);
                    
                    const questObject = {
                        id: completion.quest_id,
                        title: questDetails?.title || `Quest ${completion.quest_id}`,
                        description: questDetails?.description || 'Completed quest',
                        xp_reward: completion.xp_awarded || questDetails?.xp_reward || 0,
                        quest_type: questDetails?.quest_type || 'COMPLETED',
                        image_url: questDetails?.image_url || null,
                        target_url: questDetails?.target_url || null,
                        verification_method: questDetails?.verification_method || 'CLICK_VERIFY',
                        is_completed: true,
                        completed_at: completion.completed_at,
                        business_id: questDetails?.business_id || null,
                        // Add other quest properties that might be needed
                        is_published: false, // Completed quests are no longer published
                        is_archived: true,
                        is_active: false,
                        created_at: questDetails?.created_at || null,
                        updated_at: questDetails?.updated_at || null
                    };
                    
                    return questObject;
                });
            
            // Merge available quests with completed quest objects
            const allQuests = [
                ...availableQuests.map(quest => ({
                    ...quest,
                    is_completed: completedQuestIds.has(quest.id)
                })),
                ...completedQuestObjects
            ];

            console.log('[QUEST_DASHBOARD] Fetched quests:', allQuests);
            console.log('[QUEST_DASHBOARD] Available quests:', availableQuests.length);
            console.log('[QUEST_DASHBOARD] Completed quest objects:', completedQuestObjects.length);
            console.log('[QUEST_DASHBOARD] Total merged quests:', allQuests.length);
            
            setQuests(allQuests);
        } catch (error) {
            console.error('[QUEST_DASHBOARD] Error fetching quests:', error);
            toast.error('Failed to load quests');
        } finally {
            setLoading(false);
        }
    };

    const fetchQuestTypes = async () => {
        try {
            const response = await questAPI.getQuestTypes();
            const typesData = response.data?.quest_types || response.data || [];
            console.log('[QUEST_DASHBOARD] Fetched quest types:', typesData);
            setQuestTypes(Array.isArray(typesData) ? typesData : []);
        } catch (err) {
            console.error('Error fetching quest types:', err);
        }
    };

    const fetchUserCompletions = async (userId) => {
        try {
            const response = await questAPI.getUserQuestCompletions(userId);
            console.log('[QUEST_DASHBOARD] Raw user completions response:', response);
            
            // Handle different response structures
            let completionsData = [];
            if (response.data) {
                completionsData = response.data.completions || response.data || [];
            } else if (response.completions) {
                completionsData = response.completions;
            } else if (Array.isArray(response)) {
                completionsData = response;
            }
            
            console.log('[QUEST_DASHBOARD] Processed user completions:', completionsData);
            setUserCompletions(completionsData);
        } catch (error) {
            console.error('[QUEST_DASHBOARD] Error fetching completions:', error);
            setUserCompletions([]);
        }
    };

    const handleQuestComplete = async (quest, verificationData = {}) => {
        try {
            const response = await questAPI.completeQuest(quest.id, verificationData);
            
            // Refresh data after completion
            await Promise.all([
                fetchUserCompletions(user.id),
                fetchQuests(user)
            ]);

            // Show success message
            const xpAwarded = response.data?.xp_awarded || 0;
            toast.success(`Quest completed! You earned ${xpAwarded} XP!`);

            // Global XP event
            window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpAwarded } }));

            // Update localStorage user balance immediately for consistency
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
        // A quest is considered completed only when verified/awarded
        const matching = userCompletions.find(completion => {
            const completionQuestId = completion.quest_id || completion.questId || completion.id;
            return String(completionQuestId) === String(questId) || Number(completionQuestId) === Number(questId);
        });
        if (!matching) return false;
        const verificationStatus = matching.verification_status || matching.status;
        const xpStatus = matching.xp_status;
        return verificationStatus === 'VERIFIED' || xpStatus === 'AWARDED';
    };

    const getQuestCategories = () => {
        const categories = new Set();
        questTypes.forEach(type => {
            if (type.category) {
                categories.add(type.category);
            }
        });
        return Array.from(categories).sort();
    };

    // Filter quests based on tab, search, and filters
    const filteredQuests = quests.filter(quest => {
        const isCompleted = isQuestCompleted(quest.id);
        
        // Tab filter
        if (activeTab === 'completed' && !isCompleted) {
            return false;
        }
        if (activeTab === 'available' && isCompleted) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const searchTerm = searchQuery.toLowerCase();
            if (!quest.title.toLowerCase().includes(searchTerm)) {
                return false;
            }
        }

        // Category filter
        if (filters.category && filters.category !== quest.quest_type) {
            return false;
        }

        return true;
    });

    console.log(`[QUEST_DASHBOARD] Filtered quests for ${activeTab} tab:`, filteredQuests.length);

    return (
        <div className="app-layout">
            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="page-inner-container">
                    <div className="surveys-header">
                        <div className="surveys-header__left">
                            <div className="surveys-header__search">
                                <i className="ri-search-line"></i>
                                <input
                                    type="text"
                                    placeholder="Search Quests"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="surveys-subheader">
                        <div className="surveys-pills">
                            <button
                                className={`surveys-pill ${activeTab === 'available' ? 'active' : ''}`}
                                onClick={() => setActiveTab('available')}
                            >
                                Available
                            </button>
                            <button
                                className={`surveys-pill ${activeTab === 'completed' ? 'active' : ''}`}
                                onClick={() => setActiveTab('completed')}
                            >
                                Completed
                            </button>
                        </div>
                        
                        {/* Category filter only */}
                        <div style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            alignItems: 'center',
                            marginLeft: 'auto'
                        }}>
                            <select
                                value={filters.category}
                                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                                style={{
                                    background: '#1e1e1e',
                                    border: '1px solid #333',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    color: '#fff',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="">All Categories</option>
                                {getQuestCategories().map(category => (
                                    <option key={category} value={category}>
                                        {category.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="surveys-separator"></div>
                    
                    {activeTab === 'available' && (
                        loading ? (
                            <div className="loading-surveys">
                                <div className="user-loading-indicator">
                                    <div className="user-loading-spinner"></div>
                                    <p>Loading Quests...</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="empty-state">
                                <i className="ri-error-warning-line empty-state__icon" style={{ color: '#f44336' }}></i>
                                <h3 className="empty-state__title">Error Loading Quests</h3>
                                <p className="empty-state__message">{error}</p>
                                <button 
                                    onClick={fetchQuests}
                                    style={{
                                        background: '#aa2eff',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                        marginTop: '12px'
                                    }}
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredQuests.length > 0 ? (
                            <section className="cards-grid">
                                {filteredQuests.map((quest) => {
                                    const matching = userCompletions.find(c => {
                                        const completionQuestId = c.quest_id || c.questId || c.id;
                                        return String(completionQuestId) === String(quest.id) || Number(completionQuestId) === Number(quest.id);
                                    });
                                    const isPending = matching && ((matching.verification_status === 'PENDING') || (matching.xp_status === 'PENDING'));
                                    return (
                                        <QuestCard
                                            key={quest.id}
                                            quest={quest}
                                            onStart={handleQuestComplete}
                                            onStartScreenshot={(q) => setSelectedScreenshotQuest(q)}
                                            isCompleted={isQuestCompleted(quest.id)}
                                            isPending={isPending}
                                        />
                                    );
                                })}
                            </section>
                        ) : (
                            <div className="empty-state">
                                <i className="ri-treasure-map-line empty-state__icon"></i>
                                <h3 className="empty-state__title">No Quests Available</h3>
                                <p className="empty-state__message">
                                    {searchQuery || filters.category 
                                        ? 'Try adjusting your search or filters to see more quests.'
                                        : 'There are currently no quests available. Check back later for new quests!'
                                    }
                                </p>
                                {(searchQuery || filters.category) && (
                                    <button 
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilters({ category: '' });
                                        }}
                                        style={{
                                            background: '#aa2eff',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '8px 16px',
                                            cursor: 'pointer',
                                            marginTop: '12px'
                                        }}
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        )
                    )}

                    {activeTab === 'completed' && (
                        filteredQuests.length > 0 ? (
                            <section className="cards-grid">
                                {filteredQuests.map((quest) => {
                                    const matching = userCompletions.find(c => {
                                        const completionQuestId = c.quest_id || c.questId || c.id;
                                        return String(completionQuestId) === String(quest.id) || Number(completionQuestId) === Number(quest.id);
                                    });
                                    const isPending = matching && ((matching.verification_status === 'PENDING') || (matching.xp_status === 'PENDING'));
                                    return (
                                        <QuestCard
                                            key={quest.id}
                                            quest={quest}
                                            onStart={handleQuestComplete}
                                            isCompleted={isQuestCompleted(quest.id)}
                                            isPending={isPending}
                                        />
                                    );
                                })}
                            </section>
                        ) : (
                            <div className="empty-state">
                                <i className="ri-checkbox-circle-line empty-state__icon"></i>
                                <h3 className="empty-state__title">No Completed Quests</h3>
                                <p className="empty-state__message">Your completed quests will appear here.</p>
                            </div>
                        )
                    )}
                </div>
            </main>
            {selectedScreenshotQuest && (
                <ScreenshotQuestInterface
                    quest={selectedScreenshotQuest}
                    onClose={() => setSelectedScreenshotQuest(null)}
                    onComplete={async () => {
                        if (user?.id) {
                            try {
                                const response = await questAPI.getUserQuestCompletions(user.id);
                                setUserCompletions(response.data?.completions || []);
                            } catch (e) {
                                console.error('Error refreshing completions after screenshot:', e);
                            }
                        }
                    }}
                    user={user}
                />
            )}
        </div>
    );
};

export default QuestDashboard; 