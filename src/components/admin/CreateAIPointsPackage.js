import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AdminLayout from '../layouts/AdminLayout';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BSelect, BCheckbox } from './ui';
import BButton from './ui/BButton';
import { businessAPI } from '../../services/apiClient';
import './AdminForms.css';

const CreateAIPointsPackage = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        points: 1000,
        price: 999, // Price in cents
        bonus_points: 0,
        is_popular: false,
        display_order: 0,
        is_active: true
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : 
                   type === 'number' ? (value === '' ? 0 : parseInt(value)) : value
        }));
    };

    const handlePriceChange = (e) => {
        const dollarValue = parseFloat(e.target.value) || 0;
        setFormData(prev => ({
            ...prev,
            price: Math.round(dollarValue * 100) // Convert to cents
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            toast.error('Package name is required');
            return;
        }

        if (formData.points <= 0) {
            toast.error('Points must be greater than 0');
            return;
        }

        if (formData.price < 0) {
            toast.error('Price cannot be negative');
            return;
        }

        try {
            setSubmitting(true);
            
            await businessAPI.createAIPointsPackage(formData);
            toast.success('AI Points package created successfully!');
            navigate('/admin/ai-points-packages');
        } catch (error) {
            console.error('Error creating AI points package:', error);
            toast.error(error.response?.data?.error || 'Failed to create AI points package');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/ai-points-packages');
    };

    const calculateValuePerPoint = () => {
        const totalPoints = formData.points + formData.bonus_points;
        if (totalPoints > 0 && formData.price > 0) {
            return (formData.price / 100 / totalPoints).toFixed(4);
        }
        return '0.0000';
    };

    return (
        
            <div className="admin-content">
                <div className="admin-header">
                    <div className="admin-header-content">
                        <h1 className="admin-title">
                            <i className="ri-add-circle-line"></i>
                            Create AI Points Package
                        </h1>
                        <p className="admin-subtitle">Configure a new AI points package for businesses to purchase.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="admin-form">
                    {/* Basic Information */}
                    <div className="admin-form-section">
                        <h3>Basic Information</h3>
                        
                        <div className="admin-form-grid">
                            <BFormField label="Package Name" required>
                                <BTextInput
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Starter Pack, Pro Bundle"
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
                                placeholder="Brief description of this package's value"
                                rows={3}
                            />
                        </BFormField>
                    </div>

                    {/* Package Details */}
                    <div className="admin-form-section">
                        <h3>Package Details</h3>
                        
                        <div className="admin-form-grid">
                            <BFormField label="AI Points" required hint="Base AI points included in this package">
                                <BTextInput
                                    type="number"
                                    name="points"
                                    value={formData.points}
                                    onChange={handleInputChange}
                                    min="1"
                                    placeholder="1000"
                                    required
                                />
                            </BFormField>
                            <BFormField label="Bonus Points" hint="Additional bonus points for this package">
                                <BTextInput
                                    type="number"
                                    name="bonus_points"
                                    value={formData.bonus_points}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="0"
                                />
                            </BFormField>
                        </div>

                        <div className="admin-form-grid">
                            <BFormField label="Price (USD)" required hint="Price in USD (e.g., 9.99 for $9.99)">
                                <BTextInput
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={(formData.price / 100).toFixed(2)}
                                    onChange={handlePriceChange}
                                    placeholder="9.99"
                                />
                            </BFormField>
                            <BFormField label="Value Per Point" hint={`Calculated: Total points = ${formData.points + formData.bonus_points}`}>
                                <div className="admin-calculated-value">
                                    ${calculateValuePerPoint()}/point
                                </div>
                            </BFormField>
                        </div>
                    </div>

                    {/* Package Settings */}
                    <div className="admin-form-section">
                        <h3>Package Settings</h3>
                        <div className="admin-checkbox-grid">
                            <BCheckbox
                              name="is_popular"
                              checked={formData.is_popular}
                              onChange={handleInputChange}
                              label={
                                <span className="admin-checkbox-content"><strong>Popular Package</strong> <span>Mark this package as "Most Popular" for promotional purposes</span></span>
                              }
                            />
                            <BCheckbox
                              name="is_active"
                              checked={formData.is_active}
                              onChange={handleInputChange}
                              label={
                                <span className="admin-checkbox-content"><strong>Active Package</strong> <span>Make this package available for purchase</span></span>
                              }
                            />
                        </div>
                    </div>

                    {/* Package Preview */}
                    <div className="admin-form-section">
                        <h3>Package Preview</h3>
                        <div className="admin-package-preview">
                            <div className="admin-preview-card">
                                <h4>{formData.name || 'Package Name'}</h4>
                                <div className="admin-preview-price">${(formData.price / 100).toFixed(2)}</div>
                                <div className="admin-preview-points">
                                    {formData.points.toLocaleString()} AI Points
                                    {formData.bonus_points > 0 && (
                                        <span className="admin-preview-bonus"> +{formData.bonus_points.toLocaleString()} Bonus</span>
                                    )}
                                </div>
                                {formData.is_popular && <div className="admin-preview-badge">⭐ Most Popular</div>}
                                <div className="admin-preview-description">{formData.description || 'Package description...'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="admin-form-actions">
                        <BButton
                            type="button"
                            variant="secondary"
                            onClick={handleCancel}
                            disabled={submitting}
                        >
                            Cancel
                        </BButton>
                        <BButton
                            type="submit"
                            variant="primary"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <i className="ri-loader-4-line spinning"></i>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <i className="ri-save-line"></i>
                                    Create AI Points Package
                                </>
                            )}
                        </BButton>
                    </div>
                </form>
            </div>
        
    );
};

export default CreateAIPointsPackage; 