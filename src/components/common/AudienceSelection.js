import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react'; // Assuming this is installed
import { businessAPI, userProfileAPI, surveyAPI, baseURL } from '../../services/apiClient';
import TagSelector from '../common/TagSelector';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const AudienceSelection = ({
  type = 'survey', // 'business' or 'survey'
  initialSettings = {},
  businessId = null, // Required for survey type to fetch Discord roles
  itemId = null, // To generate survey links
  onSave,
  disabled = false,
  loading = false,
  error = null,
}) => {
  // Note: Admin users (super_admin and business_admin) bypass all audience restrictions
  
  // Get frontend base URL for shareable links (use current origin for consistency)
  const frontendBaseURL = window.location.origin;
  const [audienceType, setAudienceType] = useState('BUSINESS_AUDIENCE');
  const [rules, setRules] = useState([]);
  const [tokens, setTokens] = useState('');
  const [requiredTags, setRequiredTags] = useState([]);
  const [tagMatchingLogic, setTagMatchingLogic] = useState('ANY');
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSentData, setLastSentData] = useState(null); // <-- Add this line

  // Discord-specific state
  const [discordRoles, setDiscordRoles] = useState(initialSettings.discord_roles_allowed || []);
  const [availableDiscordRoles, setAvailableDiscordRoles] = useState([]);
  const [loadingDiscordRoles, setLoadingDiscordRoles] = useState(false);
  const [businessHasDiscord, setBusinessHasDiscord] = useState(false);
  const [discordError, setDiscordError] = useState('');
  const [discordServerMembersOnly, setDiscordServerMembersOnly] = useState(initialSettings.discord_server_members_only || false);

  // Input states
  const [newDomain, setNewDomain] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // NEW: Direct access link state
  const [directAccessUrl, setDirectAccessUrl] = useState('');
  const [directAccessToken, setDirectAccessToken] = useState('');
  const [generatingDirectLink, setGeneratingDirectLink] = useState(false);

  // New: State for which restriction types are enabled
  const [enabledRestrictions, setEnabledRestrictions] = useState({
    discord: false,
    tag: false,
    emailDomain: false,
    specificEmail: false,
    tokenGated: false
  });

  // Add state for upload feedback
  const [uploadFeedback, setUploadFeedback] = useState('');

  // Helper function to download QR code as PNG
  const downloadQRCode = (elementId, filename) => {
    console.log('[QR Download] Looking for element:', elementId);
    const qrElement = document.getElementById(elementId);
    console.log('[QR Download] QR Element found:', qrElement);
    
    if (!qrElement) {
      toast.error('QR code container not found');
      return;
    }
    
    const svgElement = qrElement.querySelector('svg');
    console.log('[QR Download] SVG Element found:', svgElement);
    
    if (!svgElement) {
      // Try to find it in the parent or sibling elements
      const svgInParent = qrElement.parentElement?.querySelector('svg');
      const svgAnywhere = document.querySelector(`#${elementId} svg, #${elementId} canvas`);
      console.log('[QR Download] SVG in parent:', svgInParent);
      console.log('[QR Download] SVG anywhere:', svgAnywhere);
      
      if (svgInParent) {
        console.log('[QR Download] Using SVG from parent');
        return downloadQRCodeFromSVG(svgInParent, filename);
      } else if (svgAnywhere) {
        console.log('[QR Download] Using SVG found anywhere');
        return downloadQRCodeFromSVG(svgAnywhere, filename);
      }
      
      // Last resort: try to find any QR code element and capture its content
      console.log('[QR Download] Trying fallback method');
      const allSvgs = document.querySelectorAll('svg');
      console.log('[QR Download] All SVGs on page:', allSvgs);
      
      // Look for SVG that might be a QR code (contains paths with QR-like data)
      for (let svg of allSvgs) {
        const paths = svg.querySelectorAll('path, rect');
        if (paths.length > 10) { // QR codes typically have many elements
          console.log('[QR Download] Found potential QR code SVG, attempting download');
          return downloadQRCodeFromSVG(svg, filename);
        }
      }
      
      toast.error('QR code SVG not found. Please try generating the token again.');
      return;
    }
    
    downloadQRCodeFromSVG(svgElement, filename);
  };

  const downloadQRCodeFromSVG = (svgElement, filename) => {
    try {
      // Convert SVG to PNG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      canvas.width = 160;
      canvas.height = 160;
      
      img.onload = () => {
        try {
          // Set white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          // Create download link
          const link = document.createElement('a');
          link.download = filename;
          link.href = canvas.toDataURL('image/png');
          link.click();
          
          // Cleanup
          URL.revokeObjectURL(img.src);
          toast.success('QR Code downloaded!');
        } catch (error) {
          console.error('Canvas drawing error:', error);
          toast.error('Failed to generate QR code image');
        }
      };
      
      img.onerror = () => {
        toast.error('Failed to load QR code for conversion');
      };
      
      // Create blob and set image source
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
    } catch (error) {
      console.error('QR code download error:', error);
      toast.error('Failed to download QR code');
    }
  };

  useEffect(() => {
    const source = initialSettings || {};
    setAudienceType(source.access_type || (type === 'business' ? 'PUBLIC' : 'BUSINESS_AUDIENCE'));
    setRules(source.rules || []);
    setTokens(source.access_tokens?.join(', ') || source.direct_access_tokens?.join(', ') || '');
    setRequiredTags(source.required_tags || []);
    setTagMatchingLogic(source.tag_matching_logic || 'ANY');
    setDiscordRoles(source.discord_roles_allowed || []);

    // Set enabled restrictions based on initialSettings
    setEnabledRestrictions({
      discord: (initialSettings.discord_roles_allowed && initialSettings.discord_roles_allowed.length > 0) || false,
      tag: (initialSettings.required_tags && initialSettings.required_tags.length > 0) || false,
      emailDomain: (initialSettings.email_domain_whitelist && initialSettings.email_domain_whitelist.length > 0) || false,
      specificEmail: (initialSettings.specific_email_whitelist && initialSettings.specific_email_whitelist.length > 0) || false,
      tokenGated: (initialSettings.access_tokens && initialSettings.access_tokens.length > 0) || (initialSettings.direct_access_tokens && initialSettings.direct_access_tokens.length > 0) || false
    });

  }, [initialSettings, type]);

  // Handler for mutually exclusive access type
  const [exclusiveAccessType, setExclusiveAccessType] = useState(type === 'business' ? 'PUBLIC' : 'OPEN');
  useEffect(() => {
    setExclusiveAccessType(initialSettings.access_type || (type === 'business' ? 'PUBLIC' : 'OPEN'));
  }, [initialSettings, type]);

  // Fetch cached Discord roles when component mounts
  const fetchCachedDiscordRoles = useCallback(async () => {
    if (!businessId) return;
    
    setLoadingDiscordRoles(true);
    setDiscordError('');
    
    try {
      // Call our backend endpoint for Discord roles formatted for audience selection
      const response = await businessAPI.getDiscordRolesForAudience(businessId);
      const roles = response.data?.roles || [];
      
      const formattedRoles = roles.sort((a, b) => b.position - a.position);
      
      setAvailableDiscordRoles(formattedRoles);
      setBusinessHasDiscord(roles.length > 0); // Only set to true if roles exist
      setDiscordError(''); // Clear any previous errors
      
      console.log('[AUDIENCE_SELECTION] Loaded cached Discord roles:', formattedRoles);

    } catch (error) {
      console.error('[AUDIENCE_SELECTION] Failed to load cached Discord roles:', error);
      
      // Try to get more detailed status information
      try {
        const statusResponse = await businessAPI.checkDiscordStatus(businessId);
        const status = statusResponse.data;
        
        if (status.recommendations && status.recommendations.length > 0) {
          setDiscordError(`${status.recommendations[0]}. Current status: ${!status.user_has_linked_discord ? 'No Discord account linked' : !status.discord_token_valid ? 'Discord token expired' : !status.has_discord_server ? 'No Discord server configured' : 'Unknown issue'}`);
        } else {
          setDiscordError(error.response?.data?.error || 'Failed to load Discord roles from server.');
        }
      } catch (statusError) {
        const errorMessage = error.response?.data?.error || 'Failed to load Discord roles from server.';
        setDiscordError(errorMessage);
      }
      
      setBusinessHasDiscord(false);
      setAvailableDiscordRoles([]);
    } finally {
      setLoadingDiscordRoles(false);
    }
  }, [businessId]);

  useEffect(() => {
    // Fetch when a business context exists (for both business and survey audience configs)
    if (businessId) {
      fetchCachedDiscordRoles();
    }
  }, [businessId, fetchCachedDiscordRoles]);

  // Fetch available tags for all categories (not just INTEREST)
  const fetchAvailableTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      // Fetch all tag categories
      const response = await userProfileAPI.adminGetProfileTags({ category: 'ALL' });
      setAvailableTags(response.data || []);
    } catch (err) {
      console.error("Failed to fetch tags", err);
      toast.error("Failed to fetch available profile tags.");
    } finally {
      setLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    if (audienceType === 'TAG_BASED' && availableTags.length === 0) {
      fetchAvailableTags();
    }
  }, [audienceType, availableTags.length, fetchAvailableTags]);

  // Determine user context for theme
  const userRole = localStorage.getItem('userRole');
  const tagSelectorTheme = userRole === 'business_admin' ? 'light' : 'dark';

  const handleAddRule = (attribute, value) => {
    if (value && !rules.some(r => r.attribute === attribute && r.value === value)) {
      setRules([...rules, { attribute, value }]);
    }
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) {
        toast.error('Please enter a domain');
        return;
    }
    // Basic domain validation
    if (!domain.includes('.')) {
        toast.error('Please enter a valid domain (e.g., company.com)');
        return;
    }
    handleAddRule('EMAIL_DOMAIN', domain);
    setNewDomain('');
};

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
        toast.error('Please enter an email');
        return;
    }
    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
        toast.error('Please enter a valid email address');
        return;
    }
    handleAddRule('SPECIFIC_EMAIL', email);
    setNewEmail('');
};

  const handleRemoveRule = (index) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
  };

  // Discord role handlers
  const handleDiscordRoleToggle = (roleId) => {
    const updatedRoles = discordRoles.includes(roleId)
      ? discordRoles.filter(id => id !== roleId)
      : [...discordRoles, roleId];
    setDiscordRoles(updatedRoles);
  };

  // Handler for enabling/disabling restriction types
  const handleRestrictionToggle = (key) => {
    setEnabledRestrictions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const generateDirectAccessLink = async () => {
    if (!itemId || !businessId) {
      toast.error('Survey ID and Business ID are required');
      return;
    }

    setGeneratingDirectLink(true);
    try {
      const response = await surveyAPI.generateDirectAccessLink(businessId, itemId);
      if (response.data.success) {
        setDirectAccessUrl(response.data.direct_access_url);
        toast.success('Direct access link generated successfully!');
      } else {
        toast.error(response.data.error || 'Failed to generate direct access link');
      }
    } catch (err) {
      console.error('Error generating direct access link:', err);
      toast.error(err.response?.data?.error || 'Failed to generate direct access link');
    } finally {
      setGeneratingDirectLink(false);
    }
  };

  const handleSave = async () => {
    if (disabled) return;

    setIsSaving(true);
    try {
      // Prepare the data object for the parent
      const audienceData = {
        access_type: exclusiveAccessType, // Only one of 'OPEN', 'PUBLIC', 'BUSINESS_AUDIENCE'
        specific_email_whitelist: enabledRestrictions.specificEmail ? rules.filter(r => r.attribute === 'SPECIFIC_EMAIL').map(r => r.value.toLowerCase()) : [],
        email_domain_whitelist: enabledRestrictions.emailDomain ? rules.filter(r => r.attribute === 'EMAIL_DOMAIN').map(r => r.value.toLowerCase()) : [],
        required_tags: enabledRestrictions.tag ? requiredTags.map(tag => typeof tag === 'object' ? tag.id : tag) : [],
        tag_matching_logic: tagMatchingLogic,
        discord_roles_allowed: enabledRestrictions.discord ? discordRoles : [], // Array of Discord role IDs
        access_tokens: enabledRestrictions.tokenGated ? tokens.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      if (type === 'business') {
        audienceData.discord_server_members_only = discordServerMembersOnly;
      }
      setLastSentData(audienceData);
      console.log('DEBUG: Data sent to backend:', audienceData); // <-- Save for debug log
      await onSave(audienceData);
      // No local toast or API call here; parent handles result and error display
    } catch (err) {
      // Only log error; parent handles error display
      console.error('AudienceSelection: Error during onSave callback:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for file upload (CSV/XLSX)
  const handleEmailFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    setUploadFeedback('');

    const addEmails = (emails) => {
      let added = 0;
      emails.forEach(email => {
        const clean = String(email).trim().toLowerCase();
        if (clean && clean.includes('@') && clean.includes('.') && !rules.some(r => r.attribute === 'SPECIFIC_EMAIL' && r.value === clean)) {
          setRules(prev => [...prev, { attribute: 'SPECIFIC_EMAIL', value: clean }]);
          added++;
        }
      });
      setUploadFeedback(`${added} emails added from file.`);
    };

    if (ext === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          // Flatten and filter for emails
          const emails = results.data.flat().filter(cell => typeof cell === 'string' && cell.includes('@'));
          addEmails(emails);
        },
        error: () => setUploadFeedback('Failed to parse CSV file.'),
      });
    } else if (ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const emails = [];
        workbook.SheetNames.forEach(sheetName => {
          const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
          sheet.flat().forEach(cell => {
            if (typeof cell === 'string' && cell.includes('@')) emails.push(cell);
          });
        });
        addEmails(emails);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setUploadFeedback('Unsupported file type. Please upload a CSV or XLSX file.');
    }
  };

  const sectionStyle = {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #eee',
    marginBottom: '20px'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    padding: '10px 15px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  };

  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '16px',
    backgroundColor: '#e9ecef',
    fontSize: '12px',
    marginRight: '5px',
    marginBottom: '5px'
  };

  return (
    <div style={{ maxHeight: 'calc(80vh - 100px)', overflowY: 'auto', paddingRight: '10px' }}>
      <fieldset disabled={disabled || loading || isSaving} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div style={{ marginBottom: '20px' }}>
          {/* Mutually exclusive access type radio buttons */}
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="radio"
              value={type === 'business' ? 'PUBLIC' : 'OPEN'}
              checked={exclusiveAccessType === (type === 'business' ? 'PUBLIC' : 'OPEN')}
              onChange={(e) => setExclusiveAccessType(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            {type === 'business' ? 'Public (Visible to Everyone)' : 'Open (Any user can access)'}
          </label>
          {type === 'survey' && (
            <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
              <input
                type="radio"
                value="BUSINESS_AUDIENCE"
                checked={exclusiveAccessType === 'BUSINESS_AUDIENCE'}
                onChange={(e) => setExclusiveAccessType(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Use Business Audience Settings
            </label>
          )}
          {/* Combinable restriction checkboxes */}
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={enabledRestrictions.discord}
              onChange={() => handleRestrictionToggle('discord')}
              style={{ marginRight: '8px' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ri-discord-line" style={{ color: '#5865F2' }}></i>
              Restrict by Discord Roles
            </span>
          </label>
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={enabledRestrictions.tag}
              onChange={() => handleRestrictionToggle('tag')}
              style={{ marginRight: '8px' }}
            />
            Restrict by Profile Tags
          </label>
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={enabledRestrictions.emailDomain}
              onChange={() => handleRestrictionToggle('emailDomain')}
              style={{ marginRight: '8px' }}
            />
            Restrict by Email Domain
          </label>
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={enabledRestrictions.specificEmail}
              onChange={() => handleRestrictionToggle('specificEmail')}
              style={{ marginRight: '8px' }}
            />
            Restrict by Specific Email
          </label>
          <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#333', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={enabledRestrictions.tokenGated}
              onChange={() => handleRestrictionToggle('tokenGated')}
              style={{ marginRight: '8px' }}
            />
            Token-Gated (shareable link)
          </label>
          {type === 'business' && (
            <label style={{ display: 'block', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={discordServerMembersOnly}
                onChange={(e) => setDiscordServerMembersOnly(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                <i className="ri-discord-fill" style={{ color: '#5865F2' }}></i>
                Require Discord server membership to view business page
              </span>
            </label>
          )}
        </div>
      </fieldset>

      {/* Show config UIs for each enabled restriction */}
      {enabledRestrictions.discord && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ri-discord-line" style={{ color: '#5865F2' }}></i>
            Discord Role Settings
          </h3>

          {discordError && (
            <div className="error-message-box" style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              color: '#856404', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '16px' 
            }}>
              <strong>Discord Connection Issue:</strong> {discordError}
              {discordError.includes('expired') || discordError.includes('link') ? (
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  <strong>Solution:</strong> Go to your profile settings and re-link your Discord account, then try again.
                </div>
              ) : null}
            </div>
          )}

          <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', background: '#fcfcfc' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
              Required Discord Roles:
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Users must have at least one of the selected roles to access this survey.
            </p>

            {loadingDiscordRoles ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '14px', color: '#666' }}>Loading Discord roles...</div>
              </div>
            ) : availableDiscordRoles.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                {availableDiscordRoles.map(role => (
                  <label key={role.id} className={`role-checkbox-label ${discordRoles.includes(role.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={discordRoles.includes(role.id)}
                      onChange={() => handleDiscordRoleToggle(role.id)}
                      style={{ margin: 0 }}
                    />
                    <div className="role-color-dot" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}></div>
                    <span className="role-name">{role.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '14px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <i className="ri-robot-line" style={{ fontSize: '24px', color: '#5865F2', marginBottom: '8px', display: 'block' }}></i>
                  Discord Bot Integration Required
                </div>
                <div style={{ marginBottom: '15px' }}>
                  To use Discord role-based access control, the Discord bot must be invited to your server and roles must be synced.
                </div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '15px' }}>
                  <strong>Steps:</strong>
                  <ol style={{ textAlign: 'left', paddingLeft: '20px', marginTop: '8px' }}>
                    <li>Invite the Discord bot to your server with "Manage Roles" permission</li>
                    <li>Ensure the bot has access to view roles in your Discord server</li>
                    <li>Click "Sync Discord Roles" below to fetch the latest role list</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setLoadingDiscordRoles(true);
                    try {
                      await businessAPI.syncDiscordRoles(businessId);
                      toast.success('Discord roles synced successfully!');
                      await fetchCachedDiscordRoles(); // Refresh roles
                    } catch (error) {
                      const errorMsg = error.response?.data?.error || 'Failed to sync Discord roles';
                      toast.error(errorMsg);
                      setDiscordError(errorMsg);
                    } finally {
                      setLoadingDiscordRoles(false);
                    }
                  }}
                  disabled={loadingDiscordRoles}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#5865F2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loadingDiscordRoles ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '0 auto'
                  }}
                >
                  <i className="ri-refresh-line"></i>
                  {loadingDiscordRoles ? 'Syncing Roles...' : 'Sync Discord Roles'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {enabledRestrictions.tag && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px' }}>
            Profile Tag Targeting
          </h3>
          <div style={sectionStyle}>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Target users based on the tags they've selected in their profile.
            </p>
            <TagSelector
              availableTags={availableTags}
              selectedTags={requiredTags}
              onChange={setRequiredTags}
              loading={loadingTags}
              theme={tagSelectorTheme} // Pass theme prop
            />
            {requiredTags.length > 1 && (
              <div style={{ marginTop: '16px' }}>
                <label style={{ marginRight: '10px' }}>
                  <input
                    type="radio"
                    name="tag-logic"
                    value="ANY"
                    checked={tagMatchingLogic === 'ANY'}
                    onChange={(e) => setTagMatchingLogic(e.target.value)}
                  /> Match ANY required tag
                </label>
                <label>
                  <input
                    type="radio"
                    name="tag-logic"
                    value="ALL"
                    checked={tagMatchingLogic === 'ALL'}
                    onChange={(e) => setTagMatchingLogic(e.target.value)}
                  /> Match ALL required tags
                </label>
              </div>
            )}
          </div>
        </div>
      )}
      {enabledRestrictions.emailDomain && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px' }}>
            Email & Domain Whitelist
          </h3>
          <div style={sectionStyle}>
            <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
              Allowed Email Domains
            </h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g., company.com"
                style={inputStyle}
              />
              <button onClick={handleAddDomain} style={buttonStyle}>Add</button>
            </div>
          </div>
          <div style={sectionStyle}>
            <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
              Specific Allowed Emails
            </h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g., user@example.com"
                style={inputStyle}
              />
              <button onClick={handleAddEmail} style={buttonStyle}>Add</button>
            </div>
            {rules.length > 0 && (
              <div>
                <h5 style={{ margin: '16px 0 8px 0', fontSize: '14px', color: '#555' }}>Current Rules:</h5>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {rules.map((rule, index) => (
                    <span key={index} style={chipStyle}>
                      {rule.value}
                      <button onClick={() => handleRemoveRule(index)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginLeft: '4px' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {enabledRestrictions.specificEmail && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px' }}>
            Specific Email Whitelist
          </h3>
          <div style={sectionStyle}>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Users must have one of these specific email addresses to access this survey.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g., user@example.com"
                style={inputStyle}
              />
              <button onClick={handleAddEmail} style={buttonStyle}>Add</button>
              <label style={{ marginLeft: '12px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleEmailFileUpload} />
                <span style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '7px 12px', background: '#f7f7f7' }}>Upload Email List</span>
              </label>
            </div>
            {uploadFeedback && <div style={{ color: '#28a745', fontSize: '13px', marginBottom: '8px' }}>{uploadFeedback}</div>}
            {rules.length > 0 && (
              <div>
                <h5 style={{ margin: '16px 0 8px 0', fontSize: '14px', color: '#555' }}>Current Rules:</h5>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {rules.map((rule, index) => (
                    <span key={index} style={chipStyle}>
                      {rule.value}
                      <button onClick={() => handleRemoveRule(index)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginLeft: '4px' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {enabledRestrictions.tokenGated && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px' }}>
            Token-Gated Access
          </h3>
          <div style={sectionStyle}>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Generate a unique link and QR code. Anyone with this link can access the survey after logging in.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={tokens}
                placeholder="Click 'Generate' to create a token"
                style={inputStyle}
                readOnly
              />
              <button 
                onClick={() => setTokens(crypto.randomUUID())} 
                style={buttonStyle}
                type="button"
              >
                Generate
              </button>
            </div>

            {tokens && type === 'survey' && itemId && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Shareable Survey Link</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={`${frontendBaseURL}/survey/${itemId}?token=${tokens}`}
                    readOnly
                    style={{...inputStyle, backgroundColor: '#f0f0f0', flex: 1}}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${frontendBaseURL}/survey/${itemId}?token=${tokens}`)
                        .then(() => toast.success('Link copied to clipboard!'))
                        .catch(() => toast.error('Failed to copy link'));
                    }}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#28a745',
                      minWidth: 'auto',
                      padding: '8px 12px'
                    }}
                  >
                    <i className="ri-clipboard-line"></i>
                  </button>
                </div>
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
                        Or Share via QR Code
                    </h4>
                    <div id="survey-qr-code" style={{ padding: '10px', display: 'inline-block', background: 'white', border: '1px solid #eee' }}>
                        <QRCode 
                            value={`${frontendBaseURL}/survey/${itemId}?token=${tokens}`}
                            size={160}
                        />
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            onClick={() => downloadQRCode('survey-qr-code', `survey-${itemId}-qr-code.png`)}
                            style={{
                                ...buttonStyle,
                                backgroundColor: '#17a2b8',
                                fontSize: '13px',
                                padding: '6px 12px'
                            }}
                        >
                            <i className="ri-download-line" style={{ marginRight: '4px' }}></i>
                            Download QR Code
                        </button>
                    </div>
                </div>
              </div>
            )}

            {tokens && type === 'business' && businessId && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Shareable Business Link</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={`${frontendBaseURL}/business/${businessId}?token=${tokens}`}
                    readOnly
                    style={{...inputStyle, backgroundColor: '#f0f0f0', flex: 1}}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${frontendBaseURL}/business/${businessId}?token=${tokens}`)
                        .then(() => toast.success('Link copied to clipboard!'))
                        .catch(() => toast.error('Failed to copy link'));
                    }}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#28a745',
                      minWidth: 'auto',
                      padding: '8px 12px'
                    }}
                  >
                    <i className="ri-clipboard-line"></i>
                  </button>
                </div>
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
                        Or Share via QR Code
                    </h4>
                    <div id="business-qr-code" style={{ padding: '10px', display: 'inline-block', background: 'white', border: '1px solid #eee' }}>
                        <QRCode 
                            value={`${frontendBaseURL}/business/${businessId}?token=${tokens}`}
                            size={160}
                        />
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            onClick={() => downloadQRCode('business-qr-code', `business-${businessId}-qr-code.png`)}
                            style={{
                                ...buttonStyle,
                                backgroundColor: '#17a2b8',
                                fontSize: '13px',
                                padding: '6px 12px'
                            }}
                        >
                            <i className="ri-download-line" style={{ marginRight: '4px' }}></i>
                            Download QR Code
                        </button>
                    </div>
                </div>
              </div>
            )}
            
            {tokens && type === 'survey' && !itemId && (
                <p style={{ color: 'orange', fontSize: '14px' }}>
                    Please save settings first to generate a link and QR code. The Survey ID is needed.
                </p>
            )}
          </div>
        </div>
      )}

      {/* NEW: Direct Access Link Section */}
      {type === 'survey' && itemId && businessId && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '18px' }}>
            Direct Access Link
          </h3>
          <div style={sectionStyle}>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              Generate a direct access link that bypasses all audience restrictions. Anyone with this link can access the survey when logged in.
            </p>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                onClick={generateDirectAccessLink}
                disabled={generatingDirectLink}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#28a745',
                  opacity: generatingDirectLink ? 0.6 : 1
                }}
                type="button"
              >
                {generatingDirectLink ? 'Generating...' : 'Generate Direct Link'}
              </button>
            </div>

            {directAccessUrl && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                  Direct Access URL (Bypasses all restrictions)
                </label>
                <input
                  type="text"
                  value={directAccessUrl}
                  readOnly
                  style={{...inputStyle, backgroundColor: '#f0f8ff', border: '2px solid #28a745'}}
                  onFocus={(e) => e.target.select()}
                />
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#555', fontSize: '16px' }}>
                    Direct Access QR Code
                  </h4>
                  <div style={{ padding: '10px', display: 'inline-block', background: 'white', border: '2px solid #28a745' }}>
                    <QRCode 
                      value={directAccessUrl}
                      size={160}
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    ⚠️ This link bypasses all audience restrictions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', textAlign: 'right' }}>
        <button onClick={handleSave} disabled={disabled || loading || isSaving} style={{...buttonStyle, backgroundColor: '#28a745'}}>
          {isSaving ? 'Saving...' : 'Save Audience Settings'}
        </button>
      </div>
      {error && <div style={{ color: 'red', marginTop: '10px', textAlign: 'right' }}>{error}</div>}

      {/* DEBUG LOG: Show the last data sent to the backend */}
      {lastSentData && (
        <div style={{
          marginTop: '24px',
          background: '#f8f9fa',
          border: '1px solid #ccc',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '13px',
          color: '#333',
          wordBreak: 'break-all'
        }}>
          <strong>DEBUG: Data sent to backend:</strong>
          <pre style={{ margin: 0, fontSize: '12px', background: 'none', color: '#222' }}>
            {JSON.stringify(lastSentData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AudienceSelection; 