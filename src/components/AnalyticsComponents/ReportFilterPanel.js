// src/components/AnalyticsComponents/ReportFilterPanel.js
// NEW COMPONENT - Specifically for the Report Tab sidebar filters

import React from 'react';
import PropTypes from 'prop-types';
import DatePicker from 'react-datepicker'; // Assuming react-datepicker is installed
import "react-datepicker/dist/react-datepicker.css"; // Import datepicker CSS
import './AnalyticsComponents.css'; // Ensure styles are imported

const ReportFilterPanel = ({
    availableOptions,
    filters, // Contains { age_group: [], ..., startDate: null, endDate: null }
    onFilterChange, // (categoryKey, value, isChecked) => void - NOTE: Use categoryKey like 'age_group'
    isIncludeAll,
    onIncludeAllChange, // (isChecked) => void
    onDateChange, // (field: 'startDate' | 'endDate', date: Date | null) => void
    isDisabled // Combined disabled state (loading or includeAll)
}) => {

    // Helper to render checkboxes for a category
    // It maps display label (like 'Age Group') to the key in availableOptions ('age_groups')
    // and the key in filters ('age_group')
    const renderCheckboxes = (categoryKey, categoryLabel) => {
        const options = availableOptions[categoryKey] || [];
        // Derive filter key from options key (e.g., 'age_groups' -> 'age_group')
        const filterKey = categoryKey.endsWith('s') ? categoryKey.slice(0, -1) : categoryKey;
        const currentSelection = filters[filterKey] || [];

        return (
            <div className="filter-group">
                <h4 className="filter-group-title">{categoryLabel}</h4>
                {options.length > 0 ? (
                    <div className="filter-options-grid">
                        {options.map(option => (
                            <div key={`${filterKey}-${option}`} className="filter-checkbox-item">
                                <input
                                    type="checkbox"
                                    id={`${filterKey}-${option}`}
                                    checked={currentSelection.includes(option)}
                                    // Pass the filterKey (e.g., 'age_group') to the handler
                                    onChange={(e) => onFilterChange(filterKey, option, e.target.checked)}
                                    disabled={isDisabled}
                                />
                                <label htmlFor={`${filterKey}-${option}`}>{option}</label>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-options-text">No {categoryLabel.toLowerCase()} options available.</p>
                )}
            </div>
        );
    };

    return (
        <div className="report-filter-panel"> {/* Use a specific class */}
            {/* Include All Responses Toggle */}
            <div className="filter-checkbox-item main-toggle">
                <input
                    type="checkbox"
                    id="report-include-all-responses" // Unique ID
                    checked={isIncludeAll}
                    onChange={(e) => onIncludeAllChange(e.target.checked)}
                    disabled={isDisabled && !isIncludeAll} // Allow unchecking even if loading
                />
                <label htmlFor="report-include-all-responses">Include All Responses</label>
            </div>
            <p className="filter-intro-text">
                {isIncludeAll
                    ? 'Showing all responses. Uncheck to apply specific filters.'
                    : 'Choose filters below to narrow results.'}
            </p>

            {/* Demographic Checkbox Filters - Rendered only if "Include All" is OFF */}
            {!isIncludeAll && (
                <>
                    {renderCheckboxes('age_groups', 'Age Group')}
                    {renderCheckboxes('genders', 'Gender')}
                    {renderCheckboxes('locations', 'Location')}
                    {renderCheckboxes('education', 'Education')}
                    {renderCheckboxes('companies', 'Company')}
                    {renderCheckboxes('cohort_tags', 'Cohort/Tag')}
                </>
            )}

            {/* Date Range Filter - Rendered only if "Include All" is OFF */}
             {!isIncludeAll && (
                <div className="filter-group date-filter-group">
                    <h4 className="filter-group-title">Filter by Response Date</h4>
                    <div className="date-picker-container">
                        <div className="date-picker-item">
                            <label htmlFor="reportStartDate">Start Date:</label> {/* Unique ID */}
                            <DatePicker
                                id="reportStartDate"
                                selected={filters.startDate ? new Date(filters.startDate) : null}
                                onChange={(date) => onDateChange('startDate', date)}
                                selectsStart
                                startDate={filters.startDate ? new Date(filters.startDate) : null}
                                endDate={filters.endDate ? new Date(filters.endDate) : null}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="YYYY-MM-DD"
                                isClearable
                                disabled={isDisabled}
                                className="date-picker-input"
                            />
                        </div>
                        <div className="date-picker-item">
                            <label htmlFor="reportEndDate">End Date:</label> {/* Unique ID */}
                            <DatePicker
                                id="reportEndDate"
                                selected={filters.endDate ? new Date(filters.endDate) : null}
                                onChange={(date) => onDateChange('endDate', date)}
                                selectsEnd
                                startDate={filters.startDate ? new Date(filters.startDate) : null}
                                endDate={filters.endDate ? new Date(filters.endDate) : null}
                                minDate={filters.startDate ? new Date(filters.startDate) : null}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="YYYY-MM-DD"
                                isClearable
                                disabled={isDisabled}
                                className="date-picker-input"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

ReportFilterPanel.propTypes = {
    availableOptions: PropTypes.object.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired,
    isIncludeAll: PropTypes.bool.isRequired,
    onIncludeAllChange: PropTypes.func.isRequired,
    onDateChange: PropTypes.func.isRequired,
    isDisabled: PropTypes.bool.isRequired,
};

export default ReportFilterPanel;

