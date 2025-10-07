import React from 'react';

/**
 * Compact search input styled for admin pages.
 * Props: id, value, onChange, placeholder
 */
const BSearchInput = ({ id, value, onChange, placeholder = 'Search...' }) => {
  return (
    <input
      type="text"
      id={id}
      className="b_admin_styling-input b_admin_styling-input--compact"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
};

export default BSearchInput;



