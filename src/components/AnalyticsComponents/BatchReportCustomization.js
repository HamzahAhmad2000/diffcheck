// BatchReportCustomization.js
import React, { useState, useEffect, useCallback,useMemo  } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// import 'jspdf-autotable'; // <- Keep this commented or remove if not needed
import toast from 'react-hot-toast'; // Assuming react-hot-toast is installed
import { surveyAPI, analyticsAPI, chartAPI,reportTabAPI } from '../../services/apiClient'; // Use consistent apiClient
import { createChartImage } from './exportChart'; // Import the chart image utility
import "./AnalyticsComponents.css"; // Assuming you have a CSS file for styles

// --- START OF EDIT 1: Add v4 compatibility shim after imports ---
// ⇢ v4‑compat: if the plugin hasn't patched jsPDF, alias it manually
// This patches the prototype for future instances.
jsPDF.API.autoTable ??= function (opts) { return autoTable(this, opts); };
// --- END OF EDIT 1 ---

// --- Constants ---
const PDF_MARGIN = 15;
const DEFAULT_CHART_COLOR = '#36A2EB';
const DEFAULT_PALETTE = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#FF9F80", "#66FF66", "#FF66B3", "#3399FF",
    "#FF6666", "#80b1d3", "#fdb462", "#b3de69", "#fccde5",
    "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"
]; // Expanded palette

// --- Helper Functions (Keep all existing helpers: getDefaultChartType, generateDefaultColors, addWrappedText, checkPageBreak, drawStars, prepareChartDataForPdf, getChartOptionsForPdf, renderStatisticsTableForPdf, renderGridTableForPdf, renderOpenEndedForPdf) ---
// ... (all helper functions remain exactly the same) ...
/**
 * Gets the default chart type based on question type.
 * @param {string} questionType - The type of the survey question.
 * @returns {string} Default Chart.js chart type ('pie', 'bar', 'line', etc.).
 */
const getDefaultChartType = (questionType) => {
    switch (questionType) {
        case 'multiple-choice':
        case 'dropdown':
        case 'single-image-select':
        case 'scale': // e.g., Likert scale, better as distribution
            return 'pie'; // Pie often good for single choice distribution
        case 'checkbox':
        case 'multiple-image-select':
            return 'bar'; // Bar good for multiple selections (percentage of responses)
        case 'rating-scale': // Legacy? Treat like rating
        case 'rating': // Slider
        case 'star-rating': // Standalone star rating
        case 'nps': // Net Promoter Score (often shown as bar segments)
        case 'numerical-input': // Distribution of numeric inputs
            return 'bar'; // Bar chart suitable for distributions or averages
        case 'open-ended':
        case 'text-input':
        case 'grid-choice': // Grids are handled separately (table)
        case 'grid-scale':
        case 'star-rating-grid':
        case 'file-upload':
        case 'date-time':
        default:
            return 'bar'; // Default for unknowns or types usually not charted directly
    }
};

/**
 * Generates an array of default colors for charts.
 * @param {number} count - The number of colors needed.
 * @returns {string[]} An array of hex color strings.
 */
const generateDefaultColors = (count) => {
    if (count <= 0) return [];
    if (count <= DEFAULT_PALETTE.length) return DEFAULT_PALETTE.slice(0, count);

    const colors = [...DEFAULT_PALETTE];
    for (let i = DEFAULT_PALETTE.length; i < count; i++) {
        // Generate slightly varied colors based on index for less randomness
        const hue = (i * 40) % 360; // Cycle through hues
        const saturation = 70 + ((i * 3) % 30); // Vary saturation slightly
        const lightness = 55 + ((i * 5) % 20); // Vary lightness slightly
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`); // Use template literal correctly
    }
    return colors;
};

/**
 * Adds text to the PDF document, wrapping it within a max width.
 * @param {jsPDF} doc - The jsPDF document instance.
 * @param {string} text - The text to add.
 * @param {number} x - The starting X coordinate.
 * @param {number} y - The starting Y coordinate.
 * @param {number} maxWidth - The maximum width for the text before wrapping.
 * @param {number} [lineHeight=5] - The height of each line.
 * @returns {number} The Y coordinate after adding the text.
 */
const addWrappedText = (doc, text, x, y, maxWidth, lineHeight = 5) => {
    if (!text || typeof text !== 'string') return y;
    try {
        const lines = doc.splitTextToSize(text, maxWidth);
        // Calculate required height before adding text to potentially check page break
        const textHeight = lines.length * lineHeight * 1.15;
        // y = checkPageBreak(doc, y, textHeight); // Optionally check page break *before* adding text
        doc.text(lines, x, y, { lineHeightFactor: 1.15 }); // Use lineHeightFactor for better spacing
        return y + textHeight; // Adjust Y based on lines and factor
    } catch (e) {
        console.error("Error splitting text:", text, e);
        // Fallback: Add text without wrapping if split fails
        doc.text(text, x, y);
        return y + lineHeight;
    }
};


/**
 * Checks if a page break is needed and adds a new page if necessary.
 * @param {jsPDF} doc - The jsPDF document instance.
 * @param {number} currentY - The current Y position on the page.
 * @param {number} [requiredSpace=30] - The minimum space required for the next element.
 * @returns {number} The potentially updated Y position (either original or top margin of new page).
 */
const checkPageBreak = (doc, currentY, requiredSpace = 30) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 20; // Bottom margin
    if (currentY + requiredSpace > pageHeight - marginBottom) {
        doc.addPage();
        return PDF_MARGIN; // Return new starting Y position (top margin)
    }
    return currentY;
};

/**
 * Draws stars on the PDF for ratings.
 * @param {jsPDF} doc - The jsPDF document instance.
 * @param {number} x - Starting X coordinate.
 * @param {number} y - Starting Y coordinate (center of stars).
 * @param {number} rating - The rating value (e.g., 3.5).
 * @param {number} [maxRating=5] - The maximum possible rating (e.g., 5 stars).
 * @param {number} [size=3] - The approximate radius of the star.
 */
const drawStars = (doc, x, y, rating, maxRating = 5, size = 3) => {
    const ratingNum = Number(rating) || 0;
    if (ratingNum < 0 || ratingNum > maxRating) {
        console.warn(`Rating ${ratingNum} out of range [0, ${maxRating}]`);
        // Optionally draw placeholder or nothing
        return;
    }
    const fullStars = Math.floor(ratingNum);
    const partialStar = ratingNum % 1;
    const starColor = '#fadb14'; // Standard star yellow
    const emptyColor = '#e0e0e0'; // Light grey for empty

    let currentX = x;
    // Star points definition (relative to center 0,0)
    const starPoints = [
        [0, -1], [0.22, -0.31], [0.95, -0.31], [0.36, 0.11],
        [0.59, 0.81], [0, 0.38], [-0.59, 0.81], [-0.36, 0.11],
        [-0.95, -0.31], [-0.22, -0.31]
    ];

    for (let i = 0; i < maxRating; i++) {
        const starPath = starPoints.map(p => [(p[0] * size) + currentX, (p[1] * size) + y]);

        // Draw empty star outline first
        doc.setDrawColor(emptyColor);
        doc.setFillColor(emptyColor);
        doc.lines(starPath, 0, 0, [1, 1], 'D'); // Draw outline only

        if (i < fullStars) {
            // Draw full star
            doc.setDrawColor(starColor);
            doc.setFillColor(starColor);
            doc.lines(starPath, 0, 0, [1, 1], 'FD'); // Fill and Stroke
        } else if (i === fullStars && partialStar > 0.05) { // Draw partial star
            doc.saveGraphicsState(); // Use saveGraphicsState/restoreGraphicsState
            // Create clipping path for the partial fill
            const clipWidth = size * 2 * partialStar; // Width of the filled part
            doc.rect(currentX - size, y - size, clipWidth, size * 2, 'clip'); // Define clip area

            // Redraw the star filled within the clipped area
            doc.setDrawColor(starColor);
            doc.setFillColor(starColor);
            doc.lines(starPath, 0, 0, [1, 1], 'FD');

            doc.restoreGraphicsState(); // Restore context to remove clipping
        }

        currentX += size * 2.5; // Move to the next star position
    }
};


/**
 * Prepares data in the format required by Chart.js based on analytics data and settings.
 * @param {object} analytics - The analytics object for a question (from API).
 * @param {object} settings - Customization settings for this question/chart.
 * @returns {object|null} Chart.js data object { labels, datasets } or null if not applicable.
 */
const prepareChartDataForPdf = (analytics, settings) => {
    if (!analytics || !analytics.analytics) return null;
    const data = analytics.analytics;
    const questionType = analytics.question_type;
    const showPercentages = settings.showPercentages !== undefined ? settings.showPercentages : true;
    const baseChartColor = settings.chartColor || DEFAULT_CHART_COLOR;
    let customColors = settings.customColors || [];

    const getBackgroundColors = (count) => {
        const definedCustomColors = customColors.filter(c => c); // Filter out null/undefined placeholders
        if (definedCustomColors.length >= count) {
            return definedCustomColors.slice(0, count);
        }
        // If custom colors exist but not enough, cycle through them
        if (definedCustomColors.length > 0) {
             return Array.from({ length: count }, (_, i) => definedCustomColors[i % definedCustomColors.length]);
        }
        // Use base color for single item, otherwise generate palette
        if (count === 1) return [baseChartColor];
        return generateDefaultColors(count);
    };

    let labels = [];
    let values = [];
    let percentages = [];
    let counts = [];
    let datasetLabel = showPercentages ? '%' : 'Count';

    // Logic adapted from QuestionAnalyticsChart's prepareChartData
    if (data.type === 'single_select_distribution' && data.options_distribution) {
        labels = data.options_distribution.map(d => d.option || 'N/A');
        values = data.options_distribution.map(d => showPercentages ? (d.percentage ?? 0) : (d.count ?? 0));
        percentages = data.options_distribution.map(d => d.percentage ?? 0);
        counts = data.options_distribution.map(d => d.count ?? 0);
    } else if (data.type === 'multi_select_distribution' && data.option_distribution) {
        labels = data.option_distribution.map(d => d.option || 'N/A');
        // For multi-select, percentage of *responses* is often more meaningful than % of respondents
        values = data.option_distribution.map(d => showPercentages ? (d.percentage_of_responses ?? 0) : (d.count ?? 0));
        percentages = data.option_distribution.map(d => d.percentage_of_responses ?? 0);
        counts = data.option_distribution.map(d => d.count ?? 0);
        datasetLabel = showPercentages ? '% Responses' : 'Count';
    } else if ((data.type === 'slider_stats' || data.type === 'star-rating' || data.type === 'rating-scale') && data.distribution) {
        labels = data.distribution.map(d => d.value?.toString() ?? "N/A");
        values = data.distribution.map(d => showPercentages ? (d.percentage ?? 0) : (d.count ?? 0));
        percentages = data.distribution.map(d => d.percentage ?? 0);
        counts = data.distribution.map(d => d.count ?? 0);
    } else if (data.type === 'numeric_stats' && questionType === 'nps' && data.nps_segments) {
        const { promoters = 0, passives = 0, detractors = 0 } = data.nps_segments;
        const total = promoters + passives + detractors;
        percentages = total > 0
            ? [(promoters / total) * 100, (passives / total) * 100, (detractors / total) * 100]
            : [0, 0, 0];
        counts = [promoters, passives, detractors];
        values = showPercentages ? percentages : counts;
        labels = ["Promoters (9-10)", "Passives (7-8)", "Detractors (0-6)"];
        // Use specific NPS colors unless overridden by customColors
        const npsDefaultColors = ["#4BC0C0", "#FFCE56", "#FF6384"];
        customColors = customColors.length >= 3 ? customColors.slice(0,3) : npsDefaultColors;
        datasetLabel = 'NPS Segments';
    } else {
        // Handle other numeric types if needed, or return null if not chartable
        return null; // No chartable data found
    }

    // Return null if no valid data points
    if (labels.length === 0 || values.length === 0) {
      return null;
    }

    return {
        labels,
        datasets: [{
            label: datasetLabel,
            data: values,
            backgroundColor: getBackgroundColors(labels.length), // Use generated colors
            // Store raw counts and percentages for datalabels/tooltips regardless of display value
            counts: counts,
            percentages: percentages
        }]
    };
};

/**
 * Gets Chart.js options object based on settings.
 * @param {object} analytics - Analytics data (used for title fallback).
 * @param {object} settings - Customization settings.
 * @param {Array} [labels=[]] - Array of labels for the chart (used for legend display logic).
 * @returns {object} Chart.js options object.
 */
const getChartOptionsForPdf = (analytics, settings, labels = []) => {
    const titleText = settings.customTitle || analytics.question_text || '';
    const chartType = settings.chartType || 'bar';
    // Note: 'horizontalBar' is deprecated in Chart.js 3+. Use 'bar' with indexAxis: 'y'.
    const isHorizontal = chartType === 'bar' && settings.indexAxis === 'y'; // Check settings for orientation
    const showLegend = settings.showLegend !== undefined ? settings.showLegend : true;
    const showPercentages = settings.showPercentages !== undefined ? settings.showPercentages : true;
    const isPieDoughnut = chartType === 'pie' || chartType === 'doughnut';

    const options = {
        responsive: false, // Required for static generation
        maintainAspectRatio: false, // Required for static generation
        indexAxis: isHorizontal ? 'y' : 'x',
        plugins: {
            title: {
                display: !!titleText,
                text: titleText,
                font: { size: 14, weight: 'bold' }, // Bolder title
                padding: { top: 10, bottom: 15 }
            },
            legend: {
                display: showLegend && (isPieDoughnut || (labels.length > 1 && !isHorizontal)), // Show legend for pie/doughnut or multi-item bar/line
                position: 'bottom',
                labels: {
                    padding: 15,
                    boxWidth: 12, // Slightly larger box
                    font: { size: 10 } // Slightly larger font
                }
            },
            tooltip: {
                enabled: false // Disable tooltips for static PDF image
            },
            datalabels: { // Requires 'chartjs-plugin-datalabels' to be registered globally or passed to createChartImage
                display: true, // Enable labels by default
                color: isPieDoughnut ? '#ffffff' : '#444444', // White on slices, dark otherwise
                font: {
                    size: 9,
                    weight: '500' // Slightly bolder labels
                },
                anchor: isPieDoughnut ? 'center' : 'end',
                align: isPieDoughnut ? 'center' : 'end',
                formatter: (value, context) => {
                    // Retrieve pre-calculated counts/percentages stored in the dataset
                    const count = context.dataset.counts?.[context.dataIndex] ?? value;
                    const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;

                    // For Pie/Doughnut, only show label if slice is large enough
                    if (isPieDoughnut && percentage !== null && percentage < 5) {
                        return ''; // Hide label for small slices
                    }

                    if (showPercentages && percentage !== null) {
                        return `${percentage.toFixed(1)}%`; // Show percentage
                    } else {
                        // Format count with commas for thousands separators
                        return count?.toLocaleString() ?? value; // Show count (formatted) or original value
                    }
                }
            }
        },
        scales: (chartType === 'bar' || chartType === 'line') ? { // Scales only needed for bar/line
            x: {
                beginAtZero: true,
                display: !isHorizontal, // Hide x-axis if horizontal
                ticks: { font: { size: 9 } },
                grid: { // Subtle grid lines
                    color: '#eeeeee',
                    drawBorder: false, // Cleaner look without border line
                }
            },
            y: {
                beginAtZero: true,
                display: isHorizontal, // Hide y-axis if vertical
                ticks: { font: { size: 9 } },
                grid: { // Subtle grid lines
                    color: '#eeeeee',
                    drawBorder: false,
                }
            }
        } : {},
        animation: false // Disable animation for static generation
    };

    return options;
};


/**
 * Renders statistical tables using jspdf-autotable.
 * @param {jsPDF} doc - jsPDF instance.
 * @param {object} analytics - Question analytics data.
 * @param {object} settings - Question settings (unused currently, but could be).
 * @param {number} startY - Starting Y position.
 * @param {number} margin - Left/right margin.
 * @param {number} contentWidth - Available width for content.
 * @returns {number} New Y position after rendering.
 */
const renderStatisticsTableForPdf = (doc, analytics, settings, startY, margin, contentWidth) => {
    if (!analytics || !analytics.analytics) return startY;
    const data = analytics.analytics;
    let yPos = startY;
    const tableTheme = 'striped';
    const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 9 };
    const bodyStyles = { fontSize: 8, cellPadding: 1.5, valign: 'middle' };
    const alternateRowStyles = { fillColor: [245, 245, 245] };

    // NOTE: This function relies on doc.autoTable being available due to the shim
    const addTable = (head, body, currentY, tableMargin = margin) => {
        if (!body || body.length === 0) return currentY;
        const tableHeight = (body.length + 1) * 7 + 10; // Estimate height needed
        currentY = checkPageBreak(doc, currentY, tableHeight);
        // >>> THE CALL THAT FAILED <<< This now works because of the shim
        doc.autoTable({
            head: head,
            body: body,
            startY: currentY,
            theme: tableTheme,
            headStyles: headStyles,
            bodyStyles: bodyStyles,
            alternateRowStyles: alternateRowStyles,
            margin: { left: tableMargin, right: tableMargin } // Allow specifying margin
        });
        return doc.lastAutoTable.finalY + 5; // Add padding after table
    };

    // Single/Multi-Select Distribution Table
    if (data.type === 'single_select_distribution' && data.options_distribution) {
        const headers = [['Option', 'Count', 'Percentage']];
        const body = data.options_distribution.map(item => [
            item.option || 'N/A', item.count ?? 0, `${item.percentage?.toFixed(1) ?? 0.0}%`
        ]);
        yPos = addTable(headers, body, yPos);
    } else if (data.type === 'multi_select_distribution' && data.option_distribution) {
        const headers = [['Option', 'Count', '% Responses']];
        const body = data.option_distribution.map(item => [
            item.option || 'N/A', item.count ?? 0, `${item.percentage_of_responses?.toFixed(1) ?? 0.0}%`
        ]);
        yPos = addTable(headers, body, yPos);
    }

    // Numeric/Slider/Rating/Star Summary Statistics Table
    if (data.type === 'numeric_stats' || data.type === 'slider_stats' || data.type === 'star-rating' || data.type === 'rating-scale') {
        const stats = [
            { label: "Responses", value: data.response_count },
            { label: "Average", value: data.mean },
            { label: "Median", value: data.median },
            { label: "Min", value: data.min },
            { label: "Max", value: data.max },
            { label: "Std Dev", value: data.std_dev },
        ];
        const body = stats
            .filter(stat => stat.value !== undefined && stat.value !== null)
            .map(stat => [stat.label, typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A']);

        if (body.length > 0) {
             // Use slightly wider margins for the summary table if it's standalone
             const tableMargin = (data.distribution && data.distribution.length > 0) || (analytics.question_type === 'nps' && data.nps_segments) ? margin : margin + contentWidth * 0.1;
             const tableWidth = (data.distribution && data.distribution.length > 0) || (analytics.question_type === 'nps' && data.nps_segments) ? contentWidth : contentWidth * 0.6;
             yPos = addTable([['Metric', 'Value']], body, yPos, tableMargin);
        }

        // Add star visualization for applicable types
        if ((analytics.question_type === 'star-rating' || analytics.question_type === 'rating-scale') && data.mean !== undefined && data.mean !== null) {
            yPos = checkPageBreak(doc, yPos, 15);
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(`Average Rating Visual:`, margin, yPos + 1); // Adjust text pos slightly
            // Determine max rating (e.g., from question properties if available, else default 5)
            const maxRating = analytics.max_value || analytics.max_stars || 5;
            drawStars(doc, margin + 40, yPos + 1, data.mean, maxRating, 2.5); // Use max_stars from analytics if available
            yPos += 8;
        }

        // Detailed Distribution Table (for sliders, ratings, etc.)
        if (data.distribution && data.distribution.length > 0) {
             yPos = checkPageBreak(doc, yPos, 20); // Check space before adding potentially large table
             const distHeaders = [['Value', 'Count', 'Percentage']];
             const distBody = data.distribution.map(item => [ item.value ?? 'N/A', item.count ?? 0, `${item.percentage?.toFixed(1) ?? 0.0}%` ]);
             yPos = addTable(distHeaders, distBody, yPos);
        }

        // NPS Specific Table
        if (analytics.question_type === 'nps' && data.nps_segments) {
            yPos = checkPageBreak(doc, yPos, 25);
            const npsHeaders = [['Segment', 'Count', 'Percentage']];
            const totalNps = (data.nps_segments.promoters ?? 0) + (data.nps_segments.passives ?? 0) + (data.nps_segments.detractors ?? 0);
            const npsBody = [
                ['Promoters (9-10)', data.nps_segments.promoters ?? 0, totalNps > 0 ? `${((data.nps_segments.promoters / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                ['Passives (7-8)', data.nps_segments.passives ?? 0, totalNps > 0 ? `${((data.nps_segments.passives / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                ['Detractors (0-6)', data.nps_segments.detractors ?? 0, totalNps > 0 ? `${((data.nps_segments.detractors / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                 // Add row for NPS score itself below the table
                // ['NPS Score', data.nps_score?.toFixed(1) ?? 'N/A', ''] // NPS score is not a percentage
            ];
            yPos = addTable(npsHeaders, npsBody, yPos);

            // Add NPS Score separately below the table for emphasis
            if (data.nps_score !== undefined && data.nps_score !== null) {
                yPos = checkPageBreak(doc, yPos, 10);
                doc.setFontSize(10);
                doc.setTextColor(44, 62, 80);
                doc.setFont('helvetica', 'bold');
                doc.text(`NPS Score: ${data.nps_score.toFixed(1)}`, margin, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += 7;
            }
        }
    }
    return yPos;
};

/**
 * Renders grid question data using jspdf-autotable.
 * @param {jsPDF} doc - jsPDF instance.
 * @param {object} gridData - The grid analytics data (e.g., analytics.analytics.grid_data).
 * @param {string} gridType - Type of grid question ('grid-choice', 'star-rating-grid', etc.).
 * @param {number} startY - Starting Y position.
 * @param {number} margin - Left/right margin.
 * @param {number} contentWidth - Available width for content.
 * @returns {number} New Y position after rendering.
 */
const renderGridTableForPdf = (doc, gridData, gridType, startY, margin, contentWidth) => {
    if (!gridData || !gridData.rows || !gridData.columns || gridData.rows.length === 0 || gridData.columns.length === 0) {
         startY = checkPageBreak(doc, startY, 10);
         doc.setFontSize(9);
         doc.setTextColor(150, 150, 150);
         startY = addWrappedText(doc, 'No data available for this grid.', margin, startY, contentWidth);
         return startY + 5;
    }
    let yPos = startY;
    const isStarGrid = gridType === 'star-rating-grid';
    const tableTheme = 'grid'; // Grid theme suits tables
    const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle' };
    const bodyStyles = { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle' };
    const footStyles = { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle' };

    // Headers: Empty top-left, Column names, Row Total/Avg
    const headerLabel = isStarGrid ? 'Row Avg' : 'Row Total';
    const headers = [[' '].concat(gridData.columns).concat([headerLabel])];

    // Body: Row names, Cell values (count/percentage or avg/count), Row Total/Avg
    const body = gridData.rows.map((row, rIdx) => {
        const rowData = [row || `Row ${rIdx + 1}`]; // Use row name or placeholder
        gridData.columns.forEach((_, cIdx) => {
            if (isStarGrid) {
                const avg = gridData.cell_averages?.[rIdx]?.[cIdx];
                const count = gridData.count_values?.[rIdx]?.[cIdx] ?? 0;
                rowData.push(avg !== undefined && avg !== null ? `${avg.toFixed(2)}\n(${count})` : `-\n(${count})`);
            } else { // Choice grid
                const count = gridData.values?.[rIdx]?.[cIdx] ?? 0;
                const rowTotal = gridData.row_totals?.[rIdx] ?? 0;
                const percentage = rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : '0.0';
                rowData.push(`${count}\n(${percentage}%)`);
            }
        });
        // Add Row Total/Average
        const rowStat = isStarGrid ? gridData.row_averages?.[rIdx] : gridData.row_totals?.[rIdx];
        rowData.push(rowStat !== undefined && rowStat !== null ? (isStarGrid ? rowStat.toFixed(2) : rowStat.toLocaleString()) : (isStarGrid ? '-' : 0));
        return rowData;
    });

    // Footer: Column Total/Average/Responses
    let foot = [];
    const overallAvgText = gridData.overall_average !== undefined && gridData.overall_average !== null
        ? `Overall Avg: ${gridData.overall_average.toFixed(2)}`
        : '';
    if (isStarGrid && gridData.column_averages?.length > 0) {
        foot.push(['Col Avg'].concat(gridData.column_averages.map(avg => avg?.toFixed(2) ?? '-')).concat([overallAvgText]));
    }
    // Add column total counts row for all grid types
    const colTotalsLabel = isStarGrid ? 'Col Responses' : 'Col Total';
    const colTotalValues = gridData.column_totals?.map(total => total?.toLocaleString() ?? 0) || gridData.columns.map(() => 0); // Fallback if missing
    const overallTotal = gridData.total_responses ?? body.reduce((sum, row) => sum + (isStarGrid ? 0 : parseInt(String(row[row.length - 1]).replace(/,/g, ''), 10) || 0), 0); // Calculate if missing for choice, handle commas
    const grandTotalLabel = isStarGrid ? `Total Resp: ${overallTotal.toLocaleString()}` : `Grand Total: ${overallTotal.toLocaleString()}`;
    // If not star grid and no overall average, place grand total here instead
    const lastFootCell = isStarGrid ? grandTotalLabel : (overallAvgText || grandTotalLabel);
    foot.push([colTotalsLabel].concat(colTotalValues).concat([lastFootCell]));


    // Estimate height & check page break
    // Estimate based on rows, columns, header/footer, consider avg cell height
    const avgCellHeight = 8; // Adjust based on font size and padding
    const estimatedHeight = (headers.length + body.length + foot.length) * avgCellHeight + 15;
    yPos = checkPageBreak(doc, yPos, estimatedHeight);

    // >>> THE CALL THAT FAILED <<< This now works because of the shim
    doc.autoTable({
        head: headers,
        body: body,
        foot: foot,
        startY: yPos,
        theme: tableTheme,
        headStyles: headStyles,
        bodyStyles: bodyStyles,
        footStyles: footStyles,
        margin: { left: margin, right: margin },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 'auto', fontSize: 7 } // Style first column (row headers)
        },
        didParseCell: function (data) { // Allow multi-line text in cells
            if (typeof data.cell.raw === 'string' && data.cell.raw.includes('\n')) {
                data.cell.text = data.cell.raw.split('\n');
            }
        }
    });
    yPos = doc.lastAutoTable.finalY + 10; // Add padding after table
    return yPos;
};

/**
 * Renders open-ended responses (word cloud data, recent responses) using jspdf-autotable and text rendering.
 * @param {jsPDF} doc - jsPDF instance.
 * @param {object} analytics - Question analytics data.
 * @param {number} startY - Starting Y position.
 * @param {number} margin - Left/right margin.
 * @param {number} contentWidth - Available width for content.
 * @param {boolean} showWordCloud - Whether to display the word frequency table.
 * @param {boolean} showResponses - Whether to display recent responses.
 * @param {number} limit - Max number of recent responses to show.
 * @returns {number} New Y position after rendering.
 */
const renderOpenEndedForPdf = (doc, analytics, startY, margin, contentWidth, showWordCloud, showResponses, limit) => {
    if (!analytics || !analytics.analytics) return startY;
    const data = analytics.analytics;
    let yPos = startY;
    const tableTheme = 'striped';
    const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 9 };
    const bodyStyles = { fontSize: 8, cellPadding: 1.5 };
    const alternateRowStyles = { fillColor: [245, 245, 245] };

    // Word Frequency Table (Word Cloud Data)
    if (showWordCloud && data.word_frequencies && data.word_frequencies.length > 0) {
        yPos = checkPageBreak(doc, yPos, 30); // Check space before section
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Top Words:', margin, yPos);
        yPos += 7;

        const wordHeaders = [['Word', 'Frequency']];
        // Limit to top 15-20 words for the table
        const wordBody = data.word_frequencies.slice(0, 20).map(item => [item.word, item.count]);

        if (wordBody.length > 0) {
            const tableHeight = (wordBody.length + 1) * 7 + 10;
            yPos = checkPageBreak(doc, yPos, tableHeight); // Check space for table
            // >>> THE CALL THAT FAILED <<< This now works because of the shim
            doc.autoTable({
                head: wordHeaders,
                body: wordBody,
                startY: yPos,
                theme: tableTheme,
                headStyles: headStyles,
                bodyStyles: bodyStyles,
                alternateRowStyles: alternateRowStyles,
                margin: { left: margin, right: margin }
            });
            yPos = doc.lastAutoTable.finalY + 10;
        } else {
             yPos = checkPageBreak(doc, yPos, 10);
             doc.setFontSize(9);
             doc.setTextColor(150, 150, 150);
             yPos = addWrappedText(doc, "No significant words found.", margin, yPos, contentWidth);
             yPos += 5;
        }
    } else if (showWordCloud) {
         yPos = checkPageBreak(doc, yPos, 15);
         doc.setFontSize(9);
         doc.setTextColor(150, 150, 150);
         yPos = addWrappedText(doc, 'Word frequency data not available or disabled.', margin, yPos, contentWidth);
         yPos += 10; // Add a bit more space
    }

    // Recent Responses List
    // Use 'all_responses' if available and filtering/limiting is needed, else use 'latest_10' as fallback
    const responses = data.all_responses || data.latest_10 || [];
    if (showResponses && responses.length > 0 && limit > 0) {
        yPos = checkPageBreak(doc, yPos, 25); // Check space before section
        const responsesToDisplay = responses.slice(0, limit);
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text(`Recent Responses (Showing ${responsesToDisplay.length} of ${data.response_count ?? responses.length}):`, margin, yPos);
        yPos += 7;

        responsesToDisplay.forEach((resp) => {
            const respText = resp.text || '[No Text Provided]';
            // Estimate height needed based on text length (very approximate)
            const lines = doc.splitTextToSize(respText, contentWidth - 6); // Simulate wrapping
            const requiredHeight = Math.max(15, lines.length * 4 + 8); // Min height 15, adjust line height multiplier

            yPos = checkPageBreak(doc, yPos, requiredHeight + 5); // Check space for the box + padding

            // Simple box around response
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(252, 252, 252); // Very light background
            doc.rect(margin, yPos, contentWidth, requiredHeight, 'FD'); // Fill and Draw

            // Add response text inside the box
            doc.setFontSize(8);
            doc.setTextColor(50, 50, 50);
            // Use addWrappedText with adjusted position and width
            addWrappedText(doc, respText, margin + 3, yPos + 4, contentWidth - 6, 4);

            yPos += requiredHeight + 4; // Move yPos down past the box plus spacing
        });
    } else if (showResponses) {
         yPos = checkPageBreak(doc, yPos, 15);
         doc.setFontSize(9);
         doc.setTextColor(100, 100, 100);
         yPos = addWrappedText(doc, 'No responses to display or response display is disabled.', margin, yPos, contentWidth);
         yPos += 5;
    }
    return yPos;
};

// --- Main Component ---
const BatchReportCustomization = ({ survey: surveyProp, initialSettings: initialSettingsProp, onSave: onSaveProp, onClose: onCloseProp }) => {
    const { surveyId } = useParams();
    const navigate = useNavigate();

    // Add state for active settings section
    const [activeSection, setActiveSection] = useState(null);

    const [internalSurvey, setInternalSurvey] = useState(null);
    const [internalSettings, setInternalSettings] = useState(null); // Holds settings fetched in 
    // --- State Variables ---
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState(0);
    const [pdfError, setPdfError] = useState(null);

    // PDF Export Options State
     const [editableSettings, setEditableSettings] = useState(initialSettingsProp || { global: {}, questions: {}, demographics: {}, pdfExportOptions: {} });
     
     
     // Chart/Report Customization States
    const [globalChartType, setGlobalChartType] = useState('bar'); // Default global type
    const [globalChartColor, setGlobalChartColor] = useState(DEFAULT_CHART_COLOR);
    const [globalShowPercentages, setGlobalShowPercentages] = useState(true);
    const [globalShowLegend, setGlobalShowLegend] = useState(true);
    const [questionSettings, setQuestionSettings] = useState({}); // { qId: { chartType, chartColor, showPercentages, showLegend, customTitle, customColors, displayOrder } }
    const [demographicsSettings, setDemographicsSettings] = useState({ // Default demo settings structure
        age_groups: { chartType: 'pie', chartColor: '#4BC0C0', showPercentages: true, showLegend: true, customColors: [] },
        genders: { chartType: 'pie', chartColor: '#FF6384', showPercentages: true, showLegend: true, customColors: [] },
        locations: { chartType: 'bar', chartColor: '#FFCE56', showPercentages: true, showLegend: true, customColors: [] },
        // Add other expected demographic keys with defaults
        education: { chartType: 'bar', chartColor: '#9966FF', showPercentages: true, showLegend: true, customColors: [] },
        employment_status: { chartType: 'pie', chartColor: '#FF9F40', showPercentages: true, showLegend: true, customColors: [] },
        // Add any other demographics you typically track
    });
    const [questionOptions, setQuestionOptions] = useState({}); // { qId: [{label, count}], demographics: { age_groups: [{label, count}], ... } }
    const [demographicsData, setDemographicsData] = useState(null); // Raw demographics analytics data

     // --- Local Storage Persistence (Declared early) ---
    const LS_KEY = `chart-settings-${surveyId}`;
    const isStandalone = !surveyProp || !initialSettingsProp || !onSaveProp;


        const [currentSettings, setCurrentSettings] = useState(initialSettingsProp || { global: {}, questions: {}, demographics: {}, pdfExportOptions: {} });

    // PDF export options state - initialize based on props or defaults
    const [includeDemographics, setIncludeDemographics] = useState(initialSettingsProp?.pdfExportOptions?.includeDemographics ?? true);
    const [showWordCloudData, setShowWordCloudData] = useState(initialSettingsProp?.pdfExportOptions?.showWordCloudData ?? true);
    const [showOpenEndedResponses, setShowOpenEndedResponses] = useState(initialSettingsProp?.pdfExportOptions?.showOpenEndedResponses ?? true);
    const [openEndedResponseLimit, setOpenEndedResponseLimit] = useState(initialSettingsProp?.pdfExportOptions?.openEndedResponseLimit ?? 10);
    

    // Use the appropriate survey object based on mode
    const survey = surveyProp || internalSurvey;


    const loadSettingsFromLocalStorage = useCallback(() => {
        console.log("Attempting to load settings from localStorage...");
        if (!surveyId) return;
        try {
            const localSettings = localStorage.getItem(LS_KEY);
            if (localSettings) {
                const data = JSON.parse(localSettings);
                console.log("Found settings in localStorage:", data);
                 // Apply loaded settings - similar logic to fetchChartSettings merge
                 if (data.global) {
                    setGlobalChartType(data.global.chartType || 'bar');
                    setGlobalChartColor(data.global.chartColor || DEFAULT_CHART_COLOR);
                    setGlobalShowPercentages(data.global.showPercentages !== undefined ? data.global.showPercentages : true);
                    setGlobalShowLegend(data.global.showLegend !== undefined ? data.global.showLegend : true);
                 }
                 if (data.questions) {
                    // Requires careful merge with existing questions if survey changed
                    // For now, simple overwrite if present, might lose new Qs defaults
                     setQuestionSettings(prev => ({ ...prev, ...data.questions }));
                 }
                 if (data.demographics) {
                    setDemographicsSettings(prev => ({ ...prev, ...data.demographics })); // Merge with defaults
                 }
                toast.info('Loaded settings from local backup (fallback).');
            } else {
                console.log("No settings found in localStorage.");
            }
        } catch (err) {
            console.error('Error loading settings from localStorage:', err);
        }
    }, [surveyId, LS_KEY]);

    const saveSettingsToLocalStorage = useCallback((settings) => {
        console.log("Saving settings to localStorage...");
        if (!surveyId) return;
        try {
            // Ensure settings object is well-formed before stringifying
            const validSettings = settings || {}; // Use empty object if null/undefined
            localStorage.setItem(LS_KEY, JSON.stringify(validSettings));
            console.log("Settings saved to localStorage.");
        } catch (err) {
            console.error('Error saving settings to localStorage:', err);
            toast.error('Could not save settings to local storage.'); // Inform user
        }
    }, [surveyId, LS_KEY]);





        useEffect(() => {
        const fetchStandaloneData = async () => {
            if (!surveyId) {
                setError("Survey ID missing."); setLoading(false); return;
            }
            setLoading(true); setError(null);
            try {
                console.log(`BatchReportCustomization (Standalone): Fetching base data and settings for survey ID: ${surveyId}`);
                // Fetch survey details and settings ONLY in standalone mode
                const [baseDataRes, settingsRes] = await Promise.all([
                    reportTabAPI.getBaseData(surveyId), // Fetch survey structure
                    reportTabAPI.getReportSettings(surveyId) // Fetch settings
                ]);

                if (!baseDataRes.data?.survey) throw new Error("Survey not found.");
                setInternalSurvey(baseDataRes.data.survey); // Set internal survey

                const fetchedSettings = settingsRes.data || {};
                // Use processFetchedSettings helper if available, otherwise basic assignment
                const processed = fetchedSettings; // Replace with actual processing if needed
                setInternalSettings(processed); // Set internal settings state
                setCurrentSettings(processed); // Initialize working state

                 // Initialize PDF options state from fetched settings
                 setIncludeDemographics(processed?.pdfExportOptions?.includeDemographics ?? true);
                 setShowWordCloudData(processed?.pdfExportOptions?.showWordCloudData ?? true);
                 setShowOpenEndedResponses(processed?.pdfExportOptions?.showOpenEndedResponses ?? true);
                 setOpenEndedResponseLimit(processed?.pdfExportOptions?.openEndedResponseLimit ?? 10);


                // Now fetch options and demographics using the fetched survey
                const questions = baseDataRes.data.survey.questions || [];
                await Promise.all([
                    fetchDemographicsData(),
                    fetchQuestionOptions(questions)
                ]);

            } catch (err) {
                console.error('BatchReportCustomization (Standalone): Error fetching component data:', err);
                setError(err.response?.data?.error || err.message || 'Failed to load component data');
                toast.error(`Error: ${err.message || 'Failed to load'}`);
                // Optionally try localStorage load here too?
                // loadSettingsFromLocalStorage();
            } finally {
                setLoading(false);
            }
        };

        // Fetch data only if running as a standalone page
        if (isStandalone) {
            fetchStandaloneData();
        } else {
            // If running as a modal (props provided), ensure state is synced if props change
             // And fetch options/demo data using the survey prop
            setCurrentSettings(initialSettingsProp || { global: {}, questions: {}, demographics: {}, pdfExportOptions: {} });
            setIncludeDemographics(initialSettingsProp?.pdfExportOptions?.includeDemographics ?? true);
            setShowWordCloudData(initialSettingsProp?.pdfExportOptions?.showWordCloudData ?? true);
            setShowOpenEndedResponses(initialSettingsProp?.pdfExportOptions?.showOpenEndedResponses ?? true);
            setOpenEndedResponseLimit(initialSettingsProp?.pdfExportOptions?.openEndedResponseLimit ?? 10);

             if (surveyProp) {
                 setLoading(true); // Set loading while fetching options/demo
                 Promise.all([
                     fetchDemographicsData(),
                     fetchQuestionOptions(surveyProp.questions || [])
                 ]).finally(() => setLoading(false));
             } else {
                 setLoading(false); // No survey prop, nothing to fetch
             }
        }

    // Depend on props changing to re-sync state when used as a modal component
    }, [surveyId, isStandalone, initialSettingsProp, surveyProp]); 


    // --- Fetch Initial Data ---


        useEffect(() => {
        // Only update if the prop actually changes and is valid
        if (initialSettingsProp && initialSettingsProp !== editableSettings) {
            setEditableSettings(initialSettingsProp);
        }
        // Optionally add a deep comparison if initialSettings object reference changes often
    }, [initialSettingsProp]); // Dependency on the prop

    // --- Fetch Callbacks (Stable due to useCallback) ---
    const fetchChartSettings = useCallback(async (currentSurvey) => { // Accept survey data directly
        console.log("Fetching chart settings...");
        if (!surveyId) return; // Guard against missing surveyId
        try {
            const response = await chartAPI.getChartSettings(surveyId);
            const data = response.data || {}; // Ensure data is an object
            console.log("Fetched chart settings:", data);
            const loadedSettings = data.settings || {}; // API returns settings nested

            const initialQSettings = {};
            // Define current global defaults based on fetched data or initial state constants
            const currentGlobal = {
                chartType: loadedSettings.global?.chartType || 'bar', // Use initial state as ultimate fallback
                chartColor: loadedSettings.global?.chartColor || DEFAULT_CHART_COLOR,
                showPercentages: loadedSettings.global?.showPercentages !== undefined ? loadedSettings.global.showPercentages : true,
                showLegend: loadedSettings.global?.showLegend !== undefined ? loadedSettings.global.showLegend : true,
            };
            // Update global state based on fetched settings
            setGlobalChartType(currentGlobal.chartType);
            setGlobalChartColor(currentGlobal.chartColor);
            setGlobalShowPercentages(currentGlobal.showPercentages);
            setGlobalShowLegend(currentGlobal.showLegend);

            // Initialize question settings using currentSurvey.questions
            if (currentSurvey?.questions) {
                currentSurvey.questions.forEach((q, index) => {
                    const apiSetting = loadedSettings.questions?.[q.id];
                    const defaultType = getDefaultChartType(q.question_type);
                    const normalizedColor = apiSetting?.chartColor || apiSetting?.barColor || currentGlobal.chartColor; // Use current global as fallback

                    initialQSettings[q.id] = {
                        // Prioritize API setting, then default type, then global type
                        chartType: apiSetting?.chartType || defaultType || currentGlobal.chartType,
                        chartColor: normalizedColor,
                        // Prioritize API setting, then global setting
                        showPercentages: apiSetting?.showPercentages !== undefined ? apiSetting.showPercentages : currentGlobal.showPercentages,
                        showLegend: apiSetting?.showLegend !== undefined ? apiSetting.showLegend : currentGlobal.showLegend,
                        customTitle: apiSetting?.customTitle || '',
                        // Merge customColors/optionColors arrays
                        customColors: Array.isArray(apiSetting?.customColors) && apiSetting.customColors.length > 0
                            ? apiSetting.customColors
                            : (Array.isArray(apiSetting?.optionColors) ? apiSetting.optionColors : []), // Fallback to optionColors if array
                        // Prioritize API order, then survey sequence, then index
                        displayOrder: apiSetting?.displayOrder ?? q.sequence_number ?? index + 1,
                        sortByCount: apiSetting?.sortByCount === true
                    };
                });
                 // Merge fetched settings with existing ones to preserve defaults for potentially new questions
                 setQuestionSettings(prev => ({ ...prev, ...initialQSettings }));
                 console.log("Initialized question settings:", initialQSettings);
            }

            // Initialize demographics settings using API data merged with defaults
             if (loadedSettings.demographics) {
                 const updatedDemoSettings = { ...demographicsSettings }; // Start with code defaults
                 Object.entries(loadedSettings.demographics).forEach(([key, demoSettingApi]) => {
                     if (updatedDemoSettings[key]) { // Only update if key exists in our defaults
                         const normalizedDemoColor = demoSettingApi.chartColor || updatedDemoSettings[key].chartColor; // Keep default if API missing
                         updatedDemoSettings[key] = {
                             ...updatedDemoSettings[key], // Keep structure
                             chartType: demoSettingApi.chartType || updatedDemoSettings[key].chartType,
                             chartColor: normalizedDemoColor,
                             showPercentages: demoSettingApi.showPercentages !== undefined ? demoSettingApi.showPercentages : updatedDemoSettings[key].showPercentages,
                             showLegend: demoSettingApi.showLegend !== undefined ? demoSettingApi.showLegend : updatedDemoSettings[key].showLegend,
                             customColors: Array.isArray(demoSettingApi.customColors) ? demoSettingApi.customColors : (updatedDemoSettings[key].customColors || []),
                         };
                     } else {
                        // If the key exists in API but not in our default state, maybe add it?
                        console.warn(`Demographic key '${key}' found in saved settings but not in default state.`);
                        // Optionally add it dynamically:
                        // updatedDemoSettings[key] = { ...demoSettingApi };
                     }
                 });
                 setDemographicsSettings(updatedDemoSettings);
                 console.log("Initialized demographic settings:", updatedDemoSettings);
             } else {
                console.log("No demographic settings found in API response, using defaults.");
             }

        } catch (err) {
            console.error('Error fetching chart settings:', err);
            toast.error('Could not load saved chart settings. Using defaults or local backup.');
            loadSettingsFromLocalStorage(); // Attempt local storage load on API fetch failure
        }
    }, [surveyId, loadSettingsFromLocalStorage, demographicsSettings]); // Include loadSettingsFromLocalStorage


    const fetchDemographicsData = useCallback(async () => {
        console.log("Fetching demographic analytics...");
        if (!surveyId) return;
        try {
            const response = await surveyAPI.getDemographicAnalytics(surveyId, {}); // Pass empty filter
            const data = response.data;
            setDemographicsData(data);
            console.log("Fetched demographic data:", data);

            // Update options state for color pickers based on fetched data
            if (data.demographics) {
                const newDemoOptions = {};
                // Iterate over keys present in the *fetched data* and also in *our settings*
                Object.keys(demographicsSettings).forEach(key => {
                    if (data.demographics[key]) {
                        // Map to { label, count } and sort by count descending
                        newDemoOptions[key] = Object.entries(data.demographics[key])
                            .map(([label, details]) => ({ label, count: details.count ?? 0 }))
                            .sort((a, b) => b.count - a.count);
                    } else {
                        newDemoOptions[key] = []; // Ensure key exists in options even if no data
                    }
                });
                // Update only the 'demographics' part of questionOptions state
                setQuestionOptions(prev => ({ ...prev, demographics: newDemoOptions }));
                console.log("Updated demographic options for UI:", newDemoOptions);
            } else {
                 // Ensure all demo keys exist in options even if no data fetched
                 const emptyDemoOptions = {};
                 Object.keys(demographicsSettings).forEach(key => { emptyDemoOptions[key] = [] });
                 setQuestionOptions(prev => ({ ...prev, demographics: emptyDemoOptions }));
                 console.log("No demographic data found in API response.");
            }
        } catch (err) {
            console.error('Error fetching demographics data:', err);
            toast.error('Could not load demographic analytics data.');
        }
    }, [surveyId, demographicsSettings]); // Use demographicsSettings to iterate keys





        const handleInternalSave = useCallback(async () => {
        console.log("BatchReportCustomization: Preparing settings payload...");
         if (!surveyId) { toast.error("Cannot save settings: Survey ID missing."); return; }

        const settingsPayload = {
             ...currentSettings,
             pdfExportOptions: {
                includeDemographics, showWordCloudData, showOpenEndedResponses, openEndedResponseLimit
             }
        };

        if (!isStandalone && onSaveProp) {
             // Modal Mode: Use the prop callback
             console.log("BatchReportCustomization (Modal): Calling onSave prop.");
             await onSaveProp(settingsPayload);
             // Parent (ReportTabPage) handles loading state, toasts, and closing
        } else {
             // Standalone Mode: Make API call directly
             console.log("BatchReportCustomization (Standalone): Saving settings via API.");
             setLoading(true); // Manage loading state internally
             try {
                 await reportTabAPI.saveReportSettings(surveyId, settingsPayload);
                 setInternalSettings(settingsPayload); // Update internal settings state
                 saveSettingsToLocalStorage(settingsPayload);
                 toast.success('Report settings saved successfully!');
                 // Optionally navigate back or show confirmation
                 // navigate(`/analytics/${surveyId}`); // Example navigation
             } catch (err) {
                 console.error('BatchReportCustomization (Standalone): Error saving settings:', err);
                 setError(`Save Error: ${err.response?.data?.error || err.message}`);
                 toast.error(`Save Error: ${err.response?.data?.error || err.message}`);
             } finally {
                 setLoading(false);
             }
        }

    }, [
        surveyId, currentSettings, isStandalone, onSaveProp, // Include mode flag and prop
        includeDemographics, showWordCloudData, showOpenEndedResponses, openEndedResponseLimit,
        saveSettingsToLocalStorage, // Add other necessary dependencies
        // reportTabAPI, navigate // Include if needed
    ]);



    const fetchQuestionOptions = useCallback(async (questions) => {
        if (!questions || questions.length === 0 || !surveyId) {
           console.log("No questions or surveyId provided to fetch options for.");
           return;
        }
        console.log(`Fetching options/analytics for ${questions.length} questions...`);
        const optionsData = {}; // Start fresh for question options, keep demographics separate
        const promises = [];

        for (const question of questions) {
            // Fetch analytics only for types that have options or distributions suitable for charting/color picking
            const chartableTypes = ['multiple-choice', 'dropdown', 'checkbox', 'single-image-select', 'multiple-image-select', 'scale', 'rating', 'star-rating', 'nps', 'numerical-input'];
            if (chartableTypes.includes(question.question_type) && !question.question_type.includes('grid')) {
                 promises.push(
                     analyticsAPI.getQuestionAnalyticsUnified(surveyId, question.id)
                         .then(response => {
                             const analytics = response.data?.analytics;
                             let distribution = [];
                             if (analytics?.type === 'single_select_distribution' && analytics.options_distribution) {
                                 distribution = analytics.options_distribution;
                             } else if (analytics?.type === 'multi_select_distribution' && analytics.option_distribution) {
                                 distribution = analytics.option_distribution;
                             } else if (analytics?.distribution) { // For slider, rating, numeric etc.
                                distribution = analytics.distribution.map(d => ({ option: d.value, count: d.count })); // Adapt structure
                             } else if (analytics?.type === 'numeric_stats' && question.question_type === 'nps' && analytics.nps_segments) {
                                // Create pseudo-options for NPS segments for color picking
                                const { promoters = 0, passives = 0, detractors = 0 } = analytics.nps_segments;
                                distribution = [
                                    { option: "Promoters (9-10)", count: promoters },
                                    { option: "Passives (7-8)", count: passives },
                                    { option: "Detractors (0-6)", count: detractors },
                                ];
                             }

                             // Store options with counts for UI (color pickers, potential display)
                             // Sort options by count descending for consistent UI order
                             optionsData[question.id] = distribution
                                 .map(item => ({ label: item.option?.toString() ?? 'N/A', count: item.count ?? 0 }))
                                 .sort((a, b) => b.count - a.count);
                         })
                         .catch(err => {
                             console.error(`Error fetching analytics/options for Q ${question.id} (${question.question_text}):`, err);
                             optionsData[question.id] = []; // Ensure key exists even on error
                         })
                 );
             } else {
                // For non-chartable types or grids, ensure the key exists but is empty
                optionsData[question.id] = [];
             }
         }
         await Promise.all(promises);
         // Update only the question parts of the options state, preserving demographics
         setQuestionOptions(prev => ({ ...prev, ...optionsData }));
         console.log("Updated question options for UI:", optionsData);

    }, [surveyId]); // Only surveyId needed


    // --- Save Settings ---
    const saveSettings = useCallback(async () => {
        console.log("Attempting to save settings...");
        if (!surveyId) {
            toast.error("Cannot save settings: Survey ID missing.");
            return false;
        }
        setLoading(true); // Indicate saving process
        try {
            const settingsPayload = {
                global: {
                    chartType: globalChartType,
                    chartColor: globalChartColor,
                    showPercentages: globalShowPercentages,
                    showLegend: globalShowLegend
                },
                // Map questionSettings to the expected API format
                questions: Object.fromEntries(
                    Object.entries(questionSettings).map(([id, config]) => [
                        id,
                        {
                            chartType: config.chartType || 'bar', // Default if missing
                            chartColor: config.chartColor || globalChartColor, // Default if missing
                            showPercentages: config.showPercentages !== undefined ? config.showPercentages : true,
                            showLegend: config.showLegend !== undefined ? config.showLegend : true,
                            customTitle: config.customTitle || '',
                            // Ensure customColors is an array, filter nulls before saving? Or let backend handle?
                            // Let's keep nulls for now, signifies "use default/base color"
                            customColors: Array.isArray(config.customColors) ? config.customColors : [],
                            displayOrder: config.displayOrder ?? null, // Ensure displayOrder is included (use null if undefined/empty)
                            sortByCount: config.sortByCount === true
                        }
                    ])
                ),
                demographics: demographicsSettings, // Send current demographics settings object
            };
            console.log("Saving settings payload:", settingsPayload);
            // Save to API
            await chartAPI.saveChartSettings(surveyId, settingsPayload); // Send the nested structure
            // Also save locally as a backup or for faster reload next time (optional)
            saveSettingsToLocalStorage(settingsPayload);
            toast.success('Chart settings saved successfully!');
            console.log("Settings saved successfully.");
            setError(null); // Clear previous save errors
            return true; // Indicate success

        } catch (err) {
            console.error('Error saving chart settings:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Failed to save settings';
            setError(`Save Error: ${errorMsg}`);
            toast.error(`Save Error: ${errorMsg}`);
            // Even if API save fails, we still saved locally. User might retry.
            return false; // Indicate failure
        } finally {
            setLoading(false);
        }
    }, [surveyId, globalChartType, globalChartColor, globalShowPercentages, globalShowLegend, questionSettings, demographicsSettings, saveSettingsToLocalStorage, globalChartColor]); // Added saveSettingsToLocalStorage


    // --- PDF Generation ---
    const generatePDF = useCallback(async () => {
        if (!survey || !survey.questions || survey.questions.length === 0) {
            toast.error('Survey data or questions not loaded yet. Cannot generate report.');
            return;
        }
        console.log("Starting PDF generation...");
        setGeneratingPdf(true);
        setPdfError(null);
        setPdfProgress(0);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // --- START OF EDIT 2: Ensure instance has autoTable (belt-and-suspenders) ---
        // This ensures the specific `pdf` instance has the method, even if prototype patching failed
        // or if multiple jsPDF versions coexist somehow.
        pdf.autoTable ??= function (opts) { return autoTable(this, opts); };
        // --- END OF EDIT 2 ---

        let yPos = PDF_MARGIN;
        const contentWidth = pdf.internal.pageSize.getWidth() - (PDF_MARGIN * 2);

        // Estimate total steps for progress bar
        const numQuestions = survey.questions.length;
        const numDemographics = includeDemographics ? Object.keys(demographicsSettings).length : 0;
        const totalSteps = 2 + numQuestions + (includeDemographics ? 1 : 0); // Title page, Demographics section, Each Question, Footer
        let currentStep = 0;

        const updateProgress = () => {
            currentStep++;
            setPdfProgress(Math.min(100, (currentStep / totalSteps) * 100));
        };

        try {
            // --- 1. Title Page ---
            console.log("PDF: Adding Title Page");
            pdf.setFontSize(22); pdf.setTextColor(44, 62, 80);
            pdf.text(survey.title || 'Survey Report', pdf.internal.pageSize.getWidth() / 2, yPos + 5, { align: 'center' });
            yPos += 15;
            pdf.setFontSize(12); pdf.setTextColor(100, 100, 100);
            pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pdf.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
            yPos += 15;
            if (survey.description) {
                pdf.setFontSize(12); pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'italic'); // Use italics for description
                yPos = addWrappedText(pdf, survey.description, PDF_MARGIN, yPos, contentWidth, 5);
                pdf.setFont('helvetica', 'normal'); // Reset font style
                yPos += 10;
            }
            updateProgress(); // Progress after title page

            // --- 2. Demographics Section ---
            if (includeDemographics && demographicsData?.demographics && Object.keys(demographicsData.demographics).length > 0) {
                console.log("PDF: Adding Demographics Section");
                 let addedDemoPage = false; // Flag to track if demographics page was added

                const demographicCategories = Object.keys(demographicsSettings)
                    .filter(key => demographicsData.demographics[key] && Object.keys(demographicsData.demographics[key]).length > 0); // Filter keys with actual data

                 if (demographicCategories.length > 0) {
                    pdf.addPage(); yPos = PDF_MARGIN; addedDemoPage = true;
                    pdf.setFontSize(16); pdf.setTextColor(44, 62, 80);
                    pdf.text("Demographics Overview", PDF_MARGIN, yPos); yPos += 12;
                 }

                for (const key of demographicCategories) {
                    const categoryAnalytics = demographicsData.demographics[key];
                    const chartSetting = demographicsSettings[key]; // Get settings for this category
                    const categoryTitle = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Format title

                    // Prepare data for chart - limit entries for busy charts like locations
                    const dataEntries = Object.entries(categoryAnalytics).sort((a, b) => b[1].count - a[1].count);
                    const limit = (key === 'locations' || key === 'companies' || key === 'custom_field_1') ? 10 : dataEntries.length; // Example limit
                    const limitedData = dataEntries.slice(0, limit);

                    if (limitedData.length === 0) continue; // Skip if no data after limiting

                    const labels = limitedData.map(item => item[0] || 'N/A');
                    const counts = limitedData.map(item => item[1].count ?? 0);
                    const totalCount = counts.reduce((sum, c) => sum + c, 0);
                    const percentages = counts.map(c => totalCount > 0 ? (c / totalCount) * 100 : 0);
                    const values = chartSetting.showPercentages ? percentages : counts;

                     // Get colors using the same logic as questions
                    const getDemoBackgroundColors = (count) => {
                         const custom = (chartSetting.customColors || []).filter(c => c); // Use defined colors
                         if (custom.length >= count) return custom.slice(0, count);
                         if (custom.length > 0) return Array.from({ length: count }, (_, i) => custom[i % custom.length]);
                         if (count === 1) return [chartSetting.chartColor || DEFAULT_CHART_COLOR];
                         return generateDefaultColors(count);
                    };
                    const backgroundColors = getDemoBackgroundColors(labels.length);

                    const chartData = {
                        labels,
                        datasets: [{
                            label: categoryTitle, // Use category title as dataset label
                            data: values,
                            backgroundColor: backgroundColors,
                            counts: counts, // Store raw data
                            percentages: percentages // Store raw data
                         }]
                    };
                    // Pass minimal info mimicking question analytics structure for options function
                    const pseudoAnalytics = { question_text: categoryTitle };
                    const chartOptions = getChartOptionsForPdf(pseudoAnalytics, chartSetting, labels); // Pass labels

                    // Determine chart type (handle horizontal bar case for Chart.js v3+)
                    let finalChartType = chartSetting.chartType || 'bar';
                    if (finalChartType === 'horizontalBar') {
                       finalChartType = 'bar';
                       chartOptions.indexAxis = 'y'; // Set horizontal orientation in options
                    } else {
                        chartOptions.indexAxis = 'x'; // Explicitly vertical
                    }

                    // Add chart image
                    try {
                        const chartHeightInPdf = 80; // Adjust height as needed
                        const chartWidthInPdf = contentWidth * 0.8; // Adjust width as needed
                        yPos = checkPageBreak(pdf, yPos, chartHeightInPdf + 15); // Check space + title padding
                        // Add category title before chart
                        pdf.setFontSize(11); pdf.setTextColor(60, 60, 60);
                        pdf.text(categoryTitle, PDF_MARGIN, yPos); yPos += 6;

                        const chartImage = await createChartImage({ type: finalChartType, data: chartData, options: chartOptions, width: 800, height: 500 }); // Specify render size
                        pdf.addImage(chartImage, 'PNG', PDF_MARGIN, yPos, chartWidthInPdf, chartHeightInPdf);
                        yPos += chartHeightInPdf + 15; // Add padding after chart
                    } catch (chartErr) {
                        console.error(`Error generating chart image for demographic '${key}':`, chartErr);
                        yPos = checkPageBreak(pdf, yPos, 10);
                        pdf.setTextColor(255, 0, 0);
                        yPos = addWrappedText(pdf, `Error rendering chart for ${categoryTitle}`, PDF_MARGIN, yPos, contentWidth, 5);
                        pdf.setTextColor(0, 0, 0); // Reset color
                        yPos += 5;
                    }
                } // End loop through demographic categories
                 if (addedDemoPage || demographicCategories.length > 0) {
                    updateProgress(); // Progress after demographics section if it was added/attempted
                 }
            } else if (includeDemographics) {
                 console.log("PDF: Skipping Demographics Section (no data or disabled)");
                 updateProgress(); // Still count the step even if skipped
            }


            // --- 3. Questions Section ---
            console.log("PDF: Adding Questions Section");
            // Sort questions based on displayOrder from settings
            const sortedQuestions = [...survey.questions].sort((a, b) => {
                const orderA = questionSettings[a.id]?.displayOrder ?? a.sequence_number ?? 9999; // Default large number
                const orderB = questionSettings[b.id]?.displayOrder ?? b.sequence_number ?? 9999;
                return orderA - orderB;
            });

            for (let i = 0; i < sortedQuestions.length; i++) {
                const question = sortedQuestions[i];
                const questionSetting = questionSettings[question.id] || {}; // Get settings or empty object
                const questionNum = i + 1; // Use sorted index for Q number

                console.log(`PDF: Processing Q${questionNum} (${question.id}): ${question.question_text}`);
                // Start each question on a new page for clarity
                // Add page *unless* it's the first question AND no demographics page was added
                 if (i > 0 || (i === 0 && includeDemographics && demographicsData?.demographics && Object.keys(demographicsData.demographics).length > 0 && Object.keys(demographicsSettings).some(key => demographicsData.demographics[key] && Object.keys(demographicsData.demographics[key]).length > 0))) {
                    pdf.addPage();
                }
                 yPos = PDF_MARGIN; // Reset Y pos for new page or after title

                // --- Question Header ---
                pdf.setFillColor(245, 245, 245); // Light grey background for header
                pdf.rect(PDF_MARGIN, yPos, contentWidth, 10, 'F');
                pdf.setFontSize(14); pdf.setTextColor(44, 62, 80); pdf.setFont('helvetica', 'bold');
                const qHeaderText = `Q${questionNum}: ${questionSetting.customTitle || question.question_text}`;
                // AddWrappedText handles potential wrapping for long titles
                yPos = addWrappedText(pdf, qHeaderText, PDF_MARGIN + 2, yPos + 7, contentWidth - 4, 6) - 7; // Calculate position carefully
                yPos += 12; // Space after header box
                pdf.setFont('helvetica', 'normal'); // Reset font

                pdf.setFontSize(11); pdf.setTextColor(80, 80, 80);
                yPos = addWrappedText(pdf, `Type: ${question.question_type}`, PDF_MARGIN, yPos, contentWidth, 4);
                yPos += 6; // Space after type

                // --- Fetch Analytics for this question ---
                let analytics = null;
                let fetchError = null;
                try {
                    const analyticsResponse = await analyticsAPI.getQuestionAnalyticsUnified(surveyId, question.id);
                    analytics = analyticsResponse.data;
                    console.log(`PDF: Fetched analytics for Q${questionNum}`, analytics);
                } catch (err) {
                    console.error(`Error fetching analytics for Q${question.id}:`, err);
                    fetchError = err.message || 'Failed to load analytics data.';
                }

                // --- Render Content based on type ---
                if (analytics && analytics.analytics) {
                    // Attempt to generate and add Chart if applicable
                    const chartableTypes = ['multiple-choice', 'dropdown', 'single-image-select', 'checkbox', 'multiple-image-select', 'scale', 'rating', 'star-rating', 'nps', 'numerical-input']; // Exclude grids
                    if (chartableTypes.includes(question.question_type)) {
                         try {
                             const preparedChartData = prepareChartDataForPdf(analytics, questionSetting);
                             if (preparedChartData && preparedChartData.labels.length > 0) {
                                 const chartOptions = getChartOptionsForPdf(analytics, questionSetting, preparedChartData.labels); // Pass labels
                                 let finalChartType = questionSetting.chartType || getDefaultChartType(question.question_type);
                                 if (finalChartType === 'horizontalBar') {
                                     finalChartType = 'bar';
                                     chartOptions.indexAxis = 'y';
                                 } else {
                                     chartOptions.indexAxis = 'x';
                                 }

                                 const chartHeightInPdf = 80; // Adjust as needed
                                 const chartWidthInPdf = contentWidth * 0.9; // Adjust as needed
                                 yPos = checkPageBreak(pdf, yPos, chartHeightInPdf + 5); // Check space

                                 console.log(`PDF: Generating chart for Q${questionNum} - Type: ${finalChartType}`);
                                 const chartImage = await createChartImage({ type: finalChartType, data: preparedChartData, options: chartOptions, width: 800, height: 500 });
                                 pdf.addImage(chartImage, 'PNG', PDF_MARGIN + (contentWidth - chartWidthInPdf)/2, yPos, chartWidthInPdf, chartHeightInPdf); // Center chart
                                 yPos += chartHeightInPdf + 10; // Space after chart
                                 console.log(`PDF: Added chart for Q${questionNum}`);
                             } else {
                                console.log(`PDF: No chart data prepared for Q${questionNum}`);
                             }
                         } catch (chartErr) {
                             console.error(`Error generating chart image for Q${questionNum} (${question.id}):`, chartErr);
                             yPos = checkPageBreak(pdf, yPos, 10);
                             pdf.setTextColor(255, 0, 0);
                             yPos = addWrappedText(pdf, 'Error rendering chart for this question.', PDF_MARGIN, yPos, contentWidth, 5);
                             pdf.setTextColor(0, 0, 0); // Reset color
                             yPos += 5;
                         }
                    }

                    // Render Tables or Text Responses using AutoTable helpers or text functions
                    yPos = checkPageBreak(pdf, yPos, 30); // Ensure space before tables/text
                    if (question.question_type.includes('grid')) {
                        console.log(`PDF: Rendering Grid Table for Q${questionNum}`);
                        yPos = renderGridTableForPdf(pdf, analytics.analytics.grid_data, question.question_type, yPos, PDF_MARGIN, contentWidth);
                    } else if (question.question_type === 'open-ended' || question.question_type === 'text-input') {
                        console.log(`PDF: Rendering Open Ended Data for Q${questionNum}`);
                        yPos = renderOpenEndedForPdf(pdf, analytics, yPos, PDF_MARGIN, contentWidth, showWordCloudData, showOpenEndedResponses, openEndedResponseLimit);
                    } else {
                        // Render standard stats/distribution table for most other types
                        console.log(`PDF: Rendering Statistics Table for Q${questionNum}`);
                        yPos = renderStatisticsTableForPdf(pdf, analytics, questionSetting, yPos, PDF_MARGIN, contentWidth);
                    }
                } else {
                     // Handle case where analytics fetch failed or returned no data
                    console.log(`PDF: No analytics data available for Q${questionNum}`);
                    yPos = checkPageBreak(pdf, yPos, 10);
                    pdf.setFontSize(12);
                    pdf.setTextColor(150, 0, 0); // Error color
                    const errorText = fetchError ? `Analytics Error: ${fetchError}` : 'No analytics data available for this question.';
                    yPos = addWrappedText(pdf, errorText, PDF_MARGIN, yPos, contentWidth, 5);
                    pdf.setTextColor(0, 0, 0); // Reset color
                    yPos += 5;
                }
                updateProgress(); // Progress after each question
            } // End loop through questions


            // --- 4. Footer with Page Numbers ---
            console.log("PDF: Adding Footers");
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(11);
                pdf.setTextColor(150, 150, 150);
                // Page number on the right
                pdf.text(`Page ${i} of ${pageCount}`, pdf.internal.pageSize.getWidth() - PDF_MARGIN, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
                // Survey title on the left
                pdf.text(`${survey.title || 'Survey Report'}`, PDF_MARGIN, pdf.internal.pageSize.getHeight() - 10);
            }
            updateProgress(); // Final progress step

            // --- 5. Save the PDF ---
            const filename = `${survey.title || 'survey'}_custom_report_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            console.log(`PDF generated and saved as ${filename}`);
            toast.success('PDF Report generated successfully!');
            setPdfProgress(100); // Ensure it reaches 100

        } catch (err) {
            console.error('Error during PDF generation process:', err);
            setPdfError(`PDF Generation Failed: ${err.message}`);
            toast.error(`PDF Generation Failed: ${err.message}`);
        } finally {
            setGeneratingPdf(false); // Turn off loading state regardless of success/failure
            console.log("PDF generation process finished.");
        }

    }, [
        surveyId, survey, demographicsData, questionSettings, demographicsSettings,
        includeDemographics, showWordCloudData, showOpenEndedResponses, openEndedResponseLimit,
        // No need to include helper functions like render*, checkPageBreak etc. if they don't use component state/props directly
    ]); // Dependencies


    // --- Event Handlers for UI ---
    const handleGenerateReport = async () => {
        // Save settings *before* generating PDF to ensure consistency
        toast.loading('Saving settings before generating report...');
        const saved = await saveSettings();
        toast.dismiss(); // Dismiss loading toast
        if (saved) {
            generatePDF(); // Call the PDF generation logic
        } else {
            toast.error("Settings could not be saved. PDF generation cancelled.");
        }
    };

    // Update settings for a specific question
    const updateQuestionSetting = useCallback((questionId, field, value) => {
        setCurrentSettings(prev => {
             const currentQSettings = prev.questions?.[questionId] || {};
             let finalValue = value;
             // Coerce boolean values robustly
             if (['isHidden', 'showStatsTable', 'showResponseDist', 'showWordCloud', 'showDropdownResponses', 'showNA', 'showThumbnails', 'showPercentages', 'showLegend', 'sortByCount'].includes(field)) {
                 finalValue = value === true || String(value).toLowerCase() === 'true';
             }
             // Handle displayOrder parsing
             if (field === 'displayOrder') {
                 const parsed = parseInt(value, 10);
                 // Revert to current setting if invalid, null if empty, otherwise use parsed number
                 finalValue = value === '' ? null : (isNaN(parsed) || parsed < 1 ? currentQSettings.displayOrder : parsed);
             }

             return {
                 ...prev,
                 questions: {
                     ...prev.questions,
                     [questionId]: {
                         ...currentQSettings,
                         [field]: finalValue
                     }
                 }
             };
         });
     }, []);

    // Update settings for a demographic category
    const updateDemographicSetting = useCallback((category, field, value) => {
        setDemographicsSettings(prev => ({
            ...prev,
            [category]: {
                ...(prev[category] || {}), // Ensure category settings object exists
                [field]: value
            }
        }));
    }, []);

    // Update color for a specific option in a question
    const updateOptionColor = useCallback((questionId, optionIndex, color) => {
        setQuestionSettings(prev => {
            const question = prev[questionId] || {};
            const currentColors = question.customColors || [];
            const newColors = [...currentColors]; // Create a mutable copy

            // Pad the array with null/undefined or a default if the index is out of bounds
             // This ensures the array length matches the option index + 1
             while (newColors.length <= optionIndex) {
                 // You could use null, or the question's base color, or global color
                 newColors.push(null); // Using null signifies "use default/base color"
             }
             newColors[optionIndex] = color;

            return { ...prev, [questionId]: { ...question, customColors: newColors } };
        });
    }, []); // No dependencies needed if it only operates on previous state

    // Update color for a demographic option
    const updateDemographicOptionColor = useCallback((category, optionIndex, color) => {
        setDemographicsSettings(prev => {
            const categorySettings = prev[category] || {};
            const currentColors = categorySettings.customColors || [];
            const newColors = [...currentColors];

            while (newColors.length <= optionIndex) {
                newColors.push(null); // Pad with null
            }
            newColors[optionIndex] = color;

            return { ...prev, [category]: { ...categorySettings, customColors: newColors } };
        });
    }, []);

    // Update question display order (ensuring positive integer)
    const updateQuestionDisplayOrder = useCallback((questionId, newOrderStr) => {
        const newOrder = parseInt(newOrderStr, 10);
        // Allow empty string or positive numbers, reject negatives/zero/NaN
        if (newOrderStr === '' || (!isNaN(newOrder) && newOrder >= 1)) {
            setQuestionSettings(prev => ({
                ...prev,
                [questionId]: {
                    ...(prev[questionId] || {}),
                    displayOrder: newOrderStr === '' ? null : newOrder // Store null if empty, number otherwise
                }
            }));
        } else if (newOrderStr !== '') { // Only show error if input is invalid, not just empty
            toast.error("Display order must be a positive number (e.g., 1, 2, 3...).");
            // Optionally revert input or keep invalid state temporarily
        }
    }, []);

    // Apply global settings to all questions and demographics
    const applyGlobalSettings = useCallback(() => {
        const confirmed = window.confirm("Apply current global settings (Type, Color, %, Legend) to ALL questions and demographics? This will overwrite individual settings.");
        if (!confirmed) return;

        console.log("Applying global settings to all...");
        // Apply to Questions
        setQuestionSettings(prevQSettings => {
             const updatedQSettings = {};
             // Ensure we iterate over keys derived from the *survey* questions, not just current state keys
             // This handles cases where state might not yet be populated for all questions
             survey?.questions?.forEach(q => {
                 const qId = q.id;
                 updatedQSettings[qId] = {
                     ...(prevQSettings[qId] || {}), // Keep existing customTitle, customColors, displayOrder
                     chartType: globalChartType, // Overwrite
                     chartColor: globalChartColor, // Overwrite
                     showPercentages: globalShowPercentages, // Overwrite
                     showLegend: globalShowLegend // Overwrite
                 };
             });
             return updatedQSettings;
        });

        // Apply to Demographics
        setDemographicsSettings(prevDemoSettings => {
            const updatedDemoSettings = {};
            Object.keys(prevDemoSettings).forEach(key => {
                 updatedDemoSettings[key] = {
                     ...(prevDemoSettings[key] || {}), // Keep existing customColors if any
                     // Decide whether to apply global chartType to demos. Let's apply color, %, legend but maybe keep demo types specific?
                     // chartType: globalChartType, // Uncomment to apply global type too
                     chartColor: globalChartColor, // Apply global color
                     showPercentages: globalShowPercentages,
                     showLegend: globalShowLegend
                 };
             });
             return updatedDemoSettings;
        });

        toast.success("Global settings applied to all!");
    }, [globalChartType, globalChartColor, globalShowPercentages, globalShowLegend, survey?.questions]); // Add survey.questions dependency


    // --- Render Logic ---

    // Sort questions based on displayOrder for the UI rendering
    const sortedQuestionsForUI = useMemo(() => (survey?.questions || [])
        .sort((a, b) => {
           const orderA = editableSettings.questions?.[a.id]?.displayOrder ?? a.report_sequence ?? a.sequence_number ?? 9999;
            const orderB = editableSettings.questions?.[b.id]?.displayOrder ?? b.report_sequence ?? b.sequence_number ?? 9999;
            return orderA - orderB;
          }), [survey?.questions, editableSettings.questions]);

    if (loading && !survey) { // Show loading indicator only on initial load
        return <div className="loading-indicator">Loading report settings...</div>;
    }

    if (error && !survey) { // Show fatal error if survey couldn't load
        return <div className="error-message">Error loading survey data: {error}</div>;
    }

     if (!survey) { // Should not happen if loading/error handled, but as a fallback
        return <div className="error-message">Survey data could not be loaded.</div>;
    }

    // Main component return JSX
    return (
        <div className="analytics-panel-container demographics-summary-page">
        <div className="batch-report-customization-container" style={styles.container}>
            <div className="header-row">
                <h2>Customize Report for: {survey.title}</h2>
                <button
                    onClick={handleGenerateReport}
                    disabled={loading || generatingPdf}
                    className="nawabutton"
                >
                    <i className="ri-download-2-line" style={{ marginRight: '8px' }}></i>
                    {generatingPdf ? `Generating PDF (${pdfProgress.toFixed(0)}%)...` : 'Export'}
                </button>
            </div>

            {error && <p style={styles.errorText}>Warning: {error}</p>}

            {/* Settings Buttons */}
           

            {/* Action Buttons - Only show when a section is active */}
            {activeSection && (
                <div className="action-buttons">
                    <button 
                        onClick={handleInternalSave} 
                        className="batch-btn warm"
                        disabled={loading || generatingPdf}
                    >
                        <i className="ri-save-line" style={{ marginRight: '8px' }}></i>
                        Save Settings
                    </button>
                    <button 
                        onClick={() => setActiveSection(null)} 
                        className="batch-btn"
                        disabled={loading || generatingPdf}
                    >
                        <i className="ri-arrow-left-line" style={{ marginRight: '8px' }}></i>
                        Back to Menu
                    </button>
                </div>
            )}

            {/* PDF Export Options Section */}
            {activeSection === 'pdf' && (
                <div className="settings-section">
                    <h3 style={styles.sectionTitle}>PDF Export Options</h3>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            <input
                                type="checkbox"
                                checked={includeDemographics}
                                onChange={(e) => setIncludeDemographics(e.target.checked)}
                            /> Include Demographics Section
                        </label>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            <input
                                type="checkbox"
                                checked={showWordCloudData}
                                onChange={(e) => setShowWordCloudData(e.target.checked)}
                            /> Show Top Words Table (Open-Ended)
                        </label>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            <input
                                type="checkbox"
                                checked={showOpenEndedResponses}
                                onChange={(e) => setShowOpenEndedResponses(e.target.checked)}
                            /> Show Recent Responses List (Open-Ended)
                        </label>
                    </div>
                    {showOpenEndedResponses && (
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="openEndedLimit">Limit Responses to Show:</label>
                            <input
                                type="number"
                                id="openEndedLimit"
                                style={styles.input}
                                value={openEndedResponseLimit}
                                onChange={(e) => setOpenEndedResponseLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                min="0"
                                step="1"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Global Settings Section */}
            {activeSection === 'global' && (
                <div className="settings-section">
                    <h3 style={styles.sectionTitle}>Global Chart Settings</h3>
                    <div style={styles.grid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="globalChartType">Default Chart Type:</label>
                            <select id="globalChartType" style={styles.select} value={globalChartType} onChange={(e) => setGlobalChartType(e.target.value)}>
                                <option value="bar">Bar</option>
                                <option value="pie">Pie</option>
                                <option value="doughnut">Doughnut</option>
                                <option value="line">Line</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="globalChartColor">Default Base Color:</label>
                            <input id="globalChartColor" type="color" style={styles.colorInput} value={globalChartColor} onChange={(e) => setGlobalChartColor(e.target.value)} />
                            <span>{globalChartColor}</span>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>
                                <input type="checkbox" checked={globalShowPercentages} onChange={(e) => setGlobalShowPercentages(e.target.checked)} /> Show Percentages
                            </label>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>
                                <input type="checkbox" checked={globalShowLegend} onChange={(e) => setGlobalShowLegend(e.target.checked)} /> Show Legend
                            </label>
                        </div>
                    </div>
                    <div className="button-align-right">
                        <button
                            onClick={applyGlobalSettings}
                            className="batch-btn warm"
                            disabled={loading || generatingPdf}
                        >
                            <i className="ri-equalizer-line" style={{ marginRight: '8px' }}></i>
                            Apply Global Settings to All
                        </button>
                    </div>
                </div>
            )}

            {/* Demographics Settings Section */}
            {activeSection === 'demographics' && (
                <div className="settings-section">
                    <h3 style={styles.sectionTitle}>Demographics Settings</h3>
                    {Object.keys(demographicsSettings).length > 0 ? (
                        <div style={styles.grid}>
                            {Object.entries(demographicsSettings).map(([key, settings]) => {
                                const categoryTitle = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                const demoOptions = questionOptions.demographics?.[key] || [];

                                return (
                                    <div key={key} style={styles.itemCard}>
                                        <h4 style={styles.itemTitle}>{categoryTitle}</h4>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label} htmlFor={`demoChartType-${key}`}>Chart Type:</label>
                                            <select id={`demoChartType-${key}`} style={styles.select} value={settings.chartType || 'bar'} onChange={(e) => updateDemographicSetting(key, 'chartType', e.target.value)}>
                                                <option value="bar">Bar</option>
                                                <option value="pie">Pie</option>
                                                <option value="doughnut">Doughnut</option>
                                                <option value="line">Line</option>
                                            </select>
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label} htmlFor={`demoChartColor-${key}`}>Base Color:</label>
                                            <input id={`demoChartColor-${key}`} type="color" style={styles.colorInput} value={settings.chartColor || DEFAULT_CHART_COLOR} onChange={(e) => updateDemographicSetting(key, 'chartColor', e.target.value)} />
                                        </div>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>
                                                <input type="checkbox" checked={settings.showPercentages !== undefined ? settings.showPercentages : true} onChange={(e) => updateDemographicSetting(key, 'showPercentages', e.target.checked)} /> Show Percentage
                                            </label>
                                            <label style={styles.label}>
                                                <input type="checkbox" checked={settings.showLegend !== undefined ? settings.showLegend : true} onChange={(e) => updateDemographicSetting(key, 'showLegend', e.target.checked)} /> Show Legend
                                            </label>
                                        </div>
                                        {demoOptions.length > 0 && (settings.chartType === 'pie' || settings.chartType === 'doughnut' || settings.chartType === 'bar') && (
                                            <div style={styles.optionColorSection}>
                                                <h5>Option Colors:</h5>
                                                {demoOptions.map((option, index) => (
                                                    <div key={`${key}-${index}`} style={styles.optionColorItem}>
                                                        <input
                                                            type="color"
                                                            style={styles.colorInputSmall}
                                                            value={settings.customColors?.[index] || settings.chartColor || DEFAULT_CHART_COLOR}
                                                            onChange={(e) => updateDemographicOptionColor(key, index, e.target.value)}
                                                        />
                                                        <span style={styles.optionLabel}>{option.label} ({option.count})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p>No demographic categories configured.</p>
                    )}
                </div>
            )}
        </div>
        </div>
    );
};


// Basic Inline Styles (Consider moving to a CSS file for larger applications)
const styles = {    container: { fontFamily: 'Arial, sans-serif' },
    section: { marginBottom: '30px', padding: '20px', border: '1px solid #eee', borderRadius: '8px', background: '#f9f9f9' },
    sectionTitle: { marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '10px', color: '#333' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '15px' },
    itemCard: { border: '1px solid #e0e0e0', borderRadius: '5px', padding: '15px', background: '#fff' },
    questionItemCard: { marginBottom: '15px' },
    itemTitle: { marginTop: '0', marginBottom: '10px', fontSize: '1.1em', color: '#444' },
    questionTypeLabel: { fontSize: '0.8em', color: '#777', display: 'block', marginBottom: '10px' },
    formGroup: { marginBottom: '10px' },
    label: { display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#555', marginRight: '10px' },
    input: { width: '95%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    inputSmall: { width: '80px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    select: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    colorInput: { verticalAlign: 'middle', marginRight: '5px', width: '40px', height: '25px', border: '1px solid #ccc', padding: '1px', cursor: 'pointer' },
    colorInputSmall: { verticalAlign: 'middle', marginRight: '5px', width: '25px', height: '20px', border: '1px solid #ccc', padding: '1px', cursor: 'pointer' },
    optionColorSection: { marginTop: '15px', borderTop: '1px dashed #eee', paddingTop: '10px' },
    optionColorItem: { display: 'flex', alignItems: 'center', marginBottom: '5px' },
    optionLabel: { fontSize: '0.85em', color: '#666', marginLeft: '5px' },
    actions: { marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' },
    button: { padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em' },
    buttonPrimary: { background: '#007bff', color: '#fff' },
    buttonSecondary: { background: '#6c757d', color: '#fff' },
    buttonDanger: { background: '#dc3545', color: '#fff' },
    infoText: { fontSize: '0.9em', color: '#666', fontStyle: 'italic', marginTop: '10px' },
    errorText: { color: 'red', fontWeight: 'bold', marginBottom: '15px' },
    // PDF Progress Overlay Styles
    pdfOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    pdfModal: { background: '#fff', padding: '30px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', minWidth: '300px' },
    progressBarContainer: { background: '#e0e0e0', borderRadius: '4px', height: '20px', overflow: 'hidden', margin: '15px 0' },
    progressBar: { background: '#aa2eff', height: '100%', transition: 'width 0.3s ease-in-out' },
    progressText: { margin: '10px 0 0 0', fontWeight: 'bold', fontFamily: 'Poppins', sanserif: 'sans-serif', fontSize: '0.8em' },
    pdfError: { color: 'red', marginTop: '10px', fontSize: '0.9em' },
};


export default BatchReportCustomization;