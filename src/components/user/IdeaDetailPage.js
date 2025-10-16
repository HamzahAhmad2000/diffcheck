import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ideaAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../user/BrandDetailPage.css';
import '../user/BusinessDetailView.css';
import '../user/IdeaDetailPage.css';

const resolveIdeaImageSrc = (idea) => {
    if (!idea) return null;
    const candidates = [idea.image_url, idea.image, idea.media_url, idea.cover_image];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;
        if (candidate.startsWith('http')) {
            return candidate;
        }
        const normalized = candidate.startsWith('/') ? candidate : `/${candidate}`;
        return `${baseURL}${normalized}`;
    }

    return null;
};

const resolveAllIdeaImages = (idea) => {
    if (!idea) return [];
    
    const allImages = [];
    
    // Check image_urls array first (new multiple image support)
    if (idea.image_urls && Array.isArray(idea.image_urls) && idea.image_urls.length > 0) {
        idea.image_urls.forEach(url => {
            if (url && typeof url === 'string') {
                if (url.startsWith('http')) {
                    allImages.push(url);
                } else {
                    const normalized = url.startsWith('/') ? url : `/${url}`;
                    allImages.push(`${baseURL}${normalized}`);
                }
            }
        });
    } else {
        // Fallback to single image_url for backward compatibility
        const singleImage = resolveIdeaImageSrc(idea);
        if (singleImage) {
            allImages.push(singleImage);
        }
    }
    
    return allImages;
};

const IdeaDetailPage = () => {
    const { ideaId } = useParams();
    const navigate = useNavigate();
    const [idea, setIdea] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [liked, setLiked] = useState(false);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [allImages, setAllImages] = useState([]);
    const [activeTab, setActiveTab] = useState('details'); // 'details' or 'comments'

    // Detect user theme context - Force dark theme for user context
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || localStorage.getItem('userRole') || 'user';
    const themeClass = 'brand-detail-dark-theme';

    useEffect(() => {
        fetchIdeaData();
    }, [ideaId]);

    const fetchIdeaData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [ideaResponse, commentsResponse] = await Promise.allSettled([
                ideaAPI.getIdeaDetails(ideaId),
                ideaAPI.getIdeaComments(ideaId)
            ]);

            if (ideaResponse.status === 'fulfilled' && ideaResponse.value.idea) {
                const ideaData = ideaResponse.value.idea;
                setIdea(ideaData);
                setLiked(ideaData.liked_by_user || false);
                setImageError(false);
                
                // Resolve and set all images
                const images = resolveAllIdeaImages(ideaData);
                setAllImages(images);
                setCurrentImageIndex(0); // Reset to first image
            } else {
                setError('Idea not found');
                return;
            }

            if (commentsResponse.status === 'fulfilled') {
                setComments(commentsResponse.value.comments || []);
            }

        } catch (err) {
            console.error('Error fetching idea data:', err);
            setError('Failed to load idea details');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        try {
            const response = await ideaAPI.likeIdea(ideaId);
            setLiked(response.liked);
            setIdea(prev => ({
                ...prev,
                likes_count: response.likes_count,
                is_open_for_support: response.is_open_for_support,
                liked_by_user: response.liked,
            }));
            toast.success(response.liked ? 'Idea liked!' : 'Like removed');
        } catch (error) {
            console.error('Error liking idea:', error);
            toast.error(error.message || 'Failed to like idea');
            fetchIdeaData();
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsSubmittingComment(true);
        try {
            // Get user info from localStorage to ensure proper attribution
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const commentData = { 
                body: newComment.trim(),
                // Include user info as fallback in case backend doesn't extract it properly
                user_name: userData.name || userData.username || userData.email || 'Anonymous'
            };
            
            await ideaAPI.addComment(ideaId, commentData);
            setNewComment('');
            setShowCommentForm(false);
            // Refresh comments
            const commentsResponse = await ideaAPI.getIdeaComments(ideaId);
            setComments(commentsResponse.comments || []);
            // Update comment count in idea
            setIdea(prev => ({ ...prev, comments_count: (commentsResponse.comments || []).length }));
            toast.success('Comment added successfully!');
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Failed to add comment');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const calculateDaysLeft = (supportEndsAt) => {
        if (!supportEndsAt) return null;
        const endDate = new Date(supportEndsAt);
        const now = new Date();
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className={`brand-detail-loading ${themeClass}`}>
                <div className="user-loading-indicator">
                    <div className="user-loading-spinner"></div>
                    <p>Loading Idea Details...</p>
                </div>
            </div>
        );
    }

    if (error || !idea) {
        return (
            <div className={`brand-detail-error ${themeClass}`}>
                <h2>Idea Not Found</h2>
                <p>{error || 'The idea you are looking for could not be found.'}</p>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        );
    }

    const daysLeft = calculateDaysLeft(idea.support_ends_at);
    const isOpenForSupport = idea.is_open_for_support;
    
    // Navigation functions for image carousel
    const nextImage = () => {
        if (allImages.length > 1) {
            setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
        }
    };
    
    const prevImage = () => {
        if (allImages.length > 1) {
            setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
        }
    };
    
    const goToImage = (index) => {
        setCurrentImageIndex(index);
    };

    return (
        <div className={`brand-detail-page ${themeClass}`}>
            {/* Back Button - Consistent styling */}
            <button 
                className="page-header__back-button page-header__back-button--primary"
                onClick={() => navigate(`/user/brand/${idea.business_id}`)}
                title="Back to Ideas Hub"
                style={{ 
                    position: 'fixed', 
                    left: '20px', 
                    top: '80px',
                    zIndex: 1000
                }}
            >
                <i className="ri-arrow-left-line"></i>
                Back
            </button>

            {/* Header */}
            <div className="brand-header">
                <div className="brand-header__content" style={{ justifyContent: 'center' }}>
                    <h1 className="brand-header__title">
                        Idea Details
                    </h1>
                </div>
            </div>

            <div className="brand-content-grid-generic">
                <div className="scrollable-panel idea-detail-shell">
                    <div className="row g-4">
                        <div className="col-lg-8">
                            {/* Tab Navigation */}
                            <div className="idea-detail-tabs mb-4">
                                <button 
                                    className={`idea-detail-tab ${activeTab === 'details' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('details')}
                                >
                                    <i className="ri-file-text-line me-2"></i>
                                    Idea Details
                                </button>
                                <button 
                                    className={`idea-detail-tab ${activeTab === 'comments' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('comments')}
                                >
                                    <i className="ri-chat-3-line me-2"></i>
                                    Comments ({idea.comments_count || 0})
                                </button>
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'details' && (
                                <div className="idea-detail-panel mb-4">
                                    <div className="idea-detail-panel__body">
                                        <div className="mb-4">
                                            <h1 className="h3 mb-2 text-white">{idea.title}</h1>
                                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                                <span className="idea-detail-meta-tag">
                                                    <i className="ri-user-line"></i>
                                                    {idea.author_name || 'Anonymous'}
                                                </span>
                                                <span className="idea-detail-meta-tag">
                                                    <i className="ri-calendar-line"></i>
                                                    {formatDate(idea.created_at)}
                                                </span>
                                                {typeof daysLeft === 'number' && (
                                                    <span className="idea-detail-meta-tag">
                                                        <i className="ri-timer-2-line"></i>
                                                        {isOpenForSupport ? `${daysLeft} days left` : 'Support closed'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                    {(allImages.length > 0 && !imageError) && (
                        <div className="idea-detail-media" style={{ 
                            minHeight: 'auto',
                            maxHeight: 'none',
                            alignItems: 'flex-start',
                            padding: '16px',
                            position: 'relative'
                        }}>
                            {/* Main Image */}
                            <img
                                src={allImages[currentImageIndex]}
                                alt={`${idea.title} - Image ${currentImageIndex + 1}`}
                                onError={() => setImageError(true)}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: 'none',
                                    objectFit: 'contain',
                                    borderRadius: '8px'
                                }}
                            />
                            
                            {/* Navigation Arrows (only show if multiple images) */}
                            {allImages.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        style={{
                                            position: 'absolute',
                                            left: '24px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0, 0, 0, 0.7)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '40px',
                                            height: '40px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '18px',
                                            zIndex: 10
                                        }}
                                        title="Previous image"
                                    >
                                        <i className="ri-arrow-left-line"></i>
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        style={{
                                            position: 'absolute',
                                            right: '24px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0, 0, 0, 0.7)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '40px',
                                            height: '40px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '18px',
                                            zIndex: 10
                                        }}
                                        title="Next image"
                                    >
                                        <i className="ri-arrow-right-line"></i>
                                    </button>
                                </>
                            )}
                            
                            {/* Image Counter */}
                            {allImages.length > 1 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '24px',
                                    right: '24px',
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}>
                                    {currentImageIndex + 1} / {allImages.length}
                                </div>
                            )}
                            
                            {/* Thumbnail Dots (only show if multiple images) */}
                            {allImages.length > 1 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    marginTop: '16px'
                                }}>
                                    {allImages.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => goToImage(index)}
                                            style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: index === currentImageIndex 
                                                    ? 'var(--bs-primary)' 
                                                    : 'rgba(255, 255, 255, 0.5)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            title={`Go to image ${index + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                                    <div className="mb-4">
                                        <h5 className="idea-detail-section-title mb-3">Description</h5>
                                        <p className="idea-detail-description text-break">
                                            {idea.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div className="idea-detail-actions mb-3">
                                        <button
                                            type="button"
                                            className={`btn btn-like ${liked ? 'is-active' : ''}`}
                                            onClick={handleLike}
                                            disabled={!isOpenForSupport}
                                        >
                                            <i className="ri-heart-3-fill me-2"></i>
                                            {liked ? 'Liked' : 'Like'}
                                            <span className="ms-2 idea-detail-meta-tag">
                                                <i className="ri-bar-chart-2-line"></i>
                                                {idea.likes_count || 0}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-comment"
                                            onClick={() => {
                                                setActiveTab('comments');
                                                setShowCommentForm(false);
                                            }}
                                        >
                                            <i className="ri-chat-3-line me-2"></i>
                                            View Comments
                                            <span className="ms-2 idea-detail-meta-tag">
                                                <i className="ri-chat-smile-2-line"></i>
                                                {idea.comments_count || 0}
                                            </span>
                                        </button>
                                    </div>

                                        {!isOpenForSupport && (
                                            <div className="idea-detail-support-banner">
                                                <i className="ri-lock-line"></i>
                                                Support period ended for this idea.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'comments' && (
                                <div className="idea-detail-panel">
                                    <div className="idea-detail-panel__body">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="idea-detail-section-title mb-0">Community Comments</h6>
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={() => setShowCommentForm(!showCommentForm)}
                                            >
                                                <i className="ri-add-line me-1"></i>
                                                Add Comment
                                            </button>
                                        </div>

                                        {showCommentForm && (
                                            <div className="idea-detail-comment-card mb-4">
                                                <form onSubmit={handleCommentSubmit}>
                                                    <div className="mb-3">
                                                        <textarea
                                                            className="form-control"
                                                            rows="3"
                                                            value={newComment}
                                                            onChange={(e) => setNewComment(e.target.value)}
                                                            placeholder="Share your thoughts on this idea..."
                                                            required
                                                        ></textarea>
                                                    </div>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            type="submit"
                                                            className="btn btn-primary btn-sm"
                                                            disabled={isSubmittingComment || !newComment.trim()}
                                                        >
                                                            {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary btn-sm"
                                                            onClick={() => setShowCommentForm(false)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {comments.length > 0 ? (
                                            <div className="idea-detail-comment-list">
                                                {comments.map(comment => (
                                                    <CommentItem key={comment.id} comment={comment} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <i className="ri-chat-3-line" style={{ fontSize: '2.5rem', color: 'var(--bs-text-muted)', marginBottom: '1rem', display: 'block' }}></i>
                                                <h4>No Comments Yet</h4>
                                                <p className="text-muted mb-3">Be the first to share your thoughts on this idea!</p>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={() => setShowCommentForm(true)}
                                                >
                                                    <i className="ri-chat-3-line me-2"></i>
                                                    Add First Comment
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-4">
                            <div className="idea-detail-stats-card">
                                <h6 className="mb-3">Idea Statistics</h6>
                                <div className="idea-detail-stat">
                                    <span className="idea-detail-stat__label">
                                        <i className="ri-heart-3-line"></i>
                                        Likes
                                    </span>
                                    <span className="idea-detail-stat__value">{idea.likes_count || 0}</span>
                                </div>
                                <div className="idea-detail-stat">
                                    <span className="idea-detail-stat__label">
                                        <i className="ri-chat-1-line"></i>
                                        Comments
                                    </span>
                                    <span className="idea-detail-stat__value">{idea.comments_count || 0}</span>
                                </div>
                                {typeof daysLeft === 'number' && (
                                    <div className="idea-detail-stat">
                                        <span className="idea-detail-stat__label">
                                            <i className="ri-time-line"></i>
                                            {isOpenForSupport ? 'Days Left' : 'Support Ended'}
                                        </span>
                                        <span className="idea-detail-stat__value">
                                            {isOpenForSupport ? Math.max(daysLeft, 0) : 'Closed'}
                                        </span>
                                    </div>
                                )}
                                <div className="idea-detail-stat">
                                    <span className="idea-detail-stat__label">
                                        <i className="ri-calendar-2-line"></i>
                                        Created
                                    </span>
                                    <span className="idea-detail-stat__value">{formatDate(idea.created_at)}</span>
                                </div>
                            </div>

                            {idea.milestones && idea.milestones.length > 0 && (
                                <div className="idea-detail-panel mt-4">
                                    <div className="idea-detail-panel__body">
                                        <h6 className="idea-detail-section-title mb-3">Milestones</h6>
                                        {idea.milestones.map((milestone) => (
                                            <div key={milestone.id || milestone.label} className="idea-detail-milestone">
                                                <div className="idea-detail-milestone__header">
                                                    <span className="idea-detail-milestone__label">{milestone.label}</span>
                                                    <span className="idea-detail-milestone__target">
                                                        <i className="ri-flashlight-line"></i>
                                                        {milestone.likes_target}
                                                    </span>
                                                </div>
                                                {milestone.achieved_at && (
                                                    <div className="idea-detail-milestone__achieved">
                                                        <i className="ri-check-line me-1"></i>
                                                        Achieved on {formatDate(milestone.achieved_at)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Comment Item Component
const CommentItem = ({ comment }) => {
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="idea-detail-comment-item">
            <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <strong>{comment.user_name || 'Anonymous'}</strong>
                    <span className="text-muted small ms-2">{formatDate(comment.created_at)}</span>
                </div>
            </div>
            <p className="mb-0 text-break" style={{ color: '#ffffff' }}>{comment.body}</p>
        </div>
    );
};

export default IdeaDetailPage;
