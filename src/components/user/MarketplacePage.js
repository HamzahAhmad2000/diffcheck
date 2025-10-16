import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { baseURL, marketplaceAPI, purchaseAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';

import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import '../../styles/userStyles.css'; // General user styles
import '../../styles/UserHomepage.css';
import '../../styles/LegalComponents.css';

// Default marketplace item image as data URL SVG
const defaultItemImagePath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMkEyQTJBIi8+CjxwYXRoIGQ9Ik0xNTAgODBMMTc1IDEyMEgxMjVMMTUwIDgwWiIgZmlsbD0iIzZBNkE2QSIvPgo8Y2lyY2xlIGN4PSIxMzUiIGN5PSI3MCIgcj0iOCIgZmlsbD0iIzZBNkE2QSIvPgo8cmVjdCB4PSI4MCIgeT0iMTMwIiB3aWR0aD0iMTQwIiBoZWlnaHQ9IjgiIGZpbGw9IiM0QTRBNEEiLz4KPHJlY3QgeD0iODAiIHk9IjE0NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2IiBmaWxsPSIjNEE0QTRBIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTc1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM4QThBOEEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1hcmtldHBsYWNlIEl0ZW08L3RleHQ+Cjwvc3ZnPg==";

const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
};

const MarketplaceItemCard = ({ item, userXP, onPurchase, onViewDetail }) => {
    const canAfford = userXP >= item.xp_cost;
    const isDirectPurchase = item.item_type === 'DIRECT';
    const isRaffle = item.item_type === 'RAFFLE';
    
    // Calculate XP progress percentage
    const xpProgress = Math.min((userXP / item.xp_cost) * 100, 100);
    const xpNeeded = Math.max(0, item.xp_cost - userXP);

    // Check redemption limits
    const hasReachedLimit = item.user_limit_reached || false;
    const hasReachedRaffleLimit = item.user_raffle_limit_reached || false;

    let buttonText = 'Purchase';
    let buttonAction = () => onPurchase(item.id, item.title, item.item_type);
    let isDisabled = !canAfford;
    let disabledTitle = !canAfford ? "Not enough XP" : "Purchase Item";

    if (isDirectPurchase) {
        buttonText = 'Purchase';
        // Check if user has reached redemption limit
        if (hasReachedLimit) {
            buttonText = 'Limit Reached';
            isDisabled = true;
            disabledTitle = `You have reached the redemption limit for this item${item.redeem_limit_per_user ? ` (${item.redeem_limit_per_user} max)` : ''}`;
        } else if (item.stock !== null && item.stock <= 0) {
            buttonText = 'Out of Stock';
            isDisabled = true;
            disabledTitle = 'This item is out of stock.';
        }
    } else if (isRaffle) {
        buttonText = 'Enter Raffle';
        buttonAction = () => onPurchase(item.id, item.title, item.item_type);
        disabledTitle = !canAfford ? "Not enough XP" : "Enter Raffle";
        
        // Check if user has reached raffle entry limit
        if (hasReachedRaffleLimit) {
            buttonText = 'Max Entries Reached';
            isDisabled = true;
            disabledTitle = `You have reached the maximum entries for this raffle${item.raffle_entries_per_user ? ` (${item.raffle_entries_per_user} max)` : ''}`;
        } else if (item.raffle_end_date && new Date(item.raffle_end_date) < new Date()) {
            buttonText = 'Raffle Ended';
            isDisabled = true;
            disabledTitle = 'This raffle has ended.';
        }
    }

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) {
            console.log('No image URL provided, using default');
            return defaultItemImagePath;
        }
        
        // Handle full URLs (external images or data URLs)
        if (relativeOrAbsoluteUrl.startsWith('http://') || 
            relativeOrAbsoluteUrl.startsWith('https://') || 
            relativeOrAbsoluteUrl.startsWith('data:')) {
            return relativeOrAbsoluteUrl;
        }
        
        // Handle relative URLs - construct full path
        let cleanPath = relativeOrAbsoluteUrl;
        if (!cleanPath.startsWith('/')) {
            cleanPath = `/${cleanPath}`;
        }
        
        const fullUrl = `${baseURL}${cleanPath}`;
        console.log('Constructed image URL:', fullUrl);
        return fullUrl;
    };

    const imageUrl = getFullImageUrl(item.image_url);

    return (
        <div className="dashboard-item dashboard-marketplace-item" onClick={() => onViewDetail(item.id)}>
            {/* Image Section */}
            <div className="dashboard-item__image-container">
                <img
                    src={imageUrl}
                    alt={item.title || 'Marketplace Item'}
                    className="dashboard-item__image"
                    onError={(e) => { 
                        console.log('Image load error for:', imageUrl, 'Original URL:', item.image_url);
                        if (e.target.src !== defaultItemImagePath) {
                            e.target.src = defaultItemImagePath; 
                        }
                    }}
                    onLoad={() => {
                        console.log('Image loaded successfully:', imageUrl);
                    }}
                />
                
                {/* Item Type Badge (text-only, no icons) */}
                <div className={`marketplace-item-badge ${isRaffle ? 'raffle' : 'instant'}`}>
                    {isRaffle ? 'Raffle' : 'Instant'}
                </div>
            </div>
            
            {/* Content Section */}
            <div className="dashboard-item__info">
                {/* Title and Description */}
                <div className="marketplace-item-header">
                    <h4>{truncateText(item.title || 'Item Name', 18)}</h4>
                    
                    {item.description && item.description.trim() && (
                        <p className="marketplace-item-description">
                            {truncateText(item.description, 50)}
                        </p>
                    )}
                </div>

                {/* XP Cost - More Prominent */}
                <div className="xp-highlight">
                    <div className="xp-highlight">
                        <i className="ri-copper-coin-fill"></i>
                        {item.xp_cost.toLocaleString()} XP
                    </div>
                    
                    {/* Stock/Limit Info */}
                    {isDirectPurchase && item.stock !== null && (
                        <span className="marketplace-stock">
                            Stock: {item.stock}
                        </span>
                    )}
                </div>

                {/* XP Progress Bar */}
                <div className="marketplace-progress-section">
                    <div className="marketplace-progress-header">
                        {!canAfford ? (
                            <span className="progress-needed">
                                You need {xpNeeded.toLocaleString()} more XP
                            </span>
                        ) : (
                            <span className="progress-complete">
                                ✓
                            </span>
                        )}
                    </div>
                    <div className="progress-bar1">
                        <div 
                            className={`progress-fill ${canAfford ? 'complete' : 'incomplete'}`}
                            style={{ width: `${xpProgress}%` }}
                        ></div>
                    </div>
                </div>

                {/* Additional Meta Information */}
                <div className="marketplace-meta">
                    {isDirectPurchase && item.redeem_limit_per_user !== null && (
                        <div className="meta-item">
                            <i className="ri-repeat-line"></i>
                            Redeemed: {item.user_redemption_count || 0}/{item.redeem_limit_per_user}
                        </div>
                    )}
                    {isRaffle && item.raffle_end_date && (
                        <div className="meta-item">
                            <i className="ri-calendar-line"></i>
                            Ends: {new Date(item.raffle_end_date).toLocaleDateString()}
                        </div>
                    )}
                    {isRaffle && item.raffle_entries_per_user !== null && (
                        <div className="meta-item">
                            <i className="ri-ticket-line"></i>
                            Entries: {item.user_raffle_entries || 0}/{item.raffle_entries_per_user}
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button 
                    className={`dashboard-item__cta ${isDisabled ? 'disabled' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) {
                            buttonAction();
                        }
                    }}
                    disabled={isDisabled}
                    title={disabledTitle}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
};

const MarketplacePage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [userXP, setUserXP] = useState(0);
    const [loading, setLoading] = useState(true);
    const [raffleModal, setRaffleModal] = useState({ show: false, item: null });
    const [acceptRaffleTerms, setAcceptRaffleTerms] = useState(false);

    const fetchMarketplaceData = useCallback(async () => {
        setLoading(true);
        try {
            console.log('Fetching marketplace data...');
            const response = await marketplaceAPI.getItems();
            console.log('Marketplace API response:', response.data);
            
            setItems(response.data.items || []);
            setUserXP(response.data.user_xp || 0);
            
            if ((response.data.items || []).length === 0) {
                console.log('No marketplace items found');
            } else {
                console.log(`Loaded ${response.data.items.length} marketplace items`);
            }
        } catch (error) {
            console.error('Error fetching marketplace items:', error);
            console.error('Error response:', error.response?.data);
            toast.error(error.response?.data?.error || 'Failed to load marketplace items.');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMarketplaceData();
    }, [fetchMarketplaceData]);

    const handlePurchase = async (itemId, itemTitle, itemType) => {
        try {
            if (itemType === 'DIRECT') {
                // For direct purchases, first initiate purchase then navigate to delivery form
                try {
                    const response = await apiClient.post(`/api/marketplace/purchase/${itemId}`);
                    if (response.data && response.data.purchase_id) {
                        navigate(`/user/marketplace/purchase/${response.data.purchase_id}/delivery`);
                    } else {
                        toast.error('Failed to initiate purchase');
                    }
                } catch (error) {
                    console.error('Error initiating direct purchase:', error);
                    toast.error(error.response?.data?.error || `Failed to initiate purchase for ${itemTitle}.`);
                }
            } else if (itemType === 'RAFFLE') {
                // For raffle entries, show terms acceptance modal first
                const raffleItem = items.find(item => item.id === itemId);
                if (raffleItem) {
                    setRaffleModal({ show: true, item: raffleItem });
                }
            }
        } catch (error) {
            console.error('Error initiating purchase:', error);
            toast.error(error.response?.data?.error || 'Failed to process request');
        }
    };
    
    const handleViewRewardsHistory = () => {
        navigate('/user/notifications'); // Navigate to notifications where order updates are shown
    };

    const handleViewDetail = (itemId) => {
        navigate(`/user/marketplace/item/${itemId}`);
    };

    const handleRaffleModalClose = () => {
        setRaffleModal({ show: false, item: null });
        setAcceptRaffleTerms(false);
    };

    const handleEnterRaffle = async () => {
        if (!acceptRaffleTerms || !raffleModal.item) return;

        try {
            const response = await marketplaceAPI.enterRaffle(raffleModal.item.id);
            toast.success(`Successfully entered raffle for ${raffleModal.item.title}!`);
            // Refresh marketplace data to update counts
            await fetchMarketplaceData();
            handleRaffleModalClose();
        } catch (error) {
            console.error('Error entering raffle:', error);
            toast.error(error.response?.data?.error || `Failed to enter raffle for ${raffleModal.item.title}.`);
        }
    };

    return (
        <div className="app-layout">
            <main className="main-content12">
                <div className="page-inner-container">
                   

                    {loading ? (
                        <div className="loading-marketplace">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Marketplace Items...</p>
                            </div>
                        </div>
                    ) : items.length > 0 ? (
                        <section className="marketplace-section">
                            <div className="marketplace-grid">
                                {items.map((item) => (
                                    <MarketplaceItemCard
                                        key={item.id}
                                        item={item}
                                        userXP={userXP}
                                        onPurchase={handlePurchase}
                                        onViewDetail={handleViewDetail}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : (
                        <div className="empty-state">
                            <i className="ri-store-2-line empty-state__icon"></i>
                            <h3 className="empty-state__title">Marketplace is Empty</h3>
                            <p className="empty-state__message">There are no items available in the marketplace right now. Please check back later.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Raffle Terms Acceptance Modal */}
            {raffleModal.show && raffleModal.item && (
                <div className="raffle-modal-overlay">
                    <div className="raffle-modal-content">
                        <div className="raffle-modal-header">
                            <h3>Enter Raffle: {raffleModal.item.title}</h3>
                            <button
                                className="raffle-modal-close"
                                onClick={handleRaffleModalClose}
                            >
                                ×
                            </button>
                        </div>

                        <div className="raffle-modal-body">
                            <div className="raffle-item-summary">
                                <p><strong>Cost:</strong> {raffleModal.item.xp_cost} XP</p>
                                <p><strong>Description:</strong> {raffleModal.item.description}</p>
                                {raffleModal.item.raffle_end_date && (
                                    <p><strong>Draw Date:</strong> {new Date(raffleModal.item.raffle_end_date).toLocaleDateString()}</p>
                                )}
                            </div>

                            <div className="raffle-terms-acceptance">
                                <label className="raffle-terms-label">
                                    <input
                                        type="checkbox"
                                        checked={acceptRaffleTerms}
                                        onChange={(e) => setAcceptRaffleTerms(e.target.checked)}
                                        className="raffle-terms-checkbox"
                                    />
                                    <span className="raffle-terms-text">
                                        ✅ I accept the{' '}
                                        <a
                                            href="/legal#rewards"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="raffle-terms-link"
                                        >
                                            Reward & Raffle Terms
                                        </a>
                                    </span>
                                </label>
                                {!acceptRaffleTerms && (
                                    <p className="raffle-terms-error">Please accept the Reward & Raffle Terms to enter.</p>
                                )}
                            </div>
                        </div>

                        <div className="raffle-modal-footer">
                            <button
                                className="raffle-cancel-btn"
                                onClick={handleRaffleModalClose}
                            >
                                Cancel
                            </button>
                            <button
                                className={`raffle-enter-btn ${acceptRaffleTerms ? 'enabled' : 'disabled'}`}
                                onClick={handleEnterRaffle}
                                disabled={!acceptRaffleTerms}
                            >
                                Enter Raffle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplacePage; 