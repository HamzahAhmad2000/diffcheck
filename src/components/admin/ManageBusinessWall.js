import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminTables.css'; // Reusing table styles
import './AdminForms.css'; // For modal form if any
import BLoading from './ui/BLoading';

const ManageBusinessWall = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [activities, setActivities] = useState([]);
    const [businessName, setBusinessName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPostTitle, setNewPostTitle] = useState('');
    const [newPostDescription, setNewPostDescription] = useState('');
    const [newPostIsPublic, setNewPostIsPublic] = useState(false);
    const [isSubmittingPost, setIsSubmittingPost] = useState(false);

    // For editing existing custom posts
    const [editingActivity, setEditingActivity] = useState(null); 

    const userRole = localStorage.getItem('userRole');
    const dashboardLink = userRole === 'business_admin'
        ? '/business-admin/dashboard'
        : `/admin/business/dashboard/${businessId}`;

    const fetchBusinessDetailsAndActivities = useCallback(async () => {
        setIsLoading(true);
        try {
            const bizResponse = await apiClient.get(`/api/businesses/${businessId}`);
            setBusinessName(bizResponse.data.name || 'Business');

            // Fetch ALL activities (public and private) for management view
            const actResponse = await apiClient.get(`/api/businesses/${businessId}/activities`);
            setActivities(actResponse.data.activities || []);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to load business wall data.');
            console.error("Error fetching wall data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchBusinessDetailsAndActivities();
    }, [fetchBusinessDetailsAndActivities]);

    const handleTogglePublic = async (activityId, currentIsPublic) => {
        try {
            await apiClient.put(`/api/activities/${activityId}/visibility`, { is_public: !currentIsPublic });
            toast.success(`Activity visibility updated.`);
            fetchBusinessDetailsAndActivities(); // Refresh
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update visibility.');
        }
    };

    const handleTogglePin = async (activityId, currentIsPinned) => {
        try {
            await apiClient.put(`/api/activities/${activityId}/visibility`, { is_pinned: !currentIsPinned });
            toast.success(`Activity pin status updated.`);
            fetchBusinessDetailsAndActivities(); // Refresh
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update pin status.');
        }
    };
    
    const handleDeleteActivity = async (activityId, activityTitle) => {
        if (window.confirm(`Are you sure you want to delete activity "${activityTitle}"? This cannot be undone.`)) {
            try {
                await apiClient.delete(`/api/activities/${activityId}`);
                toast.success(`Activity "${activityTitle}" deleted.`);
                fetchBusinessDetailsAndActivities(); // Refresh
            } catch (error) {
                toast.error(error.response?.data?.error || 'Failed to delete activity.');
            }
        }
    };

    const handleCreateNewPost = async (e) => {
        e.preventDefault();
        if (!newPostTitle.trim()) {
            toast.error("Post title is required.");
            return;
        }
        setIsSubmittingPost(true);
        try {
            const payload = {
                title: newPostTitle,
                description: newPostDescription,
                is_public: newPostIsPublic,
            };
            if (editingActivity) { // If editing
                 await apiClient.put(`/api/activities/${editingActivity.id}/visibility`, payload); // Uses same endpoint for title/desc for custom posts
                 toast.success("Custom post updated successfully!");
            } else { // If creating new
                 await apiClient.post(`/api/businesses/${businessId}/activities/custom-post`, payload);
                 toast.success("Custom post created successfully!");
            }
            setShowCreateModal(false);
            setNewPostTitle('');
            setNewPostDescription('');
            setNewPostIsPublic(false);
            setEditingActivity(null);
            fetchBusinessDetailsAndActivities(); // Refresh
        } catch (error) {
            toast.error(error.response?.data?.error || `Failed to ${editingActivity ? 'update' : 'create'} custom post.`);
        } finally {
            setIsSubmittingPost(false);
        }
    };

    const openEditModal = (activity) => {
        if (activity.activity_type === "custom_post") {
            setEditingActivity(activity);
            setNewPostTitle(activity.title);
            setNewPostDescription(activity.description || '');
            setNewPostIsPublic(activity.is_public);
            setShowCreateModal(true);
        } else {
            toast.error("Only custom posts can be directly edited here. Other activities are system-generated.");
        }
    };
    
    const openCreateModal = () => {
        setEditingActivity(null);
        setNewPostTitle('');
        setNewPostDescription('');
        setNewPostIsPublic(false);
        setShowCreateModal(true);
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-table-page">
                <div className="table-header-container">
                    <div className="table-header">
                        <Link to={dashboardLink} className="back-to-dashboard-link" style={{ fontSize: '14px', marginBottom: '10px', display: 'block' }}>
                            <i className="ri-arrow-left-line"></i> Back to {businessName} Dashboard
                        </Link>
                        <h1 className="chat-title">Manage Wall for {businessName}</h1>
                        <p className="chat-subtitle">Control what appears on your business's public feed.</p>
                    </div>
                    <button 
                        className="newform-button primary table-action-button" 
                        onClick={openCreateModal}
                    >
                        <i className="ri-add-circle-line"></i> Create Custom Post
                    </button>
                </div>

                {/* Modal for Creating/Editing Custom Post */}
                {showCreateModal && (
                    <div className="modal-backdrop">
                        <div className="modal-content admin-form" style={{maxWidth: '600px', margin: '50px auto', padding: '30px', background: 'white', borderRadius: '8px'}}>
                            <h2 className="chat-title" style={{fontSize:'22px'}}>{editingActivity ? "Edit" : "Create New"} Custom Wall Post</h2>
                            <form onSubmit={handleCreateNewPost}>
                                <div className="newform-group">
                                    <label htmlFor="postTitle">Title*</label>
                                    <input type="text" id="postTitle" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} required />
                                </div>
                                <div className="newform-group">
                                    <label htmlFor="postDescription">Description/Content</label>
                                    <textarea id="postDescription" value={newPostDescription} onChange={(e) => setNewPostDescription(e.target.value)} rows="4"></textarea>
                                </div>
                                <div className="newform-group permission-item">
                                    <input type="checkbox" id="postIsPublic" checked={newPostIsPublic} onChange={(e) => setNewPostIsPublic(e.target.checked)} />
                                    <label htmlFor="postIsPublic" style={{marginBottom:0}}>Make this post public on the wall immediately?</label>
                                </div>
                                <div className="form-actions" style={{justifyContent:'space-between'}}>
                                    <button type="button" className="newform-button secondary" onClick={() => {setShowCreateModal(false); setEditingActivity(null);}} disabled={isSubmittingPost}>Cancel</button>
                                    <button type="submit" className="newform-button primary" disabled={isSubmittingPost}>
                                        {isSubmittingPost ? (editingActivity ? 'Updating...' : 'Posting...') : (editingActivity ? 'Update Post' : 'Create Post')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <BLoading variant="page" label="Loading wall activities..." />
                ) : (
                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Created By</th>
                                    <th>Public</th>
                                    <th>Pinned</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.length > 0 ? activities.map(act => (
                                    <tr key={act.id}>
                                        <td>{act.title}</td>
                                        <td><span className='status-badge' style={{backgroundColor: '#eee', color: '#333'}}>{act.activity_type.replace(/_/g, ' ').toUpperCase()}</span></td>
                                        <td>{act.user_name || 'System'}</td>
                                        <td>
                                            <button 
                                                onClick={() => handleTogglePublic(act.id, act.is_public)}
                                                className="action-button-link"
                                                title={act.is_public ? 'Make Private' : 'Make Public'}
                                            >
                                               <i className={act.is_public ? "ri-eye-fill" : "ri-eye-off-fill"}></i>
                                            </button>
                                            {act.is_public ? "Yes" : "No"}
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => handleTogglePin(act.id, act.is_pinned)}
                                                className="action-button-link"
                                                title={act.is_pinned ? 'Unpin' : 'Pin to Top'}
                                            >
                                               <i className={act.is_pinned ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
                                            </button>
                                            {act.is_pinned ? "Yes" : "No"}
                                        </td>
                                        <td>{new Date(act.created_at).toLocaleString()}</td>
                                        <td className="actions-cell">
                                            {act.activity_type === "custom_post" && (
                                                 <button onClick={() => openEditModal(act)} className="action-button modify">
                                                    <i className="ri-pencil-line"></i> Edit
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteActivity(act.id, act.title)} className="action-button delete">
                                                <i className="ri-delete-bin-line"></i> Delete
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center' }}>No activities found for this business wall.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageBusinessWall; 