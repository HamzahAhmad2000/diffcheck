import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { purchaseAPI } from '../../services/apiClient';
import './AdminTables.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import { BAdminTable, BFormField, BTextInput, BSelect, BStatusBadge } from './ui';
import BButton from './ui/BButton';
import './ui/b_ui.css';

const AdminDeliveryManagement = () => {
  const [deliveryInfo, setDeliveryInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDeliveryInfo();
    fetchStats();
  }, [page, selectedStatus, searchTerm]);

  const fetchDeliveryInfo = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        status: selectedStatus || undefined,
        search: searchTerm || undefined
      };

      const response = await purchaseAPI.adminGetDeliveryInfo(params);
      setDeliveryInfo(response.data.delivery_info || []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching delivery info:', error);
      setError('Failed to load delivery information');
      toast.error('Failed to load delivery information');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Calculate stats from delivery info
      const totalDeliveries = deliveryInfo.length;
      const pendingCount = deliveryInfo.filter(d => d.status === 'PENDING').length;
      const shippedCount = deliveryInfo.filter(d => d.status === 'SHIPPED').length;
      const deliveredCount = deliveryInfo.filter(d => d.status === 'DELIVERED').length;
      
      setStats({
        total_deliveries: totalDeliveries,
        pending_deliveries: pendingCount,
        shipped_deliveries: shippedCount,
        delivered_deliveries: deliveredCount
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const updatePurchaseStatus = async (purchaseId, newStatus) => {
    try {
      await purchaseAPI.adminUpdatePurchaseStatus(purchaseId, { status: newStatus });
      fetchDeliveryInfo(); // Refresh the list
      toast.success('Purchase status updated successfully!');
    } catch (error) {
      console.error('Error updating purchase status:', error);
      toast.error('Failed to update purchase status');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const labelMap = {
      PENDING: 'Pending',
      PENDING_DELIVERY_INFO: 'Delivery Info Needed',
      PENDING_FULFILLMENT: 'Pending',
      PROCESSING: 'Processing',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
    };
    const typeMap = {
      PENDING: 'pending',
      PENDING_DELIVERY_INFO: 'pending',
      PENDING_FULFILLMENT: 'pending',
      PROCESSING: 'pending',
      SHIPPED: 'approved',
      DELIVERED: 'active',
      CANCELLED: 'inactive',
    };
    return <BStatusBadge type={typeMap[status] || 'inactive'}>{labelMap[status] || status}</BStatusBadge>;
  };

  const openDeliveryModal = (purchase) => {
    setSelectedPurchase(purchase);
  };

  const closeDeliveryModal = () => {
    setSelectedPurchase(null);
  };

  if (loading && page === 1) {
    return (
      <div className="admin-form-page">
        <div>
          <div className="form-header">
            <h1 className="chat-title">📦 Delivery Management</h1>
            <p className="chat-subtitle">Loading delivery information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-form-page">
        <div >
          <div className="form-header">
            <h1 className="chat-title">📦 Delivery Management</h1>
            <p className="chat-subtitle">Error loading data</p>
          </div>
          <div className="newform-group">
            <p style={{ color: '#dc3545', textAlign: 'center' }}>{error}</p>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <BButton onClick={fetchDeliveryInfo} variant="primary">
                <i className="ri-refresh-line"></i>
                Retry
              </BButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Client-side filtering fallback to ensure filters always work
  const filteredDeliveryInfo = deliveryInfo.filter((purchase) => {
    const isMissingDeliveryInfo = !purchase.delivery_info || !purchase.delivery_info.address;
    const matchesStatus = selectedStatus
      ? (selectedStatus === 'PENDING_DELIVERY_INFO'
          ? isMissingDeliveryInfo
          : purchase.status === selectedStatus)
      : true;
    const query = (searchTerm || '').toLowerCase().trim();
    const matchesQuery = query
      ? (
          (purchase.delivery_info?.full_name || purchase.user?.username || '').toLowerCase().includes(query) ||
          (purchase.delivery_info?.email || purchase.user?.email || '').toLowerCase().includes(query) ||
          (purchase.marketplace_item?.name || '').toLowerCase().includes(query)
        )
      : true;
    return matchesStatus && matchesQuery;
  });

  return (
    <div>
      <div  style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div className="form-header">
          <h1 className="chat-title">📦 Delivery Management</h1>
          <p className="chat-subtitle">View and manage user delivery information</p>
        </div>

        {stats && (
          <div className="newform-group" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#333' }}>{stats.total_deliveries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Deliveries</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fff8e1', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#f57c00' }}>{stats.pending_deliveries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Pending</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#1976d2' }}>{stats.shipped_deliveries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Shipped</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#2e7d32' }}>{stats.delivered_deliveries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Delivered</p>
              </div>
            </div>
          </div>
        )}

        <div className="newform-group">
          <div className="admin-form">
            <BFormField label="Filter by Status:">
              <BSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PENDING_DELIVERY_INFO">Pending (Delivery Info Needed)</option>
                <option value="PENDING_FULFILLMENT">Pending Fulfillment</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </BSelect>
            </BFormField>

            <BFormField label="Search:">
              <BTextInput
                type="text"
                placeholder="Search by name, email, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </BFormField>
          </div>
        </div>

        {deliveryInfo.length === 0 ? (
          <div className="newform-group">
            <div className="no-results">
              <h3>No delivery information found</h3>
              <p>No delivery information matches your current filters.</p>
            </div>
          </div>
        ) : (
          <div className="admin-table-container">
            <BAdminTable headers={["Purchase ID","Customer","Item","Order Date","Status","Delivery Address","Actions"]}>
              {filteredDeliveryInfo.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>
                    No delivery information matches your current filters.
                  </td>
                </tr>
              ) : filteredDeliveryInfo.map(purchase => (
                <tr key={purchase.id}>
                  <td>#{purchase.id}</td>
                  <td>
                    <div>
                      <strong style={{ color: '#111827' }}>{purchase.delivery_info?.full_name || purchase.user?.username || 'Unknown'}</strong>
                      <br />
                      <small style={{ color: '#666' }}>
                        {purchase.delivery_info?.email || purchase.user?.email || 'N/A'}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: '#111827' }}>{purchase.marketplace_item?.name || 'Unknown Item'}</strong>
                      <br />
                      <small style={{ color: '#666' }}>
                        {purchase.marketplace_item?.points_cost || 0} points
                      </small>
                    </div>
                  </td>
                  <td>{formatDate(purchase.created_at)}</td>
                  <td>{getStatusBadge(purchase.status)}</td>
                  <td>
                    {purchase.delivery_info ? (
                      <div>
                        <div style={{ color: '#111827' }}>{purchase.delivery_info.address}</div>
                        <small style={{ color: '#666' }}>
                          {purchase.delivery_info.city}, {purchase.delivery_info.state_province}
                        </small>
                      </div>
                    ) : (
                      <span style={{ color: '#999', fontStyle: 'italic' }}>No address provided</span>
                    )}
                  </td>
                  <td className="b_admin_styling-table__actions">
                    <button
                      onClick={() => openDeliveryModal(purchase)}
                      className="b_admin_styling-icon-btn"
                      title="View full details"
                    >
                      <i className="ri-eye-line"></i>
                    </button>
                    {purchase.status !== 'DELIVERED' && purchase.status !== 'CANCELLED' && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            updatePurchaseStatus(purchase.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="b_admin_styling-select b_ui-select"
                        defaultValue=""
                        style={{ display: 'inline-block', width: 'auto', marginLeft: '10px', fontSize: '12px' }}
                      >
                        <option value="">Update Status</option>
                        {(purchase.status === 'PENDING' || purchase.status === 'PENDING_FULFILLMENT') && (
                          <option value="PROCESSING">Mark as Processing</option>
                        )}
                        {(purchase.status === 'PENDING' || purchase.status === 'PENDING_FULFILLMENT' || purchase.status === 'PROCESSING') && (
                          <option value="SHIPPED">Mark as Shipped</option>
                        )}
                        {purchase.status === 'SHIPPED' && (
                          <option value="DELIVERED">Mark as Delivered</option>
                        )}
                        <option value="CANCELLED">Cancel Order</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </BAdminTable>
          </div>
        )}

        {totalPages > 1 && (
          <div className="newform-actions" style={{ justifyContent: 'center' }}>
            <BButton
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              variant="secondary"
            >
              <i className="ri-arrow-left-line"></i>
              Previous
            </BButton>
            <span style={{ margin: '0 20px', fontWeight: '500', alignSelf: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <BButton
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              variant="secondary"
            >
              Next
              <i className="ri-arrow-right-line"></i>
            </BButton>
          </div>
        )}

        {/* Delivery Details Modal */}
        {selectedPurchase && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={closeDeliveryModal}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '800px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#333' }}>
                  📦 Delivery Details - Purchase #{selectedPurchase.id}
                </h2>
                <button 
                  onClick={closeDeliveryModal} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '24px', 
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' , color: '#000'}}>
                <div>
                  <h3 style={{ color: '#333', marginBottom: '15px' }}>Customer Information</h3>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Full Name:</strong> {selectedPurchase.delivery_info?.full_name || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Email:</strong> {selectedPurchase.delivery_info?.email || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Phone:</strong> {selectedPurchase.delivery_info?.phone || 'N/A'}
                  </div>
                </div>

                <div>
                  <h3 style={{ color: '#333', marginBottom: '15px' }}>Delivery Address</h3>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Address:</strong> {selectedPurchase.delivery_info?.address || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>City:</strong> {selectedPurchase.delivery_info?.city || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>State/Province:</strong> {selectedPurchase.delivery_info?.state_province || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Postal Code:</strong> {selectedPurchase.delivery_info?.postal_code || 'N/A'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Country:</strong> {selectedPurchase.delivery_info?.country || 'N/A'}
                  </div>
                </div>

                {selectedPurchase.delivery_info?.billing_same_as_delivery === false && (
                  <div>
                    <h3 style={{ color: '#333', marginBottom: '15px' }}>Billing Address</h3>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Address:</strong> {selectedPurchase.delivery_info?.billing_address || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>City:</strong> {selectedPurchase.delivery_info?.billing_city || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>State/Province:</strong> {selectedPurchase.delivery_info?.billing_state_province || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Postal Code:</strong> {selectedPurchase.delivery_info?.billing_postal_code || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Country:</strong> {selectedPurchase.delivery_info?.billing_country || 'N/A'}
                    </div>
                  </div>
                )}

                <div>
                  <h3 style={{ color: '#333', marginBottom: '15px' }}>Order Information</h3>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Item:</strong> {selectedPurchase.marketplace_item?.name || 'Unknown Item'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Points Cost:</strong> {selectedPurchase.marketplace_item?.points_cost || 0} points
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Order Date:</strong> {formatDate(selectedPurchase.created_at)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Status:</strong> {getStatusBadge(selectedPurchase.status)}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Payment Method:</strong> {selectedPurchase.delivery_info?.payment_method || 'N/A'}
                  </div>
                  {selectedPurchase.delivery_info?.notes && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Notes:</strong> {selectedPurchase.delivery_info.notes}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button onClick={closeDeliveryModal} className="nawa2button">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeliveryManagement; 