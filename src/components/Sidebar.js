// src/components/Sidebar.js
import React from 'react';
import PropTypes from 'prop-types';

// Import sub-components for filtering and comparison
// import DemographicsFilterPanel from './AnalyticsComponents/DemographicsFilterPanel'; // REMOVE THIS IMPORT
import ReportFilterPanel from './AnalyticsComponents/ReportFilterPanel'; // *** ADD THIS IMPORT ***
import ComparisonPanel from './AnalyticsComponents/ComparisonPanel';

// Import CSS
import './AnalyticsDashboard.css';
import './AnalyticsComponents/AnalyticsComponents.css';

const AUTOSAVE_VIEW_NAME = '_latest_autosave';

const Sidebar = ({
    isOpen,
    onClose,
    // Saved Views Props (remain the same)
    savedViews = [],
    currentViewName,
    onLoadView = () => {},
    onSaveView = () => {},
    onDeleteView = () => {},
    // Filtering Props (remain the same, passed to ReportFilterPanel)
    availableFilterOptions = { age_groups: [], locations: [], genders: [], education: [], companies: [], cohort_tags: [] },
    filterState = { age_group: [], location: [], gender: [], education: [], company: [], cohort_tag: [], startDate: null, endDate: null },
    isIncludeAll,
    onFilterChange = () => {},
    onIncludeAllChange = () => {},
    onDateChange = () => {},
    onResetFilters = () => {},
    onApplyFilters = () => {},
    // Comparison Props (remain the same)
    isComparisonActive,
    onToggleComparison = () => {},
    comparisonState = { dimension: null, segments: [] },
    onComparisonChange = () => {},
    comparisonSegmentCounts = {},
    // Sample Size Props (remain the same)
    loading = false,
    currentSampleSize,
    sampleSizeGroup1,
    sampleSizeGroup2,
    group1Name = 'Group 1',
    group2Name = 'Group 2',
    sampleWarningGroup1,
    sampleWarningGroup2,
    showOverallWarning
}) => {

    return (
        <>
            {/* Overlay (remains the same) */}
            <div
                className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
                aria-hidden={!isOpen}
                role="button"
                tabIndex={-1}
                aria-label="Close sidebar"
            />
            {/* Sidebar Panel (remains the same) */}
            <div className={`analytics-dashboard-sidebar ${isOpen ? 'open' : ''}`} role="complementary" aria-labelledby="sidebar-title">
                {/* Close button (remains the same) */}
                <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close sidebar">
                    <i className="ri-close-line"></i>
                </button>

                <div className="sidebar-content">
                    <h2 id="sidebar-title" className="sr-only">Report Controls Sidebar</h2>

                    {/* Saved Views (remains the same) */}
                    <div className="sidebar-section">
                         {/* ... Saved Views UI ... */}
                         <h3>Saved Views</h3>
                        <select
                            value={currentViewName || ""}
                            onChange={(e) => onLoadView(e.target.value)}
                            className="sidebar-select"
                            disabled={savedViews.length === 0 || loading}
                            aria-label="Load saved report view"
                        >
                            <option value="" disabled>Load a View...</option>
                            {savedViews.map(view => (
                                <option key={view.name} value={view.name}>
                                    {view.name === AUTOSAVE_VIEW_NAME ? "Latest Autosaved View" : view.name}
                                </option>
                            ))}
                        </select>
                        <button onClick={onSaveView} className="sidebar-button" disabled={loading}>
                            <i className="ri-save-line"></i> Save Current View
                        </button>
                        {currentViewName && currentViewName !== AUTOSAVE_VIEW_NAME && (
                            <button onClick={() => onDeleteView(currentViewName)} className="sidebar-button danger" disabled={loading}>
                                <i className="ri-delete-bin-line"></i> Delete "{currentViewName}"
                            </button>
                        )}
                    </div>

                    {/* Filtering Section - *** USE ReportFilterPanel *** */}
                    <div className="sidebar-section">
                        <h3>Filter Responses</h3>
                        <ReportFilterPanel 
                            availableOptions={availableFilterOptions}
                            filters={filterState}
                            onFilterChange={onFilterChange}
                            isIncludeAll={isIncludeAll}
                            onIncludeAllChange={onIncludeAllChange}
                            onDateChange={onDateChange}
                            isDisabled={isIncludeAll || loading}
                        />
                    </div>

                    {/* Sample Size Display Section (remains the same) */}
                    <div className="sidebar-section sample-size-info">
                        {/* ... Sample Size UI ... */}
                        <h3>Current Sample</h3>
                        {loading && <p className="loading-text small">Loading sample size...</p>}
                        {!loading && isComparisonActive && (
                            <>
                                <p className={`sample-size-line ${sampleWarningGroup1 ? 'warning' : ''}`}>
                                    {group1Name}: <strong>{sampleSizeGroup1 ?? 'N/A'}</strong> Responses
                                    {sampleWarningGroup1 && <span className="warning-icon" title="Sample size below 200">⚠️</span>}
                                </p>
                                <p className={`sample-size-line ${sampleWarningGroup2 ? 'warning' : ''}`}>
                                    {group2Name}: <strong>{sampleSizeGroup2 ?? 'N/A'}</strong> Responses
                                    {sampleWarningGroup2 && <span className="warning-icon" title="Sample size below 200">⚠️</span>}
                                </p>
                            </>
                        )}
                        {!loading && !isComparisonActive && (
                            <p className={`sample-size-line ${showOverallWarning ? 'warning' : ''}`}>
                                Overall Sample: <strong>{currentSampleSize ?? 'N/A'}</strong> Responses
                                {showOverallWarning && <span className="warning-icon" title="Sample size below 200">⚠️</span>}
                            </p>
                        )}
                        {(sampleWarningGroup1 || sampleWarningGroup2 || showOverallWarning) && (
                             <p className="warning-text detail-warning">
                                <i className="ri-error-warning-line"></i> Results may be less representative with sample sizes under 200.
                             </p>
                        )}
                    </div>

                    {/* Comparison Section (remains the same) */}
                    <div className="sidebar-section">
                        <ComparisonPanel
                            isActive={isComparisonActive}
                            onToggle={onToggleComparison}
                            availableOptions={availableFilterOptions}
                            comparisonState={comparisonState}
                            onComparisonChange={onComparisonChange}
                            comparisonSegmentCounts={comparisonSegmentCounts}
                        />
                    </div>

                    {/* Apply/Reset Actions (remains the same) */}
                    <div className="sidebar-section apply-section">
                        {/* ... Apply/Reset Buttons ... */}
                         <button
                            onClick={onResetFilters}
                            className="sidebar-button secondary"
                            disabled={loading}
                        >
                             <i className="ri-refresh-line"></i> Reset Filters & View
                        </button>
                        <button
                            onClick={onApplyFilters}
                            className="sidebar-button apply-button"
                            disabled={loading || (isComparisonActive && comparisonState.segments.length < 2)} // Disable if loading OR comparing and less than 2 segments selected
                            title={(isComparisonActive && comparisonState.segments.length < 2) ? "Select 2 segments to compare" : "Apply current filters and comparison"}
                        >
                            {loading ? 'Applying...' : 'Apply Filters & Compare'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// PropTypes (remain the same, no change needed here)
Sidebar.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    // Saved Views
    savedViews: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        settingsSnapshot: PropTypes.object.isRequired,
    })),
    currentViewName: PropTypes.string,
    onLoadView: PropTypes.func,
    onSaveView: PropTypes.func,
    onDeleteView: PropTypes.func,
    // Filtering
    availableFilterOptions: PropTypes.object,
    filterState: PropTypes.object,
    isIncludeAll: PropTypes.bool,
    onFilterChange: PropTypes.func,
    onIncludeAllChange: PropTypes.func,
    onDateChange: PropTypes.func,
    onResetFilters: PropTypes.func,
    onApplyFilters: PropTypes.func,
    // Comparison
    isComparisonActive: PropTypes.bool,
    onToggleComparison: PropTypes.func,
    comparisonState: PropTypes.object,
    onComparisonChange: PropTypes.func,
    comparisonSegmentCounts: PropTypes.object,
    // Sample Size
    loading: PropTypes.bool,
    currentSampleSize: PropTypes.number,
    sampleSizeGroup1: PropTypes.number,
    sampleSizeGroup2: PropTypes.number,
    group1Name: PropTypes.string,
    group2Name: PropTypes.string,
    sampleWarningGroup1: PropTypes.bool,
    sampleWarningGroup2: PropTypes.bool,
    showOverallWarning: PropTypes.bool,
};


export default Sidebar;