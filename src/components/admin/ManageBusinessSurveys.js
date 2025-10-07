import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import AudienceSelection from '../common/AudienceSelection';
import { businessAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminTables.css'; // Reusing table styles
import './BusinessFeedbackManagement.css'; // For modal styles
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BAdminTable from './ui/BAdminTable';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const ManageBusinessSurveys = () => {
    const navigate = useNavigate();
    const { businessId } = useParams();
    const [surveys, setSurveys] = useState([]);
    const [businessName, setBusinessName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);
    
    // Audience selection modal states
    const [showAudienceModal, setShowAudienceModal] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState(null);
    const [audienceSettings, setAudienceSettings] = useState(null);
    const [audienceLoading, setAudienceLoading] = useState(false);
    const [audienceError, setAudienceError] = useState(null);
    
    // Determine the correct dashboard link based on user role
    const userRole = localStorage.getItem('userRole');
    const dashboardLink = userRole === 'business_admin'
        ? '/business-admin/dashboard'
        : `/admin/business/dashboard/${businessId}`;

    // Add filter states if needed: searchTerm, filterStatus, etc.

    const fetchBusinessSurveys = useCallback(async () => {
        setIsLoading(true);
        try {
            // Use businessAPI for consistency
            const response = await businessAPI.getSurveysForBusiness(businessId);
            setSurveys(response.data.surveys || []);
            setBusinessName(response.data.business_name || 'Selected Business');
        } catch (error) {
            console.error("Error fetching business surveys:", error);
            toast.error(error.response?.data?.error || 'Failed to fetch surveys for this business.');
            setSurveys([]);
        } finally {
            setIsLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchBusinessSurveys();
    }, [fetchBusinessSurveys]);

    const handleEditSurvey = (surveyId) => {
        // Navigate to business-specific survey edit route instead of old AI editor
        navigate(`/admin/business/${businessId}/surveys/${surveyId}/edit`, {
            state: {
                editMode: true,
                surveyId: surveyId,
                businessId: businessId,
                businessName: businessName
            }
        });
    };

    const handleArchiveSurvey = async (surveyId, surveyTitle) => {
        try {
            await businessAPI.archiveSurveyForBusiness(businessId, surveyId);
            toast.success(`Survey "${surveyTitle}" archived successfully.`);
            fetchBusinessSurveys();
        } catch (error) {
            console.error('Error archiving survey:', error);
            toast.error(error.response?.data?.error || 'Failed to archive survey.');
        }
    };
    
    const handleViewAnalytics = (surveyId) => {
        navigate(`/analytics/${surveyId}`, { state: { businessId, businessName }});
    };

    const handlePublishSurvey = async (surveyId, surveyTitle) => {
        try {
            await businessAPI.publishSurveyForBusiness(businessId, surveyId);
            toast.success(`Survey "${surveyTitle}" published successfully!`);
            fetchBusinessSurveys(); // Refresh list
        } catch (error) {
            console.error('Error publishing survey:', error);
            toast.error(error.response?.data?.error || 'Failed to publish survey.');
        }
    };

    const handleUnpublishSurvey = async (surveyId, surveyTitle) => {
        try {
            await businessAPI.unpublishSurveyForBusiness(businessId, surveyId);
            toast.success(`Survey "${surveyTitle}" unpublished successfully!`);
            fetchBusinessSurveys();
        } catch (error) {
            console.error('Error unpublishing survey:', error);
            toast.error(error.response?.data?.error || 'Failed to unpublish survey.');
        }
    };

    const handleManageAudience = async (survey) => {
        setSelectedSurvey(survey);
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            // Load current audience settings for the survey
            const response = await businessAPI.getSurveyAudienceSettings(businessId, survey.id);
            // Backend returns { is_restricted, audience_details }, we want audience_details
            setAudienceSettings(response.data.audience_details || {});
        } catch (error) {
            console.error('Error loading audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to load audience settings');
            setAudienceSettings({}); // Set empty settings as fallback
        } finally {
            setAudienceLoading(false);
        }
        
        setShowAudienceModal(true);
    };

    const handleSaveAudience = async (settings) => {
        if (!selectedSurvey) return;
        
        setAudienceLoading(true);
        setAudienceError(null);
        
        try {
            console.log('DEBUG: Data sent to backend:', settings);
            await businessAPI.updateSurveyAudienceSettings(businessId, selectedSurvey.id, settings);
            toast.success('Audience settings updated successfully!');
            setShowAudienceModal(false);
            fetchBusinessSurveys(); // Refresh list
        } catch (error) {
            console.error('Error updating audience settings:', error);
            setAudienceError(error.response?.data?.error || 'Failed to update audience settings');
        } finally {
            setAudienceLoading(false);
        }
    };

    const handleCopySurvey = async (surveyId, surveyTitle) => {
        try {
            await businessAPI.copySurveyForBusiness(businessId, surveyId, { copy_responses: false });
            toast.success(`Survey "${surveyTitle}" copied successfully!`);
            fetchBusinessSurveys();
        } catch (error) {
            console.error('Error copying survey:', error);
            toast.error(error.response?.data?.error || 'Failed to copy survey.');
        }
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-table-page">
                <div className="table-header-container">
                    <div className="table-header">
                        <h1 className="b_admin_styling-title">Surveys for {businessName}</h1>
                        <p className="chat-subtitle">Manage all surveys associated with this business.</p>
                    </div>
                    <BButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/admin/business/${businessId}/surveys/new`, { state: { businessId, businessName }})}
                    >
                        <i className="ri-add-line"></i> Create New Survey
                    </BButton>
                </div>

                {/* Add filters here if needed */}

                {isLoading ? (
                    <BLoading variant="page" label="Loading surveys..." />
                ) : (
                    <BAdminTable headers={[ 'Title','Status','Responses','Created At','Actions' ]}>
                        {surveys.length > 0 ? surveys.map(survey => (
                            <tr key={survey.id}>
                                <td>{survey.title}</td>
                                <td>
                                    <BStatusBadge type={survey.published ? 'approved' : 'pending'}>
                                        {survey.published ? 'Published' : 'Draft'}
                                    </BStatusBadge>
                                    {survey.is_archived && (
                                        <span style={{ marginLeft: 8 }}>
                                            <BStatusBadge type={'inactive'}>Archived</BStatusBadge>
                                        </span>
                                    )}
                                </td>
                                <td>{survey.response_count || 0}</td>
                                <td>{new Date(survey.created_at).toLocaleDateString()}</td>
                                <td className="b_admin_styling-table__actions">
                                    <BKebabMenu
                                        isOpen={openMenuId === survey.id}
                                        onToggle={() => setOpenMenuId(openMenuId === survey.id ? null : survey.id)}
                                        items={[
                                            { label: 'Edit', icon: 'ri-pencil-line', onClick: () => handleEditSurvey(survey.id) },
                                            ...(!survey.is_archived ? [
                                                { label: survey.published ? 'Unpublish' : 'Publish', icon: survey.published ? 'ri-pause-circle-line' : 'ri-send-plane-line', onClick: () => (survey.published ? handleUnpublishSurvey(survey.id, survey.title) : handlePublishSurvey(survey.id, survey.title)) },
                                            ] : []),
                                            { label: 'Audience', icon: 'ri-group-line', onClick: () => handleManageAudience(survey) },
                                            { label: 'Analytics', icon: 'ri-bar-chart-2-line', onClick: () => handleViewAnalytics(survey.id) },
                                            { label: 'Copy', icon: 'ri-file-copy-line', onClick: () => handleCopySurvey(survey.id, survey.title) },
                                            ...(!survey.is_archived ? [
                                                { label: 'Archive', icon: 'ri-archive-line', danger: true, onClick: () => handleArchiveSurvey(survey.id, survey.title) },
                                            ] : [
                                                { label: 'Archived', icon: 'ri-archive-line', onClick: () => {}, disabled: true }
                                            ])
                                        ]}
                                    />
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="admin-empty-state">
                                    <i className="ri-survey-line"></i>
                                    <h3>No surveys found for this business.</h3>
                                </td>
                            </tr>
                        )}
                    </BAdminTable>
                )}

                {/* Audience Selection Modal */}
                {showAudienceModal && (
                    <div className="modal-backdrop" onClick={() => setShowAudienceModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header" >
                                <h2 className="new-chat-title" style={{color: 'white',  borderRadius: '16px', backgroundColor: 'linear-gradient(to right, #ffffff, #ffffff)'}}>
                                    <i className="ri-group-line" style={{color: 'white'}}></i>
                                    Manage Survey Audience
                                </h2>
                                <button 
                                    className="close-button" 
                                    onClick={() => setShowAudienceModal(false)}
                                    aria-label="Close"
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <div style={{ padding: '20px', maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
                                {selectedSurvey && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
                                            {selectedSurvey.title}
                                        </h3>
                                        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                                            Configure who can access this survey
                                        </p>
                                    </div>
                                )}
                                
                                <AudienceSelection
                                    type="survey"
                                    businessId={businessId}
                                    itemId={selectedSurvey?.id}
                                    initialSettings={audienceSettings || {}}
                                    onSave={handleSaveAudience}
                                    loading={audienceLoading}
                                    error={audienceError}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageBusinessSurveys; 