// AnalyticsDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './AnalyticsDashboard.css';
import { authAPI, surveyAPI, analyticsAPI, chartAPI, reportTabAPI } from '../services/apiClient';
import { useBusiness } from '../services/BusinessContext';

// Import core components
import QuestionAnalyticsChart from './AnalyticsComponents/QuestionAnalyticsChart';
import MergeAnalyticsDashboard from './AnalyticsComponents/MergeAnalyticsDashboard';
import ResponseTimeAnalyticsPanel from './AnalyticsComponents/ResponseTimeAnalyticsPanel';
import DropoutAnalysisPanel from './AnalyticsComponents/DropoutAnalysisPanel';
import ReportDownloadPanel from './AnalyticsComponents/ReportDownloadPanel';
import GridAnalytics from './AnalyticsComponents/GridAnalytics';
import WordCloudViewer from './AnalyticsComponents/WordCloudViewer';
import QuestionAnalyticsWithSettings from './AnalyticsComponents/QuestionAnalyticsWithSettings';
import ReportTabPage from './ReportTabPage';
import BatchReportCustomization from './AnalyticsComponents/BatchReportCustomization';

// question types excluded from standard analysis/PDF but included in Excel export
const EXCLUDED_ANALYSIS_TYPES = new Set(['document-upload', 'signature', 'date-picker', 'email-input', 'content-text', 'content-media']);

export default function AnalyticsDashboard() {
  const { surveyId, linkCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { business, isBusinessAdmin, isSuperAdmin } = useBusiness();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chart settings state
  const [globalChartType, setGlobalChartType] = useState('bar');
  const [globalChartColor, setGlobalChartColor] = useState('#36A2EB');
  const [globalShowPercentages, setGlobalShowPercentages] = useState(true);
  const [globalShowLegend, setGlobalShowLegend] = useState(true);
  const [questionSettings, setQuestionSettings] = useState({});
  const [questionOptions, setQuestionOptions] = useState({});

  // Question order state for drag and drop
  const [questionOrder, setQuestionOrder] = useState([]);

  // Demographics settings removed

  // Remove selectedQuestionId since we're showing all analyses
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // Function to update question-specific settings
  const updateQuestionSetting = async (questionId, field, value) => {
    try {
      let updatedSettings;

      // Handle both formats: field+value or entire settings object
      if (field === null && typeof value === 'object') {
        // New format: entire settings object is passed
        updatedSettings = {
          ...questionSettings,
          [questionId]: value
        };
      } else {
        // Old format: field and value are passed separately
        updatedSettings = {
          ...questionSettings,
          [questionId]: {
            ...(questionSettings[questionId] || {}),
            [field]: value
          }
        };
      }

      setQuestionSettings(updatedSettings);

      // Save to backend using chartAPI
      await chartAPI.saveChartSettings(surveyId, {
        global: {
          chartType: globalChartType,
          chartColor: globalChartColor,
          showPercentages: globalShowPercentages,
          showLegend: globalShowLegend
        },
        questions: updatedSettings
      });

      return true; // Return success for async handling
    } catch (err) {
      console.error('Error saving chart settings:', err);
      // Optionally revert the state if save fails
      // You could show a toast notification here
      return false; // Return failure for async handling
    }
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(orderedAnalyzableQuestions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update question order state
    const newOrder = items.map((q, index) => ({ id: q.id, order: index + 1 }));
    setQuestionOrder(newOrder);

    // Update each question's displayOrder setting
    newOrder.forEach(({ id, order }) => {
      updateQuestionSetting(id, 'displayOrder', order);
    });
  };

  // Demographics functionality removed

  // Helper function to clone elements and convert charts for PDF
  const createCloneWithCharts = (sourceEl, sectionType = 'all') => {
    const clone = sourceEl.cloneNode(true);

    // Remove interactive UI elements not needed in PDF
    clone
      .querySelectorAll(
        '.drag-handle, .settings-column, .settings-toggle, .order-control, .pdf-include-control, .settings-buttons-container, .action-buttons, .settings-section, .header-row'
      )
      .forEach((el) => el.remove());

    // Section-specific filtering
    try {
      if (sectionType === 'charts') {
        // Remove all tables and statistics panels
        clone.querySelectorAll('table').forEach((el) => el.remove());
        clone.querySelectorAll('.statistics-panel, .demographics-table, .ranking-distribution-table').forEach((el) => el.remove());
      } else if (sectionType === 'tables') {
        // Remove chart wrappers, canvases, svgs (including word cloud), and chart placeholders
        clone.querySelectorAll('.chart-container, .chart-wrapper, .chart-placeholder, .word-cloud-analysis').forEach((el) => el.remove());
        clone.querySelectorAll('canvas').forEach((el) => el.remove());
        clone.querySelectorAll('svg').forEach((el) => el.remove());
      }
    } catch (e) {
      console.warn('[PDF Export] Section filtering error:', e);
    }

    // Replace canvases with images to preserve rendered charts
    const srcCanvases = sourceEl.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    console.log(`[PDF Export] Converting ${srcCanvases.length} canvases to images`);

    if (sectionType !== 'tables') {
      srcCanvases.forEach((canvas, idx) => {
        try {
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.style.width = canvas.style.width || canvas.width + 'px';
          img.style.height = canvas.style.height || canvas.height + 'px';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';

          if (cloneCanvases[idx]) {
            cloneCanvases[idx].replaceWith(img);
            console.log(`[PDF Export] Converted canvas ${idx + 1} to image`);
          }
        } catch (e) {
          console.warn(`[PDF Export] Could not convert canvas ${idx + 1} to image:`, e);
        }
      });
    }

    // Basic styling for white background
    clone.style.background = 'white';
    clone.style.padding = '20px';
    return clone;
  };

  // Helper to wrap a section in a PDF-only card container
  const createPdfCard = (contentEl, titleText = '') => {
    const card = document.createElement('div');
    card.style.border = '1px solid #e5e7eb';
    card.style.borderRadius = '8px';
    card.style.padding = '16px';
    card.style.margin = '12px 0';
    card.style.background = '#ffffff';

    if (titleText) {
      const header = document.createElement('div');
      header.style.fontSize = '16px';
      header.style.fontWeight = '600';
      header.style.marginBottom = '10px';
      header.style.color = '#000000';
      header.textContent = titleText;
      card.appendChild(header);
    }

    // Ensure content fits within card width
    contentEl.style.maxWidth = '100%';
    card.appendChild(contentEl);
    return card;
  };

  // Helper function to calculate color brightness
  const getBrightness = (color) => {
    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return (r * 299 + g * 587 + b * 114) / 1000;
    }
    
    // Handle hex format
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    }
    
    return 0; // Default to dark if can't parse
  };

  // PDF Export function - REFACTORED FOR HIGH QUALITY
  const exportToPDF = async () => {
    console.log('[PDF Export] Starting PDF export...');
    console.log('[PDF Export] Questions to analyze:', orderedAnalyzableQuestions.length);

    try {
      // Determine which questions to include based on settings  
      const questionsToInclude = orderedAnalyzableQuestions.filter(
        q => questionSettings[q.id]?.isHidden !== true
      );

      console.log('[PDF Export] Questions to include in PDF:', questionsToInclude.length);

      if (questionsToInclude.length === 0) {
        alert('No content is marked for PDF export. Please check "Include in PDF Export" for at least one question.');
        return;
      }

      // Build list of elements to render as separate sections (title + demographics + charts + tables)
      const elements = [];

      // --- 1. ENHANCED TITLE PAGE ---
      const titleContainer = document.createElement('div');
      titleContainer.style.background = '#ffffff';
      titleContainer.style.padding = '40px'; // More padding
      titleContainer.style.textAlign = 'center';
      titleContainer.style.width = '100%';
      
      const title = document.createElement('h1');
      title.textContent = `Analytics Report: ${survey?.title || 'Survey'}`;
      title.style.fontSize = '32px'; // Much larger title for impact
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '25px';
      title.style.color = '#000000';
      title.style.fontFamily = 'Arial, sans-serif'; // Use a reliable font
      
      const dateElement = document.createElement('p');
      dateElement.textContent = `Generated on: ${new Date().toLocaleDateString()}`;
      dateElement.style.fontSize = '16px';
      dateElement.style.color = '#333333';
      dateElement.style.marginTop = '15px';
      dateElement.style.fontFamily = 'Arial, sans-serif';
      
      titleContainer.appendChild(title);
      titleContainer.appendChild(dateElement);
      elements.push(titleContainer);

      // --- 2. DEMOGRAPHICS REMOVED ---

      // --- 3. QUESTION ANALYTICS (split into PDF-only cards for charts and tables per question) ---
      questionsToInclude.forEach((q) => {
        const questionEl = document.querySelector(`[data-question-id="${q.id}"]`);
        if (questionEl) {
          const chartsOnly = createCloneWithCharts(questionEl, 'charts');
          const tablesOnly = createCloneWithCharts(questionEl, 'tables');

          // Derive a friendly title for charts if available (prefer in-card headings)
          let chartsTitle = '';
          try {
            const headerCandidate = chartsOnly.querySelector('.section-title') || chartsOnly.querySelector('h4') || chartsOnly.querySelector('h3');
            const txt = (headerCandidate && headerCandidate.textContent || '').trim();
            if (txt && !/^Q\d+:/i.test(txt)) chartsTitle = txt; // avoid question header patterns
          } catch {}
          const chartsCard = createPdfCard(chartsOnly, chartsTitle);
          chartsCard.classList.add('pdf-card');
          elements.push(chartsCard);

          // Split each table into its own PDF card
          const tableNodes = Array.from(tablesOnly.querySelectorAll('table'));
          if (tableNodes.length > 0) {
            tableNodes.forEach((tbl, idx) => {
              // Attempt to derive a nearby heading for this table
              let titleText = '';
              try {
                // Prefer the closest heading above the table by position
                const headings = Array.from(
                  tablesOnly.querySelectorAll('h1,h2,h3,h4,h5,.section-title,.ranking-table-title,.nps-analysis-title')
                );
                const tblTop = tbl.getBoundingClientRect().top;
                let bestHeading = null;
                let bestTop = -Infinity;
                headings.forEach((h) => {
                  const hTop = h.getBoundingClientRect().top;
                  if (hTop < tblTop && hTop > bestTop) {
                    bestTop = hTop;
                    bestHeading = h;
                  }
                });
                if (bestHeading) {
                  titleText = (bestHeading.textContent || '').trim();
                }
                // Fallback: walk previous siblings if still not found
                if (!titleText) {
                  let p = tbl.previousElementSibling;
                  let guard = 0;
                  while (p && guard < 8 && !titleText) {
                    const className = (p.className || '').toString();
                    if (
                      ['H2', 'H3', 'H4', 'H5'].includes(p.tagName) ||
                      className.includes('section-title') ||
                      className.includes('ranking-table-title') ||
                      className.includes('nps-analysis-title')
                    ) {
                      const txt = (p.textContent || '').trim();
                      if (txt) titleText = txt;
                    }
                    p = p.previousElementSibling;
                    guard++;
                  }
                }
              } catch {}

              // Manual fallback based on table headers/content
              if (!titleText) {
                try {
                  const ths = Array.from(tbl.querySelectorAll('thead th'));
                  const headerLabels = ths.map(th => (th.textContent || '').trim().toLowerCase());
                  const has = (lbl) => headerLabels.includes(lbl);

                  if (has('value') && has('count') && headerLabels.some(h => h.includes('percent'))) {
                    titleText = 'Slider Value Distribution';
                  } else if (has('metric') && has('value')) {
                    // Typical for slider/numerical/NPS summary tables
                    // If we can spot NPS columns elsewhere, label accordingly
                    const bodyText = (tbl.textContent || '').toLowerCase();
                    if (bodyText.includes('promoters') || bodyText.includes('detractors')) {
                      titleText = 'NPS Statistical Summary';
                    } else if (bodyText.includes('average') || bodyText.includes('median')) {
                      titleText = 'Slider Statistical Summary';
                    } else {
                      titleText = 'Statistical Summary';
                    }
                  } else if (has('item') && (headerLabels.some(h => h.includes('average rank')) || bodyText?.includes('average rank'))) {
                    titleText = 'Average Rank per Item';
                  } else if ((has('option') || has('options')) && (has('count') || headerLabels.some(h => h.includes('%')))) {
                    titleText = 'Option Selection Distribution';
                  }
                } catch {}
              }

              const single = document.createElement('div');
              single.style.width = '100%';
              single.appendChild(tbl.cloneNode(true));

              const tableCard = createPdfCard(single, titleText || '');
              tableCard.classList.add('pdf-card');
              elements.push(tableCard);
            });
          } else {
            // Fallback: a single card containing whatever remains
            const tablesCard = createPdfCard(tablesOnly, '');
            tablesCard.classList.add('pdf-card');
            elements.push(tablesCard);
          }
        }
      });

      if (elements.length <= 1) { // Only title page
        alert('Nothing to export.');
        return;
      }

      // --- 4. INITIALIZE PDF WITH HIGH-QUALITY SETTINGS ---
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false, // Disabling compression is key for quality
      });
      const pageWidth = 210 - 20; // A4 width (210mm) - 10mm margin on each side
      const pageHeight = 297 - 20; // A4 height (297mm) - 10mm margin on each side

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];

        // --- 5. STYLE THE ELEMENT FOR PRINT BEFORE RENDERING ---
        // This is crucial for making text readable and layouts consistent.
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        el.style.width = '800px'; // Render at a fixed, larger pixel width for consistency
        el.style.minHeight = 'auto'; // Allow natural height
        el.style.overflow = 'visible'; // Ensure no content is clipped
        el.style.backgroundColor = '#ffffff';
        el.style.boxSizing = 'border-box';

        // Enhance all text elements within the element for better readability in the PDF
        const textElements = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span, td, th, li');
        textElements.forEach(textEl => {
          textEl.style.color = '#000000'; // Ensure pure black text for max contrast
          textEl.style.lineHeight = '1.5';
          // Try to prevent awkward page breaks within tables or sections
          if (textEl.tagName === 'TABLE' || textEl.tagName === 'TR') {
            textEl.style.pageBreakInside = 'auto';
          } else {
            textEl.style.pageBreakInside = 'avoid';
          }
        });

        document.body.appendChild(el);
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow styles to apply

        // Collect table positions relative to element (in pixels)
        const elementRect = el.getBoundingClientRect();
        const isPdfCard = !!(el.classList && el.classList.contains('pdf-card'));
        let tables = Array.from(el.querySelectorAll('table'))
          .map(tbl => {
            const r = tbl.getBoundingClientRect();
            const top = Math.max(0, r.top - elementRect.top);
            const height = r.height;
            return { top, bottom: top + height, height };
          })
          .filter(t => t.height > 20) // Filter tiny tables
          .sort((a, b) => a.top - b.top);

        // --- 6. RENDER WITH HIGH-QUALITY HTML2CANVAS SETTINGS ---
        // Adaptive scale to prevent memory errors on very tall elements
        let adaptiveScale = 3;
        const elementHeightPx = el.scrollHeight || el.getBoundingClientRect().height || 0;
        if (elementHeightPx > 6000) adaptiveScale = 2;
        if (elementHeightPx > 12000) adaptiveScale = 1.5;
        const canvas = await html2canvas(el, {
          scale: adaptiveScale, // Adaptive scale for memory safety
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          dpi: 300, // Explicitly set DPI for print quality
          letterRendering: true, // Improves text rendering
          logging: false,
          width: el.scrollWidth, // Use the actual width of the styled element
          height: el.scrollHeight, // Use the actual height
          scrollX: 0,
          scrollY: 0,
        });

        document.body.removeChild(el);

        const imgData = canvas.toDataURL('image/png', 1.0); // Use max quality PNG

        // --- 7. CALCULATE IMAGE DIMENSIONS AND ADD TO PDF ---
        const ratio = pageWidth / canvas.width; // mm per pixel for width scaling
        const imgHeight = canvas.height * ratio; // total image height when scaled to page width (mm)
        const pageHeightPx = pageHeight / ratio; // page height expressed in image pixels

        if (i > 0) pdf.addPage();

        // If the content fits on one page, add it and continue
        if (imgHeight <= pageHeight) {
          pdf.addImage(imgData, 'PNG', 10, 10, pageWidth, imgHeight, undefined, 'FAST');
          continue;
        }

        // --- 8. BUILD SECTIONS ---
        // For PDF cards, treat the whole card as one section to avoid splitting title/table across separate pages
        const sectionStarts = isPdfCard
          ? [0]
          : [0, ...tables.map(t => t.top)].filter((v, idx, arr) => idx === 0 || v !== arr[idx - 1]);
        const marginTopMm = 10;

        for (let s = 0; s < sectionStarts.length; s++) {
          const startPx = sectionStarts[s];
          const endPx = s < sectionStarts.length - 1 ? sectionStarts[s + 1] : canvas.height;

          let curPx = startPx;
          // Always start this section on a new page
          if (s > 0 || i > 0) pdf.addPage();

          while (curPx < endPx) {
            const sliceHeightPx = Math.min(pageHeightPx, endPx - curPx);
            const yOffsetMm = marginTopMm - (curPx * ratio);
            pdf.addImage(imgData, 'PNG', 10, yOffsetMm, pageWidth, imgHeight, undefined, 'FAST');
            curPx += sliceHeightPx;
            if (curPx < endPx) {
              pdf.addPage();
            }
          }
        }
      }

      const fileName = `${survey?.title || 'Survey'}_Analytics_Report.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please check the console for details.');
    }
  };

  // Export raw data to Excel
  const exportToExcel = async () => {
    try {
      const response = await reportTabAPI.exportExcelReport(surveyId, {});
      const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `survey_${surveyId}_raw_data.xlsx`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Error exporting Excel. Please try again.');
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  // Filter questions into analyzable and reference-only lists - using useMemo to stabilize dependencies
  const analyzableQuestions = React.useMemo(() => {
    return survey?.questions?.filter(q => !EXCLUDED_ANALYSIS_TYPES.has(q.question_type)) || [];
  }, [survey?.questions]);

  const referenceQuestions = React.useMemo(() => {
    return survey?.questions?.filter(q => EXCLUDED_ANALYSIS_TYPES.has(q.question_type)) || [];
  }, [survey?.questions]);

  // Create ordered analyzable questions based on displayOrder or original sequence
  const orderedAnalyzableQuestions = React.useMemo(() => {
    return [...analyzableQuestions].sort((a, b) => {
      const aOrder = questionSettings[a.id]?.displayOrder || a.sequence_number || 999;
      const bOrder = questionSettings[b.id]?.displayOrder || b.sequence_number || 999;
      return aOrder - bOrder;
    });
  }, [analyzableQuestions, questionSettings]);

  // Check if user is authenticated and handle business context redirection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Authentication required. Redirecting...');
      navigate('/login');
      return;
    }

    // Save business context when accessing analytics
    if (surveyId && business) {
      const analyticsContext = {
        surveyId,
        businessId: business.id,
        accessedAt: new Date().toISOString(),
        currentPath: location.pathname
      };
      localStorage.setItem('analytics_business_context', JSON.stringify(analyticsContext));
    }

    // Handle user redirection based on role
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'business_admin' && business) {
      // Business admin should be redirected to business admin dashboard
      const currentPath = location.pathname;
      if (!currentPath.includes('/business-admin/')) {
        navigate(`/business-admin/dashboard`);
        return;
      }
    } else if (userRole === 'super_admin') {
      // Super admin stays on current path (saved surveys path)
      // No redirection needed as they have access to all surveys
    }
  }, [navigate, surveyId, business, location.pathname, isBusinessAdmin, isSuperAdmin]);

  // Initialize question order state when questions are loaded
  useEffect(() => {
    if (orderedAnalyzableQuestions.length > 0 && questionOrder.length === 0) {
      const initialOrder = orderedAnalyzableQuestions.map((q, index) => ({
        id: q.id,
        order: questionSettings[q.id]?.displayOrder || index + 1
      }));
      setQuestionOrder(initialOrder);
    }
  }, [orderedAnalyzableQuestions, questionOrder.length, questionSettings]);

  // Fetch the main survey details
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!surveyId) {
        console.error('[ANALYTICS_DASHBOARD] No survey ID provided');
        setError('No survey ID provided');
        setLoading(false);
        return;
      }

      console.log(`[ANALYTICS_DASHBOARD] Starting fetch for survey ${surveyId}`);
      setLoading(true);
      setError(null);

      try {
        console.log(`[ANALYTICS_DASHBOARD] Making API call to get survey ${surveyId}`);
        const response = await surveyAPI.getById(surveyId);

        console.log('[ANALYTICS_DASHBOARD] ✅ Survey fetch successful:', response.data);
        setSurvey(response.data);

        // Load chart settings from backend (backend is the source of truth)
        try {
          const chartSettingsResponse = await chartAPI.getChartSettings(surveyId);
          console.log('[ANALYTICS_DASHBOARD] Raw response from chartAPI:', chartSettingsResponse.data);

          // Backend returns {settings: {...}} structure
          const settings = chartSettingsResponse.data.settings || {};
          setGlobalChartType(settings.global?.chartType || 'bar');
          setGlobalChartColor(settings.global?.chartColor || '#36A2EB');
          setGlobalShowPercentages(settings.global?.showPercentages ?? true);
          setGlobalShowLegend(settings.global?.showLegend ?? true);
          setQuestionSettings(settings.questions || {});

          console.log('[ANALYTICS_DASHBOARD] ✅ Loaded settings from backend:', settings);
        } catch (settingsErr) {
          console.warn('[ANALYTICS_DASHBOARD] Could not load chart settings, using defaults:', settingsErr);
          // Use default settings if loading fails
          setGlobalChartType('bar');
          setGlobalChartColor('#36A2EB');
          setGlobalShowPercentages(true);
          setGlobalShowLegend(true);
          setQuestionSettings({});
        }


        // Initialize question options
        const options = {};
        if (response.data?.questions) {
          for (const q of response.data.questions) {
            if (!EXCLUDED_ANALYSIS_TYPES.has(q.question_type)) {
              try {
                const analyticsResponse = await analyticsAPI.getQuestionAnalyticsUnified(surveyId, q.id);
                const analytics = analyticsResponse.data;
                // Handle different analytics types
                let distribution = null;
                if (analytics?.analytics?.options_distribution) {
                  // Single choice distribution
                  distribution = analytics.analytics.options_distribution;
                } else if (analytics?.analytics?.option_distribution) {
                  // Multiple choice distribution
                  distribution = analytics.analytics.option_distribution;
                } else if (analytics?.analytics?.distribution && analytics?.analytics?.type === 'slider_stats') {
                  // Slider/rating distribution - filter out N/A values for settings panel
                  distribution = analytics.analytics.distribution.filter(item => {
                    const value = item.value;
                    return value !== null && value !== undefined &&
                      value !== 'NA' && value !== 'N/A' && value !== 'Not Applicable' &&
                      !isNaN(Number(value));
                  });
                }

                if (distribution) {
                  options[q.id] = distribution.map(opt => ({
                    label: opt.option || opt.hidden_label || String(opt.value) || 'Unknown',
                    count: opt.count
                  }));
                }
              } catch (err) {
                console.error(`Error fetching options for question ${q.id}:`, err);
                options[q.id] = [];
              }
            }
          }
        }
        setQuestionOptions(options);
      } catch (err) {
        console.error('[ANALYTICS_DASHBOARD] ❌ Error fetching survey:', err);
        console.error('[ANALYTICS_DASHBOARD] Error details:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data
        });

        let errorMessage = 'Failed to load survey data';
        if (err.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (err.response?.status === 403) {
          errorMessage = 'Access denied. You do not have permission to view this survey.';
        } else if (err.response?.status === 404) {
          errorMessage = 'Survey not found or has been deleted.';
        } else if (err.response?.data?.error) {
          errorMessage = err.response.data.error;
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  // Add useEffect for window resize handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when clicking overlay (mobile only)
  const handleOverlayClick = () => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Helper function to check if we're on the report view (index route)
  const isReportView = () => {
    return location.pathname === `/analytics/${surveyId}`;
  };

  // Demographics settings functionality removed

  // Helper function to restore business context
  const restoreBusinessContext = () => {
    try {
      const savedContext = localStorage.getItem('analytics_business_context');
      if (savedContext) {
        const context = JSON.parse(savedContext);
        console.log('[ANALYTICS_CONTEXT] Restored business context:', context);
        return context;
      }
    } catch (error) {
      console.error('[ANALYTICS_CONTEXT] Error restoring business context:', error);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analytics dashboard...</p>
          <small>Survey ID: {surveyId}</small>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard">
        <div className="error-container">
          <h2>❌ Unable to Load Analytics</h2>
          <p>{error}</p>
          <div className="error-details">
            <strong>Survey ID:</strong> {surveyId}
            <br />
            <small>Check the browser console for more details</small>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!survey) {
    console.warn('[ANALYTICS_DASHBOARD] Survey data is null after successful fetch');
    return (
      <div className="analytics-dashboard">
        <div className="error-container">
          <h2>⚠️ No Survey Data</h2>
          <p>Survey data could not be loaded.</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  console.log('[ANALYTICS_DASHBOARD] ✅ Rendering MergeAnalyticsDashboard with survey:', survey.title);

  return (
    <div className="analytics-dashboard-container">
      {/* Sidebar Toggle Button */}
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        <i className="ri-menu-line"></i>
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Sidebar */}
      <div className={`analytics-dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div>
          <h2 className="analytics-dashboard-title">Analytics</h2>
          <nav>
            {/* Back to Survey Button */}
            <button
              className="analytics-dashboard-back"
              onClick={() => navigate('/savedsurveys')}
            >
              <i className="ri-arrow-left-line"></i>
              Back to Surveys
            </button>

            {/* Report Group */}
            <div className="analytics-sidebar-group">
              <h3>Report</h3>
              <NavLink
                to={`/analytics/${surveyId}`}
                end
                className={({ isActive }) => `analytics-dashboard-link ${isActive ? "active" : ""}`}
              >
                <i className="ri-file-text-line"></i>
                Report
              </NavLink>
            </div>

            {/* AI Insights Group */}
            <div className="analytics-sidebar-group">
              <h3>AI Insights</h3>
              <NavLink
                to={`/analytics/${surveyId}/ai-summary`}
                className={({ isActive }) => `analytics-dashboard-link ${isActive ? "active" : ""}`}
              >
                <i className="ri-brain-line"></i>
                AI Report
              </NavLink>
            </div>
          </nav>
        </div>
      </div>

      {/* Fixed Header */}
      <div className="analytics-fixed-header">
        <h2 className="survey-title">{survey?.title}</h2>

        <div className="export-buttons-group">
          <button
            className="export-btn"
            onClick={exportToPDF}
          >
            <i className="ri-file-pdf-line"></i>
            Export PDF
          </button>

          <button
            className="export-btn"
            onClick={exportToExcel}
          >
            <i className="ri-file-excel-2-line"></i>
            Export Raw Data
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="analytics-dashboard-yo">
        {/* This will render the child routes */}
        <Outlet context={{ surveyId }} />

        {/* Question List Section - Only show on report view */}
        {isReportView() && (
          <>
            {/* Demographics Section Removed */}

            <div className="analytics-dashboard-questions">
              <h3>Question Results</h3>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="questions">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {orderedAnalyzableQuestions.map((q, index) => (
                        <Draggable key={q.id} draggableId={q.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              data-question-id={q.id}
                              style={{
                                ...provided.draggableProps.style,
                                marginBottom: '20px',
                                opacity: snapshot.isDragging ? 0.8 : 1,
                                transform: snapshot.isDragging
                                  ? `${provided.draggableProps.style?.transform} rotate(2deg)`
                                  : provided.draggableProps.style?.transform
                              }}
                            >
                              <div {...provided.dragHandleProps}>
                                <QuestionAnalyticsWithSettings
                                  key={q.id}
                                  question={q}
                                  surveyId={surveyId}
                                  questionSettings={questionSettings[q.id] || {}}
                                  globalSettings={{
                                    chartType: globalChartType,
                                    chartColor: globalChartColor,
                                    showPercentages: globalShowPercentages,
                                    showLegend: globalShowLegend
                                  }}
                                  onSettingsChange={(field, value) => updateQuestionSetting(q.id, field, value)}
                                  questionOptions={questionOptions[q.id] || []}
                                  index={index}
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            {/* Reference Data Section */}
            {referenceQuestions.length > 0 && (
              <div className="analytics-dashboard-reference-questions">
                <h3 style={{ color: 'black', marginTop: '15px' }}>Reference Data (Included in Excel Export)</h3>
                <p className="reference-info" style={{ color: '#333' }}>
                  The following question types are not visualized here but their data is available in the raw data export (Excel):
                  Upload File (Filename), Signature (Yes/No), Date Picker (Date), Email Input (Email).
                </p>
                {referenceQuestions.map((q) => (
                  <div key={q.id} className="analytics-dashboard-question-item reference-item">
                    <div className="question2-text">
                      <strong>#{q.sequence_number || 'N/A'}:</strong> {q.question_text}
                    </div>
                    <span className="reference-note">See Excel Export</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  loading: {
    margin: 20,
    fontSize: '1.1em',
    textAlign: 'center',
    padding: '40px'
  },
  error: {
    color: 'red',
    margin: 20,
    padding: '20px',
    border: '1px solid #ffcccc',
    borderRadius: '4px',
    backgroundColor: '#fff8f8'
  },
  title: {
    fontSize: '1.8em',
    marginBottom: 10,
    color: '#333'
  },
  advancedControls: {
    marginBottom: 20,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  advancedButton: {
    backgroundColor: '#17a2b8',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  panelContainer: {
    border: '1px solid #ccc',
    padding: 20,
    borderRadius: 4,
    marginBottom: 20,
    backgroundColor: '#fff'
  },
  divider: {
    margin: '20px 0',
    border: 'none',
    borderTop: '1px solid #ddd'
  },
  questionList: {
    marginTop: 15
  },
  questionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #ddd',
    borderRadius: 4,
    padding: '12px 15px',
    marginBottom: '10px',
    backgroundColor: '#f9f9f9',
    transition: 'background-color 0.2s'
  },
  analyzeButton: {
    backgroundColor: '#28a745',
    border: 'none',
    padding: '8px 14px',
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  noQuestions: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px'
  },
  analyticsPanel: {
    marginTop: 20,
    border: '1px solid #aaa',
    padding: 20,
    borderRadius: 4,
    backgroundColor: '#fff'
  },
  analyticsPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px'
  },
  closeButton: {
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '8px 15px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '14px'
  }
};