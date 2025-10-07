import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../marketplace/MarketplacePage.css'; // Using marketplace styles
import './DeliveryForm.css'; // Custom delivery form styles
import '../../styles/userStyles.css';

const DeliveryForm = () => {
    const navigate = useNavigate();
    const { purchaseId } = useParams();
    const [loading, setLoading] = useState(false);
    const [purchaseDetails, setPurchaseDetails] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '',
        phone_number: '',
        email: '',
        address: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: '',
        billing_same_as_delivery: true,
        billing_address: '',
        billing_city: '',
        billing_state_province: '',
        billing_postal_code: '',
        billing_country: '',
        delivery_notes: ''
    });
    const [imageError, setImageError] = useState(false);

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) return '';
        if (
            relativeOrAbsoluteUrl.startsWith('http://') ||
            relativeOrAbsoluteUrl.startsWith('https://') ||
            relativeOrAbsoluteUrl.startsWith('data:')
        ) {
            return relativeOrAbsoluteUrl;
        }
        const clean = relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
        return `${baseURL}${clean}`;
    };

    useEffect(() => {
        if (purchaseId) {
            fetchPurchaseDetails();
        }
    }, [purchaseId]);

    const fetchPurchaseDetails = async () => {
        try {
            setLoading(true);
            const response = await purchaseAPI.getPurchaseDetails(purchaseId);
            setPurchaseDetails(response.data);
            
            // Pre-fill email from user data if available
            if (response.data) {
                setFormData(prev => ({
                    ...prev,
                    email: response.data.user_email || ''
                }));
            }
        } catch (error) {
            console.error('Error fetching purchase details:', error);
            toast.error('Failed to load purchase details.');
            navigate('/user/marketplace');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await purchaseAPI.submitDeliveryInfo(purchaseId, formData);
            
            toast.success(response.data.message || 'Order placed successfully!');
            
            // Navigate to confirmation screen or marketplace
            navigate('/user/marketplace');
            
        } catch (error) {
            console.error('Error submitting delivery info:', error);
            toast.error(error.response?.data?.error || 'Failed to submit delivery information.');
        } finally {
            setLoading(false);
        }
    };

    const countries = [
        'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
        'France', 'Japan', 'South Korea', 'India', 'Brazil', 'Mexico', 'Other'
    ];

    if (loading && !purchaseDetails) {
        return (
            <div className="app-layout">
                <main className="main-content12" style={{ marginLeft: '100px' }}>
                    <div className="page-inner-container">
                        <div className="user-loading-indicator">
                            <div className="user-loading-spinner"></div>
                            <p>Loading Purchase Details...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="page-inner-container">
                    <div className="surveys-subheader">
                        <button
                            className="page-header__back-button page-header__back-button--primary"
                            onClick={() => navigate('/user/marketplace')}
                        >
                            <i className="ri-arrow-left-s-line"></i> Back to Marketplace
                        </button>
                    </div>

                    <div className="surveys-separator"></div>

                    {purchaseDetails && (
                        <div className="purchase-summary-section">
                            <div className="settings-section">
                                <h2 className="settings-section__title">Order Summary</h2>
                                <div className="settings-section__content">
                                    <div className="dashboard-item dashboard-marketplace-item" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {purchaseDetails?.item?.image_url && !imageError && (
                                            <img
                                                src={getFullImageUrl(purchaseDetails.item.image_url)}
                                                alt={purchaseDetails.item_title || 'Item image'}
                                                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '1px solid #4e4e4e' }}
                                                onError={() => setImageError(true)}
                                            />
                                        )}
                                        <div className="dashboard-item__info">
                                            <h4>{purchaseDetails.item_title}</h4>
                                            <div className="xp-highlight">
                                                <i className="ri-copper-coin-fill"></i>
                                                {purchaseDetails.xp_spent?.toLocaleString() || 0} XP
                                            </div>
                                            {purchaseDetails.is_raffle_win && (
                                                <div className="marketplace-item-badge raffle">
                                                    🎉 Raffle Winner!
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="settings-section__message">
                                        Please provide your delivery details to complete your order. Payment has already been processed using your XP.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="settings-sections">
                        <form onSubmit={handleSubmit}>
                            {/* Personal Information Section */}
                            <div className="settings-section">
                                <h2 className="settings-section__title">Personal Information</h2>
                                <div className="settings-section__content">
                                    {/* Removed item image box from personal information section to declutter */}
                                    <div className="settings-section__grid">
                                        <div className="settings-input-group">
                                            <label htmlFor="full_name">Full Name *</label>
                                            <input
                                                type="text"
                                                id="full_name"
                                                name="full_name"
                                                value={formData.full_name}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Enter your full name"
                                            />
                                        </div>
                                        
                                        <div className="settings-input-group">
                                            <label htmlFor="phone_number">Phone Number *</label>
                                            <input
                                                type="tel"
                                                id="phone_number"
                                                name="phone_number"
                                                value={formData.phone_number}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Enter your phone number"
                                            />
                                        </div>
                                    </div>

                                    <div className="settings-input-group">
                                        <label htmlFor="email">Email Address *</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Enter your email address"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Address Section */}
                            <div className="settings-section">
                                <h2 className="settings-section__title">Delivery Address</h2>
                                <div className="settings-section__content">
                                    <div className="settings-input-group">
                                        <label htmlFor="address">Street Address *</label>
                                        <textarea
                                            className="delivery-form-textarea"
                                            id="address"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleInputChange}
                                            required
                                            rows={3}
                                            placeholder="Enter your complete address"
                                        />
                                    </div>

                                    <div className="settings-section__grid">
                                        <div className="settings-input-group">
                                            <label htmlFor="city">City *</label>
                                            <input
                                                type="text"
                                                id="city"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Enter your city"
                                            />
                                        </div>
                                        
                                        <div className="settings-input-group">
                                            <label htmlFor="state_province">State/Province *</label>
                                            <input
                                                type="text"
                                                id="state_province"
                                                name="state_province"
                                                value={formData.state_province}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Enter your state/province"
                                            />
                                        </div>
                                    </div>

                                    <div className="settings-section__grid">
                                        <div className="settings-input-group">
                                            <label htmlFor="postal_code">Postal/Zip Code *</label>
                                            <input
                                                type="text"
                                                id="postal_code"
                                                name="postal_code"
                                                value={formData.postal_code}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Enter postal/zip code"
                                            />
                                        </div>
                                        
                                        <div className="settings-input-group">
                                            <label htmlFor="country">Country *</label>
                                            <select
                                                id="country"
                                                name="country"
                                                value={formData.country}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">Select Country</option>
                                                {countries.map(country => (
                                                    <option key={country} value={country}>{country}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Address Section */}
                            <div className="settings-section">
                                <h2 className="settings-section__title">Billing Address</h2>
                                <div className="settings-section__content">
                                    <div className="settings-input-group">
                                        <label className="checkbox-label billing-address-dark">
                                            <input
                                                type="checkbox"
                                                name="billing_same_as_delivery"
                                                checked={formData.billing_same_as_delivery}
                                                onChange={handleInputChange}
                                            />
                                            <span className="checkbox-text">Billing address is the same as delivery address</span>
                                        </label>
                                    </div>

                                    {!formData.billing_same_as_delivery && (
                                        <>
                                            <div className="settings-input-group">
                                                <label htmlFor="billing_address">Billing Street Address *</label>
                                                <textarea
                                                    className="delivery-form-textarea"
                                                    id="billing_address"
                                                    name="billing_address"
                                                    value={formData.billing_address}
                                                    onChange={handleInputChange}
                                                    required={!formData.billing_same_as_delivery}
                                                    rows={3}
                                                    placeholder="Enter billing address"
                                                />
                                            </div>

                                            <div className="settings-section__grid">
                                                <div className="settings-input-group">
                                                    <label htmlFor="billing_city">Billing City *</label>
                                                    <input
                                                        type="text"
                                                        id="billing_city"
                                                        name="billing_city"
                                                        value={formData.billing_city}
                                                        onChange={handleInputChange}
                                                        required={!formData.billing_same_as_delivery}
                                                        placeholder="Enter billing city"
                                                    />
                                                </div>
                                                
                                                <div className="settings-input-group">
                                                    <label htmlFor="billing_state_province">Billing State/Province *</label>
                                                    <input
                                                        type="text"
                                                        id="billing_state_province"
                                                        name="billing_state_province"
                                                        value={formData.billing_state_province}
                                                        onChange={handleInputChange}
                                                        required={!formData.billing_same_as_delivery}
                                                        placeholder="Enter billing state/province"
                                                    />
                                                </div>
                                            </div>

                                            <div className="settings-section__grid">
                                                <div className="settings-input-group">
                                                    <label htmlFor="billing_postal_code">Billing Postal/Zip Code *</label>
                                                    <input
                                                        type="text"
                                                        id="billing_postal_code"
                                                        name="billing_postal_code"
                                                        value={formData.billing_postal_code}
                                                        onChange={handleInputChange}
                                                        required={!formData.billing_same_as_delivery}
                                                        placeholder="Enter billing postal/zip code"
                                                    />
                                                </div>
                                                
                                                <div className="settings-input-group">
                                                    <label htmlFor="billing_country">Billing Country *</label>
                                                    <select
                                                        id="billing_country"
                                                        name="billing_country"
                                                        value={formData.billing_country}
                                                        onChange={handleInputChange}
                                                        required={!formData.billing_same_as_delivery}
                                                    >
                                                        <option value="">Select Country</option>
                                                        {countries.map(country => (
                                                            <option key={country} value={country}>{country}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Additional Information Section */}
                            <div className="settings-section">
                                <h2 className="settings-section__title">Additional Information</h2>
                                <div className="settings-section__content">
                                    <div className="settings-input-group">
                                        <label htmlFor="delivery_notes">Delivery Notes (Optional)</label>
                                        <textarea
                                            className="delivery-form-textarea"
                                            id="delivery_notes"
                                            name="delivery_notes"
                                            value={formData.delivery_notes}
                                            onChange={handleInputChange}
                                            rows={4}
                                            placeholder="Any special delivery instructions or notes..."
                                        />
                                    </div>
                                    
                                    <div className="settings-section__actions">
                                        <button
                                            type="submit"
                                            className="settings-button settings-button--primary"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="user-loading-spinner"></div>
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="ri-check-line"></i>
                                                    Complete Order
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DeliveryForm; 