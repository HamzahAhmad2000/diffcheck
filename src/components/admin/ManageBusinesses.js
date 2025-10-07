import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Sidebar is provided by the admin layout; do not import locally
import apiClient, { businessAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/b_admin_styling.css';
// Reusable admin UI components
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';
import BAdminTable from './ui/BAdminTable';
import BLoading from './ui/BLoading';

const ManageBusinesses = () => {
    const navigate = useNavigate();
    const [businesses, setBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState('');
    const [filterApproved, setFilterApproved] = useState(''); // 'true', 'false', or ''
    const [openMenuId, setOpenMenuId] = useState(null);


    const fetchBusinesses = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (searchTerm) params.name = searchTerm;
            if (filterTier) params.tier = filterTier;
            if (filterApproved !== '') params.is_approved = filterApproved;
            
            console.log('[ManageBusinesses] Fetching with params:', params);
            const response = await apiClient.get('/api/businesses', { params });
            setBusinesses(response.data || []);
        } catch (error) {
            console.error("Error fetching businesses:", error);
            toast.error(error.response?.data?.error || 'Failed to fetch businesses.');
            setBusinesses([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, filterTier, filterApproved]);

    useEffect(() => {
        fetchBusinesses();
    }, [fetchBusinesses]);

    const handleModify = (businessId) => {
        navigate(`/admin/business/edit/${businessId}`);
    };

    const handleDelete = async (businessId, businessName) => {
        try {
            await apiClient.delete(`/api/businesses/${businessId}`);
            toast.success(`Business "${businessName}" deleted successfully.`);
            fetchBusinesses();
        } catch (error) {
            console.error("Error deleting business:", error);
            toast.error(error.response?.data?.error || 'Failed to delete business.');
        }
    };
    
    // Toggle active/inactive or approved status
    const handleToggleStatus = async (businessId, field, currentValue) => {
        const newValue = !currentValue;
        const updateData = { [field]: newValue };
        const actionText = field === 'is_active' ? (newValue ? 'activate' : 'deactivate') : (newValue ? 'approve' : 'unapprove');
        try {
            await apiClient.put(`/api/businesses/${businessId}`, updateData);
            toast.success(`Business successfully ${actionText}d.`);
            fetchBusinesses();
        } catch (error) {
            toast.error(`Failed to ${actionText} business.`);
            console.error(`Error toggling ${field} status:`, error);
        }
    };

    const handleToggleFeatured = async (businessId, currentValue) => {
        const newValue = !currentValue;
        const actionText = newValue ? 'feature' : 'unfeature';
        try {
            if (newValue) {
                await businessAPI.featureBusiness(businessId);
            } else {
                await businessAPI.unfeatureBusiness(businessId);
            }
            toast.success(`Business successfully ${actionText}d.`);
            fetchBusinesses();
        } catch (error) {
            toast.error(`Failed to ${actionText} business.`);
            console.error(`Error toggling featured status:`, error);
        }
    };

    return (
        <main className="b_admin_styling-main">
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">Manage Businesses</h1>
                        <p style={{ margin: 0, color: '#666' }}>View, edit, and manage all registered business entities.</p>
                    </div>
                    <BButton variant="primary" size="sm" onClick={() => navigate('/admin/business/new')}>
                        <i className="ri-add-line"></i>
                        Add New Business
                    </BButton>
                </div>
                <BFilterBar>
                    <BFilterControl label="Search by Name" htmlFor="searchTerm">
                        <BSearchInput
                            id="searchTerm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter business name..."
                        />
                    </BFilterControl>
                    <BFilterControl label="Filter by Tier" htmlFor="filterTier">
                        <select
                            id="filterTier"
                            className="b_admin_styling-select b_admin_styling-select--compact"
                            value={filterTier}
                            onChange={(e) => setFilterTier(e.target.value)}
                        >
                            <option value="">All Tiers</option>
                            <option value="normal">Normal</option>
                            <option value="advanced">Advanced</option>
                            <option value="super">Super</option>
                        </select>
                    </BFilterControl>
                    <BFilterControl label="Filter by Approval" htmlFor="filterApproved">
                        <select
                            id="filterApproved"
                            className="b_admin_styling-select b_admin_styling-select--compact"
                            value={filterApproved}
                            onChange={(e) => setFilterApproved(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Approved</option>
                            <option value="false">Pending/Not Approved</option>
                        </select>
                    </BFilterControl>
                </BFilterBar>

                {isLoading ? (
                    <BLoading variant="page" label="Loading businesses..." />
                ) : (
                    <BAdminTable headers={[
                        'Name','Tier','Website','Status','Approved','Created At','Featured','Actions'
                    ]}>
                        {businesses.length > 0 ? (
                            businesses.map((biz) => (
                                <tr key={biz.id}>
                                    <td>
                                        <Link to={`/admin/business/dashboard/${biz.id}`} className="b_admin_styling-table__link">
                                            {biz.name}
                                        </Link>
                                    </td>
                                    <td>{biz.tier?.charAt(0).toUpperCase() + biz.tier?.slice(1)}</td>
                                    <td>
                                        {biz.website ? (
                                            <a href={biz.website} target="_blank" className="b_admin_styling-table__link" rel="noopener noreferrer">
                                                {biz.website}
                                            </a>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                    <td>
                                        <BStatusBadge type={biz.is_active ? 'active' : 'inactive'}>
                                            {biz.is_active ? 'Active' : 'Inactive'}
                                        </BStatusBadge>
                                    </td>
                                    <td>
                                        <BStatusBadge type={biz.is_approved ? 'approved' : 'pending'}>
                                            {biz.is_approved ? 'Approved' : 'Pending'}
                                        </BStatusBadge>
                                    </td>
                                    <td>{biz.created_at ? new Date(biz.created_at).toLocaleDateString() : '-'}</td>
                                    <td>
                                        <BStatusBadge type={biz.is_featured ? 'active' : 'inactive'}>
                                            {biz.is_featured ? 'Featured' : 'Not'}
                                        </BStatusBadge>
                                    </td>
                                    <td className="b_admin_styling-table__actions">
                                        <BKebabMenu
                                            isOpen={openMenuId === biz.id}
                                            onToggle={() => setOpenMenuId(openMenuId === biz.id ? null : biz.id)}
                                            items={[
                                                { label: 'Modify', icon: 'ri-pencil-line', onClick: () => { setOpenMenuId(null); handleModify(biz.id); } },
                                                { label: biz.is_active ? 'Deactivate' : 'Activate', icon: biz.is_active ? 'ri-toggle-fill' : 'ri-toggle-line', onClick: () => { setOpenMenuId(null); handleToggleStatus(biz.id, 'is_active', biz.is_active); } },
                                                { label: biz.is_approved ? 'Unapprove' : 'Approve', icon: biz.is_approved ? 'ri-checkbox-circle-fill' : 'ri-time-line', onClick: () => { setOpenMenuId(null); handleToggleStatus(biz.id, 'is_approved', biz.is_approved); } },
                                                { label: biz.is_featured ? 'Unfeature' : 'Feature', icon: biz.is_featured ? 'ri-star-fill' : 'ri-star-line', onClick: () => { setOpenMenuId(null); handleToggleFeatured(biz.id, biz.is_featured); } },
                                                { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDelete(biz.id, biz.name); } },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No businesses found.</td>
                            </tr>
                        )}
                    </BAdminTable>
                )}
        </main>
    );
};

export default ManageBusinesses; 