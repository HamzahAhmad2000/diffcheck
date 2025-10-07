import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { dailyRewardAPI, marketplaceAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';

const AdminDailyRewardsConfigForm = () => {
    const navigate = useNavigate();
    const { configId } = useParams();
    const path = window.location.pathname;
    const action = path.includes('/create') ? 'create' : 
                   path.includes('/duplicate') ? 'duplicate' : 
                   path.includes('/edit') ? 'edit' : 'create';
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [marketplaceItems, setMarketplaceItems] = useState([]);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [currentDay, setCurrentDay] = useState(null);
    const [currentRewardType, setCurrentRewardType] = useState('XP');

    // Form state
    const [formData, setFormData] = useState({
        week_identifier: '',
        recovery_xp_cost: 10,
        weekly_freeze_count: 2,
        bonus_reward_type: null,
        bonus_xp_amount: null,
        bonus_raffle_item_id: null,
        daily_rewards: Array(7).fill(null).map((_, i) => ({
            day_of_week: i + 1,
            reward_type: null,
            xp_amount: null,
            raffle_item_id: null
        }))
    });

    // Modal state for setting rewards
    const [modalReward, setModalReward] = useState({
        type: 'XP',
        xp_amount: 25,
        raffle_item_id: null
    });

    const isEditMode = action === 'edit';
    const isDuplicateMode = action === 'duplicate';
    const isCreateMode = action === 'create' || !action;

    const fetchMarketplaceItems = useCallback(async () => {
        try {
            const response = await marketplaceAPI.adminGetItems();
            setMarketplaceItems(response.data.items || []);
        } catch (error) {
            console.error("Error fetching marketplace items:", error);
            // Don't show error toast as this is not critical
        }
    }, []);

    const fetchConfiguration = useCallback(async () => {
        if (!configId || isCreateMode) return;

        setLoading(true);
        try {
            const response = await dailyRewardAPI.adminGetWeekConfiguration(configId);
            const config = response.data.config || response.data;
            
            // Transform the data to match our form structure
            const transformedData = {
                week_identifier: isDuplicateMode ? `${config.week_identifier} (Copy)` : config.week_identifier,
                recovery_xp_cost: config.recovery_xp_cost || 10,
                weekly_freeze_count: config.weekly_freeze_count || 2,
                bonus_reward_type: config.bonus_reward?.type || null,
                bonus_xp_amount: config.bonus_reward?.xp_amount || null,
                bonus_raffle_item_id: config.bonus_reward?.raffle_item_id || null,
                daily_rewards: Array(7).fill(null).map((_, i) => {
                    const dayReward = config.daily_rewards?.find(r => r.day_of_week === i + 1);
                    return {
                        day_of_week: i + 1,
                        reward_type: dayReward?.reward?.type || null,
                        xp_amount: dayReward?.reward?.xp_amount || null,
                        raffle_item_id: dayReward?.reward?.raffle_item_id || null
                    };
                })
            };

            setFormData(transformedData);
        } catch (error) {
            console.error("Error fetching configuration:", error);
            toast.error(error.response?.data?.error || 'Failed to load configuration.');
            navigate('/admin/daily-rewards');
        } finally {
            setLoading(false);
        }
    }, [configId, isCreateMode, isDuplicateMode, navigate]);

    useEffect(() => {
        fetchMarketplaceItems();
        fetchConfiguration();
    }, [fetchMarketplaceItems, fetchConfiguration]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const openRewardModal = (dayIndex = null) => {
        setCurrentDay(dayIndex);
        
        if (dayIndex !== null) {
            // Setting daily reward
            const dayReward = formData.daily_rewards[dayIndex];
            setModalReward({
                type: dayReward.reward_type || 'XP',
                xp_amount: dayReward.xp_amount || 25,
                raffle_item_id: dayReward.raffle_item_id || null
            });
        } else {
            // Setting bonus reward
            setModalReward({
                type: formData.bonus_reward_type || 'XP',
                xp_amount: formData.bonus_xp_amount || 50,
                raffle_item_id: formData.bonus_raffle_item_id || null
            });
        }
        
        setCurrentRewardType(modalReward.type);
        setShowRewardModal(true);
    };

    const saveReward = () => {
        if (currentDay !== null) {
            // Save daily reward
            const newDailyRewards = [...formData.daily_rewards];
            newDailyRewards[currentDay] = {
                day_of_week: currentDay + 1,
                reward_type: modalReward.type,
                xp_amount: modalReward.type === 'XP' ? modalReward.xp_amount : null,
                raffle_item_id: modalReward.type === 'RAFFLE_ENTRY' ? modalReward.raffle_item_id : null
            };
            
            setFormData(prev => ({
                ...prev,
                daily_rewards: newDailyRewards
            }));
        } else {
            // Save bonus reward
            setFormData(prev => ({
                ...prev,
                bonus_reward_type: modalReward.type,
                bonus_xp_amount: modalReward.type === 'XP' ? modalReward.xp_amount : null,
                bonus_raffle_item_id: modalReward.type === 'RAFFLE_ENTRY' ? modalReward.raffle_item_id : null
            }));
        }
        
        setShowRewardModal(false);
        setCurrentDay(null);
    };

    const clearReward = (dayIndex = null) => {
        if (dayIndex !== null) {
            // Clear daily reward
            const newDailyRewards = [...formData.daily_rewards];
            newDailyRewards[dayIndex] = {
                day_of_week: dayIndex + 1,
                reward_type: null,
                xp_amount: null,
                raffle_item_id: null
            };
            
            setFormData(prev => ({
                ...prev,
                daily_rewards: newDailyRewards
            }));
        } else {
            // Clear bonus reward
            setFormData(prev => ({
                ...prev,
                bonus_reward_type: null,
                bonus_xp_amount: null,
                bonus_raffle_item_id: null
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.week_identifier.trim()) {
            toast.error('Week identifier is required.');
            return;
        }

        if (formData.recovery_xp_cost < 1) {
            toast.error('Recovery XP cost must be at least 1.');
            return;
        }

        if (formData.weekly_freeze_count < 0) {
            toast.error('Weekly freeze count cannot be negative.');
            return;
        }

        // Check if at least one daily reward is set
        const hasRewards = formData.daily_rewards.some(reward => reward.reward_type);
        if (!hasRewards) {
            toast.error('Please set at least one daily reward.');
            return;
        }

        setSaving(true);
        try {
            const submitData = {
                week_identifier: formData.week_identifier.trim(),
                recovery_xp_cost: parseInt(formData.recovery_xp_cost),
                weekly_freeze_count: parseInt(formData.weekly_freeze_count),
                bonus_reward_type: formData.bonus_reward_type,
                bonus_xp_amount: formData.bonus_xp_amount ? parseInt(formData.bonus_xp_amount) : null,
                bonus_raffle_item_id: formData.bonus_raffle_item_id ? parseInt(formData.bonus_raffle_item_id) : null,
                daily_rewards: formData.daily_rewards.filter(reward => reward.reward_type).map(reward => ({
                    day_of_week: reward.day_of_week,
                    reward_type: reward.reward_type,
                    xp_amount: reward.xp_amount ? parseInt(reward.xp_amount) : null,
                    raffle_item_id: reward.raffle_item_id ? parseInt(reward.raffle_item_id) : null
                }))
            };

            if (isEditMode && !isDuplicateMode) {
                await dailyRewardAPI.adminUpdateWeekConfiguration(configId, submitData);
                toast.success('Configuration updated successfully!');
            } else {
                await dailyRewardAPI.adminCreateWeekConfiguration(submitData);
                toast.success('Configuration created successfully!');
            }

            navigate('/admin/daily-rewards');
        } catch (error) {
            console.error("Error saving configuration:", error);
            toast.error(error.response?.data?.error || 'Failed to save configuration.');
        } finally {
            setSaving(false);
        }
    };

    const getDayName = (dayIndex) => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days[dayIndex];
    };

    const formatRewardDisplay = (reward) => {
        if (!reward.reward_type) return null;
        
        if (reward.reward_type === 'XP') {
            return `💰 ${reward.xp_amount} XP`;
        } else if (reward.reward_type === 'RAFFLE_ENTRY') {
            const item = marketplaceItems.find(item => item.id === reward.raffle_item_id);
            return `🎟️ ${item?.title || 'Raffle Entry'}`;
        }
        
        return 'Unknown';
    };

    const formatBonusDisplay = () => {
        if (!formData.bonus_reward_type) return null;
        
        if (formData.bonus_reward_type === 'XP') {
            return `💰 ${formData.bonus_xp_amount} XP`;
        } else if (formData.bonus_reward_type === 'RAFFLE_ENTRY') {
            const item = marketplaceItems.find(item => item.id === formData.bonus_raffle_item_id);
            return `🎟️ ${item?.title || 'Raffle Entry'}`;
        }
        
        return 'Unknown';
    };

    const getPageTitle = () => {
        if (isDuplicateMode) return 'Duplicate Week Configuration';
        if (isEditMode) return 'Edit Week Configuration';
        return 'Create Week Configuration';
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 b_admin_styling-main">
                    <BLoading variant="page" label="Loading configuration..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 b_admin_styling-main" style={{ paddingRight: '25px' }}>
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">{getPageTitle()}</h1>
                        <p className="chat-subtitle" style={{ margin: 0 }}>
                            Configure the daily rewards for a week including individual day rewards and completion bonus.
                        </p>
                    </div>
                    <BButton 
                        onClick={() => navigate('/admin/daily-rewards')} 
                        variant="secondary" 
                        size="sm"
                    >
                        <i className="ri-arrow-left-line"></i> Back to Dashboard
                    </BButton>
                </div>

                <form onSubmit={handleSubmit} className="b_admin_styling-form">
                    {/* Configuration Settings */}
                    <div className="b_admin_styling-form-section">
                        <h3 className="b_admin_styling-form-section__title">Configuration Settings</h3>
                        
                        <div className="b_admin_styling-form-grid">
                            <div className="b_admin_styling-form-group">
                                <label htmlFor="week_identifier" className="b_admin_styling-form-label">
                                    Week Identifier *
                                </label>
                                <input
                                    id="week_identifier"
                                    type="text"
                                    className="b_admin_styling-input"
                                    placeholder="e.g., July Week 1 - Standard"
                                    value={formData.week_identifier}
                                    onChange={(e) => handleInputChange('week_identifier', e.target.value)}
                                    required
                                />
                                <p className="b_admin_styling-form-help">
                                    A descriptive name for this week configuration.
                                </p>
                            </div>

                            <div className="b_admin_styling-form-group">
                                <label htmlFor="recovery_xp_cost" className="b_admin_styling-form-label">
                                    Recovery XP Cost
                                </label>
                                <input
                                    id="recovery_xp_cost"
                                    type="number"
                                    min="1"
                                    className="b_admin_styling-input"
                                    value={formData.recovery_xp_cost}
                                    onChange={(e) => handleInputChange('recovery_xp_cost', e.target.value)}
                                />
                                <p className="b_admin_styling-form-help">
                                    XP cost for users to recover a missed day.
                                </p>
                            </div>

                            <div className="b_admin_styling-form-group">
                                <label htmlFor="weekly_freeze_count" className="b_admin_styling-form-label">
                                    Weekly Streak Freezes
                                </label>
                                <input
                                    id="weekly_freeze_count"
                                    type="number"
                                    min="0"
                                    className="b_admin_styling-input"
                                    value={formData.weekly_freeze_count}
                                    onChange={(e) => handleInputChange('weekly_freeze_count', e.target.value)}
                                />
                                <p className="b_admin_styling-form-help">
                                    Number of free misses a user gets per week before their streak resets.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Daily Reward Slots */}
                    <div className="b_admin_styling-form-section">
                        <h3 className="b_admin_styling-form-section__title">Daily Reward Slots</h3>
                        
                        <div className="daily-rewards-grid" style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '16px',
                            marginTop: '16px'
                        }}>
                            {formData.daily_rewards.map((reward, index) => (                                <div key={index} className="daily-reward-card" style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    backgroundColor: 'var(--background-secondary)'
                                }}>
                                    <div className="daily-reward-card__header" style={{ color : "#000000" }}>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600' }}>
                                            Day {index + 1}
                                        </h4>
                                        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {getDayName(index)}
                                        </p>
                                    </div>
                                    
                                    <div className="daily-reward-card__content">
                                        {reward.reward_type ? (
                                            <div>
                                                <div className="reward-display" style={{
                                                    padding: '8px 12px',
                                                    backgroundColor: 'var(--background-primary)',
                                                    borderRadius: '6px',
                                                    marginBottom: '8px',
                                                    fontSize: '13px',
                                                    fontWeight: '500'
                                                }}>
                                                    {formatRewardDisplay(reward)}
                                                </div>
                                                <div className="reward-actions" style={{ display: 'flex', gap: '8px' }}>
                                                    <BButton 
                                                        type="button"
                                                        variant="secondary" 
                                                        size="xs"
                                                        onClick={() => openRewardModal(index)}
                                                    >
                                                        Edit
                                                    </BButton>
                                                    <BButton 
                                                        type="button"
                                                        variant="danger" 
                                                        size="xs"
                                                        onClick={() => clearReward(index)}
                                                    >
                                                        Clear
                                                    </BButton>
                                                </div>
                                            </div>
                                        ) : (
                                            <BButton 
                                                type="button"
                                                variant="primary" 
                                                size="sm"
                                                onClick={() => openRewardModal(index)}
                                                style={{ width: '100%' }}
                                            >
                                                <i className="ri-add-line"></i> Set Reward
                                            </BButton>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Week Completion Bonus */}
                    <div className="b_admin_styling-form-section">
                        <h3 className="b_admin_styling-form-section__title">7-Day Completion Bonus Reward</h3>
                        
                        <div className="completion-bonus-card" style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '20px',
                            backgroundColor: 'var(--background-secondary)',
                            marginTop: '16px'
                        }}>
                            {formData.bonus_reward_type ? (
                                <div>
                                    <div className="reward-display" style={{
                                        padding: '12px 16px',
                                        backgroundColor: 'var(--background-primary)',
                                        borderRadius: '6px',
                                        marginBottom: '12px',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}>
                                        {formatBonusDisplay()}
                                    </div>
                                    <div className="reward-actions" style={{ display: 'flex', gap: '8px' }}>
                                        <BButton 
                                            type="button"
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => openRewardModal(null)}
                                        >
                                            Edit Bonus
                                        </BButton>
                                        <BButton 
                                            type="button"
                                            variant="danger" 
                                            size="sm"
                                            onClick={() => clearReward(null)}
                                        >
                                            Clear Bonus
                                        </BButton>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>
                                        No completion bonus set
                                    </p>
                                    <BButton 
                                        type="button"
                                        variant="primary" 
                                        size="sm"
                                        onClick={() => openRewardModal(null)}
                                    >
                                        <i className="ri-add-line"></i> Set Completion Bonus
                                    </BButton>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="b_admin_styling-form-actions">
                        <BButton 
                            type="button"
                            variant="secondary" 
                            onClick={() => navigate('/admin/daily-rewards')}
                            disabled={saving}
                        >
                            Cancel
                        </BButton>
                        <BButton 
                            type="submit"
                            variant="primary"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <i className="ri-loader-4-line ri-spin"></i>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="ri-save-line"></i>
                                    Save Configuration
                                </>
                            )}
                        </BButton>
                    </div>
                </form>
            </div>

            {/* Reward Setting Modal */}
            {showRewardModal && (
                <div className="modal-overlay" onClick={() => setShowRewardModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <div className="modal-header">
                            <h3>
                                {currentDay !== null 
                                    ? `Set Reward for Day ${currentDay + 1} (${getDayName(currentDay)})`
                                    : 'Set Week Completion Bonus'
                                }
                            </h3>
                            <button 
                                type="button"
                                className="modal-close"
                                onClick={() => setShowRewardModal(false)}
                            >
                                <i className="ri-close-line"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="b_admin_styling-form-group">
                                <label className="b_admin_styling-form-label">Reward Type</label>
                                <div className="reward-type-options" style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                    <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="radio"
                                            name="reward_type"
                                            value="XP"
                                            checked={modalReward.type === 'XP'}
                                            onChange={(e) => setModalReward(prev => ({ ...prev, type: e.target.value }))}
                                        />
                                        <span>💰 XP</span>
                                    </label>
                                    <label className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="radio"
                                            name="reward_type"
                                            value="RAFFLE_ENTRY"
                                            checked={modalReward.type === 'RAFFLE_ENTRY'}
                                            onChange={(e) => setModalReward(prev => ({ ...prev, type: e.target.value }))}
                                        />
                                        <span>🎟️ Raffle Entry</span>
                                    </label>
                                </div>
                            </div>

                            {modalReward.type === 'XP' && (
                                <div className="b_admin_styling-form-group">
                                    <label htmlFor="xp_amount" className="b_admin_styling-form-label">
                                        XP Amount
                                    </label>
                                    <input
                                        id="xp_amount"
                                        type="number"
                                        min="1"
                                        className="b_admin_styling-input"
                                        value={modalReward.xp_amount || ''}
                                        onChange={(e) => setModalReward(prev => ({ ...prev, xp_amount: e.target.value }))}
                                        placeholder="e.g., 25"
                                    />
                                </div>
                            )}

                            {modalReward.type === 'RAFFLE_ENTRY' && (
                                <div className="b_admin_styling-form-group">
                                    <label htmlFor="raffle_item" className="b_admin_styling-form-label">
                                        Select Raffle Item
                                    </label>
                                    <select
                                        id="raffle_item"
                                        className="b_admin_styling-input"
                                        value={modalReward.raffle_item_id || ''}
                                        onChange={(e) => setModalReward(prev => ({ ...prev, raffle_item_id: e.target.value }))}
                                    >
                                        <option value="">Select an item...</option>
                                        {marketplaceItems.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <BButton 
                                type="button"
                                variant="secondary" 
                                onClick={() => setShowRewardModal(false)}
                            >
                                Cancel
                            </BButton>
                            <BButton 
                                type="button"
                                variant="primary"
                                onClick={saveReward}
                                disabled={
                                    (modalReward.type === 'XP' && !modalReward.xp_amount) ||
                                    (modalReward.type === 'RAFFLE_ENTRY' && !modalReward.raffle_item_id)
                                }
                            >
                                Save Reward
                            </BButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDailyRewardsConfigForm;
