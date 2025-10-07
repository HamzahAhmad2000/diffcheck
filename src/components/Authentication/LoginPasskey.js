import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Auth.css';
import '../../styles/account.css';
import eclipseerlogo from '../static/assets/navlogo.png';
import { authAPI } from '../../services/apiClient';

const LoginPasskey = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !passkey) {
      setError('Please enter both email and passkey');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.loginWithPasskey({ email, passkey });
      const data = response.data;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userRole', data.role);

      if (data.role === 'super_admin' || data.role === 'admin') {
        navigate('/admin');
      } else if (data.role === 'business_admin') {
        navigate('/business-admin/dashboard');
      } else {
        navigate('/user/home');
      }
    } catch (err) {
      console.error('Passkey Login Error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to login with passkey');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <div className="forgot-password-header">
          <img src={eclipseerlogo} alt="Eclipseer Logo" className="forgot-password-logo" />
          <h2 className="forgot-password-title">Sign In with Passkey</h2>
          <p className="forgot-password-subtitle">
            Use one of your single-use passkeys to access your account.
          </p>
        </div>
        {error && <div className="forgot-password-error">{error}</div>}
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
              disabled={isLoading}
              required
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
              disabled={isLoading}
              required
            />
          </div>
          <button type="submit" className="forgot-password-button" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <div className="forgot-password-footer">
          <button onClick={() => navigate('/login')} className="forgot-password-back-button" disabled={isLoading}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPasskey;
