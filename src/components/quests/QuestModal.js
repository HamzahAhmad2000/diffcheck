import React, { useState, useEffect } from 'react';
import './QuestModal.css';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';
import { questAPI, uploadAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';

const QuestModal = ({ quest, questType, isCompleted, onClose, onComplete, user }) => {
  const [completing, setCompleting] = useState(false);
  const [linkClicked, setLinkClicked] = useState(false);
  const [verificationData, setVerificationData] = useState({
    screenshot: null,
    notes: '',
    url_visited: '',
    link_clicked: false
  });
  const [showScreenshotFlow, setShowScreenshotFlow] = useState(false);
  const [screenshotStep, setScreenshotStep] = useState(1); // 1: visit link, 2: upload screenshot

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = () => {
    if (!quest.end_date) return false;
    return new Date(quest.end_date) < new Date();
  };

  const isNotStarted = () => {
    if (!quest.start_date) return false;
    return new Date(quest.start_date) > new Date();
  };

  const canComplete = () => {
    return user && !isCompleted && !isExpired() && !isNotStarted();
  };

  const handleQuestComplete = async () => {
    if (!canComplete() || !onComplete) return;

    // Check if quest requires link click but user hasn't clicked it
    if (quest.target_url && quest.verification_method === 'CLICK_VERIFY' && !linkClicked) {
      alert('Please visit the target link first before claiming your reward!');
      return;
    }

    setCompleting(true);
    try {
      const result = await onComplete({
        ...verificationData,
        link_clicked: linkClicked,
        // Ensure we're always sending the current link click status
        quest_id: quest.id,
        user_clicked_link: linkClicked
      });
      if (result.success) {
        // Modal will close automatically when quest state updates
      }
    } catch (error) {
      console.error('Error completing quest:', error);
    } finally {
      setCompleting(false);
    }
  };

  const handleQuestAction = async () => {
    if (isCompleted) return;
    
    // For screenshot verification quests, show the two-step flow
    if (quest.verification_method === 'SCREENSHOT_VERIFY') {
      setShowScreenshotFlow(true);
      return;
    }
    
    // For open link quests (formerly click to verify)
    if (quest.verification_method === 'CLICK_VERIFY') {
      if (quest.target_url && !linkClicked) {
        // Track link click and open URL
        try {
          await questAPI.trackLinkClick(quest.id);
          setLinkClicked(true);
          setVerificationData(prev => ({ ...prev, link_clicked: true }));
          window.open(quest.target_url, '_blank');
        } catch (error) {
          console.error('Error tracking link click:', error);
          window.open(quest.target_url, '_blank');
        }
        return;
      } else if (linkClicked) {
        // User has clicked link, now they can claim
        await handleQuestComplete();
        return;
      }
    }
    
    // For other verification methods, complete directly
    await handleQuestComplete();
  };

  const handleScreenshotStepAction = async () => {
    if (screenshotStep === 1) {
      // Step 1: Visit the link
      if (quest.target_url) {
        try {
          await questAPI.trackLinkClick(quest.id);
          setLinkClicked(true);
          window.open(quest.target_url, '_blank');
          setScreenshotStep(2); // Move to step 2
        } catch (error) {
          console.error('Error tracking link click:', error);
          window.open(quest.target_url, '_blank');
          setScreenshotStep(2);
        }
      } else {
        setScreenshotStep(2);
      }
    } else if (screenshotStep === 2) {
      // Step 2: Submit screenshot
      await handleScreenshotSubmit();
    }
  };

  const handleScreenshotSubmit = async () => {
    if (!verificationData.screenshot) {
      toast.error('Please upload a screenshot before submitting');
      return;
    }

    try {
      setCompleting(true);

      // 1) Upload the screenshot to get a URL the backend/admin can view
      let uploaded;
      try {
        const uploadResult = await uploadAPI.uploadImage(verificationData.screenshot);
        const resolvedUrl = uploadResult?.data?.image_url || uploadResult?.data?.file_url;
        if (!resolvedUrl) throw new Error('Upload did not return image URL');
        uploaded = [{ name: verificationData.screenshot.name, filename: verificationData.screenshot.name, url: resolvedUrl }];
      } catch (e) {
        console.error('Upload failed:', e);
        toast.error('Failed to upload screenshot');
        return;
      }

      // 2) Submit proof with uploaded file metadata
      const proofData = {
        proof_type: 'SCREENSHOT',
        proof_files: uploaded,
        proof_text: verificationData.notes,
        link_clicked: linkClicked
      };

      const result = await questAPI.submitProof(quest.id, proofData);
      if (result && result.data) {
        setShowScreenshotFlow(false);
        toast.success("Screenshot submitted! Status: Pending approval (up to 48 hours).");
        onClose(); // Close the modal
      }
    } catch (error) {
      console.error('Error submitting screenshot:', error);
      toast.error('Failed to submit screenshot');
    } finally {
      setCompleting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVerificationData(prev => ({ ...prev, screenshot: file }));
    }
  };

  const handleLinkClick = async () => {
    if (quest.target_url) {
      // Track the link click first
      try {
        await questAPI.trackLinkClick(quest.id);
        setLinkClicked(true);
        setVerificationData(prev => ({ ...prev, link_clicked: true }));
        
        // Then open the link
        window.open(quest.target_url, '_blank');
      } catch (error) {
        console.error('Error tracking link click:', error);
        // Still open the link even if tracking fails
        window.open(quest.target_url, '_blank');
      }
    }
  };

  const getQuestTypeIcon = () => {
    const type = quest.quest_type;
    if (type.includes('TWITTER') || type.includes('X_')) return '🐦';
    if (type.includes('INSTAGRAM')) return '📷';
    if (type.includes('LINKEDIN')) return '💼';
    if (type.includes('YOUTUBE')) return '📺';
    if (type.includes('DISCORD')) return '🎮';
    if (type.includes('TELEGRAM')) return '💬';
    if (type.includes('SURVEY')) return '📋';
    if (type.includes('VISIT')) return '🔗';
    return '🎯';
  };

  const isLinkRequired = quest.target_url && quest.verification_method === 'CLICK_VERIFY';

  const renderVerificationSection = () => {
    if (!canComplete()) return null;

    return (
      <div className="verification-section">
        <h4>Complete this Quest</h4>
        
        {quest.target_url && (
          <div className="target-action">
            <p>First, visit the target link:</p>
            <button 
              className={`btn-primary target-link ${linkClicked ? 'clicked' : ''}`}
              onClick={handleLinkClick}
              style={{
                backgroundColor: linkClicked ? '#4caf50' : '',
                border: linkClicked ? '2px solid #4caf50' : ''
              }}
            >
              {linkClicked ? '✓ Visited' : '🔗 Visit'} {quest.target_url}
            </button>
            {isLinkRequired && !linkClicked && (
              <p className="link-requirement-note" style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '5px' }}>
                ⚠️ You must visit this link before you can claim your reward
              </p>
            )}
          </div>
        )}

        {quest.verification_method === 'SCREENSHOT' && (
          <div className="verification-input">
            <label>Upload Screenshot (Required)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="file-input"
            />
            {verificationData.screenshot && (
              <span className="file-selected">
                ✓ {verificationData.screenshot.name}
              </span>
            )}
          </div>
        )}

        {quest.verification_method === 'MANUAL_REVIEW' && (
          <div className="verification-input">
            <label>Additional Notes (Optional)</label>
            <textarea
              value={verificationData.notes}
              onChange={(e) => setVerificationData(prev => ({ 
                ...prev, 
                notes: e.target.value 
              }))}
              placeholder="Provide any additional information about completing this quest..."
              rows={3}
            />
          </div>
        )}

        <button
          className={`btn-success complete-btn ${(!linkClicked && isLinkRequired) ? 'disabled' : ''}`}
          onClick={handleQuestAction}
          disabled={
            completing || 
            (quest.verification_method === 'SCREENSHOT' && !verificationData.screenshot) ||
            (isLinkRequired && !linkClicked)
          }
          style={{
            opacity: (completing || (quest.verification_method === 'SCREENSHOT' && !verificationData.screenshot) || (isLinkRequired && !linkClicked)) ? 0.6 : 1,
            cursor: (completing || (quest.verification_method === 'SCREENSHOT' && !verificationData.screenshot) || (isLinkRequired && !linkClicked)) ? 'not-allowed' : 'pointer'
          }}
        >
          {getButtonText()}
        </button>
      </div>
    );
  };

  const getButtonText = () => {
    if (isCompleted) return '✓ Completed';
    
    if (quest.verification_method === 'SCREENSHOT_VERIFY') {
      return 'Complete Quest';
    }
    
    if (quest.verification_method === 'CLICK_VERIFY') {
      if (linkClicked) return 'Claim Reward';
      return 'Visit Link';
    }
    
    return 'Complete Quest';
  };

  const getVerificationMethodLabel = (method) => {
    switch (method) {
      case 'CLICK_VERIFY': return 'Open Link';
      case 'SCREENSHOT_VERIFY': return 'Screenshot Upload';
      default: return method?.replace(/_/g, ' ') || 'Click to Verify';
    }
  };

  useEffect(() => {
    const checkLinkClickStatus = async () => {
      if (quest.target_url && quest.verification_method === 'CLICK_VERIFY' && user) {
        try {
          const response = await questAPI.checkLinkClick(quest.id);
          if (response.data.has_clicked) {
            setLinkClicked(true);
            setVerificationData(prev => ({ ...prev, link_clicked: true }));
          }
        } catch (error) {
          console.error('Error checking link click status:', error);
        }
      }
    };

    checkLinkClickStatus();
  }, [quest.id, quest.target_url, quest.verification_method, user]);

  return (
    <div className="quest-modal-overlay" onClick={onClose}>
      <div className="quest-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="quest-title-section">
            <span className="quest-icon-large">{getQuestTypeIcon()}</span>
            <div>
              <h2>{quest.title}</h2>
              <span className="quest-type-label">{questType}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {/* Quest Image */}
          {(quest.image_url || quest.cover_image_url) && (
            <div className="quest-image-large">
              <img 
                src={quest.cover_image_url || quest.image_url} 
                alt={quest.title}
              />
            </div>
          )}

          {/* Quest Status */}
          <div className="quest-status-section">
            <div className="status-badges">
              {quest.is_featured && (
                <span className="status-badge featured">⭐ Featured Quest</span>
              )}
              {quest.has_raffle_prize && (
                <span className="status-badge raffle">🎁 Raffle Prize</span>
              )}
              {isCompleted && (
                <span className="status-badge completed">✓ Completed</span>
              )}
              {isExpired() && (
                <span className="status-badge expired">⏰ Expired</span>
              )}
              {isNotStarted() && (
                <span className="status-badge not-started">⏳ Not Started</span>
              )}
            </div>
          </div>

          {/* Quest Description */}
          <div className="quest-description-full">
            <h3>Quest Description</h3>
            <p>{quest.description || 'No detailed description available for this quest.'}</p>
          </div>

          {/* Quest Details */}
          <div className="quest-details-grid">
            <div className="detail-item">
              <label>XP Reward</label>
              <span className="xp-value">{quest.xp_reward} XP</span>
            </div>

            <div className="detail-item">
              <label>Verification</label>
              <span>{getVerificationMethodLabel(quest.verification_method)}</span>
            </div>

            {quest.max_completions && (
              <div className="detail-item">
                <label>Completions</label>
                <span>{quest.completion_count || 0} / {quest.max_completions}</span>
              </div>
            )}

            {quest.start_date && (
              <div className="detail-item">
                <label>Start Date</label>
                <span>{formatDate(quest.start_date)}</span>
              </div>
            )}

            {quest.end_date && (
              <div className="detail-item">
                <label>End Date</label>
                <span>{formatDate(quest.end_date)}</span>
              </div>
            )}
          </div>

          {/* Raffle Information */}
          {quest.has_raffle_prize && (
            <div className="raffle-section">
              <h3>🎁 Raffle Prize Information</h3>
              <p>{quest.raffle_prize_description}</p>
              {quest.raffle_end_date && (
                <p className="raffle-deadline">
                  <strong>Raffle Deadline:</strong> {formatDate(quest.raffle_end_date)}
                </p>
              )}
            </div>
          )}

          {/* Target Information */}
          {(quest.target_url || quest.target_data) && (
            <div className="target-section">
              <h3>Quest Requirements</h3>
              {quest.target_url && (
                <div className="target-item">
                  <label>Target URL:</label>
                  <a 
                    href={quest.target_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="target-link"
                  >
                    {quest.target_url}
                  </a>
                </div>
              )}
              {quest.target_data && (
                <div className="target-item">
                  <label>Additional Data:</label>
                  <pre className="target-data">
                    {typeof quest.target_data === 'object' 
                      ? JSON.stringify(quest.target_data, null, 2)
                      : String(quest.target_data)
                    }
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Completion Section - Updated for new verification methods */}
          {renderVerificationSection()}

          {/* Screenshot Upload Flow Modal */}
          {showScreenshotFlow && (
            <div className="screenshot-flow-overlay">
              <div className="screenshot-flow-modal">
                <div className="screenshot-flow-header">
                  <h3>Complete Quest</h3>
                  <button 
                    className="close-button"
                    onClick={() => {
                      setShowScreenshotFlow(false);
                      setScreenshotStep(1);
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div className="screenshot-flow-content">
                  <div className="quest-description-flow">
                    <p>{quest.screenshot_description || "Upload a screenshot to show you've completed the task. If it checks out, you'll be able to claim your XP—usually within 48 hours!"}</p>
                  </div>
                  
                  <div className="screenshot-steps">
                    <div className={`step ${screenshotStep >= 1 ? 'active' : ''} ${screenshotStep > 1 ? 'completed' : ''}`}>
                      <div className="step-number">1</div>
                      <div className="step-content">
                        <h4>Step 1: Visit the link</h4>
                        {quest.target_url && (
                          <div className="target-link-container">
                            <a href={quest.target_url} target="_blank" rel="noopener noreferrer" className="target-link-display">
                              {quest.target_url}
                            </a>
                          </div>
                        )}
                        {screenshotStep === 1 && (
                          <button 
                            className="step-action-button"
                            onClick={handleScreenshotStepAction}
                          >
                            Visit Link & Continue
                          </button>
                        )}
                        {screenshotStep > 1 && (
                          <span className="step-completed">✓ Link visited</span>
                        )}
                      </div>
                    </div>
                    
                    <div className={`step ${screenshotStep >= 2 ? 'active' : ''}`}>
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h4>Step 2: Upload a screenshot as proof to unlock your XP rewards</h4>
                        
                        {screenshotStep === 2 && (
                          <>
                            <div className="screenshot-upload-section">
                              <div className="file-upload-area" 
                                   onClick={() => document.getElementById('screenshot-upload').click()}>
                                <input
                                  id="screenshot-upload"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setVerificationData(prev => ({ 
                                    ...prev, 
                                    screenshot: e.target.files[0] 
                                  }))}
                                  style={{ display: 'none' }}
                                />
                                <div className="upload-icon">📷</div>
                                <p>{verificationData.screenshot ? 
                                  `Selected: ${verificationData.screenshot.name}` : 
                                  'Click to upload screenshot'
                                }</p>
                              </div>
                              
                              <textarea
                                placeholder="Add any additional notes (optional)"
                                value={verificationData.notes}
                                onChange={(e) => setVerificationData(prev => ({ 
                                  ...prev, 
                                  notes: e.target.value 
                                }))}
                                rows={3}
                                className="notes-textarea"
                              />
                              
                              <button
                                className="submit-screenshot-button"
                                onClick={handleScreenshotStepAction}
                                disabled={!verificationData.screenshot || completing}
                              >
                                {completing ? 'Submitting...' : 'Submit Screenshot'}
                              </button>
                              
                              <div className="approval-info">
                                <i className="ri-time-line"></i>
                                <span>Screenshots are usually reviewed within 48 hours. If not reviewed, they'll be automatically approved.</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Login Prompt */}
          {!user && (
            <div className="login-prompt">
              <p>Please log in to complete quests and earn XP!</p>
              <button className="btn-primary" onClick={() => window.location.href = '/login'}>
                Login / Register
              </button>
            </div>
          )}

          {/* Already Completed */}
          {isCompleted && (
            <div className="completed-section">
              <div className="completed-message">
                <span className="check-icon">✓</span>
                <div>
                  <h4>Quest Completed!</h4>
                  <p>You've already earned the XP reward for this quest.</p>
                </div>
              </div>
            </div>
          )}

          {/* Expired/Not Started Messages */}
          {isExpired() && (
            <div className="expired-section">
              <p>⏰ This quest has expired and can no longer be completed.</p>
            </div>
          )}

          {isNotStarted() && (
            <div className="not-started-section">
              <p>⏳ This quest hasn't started yet. Check back on {formatDate(quest.start_date)}.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      
      {/* Screenshot Flow Styles */}
      <style jsx>{`
        .screenshot-flow-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        }
        
        .screenshot-flow-modal {
          background: #1a1a1a;
          border-radius: 12px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          color: #fff;
        }
        
        .screenshot-flow-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #333;
        }
        
        .screenshot-flow-header h3 {
          margin: 0;
          color: #aa2eff;
        }
        
        .screenshot-flow-header .close-button {
          background: none;
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .screenshot-flow-content {
          padding: 20px;
        }
        
        .quest-description-flow {
          background: #2a2a2a;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .quest-description-flow p {
          margin: 0;
          color: #ccc;
          line-height: 1.5;
        }
        
        .screenshot-steps {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .step {
          display: flex;
          gap: 15px;
          padding: 15px;
          border-radius: 8px;
          background: #2a2a2a;
          opacity: 0.6;
          transition: all 0.3s ease;
        }
        
        .step.active {
          opacity: 1;
          background: #3a3a3a;
          border: 1px solid #aa2eff;
        }
        
        .step.completed {
          background: #2a4a2a;
          border: 1px solid #4caf50;
        }
        
        .step-number {
          width: 30px;
          height: 30px;
          background: #555;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
        }
        
        .step.active .step-number {
          background: #aa2eff;
        }
        
        .step.completed .step-number {
          background: #4caf50;
        }
        
        .step-content {
          flex: 1;
        }
        
        .step-content h4 {
          margin: 0 0 10px 0;
          color: #fff;
        }
        
        .target-link-container {
          margin: 10px 0;
        }
        
        .target-link-display {
          color: #aa2eff;
          text-decoration: none;
          padding: 8px 12px;
          background: #3a3a3a;
          border-radius: 4px;
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .step-action-button {
          background: #aa2eff;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          margin-top: 10px;
        }
        
        .step-action-button:hover {
          background: #9020e0;
        }
        
        .step-completed {
          color: #4caf50;
          font-weight: 500;
          margin-top: 10px;
          display: inline-block;
        }
        
        .screenshot-upload-section {
          margin-top: 15px;
        }
        
        .file-upload-area {
          border: 2px dashed #555;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 15px;
        }
        
        .file-upload-area:hover {
          border-color: #aa2eff;
        }
        
        .upload-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        
        .file-upload-area p {
          margin: 0;
          color: #ccc;
        }
        
        .notes-textarea {
          width: 100%;
          background: #2a2a2a;
          border: 1px solid #555;
          color: #fff;
          padding: 10px;
          border-radius: 6px;
          resize: vertical;
          margin-bottom: 15px;
          font-family: inherit;
        }
        
        .notes-textarea::placeholder {
          color: #888;
        }
        
        .submit-screenshot-button {
          background: #4caf50;
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          width: 100%;
          margin-bottom: 15px;
        }
        
        .submit-screenshot-button:hover {
          background: #45a049;
        }
        
        .submit-screenshot-button:disabled {
          background: #555;
          cursor: not-allowed;
        }
        
        .approval-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: #2a3a2a;
          border-radius: 6px;
          color: #bbb;
          font-size: 14px;
        }
        
        .approval-info i {
          color: #4caf50;
        }
      `}</style>
    </div>
  );
};

export default QuestModal; 