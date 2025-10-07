import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { leaderboardAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';

const LeaderboardManagement = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        is_enabled: true,
        active_timeframe: 'ALL_TIME',
        display_count: 25
    });
    const [cacheStatus, setCacheStatus] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [userLookupId, setUserLookupId] = useState('');
    const [userRankData, setUserRankData] = useState(null);
    const [lookingUpUser, setLookingUpUser] = useState(false);

    // Timeframe options
    const timeframeOptions = [
        { value: 'ALL_TIME', label: 'All-Time' },
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'WEEKLY', label: 'Weekly' },
        { value: 'DAILY', label: 'Daily' }
    ];

    // Display count options
    const displayCountOptions = [
        { value: 10, label: 'Top 10' },
        { value: 25, label: 'Top 25' },
        { value: 50, label: 'Top 50' },
        { value: 100, label: 'Top 100' }
    ];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [settingsResponse, cacheResponse] = await Promise.all([
                leaderboardAPI.admin.getSettings(),
                leaderboardAPI.admin.getCacheStatus()
            ]);

            setSettings(settingsResponse.data);
            setCacheStatus(cacheResponse.data);
        } catch (error) {
            console.error("Error fetching leaderboard data:", error);
            toast.error(error.response?.data?.error || 'Failed to load leaderboard data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSettingsChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSaveSettings = async () => {
        const toastId = toast.loading('Saving settings...');
        try {
            const response = await leaderboardAPI.admin.updateSettings(settings);
            setSettings(response.data.settings);
            toast.success('Settings saved successfully!', { id: toastId });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error(error.response?.data?.error || 'Failed to save settings.', { id: toastId });
        }
    };

    const handleRefreshCache = async () => {
        if (!window.confirm('Are you sure? This may take a few moments and will recalculate all leaderboards.')) {
            return;
        }

        setRefreshing(true);
        const toastId = toast.loading('Refreshing leaderboard cache...');
        
        try {
            const response = await leaderboardAPI.admin.refreshCache();
            
            if (response.data.success) {
                toast.success('Leaderboard cache refreshed successfully!', { id: toastId });
                // Refresh cache status
                const cacheResponse = await leaderboardAPI.admin.getCacheStatus();
                setCacheStatus(cacheResponse.data);
            } else {
                toast.error(response.data.error || 'Failed to refresh cache.', { id: toastId });
            }
        } catch (error) {
            console.error("Error refreshing cache:", error);
            toast.error(error.response?.data?.error || 'Failed to refresh cache.', { id: toastId });
        } finally {
            setRefreshing(false);
        }
    };

    const handleUserLookup = async () => {
        if (!userLookupId.trim()) {
            toast.error('Please enter a user ID');
            return;
        }

        setLookingUpUser(true);
        try {
            const response = await leaderboardAPI.admin.getUserRank(parseInt(userLookupId));
            setUserRankData(response.data);
        } catch (error) {
            console.error("Error looking up user:", error);
            if (error.response?.status === 404) {
                toast.error('User not found');
            } else {
                toast.error(error.response?.data?.error || 'Failed to lookup user.');
            }
            setUserRankData(null);
        } finally {
            setLookingUpUser(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'Never';
        const now = new Date();
        const date = new Date(timestamp);
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
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 b_admin_styling-main">
                    <BLoading variant="page" label="Loading leaderboard management..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 b_admin_styling-main" style={{ paddingRight: '25px' }}>
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">Leaderboard Management</h1>
                        <p className="chat-subtitle" style={{ margin: 0 }}>
                            Configure and manage the XP leaderboard system.
                        </p>
                    </div>
                </div>

                {/* Global Leaderboard Settings */}
                <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                    <div className="b_admin_styling-card__header">
                        <h2 className="b_admin_styling-card__title">Global Leaderboard Settings</h2>
                        <p className="b_admin_styling-card__subtitle">
                            Control the overall leaderboard visibility and behavior.
                        </p>
                    </div>
                    <div className="b_admin_styling-card__content">
                        <div className="b_admin_styling-form-group">
                            <label className="b_admin_styling-label">
                                <input
                                    type="checkbox"
                                    checked={settings.is_enabled}
                                    onChange={(e) => handleSettingsChange('is_enabled', e.target.checked)}
                                    className="b_admin_styling-checkbox"
                                />
                                <span className="b_admin_styling-checkbox-label">Enable XP Leaderboard</span>
                            </label>
                            <p className="b_admin_styling-help-text">
                                When disabled, the leaderboard will not be visible to users.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Public Display Configuration */}
                <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                    <div className="b_admin_styling-card__header">
                        <h2 className="b_admin_styling-card__title">Public Display Configuration</h2>
                        <p className="b_admin_styling-card__subtitle">
                            Configure what users see on the main leaderboard page.
                        </p>
                    </div>
                    <div className="b_admin_styling-card__content">
                        <div className="b_admin_styling-form-row">
                            <div className="b_admin_styling-form-group">
                                <label className="b_admin_styling-label" htmlFor="timeframe">
                                    Default Timeframe
                                </label>
                                <select
                                    id="timeframe"
                                    value={settings.active_timeframe}
                                    onChange={(e) => handleSettingsChange('active_timeframe', e.target.value)}
                                    className="b_admin_styling-select"
                                >
                                    {timeframeOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="b_admin_styling-help-text">
                                    The default timeframe shown to users when they visit the leaderboard.
                                </p>
                            </div>

                            <div className="b_admin_styling-form-group">
                                <label className="b_admin_styling-label" htmlFor="displayCount">
                                    Number of Users to Display
                                </label>
                                <select
                                    id="displayCount"
                                    value={settings.display_count}
                                    onChange={(e) => handleSettingsChange('display_count', parseInt(e.target.value))}
                                    className="b_admin_styling-select"
                                >
                                    {displayCountOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="b_admin_styling-help-text">
                                    How many top users to show on the leaderboard.
                                </p>
                            </div>
                        </div>

                        <div className="b_admin_styling-form-actions">
                            <BButton onClick={handleSaveSettings} variant="primary">
                                <i className="ri-save-line"></i> Save Settings
                            </BButton>
                        </div>
                    </div>
                </div>

                {/* Cache Management & Status */}
                <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                    <div className="b_admin_styling-card__header">
                        <h2 className="b_admin_styling-card__title">Cache Management & Status</h2>
                        <p className="b_admin_styling-card__subtitle">
                            Monitor and control the leaderboard data refresh process.
                        </p>
                    </div>
                    <div className="b_admin_styling-card__content">
                        <div className="b_admin_styling-form-row">
                            <div className="b_admin_styling-form-group">
                                <label className="b_admin_styling-label">Last Cache Refresh</label>
                                <div className="b_admin_styling-status-display">
                                    <span className="b_admin_styling-status-value">
                                        {formatTimestamp(cacheStatus?.last_refresh)}
                                    </span>
                                    <span className="b_admin_styling-status-meta">
                                        ({formatTimeAgo(cacheStatus?.last_refresh)})
                                    </span>
                                </div>
                            </div>

                            <div className="b_admin_styling-form-group">
                                <label className="b_admin_styling-label">Cache Actions</label>
                                <BButton 
                                    onClick={handleRefreshCache} 
                                    variant="secondary"
                                    disabled={refreshing}
                                >
                                    {refreshing ? (
                                        <>
                                            <i className="ri-loader-4-line spinning"></i> Refreshing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ri-refresh-line"></i> Refresh Cache Now
                                        </>
                                    )}
                                </BButton>
                                <p className="b_admin_styling-help-text">
                                    Manually trigger a complete leaderboard recalculation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Diagnostics & Troubleshooting */}
                <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                    <div className="b_admin_styling-card__header">
                        <h2 className="b_admin_styling-card__title">Diagnostics & Troubleshooting</h2>
                        <p className="b_admin_styling-card__subtitle">
                            Advanced tools for monitoring data integrity and user support.
                        </p>
                    </div>
                    <div className="b_admin_styling-card__content">
                        {/* Cache Status Table */}
                        <div className="b_admin_styling-form-group" style={{ marginBottom: '32px' }}>
                            <label className="b_admin_styling-label">Cached Entries per Timeframe</label>
                            <div className="b_admin_styling-table-container">
                                <table className="b_admin_styling-table">
                                    <thead>
                                        <tr>
                                            <th>Timeframe</th>
                                            <th>Cached User Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cacheStatus?.cache_counts && Object.entries(cacheStatus.cache_counts).map(([timeframe, count]) => (
                                            <tr key={timeframe}>
                                                <td>{timeframeOptions.find(opt => opt.value === timeframe)?.label || timeframe}</td>
                                                <td>{count.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr className="b_admin_styling-table-total">
                                            <td><strong>Total</strong></td>
                                            <td><strong>{cacheStatus?.total_cached_entries?.toLocaleString() || 0}</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* User Rank Lookup Tool */}
                        <div className="b_admin_styling-form-group">
                            <label className="b_admin_styling-label" htmlFor="userLookup">
                                User Rank Lookup Tool
                            </label>
                            <div className="b_admin_styling-input-group">
                                <input
                                    id="userLookup"
                                    type="number"
                                    placeholder="Enter User ID..."
                                    value={userLookupId}
                                    onChange={(e) => setUserLookupId(e.target.value)}
                                    className="b_admin_styling-input"
                                />
                                <BButton 
                                    onClick={handleUserLookup} 
                                    variant="secondary"
                                    disabled={lookingUpUser}
                                >
                                    {lookingUpUser ? (
                                        <>
                                            <i className="ri-loader-4-line spinning"></i> Searching...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ri-search-line"></i> Search
                                        </>
                                    )}
                                </BButton>
                            </div>
                            <p className="b_admin_styling-help-text">
                                Look up a specific user's rank across all timeframes for support purposes.
                            </p>

                            {/* User Rank Results */}
                            {userRankData && (
                                <div className="b_admin_styling-user-rank-results">
                                    <h4 className="b_admin_styling-results-title">
                                        User Rank Results (ID: {userRankData.user_id})
                                    </h4>
                                    <div className="b_admin_styling-rank-grid">
                                        {Object.entries(userRankData.ranks).map(([timeframe, rankData]) => (
                                            <div key={timeframe} className="b_admin_styling-rank-card">
                                                <div className="b_admin_styling-rank-timeframe">
                                                    {timeframeOptions.find(opt => opt.value === timeframe)?.label || timeframe}
                                                </div>
                                                {rankData ? (
                                                    <>
                                                        <div className="b_admin_styling-rank-position">
                                                            Rank #{rankData.rank}
                                                        </div>
                                                        <div className="b_admin_styling-rank-xp">
                                                            {rankData.total_xp.toLocaleString()} XP
                                                        </div>
                                                        {rankData.user && (
                                                            <div className="b_admin_styling-rank-user">
                                                                {rankData.user.name || rankData.user.username}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="b_admin_styling-rank-not-ranked">
                                                        Not Ranked
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaderboardManagement;
