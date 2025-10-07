import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import { businessAPI } from '../../services/apiClient';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BAdminTable from './ui/BAdminTable';
import BStatusBadge from './ui/BStatusBadge';
import BKebabMenu from './ui/BKebabMenu';

const BusinessSubscriptionManagement = () => {
    const [businesses, setBusinesses] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        tier: '',
        status: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [businessResponse, tierResponse] = await Promise.all([
                businessAPI.adminGetAllBusinesses(),
                businessAPI.getAllBusinessTiers()
            ]);
            
            setBusinesses(businessResponse.data.businesses || []);
            setTiers(tierResponse.data.tiers || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load subscription data');
        } finally {
            setLoading(false);
        }
    };

    const handleTierChange = async (businessId, newTierId) => {
        try {
            setUpdating(businessId);
            await businessAPI.adminUpdateBusinessTier(businessId, newTierId);
            toast.success('Business tier updated successfully');
            await fetchData();
        } catch (error) {
            console.error('Error updating business tier:', error);
            toast.error(error.response?.data?.error || 'Failed to update business tier');
        } finally {
            setUpdating(null);
        }
    };

    const handleStatusToggle = async (businessId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'suspend';
        
        if (!window.confirm(`Are you sure you want to ${action} this business subscription?`)) {
            return;
        }

        try {
            setUpdating(businessId);
            await businessAPI.adminUpdateBusinessStatus(businessId, newStatus);
            toast.success(`Business subscription ${action}d successfully`);
            await fetchData();
        } catch (error) {
            console.error('Error updating business status:', error);
            toast.error(error.response?.data?.error || `Failed to ${action} business`);
        } finally {
            setUpdating(null);
        }
    };

    const filteredBusinesses = businesses.filter(business => {
        const searchMatch = !filters.search || 
            business.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
            business.email?.toLowerCase().includes(filters.search.toLowerCase());
        
        const tierMatch = !filters.tier || business.tier_id?.toString() === filters.tier;
        const statusMatch = !filters.status || business.status === filters.status;
        
        return searchMatch && tierMatch && statusMatch;
    });

    const getTierName = (tierId) => {
        const tier = tiers.find(t => t.id === tierId);
        return tier ? tier.name : 'Unknown Tier';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined) return 'Free';
        return `$${(price / 100).toFixed(2)}/month`;
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-table-page">
                    <div className="loading-container">
                        <i className="ri-loader-4-line spinning"></i>
                        <span>Loading subscription data...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-table-page" style ={{marginLeft: '300px'}}>
                <div className="table-header-container">
                    <div className="table-header">
                        <h1 className="b_admin_styling-title">Business Subscription Management</h1>
                        <p className="chat-subtitle">Manage business tier assignments and subscription status</p>
                    </div>
                </div>

                {/* Subscription Stats */}
                <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon">
                            <i className="ri-building-line"></i>
                        </div>
                        <div className="admin-stat-content">
                            <h3>{businesses.length}</h3>
                            <p>Total Businesses</p>
                        </div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon">
                            <i className="ri-checkbox-circle-line"></i>
                        </div>
                        <div className="admin-stat-content">
                            <h3>{businesses.filter(b => b.status === 'active').length}</h3>
                            <p>Active Subscriptions</p>
                        </div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon">
                            <i className="ri-pause-circle-line"></i>
                        </div>
                        <div className="admin-stat-content">
                            <h3>{businesses.filter(b => b.status === 'suspended').length}</h3>
                            <p>Suspended</p>
                        </div>
                    </div>
                    <div className="admin-stat-card">
                        <div className="admin-stat-icon">
                            <i className="ri-money-dollar-circle-line"></i>
                        </div>
                        <div className="admin-stat-content">
                            <h3>
                                ${businesses.reduce((total, b) => {
                                    const tier = tiers.find(t => t.id === b.tier_id);
                                    return total + (tier ? tier.price / 100 : 0);
                                }, 0).toFixed(0)}
                            </h3>
                            <p>Monthly Revenue</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <BFilterBar>
                  <BFilterControl label="Search" htmlFor="subSearch">
                    <BSearchInput id="subSearch" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search businesses..." />
                  </BFilterControl>
                  <BFilterControl label="Tier" htmlFor="tierFilter">
                    <select id="tierFilter" value={filters.tier} onChange={(e) => setFilters({ ...filters, tier: e.target.value })} className="b_admin_styling-select b_admin_styling-select--compact">
                      <option value="">All Tiers</option>
                      {tiers.map(tier => (
                        <option key={tier.id} value={tier.id}>{tier.name} ({formatPrice(tier.price)})</option>
                      ))}
                    </select>
                  </BFilterControl>
                  <BFilterControl label="Status" htmlFor="statusFilter">
                    <select id="statusFilter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="b_admin_styling-select b_admin_styling-select--compact">
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </BFilterControl>
                </BFilterBar>

                {/* Businesses Table */}
                <BAdminTable headers={["Business","Current Tier","Status","Monthly Price","Response Usage","Last Updated","Actions"]}>
                  {filteredBusinesses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-empty-state">
                        <i className="ri-building-line"></i>
                        <h3>No Businesses Found</h3>
                        <p>No businesses match your current filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBusinesses.map(business => (
                      <tr key={business.id}>
                        <td>
                          <div className="business-info">
                            <strong>{business.name}</strong>
                            {business.location && (<div className="business-location">{business.location}</div>)}
                          </div>
                        </td>
                        <td><span className="tier-badge">{getTierName(business.tier_id)}</span></td>
                        <td>
                          <BStatusBadge type={(business.status || 'active') === 'active' ? 'approved' : 'inactive'}>
                            {business.status || 'active'}
                          </BStatusBadge>
                        </td>
                        <td>{formatPrice(tiers.find(t => t.id === business.tier_id)?.price)}</td>
                        <td>
                          <div className="usage-info">
                            <span>{(business.monthly_responses_used || 0).toLocaleString()}</span>
                            <span className="usage-separator">/</span>
                            <span>{(business.monthly_response_limit || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td>{formatDate(business.updated_at)}</td>
                        <td className="b_admin_styling-table__actions">
                          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={business.tier_id || ''}
                              onChange={(e) => handleTierChange(business.id, parseInt(e.target.value))}
                              disabled={updating === business.id}
                              className="tier-select"
                            >
                              {tiers.map(tier => (
                                <option key={tier.id} value={tier.id}>{tier.name}</option>
                              ))}
                            </select>
                            <BKebabMenu
                              isOpen={updating === business.id}
                              onToggle={() => { /* no-op visual toggle tied to updating state */ }}
                              items={[
                                { label: business.status === 'active' ? 'Suspend' : 'Activate', icon: business.status === 'active' ? 'ri-pause-line' : 'ri-play-line', onClick: () => handleStatusToggle(business.id, business.status || 'active') },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </BAdminTable>
            </div>
        </div>
    );
};

export default BusinessSubscriptionManagement; 