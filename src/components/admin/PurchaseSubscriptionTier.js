import React, { useEffect, useState } from 'react';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import { businessTierAPI, businessAPI } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import BLoading from './ui/BLoading';

const PurchaseSubscriptionTier = () => {
  const { business, refreshBusiness } = useBusiness();

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [requestData, setRequestData] = useState({
    business_name: '',
    email: '',
    message: '',
  });

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const response = await businessTierAPI.getAvailableTiers();
        setTiers(response.data?.tiers || response.tiers || []);
      } catch (error) {
        console.error('[Subscription] Failed to load tiers', error);
        toast.error('Failed to load subscription tiers');
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, []);

  const handlePurchase = async (tier) => {
    if (purchasing) return;
    setPurchasing(true);
    setSelectedTier(tier.id);

    try {
      // Determine if this is an upgrade or downgrade
      const currentTierPrice = business.tier_info?.price || 0;
      const isUpgrade = tier.price > currentTierPrice;
      const isDowngrade = tier.price < currentTierPrice;
      
      if (isDowngrade) {
        // For downgrades, skip payment and directly change tier
        const loadingToast = toast.loading('Updating subscription...');
        
        await businessAPI.changeBusinessTier(business.id, tier.id);
        
        toast.success(`Subscription updated to ${tier.name}`, { id: loadingToast });
        
      } else if (isUpgrade) {
        // For upgrades, use the payment flow
        // 1. Create payment intent
        const intentRes = await businessAPI.createSubscriptionIntent(business.id, tier.id);
        const payment_intent_id = intentRes.data?.payment_intent_id;
        if (!payment_intent_id) throw new Error('Unable to create payment intent');

        const loadingToast = toast.loading('Processing payment...');

        // 2. Simulate payment (sandbox)
        await businessAPI.simulateSubscriptionPayment(payment_intent_id);

        // 3. Change business tier (backend endpoint handles balance updates)
        await businessAPI.changeBusinessTier(business.id, tier.id);

        toast.success(`Subscription updated to ${tier.name}`, { id: loadingToast });
        
      } else {
        // Same tier - no action needed
        toast.info('You are already on this tier');
        return;
      }

      await refreshBusiness();
    } catch (error) {
      console.error('[Subscription] purchase failed', error);
      toast.error(error.response?.data?.error || error.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
      setSelectedTier(null);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      await businessTierAPI.requestCustomTier(requestData);
      toast.success('Request submitted');
      setShowRequest(false);
      setRequestData({ business_name: '', email: '', message: '' });
    } catch (error) {
      console.error('Request failed', error);
      toast.error(error.response?.data?.error || 'Failed to submit request');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading subscription plans..." />
        </div>
      </div>
    );
  }

  // Removed price formatting functions as prices are now hidden

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page" style={{ marginLeft: '300px' }}>
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="chat-title">Subscription Plans</h1>
            <p className="chat-subtitle">Choose the plan that fits your business needs</p>
          </div>
        </div>

        <div className="packages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '20px' }}>
          {tiers.slice(0,3).map((tier) => {
            const businessTierId = business?.tier_id ?? null;
            const isCurrent = businessTierId === tier.id;
            const currentTierPrice = business?.tier_info?.price || 0;
            const isUpgrade = tier.price > currentTierPrice;
            const isDowngrade = tier.price < currentTierPrice;
            
            return (
              <div key={tier.id} className={`admin-card ${tier.is_popular ? 'popular' : ''}`} style={{ padding: '25px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {tier.is_popular && <div className="popular-badge">Most Popular</div>}
                <div className="admin-card-header" style={{ marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>{tier.name}</h3>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#aa2eff' }}>Available</div>
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>Contact sales for pricing</div>
                </div>
                {tier.description && <p style={{ color: '#6b7280', minHeight: '60px' }}>{tier.description}</p>}

                <ul className="admin-info-list" style={{ marginTop: '15px' }}>
                  <li><i className="ri-check-line"></i> {tier.monthly_response_limit === -1 ? 'Unlimited' : tier.monthly_response_limit.toLocaleString()} responses / month</li>
                  <li><i className="ri-check-line"></i> {tier.monthly_quest_limit === -1 ? 'Unlimited' : tier.monthly_quest_limit} quests / month</li>
                  <li><i className="ri-check-line"></i> {tier.admin_seat_limit === -1 ? 'Unlimited' : `${tier.admin_seat_limit}`} admin seats</li>
                  {tier.ai_points_included > 0 && <li><i className="ri-check-line"></i> {tier.ai_points_included} AI points / month</li>}
                  {tier.can_use_ai_builder || tier.can_use_ai_insights ? <li><i className="ri-check-line"></i> AI Tools Access</li> : null}
                </ul>

                <button
                  className={`newform-button primary ${isCurrent ? 'disabled' : ''}`}
                  style={{ width: '100%', marginTop: '20px' }}
                  disabled={isCurrent || purchasing}
                  onClick={() => handlePurchase(tier)}
                >
                  {isCurrent ? 'Current Plan' : 
                   selectedTier === tier.id && purchasing ? 'Processing...' : 
                   isUpgrade ? 'Upgrade' : 
                   isDowngrade ? 'Downgrade' : 'Choose Plan'}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
        
        </div>
        {showRequest && (
          <div className="modal-backdrop" onClick={() => setShowRequest(false)}>
            <div className="modal-content admin-form" onClick={e => e.stopPropagation()} style={{maxWidth:'500px'}}>
              <div className="modal-header">
                <h2 className="chat-title" style={{fontSize:'22px'}}>Request Custom Plan</h2>
                <button className="close-button" onClick={() => setShowRequest(false)}><i className="ri-close-line"></i></button>
              </div>
              <form onSubmit={handleRequestSubmit} className="admin-form">
                <div className="admin-form-group">
                  <label className="admin-form-label">Business Name</label>
                  <input className="admin-form-input" type="text" value={requestData.business_name} onChange={e=>setRequestData({...requestData,business_name:e.target.value})} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Email*</label>
                  <input className="admin-form-input" type="email" value={requestData.email} onChange={e=>setRequestData({...requestData,email:e.target.value})} required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Message</label>
                  <textarea className="admin-form-textarea" rows="4" value={requestData.message} onChange={e=>setRequestData({...requestData,message:e.target.value})}></textarea>
                </div>
                <button className="newform-button primary" type="submit" style={{marginTop:'10px'}}>Submit Request</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseSubscriptionTier; 
