import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AdminLayout from '../layouts/AdminLayout';
import { businessAPI } from '../../services/apiClient';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';

const EditAIPointsPackage = () => {
    const { packageId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchPackageData();
    }, [packageId]);

    const fetchPackageData = async () => {
        try {
            setLoading(true);
            const response = await businessAPI.getAIPointsPackage(packageId);
            const pkg = response.data.package;
            
            setFormData({
                name: pkg.name || '',
                description: pkg.description || '',
                points: pkg.points || 1000,
                price: pkg.price || 999,
                bonus_points: pkg.bonus_points || 0,
                is_popular: pkg.is_popular || false,
                display_order: pkg.display_order || 0,
                is_active: pkg.is_active || false
            });
        } catch (error) {
            console.error('Error fetching package data:', error);
            toast.error('Failed to load package data');
            navigate('/admin/ai-points-packages');
        } finally {
            setLoading(false);
        }
    };

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
            
            await businessAPI.updateAIPointsPackage(packageId, formData);
            toast.success('AI Points package updated successfully!');
            navigate('/admin/ai-points-packages');
        } catch (error) {
            console.error('Error updating AI points package:', error);
            toast.error(error.response?.data?.error || 'Failed to update AI points package');
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

    if (loading) {
        return (
            <AdminLayout>
                <div className="admin-content">
                    <div className="loading-container">
                        <i className="ri-loader-4-line spinning"></i>
                        <span>Loading package data...</span>
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
                            Edit AI Points Package
                        </h1>
                        <p className="admin-subtitle">Modify AI points package pricing and configuration.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="admin-form">
                    {/* Basic Information */}
                    <div className="admin-form-section">
                        <h3>Basic Information</h3>
                        
                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Package Name*</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Starter Pack, Pro Bundle"
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
                                placeholder="Brief description of this package's value"
                                rows="3"
                            />
                        </div>
                    </div>

                    {/* Package Details */}
                    <div className="admin-form-section">
                        <h3>Package Details</h3>
                        
                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">AI Points*</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="points"
                                    value={formData.points}
                                    onChange={handleInputChange}
                                    min="1"
                                    placeholder="1000"
                                    required
                                />
                                <small className="admin-form-help">Base AI points included in this package</small>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Bonus Points</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    name="bonus_points"
                                    value={formData.bonus_points}
                                    onChange={handleInputChange}
                                    min="0"
                                    placeholder="0"
                                />
                                <small className="admin-form-help">Additional bonus points for this package</small>
                            </div>
                        </div>

                        <div className="admin-form-grid">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Price (USD)*</label>
                                <input
                                    type="number"
                                    className="admin-form-input"
                                    step="0.01"
                                    min="0"
                                    value={(formData.price / 100).toFixed(2)}
                                    onChange={handlePriceChange}
                                    placeholder="9.99"
                                />
                                <small className="admin-form-help">Price in USD (e.g., 9.99 for $9.99)</small>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Value Per Point</label>
                                <div className="admin-calculated-value">
                                    ${calculateValuePerPoint()}/point
                                </div>
                                <small className="admin-form-help">Calculated: Total points = {formData.points + formData.bonus_points}</small>
                            </div>
                        </div>
                    </div>

                    {/* Package Settings */}
                    <div className="admin-form-section">
                        <h3>Package Settings</h3>
                        
                        <div className="admin-checkbox-grid">
                            <label className="admin-checkbox">
                                <input
                                    type="checkbox"
                                    name="is_popular"
                                    checked={formData.is_popular}
                                    onChange={handleInputChange}
                                />
                                <span className="checkmark"></span>
                                <div className="admin-checkbox-content">
                                    <strong>Popular Package</strong>
                                    <span>Mark this package as "Most Popular" for promotional purposes</span>
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
                                    <strong>Active Package</strong>
                                    <span>Make this package available for purchase</span>
                                </div>
                            </label>
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
                        {submitting ? 'Updating...' : (
                            <>
                                <i className="ri-save-line"></i>
                                Update AI Points Package
                            </>
                        )}
                    </BButton>
                </div>
                </form>
            </div>
        </AdminLayout>
    );
};

export default EditAIPointsPackage; 