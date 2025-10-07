import React from 'react';
import '../../../styles/b_admin_styling.css';

/**
 * Full-page light loading state with purple spinner.
 * - variant: 'page' | 'inline'
 * - label: optional text
 */
const BLoading = ({ variant = 'page', label = 'Loading...' }) => {
  if (variant === 'inline') {
    return (
      <div className="b_admin_styling-loading-inline">
        <div className="b_admin_styling-spinner b_admin_styling-spinner--sm"></div>
        <span>{label}</span>
      </div>
    );
  }

  // Page variant
  return (
    <div className="b_admin_styling-loading-page" style={{ background: '#fcfaff' }}>
      <div className="b_admin_styling-spinner"></div>
    </div>
  );
};

export default BLoading;


