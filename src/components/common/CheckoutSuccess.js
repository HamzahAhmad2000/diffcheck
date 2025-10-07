import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { businessAPI } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';
import Sidebar from './Sidebar';
import './StripeCheckout.css';

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const { refreshBusiness } = useBusiness();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }

      try {
        // Get session status from Stripe
        const response = await businessAPI.getStripeSessionStatus(sessionId);
        setSessionData(response.data);

        // Refresh business data to reflect the purchase
        await refreshBusiness();

        // Show success message
        const purchaseType = response.data.metadata?.purchase_type || 'purchase';
        toast.success(`${getPurchaseTypeLabel(purchaseType)} completed successfully!`);

      } catch (error) {
        console.error('[CheckoutSuccess] Error verifying session:', error);
        setError(error.response?.data?.error || 'Failed to verify payment');
        toast.error('Payment verification failed');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId, refreshBusiness]);

  const getPurchaseTypeLabel = (type) => {
    switch (type) {
      case 'subscription':
        return 'Subscription upgrade';
      case 'ai_points':
        return 'AI points purchase';
      case 'responses':
        return 'Response quota purchase';
      case 'quests':
        return 'Quest credits purchase';
      case 'admin_seats':
        return 'Admin seats purchase';
      default:
        return 'Purchase';
    }
  };

  const getSuccessMessage = () => {
    if (!sessionData?.metadata) return 'Your payment has been processed successfully.';

    const { purchase_type, package_name, target_tier_name, points, responses, quest_credits, admin_seats } = sessionData.metadata;

    switch (purchase_type) {
      case 'subscription':
        return `Your business has been upgraded to the ${target_tier_name} plan. You now have access to all the features included in your new subscription tier.`;
      case 'ai_points':
        return `${points} AI points have been added to your business account. You can now use these points for AI-powered features like survey building and insights.`;
      case 'responses':
        return `${responses} additional survey responses have been added to your account. Your surveys can now collect more responses beyond your monthly limit.`;
      case 'quests':
        return `${quest_credits} quest credits have been added to your business account. You can now create and manage more quests for your community.`;
      case 'admin_seats':
        return `${admin_seats} additional admin seats have been added to your business. You can now invite more team members as administrators.`;
      default:
        return 'Your purchase has been completed successfully.';
    }
  };

  const getNextSteps = () => {
    if (!sessionData?.metadata) return [];

    const { purchase_type } = sessionData.metadata;

    switch (purchase_type) {
      case 'subscription':
        return [
          'Explore your new subscription features in the business dashboard',
          'Check your updated monthly limits and quotas',
          'Invite additional team members if your plan includes more admin seats'
        ];
      case 'ai_points':
        return [
          'Try the AI Survey Builder to create intelligent surveys',
          'Use AI Insights to analyze your survey responses',
          'Monitor your AI points usage in the business dashboard'
        ];
      case 'responses':
        return [
          'Your surveys can now collect additional responses',
          'Check your updated response limits in the business dashboard',
          'Continue collecting valuable feedback from your audience'
        ];
      case 'quests':
        return [
          'Create new quests for your community',
          'Manage existing quests with your additional credits',
          'Engage your audience with interactive challenges'
        ];
      case 'admin_seats':
        return [
          'Invite new team members as business administrators',
          'Manage user permissions in the business settings',
          'Collaborate more effectively with your expanded team'
        ];
      default:
        return ['Return to your dashboard to continue using the platform'];
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="main-content">
          <div className="checkout-status-page">
            <div className="checkout-status-icon">
              <i className="ri-loader-4-line spinning"></i>
            </div>
            <h1 className="checkout-status-title">Verifying Payment...</h1>
            <p className="checkout-status-message">
              Please wait while we confirm your payment details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="main-content">
          <div className="checkout-status-page">
            <div className="checkout-status-icon error">
              <i className="ri-error-warning-line"></i>
            </div>
            <h1 className="checkout-status-title">Payment Verification Failed</h1>
            <p className="checkout-status-message">
              {error}
            </p>
            <div className="checkout-status-actions">
              <Link to="/business/dashboard" className="checkout-status-button secondary">
                Return to Dashboard
              </Link>
              <button 
                onClick={() => window.location.reload()} 
                className="checkout-status-button primary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content">
        <div className="checkout-status-page">
          <div className="checkout-status-icon success">
            <i className="ri-check-double-line"></i>
          </div>
          <h1 className="checkout-status-title">Payment Successful!</h1>
          <p className="checkout-status-message">
            {getSuccessMessage()}
          </p>

          {getNextSteps().length > 0 && (
            <div style={{ marginBottom: '30px', textAlign: 'left', maxWidth: '500px' }}>
              <h3 style={{ marginBottom: '12px', color: '#495057' }}>Next Steps:</h3>
              <ul style={{ color: '#6c757d', lineHeight: '1.6' }}>
                {getNextSteps().map((step, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="checkout-status-actions">
            <Link to="/business/dashboard" className="checkout-status-button primary">
              Go to Dashboard
            </Link>
            <Link to="/business/subscription" className="checkout-status-button secondary">
              Manage Subscription
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;

