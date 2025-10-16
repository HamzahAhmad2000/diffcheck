import React from 'react';
import CookieConsent from 'react-cookie-consent';

const CookieBanner = () => {
  const handleAccept = () => {
    // Cookie consent is automatically handled by react-cookie-consent
    console.log('Cookies accepted');
  };

  const handleDecline = () => {
    // Cookie consent is automatically handled by react-cookie-consent
    console.log('Cookies declined');
  };

  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept All"
      declineButtonText="Reject Non-Essential"
      cookieName="eclipseer_cookie_consent"
      style={{
        background: "#2B373B",
        color: "#ffffff",
        fontSize: "14px",
        textAlign: "left",
        padding: "20px",
        alignItems: "center"
      }}
      buttonStyle={{
        background: "#4CAF50",
        color: "white",
        fontSize: "14px",
        padding: "10px 20px",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        marginLeft: "10px"
      }}
      declineButtonStyle={{
        background: "#f44336",
        color: "white",
        fontSize: "14px",
        padding: "10px 20px",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
      }}
      expires={365}
      onAccept={handleAccept}
      onDecline={handleDecline}
      enableDeclineButton={true}
      flipButtons={false}
    >
      <div className="cookie-banner-content">
        <p>
          We use cookies to enhance your experience on our platform. Essential cookies are required for basic functionality,
          while non-essential cookies help us improve our services and provide personalized content.
        </p>
        <p>
          By continuing to use our site, you agree to our use of essential cookies. You can manage your cookie preferences
          or learn more about how we use cookies in our{' '}
          <a
            href="/legal#cookies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#4CAF50", textDecoration: "underline" }}
          >
            Cookie Policy
          </a>
          .
        </p>
      </div>
    </CookieConsent>
  );
};

export default CookieBanner;
