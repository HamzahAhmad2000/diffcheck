import React, { useState, useEffect } from 'react';
import { questVerificationAPI, baseURL } from '../../services/apiClient';
import './AdminTables.css';
import './AdminLayout.css';
import './BusinessSpecificDashboard.css';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';

const QuestVerificationDashboard = ({ businessId, onClose }) => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const perPage = 20;

  useEffect(() => {
    if (businessId) {
      loadVerifications();
    }
  }, [businessId]);

  const loadVerifications = async () => {
    try {
      setLoading(true);
      
      // Ensure we have a valid business ID
      if (!businessId) {
        setError('Business ID is required');
        return;
      }
      
      const response = await questVerificationAPI.getPendingVerifications(businessId);
      const apiData = response?.data || response; // support both axios and fetch-like shapes
      const verifications = apiData.pending_verifications || apiData.data?.pending_verifications || [];

      // Server already filters by business; do not over-filter client-side
      setVerifications(verifications);
      setTotalCount(verifications.length);
    } catch (error) {
      console.error('Error loading verifications:', error);
      setError('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (completionId, decision) => {
    try {
      await questVerificationAPI.verifyQuestCompletion(completionId, decision, reviewNotes || '');
      setSuccess(`Quest ${decision.toLowerCase()} successfully!`);
      loadVerifications(); // Reload
    } catch (error) {
      setError(`Failed to ${decision.toLowerCase()} quest`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatProofData = (verification) => {
    if (!verification.proof_submitted) {
      return verification.link_clicked ? 'Link clicked' : 'No proof submitted';
    }
    
    const proofTypes = [];
    if (verification.proof_type) {
      proofTypes.push(verification.proof_type);
    }
    if (verification.link_clicked) {
      proofTypes.push('Link clicked');
    }
    
    return proofTypes.join(', ') || 'Proof submitted';
  };

  const renderProofDetails = (verification) => {
    return (
      <div className="proof-details">
        <div className="proof-section">
          <h4>Proof Information</h4>
          <div className="proof-item">
            <label>Submission Type:</label>
            <span>{formatProofData(verification)}</span>
          </div>
          
          {verification.proof_text && (
            <div className="proof-item">
              <label>User Description:</label>
              <div className="proof-text">{verification.proof_text}</div>
            </div>
          )}
          
          {verification.link_clicked && verification.link_click_timestamp && (
            <div className="proof-item">
              <label>Link Clicked At:</label>
              <span>{formatDate(verification.link_click_timestamp)}</span>
            </div>
          )}
          
          {verification.proof_data && verification.proof_data.length > 0 && (
            <div className="proof-item">
              <label>Attached Screenshots:</label>
              <div className="proof-files">
                {verification.proof_data.map((file, index) => (
                  <div key={index} className="proof-file">
                    {file.url ? (
                      <img 
                        src={file.url.startsWith('http') ? file.url : `${baseURL}${file.url}`}
                        alt={file.name || `Screenshot ${index + 1}`}
                        className="screenshot-preview"
                        style={{
                          maxWidth: '200px',
                          maxHeight: '150px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          margin: '5px',
                          cursor: 'pointer'
                        }}
                        onClick={() => window.open(file.url.startsWith('http') ? file.url : `${baseURL}${file.url}`, '_blank')}
                      />
                    ) : (
                      <div className="file-name">
                        {file.name || `File ${index + 1}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="quest-section">
          <h4>Quest Details</h4>
          <div className="quest-item">
            <label>Quest Title:</label>
            <span>{verification.quest?.title || 'Unknown Quest'}</span>
          </div>
          <div className="quest-item">
            <label>XP Reward:</label>
            <span>{verification.quest?.xp_reward || 0} XP</span>
          </div>
          {verification.quest?.target_url && (
            <div className="quest-item">
              <label>Target URL:</label>
              <a href={verification.quest.target_url} target="_blank" rel="noopener noreferrer">
                {verification.quest.target_url}
              </a>
            </div>
          )}
        </div>
        
        <div className="user-section">
          <h4>User Information</h4>
          <div className="user-item">
            <label>Username:</label>
            <span>{verification.user?.username || 'Unknown User'}</span>
          </div>
          <div className="user-item">
            <label>Submitted At:</label>
            <span>{formatDate(verification.completed_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / perPage);

  const renderContent = () => {
    if (loading) {
      return <BLoading variant="page" label="Loading pending verifications..." />;
    }

    return (
      <div className="dashboard-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">
              <i className="ri-clipboard-check-line" aria-hidden="true"></i>
            </div>
            <div className="admin-stat-content">
              <h3>{totalCount}</h3>
              <p>Pending Verifications</p>
            </div>
          </div>
        </div>
        
        {verifications.length === 0 ? (
          <div className="b_admin_styling-card admin-empty-state">
            <i className="ri-checkbox-circle-line"></i>
            <h3>No Pending Verifications</h3>
            <p>All quest completions have been reviewed.</p>
          </div>
        ) : (
          <>
            <div className="verifications-layout">
              {/* Left Panel - Verification List */}
              <div className="verifications-list b_admin_styling-card">
                <h3>Pending Quest Completions</h3>
                {verifications.map((verification) => (
                  <div 
                    key={verification.id} 
                    className={`verification-item ${selectedVerification?.id === verification.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVerification(verification)}
                  >
                    <div className="verification-summary">
                      <div className="quest-title">
                        {verification.quest?.title || 'Unknown Quest'}
                      </div>
                      <div className="user-info">
                        By: {verification.user?.username || verification.user_name || 'Unknown User'}
                      </div>
                      <div className="submission-time">
                        {formatDate(verification.completed_at)}
                      </div>
                      <div className="proof-type">
                        {formatProofData(verification)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Right Panel - Verification Details */}
              <div className="verification-details b_admin_styling-card">
                {selectedVerification ? (
                  <>
                    {renderProofDetails(selectedVerification)}
                    
                    <div className="review-section">
                      <h4>Review Decision</h4>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add review notes (optional)..."
                        className="review-notes"
                        rows={3}
                      />
                      
                      <div className="verification-actions">
                        <BButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerification(selectedVerification.id, 'VERIFIED')}
                          disabled={processingIds.has(selectedVerification.id)}
                        >
                          {processingIds.has(selectedVerification.id) ? 'Approving...' : 'Approve & Award XP'}
                        </BButton>
                        
                        <BButton
                          variant="danger"
                          size="sm"
                          onClick={() => handleVerification(selectedVerification.id, 'REJECTED')}
                          disabled={processingIds.has(selectedVerification.id)}
                        >
                          {processingIds.has(selectedVerification.id) ? 'Rejecting...' : 'Reject'}
                        </BButton>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-selection">
                    <h3>Select a Quest Completion</h3>
                    <p>Choose a quest completion from the left to review and verify.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  <i className="ri-arrow-left-line"></i> Previous
                </button>
                <span className="page-info">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (onClose) {
    return (
      <div className="modal-overlay">
        <div className="admin-form-container large">
          <div className="admin-form-header">
            <h2>Quest Verification Dashboard</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          {renderContent()}
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
            <h1 className="b_admin_styling-title">Quest Verification Dashboard</h1>
            <p className="chat-subtitle">Review and verify pending quest completions</p>
          </div>
          <BButton 
            variant="primary" 
            size="sm"
            onClick={loadVerifications}
          >
            <i className="ri-refresh-line"></i> Refresh
          </BButton>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default QuestVerificationDashboard; 