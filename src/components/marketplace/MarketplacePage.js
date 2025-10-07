import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';
import RewardCard from './RewardCard';
import MyRewardsSection from './MyRewardsSection';
import XPGainAnimation from './XPGainAnimation';
import './MarketplacePage.css';

const MarketplacePage = () => {
    const [items, setItems] = useState([]);
    const [userXP, setUserXP] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        type: 'ALL',
        xp_min: 0,
        xp_max: 10000
    });
    const [showAnimation, setShowAnimation] = useState(false);
    const [animationData, setAnimationData] = useState(null);

    useEffect(() => {
        fetchMarketplaceItems();
    }, [filters]);

    const fetchMarketplaceItems = async () => {
        try {
            setLoading(true);
            
            // Build query params
            const params = new URLSearchParams();
            if (filters.type !== 'ALL') {
                params.append('type', filters.type);
            }
            if (filters.xp_min > 0) {
                params.append('xp_min', filters.xp_min);
            }
            if (filters.xp_max < 10000) {
                params.append('xp_max', filters.xp_max);
            }

            const response = await apiClient.get(`/api/marketplace/items?${params.toString()}`);
            
            if (response.data) {
                setItems(response.data.items || []);
                setUserXP(response.data.user_xp || 0);
            }
        } catch (error) {
            console.error('Error fetching marketplace items:', error);
            toast.error('Failed to load marketplace items');
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async (item) => {
        try {
            const response = await apiClient.post(`/api/marketplace/items/${item.id}/redeem`);
            
            if (response.data.success) {
                toast.success(response.data.message);
                
                // Show XP animation if points were spent
                if (response.data.xp_spent) {
                    setAnimationData({
                        type: 'spend',
                        amount: response.data.xp_spent,
                        message: `${response.data.xp_spent} XP spent on ${item.title}`
                    });
                    setShowAnimation(true);
                }
                
                // Update user XP
                setUserXP(response.data.remaining_xp);
                
                // Refresh items to update stock
                fetchMarketplaceItems();
            }
        } catch (error) {
            console.error('Error redeeming item:', error);
            toast.error(error.response?.data?.error || 'Failed to redeem item');
        }
    };

    const handleEnterRaffle = async (item) => {
        try {
            const response = await apiClient.post(`/api/marketplace/items/${item.id}/enter-raffle`);
            
            if (response.data.success) {
                toast.success(response.data.message);
                
                // Show XP animation if points were spent
                if (response.data.xp_spent) {
                    setAnimationData({
                        type: 'spend',
                        amount: response.data.xp_spent,
                        message: `${response.data.xp_spent} XP spent on raffle entry`
                    });
                    setShowAnimation(true);
                }
                
                // Update user XP
                setUserXP(response.data.remaining_xp);
            }
        } catch (error) {
            console.error('Error entering raffle:', error);
            toast.error(error.response?.data?.error || 'Failed to enter raffle');
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleAnimationComplete = () => {
        setShowAnimation(false);
        setAnimationData(null);
    };

    return (
        <div className="marketplace-page">
            {/* XP Animation Overlay */}
            {showAnimation && animationData && (
                <XPGainAnimation
                    data={animationData}
                    onComplete={handleAnimationComplete}
                />
            )}
            
            <div className="marketplace-container">
                {/* Marketplace Section */}
                <div className="marketplace-section">
                    <div className="marketplace-header">
                        <div className="marketplace-title">
                            <h1>XP Store</h1>
                            <div className="xp-display">
                                <div className="xp-coin-icon">
                                    <i className="ri-copper-coin-line"></i>
                                </div>
                                <span className="xp-amount">{userXP.toLocaleString()}</span>
                                <span className="xp-label">XP</span>
                            </div>
                        </div>
                        
                        {/* Filters */}
                        <div className="marketplace-filters">
                            <div className="filter-group">
                                <label>Type</label>
                                <select 
                                    value={filters.type}
                                    onChange={(e) => handleFilterChange('type', e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="ALL">All</option>
                                    <option value="DIRECT">Direct</option>
                                    <option value="RAFFLE">Raffle</option>
                                </select>
                            </div>
                            
                            <div className="filter-group">
                                <label>XP cost</label>
                                <div className="xp-range-container">
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000"
                                        value={filters.xp_max}
                                        onChange={(e) => handleFilterChange('xp_max', parseInt(e.target.value))}
                                        className="xp-range-slider"
                                    />
                                    <div className="xp-range-display">
                                        <span>0</span>
                                        <span className="max-xp">{filters.xp_max.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Loading State */}
                    {loading ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p>Loading marketplace...</p>
                        </div>
                    ) : (
                        /* Items Grid */
                        <div className="marketplace-grid">
                            {items.length > 0 ? (
                                items.map(item => (
                                    <RewardCard
                                        key={item.id}
                                        item={item}
                                        userXP={userXP}
                                        onEnterRaffle={handleEnterRaffle}
                                    />
                                ))
                            ) : (
                                <div className="no-items">
                                    <p>No marketplace items available at the moment.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* My Rewards Section */}
                <MyRewardsSection />
            </div>
        </div>
    );
};

export default MarketplacePage; 