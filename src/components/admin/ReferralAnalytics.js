import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { referralAdminAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BAdminTable from './ui/BAdminTable';
import BLoading from './ui/BLoading';

const ReferralAnalytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [tagAnalytics, setTagAnalytics] = useState(null);
    const [dateRange, setDateRange] = useState({
        start_date: '',
        end_date: ''
    });

    // Fetch analytics data
    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange.start_date) params.start_date = dateRange.start_date;
            if (dateRange.end_date) params.end_date = dateRange.end_date;
            
            const [analyticsResponse, tagAnalyticsResponse] = await Promise.all([
                referralAdminAPI.getReferralAnalytics(params),
                referralAdminAPI.getTagAnalytics()
            ]);
            
            setAnalytics(analyticsResponse.data.data);
            setTagAnalytics(tagAnalyticsResponse.data.data);
        } catch (error) {
            console.error("Error fetching analytics:", error);
            toast.error(error.response?.data?.error || 'Failed to load analytics.');
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    // Initial data fetch
    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // Handle date range change
    const handleDateRangeChange = (field, value) => {
        setDateRange(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Apply date filter
    const handleApplyFilter = () => {
        fetchAnalytics();
    };

    // Clear date filter
    const handleClearFilter = () => {
        setDateRange({
            start_date: '',
            end_date: ''
        });
    };

    // Format date helper
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-table-page b_admin_styling-main">
                    <BLoading variant="page" label="Loading referral analytics..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-table-page b_admin_styling-main">
                <div className="table-header-container">
                    <div className="table-header">
                        <h1 className="b_admin_styling-title">Referral Analytics</h1>
                        <p className="chat-subtitle">Detailed analytics and insights for the referral and affiliate system</p>
                    </div>
                    <BButton onClick={() => navigate('/admin/referrals/manage')} variant="secondary" size="sm">
                        <i className="ri-settings-line"></i> Manage System
                    </BButton>
                </div>

                {/* Date Range Filter */}
                <BFilterBar>
                    <BFilterControl label="Start Date" htmlFor="startDate">
                        <input
                            id="startDate"
                            type="date"
                            className="b_admin_styling-input b_admin_styling-input--compact"
                            value={dateRange.start_date}
                            onChange={(e) => handleDateRangeChange('start_date', e.target.value)}
                        />
                    </BFilterControl>
                    
                    <BFilterControl label="End Date" htmlFor="endDate">
                        <input
                            id="endDate"
                            type="date"
                            className="b_admin_styling-input b_admin_styling-input--compact"
                            value={dateRange.end_date}
                            onChange={(e) => handleDateRangeChange('end_date', e.target.value)}
                        />
                    </BFilterControl>
                    
                    <div className="filter-actions">
                        <BButton onClick={handleApplyFilter} variant="primary" size="sm">
                            Apply Filter
                        </BButton>
                        <BButton onClick={handleClearFilter} variant="secondary" size="sm">
                            Clear
                        </BButton>
                    </div>
                </BFilterBar>

                {analytics ? (
                    <>
                        {/* Statistics Cards */}
                        <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon">
                                    <i className="ri-user-add-line"></i>
                                </div>
                                <div className="admin-stat-content">
                                    <h3>{analytics.total_referrals || 0}</h3>
                                    <p>Total Referrals</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon">
                                    <i className="ri-links-line"></i>
                                </div>
                                <div className="admin-stat-content">
                                    <h3>{analytics.total_active_links || 0}</h3>
                                    <p>Active Affiliate Links</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon">
                                    <i className="ri-copper-coin-line"></i>
                                </div>
                                <div className="admin-stat-content">
                                    <h3>{(analytics.total_xp_awarded || 0).toLocaleString()}</h3>
                                    <p>Total XP Awarded</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon">
                                    <i className="ri-trophy-line"></i>
                                </div>
                                <div className="admin-stat-content">
                                    <h3>{analytics.top_referrers?.length || 0}</h3>
                                    <p>Active Referrers</p>
                                </div>
                            </div>
                        </div>

                        {/* Current Settings Display */}
                        {analytics.current_settings && (
                            <div className="b_admin_styling-section">
                                <h2 className="b_admin_styling-title">Current System Settings</h2>
                                <div className="settings-display">
                                    <div className="settings-grid">
                                        <div className="setting-display-item">
                                            <label>System Status</label>
                                            <span className={`status-badge ${analytics.current_settings.is_active ? 'active' : 'inactive'}`}>
                                                {analytics.current_settings.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="setting-display-item">
                                            <label>Referrer Reward XP</label>
                                            <span>{analytics.current_settings.user_reward_xp || 0}</span>
                                        </div>
                                        <div className="setting-display-item">
                                            <label>New User Bonus XP</label>
                                            <span>{analytics.current_settings.new_user_bonus_xp || 0}</span>
                                        </div>
                                        <div className="setting-display-item">
                                            <label>XP Cap per User</label>
                                            <span>{(analytics.current_settings.user_xp_cap || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top Referrers */}
                        {analytics.top_referrers && analytics.top_referrers.length > 0 && (
                            <div className="admin-table-container">
                                <h2 className="b_admin_styling-title">Top Referrers</h2>
                                <table className="b_admin_styling-table">
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>User</th>
                                            <th>Email</th>
                                            <th>Total Referrals</th>
                                            <th>XP Earned</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.top_referrers.map((referrer, index) => (
                                            <tr key={referrer.user_id}>
                                                <td>
                                                    <div className="rank-badge">
                                                        #{index + 1}
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>{referrer.name}</strong>
                                                </td>
                                                <td>{referrer.email}</td>
                                                <td>
                                                    <span className="referral-count">
                                                        {referrer.referral_count || 0}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="xp-earned">
                                                        {(referrer.xp_earned || 0).toLocaleString()} XP
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Tag Analytics */}
                        {tagAnalytics && tagAnalytics.tags && tagAnalytics.tags.length > 0 && (
                            <div className="admin-table-container">
                                <h2 className="b_admin_styling-title">Tag Analytics</h2>
                                <p className="table-description">Users and conversions by assigned tags</p>
                                <table className="b_admin_styling-table">
                                    <thead>
                                        <tr>
                                            <th>Tag</th>
                                            <th>Total Users</th>
                                            <th>Total Conversions</th>
                                            <th>Total XP Awarded</th>
                                            <th>Affiliate Links</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tagAnalytics.tags.map((tagData) => (
                                            <tr key={tagData.tag}>
                                                <td>
                                                    <span className="tag-badge">{tagData.tag}</span>
                                                </td>
                                                <td>
                                                    <strong>{tagData.user_count || 0}</strong>
                                                </td>
                                                <td>{tagData.total_conversions || 0}</td>
                                                <td>
                                                    <span className="xp-earned">
                                                        {(tagData.total_xp_awarded || 0).toLocaleString()} XP
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="affiliate-links-list">
                                                        {tagData.affiliate_links && tagData.affiliate_links.length > 0 ? (
                                                            tagData.affiliate_links.map((link, idx) => (
                                                                <span key={idx} className="affiliate-link-item" title={`${link.conversions} conversions`}>
                                                                    {link.name}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* No Data State */}
                        {(!analytics.top_referrers || analytics.top_referrers.length === 0) && (!tagAnalytics || !tagAnalytics.tags || tagAnalytics.tags.length === 0) && (
                            <div className="admin-table-container">
                                <div className="admin-empty-state">
                                    <i className="ri-user-add-line"></i>
                                    <h3>No Referral Data Yet</h3>
                                    <p>Once users start referring friends, their statistics will appear here.</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="admin-table-container">
                        <div className="admin-empty-state">
                            <i className="ri-error-warning-line"></i>
                            <h3>Failed to Load Analytics</h3>
                            <p>There was an error loading the referral analytics data.</p>
                            <BButton onClick={fetchAnalytics} variant="primary">
                                Retry
                            </BButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReferralAnalytics;
