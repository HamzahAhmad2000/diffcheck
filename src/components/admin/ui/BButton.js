import React from 'react';

/**
 * Reusable admin-styled button.
 * - variant: 'primary' | 'secondary' | 'danger'
 * - size: 'sm' | 'md'
 */
const BButton = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClass = `b_admin_styling-btn--${variant}`;
  const sizeClass = size === 'sm' ? 'b_admin_styling-btn--sm' : '';
  const composed = ['b_admin_styling-btn', variantClass, sizeClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={composed} {...props}>
      {children}
    </button>
  );
};

export default BButton;



