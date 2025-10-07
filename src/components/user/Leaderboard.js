import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaderboardAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';
import '../../styles/Leaderboard.css';

const Leaderboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('ALL_TIME');
    const [leaderboardStatus, setLeaderboardStatus] = useState(null);

    // Timeframe options
    const timeframeOptions = [
        { value: 'ALL_TIME', label: 'All-Time', icon: '🏆' },
        { value: 'MONTHLY', label: 'Monthly', icon: '📅' },
        { value: 'WEEKLY', label: 'Weekly', icon: '📊' },
        { value: 'DAILY', label: 'Daily', icon: '⚡' }
    ];

    const fetchLeaderboardData = useCallback(async () => {
        setLoading(true);
        try {
            console.log('[LEADERBOARD] Fetching leaderboard data for timeframe:', selectedTimeframe);
            const response = await leaderboardAPI.getLeaderboard();
            
            if (response.data) {
                setLeaderboardData(response.data);
                console.log('[LEADERBOARD] Data loaded:', response.data);
                
                // If user is logged in, also fetch their rank for the selected timeframe
                if (currentUser) {
                    try {
                        const rankResponse = await leaderboardAPI.getMyRank(selectedTimeframe);
                        if (rankResponse.data?.user_rank) {
                            // Update the current user rank in the leaderboard data
                            setLeaderboardData(prev => ({
                                ...prev,
                                current_user_rank: rankResponse.data.user_rank
                            }));
                        }
                    } catch (rankError) {
                        console.log('[LEADERBOARD] Could not fetch user rank:', rankError);
                        // Not a critical error, continue without user rank
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            if (error.response?.data?.is_enabled === false) {
                toast.error('Leaderboard is currently disabled');
            } else {
                toast.error('Failed to load leaderboard data');
            }
        } finally {
            setLoading(false);
        }
    }, [selectedTimeframe, currentUser]);

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user'));
        setCurrentUser(userData);
        fetchLeaderboardStatus();
    }, []);

    useEffect(() => {
        fetchLeaderboardData();
    }, [fetchLeaderboardData]);

    const fetchLeaderboardStatus = async () => {
        try {
            const response = await leaderboardAPI.getLeaderboardStatus();
            setLeaderboardStatus(response.data);
        } catch (error) {
            console.error('Error fetching leaderboard status:', error);
        }
    };

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) {
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjY2NjYiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+CjxwYXRoIGQ9Ik0xMiAyQzEzLjEgMiAxNCAyLjkgMTQgNEMxNCA1LjEgMTMuMSA2IDEyIDZDMTAuOSA2IDEwIDUuMSAxMCA0QzEwIDIuOSAxMC45IDIgMTIgMlpNMjEgOVYyMkgxOVYxNkgxM1YyMkgxMVY5QzExIDguNDUgMTEuNDUgOCAxMiA4SDE4QzE4LjU1IDggMTkgOC40NSAxOSA5WiIvPgo8L3N2Zz4KPC9zdmc+";
        }
        
        if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
            return relativeOrAbsoluteUrl;
        }
        
        const cleanPath = relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
        return `${baseURL}${cleanPath}`;
    };

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    const formatLastUpdated = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    if (loading) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="loading-surveys">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Leaderboard...</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!leaderboardData || leaderboardData.error) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="empty-state">
                            <i className="ri-trophy-line empty-state__icon"></i>
                            <h3 className="empty-state__title">Leaderboard Unavailable</h3>
                            <p className="empty-state__message">
                                {leaderboardData?.error || 'The leaderboard is currently being updated. Please try again in a few minutes.'}
                            </p>
                            <button 
                                className="button button--primary"
                                onClick={() => fetchLeaderboardData()}
                            >
                                <i className="ri-refresh-line"></i>
                                Try Again
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const { top_users, current_user_rank, timeframe, last_updated } = leaderboardData;

    return (
        <div className="app-layout">
            <main className="main-content12 full-height">
                <div className="page-inner-container">
                    {/* Header Section */}
                    <div className="surveys-header">
                        <div className="surveys-header__left">
                            <div className="leaderboard-header-info">
                                <h1 className="page-title">
                                    <i className="ri-trophy-line"></i>
                                    XP Leaderboard
                                </h1>
                                <p className="page-subtitle">
                                    Compete with other users and climb the ranks by earning XP!
                                </p>
                            </div>
                        </div>
                        <div className="surveys-header__right">
                            {last_updated && (
                                <div className="leaderboard-last-updated">
                                    <i className="ri-time-line"></i>
                                    Updated {formatLastUpdated(last_updated)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="surveys-separator"></div>

                    {/* Timeframe Selection */}
                    <div className="dashboard-section" style={{ marginBottom: '24px' }}>
                        <div className="dashboard-section__header">
                            <div className="dashboard-section__title">
                                <i className="ri-calendar-line"></i>
                                <h3>Timeframe</h3>
                            </div>
                        </div>
                        <div className="dashboard-section__content">
                            <div className="timeframe-selector">
                                {timeframeOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        className={`timeframe-button ${selectedTimeframe === option.value ? 'active' : ''}`}
                                        onClick={() => setSelectedTimeframe(option.value)}
                                    >
                                        <span className="timeframe-icon">{option.icon}</span>
                                        <span className="timeframe-label">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Current User Rank (if available) */}
                    {current_user_rank && (
                        <div className="dashboard-section" style={{ marginBottom: '24px' }}>
                            <div className="dashboard-section__header">
                                <div className="dashboard-section__title">
                                    <i className="ri-user-star-line"></i>
                                    <h3>Your Rank</h3>
                                </div>
                            </div>
                            <div className="dashboard-section__content">
                                <div className="current-user-rank">
                                    <div className="rank-card user-rank-card">
                                        <div className="rank-position">
                                            <span className="rank-number">{getRankIcon(current_user_rank.rank)}</span>
                                        </div>
                                        <div className="rank-user-info">
                                            <div className="rank-avatar">
                                                {current_user_rank.user.profile_image_url ? (
                                                    <img 
                                                        src={getFullImageUrl(current_user_rank.user.profile_image_url)} 
                                                        alt={current_user_rank.user.name || current_user_rank.user.username}
                                                        onError={(e) => {
                                                            e.target.src = getFullImageUrl(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="rank-avatar-fallback">
                                                        {(current_user_rank.user.name || current_user_rank.user.username || 'U')[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="rank-user-details">
                                                <h4 className="rank-username">{current_user_rank.user.name || current_user_rank.user.username}</h4>
                                                <div className="rank-stats">
                                                    <span className="rank-xp">✨ {current_user_rank.total_xp.toLocaleString()} XP</span>
                                                    {current_user_rank.user.highest_badge && (
                                                        <div className="rank-badge">
                                                            <img 
                                                                src={getFullImageUrl(current_user_rank.user.highest_badge.image_url)} 
                                                                alt={current_user_rank.user.highest_badge.name}
                                                                className="badge-icon"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                            <span>{current_user_rank.user.highest_badge.name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Users Leaderboard */}
                    <div className="dashboard-section">
                        <div className="dashboard-section__header">
                            <div className="dashboard-section__title">
                                <i className="ri-trophy-line"></i>
                                <h3>Top Users</h3>
                            </div>
                            <div className="leaderboard-info">
                                <span className="timeframe-display">
                                    {timeframeOptions.find(opt => opt.value === timeframe)?.label || timeframe}
                                </span>
                            </div>
                        </div>
                        <div className="dashboard-section__content">
                            {top_users && top_users.length > 0 ? (
                                <div className="leaderboard-list">
                                    {top_users.map((entry, index) => (
                                        <div key={entry.user.id} className={`rank-card ${index < 3 ? 'top-three' : ''} ${entry.user.id === currentUser?.id ? 'current-user' : ''}`}>
                                            <div className="rank-position">
                                                <span className="rank-number">{getRankIcon(entry.rank)}</span>
                                            </div>
                                            <div className="rank-user-info">
                                                <div className="rank-avatar">
                                                    {entry.user.profile_image_url ? (
                                                        <img 
                                                            src={getFullImageUrl(entry.user.profile_image_url)} 
                                                            alt={entry.user.name || entry.user.username}
                                                            onError={(e) => {
                                                                e.target.src = getFullImageUrl(null);
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="rank-avatar-fallback">
                                                            {(entry.user.name || entry.user.username || 'U')[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="rank-user-details">
                                                    <h4 className="rank-username">{entry.user.name || entry.user.username}</h4>
                                                    <div className="rank-stats">
                                                        <span className="rank-xp">✨ {entry.total_xp.toLocaleString()} XP</span>
                                                        {entry.user.highest_badge && (
                                                            <div className="rank-badge">
                                                                <img 
                                                                    src={getFullImageUrl(entry.user.highest_badge.image_url)} 
                                                                    alt={entry.user.highest_badge.name}
                                                                    className="badge-icon"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                    }}
                                                                />
                                                                <span>{entry.user.highest_badge.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="dashboard-section__empty">
                                    <i className="ri-trophy-line"></i>
                                    <p>No leaderboard data available for this timeframe</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Leaderboard;
