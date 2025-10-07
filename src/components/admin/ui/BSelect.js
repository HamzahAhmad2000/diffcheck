import React from 'react';

const BSelect = ({ className = '', children, ...props }) => {
  const composed = [
    'b_admin_styling-select',
    'b_ui-select',
    className,
  ].filter(Boolean).join(' ');

  return (
    <select className={composed} {...props}>
      {children}
    </select>
  );
};

export default BSelect;




