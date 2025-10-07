// src/components/AnalyticsComponents/MetricCard.js
import React from 'react';
// Make sure the corresponding CSS file is imported in your project,
// typically in a higher-level component or index file.
// e.g., import './AnalyticsComponents.css';
// Or if the styles are within AnalyticsDashboard.css:
// import '../AnalyticsDashboard.css'; // Adjust path as needed

/**
 * MetricCard Component
 * Displays a single key metric value with its label.
 * Handles potentially null or undefined values gracefully by showing 'N/A'.
 * Assumes CSS classes .metric-card, .metric-value, .metric-label are defined.
 *
 * @param {object} props - Component props.
 * @param {string} props.label - The label text for the metric.
 * @param {string|number|null|undefined} props.value - The value of the metric.
 */
const MetricCard = ({ label, value }) => {
  // Determine the display value, show 'N/A' if value is null or undefined
  const displayValue = (value === null || value === undefined) ? 'N/A' : value;

  return (
    // Use the class name defined in the CSS for styling
    <div className="metric-card">
      <div className="metric-value">{displayValue}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
};

export default MetricCard;