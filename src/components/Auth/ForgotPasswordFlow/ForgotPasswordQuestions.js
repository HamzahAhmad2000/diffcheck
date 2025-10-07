import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../../services/apiClient';
import '../../../styles/Auth.css';
import '../../../styles/account.css';
import './ForgotPassword.css';
import eclipseerlogo from '../../static/assets/navlogo.png';

const ForgotPasswordQuestions = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fetchedQuestions, setFetchedQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (!email) {
      toast.error('Please enter your email address.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await authAPI.fetchSecurityQuestionsForEmail({ email });
      if (response.questions && response.questions.length > 0) {
        setFetchedQuestions(response.questions);
        setAnswers(response.questions.map(() => ''));
        setEmailSubmitted(true);
        toast.success('Security questions fetched. Please answer them.');
      } else {
        toast.error(response.message || 'No security questions found for this email, or email does not exist.');
      }
    } catch (err) {
      console.error("Fetch Questions Error:", err);
      toast.error(err.message || 'Failed to fetch security questions.');
    }
    setIsLoading(false);
  };

  const handleAnswerChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleAnswersSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const answersPayload = fetchedQuestions.map((question, index) => ({
      question_id: question.question_id,
      answer: answers[index]
    }));

    if (answersPayload.some(a => !a.answer)) {
      toast.error("Please answer all security questions.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.verifySecurityAnswers({ email, answers: answersPayload });
      toast.success(response.message || 'Answers verified successfully!');
      if (response.reset_token) {
        navigate(`/reset-password?token=${response.reset_token}`);
      } else {
        toast.error('Verification successful, but reset token was not provided.');
      }
    } catch (err) {
      console.error("Verify Answers Error:", err);
      toast.error(err.message || 'Failed to verify answers. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-form">
        <div className="forgot-password-header">
          <img src={eclipseerlogo} alt="Eclipseer Logo" className="forgot-password-logo" />
          <h2 className="forgot-password-title">Recover via Security Questions</h2>
          {!emailSubmitted && (
            <p className="forgot-password-subtitle">
              Enter your email to retrieve your security questions.
            </p>
          )}
        </div>

        {!emailSubmitted ? (
          <form onSubmit={handleEmailSubmit}>
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
            <button 
              type="submit" 
              className="forgot-password-button"
              disabled={isLoading}
            >
              {isLoading ? 'Fetching...' : 'Get Security Questions'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAnswersSubmit} className="security-questions-list">
            {fetchedQuestions.map((question, index) => (
              <div key={index} className="security-question-item">
                <label htmlFor={`answer-${index}`} className="security-question-text">
                  {question.question_text}
                </label>
                <input
                  type="text"
                  id={`answer-${index}`}
                  value={answers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  placeholder={`Answer for question ${index + 1}`}
                  className="forgot-password-input"
                  disabled={isLoading}
                  required
                />
              </div>
            ))}
            <button 
              type="submit" 
              className="forgot-password-button"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Submit Answers'}
            </button>
          </form>
        )}

        <div className="forgot-password-footer">
          {emailSubmitted && (
            <button 
              onClick={() => { setEmailSubmitted(false); setAnswers([]); }} 
              className="forgot-password-back-button"
              disabled={isLoading}
            >
              ← Back to Email Entry
            </button>
          )}
          <button 
            onClick={() => navigate('/forgot-password')} 
            className="forgot-password-back-button"
            style={{ marginLeft: emailSubmitted ? '15px' : '0' }}
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

export default ForgotPasswordQuestions; 