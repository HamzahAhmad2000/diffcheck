import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shareAPI } from '../../../services/apiClient';
import { LoadingIndicator, BackButton } from '../components';
import toast from 'react-hot-toast';
import './XPHistoryPage.css';

/**
 * XPHistoryPage - Display user's XP transaction history including share rewards
 */
const XPHistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, shares, other
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [page, filter]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await shareAPI.getShareHistory(page, 20);
      
      if (response.data) {
        setHistory(response.data.shares || []);
        setTotalPages(response.data.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching XP history:', error);
      toast.error('Failed to load XP history');
    } finally {
      setLoading(false);
    }
  };

  const getShareTypeLabel = (shareType) => {
    const labels = {
      'join_share': 'Welcome Bonus Share',
      'badge_share': 'Badge Share',
      'reward_redemption': 'Reward Redemption Share',
      'raffle_win': 'Raffle Win Share',
      'raffle_entry': 'Raffle Entry Share'
    };
    return labels[shareType] || shareType;
  };

  const getShareTypeIcon = (shareType) => {
    const icons = {
      'join_share': 'ri-gift-line',
      'badge_share': 'ri-medal-line',
      'reward_redemption': 'ri-shopping-cart-line',
      'raffle_win': 'ri-trophy-line',
      'raffle_entry': 'ri-ticket-line'
    };
    return icons[shareType] || 'ri-share-line';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const filteredHistory = filter === 'all' 
    ? history 
    : filter === 'shares'
    ? history.filter(item => item.share_type)
    : history.filter(item => !item.share_type);

  return (
    <div className="app-layout">
      <main className="main-content12">
        <div className="page-inner-container">
          <div className="xp-history-page">
            {/* Header */}
            <div className="xp-history-page__header">
              <BackButton 
                onClick={() => navigate('/user/profile')}
                text="Back to Profile"
                variant="secondary"
              />

              <div className="xp-history-page__title-section">
                <h1 className="xp-history-page__title">
                  <i className="ri-history-line"></i>
                  XP History
                </h1>
                <p className="xp-history-page__subtitle">
                  Track all your XP transactions and social share rewards
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="xp-history-page__filters">
              <button
                className={`xp-history-filter ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <i className="ri-list-check"></i>
                All Activity
              </button>
              <button
                className={`xp-history-filter ${filter === 'shares' ? 'active' : ''}`}
                onClick={() => setFilter('shares')}
              >
                <i className="ri-share-line"></i>
                Social Shares
              </button>
              <button
                className={`xp-history-filter ${filter === 'other' ? 'active' : ''}`}
                onClick={() => setFilter('other')}
              >
                <i className="ri-star-line"></i>
                Other Rewards
              </button>
            </div>

            {/* History List */}
            {loading ? (
              <LoadingIndicator 
                variant="spinner"
                size="large"
                text="Loading your XP history..."
                fullHeight
              />
            ) : filteredHistory.length === 0 ? (
              <div className="xp-history-page__empty">
                <i className="ri-inbox-line"></i>
                <h3>No XP History Yet</h3>
                <p>Start earning XP by completing surveys, sharing on social media, and engaging with the platform!</p>
              </div>
            ) : (
              <>
                <div className="xp-history-list">
                  {filteredHistory.map((item, index) => (
                    <div key={item.id || index} className="xp-history-item">
                      <div className="xp-history-item__icon">
                        <i className={getShareTypeIcon(item.share_type)}></i>
                      </div>

                      <div className="xp-history-item__content">
                        <div className="xp-history-item__main">
                          <h4 className="xp-history-item__title">
                            {getShareTypeLabel(item.share_type)}
                          </h4>
                          <p className="xp-history-item__date">
                            {formatDate(item.shared_at || item.created_at)}
                          </p>
                        </div>
                        
                        {item.entity_name && (
                          <p className="xp-history-item__description">
                            {item.entity_name}
                          </p>
                        )}
                      </div>

                      <div className="xp-history-item__xp">
                        <span className="xp-history-item__xp-value">
                          +{item.xp_awarded || item.xp_amount || 0}
                        </span>
                        <span className="xp-history-item__xp-label">XP</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="xp-history-pagination">
                    <button
                      className="xp-history-pagination__button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <i className="ri-arrow-left-s-line"></i>
                      Previous
                    </button>

                    <span className="xp-history-pagination__info">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      className="xp-history-pagination__button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <i className="ri-arrow-right-s-line"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default XPHistoryPage;

