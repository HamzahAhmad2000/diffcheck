import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../../services/apiClient'; // Adjusted path
import toast from 'react-hot-toast';
import '../../../styles/Auth.css';
import '../../../styles/account.css';
import './ForgotPassword.css';
import eclipseerlogo from '../../static/assets/navlogo.png'; // Adjust path

const ForgotPasswordEmail = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState(''); // Using toast for errors
  // const [successMessage, setSuccessMessage] = useState(''); // Using toast for success

  const handleSubmit = async (e) => {
    e.preventDefault();
    // setError('');
    // setSuccessMessage('');
    setIsLoading(true);

    if (!email) {
      toast.error('Please enter your email address.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.initiatePasswordResetEmail({ email });
      toast.success(response.message || 'If an account with that email exists, a password reset link has been sent.');
      // Optionally, navigate to a confirmation page or back to login
      // navigate('/login'); 
    } catch (err) {
      console.error("Forgot Password Email Error:", err);
      toast.error(err.message || 'Failed to send password reset email. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <div className="forgot-password-header">
          <img src={eclipseerlogo} alt="Eclipseer Logo" className="forgot-password-logo" />
          <h2 className="forgot-password-title">Recover via Email</h2>
          <p className="forgot-password-subtitle">
            Enter your email address, and we'll send you a link to reset your password.
          </p>
        </div>

        {/* {error && <p className="error-message">{error}</p>} */}
        {/* {successMessage && <p className="success-message">{successMessage}</p>} */}

        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="forgot-password-input-group">
            <label htmlFor="email" className="forgot-password-label">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="you@example.com"
              className="forgot-password-input"
              disabled={isLoading}
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="forgot-password-button"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPasswordEmail; 