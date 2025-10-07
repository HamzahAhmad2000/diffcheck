import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { businessAPI, authAPI, userProfileAPI } from '../../services/apiClient';
import apiClient from '../../services/apiClient';
import AudienceSelection from '../common/AudienceSelection';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../SuperAdminDashboard.css';
import './BusinessSpecificDashboard.css';
import './BusinessFeedbackManagement.css';
import BLoading from './ui/BLoading';

const ManageBusinessAudience = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { business, loading, error, refreshBusiness } = useBusiness();
  
  // Local copy of user that we can update
  const [localUser, setLocalUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  
  // Business audience modal states
  const [businessAudienceSettings, setBusinessAudienceSettings] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);
  
  // Discord Integration State
  const [discordServerId, setDiscordServerId] = useState('');
  const [isSavingDiscord, setIsSavingDiscord] = useState(false);
  const [isInvitingBot, setIsInvitingBot] = useState(false);
  const [isSyncingRoles, setIsSyncingRoles] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const successParam = queryParams.get('success');
    const guildId = queryParams.get('guild_id');
    
    if (successParam === 'discord_linked') {
      toast.success("Discord account linked successfully!");
      console.log('[ManageBusinessAudience] Discord linking success detected, refreshing user data...');
      // Refetch user profile to get updated discord_id
      apiClient.get('/auth/profile').then(response => {
        const updatedUser = response.data;
        console.log('[ManageBusinessAudience] Updated user data received:', updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setLocalUser(updatedUser); // Update local state to trigger re-render
        refreshBusiness(); // Refresh business context as well
        // Clean the URL
        navigate(`/admin/business/${businessId}/audience`, { replace: true });
      }).catch(err => {
        console.error('[ManageBusinessAudience] Failed to refresh user data:', err);
        toast.error("Failed to refresh user data after linking.");
      });
    } else if (successParam === 'discord_bot_added' && guildId) {
      toast.success(`Discord bot successfully added to server (ID: ${guildId})! Roles have been synced.`);
      console.log('[ManageBusinessAudience] Discord bot addition success detected, refreshing business data...');
      refreshBusiness();
      navigate(`/admin/business/${businessId}/audience`, { replace: true });
    } else if (successParam === 'discord_bot_invited') {
      toast.success('Discord bot invitation completed! The server may have been configured automatically.');
      console.log('[ManageBusinessAudience] Discord bot invitation completed, refreshing business data...');
      refreshBusiness();
      navigate(`/admin/business/${businessId}/audience`, { replace: true });
    }
    
    // Handle error messages
    const errorParam = queryParams.get('error');
    if (errorParam) {
      toast.error(decodeURIComponent(errorParam));
      navigate(`/admin/business/${businessId}/audience`, { replace: true });
    }
  }, [businessId, navigate, refreshBusiness]);

  useEffect(() => {
    if (business) {
      loadBusinessAudienceSettings();
    }
  }, [business]);

  const loadBusinessAudienceSettings = async () => {
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
  };

  const handleSaveBusinessAudience = async (settings) => {
    setAudienceLoading(true);
    setAudienceError(null);
    
    try {
      await apiClient.put(`/api/businesses/${businessId}/audience`, settings);
      toast.success('Business audience settings updated successfully!');
      setBusinessAudienceSettings(settings);
      refreshBusiness();
    } catch (error) {
      console.error('Error updating business audience settings:', error);
      setAudienceError(error.response?.data?.error || 'Failed to update audience settings');
      throw error;
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

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="main-content business-specific-dashboard">
          <BLoading variant="page" label="Loading business data..." />
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
          <h1 className="dashboard-title" style={{ color: 'black' }}>Audience Management</h1>
          <p className="dashboard-subtitle" style={{ color: 'black' }}>
            Managing: {business.name} | Configure who can access your business and surveys
          </p>
        </div>

        <div className="dashboard-grid">
          {/* Audience Selection Card */}
          <div className="dashboard-card">
            <h2 className="card-title">
              <i className="ri-group-line"></i>
              Audience Selection
              <i
                className="ri-information-line info-icon"
                data-tooltip="Choose who sees your brand page—open to all or limited to specific groups like Discord roles or email domains."
                style={{ marginLeft: '4px' }}
              ></i>
            </h2>
            <div className="card-content">
              <p style={{ marginBottom: '20px', color: '#666' , fontSize:'16px'}}>
                Configure who can access your business page and surveys. These settings control the visibility 
                and accessibility of your business content on the platform.
              </p>
              
              {business && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
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
                businessId={businessId}
                initialSettings={businessAudienceSettings || {}}
                onSave={handleSaveBusinessAudience}
                loading={audienceLoading}
                error={audienceError}
              />
            </div>
          </div>

          {/* Discord Integration Card */}
          <div className="dashboard-card">
            <h2 className="card-title">
              <i className="ri-discord-fill"></i>
              Discord Integration
              <i
                className="ri-information-line info-icon"
                data-tooltip="Connect your Discord account and server to enable role-based access control and audience management."
                style={{ marginLeft: '4px' }}
              ></i>
            </h2>
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

          {/* Quick Actions Card */}
          <div className="dashboard-card">
            <h2 className="card-title">
              <i className="ri-settings-3-line"></i>
              Quick Actions
            </h2>
            <div className="card-actions">
              <button
                className="dashboard-button"
                onClick={() => navigate(`/admin/business/${businessId}/splash-page/edit`)}
              >
                <i className="ri-palette-line"></i>
                <span>Brand Logo & Splash Page</span>
              </button>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageBusinessAudience;