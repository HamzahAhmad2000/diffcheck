import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import { seasonPassAPI, badgeAPI, marketplaceAPI } from '../../services/apiClient';
import {
    BAdminTable,
    BButton,
    BFormField,
    BTextInput,
    BTextarea,
    BSelect,
    BNumberInput,
    BDateInput,
    BStatusBadge,
    BLoading,
    BFilterBar,
    BFilterControl,
    BKebabMenu,
    BPackageFormModal
} from './ui';
import './AdminForms.css';
import './AdminTables.css';
import './ManageSeasonPass.css';
import '../../styles/b_admin_styling.css';

// Custom Badge Dropdown Component
const BadgeDropdown = ({ badges, selectedBadgeId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

    const updateMenuPosition = React.useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        updateMenuPosition();

        const handleResizeOrScroll = () => updateMenuPosition();
        const handleClickOutside = (event) => {
            const triggerElement = triggerRef.current;
            const dropdownElement = menuRef.current;

            if (triggerElement?.contains(event.target)) return;
            if (dropdownElement?.contains(event.target)) return;

            setIsOpen(false);
        };

        window.addEventListener('resize', handleResizeOrScroll);
        window.addEventListener('scroll', handleResizeOrScroll, true);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('resize', handleResizeOrScroll);
            window.removeEventListener('scroll', handleResizeOrScroll, true);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, updateMenuPosition]);

    const selectedBadge = badges.find(badge => badge.id === parseInt(selectedBadgeId));
    const filteredBadges = badges.filter(badge => 
        badge.name && badge.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="custom-dropdown" ref={triggerRef}>
            <div 
                className="dropdown-trigger"
                onClick={() => setIsOpen(prev => !prev)}
            >
                {selectedBadge ? (
                    <div className="selected-item">
                        <img 
                            src={selectedBadge.image_url || '/default-badge-placeholder.png'} 
                            alt={selectedBadge.name}
                            className="item-image"
                        />
                        <div className="item-details">
                            <span className="item-name">{selectedBadge.name}</span>
                            <span className="item-subtitle">{selectedBadge.xp_threshold} XP threshold</span>
                        </div>
                    </div>
                ) : (
                    <div className="placeholder-text">Select a badge...</div>
                )}
                <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line dropdown-arrow`}></i>
            </div>
            
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="dropdown-menu dropdown-menu-portal"
                    style={{
                        position: 'absolute',
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                        zIndex: 2000
                    }}
                >
                    <div className="dropdown-search">
                        <input
                            type="text"
                            placeholder="Search badges..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="dropdown-list">
                        {filteredBadges.length > 0 ? filteredBadges.map(badge => (
                            <div
                                key={badge.id}
                                className={`dropdown-item ${parseInt(selectedBadgeId) === badge.id ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelect(badge.id);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                            >
                                <img 
                                    src={badge.image_url || '/default-badge-placeholder.png'} 
                                    alt={badge.name || 'Badge'}
                                    className="item-image"
                                />
                                <div className="item-details">
                                    <span className="item-name">{badge.name || 'Unnamed Badge'}</span>
                                    <span className="item-subtitle">{badge.xp_threshold || 0} XP threshold</span>
                                    {badge.description && (
                                        <span className="item-description">{badge.description}</span>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="no-results">
                                {badges.length === 0 ? 'No badges available' : 'No badges match your search'}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// Custom Marketplace Item Dropdown Component
const MarketplaceDropdown = ({ items, selectedItemId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

    const updateMenuPosition = React.useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        updateMenuPosition();

        const handleResizeOrScroll = () => updateMenuPosition();
        const handleClickOutside = (event) => {
            if (triggerRef.current?.contains(event.target)) return;
            if (menuRef.current?.contains(event.target)) return;
            setIsOpen(false);
        };

        window.addEventListener('resize', handleResizeOrScroll);
        window.addEventListener('scroll', handleResizeOrScroll, true);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('resize', handleResizeOrScroll);
            window.removeEventListener('scroll', handleResizeOrScroll, true);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, updateMenuPosition]);

    const selectedItem = items.find(item => item.id === parseInt(selectedItemId));
    const filteredItems = items.filter(item => 
        item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="custom-dropdown" ref={triggerRef}>
            <div 
                className="dropdown-trigger"
                onClick={() => setIsOpen(prev => !prev)}
            >
                {selectedItem ? (
                    <div className="selected-item">
                        <img 
                            src={selectedItem.image_url || '/default-item-placeholder.png'} 
                            alt={selectedItem.name}
                            className="item-image"
                        />
                        <div className="item-details">
                            <span className="item-name">{selectedItem.name}</span>
                            <span className="item-subtitle">{selectedItem.xp_cost} XP • {selectedItem.item_type}</span>
                        </div>
                    </div>
                ) : (
                    <div className="placeholder-text">Select a marketplace item...</div>
                )}
                <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line dropdown-arrow`}></i>
            </div>
            
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="dropdown-menu dropdown-menu-portal"
                    style={{
                        position: 'absolute',
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                        zIndex: 2000
                    }}
                >
                    <div className="dropdown-search">
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="dropdown-list">
                        {filteredItems.length > 0 ? filteredItems.map(item => (
                            <div
                                key={item.id}
                                className={`dropdown-item ${parseInt(selectedItemId) === item.id ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelect(item.id);
                                    setIsOpen(false);
                                    setSearchTerm('');
                                }}
                            >
                                <img 
                                    src={item.image_url || '/default-item-placeholder.png'} 
                                    alt={item.name || 'Item'}
                                    className="item-image"
                                />
                                <div className="item-details">
                                    <span className="item-name">{item.name || 'Unnamed Item'}</span>
                                    <span className="item-subtitle">{item.xp_cost || 0} XP • {item.item_type || 'Item'}</span>
                                    {item.description && (
                                        <span className="item-description">{item.description}</span>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="no-results">
                                {items.length === 0 ? 'No marketplace items available' : 'No items match your search'}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const ManageSeasonPass = () => {
    const navigate = useNavigate();
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [editingLevel, setEditingLevel] = useState(null);
    const [showXPModal, setShowXPModal] = useState(false);
    const [xpModifications, setXpModifications] = useState({});
    const [bulkXPSettings, setBulkXPSettings] = useState({
        globalXP: 250,
        rangeStart: 1,
        rangeEnd: 5,
        rangeXP: 250
    });
    const [availableBadges, setAvailableBadges] = useState([]);
    const [availableMarketplaceItems, setAvailableMarketplaceItems] = useState([]);
    const [loadingDropdownData, setLoadingDropdownData] = useState(false);
    
    // Analytics state
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsView, setAnalyticsView] = useState('overview'); // overview, retention, churn, growth

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        end_date: '',
        lunar_pass_price: 1999,
        totality_pass_price: 3499,
        lunar_xp_multiplier: 1.25,
        totality_xp_multiplier: 2.0
    });

    const [rewardForm, setRewardForm] = useState({
        tier_type: 'LUNAR',
        reward_type: 'XP',
        xp_amount: 100,
        badge_id: '',
        marketplace_item_id: '',
        display_name: '',
        description: '',
        image_url: ''
    });

    useEffect(() => {
        fetchSeasons();
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        setLoadingDropdownData(true);
        try {
            // Fetch all badges (including unpublished ones for special tier rewards)
            const badgesResponse = await badgeAPI.adminGetBadges();
            setAvailableBadges(badgesResponse.data?.badges || []);

            // Fetch all marketplace items
            const itemsResponse = await marketplaceAPI.adminGetItems();
            setAvailableMarketplaceItems(itemsResponse.data?.items || []);
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
            toast.error('Failed to load badges and marketplace items');
        } finally {
            setLoadingDropdownData(false);
        }
    };

    const fetchAnalyticsData = async (view = 'overview') => {
        setAnalyticsLoading(true);
        try {
            let response;
            switch (view) {
                case 'retention':
                    response = await seasonPassAPI.admin.getRetentionAnalytics();
                    break;
                case 'churn':
                    response = await seasonPassAPI.admin.getChurnAnalytics();
                    break;
                case 'growth':
                    response = await seasonPassAPI.admin.getGrowthAnalytics();
                    break;
                default:
                    response = await seasonPassAPI.admin.getSubscriptionAnalytics();
                    break;
            }
            setAnalyticsData(response.data?.data || null);
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            toast.error('Failed to load analytics data');
            setAnalyticsData(null);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleAnalyticsViewChange = (view) => {
        setAnalyticsView(view);
        fetchAnalyticsData(view);
    };

    const fetchSeasons = async () => {
        try {
            setLoading(true);
            const response = await seasonPassAPI.admin.listSeasons();
            setSeasons(response.data?.data?.seasons || []);
        } catch (error) {
            console.error('Error fetching seasons:', error);
            toast.error('Failed to fetch seasons');
        } finally {
            setLoading(false);
        }
    };

    const fetchSeasonDetails = async (seasonId) => {
        try {
            const response = await seasonPassAPI.admin.getSeasonOverview(seasonId);
            setSelectedSeason(response.data?.data || null);
        } catch (error) {
            console.error('Error fetching season details:', error);
            toast.error('Failed to fetch season details');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Generate default levels (1-15) with configurable progression
            const levels = [];
            for (let i = 1; i <= 15; i++) {
                levels.push({
                    level_number: i,
                    xp_required_for_level: 250  // Fixed 250 XP per level (configurable)
                });
            }

            const seasonData = {
                ...formData,
                levels: levels
            };

            await seasonPassAPI.admin.createSeason(seasonData);
            toast.success('Season created successfully!');
            setShowCreateModal(false);
            resetForm();
            fetchSeasons();
        } catch (error) {
            console.error('Error creating season:', error);
            toast.error(error.response?.data?.error || 'Failed to create season');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            end_date: '',
            lunar_pass_price: 1999,
            totality_pass_price: 3499,
            lunar_xp_multiplier: 1.25,
            totality_xp_multiplier: 2.0
        });
    };

    const handleFieldChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleActivateSeason = async (seasonId) => {
        try {
            await seasonPassAPI.admin.activateSeason(seasonId);
            toast.success('Season activated successfully!');
            fetchSeasons();
        } catch (error) {
            console.error('Error activating season:', error);
            toast.error(error.response?.data?.error || 'Failed to activate season');
        }
    };

    const handleSetNextSeason = async (seasonId) => {
        try {
            await seasonPassAPI.admin.setNextSeason(seasonId);
            toast.success('Season set as next successfully!');
            fetchSeasons();
        } catch (error) {
            console.error('Error setting next season:', error);
            toast.error(error.response?.data?.error || 'Failed to set next season');
        }
    };

    const handleXPUpdate = async () => {
        if (!selectedSeason || Object.keys(xpModifications).length === 0) {
            toast.error('No XP modifications to save');
            return;
        }

        try {
            await seasonPassAPI.admin.updateXPRequirements(selectedSeason.season.id, xpModifications);
            toast.success('XP requirements updated successfully!');
            setShowXPModal(false);
            setXpModifications({});
            // Refresh season details
            fetchSeasonDetails(selectedSeason.season.id);
        } catch (error) {
            console.error('Error updating XP requirements:', error);
            toast.error(error.response?.data?.error || 'Failed to update XP requirements');
        }
    };

    const handleGlobalXPApply = () => {
        if (!selectedSeason) return;
        
        const modifications = {};
        selectedSeason.levels.forEach(level => {
            modifications[level.level_number] = bulkXPSettings.globalXP;
        });
        setXpModifications(modifications);
        toast.success(`Applied ${bulkXPSettings.globalXP} XP to all levels`);
    };

    const handleRangeXPApply = () => {
        if (!selectedSeason) return;
        
        const { rangeStart, rangeEnd, rangeXP } = bulkXPSettings;
        
        if (rangeStart > rangeEnd || rangeStart < 1 || rangeEnd > selectedSeason.levels.length) {
            toast.error('Invalid level range');
            return;
        }

        const modifications = { ...xpModifications };
        for (let i = rangeStart; i <= rangeEnd; i++) {
            modifications[i] = rangeXP;
        }
        setXpModifications(modifications);
        toast.success(`Applied ${rangeXP} XP to levels ${rangeStart}-${rangeEnd}`);
    };

    const handleIndividualXPChange = (levelNumber, newXP) => {
        setXpModifications(prev => ({
            ...prev,
            [levelNumber]: parseInt(newXP) || 0
        }));
    };

    const openXPModal = () => {
        if (!selectedSeason) return;
        
        // Initialize with current XP values
        const currentXP = {};
        selectedSeason.levels.forEach(level => {
            currentXP[level.level_number] = level.xp_required_for_level;
        });
        setXpModifications(currentXP);
        setShowXPModal(true);
    };

    const handleCreateReward = async (e) => {
        e.preventDefault();
        if (!editingLevel || !selectedSeason) return;

        try {
            await seasonPassAPI.admin.createReward(
                selectedSeason.season.id,
                editingLevel.id,
                rewardForm
            );
            toast.success('Reward created successfully!');
            setShowRewardModal(false);
            setEditingReward(null);
            setEditingLevel(null);
            setRewardForm({
                tier_type: 'LUNAR',
                reward_type: 'XP',
                xp_amount: 100,
                badge_id: '',
                marketplace_item_id: '',
                display_name: '',
                description: '',
                image_url: ''
            });
            // Refresh season details
            fetchSeasonDetails(selectedSeason.season.id);
        } catch (error) {
            console.error('Error creating reward:', error);
            toast.error(error.response?.data?.error || 'Failed to create reward');
        }
    };

    const handleUpdateReward = async (e) => {
        e.preventDefault();
        if (!editingReward || !editingLevel || !selectedSeason) return;

        try {
            await seasonPassAPI.admin.updateReward(
                selectedSeason.season.id,
                editingLevel.id,
                editingReward.id,
                rewardForm
            );
            toast.success('Reward updated successfully!');
            setShowRewardModal(false);
            setEditingReward(null);
            setEditingLevel(null);
            setRewardForm({
                tier_type: 'LUNAR',
                reward_type: 'XP',
                xp_amount: 100,
                badge_id: '',
                marketplace_item_id: '',
                display_name: '',
                description: '',
                image_url: ''
            });
            // Refresh season details
            fetchSeasonDetails(selectedSeason.season.id);
        } catch (error) {
            console.error('Error updating reward:', error);
            toast.error(error.response?.data?.error || 'Failed to update reward');
        }
    };

    const handleDeleteReward = async (levelId, rewardId) => {
        if (!window.confirm('Are you sure you want to delete this reward?')) return;

        try {
            await seasonPassAPI.admin.deleteReward(
                selectedSeason.season.id,
                levelId,
                rewardId
            );
            toast.success('Reward deleted successfully!');
            // Refresh season details
            fetchSeasonDetails(selectedSeason.season.id);
        } catch (error) {
            console.error('Error deleting reward:', error);
            toast.error(error.response?.data?.error || 'Failed to delete reward');
        }
    };

    const openRewardModal = (level, reward = null, defaultTierType = null) => {
        setEditingLevel(level);
        setEditingReward(reward);

        if (reward) {
            // Editing existing reward
            setRewardForm({
                tier_type: reward.tier_type,
                reward_type: reward.reward_type,
                xp_amount: reward.xp_amount || 100,
                badge_id: reward.badge?.id || '',
                marketplace_item_id: reward.marketplace_item?.id || '',
                display_name: reward.display_name || '',
                description: reward.description || '',
                image_url: reward.image_url || ''
            });
        } else {
            // Creating new reward
            setRewardForm({
                tier_type: defaultTierType || 'LUNAR',
                reward_type: 'XP',
                xp_amount: 100,
                badge_id: '',
                marketplace_item_id: '',
                display_name: '',
                description: '',
                image_url: ''
            });
        }

        setShowRewardModal(true);
    };

    const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

    const getRewardTypeIcon = (type) => {
        switch (type) {
            case 'XP': return '✨';
            case 'BADGE': return '🏆';
            case 'RAFFLE_ENTRY': return '🎁';
            case 'MARKETPLACE_ITEM': return '🛍️';
            case 'CUSTOM': return '🎯';
            default: return '❓';
        }
    };

    const getTierColor = (tier) => {
        return tier === 'LUNAR' ? '#4A90E2' : '#9B59B6';
    };

    // Filter seasons based on search term
    const filteredSeasons = seasons.filter(season => 
        season.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        season.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-table-page b_admin_styling-main">
                    <BLoading variant="page" label="Loading Season Pass Management..." />
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
                        <h1 className="b_admin_styling-title">Season Pass Management</h1>
                        <p className="chat-subtitle">Create and manage season pass rewards and progression</p>
                    </div>
                    <div className="header-actions">
                        <BButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAnalytics(!showAnalytics);
                                if (!showAnalytics && !analyticsData) {
                                    fetchAnalyticsData();
                                }
                            }}
                        >
                            <i className="ri-bar-chart-line"></i>
                            {showAnalytics ? 'Hide Analytics' : 'View Analytics'}
                        </BButton>
                        <BButton
                            variant="primary"
                            size="sm"
                            onClick={() => { 
                                resetForm(); 
                                setShowCreateModal(true); 
                            }}
                        >
                            <i className="ri-add-line"></i>
                            Create New Season
                        </BButton>
                    </div>
                </div>

                {/* Analytics Dashboard */}
                {showAnalytics && (
                    <div className="analytics-dashboard">
                        <div className="analytics-header">
                            <h2>Season Pass Analytics</h2>
                            <div className="analytics-tabs">
                                <button
                                    className={`analytics-tab ${analyticsView === 'overview' ? 'active' : ''}`}
                                    onClick={() => handleAnalyticsViewChange('overview')}
                                >
                                    <i className="ri-dashboard-line"></i>
                                    Overview
                                </button>
                                <button
                                    className={`analytics-tab ${analyticsView === 'retention' ? 'active' : ''}`}
                                    onClick={() => handleAnalyticsViewChange('retention')}
                                >
                                    <i className="ri-user-heart-line"></i>
                                    Retention
                                </button>
                                <button
                                    className={`analytics-tab ${analyticsView === 'churn' ? 'active' : ''}`}
                                    onClick={() => handleAnalyticsViewChange('churn')}
                                >
                                    <i className="ri-user-unfollow-line"></i>
                                    Churn
                                </button>
                                <button
                                    className={`analytics-tab ${analyticsView === 'growth' ? 'active' : ''}`}
                                    onClick={() => handleAnalyticsViewChange('growth')}
                                >
                                    <i className="ri-line-chart-line"></i>
                                    Growth
                                </button>
                            </div>
                        </div>

                        {analyticsLoading ? (
                            <BLoading variant="section" label="Loading analytics..." />
                        ) : analyticsData ? (
                            <div className="analytics-content">
                                {analyticsView === 'overview' && (
                                    <div className="overview-analytics">
                                        {/* Overview Metrics */}
                                        <div className="metrics-grid">
                                            <div className="metric-card">
                                                <div className="metric-icon">
                                                    <i className="ri-user-line"></i>
                                                </div>
                                                <div className="metric-content">
                                                    <h3>{analyticsData.overview?.total_unique_subscribers || 0}</h3>
                                                    <p>Total Unique Subscribers</p>
                                                </div>
                                            </div>
                                            <div className="metric-card">
                                                <div className="metric-icon">
                                                    <i className="ri-vip-crown-line"></i>
                                                </div>
                                                <div className="metric-content">
                                                    <h3>{analyticsData.overview?.current_active_subscribers || 0}</h3>
                                                    <p>Current Active Subscribers</p>
                                                </div>
                                            </div>
                                            <div className="metric-card">
                                                <div className="metric-icon">
                                                    <i className="ri-calendar-line"></i>
                                                </div>
                                                <div className="metric-content">
                                                    <h3>{analyticsData.overview?.total_seasons || 0}</h3>
                                                    <p>Total Seasons</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Season Comparisons */}
                                        <div className="season-comparisons">
                                            <h3>Season Performance Comparison</h3>
                                            <div className="seasons-grid">
                                                {analyticsData.season_comparisons?.map((season, index) => (
                                                    <div key={season.season.id} className="season-analytics-card">
                                                        <div className="season-header">
                                                            <h4>{season.season.name}</h4>
                                                            <span className={`season-status ${season.season.is_active ? 'active' : 'inactive'}`}>
                                                                {season.season.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="season-metrics">
                                                            <div className="metric-row">
                                                                <span className="metric-label">Subscribers:</span>
                                                                <span className="metric-value">{season.subscription_metrics?.total_subscribers || 0}</span>
                                                            </div>
                                                            <div className="metric-row">
                                                                <span className="metric-label">Revenue:</span>
                                                                <span className="metric-value">${season.revenue_metrics?.total_revenue_dollars?.toFixed(2) || '0.00'}</span>
                                                            </div>
                                                            <div className="metric-row">
                                                                <span className="metric-label">New Users:</span>
                                                                <span className="metric-value new-users">{season.user_behavior?.new_subscribers || 0}</span>
                                                            </div>
                                                            <div className="metric-row">
                                                                <span className="metric-label">Returning:</span>
                                                                <span className="metric-value returning-users">{season.user_behavior?.returning_subscribers || 0}</span>
                                                            </div>
                                                            <div className="metric-row">
                                                                <span className="metric-label">Retention Rate:</span>
                                                                <span className="metric-value retention-rate">
                                                                    {season.user_behavior?.retention_rate?.toFixed(1) || '0.0'}%
                                                                </span>
                                                            </div>
                                                            <div className="metric-row">
                                                                <span className="metric-label">Churn Rate:</span>
                                                                <span className="metric-value churn-rate">
                                                                    {season.user_behavior?.churn_rate?.toFixed(1) || '0.0'}%
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="tier-distribution">
                                                            <h5>Tier Distribution</h5>
                                                            <div className="tier-bars">
                                                                <div className="tier-bar">
                                                                    <span className="tier-label">🌙 Lunar</span>
                                                                    <div className="tier-progress">
                                                                        <div 
                                                                            className="tier-fill lunar"
                                                                            style={{ width: `${season.subscription_metrics?.tier_distribution?.lunar_percentage || 0}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="tier-percentage">
                                                                        {season.subscription_metrics?.tier_distribution?.lunar_percentage?.toFixed(1) || '0.0'}%
                                                                    </span>
                                                                </div>
                                                                <div className="tier-bar">
                                                                    <span className="tier-label">🌟 Totality</span>
                                                                    <div className="tier-progress">
                                                                        <div 
                                                                            className="tier-fill totality"
                                                                            style={{ width: `${season.subscription_metrics?.tier_distribution?.totality_percentage || 0}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="tier-percentage">
                                                                        {season.subscription_metrics?.tier_distribution?.totality_percentage?.toFixed(1) || '0.0'}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {analyticsView === 'retention' && (
                                    <div className="retention-analytics">
                                        <div className="retention-overview">
                                            <div className="retention-metrics">
                                                <div className="retention-metric-card">
                                                    <h3>{analyticsData.overall_retention_rate?.toFixed(1) || '0.0'}%</h3>
                                                    <p>Overall Retention Rate</p>
                                                </div>
                                                <div className="retention-metric-card">
                                                    <h3>{analyticsData.loyal_subscribers || 0}</h3>
                                                    <p>Loyal Subscribers (3+ Seasons)</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="season-retention-table">
                                            <h3>Season-to-Season Retention</h3>
                                            <table className="retention-table">
                                                <thead>
                                                    <tr>
                                                        <th>From Season</th>
                                                        <th>To Season</th>
                                                        <th>Previous Subscribers</th>
                                                        <th>Retained</th>
                                                        <th>Retention Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analyticsData.season_to_season_retention?.map((retention, index) => (
                                                        <tr key={index}>
                                                            <td>{retention.from_season.name}</td>
                                                            <td>{retention.to_season.name}</td>
                                                            <td>{retention.total_previous_subscribers}</td>
                                                            <td>{retention.subscribers_retained}</td>
                                                            <td>
                                                                <span className={`retention-rate ${retention.retention_rate >= 50 ? 'good' : retention.retention_rate >= 25 ? 'medium' : 'poor'}`}>
                                                                    {retention.retention_rate.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {analyticsView === 'churn' && (
                                    <div className="churn-analytics">
                                        <div className="churn-overview">
                                            <div className="churn-metrics">
                                                <div className="churn-metric-card">
                                                    <h3>{analyticsData.overall_churn_rate?.toFixed(1) || '0.0'}%</h3>
                                                    <p>Overall Churn Rate</p>
                                                </div>
                                                <div className="churn-metric-card">
                                                    <h3>{analyticsData.churn_analysis?.never_returned || 0}</h3>
                                                    <p>One-Time Subscribers</p>
                                                </div>
                                                <div className="churn-metric-card">
                                                    <h3>{analyticsData.churn_analysis?.tier_upgrades || 0}</h3>
                                                    <p>Tier Upgrades</p>
                                                </div>
                                                <div className="churn-metric-card">
                                                    <h3>{analyticsData.churn_analysis?.tier_downgrades || 0}</h3>
                                                    <p>Tier Downgrades</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="season-churn-table">
                                            <h3>Season-to-Season Churn</h3>
                                            <table className="churn-table">
                                                <thead>
                                                    <tr>
                                                        <th>From Season</th>
                                                        <th>To Season</th>
                                                        <th>Previous Subscribers</th>
                                                        <th>Churned</th>
                                                        <th>Churn Rate</th>
                                                        <th>Tier Changes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analyticsData.season_to_season_churn?.map((churn, index) => (
                                                        <tr key={index}>
                                                            <td>{churn.from_season.name}</td>
                                                            <td>{churn.to_season.name}</td>
                                                            <td>{churn.total_previous_subscribers}</td>
                                                            <td>{churn.churned_users}</td>
                                                            <td>
                                                                <span className={`churn-rate ${churn.churn_rate <= 25 ? 'good' : churn.churn_rate <= 50 ? 'medium' : 'poor'}`}>
                                                                    {churn.churn_rate.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="tier-changes">
                                                                    <span className="upgrade">↗ {churn.tier_changes.upgrades}</span>
                                                                    <span className="downgrade">↘ {churn.tier_changes.downgrades}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {analyticsView === 'growth' && (
                                    <div className="growth-analytics">
                                        <div className="growth-overview">
                                            <div className="growth-metrics">
                                                <div className="growth-metric-card">
                                                    <h3>{analyticsData.growth_trends?.avg_subscriber_growth_rate?.toFixed(1) || '0.0'}%</h3>
                                                    <p>Avg Subscriber Growth Rate</p>
                                                </div>
                                                <div className="growth-metric-card">
                                                    <h3>{analyticsData.growth_trends?.avg_revenue_growth_rate?.toFixed(1) || '0.0'}%</h3>
                                                    <p>Avg Revenue Growth Rate</p>
                                                </div>
                                                {analyticsData.growth_trends?.fastest_growing_season && (
                                                    <div className="growth-metric-card highlight">
                                                        <h3>{analyticsData.growth_trends.fastest_growing_season.name}</h3>
                                                        <p>Fastest Growing Season ({analyticsData.growth_trends.fastest_growing_season.growth_rate.toFixed(1)}%)</p>
                                                    </div>
                                                )}
                                                {analyticsData.growth_trends?.highest_revenue_season && (
                                                    <div className="growth-metric-card highlight">
                                                        <h3>{analyticsData.growth_trends.highest_revenue_season.name}</h3>
                                                        <p>Highest Revenue Season (${analyticsData.growth_trends.highest_revenue_season.revenue.toFixed(2)})</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="growth-charts">
                                            <div className="growth-chart">
                                                <h3>Subscriber Growth by Season</h3>
                                                <div className="growth-bars">
                                                    {analyticsData.subscriber_growth?.map((growth, index) => (
                                                        <div key={index} className="growth-bar-item">
                                                            <div className="growth-bar-label">{growth.season.name}</div>
                                                            <div className="growth-bar-container">
                                                                <div 
                                                                    className={`growth-bar ${growth.growth_rate >= 0 ? 'positive' : 'negative'}`}
                                                                    style={{ 
                                                                        width: `${Math.abs(growth.growth_rate)}%`,
                                                                        maxWidth: '100%'
                                                                    }}
                                                                ></div>
                                                            </div>
                                                            <div className="growth-bar-value">
                                                                {growth.growth_rate >= 0 ? '+' : ''}{growth.growth_rate.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="growth-chart">
                                                <h3>Revenue Growth by Season</h3>
                                                <div className="growth-bars">
                                                    {analyticsData.revenue_growth?.map((growth, index) => (
                                                        <div key={index} className="growth-bar-item">
                                                            <div className="growth-bar-label">{growth.season.name}</div>
                                                            <div className="growth-bar-container">
                                                                <div 
                                                                    className={`growth-bar ${growth.growth_rate >= 0 ? 'positive' : 'negative'}`}
                                                                    style={{ 
                                                                        width: `${Math.abs(growth.growth_rate)}%`,
                                                                        maxWidth: '100%'
                                                                    }}
                                                                ></div>
                                                            </div>
                                                            <div className="growth-bar-value">
                                                                {growth.growth_rate >= 0 ? '+' : ''}{growth.growth_rate.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="analytics-empty">
                                <i className="ri-bar-chart-line"></i>
                                <p>No analytics data available</p>
                            </div>
                        )}
                    </div>
                )}

                {!selectedSeason ? (
                    <>
                        {/* Filters */}
                        <BFilterBar>
                            <BFilterControl label="Search Seasons" htmlFor="seasonSearch">
                                <input
                                    id="seasonSearch"
                                    type="text"
                                    className="b_admin_styling-input b_admin_styling-input--compact"
                                    placeholder="Search by season name or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </BFilterControl>
                        </BFilterBar>

                        <div className="b_admin_styling-table-container">
                            <table className="b_admin_styling-table">
                            <thead>
                                <tr>
                                    <th>Season</th>
                                    <th>Status</th>
                                    <th>Pass Prices</th>
                                    <th>XP Multipliers</th>
                                    <th>End Date</th>
                                    <th className="b_admin_styling-table__actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSeasons.length > 0 ? filteredSeasons.map((season) => (
                                    <tr key={season.id}>
                                        <td>
                                            <div className="season-name">
                                                <strong>{season.name}</strong>
                                                {season.description && (
                                                    <div className="season-description">{season.description}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${season.is_active ? 'active' : season.is_next ? 'pending' : 'inactive'}`}>
                                                {season.is_active ? 'Active' : 
                                                 season.is_next ? 'Next' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="price-info">
                                                <div>Lunar: {formatPrice(season.lunar_pass_price)}</div>
                                                <div>Totality: {formatPrice(season.totality_pass_price)}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="multiplier-info">
                                                <div>Lunar: {season.lunar_xp_multiplier}x</div>
                                                <div>Totality: {season.totality_xp_multiplier}x</div>
                                            </div>
                                        </td>
                                        <td>
                                            {season.end_date ? 
                                                new Date(season.end_date).toLocaleDateString() : 
                                                'No end date'
                                            }
                                        </td>
                                        <td className="b_admin_styling-table__actions">
                                            <BKebabMenu
                                                isOpen={openMenuId === season.id}
                                                onToggle={() => setOpenMenuId(openMenuId === season.id ? null : season.id)}
                                                items={[
                                                    { label: 'View Details', icon: 'ri-eye-line', onClick: () => { setOpenMenuId(null); fetchSeasonDetails(season.id); } },
                                                    ...((!season.is_active && !season.is_next) ? [
                                                        { label: 'Activate', icon: 'ri-play-line', onClick: () => { setOpenMenuId(null); handleActivateSeason(season.id); } },
                                                        { label: 'Set as Next', icon: 'ri-calendar-schedule-line', onClick: () => { setOpenMenuId(null); handleSetNextSeason(season.id); } }
                                                    ] : [])
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="admin-empty-state">
                                                <i className="ri-vip-crown-line"></i>
                                                <h3>{seasons.length === 0 ? 'No Seasons Created Yet' : 'No Seasons Match Your Search'}</h3>
                                                <p>{seasons.length === 0 ? 'Create your first season to get started.' : 'Try adjusting your search criteria.'}</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </>
                ) : (
                    <div className="admin-section">
                        <div className="section-header">
                            <div>
                                <h2>{selectedSeason.season.name}</h2>
                                <p>{selectedSeason.season.description}</p>
                            </div>
                            <BButton
                                variant="secondary"
                                onClick={() => setSelectedSeason(null)}
                            >
                                <i className="ri-arrow-left-line"></i>
                                Back to All Seasons
                            </BButton>
                        </div>

                        <div className="season-details">
                            <div className="season-stats">
                                <div className="stat-card">
                                    <h4>Status</h4>
                                    <span className={`status-badge ${
                                        selectedSeason.season.is_active ? 'active' : 
                                        selectedSeason.season.is_next ? 'next' : 'inactive'
                                    }`}>
                                        {selectedSeason.season.is_active ? 'Active' : 
                                         selectedSeason.season.is_next ? 'Next' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="stat-card">
                                    <h4>Total Levels</h4>
                                    <p>{selectedSeason.levels.length}</p>
                                </div>
                                <div className="stat-card">
                                    <h4>Pass Prices</h4>
                                    <p>Lunar: {formatPrice(selectedSeason.season.lunar_pass_price)}</p>
                                    <p>Totality: {formatPrice(selectedSeason.season.totality_pass_price)}</p>
                                </div>
                            </div>

                            <div className="levels-container">
                                <div className="levels-header">
                                    <h3>Level Progression & Rewards</h3>
                                    <BButton
                                        variant="outline"
                                        size="sm"
                                        onClick={openXPModal}
                                    >
                                        <i className="ri-settings-line"></i>
                                        Modify XP Requirements
                                    </BButton>
                                </div>
                                <div className="levels-grid">
                                    {selectedSeason.levels.map(level => {
                                        const lunarReward = level.rewards.find(r => r.tier_type === 'LUNAR');
                                        const totalityReward = level.rewards.find(r => r.tier_type === 'TOTALITY');

                                        return (
                                            <div key={level.id} className="level-card">
                                                <div className="level-header">
                                                    <h4>Level {level.level_number}</h4>
                                                    <p>{level.xp_required_for_level} XP</p>
                                                </div>

                                                <div className="rewards-section">
                                                    <div className="tier-rewards">
                                                        <h5 style={{ color: getTierColor('LUNAR') }}>
                                                            Lunar Tier
                                                        </h5>
                                                        {lunarReward ? (
                                                            <div className="reward-item">
                                                                <span className="reward-icon">
                                                                    {getRewardTypeIcon(lunarReward.reward_type)}
                                                                </span>
                                                                <span className="reward-name">
                                                                    {lunarReward.display_name || 
                                                                     `${lunarReward.reward_type} Reward`}
                                                                </span>
                                                                <div className="reward-actions">
                                                                    <button
                                                                        className="btn btn-xs btn-outline"
                                                                        onClick={() => openRewardModal(level, lunarReward)}
                                                                        title="Edit Reward"
                                                                    >
                                                                        <i className="ri-edit-line"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-xs btn-danger"
                                                                        onClick={() => handleDeleteReward(level.id, lunarReward.id)}
                                                                        title="Delete Reward"
                                                                    >
                                                                        <i className="ri-delete-bin-line"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="btn btn-xs btn-dashed"
                                                                onClick={() => openRewardModal(level, null, 'LUNAR')}
                                                            >
                                                                <i className="ri-add-line"></i>
                                                                Add Lunar Reward
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="tier-rewards">
                                                        <h5 style={{ color: getTierColor('TOTALITY') }}>
                                                            Totality Tier
                                                        </h5>
                                                        {totalityReward ? (
                                                            <div className="reward-item">
                                                                <span className="reward-icon">
                                                                    {getRewardTypeIcon(totalityReward.reward_type)}
                                                                </span>
                                                                <span className="reward-name">
                                                                    {totalityReward.display_name || 
                                                                     `${totalityReward.reward_type} Reward`}
                                                                </span>
                                                                <div className="reward-actions">
                                                                    <button
                                                                        className="btn btn-xs btn-outline"
                                                                        onClick={() => openRewardModal(level, totalityReward)}
                                                                        title="Edit Reward"
                                                                    >
                                                                        <i className="ri-edit-line"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-xs btn-danger"
                                                                        onClick={() => handleDeleteReward(level.id, totalityReward.id)}
                                                                        title="Delete Reward"
                                                                    >
                                                                        <i className="ri-delete-bin-line"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="btn btn-xs btn-dashed"
                                                                onClick={() => openRewardModal(level, null, 'TOTALITY')}
                                                            >
                                                                <i className="ri-add-line"></i>
                                                                Add Totality Reward
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Season Modal */}
                {showCreateModal && (
                    <BPackageFormModal
                        isOpen={showCreateModal}
                        title="Create New Season"
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleSubmit}
                        submitLabel="Create Season (with 15 levels)"
                        submitting={false}
                        values={formData}
                        onChange={handleFieldChange}
                        fields={[
                            { 
                                name: 'name', 
                                label: 'Season Name', 
                                type: 'text', 
                                required: true, 
                                placeholder: 'e.g., Season 1: Lunar & Totality' 
                            },
                            { 
                                name: 'description', 
                                label: 'Description', 
                                type: 'textarea', 
                                placeholder: "Describe this season's theme and features" 
                            },
                            { 
                                name: 'start_date', 
                                label: 'Start Date', 
                                type: 'datetime-local',
                                hint: 'When this season should start (optional, defaults to now)' 
                            },
                            { 
                                name: 'end_date', 
                                label: 'End Date', 
                                type: 'datetime-local',
                                hint: 'When this season should end (optional)' 
                            },
                            { 
                                name: 'lunar_pass_price', 
                                label: 'Lunar Pass Price (cents)', 
                                type: 'number', 
                                min: 0, 
                                placeholder: 'e.g., 1999 for $19.99',
                                hint: 'Price in cents for the Lunar tier pass' 
                            },
                            { 
                                name: 'totality_pass_price', 
                                label: 'Totality Pass Price (cents)', 
                                type: 'number', 
                                min: 0, 
                                placeholder: 'e.g., 3499 for $34.99',
                                hint: 'Price in cents for the Totality tier pass' 
                            },
                            { 
                                name: 'lunar_xp_multiplier', 
                                label: 'Lunar XP Multiplier', 
                                type: 'number', 
                                step: 0.01, 
                                min: 1,
                                placeholder: 'e.g., 1.25',
                                hint: 'XP multiplier for Lunar pass holders' 
                            },
                            { 
                                name: 'totality_xp_multiplier', 
                                label: 'Totality XP Multiplier', 
                                type: 'number', 
                                step: 0.01, 
                                min: 1,
                                placeholder: 'e.g., 2.0',
                                hint: 'XP multiplier for Totality pass holders' 
                            }
                        ]}
                    />
                )}

                {/* Reward Modal */}
                {showRewardModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>
                                    {editingReward ? 'Edit' : 'Create'} Reward - Level {editingLevel?.level_number}
                                </h3>
                                <button
                                    className="modal-close"
                                    onClick={() => setShowRewardModal(false)}
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>

                            <form onSubmit={editingReward ? handleUpdateReward : handleCreateReward} className="admin-form">
                                <div className="form-row">
                                    {editingReward && (
                                        <div className="season-pass-form-group">
                                            <label>Tier Type *</label>
                                            <select
                                                value={rewardForm.tier_type}
                                                onChange={(e) => setRewardForm({...rewardForm, tier_type: e.target.value})}
                                                required
                                            >
                                                <option value="LUNAR">Lunar Tier</option>
                                                <option value="TOTALITY">Totality Tier</option>
                                            </select>
                                        </div>
                                    )}
                                    {!editingReward && (
                                        <div className="season-pass-form-group">
                                            <label>Tier Type</label>
                                            <div className="tier-type-display">
                                                <span className={`tier-badge ${rewardForm.tier_type.toLowerCase()}`}>
                                                    {rewardForm.tier_type === 'LUNAR' ? 'Lunar Tier' : 'Totality Tier'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="season-pass-form-group">
                                        <label>Reward Type *</label>
                                        <select
                                            value={rewardForm.reward_type}
                                            onChange={(e) => setRewardForm({...rewardForm, reward_type: e.target.value})}
                                            required
                                        >
                                            <option value="XP">XP Boost</option>
                                            <option value="BADGE">Badge</option>
                                            <option value="RAFFLE_ENTRY">Raffle Entry</option>
                                            <option value="MARKETPLACE_ITEM">Marketplace Item</option>
                                            <option value="CUSTOM">Custom</option>
                                        </select>
                                    </div>
                                </div>

                                {rewardForm.reward_type === 'XP' && (
                                    <div className="season-pass-form-group">
                                        <label>XP Amount *</label>
                                        <input
                                            type="number"
                                            value={rewardForm.xp_amount}
                                            onChange={(e) => setRewardForm({...rewardForm, xp_amount: parseInt(e.target.value)})}
                                            min="1"
                                            required
                                        />
                                    </div>
                                )}

                                {rewardForm.reward_type === 'BADGE' && (
                                    <div className="season-pass-form-group">
                                        <label>Select Badge</label>
                                        {(() => {
                                            console.log('Rendering badge section - loadingDropdownData:', loadingDropdownData);
                                            console.log('Rendering badge section - availableBadges:', availableBadges);
                                            console.log('Rendering badge section - availableBadges.length:', availableBadges.length);
                                            
                                            if (loadingDropdownData) {
                                                return <div className="loading-dropdown">Loading badges...</div>;
                                            } else if (availableBadges.length === 0) {
                                                return <div className="loading-dropdown">No badges available. Please create badges first.</div>;
                                            } else {
                                                return (
                                                    <BadgeDropdown
                                                        badges={availableBadges}
                                                        selectedBadgeId={rewardForm.badge_id}
                                                        onSelect={(badgeId) => setRewardForm({...rewardForm, badge_id: badgeId})}
                                                    />
                                                );
                                            }
                                        })()}
                                    </div>
                                )}

                                {(rewardForm.reward_type === 'RAFFLE_ENTRY' || rewardForm.reward_type === 'MARKETPLACE_ITEM') && (
                                    <div className="season-pass-form-group">
                                        <label>Select Marketplace Item</label>
                                        {loadingDropdownData ? (
                                            <div className="loading-dropdown">Loading marketplace items...</div>
                                        ) : availableMarketplaceItems.length === 0 ? (
                                            <div className="loading-dropdown">No marketplace items available. Please create items first.</div>
                                        ) : (
                                            <MarketplaceDropdown
                                                items={availableMarketplaceItems}
                                                selectedItemId={rewardForm.marketplace_item_id}
                                                onSelect={(itemId) => setRewardForm({...rewardForm, marketplace_item_id: itemId})}
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="season-pass-form-group">
                                    <label>Display Name</label>
                                    <input
                                        type="text"
                                        value={rewardForm.display_name}
                                        onChange={(e) => setRewardForm({...rewardForm, display_name: e.target.value})}
                                        placeholder="e.g., '100 XP Bonus'"
                                    />
                                </div>

                                <div className="season-pass-form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={rewardForm.description}
                                        onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})}
                                        placeholder="Describe this reward"
                                        rows="2"
                                    />
                                </div>

                                <div className="season-pass-form-group">
                                    <label>Image URL</label>
                                    <input
                                        type="url"
                                        value={rewardForm.image_url}
                                        onChange={(e) => setRewardForm({...rewardForm, image_url: e.target.value})}
                                        placeholder="https://example.com/reward-image.png"
                                    />
                                </div>

                                <div className="season-pass-form-actions-modal">
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => setShowRewardModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingReward ? 'Update' : 'Create'} Reward
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* XP Requirements Modal */}
                {showXPModal && selectedSeason && (
                    <div className="modal-overlay">
                        <div className="modal-content xp-modal">
                            <div className="modal-header">
                                <h3>Modify XP Requirements - {selectedSeason.season.name}</h3>
                                <button
                                    className="modal-close"
                                    onClick={() => setShowXPModal(false)}
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>

                            <div className="modal-body">
                                {/* Bulk XP Settings */}
                                <div className="bulk-xp-section">
                                    <h4>Bulk XP Settings</h4>
                                    
                                    {/* Global XP Setting */}
                                    <div className="bulk-setting-row">
                                        <div className="bulk-setting-group">
                                            <label>Set Global XP for All Levels</label>
                                            <div className="bulk-setting-controls">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={bulkXPSettings.globalXP}
                                                    onChange={(e) => setBulkXPSettings(prev => ({
                                                        ...prev,
                                                        globalXP: parseInt(e.target.value) || 0
                                                    }))}
                                                    placeholder="250"
                                                />
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={handleGlobalXPApply}
                                                >
                                                    Apply to All
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Range XP Setting */}
                                    <div className="bulk-setting-row">
                                        <div className="bulk-setting-group">
                                            <label>Set XP for Level Range</label>
                                            <div className="bulk-setting-controls range-controls">
                                                <div className="range-inputs">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={selectedSeason.levels.length}
                                                        value={bulkXPSettings.rangeStart}
                                                        onChange={(e) => setBulkXPSettings(prev => ({
                                                            ...prev,
                                                            rangeStart: parseInt(e.target.value) || 1
                                                        }))}
                                                        placeholder="Start"
                                                    />
                                                    <span>to</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={selectedSeason.levels.length}
                                                        value={bulkXPSettings.rangeEnd}
                                                        onChange={(e) => setBulkXPSettings(prev => ({
                                                            ...prev,
                                                            rangeEnd: parseInt(e.target.value) || 1
                                                        }))}
                                                        placeholder="End"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={bulkXPSettings.rangeXP}
                                                        onChange={(e) => setBulkXPSettings(prev => ({
                                                            ...prev,
                                                            rangeXP: parseInt(e.target.value) || 0
                                                        }))}
                                                        placeholder="XP Amount"
                                                    />
                                                </div>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={handleRangeXPApply}
                                                >
                                                    Apply to Range
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Individual Level XP Settings */}
                                <div className="individual-xp-section">
                                    <h4>Individual Level XP Requirements</h4>
                                    <div className="xp-grid">
                                        {selectedSeason.levels.map(level => {
                                            const currentValue = xpModifications[level.level_number] || level.xp_required_for_level;
                                            const isModified = xpModifications[level.level_number] && 
                                                             xpModifications[level.level_number] !== level.xp_required_for_level;
                                            
                                            return (
                                                <div key={level.id} className={`xp-level-item ${isModified ? 'has-changes' : ''}`}>
                                                    <label>Level {level.level_number}</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={currentValue}
                                                        onChange={(e) => handleIndividualXPChange(level.level_number, e.target.value)}
                                                        className={`xp-input ${isModified ? 'modified' : ''}`}
                                                        placeholder={level.xp_required_for_level.toString()}
                                                    />
                                                    {isModified && (
                                                        <small style={{ 
                                                            color: '#10b981', 
                                                            fontSize: '0.75rem',
                                                            fontWeight: '500'
                                                        }}>
                                                            Changed from {level.xp_required_for_level}
                                                        </small>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <div className="footer-info">
                                    {(() => {
                                        const modifiedCount = Object.keys(xpModifications).filter(levelNum => 
                                            xpModifications[levelNum] !== selectedSeason.levels.find(l => l.level_number === parseInt(levelNum))?.xp_required_for_level
                                        ).length;
                                        
                                        if (modifiedCount > 0) {
                                            return (
                                                <span style={{ 
                                                    color: '#10b981', 
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}>
                                                    {modifiedCount} level{modifiedCount !== 1 ? 's' : ''} modified
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="footer-buttons">
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => setShowXPModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleXPUpdate}
                                        disabled={(() => {
                                            const modifiedCount = Object.keys(xpModifications).filter(levelNum => 
                                                xpModifications[levelNum] !== selectedSeason.levels.find(l => l.level_number === parseInt(levelNum))?.xp_required_for_level
                                            ).length;
                                            return modifiedCount === 0;
                                        })()}
                                    >
                                        Save XP Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                /* Analytics Dashboard Styles */
                .header-actions {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .analytics-dashboard {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    margin-bottom: 30px;
                    overflow: hidden;
                }

                .analytics-header {
                    padding: 24px 24px 0 24px;
                    border-bottom: 1px solid var(--color-border);
                }

                .analytics-header h2 {
                    color: var(--color-text-light);
                    margin: 0 0 20px 0;
                    font-size: 1.5rem;
                    font-weight: 600;
                }

                .analytics-tabs {
                    display: flex;
                    gap: 4px;
                    margin-bottom: -1px;
                }

                .analytics-tab {
                    background: transparent;
                    border: 1px solid var(--color-border);
                    border-bottom: none;
                    color: var(--color-text-muted);
                    padding: 12px 20px;
                    border-radius: 8px 8px 0 0;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .analytics-tab:hover {
                    background: var(--color-surface-alt);
                    color: var(--color-text-light);
                }

                .analytics-tab.active {
                    background: var(--color-primary);
                    color: white;
                    border-color: var(--color-primary);
                }

                .analytics-content {
                    padding: 24px;
                }

                .analytics-empty {
                    text-align: center;
                    padding: 60px 24px;
                    color: var(--color-text-muted);
                }

                .analytics-empty i {
                    font-size: 3rem;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                /* Overview Analytics */
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .metric-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .metric-icon {
                    background: var(--color-primary);
                    color: white;
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                }

                .metric-content h3 {
                    color: var(--color-text-light);
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                }

                .metric-content p {
                    color: var(--color-text-muted);
                    font-size: 0.9rem;
                    margin: 0;
                }

                /* Season Comparisons */
                .season-comparisons {
                    margin-top: 30px;
                }

                .season-comparisons h3 {
                    color: var(--color-text-light);
                    margin: 0 0 20px 0;
                    font-size: 1.3rem;
                }

                .seasons-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 20px;
                }

                .season-analytics-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 20px;
                }

                .season-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--color-border);
                }

                .season-header h4 {
                    color: var(--color-text-light);
                    margin: 0;
                    font-size: 1.1rem;
                }

                .season-status {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .season-status.active {
                    background: #10b981;
                    color: white;
                }

                .season-status.inactive {
                    background: var(--color-border);
                    color: var(--color-text-muted);
                }

                .season-metrics {
                    margin-bottom: 16px;
                }

                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                }

                .metric-label {
                    color: var(--color-text-muted);
                }

                .metric-value {
                    color: var(--color-text-light);
                    font-weight: 600;
                }

                .metric-value.new-users {
                    color: #10b981;
                }

                .metric-value.returning-users {
                    color: #3b82f6;
                }

                .metric-value.retention-rate {
                    color: #10b981;
                }

                .metric-value.churn-rate {
                    color: #ef4444;
                }

                /* Tier Distribution */
                .tier-distribution h5 {
                    color: var(--color-text-light);
                    margin: 0 0 12px 0;
                    font-size: 1rem;
                }

                .tier-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }

                .tier-label {
                    min-width: 80px;
                    font-size: 0.9rem;
                    color: var(--color-text-light);
                }

                .tier-progress {
                    flex: 1;
                    height: 8px;
                    background: var(--color-border);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .tier-fill {
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .tier-fill.lunar {
                    background: #4a90e2;
                }

                .tier-fill.totality {
                    background: #ffd700;
                }

                .tier-percentage {
                    min-width: 40px;
                    text-align: right;
                    font-size: 0.8rem;
                    color: var(--color-text-muted);
                    font-weight: 600;
                }

                /* Retention Analytics */
                .retention-overview {
                    margin-bottom: 30px;
                }

                .retention-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }

                .retention-metric-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 24px;
                    text-align: center;
                }

                .retention-metric-card h3 {
                    color: #10b981;
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 0 0 8px 0;
                }

                .retention-metric-card p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .retention-table, .churn-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: var(--color-background);
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid var(--color-border);
                }

                .retention-table th, .churn-table th {
                    background: var(--color-surface-alt);
                    color: var(--color-text-light);
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .retention-table td, .churn-table td {
                    padding: 12px;
                    border-top: 1px solid var(--color-border);
                    color: var(--color-text-light);
                    font-size: 0.9rem;
                }

                .retention-rate.good, .churn-rate.good {
                    color: #10b981;
                    font-weight: 600;
                }

                .retention-rate.medium, .churn-rate.medium {
                    color: #f59e0b;
                    font-weight: 600;
                }

                .retention-rate.poor, .churn-rate.poor {
                    color: #ef4444;
                    font-weight: 600;
                }

                /* Churn Analytics */
                .churn-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .churn-metric-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }

                .churn-metric-card h3 {
                    color: #ef4444;
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin: 0 0 8px 0;
                }

                .churn-metric-card p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.85rem;
                }

                .tier-changes {
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                }

                .tier-changes .upgrade {
                    color: #10b981;
                    font-weight: 600;
                }

                .tier-changes .downgrade {
                    color: #ef4444;
                    font-weight: 600;
                }

                /* Growth Analytics */
                .growth-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .growth-metric-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }

                .growth-metric-card.highlight {
                    border-color: var(--color-primary);
                    background: linear-gradient(135deg, var(--color-background) 0%, rgba(170, 46, 255, 0.1) 100%);
                }

                .growth-metric-card h3 {
                    color: var(--color-primary);
                    font-size: 1.6rem;
                    font-weight: 700;
                    margin: 0 0 8px 0;
                }

                .growth-metric-card p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .growth-charts {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 30px;
                }

                .growth-chart h3 {
                    color: var(--color-text-light);
                    margin: 0 0 20px 0;
                    font-size: 1.2rem;
                }

                .growth-bars {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .growth-bar-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .growth-bar-label {
                    min-width: 120px;
                    font-size: 0.9rem;
                    color: var(--color-text-light);
                    font-weight: 500;
                }

                .growth-bar-container {
                    flex: 1;
                    height: 20px;
                    background: var(--color-border);
                    border-radius: 10px;
                    overflow: hidden;
                    position: relative;
                }

                .growth-bar {
                    height: 100%;
                    border-radius: 10px;
                    transition: width 0.3s ease;
                }

                .growth-bar.positive {
                    background: linear-gradient(90deg, #10b981, #059669);
                }

                .growth-bar.negative {
                    background: linear-gradient(90deg, #ef4444, #dc2626);
                }

                .growth-bar-value {
                    min-width: 60px;
                    text-align: right;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-text-light);
                }

                /* Table Container Overflow Fix for Kebab Menu */
                .b_admin_styling-table-container {
                    overflow: visible !important;
                    position: relative;
                }

                .b_admin_styling-table {
                    overflow: visible;
                }

                .b_admin_styling-table__actions {
                    overflow: visible;
                    position: relative;
                }

                /* Responsive Design for Analytics */
                @media (max-width: 768px) {
                    .analytics-tabs {
                        flex-wrap: wrap;
                        gap: 8px;
                    }

                    .analytics-tab {
                        font-size: 0.8rem;
                        padding: 10px 16px;
                    }

                    .metrics-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    .seasons-grid {
                        grid-template-columns: 1fr;
                    }

                    .retention-metrics, .churn-metrics, .growth-metrics {
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 16px;
                    }

                    .growth-charts {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }

                    .growth-bar-item {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 8px;
                    }

                    .growth-bar-label {
                        min-width: auto;
                        text-align: center;
                    }

                    .growth-bar-value {
                        text-align: center;
                        min-width: auto;
                    }

                    .retention-table, .churn-table {
                        font-size: 0.8rem;
                    }

                    .retention-table th, .churn-table th,
                    .retention-table td, .churn-table td {
                        padding: 8px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ManageSeasonPass;