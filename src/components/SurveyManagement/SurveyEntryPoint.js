import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import '../../styles/AIChat.css';

const SurveyEntryPoint = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    // If business admin, redirect to business-specific survey creation
    if (userRole === 'business_admin' && user.business_id) {
      navigate(`/admin/business/${user.business_id}/surveys/new`, {
        state: { businessId: user.business_id }
      });
    }
  }, [userRole, user.business_id, navigate]);

  const handleQuickStart = () => {
    // For business admin, redirect to business-specific survey creation
    if (userRole === 'business_admin' && user.business_id) {
      navigate(`/admin/business/${user.business_id}/surveys/new`, {
        state: { businessId: user.business_id }
      });
    } else {
      navigate('/ai-survey-builder/quick');
    }
  };

  const handleGuidedStart = () => {
    // For business admin, redirect to business-specific survey creation
    if (userRole === 'business_admin' && user.business_id) {
      navigate(`/admin/business/${user.business_id}/surveys/new`, {
        state: { businessId: user.business_id }
      });
    } else {
      navigate('/ai-survey-builder/guided');
    }
  };

  // If business admin, don't render the entry point UI
  if (userRole === 'business_admin') {
    return <div>Redirecting to business survey creation...</div>;
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content3">
        <div className="survey-entry-container">
          <h1 className="entry-title">How Would You Like to Create Your Survey?</h1>
          <p className="entry-description">
            Choose the method that suits your style and speed. You can start with a quick sentence or take a few guided steps for a fully personalized survey.
          </p>
          
          <div className="entry-options">
            <div className="entry-card">
              <h2>Quick Start — Text to Survey</h2>
              <p className="card-description">
                Type a sentence or two describing what you want to ask. We'll instantly create a draft survey for you to preview and refine.
              </p>
              <ul className="card-bullets">
                <li>Fastest option (under 60 seconds)</li>
                <li>Great for exploring ideas or testing questions</li>
                <li>Less tailored, but helpful for quick validation</li>
              </ul>
              <div className="card-example">
                <span>Example:</span> "I want to ask users about our game's progression pace."
              </div>
              <button onClick={handleQuickStart} className="entry-button">
                Start with a Sentence
              </button>
            </div>

            <div className="entry-card recommended">
              <div className="recommended-badge">Recommended</div>
              <h2>Guided Survey Builder</h2>
              <p className="card-description">
                Answer a few quick questions about your business and what you're exploring. We'll generate a fully customized survey for you.
              </p>
              <ul className="card-bullets">
                <li>Personalized and goal-driven</li>
                <li>Takes under 5 minutes</li>
                <li>Ideal for collecting meaningful, high-quality feedback</li>
              </ul>
              <button onClick={handleGuidedStart} className="entry-button primary">
                Build My Survey
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyEntryPoint;
