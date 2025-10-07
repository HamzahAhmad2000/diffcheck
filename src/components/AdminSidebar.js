import React, { useState, useEffect } from 'react';
import '../components/static/css/admin.css';

const AdminSidebar = ({ onMenuClick, activeSection }) => {
  const [isPinned, setIsPinned] = useState(true);
  
  const toggleSidebar = () => {
    setIsPinned(!isPinned);
  };
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsPinned(false);
      }
    };
    
    // Initial check
    handleResize();
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = () => {
    // Clear ALL session/authentication data from localStorage.
    // This is the critical fix. It removes login tokens AND any leftover
    // registration tokens (like reg_temp_auth_token).
    localStorage.clear();
    
    window.location.href = '/login';
  };

  return (
    <div className={`sidebar ${!isPinned ? 'unpinned' : ''}`}>
      <div className="side_bar_top">
        <div className="sidebar-header">
          <h2>Admin</h2>
          <button className="pin-button" aria-label="Toggle sidebar" onClick={toggleSidebar}>
            <i className={isPinned ? "ri-arrow-left-s-line" : "ri-arrow-right-s-line"}></i>
          </button>
        </div>
        <ul className="sidebar-menu">
          <li 
            data-section="home"
            className={activeSection === "home" ? "active" : ""}
            onClick={() => onMenuClick("home")}
          >
            <i className="ri-home-line"></i>
            <span>Home</span>
          </li>
          <li 
            data-section="users"
            className={activeSection === "users" ? "active" : ""}
            onClick={() => onMenuClick("users")}
          >
            <i className="ri-user-line"></i>
            <span>Users</span>
          </li>
          <li 
            data-section="queries"
            className={activeSection === "queries" ? "active" : ""}
            onClick={() => onMenuClick("queries")}
          >
            <i className="ri-questionnaire-line"></i>
            <span>Queries</span>
          </li>
          <li 
            data-section="organizations"
            className={activeSection === "organizations" ? "active" : ""}
            onClick={() => onMenuClick("organizations")}
          >
            <i className="ri-team-line"></i>
            <span>Organizations</span>
          </li>
          <li 
            data-section="partners"
            className={activeSection === "partners" ? "active" : ""}
            onClick={() => onMenuClick("partners")}
          >
            <i className="ri-shake-hands-line"></i>
            <span>Partners</span>
          </li>
          <li 
            data-section="qrcodes"
            className={activeSection === "qrcodes" ? "active" : ""}
            onClick={() => onMenuClick("qrcodes")}
          >
            <i className="ri-qr-code-line"></i>
            <span>QR Codes</span>
          </li>
          <li 
            data-section="products"
            className={activeSection === "products" ? "active" : ""}
            onClick={() => onMenuClick("products")}
          >
            <i className="ri-shopping-bag-line"></i>
            <span>Products</span>
          </li>
        </ul>
      </div>
      <div className="sidebar-footer">
        <button className="admin_logout" onClick={handleLogout}>
          <i className="ri-logout-circle-line"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
