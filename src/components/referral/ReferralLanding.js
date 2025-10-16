import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { referralAPI, authAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './ReferralLanding.css';

const ReferralLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  
  const [loading, setLoading] = useState(true);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // Store referral code in localStorage for later use
    if (refCode) {
      localStorage.setItem('referral_code', refCode);
    }

    if (!refCode) {
      // No referral code provided, redirect to signup
      navigate('/register/step1');
      return;
    }

    const validateCode = async () => {
      try {
        // Track the click
        await referralAPI.trackReferralClick(refCode);

        // Validate and get referrer info
        const response = await referralAPI.validateReferralCode(refCode);

        if (response.data.valid) {
          setReferrerInfo(response.data.data);
          // Store referrer information in localStorage
          localStorage.setItem('referrer_info', JSON.stringify(response.data.data));
        } else {
          // Even if invalid, store the code and redirect to signup
          console.warn('Invalid referral code, but storing for later use:', refCode);
          navigate('/register/step1');
          return;
        }
      } catch (err) {
        console.error('Error validating referral code:', err);
        // On error, still store the code and redirect to signup
        console.warn('Error validating referral code, but storing for later use:', refCode);
        navigate('/register/step1');
        return;
      } finally {
        setLoading(false);
      }
    };

    validateCode();
  }, [refCode, navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    const toastId = toast.loading('Creating your account...');

    try {
      const response = await authAPI.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        referral_code: refCode
      });

      toast.success('Account created successfully! Check your email to verify.', { id: toastId });
      
      // Redirect to dashboard or verification page
      navigate('/verify-email');
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || 'Registration failed';
      toast.error(errorMessage, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="referral-landing">
        <div className="referral-landing__container">
          <div className="referral-landing__loader">
            <div className="spinner"></div>
            <p>Validating referral link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referral-landing">
        <div className="referral-landing__container">
          <div className="referral-landing__error">
            <i className="ri-error-warning-line"></i>
            <h2>Invalid Referral Link</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/join')} className="btn-primary">
              Sign Up Without Referral
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-landing">
      <div className="referral-landing__container">
        {/* Referrer Info Card */}
        <div className="referrer-card">
          <div className="referrer-card__avatar">
            {referrerInfo?.referrer_name?.charAt(0).toUpperCase() || 'E'}
          </div>
          <div className="referrer-card__content">
            <p className="referrer-card__label">You've been invited by</p>
            <h2 className="referrer-card__name">{referrerInfo?.referrer_name || 'A friend'}</h2>
            <p className="referrer-card__subtitle">to join Eclipseer</p>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="benefits-section">
          <h3>🎁 Join and Get Rewarded!</h3>
          <div className="benefits-list">
            <div className="benefit-item">
              <i className="ri-copper-coin-line"></i>
              <div>
                <strong>50 XP Welcome Bonus</strong>
                <p>Start your journey with free points</p>
              </div>
            </div>
            <div className="benefit-item">
              <i className="ri-check-double-line"></i>
              <div>
                <strong>Verified Referral</strong>
                <p>Trusted recommendation from {referrerInfo?.referrer_name}</p>
              </div>
            </div>
            <div className="benefit-item">
              <i className="ri-star-line"></i>
              <div>
                <strong>Instant Access</strong>
                <p>Start completing surveys & earning rewards</p>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <div className="registration-form">
          <h3>Create Your Account</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">
                <i className="ri-user-line"></i>
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">
                <i className="ri-mail-line"></i>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <i className="ri-lock-line"></i>
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                <i className="ri-lock-line"></i>
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Re-enter your password"
                required
              />
            </div>

            <button type="submit" className="btn-submit">
              <i className="ri-user-add-line"></i>
              Create Account & Claim Bonus
            </button>
          </form>

          <p className="terms-text">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="trust-section">
          <div className="trust-item">
            <i className="ri-shield-check-line"></i>
            <span>Secure & Private</span>
          </div>
          <div className="trust-item">
            <i className="ri-mail-check-line"></i>
            <span>Email Verified</span>
          </div>
          <div className="trust-item">
            <i className="ri-lock-2-line"></i>
            <span>Encrypted Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralLanding;




