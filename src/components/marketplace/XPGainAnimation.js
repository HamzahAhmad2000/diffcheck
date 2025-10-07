import React, { useEffect, useState } from 'react';
import './XPGainAnimation.css';

const XPGainAnimation = ({ data, onComplete }) => {
    const [visible, setVisible] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        // Trigger animation
        setTimeout(() => setVisible(true), 100);
        
        // Show confetti for gains
        if (data.type === 'gain') {
            setTimeout(() => setShowConfetti(true), 500);
        }
        
        // Auto-hide after animation
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onComplete, 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, [data, onComplete]);

    const renderConfetti = () => {
        if (!showConfetti) return null;
        
        return Array.from({ length: 20 }, (_, i) => (
            <div
                key={i}
                className="confetti-piece"
                style={{
                    '--delay': `${i * 0.1}s`,
                    '--x-offset': `${(Math.random() - 0.5) * 200}px`,
                    '--rotation': `${Math.random() * 360}deg`
                }}
            />
        ));
    };

    const getAnimationClass = () => {
        let className = 'xp-animation-content';
        if (data.type === 'gain') className += ' gain';
        if (data.type === 'spend') className += ' spend';
        if (visible) className += ' visible';
        return className;
    };

    const getIcon = () => {
        switch (data.type) {
            case 'gain':
                return '✨';
            case 'spend':
                return '💰';
            default:
                return '⭐';
        }
    };

    const getSymbol = () => {
        return data.type === 'gain' ? '+' : '-';
    };

    return (
        <div className="xp-animation-overlay">
            <div className={getAnimationClass()}>
                {/* Checkmark for completion */}
                {data.type === 'gain' && (
                    <div className="completion-checkmark">
                        <div className="checkmark-circle">
                            <div className="checkmark-stem"></div>
                            <div className="checkmark-kick"></div>
                        </div>
                    </div>
                )}
                
                {/* XP Amount Display */}
                <div className="xp-display">
                    <div className="xp-icon">{getIcon()}</div>
                    <div className="xp-amount">
                        <span className="xp-symbol">{getSymbol()}</span>
                        <span className="xp-number">{data.amount}</span>
                        <span className="xp-label">XP</span>
                    </div>
                </div>
                
                {/* Message */}
                {data.message && (
                    <div className="xp-message">
                        {data.message}
                    </div>
                )}
                
                {/* Badge notification if included */}
                {data.newBadges && data.newBadges.length > 0 && (
                    <div className="badge-notification">
                        <div className="badge-header">🏆 New Badge Earned!</div>
                        {data.newBadges.map((badge, index) => (
                            <div key={index} className="badge-item">
                                <img src={badge.image_url} alt={badge.name} className="badge-image" />
                                <div className="badge-info">
                                    <div className="badge-name">{badge.name}</div>
                                    <div className="badge-description">{badge.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Confetti */}
            {renderConfetti()}
        </div>
    );
};

export default XPGainAnimation; 