import React, { useState, useEffect } from 'react';
import { referralAdminAPI, businessAPI, adminAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';
import '../../styles/b_admin_styling.css';

const AffiliateModal = ({ affiliate, onClose, defaultSettings }) => {
    const [loading, setLoading] = useState(false);
    const [usersLoading, setUsersLoading] = useState(false);
    const [businessesLoading, setBusinessesLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        user_id: null,
        business_id: null,
        custom_user_reward_xp: null,
        custom_new_user_bonus_xp: null,
        assigned_tag: '',
        assigned_xp_user_id: null,
        commission_rate: 0.0,
        expires_at: '',
        is_active: true
    });
    
    const [users, setUsers] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [businessSearch, setBusinessSearch] = useState('');

    const isEditing = !!affiliate;

    // Initialize form data
    useEffect(() => {
        if (affiliate) {
            setFormData({
                name: affiliate.name || '',
                description: affiliate.description || '',
                user_id: affiliate.user_id || null,
                business_id: affiliate.business_id || null,
                custom_user_reward_xp: affiliate.custom_user_reward_xp,
                custom_new_user_bonus_xp: affiliate.custom_new_user_bonus_xp,
                assigned_tag: affiliate.assigned_tag || '',
                assigned_xp_user_id: affiliate.assigned_xp_user_id || null,
                commission_rate: affiliate.commission_rate || 0.0,
                expires_at: affiliate.expires_at ? affiliate.expires_at.split('T')[0] : '',
                is_active: affiliate.is_active !== false
            });
        }
    }, [affiliate]);

    // Fetch users for dropdown
    const fetchUsers = async (search = '') => {
        setUsersLoading(true);
        try {
            const response = await adminAPI.getAllUsers({ 
                search,
                per_page: 50 
            });
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    };

    // Fetch businesses for dropdown
    const fetchBusinesses = async (search = '') => {
        setBusinessesLoading(true);
        try {
            const response = await businessAPI.listAll({ 
                search,
                per_page: 50 
            });
            setBusinesses(response.data.businesses || []);
        } catch (error) {
            console.error('Error fetching businesses:', error);
            toast.error('Failed to load businesses');
        } finally {
            setBusinessesLoading(false);
        }
    };

    // Load initial data
    useEffect(() => {
        fetchUsers();
        fetchBusinesses();
    }, []);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate form
            if (!formData.name.trim()) {
                toast.error('Name is required');
                return;
            }

            // Prepare data for submission
            const submitData = {
                ...formData,
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                user_id: formData.user_id || null,
                business_id: formData.business_id || null,
                custom_user_reward_xp: formData.custom_user_reward_xp || null,
                custom_new_user_bonus_xp: formData.custom_new_user_bonus_xp || null,
                assigned_tag: formData.assigned_tag.trim() || null,
                assigned_xp_user_id: formData.assigned_xp_user_id || null,
                commission_rate: parseFloat(formData.commission_rate) || 0.0,
                expires_at: formData.expires_at || null
            };

            // Ensure only one owner type is set
            if (submitData.user_id && submitData.business_id) {
                toast.error('Please select either a user or business owner, not both');
                return;
            }

            let response;
            if (isEditing) {
                response = await referralAdminAPI.updateAffiliateLink(affiliate.id, submitData);
                toast.success('Affiliate link updated successfully!');
            } else {
                response = await referralAdminAPI.createAffiliateLink(submitData);
                toast.success('Affiliate link created successfully!');
            }

            onClose(true); // Close modal and refresh parent
        } catch (error) {
            console.error('Error saving affiliate link:', error);
            toast.error(error.response?.data?.error || 'Failed to save affiliate link');
        } finally {
            setLoading(false);
        }
    };

    // Handle input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle owner selection
    const handleOwnerChange = (type, value) => {
        if (type === 'user') {
            setFormData(prev => ({
                ...prev,
                user_id: value,
                business_id: null // Clear business when user is selected
            }));
        } else if (type === 'business') {
            setFormData(prev => ({
                ...prev,
                business_id: value,
                user_id: null // Clear user when business is selected
            }));
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container large-modal">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {isEditing ? 'Edit Affiliate Link' : 'Create New Affiliate Link'}
                    </h2>
                    <button 
                        onClick={() => onClose(false)} 
                        className="modal-close-btn"
                        disabled={loading}
                    >
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-content">
                    <div className="form-grid">
                        {/* Basic Information */}
                        <div className="form-section">
                            <h3 className="form-section-title">Basic Information</h3>
                            
                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Name *
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="b_admin_styling-input"
                                        placeholder="e.g., TechCrunch Partnership"
                                        required
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Description
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                        className="b_admin_styling-textarea"
                                        placeholder="Internal notes about this affiliate link..."
                                        rows="3"
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                                        className="b_admin_styling-checkbox"
                                        disabled={loading}
                                    />
                                    Active
                                </label>
                            </div>
                        </div>

                        {/* Owner Assignment */}
                        <div className="form-section">
                            <h3 className="form-section-title">Owner Assignment</h3>
                            <p className="form-section-description">
                                Assign this link to a specific user or business (optional)
                            </p>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Assign to User
                                    <select
                                        value={formData.user_id || ''}
                                        onChange={(e) => handleOwnerChange('user', e.target.value || null)}
                                        className="b_admin_styling-select"
                                        disabled={loading || usersLoading}
                                    >
                                        <option value="">Select a user...</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.name} ({user.email})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {usersLoading && <BLoading variant="inline" size="sm" />}
                            </div>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Assign to Business
                                    <select
                                        value={formData.business_id || ''}
                                        onChange={(e) => handleOwnerChange('business', e.target.value || null)}
                                        className="b_admin_styling-select"
                                        disabled={loading || businessesLoading}
                                    >
                                        <option value="">Select a business...</option>
                                        {businesses.map(business => (
                                            <option key={business.id} value={business.id}>
                                                {business.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {businessesLoading && <BLoading variant="inline" size="sm" />}
                            </div>
                        </div>

                        {/* Reward Configuration */}
                        <div className="form-section">
                            <h3 className="form-section-title">Reward Configuration</h3>
                            <p className="form-section-description">
                                Leave blank to use default values ({defaultSettings.user_reward_xp} / {defaultSettings.new_user_bonus_xp} XP)
                            </p>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Custom XP for Affiliate
                                    <input
                                        type="number"
                                        value={formData.custom_user_reward_xp || ''}
                                        onChange={(e) => handleInputChange('custom_user_reward_xp', e.target.value ? parseInt(e.target.value) : null)}
                                        className="b_admin_styling-input"
                                        placeholder={`Default: ${defaultSettings.user_reward_xp}`}
                                        min="0"
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Custom Bonus XP for New User
                                    <input
                                        type="number"
                                        value={formData.custom_new_user_bonus_xp || ''}
                                        onChange={(e) => handleInputChange('custom_new_user_bonus_xp', e.target.value ? parseInt(e.target.value) : null)}
                                        className="b_admin_styling-input"
                                        placeholder={`Default: ${defaultSettings.new_user_bonus_xp}`}
                                        min="0"
                                        disabled={loading}
                                    />
                                </label>
                            </div>

                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Commission Rate (%)
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.commission_rate}
                                        onChange={(e) => handleInputChange('commission_rate', parseFloat(e.target.value) || 0)}
                                        className="b_admin_styling-input"
                                        placeholder="0.00"
                                        min="0"
                                        max="100"
                                        disabled={loading}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Tag Assignment */}
                        <div className="form-section">
                            <h3 className="form-section-title">Tag Assignment</h3>
                            <p className="form-section-description">
                                Automatically assign a tag to users who sign up with this link
                            </p>
                            
                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Assigned Tag
                                    <input
                                        type="text"
                                        value={formData.assigned_tag}
                                        onChange={(e) => handleInputChange('assigned_tag', e.target.value)}
                                        className="b_admin_styling-input"
                                        placeholder="e.g., Galvan AI, TechCrunch"
                                        disabled={loading}
                                    />
                                </label>
                                <small className="form-help-text">
                                    This tag will be added to all users who sign up using this link
                                </small>
                            </div>
                        </div>

                        {/* XP Recipient */}
                        <div className="form-section">
                            <h3 className="form-section-title">XP Recipient</h3>
                            <p className="form-section-description">
                                Specify which user should receive XP for conversions (optional)
                            </p>
                            
                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    XP Recipient User
                                    <select
                                        value={formData.assigned_xp_user_id || ''}
                                        onChange={(e) => handleInputChange('assigned_xp_user_id', e.target.value || null)}
                                        className="b_admin_styling-select"
                                        disabled={loading || usersLoading}
                                    >
                                        <option value="">Use link owner (default)</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.name} ({user.email})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <small className="form-help-text">
                                    If not specified, XP will go to the link owner
                                </small>
                            </div>
                        </div>

                        {/* Expiration */}
                        <div className="form-section">
                            <h3 className="form-section-title">Expiration</h3>
                            
                            <div className="form-field">
                                <label className="b_admin_styling-label">
                                    Expires At (Optional)
                                    <input
                                        type="date"
                                        value={formData.expires_at}
                                        onChange={(e) => handleInputChange('expires_at', e.target.value)}
                                        className="b_admin_styling-input"
                                        disabled={loading}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </label>
                                <small className="form-help-text">
                                    Leave blank for no expiration
                                </small>
                            </div>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <BButton
                            type="button"
                            variant="secondary"
                            onClick={() => onClose(false)}
                            disabled={loading}
                        >
                            Cancel
                        </BButton>
                        <BButton
                            type="submit"
                            variant="primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <BLoading variant="inline" size="sm" />
                                    {isEditing ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    <i className={`ri-${isEditing ? 'save' : 'add'}-line`}></i>
                                    {isEditing ? 'Update Link' : 'Create Link'}
                                </>
                            )}
                        </BButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AffiliateModal;
