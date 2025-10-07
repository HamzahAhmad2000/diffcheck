// src/components/AnalyticsComponents/ReportGridDisplay.js
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './GridAnalytics.css'; // Reuse existing styles if appropriate
import './AnalyticsComponents.css'; // Shared styles

// --- Star Rating Visual Helper ---
const StarRatingVisual = ({ rating, maxRating = 5 }) => {
    const ratingNum = Number(rating) || 0;
    const fullStars = Math.floor(ratingNum);
    const partialStar = ratingNum % 1;
    const showPartial = partialStar > 0.05;
    // Ensure emptyStars is non-negative
    const emptyStars = Math.max(0, maxRating - fullStars - (showPartial ? 1 : 0));

    const renderStar = (type, key, partialPercentage = 0) => {
        let style = {}; let starChar = "★";
        switch (type) {
            case "full": style = { color: "#AA2EFF" }; break; // Or use settings color
            case "partial":
                style = {
                    display: "inline-block",
                    background: `linear-gradient(90deg, #AA2EFF ${partialPercentage}%, #ccc ${partialPercentage}%)`,
                    WebkitBackgroundClip: "text", backgroundClip: "text",
                    color: "transparent", WebkitTextFillColor: "transparent",
                }; break;
            default: style = { color: "#ccc" }; break;
        }
        style.fontSize = "1.2em"; style.lineHeight = "1";
        return <span key={key} style={style} className="star-char">{starChar}</span>;
    };

    return (
        <div className="star-rating-visual" style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {[...Array(fullStars)].map((_, i) => renderStar("full", `full-${i}`))}
            {showPartial && renderStar("partial", "partial", partialStar * 100)}
            {[...Array(emptyStars)].map((_, i) => renderStar("empty", `empty-${i}`))}
        </div>
    );
};

// --- Main Grid Display Component ---
const ReportGridDisplay = ({ question, analyticsData, questionSettings = {} }) => {

    // --- Memoize Processed Data & Settings ---
    const { gridData, showNA, questionType } = useMemo(() => {
        const data = analyticsData?.analytics?.grid_data;
        const settings = questionSettings;
        const type = question?.question_type || '';
        const shouldShowNA = settings?.showNA !== undefined ? settings.showNA : true; // Default to showing N/A

        // Basic validation
        if (!data || !question || !type) {
            return { gridData: null, showNA: shouldShowNA, questionType: type };
        }
        // Ensure essential grid structure exists
        if (!Array.isArray(data.rows) || !Array.isArray(data.columns)) {
             console.warn(`ReportGridDisplay: Missing rows or columns in gridData for Q: ${question.id}`);
             return { gridData: null, showNA: shouldShowNA, questionType: type };
        }

        return { gridData: data, showNA: shouldShowNA, questionType: type };

    }, [analyticsData, question, questionSettings]);

    // --- Memoize Filtered Columns and Indices ---
    const { filteredColumns, originalIndices } = useMemo(() => {
        const originalCols = gridData?.columns || [];
        if (!gridData) return { filteredColumns: [], originalIndices: [] };

        const cols = [];
        const indices = [];
        originalCols.forEach((col, index) => {
            const isNAColumn = col?.isNotApplicable === true;
            if (showNA || !isNAColumn) {
                cols.push(col);
                indices.push(index); // Store the original index
            }
        });
        return { filteredColumns: cols, originalIndices: indices };
    }, [gridData, showNA]);


    // --- Loading / Error / No Data States ---
    if (!analyticsData || !gridData) {
        // Parent ReportTabPage should handle primary loading/error.
        // This handles cases where analytics *exist* but grid_data is missing/invalid.
        console.warn(`ReportGridDisplay: No valid gridData found for Q: ${question?.id}`);
        return <div className="no-data">Grid data structure is missing or incomplete for this question.</div>;
    }
    if (gridData.rows.length === 0 || gridData.columns.length === 0) {
        return <div className="no-data">No grid data available for the current selection.</div>;
    }

    // --- Rendering Functions for Specific Grid Types ---

    const renderRadioGridTable = () => (
        <div className="grid-analysis">
            {/* Title can be handled by the parent component or added here */}
            {/* <h4>Radio Grid Responses</h4> */}
            <div className="grid-table-container">
                <table className="grid-table">
                    <thead>
                        <tr>
                            <th></th> {/* Empty corner */}
                            {filteredColumns.map((col, fColIndex) => (
                                <th key={`h-${originalIndices[fColIndex]}`}>
                                    {typeof col === "object" ? col.text : col}
                                </th>
                            ))}
                            <th>Responses</th> {/* Total responses for the row */}
                        </tr>
                    </thead>
                    <tbody>
                        {gridData.rows.map((row, rowIndex) => {
                            const rowLabel = typeof row === "object" ? row.text : row;
                            const rowTotal = gridData.row_totals?.[rowIndex] ?? 0;
                            return (
                                <tr key={rowIndex}>
                                    <td className="row-label">{rowLabel}</td>
                                    {filteredColumns.map((_, fColIndex) => {
                                        const originalColIndex = originalIndices[fColIndex];
                                        const count = gridData.values?.[rowIndex]?.[originalColIndex] ?? 0;
                                        const percentage = rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : 0;
                                        return (
                                            <td key={`c-${originalColIndex}`} className="cell">
                                                <div>{count}</div>
                                                <div style={{ fontSize: "0.8em", color: "#666" }}>({percentage}%)</div>
                                            </td>
                                        );
                                    })}
                                    <td className="row-total">{rowTotal}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>Column Total</td>
                            {filteredColumns.map((_, fColIndex) => {
                                const originalColIndex = originalIndices[fColIndex];
                                return (
                                    <td key={`f-${originalColIndex}`} className="column-total">
                                        {gridData.column_totals?.[originalColIndex] ?? 0}
                                    </td>
                                );
                             })}
                            {/* Adjust colspan based on whether N/A is filtered */}
                            <td colSpan={showNA && originalIndices.includes(gridData.columns.findIndex(c => c?.isNotApplicable)) ? 1 : 1}>
                                Total Responses: {gridData.total_responses ?? 0}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    const renderCheckboxGridTable = () => (
         <div className="grid-analysis">
            {/* <h4>Checkbox Grid Analysis</h4> */}
            <div className="grid-table-container">
                <table className="grid-table">
                    <thead>
                        <tr>
                            <th></th>
                            {filteredColumns.map((col, fColIndex) => (
                                <th key={`h-${originalIndices[fColIndex]}`}>{typeof col === "object" ? col.text : col}</th>
                            ))}
                            <th>Row Total Selections</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gridData.rows.map((row, rowIndex) => {
                            const rowLabel = typeof row === "object" ? row.text : row;
                            return (
                                <tr key={rowIndex}>
                                    <td className="row-label">{rowLabel}</td>
                                    {filteredColumns.map((_, fColIndex) => {
                                         const originalColIndex = originalIndices[fColIndex];
                                         const count = gridData.values?.[rowIndex]?.[originalColIndex] ?? 0;
                                        return <td key={`c-${originalColIndex}`} className="cell">{count}</td>;
                                    })}
                                    <td className="row-total">{gridData.row_totals?.[rowIndex] ?? 0}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>Column Total Selections</td>
                            {filteredColumns.map((_, fColIndex) => {
                                const originalColIndex = originalIndices[fColIndex];
                                return (
                                    <td key={`f-${originalColIndex}`} className="column-total">
                                        {gridData.column_totals?.[originalColIndex] ?? 0}
                                    </td>
                                );
                            })}
                             {/* Adjust colspan based on whether N/A is filtered */}
                             <td colSpan={1}>
                                Total Responses: {gridData.total_responses ?? 0}
                             </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    const renderStarRatingGridTable = () => (
        <div className="grid-analysis">
            {/* <h4 style={{}}>Star Rating Grid Analysis</h4> */}
            <div className="grid-table-container">
                <table className="grid-table star-rating-grid-table">
                    <thead>
                        <tr>
                            <th style={{ background: "#f8f9fa", padding: "12px 15px" }}></th>
                            {filteredColumns.map((col, fColIndex) => (
                                <th key={`h-${originalIndices[fColIndex]}`} style={{}}>
                                    {typeof col === "object" ? col.text : col}
                                </th>
                            ))}
                            <th style={{}}>Row Avg</th>
                            <th style={{}}># Responses</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gridData.rows.map((row, rowIndex) => {
                            const rowLabel = typeof row === "object" ? row.text : row;
                            return (
                                <tr key={rowIndex}>
                                    <td className="row-label" style={{}}>{rowLabel}</td>
                                    {filteredColumns.map((_, fColIndex) => {
                                        const originalColIndex = originalIndices[fColIndex];
                                        const avg = gridData.cell_averages?.[rowIndex]?.[originalColIndex] ?? 0;
                                        const count = gridData.count_values?.[rowIndex]?.[originalColIndex] ?? 0;
                                        return (
                                            <td key={`c-${originalColIndex}`} className="cell star-rating-cell-display" style={{}}>
                                                <div style={{}}>
                                                    <StarRatingVisual rating={Number(avg) || 0} maxRating={question?.rating_end || 5} />
                                                    <span style={{}}>{avg.toFixed(2)}</span>
                                                    <span style={{}}>({count})</span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="row-average" style={{}}>
                                        <div style={{}}>
                                            <StarRatingVisual rating={Number(gridData.row_averages?.[rowIndex]) || 0} maxRating={question?.rating_end || 5}/>
                                            <span style={{}}>{(Number(gridData.row_averages?.[rowIndex]) || 0).toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td className="row-total" style={{}}>{gridData.row_totals?.[rowIndex] ?? 0}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style={{}}>Column Avg</td>
                            {filteredColumns.map((_, fColIndex) => {
                                const originalColIndex = originalIndices[fColIndex];
                                return (
                                    <td key={`fa-${originalColIndex}`} className="column-average" style={{}}>
                                        <div style={{}}>
                                            <StarRatingVisual rating={Number(gridData.column_averages?.[originalColIndex]) || 0} maxRating={question?.rating_end || 5}/>
                                            <span style={{}}>{(Number(gridData.column_averages?.[originalColIndex]) || 0).toFixed(2)}</span>
                                        </div>
                                    </td>
                                );
                            })}
                            <td colSpan="2"></td> {/* Empty cells for row avg/count columns */}
                        </tr>
                         <tr>
                            <td style={{}}># Responses</td>
                            {filteredColumns.map((_, fColIndex) => {
                                 const originalColIndex = originalIndices[fColIndex];
                                return (
                                    <td key={`fc-${originalColIndex}`} className="column-total" style={{}}>
                                        {gridData.column_totals?.[originalColIndex] ?? 0}
                                    </td>
                                );
                            })}
                             <td colSpan="2" style={{}}>
                                Total Responses: {gridData.total_responses ?? 0}
                             </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    // --- Select Renderer Based on Type ---
    switch (questionType) {
        case "radio-grid":
            return renderRadioGridTable();
        case "checkbox-grid":
            return renderCheckboxGridTable();
        case "star-rating-grid":
            return renderStarRatingGridTable();
        default:
            console.warn(`ReportGridDisplay: Unsupported grid type "${questionType}" for Q: ${question?.id}`);
            return <div className="no-data">Unsupported grid type: {questionType}</div>;
    }
};

// --- PropTypes ---
ReportGridDisplay.propTypes = {
    question: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        question_text: PropTypes.string,
        question_type: PropTypes.string.isRequired,
        grid_rows: PropTypes.array,
        grid_columns: PropTypes.array,
        not_applicable: PropTypes.bool,
        not_applicable_text: PropTypes.string,
        rating_end: PropTypes.number, // For star rating max
    }).isRequired,
    analyticsData: PropTypes.shape({
        analytics: PropTypes.shape({
            grid_data: PropTypes.shape({
                rows: PropTypes.array,
                columns: PropTypes.array,
                values: PropTypes.array, // Counts for radio/checkbox
                row_totals: PropTypes.array,
                column_totals: PropTypes.array,
                cell_averages: PropTypes.array, // Specific to star rating
                count_values: PropTypes.array, // Specific to star rating counts per cell
                row_averages: PropTypes.array,
                column_averages: PropTypes.array,
                total_responses: PropTypes.number,
                // Add other expected fields if necessary
            })
        })
    }), // Can be null initially
    questionSettings: PropTypes.shape({
        showNA: PropTypes.bool, // This is the key setting used here
        // Include other settings if needed by potential future features
    }),
};

export default ReportGridDisplay;