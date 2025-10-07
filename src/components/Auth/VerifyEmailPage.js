import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';
import '../../styles/Auth.css';
import '../../styles/account.css';

const VerifyEmailPage = () => {
  const navigate = useNavigate();

  // 1) Local state
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 2) Grab the previously stored email & tempAuthToken
  const email = localStorage.getItem('reg_user_email');
  const tempAuthToken = localStorage.getItem('reg_temp_auth_token');

  useEffect(() => {
    // If either is missing, send the user back to Step 1.
    if (!email || !tempAuthToken) {
      toast.error('Session expired or invalid. Please start from Step 1.');
      navigate('/register/step1');
    }
  }, [email, tempAuthToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otp) {
      setError('Please enter the OTP sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 3) Call the backend endpoint: /auth/verify-otp
      //    Payload: { email, pin: otp }
      //    We assume authAPI.verifyOtp is defined to POST to /auth/verify-otp
      await authAPI.verifyOtp({
        email,
        pin: otp
      });

      // Mark email as verified in localStorage for security
      localStorage.setItem('reg_email_verified', 'true');

      toast.success('Email verified successfully! Redirecting to Step 2...');
      // 4) Navigate to Step 2 after a brief delay so user sees the success message
      setTimeout(() => {
        navigate('/register/step2');
      }, 1500);
    } catch (err) {
      // If the backend responds with 400/404 or other, show its message
      const backendError =
        err.response?.data?.error ||
        err.message ||
        'OTP verification failed. Please try again.';
      setError(backendError);
      toast.error(backendError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await authAPI.resendOtp({ email });
      toast.success('A new OTP has been sent to your email.');
    } catch (resendErr) {
      const msg =
        resendErr.response?.data?.error ||
        resendErr.message ||
        'Failed to resend OTP. Please try again later.';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="auth-container primaryfont" style={{ color: '#eaeaea' }}>
      <div className="auth-form">
        <h2 className="auth-title">Verify Your Email</h2>
        <p className="info-text">
          We have sent a one-time PIN to <strong>{email}</strong>. <br />
          Please enter the 6-digit code below to verify your email.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="otp">One-Time PIN</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.trim())}
              placeholder="Enter 6-digit PIN"
              maxLength={6}
              className={error ? 'input-error' : ''}
              disabled={isSubmitting}
            />
            {error && <p className="error-text">{error}</p>}
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <div className="resend-section">
          <p>
            Didn't get the code?{' '}
            <button
              type="button"
              className="link-button"
              onClick={handleResendOtp}
              disabled={isSubmitting}
            >
              Resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage; 