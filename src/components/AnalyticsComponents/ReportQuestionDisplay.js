// src/components/AnalyticsComponents/ReportQuestionDisplay.js
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
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
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels'; // Import the plugin
import DivergingRankChart from './DivergingRankChart';
import './AnalyticsComponents.css'; // Ensure shared styles are imported
import { analyticsAPI } from 'services/apiClient';

// Register Chart.js components and the datalabels plugin
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, ChartDataLabels // Register DataLabels
);

// --- Constants ---
const DEFAULT_CHART_COLOR = '#36A2EB';
const DEFAULT_PALETTE = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    "#E7E9ED", "#8A8A8A", "#F7464A", "#46BFBD", "#FDB45C", "#949FB1"
];

// --- HELPER FUNCTIONS ---

const getDefaultChartType = (questionType) => {
    switch (questionType) {
        case 'multiple-choice': case 'dropdown': case 'single-image-select': return 'pie';
        case 'checkbox': case 'rating': case 'star-rating': case 'nps': case 'numerical-input': case 'multiple-image-select': case 'scale': return 'bar';
        default: return 'bar';
    }
};

const generateDefaultColors = (count, baseColor, customColors = []) => {
    const definedCustom = (customColors || []).filter(c => c && typeof c === 'string');
    if (definedCustom.length >= count) return definedCustom.slice(0, count);
    if (definedCustom.length > 0) return Array.from({ length: count }, (_, i) => definedCustom[i % definedCustom.length]);
    if (count === 1) return [baseColor || DEFAULT_CHART_COLOR];
    return Array.from({ length: count }, (_, i) => DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
};

// Calculates weighted average for single-choice/scale, excluding N/A
// Note: Scale average is now primarily calculated and displayed within renderStatisticsTables
const calculateSingleChoiceAverage = (optionsDistribution, naText = "not applicable") => {
    if (!optionsDistribution || optionsDistribution.length === 0) return null;
    let weightedSum = 0; let totalCountForAvg = 0;
    const lowerNaText = naText.toLowerCase();
    optionsDistribution.forEach((item, index) => {
      const optionLabel = String(item.option || '').toLowerCase();
      if (optionLabel !== lowerNaText) {
        const count = Number(item.count);
        if (!isNaN(count)) {
            weightedSum += count * (index + 1);
            totalCountForAvg += count;
        }
      }
    });
    return totalCountForAvg === 0 ? null : weightedSum / totalCountForAvg;
};

// --- Visual Star Rating Component ---
const StarRatingVisual = ({ rating, maxRating = 5 }) => {
  const ratingNum = Number(rating) || 0;
  const fullStars = Math.floor(ratingNum);
  const partialStar = ratingNum % 1;
  const showPartial = partialStar > 0.05;
  const emptyStars = Math.max(0, maxRating - fullStars - (showPartial ? 1 : 0));

  const renderStar = (type, key, partialPercentage = 0) => {
    let style = {}; let starChar = "★";
    switch (type) {
      case "full": style = { color: "#AA2EFF" }; break;
      case "partial":
        style = { display: "inline-block", background: `linear-gradient(90deg, #AA2EFF ${partialPercentage}%, #ccc ${partialPercentage}%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent", }; break;
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


// --- HELPER: Prepare Chart Data ---
const prepareChartData = (analyticsDataExternal, questionSettings, globalSettings, question) => {
    // Input Validation
    if (!analyticsDataExternal?.analytics || !question) {
        console.warn("[prepareChartData] Missing analytics data or question object.");
        return null;
    }

    const { analytics, question_type } = analyticsDataExternal;
    const settings = questionSettings || {};
    const global = globalSettings || {};

    // Extract settings with fallbacks
    const showPercentages = settings.showPercentages !== undefined ? settings.showPercentages : (global.showPercentages !== undefined ? global.showPercentages : true);
    const showNA = settings.showNA !== undefined ? settings.showNA : true; // Default SHOW N/A
    const baseChartColor = settings.chartColor || global.chartColor || DEFAULT_CHART_COLOR;
    const customColors = settings.customColors || [];
    const naTextRaw = question.not_applicable_text || "Not Applicable";
    const naText = naTextRaw.toLowerCase();

    let rawDistribution = [];
    let datasetLabel = showPercentages ? '%' : 'Count';
    let percentageBaseTotal = null; // null = calculate from valid counts, number = use this total (e.g., for multi-select)

    // Extract raw distribution based on analytics type
    if (analytics.type === 'single_select_distribution' && analytics.options_distribution) {
        rawDistribution = analytics.options_distribution.map(d => ({ ...d, option: String(d.option || '') })); // Ensure option is string
    } else if ((analytics.type === 'multi_select_distribution' || analytics.type === 'image_select_distribution') && analytics.option_distribution) {
        rawDistribution = analytics.option_distribution.map(d => ({ ...d, option: String(d.option || d.hidden_label || '') })); // Use hidden_label for images
        datasetLabel = showPercentages ? '% Responses' : 'Count';
        percentageBaseTotal = analytics.total_responses_considered ?? analytics.total_responses ?? null; // Use total responses for multi %
    } else if ((analytics.type === 'slider_stats' || analytics.type === 'star-rating') && analytics.distribution) {
        rawDistribution = analytics.distribution.map(d => ({ ...d, option: String(d.value || '') })); // Treat 'value' as 'option' for consistency
    } else if (analytics.type === 'numeric_stats' && question_type === 'nps' && analytics.nps_segments) {
        const { promoters = 0, passives = 0, detractors = 0 } = analytics.nps_segments;
        rawDistribution = [
            { option: "Promoters (9-10)", count: promoters },
            { option: "Passives (7-8)", count: passives },
            { option: "Detractors (0-6)", count: detractors },
        ];
        datasetLabel = showPercentages ? 'NPS Segments (%)' : 'NPS Segments (Count)';
    } else if (analytics.type === 'numeric_stats' && analytics.distribution) {
        datasetLabel = showPercentages ? '% Responses' : 'Count';
        const numericEntries = [];
        let naCountTemp = 0;
        analytics.distribution.forEach(d => {
            const val = parseFloat(d.value);
            if (!isNaN(val)) {
                numericEntries.push({ value: val, count: d.count ?? 0 });
            } else if (String(d.value || '').toLowerCase() === naText) {
                naCountTemp += d.count ?? 0;
            }
        });
        if (numericEntries.length === 0 && naCountTemp === 0) {
            return null;
        }
        const uniqueVals = [...new Set(numericEntries.map(e => e.value))].sort((a,b) => a-b);
        if (uniqueVals.length <= 10) {
            rawDistribution = uniqueVals.map(val => {
                const count = numericEntries.filter(e => e.value === val).reduce((sum, e) => sum + e.count, 0);
                return { option: String(val), count };
            });
        } else {
            const minVal = analytics.min !== undefined ? analytics.min : Math.min(...numericEntries.map(e => e.value));
            const maxVal = analytics.max !== undefined ? analytics.max : Math.max(...numericEntries.map(e => e.value));
            const numBins = 5;
            const binWidth = (maxVal - minVal) / numBins || 1;
            const binCounts = Array(numBins).fill(0);
            numericEntries.forEach(({ value, count }) => {
                let idx = Math.floor((value - minVal) / binWidth);
                if (idx >= numBins) idx = numBins - 1;
                binCounts[idx] += count;
            });
            rawDistribution = binCounts.map((c, i) => {
                const start = minVal + i * binWidth;
                const end = i === numBins - 1 ? maxVal : start + binWidth;
                return { option: `${start.toFixed(1)} - ${end.toFixed(1)}`, count: c };
            });
        }
        if (naCountTemp > 0) {
            rawDistribution.push({ option: naTextRaw, count: naCountTemp });
        }
    } else {
        // No chartable distribution found for this type (e.g., ranking, open-ended)
        // console.warn(`[prepareChartData] No standard distribution found for chart type: ${analytics.type}`);
        return null;
    }

    // Process N/A and filter if needed
    let naCount = 0;
    let processedDistribution = [];
    if (Array.isArray(rawDistribution)) { // Check if rawDistribution is actually an array
        rawDistribution.forEach(item => {
            const labelLower = String(item.option || '').toLowerCase();
            if (labelLower === naText) {
                naCount += (item.count ?? 0);
                if (showNA) { // Include N/A in processed list only if setting is true
                    processedDistribution.push({ ...item, count: item.count ?? 0 }); // Ensure count is number
                }
            } else {
                processedDistribution.push({ ...item, count: item.count ?? 0 }); // Ensure count is number
            }
        });
    } else {
        console.warn("[prepareChartData] rawDistribution is not an array:", rawDistribution);
        return null; // Cannot proceed if rawDistribution isn't an array
    }


    // Determine total counts for percentage calculations
    const countValidResponses = processedDistribution
        .filter(item => String(item.option || '').toLowerCase() !== naText)
        .reduce((sum, item) => sum + (item.count ?? 0), 0);
    // Use explicit total from analytics if available, otherwise calculate based on showNA
    const totalResponsesConsidered = analytics.total_responses_considered ?? (countValidResponses + (showNA ? naCount : 0));


    // Order the distribution
    const sortOrder = settings.sortOrder || (settings.sortByCount ? 'desc' : 'default');
    if (question_type === 'scale' && question?.scale_points && Array.isArray(question.scale_points)) {
         const scaleOrderMap = question.scale_points.reduce((map, point, index) => { map[point] = index; return map; }, {});
         processedDistribution.sort((a, b) => {
             const orderA = scaleOrderMap[a.option] ?? Infinity; const orderB = scaleOrderMap[b.option] ?? Infinity;
             if (String(a.option || '').toLowerCase() === naText) return 1; if (String(b.option || '').toLowerCase() === naText) return -1;
             return orderA - orderB;
         });
    } else {
         processedDistribution.sort((a, b) => {
              if (String(a.option || '').toLowerCase() === naText) return 1; if (String(b.option || '').toLowerCase() === naText) return -1;
              if (sortOrder === 'desc') return (b.count ?? 0) - (a.count ?? 0);
              if (sortOrder === 'asc') return (a.count ?? 0) - (b.count ?? 0);
              return 0;
         });
    }

    // Extract final labels, counts, and percentages
    const labels = processedDistribution.map(d => d.option || 'N/A');
    const counts = processedDistribution.map(d => d.count ?? 0);
    const percentages = processedDistribution.map(d => {
         const count = d.count ?? 0;
         // For multi-select/image-select, base % on total responses considered
         const base = (analytics.type === 'multi_select_distribution' || analytics.type === 'image_select_distribution' || String(d.option||'').toLowerCase() === naText)
                       ? totalResponsesConsidered
                       : countValidResponses;
         return base > 0 ? (count / base * 100) : 0;
    });


    if (labels.length === 0) {
        console.warn("[prepareChartData] No labels found after processing.");
        return null;
    }

    const dataValues = showPercentages ? percentages : counts;
    const backgroundColors = generateDefaultColors(labels.length, baseChartColor, customColors);
    const borderColors = backgroundColors.map(c => typeof c === 'string' ? c.replace(/, [\d.]+\)$/, ', 1)') : c); // Opaque border

    return {
        labels,
        datasets: [{
            label: datasetLabel,
            data: dataValues,
            backgroundColor: backgroundColors.map(c => typeof c === 'string' && c.startsWith('rgba') ? c : (typeof c === 'string' ? c.replace('rgb(', 'rgba(').replace(')', ', 0.7)') : c)), // Ensure alpha
            borderColor: borderColors,
            borderWidth: 1,
            counts: counts, // Store raw counts
            percentages: percentages, // Store calculated percentages
            countValidResponses: countValidResponses, // Store total used for valid % calc
            totalResponsesConsidered: totalResponsesConsidered // Store base for multi-select/N/A % calc
        }]
    };
};

// --- HELPER: Get Chart Options ---
const getChartOptions = (analyticsDataExternal, questionSettings, globalSettings, chartData) => {
    const settings = questionSettings || {};
    const global = globalSettings || {};
    const labels = chartData?.labels || [];

    if (!analyticsDataExternal) { return { responsive: true, maintainAspectRatio: false }; }

    const defaultTitle = question?.question_text || analyticsDataExternal.question_text || '';
    const titleText = settings.customTitle || defaultTitle;
    const defaultQTypeChart = getDefaultChartType(analyticsDataExternal.question_type);
    const currentChartType = settings.chartType || defaultQTypeChart || global.chartType || 'bar';
    const isHorizontal = currentChartType === 'bar' && settings.indexAxis === 'y';
    const showLegend = settings.showLegend !== undefined ? settings.showLegend : (global.showLegend !== undefined ? global.showLegend : true);
    const dataLabelFormat = settings.dataLabelFormat || global.dataLabelFormat || 'percent';
    const isPieDoughnut = currentChartType === 'pie' || currentChartType === 'doughnut';

    const options = {
        responsive: true, maintainAspectRatio: false, indexAxis: isHorizontal ? 'y' : 'x',
        plugins: {
            title: { display: !!titleText, text: titleText, font: { size: 16, weight: 'bold' }, padding: { top: 10, bottom: 15 } },
            legend: { display: showLegend && (isPieDoughnut || labels.length > 1), position: 'bottom', labels: { padding: 15, boxWidth: 12, font: { size: 11 } } },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const count = context.dataset.counts?.[context.dataIndex] ?? context.raw;
                        const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;
                        let label = `${context.label || ''}: `;
                        if (percentage !== null) { label += `${percentage.toFixed(1)}% `; }
                        label += `(${Number(count).toLocaleString()} Count)`;
                        return label;
                    }
                }
            },
            datalabels: {
                display: dataLabelFormat !== 'none',
                color: (context) => {
                    if (isPieDoughnut) return '#ffffff';
                    const bgColor = context.dataset.backgroundColor?.[context.dataIndex] || '#000000';
                    try {
                       let brightness = 128;
                       if (bgColor.startsWith('#')) { const r = parseInt(bgColor.slice(1, 3), 16), g = parseInt(bgColor.slice(3, 5), 16), b = parseInt(bgColor.slice(5, 7), 16); brightness = (r*0.299 + g*0.587 + b*0.114); }
                       else if (bgColor.startsWith('rgba') || bgColor.startsWith('rgb')) { const parts = bgColor.match(/[\d.]+/g); if (parts && parts.length >= 3) { brightness = (parseInt(parts[0])*0.299 + parseInt(parts[1])*0.587 + parseInt(parts[2])*0.114); } }
                       return brightness > 160 ? '#333333' : '#ffffff';
                    } catch { return '#444444'; }
                },
                font: { size: 10, weight: '500' },
                anchor: isPieDoughnut ? 'center' : 'end',
                align: isPieDoughnut ? 'center' : 'end',
                offset: isPieDoughnut ? 0 : 4,
                formatter: (value, context) => {
                    const count = context.dataset.counts?.[context.dataIndex] ?? null;
                    const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;
                    if (isPieDoughnut && percentage !== null && percentage < 3) return '';
                    if (dataLabelFormat === 'both' && percentage !== null && count !== null) return `${percentage.toFixed(1)}%\n(${Number(count).toLocaleString()})`;
                    if (dataLabelFormat === 'count' && count !== null) return Number(count).toLocaleString();
                    if (dataLabelFormat === 'percent' && percentage !== null) return `${percentage.toFixed(1)}%`;
                    return '';
                }
            }
        },
        scales: (currentChartType === 'bar' || currentChartType === 'line') ? {
             x: { beginAtZero: true, display: !isHorizontal, ticks: { font: { size: 10 } }, grid: { color: '#eeeeee', drawBorder: false } },
             y: { beginAtZero: true, display: isHorizontal, ticks: { font: { size: 10 } }, grid: { color: '#eeeeee', drawBorder: false } }
         } : {},
    }; return options;
};

// --- Render Statistics Tables (Includes Ranking Logic) ---
const renderStatisticsTables = (analyticsDataExternal, questionSettings, question) => {
    if (!analyticsDataExternal?.analytics || !question) {
        return null;
    }

    const { analytics, question_type } = analyticsDataExternal;
    const settings = questionSettings || {};
    const showDist = settings.showResponseDist !== undefined ? settings.showResponseDist : true;
    const showStats = settings.showStatsTable !== undefined ? settings.showStatsTable : true;
    const showNA = settings.showNA !== undefined ? settings.showNA : true;
    const showMean = settings.showMean !== undefined ? settings.showMean : true;
    const showMedian = settings.showMedian !== undefined ? settings.showMedian : true;
    const showMin = settings.showMin !== undefined ? settings.showMin : true;
    const showMax = settings.showMax !== undefined ? settings.showMax : true;
    const showStdDev = settings.showStdDev !== undefined ? settings.showStdDev : true;
    const naText = (question.not_applicable_text || "Not Applicable").toLowerCase();

    if (!showDist && !showStats && question_type !== 'interactive-ranking') { // Ensure ranking tables show even if others hidden
        return null;
    }

    // --- Data Preparation ---
    let distributionForTable = [];
    let naCountForTable = analytics.count_na ?? 0;
    let totalValidResponsesForTable = analytics.count_valid ?? 0;
    let totalResponsesConsideredForTable = analytics.total_responses_considered ?? 0;
    let statsForTable = [];
    let avgRating = null;
    let avgScaleScore = null;
    let npsSegments = null;
    let npsScore = null;
    let rankingAverageRanks = null;
    let rankingDistributionMatrix = null;
    let rankingItemsInQuestion = null;
    let rankingOverallScores = null;

    if (showDist) {
        if (analytics.options_distribution) { distributionForTable = analytics.options_distribution; }
        else if (analytics.option_distribution) { distributionForTable = analytics.option_distribution; }
        else if (analytics.distribution && !analytics.rank_distribution_matrix) { distributionForTable = analytics.distribution; }
        if (!showNA) { distributionForTable = distributionForTable.filter(item => String(item.option || item.value || '').toLowerCase() !== naText); }
    }

    if (showStats) {
        if (['numeric_stats', 'slider_stats', 'star-rating'].includes(analytics.type)) {
            if (analytics.count_valid !== undefined) statsForTable.push({ label: 'Valid Responses', value: analytics.count_valid });
            else if (analytics.total_responses_considered !== undefined) statsForTable.push({ label: 'Responses Considered', value: analytics.total_responses_considered });
            if (showMean && question_type === 'scale' && analytics.mean !== undefined) { avgScaleScore = analytics.mean; statsForTable.push({ label: 'Average Score*', value: avgScaleScore }); }
            else if (showMean && analytics.mean !== undefined) { statsForTable.push({ label: 'Average', value: analytics.mean }); }
            if (showMedian && analytics.median !== undefined) statsForTable.push({ label: 'Median', value: analytics.median });
            if (showMin && analytics.min !== undefined) statsForTable.push({ label: 'Min', value: analytics.min });
            if (showMax && analytics.max !== undefined) statsForTable.push({ label: 'Max', value: analytics.max });
            if (showStdDev && analytics.std_dev !== undefined) statsForTable.push({ label: 'Std Dev', value: analytics.std_dev });
        }
        if (question_type === 'star-rating' && analytics.mean !== undefined) { avgRating = analytics.mean; }
        if (question_type === 'nps' && analytics.nps_segments) { npsSegments = analytics.nps_segments; npsScore = analytics.nps_score; }
    }

    if (question_type === 'interactive-ranking' && analytics.type === 'ranking_stats') {
        rankingAverageRanks = analytics.average_ranks || [];
        rankingDistributionMatrix = analytics.rank_distribution_matrix || {};
        rankingItemsInQuestion = analytics.items_in_question || [];
        const numItems = rankingItemsInQuestion.length || rankingAverageRanks.length || 0;
        rankingOverallScores = rankingAverageRanks.map(r => ({
            ...r,
            overall_score: (r.average_rank != null && numItems > 0)
                ? (numItems + 1 - r.average_rank)
                : null,
        }));
    }

    // --- Render JSX ---
    const shouldRenderDist = showDist && distributionForTable.length > 0;
    const shouldRenderStats = showStats && statsForTable.length > 0;
    const shouldRenderStars = showStats && avgRating !== null;
    const shouldRenderNPS = showStats && npsSegments;
    const shouldRenderRanking = question_type === 'interactive-ranking' && (rankingAverageRanks || rankingDistributionMatrix);

    // If nothing to render based on settings and data, return null
    if (!shouldRenderDist && !shouldRenderStats && !shouldRenderStars && !shouldRenderNPS && !shouldRenderRanking) {
        return null;
    }

    const hasOtherRow = distributionForTable.some(it => String(it.option || it.value || '').toLowerCase() === '_other_');

    return (
        <div className="statistics-panel">
            {/* Response Distribution Table */}
            {shouldRenderDist && (
                <>
                    <h4 className="section-title">Response Distribution</h4>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse demographics-table">
                            <thead>
                                <tr>
                                    <th>Option/Value</th>
                                    <th>Count</th>
                                    <th>Percentage</th>
                                    {hasOtherRow && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {distributionForTable.map((item, index) => {
                                    const count = item.count ?? 0;
                                    const labelRaw = item.option || item.value?.toString() || 'N/A';
                                    const label = String(labelRaw).toLowerCase() === '_other_' ? (question.other_option_text || 'Other') : labelRaw;
                                    const isItemNA = String(labelRaw).toLowerCase() === naText;
                                    let percentage = 0;
                                    if (item.percentage !== undefined) { percentage = item.percentage; }
                                    else if (item.percentage_of_responses !== undefined) { percentage = item.percentage_of_responses; }
                                    else { const base = (analytics.type === 'multi_select_distribution' || analytics.type === 'image_select_distribution' || isItemNA) ? totalResponsesConsideredForTable : totalValidResponsesForTable; percentage = base > 0 ? (count / base * 100) : 0; }
                                    const isOtherRow = String(labelRaw).toLowerCase() === '_other_';
                                    return (
                                        <tr key={index}>
                                            <td>{label}</td>
                                            <td>{count.toLocaleString()}</td>
                                            <td>{percentage.toFixed(1)}%</td>
                                            {hasOtherRow && (
                                                <td>
                                                    {isOtherRow && (
                                                        <button className="show-all-btn" onClick={openOtherModal}>View Responses</button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                <tr className="font-semibold bg-gray-100"><td>Total Valid Responses</td><td>{totalValidResponsesForTable.toLocaleString()}</td><td>{totalValidResponsesForTable > 0 ? '100.0%' : 'N/A'}</td></tr>
                                {!showNA && naCountForTable > 0 && (<tr className="italic bg-gray-50 text-gray-600"><td>'{question.not_applicable_text || "Not Applicable"}' (Hidden)</td><td>{naCountForTable.toLocaleString()}</td><td>({(naCountForTable * 100 / totalResponsesConsideredForTable).toFixed(1)}% of total)</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {showDist && distributionForTable.length === 0 && (<p className="no-data-small">No distribution data to display{showNA ? '.' : ' (excluding hidden N/A responses).'}</p>)}

            {/* Statistical Summary Table */}
            {shouldRenderStats && (
                <>
                    <h4 className="section-title" style={{ marginTop: '20px' }}>Statistical Summary</h4>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse demographics-table">
                            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                            <tbody>
                                {statsForTable.map((stat, i) => (<tr key={i}><td>{stat.label}</td><td className="text-right">{typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(stat.value ?? 'N/A')}</td></tr>))}
                                {avgScaleScore !== null && (<tr className="bg-gray-50"><td colSpan="2" className="border p-2 text-center text-xs text-gray-600 italic">*Assumes sequential values (1, 2...) for scale options, excludes N/A.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Star Rating Visual */}
            {shouldRenderStars && (
                <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                    <h4 className="section-title" style={{ marginBottom: '10px' }}>Average Star Rating</h4>
                    <StarRatingVisual rating={avgRating} maxRating={question.rating_end || 5} />
                    <p className="stat-value" style={{ fontSize: '1.8em', marginTop: '5px', color: '#AA2EFF' }}>{avgRating.toFixed(2)} stars</p>
                    <p className="info-text" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Based on {totalValidResponsesForTable.toLocaleString()} valid responses.</p>
                </div>
             )}

            {/* NPS Breakdown Table */}
            {shouldRenderNPS && (
                <>
                    <h4 className="section-title" style={{ marginTop: '20px' }}>NPS Breakdown</h4>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse demographics-table nps-segments-grid">
                            <thead><tr><th>Segment</th><th>Count</th><th>Percentage</th></tr></thead>
                            <tbody>
                                <tr className="nps-promoters"><td>Promoters (9-10)</td><td>{npsSegments.promoters ?? 0}</td><td>{((npsSegments.promoters ?? 0) * 100 / totalValidResponsesForTable).toFixed(1)}%</td></tr>
                                <tr className="nps-passives"><td>Passives (7-8)</td><td>{npsSegments.passives ?? 0}</td><td>{((npsSegments.passives ?? 0) * 100 / totalValidResponsesForTable).toFixed(1)}%</td></tr>
                                <tr className="nps-detractors"><td>Detractors (0-6)</td><td>{npsSegments.detractors ?? 0}</td><td>{((npsSegments.detractors ?? 0) * 100 / totalValidResponsesForTable).toFixed(1)}%</td></tr>
                            </tbody>
                        </table>
                        <div className="nps-segment nps-score" style={{marginTop: '15px', textAlign: 'center'}}>
                             <div className="nps-segment-label">NPS Score</div><div className="nps-segment-value" style={{ fontSize: '1.8em' }}>{npsScore?.toFixed(1) ?? 'N/A'}</div><div className="nps-segment-percentage" style={{ fontSize: '0.9em', color: '#666' }}>Based on {totalValidResponsesForTable.toLocaleString()} responses</div>
                        </div>
                    </div>
                </>
            )}

             {/* --- Ranking Tables --- */}
             {shouldRenderRanking && rankingAverageRanks && (
                 <>
                     {/* Average Rank Table */}
                     <h4 className="section-title" style={{ marginTop: '20px' }}>Average Rank per Item</h4>
                     <p className="info-text" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Lower average rank indicates item was generally ranked higher (closer to 1).</p>
                     <div className="overflow-x-auto">
                         <table className="min-w-full border-collapse demographics-table">
                             <thead><tr><th>Item</th><th>Average Rank</th><th>Rank Score</th><th>Responses (Ranked)</th></tr></thead>
                             <tbody>
                                 {rankingOverallScores
                                     ?.sort((a, b) => (a.average_rank ?? 999) - (b.average_rank ?? 999))
                                     .map((item, index) => (
                                         <tr key={index}>
                                             <td>{item.item || "N/A"}</td>
                                             <td className="text-right">{item.average_rank?.toFixed(2) ?? "N/A"}</td>
                                             <td className="text-right">{item.overall_score != null ? item.overall_score.toFixed(2) : "N/A"}</td>
                                             <td className="text-right">{item.count ?? 0}</td>
                                         </tr>
                                     ))}
                             </tbody>
                         </table>
                     </div>
                </>
            )}
             {shouldRenderRanking && rankingDistributionMatrix && rankingItemsInQuestion && (
                 <>
                     {/* Rank Distribution Matrix Table */}
                     <h4 className="section-title" style={{ marginTop: '20px' }}>Rank Distribution Matrix</h4>
                     <p className="info-text" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Shows count of times each item was placed in each rank position.</p>
                     <div className="overflow-x-auto ranking-matrix-wrapper">
                         <table className="ranking-distribution-table">
                             <thead><tr><th>Items</th>{rankingItemsInQuestion.map((_, idx) => (<th key={`rank-h-${idx + 1}`}>Rank {idx + 1}</th>))}</tr></thead>
                             <tbody>
                                 {rankingItemsInQuestion.map((itemText, rowIndex) => (
                                     <tr key={`row-${rowIndex}`}>
                                         <td className="item-name">{itemText}</td>
                                         {rankingItemsInQuestion.map((_, colIndex) => {
                                             const rankPosition = colIndex + 1;
                                             const count = rankingDistributionMatrix[itemText]?.[rankPosition] ?? 0;
                                             return (<td key={`cell-${rowIndex}-${colIndex}`} className={`rank-count ${count > 0 ? 'has-value' : ''}`}>{count}</td>);
                                         })}
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                     {analytics.total_responses_considered !== undefined && (<p className="info-text" style={{ marginTop: '15px', textAlign: 'center' }}>Based on {analytics.total_responses_considered} total responses considered for ranking.</p>)}
                 </>
             )}
             {/* --- End Ranking Tables --- */}

             {/* Message if stats hidden but data exists */}
             {!showStats && statsForTable.length > 0 && (<p className="no-data-small" style={{marginTop: '20px'}}>Statistical summary hidden by settings.</p>)}
             {/* Message if no applicable stats */}
             {showStats && statsForTable.length === 0 && avgRating === null && !npsSegments && avgScaleScore === null && !shouldRenderRanking && (
                 <p className="no-data-small" style={{marginTop: '20px'}}>No statistical summary data available for this question type or selection.</p>
             )}
        </div>
    );
};

// --- Render Image Thumbnails ---
const renderImageThumbnails = (questionSettings, question) => {
    const defaultShow = ["single-image-select", "multiple-image-select"].includes(question.question_type);
    const showThumbs =
        questionSettings?.showThumbnails !== undefined ? questionSettings.showThumbnails : defaultShow;
    if (!showThumbs || !["single-image-select", "multiple-image-select"].includes(question.question_type))
        return null;
    const imageOptions = question.image_options || [];
    if (imageOptions.length === 0) return null;
    return (
        <div className="image-thumbnails-container">
            <h4 className="section-title">Image Options</h4>
            <div className="image-thumbnails-grid">
                {imageOptions.map((opt, index) => {
                    if (typeof opt !== "object" || !opt.image_url) return null;
                    const label = opt.label && String(opt.label).trim() ? opt.label : `Option ${index + 1}`;
                    const hiddenLabel = opt.hidden_label || `img_${index}`;
                    return (
                        <div key={hiddenLabel} className="thumbnail-item">
                            <img src={opt.image_url} alt={label} onError={(e) => { e.target.style.display = "none"; }} />
                            <p>{label}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Render the Chart Component ---
const renderChartComponent = (chartData, chartOptions, questionSettings, question) => {
    const defaultChartType = getDefaultChartType(question?.question_type);
    const currentChartType = questionSettings?.chartType || defaultChartType || 'bar';
    const canChart = chartData && chartData.labels.length > 0 && currentChartType !== 'none';
    if (!canChart) { if (chartData && chartData.labels.length > 0 && currentChartType === 'none') { return <div className="chart-placeholder no-data">Chart display turned off in settings.</div>; } return <div className="chart-placeholder no-data">Chart view not applicable or no data.</div>; }
    const ChartComponent = { bar: Bar, pie: Pie, doughnut: Doughnut, line: Line }[currentChartType] || Bar;
    const chartHeight = (currentChartType === 'pie' || currentChartType === 'doughnut') ? '350px' : '350px';
    return ( <div className="chart-container" style={{ height: chartHeight, width: '100%', position: 'relative', margin: '20px auto 0' }}> <ChartComponent data={chartData} options={chartOptions} /> </div> );
};


// --- Main Component Structure ---
const ReportQuestionDisplay = ({
    surveyId,
    questionId,
    question,
    analyticsDataExternal,
    questionSettings = {},
    globalSettings = {},
}) => {

    // Memoize chart data and options preparation
    const chartData = useMemo(() => prepareChartData(analyticsDataExternal, questionSettings, globalSettings, question),
        [analyticsDataExternal, questionSettings, globalSettings, question]
    );

    const chartOptions = useMemo(() => getChartOptions(analyticsDataExternal, questionSettings, globalSettings, chartData),
        [analyticsDataExternal, questionSettings, globalSettings, chartData]
    );

    const rankingMatrix = analyticsDataExternal.analytics?.rank_distribution_matrix;
    const rankingItems = analyticsDataExternal.analytics?.items_in_question;
    const rankingTotal = analyticsDataExternal.analytics?.total_responses_considered;
    const rankingAvgRanks = analyticsDataExternal.analytics?.average_ranks;
    const showPercentages = questionSettings?.showPercentages !== undefined
        ? questionSettings.showPercentages
        : (globalSettings.showPercentages !== undefined ? globalSettings.showPercentages : true);
    const otherTexts = analyticsDataExternal?.analytics?.other_texts || [];
    const [otherModalOpen, setOtherModalOpen] = useState(false);
    const [otherResponses, setOtherResponses] = useState([]);

    const openOtherModal = async () => {
        try {
            const res = await analyticsAPI.getOpenEndedResponses(surveyId, questionId);
            const dataList = res.data?.responses || res.data?.other_texts || [];
            const texts = dataList.map(r => r.response_text || r.text || r);
            setOtherResponses(texts);
        } catch (err) {
            console.error('Failed to fetch other responses', err);
            setOtherResponses(otherTexts);
        }
        setOtherModalOpen(true);
    };

    const rankingScores = useMemo(() => {
        if (!rankingAvgRanks || !rankingItems) return null;
        const numItems = rankingItems.length || rankingAvgRanks.length;
        return rankingAvgRanks.map(r => ({
            ...r,
            overall_score: (r.average_rank != null && numItems > 0) ? (numItems + 1 - r.average_rank) : null
        }));
    }, [rankingAvgRanks, rankingItems]);

    const sortedRankingItems = useMemo(() => {
        if (!rankingItems || !rankingScores) return rankingItems || [];
        const scoreMap = rankingScores.reduce((map, r) => {
            map[r.item] = r.overall_score;
            return map;
        }, {});
        return [...rankingItems].sort((a, b) => {
            const sb = scoreMap[b] ?? -Infinity;
            const sa = scoreMap[a] ?? -Infinity;
            return sb - sa;
        });
    }, [rankingItems, rankingScores]);


    // --- Render Loading/Error/No Data ---
    if (!analyticsDataExternal) {
        return <div className="question-panel-placeholder loading">Loading...</div>;
    }
    if (analyticsDataExternal.error) {
         return <div className="question-panel-placeholder error">Error: {analyticsDataExternal.error}</div>;
    }
     if (!analyticsDataExternal.analytics || Object.keys(analyticsDataExternal.analytics).length === 0) {
          const excludedTypes = new Set(['document-upload', 'signature', 'date-picker', 'email-input', 'content-text', 'content-media']);
         if (excludedTypes.has(question.question_type)) {
              if (['document-upload', 'date-picker'].includes(question.question_type)) {
                  const fileUrl = `/api/surveys/${surveyId}/files?question_id=${questionId}`;
                  return (
                      <div className="question-panel-placeholder no-data">
                          Analytics not applicable for this question type ({question.question_type}). View uploads in the raw export or <a href={fileUrl} target="_blank" rel="noopener noreferrer">file list</a>.
                      </div>
                  );
              }
              return <div className="question-panel-placeholder no-data">Analytics not applicable for this question type ({question.question_type}). See raw data export.</div>;
         }
          return <div className="question-panel-placeholder no-data">No analytics data available for the current filter selection.</div>;
     }


    // --- Final Render ---
    return (
        <div className="report-question-display">
            {/* Chart Display Area */}
            {question.question_type === 'interactive-ranking' && rankingMatrix && rankingItems ? (
                <DivergingRankChart
                    items={sortedRankingItems}
                    matrix={rankingMatrix}
                    totalResponses={rankingTotal}
                />
            ) : (
                renderChartComponent(chartData, chartOptions, questionSettings, question)
            )}

            {/* Statistics / Tables / Ranking */}
            {renderStatisticsTables(analyticsDataExternal, questionSettings, question)}

            {/* Image Thumbnails (if applicable) */}
            {renderImageThumbnails(questionSettings, question)}

            {/* Modal for Other Responses */}
            {otherModalOpen && (
                <div className="modal-overlay" onClick={() => setOtherModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h4 className="section-title" style={{ marginTop: 0 }}>Other Responses</h4>
                        {otherResponses.length > 0 ? (
                            <ul className="responses-list scrollable other-responses-list">
                                {otherResponses.map((txt, idx) => (
                                    <li key={idx} className="response-item">{txt}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-data-small">No responses available.</p>
                        )}
                        <button className="show-all-btn" onClick={() => setOtherModalOpen(false)} style={{ marginTop: '15px' }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PropTypes ---
ReportQuestionDisplay.propTypes = {
    surveyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    questionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    question: PropTypes.object.isRequired,
    analyticsDataExternal: PropTypes.object,
    questionSettings: PropTypes.shape({
        isHidden: PropTypes.bool, chartType: PropTypes.string, chartColor: PropTypes.string, customColors: PropTypes.arrayOf(PropTypes.string),
        customTitle: PropTypes.string, showPercentages: PropTypes.bool, showLegend: PropTypes.bool,
        dataLabelFormat: PropTypes.oneOf(['none', 'percent', 'count', 'both']), showStatsTable: PropTypes.bool, showResponseDist: PropTypes.bool,

        showNA: PropTypes.bool, showThumbnails: PropTypes.bool,
        showMean: PropTypes.bool, showMedian: PropTypes.bool, showMin: PropTypes.bool, showMax: PropTypes.bool, showStdDev: PropTypes.bool,
        displayOrder: PropTypes.number, indexAxis: PropTypes.oneOf(['x', 'y']),
        sortOrder: PropTypes.oneOf(['default', 'asc', 'desc'])

    }),
    globalSettings: PropTypes.object,
};

export default ReportQuestionDisplay;
