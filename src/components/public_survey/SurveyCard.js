import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SurveyCompletionModal from '../common/SurveyCompletionModal';
import '../../styles/userStyles.css'; // Or a more specific stylesheet if created

// It's good practice to have a default image for surveys if one isn't provided
const defaultSurveyImagePath = '/default-survey-cover.png'; // Make sure this image exists in /public

const SurveyCard = ({ survey }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const descriptionRef = useRef(null);

    // Check if current user is a regular user (not admin)
    const isRegularUser = () => {
        const userRole = localStorage.getItem('userRole');
        return !userRole || userRole === 'user';
    };

    useEffect(() => {
        // Check if description is overflowing
        if (descriptionRef.current) {
            const isOverflowing = descriptionRef.current.scrollHeight > descriptionRef.current.clientHeight;
            setIsDescriptionOverflowing(isOverflowing);
        }
    }, [survey?.description]);

    if (!survey) {
        return null;
    }

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) return defaultSurveyImagePath;
        // Assuming baseURL is available or not needed if image URLs are absolute
        // For now, let's assume image_url can be relative or absolute
        return relativeOrAbsoluteUrl.startsWith('http') || relativeOrAbsoluteUrl.startsWith('/') 
            ? relativeOrAbsoluteUrl 
            : `/${relativeOrAbsoluteUrl}`; // Basic handling for relative paths
    };

    const imageUrl = getFullImageUrl(survey.image_url);
    const tags = survey.tags && Array.isArray(survey.tags) ? survey.tags : (survey.tags ? JSON.parse(survey.tags) : []);
    const showTextFallback = !imageUrl || imageUrl === defaultSurveyImagePath;

    // Check if survey is completed by the current user and user is regular user
    const isCompleted = survey.completed_by_user && isRegularUser();

    const handleTakeSurveyClick = (e) => {
        if (isCompleted) {
            e.preventDefault();
            setShowCompletionModal(true);
        }
        // If not completed or user is admin, the Link will handle navigation normally
    };

    return (
        <div className={`survey-list-item-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="survey-list-item-card__image-container">
                {isCompleted && (
                    <span className="survey-list-item-card__badge">
                        <i className="ri-check-line"></i> Completed
                    </span>
                )}
                {showTextFallback ? (
                    <div className="image-text-fallback image-text-fallback--cover">
                        <span>{survey.title?.substring(0,10)}{survey.title?.length > 10 && '...'}</span>
                    </div>
                ) : (
                    <div
                        className="survey-list-item-card__image"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                        onError={(e) => {
                            e.target.style.backgroundImage = `url(${defaultSurveyImagePath})`;
                        }}
                    />
                )}
            </div>
            
            <div className="survey-list-item-card__content">
                <div className="survey-list-item-card__header">
                    <h3 className="survey-list-item-card__title">{survey.title || 'Untitled Survey'}</h3>
                </div>

                {!isExpanded && (
                    <div className="survey-list-item-card__pills">
                        {tags.length > 0 && (
                            <span className="survey-list-item-card__category">
                                <i className="ri-price-tag-3-line"></i>
                                {typeof tags[0] === 'object' ? tags[0].name : tags[0]}
                            </span>
                        )}
                        <span className="survey-list-item-card__category">
                            <i className="ri-questionnaire-line"></i>
                            {survey.question_count || 0} Questions
                        </span>
                    </div>
                )}
                
                <div className={`survey-list-item-card__description-container ${isExpanded ? 'expanded' : ''}`}>
                    <p 
                        ref={descriptionRef}
                        className="survey-list-item-card__description"
                    >
                        {survey.description || 'No description available.'}
                    </p>
                    {isDescriptionOverflowing && !isExpanded && (
                        <button 
                            className="survey-list-item-card__read-more"
                            onClick={() => setIsExpanded(true)}
                        >
                            Read More...
                        </button>
                    )}
                    {isExpanded && (
                        <button 
                            className="survey-list-item-card__read-more"
                            onClick={() => setIsExpanded(false)}
                        >
                            Show Less
                        </button>
                    )}
                </div>
                
                <div className="survey-list-item-card__footer">
                        <div className="survey-list-item-card__actions">
                            <button className="survey-list-item-card__info">
                                <i className="ri-copper-coin-line"></i>
                                {survey.xp_reward || 0}XP
                            </button>
                            {isCompleted ? (
                                <button
                                    className="survey-list-item-card__take-survey survey-list-item-card__take-survey--completed"
                                    onClick={handleTakeSurveyClick}
                                    title="You have already completed this survey"
                                >
                                    <i className="ri-check-line"></i>
                                    Survey Completed
                                </button>
                            ) : (
                                <Link
                                    to={`/survey/${survey.id}`}
                                    className="survey-list-item-card__take-survey"
                                    onClick={handleTakeSurveyClick}
                                >
                                    Take Survey
                                </Link>
                            )}
                        </div>
                </div>
            </div>
            
            {/* Survey Completion Modal */}
            <SurveyCompletionModal 
                isOpen={showCompletionModal}
                onClose={() => setShowCompletionModal(false)}
                surveyTitle={survey.title}
            />
        </div>
    );
};

export default SurveyCard; 