import React from 'react';

/**
 * Horizontal compact filters/search toolbar.
 * Expects children as filter controls.
 */
const BFilterBar = ({ children, className = '', style = {} }) => {
  const composed = ['b_admin_styling-filters', className].filter(Boolean).join(' ');
  return (
    <div className={composed} style={{ marginBottom: 12, ...style }}>
      {children}
    </div>
  );
};

export default BFilterBar;



