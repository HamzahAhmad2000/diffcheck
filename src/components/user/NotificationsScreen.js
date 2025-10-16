import React, { useState, useEffect } from 'react';
import { notificationAPI, shareAPI } from '../../services/apiClient';
import ShareButton from './share/ShareButton';
import '../../styles/userStyles.css'; // Import global styles
import './NotificationsScreen.css'; // Keep component-specific styles

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [sharedRaffles, setSharedRaffles] = useState(new Set());

  useEffect(() => {
    fetchNotifications();
    checkSharedRaffles();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getUserNotifications();
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const checkSharedRaffles = async () => {
    try {
      const response = await shareAPI.getAvailableRaffleShares();
      if (response.data?.available_raffles) {
        // Create a set of raffle IDs that have already been shared
        const sharedIds = new Set();
        response.data.available_raffles.forEach(raffle => {
          if (raffle.already_shared) {
            sharedIds.add(raffle.raffle_id);
          }
        });
        setSharedRaffles(sharedIds);
      }
    } catch (error) {
      console.error('Error checking shared raffles:', error);
    }
  };

  const handleRaffleShareSuccess = (raffleId, shareData) => {
    // Mark raffle as shared
    setSharedRaffles(prev => new Set([...prev, raffleId]));
    
    // Update user's XP balance in localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData && shareData.xp_awarded) {
      userData.xp_balance = (userData.xp_balance || 0) + shareData.xp_awarded;
      localStorage.setItem('user', JSON.stringify(userData));
      window.dispatchEvent(new CustomEvent('userUpdated'));
      window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: shareData.xp_awarded } }));
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationAPI.markNotificationRead(notificationId);
      setNotifications(notifications.map(notif => 
        notif.id === notificationId ? { ...notif, status: 'READ' } : notif
      ));
      // Dispatch event to update navbar notification count
      window.dispatchEvent(new CustomEvent('notificationUpdated'));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await notificationAPI.dismissNotification(notificationId);
      setNotifications(notifications.map(notif => 
        notif.id === notificationId ? { ...notif, status: 'DISMISSED' } : notif
      ));
      // Dispatch event to update navbar notification count
      window.dispatchEvent(new CustomEvent('notificationUpdated'));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }
    
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(notifications.filter(notif => notif.id !== notificationId));
      // Dispatch event to update navbar notification count
      window.dispatchEvent(new CustomEvent('notificationUpdated'));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedNotifications.length === 0) {
      return;
    }

    try {
      const promises = selectedNotifications.map(id => {
        switch (action) {
          case 'read':
            return notificationAPI.markNotificationRead(id);
          case 'dismiss':
            return notificationAPI.dismissNotification(id);
          case 'delete':
            return notificationAPI.deleteNotification(id);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      
      if (action === 'delete') {
        setNotifications(notifications.filter(notif => !selectedNotifications.includes(notif.id)));
      } else {
        const newStatus = action === 'read' ? 'READ' : 'DISMISSED';
        setNotifications(notifications.map(notif => 
          selectedNotifications.includes(notif.id) ? { ...notif, status: newStatus } : notif
        ));
      }
      
      setSelectedNotifications([]);
      // Dispatch event to update navbar notification count
      window.dispatchEvent(new CustomEvent('notificationUpdated'));
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return notif.status === 'UNREAD';
    if (filter === 'read') return notif.status === 'READ';
    return notif.status !== 'DISMISSED'; // Show all except dismissed
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'RAFFLE_WINNER':
        return '🎉';
      case 'ORDER_SHIPPED':
        return '📦';
      case 'ORDER_DELIVERED':
        return '✅';
      case 'RAFFLE_ENTRY':
        return '🎫';
      case 'SYSTEM_ANNOUNCEMENT':
        return '📢';
      case 'CUSTOM':
        return '💬';
      default:
        return '🔔';
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'RAFFLE_WINNER':
        return 'Raffle Win';
      case 'ORDER_SHIPPED':
        return 'Order Shipped';
      case 'ORDER_DELIVERED':
        return 'Order Delivered';
      case 'RAFFLE_ENTRY':
        return 'Raffle Entry';
      case 'SYSTEM_ANNOUNCEMENT':
        return 'Announcement';
      case 'CUSTOM':
        return 'Message';
      default:
        return 'Notification';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const toggleSelectNotification = (notificationId) => {
    if (selectedNotifications.includes(notificationId)) {
      setSelectedNotifications(selectedNotifications.filter(id => id !== notificationId));
    } else {
      setSelectedNotifications([...selectedNotifications, notificationId]);
    }
  };

  const selectAllNotifications = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(notif => notif.id));
    }
  };

  if (loading) {
    return ( // Use standardized loading indicator
      <div className="main-content12">
        <div className="user-loading-indicator">
          <div className="user-loading-spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return ( // Use standardized error message
      <div className="main-content12">
        <div className="user-error-message">
          <p>{error}</p>
          <button onClick={fetchNotifications} className="button button--primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content12">
      <div className="page-header">
        <h1 className="page-header__title">Notifications</h1>
        <div className="notifications-stats">
          <span className="total-count">
            {notifications.filter(n => n.status !== 'DISMISSED').length} total
          </span>
          <span className="unread-count" style={{ color: 'var(--color-primary)' }}>
            {notifications.filter(n => n.status === 'UNREAD').length} unread
          </span>
        </div>
      </div>

      <div className="notifications-controls" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="filter-controls">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({notifications.filter(n => n.status === 'UNREAD').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Read
          </button>
        </div>

        {filteredNotifications.length > 0 && (
          <div className="bulk-controls">
            <label className="select-all">
              <input
                type="checkbox"
                checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                onChange={selectAllNotifications}
              />
              Select All
            </label>
            
            {selectedNotifications.length > 0 && (
              <div className="bulk-actions">
                <button onClick={() => handleBulkAction('read')} className="bulk-action-btn">
                  Mark as Read ({selectedNotifications.length})
                </button>
                <button onClick={() => handleBulkAction('dismiss')} className="bulk-action-btn">
                  Dismiss ({selectedNotifications.length})
                </button>
                <button onClick={() => handleBulkAction('delete')} className="bulk-action-btn delete">
                  Delete ({selectedNotifications.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state"> {/* Use standardized empty state */}
            <i className="ri-notification-off-line empty-state__icon"></i>
            <h3 className="empty-state__title">No Notifications</h3>
            <p className="empty-state__message">
              {filter === 'unread' 
                ? "You're all caught up! No unread notifications." 
                : filter === 'read' 
                ? "No read notifications to display."
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notification => {
            const isRaffleWin = notification.type === 'RAFFLE_WINNER';
            const raffleId = notification.related_object_id;
            const hasShared = sharedRaffles.has(raffleId);
            
            return (
              <div 
                key={notification.id} 
                className={`notification-item ${notification.status === 'UNREAD' ? 'unread' : ''} ${selectedNotifications.includes(notification.id) ? 'selected' : ''} ${isRaffleWin ? 'raffle-win' : ''}`}
              >
                <div className="notification-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={() => toggleSelectNotification(notification.id)}
                  />
                </div>
                
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="notification-content">
                  <div className="notification-header">
                    <span className="notification-type">
                      {getNotificationTypeLabel(notification.type)}
                    </span>
                    {notification.status === 'UNREAD' && (
                      <span className="unread-indicator">●</span>
                    )}
                  </div>
                  
                  <h4 className="notification-title">{notification.title}</h4>
                  <p className="notification-message">{notification.message}</p>
                  
                  <div className="notification-meta">
                    <span className="notification-date">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  
                  {/* Share button for raffle wins */}
                  {isRaffleWin && raffleId && (
                    <div className="notification-share-section">
                      <ShareButton
                        shareType="raffle_win"
                        entityId={raffleId}
                        entityName={notification.title}
                        variant="success"
                        size="small"
                        xpReward={50}
                        hasShared={hasShared}
                        onShareSuccess={(shareData) => handleRaffleShareSuccess(raffleId, shareData)}
                        className="notification-share-button"
                      />
                    </div>
                  )}
                </div>
                
                <div className="notification-actions">
                  {notification.status === 'UNREAD' && (
                    <button 
                      onClick={() => markAsRead(notification.id)}
                      className="action-btn read-btn"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button 
                    onClick={() => dismissNotification(notification.id)}
                    className="action-btn dismiss-btn"
                    title="Dismiss"
                  >
                    ⊗
                  </button>
                  <button 
                    onClick={() => deleteNotification(notification.id)}
                    className="action-btn delete-btn"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredNotifications.length > 0 && (
        <div className="notifications-footer">
          <button onClick={fetchNotifications} className="refresh-btn">
            Refresh Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen; 