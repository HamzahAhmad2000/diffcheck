import React from 'react';
import QuestCard from './QuestCard';
import XPItemCard from './XPItemCard';
import '../../styles/UserHomepage.css';

const FeaturedSection = ({ title, items, viewMoreLink, cardType }) => {
    
    const renderCard = (item) => {
        switch (cardType) {
            case 'brand':
                // Assuming a BrandCard component exists
                // return <BrandCard key={item.id} brand={item} />;
                return <div className="card brand-card" key={item.id}>
                    <img src={item.logo_url} alt={item.name} className="card-image"/>
                    <div className="card-content">
                        <h3 className="card-title">{item.name}</h3>
                        <div className="card-info">
                            <span>✨ {item.available_xp} XP</span>
                        </div>
                        <button className="card-button">Enter</button>
                    </div>
                </div>;
            case 'survey':
                // Assuming a SurveyCard component exists
                // return <SurveyCard key={item.id} survey={item} />;
                 return <div className="card survey-card" key={item.id}>
                    <div className="card-content">
                        <h3 className="card-title">{item.title}</h3>
                        <p className="card-subtitle">{item.business_name}</p>
                        <div className="card-info">
                            <span>⏱️ {item.estimated_time} min</span>
                            <span>✨ {item.xp_reward} XP</span>
                        </div>
                        <button className="card-button">Start</button>
                    </div>
                </div>;
            case 'quest':
                return <QuestCard key={item.id} quest={item} />;
            case 'xp_item':
                return <XPItemCard key={item.id} item={item} />;
            default:
                return null;
        }
    };

    return (
        <section className="featured-section">
            <div className="section-header">
                <h2>{title}</h2>
                <a href={viewMoreLink} className="view-more-btn">View More</a>
            </div>
            <div className="cards-grid">
                {items.slice(0, 4).map(item => renderCard(item))}
            </div>
        </section>
    );
};

export default FeaturedSection; 