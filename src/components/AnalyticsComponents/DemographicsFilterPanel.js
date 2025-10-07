// Enhanced DemographicsFilterPanel.js with comparison support
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QuestionAnalyticsChart from './QuestionAnalyticsChart';
import './AnalyticsComponents.css';
import ComparisonChart from './ComparisonChart';
import { analyticsAPI, surveyAPI } from 'services/apiClient';
export default function DemographicsFilterPanel() {
  const { surveyId } = useParams();
  
  // State for demographic options
  const [availableOptions, setAvailableOptions] = useState({
    age_groups: [],
    locations: [],
    genders: [],
    education: [],
    companies: [],
    cohorts: []
  });
  
  // State for comparison mode
  const [comparisonMode, setComparisonMode] = useState(false);
  
const [questionAnalytics1, setQuestionAnalytics1] = useState(null);
const [questionAnalytics2, setQuestionAnalytics2] = useState(null);
const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  // Filter states for both groups
  const [filtersGroup1, setFiltersGroup1] = useState({
    age_group: [],
    location: [],
    gender: [],
    education: [],
    company: [],
    cohort_tag: []
  });
  
  const fetchFilteredQuestionAnalytics = async (questionId, filters, setStateFunction) => {
    console.log("Fetching filtered question analytics:", {
      questionId,
      filters
    });
    
    try {

      console.log("Request payload:", { filters });
      
      const response = await analyticsAPI.getFilteredQuestionAnalytics(surveyId, questionId, filters);
      

      
      const data =  response.data;
      console.log("Received filtered question analytics:", data);
      
      // Log detailed analytics information
      if (data.analytics) {
        console.log("Analytics type:", data.analytics.type);
        console.log("Total responses:", data.total_responses);
        
        // Log specific details based on analytics type
        if (data.analytics.type === 'single_select_distribution') {
          console.log("Option distribution count:", data.analytics.options_distribution?.length);
          if (data.analytics.options_distribution && data.analytics.options_distribution.length > 0) {
            console.log("Top option:", data.analytics.options_distribution[0]);
          }
        } else if (data.analytics.type === 'multi_select_distribution') {
          console.log("Option distribution count:", data.analytics.option_distribution?.length);
          if (data.analytics.option_distribution && data.analytics.option_distribution.length > 0) {
            console.log("Top option:", data.analytics.option_distribution[0]);
          }
        } else if (data.analytics.type === 'numeric_stats') {
          console.log("Numeric stats:", {
            mean: data.analytics.mean,
            median: data.analytics.median,
            min: data.analytics.min,
            max: data.analytics.max
          });
        } else if (data.analytics.type === 'grid_data') {
          console.log("Grid data metrics:", {
            rows: data.analytics.grid_data?.rows?.length,
            columns: data.analytics.grid_data?.columns?.length,
            totalResponses: data.analytics.grid_data?.total_responses
          });
        }
      } else {
        console.warn("No analytics data in response");
      }
      
      setStateFunction(data);
    } catch (err) {
      console.error('Error fetching filtered question analytics:', err);
      throw err;
    }
  };

  const [filtersGroup2, setFiltersGroup2] = useState({
    age_group: [],
    location: [],
    gender: [],
    education: [],
    company: [],
    cohort_tag: []
  });
  
  // Group names
  const [group1Name, setGroup1Name] = useState('Group 1');
  const [group2Name, setGroup2Name] = useState('Group 2');
  
  // State for filtered data
  const [filteredDataGroup1, setFilteredDataGroup1] = useState(null);
  const [filteredDataGroup2, setFilteredDataGroup2] = useState(null);
  
  // Selected question for detailed view
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Get auth token
  const token = localStorage.getItem('token');
  
  // Fetch available demographic options
  useEffect(() => {
    const fetchDemographicsOptions = async () => {
      try {
        setLoading(true);
        const response = await surveyAPI.getDemographicAnalytics(surveyId,{});
        
       
        const data = response.data;
        console.log('Demographic options data:', data);
        
        if (data.demographics) {
          // Extract unique values for each demographic category
          const options = {
            age_groups: Object.keys(data.demographics.age_groups || {}),
            locations: Object.keys(data.demographics.locations || {}),
            genders: Object.keys(data.demographics.genders || {}),
            education: Object.keys(data.demographics.education || {}),
            companies: Object.keys(data.demographics.companies || {}),
            cohorts: Object.keys(data.demographics.cohorts || {})
          };
          
          // Filter out 'Unknown' or empty values
          for (const category in options) {
            options[category] = options[category].filter(item => 
              item && item !== 'undefined' && item !== 'Unknown'
            );
          }
          
          setAvailableOptions(options);
        }
      } catch (err) {
        console.error('Error fetching demographic options:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (surveyId) {
      fetchDemographicsOptions();
    }
  }, [surveyId, token]);
  





  
  // Handle filter changes for group 1
  const handleFilterChangeGroup1 = (category, value, isChecked) => {
    setFiltersGroup1(prev => {
      const updatedFilters = { 
        ...prev,
        [category]: Array.isArray(prev[category]) ? [...prev[category]] : []
      };
      
      if (isChecked) {
        if (!updatedFilters[category].includes(value)) {
          updatedFilters[category].push(value);
        }
      } else {
        updatedFilters[category] = updatedFilters[category].filter(item => item !== value);
      }
      
      return updatedFilters;
    });
  };
  
  // Handle filter changes for group 2
  const handleFilterChangeGroup2 = (category, value, isChecked) => {
    setFiltersGroup2(prev => {
      const updatedFilters = { 
        ...prev,
        [category]: Array.isArray(prev[category]) ? [...prev[category]] : []
      };
      
      if (isChecked) {
        if (!updatedFilters[category].includes(value)) {
          updatedFilters[category].push(value);
        }
      } else {
        updatedFilters[category] = updatedFilters[category].filter(item => item !== value);
      }
      
      return updatedFilters;
    });
  };
  
  // Apply filters and fetch analytics
  const handleApplyFilters = async () => {
    console.log("Applying demographic filters...");
    console.log("Current state:", {
      comparisonMode,
      filtersGroup1,
      filtersGroup2,
      group1Name,
      group2Name
    });
    
    setLoading(true);
    setError('');
    setFilteredDataGroup1(null);
    setFilteredDataGroup2(null);
    setSelectedQuestionId(null);
    
    try {
      // Prepare filter payloads
      const filterPayload1 = {};
      for (const category in filtersGroup1) {
        if (filtersGroup1[category] && filtersGroup1[category].length > 0) {
          filterPayload1[category] = filtersGroup1[category];
        }
      }
      
      console.log(`Prepared filter payload for ${group1Name}:`, filterPayload1);
      
      // Fetch analytics for group 1
      console.log(`Making POST request to /surveys/${surveyId}/demographic-analytics for ${group1Name}`);
      const response1 = await surveyAPI.getDemographicAnalytics(surveyId, filterPayload1);

      
      const data1 =response1.data;
      console.log(`Received demographic data for ${group1Name}:`, data1);
      
      // Enhanced logging to debug question data
      console.log("FULL demographic data for Group 1:", JSON.stringify(data1, null, 2));
      console.log(`Filtered responses count: ${data1.total_responses}`);
      console.log(`Question data available: ${Object.keys(data1.question_stats || {}).length} questions`);
      
      if (data1.question_stats) {
        console.log("Sample of question IDs:", Object.keys(data1.question_stats).slice(0, 5));
        // Log details of first question if available
        const firstQuestionId = Object.keys(data1.question_stats)[0];
        if (firstQuestionId) {
          console.log("First question details:", data1.question_stats[firstQuestionId]);
        }
      } else {
        console.warn("No question_stats found in response");
      }
      
      setFilteredDataGroup1(data1);
      
      // If in comparison mode, fetch data for group 2
      if (comparisonMode) {
        console.log("Comparison mode enabled, fetching data for second group...");
        const filterPayload2 = {};
        for (const category in filtersGroup2) {
          if (filtersGroup2[category] && filtersGroup2[category].length > 0) {
            filterPayload2[category] = filtersGroup2[category];
          }
        }
        
        console.log(`Prepared filter payload for ${group2Name}:`, filterPayload2);
        
        console.log(`Making POST request to /surveys/${surveyId}/demographic-analytics for ${group2Name}`);
        const response2 = await surveyAPI.getDemographicAnalytics(surveyId, filterPayload2);
        
       
        
        const data2 =response2.data;
        console.log(`Received demographic data for ${group2Name}:`, data2);
        
        // Enhanced logging for Group 2
        console.log("FULL demographic data for Group 2:", JSON.stringify(data2, null, 2));
        console.log(`Filtered responses count: ${data2.total_responses}`);
        console.log(`Question data available: ${Object.keys(data2.question_stats || {}).length} questions`);
        
        if (data2.question_stats) {
          console.log("Sample of question IDs:", Object.keys(data2.question_stats).slice(0, 5));
          // Log details of first question if available
          const firstQuestionId = Object.keys(data2.question_stats)[0];
          if (firstQuestionId) {
            console.log("First question details:", data2.question_stats[firstQuestionId]);
          }
        } else {
          console.warn("No question_stats found in response");
        }
        
        setFilteredDataGroup2(data2);
      }
      
      console.log("Filter application completed successfully");
    } catch (err) {
      console.error('Error applying filters:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // Reset all filters
  const handleResetFilters = () => {
    setFiltersGroup1({
      age_group: [],
      location: [],
      gender: [],
      education: [],
      company: [],
      cohort_tag: []
    });
    
    setFiltersGroup2({
      age_group: [],
      location: [],
      gender: [],
      education: [],
      company: []
    });
    
    setFilteredDataGroup1(null);
    setFilteredDataGroup2(null);
    setSelectedQuestionId(null);
  };
  
  // Toggle comparison mode
  const toggleComparisonMode = () => {
    setComparisonMode(!comparisonMode);
    
    // Reset data when toggling modes
    setFilteredDataGroup1(null);
    setFilteredDataGroup2(null);
    setSelectedQuestionId(null);
  };
  
  // Render filter checkboxes for a category
  const renderFilterCheckboxes = (category, displayName, groupNumber) => {
    const categoryKey = category === 'genders' ? 'gender' : 
                      category === 'locations' ? 'location' : 
                      category === 'age_groups' ? 'age_group' : 
                      category === 'cohorts' ? 'cohort_tag' : // Map cohorts to cohort_tag
                      category; // Default case
    
    const filters = groupNumber === 1 ? filtersGroup1 : filtersGroup2;
    const handleFilterChange = groupNumber === 1 ? handleFilterChangeGroup1 : handleFilterChangeGroup2;
    
    // Ensure we have an array for this category
    if (!filters[categoryKey]) {
      if (groupNumber === 1) {
        setFiltersGroup1(prev => ({...prev, [categoryKey]: []}));
      } else {
        setFiltersGroup2(prev => ({...prev, [categoryKey]: []}));
      }
      return null; // Skip rendering this cycle
    }
    
    return (
      <div className="demographics-filter-section">
        <h4 className="demographics-filter-heading">{displayName}</h4>
        <div className="demographics-filter-options">
          {availableOptions[category] && availableOptions[category].length > 0 ? (
            availableOptions[category].map((option, index) => (
              <div key={index} className="demographics-filter-option">
                <label className="demographics-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters[categoryKey].includes(option)}
                    onChange={(e) => handleFilterChange(categoryKey, option, e.target.checked)}
                    className="demographics-checkbox"
                  />
                  <span className="demographics-option-text">{option}</span>
                </label>
              </div>
            ))
          ) : (
            <p className="demographics-no-options">No options available</p>
          )}
        </div>
      </div>
    );
  };
  
  // Handle selecting a question for detailed analysis
  const handleQuestionSelect = async (questionId) => {
    console.log("Question selected for analytics:", questionId);
    setSelectedQuestionId(questionId);
    setQuestionAnalytics1(null);
    setQuestionAnalytics2(null);
    setLoadingAnalytics(true);
    
    try {
      // Prepare filter payloads
      const filterPayload1 = {};
      for (const category in filtersGroup1) {
        if (filtersGroup1[category] && filtersGroup1[category].length > 0) {
          filterPayload1[category] = filtersGroup1[category];
        }
      }
      
      console.log(`Fetching question analytics for ${group1Name} with filters:`, filterPayload1);
      
      // Fetch data for group 1
      await fetchFilteredQuestionAnalytics(questionId, filterPayload1, setQuestionAnalytics1);
      
      // If in comparison mode, fetch data for group 2
      if (comparisonMode) {
        const filterPayload2 = {};
        for (const category in filtersGroup2) {
          if (filtersGroup2[category] && filtersGroup2[category].length > 0) {
            filterPayload2[category] = filtersGroup2[category];
          }
        }
        
        console.log(`Fetching question analytics for ${group2Name} with filters:`, filterPayload2);
        
        await fetchFilteredQuestionAnalytics(questionId, filterPayload2, setQuestionAnalytics2);
      }
      
    } catch (err) {
      console.error("Error selecting question:", err);
      setError(`Failed to load question analytics: ${err.message}`);
    } finally {
      setLoadingAnalytics(false);
      console.log("Question analytics fetch completed");
    }
  };
  
  // Function to fetch filtered question analytics

  // Render list of questions from filtered data for a group
// Render list of questions from filtered data for a group
const renderQuestionsList = (filteredData, groupName) => {
  console.log(`Rendering questions list for ${groupName}:`, filteredData);
  
  if (!filteredData) {
    return (
      <div className="demographics-no-data">
        No data available for {groupName}. Apply filters to see results.
      </div>
    );
  }
  
  // Check for question_stats in the data
  if (!filteredData.question_stats || Object.keys(filteredData.question_stats).length === 0) {
    console.log(`No question_stats found for ${groupName}`, filteredData);
    return (
      <div className="demographics-no-data">
        No question data available for {groupName}. Apply filters to see results.
      </div>
    );
  }
  
  // Log what we have for debugging
  console.log(`Found ${Object.keys(filteredData.question_stats).length} questions for ${groupName}`);
  
  return (
    <div className="demographics-questions-container">
      <h4 className="demographics-questions-title">
        Questions ({groupName} - {filteredData.total_responses} responses)
      </h4>
      
      <div className="demographics-questions-list">
        {Object.entries(filteredData.question_stats).map(([questionId, questionData]) => (
          <div 
            key={questionId} 
            className="demographics-question-item"
            onClick={() => handleQuestionSelect(questionId)}
          >
            <div className="demographics-question-content">
              <p className="demographics-question-text">
                <span className="question-sequence">#{questionData.sequence_number || '?'}: </span>
                {questionData.question_text}
              </p>
              <p className="demographics-question-type">
                {questionData.question_type}
                {questionData.is_grid && " (Grid)"}
              </p>
            </div>
            <div className="demographics-question-stats">
              <p className="demographics-response-count">
                {questionData.response_count} responses
              </p>
              
              {/* Show preview of key statistics if available */}
              {questionData.options && questionData.options.length > 0 && (
                <div className="question-preview">
                  <p className="top-option">
                    Top: {questionData.options[0].option} ({questionData.options[0].percentage}%)
                  </p>
                </div>
              )}
              
              {questionData.stats && (
                <div className="question-preview">
                  <p className="question-avg">
                    Avg: {questionData.stats.mean}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
  
  // Render demographics summary for a group
  const renderDemographicsSummary = (filteredData, groupName) => {
    if (!filteredData || !filteredData.demographics) return null;
    
    return (
      <div className="demographics-summary">
        <h4 className="demographics-summary-title">{groupName} Demographics</h4>
        <div className="demographics-summary-grid">
          {Object.entries(filteredData.demographics).map(([category, data]) => (
            <div key={category} className="demographics-summary-card">
              <h5 className="demographics-category-title">{category.replace('_', ' ')}</h5>
              <ul className="demographics-category-list">
                {Object.entries(data).slice(0, 5).map(([key, valueObj]) => (
                  <li key={key} className="demographics-stat-item">
                    <span className="stat-label">{key}</span>
                    <span className="stat-value">{valueObj.count} ({valueObj.percentage}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render the comparison view for a selected question
  const renderComparisonView = () => {
    if (!selectedQuestionId) return null;
    
    return (
      <div className="comparison-view">
        <div className="comparison-header">
          <h3 className="comparison-title">Question Comparison</h3>
          <button 
            onClick={() => {
              setSelectedQuestionId(null);
              setQuestionAnalytics1(null);
              setQuestionAnalytics2(null);
            }}
            className="comparison-close-btn"
          >
            Close
          </button>
        </div>
        
        <div className="comparison-content">
          {loadingAnalytics ? (
            <div className="comparison-loading">
              Loading question analytics...
            </div>
          ) : (
            <>
              {comparisonMode && questionAnalytics1 && questionAnalytics2 ? (
                // Enhanced side-by-side comparison
                <div className="enhanced-comparison">
                  <ComparisonChart 
                    group1Data={questionAnalytics1}
                    group2Data={questionAnalytics2}
                    group1Name={group1Name}
                    group2Name={group2Name}
                    chartType="bar"
                  />
                </div>
              ) : questionAnalytics1 ? (
                // Single group view
                <div className="single-chart">
                  <QuestionAnalyticsChart 
                    surveyId={surveyId} 
                    questionId={selectedQuestionId} 
                    filterPayload={filtersGroup1}
                    onClose={() => {
                      setSelectedQuestionId(null);
                      setQuestionAnalytics1(null);
                      setQuestionAnalytics2(null);
                    }}
                  />
                </div>
              ) : (
                <div className="comparison-no-data">
                  No data available for the selected question and filters.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  
  return (
    <div className="demographics-panel-container">
      <div className="demographics-header">
        <h3 className="demographics-title">Filter Analytics by Demographics</h3>
        
        {/* Toggle for comparison mode */}
        <div className="comparison-toggle" style={{ color: 'black' }}>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={comparisonMode}
              onChange={toggleComparisonMode}
              className="toggle-input"
            />
            <span className="toggle-text">Enable Comparison Mode</span>
          </label>
        </div>
      </div>
      
      <div className="demographics-content">
        {comparisonMode ? (
          // Comparison mode layout (two filter sections)
          <div className="comparison-filters-container">
            <div className="comparison-group-filters">
              <div className="comparison-group-header">
                <h3 className="comparison-group-title">{group1Name} Filters</h3>
                <input
                  type="text"
                  value={group1Name}
                  onChange={(e) => setGroup1Name(e.target.value)}
                  className="group-name-input"
                  placeholder="Group 1 Name"
                />
              </div>
              <div className="demographics-grid">
                <div className="demographics-card">
                  {renderFilterCheckboxes('age_groups', 'Age Groups', 1)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('genders', 'Gender', 1)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('locations', 'Location', 1)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('education', 'Education', 1)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('companies', 'Company', 1)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('cohorts', 'Cohort/Tag', 1)}
                </div>
              </div>
            </div>
            
            <div className="comparison-group-filters">
              <div className="comparison-group-header">
                <h3 className="comparison-group-title">{group2Name} Filters</h3>
                <input
                  type="text"
                  value={group2Name}
                  onChange={(e) => setGroup2Name(e.target.value)}
                  className="group-name-input"
                  placeholder="Group 2 Name"
                />
              </div>
              <div className="demographics-grid">
                <div className="demographics-card">
                  {renderFilterCheckboxes('age_groups', 'Age Groups', 2)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('genders', 'Gender', 2)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('locations', 'Location', 2)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('education', 'Education', 2)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('companies', 'Company', 2)}
                </div>
                <div className="demographics-card">
                  {renderFilterCheckboxes('cohorts', 'Cohort/Tag', 2)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Single filter mode layout
          <div className="demographics-grid">
            <div className="demographics-card">
              {renderFilterCheckboxes('age_groups', 'Age Groups', 1)}
            </div>
            <div className="demographics-card">
              {renderFilterCheckboxes('genders', 'Gender', 1)}
            </div>
            <div className="demographics-card">
              {renderFilterCheckboxes('locations', 'Location', 1)}
            </div>
            <div className="demographics-card">
              {renderFilterCheckboxes('education', 'Education', 1)}
            </div>
            <div className="demographics-card">
              {renderFilterCheckboxes('companies', 'Company', 1)}
            </div>
            <div className="demographics-card">
              {renderFilterCheckboxes('cohorts', 'Cohort/Tag', 1)}
            </div>
          </div>
        )}
        
        <div className="demographics-actions">
          <button
            onClick={handleResetFilters}
            className="demographicsnew-btn secondary"
          >
            Reset Filters
          </button>
          <button
            onClick={handleApplyFilters}
            className="demographicsnew-btn primary"
            disabled={loading}
          >
            {loading ? 'Applying...' : 'Apply Filters'}
          </button>
        </div>
        
        {error && (
          <div className="demographics-error">
            {error}
          </div>
        )}
      </div>
      
      {/* Results display */}
      <div className="demographics-results">
        {comparisonMode && filteredDataGroup1 && filteredDataGroup2 ? (
          // Comparison results layout
          <div className="comparison-results-container">
            <div className="comparison-results-group">
              {renderDemographicsSummary(filteredDataGroup1, group1Name)}
              {renderQuestionsList(filteredDataGroup1, group1Name)}
            </div>
            
            <div className="comparison-results-group">
              {renderDemographicsSummary(filteredDataGroup2, group2Name)}
              {renderQuestionsList(filteredDataGroup2, group2Name)}
            </div>
          </div>
        ) : filteredDataGroup1 ? (
          // Single group results layout
          <div className="single-results-container">
            {renderDemographicsSummary(filteredDataGroup1, 'Filtered Results')}
            {renderQuestionsList(filteredDataGroup1, 'Filtered Results')}
          </div>
        ) : null}
      </div>
      
      {/* Question comparison view */}
      {selectedQuestionId && renderComparisonView()}
    </div>
  );
}