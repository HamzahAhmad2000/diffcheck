import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminTables.css';
import './AdminForms.css'; // For filter form styles
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const ManageBusinessRequests = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchPendingRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = { is_approved: 'false' }; // Key filter for this page
            if (searchTerm) params.name = searchTerm;
            
            const response = await apiClient.get('/api/businesses', { params });
            setRequests(response.data || []);
        } catch (error) {
            console.error("Error fetching pending business requests:", error);
            toast.error('Failed to fetch pending business requests.');
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        fetchPendingRequests();
    }, [fetchPendingRequests]);

    const handleApprove = async (requestId, businessName) => {
        if (window.confirm(`Are you sure you want to approve the business request for "${businessName}"?`)) {
            try {
                await apiClient.put(`/api/businesses/${requestId}/approve`);
                toast.success(`Business "${businessName}" approved successfully.`);
                fetchPendingRequests(); // Refresh list
            } catch (error) {
                console.error("Error approving business request:", error);
                toast.error(error.response?.data?.error || 'Failed to approve request.');
            }
        }
    };

    const handleReject = async (requestId, businessName) => {
        if (window.confirm(`Are you sure you want to reject (and delete) the business request for "${businessName}"? This action cannot be undone.`)) {
            try {
                await apiClient.delete(`/api/businesses/${requestId}/request`);
                toast.success(`Business request for "${businessName}" rejected and removed.`);
                fetchPendingRequests(); // Refresh list
            } catch (error) {
                console.error("Error rejecting business request:", error);
                toast.error(error.response?.data?.error || 'Failed to reject request.');
            }
        }
    };
    
    const handleViewDetails = (requestId) => {
        // Navigate to the standard EditBusiness page, but it's for an unapproved business
        navigate(`/admin/business/edit/${requestId}`);
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="main-content10 admin-table-page">
                <div className="table-header-container">
                    <div className="table-header">
                        <h1 className="b_admin_styling-title">Manage Business Requests</h1>
                        <p className="chat-subtitle">Review and process new business registration requests.</p>
                    </div>
                </div>

                <BFilterBar>
                    <BFilterControl label="Search by Name" htmlFor="searchTermRequests">
                        <BSearchInput id="searchTermRequests" placeholder="Enter business name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </BFilterControl>
                </BFilterBar>

                {isLoading ? (
                    <BLoading variant="page" label="Loading requests..." />
                ) : (
                    <div className="admin-table-container">
                        <table className="b_admin_styling-table">
                            <thead>
                                <tr>
                                    <th>Requested Name</th>
                                    <th>Requested By</th>
                                    <th>Desired Tier</th>
                                    <th>Location</th>
                                    <th>Website</th>
                                    <th>Requested At</th>
                                    <th className="b_admin_styling-table__actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length > 0 ? requests.map(req => (
                                    <tr key={req.id}>
                                        <td>{req.name}</td>
                                        <td>{req.requested_by_username || `User ID: ${req.requested_by_user_id}` || 'N/A'}</td>
                                        <td>{req.tier}</td>
                                        <td>{req.location || '-'}</td>
                                        <td>
                                            {req.website ? (
                                                <a href={req.website} target="_blank" rel="noopener noreferrer">
                                                    {req.website}
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td className="b_admin_styling-table__actions">
                                            <BKebabMenu
                                                isOpen={false}
                                                onToggle={() => {}}
                                                items={[
                                                    { label: 'Approve', icon: 'ri-check-line', onClick: () => handleApprove(req.id, req.name) },
                                                    { label: 'Reject', icon: 'ri-close-line', danger: true, onClick: () => handleReject(req.id, req.name) },
                                                    { label: 'Details', icon: 'ri-eye-line', onClick: () => handleViewDetails(req.id) },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="admin-empty-state">No pending business requests found.</td>
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

export default ManageBusinessRequests; 