import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { useBusiness } from '../../services/BusinessContext';
import { toast } from 'react-hot-toast';
import { businessAPI, adminSeatPackageAPI } from '../../services/apiClient';
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BSearchInput from './ui/BSearchInput';
import BAdminTable from './ui/BAdminTable';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const ManageBusinessAdmins = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { 
    loading, 
    permissions, 
    business, 
    totalAdminSeats, 
    usedAdminSeats, 
    adminSeatsPurchased, 
    tierInfo, 
    canAddAdminSeat 
  } = useBusiness();
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seatPackages, setSeatPackages] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = localStorage.getItem('userRole');

  const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';

  // Authorization checks
  let unauthorized = false;
  if (!isSuperAdmin) {
    if (userRole !== 'business_admin' || user.business_id !== parseInt(businessId)) {
      unauthorized = true;
    } else if (!permissions?.can_manage_admins || !(user.business_admin_permissions?.can_manage_admins)) {
      unauthorized = true;
    }
  }

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await businessAPI.listBusinessAdmins(businessId);
      setAdmins(res.data.admins || []);
      console.log('[MANAGE_ADMINS] Business context data:', {
        business,
        tierInfo,
        totalAdminSeats,
        usedAdminSeats,
        adminSeatsPurchased,
        adminsFromAPI: res.data.admins?.length || 0,
        businessTier: business?.tier,
        businessTierInfo: business?.tier_info,
        businessAdminSeatLimit: business?.admin_seat_limit,
        businessAdminSeatsPurchased: business?.admin_seats_purchased
      });
    } catch (err) {
      console.error('Error fetching admins', err);
      toast.error('Failed to load business admins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!unauthorized) {
      fetchAdmins();
    }
  }, [businessId, unauthorized]);

  const handleDelete = async (adminId, adminName) => {
    try {
      await businessAPI.deleteBusinessAdmin(businessId, adminId);
      toast.success('Admin deleted');
      fetchAdmins();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // Determine seat availability using fresh admin list and total seats
  const seatAvailable = isSuperAdmin || totalAdminSeats === Infinity || admins.length < totalAdminSeats;

  useEffect(() => {
    if (!seatAvailable) {
      adminSeatPackageAPI.getAvailablePackages()
        .then((res) => {
          setSeatPackages(res.data?.packages || res.packages || []);
        })
        .catch((err) => {
          console.error('Error loading admin seat packages', err);
        });
    } else {
      setSeatPackages([]);
    }
  }, [seatAvailable]);

  const handleAddAdmin = () => {
    if (!seatAvailable) {
      toast.error('Admin seat limit reached. Please purchase additional seats.');
      navigate('/business/purchase-admin-seats');
      return;
    }
    navigate(`/admin/business/${businessId}/admins/new`);
  };

  const renderSeatInfo = () => {
    if (isSuperAdmin) return null;
    
    // Use tier_info from business context, fallback to business data
    const effectiveTierInfo = tierInfo || business?.tier_info;
    const tierSeats = effectiveTierInfo?.admin_seat_limit || business?.admin_seat_limit || 1;
    const tierSeatsDisplay = tierSeats === -1 ? '∞' : tierSeats;
    const totalSeatsDisplay = totalAdminSeats === Infinity ? '∞' : totalAdminSeats;
    const currentCount = admins.length; // Use actual admin count from API
    
    const isNearLimit = totalAdminSeats !== Infinity && currentCount >= totalAdminSeats * 0.8;
    const isAtLimit = totalAdminSeats !== Infinity && currentCount >= totalAdminSeats;

    return (
      <div className={`seat-info-card ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
        <div className="seat-info-header">
          <h3>Admin Seat Usage</h3>
          <span className="seat-counter">{currentCount} / {totalSeatsDisplay}</span>
        </div>
        <div className="seat-breakdown">
          <div className="seat-item">
            <span className="seat-label">Tier Seats ({effectiveTierInfo?.name || business?.tier || 'Unknown'}):</span>
            <span className="seat-value">{tierSeatsDisplay}</span>
          </div>
          {adminSeatsPurchased > 0 && (
            <div className="seat-item">
              <span className="seat-label">Purchased Seats:</span>
              <span className="seat-value">+{adminSeatsPurchased}</span>
            </div>
          )}
        </div>
        {isAtLimit && (
          <div className="seat-warning">
            <i className="ri-alert-fill"></i>
            You've reached your admin seat limit. Upgrade your tier or purchase additional seats to add more admins.
          </div>
        )}
        {isNearLimit && !isAtLimit && (
          <div className="seat-warning near">
            <i className="ri-information-fill"></i>
            You're approaching your admin seat limit.
          </div>
        )}
      </div>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="newmain-content33 user-management-page b_admin_styling-main">
          <BLoading variant="page" label="Loading admins..." />
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="page-container"><Sidebar /><div className="newmain-content33 user-management-page"><h2>Unauthorized</h2></div></div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="newmain-content33 user-management-page">
      <div className="b_admin_styling-header">
        <h1 className="b_admin_styling-title">Manage Business Admins</h1>
        {seatAvailable ? (
          <BButton variant="primary" size="sm" onClick={handleAddAdmin}>
            <i className="ri-user-add-line"></i> Add Admin
          </BButton>
        ) : (
          <BButton variant="secondary" size="sm" onClick={() => navigate('/business/purchase-admin-seats')}>
            <i className="ri-shopping-cart-line"></i> Purchase Admin Seats
          </BButton>
        )}
      </div>

      {!seatAvailable && seatPackages.length > 0 && (
        <div className="seat-package-info" style={{ marginBottom: '20px' }}>
          <p style={{ color: '#333' }}>
            No available admin seats. Packages start at{' '}
            <strong>${(seatPackages[0].price / 100).toFixed(2)}</strong> for{' '}
            {seatPackages[0].total_seats} seat{seatPackages[0].total_seats > 1 ? 's' : ''}.
          </p>
        </div>
      )}

        {renderSeatInfo()}

        {admins.length === 0 ? (
          <div className="b_admin_styling-empty-state">
            <i className="ri-user-3-line"></i>
            <h3>No admins found for this business.</h3>
          </div>
        ) : (
          <BAdminTable headers={["Name","Email","Created","Actions"]}>
            {admins.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="b_admin_styling-table__actions">
                  <BKebabMenu
                    isOpen={openMenuId === a.id}
                    onToggle={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                    items={[
                      { label: 'Delete', icon: 'ri-delete-bin-line', danger: true, onClick: () => { setOpenMenuId(null); handleDelete(a.id, a.name); } },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </BAdminTable>
        )}
      </div>
    </div>
  );
};

export default ManageBusinessAdmins; 