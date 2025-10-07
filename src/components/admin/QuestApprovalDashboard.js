import React, { useState, useEffect } from 'react';
import { questVerificationAPI } from '../../services/apiClient';
import './AdminTables.css';
import './AdminLayout.css';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../../styles/QuestModal.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';

const QuestApprovalDashboard = ({ onClose }) => {
  const [pendingQuests, setPendingQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPendingQuests();
  }, []);

  const loadPendingQuests = async () => {
    try {
      setLoading(true);
      const response = await questVerificationAPI.getPendingQuestApprovals();
      console.log('[QUEST_APPROVAL] API Response:', response);
      
      // Handle both response.data and direct response structure
      const pendingQuests = response.data?.pending_quests || response.pending_quests || [];
      console.log('[QUEST_APPROVAL] All pending quests:', pendingQuests);
      
      // Filter to show only business admin created quests (quests with created_by_user_id)
      const businessAdminQuests = pendingQuests.filter(quest => 
        quest.created_by_user_id && quest.approval_status === 'PENDING'
      );
      
      setPendingQuests(businessAdminQuests);
      console.log(`[QUEST_APPROVAL] Loaded ${businessAdminQuests.length} business admin quests pending approval`);
      
      // Debug: Show details of filtered quests
      businessAdminQuests.forEach(quest => {
        console.log(`[QUEST_APPROVAL] Quest ID: ${quest.id}, Title: ${quest.title}, Created by user: ${quest.created_by_user_id}`);
      });
      
    } catch (error) {
      console.error('Error loading pending quests:', error);
      setError('Failed to load pending quest approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (questId, action) => {
    try {
      setProcessing(true);
      setError('');

      if (action === 'approve') {
        await questVerificationAPI.approveQuest(questId, reviewNotes);
        setSuccess('Quest approved successfully!');
      } else {
        await questVerificationAPI.rejectQuest(questId, reviewNotes);
        setSuccess('Quest rejected successfully!');
      }

      // Remove from pending list
      setPendingQuests(prev => prev.filter(q => q.id !== questId));
      setSelectedQuest(null);
      setReviewNotes('');

    } catch (error) {
      console.error(`Error ${action}ing quest:`, error);
      setError(error.message || `Failed to ${action} quest`);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const renderContent = () => {
    if (loading) {
      return <BLoading variant="page" label="Loading pending quest approvals..." />;
    }

    return (
      <div className="dashboard-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">
              <i className="ri-file-check-line"></i>
            </div>
            <div className="admin-stat-content">
              <h3>{pendingQuests.length}</h3>
              <p>Pending Approvals</p>
            </div>
          </div>
        </div>

        {pendingQuests.length === 0 ? (
          <div className="b_admin_styling-card admin-empty-state">
            <i className="ri-checkbox-circle-line"></i>
            <h3>No Pending Quest Approvals</h3>
            <p>All business admin created quests have been reviewed.</p>
          </div>
        ) : (
          <div className="quests-layout">
            {/* Quest List */}
            <div className="quests-list b_admin_styling-card">
              <h3>Pending Quests</h3>
              {pendingQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={`quest-item ${selectedQuest?.id === quest.id ? 'selected' : ''}`}
                  onClick={() => setSelectedQuest(quest)}
                >
                  <div className="quest-summary">
                    <div className="quest-title">{quest.title}</div>
                    <div className="quest-business">
                      Business: {quest.business?.name || quest.business_name || 'Unknown'}
                    </div>
                    <div className="quest-creator">
                      Created by: {quest.created_by_user?.username || 'Unknown'}
                    </div>
                    {quest.target_url && (
                      <div className="quest-url">
                        URL: {quest.target_url.length > 40 ? quest.target_url.substring(0, 40) + '...' : quest.target_url}
                      </div>
                    )}
                    <div className="quest-date">
                      {formatDate(quest.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quest Details */}
            <div className="quest-details b_admin_styling-card">
              {selectedQuest ? (
                <>
                  <div className="quest-info">
                    <h3>{selectedQuest.title}</h3>
                    <div className="quest-detail-item">
                      <label>Description:</label>
                      <p>{selectedQuest.description || 'No description provided'}</p>
                    </div>
                    <div className="quest-detail-item">
                      <label>Quest Type:</label>
                      <span>{selectedQuest.quest_type}</span>
                    </div>
                    <div className="quest-detail-item">
                      <label>XP Reward:</label>
                      <span>{selectedQuest.xp_reward} XP</span>
                    </div>
                    {selectedQuest.target_url && (
                      <div className="quest-detail-item">
                        <label>Target URL:</label>
                        <a href={selectedQuest.target_url} target="_blank" rel="noopener noreferrer">
                          {selectedQuest.target_url}
                        </a>
                      </div>
                    )}
                    <div className="quest-detail-item">
                      <label>Verification Method:</label>
                      <span>{selectedQuest.verification_method}</span>
                    </div>
                    <div className="quest-detail-item">
                      <label>Business:</label>
                      <span>{selectedQuest.business?.name || selectedQuest.business_name || 'Unknown'}</span>
                    </div>
                    <div className="quest-detail-item">
                      <label>Created By:</label>
                      <span>{selectedQuest.created_by_user?.username || 'Unknown'}</span>
                    </div>
                    <div className="quest-detail-item">
                      <label>Created At:</label>
                      <span>{formatDate(selectedQuest.created_at)}</span>
                    </div>
                  </div>

                  <div className="approval-section">
                    <h4>Review Decision</h4>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add review notes (optional)..."
                      className="review-notes"
                      rows={3}
                    />

          <div className="approval-actions">
            <BButton
              variant="primary"
              size="sm"
              onClick={() => handleApproval(selectedQuest.id, 'approve')}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Approve Quest'}
            </BButton>
            <BButton
              variant="danger"
              size="sm"
              onClick={() => handleApproval(selectedQuest.id, 'reject')}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Reject Quest'}
            </BButton>
          </div>
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <h3>Select a Quest</h3>
                  <p>Choose a quest from the left to review and approve.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (onClose) {
    // Maintain modal overlay for inline usage
    return (
      <div className="modal-overlay">
        <div className="admin-form-container large">
          <div className="admin-form-header">
            <h2>Quest Approval Dashboard</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          {renderContent()}
        </div>
      </div>
    );
  }

  // Full page layout with sidebar
  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page">
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="b_admin_styling-title">Quest Approval Dashboard</h1>
            <p className="chat-subtitle">Review and approve quests submitted by business admins</p>
          </div>
          <BButton 
            variant="primary" 
            size="sm"
            onClick={loadPendingQuests}
          >
            <i className="ri-refresh-line"></i> Refresh
          </BButton>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default QuestApprovalDashboard; 