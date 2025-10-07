import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../../services/BusinessContext';
import CreateBusinessAdmin from './CreateBusinessAdmin';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';

/**
 * Wrapper used by business admins to create other admins within the same business.
 * If no admin seats are available, redirect user to purchase seats page instead of rendering the form.
 */
const CreateBusinessAdminForBusiness = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { canAddAdminSeat, isSuperAdmin } = useBusiness();

  useEffect(() => {
    // If a business admin lacks seats, redirect to purchase page
    // But allow super tier businesses to proceed
    if (!isSuperAdmin && !canAddAdminSeat()) {
      navigate('/business/purchase-admin-seats');
    }
  }, [canAddAdminSeat, isSuperAdmin, navigate]);

  // Render form only when seats are available (or super admin bypass)
  if (!isSuperAdmin && !canAddAdminSeat()) {
    return null;
  }

  return <CreateBusinessAdmin presetBusinessId={businessId} />;
};

export default CreateBusinessAdminForBusiness; 