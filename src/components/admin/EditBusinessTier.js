import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AdminLayout from '../layouts/AdminLayout';
import { businessAPI } from '../../services/apiClient';
import './AdminForms.css';

const EditBusinessTier = () => {
    const { tierId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        monthly_response_limit: 1000,
        monthly_quest_limit: 5,
        admin_seat_limit: 1,
        ai_points_included: 50,
        can_use_ai_builder: true,
        can_use_ai_insights: true,
        can_create_surveys: true,
        can_generate_responses: true,
        can_request_featured: false,
        can_create_quests: false,
        display_order: 0,
        is_active: true
    });

    useEffect(() => {
        fetchTierData();
    }, [tierId]);

    const fetchTierData = async () => {
        try {
            setLoading(true);
            const response = await businessAPI.getBusinessTier(tierId);
            const tier = response.data.tier;
            
            setFormData({
                name: tier.name || '',
                description: tier.description || '',
                price: tier.price ? (tier.price / 100) : 0, // Convert cents to dollars
                monthly_response_limit: tier.monthly_response_limit || 1000,
                monthly_quest_limit: tier.monthly_quest_limit || 5,
                admin_seat_limit: tier.admin_seat_limit || 1,
                ai_points_included: tier.ai_points_included || 50,
                can_use_ai_builder: tier.can_use_ai_builder || false,
                can_use_ai_insights: tier.can_use_ai_insights || false,
                can_create_surveys: tier.can_create_surveys || false,
                can_generate_responses: tier.can_generate_responses || false,
                can_request_featured: tier.can_request_featured || false,
                can_create_quests: tier.can_create_quests || (tier.monthly_quest_limit > 0),
                display_order: tier.display_order || 0,
                is_active: tier.is_active || false
            });
        } catch (error) {
            console.error('Error fetching tier data:', error);
            toast.error('Failed to load tier data');
            navigate('/admin/business-tiers');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : 
                        type === 'number' ? (value === '' ? 0 : parseInt(value)) : value;
        
        setFormData(prev => {
            const updatedData = {
                ...prev,
                [name]: newValue
            };
            
            // Auto-enable quest creation when monthly quest limit is positive
            if (name === 'monthly_quest_limit') {
                updatedData.can_create_quests = newValue > 0;
            }
            
            return updatedData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            toast.error('Tier name is required');
            return;
        }

        if (formData.price < 0) {
            toast.error('Price cannot be negative');
            return;
        }

        try {
            setSubmitting(true);
            
            // Convert price to cents for backend
            const submitData = {
                ...formData,
                price: Math.round(formData.price * 100) // Convert dollars to cents
            };

            await businessAPI.updateBusinessTier(tierId, submitData);
            toast.success('Business tier updated successfully!');
            navigate('/admin/business-tiers');
        } catch (error) {
            console.error('Error updating business tier:', error);
            toast.error(error.response?.data?.error || 'Failed to update business tier');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/business-tiers');
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="admin-content">
                    <div className="loading-container">
                        <i className="ri-loader-4-line spinning"></i>
                        <span>Loading tier data...</span>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="admin-content">
                <div className="admin-header">
                    <div className="admin-header-content">
                        <h1 className="admin-title">
                            <i className="ri-edit-line"></i>
                            Edit Business Tier
                        </h1>
                        <p className="admin-subtitle">Modify subscription tier pricing and feature limits.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="admin-form">
                    {/* Basic Information */}
                    <div className="admin-form-section">
                        <h3>Basic Information</h3>
                        
                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Tier Name*</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Professional, Enterprise"
                                    required
                                />
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Display Order</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="display_order"
                                    value={formData.display_order}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">Description</label>
                            <textarea
                                className="admin-form-textarea"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Brief description of this tier's benefits"
                                rows="3"
                            />
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="admin-form-section">
                        <h3>Pricing</h3>
                        
                        <div className="admin-form-group">
                            <label className="admin-form-label">Monthly Price (USD)*</label>
                            <input
                                type="number"
                                className="admin-form-input"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <small className="admin-form-help">Enter 0 for free tier. Price in dollars (will be converted to cents).</small>
                        </div>
                    </div>

                    {/* Usage Limits */}
                    <div className="admin-form-section">
                        <h3>Usage Limits</h3>
                        
                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Monthly Response Limit*</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="monthly_response_limit"
                                    value={formData.monthly_response_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="1000"
                                />
                                <small className="admin-form-help">Use -1 for unlimited responses</small>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Monthly Quest Limit*</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="monthly_quest_limit"
                                    value={formData.monthly_quest_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="5"
                                />
                                <small className="admin-form-help">Use -1 for unlimited quests</small>
                            </div>
                        </div>

                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Admin Seat Limit*</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="admin_seat_limit"
                                    value={formData.admin_seat_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="1"
                                />
                                <small className="admin-form-help">Use -1 for unlimited admin seats</small>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">AI Points Included</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="ai_points_included"
                                    value={formData.ai_points_included}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="50"
                                />
                                <small className="admin-form-help">AI points included with this tier per month</small>
                            </div>
                        </div>
                    </div>

                    {/* Feature Permissions */}
                    <div className="admin-form-section">
                        <h3>Feature Permissions</h3>
                        
                        <div className="admin-checkbox-grid">
                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_use_ai_builder"
                                    checked={formData.can_use_ai_builder}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>AI Survey Builder</strong>
                                    <span>Allow use of AI-powered survey creation tools</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_use_ai_insights"
                                    checked={formData.can_use_ai_insights}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>AI Insights & Analytics</strong>
                                    <span>Enable AI-powered response analysis and insights</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_create_surveys"
                                    checked={formData.can_create_surveys}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Create Surveys</strong>
                                    <span>Basic survey creation capabilities</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_generate_responses"
                                    checked={formData.can_generate_responses}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Generate Test Responses</strong>
                                    <span>AI-powered test response generation</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_request_featured"
                                    checked={formData.can_request_featured}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Featured Content Requests</strong>
                                    <span>Ability to request featured placement on platform</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="can_create_quests"
                                    checked={formData.can_create_quests}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Create Quests</strong>
                                    <span>Allow businesses on this tier to create quests</span>
                                </div>
                            </label>

                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Active Tier</strong>
                                    <span>Make this tier available for businesses to select</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="admin-form-actions">
                        <button
                            type="button"
                            className="admin-button admin-button--secondary"
                            onClick={handleCancel}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="admin-button admin-button--primary"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <i className="ri-loader-4-line spinning"></i>
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <i className="ri-save-line"></i>
                                    Update Business Tier
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
};

export default EditBusinessTier; 