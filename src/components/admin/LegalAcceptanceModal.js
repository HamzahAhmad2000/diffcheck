import React, { useState, useEffect } from 'react';
import { authAPI } from '../../services/apiClient';
import toast from '../../utils/toast';
import '../../styles/LegalComponents.css';

const LegalAcceptanceModal = ({ onAccepted, user }) => {
  const [acceptedDocuments, setAcceptedDocuments] = useState({
    terms: false,
    privacy: false,
    cookies: false,
    community: false,
    dpa: false,
    eula: false,
    rewards: false,
    sla: false,
    ai: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const legalDocuments = [
    { key: 'terms', label: 'Terms & Conditions', url: '/legal#terms' },
    { key: 'privacy', label: 'Privacy Policy', url: '/legal#privacy' },
    { key: 'cookies', label: 'Cookie Policy', url: '/legal#cookies' },
    { key: 'community', label: 'Community Guidelines', url: '/legal#community' },
    { key: 'dpa', label: 'Data Processing Agreement (DPA)', url: '/legal#dpa' },
    { key: 'eula', label: 'End User License Agreement (EULA)', url: '/legal#eula' },
    { key: 'rewards', label: 'Reward & Raffle Terms', url: '/legal#rewards' },
    { key: 'sla', label: 'Service Level Agreement (SLA)', url: '/legal#sla' },
    { key: 'ai', label: 'AI Use Policy', url: '/legal#ai' }
  ];

  const allAccepted = Object.values(acceptedDocuments).every(accepted => accepted);

  const handleCheckboxChange = (documentKey) => {
    setAcceptedDocuments(prev => ({
      ...prev,
      [documentKey]: !prev[documentKey]
    }));
  };

  const handleAcceptAll = async () => {
    if (!allAccepted) return;

    setIsSubmitting(true);
    try {
      const response = await authAPI.acceptLegalTerms();
      if (response.data) {
        toast.success('Legal terms accepted successfully!');
        onAccepted();
      }
    } catch (error) {
      console.error('Error accepting legal terms:', error);
      toast.error('Failed to accept legal terms. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentClick = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="legal-modal-overlay">
      <div className="legal-modal-content">
        <div className="legal-modal-header">
          <h2>Welcome to Eclipseer!</h2>
          <p>To continue using our platform, please review and accept our legal documents.</p>
        </div>

        <div className="legal-modal-body">
          <div className="legal-documents-list">
            {legalDocuments.map((doc) => (
              <div key={doc.key} className="legal-document-item">
                <label className="legal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={acceptedDocuments[doc.key]}
                    onChange={() => handleCheckboxChange(doc.key)}
                    className="legal-checkbox"
                  />
                  <span className="legal-checkbox-text">
                    I have read and accept the{' '}
                    <button
                      type="button"
                      className="legal-document-link"
                      onClick={() => handleDocumentClick(doc.url)}
                    >
                      {doc.label}
                    </button>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="legal-modal-footer">
          <button
            className={`legal-accept-button ${allAccepted ? 'enabled' : 'disabled'}`}
            onClick={handleAcceptAll}
            disabled={!allAccepted || isSubmitting}
          >
            {isSubmitting ? 'Accepting...' : 'Accept All & Continue'}
          </button>
          {!allAccepted && (
            <p className="legal-accept-hint">
              Please review and accept all documents to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalAcceptanceModal;
