// src/components/AnalyticsComponents/ComparisonPanel.js
import React from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast'; // Assuming you use react-hot-toast for feedback
import './AnalyticsComponents.css'; // Ensure styles for .comparison-panel, .toggle-label etc. are here

const ComparisonPanel = ({
    isActive,
    onToggle,
    availableOptions, // e.g., { age_groups: ['18-24', '25-34'], genders: ['Male', 'Female'], ... }
    comparisonState,  // e.g., { dimension: 'age_group', segments: ['18-24', '25-34'] }
    onComparisonChange, // Function to update parent state: ({ dimension, segments }) => void
    comparisonSegmentCounts = {} // NEW: Counts for each segment { segmentName: count }
}) => {
    // Define the dimensions available for comparison (ensure keys match filterState/availableOptions)
    const dimensions = [
        { key: 'age_group', label: 'Age Group' },
        { key: 'gender', label: 'Gender' },
        { key: 'location', label: 'Location' },
        { key: 'education', label: 'Education' },
        { key: 'company', label: 'Company' },
        { key: 'cohort_tag', label: 'Cohort/Tag' }, // Added cohort_tag
    ];

    // Handler for changing the comparison dimension
    const handleDimensionChange = (e) => {
        const newDimension = e.target.value;
        // Reset selected segments when the dimension changes
        onComparisonChange({ dimension: newDimension, segments: [] });
    };

    // Handler for changing selected segments
    const handleSegmentChange = (segment, isChecked) => {
        const currentSegments = comparisonState.segments || [];
        let newSegments;

        if (isChecked) {
            // Add segment if not already present
            if (!currentSegments.includes(segment)) {
                newSegments = [...currentSegments, segment];
            } else {
                newSegments = currentSegments; // No change if already present
            }
        } else {
            // Remove segment
            newSegments = currentSegments.filter(s => s !== segment);
        }

        // Enforce selection limit (max 2 segments for this implementation)
        if (newSegments.length > 2) {
            // Notify user and prevent adding more than 2
            toast.error("You can only compare up to 2 segments at a time.");
            newSegments = newSegments.slice(0, 2); // Keep only the first two selected
        }

        // Update parent state
        onComparisonChange({ ...comparisonState, segments: newSegments });
    };

    // Determine which segments are available for the currently selected dimension
    const selectedDimensionKey = comparisonState.dimension;
    // Map the dimension key from comparisonState to the key used in availableOptions
    const optionsKeyMap = {
        'age_group': 'age_groups',
        'gender': 'genders',
        'location': 'locations',
        'education': 'education',
        'company': 'companies',
        'cohort_tag': 'cohorts', // Match key from DemographicsSummary
    };
    const currentOptionsKey = optionsKeyMap[selectedDimensionKey] || null;
    const segmentsAvailable = currentOptionsKey ? (availableOptions[currentOptionsKey] || []) : [];

    // Check if segment selection is needed but incomplete
    const showError = isActive && selectedDimensionKey && comparisonState.segments.length < 2;

    return (
        <div className="sidebar-section comparison-panel">
            <h3>Compare Results</h3>
            {/* Toggle to enable/disable comparison mode */}
            <label className="toggle-label" style={{ marginBottom: '15px' }}>
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={onToggle} // This function should be passed from the parent
                    className="toggle-input" // Add appropriate styling
                />
                 <span className="toggle-text">Enable Comparison</span>
            </label>
             <p className="comparison-prompt">
                {isActive
                  ? "Select a group and two segments below to compare."
                  : "Enable comparison to see differences across segments."}
            </p>

            {/* Show dimension and segment selection only if comparison is active */}
            {isActive && (
                <>
                    {/* Dimension Selection Dropdown */}
                    <div className="formGroup">
                        <label className="label" htmlFor="comparisonDimension">Compare by:</label>
                        <select
                            id="comparisonDimension"
                            className="sidebar-select" // Use sidebar styling
                            value={selectedDimensionKey || ""}
                            onChange={handleDimensionChange}
                        >
                            <option value="" disabled>Select Dimension...</option>
                            {dimensions.map(dim => (
                                <option key={dim.key} value={dim.key}>{dim.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Segment Selection Checkboxes */}
                    {selectedDimensionKey && (
                        <div className="formGroup">
                            <label className="label">Select Segments (Choose 2):</label>
                             {segmentsAvailable.length > 0 ? (
                                 <div className="segment-checkbox-group"> {/* Style this container */}
                                    {segmentsAvailable.map(segment => {
                                        const isChecked = comparisonState.segments.includes(segment);
                                        // Disable checkbox if 2 are already selected and this one is not checked
                                        const isDisabled = comparisonState.segments.length >= 2 && !isChecked;
                                        const count = comparisonSegmentCounts[segment];
                                        const displayCount = (count === undefined || count === null || count === 'Err') ? '...' : count; // Show '...' while loading or on error
                                        const hasWarning = typeof count === 'number' && count < 200;

                                        return (
                                            <label key={segment} className={`checkbox-label ${isDisabled ? 'disabled' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => handleSegmentChange(segment, e.target.checked)}
                                                    disabled={isDisabled}
                                                    aria-label={`${segment} (${displayCount} responses)`}
                                                />
                                                 <span className="segment-text">{segment}</span>
                                                 {/* Display count next to the label */}
                                                 <span className={`segment-count ${hasWarning ? 'warning' : ''}`}>
                                                      ({displayCount})
                                                      {hasWarning && <span className="warning-icon-inline" title="Sample size below 200">⚠️</span>}
                                                 </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="no-options-text">No segments available for '{dimensions.find(d => d.key === selectedDimensionKey)?.label || selectedDimensionKey}'.</p>
                             )}
                             {/* Show error/prompt if comparison active but segments incomplete */}
                             {showError && (
                                 <p className="warning-text comparison-warning">
                                     <i className="ri-error-warning-line"></i> Please select 2 segments to compare.
                                 </p>
                             )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

ComparisonPanel.propTypes = {
    isActive: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    availableOptions: PropTypes.object.isRequired,
    comparisonState: PropTypes.object.isRequired,
    onComparisonChange: PropTypes.func.isRequired,
    comparisonSegmentCounts: PropTypes.object, // Added
};

export default ComparisonPanel;
