// src/components/AnalyticsComponents/ReportDemographicsDisplay.js
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import './AnalyticsComponents.css'; // Assuming shared styles

// Register Chart.js components and datalabels plugin
ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, ChartDataLabels
);

// --- Constants ---
const DEFAULT_CHART_COLOR = '#36A2EB';
const DEFAULT_PALETTE = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    "#E7E9ED", "#8A8A8A", "#F7464A", "#46BFBD", "#FDB45C", "#949FB1"
];

// --- Helper: Generate Colors ---
const generateDefaultColors = (count, baseColor, customColors = []) => {
    const definedCustom = (customColors || []).filter(c => c && typeof c === 'string');
    if (definedCustom.length >= count) return definedCustom.slice(0, count);
    if (definedCustom.length > 0) return Array.from({ length: count }, (_, i) => definedCustom[i % definedCustom.length]);
    if (count === 1) return [baseColor || DEFAULT_CHART_COLOR];
    return Array.from({ length: count }, (_, i) => DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
};

// --- Helper: Prepare Chart Data for Demographics ---
const prepareChartDataForDemographics = (categoryData = {}, categorySettings = {}) => {
    // Use all relevant settings from categorySettings prop
    const showPercentages = categorySettings.showPercentages !== undefined ? categorySettings.showPercentages : true;
    const baseChartColor = categorySettings.chartColor || DEFAULT_CHART_COLOR;
    const customColors = categorySettings.customColors || [];
    // Assuming showNA might be added later, default to true for now.
    // If demographics *never* have a showNA toggle, this check can be simplified.
    const showNA = categorySettings.showNA !== undefined ? categorySettings.showNA : true;

    // Filter entries based on showNA setting FIRST
    let filteredEntries = Object.entries(categoryData).filter(([key]) => {
        // Keep the entry if showNA is true OR if the key is not "Unknown" (case-insensitive check)
        return showNA || key.toLowerCase() !== 'unknown';
    });

    // Sort entries by count descending (after potential filtering)
    const sortedEntries = filteredEntries.sort(([, a], [, b]) => (b?.count ?? 0) - (a?.count ?? 0));

    // Example Limiting (Optional, keep commented or implement if needed)
    // const categoryKey = categorySettings.key;
    // const limit = (categoryKey === 'locations' || categoryKey === 'companies') ? 7 : sortedEntries.length;
    // let limitedEntries = sortedEntries.slice(0, limit);
    // let otherCount = sortedEntries.slice(limit).reduce((sum, [, data]) => sum + (data?.count ?? 0), 0);
    // if (otherCount > 0) limitedEntries.push(['Other', { count: otherCount }]);
    let limitedEntries = sortedEntries; // Use sorted entries directly for now

    if (limitedEntries.length === 0) return null; // Return null if no data after filtering/sorting

    const labels = limitedEntries.map(([key]) => key);
    const counts = limitedEntries.map(([, data]) => data?.count ?? 0);

    // Calculate total count based on the *currently displayed* data
    const totalCountForPercent = counts.reduce((sum, c) => sum + c, 0);
    const percentages = counts.map(c => totalCountForPercent > 0 ? (c / totalCountForPercent * 100) : 0);

    const dataValues = showPercentages ? percentages : counts;
    const backgroundColors = generateDefaultColors(labels.length, baseChartColor, customColors);
    // Ensure border color is opaque version of background color
    const borderColors = backgroundColors.map(c => typeof c === 'string' ? c.replace(/rgba\(([^)]+), [\d.]+\)/, 'rgb($1)') // Remove alpha
                                                                         .replace(/hsla\(([^)]+), [\d.]+\)/, 'hsl($1)') // Remove alpha
                                                                         : c);


    return {
        labels,
        datasets: [{
            label: showPercentages ? 'Percentage (%)' : 'Count',
            data: dataValues,
            // Apply transparency to background colors for better look
            backgroundColor: backgroundColors.map(c => typeof c === 'string' ? c.replace(/rgb\(/, 'rgba(').replace(/\)$/, ', 0.7)') // Add alpha if rgb
                                                                                .replace(/hsl\(/, 'hsla(').replace(/\)$/, ', 0.7)') // Add alpha if hsl
                                                                                : c),
            borderColor: borderColors,
            borderWidth: 1,
            // Store raw counts/percentages for datalabels/tooltips
            counts: counts,
            percentages: percentages
        }]
    };
};

// --- Helper: Get Chart Options for Demographics ---
const getChartOptionsForDemographics = (categoryKey, categorySettings = {}, labels = []) => {
    // Use all relevant settings from categorySettings prop
    const titleText = categorySettings.customTitle || categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const chartType = categorySettings.chartType || 'bar'; // Default to bar
    // Handle horizontalBar setting for backwards compatibility or specific preference
    const isHorizontal = chartType === 'horizontalBar' || (chartType === 'bar' && categorySettings.indexAxis === 'y');
    const finalChartType = chartType === 'horizontalBar' ? 'bar' : chartType; // Use 'bar' for Chart.js v3+

    const showLegend = categorySettings.showLegend !== undefined ? categorySettings.showLegend : true;
    const dataLabelFormat = categorySettings.dataLabelFormat || 'percent'; // Default to percent
    const isPieDoughnut = finalChartType === 'pie' || finalChartType === 'doughnut';

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isHorizontal ? 'y' : 'x', // Set axis based on isHorizontal
        plugins: {
            title: {
                display: !!titleText, // Show title only if text exists
                text: titleText,
                font: { size: 14, weight: 'bold' },
                padding: { top: 5, bottom: 10 }
            },
            legend: {
                // Show legend for pie/doughnut, or if multi-item non-pie and enabled
                display: showLegend && (isPieDoughnut || labels.length > 1),
                position: 'bottom',
                labels: { padding: 10, boxWidth: 10, font: { size: 10 } }
            },
            tooltip: { // Keep tooltip consistent
                callbacks: {
                    label: function (context) {
                        const count = context.dataset.counts?.[context.dataIndex] ?? context.raw;
                        const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;
                        let label = `${context.label || ''}: `;
                        if (percentage !== null) label += `${percentage.toFixed(1)}% `;
                        label += `(${Number(count).toLocaleString()} Count)`; // Ensure count is formatted
                        return label;
                    }
                }
            },
            datalabels: { // Use dataLabelFormat setting
                display: dataLabelFormat !== 'none',
                color: (context) => { // Dynamic color logic (Keep as is)
                    if (isPieDoughnut) return '#ffffff';
                    const bgColor = context.dataset.backgroundColor?.[context.dataIndex] || '#000000';
                    try {
                       let brightness = 128;
                       if (bgColor.startsWith('#')) { const r = parseInt(bgColor.slice(1, 3), 16), g = parseInt(bgColor.slice(3, 5), 16), b = parseInt(bgColor.slice(5, 7), 16); brightness = (r*0.299 + g*0.587 + b*0.114); }
                       else if (bgColor.startsWith('rgba') || bgColor.startsWith('rgb')) { const parts = bgColor.match(/[\d.]+/g); if (parts && parts.length >= 3) { brightness = (parseInt(parts[0])*0.299 + parseInt(parts[1])*0.587 + parseInt(parts[2])*0.114); } }
                       return brightness > 160 ? '#333333' : '#ffffff'; // Dark text on light bg
                    } catch { return '#444444'; }
                },
                font: { size: 9, weight: '500' },
                anchor: isPieDoughnut ? 'center' : 'end',
                align: isPieDoughnut ? 'center' : 'end',
                offset: isPieDoughnut ? 0 : 4,
                formatter: (value, context) => {
                    // Use stored raw counts/percentages
                    const count = context.dataset.counts?.[context.dataIndex] ?? null;
                    const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;
                    if (isPieDoughnut && percentage !== null && percentage < 3) return ''; // Hide small pie labels

                    // Format based on dataLabelFormat setting
                    if (dataLabelFormat === 'both' && percentage !== null && count !== null) return `${percentage.toFixed(1)}%\n(${Number(count).toLocaleString()})`;
                    if (dataLabelFormat === 'count' && count !== null) return Number(count).toLocaleString();
                    if (dataLabelFormat === 'percent' && percentage !== null) return `${percentage.toFixed(1)}%`;
                    // Default (format is 'none' or data unavailable)
                    return '';
                }
            }
        },
        // Configure scales only for bar/line charts
        scales: (finalChartType === 'bar' || finalChartType === 'line') ? {
             x: {
                 beginAtZero: true,
                 display: !isHorizontal, // Display axis based on orientation
                 ticks: { font: { size: 9 } },
                 grid: { color: '#f0f0f0', drawBorder: false } // Subtle grid lines
             },
             y: {
                 beginAtZero: true,
                 display: isHorizontal, // Display axis based on orientation
                 ticks: { font: { size: 9 } },
                 grid: { color: '#f0f0f0', drawBorder: false }
             }
         } : {}, // No scales for pie/doughnut
    };
    return options;
};

// --- Main Component ---
const ReportDemographicsDisplay = ({ demographicsData = null, demographicsSettings = {} }) => {

    const categoryKeys = useMemo(() => {
        // Render based on keys present in the *data* that also have *settings*
        if (!demographicsData) return [];
        return Object.keys(demographicsSettings).filter(key => demographicsData[key] && Object.keys(demographicsData[key]).length > 0);
    }, [demographicsData, demographicsSettings]);

    if (!demographicsData || categoryKeys.length === 0) {
        return <p className="no-data-small">No demographic data available for the current selection.</p>;
    }

    return (
        <div className="demographics-summary-container">
            {categoryKeys.map(key => {
                const categoryData = demographicsData[key];
                const categorySettings = { ...(demographicsSettings[key] || {}), key: key }; // Pass key for potential use in helpers
                const chartData = prepareChartDataForDemographics(categoryData, categorySettings);
                const chartOptions = getChartOptionsForDemographics(key, categorySettings, chartData?.labels);
                const chartType = categorySettings.chartType || 'bar';
                const ChartComponent = { bar: Bar, pie: Pie }[chartType] || Bar; // Default to Bar

                if (!chartData) {
                    return (
                        <div key={key} className="demographics-chart-box">
                            <h3 className="demographics-chart-title">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                            <p className="no-data-small">No data for this category.</p>
                        </div>
                    );
                }

                // Determine container class for layout adjustment
                const containerClass = (chartType === 'pie' || chartType === 'doughnut')
                    ? "demographics-chart-wrapper pie-container"
                    : "demographics-chart-wrapper";

                return (
                    <div key={key} className="demographics-chart-box">
                        {/* Title is now part of chartOptions */}
                        <div className={containerClass}>
                            <ChartComponent data={chartData} options={chartOptions} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

ReportDemographicsDisplay.propTypes = {
    demographicsData: PropTypes.object, // Can be null initially
    demographicsSettings: PropTypes.object,
};

export default ReportDemographicsDisplay;