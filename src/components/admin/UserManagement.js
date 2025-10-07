import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { toast } from 'react-hot-toast';
import { adminAPI } from '../../services/apiClient';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../../styles/b_admin_styling.css';
import './AdminForms.css';
import './AdminTables.css';
import './AdminLayout.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BAdminTable from './ui/BAdminTable';
import BLoading from './ui/BLoading';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';

const UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [error, setError] = useState(null);
    const [businessNames, setBusinessNames] = useState({});
    const [openMenuId, setOpenMenuId] = useState(null);

    useEffect(() => {
        fetchAllUsers();
    }, []);

    const fetchAllUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('Fetching users...');
            const usersResponse = await adminAPI.getAllUsers();
            console.log('Users response:', usersResponse.data);
            const fetchedUsers = usersResponse.data.users || [];
            setUsers(fetchedUsers);

            const adminsResponse = await adminAPI.getAllSuperAdmins();
            console.log('Admins response:', adminsResponse.data);
            setAdmins(adminsResponse.data.admins || []);

            // Fetch business names for all business admins
            const businessIds = [...new Set(fetchedUsers.map(u => u.business_id).filter(id => id != null))];
            if (businessIds.length > 0) {
                try {
                    // This assumes an endpoint getBusinessNames is added to your adminAPI client
                    console.log('Requesting business names for IDs:', businessIds);
                    const namesResponse = await adminAPI.getBusinessNames({ ids: businessIds });
                    setBusinessNames(namesResponse.data.names || {});
                    console.log('Fetched business names:', namesResponse.data.names);
                } catch (nameError) {
                    console.error('Could not fetch business names:', nameError);
                    toast.error('Could not load some business names.');
                }
            }
            
            if (fetchedUsers.length === 0 && (adminsResponse.data.admins || []).length === 0) {
                toast.info('No users found in the system');
            } else {
                toast.success(`Loaded ${fetchedUsers.length} users and ${(adminsResponse.data.admins || []).length} admins`);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch users. Please check your connection and try again.';
            toast.error(errorMessage);
            setError(errorMessage);
            setUsers([]);
            setAdmins([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (userId, userType, userName) => {
        try {
            if (userType === 'super_admin') {
                await adminAPI.deleteSuperAdmin(userId);
            } else {
                await adminAPI.deleteUser(userId);
            }
            
            toast.success(`${userType} "${userName}" deleted successfully`);
            fetchAllUsers(); // Refresh the list
        } catch (error) {
            console.error('Error deleting user:', error);
            const errorMessage = error.response?.data?.error || 'Failed to delete user';
            toast.error(errorMessage);
        }
    };

    const getAllUsers = () => {
        const allUsers = [
            ...admins.map(admin => ({ ...admin, userType: 'super_admin' })),
            ...users.map(user => ({ ...user, userType: user.role || 'user' }))
        ];
        return allUsers;
    };

    const getFilteredUsers = () => {
        let filteredUsers = [];
        
        switch (activeTab) {
            case 'super_admins':
                filteredUsers = admins.map(admin => ({ ...admin, userType: 'super_admin' }));
                break;
            case 'business_admins':
                filteredUsers = users.filter(user => user.role === 'business_admin')
                    .map(user => ({ ...user, userType: 'business_admin' }));
                break;
            case 'users':
                filteredUsers = users.filter(user => user.role === 'user' || !user.role)
                    .map(user => ({ ...user, userType: 'user' }));
                break;
            default:
                filteredUsers = getAllUsers();
        }

        // Apply search filter
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(user =>
                (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Apply sorting
        filteredUsers.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];
            
            if (sortBy === 'created_at') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return filteredUsers;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRoleBadgeClass = (userType) => {
        switch (userType) {
            case 'super_admin':
                return 'badge-super-admin';
            case 'business_admin':
                return 'badge-business-admin';
            case 'user':
                return 'badge-user';
            default:
                return 'badge-default';
        }
    };

    const getAddButtonConfig = () => {
        switch (activeTab) {
            case 'business_admins':
                return {
                    text: 'Add Business Admin',
                    icon: 'ri-building-line',
                    onClick: () => navigate('/admin/business-admin/new')
                };
            case 'super_admins':
                return {
                    text: 'Add Super Admin',
                    icon: 'ri-user-add-line',
                    onClick: () => navigate('/admin/register')
                };
            case 'users':
                // Regular users can create their own accounts via sign-up,
                // so we don't show an add button for this tab
                return null;
            default:
                return {
                    text: 'Add Super Admin',
                    icon: 'ri-user-add-line',
                    onClick: () => navigate('/admin/register')
                };
        }
    };

    const buttonConfig = getAddButtonConfig();
    const filteredUsers = getFilteredUsers();

    if (isLoading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 user-management-page b_admin_styling-main">
                    <BLoading variant="page" label="Loading users..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 user-management-page b_admin_styling-main">
                <div className="dashboard-header">
                    <h1 className="chat-title">User Management</h1>
                    <p className="chat-subtitle">Manage all users, business admins, and super admins in the system.</p>
                </div>

                {error && (
                    <div className="error-container" style={{ 
                        background: '#ffebee', 
                        border: '1px solid #f44336', 
                        borderRadius: '8px', 
                        padding: '15px', 
                        margin: '20px 0', 
                        color: '#d32f2f' 
                    }}>
                        <p style={{ margin: '0 0 10px 0', fontWeight: '500' }}>Error: {error}</p>
                        <button 
                            onClick={fetchAllUsers} 
                            className="dashboard-button primary"
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            <i className="ri-refresh-line"></i> Retry
                        </button>
                    </div>
                )}

                <div className="user-management-controls">
                    <div className="tabs-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <button 
                            className={`nawa2button ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All Users ({getAllUsers().length})
                        </button>
                        <button 
                            className={`nawa2button ${activeTab === 'super_admins' ? 'active' : ''}`}
                            onClick={() => setActiveTab('super_admins')}
                        >
                            Super Admins ({admins.length})
                        </button>
                        <button 
                            className={`nawa2button ${activeTab === 'business_admins' ? 'active' : ''}`}
                            onClick={() => setActiveTab('business_admins')}
                        >
                            Business Admins ({users.filter(u => u.role === 'business_admin').length})
                        </button>
                        <button 
                            className={`nawa2button ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            Regular Users ({users.filter(u => u.role === 'user' || !u.role).length})
                        </button>
                    </div>

                    <BFilterBar>
                        <BFilterControl label="Search" htmlFor="userSearch">
                            <BSearchInput
                                id="userSearch"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search users by name, username, or email..."
                            />
                        </BFilterControl>
                        <BFilterControl label="Sort By" htmlFor="sortBy">
                            <select 
                                id="sortBy"
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value)}
                                className="b_admin_styling-select b_admin_styling-select--compact"
                            >
                                <option value="created_at">Created Date</option>
                                <option value="name">Name</option>
                                <option value="email">Email</option>
                                <option value="userType">Role</option>
                            </select>
                        </BFilterControl>
                        <BFilterControl label="Order" htmlFor="sortOrder">
                            <BButton size="sm" variant="secondary" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                            </BButton>
                        </BFilterControl>
                        {buttonConfig && (
                            <BButton onClick={buttonConfig.onClick} variant="primary" size="sm">
                                <i className={buttonConfig.icon}></i>
                                {buttonConfig.text}
                            </BButton>
                        )}
                    </BFilterBar>
                </div>

                <BAdminTable headers={["Name","Username","Email","Role","Business","Created","Actions"]}>
                    {filteredUsers.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No users found matching your criteria.</td></tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={`${user.userType}-${user.id}`}>
                                <td>
                                    <Link to="#" className="b_admin_styling-table__link" onClick={(e)=>e.preventDefault()}>
                                        {user.name || 'N/A'}
                                    </Link>
                                </td>
                                <td>{user.username || 'N/A'}</td>
                                <td>
                                    <a href={`mailto:${user.email}`} className="b_admin_styling-table__link">{user.email}</a>
                                </td>
                                <td>{user.userType.replace('_', ' ').toUpperCase()}</td>
                                <td>
                                    {user.business_id ? (
                                        <span title={`Business ID: ${user.business_id}`}>
                                            {businessNames[user.business_id] || `ID: ${user.business_id}`}
                                        </span>
                                    ) : (
                                        <span>N/A</span>
                                    )}
                                </td>
                                <td>{formatDate(user.created_at)}</td>
                                <td className="b_admin_styling-table__actions">
                                    <BKebabMenu
                                        isOpen={openMenuId === user.id}
                                        onToggle={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                        items={[{ label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => handleDeleteUser(user.id, user.userType, user.name || user.username) }]}
                                    />
                                </td>
                            </tr>
                        ))
                    )}
                </BAdminTable>
            </div>
        </div>
    );
};

export default UserManagement; 