import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import { marketplaceAPI, baseURL } from '../../services/apiClient'; // Assuming marketplaceAPI client exists
import { toast } from 'react-hot-toast';
import '../../styles/userStyles.css'; // Or a specific CSS file for this page
import '../marketplace/MyRewardsSection.css'; // For consistent reward styling

const UserRewardsHistoryPage = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRewardsHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await marketplaceAPI.getMyRewards(); // Calls GET /api/marketplace/my-rewards
                setRewards(response.data.rewards || []);
            } catch (err) {
                console.error("Error fetching rewards history:", err);
                const errorMessage = err.response?.data?.error || "Failed to load rewards history.";
                setError(errorMessage);
                toast.error(errorMessage);
                setRewards([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRewardsHistory();
        const onResize = () => setIsMobile(window.innerWidth < 769);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleBack = () => {
        navigate('/user/profile');
    };

    return (
        <div className="app-layout">
            
            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="page-inner-container">
                    {isMobile && (
                        <div className="surveys-subheader">
                            <button
                                className="page-header__back-button page-header__back-button--primary"
                                onClick={handleBack}
                            >
                                <i className="ri-arrow-left-s-line"></i> Back
                            </button>
                        </div>
                    )}
                    
                    <header className="page-header dark-theme">
                        <h1 className="page-header__title">My Rewards History</h1>
                        <p className="page-header__subtitle">A log of all your marketplace redemptions and raffle entries.</p>
                    </header>

                    {loading && (
                        <div className="user-loading-indicator">
                            <div className="user-loading-spinner"></div>
                            <p>Loading Rewards...</p>
                        </div>
                    )}
                    {error && (
                        <div className="user-error-message">
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="rewards-table-container">
                            {rewards.length > 0 ? (
                                <table className="rewards-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Type</th>
                                            <th>XP Spent</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rewards.map(reward => (
                                            <tr key={reward.id || reward.date + reward.reward_title}> {/* Use a unique key */}
                                                <td>
                                                    <div className="reward-item-display">
                                                        {reward.marketplace_item?.image_url && (
                                                            <img 
                                                                src={reward.marketplace_item.image_url.startsWith('http') 
                                                                    ? reward.marketplace_item.image_url 
                                                                    : `${baseURL}${reward.marketplace_item.image_url}`
                                                                }
                                                                alt={reward.reward_title}
                                                                className="reward-item-image"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                        )}
                                                        <div className="reward-item-info">
                                                            <span className="reward-name">{reward.reward_title}</span>
                                                            {reward.marketplace_item?.description && (
                                                                <span className="reward-description">{reward.marketplace_item.description}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`type-badge ${reward.reward_type.toLowerCase()}`}>
                                                        {reward.reward_type === 'DIRECT' ? 'Direct' : 'Raffle'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="xp-display">
                                                        <span className="xp-amount">{reward.xp_spent.toLocaleString()}</span>
                                                        <span className="xp-label">XP</span>
                                                    </div>
                                                </td>
                                                <td>{new Date(reward.date).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={`status-badge ${reward.status.toLowerCase()}`}>
                                                        {reward.status.charAt(0).toUpperCase() + reward.status.slice(1).toLowerCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>You haven't redeemed any rewards yet. Visit the Marketplace to spend your XP!</p>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UserRewardsHistoryPage; 