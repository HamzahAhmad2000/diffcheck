import React from 'react';

/**
 * Kebab menu with provided items. Handles open/close externally with open flag.
 * items: Array<{ label: string, icon?: string, onClick: () => void, danger?: boolean }>
 */
const BKebabMenu = ({ isOpen, onToggle, items = [] }) => {
  return (
    <div className="b_admin_styling-actions-popover">
      <button
        className="b_admin_styling-kebab"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <i className="ri-more-2-fill"></i>
      </button>
      {isOpen && (
        <div className="b_admin_styling-menu" role="menu">
          {items.map((item, idx) => (
            <button
              key={idx}
              className={`b_admin_styling-menu__item ${item.danger ? 'b_admin_styling-menu__item--danger' : ''}`}
              onClick={item.onClick}
              role="menuitem"
            >
              {item.icon && <i className={item.icon}></i>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BKebabMenu;



