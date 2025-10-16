import React, { useState, useEffect } from 'react';
import { authAPI } from '../../services/apiClient';
import toast from '../../utils/toast';
import '../../styles/LegalComponents.css';

const AIUsageNotice = ({ showModal = false, onModalAccepted }) => {
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (showModal) {
      setShowFirstTimeModal(true);
    }
  }, [showModal]);

  const handleAcceptPolicy = async () => {
    if (!hasAccepted) return;

    setIsSubmitting(true);
    try {
      const response = await authAPI.acceptAIPolicy();
      if (response.data) {
        toast.success('AI policy accepted successfully!');
        setShowFirstTimeModal(false);
        if (onModalAccepted) {
          onModalAccepted();
        }
      }
    } catch (error) {
      console.error('Error accepting AI policy:', error);
      toast.error('Failed to accept AI policy. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentClick = () => {
    window.open('/legal#ai', '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Notice Banner */}
      <div className="ai-usage-notice">
        <div className="ai-notice-content">
          <span className="ai-warning-icon">⚠️</span>
          <span className="ai-notice-text">
            This feature uses AI. Results may be inaccurate or biased. Review before use. By continuing, you agree to the{' '}
            <button
              type="button"
              className="ai-policy-link"
              onClick={handleDocumentClick}
            >
              AI Use Policy
            </button>
            .
          </span>
        </div>
      </div>

      {/* First-Time Modal */}
      {showFirstTimeModal && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="ai-modal-header">
              <h3>AI Feature Usage Notice</h3>
            </div>

            <div className="ai-modal-body">
              <div className="ai-modal-warning">
                <span className="ai-modal-icon">⚠️</span>
                <p><strong>Important:</strong> This feature uses artificial intelligence technology.</p>
              </div>

              <div className="ai-modal-info">
                <p>Please be aware that:</p>
                <ul>
                  <li>AI-generated content may contain inaccuracies or biases</li>
                  <li>Results should be reviewed and verified before use</li>
                  <li>The AI Use Policy outlines our terms for AI feature usage</li>
                </ul>
              </div>

              <div className="ai-modal-checkbox">
                <label className="ai-acceptance-label">
                  <input
                    type="checkbox"
                    checked={hasAccepted}
                    onChange={(e) => setHasAccepted(e.target.checked)}
                    className="ai-acceptance-checkbox"
                  />
                  <span className="ai-acceptance-text">
                    I have read and accept the{' '}
                    <button
                      type="button"
                      className="ai-policy-link-inline"
                      onClick={handleDocumentClick}
                    >
                      AI Use Policy
                    </button>
                  </span>
                </label>
              </div>
            </div>

            <div className="ai-modal-footer">
              <button
                className={`ai-modal-accept-button ${hasAccepted ? 'enabled' : 'disabled'}`}
                onClick={handleAcceptPolicy}
                disabled={!hasAccepted || isSubmitting}
              >
                {isSubmitting ? 'Accepting...' : 'Accept & Continue'}
              </button>
              {!hasAccepted && (
                <p className="ai-modal-hint">
                  Please review and accept the AI Use Policy to continue.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIUsageNotice;
