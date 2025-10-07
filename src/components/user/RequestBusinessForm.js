import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import UserXPBadgeDisplay from '../common/UserXPBadgeDisplay';
import { businessAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/userStyles.css';

const RequestBusinessForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        website: '',
        discord_server: '',
        tier: 'normal'
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            toast.error('Business Name is required.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await businessAPI.requestCreation(formData);
            toast.success(response.data.message || 'Business request submitted successfully!');
            navigate('/user/home');
        } catch (error) {
            console.error("Error submitting business request:", error);
            toast.error(error.response?.data?.error || 'Failed to submit business request.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-layout">

            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="page-inner-container">
                    {/* Header Section */}
                    <div className="badges-header">
                        <UserXPBadgeDisplay showFullDetails={true} />
                        
                        <header className="page-header">
                            <h1 className="page-header__title">Request New Business</h1>
                            <p className="page-header__subtitle">Submit your business details for review and approval by our administrators.</p>
                        </header>
                    </div>

                    {/* Form Section */}
                    <div className="user-content-section">
                        <div className="form-card">
                            <div className="form-card__header">
                                <div className="form-card__icon">
                                    <i className="ri-building-2-line"></i>
                                </div>
                                <div className="form-card__title">
                                    <h2>Business Information</h2>
                                    <p>Provide details about your business to get started</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="business-request-form">
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label htmlFor="name" className="form-label">
                                            <i className="ri-building-line"></i>
                                            Business Name *
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Enter your business name"
                                            className="form-input"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="location" className="form-label">
                                            <i className="ri-map-pin-line"></i>
                                            Location
                                        </label>
                                        <input
                                            type="text"
                                            id="location"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleInputChange}
                                            placeholder="e.g., City, Country"
                                            className="form-input"
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="tier" className="form-label">
                                            <i className="ri-star-line"></i>
                                            Desired Tier
                                        </label>
                                        <select 
                                            id="tier" 
                                            name="tier"
                                            value={formData.tier} 
                                            onChange={handleInputChange}
                                            className="form-select"
                                        >
                                            <option value="normal">Normal</option>
                                            <option value="advanced">Advanced</option>
                                        </select>
                                        <small className="form-help">Final tier will be assigned upon approval by admin.</small>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="website" className="form-label">
                                            <i className="ri-global-line"></i>
                                            Website URL
                                        </label>
                                        <input
                                            type="url"
                                            id="website"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleInputChange}
                                            placeholder="https://example.com"
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="discord_server" className="form-label">
                                            <i className="ri-discord-line"></i>
                                            Discord Server URL
                                        </label>
                                        <input
                                            type="url"
                                            id="discord_server"
                                            name="discord_server"
                                            value={formData.discord_server}
                                            onChange={handleInputChange}
                                            placeholder="https://discord.gg/invitecode"
                                            className="form-input"
                                        />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button 
                                        type="button" 
                                        className="button button--secondary" 
                                        onClick={() => navigate(-1)} 
                                        disabled={isLoading}
                                    >
                                        <i className="ri-arrow-left-line"></i>
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="button button--primary" 
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <i className="ri-loader-4-line spinning"></i>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="ri-send-plane-line"></i>
                                                Submit Request
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Info Section */}
                        <div className="info-section">
                            <div className="info-card">
                                <div className="info-card__header">
                                    <i className="ri-information-line"></i>
                                    <h3>What happens next?</h3>
                                </div>
                                <div className="info-card__content">
                                    <div className="process-steps">
                                        <div className="process-step">
                                            <div className="step-number">1</div>
                                            <div className="step-content">
                                                <h4>Review Process</h4>
                                                <p>Our administrators will review your business request</p>
                                            </div>
                                        </div>
                                        <div className="process-step">
                                            <div className="step-number">2</div>
                                            <div className="step-content">
                                                <h4>Approval Notification</h4>
                                                <p>You'll receive a notification once your request is approved</p>
                                            </div>
                                        </div>
                                        <div className="process-step">
                                            <div className="step-number">3</div>
                                            <div className="step-content">
                                                <h4>Access Granted</h4>
                                                <p>Start creating surveys and managing your business profile</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RequestBusinessForm; 