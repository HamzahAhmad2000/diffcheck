// DistributionPanel.js
// This component lets an admin create new survey links, view existing links,
// copy URLs, show QR codes, and navigate to link-specific analytics.
import React, { useState, useEffect } from 'react';
import './Analytics.css';
import { useParams, useNavigate } from "react-router-dom";

const DistributionPanel = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [allowedDomain, setAllowedDomain] = useState('');
  const [allowedEmails, setAllowedEmails] = useState('');
  const [qrLink, setQrLink] = useState(null);

  // Fetch existing distribution links for the survey.
  const fetchLinks = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/surveys/${surveyId}/links`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      } else {
        console.error('Error fetching distribution links');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [surveyId]);

  // Create a new link with the provided label.
  const handleCreateLink = async () => {
    try {
      const payload = {
        label: newLinkLabel,
        ...(allowedDomain && { allowed_domain: allowedDomain }),
        ...(allowedEmails && { allowed_emails: allowedEmails.split(',').map(e => e.trim()).filter(e => e) })
      };
      const res = await fetch(`http://localhost:5000/api/surveys/${surveyId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Link created successfully!');
        setNewLinkLabel('');
        setAllowedDomain('');
        setAllowedEmails('');
        fetchLinks();
      } else {
        alert('Failed to create link.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Show QR code by setting the URL to the generated QR image.
  const handleShowQR = (linkId) => {
    setQrLink(`http://localhost:5000/api/surveys/${surveyId}/links/${linkId}/qrcode`);
  };

  // Copy the public survey URL (with link code) to the clipboard.
  const handleCopyUrl = (code) => {
    const url = `http://localhost:3000/survey/${surveyId}/${code}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard: ' + url);
  };

  // Navigate to the link-specific analytics view.
  const handleViewAnalytics = (linkId) => {
    navigate(`/analytics/${surveyId}/link/${linkId}`);
  };

  return (
    <div className="analytics-dashboard-questions">
      <h2 className="chart-title">Distribution Panel</h2>
      <div className="analytics-section">
        <h3 style={{ fontFamily: 'Clash Display, sans-serif', color: '#AA2EFF', marginBottom: '20px' }}>
          Create New Link
        </h3>
        <div className="distribution-form">
          <label className="distribution-label">Label: </label>
          <input
            className="distribution-input"
            type="text"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
          />
          <label className="distribution-label" style={{ marginLeft: '10px' }}>Allowed Domain:</label>
          <input
            className="distribution-input"
            type="text"
            value={allowedDomain}
            onChange={(e) => setAllowedDomain(e.target.value)}
          />
          <label className="distribution-label" style={{ marginLeft: '10px' }}>Allowed Emails (comma separated):</label>
          <input
            className="distribution-input"
            type="text"
            value={allowedEmails}
            onChange={(e) => setAllowedEmails(e.target.value)}
          />
          <button className="analytics-button" onClick={handleCreateLink}>
            Create Link
          </button>
        </div>
      </div>

      <div className="analytics-section">
        <h3 style={{ fontFamily: 'Clash Display, sans-serif', color: '#AA2EFF', marginBottom: '20px' }}>
          Existing Links
        </h3>
        {links.length === 0 ? (
          <p style={{ color: '#333' }}>No distribution links found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {links.map(link => (
              <li key={link.id} className="analytics-panel" style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#333' }}>{link.label || 'Default Link'}</strong>
                <div style={{ color: '#333', marginTop: '5px' }}>Code: {link.code}</div>
                {link.allowed_domain && (
                  <div style={{ color: '#333', marginTop: '5px' }}>Allowed Domain: {link.allowed_domain}</div>
                )}
                {link.allowed_emails && link.allowed_emails.length > 0 && (
                  <div style={{ color: '#333', marginTop: '5px' }}>Allowed Emails: {link.allowed_emails.join(', ')}</div>
                )}
                <div className="button-group" style={{ marginTop: '10px' }}>
                  <button className="analytics-button" onClick={() => handleCopyUrl(link.code)}>
                    <i className="ri-file-copy-line"></i> Copy URL
                  </button>
                  <button className="analytics-button secondary" onClick={() => handleShowQR(link.id)}>
                    <i className="ri-qr-code-line"></i> Show QR Code
                  </button>
                  <button className="analytics-button tertiary" onClick={() => handleViewAnalytics(link.id)}>
                    <i className="ri-bar-chart-line"></i> View Analytics
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {qrLink && (
        <div className="analytics-section">
          <h3 style={{ fontFamily: 'Clash Display, sans-serif', color: '#AA2EFF', marginBottom: '20px' }}>
            QR Code
          </h3>
          <div style={{ textAlign: 'center' }}>
            <img src={qrLink} alt="QR Code" style={{ maxWidth: '200px', border: '1px solid #ccc' }} />
            <button 
              className="analytics-button tertiary" 
              onClick={() => setQrLink(null)}
              style={{ marginTop: '15px' }}
            >
              Close QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DistributionPanel;