import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { businessAPI, questAPI } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';
import { toast } from 'react-hot-toast';
import './BusinessQuestsPanel.css';

const BusinessQuestsPanel = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const { 
        business, 
        questCredits, 
        canCreateQuests, 
        monthlyQuestLimit, 
        monthlyQuestsUsed, 
        questCreditsPurchased, 
        tierInfo, 
        isSuperAdmin 
    } = useBusiness();
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        entriesPerPage: 5,
        totalEntries: 0
    });
    const [filters, setFilters] = useState({
        search: '',
        include_archived: false
    });

    useEffect(() => {
        if (businessId) {
            fetchQuests();
        }
    }, [businessId, filters]);

    const fetchQuests = async () => {
        try {
            setLoading(true);
            
            // Fetch quests for this business
            const response = await questAPI.getBusinessQuests(businessId, {
                ...filters,
                page: pagination.currentPage,
                per_page: pagination.entriesPerPage
            });
            
            const questsData = response.data.quests || [];
            const totalCount = response.data.total || questsData.length;
            
            // Sort quests by created_at descending (newest first)
            const sortedQuests = questsData.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA;
            });
            
            setQuests(sortedQuests);
            setPagination(prev => ({
                ...prev,
                totalEntries: totalCount,
                totalPages: Math.ceil(totalCount / prev.entriesPerPage)
            }));
            
        } catch (error) {
            console.error('Error fetching quests:', error);
            toast.error('Failed to load quests');
            setQuests([]);
        } finally {
            setLoading(false);
        }
    };

    const [stats, setStats] = useState({
        totalQuests: 0,
        newQuestsThisMonth: monthlyQuestsUsed || 0,
        deletedQuests: 0,
        usersCompleted: 0,
        avgUsersPerCompleted: 0,
        avgUsersPerClicked: 0
    });

    useEffect(() => {
        // Update stats when quests data changes
        const totalQuests = quests.length;
        const completedQuests = quests.filter(q => q.completion_count > 0);
        const totalCompletions = quests.reduce((sum, q) => sum + (q.completion_count || 0), 0);
        
        setStats(prev => ({
            ...prev,
            totalQuests,
            newQuestsThisMonth: monthlyQuestsUsed || 0,
            usersCompleted: totalCompletions,
            avgUsersPerCompleted: completedQuests.length > 0 ? Math.round(totalCompletions / completedQuests.length) : 0,
            avgUsersPerClicked: totalQuests > 0 ? Math.round(totalCompletions / totalQuests) : 0
        }));
    }, [quests, monthlyQuestsUsed]);

    const handleAddQuest = () => {
        if (!canCreateQuests && !isSuperAdmin) {
            const tierAllowsQuests = tierInfo?.can_create_quests || false;
            const hasLegacyLimit = monthlyQuestLimit > 0;
            const hasQuestCapability = tierAllowsQuests || hasLegacyLimit;
            
            if (!hasQuestCapability) {
                toast.error('Quest creation is not available in your current tier. Please upgrade to create quests or purchase quest credits.');
                return;
            } else {
                toast.error('No quest creation credits available. Please purchase quest credits or wait for your monthly refresh.');
                return;
            }
        }
        
        navigate(`/admin/business/${businessId}/quests/new`);
    };

    const handleEditQuest = (questId) => {
        navigate(`/admin/business/${businessId}/quests/${questId}/edit`);
    };

    const handleDeleteQuest = async (questId) => {
        if (!window.confirm('Are you sure you want to delete this quest? This action cannot be undone.')) {
            return;
        }

        try {
            await questAPI.deleteBusinessQuest(businessId, questId, { force: true });
            toast.success('Quest deleted successfully');
            fetchQuests(); // Refresh the list
        } catch (error) {
            console.error('Error deleting quest:', error);
            toast.error('Failed to delete quest');
        }
    };

    const handleFilterChange = (newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    };

    const handleSearch = (searchTerm) => {
        setFilters(prev => ({ ...prev, search: searchTerm }));
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, currentPage: newPage }));
    };

    const getQuestTypeLabel = (type) => {
        const typeMap = {
            'FOLLOW_X_PAGE': 'Follow Page',
            'LIKE_X_POST': 'Like Post',
            'SHARE_X_POST': 'Share Post',
            'COMMENT_X_POST': 'Comment Post',
            'VISIT_WEBSITE': 'Visit Website',
            'CLICK_VERIFY': 'Click to Verify',
            'SCREENSHOT_VERIFY': 'Screenshot Upload'
        };
        return typeMap[type] || type?.replace(/_/g, ' ') || 'Unknown';
    };

    const getStatusBadge = (quest) => {
        if (quest.is_published) {
            return <span className="type-badge published">Published</span>;
        }
        
        const approvalStatus = quest.approval_status || 'PENDING';
        return (
            <span className={`type-badge approval-${approvalStatus.toLowerCase()}`}>
                {approvalStatus}
            </span>
        );
    };

    const renderQuestCreditsInfo = () => {
        if (isSuperAdmin) return null;
        
        const tierAllowsQuests = tierInfo?.can_create_quests || false;
        const hasLegacyLimit = monthlyQuestLimit > 0;
        const hasQuestCapability = tierAllowsQuests || hasLegacyLimit;
        const remainingMonthly = Math.max(0, monthlyQuestLimit - monthlyQuestsUsed);
        
        const isNearLimit = questCredits <= 2 && questCredits > 0;
        const isAtLimit = questCredits === 0;
        
        return (
            <div className={`quest-credits-card ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
                <div className="credits-header">
                    <h3>Quest Creation Credits</h3>
                    <span className="credits-counter">{questCredits === Infinity ? '∞' : questCredits}</span>
                </div>
                <div className="credits-breakdown">
                    {hasQuestCapability ? (
                        <>
                            <div className="credit-item">
                                <span className="credit-label">
                                    Monthly Allowance ({tierAllowsQuests ? (tierInfo?.name || 'Unknown') : 'Legacy'}):
                                </span>
                                <span className="credit-value">{remainingMonthly} / {monthlyQuestLimit}</span>
                            </div>
                            {questCreditsPurchased > 0 && (
                                <div className="credit-item">
                                    <span className="credit-label">Purchased Credits:</span>
                                    <span className="credit-value">{questCreditsPurchased}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="credit-item">
                            <span className="credit-label">Purchased Credits Only:</span>
                            <span className="credit-value">{questCreditsPurchased}</span>
                        </div>
                    )}
                </div>
                
                {!hasQuestCapability && (
                    <div className="credits-warning">
                        <i className="ri-alert-fill"></i>
                        Your tier doesn't include quest creation. Purchase quest credits or upgrade your tier to create quests.
                    </div>
                )}
                {isAtLimit && hasQuestCapability && (
                    <div className="credits-warning">
                        <i className="ri-alert-fill"></i>
                        No quest creation credits remaining. Purchase more credits or wait for your monthly refresh.
                    </div>
                )}
                {isNearLimit && (
                    <div className="credits-warning near">
                        <i className="ri-information-fill"></i>
                        You're running low on quest creation credits.
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="main-content">
                    <p>Loading quests panel...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="quests-panel-container">
            <Sidebar />
            
            <div className="main-content-panel">
                {renderQuestCreditsInfo()}
                
                {/* Stats Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>Total Quests</h3>
                        <div className="stat-number">{stats.totalQuests}</div>
                    </div>
                    <div className="stat-card">
                        <h3>New Quests (this month)</h3>
                        <div className="stat-number">{stats.newQuestsThisMonth}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Deleted Quests</h3>
                        <div className="stat-number">{stats.deletedQuests}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Number of users who completed the quests</h3>
                        <div className="stat-number">{stats.usersCompleted}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Average number of users per completed quests</h3>
                        <div className="stat-number">{stats.avgUsersPerCompleted}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Average number of users per clicked quests</h3>
                        <div className="stat-number">{stats.avgUsersPerClicked}</div>
                    </div>
                </div>

                {/* Table Controls */}
                <div className="table-controls">
                    <div className="left-controls">
                        <span>Show</span>
                        <select 
                            className="entries-select"
                            value={pagination.entriesPerPage}
                            onChange={(e) => {
                                const newPerPage = parseInt(e.target.value);
                                setPagination(prev => ({
                                    ...prev,
                                    entriesPerPage: newPerPage,
                                    currentPage: 1,
                                    totalPages: Math.ceil(prev.totalEntries / newPerPage)
                                }));
                            }}
                        >
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="25">25</option>
                        </select>
                        <span>Entries</span>
                    </div>
                    
                    <div className="right-controls">
                        <button className="filter-btn" onClick={() => handleFilterChange({ include_archived: !filters.include_archived })}>
                            {filters.include_archived ? '📁 Hide Archived' : '📁 Show Archived'}
                        </button>
                        <input 
                            type="text" 
                            placeholder="Search quests..." 
                            className="search-input"
                            value={filters.search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        <button 
                            className={`add-btn ${(!canCreateQuests && !isSuperAdmin) ? 'disabled' : ''}`}
                            onClick={handleAddQuest}
                            disabled={!canCreateQuests && !isSuperAdmin}
                            title={(!canCreateQuests && !isSuperAdmin) ? 'Quest creation credits required' : 'Add Quest'}
                        >
                            + Add
                        </button>
                    </div>
                </div>

                {/* Quests Table */}
                <div className="quests-table-container">
                    {loading ? (
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            height: '200px',
                            color: '#888'
                        }}>
                            Loading quests...
                        </div>
                    ) : (
                        <>
                            <table className="quests-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>URL</th>
                                        <th>Completions</th>
                                        <th>XP Reward</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quests.map((quest) => (
                                        <tr key={quest.id}>
                                            <td className="quest-title">{quest.title}</td>
                                            <td>
                                                <span className="type-badge type-quest">
                                                    {getQuestTypeLabel(quest.quest_type)}
                                                </span>
                                            </td>
                                            <td>
                                                {getStatusBadge(quest)}
                                            </td>
                                            <td className="quest-url">
                                                {quest.target_url ? (
                                                    <a href={quest.target_url} target="_blank" rel="noopener noreferrer">
                                                        {quest.target_url.length > 40 ? 
                                                            quest.target_url.substring(0, 40) + '...' : 
                                                            quest.target_url
                                                        }
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#888' }}>No URL</span>
                                                )}
                                            </td>
                                            <td className="stat-cell">{quest.completion_count || 0}</td>
                                            <td className="stat-cell">{quest.xp_reward || 100} XP</td>
                                            <td className="stat-cell">
                                                {quest.created_at ? 
                                                    new Date(quest.created_at).toLocaleDateString() : 
                                                    'N/A'
                                                }
                                            </td>
                                            <td className="actions-cell">
                                                {/* Don't show edit button for business admin as per requirements */}
                                                <button 
                                                    className="action-btn delete-btn"
                                                    onClick={() => handleDeleteQuest(quest.id)}
                                                    title="Delete quest"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {quests.length === 0 && (
                                <div style={{ 
                                    textAlign: 'center', 
                                    padding: '40px',
                                    color: '#888'
                                }}>
                                    <h3>No Quests Found</h3>
                                    <p>
                                        {filters.search ? 
                                            'Try adjusting your search criteria.' : 
                                            'Create your first quest to get started!'
                                        }
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Pagination */}
                <div className="pagination-container">
                    <div className="pagination-info">
                        Showing {Math.min((pagination.currentPage - 1) * pagination.entriesPerPage + 1, pagination.totalEntries)}-{Math.min(pagination.currentPage * pagination.entriesPerPage, pagination.totalEntries)} out of {pagination.totalEntries} entries
                    </div>
                    <div className="pagination-controls">
                        <button 
                            className="pagination-btn"
                            disabled={pagination.currentPage === 1}
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                        >
                            Prev
                        </button>
                        {Array.from({ length: pagination.totalPages }, (_, i) => (
                            <button
                                key={i + 1}
                                className={`pagination-btn ${pagination.currentPage === i + 1 ? 'active' : ''}`}
                                onClick={() => handlePageChange(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button 
                            className="pagination-btn"
                            disabled={pagination.currentPage === pagination.totalPages}
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* User Profile */}
            <div className="user-profile">
                <div className="profile-avatar">
                    <img src="/api/placeholder/40/40" alt="Profile" />
                </div>
                <div className="profile-info">
                    <div className="profile-name">Business Super Admin</div>
                    <div className="profile-email">superadmin@gmail.com</div>
                </div>
            </div>
        </div>
    );
};

export default BusinessQuestsPanel; 