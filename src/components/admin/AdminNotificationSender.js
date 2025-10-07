import React, { useState, useEffect } from 'react';
import { notificationAPI, userProfileAPI } from '../../services/apiClient';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BSelect } from './ui';
import BButton from './ui/BButton';

const AdminNotificationSender = () => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    notification_type: 'CUSTOM'
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm]);

  const fetchUsers = async () => {
    try {
      const response = await userProfileAPI.adminGetAllUsers({
        search: searchTerm,
        limit: 50
      });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserSelection = (userId, checked) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (selectedUsers.length === 0) {
        throw new Error('Please select at least one recipient');
      }

      await notificationAPI.adminSendBulkNotification({
        user_ids: selectedUsers,
        title: formData.title,
        message: formData.message,
        notification_type: formData.notification_type
      });

      setSuccess(`Notification sent to ${selectedUsers.length} recipient(s) successfully!`);

      // Reset form
      setFormData({
        title: '',
        message: '',
        notification_type: 'CUSTOM'
      });
      setSelectedUsers([]);

    } catch (error) {
      console.error('Error sending notification:', error);
      setError(error.response?.data?.message || error.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const getNotificationTypeOptions = () => [
    { value: 'CUSTOM', label: 'Custom Message' },
    { value: 'SYSTEM_ANNOUNCEMENT', label: 'System Announcement' },
    { value: 'ORDER_SHIPPED', label: 'Order Shipped' },
    { value: 'ORDER_DELIVERED', label: 'Order Delivered' },
    { value: 'RAFFLE_WINNER', label: 'Raffle Winner' }
  ];

  return (
    <div className="admin-container">
      <div className="admin-header" style={{color:"#333"}}>
        <h1>Send Notifications</h1>
        <p className="admin-subtitle">Send custom notifications to users</p>
      </div>

      <div className="quest-form-container">
        <form onSubmit={handleSubmit} className="quest-form">
          {error && (
            <div className="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {success && (
            <div className="alert alert-success">
              <strong>Success:</strong> {success}
            </div>
          )}

          <div className="newform-section">
            <h3 className="section-title">Notification Settings</h3>

            <BFormField label="Notification Type" required hint="Select the type of notification being sent">
              <BSelect
                id="notification_type"
                name="notification_type"
                value={formData.notification_type}
                onChange={handleInputChange}
                required
              >
                {getNotificationTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </BSelect>
            </BFormField>
          </div>

          <div className="newform-section">
            <h3 className="section-title">Select Recipients</h3>

            <BFormField label="Search Users" hint="Search for users to include in the notification">
              <BTextInput
                id="search_users"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by username or email..."
              />
            </BFormField>

            {users.length > 0 && (
              <div className="user-selection-container">
                <div className="user-selection-header" style={{color:"#333"}}>
                  <label >
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="newform-checkbox"
                    />
                    Select All ({users.length} users)
                  </label>
                  <span className="selected-count">
                    {selectedUsers.length} selected
                  </span>
                </div>

                <div className="user-list">
                  {users.map(user => (
                    <div key={user.id} className="user-item">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                          className="newform-checkbox"
                        />
                        <div className="user-info">
                          <span className="user-name">{user.username}</span>
                          <span className="user-email">{user.email}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="newform-section">
            <h3 className="section-title">Notification Content</h3>
            
            <BFormField label="Notification Title" required hint="Brief, descriptive title for the notification">
              <BTextInput
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter notification title..."
                maxLength={100}
                required
              />
            </BFormField>

            <BFormField label="Notification Message" required hint={<span>Detailed message content (max 500 characters) <span className="char-count">{formData.message.length}/500</span></span>}>
              <BTextarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Enter notification message..."
                rows={5}
                maxLength={500}
                required
              />
            </BFormField>
          </div>

          <div className="newform-actions">
            <BButton
              type="button"
              variant="secondary"
              onClick={() => {
                setFormData({
                  title: '',
                  message: '',
                  notification_type: 'CUSTOM'
                });
                setSelectedUsers([]);
                setError('');
                setSuccess('');
              }}
              disabled={loading}
            >
              Reset Form
            </BButton>
            
            <BButton
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner small"></span>
                  Sending...
                </>
              ) : (
                <>
                  Send Notification
                  {selectedUsers.length > 0 && (
                    <span className="recipient-count">({selectedUsers.length} selected)</span>
                  )}
                </>
              )}
            </BButton>
          </div>
        </form>
      </div>

      <div className="notification-preview">
        <h3>Notification Preview</h3>
        <div className="preview-container">
          <div className="preview-notification">
            <div className="preview-header">
              <span className="preview-type">
                {getNotificationTypeOptions().find(opt => opt.value === formData.notification_type)?.label}
              </span>
              <span className="preview-time">Just now</span>
            </div>
            <h4 className="preview-title">
              {formData.title || 'Notification Title'}
            </h4>
            <p className="preview-message">
              {formData.message || 'Notification message will appear here...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationSender; 