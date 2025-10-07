// SurveysPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { baseURL, discordAPI, surveyAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';

import '../../styles/userStyles.css';
import '../../styles/UserHomepage.css';

const SurveyCard = ({ survey, onStart, discordStatus, isCompleted = false }) => {
    // Calculate time and XP based on question count (1 question = 30 seconds = 0.5 minutes)
    const estimatedTimeMinutes = Math.ceil((survey.question_count || 1) * 0.5);
    const xpReward = (survey.question_count || 1) * 30;

    // Check if survey requires Discord roles
    const requiresDiscord = survey.audience_settings?.discord_roles_allowed?.length > 0;
    const hasDiscordAccess = discordStatus?.has_access !== false;
    const surveyCompleted = isCompleted || survey.completed_by_user;

    return (
        <div className={`card ${surveyCompleted ? 'card--completed' : ''}`}>
            <div className="card-content">
                {surveyCompleted && (
                    <div className="card-completed-badge">
                        <i className="ri-check-circle-fill"></i>
                        <span>Completed</span>
                    </div>
                )}
                <h3 className="card-title">{survey.title}</h3>
                <p className="card-subtitle">{survey.business_name}</p>
                <div className="card-info">
                    <span><i className="ri-time-line"></i> {estimatedTimeMinutes} min</span>
                    <span className="xp-highlight">✨ {xpReward} XP</span>
                    {requiresDiscord && (
                        <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            color: hasDiscordAccess ? '#5865F2' : '#999'
                        }}>
                            <i className="ri-discord-line"></i>
                            Discord
                        </span>
                    )}
                </div>
                {requiresDiscord && !hasDiscordAccess && (
                    <div style={{ 
                        fontSize: '12px', 
                        color: '#f44336', 
                        marginTop: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#ffebee',
                        borderRadius: '4px',
                        border: '1px solid #ffcdd2'
                    }}>
                        <i className="ri-lock-line"></i> Requires Discord role: {survey.audience_settings.discord_roles_allowed.join(', ')}
                    </div>
                )}
                <button 
                    className="dashboard-item__cta"
                    onClick={() => onStart(survey.id)}
                    disabled={surveyCompleted || (requiresDiscord && !hasDiscordAccess)}
                    style={{
                        opacity: (surveyCompleted || (requiresDiscord && !hasDiscordAccess)) ? 0.6 : 1,
                        cursor: (surveyCompleted || (requiresDiscord && !hasDiscordAccess)) ? 'not-allowed' : 'pointer',
                        marginTop: '1rem'
                    }}
                >
                    {surveyCompleted ? (
                        <><i className="ri-check-line"></i> Completed</>
                    ) : requiresDiscord && !hasDiscordAccess ? 'Access Restricted' : 'Start'}
                </button>
            </div>
        </div>
    );
};

const SurveysPage = () => {
    const navigate = useNavigate();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [discordAccessCache, setDiscordAccessCache] = useState({});
    const [hiddenSurveyCount, setHiddenSurveyCount] = useState(0);
    const [activeTab, setActiveTab] = useState('available'); // New state for tab management
    const [userData, setUserData] = useState(null);
    const [discordStatuses, setDiscordStatuses] = useState({});
    useEffect(() => {
        fetchAvailableSurveys();
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const response = await surveyAPI.getProfile();
            setUserData(response.data);
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        }
    };

    const fetchAvailableSurveys = async () => {
        setLoading(true);
        try {
            // Use the new optimized endpoint
            const response = await surveyAPI.getAccessibleSurveysOptimized();
            console.log('[SURVEYS_PAGE] Survey response:', response.data);
            setSurveys(response.data.surveys || []);

            // Log filter summary for debugging
            if (response.data.filter_summary) {
                console.log('[SURVEYS_PAGE] Survey filtering summary:', response.data.filter_summary);
            }
        } catch (error) {
            console.error('[SURVEYS_PAGE] Failed to fetch surveys:', error);
            console.error('[SURVEYS_PAGE] Error details:', error.response?.data);
            toast.error('Failed to load surveys');
            setSurveys([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter surveys based on active tab and search query
    const filteredSurveys = surveys
        .filter(survey => {
            // Tab filter
            const isCompleted = survey.completed_by_user;
            
            if (activeTab === 'available' && isCompleted) {
                return false;
            }
            if (activeTab === 'completed' && !isCompleted) {
                return false;
            }

            // Search filter
            const searchTerm = searchQuery.toLowerCase();
            const matchesSearch = survey.title.toLowerCase().includes(searchTerm) ||
                   survey.business_name.toLowerCase().includes(searchTerm);
            
            if (!matchesSearch && searchQuery) {
                return false;
            }
            
            return true;
        })
        .sort((a, b) => {
            // Sort by creation date (newest first) within each tab
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

    const handleStartSurvey = (surveyId) => {
        navigate(`/survey/${surveyId}`);
    };

    const handleLinkDiscord = () => {
        discordAPI.initiateOAuth();
    };

    return (
        <div className="app-layout">
            <main className="main-content12" style={{ marginLeft: '100px' }}>
                <div className="page-inner-container">
                    <div className="surveys-header">
                        <div className="surveys-header__left">
                            <div className="surveys-header__search">
                                <i className="ri-search-line"></i>
                                <input
                                    type="text"
                                    placeholder="Search Surveys"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="surveys-subheader">
                        <div className="surveys-pills">
                            <button
                                className={`surveys-pill ${activeTab === 'available' ? 'active' : ''}`}
                                onClick={() => setActiveTab('available')}
                            >
                                Available
                            </button>
                            <button
                                className={`surveys-pill ${activeTab === 'completed' ? 'active' : ''}`}
                                onClick={() => setActiveTab('completed')}
                            >
                                Completed
                            </button>
                        </div>
                    </div>

                    {/* Discord info banner - only show on available tab */}
                    {activeTab === 'available' && hiddenSurveyCount > 0 && (
                        <div style={{
                            backgroundColor: '#e8f3ff',
                            border: '1px solid #bbdefb',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            margin: '16px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <i className="ri-discord-line" style={{ color: '#5865F2', fontSize: '20px' }}></i>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '14px', color: '#1976d2' }}>
                                    <strong>{hiddenSurveyCount}</strong> survey{hiddenSurveyCount !== 1 ? 's' : ''} {hiddenSurveyCount === 1 ? 'is' : 'are'} hidden because {hiddenSurveyCount === 1 ? 'it requires' : 'they require'} specific Discord roles.
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                                    Link your Discord account to access role-restricted surveys.
                                </p>
                            </div>
                            <button
                                onClick={handleLinkDiscord}
                                style={{
                                    backgroundColor: '#5865F2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 16px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <i className="ri-discord-line"></i>
                                Link Discord
                            </button>
                        </div>
                    )}

                    <div className="surveys-separator"></div>
                    
                    {loading ? (
                        <div className="loading-surveys">
                            <div className="user-loading-indicator">
                                <div className="user-loading-spinner"></div>
                                <p>Loading Surveys...</p>
                            </div>
                        </div>
                    ) : filteredSurveys.length > 0 ? (
                        <section className="cards-grid">
                            {filteredSurveys.map((survey) => (
                                <SurveyCard
                                    key={survey.id}
                                    survey={survey}
                                    onStart={handleStartSurvey}
                                    discordStatus={discordAccessCache[survey.id]}
                                    isCompleted={activeTab === 'completed'}
                                />
                            ))}
                        </section>
                    ) : (
                        <div className="empty-state">
                            <i className="ri-survey-line empty-state__icon"></i>
                            <h3 className="empty-state__title">
                                {activeTab === 'available' ? 'No Available Surveys' : 'No Completed Surveys'}
                            </h3>
                            <p className="empty-state__message">
                                {searchQuery ? (
                                    `No surveys match your search "${searchQuery}"`
                                ) : activeTab === 'available' ? (
                                    <>
                                        There are currently no surveys available for you to complete.
                                        {hiddenSurveyCount > 0 && (
                                            <span style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                                                {hiddenSurveyCount} survey{hiddenSurveyCount !== 1 ? 's are' : ' is'} hidden due to Discord role requirements.
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    "You haven't completed any surveys yet."
                                )}
                            </p>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        background: '#aa2eff',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                        marginTop: '12px'
                                    }}
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SurveysPage;