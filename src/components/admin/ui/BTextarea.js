import React from 'react';

const BTextarea = ({ className = '', rows = 4, ...props }) => {
  const composed = [
    'b_admin_styling-textarea',
    'b_ui-textarea',
    className,
  ].filter(Boolean).join(' ');

  return <textarea rows={rows} className={composed} {...props} />;
};

export default BTextarea;




