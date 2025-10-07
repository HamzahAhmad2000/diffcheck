import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { businessTierAPI } from '../../services/apiClient';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BKebabMenu from './ui/BKebabMenu';
import BPackageFormModal from './ui/BPackageFormModal';
import BLoading from './ui/BLoading';

const ManageBusinessTiers = () => {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [tierStats, setTierStats] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    monthly_response_limit: '',
    monthly_quest_limit: '',
    admin_seat_limit: '',
    ai_points_included: '',
    can_use_ai_builder: true,
    can_use_ai_insights: true,
    can_create_surveys: true,
    can_generate_responses: true,
    can_request_featured: false,
    display_order: '',
    is_active: true
  });

  useEffect(() => {
    fetchTiers();
    fetchTierStats();
  }, [includeInactive]);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const response = await businessTierAPI.adminGetAllTiers(includeInactive);
      setTiers(response.data.tiers || []);
    } catch (error) {
      toast.error('Failed to fetch business tiers');
      console.error('Error fetching tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTierStats = async () => {
    try {
      const response = await businessTierAPI.adminGetTierStats();
      setTierStats(response.data);
    } catch (error) {
      console.error('Error fetching tier stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTier) {
        await businessTierAPI.adminUpdateTier(editingTier.id, formData);
        toast.success('Business tier updated successfully');
      } else {
        await businessTierAPI.adminCreateTier(formData);
        toast.success('Business tier created successfully');
      }
      
      setShowCreateModal(false);
      setEditingTier(null);
      resetForm();
      fetchTiers();
      fetchTierStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save business tier');
    }
  };

  const handleEdit = (tier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description || '',
      price: tier.price,
      monthly_response_limit: tier.monthly_response_limit,
      monthly_quest_limit: tier.monthly_quest_limit,
      admin_seat_limit: tier.admin_seat_limit,
      ai_points_included: tier.ai_points_included,
      can_use_ai_builder: tier.can_use_ai_builder,
      can_use_ai_insights: tier.can_use_ai_insights,
      can_create_surveys: tier.can_create_surveys,
      can_generate_responses: tier.can_generate_responses,
      can_request_featured: tier.can_request_featured,
      display_order: tier.display_order,
      is_active: tier.is_active
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (tierId) => {
    try {
      await businessTierAPI.adminDeleteTier(tierId);
      toast.success('Business tier deleted successfully');
      setDeleteConfirm(null);
      fetchTiers();
      fetchTierStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete business tier');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      monthly_response_limit: '',
      monthly_quest_limit: '',
      admin_seat_limit: '',
      ai_points_included: '',
      can_use_ai_builder: true,
      can_use_ai_insights: true,
      can_create_surveys: true,
      can_generate_responses: true,
      can_request_featured: false,
      display_order: '',
      is_active: true
    });
  };

  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatPrice = (price) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page b_admin_styling-main">
          <BLoading variant="page" label="Loading business tiers..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page b_admin_styling-main">
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="b_admin_styling-title">Manage Business Tiers</h1>
            <p className="chat-subtitle">Create and manage subscription tiers for businesses</p>
          </div>
          <BButton variant="primary" size="sm" onClick={() => { resetForm(); setEditingTier(null); setShowCreateModal(true); }}>
            <i className="ri-add-line"></i> Create New Tier
          </BButton>
        </div>

        {/* Statistics Cards */}
        {tierStats && (
          <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-stack-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{tierStats.tier_statistics?.length || 0}</h3>
                <p>Active Tiers</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-building-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{tierStats.total_businesses || 0}</h3>
                <p>Total Businesses</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <BFilterBar>
          <BFilterControl label="Include inactive" htmlFor="tierIncludeInactive">
            <label className="admin-checkbox" style={{ display: 'inline-flex', alignItems: 'center', margin: 0 }}>
              <input id="tierIncludeInactive" type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            <span className="checkmark"></span>
            Include inactive tiers
          </label>
          </BFilterControl>
        </BFilterBar>

        {/* Tiers Table */}
        <div className="admin-table-container">
          <table className="b_admin_styling-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Responses</th>
                <th>Quests</th>
                <th>Admin Seats</th>
                <th>AI Points</th>
                <th>Features</th>
                <th>Businesses</th>
                <th>Status</th>
                <th className="b_admin_styling-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const businessCount = tierStats?.tier_statistics?.find(
                  stat => stat.tier_id === tier.id
                )?.business_count || 0;

                return (
                  <tr key={tier.id}>
                    <td>
                      <div className="tier-name" style={{ color : "#000000" }}>
                        <strong>{tier.name}</strong>
                        {tier.description && (
                          <div className="tier-description">{tier.description}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="price-badge">{formatPrice(tier.price)}</span>
                      {tier.price === 0 && <span className="free-badge">FREE</span>}
                    </td>
                    <td>{tier.monthly_response_limit.toLocaleString()}</td>
                    <td>{tier.monthly_quest_limit}</td>
                    <td>{tier.admin_seat_limit}</td>
                    <td>{tier.ai_points_included}</td>
                    <td>
                      <div className="feature-badges">
                        {tier.can_use_ai_builder && <span className="feature-badge">AI Builder</span>}
                        {tier.can_use_ai_insights && <span className="feature-badge">AI Insights</span>}
                        {tier.can_request_featured && <span className="feature-badge">Featured</span>}
                      </div>
                    </td>
                    <td>
                      <span className="business-count">{businessCount}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${tier.is_active ? 'active' : 'inactive'}`}>
                        {tier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="b_admin_styling-table__actions">
                      <BKebabMenu
                        isOpen={openMenuId === tier.id}
                        onToggle={() => setOpenMenuId(openMenuId === tier.id ? null : tier.id)}
                        items={[
                          { label: 'Edit', icon: 'ri-edit-line', onClick: () => { setOpenMenuId(null); handleEdit(tier); } },
                          { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); setDeleteConfirm(tier); } },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {tiers.length === 0 && (
            <div className="admin-empty-state">
              <i className="ri-stack-line"></i>
              <h3>No Business Tiers Found</h3>
              <p>Create your first business tier to get started.</p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <BPackageFormModal
            isOpen={showCreateModal}
            title={editingTier ? 'Edit Business Tier' : 'Create New Business Tier'}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleSubmit}
            submitLabel={editingTier ? 'Update Tier' : 'Create Tier'}
            submitting={false}
            values={formData}
            onChange={handleFieldChange}
            fields={[
              { name: 'name', label: 'Tier Name', type: 'text', required: true, placeholder: 'e.g., Starter, Professional, Enterprise' },
              { name: 'price', label: 'Price (in cents)', type: 'number', required: true, min: 0, placeholder: 'e.g., 2999 for $29.99' },
              { name: 'monthly_response_limit', label: 'Monthly Response Limit', type: 'number', min: 0, placeholder: 'e.g., 1000' },
              { name: 'monthly_quest_limit', label: 'Monthly Quest Limit', type: 'number', min: 0, placeholder: 'e.g., 5' },
              { name: 'admin_seat_limit', label: 'Admin Seat Limit', type: 'number', min: 1, placeholder: 'e.g., 1' },
              { name: 'ai_points_included', label: 'AI Points Included', type: 'number', min: 0, placeholder: 'e.g., 50' },
              { name: 'description', label: 'Description', type: 'textarea', placeholder: "Describe this tier's features and benefits" },
              { name: 'display_order', label: 'Display Order', type: 'number', min: 0, placeholder: 'e.g., 1' },
              { name: 'can_use_ai_builder', label: 'AI Survey Builder', type: 'checkbox', hint: 'Allow use of AI-powered survey creation tools' },
              { name: 'can_use_ai_insights', label: 'AI Insights & Analytics', type: 'checkbox', hint: 'Enable AI-powered analysis' },
              { name: 'can_create_surveys', label: 'Create Surveys', type: 'checkbox', hint: 'Basic survey creation capabilities' },
              { name: 'can_generate_responses', label: 'Generate Test Responses', type: 'checkbox', hint: 'AI-powered test response generation' },
              { name: 'can_request_featured', label: 'Featured Content Requests', type: 'checkbox', hint: 'Ability to request featured placement' },
              { name: 'is_active', label: 'Active Tier', type: 'checkbox', hint: 'Make this tier available for businesses' },
            ]}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{maxWidth: '500px', margin: '100px auto', padding: '30px', background: 'white', borderRadius: '8px'}}>
              <h3 style={{marginBottom: '15px'}}>Delete Business Tier</h3>
              <p style={{marginBottom: '25px'}}>
                Are you sure you want to delete the tier "<strong>{deleteConfirm.name}</strong>"? 
                This action cannot be undone.
              </p>
              <div className="form-actions" style={{justifyContent:'space-between'}}>
                <BButton variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</BButton>
                <BButton variant="danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete Tier</BButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageBusinessTiers; 