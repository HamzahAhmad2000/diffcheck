import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/apiClient';
import ReCaptcha from '../common/ReCaptcha';
import '../../styles/Auth.css';
import '../../styles/account.css';

const SignupStep1Credentials = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    const existingToken = localStorage.getItem('reg_temp_auth_token');
    if (existingToken) {
      navigate('/register/step2');
    }
  }, [navigate]);

  // Check for referrer information and log it for debugging
  useEffect(() => {
    const referralCode = localStorage.getItem('referral_code');
    const referrerInfo = localStorage.getItem('referrer_info');

    if (referralCode) {
      console.log('Referral code found in SignupStep1:', referralCode);
    }
    if (referrerInfo) {
      console.log('Referrer info found in SignupStep1:', JSON.parse(referrerInfo));
    }
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email address is invalid.';
    }
    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!termsAccepted) {
      newErrors.terms = 'You must accept the terms and conditions.';
    }
    // CAPTCHA temporarily disabled - keeping code structure for future use
    // if (!captchaValue) {
    //   newErrors.captcha = 'Please complete the CAPTCHA verification.';
    // }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (stepCompleted) return;
    if (validate()) {
      setIsSubmitting(true);
      try {
        // Get referral code from localStorage if it exists
        const referralCode = localStorage.getItem('referral_code');

        // This should call the backend endpoint that creates the user stub and sends the OTP.
        // We assume the backend returns a temporary token for the registration session.
        const response = await authAPI.initiateRegistrationStep1({
          email,
          password,
          referral_code: referralCode,
          confirmPassword,
          // CAPTCHA temporarily disabled - keeping code structure for future use
          // captchaToken: captchaValue,
        });

        // Store email and temp token to be used in the next step (OTP verification)
        localStorage.setItem('reg_user_email', email);
        localStorage.setItem('reg_temp_auth_token', response.data.tempAuthToken);

        // Clear referral code from localStorage after successful registration initiation
        localStorage.removeItem('referral_code');

        // Registration successful, proceed to next step
        setStepCompleted(true);
        navigate('/verify-email');
      } catch (error) {
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          'Registration failed. Please try again.';
        // Removed toast error notification
        setErrors((prev) => ({ ...prev, server: errorMessage }));
        // Reset CAPTCHA on error - temporarily disabled but keeping code structure
        // if (captchaRef.current) {
        //   captchaRef.current.reset();
        //   setCaptchaValue(null);
        // }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle CAPTCHA change - temporarily disabled but keeping code structure
  const handleCaptchaChange = (value) => {
    setCaptchaValue(value);
    // Clear CAPTCHA error when user completes it
    // if (value && errors.captcha) {
    //   setErrors((prev) => ({ ...prev, captcha: null }));
    // }
  };

  // Handle CAPTCHA expiration - temporarily disabled but keeping code structure
  const handleCaptchaExpired = () => {
    setCaptchaValue(null);
    // setErrors((prev) => ({ ...prev, captcha: 'CAPTCHA has expired. Please complete it again.' }));
  };

  // Handle CAPTCHA error - temporarily disabled but keeping code structure
  const handleCaptchaError = () => {
    setCaptchaValue(null);
    // setErrors((prev) => ({ ...prev, captcha: 'CAPTCHA error occurred. Please try again.' }));
  };

  return (
    <div className="auth-container primaryfont" style={{ color: '#eaeaea' }}>
      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="auth-title">Create Your Account - Step 1</h2>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className={errors.email ? 'input-error' : ''}
            disabled={stepCompleted}
          />
          {errors.email && <p className="error-text">{errors.email}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className={errors.password ? 'input-error' : ''}
            disabled={stepCompleted}
          />
          {errors.password && <p className="error-text">{errors.password}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className={errors.confirmPassword ? 'input-error' : ''}
            disabled={stepCompleted}
          />
          {errors.confirmPassword && (
            <p className="error-text">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="form-group terms-group">
          <input
            type="checkbox"
            id="termsAccepted"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className={errors.terms ? 'input-error' : ''}
            disabled={stepCompleted}
          />
          <label htmlFor="termsAccepted" className="terms-label">
            I confirm I am 16 years of age or older and agree to the{' '}
            <a
              href="/legal#terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms & Conditions
            </a>
            ,{' '}
            <a
              href="/legal#privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            ,{' '}
            <a
              href="/legal#cookies"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cookie Policy
            </a>
            ,{' '}
            <a
              href="/legal#community"
              target="_blank"
              rel="noopener noreferrer"
            >
              Community Guidelines
            </a>
            ,{' '}
            <a
              href="/legal#eula"
              target="_blank"
              rel="noopener noreferrer"
            >
              End User License Agreement (EULA)
            </a>
            , and{' '}
            <a
              href="/legal#rewards"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reward Terms
            </a>
          </label>
          {errors.terms && <p className="error-text">{errors.terms}</p>}
        </div>

        {/* CAPTCHA temporarily disabled - keeping code structure for future use */}
        {/*
        <div className={`form-group ${errors.captcha ? 'captcha-error' : captchaValue ? 'captcha-success' : ''}`}>
          <label htmlFor="captcha">Security Verification *</label>
          <ReCaptcha
            ref={captchaRef}
            onChange={handleCaptchaChange}
            onExpired={handleCaptchaExpired}
            onError={handleCaptchaError}
            theme="light"
            size="normal"
          />
          {errors.captcha && <p className="error-text">{errors.captcha}</p>}
        </div>
        */}

        {errors.server && <p className="error-text">{errors.server}</p>}

        <button
          type="submit"
          className="auth-button"
          disabled={isSubmitting || stepCompleted}
        >
          {isSubmitting
            ? 'Processing...'
            : stepCompleted
            ? 'OTP Sent!'
            : 'Next: Verify Email'}
        </button>
      </form>
    </div>
  );
};

export default SignupStep1Credentials;