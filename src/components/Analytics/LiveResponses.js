import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import { useParams } from "react-router-dom";
import "./Analytics.css";
import Pagination from "./Pagination";
import { surveyAPI } from "services/apiClient";
import toast from "react-hot-toast"; // Import toast for feedback

/**
 * LiveResponses – show incoming survey submissions in real‑time with optional
 * filtering + pagination.
 * ---------------------------------------------------------------------------
 * ✓ Uses apiClient for network calls.
 * ✓ Handles paginated response data structure.
 * ✓ Displays detailed submission info (email, completion, demographics).
 * ✓ Displays individual responses within a details dropdown.
 * ✓ Builds query parameters correctly.
 * ✓ Includes export functionality.
 * ✓ Uses existing CSS classes.
 */

const DEFAULT_PER_PAGE = 20;

const LiveResponses = () => {
  const { surveyId } = useParams();

  /* --------------- state ----------------- */
  const [responses, setResponses] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
    perPage: DEFAULT_PER_PAGE,
  });

  /**
   * All filter fields – keep exactly in sync with API expectations!
   */
  const [filters, setFilters] = useState({
    age_min: "",
    age_max: "",
    email_domain: "",
    submitted_after: "",
    submitted_before: "",
    gender: "",
    location: "",
    education: "",
    company: "",
    device_type: "",
    link_id: "",
    page: 1,
    per_page: DEFAULT_PER_PAGE,
  });

  /* ---------- helpers ---------- */
  const buildParams = useCallback(() => { // useCallback for stability if passed as prop
    const params = { ...filters };
    Object.keys(params).forEach((key) => {
      if (params[key] === "" || params[key] == null) delete params[key];
    });
    return params;
  }, [filters]); // Depend on filters state

  const formatDate = (iso) => {
    if (!iso) return "N/A";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso; // Return original string if parsing fails
    }
  };

  /* ---------------- API calls ---------------- */
  const fetchLinks = useCallback(async () => { // useCallback
    if (!surveyId) return;
    try {
      const { data } = await surveyAPI.getLinks(surveyId); // Use the correct API method
      setLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[LiveResponses] fetchLinks error", err);
      // Optionally show a toast error
      // toast.error("Could not load distribution links.");
    }
  }, [surveyId]); // Depend on surveyId

  const fetchResponses = useCallback(async () => { // useCallback
    if (!surveyId) return;
    setLoading(true);
    setError("");
    try {
      // Use the correct API method and pass built params
      // *** Using surveyAPI.getLiveResponses which should now have the correct path ***
      const response = await surveyAPI.getLiveResponses(surveyId, buildParams());
      const responseData = response.data;

      // Expecting { results: [], pagination: {} } structure
      if (responseData && Array.isArray(responseData.results) && responseData.pagination) {
        setResponses(responseData.results);
        setPagination({
          currentPage: responseData.pagination.current_page || 1,
          totalPages: responseData.pagination.total_pages || 1,
          totalResults: responseData.pagination.total_results || 0,
          perPage: responseData.pagination.per_page || DEFAULT_PER_PAGE,
        });
      } else {
        // Handle cases where the structure might be different or empty
        console.warn("[LiveResponses] Unexpected data structure or no results:", responseData);
        console.warn("[LiveResponses] Expected: {results: [], pagination: {}}, got:", {
          hasResults: responseData?.results !== undefined,
          resultsType: Array.isArray(responseData?.results) ? 'array' : typeof responseData?.results,
          hasPagination: responseData?.pagination !== undefined,
          paginationType: typeof responseData?.pagination,
          fullStructure: responseData
        });
        
        setResponses([]); // Clear responses on unexpected format
        setPagination({ // Reset pagination
          currentPage: 1,
          totalPages: 1,
          totalResults: 0,
          perPage: DEFAULT_PER_PAGE,
        });
        
        // Set error only if it's truly an unexpected format, not just empty results
        if (!responseData || (!Array.isArray(responseData.results) && responseData.results !== undefined) || (responseData.pagination !== undefined && typeof responseData.pagination !== 'object')) {
             setError(`Received unexpected data format. Expected {results: [], pagination: {}}, got: ${JSON.stringify(responseData, null, 2)}`);
        }
      }
    } catch (err) {
      console.error("[LiveResponses] fetchResponses error", err);
      const errorMsg = err.response?.data?.error || err.message || "Failed to load responses";
      setError(errorMsg);
      setResponses([]); // Clear data on error
      setPagination({ // Reset pagination on error
        currentPage: 1,
        totalPages: 1,
        totalResults: 0,
        perPage: DEFAULT_PER_PAGE,
      });
      toast.error(`Error: ${errorMsg}`); // Show toast feedback
    } finally {
      setLoading(false);
    }
  }, [surveyId, buildParams]); // Depend on surveyId and buildParams

  const exportResponses = (format) => {
    const currentParams = buildParams();
    // Remove pagination params for export, backend fetches all
    delete currentParams.page;
    delete currentParams.per_page;

    const params = new URLSearchParams(currentParams);
    params.set("format", format);

    // *** Use the correct export endpoint from apiClient ***
    const exportUrl = `/api/surveys/${surveyId}/export-responses?${params.toString()}`;

    console.log('Triggering export:', exportUrl);
    toast.loading('Generating export...', { id: 'export-toast' }); // Show feedback

    // Use fetch for better error handling potential
    fetch(exportUrl, {
        method: 'GET',
        headers: {
             // Add Authorization header if needed, assuming token is stored
             'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`, // Use consistent key
             'Accept': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
    })
    .then(async res => {
        if (!res.ok) {
            // Attempt to read error message from JSON response
            let errorMsg = `Export failed (Status: ${res.status})`;
            try {
                 const errorData = await res.json();
                 errorMsg = errorData.error || errorData.details || errorMsg;
            } catch (jsonError) {
                 // If response isn't JSON, use status text
                 errorMsg = `Export failed: ${res.statusText || 'Server error'}`;
            }
            throw new Error(errorMsg);
        }
        // Get filename from Content-Disposition header
        const disposition = res.headers.get('Content-Disposition');
        let filename = `survey_${surveyId}_export.${format}`; // Default filename
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
        // Create a link and trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Export download started!', { id: 'export-toast' });
    })
    .catch(err => {
        console.error("Export error:", err);
        toast.error(`${err.message}`, { id: 'export-toast' });
    });
};

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    if (!surveyId) return; // Prevent fetching if surveyId isn't available yet
    fetchLinks();
    fetchResponses(); // Initial fetch

    // Set up polling timer
    const timer = setInterval(() => {
        if (document.visibilityState === 'visible') { // Only fetch if tab is active
             fetchResponses();
        }
    }, 30000); // Poll every 30 seconds

    // Cleanup timer on component unmount
    return () => clearInterval(timer);
  }, [surveyId, fetchResponses, fetchLinks]); // Use useCallback functions in dependency array


  /* ---------------- Handlers ---------------- */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    // Reset to page 1 when applying filters
    setFilters((prev) => ({ ...prev, page: 1 }));
    // fetchResponses will be triggered by the state change via the dependency array
    // or call it explicitly if preferred for immediate feedback
    fetchResponses();
  };

  const handlePageChange = (page) => {
    // Update the page filter, which will trigger fetchResponses via useEffect
    setFilters((p) => ({ ...p, page }));
  };

  /* ---------------- render helpers ---------------- */
  const renderRows = () => {
    if (loading && responses.length === 0) return null; // Don't show "No responses" while initially loading
    if (!loading && responses.length === 0 && !error) // Check for error too
      return (
        <tr>
          <td colSpan="9" style={{ textAlign: "center", padding: 20 }}>
            No responses found matching your criteria.
          </td>
        </tr>
      );
    if (error && responses.length === 0) return null; // Don't show "No responses" if there was an error

    return responses.map((sub) => (
      <tr key={sub.submission_id}>
        <td>{sub.submission_id}</td>
        <td>{formatDate(sub.submitted_at)}</td>
        <td>
          {sub.duration != null
            ? `${Math.floor(sub.duration / 60)}m ${sub.duration % 60}s`
            : "N/A"}
        </td>
        {/* Completion Percentage */}
        <td>
          {sub.completion_percentage != null
            ? `${sub.completion_percentage.toFixed(1)}%`
            : "N/A"
          }
        </td>
        {/* Email */}
        <td>{sub.email || "N/A"}</td>
        {/* Demographics */}
                        <td>
          <details>
            <summary>View</summary>
            <ul className="demographics-list">
               {/* Use optional chaining and nullish coalescing for safety */}
              <li>
                <strong>Age:</strong> {sub.age ?? "N/A"}
              </li>
              <li>
                <strong>Gender:</strong> {sub.gender ?? "N/A"}
              </li>
              <li>
                <strong>Location:</strong> {sub.location ?? "N/A"}
              </li>
               <li>
                <strong>Education:</strong> {sub.education ?? "N/A"}
              </li>
               <li>
                <strong>Company:</strong> {sub.company ?? "N/A"}
              </li>
            </ul>
          </details>
        </td>
        <td>
          {/* Display Device/Browser */}
          {sub.device_type || "N/A"}
          {sub.browser_info && ` / ${sub.browser_info}`}
        </td>
        <td>
          {/* Display Link Label or Code */}
           {sub.distribution_link?.label || sub.distribution_link?.code || `Link ID: ${sub.distribution_link?.id}` || "N/A"}
        </td>
        <td>
          {/* Display Individual Responses */}
          <details>
            <summary>View Responses</summary>
            <ul className="responses-list">
              {sub.responses && Array.isArray(sub.responses) && sub.responses.length > 0 ? (
                sub.responses.map((r, idx) => (
                  <li key={`${sub.submission_id}-resp-${idx}`}> {/* More unique key */}
                    <strong>
                      {r.question_text || `Q ID: ${r.question_id}`}:
                    </strong>{" "}
                    {/* Display formatted response */}
                    {(() => {
                      const responseText = r.response_text;
                      
                      // Handle arrays (from JSON multi-select)
                      if (Array.isArray(responseText)) {
                        return responseText.join(", ");
                      }
                      
                      // Handle strings
                      if (typeof responseText === 'string') {
                          // First check if it's already formatted (contains commas from controller)
                          if (responseText.includes(', ') && !responseText.startsWith('[') && !responseText.startsWith('{')) {
                              return responseText; // Already formatted by controller
                          }
                          
                          // Try to parse JSON strings
                          try {
                              const parsed = JSON.parse(responseText);
                              
                              if (Array.isArray(parsed)) {
                                  return parsed.join(", ");
                              }
                              
                              if (typeof parsed === 'object' && parsed !== null) {
                                  // For grid responses, format nicely
                                  if (r.question_type === 'grid' || r.question_type === 'radio-grid' || r.question_type === 'checkbox-grid') {
                                      const entries = Object.entries(parsed);
                                      if (entries.length > 0) {
                                          return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | ');
                                      }
                                  }
                                  // For other objects, use simple stringification
                                  return JSON.stringify(parsed, null, 0);
                              }
                              
                              return String(parsed);
                          } catch {
                              // If not valid JSON, return the text directly
                              return responseText;
                          }
                      }
                      
                      // Handle null/undefined or other types
                      return responseText ?? "N/A";
                    })()}
                    {/* Display response time if available */}
                    {r.response_time != null && (
                      <span className="response-time">
                        ({r.response_time}s)
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li>No response details available.</li>
              )}
            </ul>
          </details>
        </td>
      </tr>
    ));
  };


  /* ---------------- UI ---------------- */
  return (
    <div className="analytics-dashboard-questions"> {/* Use existing main class */}
      <h2 className="chart-title">Live Responses</h2> {/* Use existing class */}

      {/* Filters Form */}
      <div className="distribution-form"> {/* Use existing class */}
        <h4
          style={{
            fontFamily: "Clash Display, sans-serif", // Keep inline style if needed
            marginBottom: 20,
            color: "#333",
          }}
        >
          Filters
        </h4>
        <form onSubmit={applyFilters}>
          {/* Responsive grid layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 15,
            }}
          >
            {/* Filter Inputs (using existing classes) */}
            <div>
              <label className="distribution-label2">Age Min:</label>
              <input
                className="distribution-input2"
                type="number"
                name="age_min"
                value={filters.age_min}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Age Max:</label>
              <input
                className="distribution-input2"
                type="number"
                name="age_max"
                value={filters.age_max}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Email Domain:</label>
              <input
                className="distribution-input2"
                type="text"
                name="email_domain"
                value={filters.email_domain}
                onChange={handleFilterChange}
                placeholder="example.com"
              />
            </div>
            <div>
              <label className="distribution-label2">Submitted After:</label>
              <input
                className="distribution-input2"
                type="datetime-local"
                name="submitted_after"
                value={filters.submitted_after}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Submitted Before:</label>
              <input
                className="distribution-input2"
                type="datetime-local"
                name="submitted_before"
                value={filters.submitted_before}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Gender:</label>
              <select
                className="distribution-input2"
                name="gender"
                value={filters.gender}
                onChange={handleFilterChange}
              >
                <option value="">All</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="distribution-label2">Location:</label>
              <input
                className="distribution-input2"
                type="text"
                name="location"
                value={filters.location}
                onChange={handleFilterChange}
              />
            </div>
             <div>
              <label className="distribution-label2">Education:</label>
              <input
                className="distribution-input2"
                type="text"
                name="education"
                value={filters.education}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Company:</label>
              <input
                className="distribution-input2"
                type="text"
                name="company"
                value={filters.company}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="distribution-label2">Device Type:</label>
              <select
                className="distribution-input2"
                name="device_type"
                value={filters.device_type}
                onChange={handleFilterChange}
              >
                <option value="">All</option>
                <option value="Mobile">Mobile</option>
                <option value="Desktop">Desktop</option>
                <option value="Tablet">Tablet</option>
              </select>
            </div>
            <div>
              <label className="distribution-label2">Distribution Link:</label>
              <select
                className="distribution-input2"
                name="link_id"
                value={filters.link_id}
                onChange={handleFilterChange}
                disabled={links.length === 0} // Disable if links haven't loaded
              >
                <option value="">All Links</option>
                {links.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label || l.code} ({l.id}) {/* Show ID for clarity */}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions Row */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: 'center', // Align items vertically
              flexWrap: "wrap",
              gap: 10
            }}
          >
            {/* Apply Filters Button */}
            <button type="submit" className="chart-button primary">
              Apply Filters
            </button>

            {/* Export Buttons */}
            <div className="export-buttons-group"> {/* Optional: Group buttons */}
              <button
                type="button"
                className="chart-button secondary"
                onClick={() => exportResponses("csv")}
                disabled={loading || responses.length === 0} // Disable if loading or no data
                title={responses.length === 0 ? "No data to export" : "Export as CSV"}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="chart-button secondary"
                onClick={() => exportResponses("xlsx")}
                disabled={loading || responses.length === 0} // Disable if loading or no data
                title={responses.length === 0 ? "No data to export" : "Export as Excel (XLSX)"}
                style={{ marginLeft: 10 }} // Keep margin if desired
              >
                Export XLSX
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Message Display */}
      {error && (
        <div className="error-message" style={{ margin: "15px 0", color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Results Count */}
      <div style={{ margin: "20px 0 10px", color: "#000", fontSize: '0.9em' }}>
         {loading ? 'Loading...' : `${pagination.totalResults} response${pagination.totalResults !== 1 ? 's' : ''} found.`}
      </div>

      {/* Table Section */}
      {loading && responses.length === 0 ? ( // Show spinner only when initially loading
        <div className="loading-spinner" style={{ margin: '30px auto', textAlign: 'center' }}>Loading responses...</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}> {/* Make table horizontally scrollable */}
            <table className="analytics-table"> {/* Use existing class */}
              <thead>
                <tr>
                  {/* Table Headers */}
                  <th>ID</th>
                  <th>Submitted At</th>
                  <th>Duration</th>
                  <th>Completion</th>
                  <th>Email</th>
                  <th>Demographics</th>
                  <th>Device/Browser</th>
                  <th>Link</th>
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default LiveResponses;