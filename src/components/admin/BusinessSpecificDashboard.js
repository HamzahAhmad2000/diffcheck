import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import AudienceSelection from '../common/AudienceSelection';
import { businessAPI } from '../../services/apiClient';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import './BusinessSpecificDashboard.css'; // For any specific overrides or new styles

const BusinessSpecificDashboard = () => {
    const navigate = useNavigate();
    const { businessId } = useParams();
    const [business, setBusiness] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Business audience modal states
    const [showBusinessAudienceModal, setShowBusinessAudienceModal] = useState(false);
    const [businessAudienceSettings, setBusinessAudienceSettings] = useState(null);
    const [audienceLoading, setAudienceLoading] = useState(false);
    const [audienceError, setAudienceError] = useState(null);
    
    // Get user role to determine permissions
    const userRole = localStorage.getItem('userRole');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';

    const fetchBusinessDetails = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await businessAPI.getDetails(businessId);
            setBusiness(response.data);
        } catch (error) {
            console.error("Error fetching business details:", error);
            toast.error(error.response?.data?.error || `Failed to fetch details for business ID: ${businessId}.`);
            navigate('/admin/business/manage'); // Redirect if not found
        } finally {
            setIsLoading(false);
        }
    }, [businessId, navigate]);

    useEffect(() => {
        fetchBusinessDetails();
    }, [fetchBusinessDetails]);

    const handleNavigation = (path, actionType = "") => {
        if (!business) return;

        if (path) {
            // Pass businessId and businessName for context if needed by the target page
            navigate(path, { state: { businessId: business.id, businessName: business.name } });
        } else {
            console.warn(`Navigation path for ${actionType} is undefined.`);
            toast.info(`Feature '${actionType}' for ${business.name} is coming soon!`);
        }
    };

    const handleManageBusinessAudience = async () => {
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            // Load current business audience settings
            const response = await apiClient.get(`/api/businesses/${businessId}/audience`);
            setBusinessAudienceSettings(response.data);
        } catch (error) {
            console.error('Error loading business audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to load audience settings');
            setBusinessAudienceSettings({}); // Set empty settings as fallback
        } finally {
            setAudienceLoading(false);
        }
        
        setShowBusinessAudienceModal(true);
    };

    const handleSaveBusinessAudience = async (settings) => {
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            await apiClient.put(`/api/businesses/${businessId}/audience`, settings);
            toast.success('Business audience settings updated successfully!');
            setShowBusinessAudienceModal(false);
            fetchBusinessDetails(); // Refresh business details
        } catch (error) {
            console.error('Error updating business audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to update audience settings');
        } finally {
            setAudienceLoading(false);
        }
    };
    
    // Define actions a business can typically perform
    const businessActionGroups = business ? [
        {
            groupTitle: "Survey Management",
            items: [
                { label: "Create Survey for Business", icon: "ri-survey-line", path: `/admin/business/${businessId}/surveys/new`, actionKey: "can_create_surveys" },
                { label: "Manage Business Surveys", icon: "ri-list-settings-line", path: `/admin/business/${businessId}/surveys/manage`, actionKey: "can_edit_surveys" },
            ]
        },
        {
            groupTitle: "Quest Management",
            items: [
                { label: "Create Quest", icon: "ri-sword-line", path: `/admin/business/${businessId}/quests/new`, actionKey: "can_create_quests" },
                { label: "Manage Quests", icon: "ri-treasure-map-line", path: `/admin/business/${businessId}/quests`, actionKey: "can_edit_quests" },
            ]
        },
        {
            groupTitle: "Analytics & Insights", 
            items: [
                { label: "Business Analytics", icon: "ri-bar-chart-box-line", path: `/admin/business/${businessId}/analytics`, actionKey: "can_view_survey_analytics" },
            ]
        },
        {
            groupTitle: "Feedback & Reporting",
            items: [
                { label: "View All Feedback", icon: "ri-dashboard-line", path: `/admin/business/${businessId}/feedback`, actionKey: "can_view_feedback"},
                { label: "Manage Wall Posts", icon: "ri-table-line", path: `/admin/business/${businessId}/wall/manage`, actionKey: "can_edit_splash_page" },
                { label: "Submit Bug Report", icon: "ri-bug-line", path: `/business/${businessId}/report-bug`, actionKey: "can_create_bug_reports"},
                { label: "Submit Feature Request", icon: "ri-lightbulb-line", path: `/business/${businessId}/request-feature`, actionKey: "can_create_feature_requests"},
            ]
        },
        {
            groupTitle: "Business Administration",
            items: [
                // Only super admins can edit business details
                ...(isSuperAdmin ? [{ label: "Edit Business Details", icon: "ri-building-2-line", path: `/admin/business/edit/${businessId}` }] : []),
                { label: "View Splash Page", icon: "ri-eye-line", path: `/business/${businessId}`, actionKey: "can_view_splash" },
                { label: "Edit Splash Page", icon: "ri-palette-line", path: `/admin/business/${businessId}/splash-page/edit`, actionKey: "can_edit_splash_page" },
                { label: "Manage Business Admins", icon: "ri-admin-line", path: `/admin/business/${businessId}/admins/manage`, actionKey: "can_manage_admins" },
                { label: "Manage Business Wall", icon: "ri-layout-grid-line", path: `/admin/business/${businessId}/wall/manage`, actionKey: "can_edit_splash_page" },
                { label: "Manage Business Audience", icon: "ri-group-line", action: "manage_audience", actionKey: "can_edit_splash_page" },
            ]
        }
    ] : [];

    if (isLoading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content business-specific-dashboard"> 
                    <div className="loading-container">
                        <p>Loading business dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Unauthorized if business admin is trying to access another business
    if (userRole === 'business_admin' && user?.business_id && parseInt(businessId) !== user.business_id) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content business-specific-dashboard"> 
                    <div className="error-container">
                        <h2>Unauthorized</h2>
                        <p>You do not have access to this business.</p>
                        <button 
                            onClick={() => navigate('/business-admin/dashboard')}
                            className="dashboard-button"
                        >
                            <i className="ri-arrow-left-line"></i>
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!business) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content business-specific-dashboard"> 
                    <div className="error-container">
                        <p>Business not found.</p>
                        <button 
                            onClick={() => navigate('/admin/business/manage')}
                            className="dashboard-button"
                        >
                            <i className="ri-arrow-left-line"></i>
                            <span>Back to Businesses</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    const businessPermissions = business.permissions || {};

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content business-specific-dashboard">
                {/* Navigation Breadcrumb */}
                <div className="business-navigation">
                    <nav className="breadcrumb-nav">
                        {isSuperAdmin ? (
                            <>
                                <Link to="/admin" className="breadcrumb-link">
                                    <i className="ri-admin-line"></i>
                                    Admin Panel
                                </Link>
                                <span className="breadcrumb-separator">
                                    <i className="ri-arrow-right-s-line"></i>
                                </span>
                                <Link to="/admin/business/manage" className="breadcrumb-link">
                                    <i className="ri-building-line"></i>
                                    Manage Businesses
                                </Link>
                                <span className="breadcrumb-separator">
                                    <i className="ri-arrow-right-s-line"></i>
                                </span>
                            </>
                        ) : (
                            <>
                                <Link to="/business-admin/dashboard" className="breadcrumb-link">
                                    <i className="ri-dashboard-line"></i>
                                    Business Dashboard
                                </Link>
                                <span className="breadcrumb-separator">
                                    <i className="ri-arrow-right-s-line"></i>
                                </span>
                            </>
                        )}
                        <span className="breadcrumb-current">
                            <i className="ri-dashboard-3-line"></i>
                            {business.name}
                        </span>
                    </nav>
                </div>

                {/* Business Header */}
                <div className="dashboard-header">
                    <div className="business-header-info">
                        <h1 className="newchat-title">
                            <i className="ri-building-4-line"></i>
                            {business.name}
                        </h1>
                        <p className="chat-subtitle">Business Management Dashboard</p>
                        <div className="business-status-info">
                            <span className={`business-tier ${business.tier?.toLowerCase()}`}>
                                {business.tier} Tier
                            </span>
                            <span className={`business-status ${business.is_active ? 'active' : 'inactive'}`}>
                                {business.is_active ? "Active" : "Inactive"}
                            </span>
                            <span className={`business-approval ${business.is_approved ? 'approved' : 'pending'}`}>
                                {business.is_approved ? "Approved" : "Pending Approval"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Cards */}
                <div className="dashboard-grid">
                    {businessActionGroups.map((group, groupIndex) => {
                        // Filter items based on business permissions for dynamic display
                        // Super admins see all actions, business admins only see permitted actions
                        const permittedItems = group.items.filter(item => 
                            isSuperAdmin || !item.actionKey || (business.permissions && business.permissions[item.actionKey] === true)
                        );

                        return permittedItems.length > 0 && (
                            <div className="dashboard-card" key={groupIndex}>
                                <h2 className="card-title">{group.groupTitle}</h2>
                                <div className="card-actions">
                                    {permittedItems.map((action, actionIndex) => (
                                        <button
                                            key={actionIndex}
                                            className="dashboard-button"
                                            onClick={() => {
                                                if (action.action === 'manage_audience') {
                                                    handleManageBusinessAudience();
                                                } else {
                                                    handleNavigation(action.path, action.label);
                                                }
                                            }}
                                        >
                                            <i className={action.icon}></i>
                                            <span>{action.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    
                    {businessActionGroups.every(group => 
                        group.items.filter(item => isSuperAdmin || !item.actionKey || (business.permissions && business.permissions[item.actionKey] === true)).length === 0
                    ) && (
                        <div className="dashboard-card">
                            <h2 className="card-title">No Actions Available</h2>
                            <p>This business currently has no specific actions permitted or enabled. You can edit its permissions via "Manage Businesses".</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions Bar */}
                <div className="quick-actions-bar">
                    <h3>Quick Actions</h3>
                    <div className="quick-actions-grid">
                        {(isSuperAdmin || (business.permissions && business.permissions.can_create_surveys)) && (
                            <button 
                                className="quick-action-button"
                                onClick={() => navigate(`/admin/business/${businessId}/surveys/new`)}
                            >
                                <i className="ri-add-circle-line"></i>
                                <span>New Survey</span>
                            </button>
                        )}
                        {(isSuperAdmin || (business.permissions && business.permissions.can_create_bug_reports)) && (
                            <button 
                                className="quick-action-button"
                                onClick={() => navigate(`/admin/business/${businessId}/bugs`)}
                            >
                                <i className="ri-bug-line"></i>
                                <span>Report Bug</span>
                            </button>
                        )}
                        {(isSuperAdmin || (business.permissions && business.permissions.can_create_feature_requests)) && (
                            <button 
                                className="quick-action-button"
                                onClick={() => navigate(`/admin/business/${businessId}/features`)}
                            >
                                <i className="ri-lightbulb-line"></i>
                                <span>Request Feature</span>
                            </button>
                        )}
                        {isSuperAdmin && (
                            <button 
                                className="quick-action-button"
                                onClick={() => navigate(`/admin/business/edit/${businessId}`)}
                            >
                                <i className="ri-edit-line"></i>
                                <span>Edit Business</span>
                            </button>
                        )}
                        <button 
                            className="quick-action-button"
                            onClick={() => navigate(`/business/${businessId}`)}
                        >
                            <i className="ri-external-link-line"></i>
                            <span>View Public Page</span>
                        </button>
                    </div>
                </div>

                {/* Back Button */}
                <div className="back-button-container">
                    {isSuperAdmin ? (
                        <button 
                            className="back-navigation-button"
                            onClick={() => navigate('/admin/business/manage')}
                        >
                            <i className="ri-arrow-left-line"></i>
                            <span>Back to All Businesses</span>
                        </button>
                    ) : (
                        <button 
                            className="back-navigation-button"
                            onClick={() => navigate('/business-admin/dashboard')}
                        >
                            <i className="ri-arrow-left-line"></i>
                            <span>Back to Dashboard</span>
                        </button>
                    )}
                </div>

                {/* Business Audience Selection Modal */}
                {showBusinessAudienceModal && (
                    <div className="modal-backdrop" onClick={() => setShowBusinessAudienceModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="chat-title">
                                    <i className="ri-group-line"></i>
                                    Manage Business Audience
                                </h2>
                                <button 
                                    className="close-button" 
                                    onClick={() => setShowBusinessAudienceModal(false)}
                                    aria-label="Close"
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                {business && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
                                            {business.name}
                                        </h3>
                                        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                                            Configure who can access this business and its content. 
                                            {business.audience_type === 'PUBLIC' ? 
                                                ' Currently set to PUBLIC - anyone can view this business.' :
                                                ' Currently set to RESTRICTED - only specified users can access.'
                                            }
                                        </p>
                                    </div>
                                )}
                                
                                <AudienceSelection
                                    type="business"
                                    initialSettings={businessAudienceSettings || {}}
                                    onSave={handleSaveBusinessAudience}
                                    loading={audienceLoading}
                                    error={audienceError}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessSpecificDashboard; 