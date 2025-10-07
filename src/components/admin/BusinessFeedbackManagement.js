import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import './BusinessFeedbackManagement.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BKebabMenu from './ui/BKebabMenu';
import { baseURL, itemAPI } from '../../services/apiClient';

const BusinessFeedbackManagement = ({ type = 'all' }) => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [business, setBusiness] = useState(null);
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', description: '', item_type: '' });
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [openMenuId, setOpenMenuId] = useState(null);

    // Get user info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'business_admin';
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';

    useEffect(() => {
        fetchBusinessDetails();
        fetchItems();
    }, [businessId, type]);

    const fetchBusinessDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${baseURL}/api/businesses/${businessId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setBusiness(data);
            } else {
                throw new Error('Failed to fetch business details');
            }
        } catch (error) {
            console.error('Error fetching business details:', error);
            toast.error('Failed to fetch business details');
        }
    };

    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            let response;
            
            // Use admin view for business admins/super admins to see unpublished items
            const params = isAdmin ? { admin_view: 'true' } : {};
            
            // Use appropriate itemAPI method based on type
            if (type === 'bugs') {
                response = await itemAPI.listBugsForBusiness(businessId, params);
            } else if (type === 'features') {
                response = await itemAPI.listFeaturesForBusiness(businessId, params);
            } else {
                response = await itemAPI.listItemsForBusiness(businessId, params);
            }

            setItems(response.data.items || []);
        } catch (error) {
            console.error('Error fetching items:', error);
            setError('Failed to load feedback items');
            toast.error('Failed to load feedback items');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateItem = async (e) => {
        e.preventDefault();
        
        if (!newItem.title.trim()) {
            toast.error('Title is required');
            return;
        }

        // Validate item type for 'all' mode
        if (type === 'all' && !newItem.item_type) {
            toast.error('Please select an item type');
            return;
        }

        try {
            let itemData = { ...newItem };
            
            // Set item type based on type and use appropriate API method
            if (type === 'bugs') {
                itemData.item_type = 'BUG';
                await itemAPI.createBugReport(businessId, itemData);
            } else if (type === 'features') {
                itemData.item_type = 'FEATURE';
                await itemAPI.createFeatureRequest(businessId, itemData);
            } else {
                await itemAPI.createItem(businessId, itemData);
            }

            toast.success('Item created successfully');
            setNewItem({ title: '', description: '', item_type: '' });
            setShowCreateDialog(false);
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error creating item:', error);
            toast.error(error.response?.data?.error || 'Failed to create item');
        }
    };

    const handleDeleteItem = async (itemId, itemTitle) => {
        if (!window.confirm(`Are you sure you want to delete "${itemTitle}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await itemAPI.deleteItem(itemId);
            toast.success('Item deleted successfully');
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error(error.response?.data?.error || 'Failed to delete item');
        }
    };

    const handleStatusChange = async (itemId, newStatus) => {
        try {
            await itemAPI.updateBusinessItemStatus(businessId, itemId, { status: newStatus });
            toast.success('Status updated successfully');
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error(error.response?.data?.error || 'Failed to update status');
        }
    };

    const handlePublishItem = async (itemId) => {
        try {
            await itemAPI.publishItem(itemId);
            toast.success('Item published successfully');
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error publishing item:', error);
            toast.error(error.response?.data?.error || 'Failed to publish item');
        }
    };

    const handleUnpublishItem = async (itemId) => {
        try {
            await itemAPI.unpublishItem(itemId);
            toast.success('Item unpublished successfully');
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error unpublishing item:', error);
            toast.error(error.response?.data?.error || 'Failed to unpublish item');
        }
    };

    const handleArchiveItem = async (itemId) => {
        if (!window.confirm('Are you sure you want to archive this item? It will be hidden from active lists.')) {
            return;
        }
        
        try {
            await itemAPI.archiveItem(itemId);
            toast.success('Item archived successfully');
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error('Error archiving item:', error);
            toast.error(error.response?.data?.error || 'Failed to archive item');
        }
    };

    const getPageTitle = () => {
        switch (type) {
            case 'bugs':
                return 'Bug Reports';
            case 'features':
                return 'Feature Requests';
            default:
                return 'All Feedback';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED':
                return 'status-completed';
            case 'REJECTED':
                return 'status-rejected';
            case 'UNDER_REVIEW':
                return 'status-under-review';
            case 'PLANNED':
                return 'status-planned';
            default:
                return 'status-pending';
        }
    };

    const filteredItems = items.filter(item => {
        if (statusFilter === 'all') return true;
        return item.status === statusFilter;
    }).sort((a, b) => {
        if (sortBy === 'votes') {
            return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
        }
        return new Date(b.created_at) - new Date(a.created_at);
    });

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content business-feedback-page">
                {/* Breadcrumbs intentionally removed for cleaner header */}

                {/* Page Header */}
                <div className="dashboard-header">
                    <h1 className="b_admin_styling-title">
                        {getPageTitle()} - {business?.name || 'Business'}
                    </h1>
                    <p className="chat-subtitle">
                        Manage and respond to {type === 'all' ? 'all feedback' : type} for this business.
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
                                    <option value="PENDING">Pending</option>
                                    <option value="UNDER_REVIEW">Under Review</option>
                                    <option value="PLANNED">Planned</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="REJECTED">Rejected</option>
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
                                    <option value="votes">Most Voted</option>
                                </select>
                            </BFilterControl>
                        </BFilterBar>
                        <BButton onClick={() => setShowCreateDialog(true)} variant="primary" size="sm">
                            <i className="ri-add-line"></i>
                            New {type === 'bugs' ? 'Bug Report' : type === 'features' ? 'Feature Request' : 'Item'}
                        </BButton>
                    </div>
                </div>

                {/* Items List */}
                <div className="feedback-content">
                    {isLoading ? (
                        <div className="loading-state">
                            <i className="ri-loader-4-line"></i>
                            <p>Loading feedback items...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <i className="ri-error-warning-line"></i>
                            <p>{error}</p>
                            <button onClick={fetchItems} className="retry-button">
                                <i className="ri-refresh-line"></i>
                                Retry
                            </button>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="b_admin_styling-card b_admin_styling-empty-state">
                            <i className="ri-inbox-line" style={{ color: 'var(--b-admin-primary)', fontSize: 32 }}></i>
                            <h3 style={{ marginTop: 8, color: 'var(--b-admin-primary)' }}>
                                No {type === 'all' ? 'feedback items' : type} found.
                            </h3>
                            <BButton 
                                onClick={() => setShowCreateDialog(true)}
                                variant="primary"
                                size="sm"
                            >
                                <i className="ri-add-line"></i>
                                Create First {type === 'bugs' ? 'Bug Report' : type === 'features' ? 'Feature Request' : 'Item'}
                            </BButton>
                        </div>
                    ) : (
                        <div className="items-grid">
                            {filteredItems.map((item) => (
                                <div key={item.id} className="item-card">
                                    <div className="item-header">
                                        <div className="item-type-badge">
                                            <i className={item.item_type === 'BUG' ? 'ri-bug-line' : 'ri-lightbulb-line'}></i>
                                            {item.item_type}
                                        </div>
                                        <div className={`status-badge ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </div>
                                        {isAdmin && (
                                            <div className={`publication-badge ${item.is_published ? 'published' : 'unpublished'}`}>
                                                <i className={item.is_published ? 'ri-eye-line' : 'ri-eye-off-line'}></i>
                                                {item.is_published ? 'PUBLIC' : 'DRAFT'}
                                            </div>
                                        )}
                                        {isAdmin && item.is_archived && (
                                            <div className="archived-badge">
                                                <i className="ri-archive-line"></i>
                                                ARCHIVED
                                            </div>
                                        )}
                                    </div>
                                    
                                    <h3 className="item-title">{item.title}</h3>
                                    
                                    {item.description && (
                                        <p className="item-description">{item.description}</p>
                                    )}
                                    
                                    <div className="item-meta">
                                        <span className="item-author">
                                            <i className="ri-user-line"></i>
                                            {item.user_name || 'Unknown User'}
                                        </span>
                                        <span className="item-date">
                                            <i className="ri-calendar-line"></i>
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                        <span className="item-votes">
                                            <i className="ri-thumb-up-line"></i>
                                            {item.upvotes || 0}
                                            <i className="ri-thumb-down-line"></i>
                                            {item.downvotes || 0}
                                        </span>
                                    </div>
                                    
                                    {isAdmin && (
                                        <div className="item-actions">
                                            <div className="action-row" style={{ marginBottom: 8 }}>
                                                <select 
                                                    value={item.status}
                                                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                    className="status-select"
                                                >
                                                    <option value="PENDING">Pending</option>
                                                    <option value="UNDER_REVIEW">Under Review</option>
                                                    <option value="PLANNED">Planned</option>
                                                    <option value="COMPLETED">Completed</option>
                                                    <option value="REJECTED">Rejected</option>
                                                </select>
                                            </div>
                                            <div className="action-row">
                                                <BKebabMenu
                                                    isOpen={openMenuId === item.id}
                                                    onToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                                    items={[
                                                        ...(!item.is_archived ? [
                                                            { label: item.is_published ? 'Unpublish' : 'Publish', icon: item.is_published ? 'ri-eye-off-line' : 'ri-eye-line', onClick: () => (item.is_published ? handleUnpublishItem(item.id) : handlePublishItem(item.id)) },
                                                            { label: 'Archive', icon: 'ri-archive-line', onClick: () => handleArchiveItem(item.id) },
                                                        ] : []),
                                                        { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => handleDeleteItem(item.id, item.title) }
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

                {/* Create Dialog */}
                {showCreateDialog && (
                    <div className="modal-backdrop" onClick={() => setShowCreateDialog(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Create New {type === 'bugs' ? 'Bug Report' : type === 'features' ? 'Feature Request' : 'Item'}</h2>
                                <button 
                                    onClick={() => setShowCreateDialog(false)}
                                    className="close-button"
                                >
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            
                            <form onSubmit={handleCreateItem} className="create-form">
                                {type === 'all' && (
                                    <div className="newform-group">
                                        <label htmlFor="item_type">Type *</label>
                                        <select
                                            id="item_type"
                                            value={newItem.item_type}
                                            onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                                            required
                                            className="newform-select"
                                        >
                                            <option value="">Select type...</option>
                                            <option value="BUG">Bug Report</option>
                                            <option value="FEATURE">Feature Request</option>
                                        </select>
                                    </div>
                                )}
                                
                                <div className="newform-group">
                                    <label htmlFor="title">Title *</label>
                                    <input
                                        type="text"
                                        id="title"
                                        value={newItem.title}
                                        onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                        placeholder="Enter a descriptive title"
                                        required
                                        className="form-input"
                                    />
                                </div>
                                
                                <div className="newform-group">
                                    <label htmlFor="description">Description</label>
                                    <textarea
                                        id="description"
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                        placeholder="Provide detailed information"
                                        rows={4}
                                        className="form-textarea"
                                    />
                                </div>
                                
                                <div className="form-actions">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCreateDialog(false)}
                                        className="cancel-button"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="nawabutton"
                                    >
                                        <i className="ri-add-line"></i>
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessFeedbackManagement; 