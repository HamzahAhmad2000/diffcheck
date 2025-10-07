// AdminRegistration.js (continued)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../admin/AdminForms.css';
import '../../styles/b_admin_styling.css';
import '../admin/ui/b_ui.css';
import { BFormField, BTextInput } from '../admin/ui';
import BButton from '../admin/ui/BButton';
import 'remixicon/fonts/remixicon.css';
import { baseURL } from '../../services/apiClient';

const AdminRegistration = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const navigate = useNavigate();
  
  // Check if the current user is an admin
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || (userRole !== 'admin' && userRole !== 'super_admin')) {
      setIsAuthorized(false);
      setServerError('You must be a super admin to register a new admin');
      return;
    }
    
    setIsAuthorized(true);
  }, []);
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setServerError('');
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${baseURL}/auth/admin/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: formData.name
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Show success message and reset form
      toast.success('Super Admin registered successfully!');
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        name: ''
      });
      
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isAuthorized) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-form-page">
          <div className="form-container-card">
            <div className="form-header">
              <h1 className="chat-title">Unauthorized Access</h1>
              <p className="chat-subtitle">{serverError}</p>
            </div>
            <div className="form-actions" style={{ justifyContent: 'center', borderTop: 'none' }}>
              <button 
                onClick={() => navigate('/admin')} 
                className="form-button secondary"
              >
                <i className="ri-arrow-left-line"></i>
                Back to Admin Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="page-container">
      <Sidebar />
      
        <div className="form-container-card">
          <div className="form-header">
            <h1 className="chat-title">Register New Super Admin</h1>
            <p className="chat-subtitle">Create a new super administrator account for the platform.</p>
          </div>

          {serverError && (
            <div className="error-message" style={{ 
              backgroundColor: '#f8d7da', 
              color: '#721c24', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #f5c6cb'
            }}>
              {serverError}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-row">
              <BFormField label="Username" required error={errors.username}>
                <BTextInput
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                />
              </BFormField>
              <BFormField label="Email" required error={errors.email}>
                <BTextInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                />
              </BFormField>
            </div>

            <div className="form-row">
              <BFormField label="Password" required error={errors.password}>
                <BTextInput
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                />
              </BFormField>
              <BFormField label="Confirm Password" required error={errors.confirmPassword}>
                <BTextInput
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm password"
                />
              </BFormField>
            </div>

            <BFormField label="Full Name">
              <BTextInput
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name (optional)"
              />
            </BFormField>

            <div className="form-note" style={{ marginTop: '1rem' }}>* Required fields</div>

            <div className="form-actions">
              <BButton
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin')}
                disabled={isLoading}
              >
                <i className="ri-arrow-left-line"></i>
                Back to Dashboard
              </BButton>
              <BButton
                type="submit"
                variant="primary"
                disabled={isLoading}
              >
                <i className="ri-user-add-line"></i>
                {isLoading ? 'Creating...' : 'Create Super Admin'}
              </BButton>
            </div>
          </form>
        </div>
      </div>
   
  );
};

export default AdminRegistration;