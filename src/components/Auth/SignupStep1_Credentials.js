import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/apiClient';
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

  useEffect(() => {
    const existingToken = localStorage.getItem('reg_temp_auth_token');
    if (existingToken) {
      navigate('/register/step2');
    }
  }, [navigate]);

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (stepCompleted) return;
    if (validate()) {
      setIsSubmitting(true);
      try {
        // This should call the backend endpoint that creates the user stub and sends the OTP.
        // We assume the backend returns a temporary token for the registration session.
        const response = await authAPI.initiateRegistrationStep1({
          email,
          password,
          confirmPassword,
        });

        // Store email and temp token to be used in the next step (OTP verification)
        localStorage.setItem('reg_user_email', email);
        localStorage.setItem('reg_temp_auth_token', response.data.tempAuthToken);

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
      } finally {
        setIsSubmitting(false);
      }
    }
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
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms
            </a>{' '}and{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </label>
          {errors.terms && <p className="error-text">{errors.terms}</p>}
        </div>

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