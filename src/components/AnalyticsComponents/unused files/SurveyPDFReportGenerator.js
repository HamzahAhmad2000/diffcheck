import React, { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * SurveyPDFReportGenerator
 * 
 * This component generates a comprehensive PDF report with:
 * - Summary statistics
 * - Demographics information
 * - Customized charts for each question
 * - Word clouds for open-ended questions
 * - Grid analytics for grid questions
 * - Response time analytics
 * - Dropout analysis
 */
const SurveyPDFReportGenerator = ({ surveyId, onClose }) => {
  // State variables
  const [survey, setSurvey] = useState(null);
  const [chartSettings, setChartSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: 'Initializing...' });
  const [error, setError] = useState(null);
  const [showWordClouds, setShowWordClouds] = useState(true);
  const [showOpenEndedResponses, setShowOpenEndedResponses] = useState(true);
  const [openEndedResponseLimit, setOpenEndedResponseLimit] = useState(5);
  const [generatePdf, setGeneratePdf] = useState(false);
  const [includeDropoutAnalysis, setIncludeDropoutAnalysis] = useState(true);
  const [includeResponseTimeAnalysis, setIncludeResponseTimeAnalysis] = useState(true);
  const [includeDemographics, setIncludeDemographics] = useState(true);
  
  const token = localStorage.getItem('token');

  // 1. Fetch the survey data including questions
  useEffect(() => {
    const fetchSurvey = async () => {
      setLoading(true);
      setProgress({ current: 0, total: 1, message: 'Fetching survey data...' });
      
      try {
        const response = await fetch(`http://localhost:5000/surveys/${surveyId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setSurvey(data);
        
        // Update progress
        setProgress(prev => ({ 
          ...prev, 
          current: 1, 
          total: data.questions ? data.questions.length + 1 : 1,
          message: 'Survey data loaded successfully.' 
        }));
        
        // Fetch saved chart settings
        fetchChartSettings(data);
      } catch (err) {
        console.error('Error fetching survey:', err);
        setError(`Failed to fetch survey data: ${err.message}`);
        setLoading(false);
      }
    };
    
    fetchSurvey();
  }, [surveyId, token]);

  // 2. Fetch saved chart settings if available
  const fetchChartSettings = async (surveyData) => {
    setProgress(prev => ({ ...prev, message: 'Fetching chart customizations...' }));
    
    try {
      const response = await fetch(`http://localhost:5000/api/surveys/${surveyId}/chart-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.questions) {
          setChartSettings(data.questions);
        } else {
          // Initialize default chart settings for each question
          const defaultSettings = {};
          
          if (surveyData.questions) {
            surveyData.questions.forEach(question => {
              const defaultType = getDefaultChartType(question.question_type);
              defaultSettings[question.id] = {
                chartType: defaultType,
                chartColor: '#36A2EB',
                showPercentages: true,
                showLegend: true,
                customTitle: '',
                customColors: []
              };
            });
          }
          
          setChartSettings(defaultSettings);
        }
      } else {
        console.warn('Could not fetch chart settings, using defaults');
        // Initialize default settings
        const defaultSettings = {};
        
        if (surveyData.questions) {
          surveyData.questions.forEach(question => {
            const defaultType = getDefaultChartType(question.question_type);
            defaultSettings[question.id] = {
              chartType: defaultType,
              chartColor: '#36A2EB',
              showPercentages: true,
              showLegend: true,
              customTitle: '',
              customColors: []
            };
          });
        }
        
        setChartSettings(defaultSettings);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chart settings:', err);
      
      // Initialize default settings if there's an error
      const defaultSettings = {};
      
      if (surveyData.questions) {
        surveyData.questions.forEach(question => {
          const defaultType = getDefaultChartType(question.question_type);
          defaultSettings[question.id] = {
            chartType: defaultType,
            chartColor: '#36A2EB',
            showPercentages: true,
            showLegend: true,
            customTitle: '',
            customColors: []
          };
        });
      }
      
      setChartSettings(defaultSettings);
      setLoading(false);
    }
  };

  // Get default chart type based on question type
  const getDefaultChartType = (questionType) => {
    switch (questionType) {
      case 'multiple-choice':
      case 'dropdown':
        return 'pie';
      case 'checkbox':
        return 'bar';
      case 'rating-scale':
      case 'nps':
      case 'numerical-input':
        return 'bar';
      default:
        return 'bar';
    }
  };

  // Update chart settings for a specific question
  const updateQuestionChartSettings = (questionId, settings) => {
    setChartSettings(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...settings
      }
    }));
  };

  // Update a specific color for a question option
  const updateOptionColor = (questionId, optionIndex, color) => {
    setChartSettings(prev => {
      const question = prev[questionId] || {};
      const customColors = [...(question.customColors || [])];
      
      // Ensure the array is long enough
      while (customColors.length <= optionIndex) {
        customColors.push(question.chartColor || '#36A2EB');
      }
      
      customColors[optionIndex] = color;
      
      return {
        ...prev,
        [questionId]: {
          ...question,
          customColors
        }
      };
    });
  };

  // Apply the same settings to all questions
  const applySettingsToAll = (settings) => {
    const updatedSettings = {};
    
    Object.keys(chartSettings).forEach(questionId => {
      updatedSettings[questionId] = {
        ...chartSettings[questionId],
        ...settings
      };
    });
    
    setChartSettings(updatedSettings);
  };

  // Save chart settings to backend
  const saveChartSettings = async () => {
    setProgress(prev => ({ ...prev, message: 'Saving chart customizations...' }));
    
    try {
      const response = await fetch(`http://localhost:5000/api/surveys/${surveyId}/chart-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          global: {
            showPercentages: true,
            showLegend: true
          },
          questions: chartSettings
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save chart settings');
      }
      
      setProgress(prev => ({ ...prev, message: 'Chart customizations saved successfully.' }));
    } catch (err) {
      console.error('Error saving chart settings:', err);
      setError(`Failed to save chart settings: ${err.message}`);
    }
  };

  // 3. Generate the PDF report
// Add this to SurveyPDFReportGenerator.js - Handling question sequence in PDF generation

// Update the generatePDFReport function to handle question sequences
  const generatePDFReport = async () => {
    if (!survey || !survey.questions) {
      setError('Survey data is required to generate PDF');
      return;
    }
    
    setGeneratePdf(true);
    setProgress({ current: 0, total: 6 + survey.questions.length, message: 'Initializing PDF generation...' });
    
    // Create a new jsPDF instance
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    try {
      // 1. Add title page
      setProgress(prev => ({ ...prev, current: 1, message: 'Creating title page...' }));
      await addTitlePage(doc, survey);
      
      // 2. Add summary statistics
      setProgress(prev => ({ ...prev, current: 2, message: 'Adding summary statistics...' }));
      await addSummaryStatistics(doc, survey);
      
      // 3. Add demographics if included
      if (includeDemographics) {
        setProgress(prev => ({ ...prev, current: 3, message: 'Adding demographics information...' }));
        // Fetch chart settings for demographics
        let demographicsSettings = null;
        try {
          const response = await fetch(`http://localhost:5000/api/surveys/${surveyId}/chart-settings`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.settings && data.settings.demographics) {
              demographicsSettings = data.settings.demographics;
            }
          }
        } catch (err) {
          console.error('Error fetching demographics chart settings:', err);
        }
        
        await addDemographicsInformation(doc, surveyId, demographicsSettings);
      }
      
      // 4. Add question analytics (loop through each question in the proper sequence)
      // First, sort questions based on display order from chart settings
      let sortedQuestions = [...survey.questions];
      
      // Fetch question display order from chart settings
      try {
        const response = await fetch(`http://localhost:5000/api/surveys/${surveyId}/chart-settings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.settings && data.settings.questions) {
            // Create a map of question ID to display order
            const questionOrders = {};
            
            Object.entries(data.settings.questions).forEach(([id, settings]) => {
              if (settings.displayOrder !== undefined) {
                questionOrders[id] = settings.displayOrder;
              }
            });
            
            // Sort questions based on display order
            sortedQuestions.sort((a, b) => {
              const orderA = questionOrders[a.id] !== undefined ? questionOrders[a.id] : a.sequence_number;
              const orderB = questionOrders[b.id] !== undefined ? questionOrders[b.id] : b.sequence_number;
              return orderA - orderB;
            });
          }
        }
      } catch (err) {
        console.error('Error fetching question display order:', err);
      }
      
      let questionCounter = 0;
      if (sortedQuestions.length > 0) {
        for (const question of sortedQuestions) {
          questionCounter++;
          setProgress(prev => ({ 
            ...prev, 
            current: 3 + questionCounter, 
            message: `Processing question ${questionCounter} of ${sortedQuestions.length}...` 
          }));
          
          await addQuestionAnalytics(doc, survey, question, questionCounter);
        }
      }
      
      // 5. Add response time analysis if included
      if (includeResponseTimeAnalysis) {
        setProgress(prev => ({ 
          ...prev, 
          current: prev.current + 1, 
          message: 'Adding response time analysis...' 
        }));
        await addResponseTimeAnalysis(doc, surveyId);
      }
      
      // 6. Add dropout analysis if included
      if (includeDropoutAnalysis) {
        setProgress(prev => ({ 
          ...prev, 
          current: prev.current + 1, 
          message: 'Adding dropout analysis...' 
        }));
        await addDropoutAnalysis(doc, surveyId);
      }
      
      // 7. Save the PDF
      setProgress(prev => ({ 
        ...prev, 
        current: prev.total, 
        message: 'Finalizing PDF...' 
      }));
      
      doc.save(`survey_${surveyId}_report.pdf`);
      
      setProgress(prev => ({ 
        ...prev, 
        message: 'PDF generated successfully!' 
      }));
      
      setGeneratePdf(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(`Failed to generate PDF: ${err.message}`);
      setGeneratePdf(false);
    }
  };
  
  // Update the addQuestionAnalytics function to use chart settings
  const addQuestionAnalytics = async (doc, survey, question, questionIndex) => {
    // Add section title
    doc.setFillColor(52, 152, 219);
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`Question ${questionIndex}: ${question.question_type.toUpperCase()}`, 105, 10, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    // Add question text
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Question:', 20, 25);
    
    // Handle potentially long question text with wrapping
    const questionText = question.question_text || 'No question text available';
    const textLines = doc.splitTextToSize(questionText, 170);
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text(textLines, 20, 35);
    
    let yPos = 35 + (textLines.length * 7);
    
    try {
      // Fetch analytics data
      const response = await fetch(
        `http://localhost:5000/surveys/${surveyId}/questions/${question.id}/analytics-unified`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const analyticsData = await response.json();
      
      // Fetch chart settings for this question
      let questionSettings = null;
      try {
        const settingsResponse = await fetch(`http://localhost:5000/api/surveys/${surveyId}/chart-settings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.settings && settingsData.settings.questions && 
              settingsData.settings.questions[question.id]) {
            questionSettings = settingsData.settings.questions[question.id];
          }
        }
      } catch (err) {
        console.error(`Error fetching chart settings for question ${question.id}:`, err);
      }
      
      // Get chart settings for this question
      const settings = questionSettings || {
        chartType: getDefaultChartType(question.question_type),
        chartColor: '#36A2EB',
        showPercentages: true,
        showLegend: true,
        customTitle: '',
        customColors: []
      };
      
      // Different handling based on question type
      if (question.question_type === 'open-ended') {
        await addOpenEndedAnalytics(doc, question, analyticsData, yPos);
      } else if (question.question_type.includes('grid')) {
        await addGridAnalytics(doc, question, analyticsData, yPos);
      } else {
        await addChartAndStats(doc, question, analyticsData, settings, yPos);
      }
      
    } catch (err) {
      console.error(`Error fetching analytics for question ${question.id}:`, err);
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text(`Error fetching analytics data: ${err.message}`, 20, yPos + 10);
      doc.addPage();
    }
  };
  // Helper function to add title page
  const addTitlePage = async (doc, survey) => {
    doc.setFillColor(52, 152, 219); // Blue header
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('Survey Report', 105, 25, { align: 'center' });
    
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(survey.title, 105, 60, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`ID: ${surveyId}`, 105, 70, { align: 'center' });
    
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Generated on: ${currentDate}`, 105, 80, { align: 'center' });
    
    doc.setFillColor(52, 152, 219); // Blue footer
    doc.rect(0, 280, 210, 17, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Confidential - For internal use only', 105, 290, { align: 'center' });
    
    doc.addPage();
  };

  // Helper function to add summary statistics
  const addSummaryStatistics = async (doc, survey) => {
    // Add section title
    doc.setFillColor(52, 152, 219);
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Survey Summary', 105, 10, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    // Fetch summary data
    try {
      const response = await fetch(`http://localhost:5000/surveys/${surveyId}/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const summaryData = await response.json();
      
      // Add summary statistics
      let yPos = 30;
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Basic Statistics:', 20, yPos);
      yPos += 10;
      
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text(`Total Responses: ${summaryData.total_responses || 0}`, 25, yPos);
      yPos += 8;
      
      doc.text(`Completion Rate: ${(summaryData.completion_rate || 0).toFixed(2)}%`, 25, yPos);
      yPos += 8;
      
      doc.text(`Average Completion Time: ${(summaryData.avg_completion_time || 0).toFixed(2)} seconds`, 25, yPos);
      yPos += 8;
      
      doc.text(`Total Questions: ${survey.questions ? survey.questions.length : 0}`, 25, yPos);
      yPos += 15;
      
      // Questions by type
      if (survey.questions) {
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Questions by Type:', 20, yPos);
        yPos += 10;
        
        const questionTypes = {};
        survey.questions.forEach(q => {
          questionTypes[q.question_type] = (questionTypes[q.question_type] || 0) + 1;
        });
        
        doc.setFont(StandardFonts.Helvetica, 'normal');
        Object.entries(questionTypes).forEach(([type, count]) => {
          doc.text(`${type}: ${count}`, 25, yPos);
          yPos += 8;
        });
      }
      
      doc.addPage();
      
    } catch (err) {
      console.error('Error fetching summary data:', err);
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text('Error fetching summary data', 20, 30);
      doc.addPage();
    }
  };

    // Helper function to add demographics information
    // Add demographics information to PDF with customized chart settings
  async function addDemographicsInformation(doc, surveyId, demographics_settings=null) {
        // Add section title
        doc.setFillColor(52, 152, 219);
        doc.rect(0, 0, 210, 15, 'F');
        
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('Demographics Information', 105, 10, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        
        // Use default settings if none provided
        if (demographics_settings === null) {
            demographics_settings = {
                'age_groups': { 'chartType': 'pie', 'chartColor': '#4BC0C0', 'showPercentages': true },
                'genders': { 'chartType': 'pie', 'chartColor': '#FF6384', 'showPercentages': true },
                'locations': { 'chartType': 'bar', 'chartColor': '#FFCE56', 'showPercentages': true },
                'education': { 'chartType': 'bar', 'chartColor': '#9966FF', 'showPercentages': true },
                'companies': { 'chartType': 'bar', 'chartColor': '#FF9F40', 'showPercentages': true }
            };
        }
        
        try {
            // Fetch demographics data
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/surveys/${surveyId}/demographic-analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})  // Empty object to get all demographics
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const demographicsData = await response.json();
            
            // Check if demographics data exists
            if (!demographicsData.demographics) {
                doc.setFont(StandardFonts.Helvetica, 'normal');
                doc.text('No demographics data available', 20, 30);
                doc.addPage();
                return;
            }
            
            const { demographics } = demographicsData;
            let yPos = 30;
            
            // Age Groups
            if (demographics.age_groups && Object.keys(demographics.age_groups).length > 0) {
                doc.setFont(StandardFonts.Helvetica, 'bold');
                doc.text('Age Distribution:', 20, yPos);
                yPos += 10;
                
                const settings = demographics_settings.age_groups;
                
                // Create chart with custom settings
                if (settings.chartType === 'pie' || settings.chartType === 'doughnut') {
                    // Create a pie/doughnut chart with custom colors
                    const ageData = {};
                    Object.entries(demographics.age_groups).forEach(([group, data]) => {
                        ageData[group] = data.count;
                    });
                    
                    const chartImage = await createCustomPieChart(
                        ageData, 
                        'Age Distribution', 
                        settings.customColors || [], 
                        settings.chartColor, 
                        settings.chartType === 'doughnut'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                } else {
                    // Create a bar chart with custom colors
                    const ageData = {};
                    Object.entries(demographics.age_groups).forEach(([group, data]) => {
                        ageData[group] = settings.showPercentages ? data.percentage : data.count;
                    });
                    
                    const chartImage = await createCustomBarChart(
                        ageData, 
                        'Age Distribution', 
                        settings.customColors || [], 
                        settings.chartColor,
                        settings.chartType === 'horizontalBar'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                }
                
                // Create table data
                const ageTableData = Object.entries(demographics.age_groups).map(([group, data]) => [
                    group, data.count, `${data.percentage.toFixed(1)}%`
                ]);
                
                // Add table
                doc.autoTable({
                    startY: yPos,
                    head: [['Age Group', 'Count', 'Percentage']],
                    body: ageTableData,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
                
                yPos = doc.previousAutoTable.finalY + 15;
            }
            
            // Gender Distribution
            if (demographics.genders && Object.keys(demographics.genders).length > 0) {
                // Add page if needed
                if (yPos > 230) {
                    doc.addPage();
                    yPos = 30;
                }
                
                doc.setFont(StandardFonts.Helvetica, 'bold');
                doc.text('Gender Distribution:', 20, yPos);
                yPos += 10;
                
                const settings = demographics_settings.genders;
                
                // Create chart with custom settings
                if (settings.chartType === 'pie' || settings.chartType === 'doughnut') {
                    // Create a pie/doughnut chart with custom colors
                    const genderData = {};
                    Object.entries(demographics.genders).forEach(([gender, data]) => {
                        genderData[gender] = data.count;
                    });
                    
                    const chartImage = await createCustomPieChart(
                        genderData, 
                        'Gender Distribution', 
                        settings.customColors || [], 
                        settings.chartColor, 
                        settings.chartType === 'doughnut'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                } else {
                    // Create a bar chart with custom colors
                    const genderData = {};
                    Object.entries(demographics.genders).forEach(([gender, data]) => {
                        genderData[gender] = settings.showPercentages ? data.percentage : data.count;
                    });
                    
                    const chartImage = await createCustomBarChart(
                        genderData, 
                        'Gender Distribution', 
                        settings.customColors || [], 
                        settings.chartColor,
                        settings.chartType === 'horizontalBar'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                }
                
                // Create table data
                const genderTableData = Object.entries(demographics.genders).map(([gender, data]) => [
                    gender, data.count, `${data.percentage.toFixed(1)}%`
                ]);
                
                // Add table
                doc.autoTable({
                    startY: yPos,
                    head: [['Gender', 'Count', 'Percentage']],
                    body: genderTableData,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
                
                yPos = doc.previousAutoTable.finalY + 15;
            }
            
            // Location Distribution
            if (demographics.locations && Object.keys(demographics.locations).length > 0) {
                // Add page if needed
                if (yPos > 230) {
                    doc.addPage();
                    yPos = 30;
                }
                
                doc.setFont(StandardFonts.Helvetica, 'bold');
                doc.text('Top Locations:', 20, yPos);
                yPos += 10;
                
                const settings = demographics_settings.locations;
                
                // Create chart with custom settings - for locations usually bar chart works best
                const locationData = {};
                const topLocations = Object.entries(demographics.locations)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);
                
                topLocations.forEach(([location, data]) => {
                    locationData[location] = settings.showPercentages ? data.percentage : data.count;
                });
                
                const chartImage = await createCustomBarChart(
                    locationData, 
                    'Top Locations', 
                    settings.customColors || [], 
                    settings.chartColor,
                    settings.chartType === 'horizontalBar'
                );
                
                if (chartImage) {
                    doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                    yPos += 110;
                }
                
                // Create table data for top 10 locations
                const locationTableData = topLocations.map(([location, data]) => [
                    location, data.count, `${data.percentage.toFixed(1)}%`
                ]);
                
                // Add table
                doc.autoTable({
                    startY: yPos,
                    head: [['Location', 'Count', 'Percentage']],
                    body: locationTableData,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
                
                yPos = doc.previousAutoTable.finalY + 15;
            }
            
            // Education and Companies on a new page
            doc.addPage();
            yPos = 30;
            
            // Education Level
            if (demographics.education && Object.keys(demographics.education).length > 0) {
                doc.setFont(StandardFonts.Helvetica, 'bold');
                doc.text('Education Level:', 20, yPos);
                yPos += 10;
                
                const settings = demographics_settings.education;
                
                // Create chart with custom settings
                const educationData = {};
                Object.entries(demographics.education)
                    .sort((a, b) => b[1].count - a[1].count)
                    .forEach(([education, data]) => {
                        educationData[education] = settings.showPercentages ? data.percentage : data.count;
                    });
                
                if (settings.chartType === 'pie' || settings.chartType === 'doughnut') {
                    const chartImage = await createCustomPieChart(
                        educationData, 
                        'Education Distribution', 
                        settings.customColors || [], 
                        settings.chartColor, 
                        settings.chartType === 'doughnut'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                } else {
                    const chartImage = await createCustomBarChart(
                        educationData, 
                        'Education Distribution', 
                        settings.customColors || [], 
                        settings.chartColor,
                        settings.chartType === 'horizontalBar'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                }
                
                // Create table data
                const educationTableData = Object.entries(demographics.education)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([education, data]) => [
                        education, data.count, `${data.percentage.toFixed(1)}%`
                    ]);
                
                // Add table
                doc.autoTable({
                    startY: yPos,
                    head: [['Education', 'Count', 'Percentage']],
                    body: educationTableData,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
                
                yPos = doc.previousAutoTable.finalY + 15;
            }
            
            // Companies
            if (demographics.companies && Object.keys(demographics.companies).length > 0) {
                // Add page if needed
                if (yPos > 180) {
                    doc.addPage();
                    yPos = 30;
                }
                
                doc.setFont(StandardFonts.Helvetica, 'bold');
                doc.text('Top Companies:', 20, yPos);
                yPos += 10;
                
                const settings = demographics_settings.companies;
                
                // Create chart with custom settings
                const companyData = {};
                const topCompanies = Object.entries(demographics.companies)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10);
                
                topCompanies.forEach(([company, data]) => {
                    companyData[company] = settings.showPercentages ? data.percentage : data.count;
                });
                
                if (settings.chartType === 'pie' || settings.chartType === 'doughnut') {
                    const chartImage = await createCustomPieChart(
                        companyData, 
                        'Company Distribution', 
                        settings.customColors || [], 
                        settings.chartColor, 
                        settings.chartType === 'doughnut'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                } else {
                    const chartImage = await createCustomBarChart(
                        companyData, 
                        'Company Distribution', 
                        settings.customColors || [], 
                        settings.chartColor,
                        settings.chartType === 'horizontalBar'
                    );
                    
                    if (chartImage) {
                        doc.addImage(chartImage, 'PNG', 20, yPos, 170, 100);
                        yPos += 110;
                    }
                }
                
                // Create table data
                const companyTableData = topCompanies.map(([company, data]) => [
                    company, data.count, `${data.percentage.toFixed(1)}%`
                ]);
                
                // Add table
                doc.autoTable({
                    startY: yPos,
                    head: [['Company', 'Count', 'Percentage']],
                    body: companyTableData,
                    margin: { top: 20, right: 20, bottom: 20, left: 20 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
            }
            
            doc.addPage();
            
        } catch (err) {
            console.error('Error fetching demographics data:', err);
            doc.setFont(StandardFonts.Helvetica, 'normal');
            doc.text('Error fetching demographics data', 20, 30);
            doc.addPage();
        }
    }

    // Helper function to create custom bar chart
  async function createCustomBarChart(data, title, customColors, defaultColor, horizontal = false) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 400;
            
            const ctx = canvas.getContext('2d');
            const labels = Object.keys(data);
            const values = Object.values(data);
            
            // Generate colors for each bar
            let colors = [];
            if (customColors && customColors.length > 0) {
                // Use custom colors if available
                for (let i = 0; i < labels.length; i++) {
                    colors.push(customColors[i % customColors.length]);
                }
            } else {
                // Use default color for all bars
                colors = Array(labels.length).fill(defaultColor);
            }
            
            // Create chart
            new Chart(ctx, {
                type: horizontal ? 'horizontalBar' : 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: title,
                        data: values,
                        backgroundColor: colors,
                        borderColor: colors.map(color => color.replace('rgb', 'rgba').replace(')', ', 1)')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            
            // Convert canvas to image
            return canvas.toDataURL('image/png');
        } catch (err) {
            console.error('Error creating bar chart:', err);
            return null;
        }
    }

    // Helper function to create custom pie chart
  async function createCustomPieChart(data, title, customColors, defaultColor, doughnut = false) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 400;
            
            const ctx = canvas.getContext('2d');
            const labels = Object.keys(data);
            const values = Object.values(data);
            
            // Generate colors for each slice
            let colors = [];
            if (customColors && customColors.length > 0) {
                // Use custom colors if available
                for (let i = 0; i < labels.length; i++) {
                    colors.push(customColors[i % customColors.length]);
                }
            } else {
                // Generate colors based on the default color
                const baseColor = defaultColor;
                for (let i = 0; i < labels.length; i++) {
                    // Create a shade variation of the base color
                    const hue = (i * 30) % 360;
                    colors.push(`hsl(${hue}, 70%, 50%)`);
                }
            }
            
            // Create chart
            new Chart(ctx, {
                type: doughnut ? 'doughnut' : 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderColor: 'white',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: title
                        }
                    }
                }
            });
            
            // Convert canvas to image
            return canvas.toDataURL('image/png');
        } catch (err) {
            console.error('Error creating pie chart:', err);
            return null;
        }
    }
  // Helper function to add question analytics


  // Helper function to add open-ended question analytics
  const addOpenEndedAnalytics = async (doc, question, analyticsData, startY) => {
    let yPos = startY + 10;
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Word Cloud Analysis', 20, yPos);
    yPos += 10;
    
    // If word cloud is enabled, create and add to PDF
    if (showWordClouds && analyticsData.analytics && analyticsData.analytics.word_cloud_data) {
      try {
        // Create a temporary div to render the word cloud
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '500px';
        tempDiv.style.height = '300px';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        
        // Add a message indicating word cloud visuals are included in report but not shown here
        doc.setFont(StandardFonts.Helvetica, 'italic');
        doc.text('Word cloud visualization would be included in the final PDF.', 25, yPos);
        yPos += 20;
        
        // Get top words
        const topWords = analyticsData.analytics.word_cloud_data
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);
        
        // Add top words table
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Top 15 Words:', 20, yPos);
        yPos += 10;
        
        const wordData = topWords.map((word, index) => [
          index + 1, word.text, word.value
        ]);
        
        doc.autoTable({
          startY: yPos,
          head: [['Rank', 'Word', 'Frequency']],
          body: wordData,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          headStyles: { fillColor: [52, 152, 219] }
        });
        
        yPos = doc.previousAutoTable.finalY + 15;
        
        // Remove the temporary div
        document.body.removeChild(tempDiv);
      } catch (err) {
        console.error('Error rendering word cloud:', err);
        doc.setFont(StandardFonts.Helvetica, 'normal');
        doc.text('Error rendering word cloud', 25, yPos);
        yPos += 10;
      }
    } else {
      doc.setFont(StandardFonts.Helvetica, 'italic');
      doc.text('Word cloud visualization disabled.', 25, yPos);
      yPos += 10;
    }
    
    // If recent responses are enabled, add them to the PDF
    if (showOpenEndedResponses && analyticsData.responses && analyticsData.responses.length > 0) {
      // Add page if needed
      if (yPos > 230) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text(`Recent Responses (showing ${Math.min(openEndedResponseLimit, analyticsData.responses.length)}):`, 20, yPos);
      yPos += 10;
      
      // Get the limited number of responses
      const limitedResponses = analyticsData.responses.slice(0, openEndedResponseLimit);
      
      // Add each response
      limitedResponses.forEach((response, index) => {
        // Format date if available
        const formattedDate = response.created_at 
          ? new Date(response.created_at).toLocaleDateString() 
          : 'No date';
        
        // Add page if needed
        if (yPos > 250) {
          doc.addPage();
          yPos = 30;
        }
        
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPos, 170, 7, 'F');
        
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.setFontSize(10);
        doc.text(`Response #${index + 1} - ${response.user_name || 'Anonymous'} (${formattedDate})`, 22, yPos + 5);
        yPos += 10;
        
        doc.setFont(StandardFonts.Helvetica, 'normal');
        
        // Wrap response text
        const responseText = response.response_text || 'No response text available';
        const textLines = doc.splitTextToSize(responseText, 170);
        doc.text(textLines, 25, yPos);
        
        yPos += (textLines.length * 7) + 10;
      });
    }
    
    doc.addPage();
  };

  // Helper function to add grid question analytics
  const addGridAnalytics = async (doc, question, analyticsData, startY) => {
    let yPos = startY + 10;
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Grid Analysis', 20, yPos);
    yPos += 10;
    
    // Check if grid data exists
    if (!analyticsData.analytics || !analyticsData.analytics.grid_data) {
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text('No grid data available', 25, yPos);
      doc.addPage();
      return;
    }
    
    const gridData = analyticsData.analytics.grid_data;
    
    // Different handling based on grid question type
    if (question.question_type === 'star-rating-grid') {
      // Star rating grid - show average ratings per row
      doc.setFont(StandardFonts.Helvetica, 'italic');
      doc.text('Star Rating Grid Analysis', 25, yPos);
      yPos += 10;
      
      const tableData = gridData.rows.map((row, index) => [
        row,
        gridData.row_totals[index] || 0,
        (gridData.row_averages[index] || 0).toFixed(2)
      ]);
      
      doc.autoTable({
        startY: yPos,
        head: [['Row', '# of Ratings', 'Average Rating']],
        body: tableData,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        headStyles: { fillColor: [52, 152, 219] }
      });
      
      yPos = doc.previousAutoTable.finalY + 15;
      
    } else if (question.question_type === 'checkbox-grid') {
      // Checkbox grid - show option distribution
      doc.setFont(StandardFonts.Helvetica, 'italic');
      doc.text('Checkbox Grid Analysis', 25, yPos);
      yPos += 10;
      
      // Create column headers including all column options
      const headers = ['Row'].concat(gridData.columns).concat(['Row Total']);
      
      // Create table data including counts for each cell
      const tableData = gridData.rows.map((row, rowIndex) => {
        const rowData = [row];
        gridData.values[rowIndex].forEach(value => {
          rowData.push(value);
        });
        rowData.push(gridData.row_totals[rowIndex] || 0);
        return rowData;
      });
      
      doc.autoTable({
        startY: yPos,
        head: [headers],
        body: tableData,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        headStyles: { fillColor: [52, 152, 219] }
      });
      
      yPos = doc.previousAutoTable.finalY + 15;
      
      // Co-occurrences if available
      if (gridData.co_occurrences && gridData.co_occurrences.length > 0) {
        // Add page if needed
        if (yPos > 230) {
          doc.addPage();
          yPos = 30;
        }
        
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Top Co-occurrences:', 20, yPos);
        yPos += 10;
        
        const coOccurrenceData = gridData.co_occurrences
          .slice(0, 5)
          .map((item, index) => [
            `${item[0][0]} & ${item[0][1]}`,
            item[1]
          ]);
        
        doc.autoTable({
          startY: yPos,
          head: [['Option Pair', 'Count']],
          body: coOccurrenceData,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          headStyles: { fillColor: [52, 152, 219] }
        });
        
        yPos = doc.previousAutoTable.finalY + 15;
      }
      
    } else {
      // Default (radio grid) - show option distribution with dominant choice
      doc.setFont(StandardFonts.Helvetica, 'italic');
      doc.text('Radio Grid Analysis', 25, yPos);
      yPos += 10;
      
      // Create column headers including all column options
      const headers = ['Row'].concat(gridData.columns).concat(['Row Total', 'Dominant Choice']);
      
      // Create table data including counts for each cell
      const tableData = gridData.rows.map((row, rowIndex) => {
        const rowData = [row];
        gridData.values[rowIndex].forEach(value => {
          rowData.push(value);
        });
        rowData.push(gridData.row_totals[rowIndex] || 0);
        rowData.push(gridData.dominant_choices ? gridData.dominant_choices[rowIndex] : 'N/A');
        return rowData;
      });
      
      doc.autoTable({
        startY: yPos,
        head: [headers],
        body: tableData,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        headStyles: { fillColor: [52, 152, 219] }
      });
      
      yPos = doc.previousAutoTable.finalY + 15;
    }
    
    doc.addPage();
  };

  // Helper function to add chart and statistics for standard questions
  const addChartAndStats = async (doc, question, analyticsData, settings, startY) => {
    let yPos = startY + 10;
    
    // Check if analytics data exists
    if (!analyticsData.analytics) {
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text('No analytics data available', 25, yPos);
      doc.addPage();
      return;
    }
    
    const { analytics } = analyticsData;
    
    // Different handling based on analytics type
    if (analytics.type === 'single_select_distribution') {
      // Multiple choice or dropdown
      await addSingleSelectChart(doc, question, analyticsData, settings, yPos);
    } else if (analytics.type === 'multi_select_distribution') {
      // Checkbox question
      await addMultiSelectChart(doc, question, analyticsData, settings, yPos);
    } else if (analytics.type === 'numeric_stats') {
      // Rating scale, NPS, or numerical input
      await addNumericStatsChart(doc, question, analyticsData, settings, yPos);
    } else {
      // Unknown type
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text(`Unsupported analytics type: ${analytics.type}`, 25, yPos);
      doc.addPage();
    }
  };

  // Helper function for single select charts (multiple choice, dropdown)
  const addSingleSelectChart = async (doc, question, analyticsData, settings, startY) => {
    let yPos = startY;
    
    const { analytics } = analyticsData;
    const { options_distribution } = analytics;
    
    // Chart title
    const chartTitle = settings.customTitle || `Response Distribution for ${question.question_text}`;
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text(chartTitle, 20, yPos);
    yPos += 10;
    
    // Chart description based on chart type
    doc.setFont(StandardFonts.Helvetica, 'italic');
    doc.text(`Chart Type: ${settings.chartType}`, 25, yPos);
    yPos += 10;
    
    // Add a placeholder for chart visualization
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text('Chart visualization would be included in the final PDF.', 25, yPos);
    yPos += 15;
    
    // Add response distribution table
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Response Distribution:', 20, yPos);
    yPos += 10;
    
    const tableData = options_distribution.map(item => [
      item.option,
      item.count,
      `${item.percentage.toFixed(1)}%`
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['Option', 'Count', 'Percentage']],
      body: tableData,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      headStyles: { fillColor: [52, 152, 219] }
    });
    
    yPos = doc.previousAutoTable.finalY + 15;
    
    // Find the most selected option
    const mostSelected = options_distribution.reduce((prev, current) => 
      (prev.count > current.count) ? prev : current, { count: 0 });
    
    // Add insights
    if (yPos > 230) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Insights:', 20, yPos);
    yPos += 10;
    
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text(`• Most selected option: "${mostSelected.option}" (${mostSelected.percentage.toFixed(1)}%)`, 25, yPos);
    yPos += 8;
    
    // Calculate total responses for this question
    const totalResponses = options_distribution.reduce((sum, item) => sum + item.count, 0);
    doc.text(`• Total responses for this question: ${totalResponses}`, 25, yPos);
    
    doc.addPage();
  };

  // Helper function for multi select charts (checkbox)
  const addMultiSelectChart = async (doc, question, analyticsData, settings, startY) => {
    let yPos = startY;
    
    const { analytics } = analyticsData;
    const { option_distribution, top_co_occurrences } = analytics;
    
    // Chart title
    const chartTitle = settings.customTitle || `Option Distribution for ${question.question_text}`;
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text(chartTitle, 20, yPos);
    yPos += 10;
    
    // Chart description based on chart type
    doc.setFont(StandardFonts.Helvetica, 'italic');
    doc.text(`Chart Type: ${settings.chartType}`, 25, yPos);
    yPos += 10;
    
    // Add a placeholder for chart visualization
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text('Chart visualization would be included in the final PDF.', 25, yPos);
    yPos += 15;
    
    // Add option distribution table
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Option Distribution:', 20, yPos);
    yPos += 10;
    
    const tableData = option_distribution.map(item => [
      item.option,
      item.count,
      `${item.percentage_of_responses.toFixed(1)}%`,
      `${item.percentage_of_selections.toFixed(1)}%`
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['Option', 'Count', '% of Responses', '% of Selections']],
      body: tableData,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      headStyles: { fillColor: [52, 152, 219] }
    });
    
    yPos = doc.previousAutoTable.finalY + 15;
    
    // Co-occurrences if available
    if (top_co_occurrences && top_co_occurrences.length > 0) {
      // Add page if needed
      if (yPos > 230) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Top Co-occurrences:', 20, yPos);
      yPos += 10;
      
      const coOccurrenceData = top_co_occurrences.map(item => [
        `${item.pair[0]} & ${item.pair[1]}`,
        item.count
      ]);
      
      doc.autoTable({
        startY: yPos,
        head: [['Option Pair', 'Count']],
        body: coOccurrenceData,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        headStyles: { fillColor: [52, 152, 219] }
      });
      
      yPos = doc.previousAutoTable.finalY + 15;
    }
    
    // Find the most selected option
    const mostSelected = option_distribution.reduce((prev, current) => 
      (prev.count > current.count) ? prev : current, { count: 0 });
    
    // Add insights
    if (yPos > 230) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Insights:', 20, yPos);
    yPos += 10;
    
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text(`• Most selected option: "${mostSelected.option}" (${mostSelected.percentage_of_responses.toFixed(1)}% of responses)`, 25, yPos);
    yPos += 8;
    
    // Calculate average selections per response
    const totalSelections = option_distribution.reduce((sum, item) => sum + item.count, 0);
    const totalResponses = analyticsData.total_responses || 0;
    const avgSelectionsPerResponse = totalResponses > 0 ? (totalSelections / totalResponses).toFixed(2) : 'N/A';
    
    doc.text(`• Average selections per response: ${avgSelectionsPerResponse}`, 25, yPos);
    
    doc.addPage();
  };

  // Helper function for numeric stats charts (rating scale, NPS, numerical input)
  const addNumericStatsChart = async (doc, question, analyticsData, settings, startY) => {
    let yPos = startY;
    
    const { analytics, question_type } = analyticsData;
    
    // Chart title
    const chartTitle = settings.customTitle || `Statistics for ${question.question_text}`;
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text(chartTitle, 20, yPos);
    yPos += 10;
    
    // Chart description based on chart type
    doc.setFont(StandardFonts.Helvetica, 'italic');
    doc.text(`Chart Type: ${settings.chartType}`, 25, yPos);
    yPos += 10;
    
    // Add a placeholder for chart visualization
    doc.setFont(StandardFonts.Helvetica, 'normal');
    doc.text('Chart visualization would be included in the final PDF.', 25, yPos);
    yPos += 15;
    
    // Add statistics table
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Statistical Summary:', 20, yPos);
    yPos += 10;
    
    const statsData = [
      ['Mean', (analytics.mean || 0).toFixed(2)],
      ['Median', (analytics.median || 0).toFixed(2)],
      ['Standard Deviation', (analytics.std_dev || 0).toFixed(2)],
      ['Min', (analytics.min || 0).toFixed(1)],
      ['Max', (analytics.max || 0).toFixed(1)]
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [['Statistic', 'Value']],
      body: statsData,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      headStyles: { fillColor: [52, 152, 219] }
    });
    
    yPos = doc.previousAutoTable.finalY + 15;
    
    // Special handling for NPS
    if (question_type === 'nps' && analytics.nps_segments) {
      // Add page if needed
      if (yPos > 230) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('NPS Analysis:', 20, yPos);
      yPos += 10;
      
      const { promoters, passives, detractors } = analytics.nps_segments;
      const total = promoters + passives + detractors;
      
      const npsData = [
        ['Promoters (9-10)', promoters, total > 0 ? `${(promoters / total * 100).toFixed(1)}%` : '0%'],
        ['Passives (7-8)', passives, total > 0 ? `${(passives / total * 100).toFixed(1)}%` : '0%'],
        ['Detractors (0-6)', detractors, total > 0 ? `${(detractors / total * 100).toFixed(1)}%` : '0%'],
        ['Total', total, '100%'],
        ['NPS Score', analytics.nps_score ? analytics.nps_score.toFixed(1) : 'N/A', '']
      ];
      
      doc.autoTable({
        startY: yPos,
        head: [['Category', 'Count', 'Percentage']],
        body: npsData,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        headStyles: { fillColor: [52, 152, 219] }
      });
      
      yPos = doc.previousAutoTable.finalY + 15;
    }
    
    // Add insights
    if (yPos > 230) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.text('Insights:', 20, yPos);
    yPos += 10;
    
    doc.setFont(StandardFonts.Helvetica, 'normal');
    
    // For NPS, add interpretation
    if (question_type === 'nps' && analytics.nps_score !== undefined) {
      let interpretation = 'Needs improvement';
      if (analytics.nps_score >= 50) interpretation = 'Excellent';
      else if (analytics.nps_score >= 30) interpretation = 'Good';
      else if (analytics.nps_score >= 0) interpretation = 'Average';
      
      doc.text(`• NPS Score: ${analytics.nps_score.toFixed(1)} (${interpretation})`, 25, yPos);
      yPos += 8;
    } else {
      // For other numeric questions
      doc.text(`• Average rating: ${(analytics.mean || 0).toFixed(2)}`, 25, yPos);
      yPos += 8;
    }
    
    doc.text(`• Total responses: ${analyticsData.total_responses || 0}`, 25, yPos);
    
    doc.addPage();
  };

  // Helper function to add response time analysis
  const addResponseTimeAnalysis = async (doc, surveyId) => {
    // Add section title
    doc.setFillColor(52, 152, 219);
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Response Time Analysis', 105, 10, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    let yPos = 30;
    
    try {
      // Fetch response time data
      const response = await fetch(`http://localhost:5000/surveys/${surveyId}/response-times-advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filters: {} })  // Empty filters to get all data
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const responseTimeData = await response.json();
      
      // Add summary statistics
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Summary Statistics:', 20, yPos);
      yPos += 10;
      
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text(`Total Submissions: ${responseTimeData.count_submissions || 0}`, 25, yPos);
      yPos += 8;
      
      doc.text(`Average Duration: ${(responseTimeData.average_duration || 0).toFixed(2)} seconds`, 25, yPos);
      yPos += 8;
      
      doc.text(`Median Duration: ${(responseTimeData.median_duration || 0).toFixed(2)} seconds`, 25, yPos);
      yPos += 20;
      
      // Add completion time distribution
      if (responseTimeData.duration_histogram && Object.keys(responseTimeData.duration_histogram).length > 0) {
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Completion Time Distribution:', 20, yPos);
        yPos += 10;
        
        // Create table data
        const histogramData = Object.entries(responseTimeData.duration_histogram).map(([timeRange, count]) => [
          timeRange, count
        ]);
        
        doc.autoTable({
          startY: yPos,
          head: [['Time Range (seconds)', 'Count']],
          body: histogramData,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          headStyles: { fillColor: [52, 152, 219] }
        });
        
        yPos = doc.previousAutoTable.finalY + 15;
      }
      
      // Add average time per question
      if (responseTimeData.question_avg_times && Object.keys(responseTimeData.question_avg_times).length > 0) {
        // Add page if needed
        if (yPos > 230) {
          doc.addPage();
          yPos = 30;
        }
        
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Average Time Per Question (seconds):', 20, yPos);
        yPos += 10;
        
        // Create table data
        const questionTimeData = Object.entries(responseTimeData.question_avg_times).map(([questionId, avgTime]) => [
          questionId, avgTime.toFixed(2)
        ]);
        
        doc.autoTable({
          startY: yPos,
          head: [['Question ID', 'Average Time (sec)']],
          body: questionTimeData,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          headStyles: { fillColor: [52, 152, 219] }
        });
        
        yPos = doc.previousAutoTable.finalY + 15;
      }
      
      // Add insights
      if (yPos > 230) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Insights:', 20, yPos);
      yPos += 10;
      
      doc.setFont(StandardFonts.Helvetica, 'normal');
      
      // Find longest and shortest questions if data is available
      if (responseTimeData.question_avg_times && Object.keys(responseTimeData.question_avg_times).length > 0) {
        const questionTimes = Object.entries(responseTimeData.question_avg_times);
        const longestQuestion = questionTimes.reduce((prev, current) => 
          (prev[1] > current[1]) ? prev : current);
        const shortestQuestion = questionTimes.reduce((prev, current) => 
          (prev[1] < current[1]) ? prev : current);
        
        doc.text(`• Question taking the longest time: Question ${longestQuestion[0]} (${longestQuestion[1].toFixed(2)} sec)`, 25, yPos);
        yPos += 8;
        
        doc.text(`• Question taking the shortest time: Question ${shortestQuestion[0]} (${shortestQuestion[1].toFixed(2)} sec)`, 25, yPos);
        yPos += 8;
      }
      
      // Compare with average survey completion time
      if (responseTimeData.average_duration) {
        // Typical survey completion time ranges
        let completionTimeComment = 'This is a moderate survey completion time.';
        if (responseTimeData.average_duration < 120) {
          completionTimeComment = 'This is a short survey completion time, indicating good engagement.';
        } else if (responseTimeData.average_duration > 600) {
          completionTimeComment = 'This is a long survey completion time, which may indicate complexity or low engagement.';
        }
        
        doc.text(`• ${completionTimeComment}`, 25, yPos);
      }
      
      doc.addPage();
      
    } catch (err) {
      console.error('Error fetching response time data:', err);
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text('Error fetching response time data', 20, 30);
      doc.addPage();
    }
  };

  // Helper function to add dropout analysis
  const addDropoutAnalysis = async (doc, surveyId) => {
    // Add section title
    doc.setFillColor(52, 152, 219);
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setFont(StandardFonts.Helvetica, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('Dropout Analysis', 105, 10, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    let yPos = 30;
    
    try {
      // Fetch dropout analysis data
      const response = await fetch(`http://localhost:5000/surveys/${surveyId}/dropout-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filters: {} })  // Empty filters to get all data
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const dropoutData = await response.json();
      
      // Add summary statistics
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Summary Statistics:', 20, yPos);
      yPos += 10;
      
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text(`Total Submissions: ${dropoutData.total_submissions || 0}`, 25, yPos);
      yPos += 8;
      
      doc.text(`Completion Rate: ${(dropoutData.completion_rate || 0).toFixed(2)}%`, 25, yPos);
      yPos += 20;
      
      // Add dropout distribution
      if (dropoutData.dropout_distribution && Object.keys(dropoutData.dropout_distribution).length > 0) {
        doc.setFont(StandardFonts.Helvetica, 'bold');
        doc.text('Dropout Distribution (where respondents stopped):', 20, yPos);
        yPos += 10;
        
        // Create table data
        const dropoutDistData = Object.entries(dropoutData.dropout_distribution).map(([questionId, count]) => [
          questionId, count, ((count / dropoutData.total_submissions) * 100).toFixed(2) + '%'
        ]);
        
        doc.autoTable({
          startY: yPos,
          head: [['Question ID', 'Count', 'Percentage']],
          body: dropoutDistData,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          headStyles: { fillColor: [52, 152, 219] }
        });
        
        yPos = doc.previousAutoTable.finalY + 15;
      }
      
      // Add insights
      if (yPos > 230) {
        doc.addPage();
        yPos = 30;
      }
      
      doc.setFont(StandardFonts.Helvetica, 'bold');
      doc.text('Insights:', 20, yPos);
      yPos += 10;
      
      doc.setFont(StandardFonts.Helvetica, 'normal');
      
      // Find highest dropout question if data is available
      if (dropoutData.dropout_distribution && Object.keys(dropoutData.dropout_distribution).length > 0) {
        const dropoutDistEntries = Object.entries(dropoutData.dropout_distribution);
        const highestDropout = dropoutDistEntries.reduce((prev, current) => 
          (prev[1] > current[1]) ? prev : current);
        
        doc.text(`• Highest dropout at: Question ${highestDropout[0]} (${highestDropout[1]} respondents, ${((highestDropout[1] / dropoutData.total_submissions) * 100).toFixed(2)}%)`, 25, yPos);
        yPos += 8;
        
        // Calculate dropout rate
        const completionRate = dropoutData.completion_rate || 0;
        const dropoutRate = 100 - completionRate;
        
        doc.text(`• Overall dropout rate: ${dropoutRate.toFixed(2)}%`, 25, yPos);
        yPos += 8;
        
        // Provide insights based on completion rate
        let completionComment = 'The survey has an average completion rate.';
        if (completionRate >= 85) {
          completionComment = 'The survey has an excellent completion rate, indicating good engagement.';
        } else if (completionRate >= 70) {
          completionComment = 'The survey has a good completion rate.';
        } else if (completionRate < 50) {
          completionComment = 'The survey has a low completion rate, suggesting potential issues with length or engagement.';
        }
        
        doc.text(`• ${completionComment}`, 25, yPos);
      } else {
        doc.text('• No dropout data available to analyze.', 25, yPos);
      }
      
      doc.addPage();
      
    } catch (err) {
      console.error('Error fetching dropout data:', err);
      doc.setFont(StandardFonts.Helvetica, 'normal');
      doc.text('Error fetching dropout data', 20, 30);
      doc.addPage();
    }
  };

  // Render UI for settings and generation
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
        Survey PDF Report Generator
      </h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading survey data...</p>
        </div>
      ) : (
        <>
          {/* Survey information */}
          {survey && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Survey: {survey.title}</h3>
              <p className="text-gray-600">ID: {surveyId}</p>
              <p className="text-gray-600">Questions: {survey.questions ? survey.questions.length : 0}</p>
            </div>
          )}
          
          {/* Report options */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 pb-2 border-b">Report Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Include demographics */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeDemographics"
                  checked={includeDemographics}
                  onChange={(e) => setIncludeDemographics(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="includeDemographics" className="ml-2 text-gray-700">
                  Include demographics information
                </label>
              </div>
              
              {/* Include response time analysis */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeResponseTime"
                  checked={includeResponseTimeAnalysis}
                  onChange={(e) => setIncludeResponseTimeAnalysis(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="includeResponseTime" className="ml-2 text-gray-700">
                  Include response time analysis
                </label>
              </div>
              
              {/* Include dropout analysis */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeDropout"
                  checked={includeDropoutAnalysis}
                  onChange={(e) => setIncludeDropoutAnalysis(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="includeDropout" className="ml-2 text-gray-700">
                  Include dropout analysis
                </label>
              </div>
              
              {/* Show word clouds */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showWordClouds"
                  checked={showWordClouds}
                  onChange={(e) => setShowWordClouds(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="showWordClouds" className="ml-2 text-gray-700">
                  Include word clouds for open-ended questions
                </label>
              </div>
              
              {/* Show open-ended responses */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showOpenEndedResponses"
                  checked={showOpenEndedResponses}
                  onChange={(e) => setShowOpenEndedResponses(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="showOpenEndedResponses" className="ml-2 text-gray-700">
                  Include open-ended responses
                </label>
              </div>
            </div>
            
            {/* Open-ended response limit */}
            {showOpenEndedResponses && (
              <div className="mb-4">
                <label htmlFor="openEndedResponseLimit" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of open-ended responses to include:
                </label>
                <input
                  type="number"
                  id="openEndedResponseLimit"
                  min="1"
                  max="20"
                  value={openEndedResponseLimit}
                  onChange={(e) => setOpenEndedResponseLimit(parseInt(e.target.value, 10))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          </div>
          
          {/* Chart customization */}
          {survey && survey.questions && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 pb-2 border-b">Chart Customization</h3>
              
              {/* Bulk settings */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Global Chart Settings:</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Chart type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Chart Type:
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      onChange={(e) => applySettingsToAll({ chartType: e.target.value })}
                    >
                      <option value="">Select chart type...</option>
                      <option value="bar">Bar Chart</option>
                      <option value="horizontalBar">Horizontal Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="doughnut">Doughnut Chart</option>
                      <option value="line">Line Chart</option>
                    </select>
                  </div>
                  
                  {/* Chart color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Chart Color:
                    </label>
                    <input
                      type="color"
                      className="w-full h-10 p-1 border border-gray-300 rounded-md"
                      defaultValue="#36A2EB"
                      onChange={(e) => applySettingsToAll({ chartColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              {/* Individual question customization */}
              <div className="mb-4">
                <h4 className="font-medium mb-3">Question-specific Settings:</h4>
                
                <div className="border rounded-md divide-y">
                  {survey.questions.map((question, index) => (
                    <div key={question.id} className="p-4">
                      <h5 className="font-medium mb-2">
                        Q{index + 1}: {question.question_text}
                      </h5>
                      <p className="text-sm text-gray-600 mb-3">
                        Type: {question.question_type}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Chart type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Chart Type:
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={(chartSettings[question.id] || {}).chartType || getDefaultChartType(question.question_type)}
                            onChange={(e) => updateQuestionChartSettings(question.id, { chartType: e.target.value })}
                            disabled={question.question_type === 'open-ended' || question.question_type.includes('grid')}
                          >
                            <option value="bar">Bar Chart</option>
                            <option value="horizontalBar">Horizontal Bar Chart</option>
                            <option value="pie">Pie Chart</option>
                            <option value="doughnut">Doughnut Chart</option>
                            <option value="line">Line Chart</option>
                          </select>
                        </div>
                        
                        {/* Chart title */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Title:
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={(chartSettings[question.id] || {}).customTitle || ''}
                            onChange={(e) => updateQuestionChartSettings(question.id, { customTitle: e.target.value })}
                            placeholder="Optional custom title"
                          />
                        </div>
                      </div>
                      
                      {/* Color customization for multiple choice or checkbox */}
                      {(question.question_type === 'multiple-choice' || 
                         question.question_type === 'dropdown' || 
                         question.question_type === 'checkbox') && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Option Colors:
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            You can customize colors for each option when question data is loaded.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Generate button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={saveChartSettings}
              disabled={loading || generatePdf}
              className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-6 rounded-lg mr-4"
            >
              Save Settings
            </button>
            <button
              onClick={generatePDFReport}
              disabled={loading || generatePdf}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg"
            >
              Generate PDF Report
            </button>
            <button
              onClick={onClose}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-lg ml-4"
            >
              Cancel
            </button>
          </div>
          
          {/* Progress indicator during PDF generation */}
          {generatePdf && (
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">
                  {progress.message}
                </span>
                <span className="text-sm text-blue-700">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SurveyPDFReportGenerator;