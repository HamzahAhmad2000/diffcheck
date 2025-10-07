import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { itemAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';

import '../../styles/userStyles.css';
import './ReportFormPages.css';

const ReportBugPage = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ title: '', description: '', item_type: 'BUG' });
    const [image, setImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Detect user role for appropriate layout and styling
    const userRole = localStorage.getItem('userRole');
    const isBusinessAdmin = userRole === 'business_admin' || userRole === 'admin' || userRole === 'super_admin';

    // Debug: Log the businessId to ensure it's correct
    useEffect(() => {
        console.log('[ReportBugPage] Business ID from params:', businessId);
        console.log('[ReportBugPage] User role:', userRole);
        console.log('[ReportBugPage] Is business admin:', isBusinessAdmin);
    }, [businessId, userRole, isBusinessAdmin]);

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
            const reportData = {
                ...formData,
                title: formData.title.trim(),
                description: formData.description.trim()
            };

            // Handle image upload if provided
            if (image) {
                // Note: You might need to implement proper image upload functionality
                // For now, we'll include the image name
                reportData.image_url = image.name;
            }

            console.log('[ReportBugPage] Submitting bug report to business:', businessId);
            console.log('[ReportBugPage] Report data:', reportData);
            
            const response = await itemAPI.createItem(businessId, reportData);
            console.log('[ReportBugPage] Submission response:', response);
            
            toast.success('Bug report submitted successfully!');
            
            // Navigate back to appropriate context
            if (isSuperAdmin) {
                navigate(`/admin/business/dashboard/${businessId}`);
            } else if (isBusinessAdmin) {
                navigate(`/business-admin/dashboard`);
            }
        } catch (error) {
            console.error('[ReportBugPage] Submission error:', error);
            const errorMessage = error.response?.data?.error || 'Failed to submit bug report.';
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        if (isBusinessAdmin) {
            navigate(`/admin/business/${businessId}`);
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
                                <i className="ri-bug-line"></i>
                                Report a Bug
                            </h1>
                            <p className="admin-form-subtitle">
                                Help improve this business by reporting any issues you've found.
                            </p>
                        </div>

                        <div className="admin-form-card">
                            <form onSubmit={handleSubmit} className="admin-form">
                                <div className="admin-form-group">
                                    <label htmlFor="title" className="admin-form-label">Bug Title *</label>
                                    <input 
                                        id="title" 
                                        type="text" 
                                        value={formData.title} 
                                        onChange={e => setFormData({ ...formData, title: e.target.value })} 
                                        required 
                                        placeholder="e.g., Login button not working on mobile"
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
                                        placeholder="Please describe the issue, including steps to reproduce it if possible."
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
                                        {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
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
                            <h2>Report a Bug</h2>
                            <p>Help us improve by reporting any issues you've found.</p>
                            <div className="form-group">
                                <label htmlFor="title">Bug Title *</label>
                                <input id="title" type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="e.g., Login button not working on mobile" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Detailed Description</label>
                                <textarea 
                                    id="description" 
                                    rows="6" 
                                    value={formData.description} 
                                    onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                    placeholder="Please describe the issue, including steps to reproduce it if possible."
                                />
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
                                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportBugPage; 