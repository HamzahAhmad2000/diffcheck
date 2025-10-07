import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfileAPI } from '../../services/apiClient'; // Assuming apiClient is set up
import TagSelector from '../common/TagSelector'; // Adjust path as needed
import { toast } from 'react-hot-toast';
import '../../styles/userStyles.css';
import { debounce } from 'lodash';

const UserEditTags = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  
  // State for user's tags
  const [userTags, setUserTags] = useState({
    interests: [],
    owned_devices: [],
    memberships: []
  });

  // State for all available tags, categorized
  const [availableTags, setAvailableTags] = useState({
    INTEREST: [],
    OWNED_DEVICE: [],
    MEMBERSHIP: []
  });

  // State for XP completion status
  const [xpCompletion, setXpCompletion] = useState({});
  const prevXpSetupRef = useRef(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (tagsToSave) => {
      setIsSaving(true);
      try {
        const res = await userProfileAPI.updateProfile(tagsToSave);
        const xpEarned = res.data?.xp_earned || 0;
        // Only dispatch XP events if backend actually awarded XP (not just returning cached value)
        if (xpEarned > 0) {
          // Dispatch global XP gained event for navbar glow
          window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpEarned } }));

          // Update local storage balance
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (userData) {
            userData.xp_balance = (userData.xp_balance || 0) + xpEarned;
            localStorage.setItem('user', JSON.stringify(userData));
            window.dispatchEvent(new CustomEvent('userUpdated'));
          }
        }

        // Update XP completion state from API response (prevents full refetch and page flash)
        if (res.data && typeof res.data === 'object' && 'xp_profile_completion' in res.data) {
          setXpCompletion(res.data.xp_profile_completion || {});
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to save tags.');
      } finally {
        setIsSaving(false);
      }
    }, 1500), // 1.5-second debounce delay
    []
  );

  const fetchTagsData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch user's current profile which includes tags and XP status
      const profileRes = await userProfileAPI.getProfile();
      if (profileRes.data) {
        const profile = profileRes.data;
        setUserTags({
          interests: profile.interests || [],
          owned_devices: profile.owned_devices || [],
          memberships: profile.memberships || []
        });
        setXpCompletion(profile.xp_profile_completion || {});
      }

      // Fetch all available tags for each category in parallel
      const [interestTagsRes, deviceTagsRes, membershipTagsRes] = await Promise.all([
        userProfileAPI.adminGetProfileTags({ category: 'INTEREST' }),
        userProfileAPI.adminGetProfileTags({ category: 'OWNED_DEVICE' }),
        userProfileAPI.adminGetProfileTags({ category: 'MEMBERSHIP' })
      ]);
      
      setAvailableTags({
        INTEREST: interestTagsRes.data || [],
        OWNED_DEVICE: deviceTagsRes.data || [],
        MEMBERSHIP: membershipTagsRes.data || [],
      });

    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch your data.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTagsData();
    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fetchTagsData]);

  // Detect FIRST transition from `tags_setup = false` to `true` **after** the component
  // has mounted. This ensures we only emit one XP-gain event for completing the tag
  // setup, eliminating false positives when users unselect and re-select tags.
  useEffect(() => {
    if (prevXpSetupRef.current === false && xpCompletion?.tags_setup === true) {
      const xpEarned = 500; // Fixed reward for tag setup
      window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpEarned } }));

      // Update local user cache
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      if (userData) {
        userData.xp_balance = (userData.xp_balance || 0) + xpEarned;
        localStorage.setItem('user', JSON.stringify(userData));
        window.dispatchEvent(new CustomEvent('userUpdated'));
      }
    }
    prevXpSetupRef.current = xpCompletion?.tags_setup;
  }, [xpCompletion]);

  const handleTagSelectionChange = (categoryKey, selectedIds) => {
    const updatedTags = {
      ...userTags,
      [categoryKey]: selectedIds
    };
    setUserTags(updatedTags); // Update UI immediately
    debouncedSave(updatedTags); // Trigger debounced save
  };

  const handleBackToProfile = () => {
    navigate('/user/profile');
  };

  if (loading) {
    return (
      <div className="main-content12">
        <div className="user-loading-indicator">
          <div className="user-loading-spinner"></div>
          <p>Loading tags...</p>
        </div>
      </div>
    );
  }
  
  const renderXpStatus = () => {
    const isClaimed = xpCompletion?.tags_setup;
    return (
      <span className={`xp-status ${isClaimed ? 'claimed' : ''}`}>
        {isClaimed ? 'Claimed' : '500 XP'}
      </span>
    );
  };

  return (
      <div className="main-content12">
        <div className="page-inner-container">
          {/* Back button only on small screens */}
          {isMobile && (
            <div className="surveys-subheader">
              <button
                className="page-header__back-button page-header__back-button--primary"
                onClick={handleBackToProfile}
              >
                <i className="ri-arrow-left-s-line"></i> Back
              </button>
            </div>
          )}

          <div className="tags-header">
            <h1 className="page-header__title">Select Tags</h1>
            <p className="tags-main-subtitle" style={{color :"#ffffff"}}>
              Please select tags that apply. These can unlock survey opportunities for you.
              Selecting at least one tag in any section will earn <span className="xp-reward">500 XP</span>.
              
            </p>
          </div>

          <div className="tag-sections-container" style={{ paddingBottom: '64px' }}>
            {/* Interests Section */}
            <div className="tag-section">
              <div className="tag-section-header">
                <h2 className="tag-section-title">Select Your Interests</h2>
              </div>
              <TagSelector 
                availableTags={availableTags.INTEREST}
                selectedTagIds={userTags.interests}
                onChange={(selectedIds) => handleTagSelectionChange('interests', selectedIds)}
                isLoading={isSaving}
                parentLoading={loading}
                hideActions={true}
              />
            </div>

            {/* Owned Devices Section */}
            <div className="tag-section">
              <div className="tag-section-header">
                <h2 className="tag-section-title">Select Devices You Own</h2>
              </div>
              <TagSelector 
                availableTags={availableTags.OWNED_DEVICE}
                selectedTagIds={userTags.owned_devices}
                onChange={(selectedIds) => handleTagSelectionChange('owned_devices', selectedIds)}
                isLoading={isSaving}
                parentLoading={loading}
                hideActions={true}
              />
            </div>

            {/* Memberships Section */}
            <div className="tag-section">
              <div className="tag-section-header">
                <h2 className="tag-section-title">Select Subscriptions You Have</h2>
              </div>
              <TagSelector 
                availableTags={availableTags.MEMBERSHIP}
                selectedTagIds={userTags.memberships}
                onChange={(selectedIds) => handleTagSelectionChange('memberships', selectedIds)}
                isLoading={isSaving}
                parentLoading={loading}
                hideActions={true}
              />
            </div>
          </div>
        </div>
      </div>
  );
};

export default UserEditTags; 