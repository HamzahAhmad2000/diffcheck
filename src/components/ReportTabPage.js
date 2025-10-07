// src/components/ReportTabPage.js
// (Keep imports as they are)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { debounce } from 'lodash'; // For autosave
import { format } from 'date-fns'; // For default view naming

// Import API clients
import { reportTabAPI, surveyAPI, analyticsAPI, chartAPI } from '../services/apiClient';

// Import Child Components
import MetricCard from './AnalyticsComponents/MetricCard';
import GridAnalytics from './AnalyticsComponents/GridAnalytics';
import OpenEndedDisplay from './AnalyticsComponents/OpenEndedDisplay';
import BatchReportCustomization from './AnalyticsComponents/BatchReportCustomization';
import ReportDownloadControl from './AnalyticsComponents/ReportDownloadControl';
import SurveyPDFGenerator from './AnalyticsComponents/SurveyPDFGenerator'; // PDF Logic Component/Class
import Sidebar from './Sidebar'; // Sidebar Layout
import ComparisonChartWrapper from './AnalyticsComponents/ComparisonChartWrapper'; // Handles comparison rendering
// WordCloudViewer is imported/used within OpenEndedDisplay now
import ReportDemographicsDisplay from './AnalyticsComponents/ReportDemographicsDisplay'; // *** ADD THIS IMPORT ***
import ReportQuestionDisplay from './AnalyticsComponents/ReportQuestionDisplay'; // Keep this import
import ReportGridDisplay from './AnalyticsComponents/ReportGridDisplay';
// Drag and drop for question ordering
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Import CSS
import './AnalyticsDashboard.css'; // Main dashboard layout styles
import './AnalyticsComponents/AnalyticsComponents.css'; // Styles for cards, charts etc.
import '../styles/CreateSurvey.css'; // For modal styles


// --- Constants --- (Keep existing constants: EXCLUDED_ANALYSIS_TYPES, DEFAULT_CHART_COLOR, LS_KEY_BASE, LS_VIEWS_KEY_BASE, AUTOSAVE_VIEW_NAME)
const EXCLUDED_ANALYSIS_TYPES = new Set(['document-upload', 'signature', 'date-picker', 'email-input', 'content-text', 'content-media']); // Refined list
const DEFAULT_CHART_COLOR = '#36A2EB';
const LS_KEY_BASE = 'reportSettings';
const LS_VIEWS_KEY_BASE = 'savedReportViews';
const AUTOSAVE_VIEW_NAME = '_latest_autosave'; // Fixed name for autosave

// --- Helper Functions --- (Keep existing: getDefaultChartType, formatTime)
const getDefaultChartType = (questionType) => {
    // Adjusted based on spec: Scale often needs distribution view
    switch (questionType) {
        case 'multiple-choice': case 'dropdown': case 'single-image-select': return 'pie';
        case 'checkbox': case 'rating': case 'star-rating': case 'nps': case 'numerical-input': case 'multiple-image-select': case 'scale': return 'bar'; // Scale defaults to bar now
        default: return 'bar';
    }
};
const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0) return 'N/A';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
};

// --- Main Component ---
const ReportTabPage = () => {
    const { surveyId } = useParams();

    // --- Base Data State --- (Keep existing: survey, summaryData, demographicsData, questionOptions, availableFilterOptions, loading, initialLoadComplete, error)
    const [survey, setSurvey] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [demographicsData, setDemographicsData] = useState(null); // Holds FULL unfiltered base data
    const [questionOptions, setQuestionOptions] = useState({}); // {qId: [{label, count}]} for color pickers
    const [availableFilterOptions, setAvailableFilterOptions] = useState({ age_groups: [], locations: [], genders: [], education: [], companies: [], cohort_tags: [] });
    const [loading, setLoading] = useState(true); // General loading state
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [error, setError] = useState(null);

    // --- UPDATED: reportSettings State Initialization ---
    const [reportSettings, setReportSettings] = useState({
        global: {
            chartType: 'bar',
            chartColor: DEFAULT_CHART_COLOR,
            showPercentages: true,
            showLegend: true,
            dataLabelFormat: 'percent' // 'percent', 'count', 'both', 'none'
        },
        questions: {}, // Populated dynamically based on survey + fetched settings
        demographics: { // Default structure for expected demo categories
            age_groups: { chartType: 'bar', chartColor: '#36A2EB', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
            genders: { chartType: 'pie', chartColor: '#FF6384', showPercentages: true, showLegend: true, customColors: [], dataLabelFormat: 'percent' },
            locations: { chartType: 'bar', chartColor: '#2ECC71', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
            education: { chartType: 'bar', chartColor: '#9B59B6', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
            companies: { chartType: 'bar', chartColor: '#E67E22', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
            cohort_tags: { chartType: 'bar', chartColor: '#f1c40f', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
        },
        pdfExportOptions: { // Default PDF export options nested within settings
            includeDemographics: true,
            showWordCloudData: true, // Table of top words
            showOpenEndedResponses: true, // List of recent/all responses
            openEndedResponseLimit: 10, // Max number of responses to show in PDF list
        },
    });


    

    // --- Filtering State --- (Keep existing)
    const [isIncludeAll, setIsIncludeAll] = useState(true);
    const [filterState, setFilterState] = useState({ age_group: [], location: [], gender: [], education: [], company: [], cohort_tag: [], startDate: null, endDate: null });
    const [filteredDataGroup1, setFilteredDataGroup1] = useState(null);
    const [currentSampleSize, setCurrentSampleSize] = useState(null);

    // --- Comparison State --- (Keep existing)
    const [isComparisonActive, setIsComparisonActive] = useState(false);
    const [comparisonState, setComparisonState] = useState({ dimension: null, segments: [] });
    const [group1Name, setGroup1Name] = useState('Group 1');
    const [group2Name, setGroup2Name] = useState('Group 2');
    const [filteredDataGroup2, setFilteredDataGroup2] = useState(null);
    const [sampleSizeGroup1, setSampleSizeGroup1] = useState(null);
    const [sampleSizeGroup2, setSampleSizeGroup2] = useState(null);
    const [comparisonSegmentCounts, setComparisonSegmentCounts] = useState({});

    // --- UI / PDF State --- (Keep existing: isSidebarOpen, isCustomizationOpen, generatingPdf, pdfProgress, pdfError)
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState(0);
    const [pdfError, setPdfError] = useState(null);
    // Selected Question state remains needed for potentially opening a specific panel/modal
    const [selectedQuestionId, setSelectedQuestionId] = useState(null);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    // --- Saved Views State --- (Keep existing)
    const [savedViews, setSavedViews] = useState([]);
    const [currentViewName, setCurrentViewName] = useState(null);

    // --- Derived Keys --- (Keep existing)
    const LS_KEY = useMemo(() => `${LS_KEY_BASE}-${surveyId}`, [surveyId]);
    const LS_VIEWS_KEY = useMemo(() => `${LS_VIEWS_KEY_BASE}-${surveyId}`, [surveyId]);


    // --- UPDATED: Settings Processing Helper ---
    const processFetchedSettings = useCallback((currentSurvey, fetchedSettings) => {
        console.log("Processing fetched/default settings...");
        // BASE DEFAULTS for the entire structure
        const baseDefaults = {
            global: {
                chartType: 'bar',
                chartColor: DEFAULT_CHART_COLOR,
                showPercentages: true,
                showLegend: true,
                dataLabelFormat: 'percent' // Default format
            },
            questions: {}, // Populated based on currentSurvey
            demographics: { // Default structure for expected demo categories
                age_groups: { chartType: 'bar', chartColor: '#36A2EB', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
                genders: { chartType: 'pie', chartColor: '#FF6384', showPercentages: true, showLegend: true, customColors: [], dataLabelFormat: 'percent' },
                locations: { chartType: 'bar', chartColor: '#2ECC71', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
                education: { chartType: 'bar', chartColor: '#9B59B6', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
                companies: { chartType: 'bar', chartColor: '#E67E22', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
                cohort_tags: { chartType: 'bar', chartColor: '#f1c40f', showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' },
                // Add other potential demo keys if known, otherwise they might be added dynamically below
            },
            pdfExportOptions: { // Nested PDF options defaults
                includeDemographics: true,
                showWordCloudData: true,
                showOpenEndedResponses: true,
                openEndedResponseLimit: 10,
            },
        };

        // Deep clone base defaults to prevent modification
        let finalSettings = JSON.parse(JSON.stringify(baseDefaults));
        const safeFetchedSettings = fetchedSettings || {}; // Ensure fetchedSettings is an object

        // 1. Merge Global Settings
        if (safeFetchedSettings.global) {
            finalSettings.global = {
                ...finalSettings.global, // Start with defaults
                ...safeFetchedSettings.global,
                chartColor: safeFetchedSettings.global.chartColor || finalSettings.global.chartColor
            };
            // Coerce global booleans
            finalSettings.global.showPercentages = finalSettings.global.showPercentages === true || String(finalSettings.global.showPercentages).toLowerCase() === 'true';
            finalSettings.global.showLegend = finalSettings.global.showLegend === true || String(finalSettings.global.showLegend).toLowerCase() === 'true';
        }

        // 2. Merge Demographics Settings (Robustly)
        const demoKeys = new Set([...Object.keys(finalSettings.demographics), ...Object.keys(safeFetchedSettings.demographics || {})]);
        demoKeys.forEach(key => {
            const fetchedDemoSetting = safeFetchedSettings.demographics?.[key];
            // Ensure the key exists in finalSettings, adding a default structure if needed
            if (!finalSettings.demographics[key]) {
                 finalSettings.demographics[key] = { chartType: 'bar', chartColor: finalSettings.global.chartColor, showPercentages: true, showLegend: false, customColors: [], dataLabelFormat: 'percent' };
            }
            // Merge fetched settings over the default/existing structure
            finalSettings.demographics[key] = {
                ...finalSettings.demographics[key],
                ...(fetchedDemoSetting || {})
            };
             // Coerce booleans and ensure array for customColors
             finalSettings.demographics[key].showPercentages = finalSettings.demographics[key].showPercentages === true || String(finalSettings.demographics[key].showPercentages).toLowerCase() === 'true';
             finalSettings.demographics[key].showLegend = finalSettings.demographics[key].showLegend === true || String(finalSettings.demographics[key].showLegend).toLowerCase() === 'true';
             finalSettings.demographics[key].customColors = Array.isArray(finalSettings.demographics[key].customColors) ? finalSettings.demographics[key].customColors : [];
             finalSettings.demographics[key].dataLabelFormat = finalSettings.demographics[key].dataLabelFormat || finalSettings.global.dataLabelFormat; // Inherit global if missing
        });


        // 3. Merge Question Settings (Ensure all survey questions included)
        const validQuestions = (currentSurvey?.questions || []).filter(q => q.question_type);
        validQuestions.forEach((q, index) => {
            const qIdStr = String(q.id); // Use string ID consistently
            const apiSetting = safeFetchedSettings.questions?.[qIdStr];
            const defaultQTypeChart = getDefaultChartType(q.question_type);

            // Define BASE defaults for this specific question
            const baseQSetting = {
                isHidden: false,
                chartType: defaultQTypeChart || finalSettings.global.chartType,
                chartColor: finalSettings.global.chartColor,
                customColors: [],
                customTitle: '',
                showPercentages: finalSettings.global.showPercentages,
                showLegend: finalSettings.global.showLegend,
                dataLabelFormat: finalSettings.global.dataLabelFormat,
                // Specific toggles - default based on type or global preference
                showStatsTable: !['multiple-choice', 'checkbox', 'open-ended', 'text-input', 'single-image-select', 'multiple-image-select', 'ranking', 'document-upload', 'signature', 'date-picker', 'email-input'].includes(q.question_type), // Default true for numeric/scale/rating/grid
                showResponseDist: !['open-ended', 'text-input', 'document-upload', 'signature', 'date-picker', 'email-input'].includes(q.question_type), // Default true for most
                showNA: true, // Default SHOW N/A
                // Per-stat toggles (default true)
                showMean: true,
                showMedian: true,
                showMin: true,
                showMax: true,
                showStdDev: true,
                // Open-ended specific defaults
                showWordCloud: q.question_type === 'open-ended',
                showDropdownResponses: q.question_type === 'open-ended',
                // Image specific defaults
                showThumbnails: ['single-image-select', 'multiple-image-select'].includes(q.question_type),
                // Display Order: Use saved/DB sequence first, then survey sequence, then index
                displayOrder: q.report_sequence ?? q.sequence_number ?? index + 1,
                // Add indexAxis for potential horizontal bar override
                indexAxis: 'x' // Default to vertical
            };

            // Merge API settings over the base defaults
            const mergedSetting = { ...baseQSetting, ...(apiSetting || {}) };

            // --- Coerce ALL boolean values after merge ---
            mergedSetting.isHidden = mergedSetting.isHidden === true || String(mergedSetting.isHidden).toLowerCase() === 'true';
            mergedSetting.showPercentages = mergedSetting.showPercentages === true || String(mergedSetting.showPercentages).toLowerCase() === 'true';
            mergedSetting.showLegend = mergedSetting.showLegend === true || String(mergedSetting.showLegend).toLowerCase() === 'true';
            mergedSetting.showStatsTable = mergedSetting.showStatsTable === true || String(mergedSetting.showStatsTable).toLowerCase() === 'true';
            mergedSetting.showResponseDist = mergedSetting.showResponseDist === true || String(mergedSetting.showResponseDist).toLowerCase() === 'true';
            mergedSetting.showNA = mergedSetting.showNA === true || String(mergedSetting.showNA).toLowerCase() === 'true';
            mergedSetting.showMean = mergedSetting.showMean !== false && String(mergedSetting.showMean).toLowerCase() !== 'false';
            mergedSetting.showMedian = mergedSetting.showMedian !== false && String(mergedSetting.showMedian).toLowerCase() !== 'false';
            mergedSetting.showMin = mergedSetting.showMin !== false && String(mergedSetting.showMin).toLowerCase() !== 'false';
            mergedSetting.showMax = mergedSetting.showMax !== false && String(mergedSetting.showMax).toLowerCase() !== 'false';
            mergedSetting.showStdDev = mergedSetting.showStdDev !== false && String(mergedSetting.showStdDev).toLowerCase() !== 'false';
            mergedSetting.showWordCloud = mergedSetting.showWordCloud === true || String(mergedSetting.showWordCloud).toLowerCase() === 'true';
            mergedSetting.showDropdownResponses = mergedSetting.showDropdownResponses === true || String(mergedSetting.showDropdownResponses).toLowerCase() === 'true';
            mergedSetting.showThumbnails = mergedSetting.showThumbnails === true || String(mergedSetting.showThumbnails).toLowerCase() === 'true';
            // Ensure customColors is an array
            mergedSetting.customColors = Array.isArray(mergedSetting.customColors) ? mergedSetting.customColors : [];

            // Validate and parse displayOrder after merge
            const orderVal = mergedSetting.displayOrder;
            if (orderVal === '' || orderVal === undefined || orderVal === null) {
                mergedSetting.displayOrder = baseQSetting.displayOrder; // Fallback if empty/null
            } else {
                const parsedOrder = parseInt(orderVal, 10);
                // Keep default if parsing fails or is not positive
                mergedSetting.displayOrder = (isNaN(parsedOrder) || parsedOrder < 1) ? baseQSetting.displayOrder : parsedOrder;
            }
            // Assign the final processed setting
            finalSettings.questions[qIdStr] = mergedSetting;
        });

        // 4. Merge PDF Export Options
        if (safeFetchedSettings.pdfExportOptions) {
            const pdfOptions = { ...safeFetchedSettings.pdfExportOptions };
            // Coerce booleans and parse number
            pdfOptions.includeDemographics = pdfOptions.includeDemographics === true || String(pdfOptions.includeDemographics).toLowerCase() === 'true';
            pdfOptions.showWordCloudData = pdfOptions.showWordCloudData === true || String(pdfOptions.showWordCloudData).toLowerCase() === 'true';
            pdfOptions.showOpenEndedResponses = pdfOptions.showOpenEndedResponses === true || String(pdfOptions.showOpenEndedResponses).toLowerCase() === 'true';
            pdfOptions.openEndedResponseLimit = parseInt(pdfOptions.openEndedResponseLimit, 10) || 10; // Default to 10 if invalid

            finalSettings.pdfExportOptions = { ...finalSettings.pdfExportOptions, ...pdfOptions };
        }

        console.log("Final Processed Settings:", finalSettings);
        return finalSettings;
    }, [DEFAULT_CHART_COLOR]); // Dependency on constant is fine



    const handleApplyFilters = useCallback(async (triggerLoad = true) => {
        // Check initialLoadComplete INSIDE the function
        if (!surveyId || !triggerLoad || !initialLoadComplete) {
            console.log("Apply Filters: Skipping fetch (conditions not met)", { surveyId, triggerLoad, initialLoadComplete });
            return;
        }
        console.log("Applying Filters/Comparison...");
        setLoading(true); setError(null);
        // Clear previous filtered data
        setFilteredDataGroup1(null); setFilteredDataGroup2(null);
        setCurrentSampleSize(null); setSampleSizeGroup1(null); setSampleSizeGroup2(null);
        setSelectedQuestionId(null); // Close any open question details
    
        const baseFilterPayload = isIncludeAll ? {} : { ...filterState };
        // Format dates if they exist
        if (baseFilterPayload.startDate) {
            try { baseFilterPayload.startDate = format(new Date(baseFilterPayload.startDate), 'yyyy-MM-dd'); }
            catch (e) { console.warn("Invalid start date format:", baseFilterPayload.startDate); delete baseFilterPayload.startDate; }
        } else delete baseFilterPayload.startDate;
        if (baseFilterPayload.endDate) {
            try { baseFilterPayload.endDate = format(new Date(baseFilterPayload.endDate), 'yyyy-MM-dd'); }
            catch (e) { console.warn("Invalid end date format:", baseFilterPayload.endDate); delete baseFilterPayload.endDate; }
        } else delete baseFilterPayload.endDate;
    
        // Prepare comparison payload if active
        let comparisonPayload = null;
        let currentGroup1Name = "Filtered Results"; // Default name
        let currentGroup2Name = "Group 2";
    
        if (isComparisonActive && comparisonState.dimension && comparisonState.segments.length === 2) {
            comparisonPayload = {
                dimension: comparisonState.dimension,
                segments: comparisonState.segments
            };
            // Set group names based on segments for clarity
            currentGroup1Name = comparisonState.segments[0] || "Segment 1";
            currentGroup2Name = comparisonState.segments[1] || "Segment 2";
            console.log(`Comparison Payload: Dimension=${comparisonPayload.dimension}, Segments=${comparisonPayload.segments.join(' vs ')}`);
        } else if (isComparisonActive) {
            toast.error("Please select exactly 2 segments for comparison.");
            setLoading(false);
            return; // Stop if comparison active but segments invalid
        } else {
            console.log(`Filter Payload (Single): ${JSON.stringify(baseFilterPayload)}`);
            // Ensure group name is appropriate when not comparing
            currentGroup1Name = isIncludeAll ? "Overall Results" : "Filtered Results";
        }
    
        setGroup1Name(currentGroup1Name); // Update group names in state
        setGroup2Name(currentGroup2Name);
    
        try {
            // *** USE THE NEW reportTabAPI ENDPOINT ***
            // This single call fetches data based on filters and comparison settings
            const response = await reportTabAPI.getReportData(surveyId, baseFilterPayload, comparisonPayload);
            const data = response.data; // Axios data is directly in response.data
    
            // Update state with fetched data
            if (data.group1) {
                setFilteredDataGroup1(data.group1);
                const size1 = data.group1.summary_metrics?.total_responses ?? 0;
                setSampleSizeGroup1(size1);
                // Set overall sample size if not comparing
                if (!isComparisonActive) {
                    setCurrentSampleSize(size1);
                }
            } else {
                 // Handle case where group1 data might be missing (shouldn't happen ideally)
                 setFilteredDataGroup1(null);
                 setSampleSizeGroup1(0);
                 if (!isComparisonActive) {
                     setCurrentSampleSize(0);
                 }
                 console.warn("Received no data for Group 1 from getReportData");
            }
    
            if (isComparisonActive && data.group2) {
                setFilteredDataGroup2(data.group2);
                const size2 = data.group2.summary_metrics?.total_responses ?? 0;
                setSampleSizeGroup2(size2);
                setCurrentSampleSize(null); // Clear overall sample size when comparing
            } else {
                // Clear group 2 data if not comparing or if API didn't return it
                setFilteredDataGroup2(null);
                setSampleSizeGroup2(null);
            }
    
            // Clear view name as filters have changed manually
            setCurrentViewName(null);
            toast.success("Filters Applied!");
    
        } catch (err) {
            // Error handling using the custom error object from apiClient interceptor
            const errorMsg = err.response?.data?.error || err.message || 'Failed to apply filters or comparison';
            setError(errorMsg);
            toast.error(`Filter Error: ${errorMsg}`);
            // Optionally reset to base data on filter error? Or just clear filtered data?
            // Let's clear filtered data to indicate failure
            setFilteredDataGroup1(null);
            setFilteredDataGroup2(null);
            setCurrentSampleSize(null);
            setSampleSizeGroup1(null);
            setSampleSizeGroup2(null);
        } finally {
            setLoading(false);
        }
    // Stable dependencies - functions defined with useCallback, primitives, and state directly used
    }, [
        surveyId,
        filterState, // State used directly
        isIncludeAll, // State used directly
        isComparisonActive, // State used directly
        comparisonState, // State used directly
        initialLoadComplete // State used directly
        // reportTabAPI is assumed stable (imported object)
    ]);

    
    const applySettingsSnapshot = useCallback((snapshot, triggerFilter = true) => {
        if (!snapshot) { console.warn("Attempted to apply null snapshot."); return; }
        console.log("Applying snapshot:", snapshot);
    
        // Restore filter/comparison state
        setFilterState(snapshot.filterState || { age_group: [], location: [], gender: [], education: [], company: [], cohort_tag: [], startDate: null, endDate: null });
        setIsIncludeAll(snapshot.isIncludeAll === undefined ? true : snapshot.isIncludeAll);
        setIsComparisonActive(snapshot.isComparisonActive || false);
        setComparisonState(snapshot.comparisonState || { dimension: null, segments: [] });
        setGroup1Name(snapshot.group1Name || 'Group 1');
        setGroup2Name(snapshot.group2Name || 'Group 2');
    
        // Restore UI/Report settings
        if (snapshot.reportSettings) {
            // Use processFetchedSettings which handles defaults and structure
            const reprocessedSettings = processFetchedSettings(survey, snapshot.reportSettings);
            setReportSettings(reprocessedSettings);
            console.log("Applied reportSettings from snapshot.");
        } else {
            // Fallback if snapshot didn't have settings
            const defaultSettings = processFetchedSettings(survey, {}); // Process empty object to get full defaults
            setReportSettings(defaultSettings);
            console.warn("Snapshot missing reportSettings, applying current defaults.");
        }
    
        // Trigger filter application if requested
        if (triggerFilter) {
            // Use setTimeout to ensure state updates are processed before triggering the fetch
            // handleApplyFilters will check initialLoadComplete internally
            setTimeout(() => { handleApplyFilters(); }, 0);
        }
        // No need to manage initialLoadComplete here
    
    // Stable dependencies: processFetchedSettings (useCallback), survey (state), handleApplyFilters (useCallback)
    }, [processFetchedSettings, survey, handleApplyFilters]);
    
    
    // --- UPDATED: Local Storage Functions ---
    const loadSettingsFromLocalStorage = useCallback(() => {
        if (!surveyId) return null;
        try {
            const localSettings = localStorage.getItem(LS_KEY);
            if (localSettings) {
                console.log("LS Load: Found settings.");
                const parsed = JSON.parse(localSettings);
                // Basic validation: Check for expected top-level keys
                if (parsed && parsed.global && parsed.questions && parsed.demographics && parsed.pdfExportOptions) {
                    return parsed;
                } else {
                    console.warn("LS Load: Invalid settings structure found, discarding.");
                    localStorage.removeItem(LS_KEY); // Remove invalid data
                }
            }
        } catch (err) { console.error('LS Load Settings Error:', err); }
        return null;
    }, [surveyId, LS_KEY]);

    const saveSettingsToLocalStorage = useCallback((settings) => {
        if (!surveyId || !settings) return;
        try {
            // Ensure structure before saving (optional, but good practice)
            if (settings.global && settings.questions && settings.demographics && settings.pdfExportOptions) {
                localStorage.setItem(LS_KEY, JSON.stringify(settings));
                console.log("LS Save: Settings saved.");
            } else {
                console.warn("LS Save: Attempted to save invalid settings structure. Aborting save.");
            }
        } catch (err) { console.error('LS Save Settings Error:', err); }
    }, [surveyId, LS_KEY]);

    // --- Local Storage Functions for Views --- (Keep existing: loadViewsFromLocalStorage, saveViewsToLocalStorage)
    const loadViewsFromLocalStorage = useCallback(() => {
        if (!surveyId) return [];
        try {
            const localViews = localStorage.getItem(LS_VIEWS_KEY);
            if (localViews) {
                const parsed = JSON.parse(localViews);
                console.log(`LS Load: Loaded ${parsed.length} views.`);
                // Basic validation: ensure it's an array of objects with name & settingsSnapshot
                if (Array.isArray(parsed) && parsed.every(v => typeof v === 'object' && v.name && v.settingsSnapshot)) {
                    return parsed;
                } else {
                    console.warn("LS Load: Invalid view format found, discarding.");
                    localStorage.removeItem(LS_VIEWS_KEY); // Remove invalid data
                }
            }
        } catch (err) { console.error('LS Load Views Error:', err); }
        return [];
    }, [surveyId, LS_VIEWS_KEY]);

    const saveViewsToLocalStorage = useCallback((views) => {
        if (!surveyId || !Array.isArray(views)) return;
        try {
            // Ensure structure before saving
            const validViews = views.filter(v => v && v.name && v.settingsSnapshot);
            localStorage.setItem(LS_VIEWS_KEY, JSON.stringify(validViews));
            console.log("LS Save: Views saved.");
        } catch (err) { console.error('LS Save Views Error:', err); }
    }, [surveyId, LS_VIEWS_KEY]);

    // --- UPDATED: Settings Processing Helper ---

    // --- Internal Helper: Fetch Question Options --- (Keep existing)
    const fetchQuestionOptionsInternal = useCallback(async (sId, questions, baseDemographics) => { // Pass base demographics
        const optionsData = { demographics: {} }; // Initialize with demo key
        const promises = [];
        for (const q of questions) {
            const chartableTypes = ['multiple-choice', 'dropdown', 'checkbox', 'single-image-select', 'multiple-image-select', 'scale', 'rating', 'star-rating', 'nps'];
            if (chartableTypes.includes(q.question_type) && !q.question_type.includes('grid')) {
                promises.push(
                    analyticsAPI.getQuestionAnalyticsUnified(sId, q.id)
                        .then(response => {
                            const analytics = response.data?.analytics;
                            let distribution = [];
                            // Handle various distribution keys from API
                            if (analytics?.options_distribution) distribution = analytics.options_distribution;
                            else if (analytics?.option_distribution) distribution = analytics.option_distribution;
                            else if (analytics?.distribution) distribution = analytics.distribution.map(d => ({ option: d.value, count: d.count }));
                            else if (analytics?.type === 'numeric_stats' && q.question_type === 'nps' && analytics.nps_segments) {
                                distribution = [
                                    { option: "Promoters (9-10)", count: analytics.nps_segments.promoters },
                                    { option: "Passives (7-8)", count: analytics.nps_segments.passives },
                                    { option: "Detractors (0-6)", count: analytics.nps_segments.detractors }
                                ];
                            }
                             // Include N/A option if present in the question definition
                             if (q.not_applicable || q.show_na) {
                                 const naOptionExists = distribution.some(item => (item.option?.toString() ?? '').toLowerCase() === 'n/a');
                                 if (!naOptionExists) {
                                     // Placeholder logic - ideally API provides N/A count
                                     // distribution.push({ option: "Not Applicable", count: analytics?.na_count ?? 0 });
                                 }
                             }

                            optionsData[q.id] = distribution
                                .map(item => ({ label: item.option?.toString() ?? 'N/A', count: item.count ?? 0 }))
                                .sort((a, b) => b.count - a.count); // Sort by count desc
                        })
                        .catch(err => { console.error(`Error fetching options for Q ${q.id}:`, err); optionsData[q.id] = []; })
                );
            } else {
                optionsData[q.id] = []; // No options needed for non-chartable types
            }
        }
        // Add demographic options (from *passed* base data)
        if (baseDemographics) {
            Object.keys(baseDemographics).forEach(key => {
                optionsData.demographics[key] = Object.entries(baseDemographics[key] || {})
                    .map(([label, details]) => ({ label, count: details.count ?? 0 }))
                    .sort((a, b) => b.count - a.count);
            });
        }
        await Promise.all(promises);
        return optionsData;
    }, []);

    // --- Initial Data Fetch useEffect --- (Uses reportTabAPI)
    useEffect(() => {
        let isMounted = true; // Track mount status

        const fetchAllData = async () => {
            if (!surveyId) { setError("Survey ID missing."); setLoading(false); return; }
            console.log("ReportTabPage: Initiating initial data fetch...");
            setLoading(true); setError(null); setInitialLoadComplete(false);
            setCurrentViewName(null); // Reset view name on fresh load

            try {
                // Fetch base survey structure and filter options first
                // *** USE NEW reportTabAPI ENDPOINT ***
                const baseDataRes = await reportTabAPI.getBaseData(surveyId);
                if (!isMounted) return;
                const baseData = baseDataRes.data; // Axios data is directly in response.data
                if (!baseData || !baseData.survey) throw new Error("Failed to load survey structure.");

                const fetchedSurvey = baseData.survey;
                // Filter out any entries without a question_type
                const filteredQuestions = (fetchedSurvey.questions || []).filter(q => q.question_type);
                setSurvey({ ...fetchedSurvey, questions: filteredQuestions });
                setAvailableFilterOptions(baseData.available_filter_options || { age_groups: [], locations: [], genders: [], education: [], companies: [], cohort_tags: [] });

                // Fetch summary, initial analytics (unfiltered), and settings in parallel
                const [summaryRes, initialAnalyticsRes, settingsRes] = await Promise.all([
                    surveyAPI.getSummary(surveyId).catch(err => { console.error("Summary fetch failed:", err); return { data: null }; }),
                    // *** USE NEW reportTabAPI FOR INITIAL (unfiltered) DATA ***
                    reportTabAPI.getReportData(surveyId, {}, null).catch(err => { console.error("Initial report data fetch failed:", err); return { data: { group1: null } }; }), // Fetch unfiltered data for group1, no comparison
                    // *** USE NEW reportTabAPI FOR SETTINGS ***
                    reportTabAPI.getReportSettings(surveyId).catch(err => { console.error("Settings fetch failed:", err); return { data: null }; }) // Fetch default user settings (or placeholder)
                ]);
                if (!isMounted) return;

                // Set Summary Data
                setSummaryData(summaryRes.data);

                // Set Initial Base Data (from unfiltered report data)
                const initialGroup1Data = initialAnalyticsRes.data?.group1;
                let baseDemographicsForOptions = {}; // Initialize demographics for options fetch
                if (initialGroup1Data) {
                    baseDemographicsForOptions = initialGroup1Data.demographics || {};
                    // Store base demographics + count
                    setDemographicsData({ demographics: baseDemographicsForOptions, total_responses: initialGroup1Data.summary_metrics?.total_responses ?? 0 });
                    setFilteredDataGroup1(initialGroup1Data); // Set initial view to unfiltered
                    setCurrentSampleSize(initialGroup1Data.summary_metrics?.total_responses ?? null);
                    console.log("Initial unfiltered data set for Group 1.");
                } else {
                    setDemographicsData(null);
                    setFilteredDataGroup1(null);
                    setCurrentSampleSize(null);
                    console.warn("Initial unfiltered analytics data could not be fetched or was empty.");
                }

                // Fetch Question Options (using base demographics if available)
                const qOptions = await fetchQuestionOptionsInternal(surveyId, filteredQuestions, baseDemographicsForOptions);
                if (!isMounted) return;
                setQuestionOptions(qOptions);
                console.log("Question options fetched.");

                // Process Settings (API or Local Storage Fallback)
                const fetchedApiSettings = settingsRes.data; // Settings are directly in data now
                const localSettings = (!fetchedApiSettings || Object.keys(fetchedApiSettings).length === 0) ? loadSettingsFromLocalStorage() : null;
                const settingsToProcess = fetchedApiSettings || localSettings || {}; // Use API > Local > Empty Object
                console.log("Settings source:", fetchedApiSettings ? "API" : (localSettings ? "Local Storage" : "Defaults"));
                const processedSettings = processFetchedSettings({ ...fetchedSurvey, questions: filteredQuestions }, settingsToProcess);
                setReportSettings(processedSettings);
                if (localSettings && !fetchedApiSettings) toast.info("Loaded settings from local backup.");

                // Load Saved Views List
                // *** USE NEW reportTabAPI ***
                let loadedViews = [];
                try {
                    // Assuming listSavedViews now correctly uses the placeholder user or actual auth
                    const viewsRes = await reportTabAPI.listSavedViews(surveyId);
                    loadedViews = viewsRes.data || []; // Expecting array like [{ id, name, updated_at }]
                    if (isMounted) setSavedViews(loadedViews);
                    console.log(`Loaded ${loadedViews.length} saved views from API.`);
                } catch (viewError) {
                    console.error("Failed to load saved views list from API:", viewError);
                    toast.error("Could not load saved views.");
                    // Attempt to load from local storage as a fallback for views
                    const localStoredViewsForFallback = loadViewsFromLocalStorage();
                    if(isMounted) setSavedViews(localStoredViewsForFallback);
                    console.log(`Loaded ${localStoredViewsForFallback.length} views from Local Storage fallback.`);
                }

                // Load and Apply Autosave from LOCAL STORAGE (Keep this local for now)
                const localStoredViews = loadViewsFromLocalStorage(); // Read local again for autosave
                const autoSave = localStoredViews.find(v => v.name === AUTOSAVE_VIEW_NAME);
                let appliedAutosave = false;
                if (autoSave && autoSave.settingsSnapshot) {
                    console.log("Applying locally autosaved view settings on startup.");
                    // Pass false to prevent immediate re-fetch
                    applySettingsSnapshot(autoSave.settingsSnapshot, false);
                    setCurrentViewName(AUTOSAVE_VIEW_NAME);
                    appliedAutosave = true;
                }

                 // *** Mark Initial Load Complete ***
                if (isMounted) {
                    setInitialLoadComplete(true);
                    console.log("Initial load complete.");

                    // Trigger filter fetch ONLY IF autosave was applied (to load data matching the autosaved filters)
                    if (appliedAutosave) {
                        console.log("Triggering handleApplyFilters after local autosave application.");
                        // Ensure this runs after initialLoadComplete=true state update is processed
                        setTimeout(() => { handleApplyFilters(true); }, 0);
                    }
                }

            } catch (err) {
                if (!isMounted) return;
                const errorMsg = err.response?.data?.error || err.message || 'Failed to load report data';
                setError(errorMsg); toast.error(`Error: ${errorMsg}`);
                // Attempt local settings load even on general fetch errors
                const localSettingsFallback = loadSettingsFromLocalStorage();
                if(localSettingsFallback) {
                    const processedFallback = processFetchedSettings(survey, localSettingsFallback); // Process even if survey fetch failed partially
                    if(isMounted) setReportSettings(processedFallback);
                    toast.info("Loaded settings from local backup due to API error.");
                }
                // Ensure initial load completes even on error
                if(isMounted) setInitialLoadComplete(true);
            } finally {
                if (isMounted) { setLoading(false); }
            }
        };

        fetchAllData();

        // Cleanup function
        return () => {
            isMounted = false;
            console.log("ReportTabPage: Unmounting or surveyId changed.");
        };

    // Ensure stable functions are used and dependencies are minimal/correct
    }, [
        surveyId,

    ]);

    // --- Callback for Saving Settings --- (Uses reportTabAPI)
    const handleSaveSettings = useCallback(async (newSettings) => {
        if (!surveyId) {
            toast.error("Survey ID missing. Cannot save settings.");
            return; // Return early if surveyId is missing
        }
        // Basic validation of the settings structure before attempting save
        if (!newSettings || !newSettings.global || !newSettings.questions || !newSettings.demographics || !newSettings.pdfExportOptions) {
            console.error("Invalid settings structure provided to handleSaveSettings:", newSettings);
            toast.error("Cannot save: Invalid settings data structure.");
            return; // Prevent saving invalid structure
        }

        console.log("Attempting to save report settings via API...");
        setLoading(true); // Indicate saving process

        try {
            // *** UPDATED API CALL ***
            // The new reportTabAPI expects the settings object directly
            await reportTabAPI.saveReportSettings(surveyId, newSettings);
            // *** END UPDATED API CALL ***

            // Update local state and local storage on successful API save
            setReportSettings(newSettings); // Update state with the settings that were successfully saved
            saveSettingsToLocalStorage(newSettings); // Update local backup

            toast.success('Report settings saved successfully!');
            setIsCustomizationOpen(false); // Close modal on success
        } catch (err) {
            // Error already logged by apiClient interceptor
            const errorMsg = err.response?.data?.error || err.message || 'Unknown save error';
            setError(`Save Error: ${errorMsg}`); // Update component error state if needed
            toast.error(`Save Error: ${errorMsg}`);
            // Optionally, you might want to revert local state changes here if API save fails,
            // or keep them and rely on the local storage backup. Current implementation keeps changes.
        } finally {
            setLoading(false); // Finish loading state
        }
    }, [surveyId, saveSettingsToLocalStorage]); // Dependencies: surveyId and the stable save function
    // --- Fetch Segment Counts --- (Keep existing)
    const fetchSegmentCounts = useCallback(async (dimension, segments) => {
        if (!surveyId || !dimension || segments.length === 0) {
            setComparisonSegmentCounts({}); return;
        }
        console.log(`Fetching counts for dimension: ${dimension}, segments: ${segments.join(', ')}`);
        try {
            // Use getDemographicAnalytics for simplicity, backend could optimize this
            const counts = {};
            const promises = segments.map(segment =>
                surveyAPI.getDemographicAnalytics(surveyId, { [dimension]: [segment] }) // Filter by one segment
                    .then(res => { counts[segment] = res.data?.total_responses ?? 0; })
                    .catch(err => { console.error(`Error fetching count for segment ${segment}:`, err); counts[segment] = 'Err'; })
            );
            await Promise.all(promises);
            console.log("Fetched Segment Counts:", counts);
            setComparisonSegmentCounts(counts);
        } catch (error) {
            console.error("Error fetching segment counts:", error);
            toast.error("Could not load segment counts.");
            setComparisonSegmentCounts({}); // Clear on error
        }
    }, [surveyId]);

    // --- useEffect to Fetch Segment Counts --- (Keep existing)
    useEffect(() => {
        if (isComparisonActive && comparisonState.dimension && comparisonState.segments.length > 0) {
            fetchSegmentCounts(comparisonState.dimension, comparisonState.segments);
        } else {
            setComparisonSegmentCounts({}); // Clear counts if inactive/incomplete
        }
    }, [isComparisonActive, comparisonState.dimension, comparisonState.segments, fetchSegmentCounts]);

    // --- Apply Filters/Comparison Handler --- (Keep existing, date formatting added)

    // --- UPDATED: Saved Views Handlers ---

    const handleSaveView = useCallback(() => {
        const viewName = prompt("Enter a name for this report view:", `Report View - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`);
        if (viewName && viewName.trim()) {
             if (viewName.trim() === AUTOSAVE_VIEW_NAME) {
                 toast.error(`Cannot manually save with the reserved name '${AUTOSAVE_VIEW_NAME}'.`);
                 return;
             }
            // Capture the *current* state, including the FULL reportSettings
            const currentSnapshot = {
                filterState, isIncludeAll, isComparisonActive, comparisonState,
                reportSettings, // Capture the ENTIRE current settings object
                group1Name, group2Name // Capture group names
            };

             // Basic validation before saving
             if (!currentSnapshot.reportSettings?.questions || !currentSnapshot.reportSettings?.global || !currentSnapshot.reportSettings?.demographics || !currentSnapshot.reportSettings?.pdfExportOptions) {
                  console.error("Attempting to save view with invalid/incomplete settings structure:", currentSnapshot.reportSettings);
                  toast.error("Error: Cannot save view due to incomplete settings data.");
                  return;
             }

            const existingViewIndex = savedViews.findIndex(v => v.name === viewName);
            let updatedViews;
            if (existingViewIndex > -1) {
                updatedViews = [...savedViews];
                updatedViews[existingViewIndex] = { name: viewName, settingsSnapshot: currentSnapshot };
                toast.success(`View "${viewName}" updated.`);
            } else {
                updatedViews = [...savedViews, { name: viewName, settingsSnapshot: currentSnapshot }];
                toast.success(`View "${viewName}" saved.`);
            }
            setSavedViews(updatedViews);
            saveViewsToLocalStorage(updatedViews);
            setCurrentViewName(viewName); // Set the newly saved/updated view as current
        }
        // Dependencies MUST include reportSettings
    }, [savedViews, saveViewsToLocalStorage, filterState, isIncludeAll, isComparisonActive, comparisonState, reportSettings, group1Name, group2Name]);

    // --- Load/Delete View Handlers --- (Keep existing, they rely on updated applySettingsSnapshot)
    const handleLoadView = useCallback((viewName) => {
        if (!viewName) return;
        const viewToLoad = savedViews.find(v => v.name === viewName);
        if (viewToLoad) {
            applySettingsSnapshot(viewToLoad.settingsSnapshot, true); // Apply and trigger filter fetch
            setCurrentViewName(viewName);
            toast.info(`Loaded view: ${viewName === AUTOSAVE_VIEW_NAME ? "Latest Autosaved" : viewName}`);
            setIsSidebarOpen(false); // Close sidebar after loading
        } else {
            toast.error(`View "${viewName}" not found.`);
        }
    }, [savedViews, applySettingsSnapshot]);

    const handleDeleteView = useCallback((viewName) => {
        if (viewName === AUTOSAVE_VIEW_NAME) {
             toast.error("Cannot delete the autosaved view."); return;
        }
        if (window.confirm(`Are you sure you want to delete the view "${viewName}"?`)) {
            const updatedViews = savedViews.filter(v => v.name !== viewName);
            setSavedViews(updatedViews);
            saveViewsToLocalStorage(updatedViews);
            if (currentViewName === viewName) {
                setCurrentViewName(null); // Clear current view if it was deleted
                 // Try loading autosave, otherwise reset to defaults
                 const autoSave = updatedViews.find(v => v.name === AUTOSAVE_VIEW_NAME); // Check updatedViews
                 if (autoSave) {
                     handleLoadView(AUTOSAVE_VIEW_NAME);
                 } else {
                     // Reset to default filters if no autosave
                     setIsIncludeAll(true);
                     setFilterState({ age_group: [], location: [], gender: [], education: [], company: [], cohort_tag: [], startDate: null, endDate: null });
                     setIsComparisonActive(false);
                     setComparisonState({ dimension: null, segments: [] });
                      // Reset reportSettings to defaults as well
                     const defaultSettings = processFetchedSettings(survey, {});
                     setReportSettings(defaultSettings);
                      handleApplyFilters(); // Re-apply default (all data)
                 }
            }
            toast.success(`View "${viewName}" deleted.`);
        }
    }, [savedViews, saveViewsToLocalStorage, currentViewName, handleLoadView, handleApplyFilters, processFetchedSettings, survey]); // Added processFetchedSettings, survey

    // --- UPDATED: Auto-Save Logic ---
    const debouncedAutoSave = useCallback(
        debounce((snapshotToSave) => {
            if (!initialLoadComplete || !survey) return; // Don't autosave during initial load or if survey isn't loaded
             console.log("Auto-saving latest view...");

             // Basic validation of the snapshot before saving
             if (!snapshotToSave || !snapshotToSave.reportSettings?.questions || Object.keys(snapshotToSave.reportSettings.questions).length === 0) {
                  console.warn("Skipping auto-save: Invalid or empty settings snapshot detected.");
                  return;
             }
             // Optional deeper check
              const firstQIdAuto = Object.keys(snapshotToSave.reportSettings.questions)[0];
              if (firstQIdAuto && snapshotToSave.reportSettings.questions[firstQIdAuto]) {
                   if (snapshotToSave.reportSettings.questions[firstQIdAuto].showNA === undefined || snapshotToSave.reportSettings.questions[firstQIdAuto].showThumbnails === undefined) {
                       console.warn("Warning: showNA or showThumbnails missing from sample question settings during auto-save.");
                   }
              }

            const autoSaveIndex = savedViews.findIndex(v => v.name === AUTOSAVE_VIEW_NAME);
            let updatedViews;
            const newAutoSaveEntry = { name: AUTOSAVE_VIEW_NAME, settingsSnapshot: snapshotToSave };

            if (autoSaveIndex > -1) {
                updatedViews = [...savedViews];
                updatedViews[autoSaveIndex] = newAutoSaveEntry;
            } else {
                updatedViews = [...savedViews, newAutoSaveEntry];
            }
            // Only save to LS, don't update state directly from debounce
            saveViewsToLocalStorage(updatedViews); // Use the LS save function
        }, 2000), // Save 2 seconds after the last change
        // Dependencies include reportSettings and the function to save to LS
        [savedViews, saveViewsToLocalStorage, initialLoadComplete, survey]
    );

    // useEffect for Auto-Save Trigger - NOW includes reportSettings
    useEffect(() => {
        if (initialLoadComplete && survey) {
            // Construct the snapshot including the FULL reportSettings
            const currentSnapshot = {
                filterState, isIncludeAll, isComparisonActive, comparisonState,
                reportSettings, // Capture the entire settings object
                group1Name, group2Name
            };
            debouncedAutoSave(currentSnapshot);
        }
        // Cleanup function
        return () => { debouncedAutoSave.cancel(); };
    }, [
        // Include ALL state pieces that should trigger an autosave
        filterState, isIncludeAll, isComparisonActive, comparisonState,
        reportSettings, // <<< CRUCIAL: Trigger autosave when settings change
        group1Name, group2Name,
        initialLoadComplete, survey, // Include survey
        debouncedAutoSave // Include the debounced function itself
    ]);


    // --- UPDATED: PDF Generation Callback ---
    const handleGeneratePDF = useCallback(async () => {
        const dataForPdfCheck = filteredDataGroup1;
        if (!survey || !reportSettings || !summaryData || !dataForPdfCheck) {
            toast.error("Required data (Survey, Settings, Summary, Filtered Data) not loaded yet."); return;
        }
        setGeneratingPdf(true); setPdfProgress(0); setPdfError(null);
        try {
            const generator = new SurveyPDFGenerator();
            const currentFilterStateForPdf = isIncludeAll ? {} : filterState;

            // Structure data explicitly for the generator
            const dataForPdf = {
                survey, summaryData,
                demographicsData: dataForPdfCheck?.demographics, // Pass potentially filtered demo data for Group 1
                questionStats: dataForPdfCheck?.question_stats, // Pass potentially filtered question stats for Group 1
                // Add comparison data if active and available
                comparisonData: (isComparisonActive && filteredDataGroup2) ? {
                     group1Name: group1Name,
                     group2Name: group2Name,
                     // Pass filtered data for group 2
                     demographics: filteredDataGroup2?.demographics,
                     questionStats: filteredDataGroup2?.question_stats,
                     // Include sample sizes for context in the PDF
                     sampleSize1: sampleSizeGroup1,
                     sampleSize2: sampleSizeGroup2,
                 } : null,
            };

            // Get current PDF export options FROM the reportSettings state
            const currentPdfExportOptions = reportSettings.pdfExportOptions || {
                includeDemographics: true, showWordCloudData: true, showOpenEndedResponses: true, openEndedResponseLimit: 10
            };

             console.log("Generating PDF with settings:", reportSettings);
             console.log("PDF Export Options used:", currentPdfExportOptions);
             console.log("Filter/Comparison Context:", { currentFilterStateForPdf, comparisonState, isIncludeAll, isComparisonActive });
             console.log("Data for PDF:", dataForPdf);

            // Generate PDF, passing ALL necessary state and data
            await generator.generate(
                dataForPdf,           // Survey data (inc. comparison if active)
                reportSettings,       // The FULL settings object (inc. global, question, demo, pdf options)
                currentPdfExportOptions, // Explicitly pass PDF options derived from settings
                (progress) => setPdfProgress(progress), // Progress callback
                currentFilterStateForPdf, // Base filters applied
                comparisonState,        // Comparison dimension/segments
                isIncludeAll,           // Was "Include All" active?
                isComparisonActive      // Is comparison mode active?
            );

            toast.success("PDF generated!"); setPdfProgress(100);
        } catch (err) {
            console.error("PDF Generation Error:", err);
            setPdfError(err.message || "Failed to generate PDF");
            toast.error(`PDF Error: ${err.message || "Unknown error"}`);
        } finally {
            setGeneratingPdf(false);
        }
        // Dependencies include all pieces of state passed to the generator
    }, [
        survey, reportSettings, summaryData, filteredDataGroup1, filteredDataGroup2,
        filterState, comparisonState, isIncludeAll, isComparisonActive,
        group1Name, group2Name, sampleSizeGroup1, sampleSizeGroup2
    ]);

    // --- Event Handlers for Question Panels --- (Keep existing: handleQuestionSettingChange, handleQuestionSelect, closeQuestionAnalytics)
    const handleQuestionSettingChange = useCallback((questionId, field, value) => {
        setReportSettings(prev => {
            const currentQSettings = prev.questions?.[questionId] || {};
            // Special handling for displayOrder to ensure it's a number or null
            let finalValue = value;
            if (field === 'displayOrder') {
                 const parsed = parseInt(value, 10);
                 finalValue = value === '' ? null : (isNaN(parsed) ? currentQSettings.displayOrder : parsed); // Revert if invalid, null if empty
            } else if (['isHidden', 'showStatsTable', 'showResponseDist', 'showWordCloud', 'showDropdownResponses', 'showNA', 'showThumbnails', 'showPercentages', 'showLegend',
                        'showMean', 'showMedian', 'showMin', 'showMax', 'showStdDev'].includes(field)) {
                // Ensure boolean toggles are stored as booleans
                 finalValue = value === true || String(value).toLowerCase() === 'true';
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
        // Autosave will trigger due to reportSettings change in its useEffect dependency array
    }, []);

    const handleQuestionSelect = (qId) => {
        setSelectedQuestionId(qId);
        if (survey && survey.questions) {
            const question = survey.questions.find(q => q.id === qId);
            setSelectedQuestion(question || null);
        }
    };

    const closeQuestionAnalytics = () => {
        setSelectedQuestionId(null);
        setSelectedQuestion(null);
    };

    // Reorder question cards via drag and drop
    const handleDragEnd = useCallback((result) => {
        if (!result.destination) return;
        const orderedIds = sortedAnalyzableQuestions.map(q => q.id);
        const [moved] = orderedIds.splice(result.source.index, 1);
        orderedIds.splice(result.destination.index, 0, moved);
        setReportSettings(prev => {
            const updatedQuestions = { ...prev.questions };
            orderedIds.forEach((id, idx) => {
                updatedQuestions[id] = {
                    ...(updatedQuestions[id] || {}),
                    displayOrder: idx + 1,
                };
            });
            return { ...prev, questions: updatedQuestions };
        });
    }, [sortedAnalyzableQuestions]);

    // Persist settings locally whenever they change
    useEffect(() => {
        if (initialLoadComplete) {
            saveSettingsToLocalStorage(reportSettings);
        }
    }, [reportSettings, saveSettingsToLocalStorage, initialLoadComplete]);


    // --- Sidebar Toggle --- (Keep existing)
    useEffect(() => {
        const handleResize = () => setIsSidebarOpen(window.innerWidth > 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    // --- Rendering ---
    // Move all hooks BEFORE any conditional returns

    // Define displayDataGroup1 *before* using it in JSX
    const displayDataGroup1 = filteredDataGroup1; // Holds base or filtered data for group 1

    // Calculate metrics (Keep existing)
    const completed = summaryData?.completed_responses ?? 0;
    const started = summaryData?.total_started ?? 0;
    const dropOff = started > 0 ? (((started - completed) / started) * 100) : 0;
    const apiDropOff = summaryData?.drop_off_rate?.toFixed(1) ?? dropOff.toFixed(1); // Format consistently

    // Determine sample size warnings (Keep existing)
    const sampleWarningGroup1 = isComparisonActive && sampleSizeGroup1 !== null && sampleSizeGroup1 < 200;
    const sampleWarningGroup2 = isComparisonActive && sampleSizeGroup2 !== null && sampleSizeGroup2 < 200;
    const showOverallWarning = !isComparisonActive && currentSampleSize !== null && currentSampleSize < 200;

    // Sort questions based on current settings for UI rendering (Keep existing)
    const sortedAnalyzableQuestions = useMemo(() => (survey?.questions || [])
        .filter(q => q.question_type && !EXCLUDED_ANALYSIS_TYPES.has(q.question_type))
        .sort((a, b) => {
            // Use report_sequence first, then sequence_number from survey, then index
            const orderA = reportSettings.questions[a.id]?.displayOrder ?? a.report_sequence ?? a.sequence_number ?? 9999;
            const orderB = reportSettings.questions[b.id]?.displayOrder ?? b.report_sequence ?? b.sequence_number ?? 9999;
            // Handle potential null/undefined during sorting
            const valA = orderA === null || orderA === undefined ? 9999 : orderA;
            const valB = orderB === null || orderB === undefined ? 9999 : orderB;
            return valA - valB;
        }), [survey?.questions, reportSettings.questions]);

    // UPDATED: Reference Questions (Excluded from main analysis)
    const referenceQuestions = useMemo(() => (survey?.questions || [])
        .filter(q => q.question_type && EXCLUDED_ANALYSIS_TYPES.has(q.question_type))
        // Sort reference questions by their original sequence number
        .sort((a, b) => (a.sequence_number ?? 9999) - (b.sequence_number ?? 9999)),
        [survey?.questions]);

    // Now, after all hooks, do conditional returns
    if (loading && !initialLoadComplete) return <div className="loading-indicator">Loading Report Data...</div>;
    if (error && !survey) return <div className="error-message">Error loading survey data: {error}</div>;
    if (!survey) return <div className="error-message">Survey data could not be loaded.</div>;

    // --- JSX Rendering ---
    return (
        <div className="report-tab-page with-sidebar">
            {/* Sidebar (Pass all required props, including sample size warnings) */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                // Saved Views Props
                savedViews={savedViews}
                currentViewName={currentViewName}
                onLoadView={handleLoadView}
                onSaveView={handleSaveView}
                onDeleteView={handleDeleteView}
                // Filtering Props
                availableFilterOptions={availableFilterOptions}
                filterState={filterState}
                isIncludeAll={isIncludeAll}
                onFilterChange={(category, value, isChecked) => {
                     if ((category === 'startDate' || category === 'endDate') && !value) {
                         setFilterState(prev => ({ ...prev, [category]: null }));
                     } else if (category !== 'startDate' && category !== 'endDate') {
                        setFilterState(prev => ({
                             ...prev,
                             [category]: isChecked
                                ? [...(prev[category] || []), value]
                                : (prev[category] || []).filter(item => item !== value)
                        }));
                     } else { // For date changes
                        setFilterState(prev => ({ ...prev, [category]: value }));
                     }
                 }}
                onIncludeAllChange={setIsIncludeAll}
                onDateChange={(field, date) => setFilterState(prev => ({ ...prev, [field]: date }))}
                onResetFilters={() => { // Resets filters, comparison, and report settings to default
                    setIsIncludeAll(true);
                    setFilterState({ age_group: [], location: [], gender: [], education: [], company: [], cohort_tag: [], startDate: null, endDate: null });
                    setIsComparisonActive(false);
                    setComparisonState({ dimension: null, segments: [] });
                    const defaultSettings = processFetchedSettings(survey, {}); // Get defaults
                    setReportSettings(defaultSettings);
                    setCurrentViewName(null);
                    handleApplyFilters(); // Re-apply default filters
                }}
                onApplyFilters={() => handleApplyFilters(true)} // Ensure triggerLoad is true
                // Comparison Props
                isComparisonActive={isComparisonActive}
                onToggleComparison={() => {
                    const nextComparisonState = !isComparisonActive;
                    setIsComparisonActive(nextComparisonState);
                    if (!nextComparisonState) {
                         setComparisonState({ dimension: null, segments: [] });
                         handleApplyFilters(); // Re-fetch single group data
                    } else {
                        // If activating, potentially clear group 2 data until segments are chosen & applied
                         setFilteredDataGroup2(null);
                         setSampleSizeGroup2(null);
                    }
                }}
                comparisonState={comparisonState}
                onComparisonChange={setComparisonState}
                comparisonSegmentCounts={comparisonSegmentCounts} // Pass counts for UI
                // Sample Size Props
                loading={loading}
                currentSampleSize={currentSampleSize}
                sampleSizeGroup1={sampleSizeGroup1}
                sampleSizeGroup2={sampleSizeGroup2}
                group1Name={group1Name}
                group2Name={group2Name}
                // Pass warning flags directly
                sampleWarningGroup1={sampleWarningGroup1}
                sampleWarningGroup2={sampleWarningGroup2}
                showOverallWarning={showOverallWarning}
            />

            <div className={`report-main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                {/* Header Controls (Keep existing structure) */}
                 <div className="report-header-controls">
                     <div>
                         {/* View Indicator Logic */}
                         {currentViewName && <span className='view-indicator'>Viewing: <strong>{currentViewName === AUTOSAVE_VIEW_NAME ? "Latest Autosaved" : currentViewName}</strong>{isComparisonActive && ` | Comparing ${comparisonState.dimension}`}</span>}
                         {!currentViewName && isComparisonActive && <span className='view-indicator'>Comparing <strong>{comparisonState.dimension || 'N/A'}</strong> by <strong>{(comparisonState.segments || []).join(' vs ')}</strong></span>}
                         {!currentViewName && !isComparisonActive && !isIncludeAll && <span className='view-indicator'>Filtered Results</span>}
                         {!currentViewName && !isComparisonActive && isIncludeAll && <span className='view-indicator'>Overall Results</span>}
                     </div>
                     <div className="report-actions">
                         <button className="chart-button secondary" onClick={() => setIsCustomizationOpen(true)} disabled={loading || generatingPdf}><i className="ri-settings-3-line"></i> Customize Report</button>
                         {/* Pass onGeneratePDF to the control */}
                         <ReportDownloadControl onGeneratePDF={handleGeneratePDF} surveyId={surveyId} disabled={loading || generatingPdf} />
                         <button className="mobile-sidebar-toggle chart-button secondary" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><i className="ri-menu-line"></i> {isSidebarOpen ? 'Hide' : 'Show'} Filters</button>
                     </div>
                </div>

                {error && <div className="error-message" style={{ margin: '10px 0' }}>{error}</div>}

                {/* Sections: Metrics, Demographics, Questions, Reference */}

                {/* --- Metrics Section --- (Keep existing) */}
                <div className="analytics-section metrics-section">
                    <MetricCard label="Completed Responses" value={summaryData?.total_responses ?? 'N/A'} />
                    <MetricCard label="Total Started" value={started} />
                    <MetricCard label="Total Completed" value={completed} />
                    <MetricCard label="Drop-off Rate" value={`${apiDropOff}%`} />
                    <MetricCard label="Avg. Completion Time" value={formatTime(summaryData?.average_completion_time)} />
                </div>

                {/* --- Demographics Section --- (Pass demographicsSettings prop) */}
                <div className="analytics-section demographics-section">
                    <h2>Demographics Overview</h2>
                    {displayDataGroup1 && displayDataGroup1.demographics && Object.keys(displayDataGroup1.demographics).length > 0 ? (
                        <ReportDemographicsDisplay
                            demographicsData={displayDataGroup1.demographics} // Data for group 1
                            demographicsSettings={reportSettings.demographics} // Pass full demo settings object
                        />
                    ) : loading && !displayDataGroup1 ? (
                        <div className="loading-indicator small">Loading demographics...</div>
                    ) : (
                        <p className="no-data-small">No demographic data available for the current selection.</p>
                    )}
                    {isComparisonActive && <p className="comparison-note">Demographic charts above show data for {group1Name}. Compare individual questions below.</p>}
                </div>

                 {/* --- Question Results Section --- (UPDATED PROP PASSING) */}
                 <div className="analytics-section questions-section">
                     <h2>Question Results</h2>
                     {loading && !displayDataGroup1 && <div className="loading-indicator small">Loading question results...</div>}
                     {!loading && !error && sortedAnalyzableQuestions.length === 0 && <p>No analyzable questions found in this survey.</p>}
                     {!loading && !error && sortedAnalyzableQuestions.length > 0 && (
                         <DragDropContext onDragEnd={handleDragEnd}>
                         <Droppable droppableId="questions">
                         {(provided) => (
                         <div className="questions-display-area" ref={provided.innerRef} {...provided.droppableProps}>
                             {sortedAnalyzableQuestions.map((q, index) => {
                                 // Get the specific settings object for this question
                                 const questionSpecificSettings = reportSettings.questions[q.id] || {};

                                 // Skip rendering if explicitly hidden via settings
                                 if (questionSpecificSettings.isHidden) return null;

                                 // Get potentially filtered analytics data for group 1 and group 2
                                 const qData1 = displayDataGroup1?.question_stats?.[q.id];
                                 const qData2 = filteredDataGroup2?.question_stats?.[q.id];

                                 return (
                                     <Draggable key={q.id} draggableId={String(q.id)} index={index}>
                                     {(dragProvided) => (
                                     <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        key={q.id}
                                        id={`question-analytics-${q.id}`}
                                        className="question-analytics-wrapper"
                                     >
                                         <div className="drag-handle" {...dragProvided.dragHandleProps}>
                                             <i className="ri-drag-move-line"></i>
                                         </div>
                                         {/* Render comparison chart if active and data available for both */}
                                         {isComparisonActive && qData1 && qData2 ? (
                                             <ComparisonChartWrapper
                                                 question={q} // Pass full question object
                                                 data1={qData1} // Pass full analytics data for G1
                                                 data2={qData2} // Pass full analytics data for G2
                                                 // Pass settings (can be same or different if comparison overrides existed)
                                                 settings1={questionSpecificSettings}
                                                 settings2={questionSpecificSettings} // Assuming same settings apply unless comparison overrides are implemented later
                                                 group1Name={group1Name}
                                                 group2Name={group2Name}
                                             />
                                         ) : qData1 ? (
                                             // Render single view based on question type
                                             q.question_type.includes('grid') ? (
                                                 <ReportGridDisplay
                                                    question={q} // Pass full question object
                                                    analyticsData={qData1} // Pass analytics data for the grid
                                                    questionSettings={questionSpecificSettings} // Pass specific settings
                                                  />
                                             ) : q.question_type === 'open-ended' || q.question_type === 'text-input' ? (
                                                 <OpenEndedDisplay
                                                     question={q} // Pass full question object
                                                     analyticsData={qData1} // Pass analytics data
                                                     settings={questionSpecificSettings} // Pass settings
                                                     // Pass PDF options needed for limiting response list
                                                     pdfExportOptions={reportSettings.pdfExportOptions}
                                                 />
                                             ) : (
                                                  // Standard chartable question - Pass settings directly
                                                  <ReportQuestionDisplay
                                                      surveyId={surveyId}
                                                      questionId={q.id}
                                                      analyticsDataExternal={qData1} // Pass fetched data directly
                                                      question={q} // Pass the full question object
                                                      // ** CRITICAL: Pass the specific settings object for THIS question **
                                                      questionSettings={questionSpecificSettings}
                                                      // Pass global settings as fallback or for context if needed by chart
                                                      globalSettings={reportSettings.global}
                                                      // Callback to update settings in ReportTabPage's state
                                                      onSettingChange={handleQuestionSettingChange}
                                                  />
                                             )
                                         ) : !loading ? (
                                             // Placeholder if data is missing after loading
                                             <div className="question-panel-placeholder missing-data">
                                                 <h4>Q{questionSpecificSettings.displayOrder ?? q.sequence_number ?? 'N/A'}: {q.question_text}</h4>
                                                 <span className="question-type-label">({q.question_type})</span>
                                                 <p><i>No data available for the current filter selection.</i></p>
                                             </div>
                                         ) : null /* Don't render anything if still loading overall */ }
                                     </div>
                                     )}
                                     </Draggable>
                                 );
                             })}
                             {provided.placeholder}
                         </div> 
                         )}
                         </Droppable>
                         </DragDropContext>
                     )}
                 </div>


                {/* --- NEW: Reference Data Section --- */}
                {referenceQuestions.length > 0 && (
                    <div className="analytics-section reference-data-section">
                        <h2>Reference Data (Included in Excel Export Only)</h2>
                        <p className="reference-info">
                            The following question types are not visualized here but their data is available in the raw data export (Excel):
                            Upload File (Filename), Signature (Yes/No), Date Picker (Date), Email Input (Email).
                        </p>
                        <div className="reference-list">
                            {referenceQuestions.map((q) => (
                                <div key={q.id} className="reference-question">
                                    <h4>Q{q.sequence_number || 'N/A'}: {q.question_text}</h4>
                                    <span className="reference-type">({q.question_type})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

               

            </div>
        </div> 
    );
};

// Minimal inline styles (Keep existing)
const styles = {
    pdfOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 },
    pdfModal: { background: '#fff', padding: '30px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', minWidth: '300px', color: '#333' },
    progressBarContainer: { background: '#e0e0e0', borderRadius: '4px', height: '20px', overflow: 'hidden', margin: '15px 0' },
    progressBar: { background: '#AA2EFF', height: '100%', transition: 'width 0.3s ease-in-out' },
    progressText: { margin: '10px 0 0 0', fontWeight: 'bold' },
    pdfError: { color: 'red', marginTop: '10px', fontSize: '0.9em' },
};


export default ReportTabPage;