import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import { businessAPI, responsePackageAPI } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import BLoading from './ui/BLoading';

const PurchaseResponses = () => {
  const navigate = useNavigate();
  const { business, refreshBusiness } = useBusiness();

  const [packages, setPackages] = useState({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        // Use the Stripe system for response packages (hardcoded system)
        const response = await businessAPI.getResponsePackages();
        setPackages(response.data?.packages || response.packages || {});
      } catch (error) {
        console.error('Error fetching packages:', error);
        toast.error('Failed to load response packages.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async (packageKey) => {
    if (purchasing) return;
    
    const pkg = packages[packageKey];
    if (!pkg) {
      toast.error('Package not found.');
      return;
    }

    setPurchasing(true);
    setSelectedPackage(packageKey);
    
    try {
      // Step 1: Create payment intent
      const paymentResponse = await businessAPI.createResponsePaymentIntent(packageKey);
      
      if (!paymentResponse.data.payment_intent_id) {
        throw new Error('Failed to create payment intent');
      }
      
      const { payment_intent_id } = paymentResponse.data;
      
      // Step 2: Show a toast to indicate processing
      const simulationToast = toast.loading('Processing payment...');
      
      // Step 3: Simulate payment completion (in real implementation, this would be handled by Stripe)
      // For now, we'll directly call the simulation endpoint
      
      try {
        const simulateResponse = await businessAPI.simulateResponsePayment(payment_intent_id);
        
        if (simulateResponse.data) {
          const { responses_added, simulation } = simulateResponse.data;
          
          toast.success(
            `${simulation ? 'Sandbox' : 'Payment'} successful! ${responses_added} responses added to your account.`,
            { id: simulationToast }
          );
          
          // Step 4: Refresh business data to get updated response count
          await refreshBusiness();
          
          // Wait a moment for the context to update
          await new Promise(resolve => setTimeout(resolve, 500));
          navigate('/business-admin/dashboard');
        }
      } catch (simulationError) {
        console.error('Payment simulation failed:', simulationError);
        toast.error(
          simulationError.response?.data?.error || 'Payment simulation failed. Please try again.',
          { id: simulationToast }
        );
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.error || 'Payment failed. Please try again.');
    } finally {
      setPurchasing(false);
      setSelectedPackage(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading response packages..." />
        </div>
      </div>
    );
  }

  const used = business?.monthly_responses_used || 0;
  const limit = (business?.monthly_response_limit || 0) + (business?.responses_purchased || 0);

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page" style={{marginLeft: '300px'}}>
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="chat-title">Purchase Extra Responses</h1>
            <p className="chat-subtitle">
              Current usage: <strong>{used.toLocaleString()} / {limit.toLocaleString()}</strong> responses
            </p>
          </div>
        </div>

        {/* Current Usage Display */}
        {business && (
          <div className="usage-breakdown" style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div className="usage-summary">
              <div className="usage-details">
                <div className="usage-item">
                  <span className="usage-label">Monthly Quota ({business.tier} tier):</span>
                  <span className="usage-value">{business.monthly_response_limit?.toLocaleString() || 0} responses</span>
                </div>
                <div className="usage-item">
                  <span className="usage-label">Extra Responses Purchased:</span>
                  <span className="usage-value">{business.responses_purchased?.toLocaleString() || 0} responses</span>
                </div>
                <div className="usage-item">
                  <span className="usage-label">Used This Month:</span>
                  <span className="usage-value">{used.toLocaleString()} responses</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Packages Grid */}
        <div className="packages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {Object.entries(packages).map(([key, pkg]) => (
            <div key={key} className="admin-card" style={{ padding: '25px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <div className="admin-card-header" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                  {pkg.name}
                </h3>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>{pkg.description}</p>
              </div>
              
              <div className="admin-card-body" style={{ marginBottom: '25px' }}>
                <div className="package-details" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>Responses:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{pkg.responses.toLocaleString()}</span>
                  </div>
                  <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Package:</span>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: '#aa2eff' }}>
                      Available
                    </span>
                  </div>
                  <div className="value-display" style={{ textAlign: 'center', marginTop: '15px', padding: '10px', background: '#f3f4f6', borderRadius: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      Contact sales for pricing details
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-card-actions">
                <button
                  className="newform-button primary"
                  style={{ width: '100%' }}
                  onClick={() => handlePurchase(key)}
                  disabled={purchasing}
                >
                  {purchasing && selectedPackage === key ? (
                    <>
                      <i className="ri-loader-4-line spinning"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="ri-shopping-cart-line"></i>
                      Purchase Package
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-info-card" style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h3>
            <i className="ri-information-line"></i>
            Response Quota System
          </h3>
          <ul className="admin-info-list">
            <li><i className="ri-check-line"></i> Response quota includes both survey responses and AI-generated test responses</li>
            <li><i className="ri-check-line"></i> Your monthly quota resets every billing cycle based on your subscription tier</li>
            <li><i className="ri-check-line"></i> Purchased responses are added on top of your monthly quota</li>
            <li><i className="ri-check-line"></i> Extra responses never expire and carry over month to month</li>
            <li><i className="ri-check-line"></i> Monthly quota is used first, then purchased responses</li>
            <li><i className="ri-check-line"></i> You can purchase additional responses at any time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PurchaseResponses; 