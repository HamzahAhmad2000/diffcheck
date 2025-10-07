import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { purchaseAPI, questAPI, itemAPI, notificationAPI } from '../../services/apiClient';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './AdminTables.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import { BAdminTable, BKebabMenu } from './ui';

const SuperAdminNotificationsDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    
    // Dashboard summary and main data
    const [dashboardSummary, setDashboardSummary] = useState({
        pending_quest_approvals: 0,
        pending_business_requests: 0,
        pending_feature_requests: 0,
        pending_deliveries: 0,
        unread_notifications: 0
    });
    const [recentPurchases, setRecentPurchases] = useState([]);
    const [pendingRaffles, setPendingRaffles] = useState([]);
    const [pendingFeatures, setPendingFeatures] = useState([]);
    const [pendingQuests, setPendingQuests] = useState([]);
    
    // New notification management features
    const [notifications, setNotifications] = useState([]);
    const [notificationFilter, setNotificationFilter] = useState('all'); // all, unread, read
    const [selectedNotifications, setSelectedNotifications] = useState([]);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // overview, notifications, tasks
    const [openMenuId, setOpenMenuId] = useState(null);
    
    // Notification search and pagination
    const [notificationSearch, setNotificationSearch] = useState('');
    const [notificationPage, setNotificationPage] = useState(1);
    const [notificationTotal, setNotificationTotal] = useState(0);
    const NOTIFICATIONS_PER_PAGE = 20;

    // Auto-refresh functionality
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                refreshData();
            }, 30000); // Refresh every 30 seconds

            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // Handle visibility change for efficient updates
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && autoRefresh) {
                refreshData();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [autoRefresh]);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (activeTab === 'notifications') {
            fetchPlatformNotifications();
        }
    }, [activeTab, notificationFilter, notificationSearch, notificationPage]);

    const refreshData = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchDashboardSummary(),
                fetchRecentPurchases(),
                fetchPendingRaffles(),
                fetchPendingFeatures(),
                fetchPendingQuests()
            ]);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchDashboardSummary(),
                fetchRecentPurchases(),
                fetchPendingRaffles(),
                fetchPendingFeatures(),
                fetchPendingQuests()
            ]);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboardSummary = async () => {
        try {
            const response = await apiClient.get('/api/admin/dashboard-summary');
            setDashboardSummary(response.data);
        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
        }
    };

    const fetchRecentPurchases = async () => {
        try {
            const response = await purchaseAPI.adminGetDeliveryInfo({
                limit: 10,
                status: 'PENDING_FULFILLMENT'
            });
            setRecentPurchases(response.data.delivery_info || []);
        } catch (error) {
            console.error('Error fetching recent purchases:', error);
        }
    };

    const fetchPendingRaffles = async () => {
        try {
            const response = await purchaseAPI.adminGetRaffleEntries({
                limit: 5,
                status: 'PENDING'
            });
            
            // Group entries by item for display
            const groupedEntries = (response.data.entries || []).reduce((acc, entry) => {
                const itemName = entry.marketplace_item?.name || 'Unknown Item';
                if (!acc[itemName]) {
                    acc[itemName] = {
                        item: entry.marketplace_item,
                        entryCount: 0,
                        latestEntry: entry
                    };
                }
                acc[itemName].entryCount++;
                return acc;
            }, {});
            
            setPendingRaffles(Object.values(groupedEntries));
        } catch (error) {
            console.error('Error fetching pending raffles:', error);
        }
    };

    const fetchPendingFeatures = async () => {
        try {
            const response = await itemAPI.getAdminFeatureRequests({
                status: 'PENDING',
                limit: 10
            });
            setPendingFeatures(response.data.feature_requests || []);
        } catch (error) {
            console.error('Error fetching pending features:', error);
        }
    };

    const fetchPendingQuests = async () => {
        try {
            const response = await questAPI.getPendingQuestApprovals({
                per_page: 10
            });
            setPendingQuests(response.data.quests || []);
        } catch (error) {
            console.error('Error fetching pending quests:', error);
        }
    };

    // New notification management functions
    const fetchPlatformNotifications = async () => {
        try {
            const response = await notificationAPI.adminGetAllNotifications({
                filter: notificationFilter,
                search: notificationSearch,
                page: notificationPage,
                per_page: NOTIFICATIONS_PER_PAGE
            });
            setNotifications(response.data.notifications || []);
            setNotificationTotal(response.data.total || 0);
        } catch (error) {
            console.error('Error fetching platform notifications:', error);
            toast.error('Failed to load notifications');
        }
    };

    const handleSelectRaffleWinner = async (itemId, itemName) => {
        if (!window.confirm(`Select a random winner for "${itemName}"?`)) {
            return;
        }

        try {
            const loadingToast = toast.loading(`Selecting winner for ${itemName}...`);
            await purchaseAPI.adminSelectRaffleWinner(itemId);
            toast.dismiss(loadingToast);
            toast.success(`Winner selected for ${itemName}! 🎉`);
            fetchPendingRaffles(); // Refresh
        } catch (error) {
            console.error('Error selecting raffle winner:', error);
            toast.error('Failed to select winner');
        }
    };

    const handleApproveQuest = async (questId, questTitle) => {
        try {
            const loadingToast = toast.loading(`Approving quest "${questTitle}"...`);
            await questAPI.approveQuest(questId, 'Approved via notifications dashboard');
            toast.dismiss(loadingToast);
            toast.success(`Quest "${questTitle}" approved! ✅`);
            fetchPendingQuests();
            fetchDashboardSummary();
        } catch (error) {
            console.error('Error approving quest:', error);
            toast.error('Failed to approve quest');
        }
    };

    const handleRejectQuest = async (questId, questTitle) => {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const loadingToast = toast.loading(`Rejecting quest "${questTitle}"...`);
            await questAPI.rejectQuest(questId, reason);
            toast.dismiss(loadingToast);
            toast.success(`Quest "${questTitle}" rejected`);
            fetchPendingQuests();
            fetchDashboardSummary();
        } catch (error) {
            console.error('Error rejecting quest:', error);
            toast.error('Failed to reject quest');
        }
    };

    // Notification management handlers
    const handleNotificationSelection = (notificationId, checked) => {
        if (checked) {
            setSelectedNotifications(prev => [...prev, notificationId]);
        } else {
            setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
        }
    };

    const handleSelectAllNotifications = () => {
        if (selectedNotifications.length === notifications.length) {
            setSelectedNotifications([]);
        } else {
            setSelectedNotifications(notifications.map(notif => notif.id));
        }
    };

    const handleBulkNotificationAction = async (action) => {
        if (selectedNotifications.length === 0) {
            toast.error('Please select notifications first');
            return;
        }

        setBulkActionLoading(true);
        try {
            const promises = selectedNotifications.map(id => {
                switch (action) {
                    case 'read':
                        return notificationAPI.adminMarkNotificationRead(id);
                    case 'delete':
                        return notificationAPI.adminDeleteNotification(id);
                    default:
                        return Promise.resolve();
                }
            });

            await Promise.all(promises);
            
            if (action === 'delete') {
                setNotifications(notifications.filter(notif => !selectedNotifications.includes(notif.id)));
                toast.success(`Deleted ${selectedNotifications.length} notifications`);
            } else {
                const newStatus = 'READ';
                setNotifications(notifications.map(notif => 
                    selectedNotifications.includes(notif.id) ? { ...notif, status: newStatus } : notif
                ));
                toast.success(`Marked ${selectedNotifications.length} notifications as read`);
            }
            
            setSelectedNotifications([]);
            fetchDashboardSummary(); // Update counts
        } catch (error) {
            console.error(`Error performing bulk ${action}:`, error);
            toast.error(`Failed to ${action} notifications`);
        } finally {
            setBulkActionLoading(false);
        }
    };

    // Per-notification actions
    const handleMarkNotificationRead = async (notificationId) => {
        try {
            const loadingToast = toast.loading('Marking as read...');
            await notificationAPI.adminMarkNotificationRead(notificationId);
            toast.dismiss(loadingToast);
            toast.success('Notification marked as read');
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, status: 'READ' } : n));
            setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
            fetchDashboardSummary();
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark as read');
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const loadingToast = toast.loading('Deleting notification...');
            await notificationAPI.adminDeleteNotification(notificationId);
            toast.dismiss(loadingToast);
            toast.success('Notification deleted');
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            setSelectedNotifications(prev => prev.filter(id => id !== notificationId));
            setNotificationTotal(prev => Math.max(0, prev - 1));
            fetchDashboardSummary();
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Failed to delete notification');
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'RAFFLE_WINNER':
                return '🎉';
            case 'ORDER_SHIPPED':
                return '📦';
            case 'ORDER_DELIVERED':
                return '✅';
            case 'RAFFLE_ENTRY':
                return '🎫';
            case 'SYSTEM_ANNOUNCEMENT':
                return '📢';
            case 'CUSTOM':
                return '💬';
            case 'QUEST_APPROVED':
                return '⭐';
            case 'QUEST_REJECTED':
                return '❌';
            default:
                return '🔔';
        }
    };

    const getNotificationTypeLabel = (type) => {
        switch (type) {
            case 'RAFFLE_WINNER':
                return 'Raffle Win';
            case 'ORDER_SHIPPED':
                return 'Order Shipped';
            case 'ORDER_DELIVERED':
                return 'Order Delivered';
            case 'RAFFLE_ENTRY':
                return 'Raffle Entry';
            case 'SYSTEM_ANNOUNCEMENT':
                return 'Announcement';
            case 'CUSTOM':
                return 'Message';
            case 'QUEST_APPROVED':
                return 'Quest Approved';
            case 'QUEST_REJECTED':
                return 'Quest Rejected';
            default:
                return 'Notification';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDate(dateString);
    };

    const filteredNotifications = notifications.filter(notif => {
        if (notificationFilter === 'unread') return notif.status === 'UNREAD';
        if (notificationFilter === 'read') return notif.status === 'READ';
        return true;
    });

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content">
                    <div className="admin-container">
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p>Loading notifications dashboard...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content3">
                <div className="admin-container">
                    <div className="admin-header">
                        <div className="header-content">
                            <h1 className="admin-title">
                                <i className="ri-notification-line"></i>
                                Super Admin Notifications
                                {refreshing && <div className="loading-spinner" style={{marginLeft: '1rem', width: '20px', height: '20px'}}></div>}
                            </h1>
                            <p className="admin-subtitle">
                                Manage pending tasks, approvals, and platform notifications
                            </p>
                        </div>
                        <div className="header-controls">
                            <div className="refresh-info">
                                <span className="last-refresh">Last updated: {formatRelativeTime(lastRefresh)}</span>
                                <button 
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                                    title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                                >
                                    <i className={`ri-${autoRefresh ? 'pause' : 'play'}-line`}></i>
                                    Auto-refresh
                                </button>
                            </div>
                            <button 
                                onClick={refreshData}
                                className="refresh-button"
                                disabled={refreshing}
                            >
                                <i className={`ri-refresh-line ${refreshing ? 'spinning' : ''}`}></i>
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Enhanced Tab Navigation */}
                    <div className="tab-navigation">
                        <button 
                            className={`tab-button1 ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <i className="ri-dashboard-line"></i>
                            Overview
                            {(dashboardSummary.pending_quest_approvals + dashboardSummary.pending_business_requests + dashboardSummary.pending_feature_requests > 0) && (
                                <span className="tab-badge">{dashboardSummary.pending_quest_approvals + dashboardSummary.pending_business_requests + dashboardSummary.pending_feature_requests}</span>
                            )}
                        </button>
                        <button 
                            className={`tab-button1 ${activeTab === 'notifications' ? 'active' : ''}`}
                            onClick={() => setActiveTab('notifications')}
                        >
                            <i className="ri-notification-line"></i>
                            Platform Notifications
                            {dashboardSummary.unread_notifications > 0 && (
                                <span className="tab-badge">{dashboardSummary.unread_notifications}</span>
                            )}
                        </button>
                        <button 
                            className={`tab-button1 ${activeTab === 'tasks' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tasks')}
                        >
                            <i className="ri-task-line"></i>
                            Pending Tasks
                            {(recentPurchases.length + pendingRaffles.length > 0) && (
                                <span className="tab-badge">{recentPurchases.length + pendingRaffles.length}</span>
                            )}
                        </button>
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Enhanced Summary Stats */}
                            <div className="admin-stats-grid">
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-compass-3-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{dashboardSummary.pending_quest_approvals}</h3>
                                        <p>Pending Quest Approvals</p>
                                        {dashboardSummary.pending_quest_approvals > 0 && (
                                            <span className="urgent-indicator">Requires attention</span>
                                        )}
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-building-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{dashboardSummary.pending_business_requests}</h3>
                                        <p>Pending Business Requests</p>
                                        {dashboardSummary.pending_business_requests > 0 && (
                                            <span className="urgent-indicator">Requires attention</span>
                                        )}
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-lightbulb-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{dashboardSummary.pending_feature_requests}</h3>
                                        <p>Pending Feature Requests</p>
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-shopping-cart-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{recentPurchases.length}</h3>
                                        <p>Pending Deliveries</p>
                                        {recentPurchases.length > 0 && (
                                            <span className="urgent-indicator">Requires action</span>
                                        )}
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-trophy-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{pendingRaffles.length}</h3>
                                        <p>Pending Raffles</p>
                                        {pendingRaffles.length > 0 && (
                                            <span className="urgent-indicator">Winners needed</span>
                                        )}
                                    </div>
                                </div>
                                <div className="admin-stat-card">
                                    <div className="admin-stat-icon">
                                        <i className="ri-notification-line"></i>
                                    </div>
                                    <div className="admin-stat-content">
                                        <h3>{dashboardSummary.unread_notifications || 0}</h3>
                                        <p>Unread Notifications</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="admin-controls">
                                <div className="filter-group">
                                    <button 
                                        onClick={() => navigate('/admin/notifications/send')}
                                        className="nawabutton"
                                    >
                                        <i className="ri-send-plane-line"></i>
                                        Send Notifications
                                    </button>
                                    <button 
                                        onClick={() => navigate('/admin/marketplace/delivery')}
                                        className="gennawabutton"
                                    >
                                        <i className="ri-truck-line"></i>
                                        Delivery Management
                                    </button>
                                    <button 
                                        onClick={() => navigate('/admin/marketplace/raffles')}
                                        className="gennawabutton"
                                    >
                                        <i className="ri-trophy-line"></i>
                                        Raffle Management
                                    </button>
                                </div>
                            </div>

                            {/* Pending Quest Approvals */}
                            {pendingQuests.length > 0 && (
                                <div className="admin-table-container">
                                    <div className="table-header">
                                        <h2 className="chat-title">
                                            <i className="ri-compass-3-line"></i>
                                            Pending Quest Approvals
                                        </h2>
                                        <button 
                                            onClick={() => navigate('/admin/quest-approvals')}
                                            className="nawa2button"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Quest Title</th>
                                                <th>Business</th>
                                                <th>Type</th>
                                                <th>XP Reward</th>
                                                <th>Submitted</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingQuests.slice(0, 5).map(quest => (
                                                <tr key={quest.id}>
                                                    <td>
                                                        <div className="item-title">{quest.title}</div>
                                                        {quest.description && (
                                                            <div className="item-description" style={{fontSize: '12px', color: '#666'}}>
                                                                {quest.description.substring(0, 80)}...
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{quest.business?.name || 'N/A'}</td>
                                                    <td>
                                                        <span className="status-badge status-pending">
                                                            {quest.quest_type}
                                                        </span>
                                                    </td>
                                                    <td>{quest.xp_reward} XP</td>
                                                    <td>{formatDate(quest.created_at)}</td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button
                                                                onClick={() => handleApproveQuest(quest.id, quest.title)}
                                                                className="btn-edit"
                                                                title="Approve quest"
                                                            >
                                                                <i className="ri-check-line"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectQuest(quest.id, quest.title)}
                                                                className="btn-delete"
                                                                title="Reject quest"
                                                            >
                                                                <i className="ri-close-line"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pending Deliveries */}
                            {recentPurchases.length > 0 && (
                                <div className="admin-table-container">
                                    <div className="table-header">
                                        <h2 className="chat-title">
                                            <i className="ri-truck-line"></i>
                                            Recent Marketplace Purchases - Pending Delivery
                                        </h2>
                                        <button 
                                            onClick={() => navigate('/admin/marketplace/delivery')}
                                            className="nawa2button"
                                        >
                                            Manage All
                                        </button>
                                    </div>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Purchase ID</th>
                                                <th>Customer</th>
                                                <th>Item</th>
                                                <th>Order Date</th>
                                                <th>Delivery Address</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentPurchases.slice(0, 5).map(purchase => (
                                                <tr key={purchase.id}>
                                                    <td>#{purchase.id}</td>
                                                    <td>
                                                        <div className="customer-name">
                                                            {purchase.delivery_info?.full_name || purchase.user?.username || 'Unknown'}
                                                        </div>
                                                        <div className="customer-email" style={{fontSize: '12px', color: '#666'}}>
                                                            {purchase.delivery_info?.email || purchase.user?.email || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="item-name">
                                                            {purchase.marketplace_item?.name || 'Unknown Item'}
                                                        </div>
                                                        <div className="item-cost" style={{fontSize: '12px', color: '#666'}}>
                                                            {purchase.marketplace_item?.points_cost || 0} points
                                                        </div>
                                                    </td>
                                                    <td>{formatDate(purchase.created_at)}</td>
                                                    <td>
                                                        {purchase.delivery_info ? (
                                                            <div className="address-preview">
                                                                <div className="address-line" style={{fontSize: '12px'}}>
                                                                    {purchase.delivery_info.address}
                                                                </div>
                                                                <div className="address-city" style={{fontSize: '11px', color: '#666'}}>
                                                                    {purchase.delivery_info.city}, {purchase.delivery_info.state_province}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="no-address">No address</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => navigate('/admin/marketplace/delivery')}
                                                            className="btn-edit"
                                                            title="Manage delivery"
                                                        >
                                                            <i className="ri-truck-line"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pending Raffles */}
                            {pendingRaffles.length > 0 && (
                                <div className="admin-table-container">
                                    <div className="table-header">
                                        <h2 className="chat-title">
                                            <i className="ri-trophy-line"></i>
                                            Raffle Items Ready for Winner Selection
                                        </h2>
                                        <button 
                                            onClick={() => navigate('/admin/marketplace/raffles')}
                                            className="nawa2button"
                                        >
                                            Manage All
                                        </button>
                                    </div>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Item Name</th>
                                                <th>Entry Count</th>
                                                <th>Points Cost</th>
                                                <th>Latest Entry</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingRaffles.slice(0, 5).map((raffle, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <div className="item-name">{raffle.item?.name || 'Unknown Item'}</div>
                                                        {raffle.item?.description && (
                                                            <div className="item-description" style={{fontSize: '12px', color: '#666'}}>
                                                                {raffle.item.description.substring(0, 60)}...
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="status-badge status-active">
                                                            {raffle.entryCount} entries
                                                        </span>
                                                    </td>
                                                    <td>{raffle.item?.points_cost || 0} points</td>
                                                    <td>{formatDate(raffle.latestEntry?.entry_date)}</td>
                                                    <td>
                                                        <button
                                                            onClick={() => handleSelectRaffleWinner(raffle.item?.id, raffle.item?.name)}
                                                            className="nawabutton"
                                                            style={{padding: '6px 12px', fontSize: '12px'}}
                                                        >
                                                            <i className="ri-trophy-line"></i>
                                                            Select Winner
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pending Feature Requests */}
                            {pendingFeatures.length > 0 && (
                                <div className="admin-table-container">
                                    <div className="table-header">
                                        <h2 className="chat-title">
                                            <i className="ri-lightbulb-line"></i>
                                            Recent Feature Requests
                                        </h2>
                                        <button 
                                            onClick={() => navigate('/admin/feature-requests')}
                                            className="nawa2button"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Title</th>
                                                <th>Business</th>
                                                <th>Type</th>
                                                <th>Votes</th>
                                                <th>Submitted</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingFeatures.slice(0, 5).map(feature => (
                                                <tr key={feature.id}>
                                                    <td>
                                                        <div className="item-title">{feature.title}</div>
                                                        {feature.description && (
                                                            <div className="item-description" style={{fontSize: '12px', color: '#666'}}>
                                                                {feature.description.substring(0, 80)}...
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{feature.business?.name || 'Platform'}</td>
                                                    <td>
                                                        <span className="status-badge status-pending">
                                                            {feature.item_type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="item-votes">
                                                            <span style={{color: '#22c55e'}}>
                                                                <i className="ri-thumb-up-line"></i> {feature.upvotes || 0}
                                                            </span>
                                                            <span style={{color: '#ef4444', marginLeft: '8px'}}>
                                                                <i className="ri-thumb-down-line"></i> {feature.downvotes || 0}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>{formatDate(feature.created_at)}</td>
                                                    <td>
                                                        <button
                                                            onClick={() => navigate('/admin/feature-requests')}
                                                            className="btn-edit"
                                                            title="Review feature request"
                                                        >
                                                            <i className="ri-eye-line"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Empty State */}
                            
                        </>
                    )}

                    {/* Platform Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="notifications-management">
                            {/* Notification Controls */}
                            <div className="notification-controls">
                                <div className="filter-section">
                                    <div className="filter-group">
                                        <button 
                                            className={`filter-btn1 ${notificationFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => setNotificationFilter('all')}
                                        >
                                            All
                                        </button>
                                        <button 
                                            className={`filter-btn1 ${notificationFilter === 'unread' ? 'active' : ''}`}
                                            onClick={() => setNotificationFilter('unread')}
                                        >
                                            Unread ({notifications.filter(n => n.status === 'UNREAD').length})
                                        </button>
                                        <button 
                                            className={`filter-btn1 ${notificationFilter === 'read' ? 'active' : ''}`}
                                            onClick={() => setNotificationFilter('read')}
                                        >
                                            Read
                                        </button>
                                    </div>
                                    
                                    <div className="search-box">
                                        <i className="ri-search-line"></i>
                                        <input
                                            type="text"
                                            placeholder="Search notifications..."
                                            value={notificationSearch}
                                            onChange={(e) => setNotificationSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Bulk Actions */}
                                {selectedNotifications.length > 0 && (
                                    <div className="bulk-actions">
                                        <span className="selected-count">
                                            {selectedNotifications.length} selected
                                        </span>
                                        <div className="bulk-buttons">
                                            <button
                                                onClick={() => handleBulkNotificationAction('read')}
                                                disabled={bulkActionLoading}
                                                className="bulk-btn mark-read"
                                            >
                                                <i className="ri-eye-line"></i>
                                                Mark as Read
                                            </button>
                                            <button
                                                onClick={() => handleBulkNotificationAction('delete')}
                                                disabled={bulkActionLoading}
                                                className="bulk-btn delete"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notifications List (using shared admin table and kebab menu) */}
                            <div className="admin-table-container">
                                <BAdminTable
                                    headers={[
                                        (
                                            <input
                                                type="checkbox"
                                                checked={selectedNotifications.length === notifications.length && notifications.length > 0}
                                                onChange={handleSelectAllNotifications}
                                                aria-label="Select all notifications"
                                            />
                                        ),
                                        'Type',
                                        'Title',
                                        'User',
                                        'Message',
                                        'Status',
                                        'Created',
                                        'Actions',
                                    ]}
                                >
                                    {filteredNotifications.map(notification => (
                                        <tr key={notification.id} className={notification.status === 'UNREAD' ? 'unread' : ''}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNotifications.includes(notification.id)}
                                                    onChange={(e) => handleNotificationSelection(notification.id, e.target.checked)}
                                                    aria-label={`Select notification ${notification.id}`}
                                                />
                                            </td>
                                            <td>
                                                <div className="notification-type">
                                                    <span className="type-icon">{getNotificationIcon(notification.notification_type)}</span>
                                                    <span className="type-label">{getNotificationTypeLabel(notification.notification_type)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="notification-title1">{notification.title}</div>
                                            </td>
                                            <td>
                                                <div className="user-info">
                                                    <div className="user-name">{notification.user?.username || 'Unknown User'}</div>
                                                    <div className="user-email">{notification.user?.email}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="notification-message1">
                                                    {notification.message?.substring(0, 100)}
                                                    {notification.message?.length > 100 && '...'}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${notification.status.toLowerCase()}`}>
                                                    {notification.status}
                                                </span>
                                            </td>
                                            <td>{formatRelativeTime(notification.created_at)}</td>
                                            <td className="b_admin_styling-table__actions">
                                                <BKebabMenu
                                                    isOpen={openMenuId === notification.id}
                                                    onToggle={() => setOpenMenuId(openMenuId === notification.id ? null : notification.id)}
                                                    items={[
                                                        ...(notification.status === 'UNREAD'
                                                            ? [{ label: 'Mark as Read', icon: 'ri-eye-line', onClick: () => { setOpenMenuId(null); handleMarkNotificationRead(notification.id); } }]
                                                            : []),
                                                        { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDeleteNotification(notification.id); } },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </BAdminTable>

                                {/* Pagination */}
                                {notificationTotal > NOTIFICATIONS_PER_PAGE && (
                                    <div className="pagination">
                                        <button
                                            onClick={() => setNotificationPage(prev => Math.max(prev - 1, 1))}
                                            disabled={notificationPage === 1}
                                            className="pagination-btn"
                                        >
                                            <i className="ri-arrow-left-line"></i>
                                            Previous
                                        </button>
                                        <span className="page-info">
                                            Page {notificationPage} of {Math.ceil(notificationTotal / NOTIFICATIONS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setNotificationPage(prev => prev + 1)}
                                            disabled={notificationPage >= Math.ceil(notificationTotal / NOTIFICATIONS_PER_PAGE)}
                                            className="pagination-btn"
                                        >
                                            Next
                                            <i className="ri-arrow-right-line"></i>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Empty state for notifications */}
                            {filteredNotifications.length === 0 && (
                                <div className="admin-empty-state">
                                    <i className="ri-notification-off-line"></i>
                                    <h3>No notifications found</h3>
                                    <p>There are no notifications matching your current filter.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tasks Tab */}
                    {activeTab === 'tasks' && (
                        <div className="tasks-management">
                            <div className="tasks-summary">
                                <div className="task-stat-card">
                                    <h3>{recentPurchases.length}</h3>
                                    <p>Pending Deliveries</p>
                                    <button onClick={() => navigate('/admin/marketplace/delivery')} className="task-action-btn">
                                        Manage
                                    </button>
                                </div>
                                <div className="task-stat-card">
                                    <h3>{pendingRaffles.length}</h3>
                                    <p>Pending Raffles</p>
                                    <button onClick={() => navigate('/admin/marketplace/raffles')} className="task-action-btn">
                                        Manage
                                    </button>
                                </div>
                                <div className="task-stat-card">
                                    <h3>{pendingQuests.length}</h3>
                                    <p>Quest Approvals</p>
                                    <button onClick={() => navigate('/admin/quest-approvals')} className="task-action-btn">
                                        Review
                                    </button>
                                </div>
                                {/* Removed Feature Requests from Pending Tasks for clarity and scope */}
                            </div>

                            {/* Quick Actions for High Priority Tasks */}
                            {(pendingRaffles.length > 0 || pendingQuests.length > 0) && (
                                <div className="quick-actions-section">
                                    <h3>Quick Actions</h3>
                                    
                                    {/* Quick Raffle Winners */}
                                    {pendingRaffles.slice(0, 3).map((raffle, index) => (
                                        <div key={index} className="quick-action-item">
                                            <div className="action-info">
                                                <span className="action-icon">🎯</span>
                                                <div>
                                                    <strong>Select winner for {raffle.item?.name}</strong>
                                                    <p>{raffle.entryCount} entries waiting</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleSelectRaffleWinner(raffle.item?.id, raffle.item?.name)}
                                                className="quick-action-btn"
                                            >
                                                Select Winner
                                            </button>
                                        </div>
                                    ))}

                                    {/* Quick Quest Approvals */}
                                    {pendingQuests.slice(0, 3).map(quest => (
                                        <div key={quest.id} className="quick-action-item">
                                            <div className="action-info">
                                                <span className="action-icon">⭐</span>
                                                <div>
                                                    <strong>Approve {quest.title}</strong>
                                                    <p>{quest.business?.name || 'No business'} • {quest.xp_reward} XP</p>
                                                </div>
                                            </div>
                                            <div className="quick-action-buttons">
                                                <button
                                                    onClick={() => handleApproveQuest(quest.id, quest.title)}
                                                    className="quick-approve-btn"
                                                >
                                                    ✓ Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectQuest(quest.id, quest.title)}
                                                    className="quick-reject-btn"
                                                >
                                                    ✗ Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuperAdminNotificationsDashboard; 