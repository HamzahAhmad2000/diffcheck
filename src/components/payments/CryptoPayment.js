import React, { useState } from 'react';
import { cryptoAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';

const CryptoPayment = ({ userId, amount, productType, tierType, metadata = {}, onSuccess, onError, onCancel }) => {
  const [loading, setLoading] = useState(false);

  const handleCryptoPayment = async () => {
    setLoading(true);
    try {
      const { data } = await cryptoAPI.createCharge({
        user_id: userId,
        amount,
        product_type: productType,
        tier_type: tierType,
        metadata,
      });

      if (data.hosted_url) {
        toast.success('Redirecting to Coinbase...');
        window.location.href = data.hosted_url;
      } else {
        toast.error('Failed to create crypto payment.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Payment creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <div style={{ 
        padding: 'var(--spacing-lg)', 
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        borderRadius: 'var(--border-radius-md)',
        textAlign: 'center'
      }}>
        <i className="ri-coin-line" style={{ fontSize: '48px', color: '#ffc107', marginBottom: 'var(--spacing-md)' }}></i>
        <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-sm)' }}>
          You will be redirected to Coinbase Commerce to complete your payment with cryptocurrency.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Supported: Bitcoin, Ethereum, USDC, and more
        </p>
      </div>
      
      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            <i className="ri-close-line"></i>
            Cancel
          </button>
        )}
        <button 
          onClick={handleCryptoPayment} 
          disabled={loading}
          className="button button--primary"
        >
          {loading ? (
            <>
              <i className="ri-loader-4-line spinning"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="ri-coin-line"></i>
              Continue to Coinbase
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CryptoPayment;
