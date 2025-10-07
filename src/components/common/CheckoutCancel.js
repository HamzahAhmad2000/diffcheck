import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import './StripeCheckout.css';

const CheckoutCancel = () => {
  const location = useLocation();
  
  // Try to determine what type of purchase was cancelled based on the referrer or URL
  const getPurchaseType = () => {
    const path = location.pathname;
    if (path.includes('subscription')) return 'subscription';
    if (path.includes('ai-points')) return 'AI points';
    if (path.includes('responses')) return 'response quota';
    if (path.includes('quests')) return 'quest credits';
    if (path.includes('admin-seats')) return 'admin seats';
    return 'purchase';
  };

  const getReturnPath = () => {
    const purchaseType = getPurchaseType();
    switch (purchaseType) {
      case 'subscription':
        return '/business/subscription';
      case 'AI points':
        return '/business/purchase-points';
      case 'response quota':
        return '/business/purchase-responses';
      case 'quest credits':
        return '/business/purchase-quest-credits';
      case 'admin seats':
        return '/business/purchase-admin-seats';
      default:
        return '/business/dashboard';
    }
  };

  const purchaseType = getPurchaseType();

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content">
        <div className="checkout-status-page">
          <div className="checkout-status-icon error">
            <i className="ri-close-circle-line"></i>
          </div>
          <h1 className="checkout-status-title">Payment Cancelled</h1>
          <p className="checkout-status-message">
            Your {purchaseType} was cancelled. No charges have been made to your account.
          </p>
          
          <div style={{ marginBottom: '30px', textAlign: 'left', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '12px', color: '#495057' }}>What happened?</h3>
            <ul style={{ color: '#6c757d', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>You cancelled the payment process</li>
              <li style={{ marginBottom: '8px' }}>Your browser session may have timed out</li>
              <li style={{ marginBottom: '8px' }}>There was an issue with the payment form</li>
            </ul>
          </div>

          <div style={{ marginBottom: '30px', textAlign: 'left', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '12px', color: '#495057' }}>Need help?</h3>
            <p style={{ color: '#6c757d', lineHeight: '1.6', marginBottom: '12px' }}>
              If you're experiencing issues with payment or have questions about our pricing:
            </p>
            <ul style={{ color: '#6c757d', lineHeight: '1.6' }}>
              <li style={{ marginBottom: '8px' }}>Check our pricing page for current rates</li>
              <li style={{ marginBottom: '8px' }}>Contact our support team for assistance</li>
              <li style={{ marginBottom: '8px' }}>Try using a different payment method</li>
            </ul>
          </div>

          <div className="checkout-status-actions">
            <Link to={getReturnPath()} className="checkout-status-button primary">
              Try Again
            </Link>
            <Link to="/business/dashboard" className="checkout-status-button secondary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancel;

