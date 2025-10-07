// --- START OF FILE QuestionAnalyticsChart.js ---

import React, { useEffect, useState } from "react";
import { Bar, Pie, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  PointElement,
  LineElement,
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import GridAnalytics, { StarRatingVisual } from "./GridAnalytics";
import WordCloudViewer from "./WordCloudViewer";
import "./GridAnalytics.css"; // Main styling for tables, loading etc.
import "./AnalyticsComponents.css"; // Additional component styles
import { analyticsAPI, chartAPI } from "../../services/apiClient";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Register ChartDataLabels plugin separately
ChartJS.register(ChartDataLabels);

// --- Main Component ---

const QuestionAnalyticsChart = ({
  surveyId,
  questionId,
  filterPayload = null,
  onClose,
  analyticsDataExternal = null, // Data passed directly from a parent
  settings = {}, // Centralized settings object from parent
  hideCustomization = false, // Prop to hide the customization button
}) => {
  // --- State ---
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Chart customization state
  const [chartType, setChartType] = useState("bar");
  const [chartColor, setChartColor] = useState("#36A2EB"); // Default single color
  const [showPercentages, setShowPercentages] = useState(true); // Now primarily controlled by settings prop
  const [showLegend, setShowLegend] = useState(true); // Now primarily controlled by settings prop
  const [customTitle, setCustomTitle] = useState(""); // Now primarily controlled by settings prop
  const [customColors, setCustomColors] = useState([]); // Now primarily controlled by settings prop
  const [showCustomization, setShowCustomization] = useState(false);

  const token = localStorage.getItem("token");

  // This effect is now simplified. The component primarily relies on the `settings` prop for rendering decisions.
  // Local state is used for the customization panel itself, but the rendered output uses the prop.
  useEffect(() => {
    if (settings) {
      console.log("QuestionAnalyticsChart: Received settings:", settings);
      // Update local state for the customization panel if needed, but the main rendering logic will use the `settings` prop directly.
      setChartType(settings.chartType || 'bar');
      setCustomTitle(settings.customTitle || '');
      // etc.
    }
  }, [settings]);

  // --- Helper Functions (Now defined inside the component) ---

  /**
   * Calculates the weighted average for single-choice options.
   * Options are valued starting from 1 based on their order in the distribution array.
   * Excludes options identified as "Not Applicable" or similar variations.
   */
  const calculateSingleChoiceAverage = (
    optionsDistribution,
    naIdentifiers = ["Not Applicable", "N/A", "NA", "n/a", "not applicable"]
  ) => {
    if (!optionsDistribution || optionsDistribution.length === 0) {
      return null;
    }

    let weightedSum = 0;
    let totalCountForAvg = 0;

    // NOTE: Assumes optionsDistribution is in the order to be valued (1, 2, 3...).
    // Original question order might differ.
    optionsDistribution.forEach((item, index) => {
      const optionText = typeof item.option === "string" ? item.option.trim() : "";
      
      // Check if this option should be excluded from average calculation
      const isNA = naIdentifiers.some(naId => 
        optionText.toLowerCase() === naId.toLowerCase()
      );
      
      if (!isNA && optionText !== "") {
        const value = index + 1; // Assign value based on position (1-based)
        weightedSum += (item.count || 0) * value;
        totalCountForAvg += item.count || 0;
      }
    });

    if (totalCountForAvg === 0) {
      return null; // No valid responses for average calculation
    }

    return weightedSum / totalCountForAvg;
  };

  const renderRankingDistributionMatrix = (analytics) => {
    // Add debugging
    console.log("Rendering ranking matrix with data:", analytics);
    
    // Be more flexible about the data structure
    if (!analytics) {
        console.log("No analytics data available");
        return <div className="no-data statistics-panel">No ranking distribution data available.</div>;
    }

    // For testing/development - create mock data if real data isn't available
    // Remove this in production
   

    const items = analytics.items_in_question || [];
    const matrix = analytics.rank_distribution_matrix || {};
    const numItems = items.length;

    if (numItems === 0) {
        return <div className="no-data statistics-panel">No ranking items defined.</div>;
    }

    // Add debugging for matrix data
    console.log("Matrix data:", {
        items,
        matrix,
        numItems
    });

    return (
        <div className="ranking-table-container">
            <h4 className="ranking-table-title">Interactive Ranking Distribution</h4>
            <p className="info-text" style={{ marginBottom: '15px' }}>
                Number shows how many respondents ranked each item in each position
            </p>
            <div className="ranking-matrix-wrapper">
                <table className="ranking-distribution-table">
                    <thead>
                        <tr>
                            <th>Items</th>
                            {[...Array(numItems)].map((_, idx) => (
                                <th key={`rank-header-${idx + 1}`}>Rank {idx + 1}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((itemText, rowIndex) => (
                            <tr key={`row-${rowIndex}`}>
                                <td className="item-name">{itemText}</td>
                                {[...Array(numItems)].map((_, colIndex) => {
                                    const rankPosition = colIndex + 1;
                                    const count = matrix[itemText]?.[rankPosition] ?? 0;
                                    return (
                                        <td key={`cell-${rowIndex}-${colIndex}`} 
                                            className={`rank-count ${count > 0 ? 'has-value' : ''}`}>
                                            {count}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {typeof analytics.total_responses_considered === 'number' && (
                <p className="info-text" style={{ marginTop: '15px', textAlign: 'center' }}>
                    Based on {analytics.total_responses_considered} total responses
                </p>
            )}
        </div>
    );
  };

  const getAvailableChartTypes = () => {
    // Now has access to analyticsData from component state
    if (!analyticsData) return [{ value: "bar", label: "Bar Chart" }]; // Should ideally not happen if called after loading
    const { question_type } = analyticsData;
    
    switch (question_type) {
      case "single-choice":
      case "dropdown":
      case "single-image-select": 
      case "scale": // Scale uses the same chart types as single-choice
        return [
          { value: "bar", label: "Bar Chart" },
          { value: "horizontalBar", label: "Horizontal Bar" },
          { value: "pie", label: "Pie Chart" },
          { value: "doughnut", label: "Doughnut Chart" },
        ];
      case "multi-choice":
      case "checkbox": // Include alias
      case "multiple-image-select":
        return [
          { value: "bar", label: "Bar Chart" },
          { value: "horizontalBar", label: "Horizontal Bar" },
        ];

      case "rating": // Slider - Now supports charts (histogram-like bar charts)
        return [
          { value: "bar", label: "Bar Chart" },
          { value: "horizontalBar", label: "Horizontal Bar" },
          { value: "pie", label: "Pie Chart" },
          { value: "doughnut", label: "Doughnut Chart" },
          { value: "line", label: "Line Chart" },
        ];
      
      case "interactive-ranking": // Add chart support for ranking questions
        return [
          { value: "bar", label: "Bar Chart" },
          { value: "horizontalBar", label: "Horizontal Bar" },
        ];
      
      // Types that typically DON'T have charts by default
      case "star-rating": // Primary display is table
      case "nps": // Primary display is table
      case "open-ended": // Word cloud is separate
      case "radio-grid": // Handled by GridAnalytics
      case "checkbox-grid":
      case "star-rating-grid": 
        return []; // These have their own components, no standard charts
      case "numerical-input":
        return [
          { value: "bar", label: "Bar Chart" },
          { value: "horizontalBar", label: "Horizontal Bar" },
          { value: "line", label: "Line Chart" },
        ];
      default: 
        return []; // Default to no chart options for unknown types
    } 
  };

  // Generate default color palette (can stay inside or outside, doesn't depend on state)
  const generateDefaultColors = (count) => {
    const defaultPalette = [
      "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
      "#FF9F40", "#66FF66", "#FF66B3", "#3399FF", "#FF6666",
    ];
    if (count <= 0) return [];
    if (count <= defaultPalette.length) return defaultPalette.slice(0, count);

    const colors = [...defaultPalette];
    for (let i = defaultPalette.length; i < count; i++) {
      colors.push(
        `rgb(${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)})`
      );
    }
    return colors;
  };

  const prepareChartData = () => {
    // Now has access to analyticsData and showPercentages from component state
    if (!analyticsData || !analyticsData.analytics) return null;
    const { analytics, question_type } = analyticsData;

    // Use settings values if available, otherwise fall back to internal state
    const effectiveShowPercentages = settings.showPercentages !== false; // Default to true
    const sortOrder = settings.sortOrder; // 'desc', 'asc', or 'default'

    // Using generateDefaultColors defined within the component scope now
    const getBackgroundColors = (originalLabels, currentLabels) => {
        // Always prioritize settings custom colors, then fall back to defaults
        const effectiveCustomColors = settings?.customColors || [];
        
        // Create a mapping from original option labels to their colors
        const originalColors = generateDefaultColors(originalLabels.length);
        const labelToColorMap = {};
        
        originalLabels.forEach((label, index) => {
            // Use saved custom color if available, otherwise use default color for this position
            const savedColor = effectiveCustomColors[index];
            labelToColorMap[label] = savedColor || originalColors[index] || '#36A2EB';
        });
        
        // Map colors to the current (possibly sorted) label order
        return currentLabels.map(label => {
            const color = labelToColorMap[label];
            // Handle null/undefined colors
            if (!color || typeof color !== 'string') {
                return '#36A2EB'; // Return default color
            }
            
            if (color.startsWith('#')) {
                // Basic hex to rgba conversion (assumes hex is #RRGGBB)
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, 0.6)`; // Add alpha
            } else if (color.startsWith('rgb(')) {
                 // Add alpha if not present, replace if it is
                 return color.replace('rgb(', 'rgba(').replace(')', ', 0.6)');
            }
            return color; // Return as is if unknown format
        });
    };

    // SINGLE SELECT / SCALE / DROPDOWN / SINGLE IMAGE SELECT
    if (analytics.type === "single_select_distribution" && analytics.options_distribution) {
        // Store original order for color mapping
        const originalLabels = analytics.options_distribution.map(d => d.option || "Unknown");
        
        let distribution = [...analytics.options_distribution]; // Create a mutable copy
        
        if (sortOrder === 'desc') {
            distribution.sort((a, b) => (b.count || 0) - (a.count || 0));
        } else if (sortOrder === 'asc') {
            distribution.sort((a, b) => (a.count || 0) - (b.count || 0));
        }
        
        const labels = distribution.map(d => d.option || "Unknown");
        const counts = distribution.map(d => d.count || 0);
        const percentages = distribution.map(d => d.percentage || 0);
        const dataValues = effectiveShowPercentages ? percentages : counts;
        
        // Map colors to follow the sorted data using original order mapping
        const backgroundColors = getBackgroundColors(originalLabels, labels);
        
        return {
            labels,
            datasets: [{ 
                label: effectiveShowPercentages ? "Percentage (%)" : "Count", 
                data: dataValues, 
                percentage: percentages, 
                backgroundColor: backgroundColors, 
                borderColor: backgroundColors.map(c => c && typeof c === 'string' ? c.replace('0.6', '1') : '#36A2EB'), 
                borderWidth: 1,
                // Add percentage symbols when showing percentages
                dataLabels: effectiveShowPercentages ? percentages.map(p => `${p.toFixed(1)}%`) : counts
            }],
        };
    }

    // MULTI SELECT / CHECKBOX / MULTI IMAGE SELECT
    if ((analytics.type === "multi_select_distribution" || analytics.type === "image_select_distribution") && analytics.option_distribution) {
        // Store original order for color mapping
        const originalLabels = analytics.option_distribution.map(d => d.option || d.hidden_label || "Unknown");
        
        let distribution = [...analytics.option_distribution]; // Create a mutable copy
        
        if (sortOrder === 'desc') {
            distribution.sort((a, b) => (b.count || 0) - (a.count || 0));
        } else if (sortOrder === 'asc') {
            distribution.sort((a, b) => (a.count || 0) - (b.count || 0));
        }
        
        const labels = distribution.map(d => d.option || d.hidden_label || "Unknown");
        const counts = distribution.map(d => d.count || 0);
        const percentages = distribution.map(d => d.percentage_of_responses || 0);
        const dataValues = effectiveShowPercentages ? percentages : counts;
        
        // Map colors to follow the sorted data using original order mapping
        const backgroundColors = getBackgroundColors(originalLabels, labels);
        
        return {
            labels,
            datasets: [{ 
                label: effectiveShowPercentages ? "% of Responses" : "Count", 
                data: dataValues, 
                percentage: percentages, 
                backgroundColor: backgroundColors, 
                borderColor: backgroundColors.map(c => c && typeof c === 'string' ? c.replace('0.6', '1') : '#36A2EB'), 
                borderWidth: 1,
                // Add percentage symbols when showing percentages
                dataLabels: effectiveShowPercentages ? percentages.map(p => `${p.toFixed(1)}%`) : counts
            }],
        };
    }

    // NPS Breakdown Chart Data (though chart might not be shown by default)
    if (analytics.type === "numeric_stats" && analytics.nps_segments) {
        const { promoters = 0, passives = 0, detractors = 0 } = analytics.nps_segments;
        const total = promoters + passives + detractors; 
        const percentages = total > 0 ? [ (promoters / total) * 100, (passives / total) * 100, (detractors / total) * 100 ] : [0, 0, 0]; 
        const counts = [promoters, passives, detractors];
        const dataValues = effectiveShowPercentages ? percentages : counts;
        const backgroundColors = ["rgba(75, 192, 192, 0.6)", "rgba(255, 206, 86, 0.6)", "rgba(255, 99, 132, 0.6)"];
        return {
            labels: ["Promoters (9-10)", "Passives (7-8)", "Detractors (0-6)"],
            datasets: [{ label: "NPS Breakdown", data: dataValues, percentage: percentages, backgroundColor: backgroundColors, borderColor: ["#4BC0C0", "#FFCE56", "#FF6384"], borderWidth: 1 }], 
        };
    }

    // Numerical Input Distribution Chart Data
    if (analytics.type === "numeric_stats" && question_type === "numerical-input" && analytics.distribution) {
        // Store original order for color mapping
        const originalLabels = analytics.distribution.map(d => String(d.value));
        
        let distribution = [...analytics.distribution]; // Create a mutable copy
        
        // Apply sorting if specified
        if (sortOrder === 'desc') {
            distribution.sort((a, b) => (b.count || 0) - (a.count || 0));
        } else if (sortOrder === 'asc') {
            distribution.sort((a, b) => (a.count || 0) - (b.count || 0));
        }
        
        const labels = distribution.map(d => String(d.value));
        const counts = distribution.map(d => d.count || 0);
        const percentages = distribution.map(d => d.percentage || 0); 
        const dataValues = effectiveShowPercentages ? percentages : counts;
        
        // Map colors to follow the sorted data using original order mapping
        const backgroundColors = getBackgroundColors(originalLabels, labels);
        
        return {
            labels, 
            datasets: [{ 
                label: effectiveShowPercentages ? "Percentage (%)" : "Count", 
                data: dataValues, 
                percentage: percentages, 
                backgroundColor: backgroundColors, 
                borderColor: backgroundColors.map(c => c && typeof c === 'string' ? c.replace('0.6','1') : '#36A2EB'), 
                borderWidth: 1,
                // Add percentage symbols when showing percentages
                dataLabels: effectiveShowPercentages ? percentages.map(p => `${p.toFixed(1)}%`) : counts
            }],
        };
    }

    // SLIDER (RATING) DISTRIBUTION CHART DATA
    if (analytics.type === "slider_stats" && analytics.distribution) {
        // Filter out N/A values for chart display (but keep them for table)
        const chartDistribution = analytics.distribution.filter(item => {
            const value = item.value;
            return value !== null && value !== undefined && 
                   value !== 'NA' && value !== 'N/A' && value !== 'Not Applicable' &&
                   !isNaN(Number(value));
        });
        
        // Store original order for color mapping
        const originalLabels = chartDistribution.map(d => String(d.value));
        
        let distribution = [...chartDistribution]; // Create a mutable copy
        
        // Apply sorting if specified
        if (sortOrder === 'desc') {
            distribution.sort((a, b) => (b.count || 0) - (a.count || 0));
        } else if (sortOrder === 'asc') {
            distribution.sort((a, b) => (a.count || 0) - (b.count || 0));
        } else {
            // For sliders, default sort by numeric value to create histogram effect
            distribution.sort((a, b) => Number(a.value) - Number(b.value));
        }
        
        const labels = distribution.map(d => String(d.value));
        const counts = distribution.map(d => d.count || 0);
        const percentages = distribution.map(d => d.percentage || 0); 
        const dataValues = effectiveShowPercentages ? percentages : counts;
        
        // Map colors to follow the sorted data using original order mapping
        const backgroundColors = getBackgroundColors(originalLabels, labels);
        
        return {
            labels, 
            datasets: [{ 
                label: effectiveShowPercentages ? "Percentage (%)" : "Count", 
                data: dataValues, 
                percentage: percentages, 
                backgroundColor: backgroundColors, 
                borderColor: backgroundColors.map(c => c && typeof c === 'string' ? c.replace('0.6','1') : '#36A2EB'), 
                borderWidth: 1,
                // Add percentage symbols when showing percentages
                dataLabels: effectiveShowPercentages ? percentages.map(p => `${p.toFixed(1)}%`) : counts
            }],
        };
    }

    // INTERACTIVE RANKING CHART DATA
    if (analytics.type === "ranking_stats" && analytics.average_ranks) {
        // Store original order for color mapping
        const originalLabels = analytics.average_ranks.map(d => d.item || "Unknown");
        
        let distribution = [...analytics.average_ranks]; // Create a mutable copy
        
        // Default sort by average rank (ascending - best ranks first)
        if (sortOrder === 'desc') {
            distribution.sort((a, b) => (b.average_rank ?? 999) - (a.average_rank ?? 999));
        } else if (sortOrder === 'asc') {
            distribution.sort((a, b) => (a.average_rank ?? 999) - (b.average_rank ?? 999));
        } else {
            // Default sort by best average rank (lower is better)
            distribution.sort((a, b) => (a.average_rank ?? 999) - (b.average_rank ?? 999));
        }
        
        const labels = distribution.map(d => d.item || "Unknown");
        const averageRanks = distribution.map(d => d.average_rank || 0);
        const counts = distribution.map(d => d.count || 0);
        
        // Map colors to follow the sorted data using original order mapping
        const backgroundColors = getBackgroundColors(originalLabels, labels);
        
        return {
            labels,
            datasets: [{ 
                label: "Average Rank", 
                data: averageRanks, 
                counts: counts, // Store counts for tooltip
                backgroundColor: backgroundColors, 
                borderColor: backgroundColors.map(c => c && typeof c === 'string' ? c.replace('0.6', '1') : '#36A2EB'), 
                borderWidth: 1,
                // Show average rank values with decimal places
                dataLabels: averageRanks.map(rank => rank.toFixed(2))
            }],
        };
    }

    // Fallback if no specific logic matched for chart data preparation
    console.warn("[prepareChartData] No chart data prepared for analytics type:", analytics?.type, "question type:", question_type);
    return null;
  };

const renderNumericalStatsTable = (
  analytics,
  title = "Statistical Summary",
  totalResponses = null // Keep accepting this for flexibility if needed elsewhere
) => {
  // Extract relevant stats - handle potential absence gracefully
  const mean = analytics?.mean;
  const median = analytics?.median;
  const min = analytics?.min;
  const max = analytics?.max;
  const std_dev = analytics?.std_dev;

  const stats = [
    // Use settings to conditionally include stats - ensure proper boolean checks
    (settings?.showMean !== false) && { label: "Average", value: mean },
    (settings?.showMedian !== false) && { label: "Median", value: median },
    (settings?.showMin !== false) && { label: "Min", value: min },
    (settings?.showMax !== false) && { label: "Max", value: max },
    (settings?.showStdDev !== false) && { label: "Std Dev", value: std_dev },
  ];

  // Filter out false entries and stats with null/undefined values (allow 0 for min/max/median)
  const validStats = stats.filter(
    (stat) => stat && stat.value !== undefined && stat.value !== null
  );

  // Use total_responses_considered if available from analytics object
  const totalResponsesToDisplay = analytics?.total_responses_considered; // Prefer this value
  const showTotalResponses = typeof totalResponsesToDisplay === "number" && !isNaN(totalResponsesToDisplay);

  // Check if there are any stats to show after filtering
  const effectiveShowStatsTable = settings?.showStatsTable !== false; // Default to true

  if (!effectiveShowStatsTable || (validStats.length === 0 && !showTotalResponses)) {
    return <div className="no-data statistics-panel">No statistical summary available.</div>;
  }

  return (
    <div className="statistics-panel" style={{ marginTop: "20px" }}>
      <h4 className="section-title">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse demographics-table">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Metric</th>
              <th className="border p-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {validStats.map((stat, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="border p-2">{stat.label}</td>
                <td className="border p-2 text-right">
                  {typeof stat.value === "number" && !["Min", "Max"].includes(stat.label)
                    ? stat.value.toFixed(2)
                    : stat.value ?? "N/A"}
                </td>
              </tr>
            ))}
            {showTotalResponses && (
              <tr
                className={
                  validStats.length % 2 === 0 ? "bg-white" : "bg-gray-50"
                }
              >
                <td className="border p-2">Total Responses Considered</td>
                <td className="border p-2 text-right">{totalResponsesToDisplay}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


  // --- Effects ---

  // Load saved config from backend when not using external settings
  useEffect(() => {
    const loadBackendSettings = async () => {
      try {
        const response = await chartAPI.getChartSettings(surveyId);
        const allSettings = response.data?.settings;
        const questionSettings = allSettings?.questions?.[String(questionId)];
        
        if (questionSettings) {
          if (questionSettings.chartType) setChartType(questionSettings.chartType);
          if (questionSettings.chartColor) setChartColor(questionSettings.chartColor);
          if (typeof questionSettings.showPercentages === "boolean")
            setShowPercentages(questionSettings.showPercentages);
          if (typeof questionSettings.showLegend === "boolean")
            setShowLegend(questionSettings.showLegend);
          if (questionSettings.customTitle) setCustomTitle(questionSettings.customTitle);
          if (Array.isArray(questionSettings.customColors))
            setCustomColors(questionSettings.customColors);
        }
      } catch (err) {
        console.error("Error loading chart configuration from backend:", err);
        // Fallback to localStorage if backend fails
        const storageKey = `chartConfig_${surveyId}_${questionId}`;
        const savedConfig = localStorage.getItem(storageKey);
        if (savedConfig) {
          try {
            const config = JSON.parse(savedConfig);
            if (config.chartType) setChartType(config.chartType);
            if (config.chartColor) setChartColor(config.chartColor);
            if (typeof config.showPercentages === "boolean")
              setShowPercentages(config.showPercentages);
            if (typeof config.showLegend === "boolean")
              setShowLegend(config.showLegend);
            if (config.customTitle) setCustomTitle(config.customTitle);
            if (Array.isArray(config.customColors))
              setCustomColors(config.customColors);
          } catch (parseErr) {
            console.error("Error parsing saved chart configuration from localStorage:", parseErr);
          }
        }
      }
    };
    
    loadBackendSettings();
  }, [surveyId, questionId]);

  // Load analytics data
  useEffect(() => {
    if (analyticsDataExternal) {
      setAnalyticsData(analyticsDataExternal);
      setLoading(false);
      setError("");
      return;
    }

    let alive = true;
    setLoading(true);
    setError("");
    
    const fetchData = async () => {
        try {
            const useFilters = filterPayload && Object.keys(filterPayload).some(key => Array.isArray(filterPayload[key]) && filterPayload[key].length > 0);
            let response;
            if (useFilters) {
                response = await analyticsAPI.getFilteredQuestionAnalytics(surveyId, questionId, filterPayload);
            } else {
                response = await analyticsAPI.getQuestionAnalyticsUnified(surveyId, questionId);
            }
            if (alive) {
                setAnalyticsData(response.data);
            }
        } catch (e) {
            if (alive) {
                setError(e.message || "Failed to load analytics");
            }
        } finally {
            if (alive) {
                setLoading(false);
            }
        }
    };

    fetchData()
      .then((data) => {
        if (alive) {
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message || "Failed to load analytics");
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
    
  }, [
    surveyId,
    questionId,
    JSON.stringify(filterPayload),
    analyticsDataExternal,
  ]);

  // --- Rendering Helpers ---

  // Render filter info (if applied)
  const renderFilterInfo = () => {
    // Now uses analyticsData from state
    const appliedFilters = analyticsData?.filters_applied || filterPayload;
    if (!appliedFilters) return null;

    const filterSections = Object.entries(appliedFilters)
      .filter(([key, values]) => Array.isArray(values) && values.length > 0)
      .map(
        ([key, values]) =>
          `${
            key.charAt(0).toUpperCase() + key.slice(1).replace("_", " ")
          }: ${values.join(", ")}`
      );

    if (filterSections.length === 0) return null;

    return (
      <div className="applied-filters-info">
        <h4 className="applied-filters-title">Applied Demographic Filters:</h4>
        <p className="applied-filters-text">{filterSections.join(" | ")}</p>
      </div>
    );
  };


  // Update a specific custom color
  const updateCustomColor = (index, color) => {
    const newColors = [...customColors]; // Operate on current state
    if (index >= 0) {
      while (newColors.length <= index) {
        newColors.push("#ffffff");
      }
      newColors[index] = color;
      setCustomColors(newColors);
    }
  };

  // Save chart configuration to backend
  const saveChartConfiguration = async () => {
    try {
      // Get current backend settings first 
      const response = await chartAPI.getChartSettings(surveyId);
      const allSettings = response.data?.settings || { 
        global: {},
        questions: {},
        demographics: {}
      };

      // Update only this question's settings
      if (!allSettings.questions) allSettings.questions = {};
      allSettings.questions[String(questionId)] = {
        ...allSettings.questions[String(questionId)],
        chartType,
        chartColor,
        showPercentages,
        showLegend,
        customTitle,
        customColors,
      };

      // Save to backend
      await chartAPI.saveChartSettings(surveyId, allSettings);
      
      // Also save to localStorage as backup
      const config = {
        chartType,
        chartColor,
        showPercentages,
        showLegend,
        customTitle,
        customColors,
      };
      const storageKey = `chartConfig_${surveyId}_${questionId}`;
      localStorage.setItem(storageKey, JSON.stringify(config));
      
      alert('Chart settings saved successfully!');
      setShowCustomization(false); // Hide panel after saving
    } catch (error) {
      console.error('Error saving chart configuration:', error);
      // Fallback to localStorage only
      const config = {
        chartType,
        chartColor,
        showPercentages,
        showLegend,
        customTitle,
        customColors,
      };
      const storageKey = `chartConfig_${surveyId}_${questionId}`;
      localStorage.setItem(storageKey, JSON.stringify(config));
      alert('Settings saved locally only - server connection failed.');
      setShowCustomization(false);
    }
  };



  // Get Chart.js options object
  const getChartOptions = () => {
    // Uses state: customTitle, analyticsData, chartType, showLegend, showPercentages
    // Use settings values if available, otherwise fall back to internal state
    const effectiveChartType = settings?.chartType || chartType;
    const effectiveShowLegend = settings?.showLegend ?? showLegend;
    const effectiveShowPercentages = settings?.showPercentages ?? showPercentages;
    const effectiveCustomTitle = settings?.customTitle || customTitle;
    
    // Use custom title from settings, or fall back to question text
    const titleText = effectiveCustomTitle || (analyticsData ? analyticsData.question_text : "");
    const isHorizontal = effectiveChartType === "horizontalBar";

    let options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHorizontal ? "y" : "x",
      plugins: {
        legend: { display: effectiveShowLegend, position: "bottom" },
        title: {
          display: !!titleText,
          text: titleText,
          font: { size: 16, weight: "500" },
          padding: { bottom: 20 },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              const value = context.raw;
              const percentage = context.dataset.percentage?.[context.dataIndex];
              const counts = context.dataset.counts?.[context.dataIndex];

              if (typeof value !== "number") return `${context.label}: N/A`;

              // Special handling for ranking questions
              if (analyticsData?.question_type === "interactive-ranking") {
                const rankString = `Average Rank: ${value.toFixed(2)}`;
                const countString = counts ? ` (Based on ${counts} responses)` : "";
                return `${context.label || ""}: ${rankString}${countString}`;
              }

              // Default handling for other question types
              const countString = `Count: ${value}`;
              if (effectiveShowPercentages && percentage !== undefined) {
                  return `${context.label || ""}: ${percentage.toFixed(1)}% (${countString})`;
              } else {
                  return `${context.label || ""}: ${countString}`;
              }
            },
          },
        },
        // Add datalabels plugin for showing values on charts
        datalabels: {
          display: true,
          anchor: ['pie', 'doughnut'].includes(effectiveChartType) ? 'center' : 'center',
          align: ['pie', 'doughnut'].includes(effectiveChartType) ? 'center' : 'center',
          color: 'black',
          backgroundColor: ['pie', 'doughnut'].includes(effectiveChartType) ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
          borderColor: ['pie', 'doughnut'].includes(effectiveChartType) ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: ['pie', 'doughnut'].includes(effectiveChartType) ? 0 : 1,
          borderRadius: 4,
          padding: {
            top: 4,
            bottom: 4,
            left: 6,
            right: 6
          },
          font: {
            size: 11,
            weight: 'bold'
          },
          formatter: function(value, context) {
            // Special handling for ranking questions - never show percentage signs for average ranks
            if (analyticsData?.question_type === "interactive-ranking") {
              return value.toFixed(2); // Always show average rank as decimal number
            }
            
            if (effectiveShowPercentages) {
              const percentage = context.dataset.percentage?.[context.dataIndex];
              if (percentage !== undefined) {
                return `${percentage.toFixed(1)}%`;
              } else {
                return `${value.toFixed(1)}%`;
              }
            } else {
              return value.toString();
            }
          }
        },
        // Ensure annotation plugin has a default container to avoid runtime errors
        // remove annotation plugin usage for Chart.js v3 compatibility
      },
    };

    if (["bar", "horizontalBar", "line"].includes(effectiveChartType)) {
      // Special handling for ranking questions
      let yAxisTitle = effectiveShowPercentages ? "Percentage (%)" : "Count";
      if (analyticsData?.question_type === "interactive-ranking") {
        yAxisTitle = "Average Rank";
      }
      
      options.scales = {
        [isHorizontal ? "x" : "y"]: {
          beginAtZero: true,
          title: {
            display: true,
            text: yAxisTitle,
          },
          // Add bottom padding to make room for the slider legend inside chart area
          ticks: {
            padding: 8
          },
        },
        [isHorizontal ? "y" : "x"]: {
          title: { display: false },
          ticks: {
            padding: 10
          }
        },
      };

      // For slider (rating) charts, add a custom footer annotation inside the chart area
      // For rating charts, render legend below the chart container to avoid cutoff
    } else {
      options.scales = {};
    }

    return options;
  };

  // Render the correct Chart.js component
  const renderChart = () => {
    // Uses internal helpers prepareChartData, getChartOptions which now access state
    const chartData = prepareChartData();
    const chartOptions = getChartOptions(); 
    // The chart type is now controlled by the settings prop, not local state
    const effectiveChartType = settings?.chartType || chartType;

    if (!chartData)
      return (
        <div className="no-data chart-placeholder"> {/* Use consistent class */}
          No data available for chart.
        </div>
      );

    const chartContainerStyle = {
      height: "350px",
      width: "100%",
      position: "relative",
      margin: "0 auto",
    };

          // Configure chart with plugins
      const chartProps = {
        data: chartData,
        options: chartOptions
      };

      switch (effectiveChartType) {
        case "bar": 
        case "horizontalBar": 
          return <div style={chartContainerStyle}><Bar {...chartProps} /></div>;
        case "pie": 
          return <div style={chartContainerStyle}><Pie {...chartProps} /></div>;
        case "doughnut": 
          return <div style={chartContainerStyle}><Doughnut {...chartProps} /></div>;
        case "line": 
          return <div style={chartContainerStyle}><Line data={chartData} options={chartOptions} /></div>;
        case "none": 
          return <div className="no-data chart-placeholder">Chart view disabled.</div>;
        default: 
          console.warn(`Unsupported chart type "${effectiveChartType}", rendering Bar chart.`);
          return <div style={chartContainerStyle}><Bar {...chartProps} /></div>;
      }
  };

  // --- Main Render Logic for Different Question Types ---
  const renderSpecialComponents = () => {
    // Uses state: analyticsData
    if (!analyticsData) return null;
    if (analyticsData.hideAnalytics) return <div className="info-text">Analytics view is not applicable for this question type.</div>;

    const { question_type, analytics } = analyticsData;
    const availableChartTypes = getAvailableChartTypes(); // Calls internal helper

    // GRID QUESTIONS
    if (question_type && question_type.includes("grid")) {
      return <GridAnalytics data={analyticsData} surveyId={surveyId} questionId={questionId} filterPayload={filterPayload} />;
    }

    // OPEN-ENDED
    if (question_type === "open-ended") {
      const latestResponses = analytics?.latest_10 || [];
      const wordCloudData = analytics?.word_frequencies || [];
      return (
        <div className="word-cloud-analysis">
          {wordCloudData.length > 0 ? (
            <WordCloudViewer data={wordCloudData} />
          ) : (<div className="no-data">Not enough text data for word cloud.</div>)}
          <h4 className="section-title">Latest Responses</h4>
          {latestResponses.length > 0 ? (
            <ul className="latest-responses-list">
              {latestResponses.map((resp, index) => (<li key={index}>{resp.text}</li>))}
            </ul>
          ) : (<div className="no-data">No responses yet.</div>)}
        </div>
      );
    }

    // NUMERICAL INPUT / NPS / RATING (SLIDER) / STAR RATING
    // These rely primarily on tables rendered by renderStatistics
    const tableBasedTypes = [
        "numerical-input", "nps", "star-rating"
    ];
    if (tableBasedTypes.includes(question_type)) {
        // Only render the statistics section for these types
        return renderStatistics(); // This function now handles the specific tables needed
    }

    // For non-chartable types not handled above, show a message.
    if (availableChartTypes.length === 0) {
        return <div className="info-text">Analytics view is not applicable for this question type.</div>;
    }


    // DEFAULT: CHART-BASED QUESTIONS (Single/Multi Choice, Image Select, Scale, Dropdown, Rating/Slider, Interactive Ranking)
    const chartBasedTypes = [
        'single-choice', 'dropdown', 'single-image-select',
        'multi-choice', 'checkbox', 'multiple-image-select',
        'scale', 'rating', 'interactive-ranking'
    ];
    if (chartBasedTypes.includes(question_type)) {
      const currentChartData = prepareChartData(); // Prepare data once
      const chartLabels = currentChartData?.labels || [];
      const effectiveChartType = settings?.chartType || chartType;

      return (
        <div className="question-chart">
          {/* Customization Area */}
          {availableChartTypes.length > 0 && !hideCustomization && (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={() => setShowCustomization(!showCustomization)} className="chart-button secondary">
                  {showCustomization ? "Hide Customization" : "Customize View"}
                </button>
              </div>
              {showCustomization && (
                 <div className="chart-controls">
                   <h4 className="section-title">Chart Customization</h4>
                   {/* Chart Type */}
                   <div className="control-group">
                     <label htmlFor="chartTypeSelect" className="control-label">Chart Type:</label>
                     <select id="chartTypeSelect" value={chartType} onChange={(e) => setChartType(e.target.value)} className="form-select">
                       {availableChartTypes.map(option => (
                         <option key={option.value} value={option.value}>{option.label}</option>
                       ))}
                     </select>
                   </div>
                   {/* Custom Title */}
                   <div className="control-group">
                       <label htmlFor="customTitleInput" className="control-label">Custom Title:</label>
                       <input
                          id="customTitleInput"
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="Enter custom chart title (optional)"
                          className="form-input"
                       />
                   </div>
                    {/* Color Pickers (only if data exists) */}
                    {chartLabels.length > 0 && (
                        <div className="control-group color-pickers">
                            <label className="control-label">Customize Colors:</label>
                            {chartLabels.map((label, index) => (
                                         <div key={index} className="color-picker-item">
                                             <span style={{ display: 'inline-block', marginRight: '8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={label}>{label}</span>
                                             <input
                                                 type="color"
                                                 value={customColors[index] || generateDefaultColors(chartLabels.length)[index] || '#ffffff'}
                                                 onChange={(e) => updateCustomColor(index, e.target.value)}
                                                 style={{ marginLeft: '5px', verticalAlign: 'middle' }}
                                             />
                                         </div>
                                     ))}
                                </div>
                            )}
                           {/* Toggles */}
                           <div className="control-group toggles">
                               {question_type !== 'nps' && (
                                   <label className="control-label"><input type="checkbox" checked={showPercentages} onChange={(e) => setShowPercentages(e.target.checked)} /> Show Percentages</label>
                               )}
                               {question_type !== 'nps' && (
                                   <label className="control-label"><input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} /> Show Legend</label>
                               )}
                           </div>
                           {/* Save Button */}
                           <button onClick={saveChartConfiguration} className="batch-btn primary">
                            <i className="ri-settings-3-line"></i>
                            Save Configuration
                          </button>

                         </div>
                      )}
                    </>
                  )}

                  {/* Chart Display Area */}
                  {availableChartTypes.length > 0 && effectiveChartType !== 'none' ? (
                    <>
                      <div className="chart-container"> {renderChart()} </div>
      {analyticsData?.question_type === 'rating' && (
        <div className="slider-legend-note" style={{ marginTop: '2px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
          1 = Poor, 10 = Excellent
        </div>
      )}
                    </>
                  ) : availableChartTypes.length > 0 && effectiveChartType === 'none' ? (
                    <div className="no-data chart-placeholder">Chart view disabled.</div>
                  ) : (
                    <div className="no-data chart-placeholder">
                      No chart view available. See table below.
                    </div>
                  )}

          {/* Statistics Table/Info */}
          {renderStatistics()} {/* Renders the appropriate table */}
        </div>
      );
    }

    // Fallback for unhandled types
    console.warn(`[RenderSpecialComp] No specific rendering logic found for question type: ${question_type}`);
    return <div className="no-data statistics-panel">Analytics view not configured for type: {question_type}.</div>;
  };

  // --- Render Statistics Section ---
  const renderStatistics = () => {
    // Uses state: analyticsData, question_type
    if (!analyticsData || !analyticsData.analytics) return null;
    const { analytics, question_type } = analyticsData;
    
    // Use settings prop values, with proper fallbacks
    const effectiveShowResponseDist = settings?.showResponseDist !== false; // Default to true unless explicitly false
    const sortOrder = settings?.sortOrder;

    // --- SINGLE CHOICE / DROPDOWN / SCALE ---
    if (analytics.type === "single_select_distribution" && effectiveShowResponseDist) {
      const calculatedAverage = question_type === 'scale' ? calculateSingleChoiceAverage(analytics.options_distribution) : null;
      const showAverageDisclaimer = calculatedAverage !== null;
      const showMeanSetting = settings?.showMean !== false; // Default to true unless explicitly false

      let sortedDistribution = [...(analytics.options_distribution || [])];
      if (sortOrder === 'desc') {
          sortedDistribution.sort((a, b) => (b.count || 0) - (a.count || 0));
      } else if (sortOrder === 'asc') {
          sortedDistribution.sort((a, b) => (a.count || 0) - (b.count || 0));
      }

      return (
        <div className="statistics-panel">
          <h4 className="section-title">Response Distribution</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse demographics-table">
              <thead><tr><th className="border p-2 text-left">Option</th><th className="border p-2 text-right">Count</th><th className="border p-2 text-right">Percentage</th></tr></thead>
              <tbody>
                {sortedDistribution.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2">{item.option || "N/A"}</td><td className="border p-2 text-right">{item.count ?? 0}</td><td className="border p-2 text-right">{item.percentage?.toFixed(1) ?? 0}%</td>
                  </tr>
                ))}
                 <tr className="bg-gray-100 font-semibold">
                    <td className="border p-2 text-left">Total</td>
                    <td className="border p-2 text-right">{analytics.total_responses_considered ?? sortedDistribution.reduce((sum, item) => sum + (item.count || 0), 0)}</td>
                    <td className="border p-2 text-right">100.0%</td>
                 </tr>
              </tbody>
            </table>
          </div>
          {calculatedAverage !== null && showMeanSetting && (
            <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px solid #eee", textAlign: "center" }}>
              <h4 className="section-title" style={{ marginBottom: "10px" }}>Calculated Average Score</h4>
              <div className="stat-item" style={{ display: "inline-block", background: "transparent", padding: "0", boxShadow: "none" }}>
                <span className="stat-value" style={{ fontSize: "1.8em" }}>
                  {calculatedAverage.toFixed(2)}
                </span>
              </div>
              <p className="info-text" style={{ fontSize: "12px", color: "#666", marginTop: "10px", textAlign: "center" }}>
                * Average calculation assigns sequential numeric values to options (1, 2, 3...). NA/Not Applicable options are excluded.
              </p>
            </div>
          )}
        </div>
      );
    }

    // --- MULTI CHOICE / CHECKBOX / MULTI IMAGE SELECT ---
    if ((analytics.type === "multi_select_distribution" || analytics.type === "image_select_distribution") && effectiveShowResponseDist) {
       // Add sorting support for multiple choice like single choice
       let sortedDistribution = [...(analytics.option_distribution || [])];
       if (sortOrder === 'desc') {
           sortedDistribution.sort((a, b) => (b.count || 0) - (a.count || 0));
       } else if (sortOrder === 'asc') {
           sortedDistribution.sort((a, b) => (a.count || 0) - (b.count || 0));
       }

       return (
         <div className="statistics-panel">
           <h4 className="section-title">Option Selection Distribution</h4>
           <div className="overflow-x-auto">
             <table className="min-w-full border-collapse demographics-table">
               <thead><tr><th className="border p-2 text-left">Option</th><th className="border p-2 text-right">Times Selected (Count)</th><th className="border p-2 text-right">% of Responses</th></tr></thead>
               <tbody>
                 {sortedDistribution.map((item, index) => (
                   <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                     {/* Use hidden_label as fallback for images */}
                     <td className="border p-2">{item.option || item.hidden_label || "N/A"}</td>
                     <td className="border p-2 text-right">{item.count ?? 0}</td>
                     <td className="border p-2 text-right">{item.percentage_of_responses?.toFixed(1) ?? 0}%</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {/* Add info about total responses considered */}
             {typeof analytics.total_responses_considered === 'number' && (
                   <p style={{ fontSize: '12px', color: '#666', marginTop: '15px', textAlign: 'center' }}>
                       Based on {analytics.total_responses_considered} total responses. Percentages indicate the proportion of responses where this option was selected at least once.
                   </p>
              )}
           </div>
           {/* Optionally render co-occurrences if needed */}
         </div>
       );
    }

    // --- RATING (SLIDER) ---
    if (analytics.type === "slider_stats") {
       const effectiveShowStatsTable = settings?.showStatsTable !== false; // Check if stats table should be shown
       
       return (
         <div className="rating-statistics-combined statistics-panel">
           {/* Distribution Table */}
           {effectiveShowResponseDist && (
             <div>
               <h4 className="section-title">Slider Value Distribution</h4>
               <div className="overflow-x-auto">
                 <table className="min-w-full border-collapse demographics-table">
                   <thead><tr className="bg-gray-100"><th className="border p-2 text-center">Value</th><th className="border p-2 text-right">Count</th><th className="border p-2 text-right">Percentage</th></tr></thead>
                   <tbody>
                     {(analytics.distribution || []).map((item, index) => (
                       <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                         <td className="border p-2 text-center">{item.value ?? "N/A"}</td><td className="border p-2 text-right">{item.count ?? 0}</td><td className="border p-2 text-right">{item.percentage?.toFixed(1) ?? 0}%</td>
                       </tr>
                     ))}
                      {/* Total Row */}
                      <tr className="bg-gray-100 font-semibold">
                         <td className="border p-2 text-left">Total</td>
                         <td className="border p-2 text-right">{analytics.total_responses_considered ?? (analytics.distribution || []).reduce((sum, item) => sum + (item.count || 0), 0)}</td>
                         <td className="border p-2 text-right">100.0%</td>
                      </tr>
                   </tbody>
                 </table>
               </div>
               {(analytics.left_label || analytics.right_label || analytics.center_label) && (
                 <p className="info-text" style={{ marginTop: '10px', textAlign: 'center' }}>
                   {analytics.left_label && `${analytics.distribution?.[0]?.value ?? ''} = ${analytics.left_label}`}
                   {analytics.center_label && ` | ${(analytics.distribution || []).find(d => d.value === ((analytics.rating_start + analytics.rating_end)/2)) ? ((analytics.rating_start + analytics.rating_end)/2) : ''} = ${analytics.center_label}`}
                   {analytics.left_label && analytics.right_label ? ' | ' : ''}
                   {analytics.right_label && `${analytics.distribution?.[analytics.distribution.length - 1]?.value ?? ''} = ${analytics.right_label}`}
                 </p>
               )}
             </div>
           )}
           {/* Stats Table - using internal helper */}
           {effectiveShowStatsTable && renderNumericalStatsTable(analytics, "Slider Statistical Summary")}
         </div>
       );
    }

    // --- NUMERIC STATS (Covers Numerical Input, NPS) ---
    if (analytics.type === "numeric_stats") {
        // NPS Specific Breakdown
        if (question_type === "nps" && analytics.nps_segments) {
            const roundedNpsScore = analytics.nps_score != null ? Math.round(analytics.nps_score) : "N/A";
            const totalNpsResponses = (analytics.nps_segments.promoters ?? 0) + (analytics.nps_segments.passives ?? 0) + (analytics.nps_segments.detractors ?? 0);
            const effectiveShowStatsTable = settings?.showStatsTable !== false; // Check if stats table should be shown
            
            return (
                <div className="nps-statistics statistics-panel">
                    <div className="nps-analysis">
                        <h4 className="nps-analysis-title section-title">NPS Analysis</h4>
                        <div className="nps-segments-grid">
                            <div className="nps-segment nps-promoters">
                              <div className="nps-segment-label">Promoters (9-10)</div>
                              <div className="nps-segment-value">{analytics.nps_segments.promoters ?? 0}</div>
                              <div className="nps-segment-percentage">({totalNpsResponses > 0 ? ((analytics.nps_segments.promoters ?? 0) / totalNpsResponses * 100).toFixed(1) : 0}%)</div>
                            </div>
                            <div className="nps-segment nps-passives">
                              <div className="nps-segment-label">Passives (7-8)</div>
                              <div className="nps-segment-value">{analytics.nps_segments.passives ?? 0}</div>
                               <div className="nps-segment-percentage">({totalNpsResponses > 0 ? ((analytics.nps_segments.passives ?? 0) / totalNpsResponses * 100).toFixed(1) : 0}%)</div>
                            </div>
                            <div className="nps-segment nps-detractors">
                              <div className="nps-segment-label">Detractors (0-6)</div>
                              <div className="nps-segment-value">{analytics.nps_segments.detractors ?? 0}</div>
                               <div className="nps-segment-percentage">({totalNpsResponses > 0 ? ((analytics.nps_segments.detractors ?? 0) / totalNpsResponses * 100).toFixed(1) : 0}%)</div>
                            </div>
                            <div className="nps-segment nps-score">
                              <div className="nps-segment-label">NPS Score</div>
                              <div className="nps-segment-value">{roundedNpsScore}</div>
                               <div className="nps-segment-percentage">Based on {totalNpsResponses} responses</div>
                            </div>
                        </div>
                         {/* Include the general stats table as well - only if enabled */}
                         {effectiveShowStatsTable && renderNumericalStatsTable(analytics, "NPS Statistical Summary")}
                    </div>
                </div>
            );
        }
        // Numerical Input (Distribution + Stats Table)
        else if (question_type === "numerical-input") {
             const effectiveShowStatsTable = settings?.showStatsTable !== false; // Check if stats table should be shown
             
             return (
                 <div className="numeric-input-statistics-combined statistics-panel">
                    {/* Distribution Table */}
                    {effectiveShowResponseDist && (
                        <div>
                            <h4 className="section-title">Response Value Distribution</h4>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse demographics-table">
                                    <thead><tr><th className="border p-2 text-center">Value Entered</th><th className="border p-2 text-right">Count</th><th className="border p-2 text-right">Percentage</th></tr></thead>
                                    <tbody>
                                        {(analytics.distribution || []).map((item, index) => (
                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="border p-2 text-center">{item.value ?? "N/A"}</td><td className="border p-2 text-right">{item.count ?? 0}</td><td className="border p-2 text-right">{item.percentage?.toFixed(1) ?? 0}%</td>
                                            </tr>
                                        ))}
                                        {/* Total Row */}
                                        <tr className="bg-gray-100 font-semibold">
                                           <td className="border p-2 text-left">Total</td>
                                           <td className="border p-2 text-right">{analytics.total_responses_considered ?? (analytics.distribution || []).reduce((sum, item) => sum + (item.count || 0), 0)}</td>
                                           <td className="border p-2 text-right">100.0%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Chart Customization & Display */}
                    {(() => {
                        const availableTypes = getAvailableChartTypes();
                        const currentChartData = prepareChartData();
                        const chartLabels = currentChartData?.labels || [];
                        return (
                          availableTypes.length > 0 && (
                            <>
                              <div className="flex justify-end mb-4">
                                <button
                                  onClick={() => setShowCustomization(!showCustomization)}
                                  className="chart-button secondary"
                                >
                                  {showCustomization ? "Hide Customization" : "Customize View"}
                                </button>
                              </div>
                              {showCustomization && (
                                <div className="chart-controls">
                                  <h4 className="section-title">Chart Customization</h4>
                                  <div className="control-group">
                                    <label htmlFor="chartTypeSelect" className="control-label">Chart Type:</label>
                                    <select
                                      id="chartTypeSelect"
                                      value={chartType}
                                      onChange={(e) => setChartType(e.target.value)}
                                      className="form-select"
                                    >
                                      {availableTypes.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="control-group">
                                    <label htmlFor="customTitleInput" className="control-label">Custom Title:</label>
                                    <input
                                      id="customTitleInput"
                                      type="text"
                                      value={customTitle}
                                      onChange={(e) => setCustomTitle(e.target.value)}
                                      placeholder="Enter custom chart title (optional)"
                                      className="form-input"
                                    />
                                  </div>
                                  {chartLabels.length > 0 && (
                                    <div className="control-group color-pickers">
                                      <label className="control-label">Customize Colors:</label>
                                      {chartLabels.map((label, index) => (
                                        <div key={index} className="color-picker-item">
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              marginRight: '8px',
                                              maxWidth: '150px',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              verticalAlign: 'middle',
                                            }}
                                          >
                                            {label}
                                          </span>
                                          <input
                                            type="color"
                                            value={
                                              customColors[index] ||
                                              generateDefaultColors(chartLabels.length)[index] ||
                                              '#ffffff'
                                            }
                                            onChange={(e) => updateCustomColor(index, e.target.value)}
                                            style={{ marginLeft: '5px', verticalAlign: 'middle' }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="control-group toggles">
                                    <label className="control-label">
                                      <input
                                        type="checkbox"
                                        checked={showPercentages}
                                        onChange={(e) => setShowPercentages(e.target.checked)}
                                      />{' '}
                                      Show Percentages
                                    </label>
                                    <label className="control-label">
                                      <input
                                        type="checkbox"
                                        checked={showLegend}
                                        onChange={(e) => setShowLegend(e.target.checked)}
                                      />{' '}
                                      Show Legend
                                    </label>
                                  </div>
                                  <button onClick={saveChartConfiguration} className="batch-btn primary">
                                    <i className="ri-settings-3-line"></i>
                                    Save Configuration
                                  </button>
                                </div>
                              )}
                              <div className="chart-container">{renderChart()}</div>
                            </>
                          )
                        );
                      })()}

                    {/* Stats Table - using internal helper */}
                    {effectiveShowStatsTable && renderNumericalStatsTable(analytics, "Numerical Input Summary")}
                 </div>
             );
        }
    }

    // --- STAR RATING (Standalone) ---
    else if (analytics.type === "star-rating") {
        // Calculate average excluding NA responses
        const validDistribution = (analytics.distribution || []).filter(item => {
            const value = item.value;
            return value !== null && value !== undefined && value !== 'NA' && value !== 'N/A' && !isNaN(Number(value));
        });
        
        const totalValidResponses = validDistribution.reduce((sum, item) => sum + (item.count || 0), 0);
        const weightedSum = validDistribution.reduce((sum, item) => {
            const numericValue = Number(item.value);
            return sum + (numericValue * (item.count || 0));
        }, 0);
        
        const calculatedAverage = totalValidResponses > 0 ? weightedSum / totalValidResponses : null;
        const showMeanSetting = settings?.showMean !== false; // Check if mean should be shown

        return (
          <div className="statistics-panel">
              {/* Star Rating Distribution Table */}
              {effectiveShowResponseDist && (
                <>
                  <h4 className="section-title">Star Rating Distribution</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse demographics-table">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-2 text-center">Rating</th>
                          <th className="border p-2 text-right">Count</th>
                          <th className="border p-2 text-right">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics.distribution || []).map((item, index) => (
                          <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border p-2 text-center">{item.value ?? "N/A"}</td>
                            <td className="border p-2 text-right">{item.count ?? 0}</td>
                            <td className="border p-2 text-right">{item.percentage?.toFixed(1) ?? 0}%</td>
                          </tr>
                        ))}
                         {/* Total Row */}
                         <tr className="bg-gray-100 font-semibold">
                            <td className="border p-2 text-left">Total</td>
                            <td className="border p-2 text-right">{analytics.total_responses_considered ?? (analytics.distribution || []).reduce((sum, item) => sum + (item.count || 0), 0)}</td>
                            <td className="border p-2 text-right">100.0%</td>
                         </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Star Rating Average Display - Only show if we have valid responses and mean is enabled */}
              {calculatedAverage !== null && totalValidResponses > 0 && showMeanSetting && (
                  <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'center' }}>
                      <h4 className="section-title" style={{ marginBottom: '10px' }}>Average Star Rating</h4>
                      <div className="stat-item" style={{ display: 'inline-block', background: 'transparent', padding: '0', boxShadow: 'none' }}>
                           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                <StarRatingVisual rating={calculatedAverage} />
                           </div>
                           <span className="stat-value" style={{ fontSize: '1.8em' }}>
                                {calculatedAverage.toFixed(2)}
                           </span>
                      </div>
                      <p className="info-text" style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                           Based on {totalValidResponses} valid responses (excluding NA/skipped responses).
                      </p>
                  </div>
              )}
               {typeof analytics.total_responses_considered === 'number' && (
                   <p style={{ fontSize: '12px', color: '#666', marginTop: '15px', textAlign: 'center' }}>
                       Total Responses Considered: {analytics.total_responses_considered}
                   </p>
               )}
          </div>
        );
    }

    // --- INTERACTIVE RANKING ---
    else if (analytics.type === "ranking_stats") {
        return (
          <div className="ranking-statistics-combined statistics-panel">
            {/* Average Rank Table */}
            {effectiveShowResponseDist && (
              <div>
                <h4 className="section-title">Average Rank per Item</h4>
                <p className="info-text" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                  Lower average rank indicates item was generally ranked higher (closer to 1). Calculated only from responses that ranked this specific item.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse demographics-table">
                    <thead><tr><th className="border p-2 text-left">Item</th><th className="border p-2 text-right">Average Rank</th><th className="border p-2 text-right">Responses (Ranked)</th></tr></thead>
                    <tbody>
                      {(analytics.average_ranks || []).sort((a, b) => (a.average_rank ?? 999) - (b.average_rank ?? 999)) // Sort by average rank
                      .map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border p-2">{item.item || "N/A"}</td><td className="border p-2 text-right">{item.average_rank?.toFixed(2) ?? "N/A"}</td><td className="border p-2 text-right">{item.count ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                 {typeof analytics.total_responses_considered === 'number' && (
                     <p style={{ fontSize: '12px', color: '#666', marginTop: '15px', textAlign: 'center' }}>
                         Total Responses Considered: {analytics.total_responses_considered}
                     </p>
                 )}
              </div>
            )}
            {/* Rank Distribution Matrix Table - using internal helper */}
            {renderRankingDistributionMatrix(analytics)}
          </div>
        );
    }


    // Fallback if no specific stats section is defined
    return null;
  };


  // --- Component Return ---

  if (loading)
    return (
      <div className="loading p-4 text-center">
        Loading question analytics...
      </div>
    );

  if (error)
    return (
      <div className="error p-4 bg-red-50 text-red-700 rounded">
        <p>Error loading analytics: {error}</p>
        <button onClick={onClose} className="mt-2 chart-button secondary">
          Close
        </button>
      </div>
    );

  if (!analyticsData)
    return (
      <div className="no-data p-4 bg-yellow-50 text-yellow-700 rounded">
        No analytics data available for this question.
        <button onClick={onClose} className="ml-4 chart-button secondary">
          Close
        </button>
      </div>
    );

  return (
    <div className="analytics-panel-container">
      <div className="flex justify-between items-start mb-4">
        {/* Header Info */}
        <div style={{ flexGrow: 1, marginRight: "20px" }}>
          <h3 className="analytics-panel-title">
            {settings?.customTitle || analyticsData.question_text || "Question"}
          </h3>

          <p className="text-sm" style={{ color: "#333" }}>
            Total Responses Received:{" "}
            <strong>{analyticsData.total_responses ?? 0}</strong>
          </p>
          {/* Filter Info */}
          {renderFilterInfo()}
        </div>

        {/* Close Button */}
        {onClose && (
          <button onClick={onClose} className="analytics-panel__close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293-4.293a1 1 0 011.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      {/* Main content based on question type */}
      {renderSpecialComponents()}
    </div>
  );
};

export default QuestionAnalyticsChart;
