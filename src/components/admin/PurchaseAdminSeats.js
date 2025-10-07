import React, { useState, useEffect } from 'react';
import { adminSeatPackageAPI } from '../../services/apiClient';
import './AdminForms.css';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import BLoading from './ui/BLoading';

const PurchaseAdminSeats = ({ onClose, businessId, onPurchaseSuccess }) => {
  const [packages, setPackages] = useState([]);
  const [seatInfo, setSeatInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [packagesResponse, seatInfoResponse] = await Promise.all([
        adminSeatPackageAPI.getAvailablePackages(),
        adminSeatPackageAPI.getBusinessSeatInfo()
      ]);
      
      setPackages(packagesResponse.data?.packages || packagesResponse.packages || []);
      setSeatInfo(seatInfoResponse.data || seatInfoResponse);
    } catch (error) {
      console.error('Error loading admin seat data:', error);
      setError('Failed to load admin seat information');
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

      const result = await adminSeatPackageAPI.purchasePackage(packageData.id, mockPaymentData);
      
      // Handle response structure - result might be wrapped in data property
      const responseData = result.data || result;
      const seatsAdded = responseData.seats_added || packageData.total_seats;
      
      setSuccess(`Successfully purchased ${packageData.name}! Added ${seatsAdded} admin seats.`);
      
      // Reload seat info to reflect new balance
      const updatedSeatInfo = await adminSeatPackageAPI.getBusinessSeatInfo();
      setSeatInfo(updatedSeatInfo.data || updatedSeatInfo);
      
      // Call success callback if provided
      if (onPurchaseSuccess) {
        onPurchaseSuccess(responseData);
      }
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error purchasing admin seat package:', error);
      setError(error.message || 'Failed to purchase admin seat package');
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
          <BLoading variant="page" label="Loading admin seat packages..." />
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
            <h1 className="chat-title">Purchase Admin Seats</h1>
            <p className="chat-subtitle">Buy additional admin seats for your business</p>
          </div>
        </div>

        {error && <div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>}
        {success && <div className="success-message" style={{ marginBottom: '20px' }}>{success}</div>}

        {seatInfo && (
          <div className="seat-usage-info" style={{ marginBottom: '30px' }}>
            <h3 style={{color: '#333'}}>Current Admin Seat Usage</h3>
            <div className="usage-stats">
              <div className="stat-item"><span className="stat-label">Current Admins:</span><span className="stat-value">{seatInfo.current_admin_count}</span></div>
              <div className="stat-item"><span className="stat-label">Tier Seats:</span><span className="stat-value">{seatInfo.tier_seats}</span></div>
              <div className="stat-item"><span className="stat-label">Purchased Seats:</span><span className="stat-value">{seatInfo.purchased_seats}</span></div>
              <div className="stat-item"><span className="stat-label">Total Available:</span><span className="stat-value">{seatInfo.total_seats}</span></div>
              <div className="stat-item"><span className="stat-label">Available Seats:</span><span className={`stat-value ${seatInfo.available_seats <= 0 ? 'low-seats' : ''}`}>{seatInfo.available_seats}</span></div>
            </div>
            {seatInfo.available_seats <= 0 && (
              <div className="warning-message" style={{color: '#333'}}>You have no available admin seats. Purchase more seats to add additional business admins.</div>
            )}
          </div>
        )}

        {packages.length === 0 ? (
          <div className="admin-empty-state">
            <i className="ri-stack-line"></i>
            <h3>No Admin Seat Packages Available</h3>
            <p>Check back later for new admin seat packages.</p>
          </div>
        ) : (
          <div className="packages-grid">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`admin-card ${pkg.is_popular ? 'popular' : ''}`}>
                {pkg.is_popular && <div className="popular-badge">Most Popular</div>}
                
                <div className="package-header">
                  <h3>{pkg.name}</h3>
                  <div className="package-price" style={{fontSize:'22px',fontWeight:700,color:'#aa2eff'}}>Available</div>
                </div>
                
                <div className="package-details">
                  <div className="seats-info">
                    <div className="base-seats">
                      <span className="seats-number">{pkg.seat_count}</span>
                      <span className="seats-label">Admin Seats</span>
                    </div>
                    
                    {pkg.bonus_seats > 0 && (
                      <div className="bonus-seats">
                        <span className="bonus-text">+ {pkg.bonus_seats} Bonus Seats</span>
                      </div>
                    )}
                    
                    <div className="total-seats">
                      <strong>Total: {pkg.total_seats} Seats</strong>
                    </div>
                  </div>
                  
                  {pkg.description && (
                    <div className="package-description">
                      {pkg.description}
                    </div>
                  )}
                  
                  <div className="price-per-seat">
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
          <h4>About Admin Seats</h4>
          <ul>
            <li>Admin seats allow you to create additional business admin accounts</li>
            <li>Each business admin can manage surveys, quests, and business settings</li>
            <li>Purchased seats are permanent and never expire</li>
            <li>You cannot create new admins if you have no available seats</li>
            <li>Admin seats complement your tier's included seats</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PurchaseAdminSeats; 