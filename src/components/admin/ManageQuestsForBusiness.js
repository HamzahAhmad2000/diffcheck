import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ManageQuests from './ManageQuests';
import { businessAPI } from '../../services/apiClient';
import toast from 'react-hot-toast';
import BLoading from './ui/BLoading';

const ManageQuestsForBusiness = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        setLoading(true);
        
        // Fetch business data
        const businessResponse = await businessAPI.getDetails(businessId);
        setBusinessData(businessResponse.data);
        
      } catch (error) {
        console.error('Error fetching business data:', error);
        const errorMessage = error.response?.data?.error || 'Failed to fetch business data';
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
      fetchBusinessData();
    } else {
      setError('No business ID provided');
      setLoading(false);
    }
  }, [businessId, navigate]);

  if (loading) {
    return <BLoading variant="page" label="Loading business information..." />;
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
          Error Loading Business
        </h2>
        <p style={{ 
          margin: 0, 
          fontSize: '16px',
          fontFamily: 'Poppins, sans-serif'
        }}>
          {error || 'Business data not found'}
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

  // Pass the business context to ManageQuests
  return (
    <ManageQuests 
      key={`business-${businessId}-quests`}
      businessContext={{
        businessId: parseInt(businessId),
        businessName: businessData.name,
        fromBusinessManagement: true
      }}
    />
  );
};

export default ManageQuestsForBusiness; 