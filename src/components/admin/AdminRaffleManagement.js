import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { purchaseAPI, notificationAPI } from '../../services/apiClient';
import './AdminTables.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import { BAdminTable, BFormField, BTextInput, BSelect, BStatusBadge } from './ui';
import BButton from './ui/BButton';
import './ui/b_ui.css';

const AdminRaffleManagement = () => {
  const [raffleEntries, setRaffleEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, winner_selected
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSelectingWinner, setIsSelectingWinner] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchRaffleEntries();
  }, [page, filter, selectedItem, searchTerm]);

  const fetchRaffleEntries = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        status: filter !== 'all' ? filter : undefined,
        item_id: selectedItem || undefined,
        search: searchTerm || undefined
      };

      const response = await purchaseAPI.adminGetRaffleEntries(params);
      setRaffleEntries(response.data.entries || []);
      setTotalPages(response.data.total_pages || 1);
      
      // Calculate stats from raffle entries
      calculateStats(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching raffle entries:', error);
      setError('Failed to load raffle entries');
      toast.error('Failed to load raffle entries');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (entries) => {
    const totalEntries = entries.length;
    const pendingCount = entries.filter(e => e.status === 'PENDING').length;
    const winnerSelectedCount = entries.filter(e => e.status === 'WINNER_SELECTED').length;
    const completedCount = entries.filter(e => e.status === 'COMPLETED').length;
    
    setStats({
      total_entries: totalEntries,
      pending_entries: pendingCount,
      winner_selected_entries: winnerSelectedCount,
      completed_entries: completedCount
    });
  };

  const selectRandomWinner = async (itemId) => {
    if (!window.confirm('Are you sure you want to select a random winner for this item?')) {
      return;
    }

    try {
      setIsSelectingWinner(true);
      const response = await purchaseAPI.adminSelectRaffleWinner(itemId);
      
      // Show success message
      if (response.data.winner) {
        toast.success(`Winner selected: ${response.data.winner.username} (${response.data.winner.email})`);
      }
      
      // Refresh the entries list
      fetchRaffleEntries();
    } catch (error) {
      console.error('Error selecting winner:', error);
      toast.error('Failed to select winner: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSelectingWinner(false);
    }
  };

  const sendCustomNotification = async (userId, title, message) => {
    try {
      await notificationAPI.adminSendCustomNotification({
        user_id: userId,
        title,
        message,
        type: 'CUSTOM'
      });
      toast.success('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
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
      WINNER_SELECTED: 'Winner Selected',
      COMPLETED: 'Completed',
    };
    const typeMap = {
      PENDING: 'pending',
      WINNER_SELECTED: 'active',
      COMPLETED: 'approved',
    };
    return <BStatusBadge type={typeMap[status] || 'inactive'}>{labelMap[status] || status}</BStatusBadge>;
  };

  // Group entries by item for easier management
  const groupedEntries = raffleEntries.reduce((acc, entry) => {
    const itemName = entry.marketplace_item?.name || 'Unknown Item';
    if (!acc[itemName]) {
      acc[itemName] = {
        item: entry.marketplace_item,
        entries: []
      };
    }
    acc[itemName].entries.push(entry);
    return acc;
  }, {});

  const uniqueItems = [...new Set(raffleEntries.map(entry => entry.marketplace_item?.name))].filter(Boolean);

  if (loading && page === 1) {
    return (
      <div className="admin-form-page">
        <div >
          <div className="form-header">
            <h1 className="chat-title">🏆 Raffle Management</h1>
            <p className="chat-subtitle">Loading raffle entries...</p>
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
            <h1 className="chat-title">🏆 Raffle Management</h1>
            <p className="chat-subtitle">Error loading data</p>
          </div>
          <div className="newform-group">
            <p style={{ color: '#dc3545', textAlign: 'center' }}>{error}</p>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <BButton onClick={fetchRaffleEntries} variant="primary">
                <i className="ri-refresh-line"></i>
                Retry
              </BButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div  style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div className="form-header">
          <h1 className="chat-title">🏆 Raffle Management</h1>
          <p className="chat-subtitle">Manage raffle entries and select winners</p>
        </div>

        {stats && (
          <div className="newform-group" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#333' }}>{stats.total_entries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Entries</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fff8e1', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#f57c00' }}>{stats.pending_entries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Pending</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#2e7d32' }}>{stats.winner_selected_entries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Winner Selected</p>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#1976d2' }}>{stats.completed_entries}</h3>
                <p style={{ margin: 0, color: '#666' }}>Completed</p>
              </div>
            </div>
          </div>
        )}

        <div className="newform-group">
          <div className="admin-form">
            <BFormField label="Filter by Status:">
              <BSelect
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Entries</option>
                <option value="PENDING">Pending</option>
                <option value="WINNER_SELECTED">Winner Selected</option>
                <option value="COMPLETED">Completed</option>
              </BSelect>
            </BFormField>

            <BFormField label="Filter by Item:">
              <BSelect
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
              >
                <option value="">All Items</option>
                {uniqueItems.map(itemName => (
                  <option key={itemName} value={itemName}>{itemName}</option>
                ))}
              </BSelect>
            </BFormField>

            <BFormField label="Search Users:">
              <BTextInput
                type="text"
                placeholder="Search by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </BFormField>
          </div>
        </div>

        {Object.keys(groupedEntries).length === 0 ? (
          <div className="newform-group">
            <div className="no-results">
              <h3>No raffle entries found</h3>
              <p>No entries match your current filters.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {Object.entries(groupedEntries).map(([itemName, { item, entries }]) => (
              <div key={itemName} className="newform-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>{itemName}</h3>
                    <p style={{ margin: '0 0 10px 0', color: '#666' }}>{entries.length} entries</p>
                    {item && (
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ color: '#666' }}>{item.points_cost} points</span>
                        {item.is_raffle && (
                          <span className="status-badge status-approved">🎫 Raffle Item</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {entries.some(e => e.status === 'PENDING') && (
                      <BButton
                        onClick={() => selectRandomWinner(item?.id)}
                        disabled={isSelectingWinner}
                        variant="primary"
                      >
                        <i className="ri-trophy-line"></i>
                        {isSelectingWinner ? 'Selecting...' : 'Select Random Winner'}
                      </BButton>
                    )}
                  </div>
                </div>

                <div className="admin-table-container">
                  <BAdminTable headers={["Entry ID","User","Email","Entry Date","Status","Actions"]}>
                    {entries.map(entry => (
                      <tr key={entry.id} style={entry.is_winner ? { backgroundColor: '#fff8e1' } : {}}>
                        <td>#{entry.id}</td>
                        <td>
                          <div>
                            <strong style={{ color: '#111827' }}>{entry.user?.username || 'Unknown'}</strong>
                            {entry.is_winner && (
                              <span className="status-badge status-active" style={{ marginLeft: '10px' }}>
                                🏆 Winner
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{entry.user?.email || 'N/A'}</td>
                        <td>{formatDate(entry.entry_date)}</td>
                        <td>{getStatusBadge(entry.status)}</td>
                        <td className="b_admin_styling-table__actions">
                          <button
                            onClick={() => {
                              const title = prompt('Notification title:');
                              if (title) {
                                const message = prompt('Notification message:');
                                if (message) {
                                  sendCustomNotification(entry.user?.id, title, message);
                                }
                              }
                            }}
                            className="b_admin_styling-icon-btn"
                            title="Send notification to user"
                          >
                            <i className="ri-mail-line"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </BAdminTable>
                </div>
              </div>
            ))}
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
      </div>
    </div>
  );
};

export default AdminRaffleManagement; 