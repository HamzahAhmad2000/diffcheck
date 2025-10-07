import React from 'react';

/**
 * Admin table wrapper with consistent styles.
 * - headers: string[] for column headers
 * - renderRow: (item) => ReactNode for rendering <tr>
 */
const BAdminTable = ({ headers = [], children }) => {
  return (
    <div className="b_admin_styling-table-container">
      <table className="b_admin_styling-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={h === 'Actions' ? 'b_admin_styling-table__actions' : ''}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};

export default BAdminTable;



