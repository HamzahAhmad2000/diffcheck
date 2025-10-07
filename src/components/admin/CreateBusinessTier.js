import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AdminLayout from '../layouts/AdminLayout';
import { businessAPI } from '../../services/apiClient';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BCheckbox } from './ui';
import BButton from './ui/BButton';

const CreateBusinessTier = () => {
    const navigate = useNavigate();
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
        can_create_quests: formData.monthly_quest_limit > 0,
        display_order: 0,
        is_active: true
    });

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

            await businessAPI.createBusinessTier(submitData);
            toast.success('Business tier created successfully!');
            navigate('/admin/business-tiers');
        } catch (error) {
            console.error('Error creating business tier:', error);
            toast.error(error.response?.data?.error || 'Failed to create business tier');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/business-tiers');
    };

    return (
        
            <div className="newmain-content33 admin-content">
                <div className="admin-header">
                    <div className="admin-header-content">
                        <h1 className="admin-title">
                            <i className="ri-add-circle-line"></i>
                            Create Business Tier
                        </h1>
                        <p className="admin-subtitle">Configure a new subscription tier with pricing and feature limits.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="admin-form">
                    {/* Basic Information */}
                    <div className="admin-form-section">
                        <h3>Basic Information</h3>
                        
                        <div className="admin-form-grid">
                            <BFormField label="Tier Name" required>
                                <BTextInput
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Professional, Enterprise"
                                    required
                                />
                            </BFormField>
                            <BFormField label="Display Order">
                                <BTextInput
                                    type="number"
                                    name="display_order"
                                    value={formData.display_order}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="0"
                                />
                            </BFormField>
                        </div>

                        <BFormField label="Description">
                            <BTextarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Brief description of this tier's benefits"
                                rows={3}
                            />
                        </BFormField>
                    </div>

                    {/* Pricing */}
                    <div className="admin-form-section">
                        <h3>Pricing</h3>
                        
                        <BFormField label="Monthly Price (USD)" required hint="Enter 0 for free tier. Price in dollars (will be converted to cents).">
                            <BTextInput
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                        </BFormField>
                    </div>

                    {/* Usage Limits */}
                    <div className="admin-form-section">
                        <h3>Usage Limits</h3>
                        
                        <div className="admin-form-grid">
                            <BFormField label="Monthly Response Limit" hint="Use -1 for unlimited responses">
                                <BTextInput
                                    type="number"
                                    name="monthly_response_limit"
                                    value={formData.monthly_response_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="1000"
                                />
                            </BFormField>
                            <BFormField label="Monthly Quest Limit" hint="Use -1 for unlimited quests">
                                <BTextInput
                                    type="number"
                                    name="monthly_quest_limit"
                                    value={formData.monthly_quest_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="5"
                                />
                            </BFormField>
                        </div>

                        <div className="admin-form-grid">
                            <BFormField label="Admin Seat Limit" hint="Use -1 for unlimited admin seats">
                                <BTextInput
                                    type="number"
                                    name="admin_seat_limit"
                                    value={formData.admin_seat_limit}
                                    onChange={handleInputChange}
                                    min="-1"
                                    placeholder="1"
                                />
                            </BFormField>
                            <BFormField label="AI Points Included" hint="AI points included with this tier per month">
                                <BTextInput
                                    type="number"
                                    name="ai_points_included"
                                    value={formData.ai_points_included}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="50"
                                />
                            </BFormField>
                        </div>
                    </div>

                    {/* Feature Permissions */}
                    <div className="admin-form-section">
                        <h3>Feature Permissions</h3>
                        
                        <div className="admin-checkbox-grid">
                            <BCheckbox
                              name="can_use_ai_builder"
                              checked={formData.can_use_ai_builder}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>AI Survey Builder</strong> <span>Allow use of AI-powered survey creation tools</span></span>}
                            />
                            <BCheckbox
                              name="can_use_ai_insights"
                              checked={formData.can_use_ai_insights}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>AI Insights & Analytics</strong> <span>Enable AI-powered response analysis and insights</span></span>}
                            />
                            <BCheckbox
                              name="can_create_surveys"
                              checked={formData.can_create_surveys}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>Create Surveys</strong> <span>Basic survey creation capabilities</span></span>}
                            />
                            <BCheckbox
                              name="can_generate_responses"
                              checked={formData.can_generate_responses}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>Generate Test Responses</strong> <span>AI-powered test response generation</span></span>}
                            />
                            <BCheckbox
                              name="can_request_featured"
                              checked={formData.can_request_featured}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>Featured Content Requests</strong> <span>Ability to request featured placement on platform</span></span>}
                            />
                            <BCheckbox
                              name="can_create_quests"
                              checked={formData.can_create_quests}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>Create Quests</strong> <span>Allow businesses on this tier to create quests</span></span>}
                            />
                            <BCheckbox
                              name="is_active"
                              checked={formData.is_active}
                              onChange={handleInputChange}
                              label={<span className="admin-checkbox-content"><strong>Active Tier</strong> <span>Make this tier available for businesses to select</span></span>}
                            />
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="admin-form-actions">
                        <BButton type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
                            Cancel
                        </BButton>
                        <BButton type="submit" variant="primary" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <i className="ri-loader-4-line spinning"></i>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <i className="ri-save-line"></i>
                                    Create Business Tier
                                </>
                            )}
                        </BButton>
                    </div>
                </form>
            </div>
        
    );
};

export default CreateBusinessTier; 