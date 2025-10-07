import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { dailyRewardAPI, marketplaceAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BAdminTable from './ui/BAdminTable';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const AdminDailyRewardsDashboard = () => {
    const navigate = useNavigate();
    const [configurations, setConfigurations] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);

    const fetchConfigurations = useCallback(async () => {
        setLoading(true);
        try {
            const response = await dailyRewardAPI.adminGetWeekConfigurations();
            setConfigurations(response.data.configurations || []);
        } catch (error) {
            console.error("Error fetching configurations:", error);
            toast.error(error.response?.data?.error || 'Failed to load week configurations.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            const response = await dailyRewardAPI.adminGetDailyRewardAnalytics();
            setAnalytics(response.data.analytics || {});
        } catch (error) {
            console.error("Error fetching analytics:", error);
            // Don't show error toast for analytics as it's not critical
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigurations();
        fetchAnalytics();
    }, [fetchConfigurations, fetchAnalytics]);

    const handleActivateConfiguration = async (configId, weekIdentifier) => {
        if (window.confirm(`Are you sure you want to activate '${weekIdentifier}'? This will become the live reward calendar for all users.`)) {
            const toastId = toast.loading(`Activating ${weekIdentifier}...`);
            try {
                await dailyRewardAPI.adminActivateWeekConfiguration(configId);
                toast.success(`"${weekIdentifier}" is now active!`, { id: toastId });
                fetchConfigurations(); // Refresh the list
            } catch (error) {
                console.error("Error activating configuration:", error);
                toast.error(error.response?.data?.error || `Failed to activate "${weekIdentifier}".`, { id: toastId });
            }
        }
    };

    const handleDeleteConfiguration = async (configId, weekIdentifier, isActive) => {
        if (isActive) {
            toast.error('Cannot delete the active configuration. Please activate another configuration first.');
            return;
        }

        if (window.confirm(`Are you sure you want to delete the configuration "${weekIdentifier}"? This action cannot be undone.`)) {
            const toastId = toast.loading(`Deleting ${weekIdentifier}...`);
            try {
                await dailyRewardAPI.adminDeleteWeekConfiguration(configId);
                toast.success(`"${weekIdentifier}" deleted successfully.`, { id: toastId });
                fetchConfigurations(); // Refresh the list
            } catch (error) {
                console.error("Error deleting configuration:", error);
                toast.error(error.response?.data?.error || `Failed to delete "${weekIdentifier}".`, { id: toastId });
            }
        }
    };

    const handleEditConfiguration = (configId) => {
        navigate(`/admin/daily-rewards/edit/${configId}`);
    };

    const handleDuplicateConfiguration = (configId) => {
        navigate(`/admin/daily-rewards/duplicate/${configId}`);
    };

    const filteredConfigurations = configurations.filter(config => 
        config.week_identifier.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatBonusReward = (config) => {
        if (!config.bonus_reward || !config.bonus_reward.type) {
            return 'None';
        }

        if (config.bonus_reward.type === 'XP') {
            return `💰 ${config.bonus_reward.xp_amount} XP`;
        } else if (config.bonus_reward.type === 'RAFFLE_ENTRY') {
            return `🎟️ ${config.bonus_reward.raffle_item_title || 'Raffle Entry'}`;
        }

        return 'Unknown';
    };

    const getStatusBadge = (isActive) => {
        return isActive ? (
            <span className="b_admin_styling-badge b_admin_styling-badge--success">Active</span>
        ) : (
            <span className="b_admin_styling-badge b_admin_styling-badge--secondary">Inactive</span>
        );
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 b_admin_styling-main" style={{ paddingRight: '25px' }}>
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">Daily Rewards Management</h1>
                        <p className="chat-subtitle" style={{ margin: 0 }}>Manage weekly reward configurations and monitor system analytics.</p>
                    </div>
                    <BButton onClick={() => navigate('/admin/daily-rewards/create')} variant="primary" size="sm">
                        <i className="ri-add-line"></i> Create New Week Configuration
                    </BButton>
                </div>

                {/* Analytics Overview */}
                {!analyticsLoading && analytics && (
                    <div className="b_admin_styling-analytics-grid" style={{ marginBottom: '24px' }}>
                        <div className="b_admin_styling-analytics-card">
                            <div className="b_admin_styling-analytics-card__icon">
                                <i className="ri-calendar-check-line"></i>
                            </div>
                            <div className="b_admin_styling-analytics-card__content">
                                <div className="b_admin_styling-analytics-card__value">
                                    {analytics.total_claims || 0}
                                </div>
                                <div className="b_admin_styling-analytics-card__label">Total Claims</div>
                            </div>
                        </div>

                        <div className="b_admin_styling-analytics-card">
                            <div className="b_admin_styling-analytics-card__icon">
                                <i className="ri-fire-line"></i>
                            </div>
                            <div className="b_admin_styling-analytics-card__content">
                                <div className="b_admin_styling-analytics-card__value">
                                    {analytics.unique_users || 0}
                                </div>
                                <div className="b_admin_styling-analytics-card__label">Active Users</div>
                            </div>
                        </div>

                        <div className="b_admin_styling-analytics-card">
                            <div className="b_admin_styling-analytics-card__icon">
                                <i className="ri-line-chart-line"></i>
                            </div>
                            <div className="b_admin_styling-analytics-card__content">
                                <div className="b_admin_styling-analytics-card__value">
                                    {analytics.streak_stats?.average_streak ? Math.round(analytics.streak_stats.average_streak * 10) / 10 : 0}
                                </div>
                                <div className="b_admin_styling-analytics-card__label">Avg Streak</div>
                            </div>
                        </div>

                        <div className="b_admin_styling-analytics-card">
                            <div className="b_admin_styling-analytics-card__icon">
                                <i className="ri-refresh-line"></i>
                            </div>
                            <div className="b_admin_styling-analytics-card__content">
                                <div className="b_admin_styling-analytics-card__value">
                                    {analytics.recovery_claims || 0}
                                </div>
                                <div className="b_admin_styling-analytics-card__label">Recoveries</div>
                                <div className="b_admin_styling-analytics-card__subtitle">
                                    {analytics.recovery_rate ? `${Math.round(analytics.recovery_rate)}% rate` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <BFilterBar>
                    <BFilterControl label="Search" htmlFor="configSearch">
                        <input
                            id="configSearch"
                            type="text"
                            className="b_admin_styling-input b_admin_styling-input--compact"
                            placeholder="Search by week identifier..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </BFilterControl>
                </BFilterBar>

                {loading ? (
                    <BLoading variant="page" label="Loading configurations..." />
                ) : (
                    <BAdminTable headers={["Week Identifier", "Status", "Recovery Cost", "Weekly Freezes", "Completion Bonus", "Daily Rewards", "Actions"]}>
                        {filteredConfigurations.length > 0 ? filteredConfigurations.map((config) => (
                            <tr key={config.id}>
                                <td>
                                    <div className="b_admin_styling-table__primary">
                                        {config.week_identifier}
                                    </div>
                                    <div className="b_admin_styling-table__secondary">
                                        Created {new Date(config.created_at).toLocaleDateString()}
                                    </div>
                                </td>
                                <td>{getStatusBadge(config.is_active)}</td>
                                <td>
                                    <span className="b_admin_styling-table__highlight">
                                        {config.recovery_xp_cost} XP
                                    </span>
                                </td>
                                <td>
                                    <span className="b_admin_styling-table__highlight">
                                        {config.weekly_freeze_count}
                                    </span>
                                </td>
                                <td>{formatBonusReward(config)}</td>
                                <td>
                                    <span className="b_admin_styling-table__highlight">
                                        {config.daily_rewards_count}/7 days
                                    </span>
                                </td>
                                <td className="b_admin_styling-table__actions">
                                    <BKebabMenu
                                      isOpen={openMenuId === config.id}
                                      onToggle={() => setOpenMenuId(openMenuId === config.id ? null : config.id)}
                                      items={[
                                        !config.is_active && { 
                                          label: 'Activate', 
                                          icon: 'ri-play-circle-line', 
                                          onClick: () => { 
                                            setOpenMenuId(null); 
                                            handleActivateConfiguration(config.id, config.week_identifier); 
                                          } 
                                        },
                                        { 
                                          label: 'Edit', 
                                          icon: 'ri-edit-line', 
                                          onClick: () => { 
                                            setOpenMenuId(null); 
                                            handleEditConfiguration(config.id); 
                                          } 
                                        },
                                        { 
                                          label: 'Duplicate', 
                                          icon: 'ri-file-copy-line', 
                                          onClick: () => { 
                                            setOpenMenuId(null); 
                                            handleDuplicateConfiguration(config.id); 
                                          } 
                                        },
                                        !config.is_active && { 
                                          label: 'Delete', 
                                          icon: 'ri-delete-bin-line', 
                                          danger: true, 
                                          onClick: () => { 
                                            setOpenMenuId(null); 
                                            handleDeleteConfiguration(config.id, config.week_identifier, config.is_active); 
                                          } 
                                        }
                                      ].filter(Boolean)}
                                    />
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="7" className="admin-empty-state">
                                    <div className="b_admin_styling-empty-state">
                                        <i className="ri-calendar-line"></i>
                                        <h3>No Week Configurations</h3>
                                        <p>Create your first week configuration to get started with the daily rewards system.</p>
                                        <BButton onClick={() => navigate('/admin/daily-rewards/create')} variant="primary" size="sm">
                                            <i className="ri-add-line"></i> Create Configuration
                                        </BButton>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </BAdminTable>
                )}
            </div>
        </div>
    );
};

export default AdminDailyRewardsDashboard;
