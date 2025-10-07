import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { businessAPI } from '../../services/apiClient';
import '../../styles/AIChat.css';

const SurveyCreationEntry = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get business context from multiple sources
  const [businessContext, setBusinessContext] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Get user data and role
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    const getBusinessContext = async () => {
      setLoading(true);
      
      // First, try to get from route state (highest priority)
      const stateContext = location.state;
      if (stateContext?.businessId) {
        setBusinessContext({
          businessId: stateContext.businessId,
          businessName: stateContext.businessName,
          source: 'route_state'
        });
        setLoading(false);
        return;
      }

      // Second, try to extract from URL
      const businessMatch = location.pathname.match(/\/admin\/business\/(\d+)/);
      if (businessMatch) {
        try {
          const response = await businessAPI.getDetails(businessMatch[1]);
          setBusinessContext({
            businessId: businessMatch[1],
            businessName: response.data.name,
            source: 'url_extraction'
          });
          setLoading(false);
          return;
        } catch (error) {
          console.error('Failed to fetch business details from URL:', error);
        }
      }

      // Third, for business admin, use their associated business
      if (userRole === 'business_admin' && user.business_id) {
        try {
          const response = await businessAPI.getDetails(user.business_id);
          setBusinessContext({
            businessId: user.business_id,
            businessName: response.data.name,
            source: 'user_association'
          });
          setLoading(false);
          return;
        } catch (error) {
          console.error('Failed to fetch business details for user:', error);
        }
      }

      // No business context found
      setBusinessContext(null);
      setLoading(false);
    };

    getBusinessContext();
  }, [location, userRole, user.business_id]);

  const handleQuickStart = () => {
    // Pass business context to the next step
    navigate('/survey-builder/quick', { 
      state: businessContext ? {
        businessId: businessContext.businessId,
        businessName: businessContext.businessName
      } : undefined
    });
  };

  const handleGuidedStart = () => {
    // Pass business context to the next step
    navigate('/survey-builder/guided', { 
      state: businessContext ? {
        businessId: businessContext.businessId,
        businessName: businessContext.businessName
      } : undefined
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar businessContext={businessContext} />
        <div className="main-content3">
          <div className="loading-container">
            <i className="ri-loader-4-line spinning"></i>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar businessContext={businessContext} />
      <div className="main-content3">
        <div className="survey-entry-container">
          <h1 className="entry-title">
            How Would You Like to Create Your Survey?
            {businessContext && <span> for {businessContext.businessName}</span>}
          </h1>
          <p className="entry-description">
            Choose the method that suits your style and speed. You can start with a quick sentence or take a few guided steps for a fully personalized survey.
            {businessContext && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <strong>Business Context:</strong> This survey will be associated with{' '}
                <strong>{businessContext.businessName}</strong> (ID: {businessContext.businessId})
              </div>
            )}
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
              <button 
                onClick={handleQuickStart}
                className="entry-button"
              >
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
              <button 
                onClick={handleGuidedStart}
                className="entry-button primary"
              >
                Build My Survey
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyCreationEntry;
