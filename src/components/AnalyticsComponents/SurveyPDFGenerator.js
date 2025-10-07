// src/components/SurveyPDFGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createChartImage } from './exportChart'; // Adjust path if needed

// --- jsPDF-AutoTable v4 compatibility shim ---
jsPDF.API.autoTable ??= function (opts) { return autoTable(this, opts); };

// --- Constants and Helpers --- (Keep existing: PDF_MARGIN, DEFAULT_CHART_COLOR, DEFAULT_PALETTE, EXCLUDED_ANALYSIS_TYPES, formatTime, generateColors, getDefaultChartType)
const PDF_MARGIN = 20; // Increased from 15 for better spacing
const DEFAULT_CHART_COLOR = '#36A2EB'; // A default base color
const DEFAULT_PALETTE = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    "#E7E9ED", "#8A8A8A", "#F7464A", "#46BFBD", "#FDB45C", "#949FB1"
]; // Basic palette
// Updated Excluded Types to match ReportTabPage and exclude text/media by default
const EXCLUDED_ANALYSIS_TYPES = new Set(['document-upload', 'signature', 'date-picker', 'email-input', 'content-text', 'content-media']);

const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0) return 'N/A';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
};

const generateColors = (count, baseColor, customColors = []) => {
    const definedCustom = (customColors || []).filter(c => c && typeof c === 'string'); // Filter out null/empty
    if (definedCustom.length >= count) return definedCustom.slice(0, count);
    if (definedCustom.length > 0) {
        return Array.from({ length: count }, (_, i) => definedCustom[i % definedCustom.length]);
    }
    if (count === 1) return [baseColor || DEFAULT_CHART_COLOR];
    return Array.from({ length: count }, (_, i) => DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
};

// Default Chart Type Helper (keep existing)
const getDefaultChartType = (questionType) => {
    switch (questionType) {
        case 'multiple-choice': case 'dropdown': case 'scale': case 'single-image-select': return 'pie';
        case 'checkbox': case 'rating': case 'star-rating': case 'nps': case 'numerical-input': case 'multiple-image-select': return 'bar';
        default: return 'bar';
    }
};


class SurveyPDFGenerator {
    constructor() {
        this.doc = null;
        this.yPos = PDF_MARGIN;
        this.pageWidth = 0;
        this.pageHeight = 0;
        this.contentWidth = 0;
        this.updateProgress = () => {};
        this.currentPage = 1;
        this.totalPages = 1;
        this.surveyTitle = 'Survey Report';
        // --- NEW: Store settings and context ---
        this.survey = null;
        this.reportSettings = null; // Will hold the full settings object
        this.exportOptions = null; // Derived from reportSettings.pdfExportOptions
        this.filterState = null;
        this.comparisonState = null;
        this.isIncludeAll = true;
        this.isComparisonActive = false;
        this.comparisonData = null; // Store comparison data if active
        // --- End NEW ---
    }

    // --- Helper: Check Page Break --- (Enhanced for better layout)
    checkPageBreak(requiredSpace = 40) { // Increased default space requirement
        if (this.yPos + requiredSpace > this.pageHeight - (PDF_MARGIN + 10)) { // More conservative margin
            this.doc.addPage();
            this.currentPage++;
            this.yPos = PDF_MARGIN + 5; // Small top margin on new pages
            if (this.currentPage > this.totalPages) this.totalPages = this.currentPage;
            // Optional: Redraw headers/footers on new page here if needed
            // this.addPageHeader();
            return true;
        }
        return false;
    }

    // --- Helper: Add Final Page Numbers --- (Keep existing)
    addPageNumbers() {
        const pageCount = this.doc.internal.getNumberOfPages();
        this.totalPages = pageCount;
        for (let i = 1; i <= pageCount; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(11);
            this.doc.setTextColor(120, 120, 120);
            const pageNumText = `Page ${i} of ${pageCount}`;
            const footerY = this.pageHeight - 8;
            this.doc.text(pageNumText, this.pageWidth - PDF_MARGIN, footerY, { align: 'right' });
            const title = this.surveyTitle || 'Survey Report';
            const truncatedTitle = title.length > 70 ? title.substring(0, 67) + '...' : title;
            this.doc.text(truncatedTitle, PDF_MARGIN, footerY);
        }
    }

    // --- Text Wrapping Helper --- (Keep existing)
    addWrappedText(text, x, y, maxWidth, lineHeight = 5, options = {}) {
        if (!text || typeof text !== 'string') {
             console.warn("addWrappedText called with invalid text:", text);
             return y; // Return original y if no text
        }
        const { fontSize = 10, fontStyle = 'normal', color = [0, 0, 0] } = options;
        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', fontStyle);
        this.doc.setTextColor(color[0], color[1], color[2]);
        let currentY = y; // Use local variable for calculation

        try {
            const lines = this.doc.splitTextToSize(text, maxWidth);
            const textHeight = lines.length * lineHeight * 1.15; // Approximate height

            // Check BEFORE adding text
            if (this.checkPageBreak(textHeight)) {
                 currentY = this.yPos; // Update Y if page break occurred
            }

            this.doc.text(lines, x, currentY, { lineHeightFactor: 1.15 });
            this.yPos = currentY + textHeight; // Update global yPos AFTER adding text

            return this.yPos; // Return the new global position
        } catch (e) {
            console.error("Error splitting text:", text, e);
            this.doc.text(text, x, currentY); // Fallback
            this.yPos = currentY + lineHeight;
            return this.yPos;
        }
    }

    // --- Draw Stars Helper --- (Keep existing)
    drawStars(x, y, rating, maxRating = 5, size = 3) {
        const ratingNum = Number(rating) || 0;
        if (ratingNum < 0 || ratingNum > maxRating) return;
        const fullStars = Math.floor(ratingNum);
        const partialStar = ratingNum % 1;
        const starColor = '#fadb14'; // Use a typical star color
        const emptyColor = '#d0d0d0'; // Lighter grey for empty
        let currentX = x;
        const starPoints = [
            [0,-1],[0.22,-0.31],[0.95,-0.31],[0.36,0.11],[0.59,0.81],[0,0.38],[-0.59,0.81],[-0.36,0.11],[-0.95,-0.31],[-0.22,-0.31]
        ];

        for (let i = 0; i < maxRating; i++) {
            const starPath = starPoints.map(p => [(p[0] * size) + currentX, (p[1] * size) + y]);
            // Draw empty star outline first
            this.doc.setDrawColor(emptyColor); this.doc.setFillColor(emptyColor);
            this.doc.lines(starPath, 0, 0, [1, 1], 'D');
            if (i < fullStars) { // Full star
                this.doc.setDrawColor(starColor); this.doc.setFillColor(starColor);
                this.doc.lines(starPath, 0, 0, [1, 1], 'FD');
            } else if (i === fullStars && partialStar > 0.05) { // Partial star
                this.doc.saveGraphicsState();
                const clipWidth = size * 2 * partialStar;
                this.doc.rect(currentX - size, y - size, clipWidth, size * 2, 'clip');
                this.doc.setDrawColor(starColor); this.doc.setFillColor(starColor);
                this.doc.lines(starPath, 0, 0, [1, 1], 'FD');
                this.doc.restoreGraphicsState();
            }
            currentX += size * 2.5;
        }
    }


    // --- UPDATED: Chart Data Preparation ---
    /**
     * Prepares data for PDF charts based on analytics and settings.
     * @param {object} analytics - The full analytics object for a question or demographic category.
     * @param {object} settings - The specific settings object for this item (e.g., reportSettings.questions[qId] or reportSettings.demographics[key]).
     * @returns {object|null} Chart.js data object or null.
     */
    prepareChartDataForPdf(analytics, settings) {
        // Use analytics.analytics if present (question structure), otherwise use analytics directly (demographics structure)
        const data = analytics?.analytics ?? analytics; // Handle both questions and direct demo data
        const questionType = analytics?.question_type; // May be undefined for demographics
        const categoryKey = analytics?.category_key; // Identifier for demographics if needed

        if (!data) {
            console.warn("PDF Chart Prep: Missing analytics data.");
            return null;
        }

        // Get settings, providing defaults if a key is missing in the settings object
        const showNA = settings?.showNA !== undefined ? settings.showNA : true;
        const showPercentages = settings?.showPercentages !== undefined ? settings.showPercentages : true;
        const baseChartColor = settings?.chartColor || this.reportSettings?.global?.chartColor || DEFAULT_CHART_COLOR;
        const customColors = settings?.customColors || [];
        const naText = (questionType ? this.survey?.questions?.find(q => q.id === analytics.question_id)?.not_applicable_text : null) || "Not Applicable"; // Get specific N/A text if possible

        const getBackgroundColors = (count) => generateColors(count, baseChartColor, customColors);

        let labels = [];
        let values = [];
        let percentages = [];
        let counts = [];
        let datasetLabel = showPercentages ? '%' : 'Count';

        // --- Data Extraction Logic (Handles various analytics types) ---
        let distribution = data.options_distribution || data.option_distribution || data.distribution || [];

        // Check if data is demographic (different structure)
        if (categoryKey && !distribution.length && typeof data === 'object') {
             distribution = Object.entries(data).map(([label, details]) => ({
                 option: label, // Use the key as the label
                 count: details?.count ?? 0,
                 percentage: details?.percentage ?? 0
             }));
              // Sort demographics by count descending by default
             distribution.sort((a, b) => b.count - a.count);
        }

        // Filter N/A based on settings (case-insensitive)
        if (!showNA) {
            distribution = distribution.filter(item => {
                const label = (item.option || item.value)?.toString().toLowerCase();
                return label !== naText.toLowerCase();
            });
        }

        // Check if data is still valid after filtering
        if (!distribution || distribution.length === 0) {
             console.warn("PDF Chart Prep: No distribution data found or remaining after filtering N/A.");
             return null;
        }

        // Determine how to extract labels, counts, percentages based on type
        const analyticsType = data.type; // Use type from analytics object if available

        if (analyticsType === 'single_select_distribution' || categoryKey) { // Includes demographics now
            labels = distribution.map(d => d.option || d.value || 'N/A');
            counts = distribution.map(d => d.count ?? 0);
            const totalCountForPercent = counts.reduce((s, c) => s + c, 0);
            percentages = distribution.map(d => totalCountForPercent > 0 ? ((d.count ?? 0) / totalCountForPercent * 100) : 0);
            values = showPercentages ? percentages : counts;
        } else if (analyticsType === 'multi_select_distribution' || analyticsType === 'image_select_distribution') {
            labels = distribution.map(d => d.option || d.hidden_label || 'N/A'); // Use hidden_label for images if option missing
            counts = distribution.map(d => d.count ?? 0);
            const totalResponses = data.total_responses_considered ?? analytics.total_responses ?? 1; // Use response count for multi %
            percentages = distribution.map(d => totalResponses > 0 ? ((d.count ?? 0) / totalResponses * 100) : 0);
            values = showPercentages ? percentages : counts;
            datasetLabel = showPercentages ? '% Responses' : 'Count';
        } else if ((analyticsType === 'slider_stats' || analyticsType === 'star-rating' || analyticsType === 'rating-scale') && data.distribution) {
            // Use the pre-filtered distribution
            labels = distribution.map(d => d.value?.toString() ?? "N/A");
            counts = distribution.map(d => d.count ?? 0);
            const totalCountForPercent = counts.reduce((s, c) => s + c, 0);
            percentages = distribution.map(d => totalCountForPercent > 0 ? ((d.count ?? 0) / totalCountForPercent * 100) : 0);
            values = showPercentages ? percentages : counts;
        } else if (analyticsType === 'numeric_stats' && questionType === 'nps' && data.nps_segments) {
            // NPS data extraction (remains similar, uses derived `values`)
             const { promoters = 0, passives = 0, detractors = 0 } = data.nps_segments;
             counts = [promoters, passives, detractors];
             const total = counts.reduce((s, c) => s + c, 0);
             percentages = total > 0 ? counts.map(c => (c / total) * 100) : [0, 0, 0];
             values = showPercentages ? percentages : counts; // Values already calculated based on showPercentages
             labels = ["Promoters (9-10)", "Passives (7-8)", "Detractors (0-6)"];
             const npsDefaultColors = ["#4BC0C0", "#FFCE56", "#FF6384"];
             customColors = customColors.length >= 3 ? customColors.slice(0,3) : npsDefaultColors; // Use specific logic
             datasetLabel = 'NPS Segments';
        } else {
            console.warn("PDF Chart Prep: Unhandled analytics type for chart data:", analyticsType);
            return null;
        }


        if (labels.length === 0) return null;

        // Use generated colors, considering custom overrides
        const backgroundColors = getBackgroundColors(labels.length);
        const borderColors = backgroundColors.map(c => typeof c === 'string' ? c.replace(/, [\d.]+\)$/, ', 1)') : c); // Opaque border

        return {
            labels,
            datasets: [{
                label: datasetLabel,
                data: values,
                backgroundColor: backgroundColors.map(c => typeof c === 'string' ? c.replace(/, 1\)/, ', 0.7)') : c), // Add alpha if missing
                borderColor: borderColors,
                borderWidth: 1,
                // Store raw counts/percentages for datalabels
                counts: counts,
                percentages: percentages
            }]
        };
    }
    async _addImageThumbnails(question, settings, startY) {
        this.yPos = startY;
        if (!settings.showThumbnails || !question.image_options || question.image_options.length === 0) {
            return this.yPos; // Skip if disabled or no images
        }

        console.log(`PDF Gen: Adding Thumbnails for Q${settings.displayOrder || question.sequence_number}`);
        this.checkPageBreak(30); // Check space before starting thumbnails section
        this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
        this.yPos = this.addWrappedText('Image Options:', PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 11, isBold: true });
        this.yPos += 2;

        const thumbSize = 25; // Size of thumbnail in mm
        const thumbsPerRow = Math.floor(this.contentWidth / (thumbSize + 5)); // Calculate how many fit per row with 5mm gap
        const gap = 5;
        let currentX = PDF_MARGIN;
        let rowStartY = this.yPos;
        let maxRowHeight = 0;

        for (let i = 0; i < question.image_options.length; i++) {
            const option = question.image_options[i];
            if (!option || !option.image_url) continue;

            const label = option.label || `Option ${i + 1}`;
            const labelLines = this.doc.splitTextToSize(label, thumbSize); // Wrap label text
            const labelHeight = labelLines.length * 3; // Estimate label height
            const totalItemHeight = thumbSize + 2 + labelHeight + 5; // Image + padding + label + bottom padding

            // Check if item fits in current row, or move to next row
            if (currentX + thumbSize > this.pageWidth - PDF_MARGIN) {
                 this.yPos = rowStartY + maxRowHeight; // Move Y to bottom of the completed row
                 currentX = PDF_MARGIN; // Reset X
                 rowStartY = this.yPos; // Start Y for the new row
                 maxRowHeight = 0; // Reset max height for new row
            }

            this.checkPageBreak(totalItemHeight); // Check page break for the item
            // If page break occurred, reset positions
            if (this.yPos === PDF_MARGIN && currentX !== PDF_MARGIN) {
                 rowStartY = PDF_MARGIN;
                 currentX = PDF_MARGIN; // Reset X on new page too
            }

             // --- Attempt to add image ---
             // NOTE: This is the tricky part. doc.addImage works best with Base64 or preloaded canvas/image elements.
             // Direct URL fetching within jsPDF generation is problematic (async, CORS, errors).
             // **Option 1: Assume URLs work directly (might fail often)**
             try {
                  // Draw placeholder rectangle first
                  this.doc.setDrawColor(200, 200, 200);
                  this.doc.rect(currentX, this.yPos, thumbSize, thumbSize);
                  // Try adding image
                  this.doc.addImage(option.image_url, 'JPEG', currentX + 1, this.yPos + 1, thumbSize - 2, thumbSize - 2, undefined, 'FAST');
                  // If image added successfully, update max height for the row
                  maxRowHeight = Math.max(maxRowHeight, thumbSize + 2 + labelHeight + 5);
             } catch (imgErr) {
                 console.error(`PDF Gen: Failed to add image ${option.image_url} for Q${question.id}: ${imgErr}`);
                 // Draw an 'X' in the placeholder if image fails
                 this.doc.setDrawColor(255, 0, 0); this.doc.setLineWidth(0.5);
                 this.doc.line(currentX + 2, this.yPos + 2, currentX + thumbSize - 2, this.yPos + thumbSize - 2);
                 this.doc.line(currentX + thumbSize - 2, this.yPos + 2, currentX + 2, this.yPos + thumbSize - 2);
                  maxRowHeight = Math.max(maxRowHeight, thumbSize + 2 + labelHeight + 5); // Still account for space
             }
             // **Option 2: Require Base64 data in analyticsDataExternal (Recommended for reliability)**
             // if (option.base64ImageData) {
             //     doc.addImage(option.base64ImageData, 'JPEG', currentX, this.yPos, thumbSize, thumbSize);
             // } else { /* Draw placeholder */ }
             // --- End Image adding ---


             // Add label below thumbnail (using addWrappedText for potential wrapping)
             this.addWrappedText(label, currentX, this.yPos + thumbSize + 2, thumbSize, 3, { fontSize: 7, color: [80, 80, 80] });
             // Note: addWrappedText updates the global this.yPos, which we don't want mid-row. We reset yPos based on maxRowHeight later.

             currentX += thumbSize + gap; // Move X for next thumbnail
         }

        // Move yPos down after the last row of thumbnails
        this.yPos = rowStartY + maxRowHeight;

        return this.yPos;
    }
    // --- UPDATED: Chart Options Preparation ---
    /**
     * Gets Chart.js options based on settings.
     * @param {object} analytics - Analytics data (used for title fallback).
     * @param {object} settings - Customization settings for this item.
     * @param {Array} [labels=[]] - Array of labels for the chart.
     * @returns {object} Chart.js options object.
     */
    getChartOptionsForPdf(analytics, settings, labels = []) {
        // Use analytics.question_text if available, else fallback or use category key if demo
        const defaultTitle = analytics?.question_text || analytics?.category_key?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || '';
        const titleText = settings?.customTitle || defaultTitle;
        // Use chart type from settings, fallback to global, then default based on question type
        const qType = analytics?.question_type;
        const defaultChartType = qType ? getDefaultChartType(qType) : 'bar';
        const chartType = settings?.chartType || this.reportSettings?.global?.chartType || defaultChartType;

        const isHorizontal = chartType === 'bar' && settings?.indexAxis === 'y'; // Check explicit setting if available
        const showLegend = settings?.showLegend !== undefined ? settings.showLegend : (this.reportSettings?.global?.showLegend !== undefined ? this.reportSettings.global.showLegend : true);
        const dataLabelFormat = settings?.dataLabelFormat || this.reportSettings?.global?.dataLabelFormat || 'percent';
        const isPieDoughnut = chartType === 'pie' || chartType === 'doughnut';

        const options = {
            responsive: false, maintainAspectRatio: false, indexAxis: isHorizontal ? 'y' : 'x',
            plugins: {
                title: { display: !!titleText, text: titleText, font: { size: 14, weight: 'bold' }, padding: { top: 10, bottom: 15 } },
                legend: { display: showLegend && (isPieDoughnut || labels.length > 1), position: 'bottom', labels: { padding: 15, boxWidth: 12, font: { size: 10 } } },
                tooltip: { enabled: false }, // Disabled for PDF
                datalabels: {
                    display: dataLabelFormat !== 'none',
                    color: (context) => { // Dynamic color logic (keep existing)
                        if (isPieDoughnut) return '#ffffff';
                        const bgColor = context.dataset.backgroundColor?.[context.dataIndex] || '#000000';
                        try {
                           if (bgColor.startsWith('#')) { const r = parseInt(bgColor.slice(1, 3), 16), g = parseInt(bgColor.slice(3, 5), 16), b = parseInt(bgColor.slice(5, 7), 16); const brightness = (r*0.299 + g*0.587 + b*0.114); return brightness > 186 ? '#333333' : '#ffffff'; }
                           else if (bgColor.startsWith('rgba')) { const parts = bgColor.match(/[\d.]+/g); if (parts && parts.length >= 3) { const brightness = (parseInt(parts[0])*0.299 + parseInt(parts[1])*0.587 + parseInt(parts[2])*0.114); return brightness > 186 ? '#333333' : '#ffffff'; } }
                           else if (bgColor.startsWith('rgb')) { const parts = bgColor.match(/[\d.]+/g); if (parts && parts.length >= 3) { const brightness = (parseInt(parts[0])*0.299 + parseInt(parts[1])*0.587 + parseInt(parts[2])*0.114); return brightness > 186 ? '#333333' : '#ffffff'; } }
                        } catch {}
                        return isPieDoughnut ? '#ffffff' : '#444444';
                    },
                    font: { size: 9, weight: '500' },
                    anchor: isPieDoughnut ? 'center' : 'end',
                    align: isPieDoughnut ? 'center' : 'end',
                    offset: isPieDoughnut ? 0 : 4,
                    formatter: (value, context) => {
                        // Use stored counts/percentages from dataset
                        const count = context.dataset.counts?.[context.dataIndex] ?? null;
                        const percentage = context.dataset.percentages?.[context.dataIndex] ?? null;
                        if (isPieDoughnut && percentage !== null && percentage < 3) return ''; // Hide small pie labels

                        // Use dataLabelFormat from settings
                        if (dataLabelFormat === 'both' && percentage !== null && count !== null) return `${percentage.toFixed(1)}%\n(${count.toLocaleString()})`;
                        if (dataLabelFormat === 'count' && count !== null) return count.toLocaleString();
                        if (dataLabelFormat === 'percent' && percentage !== null) return `${percentage.toFixed(1)}%`;
                        // Defaults to empty if format is 'none' or data unavailable
                        return '';
                    }
                }
            },
            scales: (chartType === 'bar' || chartType === 'line') ? {
                 x: { beginAtZero: true, display: !isHorizontal, ticks: { font: { size: 9 } }, grid: { color: '#eeeeee', drawBorder: false } },
                 y: { beginAtZero: true, display: isHorizontal, ticks: { font: { size: 9 } }, grid: { color: '#eeeeee', drawBorder: false } }
             } : {},
            animation: false
        };
        return options;
    }


    // --- Section Rendering ---
    addTitlePage() { /* ... Keep existing implementation ... */
        this.doc.setFontSize(22); this.doc.setTextColor(44, 62, 80);
        this.yPos = this.addWrappedText(this.surveyTitle, this.pageWidth / 2, this.yPos + 5, this.contentWidth, 10, { align: 'center', fontSize: 22, isBold: true });
        this.yPos += 10;
        this.doc.setFontSize(14); this.doc.setTextColor(80, 80, 80);
        this.yPos = this.addWrappedText(`Generated on: ${new Date().toLocaleDateString()}`, this.pageWidth / 2, this.yPos, this.contentWidth, 7, { align: 'center', fontSize: 14 });
        if (this.survey?.description) {
            this.yPos += 10;
            this.doc.setFontSize(12); this.doc.setTextColor(60, 60, 60); this.doc.setFont('helvetica', 'italic');
            this.yPos = this.addWrappedText(this.survey.description, PDF_MARGIN, this.yPos, this.contentWidth, 5);
            this.doc.setFont('helvetica', 'normal');
        }
        this.yPos += 20; // Space after title block
        this.updateProgress();
    }

    addSummaryStatistics(summaryData) { /* ... Keep existing implementation ... */
         if (!summaryData) return;
         this.checkPageBreak(40);
         this.doc.setFontSize(16); this.doc.setTextColor(44, 62, 80);
         this.doc.text("Survey Summary", PDF_MARGIN, this.yPos); this.yPos += 10;

         const stats = [
            ["Completed Responses", summaryData?.total_responses ?? 'N/A'],
            ["Total Started", summaryData?.total_started ?? 'N/A'],
            ["Drop-off Rate", `${summaryData?.drop_off_rate?.toFixed(1) ?? 'N/A'}%`],
            ["Avg. Completion Time", formatTime(summaryData?.average_completion_time)],
         ];
         this.doc.autoTable({
            body: stats,
            startY: this.yPos,
            theme: 'plain',
            styles: { cellPadding: 2, fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 'auto'} },
            margin: { left: PDF_MARGIN }
         });
         this.yPos = this.doc.lastAutoTable.finalY + 10;
         this.updateProgress();
    }

    addFilterInfoSection() { /* ... Keep existing implementation ... */
         if (this.isIncludeAll) return; // No filters applied
         this.checkPageBreak(30);
         this.doc.setFontSize(14); this.doc.setTextColor(44, 62, 80);
         this.doc.text("Filters Applied", PDF_MARGIN, this.yPos); this.yPos += 8;
         this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);

         const filterLines = [];
         Object.entries(this.filterState || {}).forEach(([key, value]) => {
             if (value && ( (Array.isArray(value) && value.length > 0) || (!Array.isArray(value) && key.includes('Date'))) ) {
                 const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                 let valueStr = Array.isArray(value) ? value.join(', ') : value instanceof Date ? value.toLocaleDateString() : String(value);
                 if(key.includes('Date') && value) valueStr = format(new Date(value), 'yyyy-MM-dd');
                 if(valueStr) filterLines.push(`${label}: ${valueStr}`);
             }
         });

         if (this.isComparisonActive && this.comparisonState?.dimension && this.comparisonState.segments?.length === 2) {
             filterLines.push(`Comparison: ${this.comparisonState.dimension} by [${this.comparisonState.segments.join(' vs ')}]`);
         }

         if (filterLines.length > 0) {
             this.yPos = this.addWrappedText(filterLines.join('\n'), PDF_MARGIN, this.yPos, this.contentWidth, 4, { fontSize: 9 });
         } else {
             this.yPos = this.addWrappedText("No specific filters applied (showing all responses).", PDF_MARGIN, this.yPos, this.contentWidth, 4, { fontSize: 9 });
         }
         this.yPos += 10;
         this.updateProgress(); // Count as a step
    }

    // --- UPDATED: Demographics Section ---
    async addDemographicsInformation(demographicsData, demoSettingsFromReport) {
        // **Check export option FIRST**
        if (!this.exportOptions?.includeDemographics) {
            console.log("PDF: Skipping Demographics (disabled in export options)");
            this.updateProgress();
            return;
        }
        if (!demographicsData || Object.keys(demographicsData).length === 0) {
            console.log("PDF: Skipping Demographics (no data)");
            this.updateProgress();
            return; // Skip if no data even if enabled
        }

        console.log("PDF: Adding Demographics Section");
        if (this.yPos > PDF_MARGIN + 20) {
             this.doc.addPage(); this.yPos = PDF_MARGIN; this.currentPage++;
        } else {
             this.checkPageBreak(60);
        }

        this.doc.setFontSize(16); this.doc.setTextColor(44, 62, 80);
        this.yPos = this.addWrappedText("Demographics Overview", PDF_MARGIN, this.yPos, this.contentWidth, 7, { fontSize: 16, isBold: true }); // Add spacing after title
        this.yPos += 5;

        const categoriesToRender = Object.keys(demoSettingsFromReport)
            .filter(key => demographicsData[key] && Object.keys(demographicsData[key]).length > 0);

        if (categoriesToRender.length === 0) {
            this.yPos = this.addWrappedText("No demographic data available for the current selection.", PDF_MARGIN, this.yPos, this.contentWidth, 5, {fontSize: 10, color: [150, 150, 150]});
            this.updateProgress();
            return;
        }

        for (const key of categoriesToRender) {
            const categoryData = demographicsData[key];
            const settings = demoSettingsFromReport[key] || {}; // Use settings for this category
            const categoryTitle = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Prepare data using the helper, passing category data and settings
            // The prepareChartDataForPdf helper now respects showNA from settings if present
            const chartData = this.prepareChartDataForPdf({ ...categoryData, category_key: key }, settings);

            if (!chartData || chartData.labels.length === 0) continue;

            // Use settings for chart options (title, type, legend, labels)
            const chartOptions = this.getChartOptionsForPdf({ category_key: key }, settings, chartData.labels);
            let finalChartType = settings.chartType || 'bar'; // Use setting, fallback
            if (finalChartType === 'horizontalBar') { finalChartType = 'bar'; chartOptions.indexAxis = 'y'; }
            else { chartOptions.indexAxis = 'x'; }

            // Add chart image (keep existing logic)
            try {
                const isPie = finalChartType === 'pie' || finalChartType === 'doughnut';
                const chartHeightInPdf = isPie ? 85 : 95;
                const chartWidthInPdf = isPie ? chartHeightInPdf * 1.2 : Math.min(this.contentWidth * 0.9, chartHeightInPdf * 1.8);
                this.checkPageBreak(chartHeightInPdf + 15);

                this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
                // Title is now handled by chart options, but keep a small heading
                this.yPos = this.addWrappedText(categoryTitle, PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 11, isBold: true });
                this.yPos += 2;

                const chartImage = await createChartImage({ type: finalChartType, data: chartData, options: chartOptions, width: 800, height: isPie ? 550 : 450 });
                this.doc.addImage(chartImage, 'PNG', PDF_MARGIN + (this.contentWidth - chartWidthInPdf) / 2, this.yPos, chartWidthInPdf, chartHeightInPdf);
                this.yPos += chartHeightInPdf + 10;
            } catch (chartErr) {
                this.checkPageBreak(10);
                this.yPos = this.addWrappedText(`Error rendering chart for ${categoryTitle}`, PDF_MARGIN, this.yPos, this.contentWidth, 5, { color: [255, 0, 0], fontSize: 9 });
                this.yPos += 5;
            }
        }
        this.updateProgress();
    }


    // --- UPDATED: Question Analytics Section ---
    /**
     * Adds analytics for a single question to the PDF.
     * @param {object} question - The question object from the survey.
     * @param {object} settings - The specific settings object for this question.
     * @param {object} analyticsData - The fetched analytics data for this question (Group 1).
     * @param {object|null} analyticsDataComp - Fetched analytics data for comparison group (Group 2), if active.
     */
    // --- UPDATED: Question Analytics Section ---
    async addQuestionAnalytics(question, settings, analyticsData, analyticsDataComp) {
        // Skip questions that are hidden from PDF export
        if (settings.isHidden === true) {
            console.log(`PDF Gen: Skipping Q${settings.displayOrder || question.sequence_number} (Hidden from PDF export)`);
            this.updateProgress(); 
            return;
        }

        console.log(`PDF Gen: Adding Q${settings.displayOrder || question.sequence_number} - Type: ${question.question_type}`);
        this.checkPageBreak(40);

        // --- Question Title (No settings panel in PDF) ---
        // Use custom title if available, otherwise use question text
        const questionTitle = settings.customTitle || question.question_text;
        const questionNumber = settings.displayOrder || question.sequence_number || 'N/A';
        
        // Enhanced question header for better readability
        this.doc.setFillColor(240, 240, 240); 
        this.doc.rect(PDF_MARGIN, this.yPos, this.contentWidth, 15, 'F'); // Taller header box
        const qHeaderText = `Q${questionNumber}: ${questionTitle}`;
        
        // Add question header with larger font
        let tempY = this.yPos;
        this.addWrappedText(qHeaderText, PDF_MARGIN + 3, tempY + 10, this.contentWidth - 6, 6, { fontSize: 14, fontStyle: 'bold', color: [44, 62, 80] });
        this.yPos += 18; // More space after header box
        
        // Add question type info with better styling
        this.doc.setFont('helvetica', 'normal');
        this.yPos = this.addWrappedText(`Type: ${question.question_type}`, PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 11, color: [80, 80, 80] });
        this.yPos += 12; // More space before content

        // --- Check if analytics data exists ---
        if (!analyticsData || !analyticsData.analytics) {
            const errorMsg = analyticsData?.error || 'No analytics data available (check filters).';
            this.checkPageBreak(15);
            this.yPos = this.addWrappedText(errorMsg, PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 10, color: [150, 0, 0] });
            this.yPos += 5; this.updateProgress(); return;
        }

        // --- Handle Open-ended Questions (Word Cloud) ---
        if (question.question_type === 'open-ended') {
            await this.renderOpenEndedForPdf(analyticsData, this.yPos, settings, this.exportOptions, questionTitle);
            this.updateProgress(); 
            return;
        }

        // --- Determine if Chart should be rendered ---
        const canChartPotentially = !EXCLUDED_ANALYSIS_TYPES.has(question.question_type) && !question.question_type.includes('grid') && question.question_type !== 'open-ended';
        const chartTypeSetting = settings.chartType || getDefaultChartType(question.question_type);
        const renderChart = canChartPotentially && chartTypeSetting !== 'none';

        // --- Chart Rendering (Conditional) ---
        if (renderChart) {
            try {
                const preparedChartData = this.prepareChartDataForPdf(analyticsData, settings);
                if (preparedChartData && preparedChartData.labels.length > 0) {
                    const chartOptions = this.getChartOptionsForPdf(analyticsData, settings, preparedChartData.labels);
                    let finalChartType = chartTypeSetting;
                    if (finalChartType === 'horizontalBar') { finalChartType = 'bar'; chartOptions.indexAxis = 'y'; }
                    else { chartOptions.indexAxis = 'x'; }
                    const isPie = finalChartType === 'pie' || finalChartType === 'doughnut';
                    const chartHeightInPdf = isPie ? 90 : 100; const chartWidthInPdf = isPie ? chartHeightInPdf * 1.2 : Math.min(this.contentWidth * 0.95, chartHeightInPdf * 1.8);
                    this.checkPageBreak(chartHeightInPdf + 10);
                    const chartImage = await createChartImage({ type: finalChartType, data: preparedChartData, options: chartOptions, width: 800, height: isPie ? 550 : 450 });
                    this.doc.addImage(chartImage, 'PNG', PDF_MARGIN + (this.contentWidth - chartWidthInPdf) / 2, this.yPos, chartWidthInPdf, chartHeightInPdf);
                    this.yPos += chartHeightInPdf + 10;
                } else { console.log(`PDF: No chart data for Q${settings.displayOrder}`); }
            } catch (chartErr) {
                 this.checkPageBreak(10); this.yPos = this.addWrappedText(`Error rendering chart: ${chartErr.message || 'Unknown'}`, PDF_MARGIN, this.yPos, this.contentWidth, 5, { color: [255, 0, 0], fontSize: 9 }); this.yPos += 5;
            }
        }

        // --- Table/Text Rendering (Pass settings down) ---
        this.checkPageBreak(30);
        if (question.question_type.includes('grid')) {
            if (analyticsData.analytics.grid_data) { this.yPos = this.renderGridTableForPdf(analyticsData.analytics.grid_data, question.question_type, this.yPos, settings); }
            else { this.yPos = this.addWrappedText('Grid data not available.', PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 9, color: [150, 150, 150] }); }
        } else if (!EXCLUDED_ANALYSIS_TYPES.has(question.question_type)) {
             this.yPos = this.renderStatisticsTableForPdf(analyticsData, this.yPos, settings);
        }

        // --- Image Thumbnails Rendering (Conditional) ---
        if (['single-image-select', 'multiple-image-select'].includes(question.question_type)) {
            await this._addImageThumbnails(question, settings, this.yPos);
            // Note: _addImageThumbnails updates this.yPos internally
            this.yPos += 5; // Add padding after thumbnails
        }

        // --- Comparison Rendering (NEW) ---
        if (this.isComparisonActive && analyticsDataComp?.analytics) {
             await this._addComparisonChartAndTable(question, settings, analyticsData, analyticsDataComp);
             // Note: _addComparisonChartAndTable updates this.yPos internally
        }

        this.yPos += 5; // Spacing after all content for this question
        this.updateProgress(); // Update progress after processing each question
    }

    // --- Table Rendering Helpers (renderStatisticsTableForPdf, renderGridTableForPdf, renderOpenEndedForPdf) ---
    // Ensure these helpers correctly use the `settings` prop passed to them,
    // especially for `showNA`, `showStatsTable`, `showResponseDist`, `showWordCloud`, `showDropdownResponses`.
    // The implementations provided previously should handle this.
    renderStatisticsTableForPdf(analytics, startY, settings) { /* ... keep implementation from previous response (respects settings) ... */ return this.yPos; }
    renderGridTableForPdf(gridData, gridType, startY, settings) { /* ... keep implementation from previous response (respects settings) ... */ return this.yPos; }
    renderOpenEndedForPdf(analytics, startY, settings, pdfExportOptions) { /* ... keep implementation from previous response (respects settings) ... */ return this.yPos; }

    // --- UPDATED: Main generate function ---
    async generate(data, settings, exportOptions, progressCallback, filterState, comparisonState, isIncludeAll, isComparisonActive) {
        // Initialize (keep existing)
        this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        this.yPos = PDF_MARGIN; this.pageWidth = this.doc.internal.pageSize.getWidth(); this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - (PDF_MARGIN * 2);
        this.surveyTitle = data.survey?.title || 'Survey Report';
        this.updateProgress = progressCallback || (() => {});
        this.currentPage = 1; this.totalPages = 1;

        // Store context (keep existing)
        this.survey = data.survey; this.reportSettings = settings; this.exportOptions = exportOptions;
        this.filterState = filterState; this.comparisonState = comparisonState; this.isIncludeAll = isIncludeAll;
        this.isComparisonActive = isComparisonActive; this.comparisonData = data.comparisonData;
        // Store group names from comparison data if available
        this.group1Name = data.comparisonData?.group1Name || 'Group 1';
        this.group2Name = data.comparisonData?.group2Name || 'Group 2';

        if (!this.survey || !this.reportSettings) throw new Error("Survey data or report settings missing.");
        if (!this.exportOptions) { this.exportOptions = { includeDemographics: true, showWordCloudData: true, showOpenEndedResponses: true, openEndedResponseLimit: 10 }; }

        const { summaryData, demographicsData, questionStats } = data; // Group 1 data
        const { questions: questionSettingsMap, demographics: demoSettingsFromReport } = this.reportSettings;

        // Estimate steps (keep existing)
        const questionsToProcess = (this.survey?.questions || []).filter(q => !EXCLUDED_ANALYSIS_TYPES.has(q.question_type) && !(questionSettingsMap[q.id]?.isHidden));
        const numQuestionsToProcess = questionsToProcess.length;
        const numDemographicsSteps = this.exportOptions.includeDemographics ? 1 : 0;
        const totalSteps = 3 + numDemographicsSteps + numQuestionsToProcess + 1;
        let currentStep = 0;
        const updateProgressInternal = () => { currentStep++; this.updateProgress(totalSteps > 0 ? Math.min(100, (currentStep / totalSteps) * 100) : 0); };
        this.updateProgress = updateProgressInternal; this.updateProgress(0);

        try {
            // 1. Title Page
            this.addTitlePage();
            // 2. Summary
            this.addSummaryStatistics(summaryData);
            // 3. Filter Info
            this.addFilterInfoSection();
            // 4. Demographics
            await this.addDemographicsInformation(demographicsData, demoSettingsFromReport);
            // 5. Questions
            const sortedQuestionsToRender = questionsToProcess.sort((a, b) => {
                 const orderA = questionSettingsMap[a.id]?.displayOrder ?? a.sequence_number ?? 9999;
                 const orderB = questionSettingsMap[b.id]?.displayOrder ?? b.sequence_number ?? 9999;
                 return orderA - orderB;
            });

            // Filter out questions that are hidden from PDF export
            const questionsForPdf = sortedQuestionsToRender.filter(question => {
                const qSettings = questionSettingsMap[question.id] || {};
                return qSettings.isHidden !== true; // Only include if not hidden from PDF
            });

            for (const question of questionsForPdf) {
                 this.checkPageBreak(40); // Ensure space before each question
                 const qSettings = questionSettingsMap[question.id] || {};
                 const qAnalytics = questionStats?.[question.id];
                 // Get comparison data (Group 2) - use this.comparisonData
                 const qAnalyticsComp = this.isComparisonActive ? this.comparisonData?.questionStats?.[question.id] : null;
                 // Pass BOTH group analytics data to addQuestionAnalytics
                 await this.addQuestionAnalytics(question, qSettings, qAnalytics, qAnalyticsComp);
                 // Note: updateProgress is called within addQuestionAnalytics
            }

            // 6. Final Page Numbers
            this.addPageNumbers(); // Uses this.surveyTitle
            this.updateProgress(100); // Ensure 100% at the end

            // 7. Save
            const safeTitle = this.surveyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeTitle}_report_${new Date().toISOString().split('T')[0]}.pdf`;
            this.doc.save(filename);

        } catch (error) {
            console.error("Error during PDF generation:", error);
            throw error; // Re-throw for ReportTabPage to catch
        }
    }


    // --- Table/Text Rendering Helpers --- (UPDATED to accept and use settings)

    renderStatisticsTableForPdf(analytics, startY, settings) {
        this.yPos = startY;
        if (!analytics?.analytics || !settings) { return this.yPos; } // Check settings

        const data = analytics.analytics;
        const questionType = analytics.question_type;

        // **Use settings to control visibility and N/A filtering**
        const showNA = settings?.showNA !== undefined ? settings.showNA : true;
        const showStats = settings?.showStatsTable !== undefined ? settings.showStatsTable : true;
        const showDist = settings?.showResponseDist !== undefined ? settings.showResponseDist : true;
        const naText = (analytics.question?.not_applicable_text || "Not Applicable").toLowerCase(); // Get NA text from question if possible

        // Early exit if nothing to show based on settings
        if (!showDist && !showStats) return this.yPos;

        const tableTheme = 'striped';
        const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 11 };
        const bodyStyles = { fontSize: 10, cellPadding: 2, valign: 'middle' };
        const alternateRowStyles = { fillColor: [245, 245, 245] };

        // --- Distribution Table (Conditional) ---
        let distribution = data.options_distribution || data.option_distribution || data.distribution || [];
        let naCount = 0;
        let filteredDistribution = [];
        if (Array.isArray(distribution)) {
            distribution.forEach(item => {
                const label = String(item.option || item.value || '').toLowerCase();
                if (label === naText) {
                    naCount += (item.count ?? 0);
                    if (showNA) filteredDistribution.push({...item}); // Include if showNA is true
                } else {
                    filteredDistribution.push({...item});
                }
            });
        }
        const totalValidDistCount = filteredDistribution.filter(item => String(item.option || item.value || '').toLowerCase() !== naText).reduce((sum, item) => sum + (item.count ?? 0), 0);
        const totalResponsesConsidered = totalValidDistCount + (showNA ? naCount : 0);

        if (showDist && filteredDistribution.length > 0) {
             let distHeaders = []; let distBody = []; let isMulti = false;
             const distAnalyticsType = data.type;

             if (distAnalyticsType?.includes('select_distribution') || distAnalyticsType === 'image_select_distribution') {
                 isMulti = distAnalyticsType.includes('multi') || distAnalyticsType === 'image_select_distribution';
                 distHeaders = [['Option', 'Count', isMulti ? '% Responses' : '% Total']];
                 distBody = filteredDistribution.map(item => {
                      const count = item.count ?? 0;
                      const base = isMulti ? totalResponsesConsidered : totalValidDistCount;
                      const percentage = base > 0 ? (count / base * 100) : 0;
                      return [ item.option || item.hidden_label || 'N/A', count, `${percentage.toFixed(1)}%` ];
                  });
             } else if (['slider_stats', 'star-rating'].includes(distAnalyticsType) || (distAnalyticsType === 'numeric_stats' && questionType !== 'nps')) {
                  distHeaders = [['Value', 'Count', 'Percentage']];
                  distBody = filteredDistribution.map(item => {
                       const count = item.count ?? 0;
                       const base = totalValidDistCount; // Use valid count base for these types
                       const percentage = base > 0 ? (count / base * 100) : 0;
                       return [ item.value ?? 'N/A', count, `${percentage.toFixed(1)}%` ];
                   });
             }

            if (distHeaders.length > 0 && distBody.length > 0) {
                 this.checkPageBreak((distBody.length + 1) * 7 + 15);
                 this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
                 this.doc.text('Response Distribution:', PDF_MARGIN, this.yPos); this.yPos += 7;
                                 this.doc.autoTable({ head: distHeaders, body: distBody, startY: this.yPos, theme: tableTheme, headStyles, bodyStyles, alternateRowStyles, margin: { left: PDF_MARGIN, right: PDF_MARGIN } });
                this.yPos = this.doc.lastAutoTable.finalY + 15; // More space after tables
                 // Add note if N/A was excluded
                 if (!showNA && naCount > 0) {
                     this.yPos = this.checkPageBreak(this.yPos, 10);
                     this.yPos = this.addWrappedText(`* ${naCount} 'Not Applicable' response(s) excluded from table.`, PDF_MARGIN, this.yPos, this.contentWidth, 4, {fontSize: 10, color: [80, 80, 80]});
                     this.yPos += 5;
                 }
            }
        } else if (showDist) { // Still show message if dist enabled but no data
             this.checkPageBreak(10);
             this.yPos = this.addWrappedText(`(No distribution data to display${!showNA && naCount > 0 ? ' - N/A hidden' : ''})`, PDF_MARGIN, this.yPos, this.contentWidth, 4, {fontSize: 8, color: [150, 150, 150]}); this.yPos += 5;
        }

        // --- Stats Table (Conditional on showStats) ---
        if (showStats && ['numeric_stats', 'slider_stats', 'star-rating'].includes(data.type)) {
             const stats = [];
             // Use count_valid if available, fallback logic
             const validCount = data.count_valid ?? totalValidDistCount;
             stats.push(['Valid Responses', validCount.toLocaleString()]);

             // Calculate average for 'scale' type based on *original* question options order
             let calculatedScaleAvg = null;
             if (questionType === 'scale' && question.scale_points) {
                  let weightedSum = 0; let countForAvg = 0;
                  const scalePointsMap = (question.scale_points || []).reduce((map, point, index) => { map[point] = index + 1; return map; }, {});
                  // Use the full, unfiltered distribution to calculate scale avg based on defined points
                  (data.options_distribution || []).forEach(item => {
                      const scaleValue = scalePointsMap[item.option];
                      if (scaleValue !== undefined) { // Only use defined scale points
                          weightedSum += (item.count ?? 0) * scaleValue;
                          countForAvg += (item.count ?? 0);
                      }
                  });
                  calculatedScaleAvg = countForAvg > 0 ? weightedSum / countForAvg : null;
                  if (calculatedScaleAvg !== null) stats.push(['Average Score*', calculatedScaleAvg.toFixed(2)]);
             } else if (data.mean !== undefined && data.mean !== null) {
                 stats.push(['Average', data.mean.toFixed(2)]);
             }

             // Add other stats if they exist
             if (data.median !== undefined && data.median !== null) stats.push(['Median', data.median.toFixed(2)]);
             if (data.min !== undefined && data.min !== null) stats.push(['Min', data.min.toLocaleString(undefined, { maximumFractionDigits: 2 })]);
             if (data.max !== undefined && data.max !== null) stats.push(['Max', data.max.toLocaleString(undefined, { maximumFractionDigits: 2 })]);
             if (data.std_dev !== undefined && data.std_dev !== null) stats.push(['Std Dev', data.std_dev.toFixed(2)]);

            if (stats.length > 0) {
                 this.checkPageBreak((stats.length + 1) * 7 + 15);
                 this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
                 this.doc.text('Statistical Summary:', PDF_MARGIN, this.yPos); this.yPos += 7;
                                 this.doc.autoTable({ head: [['Metric', 'Value']], body: stats, startY: this.yPos, theme: tableTheme, headStyles, bodyStyles, alternateRowStyles, margin: { left: PDF_MARGIN, right: PDF_MARGIN } });
                this.yPos = this.doc.lastAutoTable.finalY + 12; // More space after stats tables
                 if (questionType === 'scale' && calculatedScaleAvg !== null) {
                     this.yPos = this.checkPageBreak(this.yPos, 10);
                     this.yPos = this.addWrappedText('*Assumes sequential values (1, 2...) for scale options.', PDF_MARGIN, this.yPos, this.contentWidth, 4, { fontSize: 8, color: [100, 100, 100] });
                     this.yPos += 5;
                 }
            }

            // Star visualization (keep existing logic)
            if (questionType === 'star-rating' && data.mean !== undefined && data.mean !== null) { /* ...draw stars... */ this.yPos += 8; }

            // NPS Table (Enhanced layout for better readability)
            if (questionType === 'nps' && data.nps_segments) { 
                // NPS Specific Rendering for PDF - Enhanced Layout
                this.checkPageBreak(120); // Much more space for NPS section
                
                // Title with better styling
                this.doc.setFontSize(16); this.doc.setTextColor(44, 62, 80);
                this.doc.text('NPS Analysis', PDF_MARGIN, this.yPos); 
                this.yPos += 15; // More space after title
                
                const { promoters = 0, passives = 0, detractors = 0 } = data.nps_segments;
                const totalNps = promoters + passives + detractors;
                const npsScore = data.nps_score != null ? Math.round(data.nps_score) : "N/A";
                
                // First, show the prominent NPS Score at the top
                const scoreBoxWidth = 120; // Much larger
                const scoreBoxHeight = 35; // Much taller
                const scoreBoxX = PDF_MARGIN + (this.contentWidth - scoreBoxWidth) / 2;
                
                // Main score box with gradient-like effect
                this.doc.setFillColor(54, 162, 235); // Blue background
                this.doc.setDrawColor(40, 120, 200);
                this.doc.setLineWidth(2);
                this.doc.rect(scoreBoxX, this.yPos, scoreBoxWidth, scoreBoxHeight, 'FD');
                
                // Score text - much larger and more prominent
                this.doc.setTextColor(255, 255, 255); // White text
                this.doc.setFontSize(24); // Much larger
                this.doc.text(String(npsScore), scoreBoxX + scoreBoxWidth/2, this.yPos + 15, { align: 'center' });
                this.doc.setFontSize(12);
                this.doc.text('NPS Score', scoreBoxX + scoreBoxWidth/2, this.yPos + 28, { align: 'center' });
                
                this.yPos += scoreBoxHeight + 15; // More space after score box
                
                // Enhanced segments table with larger fonts
                this.doc.setFontSize(14); this.doc.setTextColor(44, 62, 80);
                this.doc.text('Segment Breakdown:', PDF_MARGIN, this.yPos); 
                this.yPos += 10;
                
                const npsHeaders = [['Segment', 'Count', 'Percentage']];
                const npsBody = [
                    ['Promoters (9-10)', promoters, totalNps > 0 ? `${((promoters / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                    ['Passives (7-8)', passives, totalNps > 0 ? `${((passives / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                    ['Detractors (0-6)', detractors, totalNps > 0 ? `${((detractors / totalNps) * 100).toFixed(1)}%` : '0.0%'],
                ];
                
                // Enhanced table styling for NPS
                const npsHeadStyles = { 
                    fillColor: [44, 62, 80], 
                    textColor: 255, 
                    fontStyle: 'bold', 
                    fontSize: 13, // Larger font
                    cellPadding: 4 // More padding
                };
                const npsBodyStyles = { 
                    fontSize: 12, // Larger font
                    cellPadding: 4, // More padding
                    valign: 'middle' 
                };
                
                this.doc.autoTable({ 
                    head: npsHeaders, 
                    body: npsBody, 
                    startY: this.yPos, 
                    theme: 'striped', 
                    headStyles: npsHeadStyles, 
                    bodyStyles: npsBodyStyles, 
                    alternateRowStyles: { fillColor: [245, 245, 245] }, 
                    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
                    tableWidth: this.contentWidth // Use full width for better readability
                });
                
                const tableEndY = this.doc.lastAutoTable.finalY;
                this.yPos = tableEndY + 10;
                
                // Add interpretation note with larger text
                this.doc.setTextColor(80, 80, 80);
                this.doc.setFontSize(11);
                this.doc.text(`Analysis based on ${totalNps} total responses`, PDF_MARGIN + (this.contentWidth - scoreBoxWidth) / 2 + scoreBoxWidth/2, this.yPos, { align: 'center' });
                this.yPos += 15; // More space after NPS section
            }
        } else if (showStats) { // Indicate if stats were enabled but not applicable
             // this.yPos = this.addWrappedText(`(Statistical summary not applicable for type: ${questionType})`, ...); // Optional message
        }
        return this.yPos;
    }



    renderGridTableForPdf(gridData, gridType, startY, settings) {
        this.yPos = startY;
        if (!gridData || !gridData.rows || !gridData.columns || gridData.rows.length === 0 || gridData.columns.length === 0) {
            this.checkPageBreak(10);
            this.yPos = this.addWrappedText('No data available for this grid.', PDF_MARGIN, this.yPos, this.contentWidth, 5, { fontSize: 9, color: [150, 150, 150] });
            return this.yPos + 5;
        }

        // **Use showNA from settings**
        const showNA = settings?.showNA !== undefined ? settings.showNA : true;
        const isStarGrid = gridType === 'star-rating-grid';
        // Styles (keep as is)
        const tableTheme = 'grid';
        const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 2, halign: 'center', valign: 'middle' };
        const bodyStyles = { fontSize: 9, cellPadding: 2, halign: 'center', valign: 'middle' };
        const footStyles = { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle' };
        const alternateRowStyles = { fillColor: [249, 249, 249] };

        // --- Filter columns based on showNA setting ---
        const originalCols = gridData.columns || [];
        const columnsToRender = [];
        const originalIndices = [];
        originalCols.forEach((col, index) => {
            // Check if column represents N/A. Look for isNotApplicable flag OR common text patterns.
            const colText = (typeof col === 'object' ? col.text : col) || '';
            const isNAColumn = col?.isNotApplicable === true || colText.toLowerCase() === 'n/a' || colText.toLowerCase() === 'not applicable';
            if (showNA || !isNAColumn) {
                columnsToRender.push(col);
                originalIndices.push(index); // Store the original index
            }
        });
        // --- End Column Filtering ---

        // Headers (use filtered columns)
        const headerLabel = isStarGrid ? 'Row Avg' : 'Row Total';
        // Ensure column labels are strings
        const headerTexts = columnsToRender.map(c => String(typeof c === 'object' ? c.text : c));
        const headers = [[' '].concat(headerTexts).concat([headerLabel])];

        // Body (map using original indices stored in originalIndices)
        const body = (gridData.rows || []).map((row, rIdx) => {
             const rowLabel = String(typeof row === 'object' ? row.text : row) || `Row ${rIdx + 1}`;
             const rowData = [rowLabel];
             originalIndices.forEach(originalColIndex => { // Iterate using the stored original indices
                 if (isStarGrid) {
                     const avg = gridData.cell_averages?.[rIdx]?.[originalColIndex];
                     const count = gridData.count_values?.[rIdx]?.[originalColIndex] ?? 0;
                     rowData.push(avg !== undefined && avg !== null ? `${avg.toFixed(2)}\n(${count})` : `-\n(${count})`);
                 } else { // Choice grid
                     const count = gridData.values?.[rIdx]?.[originalColIndex] ?? 0;
                     const rowTotal = gridData.row_totals?.[rIdx] ?? 0;
                     const percentage = rowTotal > 0 ? ((count / rowTotal) * 100).toFixed(1) : '0.0';
                     rowData.push(`${count}\n(${percentage}%)`);
                 }
             });
             // Row stat (average or total)
             const rowStat = isStarGrid ? gridData.row_averages?.[rIdx] : gridData.row_totals?.[rIdx];
             rowData.push(rowStat !== undefined && rowStat !== null ? (isStarGrid ? rowStat.toFixed(2) : rowStat.toLocaleString()) : (isStarGrid ? '-' : 0));
             return rowData;
         });

        // Footer (map using original indices)
        let foot = [];
        const colAveragesFiltered = originalIndices.map(idx => gridData.column_averages?.[idx]);
        const colTotalsFiltered = originalIndices.map(idx => gridData.column_totals?.[idx]);
        const overallAvgText = gridData.overall_average !== undefined && gridData.overall_average !== null ? `Overall Avg: ${gridData.overall_average.toFixed(2)}` : '';
        if (isStarGrid && colAveragesFiltered.length > 0) {
            foot.push(['Col Avg'].concat(colAveragesFiltered.map(avg => avg?.toFixed(2) ?? '-')).concat([overallAvgText]));
        }
        const colTotalsLabel = isStarGrid ? 'Col Responses' : 'Col Total';
        const colTotalValues = colTotalsFiltered.map(total => total?.toLocaleString() ?? 0);
        const overallTotal = gridData.total_responses ?? (gridData.rows || []).reduce((sum, _, rIdx) => sum + (isStarGrid ? 0 : (gridData.row_totals?.[rIdx] ?? 0)), 0);
        const grandTotalLabel = isStarGrid ? `Total Resp: ${overallTotal.toLocaleString()}` : `Grand Total: ${overallTotal.toLocaleString()}`;
        const lastFootCell = isStarGrid ? grandTotalLabel : (overallAvgText || grandTotalLabel);
        foot.push([colTotalsLabel].concat(colTotalValues).concat([lastFootCell]));


        // Draw table (keep existing autoTable call)
        const avgCellHeight = (isStarGrid || gridType === 'checkbox-grid') ? 10 : 8;
        const estimatedHeight = (headers.length + body.length + foot.length) * avgCellHeight + 15;
        this.checkPageBreak(estimatedHeight);
        this.doc.autoTable({
            head: headers, body: body, foot: foot, startY: this.yPos,
            theme: tableTheme, headStyles, bodyStyles, footStyles, alternateRowStyles,
            margin: { left: PDF_MARGIN, right: PDF_MARGIN }, // Use instance margin
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 'auto', fontSize: 7 } },
            didParseCell: function (data) {
                 if (typeof data.cell.raw === 'string' && data.cell.raw.includes('\n')) { data.cell.text = data.cell.raw.split('\n'); }
             }
        });
        this.yPos = this.doc.lastAutoTable.finalY + 10;
        return this.yPos;
    }



    // --- UPDATED: Open Ended Rendering ---
    renderOpenEndedForPdf(analytics, startY, settings, pdfExportOptions, questionTitle) {
        this.yPos = startY;
        // Use settings and pdfExportOptions passed from generate method
        if (!analytics?.analytics || !settings || !pdfExportOptions) {
            console.warn("PDF OpenEnded: Missing analytics, settings, or PDF export options.");
            return this.yPos;
        }
        const data = analytics.analytics;

        // Add question title for word cloud section (since settings panel is removed)
        if (questionTitle) {
            this.checkPageBreak(15);
            this.doc.setFontSize(14); this.doc.setTextColor(44, 62, 80);
            this.yPos = this.addWrappedText(questionTitle, PDF_MARGIN, this.yPos, this.contentWidth, 6, { fontSize: 14, fontStyle: 'bold' });
            this.yPos += 8;
        }

        // Determine visibility based on settings/options
        const showWordTable = settings?.showWordCloud !== undefined ? settings.showWordCloud : (pdfExportOptions?.showWordCloudData !== undefined ? pdfExportOptions.showWordCloudData : true);
        const showResponseList = settings?.showDropdownResponses !== undefined ? settings.showDropdownResponses : (pdfExportOptions?.showOpenEndedResponses !== undefined ? pdfExportOptions.showOpenEndedResponses : true);
        const limit = Math.min(pdfExportOptions?.openEndedResponseLimit ?? 5, 5); // Maximum 5 responses

        const tableTheme = 'striped';
        const headStyles = { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', fontSize: 11 };
        const bodyStyles = { fontSize: 10, cellPadding: 2 };
        const alternateRowStyles = { fillColor: [245, 245, 245] };

        // Word Cloud Analysis Section
        if (showWordTable || showResponseList) {
            this.checkPageBreak(20);
            this.doc.setFontSize(12); this.doc.setTextColor(60, 60, 60);
            this.yPos = this.addWrappedText('Word Cloud Analysis', PDF_MARGIN, this.yPos, this.contentWidth, 6, { fontSize: 12, fontStyle: 'bold' });
            this.yPos += 5;
        }

        // Word Frequency Table
        if (showWordTable && data.word_frequencies && data.word_frequencies.length > 0) {
            this.checkPageBreak(30);
            this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
            this.doc.text('Top Words:', PDF_MARGIN, this.yPos); this.yPos += 7;
            const wordHeaders = [['Word', 'Frequency']];
            const wordBody = data.word_frequencies.slice(0, 15).map(item => [item.word, item.count]); // Limit to 15 words for better PDF layout
            if (wordBody.length > 0) {
                const tableHeight = (wordBody.length + 1) * 7 + 10;
                this.checkPageBreak(tableHeight);
                this.doc.autoTable({ head: wordHeaders, body: wordBody, startY: this.yPos, theme: tableTheme, headStyles, bodyStyles, alternateRowStyles, margin: { left: PDF_MARGIN, right: PDF_MARGIN } });
                this.yPos = this.doc.lastAutoTable.finalY + 10;
            }
        } else if (showWordTable) {
             this.checkPageBreak(10);
             this.yPos = this.addWrappedText('Word frequency data not available.', PDF_MARGIN, this.yPos, this.contentWidth, 4, {fontSize: 9, color: [150, 150, 150]});
             this.yPos += 5;
        }

        // Responses List - Limited to 5 and without metadata
        const responses = data.all_responses || data.latest_10 || [];
        if (showResponseList && responses.length > 0 && limit > 0) {
            this.checkPageBreak(25);
            const responsesToDisplay = responses.slice(0, limit); // Limit to maximum 5
            this.doc.setFontSize(11); this.doc.setTextColor(60, 60, 60);
            const titleText = `Recent Responses (Showing ${responsesToDisplay.length}${data.response_count && data.response_count > responsesToDisplay.length ? ` of ${data.response_count}` : ''}):`;
            this.doc.text(titleText, PDF_MARGIN, this.yPos); this.yPos += 8;

            responsesToDisplay.forEach((resp) => {
                 const respText = resp.text || '[No Text Provided]';
                 // Keep estimation and rendering logic but make boxes smaller
                 const lines = this.doc.splitTextToSize(respText, this.contentWidth - 6);
                 const requiredHeight = Math.max(12, lines.length * 3.5 + 6); // Smaller boxes
                 this.checkPageBreak(requiredHeight + 3);
                 this.doc.setDrawColor(230, 230, 230); this.doc.setFillColor(250, 250, 250);
                 this.doc.rect(PDF_MARGIN, this.yPos, this.contentWidth, requiredHeight, 'FD');
                  // Use the existing addWrappedText helper
                 let textStartY = this.yPos;
                 this.addWrappedText(respText, PDF_MARGIN + 3, textStartY + 3, this.contentWidth - 6, 4, { fontSize: 10, color: [40, 40, 40] });
                 this.yPos = textStartY + requiredHeight + 3; // Manual control of Y position to avoid addWrappedText interference
            });
            this.yPos += 3; // Final spacing after list
        } else if (showResponseList) {
             this.checkPageBreak(10);
             this.yPos = this.addWrappedText('No responses to display.', PDF_MARGIN, this.yPos, this.contentWidth, 4, {fontSize: 9, color: [150, 150, 150]});
             this.yPos += 5;
        }
        return this.yPos; // Return the final position
    }


    // --- UPDATED: Main Generation Function ---
    async generate(data, settings, exportOptions, progressCallback, filterState, comparisonState, isIncludeAll, isComparisonActive) {
         // Initialize doc and basic properties
         this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
         this.yPos = PDF_MARGIN;
         this.pageWidth = this.doc.internal.pageSize.getWidth();
         this.pageHeight = this.doc.internal.pageSize.getHeight();
         this.contentWidth = this.pageWidth - (PDF_MARGIN * 2);
         this.surveyTitle = data.survey?.title || 'Survey Report';
         this.updateProgress = progressCallback || (() => {});
         this.currentPage = 1;
         this.totalPages = 1;

         // --- Store passed context ---
         this.survey = data.survey;
         this.reportSettings = settings; // Store the full settings object
         this.exportOptions = exportOptions; // Store PDF-specific options
         this.filterState = filterState;
         this.comparisonState = comparisonState;
         this.isIncludeAll = isIncludeAll;
         this.isComparisonActive = isComparisonActive;
         this.comparisonData = data.comparisonData; // Store comparison data if present
         // --- End Store Context ---

         if (!this.survey || !this.reportSettings) {
             throw new Error("Survey data or report settings are missing.");
         }
         if (!this.exportOptions) { // Ensure exportOptions exist
             console.warn("PDF Export options missing, using defaults.");
             this.exportOptions = { includeDemographics: true, showWordCloudData: true, showOpenEndedResponses: true, openEndedResponseLimit: 10 };
         }

         const { summaryData, demographicsData, questionStats } = data; // Use Group 1 data as primary
         const { questions: questionSettingsMap, demographics: demoSettingsFromReport } = this.reportSettings; // Use stored settings

        // --- Estimate Total Steps (Considering Hidden Questions) ---
         const questionsToProcess = (this.survey?.questions || [])
             .filter(q => !EXCLUDED_ANALYSIS_TYPES.has(q.question_type) && !(questionSettingsMap[q.id]?.isHidden));
         const numQuestionsToProcess = questionsToProcess.length;
         const numDemographicsSteps = this.exportOptions.includeDemographics ? 1 : 0;
         // Title, Summary, Filter Info, Demographics (opt), Each Question, Footer
         const totalSteps = 3 + numDemographicsSteps + numQuestionsToProcess + 1;
         let currentStep = 0;
         const updateProgressInternal = () => {
            currentStep++;
            const progress = totalSteps > 0 ? Math.min(100, (currentStep / totalSteps) * 100) : 0;
            this.updateProgress(progress);
         };
         this.updateProgress = updateProgressInternal; // Replace dummy updater
         this.updateProgress(0); // Initial progress

        try {
            // 1. Title Page
            this.addTitlePage(); // Uses this.surveyTitle, this.survey.description

            // 2. Summary
            this.addSummaryStatistics(summaryData); // Uses passed summaryData

            // 3. Filter Info
            this.addFilterInfoSection(); // Uses this.isIncludeAll, this.filterState, this.comparisonState

            // 4. Demographics (Conditional based on exportOptions)
            // Pass Group 1's demo data and the demo settings from reportSettings
            await this.addDemographicsInformation(demographicsData, demoSettingsFromReport); // Uses this.exportOptions.includeDemographics internally

            // 5. Questions
            const sortedQuestionsToRender = questionsToProcess.sort((a, b) => {
                 const orderA = questionSettingsMap[a.id]?.displayOrder ?? a.sequence_number ?? 9999;
                 const orderB = questionSettingsMap[b.id]?.displayOrder ?? b.sequence_number ?? 9999;
                 return orderA - orderB;
            });

            // Filter out questions that are hidden from PDF export
            const questionsForPdf = sortedQuestionsToRender.filter(question => {
                const qSettings = questionSettingsMap[question.id] || {};
                return qSettings.isHidden !== true; // Only include if not hidden from PDF
            });

            for (const question of questionsForPdf) {
                 this.checkPageBreak(40); // Ensure space before each question
                 const qSettings = questionSettingsMap[question.id] || {};
                 const qAnalytics = questionStats?.[question.id];
                 // Get comparison data (Group 2) - use this.comparisonData
                 const qAnalyticsComp = this.isComparisonActive ? this.comparisonData?.questionStats?.[question.id] : null;
                 // Pass BOTH group analytics data to addQuestionAnalytics
                 await this.addQuestionAnalytics(question, qSettings, qAnalytics, qAnalyticsComp);
                 // Note: updateProgress is called within addQuestionAnalytics
            }

            // 6. Final Page Numbers
            this.addPageNumbers(); // Uses this.surveyTitle
            this.updateProgress(100); // Ensure 100% at the end

            // 7. Save
            const safeTitle = this.surveyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeTitle}_report_${new Date().toISOString().split('T')[0]}.pdf`;
            this.doc.save(filename);

        } catch (error) {
            console.error("Error during PDF generation:", error);
            throw error; // Re-throw for ReportTabPage to catch
        }
    }
}

export default SurveyPDFGenerator;