import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient, { marketplaceAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';

// Default marketplace item image as data URL SVG
const defaultItemImagePath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMkEyQTJBIi8+CjxwYXRoIGQ9Ik0xNTAgODBMMTc1IDEyMEgxMjVMMTUwIDgwWiIgZmlsbD0iIzZBNkE2QSIvPgo8Y2lyY2xlIGN4PSIxMzUiIGN5PSI3MCIgcj0iOCIgZmlsbD0iIzZBNkE2QSIvPgo8cmVjdCB4PSI4MCIgeT0iMTMwIiB3aWR0aD0iMTQwIiBoZWlnaHQ9IjgiIGZpbGw9IiM0QTRBNEEiLz4KPHJlY3QgeD0iODAiIHk9IjE0NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2IiBmaWxsPSIjNEE0QTRBIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTc1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM4QThBOEEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1hcmtldHBsYWNlIEl0ZW08L3RleHQ+Cjwvc3ZnPg==";

const MarketplaceItemDetail = () => {
    const { itemId } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [userXP, setUserXP] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ticketCount, setTicketCount] = useState(1);
    const [recommendedItems, setRecommendedItems] = useState([]);

    const fetchItemDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await marketplaceAPI.getItemDetail(itemId);
            setItem(response.data.item);
            setUserXP(response.data.item.user_xp || 0);
        } catch (error) {
            console.error('Error fetching item details:', error);
            if (error.response?.status === 404) {
                setError('Item not found or no longer available');
            } else {
                setError(error.response?.data?.error || 'Failed to load item details');
            }
            toast.error(error.response?.data?.error || 'Failed to load item details');
        } finally {
            setLoading(false);
        }
    }, [itemId]);

    useEffect(() => {
        fetchItemDetail();
    }, [fetchItemDetail]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const res = await marketplaceAPI.getItems();
                const items = res.data?.items || [];
                // Exclude current item and randomize
                const candidates = items.filter((it) => String(it.id) !== String(itemId));
                const randomized = candidates.sort(() => Math.random() - 0.5).slice(0, 3);
                setRecommendedItems(randomized);
            } catch (err) {
                console.warn('[MARKETPLACE] Failed to load recommendations', err);
            }
        };
        fetchRecommendations();
    }, [itemId]);

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) {
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
        
        return `${baseURL}${cleanPath}`;
    };

    const handleRedeemItem = async () => {
        try {
            // Follow the same purchase flow used on MarketplacePage.js
            const response = await apiClient.post(`/api/marketplace/purchase/${item.id}`);
            const purchaseId = response.data?.purchase_id;
            if (purchaseId) {
                navigate(`/user/marketplace/purchase/${purchaseId}/delivery`);
            } else {
                throw new Error('Failed to initiate purchase');
            }
        } catch (error) {
            console.error('Error initiating direct purchase:', error);
            toast.error(error.response?.data?.error || `Failed to initiate purchase for ${item.title}.`);
        }
    };

    const handleEnterRaffle = async () => {
        const totalCost = item.xp_cost * ticketCount;
        try {
            // For multiple tickets, make multiple API calls
            for (let i = 0; i < ticketCount; i++) {
                await marketplaceAPI.enterRaffle(item.id);
            }
            setUserXP(userXP - totalCost);
            // Refresh item data to update counts
            await fetchItemDetail();
        } catch (error) {
            console.error('Error entering raffle:', error);
            toast.error(error.response?.data?.error || `Failed to enter raffle for ${item.title}.`);
        }
    };

    const handleBackToMarketplace = () => {
        navigate('/user/marketplace');
    };

    const handleTicketCountChange = (e) => {
        const value = parseInt(e.target.value) || 1;
        const maxTickets = item.item_type === 'RAFFLE' && item.raffle_entries_per_user 
            ? Math.min(item.raffle_entries_per_user - (item.user_raffle_entries || 0), Math.floor(userXP / item.xp_cost))
            : Math.floor(userXP / item.xp_cost);
        
        const clampedValue = Math.max(1, Math.min(value, maxTickets));
        setTicketCount(clampedValue);
    };

    const incrementTickets = () => {
        if (!item) return;
        
        const maxTickets = item.item_type === 'RAFFLE' && item.raffle_entries_per_user 
            ? Math.min(item.raffle_entries_per_user - (item.user_raffle_entries || 0), Math.floor(userXP / item.xp_cost))
            : Math.floor(userXP / item.xp_cost);
            
        if (ticketCount < maxTickets) {
            setTicketCount(ticketCount + 1);
        }
    };

    const decrementTickets = () => {
        if (ticketCount > 1) {
            setTicketCount(ticketCount - 1);
        }
    };

    if (loading) {
        return (
            <div className="app-layout">
                <main className="main-content12">
                    <div className="page-inner-container">
                        <div className="loading-marketplace">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Item Details...</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="app-layout">
                <main className="main-content12">
                    <div className="page-inner-container">
                        <div className="marketplace-item-error">
                            <h2>{error || 'Item Not Found'}</h2>
                            <button onClick={handleBackToMarketplace} className="button button--primary">
                                Back to Marketplace
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const canAfford = userXP >= item.xp_cost;
    const isDirectPurchase = item.item_type === 'DIRECT';
    const isRaffle = item.item_type === 'RAFFLE';
    
    // Check redemption limits
    const hasReachedLimit = item.user_limit_reached || false;
    const hasReachedRaffleLimit = item.user_raffle_limit_reached || false;

    let buttonText = 'Redeem Now';
    let buttonAction = handleRedeemItem;
    let isDisabled = !canAfford;
    let disabledTitle = !canAfford ? "Not enough XP" : "Redeem Item";

    if (isDirectPurchase) {
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
        const totalCost = item.xp_cost * ticketCount;
        buttonText = `Purchase ${ticketCount} ${ticketCount === 1 ? 'Ticket' : 'Tickets'}`;
        buttonAction = handleEnterRaffle;
        isDisabled = userXP < totalCost;
        disabledTitle = !canAfford ? "Not enough XP" : "Enter Raffle";
        
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

    const imageUrl = getFullImageUrl(item.image_url);

    const canAffordOne = userXP >= item.xp_cost;
    const xpProgress = item ? Math.min((userXP / item.xp_cost) * 100, 100) : 0;
    const xpNeeded = item ? Math.max(0, item.xp_cost - userXP) : 0;

    return (
        <div className="app-layout">
            <main className="main-content12">
                <div className="page-inner-container">
                    {/* Header with back button */}
                    <div className="marketplace-detail-header">
                        <button 
                            onClick={handleBackToMarketplace}
                            className="button button--purple marketplace-back-btn"
                        >
                            <i className="ri-arrow-left-line"></i> Back
                        </button>
                    </div>

                    {/* Main content */}
                    <div className="marketplace-detail-container" >
                        {/* Left side - Image */}
                        <div className="marketplace-detail-image-wrapper">
                            <div className="dashboard-item__image-container">
                                <img
                                    src={imageUrl}
                                    alt={item.title}
                                    className="marketplace-detail-image"
                                    onError={(e) => { 
                                        if (e.target.src !== defaultItemImagePath) {
                                            e.target.src = defaultItemImagePath; 
                                        }
                                    }}
                                />
                                
                                {/* Item Type Badge */}
                                <div className={`marketplace-item-badge detail ${isRaffle ? 'raffle' : 'instant'}`}>
                                    {isRaffle ? '🎲 Raffle' : '⚡ Instant'}
                                </div>
                            </div>
                        </div>

                        {/* Right side - Details and Actions */}
                        <div className="marketplace-detail-info-section">
                            <div className="dashboard-item__info">
                                {/* Title and Description */}
                                <div className="marketplace-item-header">
                                    <h1 className="marketplace-detail-title">
                                        {item.title}
                                    </h1>
                                    
                                    {item.description && (
                                        <p className="marketplace-detail-description">
                                            {item.description}
                                        </p>
                                    )}
                                </div>

                                {/* XP Cost - Prominent */}
                                <div className="xp-highlight">
                                    <div className="xp-highlight">
                                        <i className="ri-copper-coin-fill"></i>
                                        {item.xp_cost.toLocaleString()} XP
                                        <div className="xp-label">
                                            {isRaffle ? 'Per Entry' : 'Required'}
                                        </div>
                                    </div>
                                    
                                    {isDirectPurchase && item.stock !== null && (
                                        <span className="marketplace-stock">
                                            Stock: {item.stock}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="marketplace-progress-section">
                                    <div className="marketplace-progress-header">
                                        {!canAffordOne ? (
                                            <span className="progress-needed">
                                                You need {xpNeeded.toLocaleString()} more XP for one
                                            </span>
                                        ) : (
                                            <span className="progress-complete">
                                                ✓ You can afford at least one
                                            </span>
                                        )}
                                    </div>
                                    <div className="progress-bar">
                                        <div 
                                            className={`progress-fill ${canAffordOne ? 'complete' : 'incomplete'}`}
                                            style={{ width: `${xpProgress}%` }}
                                        ></div>
                                    </div>
                                </div>


                                {/* Meta Information */}
                                <div className="marketplace-meta">
                                    {isDirectPurchase && item.redeem_limit_per_user !== null && (
                                        <div className="meta-item">
                                            <i className="ri-repeat-line"></i>
                                            <span>
                                                <strong>Purchase Limit:</strong><br />
                                                {item.user_redemption_count || 0}/{item.redeem_limit_per_user} per user
                                            </span>
                                        </div>
                                    )}

                                    {isRaffle && item.raffle_end_date && (
                                        <div className="meta-item">
                                            <i className="ri-calendar-line"></i>
                                            <span>
                                                <strong>Ends:</strong><br />
                                                {new Date(item.raffle_end_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}

                                    {isRaffle && item.raffle_entries_per_user !== null && (
                                        <div className="meta-item">
                                            <i className="ri-ticket-line"></i>
                                            <span>
                                                <strong>Entry Limit:</strong><br />
                                                {item.user_raffle_entries || 0}/{item.raffle_entries_per_user} per user
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Raffle ticket selector */}
                                {isRaffle && !hasReachedRaffleLimit && !isDisabled && (
                                    <div className="marketplace-ticket-selector">
                                        <label className="ticket-selector-label">
                                            Select the number of entries to the raffle:
                                        </label>
                                        <div className="ticket-selector-controls">
                                            <button 
                                                onClick={decrementTickets}
                                                disabled={ticketCount <= 1}
                                                className={`ticket-btn ${ticketCount <= 1 ? 'disabled' : ''}`}
                                            >
                                                <i className="ri-subtract-line"></i>
                                            </button>
                                            
                                            <input
                                                type="number"
                                                value={ticketCount}
                                                onChange={handleTicketCountChange}
                                                min="1"
                                                max={Math.min(
                                                    item.raffle_entries_per_user ? item.raffle_entries_per_user - (item.user_raffle_entries || 0) : Infinity,
                                                    Math.floor(userXP / item.xp_cost)
                                                )}
                                                className="ticket-input"
                                            />
                                            
                                            <button 
                                                onClick={incrementTickets}
                                                disabled={ticketCount >= Math.min(
                                                    item.raffle_entries_per_user ? item.raffle_entries_per_user - (item.user_raffle_entries || 0) : Infinity,
                                                    Math.floor(userXP / item.xp_cost)
                                                )}
                                                className={`ticket-btn ${ticketCount >= Math.min(
                                                    item.raffle_entries_per_user ? item.raffle_entries_per_user - (item.user_raffle_entries || 0) : Infinity,
                                                    Math.floor(userXP / item.xp_cost)
                                                ) ? 'disabled' : ''}`}
                                            >
                                                <i className="ri-add-line"></i>
                                            </button>
                                        </div>
                                        <div className="ticket-total-cost">
                                            Total Cost: {(item.xp_cost * ticketCount).toLocaleString()} XP
                                        </div>
                                    </div>
                                )}

                                {/* Action button */}
                                <button 
                                    onClick={buttonAction}
                                    disabled={isDisabled}
                                    title={disabledTitle}
                                    className={`dashboard-item__cta ${isDisabled ? 'disabled' : ''}`}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* You may also like */}
                    {recommendedItems.length > 0 && (
                        <div className="marketplace-recommendations" style={{ marginTop: '32px' }}>
                            <h2 style={{ color: '#fff', marginBottom: '12px' }}>You may also like</h2>
                            <div className="marketplace-recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                {recommendedItems.map((rec) => (
                                    <div key={rec.id} className="recommendation-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #333', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/user/marketplace/item/${rec.id}`)}>
                                        <div style={{ position: 'relative', paddingTop: '56%', background: '#111' }}>
                                            {rec.image_url ? (
                                                <img src={getFullImageUrl(rec.image_url)} alt={rec.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>No image</div>
                                            )}
                                            <div style={{ position: 'absolute', top: 8, left: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: 8, fontSize: 12, color: '#fff' }}>
                                                {rec.item_type === 'RAFFLE' ? '🎲 Raffle' : '⚡ Instant'}
                                            </div>
                                        </div>
                                        <div style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                <h3 style={{ fontSize: 14, color: '#fff', margin: 0, lineHeight: 1.3 }}>{rec.title}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ color: '#fff', fontWeight: 700 }}>{rec.xp_cost?.toLocaleString?.() || rec.xp_cost}</span>
                                                    <span style={{ color: '#aaa', fontSize: 12 }}>XP</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MarketplaceItemDetail; 