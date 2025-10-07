import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import apiClient, { authAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BSelect, BCheckbox } from './ui';
import BButton from './ui/BButton';

const EditBusiness = () => {
    const navigate = useNavigate();
    const { businessId } = useParams();

    const [businessName, setBusinessName] = useState('');
    const [location, setLocation] = useState('');
    const [tier, setTier] = useState('normal');
    const [website, setWebsite] = useState('');
    const [discordServer, setDiscordServer] = useState('');
    const [audienceType, setAudienceType] = useState('PUBLIC');
    const [isActive, setIsActive] = useState(true);
    const [isApproved, setIsApproved] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [defaultPublicOnWall, setDefaultPublicOnWall] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isSyncingRoles, setIsSyncingRoles] = useState(false);
    const [isInvitingBot, setIsInvitingBot] = useState(false);
    const [discordRoles, setDiscordRoles] = useState([]);

    // Get user role for conditional rendering
    const userRole = localStorage.getItem('userRole');
    const isSuperAdmin = userRole === 'super_admin';

    // Updated permissions to match CreateBusiness
    const availablePermissions = {
        can_create_surveys: "Create Surveys",
        can_edit_surveys: "Edit Surveys",
        can_delete_surveys: "Delete Surveys",
        can_view_survey_analytics: "View Survey Analytics",
        can_create_quests: "Create Quests",
        can_edit_quests: "Edit Quests",
        can_delete_quests: "Delete Quests",
        can_create_bug_reports: "Create Bug Reports",
        can_edit_bug_reports: "Edit Bug Reports",
        can_change_bug_status: "Change Bug Status",
        can_create_feature_requests: "Create Feature Requests",
        can_edit_feature_requests: "Edit Feature Requests",
        can_change_feature_status: "Change Feature Status",
        can_view_splash: "View Splash Page",
        can_edit_splash_page: "Edit Business Splash Page",
        can_manage_admins: "Manage Business Admins",
        can_manage_items: "Manage Feedback Items",
        // Co-Create / Ideas permissions
        can_create_ideas: "Create Ideas",
        can_review_ideas: "Review Ideas",
        can_moderate_ideas: "Moderate Ideas",
        can_archive_ideas: "Archive Ideas",
        can_view_co_create: "View Co-Create"
    };
    
    const [permissions, setPermissions] = useState(
        Object.keys(availablePermissions).reduce((acc, key) => ({ ...acc, [key]: false }), {})
    );

    const fetchDiscordRoles = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/businesses/${businessId}/discord-roles`);
            setDiscordRoles(response.data.roles || []);
        } catch (error) {
            console.error("Error fetching Discord roles:", error);
            setDiscordRoles([]);
        }
    }, [businessId]);

    const fetchBusinessDetails = useCallback(async () => {
        if (!businessId) return;
        
        setIsFetching(true);
        try {
            const response = await apiClient.get(`/api/businesses/${businessId}`);
            const biz = response.data;
            
            setBusinessName(biz.name || '');
            setLocation(biz.location || '');
            setTier(biz.tier || 'normal');
            setWebsite(biz.website || '');
            setDiscordServer(biz.discord_server || '');
            setAudienceType(biz.audience_type || 'PUBLIC');
            setIsActive(biz.is_active === undefined ? true : biz.is_active);
            setIsApproved(biz.is_approved === undefined ? false : biz.is_approved);
            setIsFeatured(biz.is_featured === undefined ? false : biz.is_featured);
            setDefaultPublicOnWall(biz.default_public_on_wall === undefined ? false : biz.default_public_on_wall);
            
            // Initialize permissions from fetched data
            const initialPermissions = Object.keys(availablePermissions).reduce((acc, key) => ({ ...acc, [key]: false }), {});
            if (biz.permissions && typeof biz.permissions === 'object') {
                for (const key in biz.permissions) {
                    if (key in initialPermissions) {
                        initialPermissions[key] = biz.permissions[key];
                    }
                }
            }
            setPermissions(initialPermissions);

            // Fetch Discord roles if server ID exists
            if (biz.discord_server) {
                fetchDiscordRoles();
            }

        } catch (error) {
            console.error("Error fetching business details:", error);
            toast.error(error.response?.data?.error || `Failed to fetch business ID: ${businessId}.`);
            navigate('/admin/business/manage');
        } finally {
            setIsFetching(false);
        }
    }, [businessId, navigate, fetchDiscordRoles]);

    // Handle Discord callback success messages
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const successParam = urlParams.get('success');
        const guildId = urlParams.get('guild_id');
        
        if (successParam === 'discord_bot_added' && guildId) {
            toast.success(`Discord bot successfully added to server (ID: ${guildId})! Roles have been synced.`);
            // Update the server ID in the form
            setDiscordServer(guildId);
            // Fetch the updated Discord roles
            fetchDiscordRoles();
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (successParam === 'discord_bot_invited') {
            toast.success('Discord bot invitation completed! Please verify the server configuration.');
            fetchBusinessDetails(); // Refresh business details to get any updated server ID
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Handle error messages
        const errorParam = urlParams.get('error');
        if (errorParam === 'discord_callback_failed') {
            toast.error('Discord integration failed. Please try again.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [fetchDiscordRoles, fetchBusinessDetails]);

    const handleSyncDiscordRoles = async () => {
        if (!discordServer.trim()) {
            toast.error('Please enter a Discord Server ID first.');
            return;
        }

        setIsSyncingRoles(true);
        try {
            const response = await apiClient.post(`/api/businesses/${businessId}/discord-roles/sync`);
            if (response.data.success) {
                toast.success(response.data.message);
                await fetchDiscordRoles(); // Refresh the roles list
            } else {
                toast.error(response.data.error);
            }
        } catch (error) {
            console.error("Error syncing Discord roles:", error);
            toast.error(error.response?.data?.error || 'Failed to sync Discord roles.');
        } finally {
            setIsSyncingRoles(false);
        }
    };

    useEffect(() => {
        fetchBusinessDetails();
    }, [fetchBusinessDetails]);

    const handlePermissionChange = (permissionKey) => {
        setPermissions(prev => ({ ...prev, [permissionKey]: !prev[permissionKey] }));
    };
    
    const handleSelectAllPermissions = (e) => {
        const checked = e.target.checked;
        setPermissions(
            Object.keys(availablePermissions).reduce((acc, key) => ({ ...acc, [key]: checked }), {})
        );
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!businessName.trim()) {
            toast.error('Business Name is required.');
            return;
        }
        
        setIsLoading(true);
        const businessData = {
            name: businessName.trim(), 
            location: location.trim(), 
            tier, 
            website: website.trim(),
            discord_server: discordServer.trim(), 
            audience_type: audienceType,
            permissions,
            is_active: isActive, 
            is_approved: isApproved,
            is_featured: isFeatured,
            default_public_on_wall: defaultPublicOnWall
        };

        try {
            const response = await apiClient.put(`/api/businesses/${businessId}`, businessData);
            toast.success(response.data.message || 'Business updated successfully!');
            
            // If Discord server was updated, try to sync roles
            if (discordServer.trim() && discordServer.trim() !== businessData.discord_server) {
                await fetchDiscordRoles();
            }
            
            navigate('/admin/business/manage');
        } catch (error) {
            console.error("Error updating business:", error);
            toast.error(error.response?.data?.error || 'Failed to update business.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33">
                    <div className="form-container-card">
                        <p>Loading business details...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 " >
                <div className="form-container-card">
                    <div className="form-header">
                        <h1 className="chat-title">Edit Business: {businessName || 'Loading...'}</h1>
                        <p className="chat-subtitle">Update the details and permissions for this business.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        {/* Business Name */}
                        <BFormField label="Business Name" required>
                            <BTextInput 
                                id="businessName" 
                                value={businessName} 
                                onChange={(e) => setBusinessName(e.target.value)} 
                                placeholder="Enter business name"
                                required 
                            />
                        </BFormField>
                        
                        {/* Location */}
                        <BFormField label="Location">
                            <BTextInput 
                                id="location" 
                                value={location} 
                                onChange={(e) => setLocation(e.target.value)} 
                                placeholder="e.g., City, Country"
                            />
                        </BFormField>
                        
                        {/* Tier - Only super admin can edit */}
                        <BFormField label="Subscription Tier" required hint={!isSuperAdmin ? 'Only Super Admins can change subscription tiers' : undefined}>
                            <BSelect 
                                id="tier" 
                                value={tier} 
                                onChange={(e) => setTier(e.target.value)}
                                disabled={!isSuperAdmin}
                            >
                                <option value="normal">Normal</option>
                                <option value="advanced">Advanced</option>
                                <option value="super">Super</option>
                            </BSelect>
                        </BFormField>
                        
                        {/* Website */}
                        <BFormField label="Website URL">
                            <BTextInput 
                                type="url" 
                                id="website" 
                                value={website} 
                                onChange={(e) => setWebsite(e.target.value)} 
                                placeholder="https://example.com"
                            />
                        </BFormField>
                        
                        {/* Discord Server */}
                        <div className="newform-group">
                            <label htmlFor="discordServer">Discord Server Integration</label>
                            <div className="discord-integration-section">
                                <div style={{marginBottom: '15px'}}>
                                    <h4 style={{margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600'}}>
                                        Option 1: Invite Discord Bot (Recommended)
                                    </h4>
                                    <p style={{margin: '0 0 10px 0', fontSize: '13px', color: '#666'}}>
                                        Click to invite our Discord bot to your server. This will automatically configure the server ID and sync roles.
                                    </p>
                                    <button 
                                        type="button" 
                                        onClick={handleInviteDiscordBot}
                                        disabled={isInvitingBot}
                                        className="newform-button discord-bot"
                                        style={{marginBottom: 0}}
                                    >
                                        <i className="ri-robot-line"></i>
                                        {isInvitingBot ? 'Inviting Bot...' : 'Invite Discord Bot to Server'}
                                    </button>
                                </div>
                                
                                <div className="form-divider">
                                    <span>OR</span>
                                </div>
                                
                                <div>
                                    <h4 style={{margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600'}}>
                                        Option 2: Manual Server ID Entry
                                    </h4>
                                    <p style={{margin: '0 0 10px 0', fontSize: '13px', color: '#666'}}>
                                        Enter your Discord Server ID manually if automatic setup doesn't work.
                                    </p>
                                    <div style={{display: 'flex', gap: '10px', alignItems: 'flex-end'}}>
                                        <BTextInput 
                                            id="discordServer" 
                                            value={discordServer} 
                                            onChange={(e) => setDiscordServer(e.target.value)} 
                                            placeholder="Enter the numeric Discord Server ID"
                                            style={{flex: 1}}
                                        />
                                        <BButton 
                                            type="button" 
                                            onClick={handleSyncDiscordRoles}
                                            variant="secondary"
                                            disabled={isSyncingRoles || !discordServer.trim()}
                                            style={{marginBottom: 0}}
                                        >
                                            {isSyncingRoles ? 'Syncing...' : 'Sync Roles'}
                                        </BButton>
                                    </div>
                                </div>
                            </div>
                            {discordRoles.length > 0 && (
                                <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                                    <strong>Discord Roles ({discordRoles.length}):</strong>
                                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px'}}>
                                        {discordRoles.slice(0, 10).map(role => (
                                            <span key={role.id} style={{
                                                backgroundColor: '#e0e0e0', 
                                                padding: '2px 6px', 
                                                borderRadius: '3px', 
                                                fontSize: '12px'
                                            }}>
                                                {role.name}
                                            </span>
                                        ))}
                                        {discordRoles.length > 10 && (
                                            <span style={{fontSize: '12px', color: '#666'}}>
                                                ...and {discordRoles.length - 10} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Audience Type */}
                        <div className="newform-group">
                            <label htmlFor="audienceType">Audience Type</label>
                            <select 
                                id="audienceType" 
                                value={audienceType} 
                                onChange={(e) => setAudienceType(e.target.value)}
                            >
                                <option value="PUBLIC">Public - Anyone can access</option>
                                <option value="RESTRICTED">Restricted - Limited access</option>
                            </select>
                            <small style={{color: '#666', fontSize: '12px'}}>
                                Public businesses are visible to all users. Restricted businesses require specific access rules.
                            </small>
                        </div>

                        {/* Admin-only fields */}
                        {isSuperAdmin && (
                            <>
                                <div className="newform-group">
                                    <label>Business Status</label>
                                    <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                                        <div className="permission-item">
                                            <BCheckbox id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" />
                                        </div>
                                        <div className="permission-item">
                                            <BCheckbox id="isApproved" checked={isApproved} onChange={(e) => setIsApproved(e.target.checked)} label="Approved" />
                                        </div>
                                        <div className="permission-item">
                                            <BCheckbox id="isFeatured" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} label="Featured" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Permissions Grid */}
                        <div className="newform-group">
                            <label>Business Permissions</label>
                            <div className="permissions-grid">
                                <div className="permission-item-header">
                                     <BCheckbox 
                                        id="select_all_permissions_business_edit" 
                                        onChange={handleSelectAllPermissions} 
                                        checked={Object.values(permissions).every(Boolean)}
                                        label={<span style={{fontWeight: 'bold'}}>Select All</span>}
                                    />
                                </div>
                                {Object.entries(availablePermissions).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`permission-pill ${permissions[key] ? 'permission-pill--selected' : ''}`}
                                        onClick={() => handlePermissionChange(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        

                        <div className="form-actions">
                            <BButton 
                                type="button" 
                                variant="secondary" 
                                onClick={() => navigate('/admin/business/manage')} 
                                disabled={isLoading}
                            >
                                Cancel
                            </BButton>
                            <BButton 
                                type="submit" 
                                variant="primary" 
                                disabled={isLoading}
                            >
                                {isLoading ? 'Updating...' : 'Update Business'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditBusiness;