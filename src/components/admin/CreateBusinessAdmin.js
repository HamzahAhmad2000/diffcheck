import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css'; // Using shared admin form styles
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BSelect, BCheckbox } from './ui';
import BButton from './ui/BButton';

const CreateBusinessAdmin = ({ presetBusinessId = null }) => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedBusinessId, setSelectedBusinessId] = useState(presetBusinessId ? String(presetBusinessId) : '');
    const [businesses, setBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);

    // Define available permissions for a Business Admin
    const availableAdminPermissions = {
        can_create_surveys: "Create Surveys (for assigned business)",
        can_edit_surveys: "Edit Surveys (for assigned business)",
        can_delete_surveys: "Delete Surveys (for assigned business)",
        can_view_survey_analytics: "View Survey Analytics (for assigned business)",
        can_create_quests: "Create Quests (for assigned business)",
        can_edit_quests: "Edit Quests (for assigned business)",
        can_delete_quests: "Delete Quests (for assigned business)",
        can_create_bug_reports: "Create Bug Reports (for assigned business)",
        can_edit_bug_reports: "Edit Bug Reports (for assigned business)",
        can_change_bug_status: "Change Bug Status (for assigned business)",
        can_create_feature_requests: "Create Feature Requests (for assigned business)",
        can_edit_feature_requests: "Edit Feature Requests (for assigned business)",
        can_change_feature_status: "Change Feature Status (for assigned business)",
        can_view_splash: "View Splash Page (for assigned business)",
        can_edit_splash_page: "Edit Assigned Business Splash Page",
        can_manage_admins: "Manage Admins within Assigned Business",
        can_manage_items: "Manage Feedback Items",
        // Co-Create / Ideas permissions
        can_create_ideas: "Create Ideas (for assigned business)",
        can_review_ideas: "Review Ideas (for assigned business)",
        can_moderate_ideas: "Moderate Ideas (for assigned business)",
        can_archive_ideas: "Archive Ideas (for assigned business)",
        can_view_co_create: "View Co-Create (for assigned business)"
    };

    const [adminPermissions, setAdminPermissions] = useState(
        Object.keys(availableAdminPermissions).reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {})
    );

    useEffect(() => {
        // If we have a preset businessId, we only need to fetch that specific business for label display
        const fetchBusinesses = async () => {
            setIsLoadingBusinesses(true);
            try {
                let resp;
                if (presetBusinessId) {
                    resp = await apiClient.get(`/api/businesses/${presetBusinessId}`);
                    setBusinesses(resp.data ? [resp.data] : []);
                } else {
                    resp = await apiClient.get('/api/businesses?is_approved=true'); 
                    setBusinesses(resp.data || []);
                }
                // If no businesses found after fetch, alert user
                const anyBusinesses = presetBusinessId ? !!resp?.data : Array.isArray(resp?.data) && resp.data.length > 0;
                if (!anyBusinesses) {
                    toast.error("No businesses found. Please create a business first to assign an admin.", { duration: 5000});
                }
            } catch (error) {
                console.error("Error fetching businesses:", error);
                toast.error(error.response?.data?.error || 'Failed to fetch businesses.');
                setBusinesses([]);
            } finally {
                setIsLoadingBusinesses(false);
            }
        };
        fetchBusinesses();
    }, []);

    const handleAdminPermissionChange = (permissionKey) => {
        setAdminPermissions(prev => ({
            ...prev,
            [permissionKey]: !prev[permissionKey]
        }));
    };
    
    const handleSelectAllAdminPermissions = (e) => {
        const checked = e.target.checked;
        setAdminPermissions(
            Object.keys(availableAdminPermissions).reduce((acc, key) => {
                acc[key] = checked;
                return acc;
            }, {})
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !password || !selectedBusinessId) {
            toast.error('Name, Email, Password, and Business selection are required.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        if (businesses.length === 0) {
            toast.error("Cannot create a business admin without an existing business. Please create a business first.");
            return;
        }

        setIsLoading(true);

        const businessAdminData = {
            name,
            username: email, 
            email,
            password,
            business_id: presetBusinessId ? parseInt(presetBusinessId) : parseInt(selectedBusinessId),
            role: 'business_admin', 
            business_admin_permissions: adminPermissions,
        };

        try {
            const response = await apiClient.post('/auth/users/business-admin', businessAdminData);
            toast.success(response.data.message || 'Business Admin created successfully!');
            if (presetBusinessId) {
                navigate(`/admin/business/${presetBusinessId}/admins/manage`);
            } else {
                navigate('/admin/users/manage');
            }
        } catch (error) {
            console.error("Error creating business admin:", error);
            toast.error(error.response?.data?.error || error.message || 'Failed to create business admin.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-form-container layout-admin-form" style={{paddingLeft: '300px'}}>
                <div className="form-container-card"> 
                    <div className="form-header">
                        <h1 className="chat-title">Create New Business Admin</h1>
                        <p className="chat-subtitle">Assign an administrator to a specific business with defined permissions.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <BFormField label="Full Name" required>
                            <BTextInput
                                id="adminName"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter admin's full name"
                                required
                            />
                        </BFormField>

                        <BFormField label="Email (will be username)" required>
                            <BTextInput
                                type="email"
                                id="adminEmail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter admin's email"
                                required
                            />
                        </BFormField>
                        <div className="form-row">
                            <BFormField label="Password" required>
                                <BTextInput
                                    type="password"
                                    id="adminPassword"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    required
                                />
                            </BFormField>
                            <BFormField label="Confirm Password" required>
                                <BTextInput
                                    type="password"
                                    id="adminConfirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm password"
                                    required
                                />
                            </BFormField>
                        </div>

                        <BFormField label="Assign to Business" required>
                            {presetBusinessId ? (
                                <p><strong>{businesses[0]?.name || 'Selected Business'}</strong></p>
                            ) : isLoadingBusinesses ? (
                                <p>Loading businesses...</p>
                            ) : businesses.length > 0 ? (
                                <BSelect
                                    id="assignedBusiness"
                                    value={selectedBusinessId}
                                    onChange={(e) => setSelectedBusinessId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select a Business --</option>
                                    {businesses.map(biz => (
                                        <option key={biz.id} value={biz.id}>
                                            {biz.name} (Tier: {biz.tier})
                                        </option>
                                    ))}
                                </BSelect>
                            ) : (
                                <p style={{color: 'red'}}>No businesses available. Create a business first.</p>
                            )}
                        </BFormField>

                        <div className="newform-group">
                            <label>Business Admin Permissions</label>
                            <div className="permissions-grid">
                                 <div className="permission-item-header">
                                      <BCheckbox 
                                         id="select_all_permissions_admin"
                                         checked={Object.values(adminPermissions).every(Boolean)}
                                         onChange={handleSelectAllAdminPermissions}
                                         label={<span style={{fontWeight: 'bold'}}>Select All</span>}
                                      />
                                </div>
                                {Object.entries(availableAdminPermissions).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`permission-pill ${adminPermissions[key] ? 'permission-pill--selected' : ''}`}
                                        onClick={() => selectedBusinessId && handleAdminPermissionChange(key)}
                                        disabled={!selectedBusinessId}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <small className="form-note" style={{marginTop: '10px', display: 'block'}}>
                                Note: A Business Admin can only be granted permissions that are also enabled for the selected Business. 
                                If a permission is selected here but not active for the Business, it will not be assigned to the admin.
                            </small>
                            { !selectedBusinessId && <small style={{color: 'orange', display: 'block', marginTop: '5px'}}>Select a business to enable permission assignment.</small> }
                        </div>

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin')} disabled={isLoading}>
                                Cancel
                            </BButton>
                            <BButton type="submit" variant="primary" disabled={isLoading || isLoadingBusinesses || businesses.length === 0}>
                                {isLoading ? 'Creating Admin...' : 'Create Business Admin'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateBusinessAdmin; 