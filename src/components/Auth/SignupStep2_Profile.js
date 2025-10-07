import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { authAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';
import SocialLinkButton from './SocialLinkButton';
import '../../styles/Auth.css';
import '../../styles/account.css';

// Placeholder icons - replace with actual paths or imported components
const googleIcon = '/path/to/google-icon.svg';
const xIcon = '/path/to/x-icon.svg';
const discordIcon = '/path/to/discord-icon.svg';
const metaIcon = '/path/to/meta-icon.svg';

const SignupStep2Profile = ({ initialData = {}, onPrev = () => {console.warn("onPrev handler not implemented for SignupStep2Profile")} }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: initialData.username || '',
    dateOfBirth: initialData.dateOfBirth || '',
    gender: initialData.gender || '',
    country: initialData.country || '',
    region: initialData.region || '',
    city: initialData.city || '',
    company: initialData.company || '',
    occupation: initialData.occupation || '',
  });
  const [errors, setErrors] = useState({});
  const [localTempAuthToken, setLocalTempAuthToken] = useState(null);
  const [userEmailForDisplay, setUserEmailForDisplay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('reg_temp_auth_token');
    const email = localStorage.getItem('reg_user_email');
    const emailVerified = localStorage.getItem('reg_email_verified');
    
    if (!token) {
      toast.error('Email verification incomplete. Please start from Step 1.');
      navigate('/register/step1');
    } else if (emailVerified !== 'true') {
      // Security check: redirect to OTP verification if email not verified
      toast.error('Please verify your email before completing your profile.');
      navigate('/verify-email');
    } else {
      setLocalTempAuthToken(token);
      setUserEmailForDisplay(email || 'Email not found');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Updating ${name} to:`, value); // Add logging
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      console.log('New form data:', newData); // Add logging
      return newData;
    });
  };

  const handleDateChange = (date) => {
    let formattedDate = '';
    if (date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
    console.log('Setting date to:', formattedDate); // Add logging
    setFormData(prev => {
      const newData = { ...prev, dateOfBirth: formattedDate };
      console.log('New form data after date:', newData); // Add logging
      return newData;
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required.';
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required.';
    } else {
      const today = new Date();
      const dob = new Date(formData.dateOfBirth);
      const age = today.getFullYear() - dob.getFullYear() - (today < new Date(dob.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      if (age < 16) newErrors.dateOfBirth = 'You must be at least 16 years old to register.';
    }
    if (!formData.country.trim()) newErrors.country = 'Country is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submission - Current form data:', formData); // Add logging
    
    if (!localTempAuthToken) {
        toast.error('Critical error: Missing authentication token. Please verify your email again.');
        navigate('/register/step1');
        return;
    }
    if (validate()) {
      setIsSubmitting(true);
      try {
        const payload = { 
            ...formData, 
            tempAuthToken: localTempAuthToken, 
            email: userEmailForDisplay
        };
        console.log('Sending payload to backend:', payload); // Add logging
        // The backend now finalizes registration at this step
        const response = await authAPI.completeRegistrationStep2Profile(payload);
        
        toast.success('Registration complete! Welcome aboard!', { duration: 3000 });

        // The response now contains the final auth token and user data
        const { token, user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userRole', user.role || 'user');

        // Clean up registration-specific items from localStorage
        localStorage.removeItem('reg_temp_auth_token');
        localStorage.removeItem('reg_user_email');
        localStorage.removeItem('reg_tags');
        localStorage.removeItem('reg_email_verified');

        navigate('/user/home'); // Navigate to the main dashboard
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to save profile. Please try again.';
        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSocialLink = (platform) => {
    if (!localTempAuthToken) {
      toast.error('Email verification must be completed to link social accounts.');
      return;
    }
    const clientCallbackUrl = `${window.location.origin}/oauth/callback?source=registration`;
    window.location.href = `/api/auth/oauth/${platform.toLowerCase()}/initiate?registration_token=${localTempAuthToken}&client_callback_url=${encodeURIComponent(clientCallbackUrl)}`;
  };

  return (
    <div className="auth-container primaryfont" style={{ color: '#eaeaea' }}>
      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="auth-title">Profile Information - Step 2</h2>
        <p className="info-text">Logged in as: {userEmailForDisplay}</p>

        <div className="form-group">
          <label htmlFor="username">Username *</label>
          <input 
            type="text" 
            id="username" 
            name="username" 
            value={formData.username || ''} 
            onChange={handleChange} 
            placeholder="Choose a username" 
            className={errors.username ? 'input-error' : ''} 
            disabled={isSubmitting} 
          />
          {errors.username && <p className="error-text">{errors.username}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="dateOfBirth">Date of Birth *</label>
          <DatePicker
            id="dateOfBirth"
            selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
            onChange={handleDateChange}
            dateFormat="yyyy-MM-dd"
            placeholderText="YYYY-MM-DD"
            className={`date-picker-custom-input ${errors.dateOfBirth ? 'input-error' : ''}`}
            wrapperClassName="date-picker-wrapper"
            showYearDropdown
            showMonthDropdown
            dropdownMode="select"
            disabled={isSubmitting}
            maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 16))}
          />
          {errors.dateOfBirth && <p className="error-text">{errors.dateOfBirth}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select id="gender" name="gender" value={formData.gender} onChange={handleChange} disabled={isSubmitting}>
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="country">Country *</label>
          <input type="text" id="country" name="country" value={formData.country} onChange={handleChange} placeholder="Your country" className={errors.country ? 'input-error' : ''} disabled={isSubmitting} />
          {errors.country && <p className="error-text">{errors.country}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="region">Region/State</label>
          <input type="text" id="region" name="region" value={formData.region} onChange={handleChange} placeholder="Your region or state" disabled={isSubmitting} />
        </div>

        <div className="form-group">
          <label htmlFor="city">City</label>
          <input type="text" id="city" name="city" value={formData.city} onChange={handleChange} placeholder="Your city" disabled={isSubmitting} />
        </div>

        <div className="form-group">
          <label htmlFor="company">Company (Optional)</label>
          <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Your company" disabled={isSubmitting} />
        </div>

        <div className="form-group">
          <label htmlFor="occupation">Occupation (Optional)</label>
          <input type="text" id="occupation" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="Your occupation" disabled={isSubmitting} />
        </div>

       

        <div className="form-actions">
          <button type="button" onClick={onPrev} className="auth-button secondary" disabled={isSubmitting}>
            Back
          </button>
          <button type="submit" className="auth-button" disabled={isSubmitting || !localTempAuthToken}>
            {isSubmitting ? 'Saving...' : 'Complete Registration'}
          </button>
        </div>
      </form>
    </div>
  );
};

SignupStep2Profile.propTypes = {
  initialData: PropTypes.object,
  onPrev: PropTypes.func,
};

export default SignupStep2Profile;