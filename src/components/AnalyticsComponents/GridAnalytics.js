import React, { useState, useEffect } from "react";
import axios from "axios";
import "./GridAnalytics.css"; // Assuming this file exists and is styled as before
import apiClient, { surveyAPI, questionBankAPI, uploadAPI, aiAPI, analyticsAPI } from "../../services/apiClient";
import { baseURL } from '../../services/apiClient';

/**
 * StarRatingVisual Component to display stars based on a rating.
 * Uses opacity for partial stars, matching the original implementation.
 */

const StarRatingVisual = ({ rating, maxRating = 5 }) => {
  // Ensure it's exported
  const ratingNum = Number(rating) || 0; // Ensure rating is a number
  const fullStars = Math.floor(ratingNum);
  const partialStar = ratingNum % 1;
  // Only show partial star if it's significant (adjust threshold if needed)
  const showPartial = partialStar > 0.05;
  const emptyStars = maxRating - fullStars - (showPartial ? 1 : 0);

  const renderStar = (type, key, partialPercentage = 0) => {
    let style = {};
    let starChar = "★"; // Or your preferred star icon/character

    switch (type) {
      case "full":
        style = { color: "#AA2EFF" }; // Filled color
        break;
      case "partial":
        // Use linear gradient for partial fill
        style = {
          display: "inline-block", // Needed for background clipping
          background: `linear-gradient(90deg, #AA2EFF ${partialPercentage}%, #ccc ${partialPercentage}%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent", // Make the text color transparent to show gradient
          WebkitTextFillColor: "transparent", // For Safari
        };
        break;
      case "empty":
      default:
        style = { color: "#ccc" }; // Empty color
        break;
    }

    // Combine common styles
    style.fontSize = "1.2em"; // Adjust size as needed
    style.lineHeight = "1"; // Prevent extra spacing

    return (
      <span key={key} style={style} className="star-char">
        {starChar}
      </span>
    );
  };

  return (
    <div
      className="star-rating-visual"
      style={{ display: "inline-block", whiteSpace: "nowrap" }}
    >
      {[...Array(fullStars)].map((_, i) => renderStar("full", `full-${i}`))}
      {showPartial && renderStar("partial", "partial", partialStar * 100)}
      {[...Array(emptyStars)].map((_, i) => renderStar("empty", `empty-${i}`))}
    </div>
  );
};

/**
 * GridAnalytics fetches and renders grid-based analytics.
 * Incorporates specific display changes requested.
 */
const GridAnalytics = ({ data, surveyId, questionId, filterPayload, filterPayload1 = null, filterPayload2 = null }) => {
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get question type safely from data prop
  // This is used as an initial guess, the fetched data's type takes precedence
  const initialQuestionType =
    data?.question_type ||
    (data?.analytics ? data.analytics.question_type : "");

  // Load filtered data function
  const loadFilteredGridAnalytics = async (
    surveyId,
    questionId,
    filterPayload
  ) => {
    try {
      const response = await analyticsAPI.getFilteredQuestionAnalytics(surveyId, questionId, filterPayload);
      return response.data;
    } catch (error) {
      console.error("Error loading filtered grid analytics:", error);
      throw error;
    }
  };

  // --- Single useEffect to fetch data or process passed data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setGridData(null); // Clear previous data

      try {
        let responseData;
        const useFilters =
          filterPayload &&
          Object.keys(filterPayload).some(
            (key) =>
              Array.isArray(filterPayload[key]) && filterPayload[key].length > 0
          );

        if (useFilters) {
          console.log("Fetching filtered grid analytics via analyticsAPI...");
          responseData = await loadFilteredGridAnalytics(
            surveyId,
            questionId,
            filterPayload
          );
        } else if (
          data && // Check if data is passed directly via props
          (data.grid_data || (data.analytics && data.analytics.grid_data))
        ) {
          console.log("Using passed grid analytics data (no API call)...");
          // Directly use the passed data
          const processedData = processGridData(data);
          if (processedData) {
            setGridData(processedData);
          } else {
            throw new Error("Could not process passed grid data");
          }
          setLoading(false);
          return; // Exit early
        } else if (surveyId && questionId) {
          console.log("Fetching default grid analytics (analytics-unified) via analyticsAPI...");
          const response = await analyticsAPI.getQuestionAnalyticsUnified(surveyId, questionId);
          responseData = response.data;
        } else {
          throw new Error("Insufficient data provided to load grid analytics.");
        }

        // Process the response data if an API call was made
        console.log("Received raw grid analytics data from API:", responseData);
        const processedData = processGridData(responseData);

        if (processedData) {
          console.log("Processed grid data:", processedData);
          setGridData(processedData);
        } else {
          console.warn("Could not process grid data from response. Response:", responseData);
          // Set empty grid data structure to avoid crash
          setGridData({
            rows: [], columns: [], values: [], row_totals: [], column_totals: [],
            row_averages: [], column_averages: [], cell_averages: [],
            count_values: [], question_type: initialQuestionType,
          });
        }
      } catch (err) {
        console.error("Error in GridAnalytics fetch/process:", err);
        const errorMessage = err.response?.data?.error || err.message || "Unknown error loading grid data";
        setError(`Error loading grid analytics: ${errorMessage}`);
        console.error(`Error: ${errorMessage}`); // Use console.error instead of toast
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if surveyId and questionId are present OR if data prop exists
    if ((surveyId && questionId) || data) {
      fetchData();
    } else {
      setError("Missing survey or question ID.");
      setLoading(false);
    }

  }, [data, surveyId, questionId, filterPayload]); // Keep dependencies

  /**
   * processGridData normalizes the raw analytics data.
   */
  const processGridData = (dataObj) => {
    let extracted = dataObj.grid_data; // Prefer direct grid_data if passed
    if (!extracted && dataObj.analytics && dataObj.analytics.grid_data) {
      extracted = dataObj.analytics.grid_data; // Fallback to nested structure
    }
    if (!extracted) {
      return null; // Return null if data structure is unexpected
    }
    // Ensure question type is included in the processed data, prioritizing source data
    if (!extracted.question_type) {
      if (dataObj.question_type) {
        extracted.question_type = dataObj.question_type;
      } else if (dataObj.analytics && dataObj.analytics.question_type) {
        extracted.question_type = dataObj.analytics.question_type;
      }
    }

    // Ensure essential arrays exist, even if empty, for consistent rendering checks later
    extracted.rows = extracted.rows || [];
    extracted.columns = extracted.columns || [];
    extracted.values = extracted.values || []; // Counts for radio/checkbox
    extracted.row_totals = extracted.row_totals || [];
    extracted.column_totals = extracted.column_totals || [];
    extracted.cell_averages = extracted.cell_averages || []; // Star grid specific
    extracted.count_values = extracted.count_values || []; // Star grid specific (counts per cell)
    extracted.row_averages = extracted.row_averages || []; // Star grid specific
    extracted.column_averages = extracted.column_averages || []; // Star grid specific

    return extracted;
  };

  // --- Render Logic ---
  if (loading) return <div className="loading">Loading grid data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  // Check for gridData and essential properties AFTER loading and processing attempt
  if (
    !gridData ||
    !Array.isArray(gridData.rows) ||
    !Array.isArray(gridData.columns)
  ) {
    // If gridData is null or basic structure is missing
    return (
      <div className="no-data">
        Grid data structure is missing or incomplete.
      </div>
    );
  }
  // If structure exists but is empty (e.g., from failed processing or no responses)
  if (gridData.rows.length === 0 || gridData.columns.length === 0) {
    return (
      <div className="no-data">
        No grid data available for the current selection.
      </div>
    );
  }

  // Render based on question type using the gridData state
  // Use type from fetched/processed data as the primary source
  const currentQuestionType = gridData?.question_type || initialQuestionType;

  // console.log("Determined question type for rendering:", currentQuestionType); // Optional debug log

  switch (currentQuestionType) {
    case "star-rating-grid":
      // Check for data *specific* to star rating grid before rendering
      if (
        !gridData.cell_averages ||
        !gridData.count_values ||
        !gridData.row_averages ||
        !gridData.column_averages
      ) {
        console.warn(
          "Incomplete data for Star Rating Grid rendering, missing average/count fields:",
          gridData
        );
        return (
          <div className="no-data">
            Incomplete data provided for Star Rating Grid.
          </div>
        );
      }
      return renderStarRatingGridAnalytics(gridData);
    case "checkbox-grid":
      // Check for data *specific* to checkbox/radio grid (values = counts)
      if (!gridData.values || !gridData.row_totals || !gridData.column_totals) {
        console.warn(
          "Incomplete data for Checkbox Grid rendering, missing values/totals fields:",
          gridData
        );
        return (
          <div className="no-data">
            Incomplete data provided for Checkbox Grid.
          </div>
        );
      }
      return renderCheckboxGridAnalytics(gridData);
    case "radio-grid":
      // Check for data *specific* to checkbox/radio grid (values = counts)
      if (!gridData.values || !gridData.row_totals || !gridData.column_totals) {
        console.warn(
          "Incomplete data for Radio Grid rendering, missing values/totals fields:",
          gridData
        );
        return (
          <div className="no-data">
            Incomplete data provided for Radio Grid.
          </div>
        );
      }
      return renderRadioGridAnalytics(gridData);
    default:
      // Fallback rendering attempts based on available data structures
      console.warn(
        `Unknown or missing grid type "${currentQuestionType}". Attempting fallback rendering.`
      );
      if (
        gridData.cell_averages &&
        gridData.row_averages &&
        gridData.column_averages
      ) {
        console.log(
          "Fallback: Rendering as Star Rating Grid based on available average data."
        );
        return renderStarRatingGridAnalytics(gridData);
      } else if (
        gridData.values &&
        gridData.row_totals &&
        gridData.column_totals
      ) {
        // This structure fits both radio and checkbox, default to radio style (count + percentage)
        console.log(
          "Fallback: Rendering as Radio Grid based on available count/total data."
        );
        return renderRadioGridAnalytics(gridData);
      }
      // If none of the structures match well
      return (
        <div className="no-data">
          Unsupported or unknown grid type:{" "}
          {currentQuestionType || "Not Specified"}. Unable to determine display
          format.
        </div>
      );
  }
};

/**
 * Renders radio-grid analytics as requested:
 *  - Shows counts and row percentages in cells.
 *  - No average column.
 */
function renderRadioGridAnalytics(gridData) {
  // Basic data check already done in the main component, but good practice to have here too
  if (
    !gridData ||
    !gridData.rows ||
    !gridData.columns ||
    !gridData.values ||
    !gridData.row_totals
  ) {
    return <div className="no-data">Incomplete data for Radio Grid.</div>; // Should not be reached if checks in parent are correct
  }

  return (
    <div className="grid-analysis">
      <h4>Radio Grid Responses</h4>
      <div className="grid-table-container">
        <table className="grid-table">
          <thead>
            <tr>
              <th></th> {/* Empty corner */}
              {gridData.columns.map((col, colIndex) => (
                <th key={colIndex}>
                  {typeof col === "object" ? col.text : col}
                </th>
              ))}
              <th>Responses</th> {/* Total responses for the row */}
              {/* Average column header removed */}
            </tr>
          </thead>
          <tbody>
            {gridData.rows.map((row, rowIndex) => {
              const rowLabel = typeof row === "object" ? row.text : row;
              // Ensure rowCounts is an array, default to empty if missing/null
              const rowCounts = Array.isArray(gridData.values[rowIndex])
                ? gridData.values[rowIndex]
                : [];
              const rowTotal = gridData.row_totals[rowIndex] ?? 0;

              return (
                <tr key={rowIndex}>
                  <td className="row-label">{rowLabel}</td>
                  {gridData.columns.map((_, colIndex) => {
                    // Safely access count, default to 0
                    const count = rowCounts[colIndex] ?? 0;
                    // Calculate percentage based on row total
                    const percentage =
                      rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : 0;
                    return (
                      <td key={colIndex} className="cell">
                        {/* Display count */}
                        <div>{count}</div>
                        {/* Display percentage */}
                        <div style={{ fontSize: "0.8em", color: "#666" }}>
                          ({percentage}%)
                        </div>
                      </td>
                    );
                  })}
                  {/* Display total responses for the row */}
                  <td className="row-total">{rowTotal}</td>
                  {/* Average cell data removed */}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Column Total</td>
              {(gridData.column_totals || []).map((colTotal, colIndex) => (
                <td key={colIndex} className="column-total">
                  {colTotal ?? 0}
                </td>
              ))}
              {/* Adjusted colspan since Average column was removed */}
              {/* Display total number of respondents */}
              <td colSpan="1">
                Total Responses: {gridData.total_responses ?? 0}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Disclaimer about averages removed */}
    </div>
  );
}

/**
 * Renders checkbox-grid analytics:
 *  - Displays a table of cell frequency counts.
 *  - Shows row totals and column totals.
 */
function renderCheckboxGridAnalytics(gridData) {
  // Basic data check already done in the main component
  if (
    !gridData ||
    !gridData.rows ||
    !gridData.columns ||
    !gridData.values ||
    !gridData.row_totals ||
    !gridData.column_totals
  ) {
    return <div className="no-data">Incomplete data for Checkbox Grid.</div>;
  }

  return (
    <div className="grid-analysis">
      <h4>Checkbox Grid Analysis</h4>
      <div className="grid-table-container">
        <table className="grid-table">
          <thead>
            <tr>
              <th></th>
              {gridData.columns.map((col, colIndex) => (
                <th key={colIndex}>
                  {typeof col === "object" ? col.text : col}
                </th>
              ))}
              {/* Total *selections* made in this row */}
              <th>Row Total Selections</th>
            </tr>
          </thead>
          <tbody>
            {gridData.rows.map((row, rowIndex) => {
              const rowLabel = typeof row === "object" ? row.text : row;
              // Ensure rowValues is an array, default to empty if missing/null
              const rowValues = Array.isArray(gridData.values[rowIndex])
                ? gridData.values[rowIndex]
                : [];
              return (
                <tr key={rowIndex}>
                  <td className="row-label">{rowLabel}</td>
                  {gridData.columns.map((_, colIndex) => (
                    // Display the count for each cell (how many times this row/col combo was checked)
                    <td key={colIndex} className="cell">
                      {rowValues[colIndex] ?? 0}
                    </td>
                  ))}
                  {/* Display total selections for this row */}
                  <td className="row-total">
                    {gridData.row_totals[rowIndex] ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              {/* Total *selections* made in this column */}
              <td>Column Total Selections</td>
              {(gridData.column_totals || []).map((colTotal, colIndex) => (
                <td key={colIndex} className="column-total">
                  {colTotal ?? 0}
                </td>
              ))}
              {/* Display total number of respondents */}
              <td>Total Responses: {gridData.total_responses ?? 0}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders star-rating grid analytics using original styling structure:
 *  - Displays cell average (visual + numeric) and count.
 *  - Displays row average (visual + numeric) and total count ("Responses").
 *  - Displays column average (visual + numeric) and total count ("Responses").
 */
function renderStarRatingGridAnalytics(gridData) {
  // Basic data check already done in the main component
  if (
    !gridData ||
    !gridData.rows ||
    !gridData.columns ||
    !gridData.cell_averages ||
    !gridData.count_values ||
    !gridData.row_averages ||
    !gridData.row_totals ||
    !gridData.column_averages ||
    !gridData.column_totals
  ) {
    return <div className="no-data">Incomplete data for Star Rating Grid.</div>;
  }

  const numRows = gridData.rows.length;
  const numCols = gridData.columns.length;

  // Use safe defaults for potentially missing nested arrays/values - already done in processGridData, but defensive check is ok
  const cellAverages = gridData.cell_averages;
  const countValues = gridData.count_values;
  const rowAverages = gridData.row_averages;
  const rowTotals = gridData.row_totals; // Total responses per row
  const columnAverages = gridData.column_averages;
  const columnTotals = gridData.column_totals; // Total responses per column

  return (
    <div className="grid-analysis">
      <h4
        style={{
          background: "#aa2eff",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          fontWeight: "600",
          fontSize: "1.2em",
          marginBottom: "25px",
        }}
      >
        Star Rating Grid Analysis
      </h4>
      <div className="grid-table-container">
        <table className="grid-table star-rating-grid-table">
          <thead>
            <tr>
              <th style={{ background: "#f8f9fa", padding: "12px 15px" }}></th>
              {gridData.columns.map((col, colIndex) => (
                <th
                  key={colIndex}
                  style={{
                    background: "#f8f9fa",
                    padding: "12px 15px",
                    fontWeight: "600",
                    color: "#333",
                    textAlign: "center",
                  }}
                >
                  {typeof col === "object" ? col.text : col}
                </th>
              ))}
              <th
                style={{
                  background: "#f8f9fa",
                  padding: "12px 15px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Row Avg
              </th>
              <th
                style={{
                  background: "#f8f9fa",
                  padding: "12px 15px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                # of Responses
              </th>
            </tr>
          </thead>
          <tbody>
            {gridData.rows.map((row, rowIndex) => {
              const rowLabel = typeof row === "object" ? row.text : row;
              return (
                <tr key={rowIndex}>
                  <td
                    className="row-label"
                    style={{
                      padding: "15px",
                      fontWeight: "500",
                      color: "#333",
                      background: "#f8f9fa",
                    }}
                  >
                    {rowLabel}
                  </td>
                  {gridData.columns.map((_, colIndex) => {
                    const avg = cellAverages[rowIndex]?.[colIndex] ?? 0;
                    const count = countValues[rowIndex]?.[colIndex] ?? 0;
                    const rowTotal = rowTotals[rowIndex] ?? 0;
                    const percentage =
                      rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : 0;
                    return (
                      <td
                        key={colIndex}
                        className="cell star-rating-cell-display"
                        style={{
                          padding: "15px",
                          background: "white",
                          border: "1px solid #eee",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <StarRatingVisual rating={Number(avg) || 0} />
                          <span
                            style={{
                              fontSize: "1.1em",
                              fontWeight: "600",
                              color: "#333",
                            }}
                          >
                            {avg.toFixed(2)}
                          </span>
                          <span
                            style={{
                              fontSize: "0.85em",
                              color: "#666",
                              background: "#f8f9fa",
                              padding: "2px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            {count} ({percentage}%)
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className="row-average"
                    style={{
                      padding: "15px",
                      background: "#f8f9fa",
                      border: "1px solid #eee",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <StarRatingVisual
                        rating={Number(rowAverages[rowIndex]) || 0}
                      />
                      <span
                        style={{
                          fontSize: "1.1em",
                          fontWeight: "600",
                          color: "#333",
                        }}
                      >
                        {(Number(rowAverages[rowIndex]) || 0).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td
                    className="row-total"
                    style={{
                      padding: "15px",
                      textAlign: "center",
                      fontWeight: "500",
                      color: "#333",
                      background: "#f8f9fa",
                    }}
                  >
                    {rowTotals[rowIndex] ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                style={{
                  padding: "15px",
                  background: "#f8f9fa",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Column Avg
              </td>
              {gridData.columns.map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="column-average"
                  style={{
                    padding: "15px",
                    background: "#f8f9fa",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <StarRatingVisual
                      rating={Number(columnAverages[colIndex]) || 0}
                    />
                    <span
                      style={{
                        fontSize: "1.1em",
                        fontWeight: "600",
                        color: "#333",
                      }}
                    >
                      {(Number(columnAverages[colIndex]) || 0).toFixed(2)}
                    </span>
                  </div>
                </td>
              ))}
              <td colSpan="2"></td>
            </tr>
            <tr>
              <td
                style={{
                  padding: "15px",
                  background: "#f8f9fa",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                # of Responses
              </td>
              {gridData.columns.map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="column-total"
                  style={{
                    padding: "15px",
                    textAlign: "center",
                    fontWeight: "500",
                    color: "#333",
                    background: "#f8f9fa",
                  }}
                >
                  {columnTotals[colIndex] ?? 0}
                </td>
              ))}
              <td
                colSpan="2"
                style={{
                  padding: "15px",
                  textAlign: "center",
                  fontWeight: "600",
                  color: "#333",
                  background: "#f8f9fa",
                }}
              >
                Total Responses: {gridData.total_responses ?? 0}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Keep GridComparisonView and filter info rendering as they were, they reuse the main GridAnalytics
const GridComparisonView = ({
  questionId,
  surveyId,
  filterPayload1,
  filterPayload2,
  group1Name = "Group 1",
  group2Name = "Group 2",
}) => {
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to load data for comparison
  const loadFilteredGridAnalyticsInternal = async (
    surveyId,
    questionId,
    filterPayload
  ) => {
    try {
      const response = await analyticsAPI.getFilteredQuestionAnalytics(surveyId, questionId, filterPayload);
      return response.data;
    } catch (error) {
      console.error("Error loading filtered grid analytics:", error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchBothDatasets = async () => {
      setLoading(true);
      setError(null);
      setData1(null);
      setData2(null);
      try {
        console.log("Fetching comparison data for Group 1...");
        const result1 = await loadFilteredGridAnalyticsInternal(
          surveyId,
          questionId,
          filterPayload1
        );
        console.log("Group 1 data received:", result1);
        setData1(result1);

        console.log("Fetching comparison data for Group 2...");
        const result2 = await loadFilteredGridAnalyticsInternal(
          surveyId,
          questionId,
          filterPayload2
        );
        console.log("Group 2 data received:", result2);
        setData2(result2);
      } catch (err) {
        console.error("Error fetching comparison data:", err);
        setError(`Error loading comparison data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    if (surveyId && questionId && filterPayload1 && filterPayload2) {
      fetchBothDatasets();
    }
  }, [surveyId, questionId, filterPayload1, filterPayload2]);

  if (loading) return <div className="loading">Loading comparison data...</div>;
  if (error) return <div className="error">{error}</div>;
  
  // Check that both datasets loaded successfully AND contain the necessary grid structure
  const hasGridData = (data) =>
    data && (data.grid_data || data.analytics?.grid_data);
  if (!hasGridData(data1) || !hasGridData(data2)) {
    console.warn(
      "Missing grid data for comparison rendering. Data1:",
      data1,
      "Data2:",
      data2
    );
    return (
      <div className="no-data">
        Missing data required for comparison. Ensure both filter groups return
        valid grid analytics.
      </div>
    );
  }

  // Helper to render filter info - kept as is, uses textTransform and replaces underscores
  const renderGroupFilterInfo = (payload) => {
    if (!payload) return null;
    const entries = Object.entries(payload).filter(
      ([key, values]) => Array.isArray(values) && values.length > 0
    );
    if (entries.length === 0)
      return <div className="filter-info">No filters applied</div>;
    return (
      <div
        className="filter-info"
        style={{ marginBottom: "10px", fontSize: "0.9em", color: "#444" }}
      >
        <strong>Filters:</strong>
        {entries.map(([key, values]) => (
          <div key={key} style={{ marginLeft: "10px" }}>
            <span style={{ textTransform: "capitalize" }}>
              {key.replace(/_/g, " ")}
            </span>
            : {values.join(", ")}
          </div>
        ))}
      </div>
    );
  };

  // Determine question text safely from either dataset
  const getQuestionText = (data) =>
    data?.question_text || data?.analytics?.question_text;
  const questionText =
    getQuestionText(data1) || getQuestionText(data2) || "Grid Question";

  return (
    <div className="grid-comparison">
      <h2>Grid Comparison: {questionText}</h2>
      <div className="grid-comparison-container">
        <div className="grid-comparison-group">
          <h3>{group1Name}</h3>
          {renderGroupFilterInfo(filterPayload1)}
          {/* Pass the already fetched data directly to GridAnalytics */}
          <GridAnalytics
            data={data1}
            surveyId={surveyId} // Pass for context, GridAnalytics primarily uses data prop
            questionId={questionId} // Pass for context
            // filterPayload is intentionally omitted here, data is already filtered
          />
        </div>
        <div className="grid-comparison-group">
          <h3>{group2Name}</h3>
          {renderGroupFilterInfo(filterPayload2)}
          {/* Pass the already fetched data directly to GridAnalytics */}
          <GridAnalytics
            data={data2}
            surveyId={surveyId}
            questionId={questionId}
            // filterPayload is intentionally omitted here, data is already filtered
          />
        </div>
      </div>
    </div>
  );
};

// Standalone filter info renderer (optional, unused by default components)
const renderStandaloneFilterInfo = (filterPayload) => {
  if (
    !filterPayload ||
    !Object.keys(filterPayload).some(
      (key) =>
        Array.isArray(filterPayload[key]) && filterPayload[key].length > 0
    )
  ) {
    return null;
  }
  const filterDescriptions = Object.entries(filterPayload)
    .filter(([key, values]) => Array.isArray(values) && values.length > 0)
    .map(([key, values]) => `${key.replace(/_/g, " ")}: ${values.join(", ")}`);

  return (
    <div
      className="grid-filter-info"
      style={{ fontStyle: "italic", color: "#555", marginBottom: "10px" }}
    >
      <p>Filtered by: {filterDescriptions.join(" | ")}</p>
    </div>
  );
};

// Export the StarRatingVisual component so it can be used in other files
export { StarRatingVisual };

export default GridAnalytics;
