import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

/**
 * CheckoutCancel Component
 * 
 * Handles canceled Stripe payment redirects.
 * This component displays a message when user cancels payment
 * and provides options to retry or return to the app.
 * 
 * Used for:
 * - Season Pass purchases
 * - Business purchases (AI Points, Responses, Quests, Admin Seats)
 * - Subscription tier purchases
 */
const CheckoutCancel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Show cancellation toast
    toast.error('Payment was canceled');

    // Get redirect destination or default to home
    const redirect = searchParams.get('redirect') || '/user/home';
    const retryUrl = searchParams.get('retry');

    // Countdown timer for auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(redirect);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, searchParams]);

  const handleRetry = () => {
    const retryUrl = searchParams.get('retry');
    if (retryUrl) {
      navigate(retryUrl);
    } else {
      // Default retry location based on user role
      const userRole = localStorage.getItem('userRole');
      if (userRole === 'business_admin') {
        navigate('/business-admin/dashboard');
      } else {
        navigate('/user/home');
      }
    }
  };

  const handleGoHome = () => {
    const redirect = searchParams.get('redirect') || '/user/home';
    navigate(redirect);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        maxWidth: '500px',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          fontSize: '64px', 
          marginBottom: '20px',
          filter: 'grayscale(100%)'
        }}>
          💳
        </div>
        
        <h2 style={{ 
          color: '#333', 
          marginBottom: '10px',
          fontSize: '24px'
        }}>
          Payment Canceled
        </h2>
        
        <p style={{ 
          color: '#666', 
          marginBottom: '30px',
          lineHeight: '1.6'
        }}>
          Your payment was not processed. No charges were made to your account.
        </p>

        <div style={{
          display: 'flex',
          gap: '10px',
          flexDirection: 'column',
          marginBottom: '20px'
        }}>
          <button
            onClick={handleRetry}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            Try Again
          </button>
          
          <button
            onClick={handleGoHome}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#007bff',
              border: '2px solid #007bff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#007bff';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#007bff';
            }}
          >
            Return to Home
          </button>
        </div>

        <p style={{ 
          color: '#999', 
          fontSize: '14px',
          marginTop: '20px'
        }}>
          Redirecting in {countdown} seconds...
        </p>
      </div>
    </div>
  );
};

export default CheckoutCancel;




