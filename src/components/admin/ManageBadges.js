import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { badgeAPI } from '../../services/apiClient';
import { baseURL } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BAdminTable from './ui/BAdminTable';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const defaultBadgeImagePath = '/default-badge-placeholder.png'; // Create a default placeholder in /public

const ManageBadges = () => {
    const navigate = useNavigate();
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);

    const fetchBadges = useCallback(async () => {
        setLoading(true);
        try {
            const response = await badgeAPI.adminGetBadges();
            setBadges(response.data.badges || []);
        } catch (error) {
            console.error("Error fetching badges:", error);
            toast.error(error.response?.data?.error || 'Failed to load badges.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBadges();
    }, [fetchBadges]);

    const handleDeleteBadge = async (badgeId, badgeName) => {
        if (window.confirm(`Are you sure you want to delete the badge "${badgeName}"? This may affect users who have earned it.`)) {
            const toastId = toast.loading(`Deleting ${badgeName}...`);
            try {
                await badgeAPI.adminDeleteBadge(badgeId);
                toast.success(`"${badgeName}" deleted successfully.`, { id: toastId });
                fetchBadges(); // Refresh the list
            } catch (error) {
                console.error("Error deleting badge:", error);
                toast.error(error.response?.data?.error || `Failed to delete "${badgeName}".`, { id: toastId });
            }
        }
    };

    const handleEditBadge = (badgeId) => {
        navigate(`/admin/badges/edit/${badgeId}`);
    };

    const filteredBadges = badges.filter(badge => 
        badge.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) return null;
        return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${baseURL}${relativeOrAbsoluteUrl}`;
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 b_admin_styling-main" style={{ paddingRight: '25px' }}>
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">Manage Badges</h1>
                        <p className="chat-subtitle" style={{ margin: 0 }}>Create, view, and edit user achievement badges.</p>
                    </div>
                    <BButton onClick={() => navigate('/admin/badges/create')} variant="primary" size="sm">
                        <i className="ri-add-line"></i> Add New Badge
                    </BButton>
                </div>

                <BFilterBar>
                    <BFilterControl label="Search" htmlFor="badgeSearch">
                        <input
                            id="badgeSearch"
                            type="text"
                            className="b_admin_styling-input b_admin_styling-input--compact"
                            placeholder="Search by badge name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </BFilterControl>
                </BFilterBar>

                {loading ? (
                    <BLoading variant="page" label="Loading badges..." />
                ) : (
                    <BAdminTable headers={["Image","Name","Description","XP Threshold","Actions"]}>
                        {filteredBadges.length > 0 ? filteredBadges.map((badge) => (
                            <tr key={badge.id}>
                                <td>
                                    <img 
                                        src={getFullImageUrl(badge.image_url) || defaultBadgeImagePath} 
                                        alt={badge.name} 
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%' }}
                                        onError={(e) => { e.target.src = defaultBadgeImagePath; }}    
                                    />
                                </td>
                                <td>{badge.name}</td>
                                <td>{badge.description}</td>
                                <td>{badge.xp_threshold}</td>
                                <td className="b_admin_styling-table__actions">
                                    <BKebabMenu
                                      isOpen={openMenuId === badge.id}
                                      onToggle={() => setOpenMenuId(openMenuId === badge.id ? null : badge.id)}
                                      items={[
                                        { label: 'Edit', icon: 'ri-edit-line', onClick: () => { setOpenMenuId(null); handleEditBadge(badge.id); } },
                                        { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDeleteBadge(badge.id, badge.name); } }
                                      ]}
                                    />
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="admin-empty-state">No badges found.</td>
                            </tr>
                        )}
                    </BAdminTable>
                )}
            </div>
        </div>
    );
};

export default ManageBadges; 