import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { surveyAPI } from '../../services/apiClient';
import Sidebar from '../common/Sidebar';
import '../../styles/DataGenerator.css'; // Updated CSS import

const GenerateResponses = () => {
    const { surveyId } = useParams();
    const navigate = useNavigate();
    const [survey, setSurvey] = useState(null);
    const [count, setCount] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSurvey = async () => {
            if (!surveyId) return;
            try {
                // Use the admin endpoint to get survey details, even for drafts
                const response = await surveyAPI.getById(surveyId);
                setSurvey(response.data);
            } catch (err) {
                const fetchError = err.response?.data?.error || 'Failed to load survey details.';
                setError(fetchError);
                toast.error(fetchError);
            }
        };
        fetchSurvey();
    }, [surveyId]);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (count < 1 || count > 500) {
            toast.error('Please enter a number between 1 and 500.');
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading(`Generating ${count} random responses... This may take a moment.`);

        try {
            const response = await surveyAPI.generateRandomResponses(surveyId, count);
            toast.success(response.data.message || 'Responses generated successfully!', { id: toastId });
            
            // Navigate to the analytics page after a short delay
            setTimeout(() => {
                navigate(`/analytics/${surveyId}`);
            }, 1500);

        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Failed to generate responses.';
            toast.error(errorMessage, { id: toastId });
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (error && !survey) {
        return (
            <div className="data-generator-page">
                <Sidebar />
                <div className="data-generator-container">
                    <div className="error-text">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="data-generator-page newmain-content33 admin-page-content">
            <Sidebar />
            <div className=" data-generator-container">
                <div className="data-generator-card">
                    <div className="data-generator-header">
                        <h1 className="data-generator-title">Generate Test Data</h1>
                        <p className="data-generator-subtitle">
                            Automatically create random, structured responses for your survey. This is ideal for testing analytics, dashboard visualizations, and data exports without needing real participants.
                        </p>
                    </div>
                    
                    {survey ? (
                        <form onSubmit={handleGenerate} className="data-generator-form">
                            <div className="form-group">
                                <label className="form-label">
                                    <i className="ri-file-text-line"></i>
                                    <span style={{color: '#333'}}>
                                    Selected Survey
                                    </span>
                                    </label>
                                <input
                                style={{color: '#353'}}
                                    type="text"
                                    value={survey.title}
                                    className="form-group"
                                    disabled
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="response-count" className="form-label">
                                    <i className="ri-hashtag"></i>
                                    <span style={{color: '#333'}}>
                                    Number of Responses
                                    </span>
                                </label>
                                <input
                                    id="response-count"
                                    type="number"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                                    min="1"
                                    max="500"
                                    className="form-input-number"
                                    disabled={isLoading}
                                    required
                                />
                                <p className="info-text">
                                    Note: Generation may be slow for large numbers. Limit is 500 per request.
                                </p>
                            </div>
                            
                            <div className="form-actions">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`generator-button ${isLoading ? 'disabled' : ''}`}
                                >
                                    <i className={isLoading ? 'ri-loader-4-line spinning' : 'ri-magic-line'}></i>
                                    {isLoading ? 'Generating Data...' : 'Start Generation'}
                                </button>
                            </div>
                            {isLoading && (
                                <div className="generation-progress-notice">
                                    <i className="ri-information-line"></i>
                                    <span>Please wait. The page will redirect to the analytics dashboard upon completion.</span>
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="data-generator-form">
                            <p className="loading-text">Loading survey information...</p>
                        </div>
                    )}
                </div>
                <div className="tip-card-generator">
                    <div className="tip-header">
                        <i className="ri-lightbulb-flash-line"></i>
                        <span>How It Works</span>
                    </div>
                    <ul className="tip-list">
                        <li className="tip-item">
                            <i className="ri-checkbox-circle-line"></i>
                            <span>The generator selects random answers based on the question type (e.g., single-choice, multi-choice, sliders).</span>
                        </li>
                        <li className="tip-item">
                            <i className="ri-skip-forward-line"></i>
                            <span>Questions like Document Upload and Signature are automatically skipped.</span>
                        </li>
                        <li className="tip-item">
                            <i className="ri-user-smile-line"></i>
                            <span>Each submission is assigned random demographic data (age, gender, location) for realistic filtering tests.</span>
                        </li>
                        <li className="tip-item">
                            <i className="ri-bar-chart-box-line"></i>
                            <span>Once complete, you can view the generated data in the survey's analytics and raw responses dashboards.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default GenerateResponses; 