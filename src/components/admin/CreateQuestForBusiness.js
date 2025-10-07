import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CreateQuest from './CreateQuest';
import { businessAPI, questAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';
import BLoading from './ui/BLoading';

const CreateQuestForBusiness = () => {
  const { businessId, questId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [businessData, setBusinessData] = useState(null);
  const [questData, setQuestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch business data
        const businessResponse = await businessAPI.getDetails(businessId);
        setBusinessData(businessResponse.data);

        // If we're in edit mode, fetch the quest data
        if (questId) {
          try {
            const questResponse = await questAPI.getBusinessQuest(businessId, questId);
            setQuestData(questResponse.data.quest);
          } catch (questError) {
            console.error('Error fetching quest:', questError);
            toast.error('Failed to load quest data');
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
  }, [businessId, questId, navigate]);

  if (loading) {
    return <BLoading variant="page" label={`Loading ${questId ? 'quest' : 'business'} information...`} />;
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
          Error Loading {questId ? 'Quest' : 'Business'}
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
  const isEditMode = Boolean(questId);

  // Pass the business context and any existing quest data to CreateQuest
  return (
    <CreateQuest 
      key={`business-${businessId}-quest-${questId || 'new'}`}
      initialState={{
        businessId: parseInt(businessId),
        businessName: businessData.name,
        fromBusinessManagement: true,
        // Pass through edit mode state and quest data
        editMode: isEditMode,
        questId: questId ? parseInt(questId) : undefined,
        existingQuest: questData // Pass the fetched quest data if in edit mode
      }}
    />
  );
};

export default CreateQuestForBusiness; 