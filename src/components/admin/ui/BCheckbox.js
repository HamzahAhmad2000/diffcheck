import React from 'react';

const BCheckbox = ({ label, className = '', containerClassName = '', ...props }) => {
  return (
    <label className={["b_ui-check", containerClassName].filter(Boolean).join(' ')}>
      <input type="checkbox" className={["b_ui-check__input", className].filter(Boolean).join(' ')} {...props} />
      <span className="b_ui-check__box" aria-hidden="true" />
      {label && <span className="b_ui-check__label">{label}</span>}
    </label>
  );
};

export default BCheckbox;




