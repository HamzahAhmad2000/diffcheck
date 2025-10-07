// ReportDownloadPanel.js
import React from 'react';
// Import useParams to access URL parameters
import { useParams } from 'react-router-dom';

// Removed surveyAPI import as direct download is removed

// Remove surveyId from props, get it from useParams instead
const ReportDownloadPanel = () => {
  const { surveyId } = useParams(); // <-- Get surveyId from URL parameters


  // --- Render Logic ---
  // Only renders the "Customize" option card
  return (
    <div className="report-panel-container">
      <h3 className="analytics-panel-title">Generate PDF Report</h3>

      <div className="report-options-container">
        <p className="report-description">
          Generate a detailed PDF report for your survey. You can customize chart appearances, colors, and included sections before downloading.
        </p>

        <div className="report-options-grid">
          {/* Option: Customized Report (now takes full width) */}
          <div className="report-option-card custom full-width"> {/* Added full-width class */}
            <h4 className="report-option-title">Customized Report</h4>
            <p className="report-option-description">
              Create a fully customized report with chart settings, color options, and content selection for each question.
            </p>

            <ul className="report-features-list">
              <li>Customize chart types and colors</li>
              <li>Set individual colors for each option</li>
              <li>Configure report sections (demographics, questions, etc.)</li>
              <li>Generate a professionally formatted PDF</li>
            </ul>

          </div>
        </div>
      </div>


      <div className="report-pro-tip">
        <p className="pro-tip-title">📊 Pro Tip:</p>
        <p>The customized report option allows you to create a professionally formatted PDF with branded charts and tailored content. Perfect for sharing with stakeholders and team members!</p>
      </div>
    </div>
  );
};

export default ReportDownloadPanel;