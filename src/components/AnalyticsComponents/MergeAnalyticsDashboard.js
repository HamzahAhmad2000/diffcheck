import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AnalyticsComponents.css';
import { analyticsAPI, surveyAPI } from 'services/apiClient';

/**
 * A production-level merge analytics dashboard.
 * 1) Lists distribution links for a given survey.
 * 2) Lets admin select multiple links to merge.
 * 3) Calls /surveys/:surveyId/merged-analytics with link_ids.
 * 4) Discards duplicates automatically (per the backend code).
 * 5) Renders the aggregated analytics, or can display them question-by-question 
 *    if you integrate with QuestionAnalyticsChart. 
 */
export default function MergeAnalyticsDashboard({ surveyId }) {
  const [links, setLinks] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [mergedData, setMergedData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Ensure only admin


  // 1) Fetch distribution links for the survey
  useEffect(() => {
    async function fetchLinks() {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await surveyAPI.getLinks(surveyId);
       
        const data = res.data;
        setLinks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (surveyId) {
      fetchLinks();
    }
  }, [surveyId]);

  const handleLinkSelect = (linkId) => {
    if (selectedLinks.includes(linkId)) {
      setSelectedLinks(selectedLinks.filter((id) => id !== linkId));
    } else {
      setSelectedLinks([...selectedLinks, linkId]);
    }
  };

  const handleMerge = async () => {
    if (selectedLinks.length === 0) {
      alert('No links selected for merging');
      return;
    }
    setLoading(true);
    setError('');
    setMergedData(null);
    try {
      const token = localStorage.getItem('token');
      const res = await analyticsAPI.getMergedAnalytics(surveyId, selectedLinks);
      
      const data = res.data;
      setMergedData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div className="merge-analytics-container">
      <h2 className="merge-analytics-title">Merge Analytics Dashboard (Survey ID: {surveyId})</h2>
      {loading && <div className="demographics-loading">Loading...</div>}
      {error && <div className="demographics-error">Error: {error}</div>}

      <div className="merge-links-panel">
        <h4>Distribution Links</h4>
        {links.map((link) => (
          <div key={link.id} className="merge-link-item">
            <input
              type="checkbox"
              checked={selectedLinks.includes(link.id)}
              onChange={() => handleLinkSelect(link.id)}
            />
            <span>{link.label || `Link #${link.id}`} (code: {link.code})</span>
          </div>
        ))}
      </div>

      <button 
        className="merge-analytics-btn" 
        onClick={handleMerge} 
        disabled={loading || selectedLinks.length === 0}
      >
        {loading ? 'Merging...' : 'Merge & Compute Analytics'}
      </button>

      {mergedData && !mergedData.error && (
        <div className="merge-results-box">
          <h4>Merged Analytics Results</h4>
          <p><strong>Total responses:</strong> {mergedData.total_responses}</p>
          <p><strong>Duplicates discarded:</strong> {mergedData.duplicates_discarded || 0}</p>
          <p><strong>Completion rate:</strong> {mergedData.completion_rate?.toFixed(2)}%</p>
          <pre className="code-block">
            {JSON.stringify(mergedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
