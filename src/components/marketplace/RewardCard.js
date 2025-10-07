import React from 'react';
import { useNavigate } from 'react-router-dom';
import { purchaseAPI } from '../../services/apiClient';
import { baseURL } from '../../services/apiClient';
import { toast } from 'react-toastify';
import './RewardCard.css';

const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
};

const RewardCard = ({ item, userXP, onEnterRaffle }) => {
    const navigate = useNavigate();
    const canAfford = userXP >= item.xp_cost;
    const isOutOfStock = item.stock !== null && item.stock <= 0;
    const isRaffleExpired = item.item_type === 'RAFFLE' && item.raffle_end_date && 
                           new Date(item.raffle_end_date) < new Date();

    const handleAction = async () => {
        if (isOutOfStock || isRaffleExpired || !canAfford) {
            return;
        }

        try {
            if (item.item_type === 'DIRECT') {
                // Navigate to delivery form for direct purchases
                navigate(`/marketplace/purchase/${item.id}/delivery`);
            } else if (item.item_type === 'RAFFLE') {
                // Handle raffle entry directly (no delivery info needed)
                const response = await purchaseAPI.initiatePurchase(item.id, 'RAFFLE_ENTRY');
                if (response.data.success) {
                    toast.success('Successfully entered raffle!');
                    // Call parent callback to refresh data if provided
                    if (onEnterRaffle) {
                        onEnterRaffle(item);
                    }
                } else {
                    toast.error('Failed to enter raffle');
                }
            }
        } catch (error) {
            console.error('Error initiating purchase:', error);
            toast.error(error.response?.data?.message || 'Failed to process request');
        }
    };

    const getButtonText = () => {
        if (isOutOfStock) return 'Out of Stock';
        if (isRaffleExpired) return 'Raffle Ended';
        if (!canAfford) return 'Insufficient XP';
        
        return item.item_type === 'DIRECT' ? 'Redeem' : 'Enter Raffle';
    };

    const getButtonClass = () => {
        let className = 'reward-card-button';
        
        if (isOutOfStock || isRaffleExpired || !canAfford) {
            className += ' disabled';
        } else if (item.item_type === 'RAFFLE') {
            className += ' raffle';
        } else {
            className += ' direct';
        }
        
        return className;
    };

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) return null;
        return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${baseURL}${relativeOrAbsoluteUrl}`;
    };

    return (
        <div className={`reward-card ${!canAfford ? 'insufficient-xp' : ''}`}>
            <div className="reward-card-image">
                {item.image_url ? (
                    <img 
                        src={getFullImageUrl(item.image_url)} 
                        alt={item.title}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div className="reward-card-placeholder" style={{ display: item.image_url ? 'none' : 'flex' }}>
                    <span>📦</span>
                </div>
                
                {/* Item Type Badge (text only) */}
                <div className={`item-type-badge ${item.item_type.toLowerCase()}`}>
                    {item.item_type === 'RAFFLE' ? 'Raffle' : 'Direct'}
                </div>
            </div>
            
            <div className="reward-card-content">
                <div className="reward-card-header">
                    <h3 className="reward-card-title">{truncateText(item.title, 18)}</h3>
                    <div className="reward-card-xp">
                        <span className="xp-amount">{item.xp_cost.toLocaleString()}</span>
                        <span className="xp-label">XP</span>
                    </div>
                </div>
                
                {item.description && (
                    <p className="reward-card-description">{truncateText(item.description, 50)}</p>
                )}
                
                {/* Stock Info for Direct Items */}
                {item.item_type === 'DIRECT' && item.stock !== null && (
                    <div className="stock-info">
                        <span className={`stock-count ${item.stock <= 5 ? 'low-stock' : ''}`}>
                            {item.stock} left
                        </span>
                    </div>
                )}
                
                {/* Raffle Info */}
                {item.item_type === 'RAFFLE' && (
                    <div className="raffle-info">
                        <div className="raffle-entries">
                            Max entries: {item.raffle_entries_per_user || 1}
                        </div>
                        {item.raffle_end_date && (
                            <div className="raffle-end-date">
                                Ends: {new Date(item.raffle_end_date).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                )}
                
                <button 
                    className={getButtonClass()}
                    onClick={handleAction}
                    disabled={isOutOfStock || isRaffleExpired || !canAfford}
                >
                    {getButtonText()}
                </button>
            </div>
        </div>
    );
};

export default RewardCard; 