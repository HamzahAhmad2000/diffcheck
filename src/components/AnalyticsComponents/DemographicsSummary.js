import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { useParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import './AnalyticsComponents.css'; // Ensure CSS is imported
import { analyticsAPI, surveyAPI } from 'services/apiClient';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Helper function to format time
const formatTime = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0) {
    return 'N/A';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
};

/**
 * DemographicsSummary - A component to display demographic information and key metrics for survey respondents
 */
const DemographicsSummary = ({ surveyId: propSurveyId, settings = {}, onDataLoaded, isPDFMode = false }) => {
  const { surveyId: paramSurveyId } = useParams();
  const surveyId = propSurveyId || paramSurveyId; // Use prop if provided, otherwise use param
  
  const [summaryData, setSummaryData] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token'); // Get token for auth

  // Default settings if not provided
  const {
    showAge = true,
    showGender = true,
    showLocation = true,
    showEducation = true,
    showCompanies = true,
    includeDemographicsInPDF = true
  } = settings;

  useEffect(() => {
    const fetchData = async () => {
      if (!surveyId || !token) {
        setError("Survey ID or authentication token is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setSummaryData(null);
      setDemographics(null);

      try {
        // Fetch Summary Data
        const summaryResponse = await analyticsAPI.getSummary(surveyId);
        const summary = summaryResponse.data;
        setSummaryData(summary);

        // Fetch Demographics Data
        const demographicsResponse = await surveyAPI.getDemographicAnalytics(surveyId, {});
        const demoData = demographicsResponse.data.demographics;
        setDemographics(demographicsResponse.data.demographics);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
        // Call onDataLoaded callback when data loading is complete
        if (onDataLoaded && typeof onDataLoaded === 'function') {
          setTimeout(() => onDataLoaded(), 100); // Small delay to ensure rendering
        }
      }
    };

    fetchData();
  }, [surveyId, token, onDataLoaded]);

  // --- Chart Data Preparation Functions ---

  // Calculate age statistics
  const getAgeStatistics = () => {
    if (!demographics || !demographics.age_groups) return null;

    // Map age group strings to numeric ranges for calculation
    const ageMapping = {
      "Under 18": 17,
      "18-24": 21,
      "25-34": 29.5,
      "35-44": 39.5,
      "45-54": 49.5,
      "55-64": 59.5,
      "65+": 70
    };

    let totalAge = 0;
    let totalCount = 0;
    let minAge = Infinity;
    let maxAge = -Infinity;

    Object.entries(demographics.age_groups).forEach(([ageGroup, data]) => {
      if (ageGroup !== "Unknown" && data.count > 0) {
        const ageValue = ageMapping[ageGroup];
        if (ageValue) {
          const count = data.count;
          totalAge += ageValue * count;
          totalCount += count;
          
          // Update min/max based on age group ranges
          if (ageGroup === "Under 18") {
            minAge = Math.min(minAge, 16); // Assume youngest is 16
            maxAge = Math.max(maxAge, 17);
          } else if (ageGroup === "65+") {
            minAge = Math.min(minAge, 65);
            maxAge = Math.max(maxAge, 85); // Assume oldest is reasonable
          } else {
            const [min, max] = ageGroup.split('-').map(Number);
            minAge = Math.min(minAge, min);
            maxAge = Math.max(maxAge, max);
          }
        }
      }
    });

    if (totalCount === 0) return null;

    return {
      average: Math.round(totalAge / totalCount),
      min: minAge === Infinity ? null : minAge,
      max: maxAge === -Infinity ? null : maxAge,
      totalCount
    };
  };

  // Create chart data for gender distribution
  const getGenderChartData = () => {
    if (!demographics || !demographics.genders) return { labels: [], datasets: [] };

    const genders = Object.keys(demographics.genders).filter(gender => 
      demographics.genders[gender]?.count > 0
    );
    
    const genderColors = {
      male: '#3498DB',
      female: '#E74C3C',
      nonbinary: '#9B59B6',
      other: '#F1C40F',
      prefer_not_to_say: '#95A5A6',
      unknown: '#BDC3C7'
    };

    return {
      labels: genders,
      datasets: [
        {
          data: genders.map(gender => demographics.genders[gender]?.count || 0),
          backgroundColor: genders.map(gender => 
            genderColors[gender.toLowerCase().replace(/ /g, '_')] || '#BDC3C7'
          ),
          borderColor: genders.map(gender => 
            genderColors[gender.toLowerCase().replace(/ /g, '_')] || '#BDC3C7'
          ),
          borderWidth: 1,
        },
      ],
    };
  };

  // Create chart data for location distribution (as pie chart)
  const getLocationChartData = () => {
    if (!demographics || !demographics.locations) return { labels: [], datasets: [] };

    // Sort locations by count and take top 8 to avoid overcrowding
    const sortedLocations = Object.entries(demographics.locations)
      .filter(([location, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);

    const locationColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#66FF66', '#FF66B3'
    ];

    return {
      labels: sortedLocations.map(([location]) => location),
      datasets: [
        {
          data: sortedLocations.map(([location, data]) => data.count),
          backgroundColor: locationColors,
          borderColor: locationColors,
          borderWidth: 1,
        },
      ],
    };
  };

  // Create chart data for education distribution
  const getEducationChartData = () => {
    if (!demographics || !demographics.education) return { labels: [], datasets: [] };

    const educationLevels = Object.keys(demographics.education).filter(education => 
      demographics.education[education]?.count > 0
    );
    
    const educationColors = [
      '#FF9F40', '#4BC0C0', '#9966FF', '#FF6384', '#36A2EB', '#FFCE56'
    ];

    return {
      labels: educationLevels,
      datasets: [
        {
          data: educationLevels.map(education => demographics.education[education]?.count || 0),
          backgroundColor: educationColors.slice(0, educationLevels.length),
          borderColor: educationColors.slice(0, educationLevels.length),
          borderWidth: 1,
        },
      ],
    };
  };

  // Create chart data for companies distribution (as bar chart for better readability)
  const getCompaniesChartData = () => {
    if (!demographics || !demographics.companies) return { labels: [], datasets: [] };

    // Sort companies by count and take top 10
    const sortedCompanies = Object.entries(demographics.companies)
      .filter(([company, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    return {
      labels: sortedCompanies.map(([company]) => company),
      datasets: [
        {
          label: 'Responses',
          data: sortedCompanies.map(([company, data]) => data.count),
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1,
        },
      ],
    };
  };

  // Chart options for pie charts (PDF optimized)
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isPDFMode ? 'right' : 'bottom',
        labels: {
          padding: isPDFMode ? 8 : 15,
          font: {
            size: isPDFMode ? 10 : 12
          },
          boxWidth: isPDFMode ? 12 : 20
        }
      },
      tooltip: {
        enabled: !isPDFMode, // Disable tooltips in PDF mode
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw;
            const dataset = context.dataset;
            const total = dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Chart options for bar charts (PDF optimized)
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: !isPDFMode, // Disable tooltips in PDF mode
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.raw} responses`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            size: isPDFMode ? 10 : 12
          }
        }
      },
      x: {
        ticks: {
          maxRotation: isPDFMode ? 30 : 45,
          minRotation: 0,
          font: {
            size: isPDFMode ? 9 : 12
          }
        }
      }
    }
  };

  // Loading and error states
  if (loading) {
    return (
      <div className="demographics-summary-page">
        <div className="demographics-loading">Loading demographics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="demographics-summary-page">
        <div className="demographics-error">Error: {error}</div>
      </div>
    );
  }

  if (!summaryData && !demographics) {
    return (
      <div className="demographics-summary-page">
        <div className="demographics-no-data">No data available for this survey.</div>
      </div>
    );
  }

  // Calculate metrics
  const started = summaryData?.total_started ?? 0;
  const completed = summaryData?.completed_responses ?? 0;
  const dropOff = started > 0 ? (((started - completed) / started) * 100) : 0;
  const apiDropOff = summaryData?.drop_off_rate?.toFixed(1) ?? dropOff.toFixed(1);

  const ageStats = getAgeStatistics();

  // PDF-specific inline styles
  const pdfStyles = isPDFMode ? {
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '10px',
      fontSize: '12px'
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '8px',
      marginBottom: '15px'
    },
    metricCard: {
      textAlign: 'center',
      padding: '8px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9'
    },
    metricValue: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#333'
    },
    metricLabel: {
      fontSize: '10px',
      color: '#666',
      marginTop: '4px'
    },
    chartsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '15px',
      marginTop: '15px'
    },
    chartBox: {
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '10px',
      backgroundColor: 'white'
    },
    chartTitle: {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '8px',
      textAlign: 'center',
      color: '#333'
    },
    chartWrapper: {
      height: '200px',
      position: 'relative'
    },
    ageStatsContainer: {
      display: 'flex',
      justifyContent: 'space-around',
      padding: '10px 0'
    },
    ageStatItem: {
      textAlign: 'center'
    },
    ageStatValue: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#333'
    },
    ageStatLabel: {
      fontSize: '10px',
      color: '#666',
      marginTop: '4px'
    },
    companiesChartBox: {
      gridColumn: 'span 2' // Companies chart spans full width
    }
  } : {};

  return (
    <div 
      className="demographics-summary-page"
      style={isPDFMode ? pdfStyles.container : {}}
    >
      {/* Key Metrics Section */}
      <div 
        className="metrics-grid"
        style={isPDFMode ? pdfStyles.metricsGrid : {}}
      >
        <div 
          className="metric-card"
          style={isPDFMode ? pdfStyles.metricCard : {}}
        >
          <div 
            className="metric-value"
            style={isPDFMode ? pdfStyles.metricValue : {}}
          >
            {summaryData?.total_responses ?? 'N/A'}
          </div>
          <div 
            className="metric-label"
            style={isPDFMode ? pdfStyles.metricLabel : {}}
          >
            Completed Responses
          </div>
        </div>
        <div 
          className="metric-card"
          style={isPDFMode ? pdfStyles.metricCard : {}}
        >
          <div 
            className="metric-value"
            style={isPDFMode ? pdfStyles.metricValue : {}}
          >
            {started}
          </div>
          <div 
            className="metric-label"
            style={isPDFMode ? pdfStyles.metricLabel : {}}
          >
            Total Started
          </div>
        </div>
        <div 
          className="metric-card"
          style={isPDFMode ? pdfStyles.metricCard : {}}
        >
          <div 
            className="metric-value"
            style={isPDFMode ? pdfStyles.metricValue : {}}
          >
            {completed}
          </div>
          <div 
            className="metric-label"
            style={isPDFMode ? pdfStyles.metricLabel : {}}
          >
            Total Completed
          </div>
        </div>
        <div 
          className="metric-card"
          style={isPDFMode ? pdfStyles.metricCard : {}}
        >
          <div 
            className="metric-value"
            style={isPDFMode ? pdfStyles.metricValue : {}}
          >
            {apiDropOff}%
          </div>
          <div 
            className="metric-label"
            style={isPDFMode ? pdfStyles.metricLabel : {}}
          >
            Drop-off Rate
          </div>
        </div>
        <div 
          className="metric-card"
          style={isPDFMode ? pdfStyles.metricCard : {}}
        >
          <div 
            className="metric-value"
            style={isPDFMode ? pdfStyles.metricValue : {}}
          >
            {formatTime(summaryData?.average_completion_time)}
          </div>
          <div 
            className="metric-label"
            style={isPDFMode ? pdfStyles.metricLabel : {}}
          >
            Avg. Completion Time
          </div>
        </div>
      </div>

      {/* Demographics Section */}
      {!demographics ? (
        <div className="demographics-no-data">No demographic data available for this survey.</div>
      ) : (
        <div 
          className="demographics-summary-container"
          style={isPDFMode ? pdfStyles.chartsContainer : {}}
        >
          {/* Age Statistics */}
          {showAge && ageStats && (
            <div 
              className="demographics-chart-box"
              style={isPDFMode ? pdfStyles.chartBox : {}}
            >
              <h3 
                className="demographics-chart-title"
                style={isPDFMode ? pdfStyles.chartTitle : {}}
              >
                Age Statistics
              </h3>
              <div 
                className="age-stats-container"
                style={isPDFMode ? pdfStyles.ageStatsContainer : {}}
              >
                <div 
                  className="age-stat-item"
                  style={isPDFMode ? pdfStyles.ageStatItem : {}}
                >
                  <div 
                    className="age-stat-value"
                    style={isPDFMode ? pdfStyles.ageStatValue : {}}
                  >
                    {ageStats.min || 'N/A'}
                  </div>
                  <div 
                    className="age-stat-label"
                    style={isPDFMode ? pdfStyles.ageStatLabel : {}}
                  >
                    Minimum Age
                  </div>
                </div>
                <div 
                  className="age-stat-item"
                  style={isPDFMode ? pdfStyles.ageStatItem : {}}
                >
                  <div 
                    className="age-stat-value"
                    style={isPDFMode ? pdfStyles.ageStatValue : {}}
                  >
                    {ageStats.max || 'N/A'}
                  </div>
                  <div 
                    className="age-stat-label"
                    style={isPDFMode ? pdfStyles.ageStatLabel : {}}
                  >
                    Maximum Age
                  </div>
                </div>
                <div 
                  className="age-stat-item"
                  style={isPDFMode ? pdfStyles.ageStatItem : {}}
                >
                  <div 
                    className="age-stat-value"
                    style={isPDFMode ? pdfStyles.ageStatValue : {}}
                  >
                    {ageStats.average || 'N/A'}
                  </div>
                  <div 
                    className="age-stat-label"
                    style={isPDFMode ? pdfStyles.ageStatLabel : {}}
                  >
                    Average Age
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gender Chart */}
          {showGender && demographics.genders && (
            <div 
              className="demographics-chart-box"
              style={isPDFMode ? pdfStyles.chartBox : {}}
            >
              <h3 
                className="demographics-chart-title"
                style={isPDFMode ? pdfStyles.chartTitle : {}}
              >
                Gender Distribution
              </h3>
              <div 
                className="demographics-chart-wrapper pie-container"
                style={isPDFMode ? pdfStyles.chartWrapper : {}}
              >
                <Pie data={getGenderChartData()} options={pieChartOptions} />
              </div>
            </div>
          )}

          {/* Location Chart */}
          {showLocation && demographics.locations && (
            <div 
              className="demographics-chart-box"
              style={isPDFMode ? pdfStyles.chartBox : {}}
            >
              <h3 
                className="demographics-chart-title"
                style={isPDFMode ? pdfStyles.chartTitle : {}}
              >
                Location Distribution
              </h3>
              <div 
                className="demographics-chart-wrapper pie-container"
                style={isPDFMode ? pdfStyles.chartWrapper : {}}
              >
                <Pie data={getLocationChartData()} options={pieChartOptions} />
              </div>
            </div>
          )}

          {/* Education Chart */}
          {showEducation && demographics.education && (
            <div 
              className="demographics-chart-box"
              style={isPDFMode ? pdfStyles.chartBox : {}}
            >
              <h3 
                className="demographics-chart-title"
                style={isPDFMode ? pdfStyles.chartTitle : {}}
              >
                Education Distribution
              </h3>
              <div 
                className="demographics-chart-wrapper pie-container"
                style={isPDFMode ? pdfStyles.chartWrapper : {}}
              >
                <Pie data={getEducationChartData()} options={pieChartOptions} />
              </div>
            </div>
          )}

          {/* Companies Chart */}
          {showCompanies && demographics.companies && (
            <div 
              className="demographics-chart-box"
              style={isPDFMode ? { ...pdfStyles.chartBox, ...pdfStyles.companiesChartBox } : {}}
            >
              <h3 
                className="demographics-chart-title"
                style={isPDFMode ? pdfStyles.chartTitle : {}}
              >
                Company Distribution
              </h3>
              <div 
                className="demographics-chart-wrapper bar-container"
                style={isPDFMode ? pdfStyles.chartWrapper : {}}
              >
                <Bar data={getCompaniesChartData()} options={barChartOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DemographicsSummary;