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
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';
import AffiliateModal from './AffiliateModal';

const ManageReferrals = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [affiliateLinksLoading, setAffiliateLinksLoading] = useState(false);
    
    // Analytics data
    const [analytics, setAnalytics] = useState(null);
    
    // Settings data
    const [settings, setSettings] = useState({
        user_reward_xp: 50,
        new_user_bonus_xp: 50,
        user_xp_cap: 5000,
        is_active: true
    });
    
    // Affiliate links data
    const [affiliateLinks, setAffiliateLinks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [openMenuId, setOpenMenuId] = useState(null);
    
    // Modal state
    const [showAffiliateModal, setShowAffiliateModal] = useState(false);
    const [editingAffiliate, setEditingAffiliate] = useState(null);

    // Fetch analytics data
    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            const response = await referralAdminAPI.getReferralAnalytics();
            setAnalytics(response.data.data);
        } catch (error) {
            console.error("Error fetching analytics:", error);
            toast.error(error.response?.data?.error || 'Failed to load analytics.');
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    // Fetch settings data
    const fetchSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const response = await referralAdminAPI.getReferralSettings();
            setSettings(response.data.data);
        } catch (error) {
            console.error("Error fetching settings:", error);
            toast.error(error.response?.data?.error || 'Failed to load settings.');
        } finally {
            setSettingsLoading(false);
        }
    }, []);

    // Fetch affiliate links
    const fetchAffiliateLinks = useCallback(async (page = 1) => {
        setAffiliateLinksLoading(true);
        try {
            const params = {
                page,
                per_page: 20,
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter && { status: statusFilter })
            };
            
            const response = await referralAdminAPI.listAffiliateLinks(params);
            const data = response.data.data;
            
            setAffiliateLinks(data.links || []);
            setCurrentPage(data.page || 1);
            setTotalPages(data.total_pages || 1);
        } catch (error) {
            console.error("Error fetching affiliate links:", error);
            toast.error(error.response?.data?.error || 'Failed to load affiliate links.');
        } finally {
            setAffiliateLinksLoading(false);
        }
    }, [searchTerm, statusFilter]);

    // Initial data fetch
    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            await Promise.all([
                fetchAnalytics(),
                fetchSettings(),
                fetchAffiliateLinks()
            ]);
            setLoading(false);
        };

        fetchAllData();
    }, [fetchAnalytics, fetchSettings, fetchAffiliateLinks]);

    // Refetch affiliate links when filters change
    useEffect(() => {
        if (!loading) {
            fetchAffiliateLinks(1);
            setCurrentPage(1);
        }
    }, [searchTerm, statusFilter, fetchAffiliateLinks, loading]);

    // Handle settings update
    const handleSettingsUpdate = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Updating referral settings...');
        
        try {
            await referralAdminAPI.updateReferralSettings(settings);
            toast.success('Referral settings updated successfully!', { id: toastId });
            fetchSettings(); // Refresh settings
        } catch (error) {
            console.error("Error updating settings:", error);
            toast.error(error.response?.data?.error || 'Failed to update settings.', { id: toastId });
        }
    };

    // Handle affiliate link actions
    const handleCreateAffiliate = () => {
        setEditingAffiliate(null);
        setShowAffiliateModal(true);
    };

    const handleEditAffiliate = (affiliate) => {
        setEditingAffiliate(affiliate);
        setShowAffiliateModal(true);
        setOpenMenuId(null);
    };

    const handleDeleteAffiliate = async (affiliateId, affiliateName) => {
        if (window.confirm(`Are you sure you want to delete the affiliate link "${affiliateName}"? This action cannot be undone.`)) {
            const toastId = toast.loading(`Deleting ${affiliateName}...`);
            try {
                await referralAdminAPI.deleteAffiliateLink(affiliateId);
                toast.success(`"${affiliateName}" deleted successfully.`, { id: toastId });
                fetchAffiliateLinks(currentPage); // Refresh current page
            } catch (error) {
                console.error("Error deleting affiliate link:", error);
                toast.error(error.response?.data?.error || `Failed to delete "${affiliateName}".`, { id: toastId });
            }
        }
        setOpenMenuId(null);
    };

    const handleToggleAffiliateStatus = async (affiliate) => {
        const toastId = toast.loading(`${affiliate.is_active ? 'Deactivating' : 'Activating'} ${affiliate.name}...`);
        try {
            await referralAdminAPI.updateAffiliateLink(affiliate.id, { 
                is_active: !affiliate.is_active 
            });
            toast.success(`${affiliate.name} ${affiliate.is_active ? 'deactivated' : 'activated'} successfully.`, { id: toastId });
            fetchAffiliateLinks(currentPage); // Refresh current page
        } catch (error) {
            console.error("Error toggling affiliate status:", error);
            toast.error(error.response?.data?.error || 'Failed to update status.', { id: toastId });
        }
        setOpenMenuId(null);
    };

    // Handle modal close and refresh
    const handleModalClose = (shouldRefresh = false) => {
        setShowAffiliateModal(false);
        setEditingAffiliate(null);
        if (shouldRefresh) {
            fetchAffiliateLinks(currentPage);
            fetchAnalytics(); // Refresh analytics too
        }
    };

    // Format date helper
    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get status badge
    const getStatusBadge = (affiliate) => {
        if (!affiliate.is_active) {
            return <span className="status-badge inactive">Inactive</span>;
        }
        if (affiliate.is_expired) {
            return <span className="status-badge expired">Expired</span>;
        }
        return <span className="status-badge active">Active</span>;
    };

    // Format XP display
    const formatXP = (affiliateXP, userXP, defaultAffiliateXP, defaultUserXP) => {
        const displayAffiliateXP = affiliateXP !== null ? affiliateXP : defaultAffiliateXP;
        const displayUserXP = userXP !== null ? userXP : defaultUserXP;
        
        if (affiliateXP === null && userXP === null) {
            return 'Default';
        }
        return `${displayAffiliateXP} / ${displayUserXP}`;
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-table-page b_admin_styling-main">
                    <BLoading variant="page" label="Loading referral management..." />
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
                        <h1 className="b_admin_styling-title">Referral & Affiliate System</h1>
                        <p className="chat-subtitle">Manage referral settings, affiliate links, and view system analytics</p>
                    </div>
                    <BButton onClick={handleCreateAffiliate} variant="primary" size="sm">
                        <i className="ri-add-line"></i> Create Affiliate Link
                    </BButton>
                </div>

                {/* Statistics Cards */}
                {analyticsLoading ? (
                    <BLoading variant="inline" label="Loading analytics..." />
                ) : analytics ? (
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
                                <p>Top Referrers</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Global Referral Settings */}
                <div className="b_admin_styling-section">
                    <h2 className="b_admin_styling-title">Global Referral Settings</h2>
                    {settingsLoading ? (
                        <BLoading variant="inline" label="Loading settings..." />
                    ) : (
                        <form onSubmit={handleSettingsUpdate} className="settings-form">
                            <div className="settings-grid">
                                <div className="setting-field">
                                    <label className="b_admin_styling-label">
                                        <input
                                            type="checkbox"
                                            checked={settings.is_active}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                is_active: e.target.checked
                                            }))}
                                            className="b_admin_styling-checkbox"
                                        />
                                        Enable User Referral System
                                    </label>
                                </div>
                                
                                <div className="setting-field">
                                    <label className="b_admin_styling-label">
                                        XP Awarded to Referrer per Signup
                                        <input
                                            type="number"
                                            value={settings.user_reward_xp}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                user_reward_xp: parseInt(e.target.value) || 0
                                            }))}
                                            className="b_admin_styling-input"
                                            min="0"
                                            required
                                        />
                                    </label>
                                </div>
                                
                                <div className="setting-field">
                                    <label className="b_admin_styling-label">
                                        Bonus XP for New User on Signup
                                        <input
                                            type="number"
                                            value={settings.new_user_bonus_xp}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                new_user_bonus_xp: parseInt(e.target.value) || 0
                                            }))}
                                            className="b_admin_styling-input"
                                            min="0"
                                            required
                                        />
                                    </label>
                                </div>
                                
                                <div className="setting-field">
                                    <label className="b_admin_styling-label">
                                        Maximum XP a User Can Earn from Referrals
                                        <input
                                            type="number"
                                            value={settings.user_xp_cap}
                                            onChange={(e) => setSettings(prev => ({
                                                ...prev,
                                                user_xp_cap: parseInt(e.target.value) || 0
                                            }))}
                                            className="b_admin_styling-input"
                                            min="0"
                                            required
                                        />
                                    </label>
                                </div>
                            </div>
                            
                            <div className="settings-actions">
                                <BButton type="submit" variant="primary">
                                    Save Settings
                                </BButton>
                            </div>
                        </form>
                    )}
                </div>

                {/* Affiliate Link Management */}
                <div className="b_admin_styling-section">
                    <h2 className="b_admin_styling-title">Affiliate Link Management</h2>
                    
                    <BFilterBar>
                        <BFilterControl label="Search" htmlFor="affiliateSearch">
                            <input
                                id="affiliateSearch"
                                type="text"
                                className="b_admin_styling-input b_admin_styling-input--compact"
                                placeholder="Search by name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </BFilterControl>
                        
                        <BFilterControl label="Status" htmlFor="statusFilter">
                            <select
                                id="statusFilter"
                                className="b_admin_styling-select b_admin_styling-select--compact"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="expired">Expired</option>
                            </select>
                        </BFilterControl>
                    </BFilterBar>

                    {affiliateLinksLoading ? (
                        <BLoading variant="table" label="Loading affiliate links..." />
                    ) : (
                        <table className="b_admin_styling-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Owner</th>
                                    <th>XP Recipient</th>
                                    <th>Assigned Tag</th>
                                    <th>Conversions</th>
                                    <th>Custom XP (Affiliate/User)</th>
                                    <th>Status</th>
                                    <th>Expires</th>
                                    <th className="b_admin_styling-table__actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {affiliateLinks.length > 0 ? affiliateLinks.map((affiliate) => (
                                    <tr key={affiliate.id}>
                                        <td>
                                            <div className="affiliate-name">
                                                <strong>{affiliate.name}</strong>
                                                {affiliate.description && (
                                                    <div className="affiliate-description">{affiliate.description}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <code className="affiliate-code">{affiliate.code}</code>
                                        </td>
                                        <td>{affiliate.owner || 'No Owner'}</td>
                                        <td>
                                            {affiliate.assigned_xp_user_name || (affiliate.owner && affiliate.owner !== 'No Owner' ? 'Link Owner' : '-')}
                                        </td>
                                        <td>
                                            {affiliate.assigned_tag ? (
                                                <span className="tag-badge">{affiliate.assigned_tag}</span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td>{affiliate.conversion_count || 0}</td>
                                        <td>
                                            {formatXP(
                                                affiliate.custom_user_reward_xp,
                                                affiliate.custom_new_user_bonus_xp,
                                                settings.user_reward_xp,
                                                settings.new_user_bonus_xp
                                            )}
                                        </td>
                                        <td>{getStatusBadge(affiliate)}</td>
                                        <td>{formatDate(affiliate.expires_at)}</td>
                                        <td className="b_admin_styling-table__actions">
                                            <BKebabMenu
                                                isOpen={openMenuId === affiliate.id}
                                                onToggle={() => setOpenMenuId(openMenuId === affiliate.id ? null : affiliate.id)}
                                                items={[
                                                    { 
                                                        label: 'Edit', 
                                                        icon: 'ri-edit-line', 
                                                        onClick: () => handleEditAffiliate(affiliate) 
                                                    },
                                                    { 
                                                        label: affiliate.is_active ? 'Deactivate' : 'Activate', 
                                                        icon: affiliate.is_active ? 'ri-pause-line' : 'ri-play-line', 
                                                        onClick: () => handleToggleAffiliateStatus(affiliate) 
                                                    },
                                                    { 
                                                        label: 'Delete', 
                                                        icon: 'ri-delete-bin-line', 
                                                        danger: true, 
                                                        onClick: () => handleDeleteAffiliate(affiliate.id, affiliate.name) 
                                                    }
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="10">
                                            <div className="admin-empty-state">
                                                <i className="ri-links-line"></i>
                                                <h3>No Affiliate Links Found</h3>
                                                <p>Create your first affiliate link to get started.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination-container">
                            <BButton
                                variant="secondary"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => fetchAffiliateLinks(currentPage - 1)}
                            >
                                <i className="ri-arrow-left-line"></i> Previous
                            </BButton>
                            
                            <span className="pagination-info">
                                Page {currentPage} of {totalPages}
                            </span>
                            
                            <BButton
                                variant="secondary"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => fetchAffiliateLinks(currentPage + 1)}
                            >
                                Next <i className="ri-arrow-right-line"></i>
                            </BButton>
                        </div>
                    )}
                </div>
            </div>

            {/* Affiliate Modal */}
            {showAffiliateModal && (
                <AffiliateModal
                    affiliate={editingAffiliate}
                    onClose={handleModalClose}
                    defaultSettings={settings}
                />
            )}
        </div>
    );
};

export default ManageReferrals;
