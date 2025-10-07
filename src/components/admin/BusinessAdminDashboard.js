import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import AudienceSelection from '../common/AudienceSelection';
import { businessAPI, authAPI, userProfileAPI } from '../../services/apiClient';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../SuperAdminDashboard.css';
import './BusinessSpecificDashboard.css';
import './BusinessFeedbackManagement.css';

const BusinessAdminDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { 
        business, 
        loading, 
        error, 
        aiPoints, 
        tier, 
        permissions, 
        questCredits, 
        totalAdminSeats,
        usedAdminSeats,
        refreshBusiness, 
        setBusiness 
    } = useBusiness();
    const [isLoading, setIsLoading] = useState(true);
    
    // Tooltip texts for help icons
    const tooltipTexts = {
        "Quick Poll": "Run a fast, 1–3 question survey to get quick insights from your audience.",
        "New Survey": "Build a custom survey from scratch with as many questions as you like.",
        "AI Survey Builder": "Let AI create your survey from a simple prompt—fast, smart, and easy.",
        "Quests": "Engage your audience with tasks like follows, shares, and subscriptions—rewarded with XP.",
        "Bug & Feature Prioritization": "Let your community vote on bugs and features so you can focus on what matters most.",
        "Audience Selection": "Choose who sees your brand page—open to all or limited to specific groups like Discord roles or email domains.",
        "Brand Wall": "Upload your logo to customize your brand page and control who can see it (see Audience Selection).",
        "Business Analytics": "View results and insights from your survey in a clear, easy-to-read report.",
        "Manage Surveys": "Manage your surveys—publish or unpublish, duplicate them, choose who can respond, delete if needed, and view analytics."
    };
    
    // Local copy of user that we can update
    const [localUser, setLocalUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    
    // Business audience modal states
    const [showBusinessAudienceModal, setShowBusinessAudienceModal] = useState(false);
    const [businessAudienceSettings, setBusinessAudienceSettings] = useState(null);
    const [audienceLoading, setAudienceLoading] = useState(false);
    const [audienceError, setAudienceError] = useState(null);
    
    // Discord Integration State
    const [discordServerId, setDiscordServerId] = useState('');
    const [isSavingDiscord, setIsSavingDiscord] = useState(false);
    const [isInvitingBot, setIsInvitingBot] = useState(false);
    const [isSyncingRoles, setIsSyncingRoles] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);
    
    // Get business admin's business info from localStorage
    const businessId = localUser.business_id;
    const adminPermissions = localUser.business_admin_permissions || {};

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const successParam = queryParams.get('success');
        const guildId = queryParams.get('guild_id');
        
        if (successParam === 'discord_linked') {
            toast.success("Discord account linked successfully!");
            console.log('[BusinessAdminDashboard] Discord linking success detected, refreshing user data...');
            // Refetch user profile to get updated discord_id
            apiClient.get('/auth/profile').then(response => {
                const updatedUser = response.data;
                console.log('[BusinessAdminDashboard] Updated user data received:', updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setLocalUser(updatedUser); // Update local state to trigger re-render
                refreshBusiness(); // Refresh business context as well
                // Clean the URL
                navigate('/business-admin/dashboard', { replace: true });
            }).catch(err => {
                console.error('[BusinessAdminDashboard] Failed to refresh user data:', err);
                toast.error("Failed to refresh user data after linking.");
            });
        } else if (successParam === 'discord_bot_added' && guildId) {
            toast.success(`Discord bot successfully added to server (ID: ${guildId})! Roles have been synced.`);
            console.log('[BusinessAdminDashboard] Discord bot addition success detected, refreshing business data...');
            refreshBusiness();
            navigate('/business-admin/dashboard', { replace: true });
        } else if (successParam === 'discord_bot_invited') {
            toast.success('Discord bot invitation completed! The server may have been configured automatically.');
            console.log('[BusinessAdminDashboard] Discord bot invitation completed, refreshing business data...');
            refreshBusiness();
            navigate('/business-admin/dashboard', { replace: true });
        }
        
        // Handle error messages
        const errorParam = queryParams.get('error');
        if (errorParam === 'discord_callback_failed') {
            toast.error('Discord integration failed. Please try again.');
            navigate('/business-admin/dashboard', { replace: true });
        }
    }, [location, navigate, refreshBusiness]);

    useEffect(() => {
        // Business context is handled by BusinessProvider
        setIsLoading(loading);
        
        if (error) {
            toast.error(error);
        }
        
        if (!localUser.business_id && !loading) {
            toast.error('Business Admin not associated with a business.');
            navigate('/login');
        }
        
        if (business?.discord_server) {
            setDiscordServerId(business.discord_server);
        }
    }, [loading, error, localUser.business_id, navigate, business]);

    const handleNavigation = (path, actionType = "") => {
        if (!business) return;

        if (path) {
            navigate(path, { state: { businessId: business.id, businessName: business.name } });
        } else {
            console.warn(`Navigation path for ${actionType} is undefined.`);
            toast.info(`Feature '${actionType}' for ${business.name} is coming soon!`);
        }
    };

    const handleManageBusinessAudience = async () => {
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            const response = await apiClient.get(`/api/businesses/${businessId}/audience`);
            setBusinessAudienceSettings(response.data);
        } catch (error) {
            console.error('Error loading business audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to load audience settings');
            setBusinessAudienceSettings({});
        } finally {
            setAudienceLoading(false);
        }
        
        setShowBusinessAudienceModal(true);
    };

    const handleSaveBusinessAudience = async (settings) => {
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            await apiClient.put(`/api/businesses/${businessId}/audience`, settings);
            toast.success('Business audience settings updated successfully!');
            setShowBusinessAudienceModal(false);
            const response = await businessAPI.getDetails(businessId);
            setBusiness(response.data);
        } catch (error) {
            console.error('Error updating business audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to update audience settings');
        } finally {
            setAudienceLoading(false);
        }
    };

    const handleInitiateDiscordLink = async () => {
        try {
            const response = await apiClient.get('/linking/discord/initiate');
            if (response.data.redirect_url) {
                window.location.href = response.data.redirect_url;
            }
        } catch (error) {
            toast.error("Could not initiate Discord linking. Please try again.");
            console.error(error);
        }
    };

    const handleInviteDiscordBot = async () => {
        setIsInvitingBot(true);
        try {
            const response = await authAPI.inviteDiscordBot(businessId);
            if (response.data.bot_invite_url) {
                window.location.href = response.data.bot_invite_url;
            }
        } catch (error) {
            toast.error("Failed to generate bot invite link. Please try again.");
            console.error(error);
        } finally {
            setIsInvitingBot(false);
        }
    };

    const handleSaveDiscordServer = async () => {
        if (!discordServerId) {
            toast.error("Please enter a Discord Server ID.");
            return;
        }
        setIsSavingDiscord(true);
        try {
            await businessAPI.update(businessId, { discord_server: discordServerId });
            toast.success("Discord server linked successfully! Roles are being synced.");
            refreshBusiness(); // Refresh business context
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to link Discord server.");
        } finally {
            setIsSavingDiscord(false);
        }
    };

    const handleSyncRoles = async () => {
        setIsSyncingRoles(true);
        try {
            await businessAPI.syncRoles(businessId);
            toast.success("Discord roles synced successfully!");
            refreshBusiness(); // Refresh business context
        } catch (error) {
            toast.error("Failed to sync Discord roles. Please try again.");
            console.error(error);
        } finally {
            setIsSyncingRoles(false);
        }
    };

    const handleUnlinkDiscord = async () => {
        if (!window.confirm("Are you sure you want to unlink your Discord account? This will remove the connection for your user profile.")) return;
        
        setIsUnlinking(true);
        try {
            await userProfileAPI.unlinkSocialAccount('discord');
            toast.success("Discord account has been unlinked.");

            // Refresh the user object in state and local storage
            const updatedUser = { ...localUser, discord_id: null };
            setLocalUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Also clear the server ID from the business if it's set
            if (business && business.discord_server) {
                await businessAPI.update(businessId, { discord_server: null });
                toast.success("Business Discord connection has been reset.");
                refreshBusiness(); // This will pull the updated business state
            }
            
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to unlink Discord account.");
            console.error("Unlink error:", error);
        } finally {
            setIsUnlinking(false);
        }
    };

    const businessActionGroups = business ? [
        {
            groupTitle: "Surveys",
            items: [
                { label: "New Survey", icon: "ri-survey-line", path: `/admin/business/${businessId}/surveys/new`, actionKey: "can_create_surveys" },
                { label: "AI Survey Builder", icon: "ri-robot-line", path: '/survey-builder', actionKey: "can_create_surveys", requiresAI: true },
                { label: "Quick Poll", icon: "ri-bar-chart-box-line", path: '/quick-poll', actionKey: "can_create_surveys" },
                { label: "Manage Surveys", icon: "ri-list-settings-line", path: `/admin/business/${businessId}/surveys/manage`, actionKey: "can_edit_surveys" },
            ]
        },
        {
            groupTitle: "Business Analytics",
            items: [
                { label: "Business Analytics", icon: "ri-bar-chart-box-line", path: `/admin/business/${businessId}/analytics`, actionKey: "can_view_survey_analytics" },
            ]
        },
        {
            groupTitle: "Quests",
            items: [
                { label: "Create Quest", icon: "ri-treasure-map-line", action: "create_quest", actionKey: "can_create_quests" },
                { label: "Manage Quests", icon: "ri-list-settings-line", path: `/admin/business/${businessId}/quests`, actionKey: "can_create_quests" },
                { label: "Verify Completions", icon: "ri-shield-check-line", path: `/admin/business/${businessId}/quest-verifications`, actionKey: "can_verify_quests" },
            ]
        },
        {
            groupTitle: "Bug & Feature Prioritization",
            items: [
                { label: "Bug Reports", icon: "ri-bug-line", path: `/admin/business/${businessId}/bugs`, actionKey: "can_create_bug_reports"},
                { label: "Feature Requests", icon: "ri-lightbulb-flash-line", path: `/admin/business/${businessId}/features`, actionKey: "can_create_feature_requests"},
                { label: "All Feedback", icon: "ri-feedback-line", path: `/admin/business/${businessId}/items`, actionKey: "can_manage_items"},
            ]
        },
        {
            groupTitle: "Brand Wall",
            items: [
                { label: "Brand Logo", icon: "ri-palette-line", path: `/admin/business/${businessId}/splash-page/edit`, actionKey: "can_edit_splash_page" },
                { label: "Audience Selection", icon: "ri-group-line", action: "manage_audience", actionKey: "can_edit_splash_page" },
            ]
        },
        {
            groupTitle: "Business Admins",
            items: [
                { label: "Manage Business Admins", icon: "ri-admin-line", path: `/admin/business/${businessId}/admins/manage`, actionKey: "can_manage_admins" }
            ]
        },
        {
            groupTitle: "Discord Integration",
            items: [
                { label: "Link Discord Account", icon: "ri-discord-fill", action: "link_discord", actionKey: "can_link_discord" },
            ]
        }
    ] : [];

    if (isLoading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content business-specific-dashboard">
                    <p>Loading business dashboard...</p>
                </div>
            </div>
        );
    }

    if (!business) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content business-specific-dashboard">
                    <p>Business not found or access denied.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content business-specific-dashboard">
                <div className="dashboard-header">
                    <h1 className="dashboard-title" style={{ color: 'black' }}>Business Admin Panel</h1>
                    <p className="dashboard-subtitle" style={{ color: 'black' }}>
                        Managing: {business.name} | Tier: {tier} | Status: {business.is_active ? "Active" : "Inactive"}
                    </p>
                    <div className="ai-points-display">
                        <div className="points-balance">
                                <i className="ri-cpu-line"></i>
                            <span>AI Points: <strong>{aiPoints}</strong></span>
                            {aiPoints < 5 && (
                                <button 
                                    className="buy-points-btn"
                                    onClick={() => navigate('/business/purchase-points')}
                                >
                                    Buy More Points
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="dashboard-grid">
                    {businessActionGroups.map((group, groupIndex) => {
                        const permittedItems = group.items.filter(item => {
                            if (!item.actionKey) return true;
                            return permissions[item.actionKey] === true && adminPermissions[item.actionKey] === true;
                        });

                        return permittedItems.length > 0 && (
                            <div className="dashboard-card" key={groupIndex}>
                                <h2 className="card-title">
                                    {group.groupTitle}
                                    {tooltipTexts[group.groupTitle] && (
                                        <i
                                            className="ri-information-line info-icon"
                                            data-tooltip={tooltipTexts[group.groupTitle]}
                                            style={{ marginLeft: '4px' }}
                                        ></i>
                                    )}
                                </h2>
                                <div className="card-actions">
                                    {permittedItems.map((action, actionIndex) => (
                                        <button
                                            key={actionIndex}
                                            className="dashboard-button"
                                            onClick={() => {
                                                if (action.action === 'manage_audience') {
                                                    handleManageBusinessAudience();
                                                } else if (action.action === 'create_quest') {
                                                    const tierAllowsQuests = business?.tier_info?.can_create_quests || false;
                                                    const hasLegacyLimit = business?.monthly_quest_limit > 0;
                                                    const hasQuestCapability = tierAllowsQuests || hasLegacyLimit;
                                                    
                                                    if (!hasQuestCapability && questCredits <= 0) {
                                                        toast.error("Your tier does not include quest creation. Please upgrade or purchase quest credits.");
                                                        navigate('/business/purchase-quest-credits');
                                                    } else if (questCredits <= 0 && hasQuestCapability) {
                                                        toast.error("You have no quest credits remaining this month. Please purchase more.");
                                                        navigate('/business/purchase-quest-credits');
                                                    } else {
                                                        navigate(`/admin/business/${businessId}/quests/new`);
                                                    }
                                                } else {
                                                    handleNavigation(action.path, action.label);
                                                }
                                            }}
                                        >
                                            <i className={action.icon}></i>
                                            <span>
                                                {action.label}
                                                {tooltipTexts[action.label] && (
                                                    <i
                                                        className="ri-information-line info-icon"
                                                        data-tooltip={tooltipTexts[action.label]}
                                                        style={{ marginLeft: '4px' }}
                                                    ></i>
                                                )}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    
                    <div className="dashboard-card">
                        <h2 className="card-title">Discord Integration</h2>
                        <div className="card-actions-vertical">
                            {!localUser.discord_id ? (
                                <div className="discord-cta">
                                    <p style={{fontSize:'16px'}}>Connect your Discord account to enable role-based survey access and other features.</p>
                                    <button className="dashboard-button" onClick={handleInitiateDiscordLink}>
                                        <i className="ri-discord-fill"></i>
                                        <span>Link Discord Account</span>
                                    </button>
                                </div>
                            ) : business && !business.discord_server ? (
                                <div className="discord-cta">
                                    <p>Your account is linked! Now, invite the Discord bot to your server and configure it for <strong>{business.name}</strong>.</p>
                                    
                                    <div className="discord-setup-steps">
                                        <div className="setup-step">
                                            <h4>Step 1: Invite Discord Bot</h4>
                                            <p>Click the button below to invite our Discord bot to your server with the required permissions.</p>
                                            <button 
                                                className="dashboard-button discord-bot-button" 
                                                onClick={handleInviteDiscordBot}
                                                disabled={isInvitingBot}
                                            >
                                                <i className="ri-robot-line"></i>
                                                {isInvitingBot ? 'Inviting Bot...' : 'Invite Discord Bot to Server'}
                                            </button>
                                        </div>
                                        
                                        <div className="setup-step">
                                            <h4>Step 2: Manual Server ID (Optional)</h4>
                                            <p>If automatic setup doesn't work, you can manually enter your Discord Server ID:</p>
                                            <div className="form-group-vertical">
                                                <label htmlFor="discordServerId">Discord Server ID</label>
                                                <input
                                                    type="text"
                                                    id="discordServerId"
                                                    value={discordServerId}
                                                    onChange={(e) => setDiscordServerId(e.target.value)}
                                                    placeholder="Enter numeric server ID"
                                                    className="simple-input"
                                                />
                                                <button className="dashboard-button secondary" onClick={handleSaveDiscordServer} disabled={isSavingDiscord}>
                                                    {isSavingDiscord ? 'Saving...' : 'Save & Sync Roles'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : business && business.discord_server ? (
                                <div className="discord-cta">
                                    <p><strong>{business.name}</strong> is linked to Discord server ID: <strong>{business.discord_server}</strong>.</p>
                                    
                                    <div className="discord-management">
                                        <div className="server-info">
                                            <h4>Current Discord Server</h4>
                                            <p>Server ID: <code>{business.discord_server}</code></p>
                                            <div className="button-group horizontal">
                                                <button 
                                                    className="dashboard-button secondary"
                                                    onClick={handleSyncRoles}
                                                    disabled={isSyncingRoles}
                                                >
                                                    <i className="ri-refresh-line"></i>
                                                    {isSyncingRoles ? 'Syncing...' : 'Sync Roles'}
                                                </button>
                                                <button 
                                                    className="dashboard-button danger"
                                                    onClick={handleUnlinkDiscord}
                                                    disabled={isUnlinking}
                                                >
                                                    <i className="ri-link-unlink-m"></i>
                                                    {isUnlinking ? 'Unlinking...' : 'Unlink'}
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="change-server">
                                            <h4>Change Discord Server</h4>
                                            <p>To connect a different Discord server:</p>
                                            <div className="form-group-vertical">
                                                <label htmlFor="discordServerId">New Discord Server ID</label>
                                                <input
                                                    type="text"
                                                    id="discordServerId"
                                                    value={discordServerId}
                                                    onChange={(e) => setDiscordServerId(e.target.value)}
                                                    placeholder="Enter new numeric server ID"
                                                    className="simple-input"
                                                />
                                                <div className="button-group">
                                                    <button 
                                                        className="dashboard-button discord-bot-button" 
                                                        onClick={handleInviteDiscordBot}
                                                        disabled={isInvitingBot}
                                                    >
                                                        <i className="ri-robot-line"></i>
                                                        {isInvitingBot ? 'Inviting Bot...' : 'Invite Bot to New Server'}
                                                    </button>
                                                    <button className="dashboard-button secondary" onClick={handleSaveDiscordServer} disabled={isSavingDiscord}>
                                                        {isSavingDiscord ? 'Updating...' : 'Update & Re-Sync Roles'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    
                    {businessActionGroups.every(group =>
                        group.items.filter(item => {
                            if (!item.actionKey) return true;
                            return permissions[item.actionKey] === true && adminPermissions[item.actionKey] === true;
                        }).length === 0
                    ) && (
                        <div className="dashboard-card">
                            <h2 className="card-title">No Actions Available</h2>
                            <p>You do not have permissions for any actions. Contact a super admin.</p>
                        </div>
                    )}
                </div>

                {/* Business Audience Selection Modal */}
                {showBusinessAudienceModal && (
                    <div className="modal-backdrop" onClick={() => setShowBusinessAudienceModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="chat-title">
                                    <i className="ri-group-line"></i>
                                    Audience Selection
                                </h2>
                                <button 
                                    className="close-button" 
                                    onClick={() => setShowBusinessAudienceModal(false)}
                                    aria-label="Close"
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div style={{ padding: '20px', maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
                                {business && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
                                            {business.name}
                                        </h3>
                                        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                                            Configure who can access your business and its content. 
                                            {business.audience_type === 'PUBLIC' ? 
                                                ' Currently set to PUBLIC - anyone can view your business.' :
                                                ' Currently set to RESTRICTED - only specified users can access.'
                                            }
                                        </p>
                                    </div>
                                )}
                                
                                <AudienceSelection
                                    type="business"
                                    initialSettings={businessAudienceSettings || {}}
                                    onSave={handleSaveBusinessAudience}
                                    loading={audienceLoading}
                                    error={audienceError}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessAdminDashboard; 