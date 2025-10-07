import React from 'react';
import { Link } from 'react-router-dom';
import { baseURL } from '../../services/apiClient';
import './BusinessCard.css';

const BusinessCard = ({ business }) => {
    const logoUrl = business.logo_url
        ? (business.logo_url.startsWith('http') ? business.logo_url : baseURL + business.logo_url)
        : '';

    return (
        <Link to={`/business/${business.id}`} className="business-card-link">
            <div className="business-card">
                <div className="business-card-logo-container">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={`${business.name} logo`}
                            className="business-card-logo"
                        />
                    ) : (
                        <span className="business-card-logo-text">{business.name}</span>
                    )}
                </div>
                <div className="business-card-info">
                    <h3 className="business-card-name">{business.name}</h3>
                    <p className="business-card-tier">
                        {business.tier?.charAt(0).toUpperCase() + business.tier?.slice(1)} Tier
                    </p>
                    {business.location && (
                        <p className="business-card-location">
                            <i className="ri-map-pin-line"></i> {business.location}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default BusinessCard; 