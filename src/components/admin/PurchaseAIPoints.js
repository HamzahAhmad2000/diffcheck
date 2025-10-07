import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import { businessAPI, aiPointsPackageAPI } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import BLoading from './ui/BLoading';

const PurchaseAIPoints = () => {
  const navigate = useNavigate();
  const { business, aiPoints, refreshBusiness } = useBusiness();
  
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        // Use the admin API to get all active AI points packages
        const response = await aiPointsPackageAPI.getAvailablePackages();
        setPackages(response.data?.packages || response.packages || []);
      } catch (error) {
        console.error('Error fetching packages:', error);
        toast.error('Failed to load purchase packages.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async (packageId) => {
    if (purchasing) return;
    
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) {
      toast.error('Package not found.');
      return;
    }

    setPurchasing(true);
    setSelectedPackage(packageId);
    
    try {
      // Step 1: Create payment intent
      const paymentResponse = await businessAPI.createAIPointsPaymentIntent(packageId);
      
      if (!paymentResponse.data.payment_intent_id) {
        throw new Error('Failed to create payment intent');
      }
      
      const { payment_intent_id } = paymentResponse.data;
      
      // Step 2: Show a toast to indicate processing
      const simulationToast = toast.loading('Processing payment...');
      
      // Step 3: Simulate payment completion (in real implementation, this would be handled by Stripe)
      // For now, we'll directly call the simulation endpoint
      
      try {
        const simulateResponse = await businessAPI.simulatePayment(payment_intent_id);
        
        if (simulateResponse.data) {
          const { points_added, simulation } = simulateResponse.data;
          
          toast.success(
            `${simulation ? 'Sandbox' : 'Payment'} successful! ${points_added} AI points added to your account.`,
            { id: simulationToast }
          );
          
          // Step 4: Refresh business data to get updated points
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
          <BLoading variant="page" label="Loading purchase options..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page">
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="chat-title">Purchase AI Points</h1>
            <p className="chat-subtitle">
              Current Balance: <strong>{aiPoints} AI Points</strong>
            </p>
          </div>
        </div>

        {/* Current Usage Display */}
        {business && (
          <div className="points-breakdown" style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div className="points-summary">
              <div className="points-details">
                <div className="points-item">
                  <span className="points-label">Monthly Quota ({business.tier} tier):</span>
                  <span className="points-value">{business.ai_points_monthly || 0} points</span>
                </div>
                <div className="points-item">
                  <span className="points-label">Purchased Points:</span>
                  <span className="points-value">{business.ai_points_purchased || 0} points</span>
                </div>
                {business.days_until_reset !== null && (
                  <div className="points-item">
                    <span className="points-label">Days until monthly reset:</span>
                    <span className="points-value">{business.days_until_reset} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Packages Grid */}
        <div className="packages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {packages
            .filter(pkg => pkg.is_active)
            .sort((a, b) => a.display_order - b.display_order)
            .map((pkg) => (
            <div key={pkg.id} className="admin-card" style={{ padding: '25px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <div className="admin-card-header" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                  {pkg.name}
                  {pkg.is_popular && (
                    <span className="popular-badge" style={{ marginLeft: '10px', padding: '4px 8px', background: '#aa2eff', color: 'white', fontSize: '12px', borderRadius: '4px' }}>
                      Popular
                    </span>
                  )}
                </h3>
                <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>{pkg.description}</p>
              </div>
              
              <div className="admin-card-body" style={{ marginBottom: '25px' }}>
                <div className="package-details" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#6b7280' }}>AI Points:</span>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{pkg.points.toLocaleString()}</span>
                  </div>
                  {pkg.bonus_points > 0 && (
                    <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280' }}>Bonus Points:</span>
                      <span style={{ fontWeight: '600', color: '#059669' }}>+{pkg.bonus_points.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Total:</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                      {(pkg.points + (pkg.bonus_points || 0)).toLocaleString()} points
                    </span>
                  </div>
                  <div className="price-display" style={{ textAlign: 'center', marginTop: '15px' }}>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: '#aa2eff' }}>
                      ${(pkg.price / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-card-actions">
                <button
                  className="newform-button primary"
                  style={{ width: '100%' }}
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing}
                >
                  {purchasing && selectedPackage === pkg.id ? (
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
            AI Points System
          </h3>
          <ul className="admin-info-list">
            <li><i className="ri-check-line"></i> Each AI survey creation costs 1-3 points based on complexity</li>
            <li><i className="ri-check-line"></i> Each AI response generation costs 1 point per response</li>
            <li><i className="ri-check-line"></i> AI insights and analysis cost 1 point per request</li>
            <li><i className="ri-check-line"></i> Purchased points never expire and carry over month to month</li>
            <li><i className="ri-check-line"></i> Monthly quota points reset every billing cycle based on your tier</li>
            <li><i className="ri-check-line"></i> Monthly points are used first, then purchased points</li>
            <li><i className="ri-check-line"></i> Advanced tier: 100 monthly points, Super tier: 200 monthly points</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PurchaseAIPoints; 