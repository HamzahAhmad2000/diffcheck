import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { questAPI } from '../../services/apiClient';
import EditQuest from './EditQuest';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import '../../styles/QuestModal.css';
import './AdminTables.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BAdminTable from './ui/BAdminTable';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';
import { toast } from 'react-hot-toast';
import BLoading from './ui/BLoading';

const ManageQuests = ({ businessContext = null }) => {
  const navigate = useNavigate();
  
  // Extract business context
  const { businessId, businessName, fromBusinessManagement } = businessContext || {};
  
  const [quests, setQuests] = useState([]);
  const [questTypes, setQuestTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingQuest, setEditingQuest] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [filters, setFilters] = useState({
    include_archived: false,
    admin_only: false,
    search: '',
    quest_type: '',
    is_published: '',
    is_featured: ''
  });
  const [searchInput, setSearchInput] = useState('');

  // Debounce search input to avoid fetching on every key press
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch quests whenever filters change
  useEffect(() => {
    fetchQuests();
  }, [filters]);

  // Fetch quest types once on mount
  useEffect(() => {
    fetchQuestTypes();
  }, []);

  const fetchQuests = async () => {
    try {
      setLoading(true);
      let response;
      
      if (fromBusinessManagement && businessId) {
        // Business admin context - fetch quests for this business
        response = await questAPI.getBusinessQuests(businessId, filters);
      } else {
        // Super admin context - fetch all quests
        response = await questAPI.adminGetAllQuests(filters);
      }
      
      setQuests(response.data.quests || []);
      setError('');
    } catch (err) {
      console.error('Error fetching quests:', err);
      setError('Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestTypes = async () => {
    try {
      const response = await questAPI.getQuestTypes();
      setQuestTypes(response.data.quest_types || []);
    } catch (err) {
      console.error('Error fetching quest types:', err);
    }
  };

  const handleDeleteQuest = async (questId) => {
    try {
      if (fromBusinessManagement && businessId) {
        // Business admin context - always allow deletion with force flag
        await questAPI.deleteBusinessQuest(businessId, questId, { force: true });
      } else {
        await questAPI.adminDeleteQuest(questId);
      }
      await fetchQuests();
      toast.success('Quest deleted successfully');
    } catch (err) {
      console.error('Error deleting quest:', err);
      const errorMessage = err.response?.data?.error || 'Failed to delete quest';
      toast.error(errorMessage);
    }
  };

  const handlePublishToggle = async (quest) => {
    try {
      // Only super admins can publish/unpublish quests
      if (fromBusinessManagement && businessId) {
        alert('Business admins cannot publish quests directly. Quests must be approved by super admin first.');
        return;
      }
      
      if (quest.is_published) {
        await questAPI.adminUnpublishQuest(quest.id);
      } else {
        await questAPI.adminPublishQuest(quest.id);
      }
      await fetchQuests();
    } catch (err) {
      console.error('Error toggling quest publish status:', err);
      alert('Failed to update quest status');
    }
  };

  const handleFeatureToggle = async (quest) => {
    try {
      if (fromBusinessManagement && businessId) {
        // Feature toggle might not be available for business admin - check if API exists
        // For now, we'll disable this for business admin context
        alert('Feature toggle is only available for super admin');
        return;
      } else {
        await questAPI.adminFeatureQuest(quest.id, !quest.is_featured);
      }
      await fetchQuests();
    } catch (err) {
      console.error('Error toggling quest feature status:', err);
      alert('Failed to update quest feature status');
    }
  };

  // Filter and sort quests based on tab, search, and filters
  const filteredQuests = quests
    .filter(quest => {
      const searchMatch = !filters.search || 
        quest.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
        quest.description?.toLowerCase().includes(filters.search.toLowerCase());
      
      const typeMatch = !filters.quest_type || quest.quest_type === filters.quest_type;
      const publishMatch = filters.is_published === '' || 
        quest.is_published.toString() === filters.is_published;
      const featureMatch = filters.is_featured === '' || 
        quest.is_featured.toString() === filters.is_featured;

      return searchMatch && typeMatch && publishMatch && featureMatch;
    })
    .sort((a, b) => {
      // Sort by created_at descending (newest first)
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getQuestTypeLabel = (type) => {
    const questType = questTypes.find(qt => qt.value === type);
    return questType ? questType.label : type;
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading quests..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page">
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="b_admin_styling-title">
              Quest Management
              {fromBusinessManagement && businessName && (
                <span style={{ fontSize: '16px', color: '#888', fontWeight: 'normal', marginLeft: '10px' }}>
                  for {businessName}
                </span>
              )}
            </h1>
            <p className="chat-subtitle">
              {fromBusinessManagement 
                ? 'Create and manage quests for your business' 
                : 'Create and manage quests for users'
              }
            </p>
          </div>
          <BButton 
            variant="primary" 
            size="sm"
            onClick={() => {
              if (fromBusinessManagement && businessId) {
                navigate(`/admin/business/${businessId}/quests/new`);
              } else {
                navigate('/admin/quests/create');
              }
            }}
          >
            <i className="ri-add-line"></i> Create New Quest
          </BButton>
        </div>

        {/* Filters - switch to compact reusable components only */}
        <BFilterBar>
          <BFilterControl label="Search" htmlFor="questSearch">
            <BSearchInput id="questSearch" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search quests..." />
          </BFilterControl>
          <BFilterControl label="Type" htmlFor="questType">
            <select id="questType" value={filters.quest_type} onChange={(e) => setFilters({...filters, quest_type: e.target.value})} className="b_admin_styling-select b_admin_styling-select--compact">
              <option value="">All Types</option>
              {questTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label} ({type.category})</option>
              ))}
            </select>
          </BFilterControl>
          <BFilterControl label="Publish" htmlFor="publish">
            <select id="publish" value={filters.is_published} onChange={(e) => setFilters({...filters, is_published: e.target.value})} className="b_admin_styling-select b_admin_styling-select--compact">
              <option value="">All Status</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </BFilterControl>
          {!fromBusinessManagement && (
            <BFilterControl label="Featured" htmlFor="featured">
              <select id="featured" value={filters.is_featured} onChange={(e) => setFilters({...filters, is_featured: e.target.value})} className="b_admin_styling-select b_admin_styling-select--compact">
                <option value="">All Featured</option>
                <option value="true">Featured</option>
                <option value="false">Not Featured</option>
              </select>
            </BFilterControl>
          )}
        </BFilterBar>

        {/* Quests Table - use reusable table and kebab actions only */}
        <BAdminTable headers={["Title","Type","Business","Status", ...(fromBusinessManagement? ["Approval"]:[]), "Completions","XP Reward","Created","Actions"]}>
          {filteredQuests.length === 0 ? (
            <tr>
              <td colSpan={fromBusinessManagement ? 9 : 8} className="admin-empty-state">
                <i className="ri-treasure-map-line"></i>
                <h3>No Quests Found</h3>
                <p>Create your first quest to get users engaged.</p>
              </td>
            </tr>
          ) : (
            filteredQuests.map((quest) => (
              <tr key={quest.id}>
                <td>
                  <strong>{quest.title}</strong>
                  {quest.is_featured && (
                    <span className="b_admin_styling-badge" style={{ marginLeft: 8 }}>
                      <i className="ri-star-fill"></i>
                      Featured
                    </span>
                  )}
                </td>
                <td>{getQuestTypeLabel(quest.quest_type)}</td>
                <td>{quest.business_name || (quest.business_id ? `Business #${quest.business_id}` : 'Global')}</td>
                <td>
                  <BStatusBadge type={quest.is_published ? 'approved' : 'pending'}>
                    {quest.is_published ? 'Published' : 'Draft'}
                  </BStatusBadge>
                </td>
                {fromBusinessManagement && (
                  <td>
                    <BStatusBadge type={quest.approval_status === 'APPROVED' ? 'approved' : quest.approval_status === 'REJECTED' ? 'inactive' : 'pending'}>
                      {quest.approval_status || 'PENDING'}
                    </BStatusBadge>
                  </td>
                )}
                <td>{quest.completion_count || 0}</td>
                <td>{quest.xp_reward} XP</td>
                <td>{formatDate(quest.created_at)}</td>
                <td className="b_admin_styling-table__actions">
                  <BKebabMenu
                    isOpen={openMenuId === quest.id}
                    onToggle={() => setOpenMenuId(openMenuId === quest.id ? null : quest.id)}
                    items={[
                      ...(!fromBusinessManagement ? [{ label: 'Edit', icon: 'ri-edit-line', onClick: () => setEditingQuest(quest) }] : []),
                      ...(!fromBusinessManagement ? [{ label: quest.is_published ? 'Unpublish' : 'Publish', icon: quest.is_published ? 'ri-eye-off-line' : 'ri-eye-line', onClick: () => handlePublishToggle(quest) }] : []),
                      ...(!fromBusinessManagement ? [{ label: quest.is_featured ? 'Unfeature' : 'Feature', icon: quest.is_featured ? 'ri-star-fill' : 'ri-star-line', onClick: () => handleFeatureToggle(quest) }] : []),
                      { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => handleDeleteQuest(quest.id) },
                    ]}
                  />
                </td>
              </tr>
            ))
          )}
        </BAdminTable>

        {/* Edit Quest Modal */}
        {editingQuest && (
          <div className="quest-modal-backdrop">
            <div className="quest-modal-content">
              <div className="quest-modal-header">
                <h2>Edit Quest</h2>
                <button className="quest-modal-close" onClick={() => setEditingQuest(null)}>×</button>
              </div>
              <div className="quest-modal-body">
                <EditQuest
                  quest={editingQuest}
                  questTypes={questTypes}
                  isAdmin={!fromBusinessManagement}
                  businessContext={fromBusinessManagement ? { businessId, businessName } : null}
                  onSuccess={() => {
                    setEditingQuest(null);
                    fetchQuests();
                  }}
                  onCancel={() => setEditingQuest(null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageQuests; 