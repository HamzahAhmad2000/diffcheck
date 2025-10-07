import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { seasonPassAPI } from '../../services/apiClient';
import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';

const SeasonPassActivation = () => {
    const navigate = useNavigate();
    const [seasonData, setSeasonData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState('LUNAR');
    const [paymentMethod, setPaymentMethod] = useState('STRIPE');
    const [purchasing, setPurchasing] = useState(false);
    const [isUpgrade, setIsUpgrade] = useState(false);
    const [currentPass, setCurrentPass] = useState(null);

    useEffect(() => {
        fetchSeasonData();
    }, []);

    const fetchSeasonData = async () => {
        try {
            setLoading(true);
            // Try to get authenticated user state, fallback to preview
            let response;
            try {
                response = await seasonPassAPI.getState();
                
                // Check if user already has a season pass
                const userData = response.data?.data;
                if (userData?.user_pass) {
                    if (userData.user_pass.tier_type === 'TOTALITY') {
                        toast.info('You already have the highest tier Season Pass!');
                        setTimeout(() => {
                            navigate('/user/season-pass/rewards');
                        }, 2000);
                        return;
                    } else if (userData.user_pass.tier_type === 'LUNAR') {
                        // User has Lunar pass, allow upgrade to Totality
                        toast.info('You have a Lunar Pass. You can upgrade to Totality!');
                        setSelectedTier('TOTALITY'); // Pre-select Totality for upgrade
                        setIsUpgrade(true);
                        setCurrentPass(userData.user_pass);
                    }
                }
            } catch (error) {
                if (error.response?.status === 401) {
                    // User not authenticated, redirect to login
                    toast.error('Please log in to activate a Season Pass');
                    navigate('/auth/login');
                    return;
                } else {
                    throw error;
                }
            }
            
            setSeasonData(response.data?.data || null);
        } catch (error) {
            console.error('Error fetching season data:', error);
            toast.error('Failed to load Season Pass information');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        try {
            setPurchasing(true);
            
            let purchaseResponse;
            
            if (paymentMethod === 'STRIPE') {
                // Create Stripe payment intent
                const paymentIntentResponse = await seasonPassAPI.createStripeIntent(selectedTier);
                const { client_secret, payment_intent_id } = paymentIntentResponse.data?.data || {};
                
                if (!client_secret) {
                    throw new Error('Failed to create payment intent');
                }

                // For demo purposes, we'll directly confirm the payment
                // In production, this would integrate with Stripe Elements
                purchaseResponse = await seasonPassAPI.confirmStripePayment(payment_intent_id);
                
            } else if (paymentMethod === 'CRYPTO') {
                // Create crypto payment session
                const cryptoResponse = await seasonPassAPI.createCryptoSession(selectedTier);
                
                if (cryptoResponse.data?.success) {
                    // For demo purposes, we'll use direct purchase
                    // In production, this would redirect to crypto payment gateway
                    purchaseResponse = await seasonPassAPI.purchaseDirect(selectedTier, 'CRYPTO', 'demo_crypto_txn');
                } else {
                    throw new Error('Failed to create crypto payment session');
                }
            } else {
                // Direct purchase for testing
                purchaseResponse = await seasonPassAPI.purchaseDirect(selectedTier, paymentMethod);
            }
            
            if (purchaseResponse?.data?.success) {
                // Update user data in localStorage to reflect the new season pass
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                if (userData) {
                    // Trigger user data refresh
                    window.dispatchEvent(new CustomEvent('userUpdated'));
                }
                
                toast.success(`🎉 ${selectedTier} Season Pass activated successfully!`);
                toast.success(`You now have a ${selectedTier === 'LUNAR' ? '1.25x' : '2x'} XP multiplier!`);
                
                // Navigate to rewards page to show the activated pass
                setTimeout(() => {
                    navigate('/user/season-pass/rewards');
                }, 2000);
            } else {
                throw new Error('Purchase failed - no success response');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to purchase Season Pass';
            toast.error(errorMessage);
            
            // If it's a duplicate purchase error, redirect to rewards
            if (errorMessage.includes('already purchased') || errorMessage.includes('already have')) {
                setTimeout(() => {
                    navigate('/user/season-pass/rewards');
                }, 2000);
            }
        } finally {
            setPurchasing(false);
        }
    };

    const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

    const getTierFeatures = (tier) => {
        const baseFeatures = [
            'Season progress tracking',
            'Basic tier rewards',
            'Achievement badges'
        ];

        if (tier === 'LUNAR') {
            return [
                ...baseFeatures,
                '1.25x XP multiplier',
                'Lunar tier exclusive rewards',
                'Early access to new features'
            ];
        } else {
            return [
                ...baseFeatures,
                '2x XP multiplier',
                'All Lunar rewards + Totality exclusive',
                'Premium raffle entries',
                'Exclusive cosmetics & badges',
                'Priority customer support'
            ];
        }
    };

    if (loading) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="loading-container">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Season Pass...</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!seasonData?.season_info) {
        return (
            <div className="app-layout">
                <main className="main-content12 full-height">
                    <div className="page-inner-container">
                        <div className="empty-state">
                            <i className="ri-error-warning-line empty-state__icon"></i>
                            <h3 className="empty-state__title">Season Pass Unavailable</h3>
                            <p className="empty-state__message">
                                No active season is currently available. Please check back later.
                            </p>
                            <button 
                                className="button button--primary"
                                onClick={() => navigate('/user/home')}
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const { season_info } = seasonData;
    const lunarPrice = season_info.lunar_pass_price;
    const totalityPrice = season_info.totality_pass_price;

    return (
        <div className="app-layout">
            <main className="main-content12 full-height">
                <div className="page-inner-container">
                    <div className="activation-header">
                        <button 
                            className="back-button"
                            onClick={() => navigate(-1)}
                        >
                            <i className="ri-arrow-left-line"></i>
                            Back
                        </button>
                        <div className="header-content">
                            <h1 className="page-title">
                                <i className="ri-vip-crown-line" style={{ color: 'var(--color-primary)' }}></i>
                                {isUpgrade ? 'Upgrade Season Pass' : 'Activate Season Pass'}
                            </h1>
                            <p className="page-subtitle">
                                {isUpgrade 
                                    ? `Upgrade your Lunar Pass to Totality for enhanced benefits in ${season_info.name}`
                                    : `Choose your tier and unlock exclusive rewards in ${season_info.name}`
                                }
                            </p>
                        </div>
                    </div>

                    <div className="activation-content">
                        {/* Season Info */}
                        <div className="season-info-card">
                            <div className="season-header">
                                <h2>{season_info.name}</h2>
                                {season_info.description && (
                                    <p className="season-description">{season_info.description}</p>
                                )}
                            </div>
                            
                            {season_info.countdown && season_info.countdown.total_seconds <= 259200 && (
                                <div className="season-countdown-banner">
                                    <i className="ri-time-line"></i>
                                    <span>
                                        Season ends in: {season_info.countdown.days}d {season_info.countdown.hours}h {season_info.countdown.minutes}m
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Tier Selection */}
                        <div className="tier-selection-container">
                            <h3 className="section-title">
                                {isUpgrade ? 'Upgrade to Totality Pass' : 'Choose Your Pass'}
                            </h3>
                            
                            {isUpgrade && currentPass && (
                                <div className="current-pass-info">
                                    <div className="current-pass-badge">
                                        <i className="ri-vip-crown-line"></i>
                                        <span>Current: {currentPass.tier_type} Pass</span>
                                        <span className="current-multiplier">1.25x XP</span>
                                    </div>
                                    <div className="upgrade-arrow">
                                        <i className="ri-arrow-right-line"></i>
                                    </div>
                                    <div className="upgrade-target-badge">
                                        <i className="ri-vip-crown-2-line"></i>
                                        <span>Upgrade to: TOTALITY Pass</span>
                                        <span className="upgrade-multiplier">2x XP</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="tier-options-grid">
                                {/* Lunar Pass */}
                                <div 
                                    className={`tier-card ${selectedTier === 'LUNAR' ? 'selected' : ''} ${isUpgrade ? 'disabled' : ''} lunar`}
                                    onClick={() => !isUpgrade && setSelectedTier('LUNAR')}
                                >
                                    <div className="tier-card-header">
                                        <div className="tier-icon">🌙</div>
                                        <div className="tier-info">
                                            <h4 className="tier-name">Lunar Pass</h4>
                                            <p className="tier-price">{formatPrice(lunarPrice)}</p>
                                        </div>
                                        <div className="tier-multiplier">1.25x XP</div>
                                    </div>
                                    
                                    <div className="tier-features">
                                        <h5>What's Included:</h5>
                                        <ul>
                                            {getTierFeatures('LUNAR').map((feature, index) => (
                                                <li key={index}>
                                                    <i className="ri-check-line"></i>
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    {selectedTier === 'LUNAR' && !isUpgrade && (
                                        <div className="selected-indicator">
                                            <i className="ri-check-circle-fill"></i>
                                            Selected
                                        </div>
                                    )}
                                    
                                    {isUpgrade && (
                                        <div className="disabled-overlay">
                                            <div className="disabled-message">
                                                <i className="ri-check-circle-fill"></i>
                                                <span>You already have this</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Totality Pass */}
                                <div 
                                    className={`tier-card ${selectedTier === 'TOTALITY' ? 'selected' : ''} totality`}
                                    onClick={() => setSelectedTier('TOTALITY')}
                                >
                                    <div className="tier-card-header">
                                        <div className="tier-badge">Most Popular</div>
                                        <div className="tier-icon">🌟</div>
                                        <div className="tier-info">
                                            <h4 className="tier-name">Totality Pass</h4>
                                            <p className="tier-price">{formatPrice(totalityPrice)}</p>
                                        </div>
                                        <div className="tier-multiplier">2x XP</div>
                                    </div>
                                    
                                    <div className="tier-features">
                                        <h5>What's Included:</h5>
                                        <ul>
                                            {getTierFeatures('TOTALITY').map((feature, index) => (
                                                <li key={index}>
                                                    <i className="ri-check-line"></i>
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    {selectedTier === 'TOTALITY' && (
                                        <div className="selected-indicator">
                                            <i className="ri-check-circle-fill"></i>
                                            Selected
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Season Preview Section */}
                        <div className="season-preview-container">
                            <h3 className="section-title">Full Season Track Preview</h3>
                            <div className="season-track-preview">
                                {seasonData?.levels?.map((levelData) => {
                                    const level = levelData.level_number;
                                    const lunarReward = levelData.lunar_reward;
                                    const totalityReward = levelData.totality_reward;
                                    
                                    const getRewardDisplay = (reward) => {
                                        if (!reward) return <span className="reward-item empty-slot">-</span>;
                                        
                                        const icon = {
                                            'XP': '✨',
                                            'BADGE': '🏆',
                                            'RAFFLE_ENTRY': '🎁',
                                            'MARKETPLACE_ITEM': '🛍️',
                                            'CUSTOM': '🎯'
                                        }[reward.reward_type] || '❓';
                                        
                                        let displayText = reward.display_name;
                                        if (!displayText) {
                                            if (reward.reward_type === 'XP') {
                                                displayText = `+${reward.xp_amount} XP`;
                                            } else if (reward.reward_type === 'BADGE') {
                                                displayText = reward.badge?.name || 'Badge';
                                            } else if (reward.reward_type === 'RAFFLE_ENTRY') {
                                                displayText = reward.marketplace_item?.name || 'Raffle Entry';
                                            } else {
                                                displayText = reward.reward_type;
                                            }
                                        }
                                        
                                        return <span className={`reward-item ${reward.tier_type === 'TOTALITY' ? 'premium' : ''}`}>{icon} {displayText}</span>;
                                    };
                                    
                                    return (
                                        <div key={level} className="preview-level">
                                            <div className="level-number">{level}</div>
                                            <div className="level-rewards">
                                                <div className="tier-preview lunar">
                                                    <div className="tier-label">🌙 Lunar</div>
                                                    <div className="reward-preview">
                                                        {getRewardDisplay(lunarReward)}
                                                    </div>
                                                </div>
                                                <div className="tier-preview totality">
                                                    <div className="tier-label">🌟 Totality</div>
                                                    <div className="reward-preview">
                                                        {getRewardDisplay(totalityReward)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) || [...Array(15)].map((_, index) => (
                                    <div key={index + 1} className="preview-level">
                                        <div className="level-number">{index + 1}</div>
                                        <div className="level-rewards">
                                            <div className="tier-preview lunar">
                                                <div className="tier-label">🌙 Lunar</div>
                                                <div className="reward-preview">
                                                    <span className="reward-item empty-slot">-</span>
                                                </div>
                                            </div>
                                            <div className="tier-preview totality">
                                                <div className="tier-label">🌟 Totality</div>
                                                <div className="reward-preview">
                                                    <span className="reward-item empty-slot">-</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="payment-method-container">
                            <h3 className="section-title">Payment Method</h3>
                            
                            <div className="payment-options">
                                <div 
                                    className={`payment-option ${paymentMethod === 'STRIPE' ? 'selected' : ''}`}
                                    onClick={() => setPaymentMethod('STRIPE')}
                                >
                                    <div className="payment-icon">
                                        <i className="ri-bank-card-line"></i>
                                    </div>
                                    <div className="payment-info">
                                        <h4>Credit/Debit Card</h4>
                                        <p>Secure payment via Stripe</p>
                                    </div>
                                    {paymentMethod === 'STRIPE' && (
                                        <i className="ri-check-circle-fill selected-icon"></i>
                                    )}
                                </div>

                                <div 
                                    className={`payment-option ${paymentMethod === 'CRYPTO' ? 'selected' : ''}`}
                                    onClick={() => setPaymentMethod('CRYPTO')}
                                >
                                    <div className="payment-icon">
                                        <i className="ri-currency-line"></i>
                                    </div>
                                    <div className="payment-info">
                                        <h4>Cryptocurrency</h4>
                                        <p>Pay with crypto</p>
                                    </div>
                                    {paymentMethod === 'CRYPTO' && (
                                        <i className="ri-check-circle-fill selected-icon"></i>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Purchase Summary */}
                        <div className="purchase-summary">
                            <div className="summary-content">
                                <div className="summary-item">
                                    <span className="summary-label">Selected Pass:</span>
                                    <span className="summary-value">
                                        {selectedTier === 'LUNAR' ? '🌙 Lunar Pass' : '🌟 Totality Pass'}
                                    </span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-label">XP Multiplier:</span>
                                    <span className="summary-value multiplier-highlight">
                                        {selectedTier === 'LUNAR' ? '1.25x' : '2x'}
                                    </span>
                                </div>
                                <div className="summary-item total">
                                    <span className="summary-label">Total:</span>
                                    <span className="summary-value">
                                        {formatPrice(selectedTier === 'LUNAR' ? lunarPrice : totalityPrice)}
                                    </span>
                                </div>
                            </div>

                            <button 
                                className={`purchase-button ${purchasing ? 'loading' : ''}`}
                                onClick={handlePurchase}
                                disabled={purchasing}
                            >
                                {purchasing ? (
                                    <>
                                        <div className="mini-loading-spinner"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <i className={isUpgrade ? "ri-arrow-up-line" : "ri-shopping-cart-line"}></i>
                                        {isUpgrade 
                                            ? `Upgrade to ${selectedTier === 'LUNAR' ? 'Lunar' : 'Totality'} Pass`
                                            : `Purchase ${selectedTier === 'LUNAR' ? 'Lunar' : 'Totality'} Pass`
                                        }
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Terms and Info */}
                        <div className="terms-info">
                            <div className="info-grid">
                                <div className="info-item">
                                    <i className="ri-shield-check-line"></i>
                                    <div>
                                        <h4>Secure Payment</h4>
                                        <p>Your payment information is encrypted and secure</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <i className="ri-time-line"></i>
                                    <div>
                                        <h4>Instant Activation</h4>
                                        <p>Your Season Pass will be activated immediately after purchase</p>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <i className="ri-trophy-line"></i>
                                    <div>
                                        <h4>Retroactive Rewards</h4>
                                        <p>Claim rewards from levels you've already unlocked</p>
                                    </div>
                                </div>
                            </div>
                            
                            <p className="terms-text">
                                By purchasing a Season Pass, you agree to our Terms of Service and Privacy Policy. 
                                Season Passes are valid for the current season only and cannot be transferred or refunded.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
                .activation-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .back-button {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    color: var(--color-text-light);
                    padding: 12px 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    font-size: 0.9rem;
                }

                .back-button:hover {
                    background: var(--color-surface-alt);
                    transform: translateY(-1px);
                }

                .header-content {
                    flex: 1;
                }

                .page-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--color-text-light);
                    margin: 0 0 8px 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .page-subtitle {
                    color: var(--color-text-muted);
                    font-size: 1.1rem;
                    margin: 0;
                }

                .activation-content {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }

                .season-info-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 24px;
                }

                .season-header h2 {
                    color: var(--color-text-light);
                    margin: 0 0 8px 0;
                    font-size: 1.5rem;
                }

                .season-description {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 1rem;
                }

                .season-countdown-banner {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-weight: 500;
                }

                .section-title {
                    color: var(--color-text-light);
                    font-size: 1.3rem;
                    font-weight: 600;
                    margin: 0 0 20px 0;
                }

                .tier-options-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }

                .tier-card {
                    background: var(--color-surface);
                    border: 2px solid var(--color-border);
                    border-radius: 16px;
                    padding: 24px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .tier-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 32px rgba(170, 46, 255, 0.2);
                }

                .tier-card.selected {
                    border-color: var(--color-primary);
                    background: linear-gradient(135deg, var(--color-surface) 0%, rgba(170, 46, 255, 0.1) 100%);
                }

                .tier-card.lunar.selected {
                    border-color: #4a90e2;
                    background: linear-gradient(135deg, var(--color-surface) 0%, rgba(74, 144, 226, 0.1) 100%);
                }

                .tier-card.totality.selected {
                    border-color: #ffd700;
                    background: linear-gradient(135deg, var(--color-surface) 0%, rgba(255, 215, 0, 0.1) 100%);
                }

                .tier-card.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    pointer-events: none;
                }

                .current-pass-info {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                }

                .current-pass-badge, .upgrade-target-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 16px;
                    border-radius: 8px;
                    text-align: center;
                }

                .current-pass-badge {
                    background: linear-gradient(135deg, #4a90e2, #357abd);
                    color: white;
                }

                .upgrade-target-badge {
                    background: linear-gradient(135deg, #ffd700, #ff8c00);
                    color: #333;
                }

                .current-multiplier, .upgrade-multiplier {
                    font-size: 0.9rem;
                    font-weight: 600;
                    padding: 4px 8px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.2);
                }

                .upgrade-arrow {
                    font-size: 1.5rem;
                    color: var(--color-primary);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                .disabled-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .disabled-message {
                    background: var(--color-success);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .tier-badge {
                    position: absolute;
                    top: 0;
                    right: 0;
                    background: linear-gradient(135deg, #ffd700, #ff8c00);
                    color: #333;
                    padding: 6px 16px;
                    border-radius: 0 16px 0 16px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .tier-card-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .tier-icon {
                    font-size: 2.5rem;
                    line-height: 1;
                }

                .tier-info {
                    flex: 1;
                }

                .tier-name {
                    color: var(--color-text-light);
                    font-size: 1.4rem;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                }

                .tier-price {
                    color: var(--color-primary);
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin: 0;
                }

                .tier-multiplier {
                    background: var(--color-primary);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .tier-features h5 {
                    color: var(--color-text-light);
                    font-size: 1rem;
                    margin: 0 0 12px 0;
                }

                .tier-features ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .tier-features li {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--color-text-muted);
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                }

                .tier-features li i {
                    color: var(--color-primary);
                    font-size: 1rem;
                }

                .selected-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--color-primary);
                    font-weight: 600;
                    margin-top: 16px;
                    padding: 8px 0;
                }

                .payment-options {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 16px;
                }

                .payment-option {
                    background: var(--color-surface);
                    border: 2px solid var(--color-border);
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .payment-option:hover {
                    border-color: var(--color-primary);
                    transform: translateY(-2px);
                }

                .payment-option.selected {
                    border-color: var(--color-primary);
                    background: linear-gradient(135deg, var(--color-surface) 0%, rgba(170, 46, 255, 0.1) 100%);
                }

                .payment-icon {
                    font-size: 1.5rem;
                    color: var(--color-primary);
                }

                .payment-info {
                    flex: 1;
                }

                .payment-info h4 {
                    color: var(--color-text-light);
                    margin: 0 0 4px 0;
                    font-size: 1.1rem;
                }

                .payment-info p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .selected-icon {
                    color: var(--color-primary);
                    font-size: 1.2rem;
                }

                .purchase-summary {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 24px;
                }

                .summary-content {
                    margin-bottom: 24px;
                }

                .summary-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    font-size: 1rem;
                }

                .summary-item.total {
                    font-size: 1.2rem;
                    font-weight: 700;
                    padding-top: 12px;
                    border-top: 1px solid var(--color-border);
                    margin-top: 12px;
                }

                .summary-label {
                    color: var(--color-text-muted);
                }

                .summary-value {
                    color: var(--color-text-light);
                    font-weight: 600;
                }

                .multiplier-highlight {
                    background: var(--color-primary);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.9rem;
                }

                .purchase-button {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 16px 24px;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                }

                .purchase-button:hover:not(:disabled) {
                    background: var(--color-primary-dark);
                    transform: translateY(-2px);
                }

                .purchase-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .purchase-button.loading {
                    pointer-events: none;
                }

                .terms-info {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 24px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }

                .info-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }

                .info-item i {
                    color: var(--color-primary);
                    font-size: 1.3rem;
                    margin-top: 2px;
                }

                .info-item h4 {
                    color: var(--color-text-light);
                    margin: 0 0 4px 0;
                    font-size: 1rem;
                }

                .info-item p {
                    color: var(--color-text-muted);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .terms-text {
                    color: var(--color-text-muted);
                    font-size: 0.85rem;
                    line-height: 1.5;
                    text-align: center;
                    padding-top: 20px;
                    border-top: 1px solid var(--color-border);
                    margin: 0;
                }

                /* Season Preview Styles */
                .season-preview-container {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 24px;
                }

                .season-track-preview {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 16px;
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 16px;
                    background: var(--color-background);
                    border-radius: 8px;
                }

                .preview-level {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    min-height: 120px;
                }

                .level-number {
                    font-weight: 700;
                    font-size: 0.9rem;
                    margin-bottom: 8px;
                    background: var(--color-primary);
                    color: white !important;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 8px auto;
                }

                .level-rewards {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .tier-preview {
                    background: var(--color-background);
                    border-radius: 4px;
                    padding: 6px;
                    border: 1px solid var(--color-border);
                }

                .tier-preview.lunar {
                    border-color: #4a90e2;
                    background: linear-gradient(135deg, var(--color-background) 0%, rgba(74, 144, 226, 0.1) 100%);
                }

                .tier-preview.totality {
                    border-color: #ffd700;
                    background: linear-gradient(135deg, var(--color-background) 0%, rgba(255, 215, 0, 0.1) 100%);
                }

                .tier-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: var(--color-text-light);
                }

                .reward-preview {
                    min-height: 20px;
                }

                .reward-item {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--color-text-muted);
                    line-height: 1.2;
                }

                .reward-item.premium {
                    color: #ffd700;
                    font-weight: 600;
                }

                .reward-item.empty-slot {
                    color: var(--color-text-disabled);
                    font-style: italic;
                    opacity: 0.5;
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .activation-header {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .page-title {
                        font-size: 1.5rem;
                    }

                    .tier-options-grid {
                        grid-template-columns: 1fr;
                    }

                    .payment-options {
                        grid-template-columns: 1fr;
                    }

                    .info-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    .tier-card-header {
                        flex-direction: column;
                        text-align: center;
                        gap: 12px;
                    }

                    .tier-multiplier {
                        align-self: center;
                    }

                    .season-track-preview {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                    }

                    .preview-level {
                        min-height: 100px;
                        padding: 8px;
                    }

                    .reward-item {
                        font-size: 0.6rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default SeasonPassActivation;
