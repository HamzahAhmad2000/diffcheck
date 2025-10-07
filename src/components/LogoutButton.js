import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from 'services/apiClient';
import toast from 'react-hot-toast';

const LogoutButton = ({ className }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Call the logout endpoint
      await authAPI.logout(token);
      
      // Clear ALL session/authentication data from localStorage.
      // This is the critical fix. It removes login tokens AND any leftover
      // registration tokens (like reg_temp_auth_token).
      localStorage.clear();

      // Give user feedback
      toast.success("You have been successfully logged out.");
      
      // Redirect to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if the server request fails, still clear local storage and redirect
      localStorage.clear();
      toast.success("You have been successfully logged out.");
      navigate('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`logout-button ${className || ''}`}
    >
      Logout
      <style jsx>{`
        .logout-button {
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        
        .logout-button:hover {
          background-color: #c82333;
        }
      `}</style>
    </button>
  );
};

export default LogoutButton;