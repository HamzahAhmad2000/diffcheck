import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';

/**
 * CheckoutSuccess Component
 * 
 * Handles successful Stripe payment redirects.
 * This component:
 * 1. Receives session_id from Stripe redirect
 * 2. Calls backend to fulfill the purchase (eager sync)
 * 3. Redirects user to appropriate destination
 * 
 * Used for:
 * - Season Pass purchases
 * - Business purchases (AI Points, Responses, Quests, Admin Seats)
 * - Subscription tier purchases
 */
const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const processSuccess = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        const redirect = searchParams.get('redirect') || '/user/home';

        if (!sessionId) {
          throw new Error('No session ID provided');
        }

        // Get auth token
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Authentication required');
          navigate('/login');
          return;
        }

        // Call backend success endpoint for eager fulfillment
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        
        const response = await axios.get(
          `${API_BASE_URL}/api/stripe/success`,
          {
            params: {
              session_id: sessionId,
              redirect: redirect
            },
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success) {
          toast.success(response.data.message || 'Payment successful!');
          
          // Small delay to let user see success message
          setTimeout(() => {
            navigate(redirect);
          }, 1500);
        } else {
          throw new Error(response.data.error || 'Failed to process payment');
        }

      } catch (error) {
        console.error('Payment processing error:', error);
        setError(error.response?.data?.error || error.message || 'Failed to process payment');
        toast.error('Payment processing failed. Please contact support.');
        setProcessing(false);
      }
    };

    processSuccess();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '500px',
          padding: '40px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ color: '#d32f2f', marginBottom: '10px' }}>Payment Processing Error</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => navigate('/user/home')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '500px',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div className="spinner" style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }} />
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Processing Payment</h2>
        <p style={{ color: '#666' }}>Please wait while we confirm your payment...</p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CheckoutSuccess;







