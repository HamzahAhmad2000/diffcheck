import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CreateSurvey from './CreateSurvey';
import { businessAPI, surveyAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';

const CreateSurveyForBusiness = () => {
  const { businessId, surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [businessData, setBusinessData] = useState(null);
  const [surveyData, setSurveyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch business data
        const businessResponse = await businessAPI.getDetails(businessId);
        setBusinessData(businessResponse.data);

        // If we're in edit mode, fetch the survey data
        if (surveyId) {
          try {
            const surveyResponse = await surveyAPI.getBusinessSurvey(businessId, surveyId);
            setSurveyData(surveyResponse.data);
          } catch (surveyError) {
            console.error('Error fetching survey:', surveyError);
            toast.error('Failed to load survey data');
            // Don't redirect here, as business data loaded successfully
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        const errorMessage = error.response?.data?.error || 'Failed to fetch required data';
        setError(errorMessage);
        toast.error(errorMessage);
        // Redirect back to business management if business not found
        setTimeout(() => {
          navigate('/admin/business/manage');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    if (businessId) {
      fetchData();
    } else {
      setError('No business ID provided');
      setLoading(false);
    }
  }, [businessId, surveyId, navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px',
        backgroundColor: '#000',
        color: '#fff'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #333',
          borderTop: '4px solid #AA2EFF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h3 style={{ 
          margin: 0, 
          fontFamily: 'Clash Display, sans-serif',
          fontSize: '18px',
          fontWeight: '500'
        }}>
          Loading {surveyId ? 'survey' : 'business'} information...
        </h3>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (error || !businessData) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px',
        backgroundColor: '#000',
        color: '#fff',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2 style={{ 
          margin: 0, 
          color: '#ff4444',
          fontFamily: 'Clash Display, sans-serif',
          fontSize: '24px'
        }}>
          Error Loading {surveyId ? 'Survey' : 'Business'}
        </h2>
        <p style={{ 
          margin: 0, 
          fontSize: '16px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {error || 'Required data not found'}
        </p>
        <p style={{ 
          margin: 0, 
          color: '#888',
          fontSize: '14px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          Redirecting to business management...
        </p>
      </div>
    );
  }

  // Determine if we're in edit mode
  const isEditMode = Boolean(surveyId);

  // Pass the business context and any existing survey data to CreateSurvey
  return (
    <CreateSurvey 
      key={`business-${businessId}-survey-${surveyId || 'new'}`}
      initialState={{
        businessId: parseInt(businessId),
        businessName: businessData.name,
        fromBusinessManagement: true,
        // Pass through AI generation state if it arrived here
        fromAiGeneration: location.state?.fromAiGeneration,
        generatedSurvey: location.state?.generatedSurvey,
        // Pass through edit mode state and survey data
        editMode: isEditMode,
        surveyId: surveyId ? parseInt(surveyId) : undefined,
        existingSurvey: surveyData // Pass the fetched survey data if in edit mode
      }}
    />
  );
};

export default CreateSurveyForBusiness; 