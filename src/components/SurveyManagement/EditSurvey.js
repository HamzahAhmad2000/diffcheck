import React from 'react';
import { useNavigate } from 'react-router-dom';

const EditSurvey = ({ surveyId }) => {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Navigate to CreateSurvey with surveyId as state
    navigate('/create-survey', { 
      state: { 
        editMode: true,
        surveyId: surveyId 
      }
    });
  }, [surveyId, navigate]);

  return null; // Component will redirect immediately
};

export default EditSurvey;