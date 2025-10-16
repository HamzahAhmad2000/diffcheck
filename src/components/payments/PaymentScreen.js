import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import StripePaymentForm from './StripePaymentForm';
import CryptoPayment from './CryptoPayment';

/**
 * Unified Payment Screen Component
 * Supports multiple payment methods: Stripe (Card), Crypto (Coinbase)
 * 
 * @param {Object} props
 * @param {string} props.productType - Type of product being purchased (season_pass, ai_points, etc.)
 * @param {string} props.productName - Display name of the product
 * @param {number} props.amount - Amount in cents (for Stripe) or dollars (for Crypto)
 * @param {string} props.currency - Currency code (default: USD)
 * @param {Object} props.metadata - Additional metadata for the purchase
 * @param {Function} props.onSuccess - Callback when payment succeeds
 * @param {Function} props.onCancel - Callback when payment is cancelled
 * @param {string} props.tierType - Optional tier type (for season pass)
 */
const PaymentScreen = ({
  productType: propProductType,
  productName: propProductName,
  amount: propAmount,
  currency: propCurrency = 'USD',
  metadata: propMetadata = {},
  onSuccess: propOnSuccess,
  onCancel: propOnCancel,
  tierType: propTierType = null,
  userId: propUserId = null,
  allowCrypto = true,
  initialMethod = 'stripe',
  clientSecret: propClientSecret = null,
  paymentIntentId: propPaymentIntentId = null
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const productType = propProductType || state.productType || 'season_pass';
  const amount = propAmount ?? state.amount ?? 0;
  const currency = (propCurrency || state.currency || 'USD').toUpperCase();
  const tierType = propTierType || state.tierType || null;
  const productName = propProductName || state.productName || (tierType ? `${tierType === 'LUNAR' ? 'Lunar' : 'Totality'} Season Pass` : 'Season Pass');
  const metadata = { ...(state.metadata || {}), ...(propMetadata || {}) };
  const userId = propUserId || state.userId || null;
  const clientSecret = propClientSecret || state.clientSecret || null;
  const paymentIntentId = propPaymentIntentId || state.paymentIntentId || metadata.payment_intent_id || null;

  const [selectedMethod, setSelectedMethod] = useState(state.selectedMethod || initialMethod);
  const [availableMethods, setAvailableMethods] = useState({
    stripe: true,
    crypto: allowCrypto && !!process.env.REACT_APP_COINBASE_ENABLED
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkAvailablePaymentMethods();
  }, []);

  const checkAvailablePaymentMethods = async () => {
    try {
      setAvailableMethods(prev => ({
        ...prev,
        stripe: true,
        crypto: allowCrypto && !!process.env.REACT_APP_COINBASE_ENABLED
      }));
    } catch (error) {
      console.error('Error checking payment methods:', error);
    }
  };

  const formatAmount = (amountInCents) => {
    const dollars = amountInCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(dollars);
  };

  const handlePaymentSuccess = (paymentData) => {
    toast.success('Payment successful!');
    if (propOnSuccess) {
      propOnSuccess(paymentData);
      return;
    }

    if (state.onSuccessRedirect) {
      navigate(state.onSuccessRedirect);
      return;
    }

    // Default fallback
    if (productType === 'season_pass') {
      navigate('/user/season-pass/rewards', { replace: true });
    }
  };

  const handlePaymentError = (error) => {
    toast.error(error.message || 'Payment failed. Please try again.');
  };

  const handleCancel = () => {
    if (propOnCancel) {
      propOnCancel();
      return;
    }

    if (state.onCancelRedirect) {
      navigate(state.onCancelRedirect);
      return;
    }

    navigate(-1);
  };

  const content = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
      backdropFilter: 'blur(8px)'
    }}>
      <div className="form-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="form-card__header">
          <div className="form-card__icon">
            <i className="ri-secure-payment-line"></i>
          </div>
          <div className="form-card__title">
            <h2>Complete Your Purchase</h2>
            <p>Secure checkout powered by Stripe</p>
          </div>
          <button 
            onClick={handleCancel} 
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 'auto'
            }}
          >
            ×
          </button>
        </div>

        {/* Order Summary */}
        <div style={{ padding: 'var(--spacing-lg)', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ 
            fontFamily: 'var(--font-primary)', 
            fontSize: '18px', 
            fontWeight: 600, 
            color: 'var(--color-text-light)',
            marginBottom: 'var(--spacing-md)'
          }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-light)' }}>{productName}</span>
            <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>{formatAmount(amount)}</span>
          </div>
          {tierType && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <span>Tier:</span>
              <span style={{ 
                backgroundColor: 'var(--color-primary)', 
                color: '#fff', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '12px'
              }}>{tierType}</span>
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: 'var(--spacing-md)', 
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid var(--color-border)',
            fontSize: '18px',
            fontWeight: 700
          }}>
            <span style={{ color: 'var(--color-text-light)' }}>Total</span>
            <span style={{ color: 'var(--color-primary)' }}>{formatAmount(amount)}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        {availableMethods.crypto && (
          <div style={{ padding: 'var(--spacing-lg)', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ 
              fontFamily: 'var(--font-primary)', 
              fontSize: '18px', 
              fontWeight: 600, 
              color: 'var(--color-text-light)',
              marginBottom: 'var(--spacing-md)'
            }}>Select Payment Method</h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              {availableMethods.stripe && (
                <button
                  className="button"
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-md)',
                    backgroundColor: selectedMethod === 'stripe' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                    color: 'var(--color-text-light)',
                    border: selectedMethod === 'stripe' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedMethod('stripe')}
                >
                  <i className="ri-bank-card-line" style={{ fontSize: '24px' }}></i>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>Card</span>
                </button>
              )}

              {availableMethods.crypto && (
                <button
                  className="button"
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-md)',
                    backgroundColor: selectedMethod === 'crypto' ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                    color: 'var(--color-text-light)',
                    border: selectedMethod === 'crypto' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedMethod('crypto')}
                >
                  <i className="ri-coin-line" style={{ fontSize: '24px' }}></i>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>Crypto</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Payment Form */}
        <div style={{ padding: 'var(--spacing-lg)' }}>
          {selectedMethod === 'stripe' && (
            <StripePaymentForm
              amount={amount}
              currency={currency}
              productType={productType}
              productName={productName}
              metadata={metadata}
              tierType={tierType}
              isUpgrade={state.isUpgrade || false}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={null}
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId}
            />
          )}

          {selectedMethod === 'crypto' && (
            <CryptoPayment
              userId={userId}
              amount={amount / 100}
              productType={productType}
              tierType={tierType}
              metadata={metadata}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={null}
            />
          )}
        </div>

        {/* Security Badge */}
        <div style={{ 
          padding: 'var(--spacing-md)', 
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          justifyContent: 'center'
        }}>
          <i className="ri-shield-check-line" style={{ fontSize: '24px', color: '#4caf50' }}></i>
          <div>
            <strong style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>Secure Payment</strong>
            <br />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Your payment information is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PaymentScreen;

