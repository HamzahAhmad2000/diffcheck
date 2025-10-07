import React from 'react';

const BToggle = ({ checked, onChange, label, className = '', ...props }) => {
  return (
    <label className={["b_ui-toggle", className].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        className="b_ui-toggle__input"
        checked={checked}
        onChange={(e) => onChange && onChange(e.target.checked)}
        {...props}
      />
      <span className="b_ui-toggle__track"><span className="b_ui-toggle__thumb" /></span>
      {label && <span className="b_ui-toggle__label">{label}</span>}
    </label>
  );
};

export default BToggle;




