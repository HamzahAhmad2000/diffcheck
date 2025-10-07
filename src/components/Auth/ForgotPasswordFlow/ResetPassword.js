import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../../services/apiClient';
import toast from 'react-hot-toast';
import '../../../styles/Auth.css';
import '../../../styles/account.css';
import './ForgotPassword.css';
import eclipseerlogo from '../../static/assets/navlogo.png';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (resetToken) {
      setToken(resetToken);
      toast.success("You can now set a new password.");
    } else {
      toast.error('Invalid or missing reset token. Please try the recovery process again.');
      navigate('/forgot-password');
    }
  }, [searchParams, navigate]);

  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    return requirements;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!newPassword || !confirmPassword) {
      toast.error('Please enter and confirm your new password.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    const requirements = validatePassword(newPassword);
    if (!Object.values(requirements).every(Boolean)) {
      toast.error('Password does not meet all requirements.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.resetPasswordWithToken({ token, newPassword });
      toast.success(response.message || 'Password has been reset successfully!');
      navigate('/login');
    } catch (err) {
      console.error("Reset Password Error:", err);
      toast.error(err.message || 'Failed to reset password. The token might be invalid or expired.');
    }
    setIsLoading(false);
  };

  const requirements = validatePassword(newPassword);

  if (!token) {
    return null;
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <div className="forgot-password-header">
          <img src={eclipseerlogo} alt="Eclipseer Logo" className="forgot-password-logo" />
          <h2 className="forgot-password-title">Reset Your Password</h2>
          <p className="forgot-password-subtitle">
            Create a new password that meets all the requirements below.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="forgot-password-input-group">
            <label htmlFor="newPassword" className="forgot-password-label">New Password</label>
            <input 
              type="password" 
              id="newPassword" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="Enter new password"
              className="forgot-password-input"
              disabled={isLoading}
              required 
            />
            <ul className="password-requirements">
              <li className={requirements.length ? 'met' : ''}>
                At least 8 characters long
              </li>
              <li className={requirements.uppercase ? 'met' : ''}>
                Contains uppercase letter
              </li>
              <li className={requirements.lowercase ? 'met' : ''}>
                Contains lowercase letter
              </li>
              <li className={requirements.number ? 'met' : ''}>
                Contains number
              </li>
              <li className={requirements.special ? 'met' : ''}>
                Contains special character
              </li>
            </ul>
          </div>

          <div className="forgot-password-input-group">
            <label htmlFor="confirmPassword" className="forgot-password-label">Confirm New Password</label>
            <input 
              type="password" 
              id="confirmPassword" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="Confirm new password"
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
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div className="forgot-password-footer">
          <p className="forgot-password-link">
            Remember your password? <span onClick={() => navigate('/login')}>Sign In</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 