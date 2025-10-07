import React from 'react';
import '../../styles/UserHomepage.css'; // Assuming styles are in UserHomepage.css

const XPItemCard = ({ item }) => {
    return (
        <div className="card xp-item-card">
            <img src={item.image_url} alt={item.title} className="card-image"/>
            <div className="card-content">
                <h3 className="card-title">{item.title}</h3>
                <div className="card-info">
                    <span>✨ {item.xp_cost} XP</span>
                </div>
                 <button className="card-button">Redeem</button>
            </div>
        </div>
    );
};

export default XPItemCard; 