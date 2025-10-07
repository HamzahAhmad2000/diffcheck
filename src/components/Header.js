import React from 'react';
import { Link } from 'react-router-dom';
import LogoutButton from './LogoutButton';

const Header = () => {
  const userRole = localStorage.getItem('userRole');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <Link to={userRole === 'admin' ? '/dashboard' : '/surveys'}>
            Survey System
          </Link>
        </div>
        
        <div className="user-section">
          <span className="user-greeting">
            Welcome, {user.name || user.username || 'User'}
          </span>
          <LogoutButton />
        </div>
      </div>
      
      <style jsx>{`
        .app-header {
          background-color: #343a40;
          color: white;
          padding: 15px 20px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .logo a {
          color: white;
          font-size: 20px;
          font-weight: bold;
          text-decoration: none;
        }
        
        .user-section {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        
        .user-greeting {
          font-size: 14px;
          opacity: 0.8;
        }
      `}</style>
    </header>
  );
};

export default Header;