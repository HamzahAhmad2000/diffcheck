import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfileAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/WelcomePopup.css';

const WelcomePopup = ({ onClose }) => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);

    const welcomeSteps = [
        {
            id: 'welcome',
            title: 'Welcome to Eclipseer! 🌟',
            description: 'Your journey to earning XP and rewards starts here!',
            icon: '🎉',
            content: 'Get ready to explore surveys, complete quests, and earn amazing rewards!'
        },
        {
            id: 'surveys',
            title: 'Complete Surveys & Earn XP',
            description: 'Give surveys for companies and products',
            icon: '📋',
            content: 'For every survey you complete, you will gain XP. Each question typically rewards 30 XP!',
            action: {
                text: 'View Surveys',
                onClick: () => navigate('/user/surveys')
            }
        },
        {
            id: 'quests',
            title: 'Complete Exciting Quests',
            description: 'Take on challenges to boost your XP',
            icon: '🏆',
            content: 'Complete quests to gain additional XP. From social media tasks to special challenges!',
            action: {
                text: 'View Quests',
                onClick: () => navigate('/user/quests')
            }
        },
        {
            id: 'marketplace',
            title: 'Spend XP in the Store',
            description: 'Use your XP to purchase items or enter raffles',
            icon: '🛍️',
            content: 'Exchange your hard-earned XP for exclusive items, gift cards, and raffle entries!',
            action: {
                text: 'Browse Store',
                onClick: () => navigate('/user/marketplace')
            }
        },
        {
            id: 'season-pass',
            title: 'Boost Your Rewards',
            description: 'Subscribe to Season Pass for enhanced XP and special rewards',
            icon: '👑',
            content: 'Get XP multipliers and exclusive rewards with Lunar Pass (1.25x) or Totality Pass (2x)!',
            action: {
                text: 'View Season Pass',
                onClick: () => navigate('/user/season-pass')
            }
        },
        {
            id: 'profile',
            title: 'Complete Your Profile',
            description: 'Earn XP by filling out your profile',
            icon: '👤',
            content: 'Complete your profile to gain XP and unlock access to more targeted surveys!',
            action: {
                text: 'Edit Profile',
                onClick: () => navigate('/user/profile')
            }
        },
        {
            id: 'social',
            title: 'Connect Your Socials',
            description: 'Link accounts for exclusive access',
            icon: '🔗',
            content: 'Link your social accounts to get access to exclusive quests, surveys, and businesses!',
            action: {
                text: 'Link Accounts',
                onClick: () => navigate('/user/profile')
            }
        }
    ];

    const handleNext = () => {
        if (currentStep < welcomeSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleFinish();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleFinish = async () => {
        try {
            await userProfileAPI.markWelcomePopupSeen();
            toast.success('Welcome guide completed! Start earning XP now! 🎉');
            onClose();
        } catch (error) {
            console.error('Error marking welcome popup as seen:', error);
            // Still close the popup even if the API call fails
            onClose();
        }
    };

    const handleSkip = async () => {
        try {
            await userProfileAPI.markWelcomePopupSeen();
            onClose();
        } catch (error) {
            console.error('Error marking welcome popup as seen:', error);
            // Still close the popup even if the API call fails
            onClose();
        }
    };

    const currentStepData = welcomeSteps[currentStep];

    return (
        <div className="welcome-popup-overlay">
            <div className="welcome-popup">
                <div className="welcome-popup-header">
                    <div className="welcome-popup-progress">
                        <span className="progress-text">
                            {currentStep + 1} of {welcomeSteps.length}
                        </span>
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${((currentStep + 1) / welcomeSteps.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <button className="welcome-popup-close" onClick={handleSkip}>
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <div className="welcome-popup-content">
                    <div className="welcome-card">
                        <div className="welcome-card-icon">
                            {currentStepData.icon}
                        </div>
                        <h2 className="welcome-card-title">
                            {currentStepData.title}
                        </h2>
                        <p className="welcome-card-description">
                            {currentStepData.description}
                        </p>
                        <div className="welcome-card-content">
                            {currentStepData.content}
                        </div>
                        
                        {currentStepData.action && (
                            <button 
                                className="welcome-card-action"
                                onClick={() => {
                                    currentStepData.action.onClick();
                                    handleFinish();
                                }}
                            >
                                {currentStepData.action.text}
                                <i className="ri-arrow-right-line"></i>
                            </button>
                        )}
                    </div>
                </div>

                <div className="welcome-popup-footer">
                    <div className="welcome-popup-dots">
                        {welcomeSteps.map((_, index) => (
                            <button
                                key={index}
                                className={`welcome-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                                onClick={() => setCurrentStep(index)}
                            >
                            </button>
                        ))}
                    </div>
                    
                    <div className="welcome-popup-buttons">
                        {currentStep > 0 && (
                            <button 
                                className="welcome-btn welcome-btn-secondary"
                                onClick={handlePrevious}
                            >
                                <i className="ri-arrow-left-line"></i>
                                Previous
                            </button>
                        )}
                        
                        <button 
                            className="welcome-btn welcome-btn-primary"
                            onClick={handleNext}
                        >
                            {currentStep === welcomeSteps.length - 1 ? 'Get Started!' : 'Next'}
                            {currentStep !== welcomeSteps.length - 1 && <i className="ri-arrow-right-line"></i>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomePopup;
