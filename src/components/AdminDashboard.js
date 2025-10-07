import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { authAPI } from '../services/apiClient';
import '../components/static/css/admin.css';
import './admin/AdminLayout.css';
import '../styles/b_admin_styling.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [charts, setCharts] = useState({});

  // Chart rendering function
  const renderChart = (canvasId, chartType, data, options) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.warn(`Canvas element with id ${canvasId} not found.`);
      return null;
    }
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
      existingChart.destroy();
    }
    
    try {
      return new Chart(ctx, {
        type: chartType,
        data,
        options: options || {}
      });
    } catch (error) {
      console.error(`Error rendering chart ${canvasId}:`, error);
      return null;
    }
  };

  // Fetch dashboard statistics (dummy data for now)
  const fetchDashboardData = async () => {
    try {
      // TODO: Replace with actual API calls when backend endpoints are available
      const dummyData = {
        totalUsers: Math.floor(Math.random() * 200) + 50,
        activeUsers: Math.floor(Math.random() * 150) + 30,
        googleAccounts: Math.floor(Math.random() * 50),
        scheduledForDeletionUsers: Math.floor(Math.random() * 10),
        permanentlyDeletedUsers: Math.floor(Math.random() * 5),
        reRegisteredUsers: Math.floor(Math.random() * 5),
        restoredAccounts: Math.floor(Math.random() * 3),
        bannedUsers: Math.floor(Math.random() * 10),
        newUsersMonth: Math.floor(Math.random() * 30) + 5,
        deletedUsersMonth: Math.floor(Math.random() * 10),
        userGrowthRate: `+${(Math.random() * 10).toFixed(1)}%`,
        avgUserLifetime: `${Math.floor(Math.random() * 300) + 60} days`,
      };

      setStats(dummyData);
      
      // Update DOM elements
      Object.keys(dummyData).forEach(key => {
        const elementId = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        const element = document.getElementById(elementId);
        if (element) {
          element.innerText = dummyData[key];
        }
      });
      
      console.log("AdminDashboard: Dashboard data updated with dummy values.");
    } catch (error) {
      console.error('AdminDashboard: Failed to fetch dashboard data:', error);
      // Set error placeholders
      const placeholders = document.querySelectorAll('.dashboard-grid p, .dashboard-grid-2 p');
      placeholders.forEach(p => p.innerText = 'Error');
    }
  };

  // Fetch and render chart data
  const fetchChartDataAndRender = async () => {
    try {
      // TODO: Replace with actual API calls
      const roleDistributionData = {
        labels: ['Admin', 'User', 'Business Admin'],
        datasets: [{
          label: 'Role Distribution',
          data: [5, 150, 25],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
        }]
      };

      const verificationStatusData = {
        labels: ['Verified', 'Unverified'],
        datasets: [{
          label: 'Verification Status',
          data: [120, 60],
          backgroundColor: ['#4BC0C0', '#FF9F40']
        }]
      };

      const topCountriesData = {
        labels: ['USA', 'India', 'UK', 'Canada', 'Germany'],
        datasets: [{
          label: 'Top Countries',
          data: [70, 45, 30, 20, 15],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
        }]
      };

      const userProgressData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'User Registrations',
          data: [10, 15, 12, 18, 22, 30],
          borderColor: '#36A2EB',
          fill: false,
          tension: 0.1
        }]
      };

      const newCharts = {};
      newCharts.roleChart = renderChart('role-distribution-chart', 'doughnut', roleDistributionData);
      newCharts.verificationChart = renderChart('verification-status-chart', 'pie', verificationStatusData);
      newCharts.countriesChart = renderChart('top-countries-chart', 'bar', topCountriesData);
      newCharts.progressChart = renderChart('user-progress-chart', 'line', userProgressData);
      
      setCharts(newCharts);
      console.log("AdminDashboard: Charts rendered with dummy data.");
    } catch (error) {
      console.error("AdminDashboard: Failed to fetch chart data:", error);
    }
  };

  useEffect(() => {
    // AdminRoute already handles verification, so we can directly fetch data
    console.log('AdminDashboard: Component mounted, fetching data.');
    fetchDashboardData();
    fetchChartDataAndRender();
    
    return () => {
      // Clean up charts on unmount
      Object.values(charts).forEach(chartInstance => {
        if (chartInstance && typeof chartInstance.destroy === 'function') {
          chartInstance.destroy();
        }
      });
    };
  }, []); // Empty dependency array is correct here - we only want to run on mount

  return (
    <div className="newmain-content33">
      <div className="table-header-container">
        <div className="table-header">
          <h1 className="b_admin_styling-title">Platform Overview & Statistics</h1>
          <p className="chat-subtitle">Key metrics and trends across the platform</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-user-3-line"></i></div><div className="admin-stat-content"><h3 id="total-users">--</h3><p>Total Users</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-user-follow-line"></i></div><div className="admin-stat-content"><h3 id="active-users">--</h3><p>Active Users</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-google-line"></i></div><div className="admin-stat-content"><h3 id="google-accounts">--</h3><p>Google Accounts</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-time-line"></i></div><div className="admin-stat-content"><h3 id="new-users-month">--</h3><p>New Users (Last Month)</p></div></div>
      </div>

      {/* Secondary KPIs */}
      <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-delete-bin-6-line"></i></div><div className="admin-stat-content"><h3 id="deleted-users-month">--</h3><p>Deleted (Last Month)</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-shield-user-line"></i></div><div className="admin-stat-content"><h3 id="banned-users">--</h3><p>Banned Users</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-line-chart-line"></i></div><div className="admin-stat-content"><h3 id="user-growth-rate">--</h3><p>Growth Rate</p></div></div>
        <div className="admin-stat-card"><div className="admin-stat-icon"><i className="ri-hourglass-2-line"></i></div><div className="admin-stat-content"><h3 id="avg-user-lifetime">--</h3><p>Avg. Lifetime</p></div></div>
          </div>

      {/* Charts Row */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="b_admin_styling-card">
          <h3 style={{ marginTop: 0 }}>Role Distribution</h3>
          <div className="inner-chart-container"><canvas id="role-distribution-chart"></canvas></div>
        </div>
        <div className="b_admin_styling-card">
          <h3 style={{ marginTop: 0 }}>Verification Status</h3>
          <div className="inner-chart-container"><canvas id="verification-status-chart"></canvas></div>
        </div>
        <div className="b_admin_styling-card">
          <h3 style={{ marginTop: 0 }}>Top Countries</h3>
          <div className="inner-chart-container"><canvas id="top-countries-chart"></canvas></div>
        </div>
      </div>

      <div className="b_admin_styling-card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginTop: 0 }}>User Progress</h3>
        <canvas id="user-progress-chart"></canvas>
      </div>

      <div className="b_admin_styling-card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Login Activity Heatmap (Last 7 Days)</h3>
        <div id="login-activity-heatmap"></div>
      </div>
    </div>
  );
};

export default AdminDashboard;
