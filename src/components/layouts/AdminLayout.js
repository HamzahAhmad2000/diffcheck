import React from 'react';
import Sidebar from '../common/Sidebar';
import '../../styles/AIChat.css'; // For .page-container, .main-content3
import '../../styles/b_admin_styling.css';
import '../admin/ui/b_ui.css';

const AdminLayout = ({ children }) => {
  return (
    <div className="page-container">
      <Sidebar />
      {/* This div will be targeted by Sidebar.css to apply margin-left */}
      <div className="newmain-content33 admin-page-content"> 
        {children}
      </div>
    </div>
  );
};

export default AdminLayout; 