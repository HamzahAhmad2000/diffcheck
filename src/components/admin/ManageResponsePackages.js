import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import { responsePackageAPI } from '../../services/apiClient';
import './AdminForms.css';
import './AdminTables.css';
import './AdminLayout.css';
import '../../styles/b_admin_styling.css';
import AdminLayout from '../layouts/AdminLayout';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BKebabMenu from './ui/BKebabMenu';
import BAdminTable from './ui/BAdminTable';
import BStatusBadge from './ui/BStatusBadge';
import BPackageFormModal from './ui/BPackageFormModal';
import BLoading from './ui/BLoading';

const ManageResponsePackages = () => {
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    responses: '',
    price: '',
    display_order: 0,
    is_popular: false,
    is_active: true
  });

  useEffect(() => {
    fetchPackages();
    fetchStats();
  }, [includeInactive]);

  const fetchPackages = async () => {
    try {
      const response = await responsePackageAPI.adminGetAllPackages(includeInactive);
      setPackages(response.data.packages || []);
    } catch (error) {
      console.error('Error fetching response packages:', error);
      toast.error(error.response?.data?.error || 'Failed to load response packages');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await responsePackageAPI.adminGetPackageStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching package stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.responses || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingPackage) {
        await responsePackageAPI.adminUpdatePackage(editingPackage.id, formData);
        toast.success('Response package updated successfully');
      } else {
        await responsePackageAPI.adminCreatePackage(formData);
        toast.success('Response package created successfully');
      }
      
      setShowForm(false);
      resetForm();
      fetchPackages();
      fetchStats();
    } catch (error) {
      console.error('Error saving response package:', error);
      toast.error(error.response?.data?.error || 'Failed to save response package');
    }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      responses: pkg.responses.toString(),
      price: pkg.price.toString(),
      display_order: pkg.display_order,
      is_popular: pkg.is_popular,
      is_active: pkg.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (packageId) => {
    try {
      await responsePackageAPI.adminDeletePackage(packageId);
      toast.success('Response package deleted successfully');
      fetchPackages();
      fetchStats();
    } catch (error) {
      console.error('Error deleting response package:', error);
      toast.error(error.response?.data?.error || 'Failed to delete response package');
    }
  };

  const handleTogglePopular = async (packageId) => {
    try {
      await responsePackageAPI.adminTogglePopularStatus(packageId);
      toast.success('Package status updated successfully');
      fetchPackages();
    } catch (error) {
      console.error('Error updating package status:', error);
      toast.error(error.response?.data?.error || 'Failed to update package status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      responses: '',
      price: '',
      display_order: 0,
      is_popular: false,
      is_active: true
    });
    setEditingPackage(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 admin-table-page">
          <BLoading variant="page" label="Loading response packages..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 admin-table-page" >
        <div className="table-header-container">
          <div className="table-header">
            <h1 className="b_admin_styling-title">Manage Response Packages</h1>
            <p className="chat-subtitle">Configure response packages that businesses can purchase</p>
          </div>
          <BButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <i className="ri-add-line"></i> Create Response Package
          </BButton>
        </div>

        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-database-2-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{stats.total_packages}</h3>
                <p>Total Packages</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-checkbox-circle-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{stats.active_packages}</h3>
                <p>Active Packages</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <i className="ri-close-circle-line"></i>
              </div>
              <div className="admin-stat-content">
                <h3>{stats.inactive_packages}</h3>
                <p>Inactive Packages</p>
              </div>
            </div>
          </div>
        )}

        <BFilterBar>
          <BFilterControl label="Show inactive" htmlFor="respIncludeInactive">
            <label className="admin-checkbox" style={{ display: 'inline-flex', alignItems: 'center', margin: 0 }}>
              <input id="respIncludeInactive" type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              <span className="checkmark"></span>
              Show inactive packages
            </label>
          </BFilterControl>
        </BFilterBar>

        {showForm && (
          <BPackageFormModal
            isOpen={showForm}
            title={`${editingPackage ? 'Edit' : 'Create'} Response Package`}
            onClose={() => setShowForm(false)}
            onSubmit={handleSubmit}
            submitLabel={editingPackage ? 'Update Package' : 'Create Package'}
            submitting={false}
            values={formData}
            onChange={handleInputChange}
            fields={[
              { name: 'name', label: 'Package Name', type: 'text', required: true, placeholder: 'e.g., Small Package, Medium Package' },
              { name: 'display_order', label: 'Display Order', type: 'number', min: 0, placeholder: '0' },
              { name: 'description', label: 'Description', type: 'textarea', placeholder: "Brief description of the package" },
              { name: 'responses', label: 'Number of Responses', type: 'number', required: true, min: 1, placeholder: 'e.g., 5000' },
              { name: 'price', label: 'Price (in cents)', type: 'number', required: true, min: 0, placeholder: 'e.g., 1999 for $19.99' },
              { name: 'priceReadable', label: 'Price (readable)', type: 'calculated', render: (v) => `Price: $${((v.price || 0)/100).toFixed(2)}` },
              { name: 'is_popular', label: 'Popular Package', type: 'checkbox', hint: 'Mark as popular package' },
              { name: 'is_active', label: 'Package is active', type: 'checkbox' },
            ]}
          />
        )}

        <BAdminTable
          headers={[
            'Package Name',
            'Responses',
            'Price',
            'Per 1K Responses',
            'Order',
            'Status',
            'Actions',
          ]}
        >
          {packages.length === 0 ? (
            <tr>
              <td colSpan={7} className="admin-empty-state">
                <i className="ri-database-2-line"></i>
                <h3>No Response Packages Found</h3>
                <p>Create your first response package to get started.</p>
                <BButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
                  Create First Package
                </BButton>
              </td>
            </tr>
          ) : (
            packages.map((pkg) => (
              <tr key={pkg.id}>
                <td>
                  <div className="package-info">
                    <strong>{pkg.name}</strong>
                    {pkg.is_popular && (<span className="badge badge-star">Popular</span>)}
                    {pkg.description && (<div className="package-description">{pkg.description}</div>)}
                  </div>
                </td>
                <td className="responses-count">{pkg.responses.toLocaleString()}</td>
                <td className="price">${(pkg.price / 100).toFixed(2)}</td>
                <td className="price-per-k">${pkg.price_per_thousand}</td>
                <td>{pkg.display_order}</td>
                <td>
                  <BStatusBadge type={pkg.is_active ? 'active' : 'inactive'}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </BStatusBadge>
                </td>
                <td className="b_admin_styling-table__actions">
                  <BKebabMenu
                    isOpen={openMenuId === pkg.id}
                    onToggle={() => setOpenMenuId(openMenuId === pkg.id ? null : pkg.id)}
                    items={[
                      { label: 'Edit', icon: 'ri-edit-line', onClick: () => { setOpenMenuId(null); handleEdit(pkg); } },
                      { label: pkg.is_popular ? 'Unmark Popular' : 'Mark Popular', icon: 'ri-star-line', onClick: () => { setOpenMenuId(null); handleTogglePopular(pkg.id); } },
                      { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDelete(pkg.id); } },
                    ]}
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

export default ManageResponsePackages; 