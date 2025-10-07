import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { businessAPI } from '../../services/apiClient';
import './StripeCheckout.css';

/**
 * Universal Stripe Checkout Component
 * Handles all types of purchases: subscriptions, AI points, responses, quests, admin seats
 */
const StripeCheckout = ({ 
  type, 
  item, 
  onSuccess, 
  onCancel, 
  disabled = false,
  buttonText,
  buttonClassName = "stripe-checkout-button",
  showPricing = true,
  businessId = null
}) => {
  const [loading, setLoading] = useState(false);

  const formatPrice = (priceInCents) => {
    if (priceInCents === 0) return 'Free';
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const getCheckoutData = () => {
    const baseData = {
      type,
      business_id: businessId
    };

    switch (type) {
      case 'subscription':
        return {
          ...baseData,
          tier_id: item.id
        };
      case 'ai_points':
        return {
          ...baseData,
          package_id: item.id
        };
      case 'responses':
        return {
          ...baseData,
          package_key: item.key || item.id
        };
      case 'quests':
        return {
          ...baseData,
          package_id: item.id
        };
      case 'admin_seats':
        return {
          ...baseData,
          package_id: item.id
        };
      default:
        throw new Error(`Unsupported checkout type: ${type}`);
    }
  };

  const getItemDisplayInfo = () => {
    switch (type) {
      case 'subscription':
        return {
          name: item.name,
          description: item.description,
          price: item.price,
          features: [
            `${item.monthly_response_limit === -1 ? 'Unlimited' : item.monthly_response_limit.toLocaleString()} responses/month`,
            `${item.monthly_quest_limit === -1 ? 'Unlimited' : item.monthly_quest_limit} quests/month`,
            `${item.admin_seat_limit === -1 ? 'Unlimited' : item.admin_seat_limit} admin seats`,
            ...(item.ai_points_included > 0 ? [`${item.ai_points_included} AI points/month`] : [])
          ]
        };
      case 'ai_points':
        return {
          name: item.name,
          description: `${item.total_points || item.points} AI points`,
          price: item.price,
          features: [
            `${item.total_points || item.points} AI points`,
            ...(item.bonus_points ? [`${item.bonus_points} bonus points`] : [])
          ]
        };
      case 'responses':
        return {
          name: item.name,
          description: `${item.responses} additional survey responses`,
          price: item.price,
          features: [`${item.responses} survey responses`]
        };
      case 'quests':
        return {
          name: item.name,
          description: `${item.total_credits || item.credits} quest credits`,
          price: item.price,
          features: [
            `${item.credits} quest credits`,
            ...(item.bonus_credits ? [`${item.bonus_credits} bonus credits`] : [])
          ]
        };
      case 'admin_seats':
        return {
          name: item.name,
          description: `${item.total_seats || item.seats} additional admin seats`,
          price: item.price,
          features: [
            `${item.seat_count} admin seats`,
            ...(item.bonus_seats ? [`${item.bonus_seats} bonus seats`] : [])
          ]
        };
      default:
        return {
          name: 'Unknown Item',
          description: '',
          price: 0,
          features: []
        };
    }
  };

  const handleCheckout = async () => {
    if (loading || disabled) return;
    
    setLoading(true);
    const loadingToast = toast.loading('Creating checkout session...');

    try {
      const checkoutData = getCheckoutData();
      
      // Create Stripe Checkout session
      const response = await businessAPI.createStripeCheckoutSession(checkoutData);
      
      if (response.data?.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('[StripeCheckout] Error:', error);
      toast.error(
        error.response?.data?.error || 
        error.message || 
        'Failed to create checkout session',
        { id: loadingToast }
      );
      setLoading(false);
    }
  };

  const displayInfo = getItemDisplayInfo();

  return (
    <div className="stripe-checkout-container">
      {showPricing && (
        <div className="checkout-item-info">
          <h3 className="item-name">{displayInfo.name}</h3>
          {displayInfo.description && (
            <p className="item-description">{displayInfo.description}</p>
          )}
          <div className="item-price">{formatPrice(displayInfo.price)}</div>
          {displayInfo.features.length > 0 && (
            <ul className="item-features">
              {displayInfo.features.map((feature, index) => (
                <li key={index}>
                  <i className="ri-check-line"></i>
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      <button
        className={`${buttonClassName} ${loading ? 'loading' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleCheckout}
        disabled={loading || disabled}
      >
        {loading ? (
          <>
            <i className="ri-loader-4-line spinning"></i>
            Processing...
          </>
        ) : (
          buttonText || `Purchase ${displayInfo.name}`
        )}
      </button>
    </div>
  );
};

export default StripeCheckout;

