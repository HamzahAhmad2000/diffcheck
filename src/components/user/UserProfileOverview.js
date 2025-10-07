import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI, userProfileAPI, referralAPI, baseURL } from '../../services/apiClient'; // To fetch user data if not in localStorage
import toast from 'react-hot-toast';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import '../../styles/userStyles.css';
import '../../styles/UserProfileOverview.css'; // Create this CSS file

const UserProfileOverview = ({ onClose, onNavigateOverlay }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [badges, setBadges] = useState([]);
  const [highestBadge, setHighestBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false); // For robust image fallback
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [isLinking, setIsLinking] = useState(false);
  const [referralLink, setReferralLink] = useState(null);
  const [copied, setCopied] = useState(false);

  // Image cropping states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setImageError(false);
      try {
        // Attempt to get user from localStorage first
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Fetch fresh user details, profile data, and badges
        const userDetailsPromise = authAPI.getCurrentUserDetails();
        const profilePromise = userProfileAPI.getProfile();
        const badgesPromise = userProfileAPI.getMyBadges();
        
        const [userDetailsResponse, profileResponse, badgesResponse] = await Promise.all([
          userDetailsPromise, 
          profilePromise, 
          badgesPromise
        ]);

        // Merge user details with profile data to ensure we have everything
        const freshUser = userDetailsResponse.data.user;
        const profileData = profileResponse.data;
        
        // Build a unified tag list from profile arrays (interests, devices, memberships)
        const aggregatedTags = [
          ...(profileData.interests || []),
          ...(profileData.owned_devices || []),
          ...(profileData.memberships || [])
        ];

        // Create combined user object with unified selected_tags property
        const combinedUserData = {
          ...freshUser,
          ...profileData,
          selected_tags: (profileData.selected_tags && profileData.selected_tags.length > 0)
            ? profileData.selected_tags
            : (freshUser.selected_tags && freshUser.selected_tags.length > 0)
              ? freshUser.selected_tags
              : aggregatedTags
        };
        
        console.log('Combined user data:', combinedUserData); // Debug logging
        console.log('Selected tags:', combinedUserData.selected_tags); // Debug logging
        
        setUser(combinedUserData);
        localStorage.setItem('user', JSON.stringify(combinedUserData));

        console.log('Badges response:', badgesResponse); // Debug logging
        // Handle different possible response structures
        const earnedBadges = badgesResponse.data?.badges || badgesResponse.badges || badgesResponse.data || badgesResponse || [];
        setBadges(earnedBadges);

        if (earnedBadges.length > 0) {
          // Find the badge with the highest xp_threshold - handle different badge structures
          const highest = earnedBadges.reduce((prev, current) => {
            const prevThreshold = prev.badge?.xp_threshold || prev.xp_threshold || 0;
            const currentThreshold = current.badge?.xp_threshold || current.xp_threshold || 0;
            return prevThreshold > currentThreshold ? prev : current;
          });
          setHighestBadge(highest);
          console.log('Highest badge set:', highest); // Debug logging
        }

        // Load linked social accounts
        try {
          const linkedAccountsRes = await userProfileAPI.getLinkedAccounts();
          setLinkedAccounts(linkedAccountsRes.data || []);
        } catch (err) {
          // Non-blocking
          console.warn('[PROFILE_OVERVIEW] Failed to load linked accounts', err);
        }

        // Load referral link
        try {
          const referralRes = await referralAPI.getUserReferralLink();
          setReferralLink(referralRes.data.data);
        } catch (err) {
          console.warn('[PROFILE_OVERVIEW] Failed to load referral link', err);
        }

      } catch (error) {
        console.error('Error fetching profile data:', error);
        toast.error("Session expired or user not found. Please log in again.");
        // Clear all localStorage data including any registration tokens
        localStorage.clear();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const getFullImageUrl = (relativeOrAbsoluteUrl) => {
    if (!relativeOrAbsoluteUrl) return null;
    return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${baseURL}${relativeOrAbsoluteUrl}`;
  };

  // Handle profile image click
  const handleProfileImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle badge click
  const handleBadgeClick = () => {
    if (window.innerWidth < 769) {
      if (typeof onClose === 'function') onClose();
      navigate('/user/badges');
    } else if (typeof onNavigateOverlay === 'function') {
      onNavigateOverlay('badges');
    }
  };

  // Handle copy referral link
  const handleCopyReferralLink = async () => {
    if (!referralLink?.link) return;
    
    try {
      await navigator.clipboard.writeText(referralLink.link);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralLink.link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const getProviderIcon = (provider) => {
    switch ((provider || '').toLowerCase()) {
      case 'discord':
        return 'ri-discord-fill';
      case 'google':
        return 'ri-google-fill';
      case 'twitter':
        return 'ri-twitter-fill';
      default:
        return 'ri-link';
    }
  };

  const handleLinkSocialAccount = async (provider) => {
    try {
      setIsLinking(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in again to link your account.');
        return;
      }

      if (provider === 'discord') {
        const backendUrl = `${baseURL}/linking/discord/initiate`;
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to initiate Discord OAuth');
        const data = await response.json();
        if (data.redirect_url) {
          if (typeof onClose === 'function') onClose();
          window.location.href = data.redirect_url;
        } else {
          throw new Error('Failed to get Discord OAuth URL');
        }
        return;
      }

      if (provider === 'twitter' || provider === 'google') {
        const currentUrl = window.location.origin + '/user/profile';
        const backendUrl = `${baseURL}/linking/${provider}/initiate`;
        const oauthParams = new URLSearchParams({ token, client_callback_url: currentUrl });
        if (typeof onClose === 'function') onClose();
        window.location.href = `${backendUrl}?${oauthParams.toString()}`;
        return;
      }

      const backendUrl = `${baseURL}/linking/${provider}/initiate`;
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to initiate OAuth');
      const data = await response.json();
      if (data.redirect_url) {
        if (typeof onClose === 'function') onClose();
        window.location.href = data.redirect_url;
      } else {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }
    } catch (error) {
      console.error('Error linking account:', error);
      toast.error(error.message || 'Failed to link account. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        toast.error('Image file size should be less than 10MB.');
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setShowCropModal(true);
    e.target.value = null; // Reset file input
  };

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1,
        width,
        height
      ),
      width,
      height
    ));
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  const getCroppedImg = useCallback(async () => {
    if (!completedCrop || !previewCanvasRef.current) {
      return;
    }

    const canvas = previewCanvasRef.current;
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
    return blob;
  }, [completedCrop]);
  
  const handleCropComplete = async () => {
    try {
      const croppedImageBlob = await getCroppedImg();
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'profile-image.jpg', { type: 'image/jpeg' });
        
        // 1. Upload image to get URL
        const uploadRes = await userProfileAPI.uploadProfileImage(file);
        const newImageUrl = uploadRes.data.image_url;

        // 2. Save new image URL to the user's profile
        await userProfileAPI.updateProfile({ profile_image_url: newImageUrl });
        
        // 3. Update state and localStorage for immediate UI update
        const updatedUser = { ...user, profile_image_url: newImageUrl };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Dispatch custom event to notify TopNavbar of profile update
        document.dispatchEvent(new CustomEvent('profile-updated', { 
          detail: { user: updatedUser } 
        }));
        
        setImageError(false); // Reset image error state

        toast.success('Profile image updated successfully!');
      }
    } catch (error) {
      toast.error('Failed to update profile image.');
      console.error('Error during profile image update:', error);
    } finally {
      setShowCropModal(false);
      setImageToCrop(null);
      setCrop(undefined);
      setCompletedCrop(null);
      setScale(1);
      setRotate(0);
    }
};

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setScale(1);
    setRotate(0);
  };

  useEffect(() => {
    if (completedCrop && imgRef.current && previewCanvasRef.current) {
      const image = imgRef.current;
      const canvas = previewCanvasRef.current;
      const crop = completedCrop;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');
      const pixelRatio = window.devicePixelRatio;

      canvas.width = crop.width * pixelRatio;
      canvas.height = crop.height * pixelRatio;

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height,
      );
    }
  }, [completedCrop]);

  if (loading) {
    return (
      <div className="app-layout">
        <main className="main-content12">
          <div className="page-inner-container">
            <div className="loading-surveys">
              <div className="user-loading-indicator">
                <div className="user-loading-spinner"></div>
                <p>Loading profile...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-layout">
        <main className="main-content12">
          <div className="page-inner-container">
            <div className="user-error-message">
              <p>Could not load user profile.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Get badge data with proper fallback handling
  const badgeData = highestBadge?.badge || highestBadge;
  const badgeImageUrl = badgeData?.image_url;
  const badgeName = badgeData?.name;
  const showImage = user && user.profile_image_url && !imageError;

  return (
    <div className="app-layout">
      <main className="main-content12">
        <div className="page-inner-container">
          <div className="profile-overview-grid">
            <aside className="profile-sidebar">
              {/* Left-side stacked actions */}
              <nav className="profile-navigation">
                <Link
                  to="/user/profile/edit"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                      e.preventDefault();
                      onNavigateOverlay('edit-profile');
                    } else if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                >
                  <i className="ri-user-settings-line"></i>
                  <span>Edit Profile</span>
                </Link>
                <Link
                  to="/user/profile/tags"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                      e.preventDefault();
                      onNavigateOverlay('tags');
                    } else if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                >
                  <i className="ri-price-tag-3-line"></i>
                  <span>Manage Interests</span>
                </Link>
                <Link
                  to="/user/badges"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                      e.preventDefault();
                      onNavigateOverlay('badges');
                    } else if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                >
                  <i className="ri-medal-line"></i>
                  <span>My Badges</span>
                </Link>
                <Link
                  to="/user/rewards"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                      e.preventDefault();
                      onNavigateOverlay('rewards');
                    } else if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                >
                  <i className="ri-gift-line"></i>
                  <span>My Rewards</span>
                </Link>
                <Link
                  to="/user/referrals"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                      e.preventDefault();
                      onNavigateOverlay('referrals');
                    } else if (typeof onClose === 'function') {
                      onClose();
                    } else {
                      // Standalone usage - navigate directly
                      navigate('/user/referrals');
                      e.preventDefault();
                    }
                  }}
                >
                  <i className="ri-user-add-line"></i>
                  <span>Referrals</span>
                </Link>
                {referralLink && (
                  <div className="referral-link-quick-access">
                    <div className="referral-link-label">
                      <i className="ri-link"></i>
                      <span>Your Referral Link</span>
                    </div>
                    <div className="referral-link-actions">
                      <input 
                        type="text" 
                        value={referralLink.link} 
                        readOnly 
                        className="referral-link-input-small"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        onClick={handleCopyReferralLink}
                        className={`copy-link-btn-small ${copied ? 'copied' : ''}`}
                        title="Copy referral link"
                      >
                        <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'}></i>
                      </button>
                    </div>
                  </div>
                )}
                <Link
                  to="/user/xp-history"
                  className="profile-nav-link"
                  onClick={(e) => {
                    if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                >
                  <i className="ri-history-line"></i>
                  <span>XP History</span>
                </Link>
              </nav>
            </aside>

            <section className="profile-main">
              <div className="surveys-separator"></div>

              {/* Profile Header Section */}
              <div className="profile-header-section">
                <div className="user-panel">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/*"
              />
              <div 
                className="profile-image-container clickable" 
                onClick={handleProfileImageClick}
                title="Click to edit profile image"
              >
                {showImage ? (
                  <img 
                    src={getFullImageUrl(user.profile_image_url)} 
                    alt="Profile" 
                    className="profile-image-large"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="profile-image-fallback">
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="profile-image-edit-overlay">
                  <i className="ri-camera-line"></i>
                </div>
              </div>
              
              <div className="profile-info">
                <h1 className="profile-username">{user?.name || user?.username || 'User'}</h1>
                <p className="profile-email">{user?.email}</p>
                
                {/* XP and Badge Display - Same Line with Better Alignment */}
                <div className="xp-badge-container">
                  <div className="xp-balance-display">
                    <div className="xp-coin-icon">
                      <i className="ri-copper-coin-line"></i>
                    </div>
                    <span className="xp-amount" style={{color: 'yellow'}}>{(user.xp_balance || 0).toLocaleString()}</span>
                    <span className="xp-label">XP</span>
                  </div>
                  
                  {/* Current Badge Display */}
                  {badgeData && (
                    <div 
                      className="profile-badge-display clickable"
                      onClick={handleBadgeClick}
                      title="Click to view all badges"
                    >
                      <img 
                        src={getFullImageUrl(badgeImageUrl)} 
                        alt={badgeName || 'Badge'}
                        className="profile-highest-badge"
                        onError={(e) => { 
                          e.target.src = '/default-badge-placeholder.png';
                        }}
                      />
                      <div className="badge-info">
                        <span className="profile-badge-name">{badgeName || 'Badge'}</span>
                      </div>
                    </div>
                  )}
                  
                  {!badgeData && (
                    <div 
                      className="no-badges-message clickable"
                      onClick={handleBadgeClick}
                      title="Click to view available badges"
                    >
                      <div className="default-badge-icon">
                        <i className="ri-medal-line"></i>
                      </div>
                      <span>No badges yet</span>
                    </div>
                  )}
                </div>
                {/* Social linking pill with icons only */}
                <div className="social-link-pill" title="Link social accounts">
                  {['google','discord','twitter'].map((provider) => {
                    const isLinked = linkedAccounts.some((acc) => (acc.provider || '').toLowerCase() === provider);
                    return (
                      <button
                        key={provider}
                        className={`social-icon-btn ${isLinked ? 'linked' : ''}`}
                        onClick={() => !isLinked && handleLinkSocialAccount(provider)}
                        disabled={isLinked || isLinking}
                        aria-label={`Link ${provider}`}
                        title={isLinked ? `${provider} linked` : `Link ${provider}`}
                      >
                        <i className={getProviderIcon(provider)}></i>
                      </button>
                    );
                  })}
                </div>
                
                <p className="encouragement-text">
                  {badgeData ? 'Keep earning XP to unlock more badges!' : 'Complete surveys to earn your first badge!'}
                </p>
              </div>
              </div>
              {/* end .profile-header-section */}
              
              {/* Manage Interests Section - Integrated */}
              <div className="manage-interests-section">
                <h3>Your Tags</h3>
                <div className="interests-tags">
                  {Array.isArray(user.selected_tags) && user.selected_tags.length > 0 ? (
                    user.selected_tags.map((tag, index) => {
                      const tagLabel = typeof tag === 'string' ? tag : (tag.name || tag.label || tag.tag || tag.title || `Tag ${index+1}`);
                      return (
                        <span key={index} className="interest-tag">
                          {tagLabel}
                        </span>
                      );
                    })
                  ) : (
                    <p className="no-interests">No tags selected yet. Click below to add some!</p>
                  )}
                </div>
                <div className="profile-action-buttons">
                  <button 
                    className="edit-interests-btn"
                    onClick={() => {
                      if (window.innerWidth >= 769 && typeof onNavigateOverlay === 'function') {
                        onNavigateOverlay('tags');
                      } else {
                        if (typeof onClose === 'function') onClose();
                        navigate('/user/profile/tags');
                      }
                    }}
                  >
                    Edit Tags
                  </button>
                  
                  <button 
                    className="daily-rewards-btn"
                    onClick={() => {
                      if (typeof onClose === 'function') onClose();
                      navigate('/user/daily-rewards');
                    }}
                    title="View your daily login calendar and claim rewards!"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Daily Rewards
                  </button>
                  
                  <button 
                    className="season-pass-btn"
                    onClick={() => {
                      if (typeof onClose === 'function') onClose();
                      navigate('/user/season-pass/activate');
                    }}
                    title="Access Season Pass - Unlock exclusive rewards and progression!"
                  >
                    <i className="ri-vip-crown-line"></i>
                    Season Pass
                  </button>
                </div>
              </div>
              </div>
            </section>
            
          </div>
        </div>
      </main>
      {showCropModal && (
        <div className="crop-modal-overlay">
          <div className="crop-modal">
            <div className="crop-modal-header">
              <h3>Crop Profile Image</h3>
              <button onClick={handleCropCancel} className="crop-modal-close">
                <i className="ri-close-line"></i>
              </button>
            </div>
            
            <div className="crop-modal-content">
              <div className="crop-controls">
                <div className="crop-control">
                  <label>Zoom:</label>
                  <input
                    type="range"
                    value={scale}
                    disabled={!imageToCrop}
                    onChange={(e) => setScale(Number(e.target.value))}
                    min="1"
                    max="3"
                    step="0.1"
                    className="crop-slider"
                  />
                  <span>{Math.round(scale * 100)}%</span>
                </div>
                
                <div className="crop-control">
                  <label>Rotate:</label>
                  <input
                    type="range"
                    value={rotate}
                    disabled={!imageToCrop}
                    onChange={(e) => setRotate(Math.min(180, Math.max(-180, Number(e.target.value))))}
                    min="-180"
                    max="180"
                    step="1"
                    className="crop-slider"
                  />
                  <span>{rotate}°</span>
                </div>
              </div>

              <div className="crop-container">
                {imageToCrop && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop
                  >
                    <img
                      ref={imgRef}
                      alt="Crop preview"
                      src={imageToCrop}
                      style={{ 
                        transform: `scale(${scale}) rotate(${rotate}deg)`,
                        maxHeight: '400px',
                        maxWidth: '100%'
                      }}
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                )}
              </div>

              <div className="crop-preview">
                <h4>Preview:</h4>
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '50%',
                    width: '100px',
                    height: '100px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </div>

            <div className="crop-modal-actions">
              <button onClick={handleCropCancel} className="crop-btn crop-btn-cancel">
                Cancel
              </button>
              <button onClick={handleCropComplete} className="crop-btn crop-btn-save">
                Save Cropped Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileOverview; 