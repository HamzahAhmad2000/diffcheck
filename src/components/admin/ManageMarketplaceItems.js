import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { marketplaceAPI, baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';
import BAdminTable from './ui/BAdminTable';
import BLoading from './ui/BLoading';

const defaultItemImagePath = '/default-item-placeholder.png'; // Ensure this exists in /public

const ManageMarketplaceItems = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const response = await marketplaceAPI.adminGetItems();
            setItems(response.data.items || []);
        } catch (error) {
            console.error("Error fetching marketplace items:", error);
            toast.error(error.response?.data?.error || 'Failed to load items.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const handleDeleteItem = async (itemId, itemTitle) => {
        const toastId = toast.loading(`Deleting ${itemTitle}...`);
        try {
            await marketplaceAPI.adminDeleteItem(itemId);
            toast.success(`${itemTitle} deleted successfully.`, { id: toastId });
            fetchItems();
        } catch (error) {
            console.error("Error deleting item:", error);
            toast.error(error.response?.data?.error || `Failed to delete ${itemTitle}.`, { id: toastId });
        }
    };

    const handleEditItem = (itemId) => {
        navigate(`/admin/marketplace/edit/${itemId}`);
    };

    const handleToggleActive = async (itemId, currentStatus) => {
        const newStatus = !currentStatus;
        const actionText = newStatus ? 'Activating' : 'Deactivating';
        const itemToUpdate = items.find(item => item.id === itemId);
        const toastId = toast.loading(`${actionText} ${itemToUpdate?.title || 'item'}...`);

        try {
            const formData = new FormData();
            formData.append('is_active', newStatus);
            await marketplaceAPI.adminUpdateItem(itemId, formData);
            toast.success(`${itemToUpdate?.title || 'Item'} ${newStatus ? 'activated' : 'deactivated'}.`, { id: toastId });
            fetchItems();
        } catch (error) {
            toast.error(`Failed to ${actionText.toLowerCase()} item.`, { id: toastId });
            console.error("Error toggling item status:", error);
        }
    };

    const handleToggleFeatured = async (itemId, currentStatus) => {
        const newStatus = !currentStatus;
        const actionText = newStatus ? 'Featuring' : 'Unfeaturing';
        const itemToUpdate = items.find(item => item.id === itemId);
        const toastId = toast.loading(`${actionText} ${itemToUpdate?.title || 'item'}...`);
        try {
            if (newStatus) {
                await marketplaceAPI.featureItem(itemId);
            } else {
                await marketplaceAPI.unfeatureItem(itemId);
            }
            toast.success(`${itemToUpdate?.title || 'Item'} ${newStatus ? 'featured' : 'unfeatured'}.`, { id: toastId });
            fetchItems();
        } catch (error) {
            toast.error(`Failed to ${actionText.toLowerCase()} item.`, { id: toastId });
            console.error("Error toggling featured status:", error);
        }
    };

    const filteredItems = items.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) return null;
        return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${baseURL}${relativeOrAbsoluteUrl}`;
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="b_admin_styling-main">
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">Manage Marketplace Items</h1>
                        <p style={{ margin: 0, color: '#666' }}>View, edit, or delete marketplace reward items.</p>
                    </div>
                    <BButton variant="primary" size="sm" onClick={() => navigate('/admin/marketplace/create')}>
                        <i className="ri-add-line"></i> Add New Item
                    </BButton>
                </div>

                <BFilterBar>
                    <BFilterControl label="Search by Title" htmlFor="searchItems">
                        <BSearchInput id="searchItems" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by item title..." />
                    </BFilterControl>
                </BFilterBar>

                {loading ? (
                    <BLoading variant="page" label="Loading items..." />
                ) : (
                    <BAdminTable headers={["Image","Title","Type","XP Cost","Stock","Status","Featured","Actions"]}>
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <img 
                                            src={getFullImageUrl(item.image_url) || defaultItemImagePath} 
                                            alt={item.title} 
                                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                                            onError={(e) => { e.target.src = defaultItemImagePath; }}    
                                        />
                                    </td>
                                    <td>{item.title}</td>
                                    <td>{item.item_type}</td>
                                    <td>{item.xp_cost}</td>
                                    <td>{item.stock !== null ? item.stock : 'N/A'}</td>
                                    <td>
                                        <BStatusBadge type={item.is_active ? 'active' : 'inactive'}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </BStatusBadge>
                                    </td>
                                    <td>
                                        <BStatusBadge type={item.is_featured ? 'active' : 'inactive'}>
                                            {item.is_featured ? 'Featured' : 'Not'}
                                        </BStatusBadge>
                                    </td>
                                    <td className="b_admin_styling-table__actions">
                                        <BKebabMenu
                                            isOpen={openMenuId === item.id}
                                            onToggle={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                            items={[
                                                { label: 'Edit', icon: 'ri-pencil-line', onClick: () => { setOpenMenuId(null); handleEditItem(item.id); } },
                                                { label: item.is_active ? 'Deactivate' : 'Activate', icon: item.is_active ? 'ri-toggle-fill' : 'ri-toggle-line', onClick: () => { setOpenMenuId(null); handleToggleActive(item.id, item.is_active); } },
                                                { label: item.is_featured ? 'Unfeature' : 'Feature', icon: item.is_featured ? 'ri-star-fill' : 'ri-star-line', onClick: () => { setOpenMenuId(null); handleToggleFeatured(item.id, item.is_featured); } },
                                                { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDeleteItem(item.id, item.title); } },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No marketplace items found.</td>
                            </tr>
                        )}
                    </BAdminTable>
                )}
            </div>
        </div>
    );
};

export default ManageMarketplaceItems; 