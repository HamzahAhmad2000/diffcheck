import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import apiClient from '../../services/apiClient'; // Assuming you have an apiClient for API calls
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; // For base styles
import './AdminForms.css'; // A new CSS file for common admin form styles
import './AdminLayout.css';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BSelect, BCheckbox } from './ui';
import BButton from './ui/BButton';

const CreateBusiness = () => {
    const navigate = useNavigate();
    const [businessName, setBusinessName] = useState('');
    const [location, setLocation] = useState('');
    const [tier, setTier] = useState('normal'); // Default tier
    const [website, setWebsite] = useState('');
    const [defaultPublicOnWall, setDefaultPublicOnWall] = useState(true); // Default to true for new businesses
    const [isLoading, setIsLoading] = useState(false);

    // Define available permissions for a business
    const availablePermissions = {
        can_create_surveys: "Create Surveys",
        can_edit_surveys: "Edit Surveys",
        can_delete_surveys: "Delete Surveys",
        can_view_survey_analytics: "View Survey Analytics",
        can_create_quests: "Create Quests",
        can_edit_quests: "Edit Quests",
        can_delete_quests: "Delete Quests",
        can_create_bug_reports: "Create Bug Reports",
        can_edit_bug_reports: "Edit Bug Reports",
        can_change_bug_status: "Change Bug Status",
        can_create_feature_requests: "Create Feature Requests",
        can_edit_feature_requests: "Edit Feature Requests",
        can_change_feature_status: "Change Feature Status",
        can_view_splash: "View Splash Page",
        can_edit_splash_page: "Edit Business Splash Page",
        can_manage_admins: "Manage Business Admins",
        can_manage_items: "Manage Feedback Items",
        // Co-Create / Ideas permissions
        can_create_ideas: "Create Ideas",
        can_review_ideas: "Review Ideas",
        can_moderate_ideas: "Moderate Ideas",
        can_archive_ideas: "Archive Ideas",
        can_view_co_create: "View Co-Create"
    };

    const [permissions, setPermissions] = useState(
        Object.keys(availablePermissions).reduce((acc, key) => {
            acc[key] = false; // Initialize all permissions to false
            return acc;
        }, {})
    );

    const handlePermissionChange = (permissionKey) => {
        setPermissions(prev => ({
            ...prev,
            [permissionKey]: !prev[permissionKey]
        }));
    };
    
    const handleSelectAllPermissions = (e) => {
        const checked = e.target.checked;
        setPermissions(
            Object.keys(availablePermissions).reduce((acc, key) => {
                acc[key] = checked;
                return acc;
            }, {})
        );
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!businessName.trim()) {
            toast.error('Business Name is required.');
            return;
        }
        setIsLoading(true);

        const businessData = {
            name: businessName,
            location,
            tier,
            website,
            permissions: permissions, // Send the permissions object
            default_public_on_wall: defaultPublicOnWall,
            // cover_image_url, logo_url, color_theme will be handled via "Edit Business" / "Edit Splash Page"
        };

        try {
            // We'll need a new endpoint in the backend, e.g., /api/businesses
            const response = await apiClient.post('/api/businesses', businessData);
            toast.success(response.data.message || 'Business created successfully!');
            navigate('/admin/business/manage'); // Navigate to manage businesses page or back to super admin dashboard
        } catch (error) {
            console.error("Error creating business:", error);
            toast.error(error.response?.data?.error || error.message || 'Failed to create business.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
                        <div className="page-container">
                    <Sidebar />
                    <div className="newmain-content33">
                <div className="form-container-card">
                    <div className="form-header">
                        <h1 className="chat-title">Create New Business</h1>
                        <p className="chat-subtitle">Register a new business entity on the Eclipseer platform.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <BFormField label="Business Name" required>
                            <BTextInput
                                id="businessName"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Enter business name"
                                required
                            />
                        </BFormField>

                        <BFormField label="Location">
                            <BTextInput
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g., City, Country"
                            />
                        </BFormField>

                        <BFormField label="Subscription Tier" required>
                            <BSelect id="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
                                <option value="normal">Normal</option>
                                <option value="advanced">Advanced</option>
                                <option value="super">Super</option>
                            </BSelect>
                        </BFormField>

                        <BFormField label="Website URL">
                            <BTextInput
                                type="url"
                                id="website"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="https://example.com"
                            />
                        </BFormField>

                        <div className="newform-group">
                            <label>Business Permissions</label>
                            <div className="permissions-grid">
                                <div className="permission-item-header">
                                     <BCheckbox 
                                        id="select_all_permissions_business"
                                        checked={Object.values(permissions).every(Boolean)}
                                        onChange={handleSelectAllPermissions}
                                        label={<span style={{fontWeight: 'bold'}}>Select All</span>}
                                     />
                                </div>
                                {Object.entries(availablePermissions).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`permission-pill ${permissions[key] ? 'permission-pill--selected' : ''}`}
                                        onClick={() => handlePermissionChange(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin')} disabled={isLoading}>
                                Cancel
                            </BButton>
                            <BButton type="submit" variant="primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Business'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateBusiness; 