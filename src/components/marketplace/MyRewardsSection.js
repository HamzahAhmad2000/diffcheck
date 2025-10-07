import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiClient, { baseURL } from '../../services/apiClient';
import './MyRewardsSection.css';

const MyRewardsSection = () => {
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyRewards();
    }, []);

    const fetchMyRewards = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/marketplace/my-rewards');
            
            if (response.data && response.data.rewards) {
                setRewards(response.data.rewards);
            }
        } catch (error) {
            console.error('Error fetching rewards:', error);
            toast.error('Failed to load reward history');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format = 'csv') => {
        try {
            const response = await apiClient.get('/api/marketplace/my-rewards/export', {
                responseType: 'blob'
            });
            
            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `my_rewards.${format}`);
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success('Rewards exported successfully');
        } catch (error) {
            console.error('Error exporting rewards:', error);
            toast.error('Failed to export rewards');
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status.toLowerCase()) {
            case 'confirmed':
                return 'status-confirmed';
            case 'unconfirmed':
                return 'status-unconfirmed';
            case 'pending':
                return 'status-pending';
            case 'rejected':
                return 'status-rejected';
            default:
                return 'status-default';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="my-rewards-section">
            <div className="my-rewards-header">
                <h2>My Rewards</h2>
                <div className="export-options">
                    <button 
                        className="export-button csv"
                        onClick={() => handleExport('csv')}
                        title="Export as CSV"
                    >
                        📊 CSV
                    </button>
                    <button 
                        className="export-button download"
                        onClick={() => handleExport('csv')}
                        title="Download"
                    >
                        ⬇️
                    </button>
                </div>
            </div>
            
            {loading ? (
                <div className="rewards-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading your rewards...</p>
                </div>
            ) : (
                <div className="rewards-table-container">
                    {rewards.length > 0 ? (
                        <table className="rewards-table">
                            <thead>
                                <tr>
                                    <th>Reward</th>
                                    <th>Type</th>
                                    <th>XP Spent</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rewards.map((reward, index) => (
                                    <tr key={index}>
                                        <td className="reward-title">
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
                                        <td className="reward-type">
                                            <span className={`type-badge ${reward.reward_type.toLowerCase()}`}>
                                                {reward.reward_type === 'DIRECT' ? 'Direct' : 'Raffle'}
                                            </span>
                                        </td>
                                        <td className="xp-spent">
                                            <div className="xp-display">
                                                <span className="xp-amount">{reward.xp_spent.toLocaleString()}</span>
                                                <span className="xp-label">XP</span>
                                            </div>
                                        </td>
                                        <td className="reward-date">
                                            {formatDate(reward.date)}
                                        </td>
                                        <td className="reward-status">
                                            <span className={`status-badge ${getStatusBadgeClass(reward.status)}`}>
                                                {reward.status.charAt(0).toUpperCase() + reward.status.slice(1).toLowerCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="no-rewards">
                            <div className="no-rewards-icon">🎁</div>
                            <h3>No rewards yet</h3>
                            <p>Start earning XP and redeem your first reward!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MyRewardsSection; 