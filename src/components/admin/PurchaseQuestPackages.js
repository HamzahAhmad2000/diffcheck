import React, { useState, useEffect } from 'react';
import { questPackageAPI } from '../../services/apiClient';
import './AdminForms.css';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import BLoading from './ui/BLoading';

const PurchaseQuestPackages = ({ onClose, businessId, onPurchaseSuccess }) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await questPackageAPI.getAvailablePackages();
      setPackages(response.data?.packages || response.packages || []);
    } catch (error) {
      console.error('Error loading quest packages:', error);
      setError('Failed to load quest packages');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageData) => {
    try {
      setPurchasing(true);
      setError('');
      setSelectedPackage(packageData);

      // In a real implementation, you would integrate with Stripe here
      // For now, we'll simulate a successful payment
      const mockPaymentData = {
        stripe_charge_id: `ch_${Date.now()}_mock`,
        amount_paid: packageData.price
      };

      const result = await questPackageAPI.purchasePackage(packageData.id, mockPaymentData);
      
      setSuccess(`Successfully purchased ${packageData.name}! Added ${result.credits_added} quest credits.`);
      
      // Call success callback if provided
      if (onPurchaseSuccess) {
        onPurchaseSuccess(result);
      }
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error purchasing quest package:', error);
      setError(error.message || 'Failed to purchase quest package');
    } finally {
      setPurchasing(false);
      setSelectedPackage(null);
    }
  };

  // Removed price formatting function as prices are now hidden

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading quest packages..." />
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
            <h1 className="chat-title">Purchase Quest Credits</h1>
            <p className="chat-subtitle">Buy additional quest credits for your business</p>
          </div>
        </div>

        {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}
        {success && <div className="success-message" style={{ marginBottom: '20px' }}>{success}</div>}

        {packages.length === 0 ? (
          <div className="admin-empty-state">
            <i className="ri-stack-line"></i>
            <h3>No Quest Packages Available</h3>
            <p>Check back later for new quest credit packages.</p>
          </div>
        ) : (
          <div className="packages-grid">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`package-card ${pkg.is_popular ? 'popular' : ''}`}>
                {pkg.is_popular && <div className="popular-badge">Most Popular</div>}
                
                <div className="package-header">
                  <h3>{pkg.name}</h3>
                  <div className="package-price">Available</div>
                </div>
                
                <div className="package-details">
                  <div className="credits-info">
                    <div className="base-credits">
                      <span className="credits-number">{pkg.quest_credits}</span>
                      <span className="credits-label">Quest Credits</span>
                    </div>
                    
                    {pkg.bonus_credits > 0 && (
                      <div className="bonus-credits">
                        <span className="bonus-text">+ {pkg.bonus_credits} Bonus Credits</span>
                      </div>
                    )}
                    
                    <div className="total-credits">
                      <strong>Total: {pkg.total_credits} Credits</strong>
                    </div>
                  </div>
                  
                  {pkg.description && (
                    <div className="package-description">
                      {pkg.description}
                    </div>
                  )}
                  
                  <div className="price-per-credit">
                    Contact sales for pricing details
                  </div>
                </div>
                
                <button
                  className={`newform-button primary ${purchasing && selectedPackage?.id === pkg.id ? 'purchasing' : ''}`}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing}
                >
                  {purchasing && selectedPackage?.id === pkg.id ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    'Purchase Package'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="purchase-info">
          <h4 style={{color: '#333'}}>About Quest Credits</h4>
          <ul>
            <li>Quest credits allow you to create custom quests for your business</li>
            <li>Each quest creation consumes 1 credit</li>
            <li>Credits never expire and can be used anytime</li>
            <li>Business admin created quests require super admin approval before publishing</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PurchaseQuestPackages; 