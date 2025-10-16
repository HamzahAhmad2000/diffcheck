import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import { ideaAPI, baseURL } from '../../services/apiClient';
import '../../styles/fonts.css';
import './BusinessFeedbackManagement.css';
import '../../styles/b_admin_styling.css';
import './BusinessIdeasManagement.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BKebabMenu from './ui/BKebabMenu';

const BusinessIdeasManagement = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [business, setBusiness] = useState(null);
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Filter states
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [showModal, setShowModal] = useState(false);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const [modalType, setModalType] = useState(''); // 'review', 'milestones'
    const [modalLoading, setModalLoading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Get user info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'business_admin';
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';

    useEffect(() => {
        fetchBusinessDetails();
        fetchIdeas();
    }, [businessId]);

    useEffect(() => {
        fetchIdeas();
    }, [statusFilter, sortBy]);

    const fetchBusinessDetails = async () => {
        try {
            // Use businessId from URL params or fallback to user's business
            const targetBusinessId = businessId || user.business_id;
            if (targetBusinessId) {
                setBusiness({ id: targetBusinessId, name: user.business_name || 'Your Business' });
            }
        } catch (error) {
            console.error('Error getting business details:', error);
        }
    };

    const fetchIdeas = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const targetBusinessId = businessId || user.business_id;
            if (!targetBusinessId) {
                setError('No business associated with your account');
                return;
            }

            const params = {};
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            if (sortBy) {
                params.sort = sortBy;
            }

            const response = await ideaAPI.getAdminIdeas(targetBusinessId, params);
            setIdeas(response.ideas || []);
        } catch (err) {
            console.error('Error fetching ideas:', err);
            setError('Failed to load ideas');
            toast.error('Failed to load ideas');
        } finally {
            setLoading(false);
        }
    };

    const openManagementModal = async (idea, type) => {
        setModalType(type);
        setSelectedIdea(idea);
        setShowModal(true);

        // Published ideas expose milestone/meta detail via public endpoint; fetch for richer context
        if (idea.status === 'PUBLISHED') {
            setModalLoading(true);
            try {
                const response = await ideaAPI.getIdeaDetails(idea.id);
                if (response?.idea) {
                    setSelectedIdea(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            ...response.idea,
                            status: prev.status || response.idea.status,
                            likes_count: response.idea.likes_count ?? prev.likes_count,
                            comments_count: response.idea.comments_count ?? prev.comments_count
                        };
                    });
                }
            } catch (error) {
                console.error('Error loading idea detail for modal:', error);
                toast.error('Unable to load full idea details. Continuing with cached data.');
            } finally {
                setModalLoading(false);
            }
        } else {
            setModalLoading(false);
        }
    };

    const handleReviewIdea = (idea) => openManagementModal(idea, 'review');

    const handleManageMilestones = (idea) => openManagementModal(idea, 'milestones');

    const handleStatusUpdate = async (ideaId, newStatus, reviewData = {}) => {
        try {
            await ideaAPI.reviewIdea(ideaId, {
                status: newStatus,
                ...reviewData
            });
            
            toast.success(`Idea ${newStatus.toLowerCase()} successfully`);
            setShowModal(false);
            setSelectedIdea(null);
            fetchIdeas(); // Refresh the list
        } catch (error) {
            console.error('Error updating idea status:', error);
            toast.error('Failed to update idea status');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PUBLISHED':
                return 'status-completed';
            case 'REJECTED':
                return 'status-rejected';
            case 'UNDER_REVIEW':
                return 'status-under-review';
            case 'ARCHIVED':
                return 'status-planned';
            default:
                return 'status-pending';
        }
    };

    const filteredIdeas = ideas.filter(idea => {
        if (statusFilter === 'all') return true;
        return idea.status === statusFilter;
    }).sort((a, b) => {
        if (sortBy === 'most_liked') {
            return (b.likes_count || 0) - (a.likes_count || 0);
        }
        if (sortBy === 'most_commented') {
            return (b.comments_count || 0) - (a.comments_count || 0);
        }
        if (sortBy === 'oldest') {
            return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at); // newest first (default)
    });

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content business-feedback-page">
                {/* Page Header */}
                <div className="dashboard-header">
                    <h1 className="b_admin_styling-title">
                        💡 Co-Create Ideas - {business?.name || 'Business'}
                    </h1>
                    <p className="chat-subtitle">
                        Review and manage community-submitted ideas for this business.
                    </p>
                </div>

                {/* Controls */}
                <div className="feedback-controls">
                    <div className="controls-row">
                        <BFilterBar>
                            <BFilterControl label="Status" htmlFor="statusFilter">
                                <select
                                    id="statusFilter"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="b_admin_styling-select b_admin_styling-select--compact"
                                >
                                    <option value="all">All Status</option>
                                    <option value="UNDER_REVIEW">Under Review</option>
                                    <option value="PUBLISHED">Published</option>
                                    <option value="REJECTED">Rejected</option>
                                    <option value="ARCHIVED">Archived</option>
                                </select>
                            </BFilterControl>
                            <BFilterControl label="Sort" htmlFor="sortBy">
                                <select
                                    id="sortBy"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="b_admin_styling-select b_admin_styling-select--compact"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="most_liked">Most Liked</option>
                                    <option value="most_commented">Most Commented</option>
                                </select>
                            </BFilterControl>
                        </BFilterBar>
                    </div>
                </div>

                {/* Ideas List */}
                <div className="feedback-content">
                    {loading ? (
                        <div className="loading-state">
                            <i className="ri-loader-4-line"></i>
                            <p>Loading ideas...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <i className="ri-error-warning-line"></i>
                            <p>{error}</p>
                            <button onClick={fetchIdeas} className="retry-button">
                                <i className="ri-refresh-line"></i>
                                Retry
                            </button>
                        </div>
                    ) : filteredIdeas.length === 0 ? (
                        <div className="b_admin_styling-card b_admin_styling-empty-state">
                            <i className="ri-lightbulb-line" style={{ color: 'var(--b-admin-primary)', fontSize: 32 }}></i>
                            <h3 style={{ marginTop: 8, color: 'var(--b-admin-primary)' }}>
                                No ideas found.
                            </h3>
                            <p className="text-muted">
                                {statusFilter !== 'all' 
                                    ? `No ideas with status "${statusFilter.replace('_', ' ')}" found.`
                                    : 'No ideas have been submitted yet.'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="items-grid">
                            {filteredIdeas.map((idea) => (
                                <div key={idea.id} className="item-card">
                                    <div className="item-header">
                                        <div className="item-type-badge">
                                            <i className="ri-lightbulb-line"></i>
                                            IDEA
                                        </div>
                                        <div className={`status-badge ${getStatusColor(idea.status)}`}>
                                            {idea.status.replace('_', ' ')}
                                        </div>
                                    </div>
                                    
                                    <h3 className="item-title">{idea.title}</h3>
                                    
                                    {/* Idea Images */}
                                    {((idea.image_urls && idea.image_urls.length > 0) || idea.image_url) && (
                                        <div className="idea-images-preview" style={{ 
                                            marginBottom: '12px',
                                            display: 'flex',
                                            gap: '6px',
                                            flexWrap: 'wrap',
                                            maxHeight: '80px',
                                            overflow: 'hidden'
                                        }}>
                                            {(idea.image_urls && idea.image_urls.length > 0) ? (
                                                idea.image_urls.slice(0, 4).map((imageUrl, index) => (
                                                    <img
                                                        key={index}
                                                        src={imageUrl.startsWith('http') ? imageUrl : `${baseURL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`}
                                                        alt={`${idea.title} - Image ${index + 1}`}
                                                        style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            objectFit: 'cover',
                                                            borderRadius: '4px',
                                                            border: '1px solid var(--bs-border-color)'
                                                        }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                ))
                                            ) : idea.image_url ? (
                                                <img
                                                    src={idea.image_url.startsWith('http') ? idea.image_url : `${baseURL}${idea.image_url.startsWith('/') ? idea.image_url : `/${idea.image_url}`}`}
                                                    alt={idea.title}
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        objectFit: 'cover',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--bs-border-color)'
                                                    }}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            ) : null}
                                            {(idea.image_urls && idea.image_urls.length > 4) && (
                                                <div style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--bs-border-color)',
                                                    backgroundColor: 'var(--bs-secondary-bg)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.7rem',
                                                    color: 'var(--bs-secondary-color)'
                                                }}>
                                                    +{idea.image_urls.length - 4}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {idea.description && (
                                        <p className="item-description">
                                            {idea.description.length > 150 
                                                ? `${idea.description.substring(0, 150)}...` 
                                                : idea.description
                                            }
                                        </p>
                                    )}
                                    
                                    <div className="item-meta">
                                        <span className="item-author">
                                            <i className="ri-user-line"></i>
                                            {idea.author_name || 'Anonymous'}
                                        </span>
                                        <span className="item-date">
                                            <i className="ri-calendar-line"></i>
                                            {new Date(idea.created_at).toLocaleDateString()}
                                        </span>
                                        <span className="item-votes">
                                            <i className="ri-heart-line"></i>
                                            {idea.likes_count || 0}
                                            <i className="ri-chat-3-line"></i>
                                            {idea.comments_count || 0}
                                        </span>
                                    </div>
                                    
                                    {isAdmin && (
                                        <div className="item-actions">
                                            <div className="action-row" style={{ marginBottom: 8 }}>
                                                <select 
                                                    value={idea.status}
                                                    onChange={(e) => handleStatusUpdate(idea.id, e.target.value)}
                                                    className="status-select"
                                                >
                                                    <option value="UNDER_REVIEW">Under Review</option>
                                                    <option value="PUBLISHED">Published</option>
                                                    <option value="REJECTED">Rejected</option>
                                                    <option value="ARCHIVED">Archived</option>
                                                </select>
                                            </div>
                                            <div className="action-row">
                                                <BKebabMenu
                                                    isOpen={openMenuId === idea.id}
                                                    onToggle={() => setOpenMenuId(openMenuId === idea.id ? null : idea.id)}
                                                    items={[
                                                        { 
                                                            label: 'Review And Update Idea', 
                                                            icon: 'ri-eye-line', 
                                                            onClick: () => {
                                                                setOpenMenuId(null);
                                                                handleReviewIdea(idea);
                                                            }
                                                        },
                                                        ...(idea.status === 'PUBLISHED' ? [{
                                                            label: 'Manage Milestones', 
                                                            icon: 'ri-flag-line', 
                                                            onClick: () => {
                                                                setOpenMenuId(null);
                                                                handleManageMilestones(idea);
                                                            }
                                                        }] : []),
                                                        { 
                                                            label: 'View Details', 
                                                            icon: 'ri-external-link-line', 
                                                            onClick: () => {
                                                                setOpenMenuId(null);
                                                                window.open(`/user/idea/${idea.id}`, '_blank');
                                                            }
                                                        }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Review/Management Modal */}
                {showModal && selectedIdea && (
                    <IdeaManagementModal 
                        idea={selectedIdea}
                        type={modalType}
                        isLoading={modalLoading}
                        onClose={() => {
                            setShowModal(false);
                            setSelectedIdea(null);
                            setModalType('');
                            setModalLoading(false);
                        }}
                        onStatusUpdate={handleStatusUpdate}
                    />
                )}
            </div>
        </div>
    );
};

// Idea Management Modal Component
const IdeaManagementModal = ({ idea, type, onClose, onStatusUpdate, isLoading }) => {
    const [reviewData, setReviewData] = useState({
        status: idea.status,
        review_notes: '',
        milestones: [],
        support_days: 60
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Calculate support days from support_ends_at if available
        let supportDays = 60; // default
        if (idea.support_ends_at) {
            const supportEndDate = new Date(idea.support_ends_at);
            const now = new Date();
            const diffTime = supportEndDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            supportDays = Math.max(1, diffDays); // Ensure at least 1 day
        }

        // Sync local state with the selected idea whenever the modal opens
        setReviewData({
            status: idea.status,
            review_notes: idea.review_notes || '',
            support_days: supportDays,
            milestones: Array.isArray(idea.milestones)
                ? idea.milestones.map((milestone) => ({
                    id: milestone.id,
                    label: milestone.label || '',
                    likes_target: milestone.likes_target || 0
                }))
                : []
        });
    }, [idea, type]);

    const isMilestoneManager = type === 'milestones';
    const showMilestoneEditor = isMilestoneManager || reviewData.status === 'PUBLISHED' || reviewData.status === 'UNDER_REVIEW';

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const updateData = {
                status: reviewData.status,
                review_notes: reviewData.review_notes,
                support_days: reviewData.support_days
            };

            if (showMilestoneEditor) {
                updateData.milestones = (reviewData.milestones || [])
                    .filter(m => (m.label || '').trim() !== '' || Number(m.likes_target) > 0)
                    .map(m => ({
                        label: (m.label || '').trim() || `${Number(m.likes_target) || 0} Likes`,
                        likes_target: Number(m.likes_target) || 0
                    }));
            }

            await onStatusUpdate(idea.id, reviewData.status, updateData);
        } catch (error) {
            console.error('Error submitting review:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const addMilestone = () => {
        setReviewData(prev => ({
            ...prev,
            milestones: [
                ...prev.milestones,
                { label: '', likes_target: 100 }
            ]
        }));
    };

    const updateMilestone = (index, field, value) => {
        setReviewData(prev => ({
            ...prev,
            milestones: prev.milestones.map((milestone, i) => 
                i === index ? { ...milestone, [field]: value } : milestone
            )
        }));
    };

    const removeMilestone = (index) => {
        setReviewData(prev => ({
            ...prev,
            milestones: prev.milestones.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="idea-management-modal" style={{ height: '100vh', paddingTop: '50px', paddingBottom: '50px' ,marginBottom: '50px' }}>
            <div className="modal-dialog" style={{ marginleft: '15px' ,paddingleft: '15px'}}>
                <div className="modal-content" style={{ height: '100vh', paddingTop: '10px', paddingBottom: '50px' ,marginBottom: '50px', marginleft: '15px' ,paddingleft: '15px'}}>
                    <div className="modal-header">
                        <h5 className="modal-title">
                            {type === 'review' 
                                ? (reviewData.status === 'UNDER_REVIEW' ? 'Update Idea Settings' : 'Review Idea')
                                : 'Manage Milestones'
                            }: {idea.title}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    
                    <form onSubmit={handleSubmitReview}>
                        <div className="modal-body">
                            {isLoading ? (
                                <div className="modal-loading-state">
                                    <i className="ri-loader-4-line modal-loading-icon"></i>
                                    <span>Loading latest idea details...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="idea-details-section">
                                        <h6>Idea Details</h6>
                                        <p><strong>Author:</strong> {idea.author_name || 'Anonymous'}</p>
                                        <p><strong>Description:</strong> {idea.description || 'No description provided'}</p>
                                        {/* Display all images */}
                                        {(idea.image_urls && idea.image_urls.length > 0) ? (
                                            <div className="mb-3">
                                                <strong>Images:</strong>
                                                <div className="idea-images-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginTop: '8px' }}>
                                                    {idea.image_urls.map((imageUrl, index) => (
                                                        <img
                                                            key={index}
                                                            src={imageUrl.startsWith('http') ? imageUrl : `${baseURL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`}
                                                            alt={`${idea.title} - Image ${index + 1}`}
                                                            className="img-thumbnail idea-image"
                                                            style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ) : idea.image_url ? (
                                            <div className="mb-3">
                                                <strong>Image:</strong>
                                                <div style={{ marginTop: '8px' }}>
                                                    <img
                                                        src={idea.image_url.startsWith('http') ? idea.image_url : `${baseURL}${idea.image_url.startsWith('/') ? idea.image_url : `/${idea.image_url}`}`}
                                                        alt={idea.title}
                                                        className="img-thumbnail idea-image"
                                                        style={{ maxWidth: '200px', height: 'auto' }}
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                        <p><strong>Current Status:</strong> <span className="badge bg-secondary status-badge-modal" style={{ color: 'black' }}>{idea.status.replace('_', ' ')}</span></p>
                                        <p><strong>Likes:</strong> {idea.likes_count || 0} | <strong>Comments:</strong> {idea.comments_count || 0}</p>
                                    </div>

                                    {!isMilestoneManager && (
                                        <>
                                            <div className="mb-3">
                                                <label className="form-label">New Status</label>
                                                <select
                                                    className="form-select"
                                                    value={reviewData.status}
                                                    onChange={(e) => setReviewData(prev => ({ ...prev, status: e.target.value }))}
                                                >
                                                    <option value="UNDER_REVIEW">Under Review</option>
                                                    <option value="PUBLISHED">Published</option>
                                                    <option value="REJECTED">Rejected</option>
                                                    <option value="ARCHIVED">Archived</option>
                                                </select>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Review Notes</label>
                                                <textarea
                                                    className="form-control"
                                                    rows="3"
                                                    value={reviewData.review_notes}
                                                    onChange={(e) => setReviewData(prev => ({ ...prev, review_notes: e.target.value }))}
                                                    placeholder="Add notes about your decision..."
                                                ></textarea>
                                            </div>

                            <div className="mb-3">
                                <label className="form-label">Support Period (Days)</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min="1"
                                    max="365"
                                    value={reviewData.support_days || 60}
                                    onChange={(e) => setReviewData(prev => ({ ...prev, support_days: parseInt(e.target.value) || 60 }))}
                                    placeholder="Number of days for support period"
                                />
                                <small className="form-text text-muted">
                                    How many days users can like and comment on this idea when published (default: 60 days)
                                </small>
                            </div>
                                        </>
                                    )}

                                    {showMilestoneEditor && (
                                        <div className="milestone-section">
                                            <div className="milestone-header">
                                                <label className="form-label">Milestones</label>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-outline-primary btn-sm"
                                                    onClick={addMilestone}
                                                >
                                                    Add Milestone
                                                </button>
                                            </div>
                                            {reviewData.milestones.map((milestone, index) => (
                                                <div key={index} className="row milestone-row">
                                                    <div className="col-6">
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm milestone-input"
                                                            placeholder="Milestone label"
                                                            value={milestone.label}
                                                            onChange={(e) => updateMilestone(index, 'label', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="col-4">
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm milestone-input"
                                                            min={0}
                                                            placeholder="Likes target"
                                                            value={milestone.likes_target}
                                                            onChange={(e) => updateMilestone(index, 'likes_target', Number(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div className="col-2">
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-outline-danger btn-sm milestone-delete-btn"
                                                            onClick={() => removeMilestone(index)}
                                                        >
                                                            <i className="ri-delete-bin-6-line"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {reviewData.milestones.length === 0 && (
                                                <p className="milestone-empty-state">
                                                    {reviewData.status === 'UNDER_REVIEW' 
                                                        ? 'Set milestones to define engagement goals for when this idea is published. Default: 100, 1000, 5000, 10000 likes.'
                                                        : 'Add milestones to set engagement goals for this idea. Default: 100, 1000, 5000, 10000 likes.'
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoading}>
                                {isSubmitting 
                                    ? 'Updating...' 
                                    : (reviewData.status === 'UNDER_REVIEW' && type === 'review' 
                                        ? 'Save Settings' 
                                        : 'Update Idea')
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BusinessIdeasManagement;
