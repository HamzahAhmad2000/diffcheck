import React from 'react';

const BNumberInput = ({ className = '', step = '1', min, max, ...props }) => {
  const composed = [
    'b_admin_styling-input',
    'b_ui-input',
    className,
  ].filter(Boolean).join(' ');
  return (
    <input
      type="number"
      className={composed}
      step={step}
      min={min}
      max={max}
      {...props}
    />
  );
};

export default BNumberInput;




