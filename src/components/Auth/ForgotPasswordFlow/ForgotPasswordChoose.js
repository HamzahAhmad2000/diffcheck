import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../styles/Auth.css';
import '../../../styles/account.css';

// You might want to reuse parts of the Login/Signup page layout (e.g., background, logo)
import accountBg from '../../static/assets/account_bg.png'; // Adjust path
import eclipseerlogo from '../../static/assets/navlogo.png'; // Adjust path

const ForgotPasswordChoose = () => {
  const navigate = useNavigate();

  const handleSelection = (method) => {
    switch (method) {
      case 'email':
        navigate('/forgot-password/send-email');
        break;
      case 'questions':
        navigate('/forgot-password/verify-questions');
        break;
      case 'passkey':
        navigate('/forgot-password/verify-passkey');
        break;
      default:
        console.error('Invalid recovery method selected');
    }
  };

  return (
    <div className="auth-container primaryfont">
      <div className="auth-form recovery-form">
        <div className="auth-header">
          <h2 className="auth-title">Forgot Your Password?</h2>
          <p className="auth-subtitle">Choose a method to recover your account</p>
        </div>
        
        <div className="recovery-options">
          <button 
            onClick={() => handleSelection('email')} 
            className="recovery-option"
          >
            <div className="recovery-option__icon">
              <i className="ri-mail-line"></i>
            </div>
            <div className="recovery-option__content">
              <h3>Recover via Email</h3>
              <p>We'll send a recovery link to your registered email address</p>
            </div>
          </button>

          <button 
            onClick={() => handleSelection('questions')} 
            className="recovery-option"
          >
            <div className="recovery-option__icon">
              <i className="ri-question-line"></i>
            </div>
            <div className="recovery-option__content">
              <h3>Answer Security Questions</h3>
              <p>Use your pre-set security questions to verify your identity</p>
            </div>
          </button>

          <button 
            onClick={() => handleSelection('passkey')} 
            className="recovery-option"
          >
            <div className="recovery-option__icon">
              <i className="ri-key-2-line"></i>
            </div>
            <div className="recovery-option__content">
              <h3>Use a Passkey</h3>
              <p>Enter your recovery code to regain access</p>
            </div>
          </button>
        </div>

        <div className="form-footer">
          <button onClick={() => navigate('/login')} className="link-button">
            <i className="ri-arrow-left-line"></i> Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordChoose; 