import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userProfileAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import { Country, State, City } from 'country-state-city';
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import '../../styles/userStyles.css';

const UserEditProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const [profileData, setProfileData] = useState({
    username: '',
    dateOfBirth: null,
    gender: '',
    country: '',
    region: '',
    city: '',
    company: '',
    occupation: '',
    email: '', // Email will be read-only
    profileImageUrl: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Image cropping states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  // Security settings states
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [userSecurityQuestions, setUserSecurityQuestions] = useState([
    { question_id: '', answer: '' },
    { question_id: '', answer: '' },
  ]);
  const [passkeys, setPasskeys] = useState([]);
  const [currentPasswordForMfaDisable, setCurrentPasswordForMfaDisable] = useState('');

  useEffect(() => {
    setCountries(Country.getAllCountries());
    const handleResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    
    // Load security questions when component mounts
    const loadSecurityQuestions = async () => {
      try {
        const questionsRes = await userProfileAPI.getAvailableSecurityQuestions();
        setAvailableQuestions(questionsRes.data || []);
      } catch (error) {
        console.error('Failed to load security questions:', error);
      }
    };
    
    loadSecurityQuestions();
  }, []);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const profileRes = await userProfileAPI.getProfile();
      if (profileRes.data) {
        setProfileData({
          username: profileRes.data.username || '',
          dateOfBirth: profileRes.data.date_of_birth ? new Date(profileRes.data.date_of_birth) : null,
          gender: profileRes.data.gender || '',
          country: profileRes.data.country || '',
          region: profileRes.data.region || '',
          city: profileRes.data.city || '',
          company: profileRes.data.company || '',
          occupation: profileRes.data.occupation || '',
          email: profileRes.data.email || '',
          profileImageUrl: profileRes.data.profile_image_url || ''
        });
        
        // Set MFA status
        setMfaEnabled(profileRes.data.mfa_enabled || false);
        
        localStorage.setItem('user', JSON.stringify(profileRes.data));
        window.dispatchEvent(new Event('userUpdated'));
        if (profileRes.data.country) {
          setRegions(State.getStatesOfCountry(profileRes.data.country));
        }
        if (profileRes.data.country && profileRes.data.region) {
          setCities(City.getCitiesOfState(profileRes.data.country, profileRes.data.region));
        }
      }

      // Fetch linked accounts
      const linkedAccountsRes = await userProfileAPI.getLinkedAccounts();
      setLinkedAccounts(linkedAccountsRes.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch profile data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (profileData.country) {
      setRegions(State.getStatesOfCountry(profileData.country));
      setProfileData(prev => ({ ...prev, region: '', city: '' })); // Reset region and city when country changes
    } else {
      setRegions([]);
      setProfileData(prev => ({ ...prev, region: '', city: '' }));
    }
  }, [profileData.country]);

  useEffect(() => {
    if (profileData.country && profileData.region) {
      setCities(City.getCitiesOfState(profileData.country, profileData.region));
      setProfileData(prev => ({ ...prev, city: '' })); // Reset city when region changes
    } else {
      setCities([]);
      setProfileData(prev => ({ ...prev, city: '' }));
    }
  }, [profileData.country, profileData.region]);

  // Update preview canvas when crop changes
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

  // Add OAuth callback handling
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'discord_linked') {
      toast.success('Successfully linked your Discord account!');
      // Clean up URL
      navigate('/user/profile/edit', { replace: true });
      // Refresh profile data to show new linked account
      fetchProfileData();
    } else if (error) {
      let errorMessage = 'Failed to link Discord account. Please try again.';
      switch (error) {
        case 'discord_account_in_use':
          errorMessage = 'This Discord account is already linked to a different user.';
          break;
        case 'session_expired':
          errorMessage = 'Your session has expired. Please try again.';
          break;
        case 'user_not_found':
          errorMessage = 'User not found. Please log in again.';
          break;
        case 'discord_no_code':
          errorMessage = 'Authorization code not received from Discord.';
          break;
        case 'unexpected_error':
          errorMessage = 'An unexpected error occurred. Please try again.';
          break;
      }
      toast.error(errorMessage);
      // Clean up URL
      navigate('/user/profile/edit', { replace: true });
    }
  }, [location, navigate, fetchProfileData]);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if(!profileData.username) {
      toast.error('Username is required.');
      return;
    }
    try {
      const { profileImageUrl, ...profileFields } = profileData;
      const dataToSubmit = {
        ...profileFields,
        profile_image_url: profileImageUrl,
        dateOfBirth: profileData.dateOfBirth ? profileData.dateOfBirth.toISOString().split('T')[0] : null,
      };

      await userProfileAPI.updateProfile(dataToSubmit);
      
      // Update localStorage with new user data
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        const updatedUser = { ...user, ...dataToSubmit };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Dispatch custom event to notify TopNavbar of profile update
        document.dispatchEvent(new CustomEvent('profile-updated', { 
          detail: { user: updatedUser } 
        }));
      }
      
      toast.success('Profile updated successfully!');
      fetchProfileData(); // Re-fetch to confirm changes and get latest data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile.');
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('All password fields are required.');
      return;
    }
    try {
      await userProfileAPI.changePassword(passwordData);
      toast.success('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password.');
    }
  };

  const handleBackToProfile = () => {
    navigate('/user/profile');
  };

  const getProviderIcon = (provider) => {
    switch (provider.toLowerCase()) {
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

  const handleUnlinkSocialAccount = async (provider) => {
    if (!window.confirm(`Are you sure you want to unlink your ${provider} account?`)) return;
    try {
      await userProfileAPI.unlinkSocialAccount(provider);
      toast.success(`${provider} account unlinked successfully!`);
      fetchProfileData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to unlink ${provider} account.`);
    }
  };
  
  const handleLinkSocialAccount = async (provider) => {
    try {
        // Get the auth token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Please log in again to link your account.');
            return;
        }

        // For Discord OAuth, use the API call to initiate
        if (provider === 'discord') {
            const backendUrl = `${baseURL}/linking/discord/initiate`;
            const response = await fetch(backendUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to initiate Discord OAuth');
            }

            const data = await response.json();
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            } else {
                throw new Error('Failed to get Discord OAuth URL');
            }
            return;
        }

        // For Twitter and Google, use similar approach
        if (provider === 'twitter' || provider === 'google') {
            const currentUrl = window.location.origin + '/user/profile/edit';
            const backendUrl = `${baseURL}/linking/${provider}/initiate`;
            
            // Create the OAuth URL with the token and callback URL
            const oauthParams = new URLSearchParams({
                token: token,
                client_callback_url: currentUrl
            });
            
            window.location.href = `${backendUrl}?${oauthParams.toString()}`;
            return;
        }

        // For other providers (if any), use the standard fetch approach
        const backendUrl = `${baseURL}/linking/${provider}/initiate`;
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to initiate OAuth');
        }

        const data = await response.json();
        if (data.redirect_url) {
            window.location.href = data.redirect_url;
        } else {
            throw new Error(data.error || 'Failed to initiate OAuth');
        }
    } catch (error) {
        console.error('Error linking account:', error);
        toast.error(error.message || 'Failed to link account. Please try again.');
    }
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file size should be less than 10MB.');
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setShowCropModal(true);
  };

  // Store Date object directly and convert when submitting
  const handleDateChange = (date) => {
    setProfileData(prev => ({
      ...prev,
      dateOfBirth: date || null
    }));
  };

  const getFullImageUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${baseURL}${url}`;
  };

  // Image cropping utility functions
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

  // Convert canvas to blob and upload
  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  const getCroppedImg = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !previewCanvasRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const pixelRatio = window.devicePixelRatio;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const ctx = canvas.getContext('2d');

    canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;

    ctx.save();

    // Move the crop origin to the canvas origin (0,0)
    ctx.translate(-cropX, -cropY);
    ctx.drawImage(image, 0, 0);
    ctx.restore();

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    return blob;
  }, [completedCrop]);

  const handleCropComplete = async () => {
    try {
      const croppedImageBlob = await getCroppedImg();
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'profile-image.jpg', { type: 'image/jpeg' });
        const res = await userProfileAPI.uploadProfileImage(file);
        const newImageUrl = res.data.image_url;
        setProfileData(prev => ({ ...prev, profileImageUrl: newImageUrl }));
        
        // Update localStorage with new image URL
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          const updatedUser = { ...user, profile_image_url: newImageUrl };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          
          // Dispatch custom event to notify TopNavbar of profile update with full user object
          document.dispatchEvent(new CustomEvent('profile-updated', { 
            detail: { user: updatedUser } 
          }));
        }
        
        toast.success('Profile image updated successfully!');
      }
    } catch (error) {
      toast.error('Failed to update profile image.');
      console.error('Error cropping image:', error);
    } finally {
      setShowCropModal(false);
      setImageToCrop(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setScale(1);
      setRotate(0);
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setScale(1);
    setRotate(0);
  };

  // Security settings handlers
  const handleSetupMFA = async () => {
    setLoading(true);
    try {
      const res = await userProfileAPI.setupMFA();
      setMfaSetupData({ mfa_type: 'email_otp' });
      toast.success('MFA setup initiated. Check your email for verification code.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initiate MFA setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaVerificationCode) {
      toast.error('Please enter the verification code.');
      return;
    }
    setLoading(true);
    try {
      await userProfileAPI.verifyMFA({ pin: mfaVerificationCode });
      setMfaEnabled(true);
      setMfaSetupData(null);
      setMfaVerificationCode('');
      toast.success('MFA enabled successfully!');
      fetchProfileData(); // Refresh profile data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to verify MFA code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!currentPasswordForMfaDisable) {
      toast.error('Please enter your current password to disable MFA.');
      return;
    }
    setLoading(true);
    try {
      await userProfileAPI.disableMFA({ password: currentPasswordForMfaDisable });
      setMfaEnabled(false);
      setCurrentPasswordForMfaDisable('');
      toast.success('MFA disabled successfully!');
      fetchProfileData(); // Refresh profile data
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to disable MFA.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityQuestionChange = (index, field, value) => {
    const updatedQuestions = [...userSecurityQuestions];
    updatedQuestions[index][field] = value;
    setUserSecurityQuestions(updatedQuestions);
  };

  const handleSetSecurityQuestions = async () => {
    const questionsToSet = userSecurityQuestions.filter(q => q.question_id && q.answer);
    if (questionsToSet.length < 2) {
      toast.error('Please select at least two questions and provide answers.');
      return;
    }
    setLoading(true);
    try {
      await userProfileAPI.setSecurityQuestions({ security_questions: questionsToSet });
      toast.success('Security questions updated successfully!');
      // Clear the form after successful submission
      setUserSecurityQuestions([
        { question_id: '', answer: '' },
        { question_id: '', answer: '' },
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update security questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePasskeys = async () => {
    if (!window.confirm('Are you sure you want to generate new passkeys? This will invalidate any old ones you might have saved.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await userProfileAPI.generatePasskeys();
      setPasskeys(res.data.passkeys || []);
      toast.success('New passkeys generated. Please save them securely!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate passkeys.');
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content12">
        <div className="user-loading-indicator">
          <div className="user-loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      
      <main className="main-content12" style={{ marginLeft: '100px' }}>
        <div className="page-inner-container">
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

          <div className="surveys-separator"></div>

          <div className="settings-sections">
            {/* Personal Information Form */}
            <form onSubmit={handleProfileSubmit} className="settings-section">
              <h2 className="settings-section__title">Personal Information</h2>
              <div className="settings-section__content">
                <div className="settings-section__grid">
                  <div className="settings-input-group">
                    <label htmlFor="profileImage">Profile Image</label>
                    {profileData.profileImageUrl && (
                      <img src={getFullImageUrl(profileData.profileImageUrl)} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }} />
                    )}
                    <input type="file" id="profileImage" accept="image/*" onChange={handleProfileImageChange} />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="username">Username</label>
                    <input type="text" name="username" id="username" value={profileData.username} onChange={handleProfileChange} required />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="email">Email (Read-only)</label>
                    <input type="email" name="email" id="email" value={profileData.email} readOnly />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="dateOfBirth">Date of Birth</label>
                    <DatePicker
                      selected={profileData.dateOfBirth}
                      onChange={handleDateChange}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Select date of birth"
                      maxDate={new Date()}
                      showYearDropdown
                      scrollableYearDropdown
                      yearDropdownItemNumber={100}
                      className="datepicker-input"
                    />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="gender">Gender</label>
                    <select name="gender" id="gender" value={profileData.gender} onChange={handleProfileChange}>
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <h3 className="settings-section__subtitle">Location</h3>
                <div className="settings-section__grid">
                  <div className="settings-input-group">
                    <label htmlFor="country">Country</label>
                    <select name="country" id="country" value={profileData.country} onChange={handleProfileChange}>
                      <option value="">Select Country</option>
                      {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="region">Region/State</label>
                    <select name="region" id="region" value={profileData.region} onChange={handleProfileChange} disabled={!profileData.country || regions.length === 0}>
                      <option value="">Select Region/State</option>
                      {regions.map(r => <option key={r.isoCode} value={r.isoCode}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="city">City</label>
                    <select name="city" id="city" value={profileData.city} onChange={handleProfileChange} disabled={!profileData.region || cities.length === 0}>
                      <option value="">Select City</option>
                      {cities.map(city => <option key={city.name} value={city.name}>{city.name}</option>)}
                    </select>
                  </div>
                </div>

                <h3 className="settings-section__subtitle">Professional Information</h3>
                <div className="settings-section__grid">
                  <div className="settings-input-group">
                    <label htmlFor="company">Company</label>
                    <input type="text" name="company" id="company" value={profileData.company} onChange={handleProfileChange} />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="occupation">Occupation</label>
                    <input type="text" name="occupation" id="occupation" value={profileData.occupation} onChange={handleProfileChange} />
                  </div>
                </div>

                <div className="settings-section__actions">
                  <button type="submit" className="settings-button settings-button--primary">Save Profile Changes</button>
                </div>
              </div>
            </form>

            {/* Password Change Form */}
            <form onSubmit={handleChangePasswordSubmit} className="settings-section">
              <h2 className="settings-section__title">Change Password</h2>
              <div className="settings-section__content">
                <div className="settings-section__grid">
                  <div className="settings-input-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input type="password" name="currentPassword" id="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="newPassword">New Password</label>
                    <input type="password" name="newPassword" id="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required />
                  </div>
                  <div className="settings-input-group">
                    <label htmlFor="confirmNewPassword">Confirm New Password</label>
                    <input type="password" name="confirmNewPassword" id="confirmNewPassword" value={passwordData.confirmNewPassword} onChange={handlePasswordChange} required />
                  </div>
                </div>
                <div className="settings-section__actions">
                  <button type="submit" className="settings-button settings-button--primary">Change Password</button>
                </div>
              </div>
            </form>

            {/* Multi-Factor Authentication Section */}
            <div className="settings-section">
              <h2 className="settings-section__title">Multi-Factor Authentication (MFA)</h2>
              <div className="settings-section__content">
                {mfaEnabled ? (
                  <div>
                    <p className="settings-section__message settings-section__message--success">
                      MFA is currently enabled on your account.
                    </p>
                    <div className="settings-form">
                      <div className="settings-input-group">
                        <label htmlFor="currentPasswordForMfaDisable">Current Password (to disable MFA)</label>
                        <input 
                          type="password"
                          id="currentPasswordForMfaDisable"
                          value={currentPasswordForMfaDisable}
                          onChange={(e) => setCurrentPasswordForMfaDisable(e.target.value)}
                          required
                        />
                      </div>
                      <div className="settings-section__actions">
                        <button 
                          type="button" 
                          onClick={handleDisableMFA} 
                          disabled={loading} 
                          className="settings-button settings-button--danger"
                        >
                          {loading ? 'Disabling...' : 'Disable MFA'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : mfaSetupData ? (
                  <div className="settings-form">
                    <p className="settings-section__message">Check your email for the verification code:</p>
                    <div className="settings-input-group">
                      <label htmlFor="mfaVerificationCode">Email Verification Code</label>
                      <input 
                        type="text" 
                        id="mfaVerificationCode"
                        value={mfaVerificationCode} 
                        onChange={(e) => setMfaVerificationCode(e.target.value)} 
                        placeholder="Enter 6-digit code from email"
                        required 
                      />
                    </div>
                    <div className="settings-section__actions">
                      <button 
                        type="button" 
                        onClick={handleVerifyMFA} 
                        disabled={loading} 
                        className="settings-button settings-button--primary"
                      >
                        {loading ? 'Verifying...' : 'Verify & Enable MFA'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="settings-section__message">MFA is not enabled. Add an extra layer of security to your account.</p>
                    <div className="settings-section__actions">
                      <button 
                        type="button" 
                        onClick={handleSetupMFA} 
                        disabled={loading} 
                        className="settings-button settings-button--primary"
                      >
                        {loading ? 'Initiating...' : 'Setup MFA'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security Questions Section */}
            <div className="settings-section">
              <h2 className="settings-section__title">Security Questions</h2>
              <div className="settings-section__content">
                <p className="settings-section__message">Set up security questions for account recovery. Choose 2 questions.</p>
                <div className="settings-section__grid">
                  {userSecurityQuestions.map((sq, index) => (
                    <div key={index} className="settings-input-group">
                      <label htmlFor={`question-${index}`}>Question {index + 1}</label>
                      <select 
                        id={`question-${index}`} 
                        value={sq.question_id} 
                        onChange={(e) => handleSecurityQuestionChange(index, 'question_id', e.target.value)} 
                        required
                      >
                        <option value="">Select a question</option>
                        {availableQuestions.map(q => (
                          <option key={q.id} value={q.id}>{q.question}</option>
                        ))}
                      </select>
                      <label htmlFor={`answer-${index}`}>Answer {index + 1}</label>
                      <input 
                        type="password"
                        id={`answer-${index}`} 
                        value={sq.answer} 
                        onChange={(e) => handleSecurityQuestionChange(index, 'answer', e.target.value)} 
                        placeholder="Enter your answer"
                        required 
                      />
                    </div>
                  ))}
                </div>
                <div className="settings-section__actions">
                  <button 
                    type="button" 
                    onClick={handleSetSecurityQuestions} 
                    disabled={loading} 
                    className="settings-button settings-button--primary"
                  >
                    {loading ? 'Saving Questions...' : 'Save Security Questions'}
                  </button>
                </div>
              </div>
            </div>

            {/* Passkeys Section */}
            <div className="settings-section">
              <h2 className="settings-section__title">Passkeys (Recovery Codes)</h2>
              <div className="settings-section__content">
                <p className="settings-section__message">
                  Generate a set of one-time passkeys to use for account recovery if you lose access to your MFA device. Store these securely.
                </p>
                <div className="settings-section__actions">
                  <button onClick={handleGeneratePasskeys} disabled={loading} className="settings-button settings-button--primary">
                    {loading ? 'Generating...' : 'Generate New Passkeys'}
                  </button>
                </div>
                {passkeys.length > 0 && (
                  <div className="settings-passkeys-container">
                    <h3 className="settings-section__subtitle">Your New Passkeys:</h3>
                    <p className="settings-section__message settings-section__message--warning">
                      Please copy these codes and store them in a safe place. You will not be able to see them again after leaving this page.
                    </p>
                    <div className="settings-passkeys-grid">
                      {passkeys.map((key, index) => (
                        <div key={index} className="passkey-item">
                          <span className="passkey-number">{index + 1}.</span>
                          <code className="passkey-code">{key}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Social Account Management */}
            <div className="settings-section">
              <h2 className="settings-section__title">Linked Social Accounts</h2>
              <div className="settings-section__content">
                {linkedAccounts.length > 0 ? (
                  <ul className="settings-social-list">
                    {linkedAccounts.map(acc => (
                      <li key={acc.provider} className="settings-social-item">
                        <span className="settings-social-item__info">
                          <i className={getProviderIcon(acc.provider)}></i>
                          {acc.provider} ({acc.name || acc.email || 'Linked'})
                        </span>
                        <button 
                          onClick={() => handleUnlinkSocialAccount(acc.provider)} 
                          className="social-unlink-button"
                          disabled={loading}
                        >
                          <i className="ri-link-unlink-m"></i>
                          Unlink
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings-section__message">No social accounts linked yet.</p>
                )}
                
                <h3 className="settings-section__subtitle">Link New Account:</h3>
                <div className="settings-social-actions">
                  <button 
                    onClick={() => handleLinkSocialAccount('google')} 
                    className="settings-button settings-button--social"
                    disabled={loading || linkedAccounts.some(acc => acc.provider === 'google')}
                  >
                    <i className="ri-google-fill"></i> Link Google
                  </button>
                  <button 
                    onClick={() => handleLinkSocialAccount('discord')} 
                    className="settings-button settings-button--social"
                    disabled={loading || linkedAccounts.some(acc => acc.provider === 'discord')}
                  >
                    <i className="ri-discord-fill"></i> Link Discord
                  </button>
                  <button 
                    onClick={() => handleLinkSocialAccount('twitter')} 
                    className="settings-button settings-button--social"
                    disabled={loading || linkedAccounts.some(acc => acc.provider === 'twitter')}
                  >
                    <i className="ri-twitter-fill"></i> Link X (Twitter)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Image Cropping Modal */}
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

export default UserEditProfile; 