import React, { useState } from 'react';
import Sidebar from '../common/Sidebar';
import { userProfileAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/Auth.css';
import '../../styles/b_admin_styling.css';
import '../admin/ui/b_ui.css';
import { BFormField, BTextInput, BButton } from '../admin/ui';

const UpdatePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Include confirm_password to satisfy backends that require confirmation
      await userProfileAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      const apiMsg = err.response?.data?.error || err.response?.data?.message;
      toast.error(apiMsg || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content3 admin-form-page">
        <div className="form-container-card" style={{ maxWidth: '640px' }}>
          <div className="form-header">
            <h1 className="chat-title">Update Password</h1>
            <p className="chat-subtitle">Ensure you use a strong unique password.</p>
          </div>
          <form onSubmit={handleSubmit} className="admin-form" style={{ maxWidth: '520px' }}>
            <BFormField label="Current Password" required>
              <BTextInput
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </BFormField>

            <BFormField label="New Password" required>
              <BTextInput
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </BFormField>

            <BFormField label="Confirm New Password" required>
              <BTextInput
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </BFormField>

            <div className="newform-actions">
              <BButton type="submit" variant="primary" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </BButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword; 