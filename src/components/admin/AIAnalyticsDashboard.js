import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { authAPI } from '../../services/apiClient';
import '../../styles/b_admin_styling.css';
import './AdminLayout.css';
import BButton from './ui/BButton';
import BLoading from './ui/BLoading';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BAdminTable from './ui/BAdminTable';
import { toast } from 'react-hot-toast';

const AIAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [costTrends, setCostTrends] = useState([]);
  const [charts, setCharts] = useState({});
  const [dateRange, setDateRange] = useState('30'); // days
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    operation_type: '',
    status: '',
    user_id: '',
    business_id: ''
  });

  // Fetch analytics summary
  const fetchSummary = async () => {
    try {
      const days = parseInt(dateRange);
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const response = await authAPI.get('/super-admin/ai-tracking/summary', {
        params: {
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString()
        }
      });

      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching AI analytics summary:', error);
      toast.error('Failed to load AI analytics summary');
    }
  };

  // Fetch usage logs
  const fetchLogs = async () => {
    try {
      const days = parseInt(dateRange);
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const params = {
        page,
        per_page: 20,
        date_from: dateFrom.toISOString(),
        date_to: dateTo.toISOString(),
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) delete params[key];
      });

      const response = await authAPI.get('/super-admin/ai-tracking/logs', { params });
      
      setLogs(response.data.logs || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error fetching AI usage logs:', error);
      toast.error('Failed to load AI usage logs');
    }
  };

  // Fetch cost trends
  const fetchCostTrends = async () => {
    try {
      const response = await authAPI.get('/super-admin/ai-tracking/cost-trends', {
        params: { days: parseInt(dateRange) }
      });

      setCostTrends(response.data.daily_trends || []);
    } catch (error) {
      console.error('Error fetching cost trends:', error);
      toast.error('Failed to load cost trends');
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSummary(),
        fetchLogs(),
        fetchCostTrends()
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Render charts
  const renderCharts = () => {
    if (!summary) return;

    try {
      // Destroy existing charts
      Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });

      const newCharts = {};

      // Operations by Type Chart
      const operationsCtx = document.getElementById('operations-by-type-chart');
      if (operationsCtx && summary.operations_by_type) {
        const existingChart = Chart.getChart(operationsCtx);
        if (existingChart) existingChart.destroy();

        newCharts.operations = new Chart(operationsCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(summary.operations_by_type),
            datasets: [{
              data: Object.values(summary.operations_by_type),
              backgroundColor: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: { size: 11 },
                  padding: 10
                }
              }
            }
          }
        });
      }

      // Status Distribution Chart
      const statusCtx = document.getElementById('status-distribution-chart');
      if (statusCtx && summary.operations_by_status) {
        const existingChart = Chart.getChart(statusCtx);
        if (existingChart) existingChart.destroy();

        newCharts.status = new Chart(statusCtx, {
          type: 'pie',
          data: {
            labels: Object.keys(summary.operations_by_status),
            datasets: [{
              data: Object.values(summary.operations_by_status),
              backgroundColor: ['#4BC0C0', '#36A2EB', '#FF6384', '#FFCE56', '#9966FF']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  font: { size: 11 },
                  padding: 10
                }
              }
            }
          }
        });
      }

      // Cost Trends Chart
      const trendsCtx = document.getElementById('cost-trends-chart');
      if (trendsCtx && costTrends.length > 0) {
        const existingChart = Chart.getChart(trendsCtx);
        if (existingChart) existingChart.destroy();

        newCharts.trends = new Chart(trendsCtx, {
          type: 'line',
          data: {
            labels: costTrends.map(t => new Date(t.date).toLocaleDateString()),
            datasets: [{
              label: 'Daily Cost (USD)',
              data: costTrends.map(t => t.total_cost),
              borderColor: '#36A2EB',
              backgroundColor: 'rgba(54, 162, 235, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + value.toFixed(2);
                  }
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return 'Cost: $' + context.parsed.y.toFixed(4);
                  }
                }
              }
            }
          }
        });
      }

      // Top Users Chart
      const usersCtx = document.getElementById('top-users-chart');
      if (usersCtx && summary.top_users && summary.top_users.length > 0) {
        const existingChart = Chart.getChart(usersCtx);
        if (existingChart) existingChart.destroy();

        newCharts.topUsers = new Chart(usersCtx, {
          type: 'bar',
          data: {
            labels: summary.top_users.map(u => u.username),
            datasets: [{
              label: 'Total Cost (USD)',
              data: summary.top_users.map(u => u.total_cost),
              backgroundColor: '#FF6384'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + value.toFixed(2);
                  }
                }
              }
            }
          }
        });
      }

      setCharts(newCharts);
    } catch (error) {
      console.error('Error rendering charts:', error);
    }
  };

  // Export data
  const handleExport = async () => {
    try {
      const days = parseInt(dateRange);
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const response = await authAPI.get('/super-admin/ai-tracking/export', {
        params: {
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString(),
          format: 'csv'
        },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_usage_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange, page, filters]);

  useEffect(() => {
    if (summary && costTrends.length > 0) {
      renderCharts();
    }

    return () => {
      Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });
    };
  }, [summary, costTrends]);

  if (loading && !summary) {
    return <BLoading variant="page" label="Loading AI analytics..." />;
  }

  return (
    <div className="newmain-content33">
      <div className="table-header-container">
        <div className="table-header">
          <h1 className="b_admin_styling-title">AI Usage Analytics</h1>
          <p className="chat-subtitle">Track AI operations, costs, and performance metrics</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="b_admin_styling-input b_admin_styling-input--compact"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
          <BButton onClick={handleExport} variant="secondary" size="sm">
            <i className="ri-download-line"></i> Export CSV
          </BButton>
          <BButton onClick={loadData} variant="primary" size="sm">
            <i className="ri-refresh-line"></i> Refresh
          </BButton>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-cpu-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.total_operations}</h3>
              <p>Total Operations</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
            <div className="admin-stat-content">
              <h3>${summary.summary.total_cost.toFixed(2)}</h3>
              <p>Total Cost</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-token-swap-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.total_tokens.toLocaleString()}</h3>
              <p>Total Tokens</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-time-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.average_processing_time.toFixed(2)}s</h3>
              <p>Avg Processing Time</p>
            </div>
          </div>
        </div>
      )}

      {/* Survey Generation Stats */}
      {summary && (
        <div className="admin-stats-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-file-list-3-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.total_surveys_generated}</h3>
              <p>Surveys Generated</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-save-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.surveys_saved}</h3>
              <p>Surveys Saved</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-delete-bin-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.surveys_discarded}</h3>
              <p>Surveys Discarded</p>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon"><i className="ri-percent-line"></i></div>
            <div className="admin-stat-content">
              <h3>{summary.summary.save_rate.toFixed(1)}%</h3>
              <p>Save Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '24px' }}>
        <div className="b_admin_styling-card">
          <h3 style={{ marginTop: 0 }}>Operations by Type</h3>
          <div className="inner-chart-container">
            <canvas id="operations-by-type-chart"></canvas>
          </div>
        </div>
        <div className="b_admin_styling-card">
          <h3 style={{ marginTop: 0 }}>Status Distribution</h3>
          <div className="inner-chart-container">
            <canvas id="status-distribution-chart"></canvas>
          </div>
        </div>
      </div>

      {/* Cost Trends */}
      <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Cost Trends</h3>
        <canvas id="cost-trends-chart" style={{ maxHeight: '300px' }}></canvas>
      </div>

      {/* Top Users */}
      {summary && summary.top_users && summary.top_users.length > 0 && (
        <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Top Users by Cost</h3>
          <canvas id="top-users-chart" style={{ maxHeight: '300px' }}></canvas>
        </div>
      )}

      {/* Usage Logs Table */}
      <div className="b_admin_styling-card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>AI Usage Logs</h3>
        
        <BFilterBar>
          <BFilterControl label="Operation Type" htmlFor="operationType">
            <select
              id="operationType"
              className="b_admin_styling-input b_admin_styling-input--compact"
              value={filters.operation_type}
              onChange={(e) => setFilters({...filters, operation_type: e.target.value})}
            >
              <option value="">All Types</option>
              <option value="quick_survey_create">Quick Survey Create</option>
              <option value="guided_short_survey">Guided Short Survey</option>
              <option value="guided_balanced_survey">Guided Balanced Survey</option>
              <option value="guided_deep_survey">Guided Deep Survey</option>
              <option value="ai_insights_report">AI Insights Report</option>
              <option value="response_generation">Response Generation</option>
            </select>
          </BFilterControl>
          
          <BFilterControl label="Status" htmlFor="status">
            <select
              id="status"
              className="b_admin_styling-input b_admin_styling-input--compact"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
            </select>
          </BFilterControl>
        </BFilterBar>

        {loading && <BLoading variant="page" label="Loading logs..." />}
        
        {!loading && (
          <>
            <BAdminTable headers={["ID", "Operation", "Status", "User", "Cost", "Tokens", "Time", "Date"]}>
              {logs.length > 0 ? logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>
                    <span style={{ fontSize: '0.9em' }}>
                      {log.operation_type?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${
                      log.status === 'completed' ? 'success' : 
                      log.status === 'failed' ? 'danger' : 
                      log.status === 'processing' ? 'warning' : 'secondary'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td>{log.user?.username || 'N/A'}</td>
                  <td>${log.estimated_cost?.toFixed(4) || '0.0000'}</td>
                  <td>{log.tokens_used || 0}</td>
                  <td>{log.processing_time_seconds ? `${log.processing_time_seconds.toFixed(2)}s` : 'N/A'}</td>
                  <td style={{ fontSize: '0.85em' }}>
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="admin-empty-state">No logs found for selected filters</td>
                </tr>
              )}
            </BAdminTable>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '12px',
                marginTop: '20px'
              }}>
                <BButton 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  size="sm"
                  variant="secondary"
                >
                  Previous
                </BButton>
                <span>Page {page} of {totalPages}</span>
                <BButton 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  size="sm"
                  variant="secondary"
                >
                  Next
                </BButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIAnalyticsDashboard;


