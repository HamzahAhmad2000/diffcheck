import React, { useState, useEffect } from 'react';
import { shareAPI } from '../../services/apiClient';
import {
  BButton,
  BFormField,
  BTextInput,
  BNumberInput,
  BTextarea,
  BToggle,
  BLoading
} from './ui';
import toast from 'react-hot-toast';
import './ShareToEarnConfig.css';

/**
 * ShareToEarnConfig - Super Admin configuration panel for Share-to-Earn XP feature
 */
const ShareToEarnConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [config, setConfig] = useState({
    enabled: true,
    join_share_xp: 500,
    badge_share_xp: 50,
    reward_redemption_xp: 50,
    raffle_win_xp: 50,
    raffle_entry_xp: 10,
    join_share_duration_hours: 72,
    join_share_text: '',
    badge_share_text: '',
    reward_redemption_text: '',
    raffle_win_text: ''
  });

  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchConfig();
    fetchAnalytics();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await shareAPI.admin.getConfig();
      
      if (response.data) {
        setConfig({
          enabled: response.data.enabled !== false,
          join_share_xp: response.data.join_share_xp || 500,
          badge_share_xp: response.data.badge_share_xp || 50,
          reward_redemption_xp: response.data.reward_redemption_xp || 50,
          raffle_win_xp: response.data.raffle_win_xp || 50,
          raffle_entry_xp: response.data.raffle_entry_xp || 10,
          join_share_duration_hours: response.data.join_share_duration_hours || 72,
          join_share_text: response.data.join_share_text || '',
          badge_share_text: response.data.badge_share_text || '',
          reward_redemption_text: response.data.reward_redemption_text || '',
          raffle_win_text: response.data.raffle_win_text || ''
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await shareAPI.admin.getAnalytics();
      if (response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      await shareAPI.admin.updateConfig(config);
      
      toast.success('Share-to-Earn settings have been updated!', {
        duration: 4000,
        icon: '✅'
      });
      
      setHasChanges(false);
      
      // Refresh analytics
      await fetchAnalytics();
      
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <BLoading variant="page" label="Loading configuration..." />;
  }

  return (
    <div className="share-config">
      <div className="share-config__header">
        <div className="share-config__title-section">
          <h1 className="share-config__title">
            <i className="ri-share-line"></i>
            Share-to-Earn Configuration
          </h1>
          <p className="share-config__subtitle">
            Manage social sharing rewards, XP values, and post templates
          </p>
        </div>

        {/* Analytics Summary */}
        {analytics && (
          <div className="share-config__analytics">
            <div className="share-config__stat">
              <i className="ri-share-forward-line"></i>
              <div className="share-config__stat-content">
                <span className="share-config__stat-value">{analytics.total_shares || 0}</span>
                <span className="share-config__stat-label">Total Shares</span>
              </div>
            </div>
            <div className="share-config__stat">
              <i className="ri-copper-coin-line"></i>
              <div className="share-config__stat-content">
                <span className="share-config__stat-value">{analytics.total_xp_awarded || 0}</span>
                <span className="share-config__stat-label">XP Awarded</span>
              </div>
            </div>
            <div className="share-config__stat">
              <i className="ri-user-add-line"></i>
              <div className="share-config__stat-content">
                <span className="share-config__stat-value">{analytics.unique_users || 0}</span>
                <span className="share-config__stat-label">Active Sharers</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="share-config__content">
        {/* Section 1: Master Control */}
        <div className="share-config__section">
          <div className="share-config__section-header">
            <h2 className="share-config__section-title">
              <i className="ri-settings-3-line"></i>
              Master Control
            </h2>
            <p className="share-config__section-description">
              Enable or disable the entire Share-to-Earn feature across the platform
            </p>
          </div>

          <div className="share-config__section-content">
            <BToggle
              checked={config.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              label="Enable Share-to-Earn Feature"
            />
            {!config.enabled && (
              <p className="share-config__warning">
                <i className="ri-alert-line"></i>
                Feature is currently disabled. All share prompts and XP rewards are inactive.
              </p>
            )}
          </div>
        </div>

        {/* Section 2: XP Reward Configuration */}
        <div className="share-config__section">
          <div className="share-config__section-header">
            <h2 className="share-config__section-title">
              <i className="ri-copper-coin-line"></i>
              XP Reward Configuration
            </h2>
            <p className="share-config__section-description">
              Set the XP value for each type of social share
            </p>
          </div>

          <div className="share-config__section-content">
            <div className="share-config__grid">
              <BFormField
                label="First-Time Join Share XP"
                hint="XP awarded when new users share their welcome message"
              >
                <BNumberInput
                  value={config.join_share_xp}
                  onChange={(e) => handleChange('join_share_xp', parseInt(e.target.value) || 0)}
                  min="0"
                  step="10"
                  disabled={!config.enabled}
                />
              </BFormField>

              <BFormField
                label="Badge Earned Share XP"
                hint="XP awarded for sharing earned badges"
              >
                <BNumberInput
                  value={config.badge_share_xp}
                  onChange={(e) => handleChange('badge_share_xp', parseInt(e.target.value) || 0)}
                  min="0"
                  step="5"
                  disabled={!config.enabled}
                />
              </BFormField>

              <BFormField
                label="Reward Redemption Share XP"
                hint="XP awarded for sharing redeemed rewards"
              >
                <BNumberInput
                  value={config.reward_redemption_xp}
                  onChange={(e) => handleChange('reward_redemption_xp', parseInt(e.target.value) || 0)}
                  min="0"
                  step="5"
                  disabled={!config.enabled}
                />
              </BFormField>

              <BFormField
                label="Raffle Win Share XP"
                hint="XP awarded for sharing raffle wins"
              >
                <BNumberInput
                  value={config.raffle_win_xp}
                  onChange={(e) => handleChange('raffle_win_xp', parseInt(e.target.value) || 0)}
                  min="0"
                  step="5"
                  disabled={!config.enabled}
                />
              </BFormField>

              <BFormField
                label="Raffle Entry Share XP"
                hint="XP awarded for sharing raffle entries"
              >
                <BNumberInput
                  value={config.raffle_entry_xp}
                  onChange={(e) => handleChange('raffle_entry_xp', parseInt(e.target.value) || 0)}
                  min="0"
                  step="5"
                  disabled={!config.enabled}
                />
              </BFormField>
            </div>
          </div>
        </div>

        {/* Section 3: Rule & Logic Configuration */}
        <div className="share-config__section">
          <div className="share-config__section-header">
            <h2 className="share-config__section-title">
              <i className="ri-time-line"></i>
              Rule & Logic Configuration
            </h2>
            <p className="share-config__section-description">
              Control time-based rules for the feature
            </p>
          </div>

          <div className="share-config__section-content">
            <BFormField
              label="Join Share Prompt Visibility Duration"
              hint="Number of hours new users will see the join-share prompt after signing up"
            >
              <BNumberInput
                value={config.join_share_duration_hours}
                onChange={(e) => handleChange('join_share_duration_hours', parseInt(e.target.value) || 0)}
                min="1"
                max="168"
                step="1"
                disabled={!config.enabled}
              />
            </BFormField>
          </div>
        </div>

        {/* Section 4: Post Content Management */}
        <div className="share-config__section">
          <div className="share-config__section-header">
            <h2 className="share-config__section-title">
              <i className="ri-message-3-line"></i>
              Post Content Management
            </h2>
            <p className="share-config__section-description">
              Customize the text that appears in social media posts
            </p>
          </div>

          <div className="share-config__section-content">
            <BFormField
              label="First-Time Join Post Text"
              hint="Text used when new users share their welcome message"
            >
              <BTextarea
                value={config.join_share_text}
                onChange={(e) => handleChange('join_share_text', e.target.value)}
                rows={3}
                placeholder="Just joined @EclipseerLabs — a platform where you earn XP and rewards by giving feedback to brands and games you love! Join me and get rewarded for your voice. #Eclipseer"
                disabled={!config.enabled}
              />
            </BFormField>

            <BFormField
              label="Badge Earned Post Text"
              hint="Text used when users share earned badges"
            >
              <BTextarea
                value={config.badge_share_text}
                onChange={(e) => handleChange('badge_share_text', e.target.value)}
                rows={3}
                placeholder="Earned a new badge on @Eclipseer for contributing to great research! Join the movement and turn feedback into rewards. #Eclipseer"
                disabled={!config.enabled}
              />
            </BFormField>

            <BFormField
              label="Reward Redemption Post Text"
              hint="Use [Prize Name] placeholder - it will be replaced with the actual prize name"
            >
              <BTextarea
                value={config.reward_redemption_text}
                onChange={(e) => handleChange('reward_redemption_text', e.target.value)}
                rows={3}
                placeholder="Just redeemed [Prize Name] on @EclipseerLabs using my XP! Giving feedback has never been this rewarding. Check it out and start earning too. #Eclipseer"
                disabled={!config.enabled}
              />
              <p className="share-config__field-warning">
                <i className="ri-alert-line"></i>
                Warning: Do not remove the [Prize Name] placeholder
              </p>
            </BFormField>

            <BFormField
              label="Raffle Win Post Text"
              hint="Use [Prize Name] placeholder - it will be replaced with the actual prize name"
            >
              <BTextarea
                value={config.raffle_win_text}
                onChange={(e) => handleChange('raffle_win_text', e.target.value)}
                rows={3}
                placeholder="I just won [Prize Name] in a raffle on @EclipseerLabs 🎉 All I did was give feedback and earn XP – now I'm winning real rewards! Join in 👉 #Eclipseer"
                disabled={!config.enabled}
              />
              <p className="share-config__field-warning">
                <i className="ri-alert-line"></i>
                Warning: Do not remove the [Prize Name] placeholder
              </p>
            </BFormField>
          </div>
        </div>

        {/* Save Button */}
        <div className="share-config__actions">
          <BButton
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <i className="ri-loader-4-line rotating"></i>
                Saving Changes...
              </>
            ) : (
              <>
                <i className="ri-save-line"></i>
                Save Changes
              </>
            )}
          </BButton>

          {hasChanges && (
            <p className="share-config__unsaved-warning">
              <i className="ri-alert-line"></i>
              You have unsaved changes
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareToEarnConfig;

