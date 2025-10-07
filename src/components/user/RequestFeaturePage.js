import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { itemAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';

import '../../styles/userStyles.css';
import './ReportFormPages.css';

const RequestFeaturePage = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ title: '', description: '', item_type: 'FEATURE' });
    const [image, setImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Detect user role for appropriate layout and styling
    const userRole = localStorage.getItem('userRole');
    const isBusinessAdmin = userRole === 'business_admin' || userRole === 'admin' || userRole === 'super_admin';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error('Title is required');
            return;
        }
        
        if (!businessId) {
            toast.error('Business ID is missing');
            return;
        }

        setIsSubmitting(true);
        try {
            const requestData = {
                ...formData,
                title: formData.title.trim(),
                description: formData.description.trim()
            };

            // Handle image upload if provided
            if (image) {
                requestData.image_url = image.name;
            }

            await itemAPI.createItem(businessId, requestData);
            toast.success('Feature request submitted successfully!');
            
            // Navigate back to appropriate context
            const userRole = localStorage.getItem('userRole');
            const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';
            
            if (isSuperAdmin) {
                navigate(`/admin/business/dashboard/${businessId}`);
            } else if (isBusinessAdmin) {
                navigate(`/business-admin/dashboard`);
            } else {
                navigate(`/business/${businessId}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to submit feature request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        const userRole = localStorage.getItem('userRole');
        const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';
        
        if (isSuperAdmin) {
            navigate(`/admin/business/dashboard/${businessId}`);
        } else if (isBusinessAdmin) {
            navigate(`/business-admin/dashboard`);
        } else {
            navigate(`/business/${businessId}`);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select a valid image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image file must be smaller than 5MB');
                return;
            }
            setImage(file);
        }
    };

    const removeImage = () => {
        setImage(null);
    };

    // Render business admin layout
    if (isBusinessAdmin) {
        return (
            <div className="report-form-admin-container">
                <Sidebar />
                <main className="report-form-admin-main">
                    <div className="report-form-admin-content">
                        <div className="report-form-admin-header">
                            <button onClick={handleBack} className="admin-back-button">
                                <i className="ri-arrow-left-line"></i>
                                Back to Business Dashboard
                            </button>
                            <h1 className="admin-form-title">
                                <i className="ri-lightbulb-flash-line"></i>
                                Request a New Feature
                            </h1>
                            <p className="admin-form-subtitle">
                                Have an idea for a new feature? We would love to hear it!
                            </p>
                        </div>

                        <div className="admin-form-card">
                            <form onSubmit={handleSubmit} className="admin-form">
                                <div className="admin-form-group">
                                    <label htmlFor="title" className="admin-form-label">Feature Title *</label>
                                    <input 
                                        id="title" 
                                        type="text" 
                                        value={formData.title} 
                                        onChange={e => setFormData({ ...formData, title: e.target.value })} 
                                        required 
                                        placeholder="e.g., Add dark mode to the interface"
                                        className="admin-form-input"
                                    />
                                </div>
                                
                                <div className="admin-form-group">
                                    <label htmlFor="description" className="admin-form-label">Detailed Description</label>
                                    <textarea 
                                        id="description" 
                                        rows="6" 
                                        value={formData.description} 
                                        onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                        placeholder="Please describe the feature and why it would be useful."
                                        className="admin-form-textarea"
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Attach Image (Optional)</label>
                                    <div className="admin-file-input-container">
                                        <label className="admin-file-input-label">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="admin-file-input"
                                            />
                                            <i className="ri-image-add-line"></i>
                                            Choose Image
                                        </label>
                                        {image && (
                                            <div className="admin-file-preview">
                                                <span className="admin-file-name">
                                                    <i className="ri-file-image-line"></i>
                                                    {image.name}
                                                </span>
                                                <button type="button" onClick={removeImage} className="admin-file-remove">
                                                    <i className="ri-close-line"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="admin-form-actions">
                                    <button 
                                        type="button" 
                                        className="admin-button admin-button--secondary" 
                                        onClick={handleBack} 
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="admin-button admin-button--primary" 
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit Feature Request'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Render user layout (existing)
    return (
        <div className="app-layout">
            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="form-page-container">
                     <button onClick={handleBack} className="page-header__back-button">
                        <i className="ri-arrow-left-s-line"></i> Back to Business
                    </button>
                    <div className="form-card">
                        <form onSubmit={handleSubmit}>
                            <h2>Request a New Feature</h2>
                            <p>Have an idea for a new feature? We would love to hear it!</p>
                            <div className="form-group">
                                <label htmlFor="title">Feature Title *</label>
                                <input id="title" type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="e.g., Add dark mode to the interface" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Detailed Description</label>
                                <textarea id="description" rows="6" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Please describe the feature and why it would be useful." />
                            </div>
                            <div className="form-group">
                                <label className="file-input-label">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="file-input"
                                    />
                                    📎 Attach Image (Optional)
                                </label>
                                {image && (
                                    <div className="file-preview">
                                        <span>{image.name}</span>
                                        <button type="button" onClick={removeImage}>×</button>
                                    </div>
                                )}
                            </div>
                            <div className="form-actions">
                                <button type="button" className="button button--secondary" onClick={handleBack} disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="button button--primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RequestFeaturePage; 