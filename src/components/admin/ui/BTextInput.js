import React from 'react';

const BTextInput = ({
  type = 'text',
  className = '',
  ...props
}) => {
  const composed = [
    'b_admin_styling-input',
    'b_ui-input',
    className,
  ].filter(Boolean).join(' ');

  return <input type={type} className={composed} {...props} />;
};

export default BTextInput;




