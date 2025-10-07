import React from 'react';

/**
 * Status pill using admin badge styles.
 * type: 'active' | 'inactive' | 'approved' | 'pending'
 */
const typeToClass = {
  active: 'b_admin_styling-status-badge--active',
  inactive: 'b_admin_styling-status-badge--inactive',
  approved: 'b_admin_styling-status-badge--approved',
  pending: 'b_admin_styling-status-badge--pending',
};

const BStatusBadge = ({ type, children }) => {
  const cls = typeToClass[type] || '';
  return (
    <span className={`b_admin_styling-status-badge ${cls}`}>{children}</span>
  );
};

export default BStatusBadge;



