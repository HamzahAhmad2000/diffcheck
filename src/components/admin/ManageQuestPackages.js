import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { questPackageAPI } from '../../services/apiClient';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BPackageFormModal from './ui/BPackageFormModal';
import BLoading from './ui/BLoading';

const ManageQuestPackages = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [packageStats, setPackageStats] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quest_credits: '',
    price: '',
    bonus_credits: '',
    is_popular: false,
    display_order: '',
    is_active: true
  });

  useEffect(() => {
    fetchPackages();
    fetchPackageStats();
  }, [includeInactive]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await questPackageAPI.adminGetAllPackages(includeInactive);
      // Fix: Handle both response.data.packages and response.packages for compatibility
      setPackages(response.data?.packages || response.packages || []);
    } catch (error) {
      toast.error('Failed to fetch quest packages');
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackageStats = async () => {
    try {
      // Note: Quest package stats endpoint might not exist yet, handle gracefully
      // const response = await questPackageAPI.adminGetPackageStats();
      // setPackageStats(response.data);
      setPackageStats({
        active_packages: packages.filter(p => p.is_active).length,
        total_purchases: 0 // Would come from backend
      });
    } catch (error) {
      console.error('Error fetching package stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        await questPackageAPI.adminUpdatePackage(editingPackage.id, formData);
        toast.success('Quest package updated successfully');
      } else {
        await questPackageAPI.adminCreatePackage(formData);
        toast.success('Quest package created successfully');
      }
      
      setShowCreateModal(false);
      setEditingPackage(null);
      resetForm();
      fetchPackages();
      fetchPackageStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save quest package');
    }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      quest_credits: pkg.quest_credits,
      price: pkg.price,
      bonus_credits: pkg.bonus_credits || '',
      is_popular: pkg.is_popular,
      display_order: pkg.display_order,
      is_active: pkg.is_active
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (packageId) => {
    try {
      await questPackageAPI.adminDeletePackage(packageId);
      toast.success('Quest package deleted successfully');
      setDeleteConfirm(null);
      fetchPackages();
      fetchPackageStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete quest package');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      quest_credits: '',
      price: '',
      bonus_credits: '',
      is_popular: false,
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
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading quest packages..." />
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
            <h1 className="b_admin_styling-title">Manage Quest Packages</h1>
            <p className="chat-subtitle">Create and manage quest credit packages</p>
          </div>
          <BButton
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setEditingPackage(null);
              setShowCreateModal(true);
            }}
          >
            <i className="ri-add-line"></i> Create New Package
          </BButton>
        </div>

        {/* Statistics Cards */}
        {packageStats && (
          <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-compass-3-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{packageStats.active_packages || 0}</h3>
                <p>Active Packages</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-shopping-cart-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{packageStats.total_purchases || 0}</h3>
                <p>Total Purchases</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <BFilterBar>
          <BFilterControl label="Include inactive" htmlFor="includeInactive">
            <label className="admin-checkbox" style={{ display: 'inline-flex', alignItems: 'center', margin: 0 }}>
              <input id="includeInactive" type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              <span className="checkmark"></span>
              Include inactive packages
            </label>
          </BFilterControl>
        </BFilterBar>

        {/* Packages Table */}
        <div className="admin-table-container">
          <table className="b_admin_styling-table">
            <thead>
              <tr>
                <th>Package Name</th>
                <th>Credits</th>
                <th>Price</th>
                <th>Bonus</th>
                <th>Value</th>
                <th>Status</th>
                <th className="b_admin_styling-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <div className="package-name">
                      <strong>{pkg.name}</strong>
                      {pkg.description && (
                        <div className="package-description">{pkg.description}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="credits-badge">{pkg.quest_credits.toLocaleString()}</span>
                  </td>
                  <td>
                    <span className="price-badge">{formatPrice(pkg.price)}</span>
                  </td>
                  <td>
                    {pkg.bonus_credits > 0 ? (
                      <span className="bonus-badge">+{pkg.bonus_credits.toLocaleString()}</span>
                    ) : (
                      <span className="no-bonus">None</span>
                    )}
                  </td>
                  <td>
                    <span className="value-display">
                      ${(pkg.price / 100 / (pkg.quest_credits + (pkg.bonus_credits || 0))).toFixed(3)} per credit
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${pkg.is_active ? 'active' : 'inactive'}`}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="b_admin_styling-table__actions">
                    <BButton size="sm" onClick={() => handleEdit(pkg)}>
                      <i className="ri-edit-line"></i> Edit
                    </BButton>
                    <BButton size="sm" variant="danger" onClick={() => setDeleteConfirm(pkg)}>
                      <i className="ri-delete-bin-line"></i> Delete
                    </BButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {packages.length === 0 && (
            <div className="admin-empty-state">
              <i className="ri-compass-3-line"></i>
              <h3>No Quest Packages Found</h3>
              <p>Create your first package to get started.</p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <BPackageFormModal
            isOpen={showCreateModal}
            title={editingPackage ? 'Edit Quest Package' : 'Create New Quest Package'}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleSubmit}
            submitLabel={editingPackage ? 'Update Package' : 'Create Package'}
            submitting={false}
            values={formData}
            onChange={handleFieldChange}
            fields={[
              { name: 'name', label: 'Package Name', type: 'text', required: true, placeholder: 'e.g., Quest Starter Pack' },
              { name: 'quest_credits', label: 'Quest Credits', type: 'number', required: true, min: 1, placeholder: 'e.g., 5' },
              { name: 'price', label: 'Price (in cents)', type: 'number', required: true, min: 0, placeholder: 'e.g., 999 for $9.99' },
              { name: 'bonus_credits', label: 'Bonus Credits', type: 'number', min: 0, placeholder: 'e.g., 1' },
              { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of this package' },
              { name: 'display_order', label: 'Display Order', type: 'number', min: 0, placeholder: 'e.g., 1' },
              { name: 'is_popular', label: 'Popular Package', type: 'checkbox', hint: 'Mark as Popular' },
              { name: 'is_active', label: 'Is Active', type: 'checkbox' },
            ]}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{maxWidth: '500px', margin: '100px auto', padding: '30px', background: 'white', borderRadius: '8px'}}>
              <h3 style={{marginBottom: '15px'}}>Delete Quest Package</h3>
              <p style={{marginBottom: '25px'}}>
                Are you sure you want to delete the package "<strong>{deleteConfirm.name}</strong>"? 
                This action cannot be undone.
              </p>
              <div className="form-actions" style={{justifyContent:'space-between'}}>
                <BButton variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</BButton>
                <BButton variant="danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete Package</BButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageQuestPackages; 