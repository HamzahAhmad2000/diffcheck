import React from 'react';
import '../../styles/UserHomepage.css'; // Assuming styles are in UserHomepage.css

const QuestCard = ({ quest }) => {
    return (
        <div className="card quest-card">
            <div className="card-content">
                <h3 className="card-title">{quest.title}</h3>
                <p className="card-subtitle">{quest.business_name}</p>
                <div className="card-info">
                    <span>✨ {quest.xp_reward} XP</span>
                </div>
                <button className="card-button">View Quest</button>
            </div>
        </div>
    );
};

export default QuestCard; 