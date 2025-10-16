import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'react-hot-toast';
import { seasonPassAPI } from '../../services/apiClient';

// Load Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Card element styling
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#cccccc',
      },
    },
    invalid: {
      color: '#ff6b6b',
      iconColor: '#ff6b6b',
    },
  },
  hidePostalCode: false,
};

/**
 * Stripe Payment Form Component (Inner component with Stripe hooks)
 */
const CheckoutForm = ({ 
  amount, 
  currency, 
  productType, 
  productName, 
  metadata, 
  tierType,
  isUpgrade = false,
  onSuccess, 
  onError,
  onCancel,
  clientSecret: providedClientSecret,
  paymentIntentId
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
  });

  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    setError(event.error ? event.error.message : '');
  };

  const handleBillingDetailsChange = (e) => {
    setBillingDetails({
      ...billingDetails,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!cardComplete) {
      setError('Please complete your card details');
      return;
    }

    if (!billingDetails.name || !billingDetails.email) {
      setError('Please fill in all billing details');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      if (!providedClientSecret || !paymentIntentId) {
        throw new Error('Payment is not initialized properly. Please try again.');
      }

      const cardElement = elements.getElement(CardElement);
      const confirmResult = await stripe.confirmCardPayment(providedClientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: billingDetails,
        },
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || 'Failed to confirm card payment');
      }

      setSucceeded(true);
      toast.success('Payment confirmed!');

      if (onSuccess) {
        onSuccess({
          paymentIntentId,
          paymentIntent: confirmResult.paymentIntent,
        });
      }

    } catch (err) {
      console.error('Payment error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Payment failed';
      setError(errorMessage);
      if (onError) {
        onError({ message: errorMessage });
      }
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="business-request-form">
      <div className="form-grid">
        <div className="form-group full-width">
          <label htmlFor="name" className="form-label">
            <i className="ri-user-line"></i>
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            value={billingDetails.name}
            onChange={handleBillingDetailsChange}
            required
            disabled={processing || succeeded}
            className="form-input"
          />
        </div>
        <div className="form-group full-width">
          <label htmlFor="email" className="form-label">
            <i className="ri-mail-line"></i>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="john@example.com"
            value={billingDetails.email}
            onChange={handleBillingDetailsChange}
            required
            disabled={processing || succeeded}
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group full-width" style={{ marginTop: '1rem' }}>
        <label className="form-label">
          <i className="ri-bank-card-line"></i>
          Card Information
        </label>
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
          transition: 'all 0.2s ease'
        }}>
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onChange={handleCardChange}
          />
        </div>
      </div>

      {error && (
        <div className="user-error-message" role="alert" style={{ marginTop: '1rem' }}>
          <p>{error}</p>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: '1.5rem' }}>
        {onCancel && (
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={processing}
          >
            <i className="ri-close-line"></i>
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!stripe || processing || succeeded || !cardComplete || !providedClientSecret || !paymentIntentId}
          className="button button--primary"
        >
          {processing ? (
            <>
              <i className="ri-loader-4-line spinning"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="ri-lock-line"></i>
              Pay {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount / 100)}
            </>
          )}
        </button>
      </div>

      <p style={{ 
        fontSize: '12px', 
        color: 'var(--color-text-muted)', 
        textAlign: 'center', 
        marginTop: '1rem',
        fontStyle: 'italic'
      }}>
        By confirming your payment, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
};

/**
 * Stripe Payment Form Wrapper (with Elements provider)
 */
const StripePaymentForm = (props) => {
  return (
    <Elements
      stripe={stripePromise}
      options={props.clientSecret ? { clientSecret: props.clientSecret } : undefined}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
};

export default StripePaymentForm;

