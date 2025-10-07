// ComparisonChart.js - Enhanced version with better layout and specific type handling
import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
);

/**
 * ComparisonChart - A component to compare two sets of question analytics side by side
 * Enhanced version with better layout and styling, handles different data structures.
 */
const ComparisonChart = ({
  group1Data,
  group2Data,
  group1Name = 'Group 1',
  group2Name = 'Group 2',
  chartType = 'bar' // Default chart type, but might be overridden
}) => {
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState({});
  const [hasData, setHasData] = useState(false);
  const [comparisonType, setComparisonType] = useState(''); // 'choice', 'multi', 'numeric', 'nps', 'slider', 'star', 'unknown'

  // Setup chart data based on the analytics data
  useEffect(() => {
    console.log("[ComparisonChart DEBUG] Received props:", { group1Data, group2Data, group1Name, group2Name });
    if (!group1Data || !group2Data || !group1Data.analytics || !group2Data.analytics) {
      console.log("[ComparisonChart DEBUG] Missing group data or analytics object.");
      setHasData(false); // Ensure no chart renders if data is incomplete
      return;
    };

    // Use analytics type from group1 (assuming they match for comparison)
    const analyticsType = group1Data.analytics.type;
    const questionType = group1Data.question_type; // Also get question type
    console.log(`[ComparisonChart DEBUG] Analytics Type: ${analyticsType}, Question Type: ${questionType}`);
    
    let compType = 'unknown'; // Default

    // --- Determine Comparison Type based on analytics.type ---
    if (analyticsType === 'single_select_distribution') {
        compType = 'choice'; // Includes dropdown, single-choice, scale, single-image-select
    } else if (analyticsType === 'multi_select_distribution') {
        compType = 'multi'; // Includes checkbox, multi-choice, multiple-image-select
    } else if (analyticsType === 'numeric_stats' && questionType === 'nps') {
        compType = 'nps';
    } else if (analyticsType === 'slider_stats') { // Use the new specific slider type
        compType = 'slider';
    } else if (analyticsType === 'star-rating') { // Use the specific star-rating type
        compType = 'star';
    } else if (analyticsType === 'numeric_stats') { // General numeric stats (for numerical-input, potentially legacy rating-scale)
        compType = 'numeric';
    } else if (analyticsType === 'ranking_stats') {
         compType = 'ranking'; // Add ranking type
    } else if (analyticsType === 'grid_data') {
        // Determine specific grid type from question_type for more specific handling
        const gridType = group1Data.analytics?.grid_data?.question_type || 'unknown_grid';
        console.log(`[ComparisonChart DEBUG] Grid Type identified as: ${gridType}`);
        compType = gridType; // Use 'star-rating-grid', 'radio-grid', etc.
    }

    // Add more mappings if other analytics.type values exist

    console.log(`[ComparisonChart DEBUG] Determined Comparison Type: ${compType}`);
    setComparisonType(compType);

    // --- Configure Chart Options ---
    const options = {
      responsive: true,
      maintainAspectRatio: true, // Keep aspect ratio for better comparison consistency
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 13 }, padding: 20 } },
        title: { display: true, text: group1Data.question_text || 'Question Comparison', font: { size: 16, weight: 'bold' }, padding: { top: 10, bottom: 30 } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed.y ?? context.raw ?? 0; // Use parsed.y if available, else raw
              const formattedValue = typeof value === 'number' ? value.toFixed(1) : value; // Format if number
              // Adjust label based on type
              let unit = '%'; // Default unit
              if (compType === 'numeric' || compType === 'star' || compType === 'slider') unit = ''; // No % for raw values/averages
              if (compType === 'nps' && context.label === 'NPS Score') unit = ''; // No % for NPS score itself
              if (compType === 'ranking_stats') unit = ' (Avg Rank)'; // Specific unit for ranking
              if (compType === 'star-rating-grid') unit = ' (Avg Rating)'; // Specific unit for star grid

              return `${context.dataset.label}: ${formattedValue}${unit}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            // Adjust Y-axis title based on type. Note: NPS will have mixed values, so a generic title is better.
            text: (compType === 'numeric' || compType === 'star' || compType === 'slider' || compType === 'grid' || (compType === 'nps' && chartData?.labels.includes('NPS Score'))) ? 'Value' : 'Percentage (%)',
            font: { size: 12 }
          },
          grid: { drawBorder: false }
        },
        x: {
          title: { display: true, text: 'Options / Categories', font: { size: 12 } },
          grid: { display: false }
        }
      },
      layout: { padding: { top: 20, bottom: 20, left: 20, right: 20 } }
    };
    setChartOptions(options); // Set options early

    // --- Process Data based on Determined Type ---
    if (compType === 'choice' || compType === 'multi') { // Combined processing for choice/multi based on distribution key
      processDistributionData(group1Data, group2Data, compType);
    } else if (compType === 'nps') {
      processNpsData(group1Data, group2Data); // Keep specific NPS processing
    } else if (compType === 'slider' || compType === 'star' || compType === 'numeric') {
       // Use a common function for types primarily showing key stats
      processKeyStatsData(group1Data, group2Data, compType);
    } else if (compType === 'ranking') {
         processRankingData(group1Data, group2Data, compType);
    } else if (compType === 'star-rating-grid') {
         processGridData(group1Data, group2Data, compType);
    } else if (compType === 'radio-grid' || compType === 'checkbox-grid') {
        processGridDistributionData(group1Data, group2Data, compType);
    }
    else {
      console.warn("[ComparisonChart DEBUG] Unsupported comparison type or missing analytics data:", compType);
      setHasData(false); // No data to display
    }

  }, [group1Data, group2Data, group1Name, group2Name]); // Dependencies


  // --- Data Processing Functions ---

  // Combined function for choice-based distributions
  const processDistributionData = (data1, data2, compType) => {
    console.log(`[ComparisonChart DEBUG] Processing ${compType} distribution data`);
    const distributionKey = compType === 'choice' ? 'options_distribution' : 'option_distribution';
    const percentageKey = compType === 'choice' ? 'percentage' : 'percentage_of_responses'; // Use % of responses for multi

    const options1 = data1.analytics?.[distributionKey] || [];
    const options2 = data2.analytics?.[distributionKey] || [];

    if (options1.length === 0 && options2.length === 0) {
       console.warn("[ComparisonChart DEBUG] Both groups have empty distributions.");
       setHasData(false);
       return;
    }

    // Get all unique option labels
    const allOptionLabels = [...new Set([
      ...options1.map(item => item.option),
      ...options2.map(item => item.option)
    ])];
    console.log("[ComparisonChart DEBUG] All labels:", allOptionLabels);


    // Create maps for easy lookup
    const optionMap1 = options1.reduce((map, item) => { map[item.option] = item; return map; }, {});
    const optionMap2 = options2.reduce((map, item) => { map[item.option] = item; return map; }, {});

    // Get percentage values for each option
    const group1Values = allOptionLabels.map(option => optionMap1[option]?.[percentageKey] ?? 0);
    const group2Values = allOptionLabels.map(option => optionMap2[option]?.[percentageKey] ?? 0);
    console.log("[ComparisonChart DEBUG] Group 1 values:", group1Values);
    console.log("[ComparisonChart DEBUG] Group 2 values:", group2Values);


    const formattedData = {
      labels: allOptionLabels,
      datasets: [
        { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
        { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
      ]
    };

    setChartData(formattedData);
    setHasData(true);
  };

   // Process Key Stats (Mean, Median, Min, Max) for numeric, slider, star
   const processKeyStatsData = (data1, data2, compType) => {
     console.log(`[ComparisonChart DEBUG] Processing key stats for ${compType}`);
     const analytics1 = data1.analytics;
     const analytics2 = data2.analytics;

     if (!analytics1 || !analytics2) {
       console.error("[ComparisonChart DEBUG] Missing analytics data for key stats processing.");
       setHasData(false);
       return;
     }

     const labels = ['Average', 'Median', 'Min', 'Max']; // Consistent labels
     // Use 'mean' for average consistently
     const group1Values = [analytics1.mean ?? 0, analytics1.median ?? 0, analytics1.min ?? 0, analytics1.max ?? 0];
     const group2Values = [analytics2.mean ?? 0, analytics2.median ?? 0, analytics2.min ?? 0, analytics2.max ?? 0];

     console.log("[ComparisonChart DEBUG] Group 1 Key Stats:", group1Values);
     console.log("[ComparisonChart DEBUG] Group 2 Key Stats:", group2Values);

     // Adjust Y-axis title
      setChartOptions(prev => ({
        ...prev,
        scales: {
          ...prev.scales,
          y: { ...prev.scales.y, title: { ...prev.scales.y.title, text: 'Value' } }
        }
      }));


     const formattedData = {
       labels,
       datasets: [
         { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
         { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
       ]
     };

     setChartData(formattedData);
     setHasData(true);
   };

  // Process NPS data (Compare segments as percentages and NPS score)
  const processNpsData = (data1, data2) => {
    console.log("[ComparisonChart DEBUG] Processing NPS data");
    const analytics1 = data1.analytics;
    const analytics2 = data2.analytics;

    if (!analytics1?.nps_segments || !analytics2?.nps_segments) {
      console.error("[ComparisonChart DEBUG] Missing NPS segment data.");
      setHasData(false);
      return;
    }

    const labels = ['Promoters (%)', 'Passives (%)', 'Detractors (%)', 'NPS Score'];
    const total1 = data1.total_responses || 1; // Avoid division by zero
    const total2 = data2.total_responses || 1;

    const group1Values = [
      (analytics1.nps_segments.promoters / total1) * 100,
      (analytics1.nps_segments.passives / total1) * 100,
      (analytics1.nps_segments.detractors / total1) * 100,
      analytics1.nps_score ?? 0 // Use NPS score directly
    ];
    const group2Values = [
      (analytics2.nps_segments.promoters / total2) * 100,
      (analytics2.nps_segments.passives / total2) * 100,
      (analytics2.nps_segments.detractors / total2) * 100,
      analytics2.nps_score ?? 0 // Use NPS score directly
    ];
     console.log("[ComparisonChart DEBUG] Group 1 NPS Values:", group1Values);
     console.log("[ComparisonChart DEBUG] Group 2 NPS Values:", group2Values);


    // Adjust Y-axis label - Percentage for segments, Value for Score (handled by tooltip)
    setChartOptions(prev => ({
      ...prev,
      scales: {
        ...prev.scales,
        y: { ...prev.scales.y, title: { ...prev.scales.y.title, text: 'Value / Percentage' } }
      }
    }));

    const formattedData = {
      labels,
      datasets: [
        { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
        { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
      ]
    };

    setChartData(formattedData);
    setHasData(true);
  };

   // Process Ranking Data (Compare Average Ranks)
   const processRankingData = (data1, data2, compType) => {
     console.log("[ComparisonChart DEBUG] Processing ranking data");
     const analytics1 = data1.analytics;
     const analytics2 = data2.analytics;

     // The key here is average_ranks, not ranking_stats directly
     if (!analytics1?.average_ranks || !analytics2?.average_ranks) {
       console.error("[ComparisonChart DEBUG] Missing 'average_ranks' data in analytics object.");
        console.log("Analytics 1:", analytics1);
        console.log("Analytics 2:", analytics2);
       setHasData(false);
       return;
     }

    // If you want to compare distribution, you'd use rank_distribution_matrix
    // For now, comparing average rank is simpler and more direct.

     const ranks1 = analytics1.average_ranks;
     const ranks2 = analytics2.average_ranks;

     const allItems = [...new Set([...ranks1.map(r => r.item), ...ranks2.map(r => r.item)])];
     const itemMap1 = ranks1.reduce((map, item) => { map[item.item] = item; return map; }, {});
     const itemMap2 = ranks2.reduce((map, item) => { map[item.item] = item; return map; }, {});

     const group1Values = allItems.map(item => itemMap1[item]?.average_rank ?? null); // Use null for missing ranks
     const group2Values = allItems.map(item => itemMap2[item]?.average_rank ?? null);

     console.log("[ComparisonChart DEBUG] Group 1 Avg Ranks:", group1Values);
     console.log("[ComparisonChart DEBUG] Group 2 Avg Ranks:", group2Values);

     // Adjust Y-axis title
      setChartOptions(prev => ({
        ...prev,
        scales: {
          ...prev.scales,
          y: { ...prev.scales.y, title: { ...prev.scales.y.title, text: 'Average Rank (Lower is Better)' } }
        }
      }));


     const formattedData = {
       labels: allItems,
       datasets: [
         { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
         { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
       ]
     };

     setChartData(formattedData);
     setHasData(true);
   };

   // Process Star Rating Grid Data (Compare Averages)
   const processGridData = (data1, data2, compType) => {
     console.log(`[ComparisonChart DEBUG] Processing grid data for ${compType}`);
     const analytics1 = data1.analytics?.grid_data;
     const analytics2 = data2.analytics?.grid_data;

     if (!analytics1?.rows || !analytics2?.rows || !analytics1?.row_averages || !analytics2?.row_averages) {
       console.error("[ComparisonChart DEBUG] Missing rows or row_averages for grid comparison.");
       console.log("Analytics 1 grid_data:", analytics1);
       console.log("Analytics 2 grid_data:", analytics2);
       setHasData(false);
       return;
     }

     // Create a comparison of the average rating for each row
     const allRows = [...new Set([...analytics1.rows, ...analytics2.rows])];

     const group1Values = allRows.map(rowLabel => {
         const rowIndex = analytics1.rows.indexOf(rowLabel);
         return rowIndex !== -1 ? (analytics1.row_averages?.[rowIndex] ?? null) : null;
     });

     const group2Values = allRows.map(rowLabel => {
         const rowIndex = analytics2.rows.indexOf(rowLabel);
         return rowIndex !== -1 ? (analytics2.row_averages?.[rowIndex] ?? null) : null;
     });


     console.log("[ComparisonChart DEBUG] Group 1 Row Avgs:", group1Values);
     console.log("[ComparisonChart DEBUG] Group 2 Row Avgs:", group2Values);

     // Adjust Y-axis title
      setChartOptions(prev => ({
        ...prev,
        scales: {
          ...prev.scales,
          y: { ...prev.scales.y, title: { ...prev.scales.y.title, text: 'Average Rating per Row' } }
        }
      }));

     const formattedData = {
       labels: allRows,
       datasets: [
         { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
         { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }
       ]
     };

     setChartData(formattedData);
     setHasData(true);
   };

  // Process Radio/Checkbox Grid Data (Compare Percentages)
  const processGridDistributionData = (data1, data2, compType) => {
    console.log(`[ComparisonChart DEBUG] Processing grid distribution for ${compType}`);
    const analytics1 = data1.analytics?.grid_data;
    const analytics2 = data2.analytics?.grid_data;

    if (!analytics1?.rows || !analytics2?.rows || !analytics1?.columns || !analytics2?.columns || !analytics1?.values || !analytics2?.values) {
      console.error("[ComparisonChart DEBUG] Missing data for grid distribution comparison.");
      return;
    }

    // For simplicity, let's compare the total percentage of selections for each *column*
    const allCols = [...new Set([...analytics1.columns, ...analytics2.columns])];
    const totalResponses1 = analytics1.total_responses || 1;
    const totalResponses2 = analytics2.total_responses || 1;

    const group1Values = allCols.map(colLabel => {
        const colIndex = analytics1.columns.indexOf(colLabel);
        return colIndex !== -1 ? (analytics1.column_totals[colIndex] / totalResponses1 * 100) : 0;
    });
    const group2Values = allCols.map(colLabel => {
        const colIndex = analytics2.columns.indexOf(colLabel);
        return colIndex !== -1 ? (analytics2.column_totals[colIndex] / totalResponses2 * 100) : 0;
    });

    const formattedData = {
       labels: allCols,
       datasets: [
         { label: group1Name, data: group1Values, backgroundColor: 'rgba(54, 162, 235, 0.7)'},
         { label: group2Name, data: group2Values, backgroundColor: 'rgba(255, 99, 132, 0.7)'}
       ]
     };

     setChartData(formattedData);
     setHasData(true);
  };


  // --- Rendering Functions ---

  // Render top choices comparison table
  const renderTopChoicesTable = () => {
    // ... (logic remains the same) ...
    if (comparisonType !== 'choice' && comparisonType !== 'multi') return null;
    if (!group1Data?.analytics || !group2Data?.analytics) return null;

    let options1, options2;
    const distributionKey = comparisonType === 'choice' ? 'options_distribution' : 'option_distribution';
    const percentageKey = comparisonType === 'choice' ? 'percentage' : 'percentage_of_responses';

    options1 = group1Data.analytics[distributionKey] || [];
    options2 = group2Data.analytics[distributionKey] || [];

    const topOptions1 = [...options1].sort((a, b) => b.count - a.count).slice(0, 3);
    const topOptions2 = [...options2].sort((a, b) => b.count - a.count).slice(0, 3);

    return (
      <div className="top-choices-comparison">
        <h3 className="comparison-section-title">Top Choices Comparison</h3>
        <div className="top-choices-grid">
          <div className="top-choices-group">
            <h4 className="group-title">{group1Name}</h4>
            <table className="top-choices-table">
              <thead><tr><th>Option</th><th>Count</th><th>Percentage</th></tr></thead>
              <tbody>
                {topOptions1.map((option, index) => (
                  <tr key={index} className={index === 0 ? 'top-choice' : ''}>
                    <td>{option.option}</td>
                    <td>{option.count}</td>
                    <td>{`${option[percentageKey]?.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="top-choices-group">
            <h4 className="group-title">{group2Name}</h4>
            <table className="top-choices-table">
             <thead><tr><th>Option</th><th>Count</th><th>Percentage</th></tr></thead>
              <tbody>
                {topOptions2.map((option, index) => (
                  <tr key={index} className={index === 0 ? 'top-choice' : ''}>
                    <td>{option.option}</td>
                    <td>{option.count}</td>
                    <td>{`${option[percentageKey]?.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render statistical comparison table
  const renderStatisticsTable = () => {
     // Show this table for numeric, slider, star, nps (but not ranking)
    if (!['numeric', 'slider', 'star', 'nps'].includes(comparisonType)) return null;
    if (!group1Data?.analytics || !group2Data?.analytics) return null;

    const analytics1 = group1Data.analytics;
    const analytics2 = group2Data.analytics;

    // Function to calculate difference safely
    const calculateDiff = (val1, val2) => {
        const num1 = (val1 === null || val1 === undefined) ? NaN : Number(val1);
        const num2 = (val2 === null || val2 === undefined) ? NaN : Number(val2);
        if (isNaN(num1) || isNaN(num2)) return null; // Cannot calculate diff if either is NaN
        return num1 - num2;
    };
    // Function to format value or return N/A
    const formatValue = (val, precision = 2) => (val === null || val === undefined || isNaN(val)) ? 'N/A' : Number(val).toFixed(precision);
    // Function to format difference
    const formatDiff = (diff, precision = 2) => (diff === null || isNaN(diff)) ? '-' : diff.toFixed(precision);
    // Function to get diff class
    const getDiffClass = (diff) => (diff === null || isNaN(diff)) ? '' : (diff > 0 ? 'positive' : diff < 0 ? 'negative' : '');

    const meanDiff = calculateDiff(analytics1.mean, analytics2.mean);
    const medianDiff = calculateDiff(analytics1.median, analytics2.median);
    const minDiff = calculateDiff(analytics1.min, analytics2.min);
    const maxDiff = calculateDiff(analytics1.max, analytics2.max);
    const npsDiff = calculateDiff(analytics1.nps_score, analytics2.nps_score);

    return (
      <div className="statistics-comparison">
        <h3 className="comparison-section-title">Statistical Comparison</h3>
        <table className="statistics-table">
          <thead>
            <tr><th>Metric</th><th>{group1Name}</th><th>{group2Name}</th><th>Difference</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Average</td>
              <td>{formatValue(analytics1.mean)}</td>
              <td>{formatValue(analytics2.mean)}</td>
              <td className={getDiffClass(meanDiff)}>{formatDiff(meanDiff)}</td>
            </tr>
            <tr>
              <td>Median</td>
              <td>{formatValue(analytics1.median)}</td>
              <td>{formatValue(analytics2.median)}</td>
               <td className={getDiffClass(medianDiff)}>{formatDiff(medianDiff)}</td>
            </tr>
             {/* Conditionally show Min/Max if present */}
            {analytics1.min !== undefined && analytics2.min !== undefined && (
                <tr>
                    <td>Minimum</td>
                    <td>{formatValue(analytics1.min)}</td>
                    <td>{formatValue(analytics2.min)}</td>
                    <td className={getDiffClass(minDiff)}>{formatDiff(minDiff)}</td>
                </tr>
            )}
             {analytics1.max !== undefined && analytics2.max !== undefined && (
                <tr>
                    <td>Maximum</td>
                    <td>{formatValue(analytics1.max)}</td>
                    <td>{formatValue(analytics2.max)}</td>
                    <td className={getDiffClass(maxDiff)}>{formatDiff(maxDiff)}</td>
                </tr>
            )}
            {/* Conditionally show NPS Score */}
            {comparisonType === 'nps' && (
              <tr className="nps-score-row">
                <td>NPS Score</td>
                 <td>{formatValue(analytics1.nps_score, 1)}</td>
                 <td>{formatValue(analytics2.nps_score, 1)}</td>
                 <td className={getDiffClass(npsDiff)}>{formatDiff(npsDiff, 1)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render response counts
  const renderResponseCounts = () => {
    // ... (logic remains the same) ...
     if (!group1Data || !group2Data) return null;
     return (
       <div className="response-counts">
         <div className="group-count">
           <span className="group-name">{group1Name}:</span>
           <span className="count">{group1Data.total_responses}</span> responses
         </div>
         <div className="group-count">
           <span className="group-name">{group2Name}:</span>
           <span className="count">{group2Data.total_responses}</span> responses
         </div>
       </div>
     );
  };


  // Main component render
  if (!hasData || !chartData) {
    console.log("[ComparisonChart DEBUG] No data to render or chartData is null. HasData:", hasData);
    return (
      <div className="comparison-chart-container">
        <div className="comparison-no-data">
          {comparisonType === 'unknown'
             ? "Comparison not available for this question type."
             : "No comparable data available for these groups or question."
          }
          {/* Optionally show response counts even if chart fails */}
          {group1Data && group2Data && renderResponseCounts()}
        </div>
      </div>
    );
  }

  console.log("[ComparisonChart DEBUG] Rendering chart with data:", chartData);
  return (
    <div className="comparison-chart-container">
      {renderResponseCounts()}
      <div className="comparison-chart-wrapper">
        {/* Key change: Ensure chartData is passed */}
        <Bar data={chartData} options={chartOptions} />
      </div>
      {/* Render tables based on type */}
      {comparisonType === 'choice' || comparisonType === 'multi' ?
        renderTopChoicesTable() :
        renderStatisticsTable()
      }
      {/* Add specific ranking table if needed */}
      {/* {comparisonType === 'ranking' && renderRankingTable()} */}
    </div>
  );
};

export default ComparisonChart;
