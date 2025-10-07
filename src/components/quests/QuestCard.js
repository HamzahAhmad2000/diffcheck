import React from 'react';

const QuestCard = ({ quest, onStart, isCompleted }) => {
    const estimatedTime = Math.ceil((quest.xp_reward || 0) / 30) || 1;
    const xpReward = quest.xp_reward || 0;

    const getQuestTypeIcon = (type) => {
        if (!type) return '🎯';
        if (type.includes('TWITTER') || type.includes('X_')) return '🐦';
        if (type.includes('INSTAGRAM')) return '📷';
        if (type.includes('LINKEDIN')) return '💼';
        if (type.includes('YOUTUBE')) return '📺';
        if (type.includes('DISCORD')) return '🎮';
        if (type.includes('TELEGRAM')) return '💬';
        if (type.includes('DOWNLOAD_APP')) return '📱';
        if (type.includes('DOWNLOAD_GAME')) return '🎮';
        if (type.includes('SURVEY')) return '📋';
        if (type.includes('VISIT')) return '🔗';
        return '🎯';
    };

    return (
        <div className="card">
            {quest.image_url && (
                <div className="card-image">
                    <img 
                        src={quest.image_url.startsWith('http') ? quest.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${quest.image_url}`}
                        alt={quest.title || 'Quest image'}
                        style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'contain',
                            borderRadius: '8px 8px 0 0',
                            backgroundColor: '#f5f5f5'
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}
            <div className="card-content">
                <h3 className="card-title">{quest.title || 'Untitled Quest'}</h3>
                <p className="card-subtitle">
                    {getQuestTypeIcon(quest.quest_type)} {quest.quest_type ? quest.quest_type.replace(/_/g, ' ') : 'Quest'}
                </p>
                <div className="card-info">
                    <span>⏱️ {estimatedTime} min</span>
                    <span>✨ {xpReward} XP</span>
                    {quest.is_featured && (
                        <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            color: '#aa2eff'
                        }}>
                            ⭐ Featured
                        </span>
                    )}
                </div>
                {quest.has_raffle_prize && (
                    <div style={{ 
                        fontSize: '12px', 
                        color: '#4caf50', 
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#e8f5e8',
                        borderRadius: '4px',
                        border: '1px solid #c8e6c9'
                    }}>
                        🎁 Raffle Prize Available
                    </div>
                )}
                <button 
                    className="card-button"
                    onClick={() => onStart(quest)}
                    disabled={isCompleted}
                    style={{
                        opacity: isCompleted ? 0.6 : 1,
                        cursor: isCompleted ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isCompleted ? '✓ Completed' : 'Start Quest'}
                </button>
            </div>
        </div>
    );
};

export default QuestCard; 