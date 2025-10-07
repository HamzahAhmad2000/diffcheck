import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../marketplace/MarketplacePage.css';
import './DeliveryForm.css';
import '../../styles/userStyles.css';

const OrderConfirmation = () => {
    const navigate = useNavigate();
    const { purchaseId } = useParams();
    const [loading, setLoading] = useState(true);
    const [purchaseDetails, setPurchaseDetails] = useState(null);
    const [autoRedirectCountdown, setAutoRedirectCountdown] = useState(10);

    useEffect(() => {
        if (purchaseId) {
            fetchPurchaseDetails();
        }
    }, [purchaseId]);

    useEffect(() => {
        // Auto-redirect countdown
        if (autoRedirectCountdown > 0 && purchaseDetails) {
            const timer = setTimeout(() => {
                setAutoRedirectCountdown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (autoRedirectCountdown === 0) {
            navigate('/marketplace');
        }
    }, [autoRedirectCountdown, purchaseDetails, navigate]);

    const fetchPurchaseDetails = async () => {
        try {
            const response = await apiClient.get(`/api/marketplace/purchase/${purchaseId}`);
            setPurchaseDetails(response.data);
        } catch (error) {
            console.error('Error fetching purchase details:', error);
            toast.error('Failed to load order details.');
            navigate('/marketplace');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToMarketplace = () => {
        navigate('/marketplace');
    };

    const handleViewNotifications = () => {
        navigate('/notifications');
    };

    const handleViewMyPurchases = () => {
        navigate('/profile/purchases');
    };

    if (loading) {
        return (
            <div className="app-layout">
                <main className="main-content12">
                    <div className="page-inner-container">
                        <div className="loading-marketplace">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Order Details...</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!purchaseDetails) {
        return (
            <div className="app-layout">
                <main className="main-content12">
                    <div className="page-inner-container">
                        <div className="empty-state">
                            <i className="ri-error-warning-line empty-state__icon"></i>
                            <h3 className="empty-state__title">Order Not Found</h3>
                            <p className="empty-state__message">
                                The order you're looking for could not be found.
                            </p>
                            <button 
                                onClick={handleBackToMarketplace}
                                className="button button--primary"
                            >
                                <i className="ri-arrow-left-line"></i> Back to Marketplace
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <main className="main-content12">
                <div className="page-inner-container">
                    {/* Success Header */}
                    <div className="confirmation-header">
                        <div className="success-icon">
                            <i className="ri-check-line"></i>
                        </div>
                        <h1 className="confirmation-title">Order Placed Successfully!</h1>
                        <p className="confirmation-subtitle">
                            Thank you for your order. We've received your details and will process your request shortly.
                        </p>
                    </div>

                    {/* Order Summary */}
                    <div className="confirmation-content">
                        <section className="form-section">
                            <h3 className="section-title">Order Summary</h3>
                            
                            <div className="order-item">
                                <div className="dashboard-item dashboard-marketplace-item">
                                    <div className="dashboard-item__info">
                                        <h4>{purchaseDetails.item_title}</h4>
                                        <div className="order-details">
                                            <div className="detail-item">
                                                <span className="detail-label">Order ID:</span>
                                                <span className="detail-value">#{purchaseDetails.id}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">XP Spent:</span>
                                                <div className="xp-highlight">
                                                    <i className="ri-copper-coin-fill"></i>
                                                    {purchaseDetails.xp_spent?.toLocaleString() || 0} XP
                                                </div>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Order Date:</span>
                                                <span className="detail-value">
                                                    {new Date(purchaseDetails.created_at).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Status:</span>
                                                <span className="status-badge status-pending">
                                                    {purchaseDetails.purchase_status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </span>
                                            </div>
                                            {purchaseDetails.is_raffle_win && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Type:</span>
                                                    <div className="marketplace-item-badge raffle">
                                                        🎉 Raffle Winner!
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Delivery Information */}
                        {purchaseDetails.delivery_info && (
                            <section className="form-section">
                                <h3 className="section-title">Delivery Information</h3>
                                
                                <div className="delivery-summary">
                                    <div className="delivery-section">
                                        <h4>Delivery Address</h4>
                                        <div className="address-block">
                                            <p><strong>{purchaseDetails.delivery_info.full_name}</strong></p>
                                            <p>{purchaseDetails.delivery_info.address}</p>
                                            <p>
                                                {purchaseDetails.delivery_info.city}, {purchaseDetails.delivery_info.state_province} {purchaseDetails.delivery_info.postal_code}
                                            </p>
                                            <p>{purchaseDetails.delivery_info.country}</p>
                                        </div>
                                    </div>

                                    <div className="delivery-section">
                                        <h4>Contact Information</h4>
                                        <div className="contact-info">
                                            <p><i className="ri-phone-line"></i> {purchaseDetails.delivery_info.phone_number}</p>
                                            <p><i className="ri-mail-line"></i> {purchaseDetails.delivery_info.email}</p>
                                        </div>
                                    </div>

                                    {!purchaseDetails.delivery_info.billing_same_as_delivery && (
                                        <div className="delivery-section">
                                            <h4>Billing Address</h4>
                                            <div className="address-block">
                                                <p>{purchaseDetails.delivery_info.billing_address}</p>
                                                <p>
                                                    {purchaseDetails.delivery_info.billing_city}, {purchaseDetails.delivery_info.billing_state_province} {purchaseDetails.delivery_info.billing_postal_code}
                                                </p>
                                                <p>{purchaseDetails.delivery_info.billing_country}</p>
                                            </div>
                                        </div>
                                    )}

                                    {purchaseDetails.delivery_info.delivery_notes && (
                                        <div className="delivery-section">
                                            <h4>Delivery Notes</h4>
                                            <p className="delivery-notes">
                                                {purchaseDetails.delivery_info.delivery_notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Next Steps */}
                        <section className="form-section">
                            <h3 className="section-title">What's Next?</h3>
                            
                            <div className="next-steps">
                                <div className="step-item">
                                    <div className="step-icon">
                                        <i className="ri-notification-line"></i>
                                    </div>
                                    <div className="step-content">
                                        <h4>Stay Updated</h4>
                                        <p>We'll send you notifications about your order status and shipping updates.</p>
                                    </div>
                                </div>
                                
                                <div className="step-item">
                                    <div className="step-icon">
                                        <i className="ri-truck-line"></i>
                                    </div>
                                    <div className="step-content">
                                        <h4>Processing & Shipping</h4>
                                        <p>Your order will be processed and shipped within 3-5 business days.</p>
                                    </div>
                                </div>
                                
                                <div className="step-item">
                                    <div className="step-icon">
                                        <i className="ri-home-line"></i>
                                    </div>
                                    <div className="step-content">
                                        <h4>Delivery</h4>
                                        <p>Your item will be delivered to the address you provided.</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Action Buttons */}
                    <div className="confirmation-actions">
                        <div className="auto-redirect">
                            <p>Automatically redirecting to marketplace in {autoRedirectCountdown} seconds...</p>
                        </div>
                        
                        <div className="action-buttons">
                            <button
                                onClick={handleViewNotifications}
                                className="button button--secondary"
                            >
                                <i className="ri-notification-line"></i> View Notifications
                            </button>
                            
                            <button
                                onClick={handleViewMyPurchases}
                                className="button button--secondary"
                            >
                                <i className="ri-history-line"></i> My Orders
                            </button>
                            
                            <button
                                onClick={handleBackToMarketplace}
                                className="button button--primary"
                            >
                                <i className="ri-store-2-line"></i> Back to Marketplace
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OrderConfirmation; 