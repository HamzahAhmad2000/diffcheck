import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import './ReCaptcha.css';

/**
 * Reusable reCAPTCHA component for bot prevention
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onChange - Callback function when CAPTCHA value changes
 * @param {Function} props.onExpired - Callback function when CAPTCHA expires
 * @param {Function} props.onError - Callback function when CAPTCHA encounters an error
 * @param {string} props.theme - Theme for CAPTCHA ('light' or 'dark')
 * @param {string} props.size - Size of CAPTCHA ('normal', 'compact', or 'invisible')
 * @param {string} props.className - Additional CSS classes
 */
const ReCaptcha = forwardRef(({
  onChange,
  onExpired,
  onError,
  theme = 'light',
  size = 'normal',
  className = '',
  ...props
}, ref) => {
  const recaptchaRef = useRef(null);
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    /**
     * Reset the reCAPTCHA widget
     */
    reset: () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    },
    
    /**
     * Get the current reCAPTCHA response value
     * @returns {string|null} The reCAPTCHA response token or null
     */
    getValue: () => {
      if (recaptchaRef.current) {
        return recaptchaRef.current.getValue();
      }
      return null;
    },
    
    /**
     * Execute the reCAPTCHA (for invisible reCAPTCHA)
     */
    execute: () => {
      if (recaptchaRef.current && size === 'invisible') {
        recaptchaRef.current.execute();
      }
    }
  }));

  // Handle CAPTCHA change
  const handleChange = (value) => {
    if (onChange) {
      onChange(value);
    }
  };

  // Handle CAPTCHA expiration
  const handleExpired = () => {
    if (onExpired) {
      onExpired();
    }
  };

  // Handle CAPTCHA error
  const handleError = () => {
    if (onError) {
      onError();
    }
  };

  // Don't render if site key is not configured
  if (!siteKey) {
    console.error('reCAPTCHA site key is not configured. Please set REACT_APP_RECAPTCHA_SITE_KEY in your environment variables.');
    return (
      <div className="recaptcha-error">
        <p>CAPTCHA configuration error. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className={`recaptcha-container ${className}`}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={handleChange}
        onExpired={handleExpired}
        onError={handleError}
        theme={theme}
        size={size}
        {...props}
      />
    </div>
  );
});

ReCaptcha.displayName = 'ReCaptcha';

export default ReCaptcha;

