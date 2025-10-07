import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'chart.js/auto';
import Sidebar from '../common/Sidebar';
import { aiService } from '../../services/aiService';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css'; 
import './AdminTables.css';
import '../../styles/b_admin_styling.css';
import './AIUsageAnalytics.css';
import BButton from './ui/BButton';
import BFilterBar from './ui/BFilterBar';
import BFilterControl from './ui/BFilterControl';
import BAdminTable from './ui/BAdminTable';
import BKebabMenu from './ui/BKebabMenu';
import BLoading from './ui/BLoading';

const AIUsageAnalytics = () => {
    const navigate = useNavigate();
    const [dashboardStats, setDashboardStats] = useState(null);
    const [detailedLogs, setDetailedLogs] = useState([]);
    const [businessSummary, setBusinessSummary] = useState([]);
    const [costBreakdown, setCostBreakdown] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [filters, setFilters] = useState({
        operation_type: '',
        success: '',
        date_from: '',
        date_to: ''
    });
    const [activeTab, setActiveTab] = useState('overview');

    // Chart rendering removed - no longer needed

    const fetchDashboardStats = useCallback(async () => {
        try {
            const response = await aiService.getAIUsageDashboardStats();
            setDashboardStats(response.data);
        } catch (error) {
            console.error("Error fetching AI usage dashboard stats:", error);
            toast.error(error.message || 'Failed to load AI usage statistics.');
        }
    }, []);

    const fetchDetailedLogs = useCallback(async (page = 1) => {
        setLogsLoading(true);
        try {
            const response = await aiService.getAIUsageDetailedLogs(page, 20, filters);
            setDetailedLogs(response.data.logs || []);
            setPagination(response.data.pagination);
            setCurrentPage(page);
        } catch (error) {
            console.error("Error fetching AI usage detailed logs:", error);
            toast.error(error.message || 'Failed to load AI usage logs.');
        } finally {
            setLogsLoading(false);
        }
    }, [filters]);

    const fetchBusinessSummary = useCallback(async () => {
        try {
            const response = await aiService.getBusinessAIUsageSummary();
            setBusinessSummary(response.data.business_usage || []);
        } catch (error) {
            console.error("Error fetching business AI usage summary:", error);
            toast.error(error.message || 'Failed to load business usage summary.');
        }
    }, []);

    // Charts data fetching removed - no longer needed

    const fetchCostBreakdown = useCallback(async () => {
        try {
            const response = await aiService.getOpenAICostBreakdown();
            setCostBreakdown(response.data);
        } catch (error) {
            console.error("Error fetching OpenAI cost breakdown:", error);
            toast.error(error.message || 'Failed to load cost breakdown.');
        }
    }, []);

    const renderCharts = (data) => {
        if (!data) return;

        const newCharts = {};

        // Remove daily usage chart as it's not needed

        // Operation distribution chart
        if (data.operation_distribution && data.operation_distribution.length > 0) {
            const operationData = {
                labels: data.operation_distribution.map(item => item.operation_type.replace('_', ' ').toUpperCase()),
                datasets: [{
                    data: data.operation_distribution.map(item => item.count),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                }]
            };

            newCharts.operationDistribution = renderChart('operation-distribution-chart', 'doughnut', operationData);
        }

        // Survey type distribution chart
        if (data.survey_type_distribution && data.survey_type_distribution.length > 0) {
            const surveyTypeData = {
                labels: data.survey_type_distribution.map(item => item.generation_type.toUpperCase()),
                datasets: [{
                    data: data.survey_type_distribution.map(item => item.count),
                    backgroundColor: ['#FF9F40', '#4BC0C0', '#9966FF', '#FF6384']
                }]
            };

            newCharts.surveyTypeDistribution = renderChart('survey-type-distribution-chart', 'pie', surveyTypeData);
        }

        // Remove success rate trend chart as it's not needed

        setCharts(newCharts);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchDashboardStats(),
                fetchDetailedLogs(1),
                fetchBusinessSummary(),
                fetchCostBreakdown()
            ]);
            setLoading(false);
        };

        loadData();

        return () => {
            // Cleanup function - charts removed
        };
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchDetailedLogs(1);
        }
    }, [filters, fetchDetailedLogs]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setCurrentPage(1);
    };

    const handlePageChange = (page) => {
        fetchDetailedLogs(page);
    };

    const formatOperationType = (type) => {
        return type.replace('_', ' ').toUpperCase();
    };

    const formatOperationSubtype = (subtype) => {
        if (!subtype) return '-';
        return subtype.replace('_', ' ').toUpperCase();
    };

    const getStatusBadge = (success) => {
        return success ? (
            <span className="badge badge-success">Success</span>
        ) : (
            <span className="badge badge-error">Failed</span>
        );
    };

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33">
                    <BLoading variant="page" label="Loading AI usage analytics..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 b_admin_styling-main ai-analytics" style={{ paddingRight: '25px' }}>
                <div className="b_admin_styling-header">
                    <div>
                        <h1 className="b_admin_styling-title">AI Usage Analytics</h1>
                        <p className="chat-subtitle" style={{ margin: 0 }}>Comprehensive AI operations tracking and cost analysis.</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="tab-navigation" style={{ marginBottom: '24px' }}>
                    <button 
                        className={`tab-button1 ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button 
                        className={`tab-button1 ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Detailed Logs
                    </button>
                    <button 
                        className={`tab-button1 ${activeTab === 'businesses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('businesses')}
                    >
                        Business Usage
                    </button>
                    <button 
                        className={`tab-button1 ${activeTab === 'costs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('costs')}
                    >
                        OpenAI Costs
                    </button>
                </div>

                {activeTab === 'overview' && dashboardStats && (
                    <>
                        {/* AI Usage KPI Cards */}
                        <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-file-text-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.total_surveys_generated}</h3>
                                    <p>Total Surveys Generated</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-calendar-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.surveys_generated_last_30_days}</h3>
                                    <p>Surveys (30 Days)</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-today-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.surveys_generated_today}</h3>
                                    <p>Surveys Today</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-bar-chart-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.total_analytics_reports}</h3>
                                    <p>Analytics Reports</p>
                                </div>
                            </div>
                        </div>

                        {/* Secondary KPIs */}
                        <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-save-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.survey_generation.surveys_saved}</h3>
                                    <p>Surveys Saved</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-delete-bin-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.survey_generation.surveys_discarded}</h3>
                                    <p>Surveys Discarded</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-database-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.total_response_generations}</h3>
                                    <p>Response Generations</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-calendar-check-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>{dashboardStats.overview.analytics_reports_last_30_days}</h3>
                                    <p>Reports (30 Days)</p>
                                </div>
                            </div>
                        </div>

                        {/* OpenAI Cost KPIs */}
                        <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>${dashboardStats.overview.total_openai_cost_usd?.toFixed(4) || '0.0000'}</h3>
                                    <p>Total OpenAI Cost</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-calendar-check-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>${dashboardStats.overview.openai_cost_last_30_days?.toFixed(4) || '0.0000'}</h3>
                                    <p>Cost (30 Days)</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-today-fill"></i></div>
                                <div className="admin-stat-content">
                                    <h3>${dashboardStats.overview.openai_cost_today?.toFixed(4) || '0.0000'}</h3>
                                    <p>Cost Today</p>
                                </div>
                            </div>
                            <div className="admin-stat-card">
                                <div className="admin-stat-icon"><i className="ri-calculator-line"></i></div>
                                <div className="admin-stat-content">
                                    <h3>${((dashboardStats.overview.openai_cost_last_30_days || 0) / 30).toFixed(4)}</h3>
                                    <p>Avg Daily Cost</p>
                                </div>
                            </div>
                        </div>

                        {/* Charts removed from overview - keeping only essential data */}

                        {/* Super Admin Operations */}
                        {dashboardStats.super_admin_operations && (
                            <div className="b_admin_styling-card">
                                <h3 style={{ marginTop: 0 }}>
                                    <i className="ri-shield-star-line" style={{ marginRight: '8px' }}></i>
                                    Super Admin Operations (No Business Context)
                                </h3>
                                <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                    <div className="admin-stat-card">
                                        <div className="admin-stat-icon"><i className="ri-robot-line"></i></div>
                                        <div className="admin-stat-content">
                                            <h3>{dashboardStats.super_admin_operations.total_operations}</h3>
                                            <p>Total Operations</p>
                                        </div>
                                    </div>
                                    <div className="admin-stat-card">
                                        <div className="admin-stat-icon"><i className="ri-money-dollar-circle-line"></i></div>
                                        <div className="admin-stat-content">
                                            <h3>${dashboardStats.super_admin_operations.total_openai_cost_usd?.toFixed(4) || '0.0000'}</h3>
                                            <p>Total OpenAI Cost</p>
                                        </div>
                                    </div>
                                </div>
                                <p style={{ marginTop: '12px', fontSize: '0.9em', color: '#666', fontStyle: 'italic' }}>
                                    These are AI operations performed by super admins without a specific business context.
                                </p>
                            </div>
                        )}

                        {/* Top Businesses */}
                        {dashboardStats.top_businesses && dashboardStats.top_businesses.length > 0 && (
                            <div className="b_admin_styling-card">
                                <h3 style={{ marginTop: 0 }}>Top AI Users</h3>
                                <BAdminTable headers={["Business", "Operations", "OpenAI Cost (USD)"]}>
                                    {dashboardStats.top_businesses.map((business, index) => (
                                        <tr key={index}>
                                            <td>{business.name}</td>
                                            <td>{business.operations}</td>
                                            <td>${(business.openai_cost_usd || 0).toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </BAdminTable>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'logs' && (
                    <>
                        {/* Filters */}
                        <BFilterBar>
                            <BFilterControl label="Operation Type" htmlFor="operationType">
                                <select
                                    id="operationType"
                                    className="b_admin_styling-input b_admin_styling-input--compact"
                                    value={filters.operation_type}
                                    onChange={(e) => handleFilterChange('operation_type', e.target.value)}
                                >
                                    <option value="">All Types</option>
                                    <option value="survey_generation">Survey Generation</option>
                                    <option value="analytics_report">Analytics Report</option>
                                    <option value="response_generation">Response Generation</option>
                                </select>
                            </BFilterControl>
                            <BFilterControl label="Status" htmlFor="status">
                                <select
                                    id="status"
                                    className="b_admin_styling-input b_admin_styling-input--compact"
                                    value={filters.success}
                                    onChange={(e) => handleFilterChange('success', e.target.value)}
                                >
                                    <option value="">All Status</option>
                                    <option value="true">Success</option>
                                    <option value="false">Failed</option>
                                </select>
                            </BFilterControl>
                            <BFilterControl label="Date From" htmlFor="dateFrom">
                                <input
                                    id="dateFrom"
                                    type="date"
                                    className="b_admin_styling-input b_admin_styling-input--compact"
                                    value={filters.date_from}
                                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                                />
                            </BFilterControl>
                            <BFilterControl label="Date To" htmlFor="dateTo">
                                <input
                                    id="dateTo"
                                    type="date"
                                    className="b_admin_styling-input b_admin_styling-input--compact"
                                    value={filters.date_to}
                                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                                />
                            </BFilterControl>
                        </BFilterBar>

                        {/* Detailed Logs Table */}
                        {logsLoading ? (
                            <BLoading variant="table" label="Loading logs..." />
                        ) : (
                            <>
                                <BAdminTable headers={["Date", "Business", "Operation", "Subtype", "OpenAI Cost", "Status", "Survey ID"]}>
                                    {detailedLogs.length > 0 ? detailedLogs.map((log) => (
                                        <tr key={log.id}>
                                            <td>{new Date(log.created_at).toLocaleDateString()}</td>
                                            <td>
                                                {log.business_name || (
                                                    <span style={{ fontStyle: 'italic', color: '#888' }}>
                                                        <i className="ri-shield-star-line" style={{ marginRight: '4px' }}></i>
                                                        Super Admin
                                                    </span>
                                                )}
                                            </td>
                                            <td>{formatOperationType(log.operation_type)}</td>
                                            <td>{formatOperationSubtype(log.operation_subtype)}</td>
                                            <td>${(log.openai_cost_usd || 0).toFixed(4)}</td>
                                            <td>{getStatusBadge(log.success)}</td>
                                            <td>{log.survey_id || '-'}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="7" className="admin-empty-state">No AI usage logs found.</td>
                                        </tr>
                                    )}
                                </BAdminTable>

                                {/* Pagination */}
                                {pagination && pagination.pages > 1 && (
                                    <div className="pagination-container">
                                        <button 
                                            className="pagination-btn"
                                            disabled={!pagination.has_prev}
                                            onClick={() => handlePageChange(currentPage - 1)}
                                        >
                                            Previous
                                        </button>
                                        <span className="pagination-info">
                                            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                                        </span>
                                        <button 
                                            className="pagination-btn"
                                            disabled={!pagination.has_next}
                                            onClick={() => handlePageChange(currentPage + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {activeTab === 'businesses' && (
                    <BAdminTable headers={["Business", "Total Operations", "OpenAI Cost (USD)", "Last Activity"]}>
                        {businessSummary.length > 0 ? businessSummary.map((business) => (
                            <tr key={business.business_id}>
                                <td>{business.business_name}</td>
                                <td>{business.total_operations}</td>
                                <td>${(business.openai_cost_usd || 0).toFixed(4)}</td>
                                <td>{business.last_activity ? new Date(business.last_activity).toLocaleDateString() : '-'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="admin-empty-state">No business usage data found.</td>
                            </tr>
                        )}
                    </BAdminTable>
                )}

                {activeTab === 'costs' && costBreakdown && (
                    <>
                        {/* Model Usage Statistics */}
                        <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                            <h3 style={{ marginTop: 0 }}>Model Usage & Costs</h3>
                            <BAdminTable headers={["Model", "Requests", "Total Cost (USD)", "Input Tokens", "Output Tokens", "Avg Cost/Request"]}>
                                {costBreakdown.model_usage?.length > 0 ? costBreakdown.model_usage.map((model, index) => (
                                    <tr key={index}>
                                        <td><strong>{model.model}</strong></td>
                                        <td>{model.request_count.toLocaleString()}</td>
                                        <td>${model.total_cost_usd.toFixed(6)}</td>
                                        <td>{model.total_input_tokens.toLocaleString()}</td>
                                        <td>{model.total_output_tokens.toLocaleString()}</td>
                                        <td>${model.avg_cost_per_request.toFixed(6)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" className="admin-empty-state">No model usage data found.</td>
                                    </tr>
                                )}
                            </BAdminTable>
                        </div>

                        {/* Operation Costs */}
                        <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                            <h3 style={{ marginTop: 0 }}>Cost by Operation Type</h3>
                            <BAdminTable headers={["Operation", "Subtype", "Requests", "Total Cost (USD)", "Avg Cost (USD)"]}>
                                {costBreakdown.operation_costs?.length > 0 ? costBreakdown.operation_costs.map((op, index) => (
                                    <tr key={index}>
                                        <td><strong>{op.operation_type.replace('_', ' ')}</strong></td>
                                        <td>{op.operation_subtype || '-'}</td>
                                        <td>{op.request_count.toLocaleString()}</td>
                                        <td>${op.total_cost_usd.toFixed(6)}</td>
                                        <td>${op.avg_cost_usd.toFixed(6)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="admin-empty-state">No operation cost data found.</td>
                                    </tr>
                                )}
                            </BAdminTable>
                        </div>

                        {/* Most Expensive Requests */}
                        <div className="b_admin_styling-card" style={{ marginBottom: '24px' }}>
                            <h3 style={{ marginTop: 0 }}>Most Expensive Requests</h3>
                            <BAdminTable headers={["Operation", "Model", "Cost (USD)", "Input Tokens", "Output Tokens", "Business", "Date"]}>
                                {costBreakdown.expensive_requests?.length > 0 ? costBreakdown.expensive_requests.map((req, index) => (
                                    <tr key={index}>
                                        <td><strong>{req.operation_type}</strong> {req.operation_subtype && `(${req.operation_subtype})`}</td>
                                        <td>{req.model_used || '-'}</td>
                                        <td>${req.cost_usd.toFixed(6)}</td>
                                        <td>{req.input_tokens?.toLocaleString() || '-'}</td>
                                        <td>{req.output_tokens?.toLocaleString() || '-'}</td>
                                        <td>
                                            {req.business_name || (
                                                <span style={{ fontStyle: 'italic', color: '#888' }}>
                                                    <i className="ri-shield-star-line" style={{ marginRight: '4px' }}></i>
                                                    Super Admin
                                                </span>
                                            )}
                                        </td>
                                        <td>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '-'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="admin-empty-state">No expensive request data found.</td>
                                    </tr>
                                )}
                            </BAdminTable>
                        </div>

                        {/* Pricing Information */}
                        <div className="b_admin_styling-card">
                            <h3 style={{ marginTop: 0 }}>OpenAI Pricing Reference</h3>
                            <BAdminTable headers={["Model", "Input (per 1K tokens)", "Output (per 1K tokens)", "Input (per 1M tokens)", "Output (per 1M tokens)"]}>
                                {costBreakdown.pricing_info && Object.entries(costBreakdown.pricing_info).map(([model, pricing]) => (
                                    <tr key={model}>
                                        <td><strong>{model}</strong></td>
                                        <td>{pricing.input_per_1k}</td>
                                        <td>{pricing.output_per_1k}</td>
                                        <td>{pricing.input_per_1m}</td>
                                        <td>{pricing.output_per_1m}</td>
                                    </tr>
                                ))}
                            </BAdminTable>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AIUsageAnalytics;
