// src/components/AnalyticsComponents/ComparisonChartWrapper.js
import React from 'react';
import PropTypes from 'prop-types'; // Optional, but recommended for prop validation
import ComparisonChart from './ComparisonChart'; // The actual chart component
import './AnalyticsComponents.css'; // Ensure shared styles are imported

/**
 * ComparisonChartWrapper
 * Acts as a container for the ComparisonChart. It receives potentially
 * filtered analytics data for two groups for a specific question and
 * renders the comparison chart if data is sufficient for both.
 * Otherwise, it displays a placeholder message.
 */
const ComparisonChartWrapper = ({
    question,       // The full question object (for context like text)
    data1,          // Filtered analytics data object for group 1 (contains .analytics)
    data2,          // Filtered analytics data object for group 2 (contains .analytics)
    settings1,      // Report settings for group 1 (currently unused by ComparisonChart itself, but could be)
    settings2,      // Report settings for group 2 (currently unused)
    group1Name = 'Group 1',
    group2Name = 'Group 2'
}) => {

    // Check if data for both groups is valid and contains the necessary analytics object
    const hasValidData1 = data1 && data1.analytics && Object.keys(data1.analytics).length > 0;
    const hasValidData2 = data2 && data2.analytics && Object.keys(data2.analytics).length > 0;

    // Determine the display order using settings or sequence number
    const displayOrder1 = settings1?.displayOrder ?? question?.sequence_number ?? 'N/A';
    // Use displayOrder1 as the canonical order for the wrapper title
    const displayOrder = displayOrder1;

    if (hasValidData1 && hasValidData2) {
        // Both groups have data, render the comparison chart
        return (
            <ComparisonChart
                group1Data={data1} // Pass the full analytics object
                group2Data={data2} // Pass the full analytics object
                group1Name={group1Name}
                group2Name={group2Name}
                chartType={settings1?.chartType} // Pass for context, though ComparisonChart may override
            />
        );
    } else {
        // Data is missing for one or both groups, render a placeholder
        let message = "Comparison unavailable: ";
        if (!hasValidData1 && !hasValidData2) {
            message += "No data available for either group with the current filters.";
        } else if (!hasValidData1) {
            message += `No data available for ${group1Name} with the current filters.`;
        } else { // !hasValidData2 must be true
            message += `No data available for ${group2Name} with the current filters.`;
        }

        return (
            <div className="question-panel-placeholder comparison-missing-data">
                {/* Display Question Info even if comparison isn't possible */}
                <h4>Q{displayOrder}: {question?.question_text}</h4>
                 <span className="question-type-label" style={{fontSize: '0.8em', color: '#777'}}>({question?.question_type})</span>
                <p><i>{message}</i></p>
            </div>
        );
    }
};

// Optional: Add PropTypes for better component documentation and validation
ComparisonChartWrapper.propTypes = {
    question: PropTypes.object.isRequired, // Full question object
    data1: PropTypes.object, // Analytics data for group 1 (can be null)
    data2: PropTypes.object, // Analytics data for group 2 (can be null)
    settings1: PropTypes.object, // Settings for group 1 (optional)
    settings2: PropTypes.object, // Settings for group 2 (optional)
    group1Name: PropTypes.string,
    group2Name: PropTypes.string,
};

export default ComparisonChartWrapper;