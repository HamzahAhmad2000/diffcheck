import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../../services/apiClient';
import '../../../styles/Auth.css';
import '../../../styles/account.css';
import './ForgotPassword.css';
import eclipseerlogo from '../../static/assets/navlogo.png';

const ForgotPasswordPasskey = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [passkey, setPasskey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!email || !passkey) {
      toast.error('Please enter both your email and passkey.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.verifyPasskeyRecovery({ email, passkey });
      toast.success(response.message || 'Passkey verified successfully!');
      if (response.reset_token) {
        navigate(`/reset-password?token=${response.reset_token}`);
      } else {
        toast.error('Verification successful, but reset token was not provided.');
      }
    } catch (err) {
      console.error("Passkey Recovery Error:", err);
      toast.error(err.message || 'Failed to verify passkey. Please ensure it is correct and not yet used.');
    }
    setIsLoading(false);
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <div className="forgot-password-header">
          <img src={eclipseerlogo} alt="Eclipseer Logo" className="forgot-password-logo" />
          <h2 className="forgot-password-title">Reset via Passkey</h2>
          <p className="forgot-password-subtitle">
            Enter your email and one of your single-use passkeys (recovery codes) to proceed.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="forgot-password-input-group">
            <label htmlFor="email" className="forgot-password-label">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="forgot-password-input"
              required
              disabled={isLoading}
            />
          </div>
          <div className="forgot-password-input-group">
            <label htmlFor="passkey" className="forgot-password-label">Passkey</label>
            <input
              type="text"
              id="passkey"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="Enter your passkey"
              className="forgot-password-input"
              required
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className="forgot-password-button"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying Passkey...' : 'Verify Passkey & Proceed'}
          </button>
        </form>

        <div className="forgot-password-footer">
          <button 
            onClick={() => navigate('/forgot-password')} 
            className="forgot-password-back-button"
            disabled={isLoading}
          >
            ← Back to Recovery Options
          </button>
          
          <p className="forgot-password-link">
            Remember your password? <span onClick={() => navigate('/login')}>Sign In</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPasskey; 