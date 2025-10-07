import React from 'react';

const BDateInput = ({ className = '', ...props }) => {
  const composed = [
    'b_admin_styling-input',
    'b_ui-input',
    className,
  ].filter(Boolean).join(' ');
  return <input type="date" className={composed} {...props} />;
};

export default BDateInput;




