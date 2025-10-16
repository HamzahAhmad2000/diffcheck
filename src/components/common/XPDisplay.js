import React from 'react';
import { SeasonPassTierManager } from '../../services/apiClient';
import '../../styles/XPDisplay.css';

/**
 * XPDisplay Component - Shows XP with Season Pass bonus
 * Displays base XP as strikethrough and boosted XP when user has a season pass
 * 
 * @param {number} baseXP - The base XP amount before multiplier
 * @param {string} className - Optional CSS class for styling
 * @param {object} style - Optional inline styles
 */
const XPDisplay = ({ baseXP, className = '', style = {} }) => {
    const multiplier = SeasonPassTierManager.getMultiplier();
    const hasPass = SeasonPassTierManager.hasSeasonPass();
    const tier = SeasonPassTierManager.getTier();
    
    // Calculate boosted XP
    const boostedXP = Math.floor(baseXP * multiplier);
    
    // If no pass or multiplier is 1, just show base XP
    if (!hasPass || multiplier === 1.0) {
        return (
            <span className={`xp-display-season-pass ${className}`} style={style}>
                ✨ {baseXP.toLocaleString()} XP
            </span>
        );
    }

    // Show boosted XP with strikethrough base XP
    const tierColor = tier === 'TOTALITY' ? '#ffd700' : '#4a90e2';

    return (
        <span className={`xp-display-season-pass xp-display-season-pass--boosted ${className}`} style={style}>
            <span style={{ 
                textDecoration: 'line-through', 
                opacity: 0.6,
                marginRight: '6px',
                fontSize: '0.9em'
            }}>
                {baseXP.toLocaleString()}
            </span>
            <span style={{ 
                fontWeight: 'bold',
                color: tierColor
            }}>
                ✨ {boostedXP.toLocaleString()} XP
            </span>
            <span style={{
                fontSize: '0.75em',
                marginLeft: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: tierColor,
                color: '#000',
                fontWeight: '600'
            }}>
                {multiplier}x
            </span>
        </span>
    );
};

/**
 * Inline XP Display - Compact version for smaller spaces
 */
export const InlineXPDisplay = ({ baseXP, className = '', style = {} }) => {
    const multiplier = SeasonPassTierManager.getMultiplier();
    const hasPass = SeasonPassTierManager.hasSeasonPass();
    const tier = SeasonPassTierManager.getTier();
    
    const boostedXP = Math.floor(baseXP * multiplier);
    
    if (!hasPass || multiplier === 1.0) {
        return (
            <span className={`xp-display-season-pass-inline ${className}`} style={style}>
                ✨ {baseXP.toLocaleString()} XP
            </span>
        );
    }

    const tierColor = tier === 'TOTALITY' ? '#ffd700' : '#4a90e2';

    return (
        <span className={`xp-display-season-pass-inline xp-display-season-pass-inline--boosted ${className}`} style={style}>
            <span style={{ 
                textDecoration: 'line-through', 
                opacity: 0.5,
                fontSize: '0.85em'
            }}>
                {baseXP.toLocaleString()}
            </span>
            {' '}
            <span style={{ 
                fontWeight: 'bold',
                color: tierColor
            }}>
                ✨ {boostedXP.toLocaleString()} XP
            </span>
        </span>
    );
};

/**
 * Get boosted XP value (utility function)
 */
export const getBoostedXP = (baseXP) => {
    const multiplier = SeasonPassTierManager.getMultiplier();
    return Math.floor(baseXP * multiplier);
};

/**
 * Get XP display text
 */
export const getXPDisplayText = (baseXP) => {
    const multiplier = SeasonPassTierManager.getMultiplier();
    const hasPass = SeasonPassTierManager.hasSeasonPass();
    const boostedXP = Math.floor(baseXP * multiplier);
    
    if (!hasPass || multiplier === 1.0) {
        return `${baseXP.toLocaleString()} XP`;
    }
    
    return `${boostedXP.toLocaleString()} XP (${multiplier}x bonus)`;
};

export default XPDisplay;

