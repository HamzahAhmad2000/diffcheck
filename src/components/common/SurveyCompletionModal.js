import React from 'react';
import '../../styles/SurveyCompletionModal.css';

const SurveyCompletionModal = ({ isOpen, onClose, surveyTitle }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="survey-completion-modal-overlay" onClick={handleOverlayClick}>
            <div className="survey-completion-modal">
                <div className="survey-completion-modal__header">
                    <div className="survey-completion-modal__icon">
                        <i className="ri-check-double-line"></i>
                    </div>
                    <h2 className="survey-completion-modal__title">Survey Already Completed!</h2>
                </div>
                
                <div className="survey-completion-modal__content">
                    <p className="survey-completion-modal__message">
                        Thanks for participating! You've already earned XP for this survey.
                    </p>
                    <p className="survey-completion-modal__sub-message">
                        Keep an eye out for new surveys to earn more rewards!
                    </p>
                    
                    <div className="survey-completion-modal__reward-info">
                        <div className="survey-completion-modal__reward-icon">
                            <i className="ri-copper-coin-line"></i>
                        </div>
                        <span>XP Already Earned</span>
                    </div>
                </div>

                <div className="survey-completion-modal__actions">
                    <button 
                        className="survey-completion-modal__close-btn"
                        onClick={onClose}
                    >
                        <i className="ri-close-line"></i>
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurveyCompletionModal; 