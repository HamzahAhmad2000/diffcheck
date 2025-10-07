import React from 'react';

/**
 * Labeled filter control wrapper used inside BFilterBar.
 * Accepts an input/select element as children.
 */
const BFilterControl = ({ label, htmlFor, children }) => {
  return (
    <div className="b_admin_styling-filter">
      {label && (
        <label htmlFor={htmlFor} className="b_admin_styling-filter__label">
          {label}
        </label>
      )}
      {children}
    </div>
  );
};

export default BFilterControl;



