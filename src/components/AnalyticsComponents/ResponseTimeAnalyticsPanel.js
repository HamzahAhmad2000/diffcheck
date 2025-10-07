import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import './AnalyticsComponents.css';
import { useParams } from 'react-router-dom';
import { analyticsAPI , surveyAPI} from 'services/apiClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * A production-level panel that fetches advanced response time data 
 * and displays a distribution histogram & question-level times.
 */
export default function ResponseTimeAnalyticsPanel() {
  const {surveyId} = useParams();
  const [filtersJSON, setFiltersJSON] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    setAnalytics(null);
    let parsedFilters = {};
    if (filtersJSON.trim()) {
      try {
        parsedFilters = JSON.parse(filtersJSON);
      } catch (err) {
        setError('Invalid JSON in filters');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await surveyAPI.getResponseTimesAdvanced(surveyId, parsedFilters);
      
      const dat = res.data;
      setAnalytics(dat);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setLoading(false);
    }
  };

  let histogramChart = null;
  let questionTimesTable = null;

  if (analytics && !analytics.error) {
    // Build a bar chart for duration_histogram
    const labels = Object.keys(analytics.duration_histogram);
    const counts = Object.values(analytics.duration_histogram);
    const barData = {
      labels,
      datasets: [
        {
          label: 'Number of Submissions',
          data: counts,
          backgroundColor: '#36A2EB'
        }
      ]
    };
    const barOptions = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Completion Time Distribution'
        },
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    };
    histogramChart = <Bar data={barData} options={barOptions} />;

    // Build a table for question_avg_times
    questionTimesTable = (
      <table className="response-time-table">
        <thead>
          <tr>
            <th>Question ID</th>
            <th>Average Time (sec)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(analytics.question_avg_times).map(([qid, avgT]) => (
            <tr key={qid}>
              <td>{qid}</td>
              <td>{avgT}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="response-time-container">
      <h3 className="response-time-title">Response Time Analytics (Survey #{surveyId})</h3>
      <p className="dropout-description">Optionally provide filters as JSON (like demographics) for advanced queries.</p>
      <textarea
        className="response-time-input"
        placeholder='{"age_group":["18-24"],"location":["USA"]}'
        value={filtersJSON}
        onChange={(e) => setFiltersJSON(e.target.value)}
      />
      <br/>
      <button className="response-time-btn" onClick={handleFetch} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {error && <div className="demographics-error">Error: {error}</div>}

      {analytics && !analytics.error && (
        <div className="response-time-results">
          <div className="response-time-stats">
            <div className="stat-box">
              <div className="stat-label">Total Submissions</div>
              <div className="stat-value">{analytics.count_submissions}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Average Duration</div>
              <div className="stat-value">{analytics.average_duration}s</div>
            </div>
          </div>
          
          <div className="response-time-chart">
            {histogramChart}
          </div>

          <h4>Average Time per Question</h4>
          {Object.keys(analytics.question_avg_times).length === 0 ? (
            <p>No per-question times recorded.</p>
          ) : questionTimesTable}
        </div>
      )}
    </div>
  );
}
