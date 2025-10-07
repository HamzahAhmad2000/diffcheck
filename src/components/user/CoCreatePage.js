import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ideaAPI, publicBusinessAPI, baseURL, uploadAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../user/BrandDetailPage.css';
import '../user/BusinessDetailView.css';
import '../user/CoCreatePage.css';

const CoCreatePage = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [business, setBusiness] = useState(null);
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);
    
    // Filter and sort states
    const [filters, setFilters] = useState({
        search: '',
        sort: 'newest', // newest, most_liked
        minLikes: '',
        maxLikes: '',
        daysLeft: 'all' // all, 1-7, 8-30, 30+
    });

    // Detect user theme context - Force dark theme for user context
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || localStorage.getItem('userRole') || 'user';
    const isAdminContext = userRole === 'admin' || userRole === 'super_admin';
    const themeClass = 'brand-detail-dark-theme';

    const refreshIdeas = useCallback(async () => {
        try {
            const response = await ideaAPI.getPublicIdeas(businessId, getFilterParams());
            setIdeas(response.ideas || []);
        } catch (error) {
            console.error('Error refreshing ideas:', error);
        }
    }, [businessId, filters]);

    useEffect(() => {
        fetchData();
        setLogoLoaded(false); // Reset logo loading state when business changes
    }, [businessId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [businessResponse, ideasResponse] = await Promise.allSettled([
                publicBusinessAPI.getBusinessDetails(businessId),
                ideaAPI.getPublicIdeas(businessId, getFilterParams())
            ]);

            if (businessResponse.status === 'fulfilled' && businessResponse.value.data) {
                setBusiness(businessResponse.value.data);
            } else {
                setError('Business not found');
                return;
            }

            if (ideasResponse.status === 'fulfilled') {
                setIdeas(ideasResponse.value.ideas || []);
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load page data');
        } finally {
            setLoading(false);
        }
    };

    const getFilterParams = () => {
        const params = {};
        
        if (filters.search.trim()) {
            params.search = filters.search.trim();
        }
        
        if (filters.sort) {
            params.sort = filters.sort;
        }
        
        if (filters.minLikes) {
            params.min_likes = parseInt(filters.minLikes);
        }
        
        if (filters.maxLikes) {
            params.max_likes = parseInt(filters.maxLikes);
        }
        
        if (filters.daysLeft !== 'all') {
            params.days_left_filter = filters.daysLeft;
        }
        
        return params;
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        
        // Auto-apply filters for search and sort changes
        if (key === 'search' || key === 'sort') {
            // Use setTimeout to debounce search
            if (key === 'search') {
                setTimeout(() => {
                    applyFiltersWithValue(key, value);
                }, 300);
            } else {
                applyFiltersWithValue(key, value);
            }
        }
    };

    const applyFiltersWithValue = async (changedKey, changedValue) => {
        try {
            setLoading(true);
            const updatedFilters = { ...filters, [changedKey]: changedValue };
            const params = {};
            
            if (updatedFilters.search.trim()) {
                params.search = updatedFilters.search.trim();
            }
            
            if (updatedFilters.sort) {
                params.sort = updatedFilters.sort;
            }
            
            if (updatedFilters.minLikes) {
                params.min_likes = parseInt(updatedFilters.minLikes);
            }
            
            if (updatedFilters.maxLikes) {
                params.max_likes = parseInt(updatedFilters.maxLikes);
            }
            
            if (updatedFilters.daysLeft !== 'all') {
                params.days_left_filter = updatedFilters.daysLeft;
            }
            
            const response = await ideaAPI.getPublicIdeas(businessId, params);
            setIdeas(response.ideas || []);
        } catch (error) {
            console.error('Error applying filters:', error);
            toast.error('Failed to apply filters');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = async () => {
        try {
            setLoading(true);
            const response = await ideaAPI.getPublicIdeas(businessId, getFilterParams());
            setIdeas(response.ideas || []);
        } catch (error) {
            console.error('Error applying filters:', error);
            toast.error('Failed to apply filters');
        } finally {
            setLoading(false);
        }
    };

    const handleIdeaClick = (ideaId) => {
        navigate(`/user/idea/${ideaId}`);
    };

    const handleSubmitIdea = () => {
        setShowSubmissionModal(true);
    };

    const handleLikeIdea = async (ideaId, event) => {
        event.stopPropagation(); // Prevent opening the idea detail
        
        try {
            const response = await ideaAPI.likeIdea(ideaId);
            // Update the specific idea in the state immediately with the backend response
            setIdeas(prevIdeas =>
                prevIdeas.map(idea => {
                    if (idea.id === ideaId) {
                        return {
                            ...idea,
                            likes_count: response.likes_count,
                            liked_by_user: response.liked,
                            user_liked: response.liked,
                            is_open_for_support: response.is_open_for_support,
                        };
                    }
                    return idea;
                })
            );
            toast.success(response.liked ? 'Idea liked!' : 'Like removed!');
            // Removed the immediate refresh to avoid race conditions
        } catch (error) {
            console.error('Error liking idea:', error);
            toast.error(error.message || 'Failed to update like');
            // Only refresh on error to get the correct state
            await fetchData();
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

    // Add filter sidebar state
    const [showFilterSidebar, setShowFilterSidebar] = useState(false);

    // Helper function to construct logo URL with cache busting
    const getLogoUrl = (logoUrl) => {
        if (!logoUrl) return '/image.png';
    
        let fullUrl = logoUrl;
        
        // If it's a relative path, construct the full URL
        if (!logoUrl.startsWith('http')) {
            const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
            fullUrl = `${baseURL}${path}`;
        }
        
        // Add a cache-busting query parameter
        return `${fullUrl}?v=${new Date().getTime()}`;
    };

    if (loading && !ideas.length) {
        return (
            <div className={`brand-detail-loading ${themeClass}`}>
                <div className="user-loading-indicator">
                    <div className="user-loading-spinner"></div>
                    <p>Loading Co-Create Ideas...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`brand-detail-error ${themeClass}`}>
                <h2>Error Loading Ideas</h2>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className={`brand-detail-page ${themeClass}`}>
            {/* Header */}
            <div className="brand-header">
                <div className="brand-header__content">
                    <button 
                        className="brand-header__back"
                        onClick={() => navigate(`/user/brand/${businessId}`)}
                        title="Back to Business"
                    >
                        <i className="ri-arrow-left-line"></i>
                    </button>
                    
                    <div className="brand-header__logo">
                        <img
                            src={getLogoUrl(business?.logo_url)}
                            alt={`${business?.name} logo`}
                            className="brand-logo"
                            style={{
                                opacity: logoLoaded ? 1 : 0,
                                transition: 'opacity 0.3s ease-in-out'
                            }}
                            onLoad={() => setLogoLoaded(true)}
                            onError={(e) => {
                                e.target.src = '/image.png';
                                setLogoLoaded(true);
                            }}
                        />
                    </div>
                    
                    <h1 className="brand-header__title">
                        {business?.name} - Ideas Hub
                    </h1>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="controls-section" style={{ padding: '16px 24px', borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <button 
                            className="start-btn" 
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                            onClick={() => setShowFilterSidebar(true)}
                        >
                            <i className="ri-filter-line me-2"></i>
                            Filters
                        </button>
                        
                        <div className="search-input-wrapper" style={{ position: 'relative' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search ideas..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                style={{ 
                                    width: '240px', 
                                    paddingLeft: '36px',
                                    backgroundColor: 'var(--bs-body-bg)',
                                    borderColor: 'var(--bs-border-color)',
                                    color: 'var(--bs-body-color)'
                                }}
                            />
                            <i className="ri-search-line" style={{ 
                                position: 'absolute', 
                                left: '12px', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: 'var(--bs-text-muted)' 
                            }}></i>
                        </div>
                    </div>
                    
                    <div className="d-flex align-items-center gap-2">
                        {/* Sort Select */}
                        <select 
                            className="form-select form-select-sm"
                            value={filters.sort}
                            onChange={(e) => handleFilterChange('sort', e.target.value)}
                            style={{ 
                                width: 'auto',
                                backgroundColor: 'var(--bs-body-bg)',
                                borderColor: 'var(--bs-border-color)',
                                color: 'var(--bs-body-color)'
                            }}
                        >
                            <option value="newest">Newest First</option>
                            <option value="most_liked">Most Liked</option>
                        </select>
                        
                        <button 
                            className="start-btn"
                            onClick={handleSubmitIdea}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            <i className="ri-lightbulb-line me-2"></i>
                            Submit Idea
                        </button>
                    </div>
                </div>
            </div>

            {/* Ideas Content */}
            <div className="brand-content-grid-generic">
                <div className="scrollable-panel">
                    <h2 className="mb-3">
                        <i className="ri-lightbulb-line me-2"></i>
                        Community Ideas ({ideas.length})
                    </h2>
                    
                    <div className="ideas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        {ideas.length > 0 ? (
                            ideas.map(idea => (
                                <DetailedIdeaCard 
                                    key={idea.id}
                                    idea={idea} 
                    onClick={() => handleIdeaClick(idea.id)}
                    onLike={handleLikeIdea}
                                    daysLeft={calculateDaysLeft(idea.support_ends_at)}
                                />
                            ))
                        ) : (
                            <div className="empty-message">
                                <div className="text-center py-5">
                                    <i className="ri-lightbulb-line" style={{ fontSize: '3rem', color: 'var(--bs-text-muted)', marginBottom: '1rem', display: 'block' }}></i>
                                    <h4>No Ideas Found</h4>
                                    <p className="text-muted">
                                        {filters.search || filters.minLikes || filters.maxLikes || filters.daysLeft !== 'all' 
                                            ? 'Try adjusting your filters to see more ideas.'
                                            : 'Be the first to share a creative idea with this community!'
                                        }
                                    </p>
                                    <button 
                                        className="start-btn"
                                        onClick={handleSubmitIdea}
                                    >
                                        <i className="ri-lightbulb-line me-2"></i>
                                        Submit Your Idea
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Sidebar */}
            {showFilterSidebar && (
                <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="position-fixed top-0 end-0 h-100" style={{ 
                        width: '350px', 
                        backgroundColor: 'var(--bs-body-bg)', 
                        boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
                        overflowY: 'auto'
                    }}>
                        <div className="p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="mb-0">
                                    <i className="fas fa-filter me-2"></i>
                                    Filter Ideas
                                </h5>
                                <button 
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setShowFilterSidebar(false)}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold">Likes Range</label>
                                <div className="row g-2">
                                    <div className="col-6">
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            placeholder="Min likes"
                                            value={filters.minLikes}
                                            onChange={(e) => handleFilterChange('minLikes', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-6">
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            placeholder="Max likes"
                                            value={filters.maxLikes}
                                            onChange={(e) => handleFilterChange('maxLikes', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold">Support Period</label>
                                <select
                                    className="form-select"
                                    value={filters.daysLeft}
                                    onChange={(e) => handleFilterChange('daysLeft', e.target.value)}
                                >
                                    <option value="all">All Ideas</option>
                                    <option value="1-7">1-7 days left</option>
                                    <option value="8-30">8-30 days left</option>
                                    <option value="30+">30+ days left</option>
                                </select>
                            </div>

                            <div className="d-grid gap-2">
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        applyFilters();
                                        setShowFilterSidebar(false);
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <i className="ri-loader-4-line me-2" style={{ animation: 'spin 1s linear infinite' }}></i>
                                            Applying...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ri-check-line me-2"></i>
                                            Apply Filters
                                        </>
                                    )}
                                </button>
                                
                                <button 
                                    className="btn btn-outline-secondary"
                                    onClick={() => {
                                        setFilters({
                                            search: '',
                                            sort: 'newest',
                                            minLikes: '',
                                            maxLikes: '',
                                            daysLeft: 'all'
                                        });
                                        applyFilters();
                                        setShowFilterSidebar(false);
                                    }}
                                >
                                    <i className="ri-refresh-line me-2"></i>
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Submission Modal */}
            {showSubmissionModal && (
                <IdeaSubmissionModal 
                    businessId={businessId}
                    onClose={() => setShowSubmissionModal(false)}
                    onSubmit={() => {
                        setShowSubmissionModal(false);
                        fetchData(); // Refresh the data
                    }}
                />
            )}
        </div>
    );
};

// Detailed Idea Card Component (smaller, compact design)
const DetailedIdeaCard = ({ idea, onClick, onLike, daysLeft }) => {
    const isLiked = idea.user_liked || idea.liked_by_user || false;

    return (
        <div className="survey-item" style={{ cursor: 'pointer', minHeight: '280px' }}>
            <div onClick={onClick}>
                <h4 style={{ fontSize: '1rem', marginBottom: '8px' }}>{idea.title}</h4>
                {idea.description && (
                    <p className="survey-description" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                        {idea.description.length > 60 ? `${idea.description.substring(0, 57)}...` : idea.description}
                    </p>
                )}
               
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div className="idea-card-meta-row">
                    <div className="idea-card-stats">
                        <span><i className="ri-heart-line"></i>{idea.likes_count || 0}</span>
                        <span><i className="ri-chat-3-line"></i>{idea.comments_count || 0}</span>
                    </div>
                    <button
                        type="button"
                        className={`btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} idea-card-like-btn`}
                        onClick={(e) => onLike(idea.id, e)}
                    >
                        <i className="ri-heart-line"></i>
                    </button>
                </div>

                {daysLeft !== null && (
                    <div className="idea-card-subtext">
                        <i className="ri-time-line"></i>
                        {daysLeft}d left
                    </div>
                )}

                <button
                    className="start-btn idea-card-view-btn"
                    onClick={onClick}
                >
                    <i className="ri-eye-line me-1"></i>
                    View
                </button>
            </div>
        </div>
    );
};

// Helper function for status badge styling
const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'PUBLISHED': return 'bg-success';
        case 'UNDER_REVIEW': return 'bg-warning';
        case 'REJECTED': return 'bg-danger';
        case 'ARCHIVED': return 'bg-secondary';
        default: return 'bg-secondary';
    }
};

// Idea Submission Modal Component (matches BugFeatureReportForm styling)
const IdeaSubmissionModal = ({ businessId, onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) { 
            toast.error('Please fill in all required fields'); 
            return; 
        }
        
        setSubmitting(true);
        try {
            const ideaData = { 
                title: title.trim(), 
                description: description.trim() 
            };

            if (images.length > 0) {
                try {
                    const uploadedImageUrls = [];
                    for (const image of images) {
                        const uploadResponse = await uploadAPI.uploadImage(image);
                        console.log('Upload response:', uploadResponse); // Debug log
                        if (uploadResponse.data && uploadResponse.data.image_url) {
                            uploadedImageUrls.push(uploadResponse.data.image_url);
                            console.log('Image URL set:', uploadResponse.data.image_url); // Debug log
                        } else {
                            console.error('No image_url in upload response:', uploadResponse);
                            toast.error('Image upload failed: No URL returned');
                            setSubmitting(false);
                            return;
                        }
                    }
                    // For now, use the first image as the main image_url for backward compatibility
                    // Later we can extend the backend to support multiple images
                    ideaData.image_url = uploadedImageUrls[0];
                    if (uploadedImageUrls.length > 1) {
                        ideaData.additional_images = uploadedImageUrls.slice(1);
                    }
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    toast.error('Failed to upload images. Please try again.');
                    setSubmitting(false);
                    return;
                }
            }
            
            await ideaAPI.createIdea(businessId, ideaData);
            toast.success('Idea submitted successfully! It will be reviewed before appearing publicly.', { duration: 6000 });
            setTitle(''); 
            setDescription(''); 
            setImages([]);
            onSubmit();
        } catch (error) { 
            toast.error(error.response?.data?.error || 'Failed to submit idea');
        } finally { 
            setSubmitting(false); 
        }
    };
    
    return (
        <div className="co-create-modal-overlay" onClick={onClose}>
            <div 
                className="co-create-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="co-create-modal__header">
                    <h5 className="co-create-modal__title">
                        <i className="ri-lightbulb-line"></i>
                        Submit Your Idea
                    </h5>
                    <button 
                        type="button" 
                        className="co-create-modal__close" 
                        onClick={onClose}
                        aria-label="Close idea submission"
                    >
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <div className="co-create-modal__body">
                    <div className="bug-report-section">
                        <p className="report-help-text">Your submission will be reviewed before appearing publicly.</p>
                        <form onSubmit={handleSubmit} className="report-form">
                            <div className="form-group">
                                <input 
                                    type="text" 
                                    placeholder="Idea Title *" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    className="form-input" 
                                    required 
                                    maxLength={120} 
                                />
                            </div>
                            <div className="form-group">
                                <textarea 
                                    placeholder="Description *" 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    className="form-textarea" 
                                    required 
                                    rows={4} 
                                    maxLength={500} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="file-input-label">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files);
                                            if (files.length + images.length > 5) {
                                                toast.error('Maximum 5 images allowed');
                                                return;
                                            }
                                            setImages(prev => [...prev, ...files]);
                                        }} 
                                        className="file-input" 
                                    />
                                    📎 Attach Images (Optional, max 5)
                                </label>
                                {images.length > 0 && (
                                    <div className="images-preview" style={{ 
                                        display: 'flex', 
                                        flexWrap: 'wrap', 
                                        gap: '8px', 
                                        marginTop: '12px' 
                                    }}>
                                        {images.map((image, index) => (
                                            <div key={index} className="image-preview-item" style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                padding: '8px',
                                                border: '1px solid var(--bs-border-color)',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bs-secondary-bg)',
                                                maxWidth: '120px'
                                            }}>
                                                <img 
                                                    src={URL.createObjectURL(image)} 
                                                    alt={`Preview ${index + 1}`}
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        objectFit: 'cover',
                                                        borderRadius: '4px'
                                                    }}
                                                />
                                                <span style={{ 
                                                    fontSize: '0.7rem', 
                                                    marginTop: '4px',
                                                    textAlign: 'center',
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {image.name.length > 15 ? `${image.name.substring(0, 12)}...` : image.name}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        background: 'rgba(220, 53, 69, 0.8)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="d-flex gap-2 justify-content-end">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={onClose}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="submit-btn" 
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Idea'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoCreatePage;
