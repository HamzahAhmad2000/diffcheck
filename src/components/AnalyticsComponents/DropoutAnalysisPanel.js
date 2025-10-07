import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useParams } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { analyticsAPI, surveyAPI } from 'services/apiClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Production-level dropout analysis component:
 * 1) Accept optional filters as JSON
 * 2) Calls /surveys/{id}/dropout-analysis
 * 3) Renders a bar chart of "last answered question" distribution
 */
export default function DropoutAnalysisPanel() {
  const {surveyId}= useParams();
  const [filtersJSON, setFiltersJSON] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);

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
      const res = await surveyAPI.getDropoutAnalysis(surveyId, parsedFilters );

      const dat =  res.data;
      setAnalysis(dat);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setLoading(false);
    }
  };

  let chart = null;
  if (analysis && !analysis.error && analysis.dropout_distribution) {
    const labels = Object.keys(analysis.dropout_distribution);
    const counts = Object.values(analysis.dropout_distribution);
    const data = {
      labels,
      datasets: [
        {
          label: 'Number of Submissions Ending Here',
          data: counts,
          backgroundColor: '#FF6384'
        }
      ]
    };
    const options = {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Dropout Distribution'
        },
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    };
    chart = <Bar data={data} options={options} />;
  }

  return (
    <div className="dropout-container">
      <h3 className="dropout-title">Dropout Analysis (Survey #{surveyId})</h3>
      <p className="dropout-description">
        Optionally provide filters (in JSON) if you want to narrow demographic or link-based data.
      </p>
      
      <textarea
        className="dropout-input"
        placeholder='{"age_group":["25-34"]}'
        value={filtersJSON}
        onChange={(e) => setFiltersJSON(e.target.value)}
      />

      <button className="dropout-btn" onClick={fetchAnalysis} disabled={loading}>
        {loading ? (
          <>
            <i className="ri-loader-4-line"></i>
            Loading...
          </>
        ) : (
          <>
            <i className="ri-bar-chart-2-line"></i>
            Fetch Dropout Data
          </>
        )}
      </button>

      {error && <div className="demographics-error">Error: {error}</div>}

      {analysis && !analysis.error && (
        <div className="dropout-results">
          <div className="dropout-stats">
            <p><strong>Total Submissions:</strong> {analysis.total_submissions}</p>
          </div>
          <div className="dropout-chart">
            {chart}
          </div>
        </div>
      )}
    </div>
  );
}
