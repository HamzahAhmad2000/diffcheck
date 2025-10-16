// src/components/Analytics/AISummaryReport.js

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Bar, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import "./AISummaryReport.css"; // new compact styles
import { aiAPI, surveyAPI } from "../../services/apiClient";
import LegalAcceptanceModal from '../admin/LegalAcceptanceModal';
import toast from "react-hot-toast";
import jsPDF from "jspdf";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Constants
const DEFAULT_PALETTE = [
  "#36A2EB",
  "#FF6384",
  "#4BC0C0",
  "#FF9F40",
  "#9966FF",
  "#FFCD56",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FECA57",
  "#FF9FF3",
  "#54A0FF",
  "#5F27CD"
];

// --- Chart Utility Functions (Using existing patterns) ---
const generateDefaultColors = (count) => {
  if (count <= 0) return ["#cccccc"];
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
  }
  return colors;
};

const createChartImage = ({ type, data, options, width = 800, height = 450 }) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = "absolute";
    canvas.style.left = "-9999px";
    canvas.style.top = "-9999px";
    canvas.style.visibility = "hidden";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      document.body.removeChild(canvas);
      return reject(new Error("Failed to get canvas context"));
    }

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let chart = null;
    try {
      chart = new ChartJS(ctx, {
        type,
        data,
        options: {
          ...options,
          animation: false,
          responsive: false,
          maintainAspectRatio: false,
        },
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const img = canvas.toDataURL("image/png", 1.0);
            if (chart) chart.destroy();
            document.body.removeChild(canvas);
            resolve(img);
          } catch (e) {
            console.error("Error converting canvas:", e);
            if (chart) chart.destroy();
            document.body.removeChild(canvas);
            reject(new Error("Failed to export chart image"));
          }
        });
      });
    } catch (chartError) {
      console.error("Chart.js Error:", chartError);
      if (chart) chart.destroy();
      document.body.removeChild(canvas);
      reject(new Error("Failed to initialize chart for export"));
    }
  });
};

// --- Main Component ---
const AISummaryReport = () => {
  const { surveyId } = useParams();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [filters, setFilters] = useState({
    includeAllResponses: true,
    ageGroup: [],
    gender: [],
    region: [],
    cohort: [],
  });
  const [sampleSize, setSampleSize] = useState(0);
  const [comparisonGroup, setComparisonGroup] = useState("none");
  const [comparisonSegments, setComparisonSegments] = useState([]);
  const [availableSegments, setAvailableSegments] = useState([]);
  const [report, setReport] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState(null);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);

  // Legal acceptance modal state
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  // Excluded question types
  const excludedTypes = new Set([
    "signature",
    "date-picker",
    "email-input",
    "file-upload",
    "document-upload",
    "content-text",
    "content-media",
  ]);

  // --- Fetch eligible questions ---
  useEffect(() => {
    const fetchSurveyQuestions = async () => {
      if (!surveyId) return;
      console.log("[DEBUG] Fetching questions for surveyId:", surveyId);
      
      try {
        const response = await aiAPI.getEligibleQuestions(surveyId);
        const data = response.data;
        console.log("[AI DEBUG] Got eligible questions:", data);

        if (data?.eligible_questions && Array.isArray(data.eligible_questions)) {
          const eligible = data.eligible_questions.filter((q) => {
            const isExcluded = excludedTypes.has(q.question_type);
            console.log(`[DEBUG] Filtering Q: ${q.id} (${q.question_type}). Is excluded: ${isExcluded}`);
            return !isExcluded;
          });

          console.log("[DEBUG] Filtered eligible questions:", eligible);
          setSurveyQuestions(eligible);
          
          // Auto-select all eligible questions by default
          const allQuestionIds = eligible.map(q => q.id);
          setSelectedQuestions(allQuestionIds);
          console.log("[DEBUG] Auto-selected all questions:", allQuestionIds);
        } else {
          console.warn("[DEBUG] data.eligible_questions was missing or not an array:", data);
          setSurveyQuestions([]);
          setSelectedQuestions([]);
        }
      } catch (err) {
        setError(err.message || "Failed to load questions");
        console.error("[ERROR] Failed to fetch questions:", err);
        setSurveyQuestions([]);
      }
    };
    
    fetchSurveyQuestions();
  }, [surveyId]);

  // --- Fetch sample size ---
  const fetchSampleSize = useCallback(async () => {
    if (!surveyId) return;
    try {
      const resp = await surveyAPI.getDemographicAnalytics(surveyId, filters);
      setSampleSize(resp.data?.total_responses ?? 0);
    } catch (err) {
      console.error("Sample size fetch error:", err);
      setSampleSize(0);
    }
  }, [surveyId, filters]);

  useEffect(() => {
    fetchSampleSize();
  }, [fetchSampleSize]);

  // Check legal acceptance on component mount
  useEffect(() => {
    if (user && !user.has_accepted_legal_terms) {
      setShowLegalModal(true);
    }
  }, [user]);

  // --- Event Handlers ---
  const handleStartAnalysis = () => setStep(1);
  
  const handleQuestionSelect = (questionId) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSelectAllChange = (isChecked) => {
    if (isChecked) {
      const allIds = surveyQuestions.map((q) => q.id);
      setSelectedQuestions(allIds);
    } else {
      setSelectedQuestions([]);
    }
  };

  const handleFilterChange = (category, value, isChecked) => {
    setFilters((prev) => {
      if (category === "includeAllResponses") {
        return {
          ...prev,
          includeAllResponses: value,
          ageGroup: [],
          gender: [],
          region: [],
          cohort: [],
        };
      }
      const newFilters = { ...prev, includeAllResponses: false };
      const currentCategory = prev[category] || [];
      if (isChecked) {
        newFilters[category] = [...currentCategory, value];
      } else {
        newFilters[category] = currentCategory.filter((item) => item !== value);
      }
      return newFilters;
    });
  };

  const handleComparisonGroupChange = (group) => {
    setComparisonGroup(group);
    setComparisonSegments([]);
    const segmentMap = {
      age: ["18-24", "25-34", "35-44", "45-54", "55+"],
      gender: ["Male", "Female", "Non-binary", "Other"],
      region: ["North America", "Europe", "Asia", "Latin America", "Africa", "Oceania"],
      cohort: ["iOS", "Android", "Web", "Desktop", "Pro User", "Free User"],
    };
    setAvailableSegments(segmentMap[group] || []);
  };

  const handleSegmentSelect = (segment) => {
    setComparisonSegments((prev) =>
      prev.includes(segment)
        ? prev.filter((s) => s !== segment)
        : [...prev, segment]
    );
  };

  const handleLegalAccepted = () => {
    setShowLegalModal(false);
    // Update local user state to reflect acceptance
    const updatedUser = { ...user, has_accepted_legal_terms: true };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditedReport(JSON.parse(JSON.stringify(report)));
    } else {
      setReport(editedReport);
    }
    setIsEditing(!isEditing);
  };

  const handleSummaryEdit = (newSummary) => {
    setEditedReport((prev) => ({
      ...prev,
      insights: {
        ...prev.insights,
        executive_summary: newSummary,
      },
    }));
  };

  const handleQuestionInsightEdit = (questionId, field, value) => {
    setEditedReport((prev) => ({
      ...prev,
      insights: {
        ...prev.insights,
        question_insights: {
          ...prev.insights.question_insights,
          [questionId]: {
            ...prev.insights.question_insights[questionId],
            [field]: value,
          },
        },
      },
    }));
  };

  // --- Generate Report ---
  const handleGenerateReport = async () => {
    if (comparisonGroup !== "none" && comparisonSegments.length < 2) {
      toast.error("Select at least 2 segments for comparison.");
      return;
    }
    if (selectedQuestions.length === 0) {
      toast.error("Select at least 1 question.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setReport(null);
    setStep(4);

    try {
      const comparisonSettings =
        comparisonGroup === "none"
          ? { type: "No Comparison" }
          : { type: comparisonGroup, segments: comparisonSegments };
          
      const response = await aiAPI.generateReportInsights(
        surveyId,
        selectedQuestions,
        filters,
        comparisonSettings
      );
      
      const reportData = response?.data?.advanced_report || response?.data;
      setReport(reportData);
    } catch (err) {
      const errorMsg = err.message || "Failed to generate report.";
      setError(errorMsg);
      toast.error(`Report Error: ${errorMsg}`);
      console.error("[ERROR] handleGenerateReport:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Test function to verify chart generation
  const testChartGeneration = async () => {
    console.log('🧪 Testing chart generation...');
    const testData = {
      type: 'bar',
      title: 'Test Chart',
      data: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 }
      ]
    };
    
    try {
      const result = await createChartImageForPDF(testData);
      console.log('🧪 Test result:', result ? 'SUCCESS' : 'FAILED');
      return result;
    } catch (error) {
      console.error('🧪 Test failed:', error);
      return null;
    }
  };

  // Helper function to create chart image for PDF
  const createChartImageForPDF = async (chartData) => {
    console.log('🎯 Creating chart image for PDF:', chartData);
    
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      console.log('❌ Chart data is invalid or empty');
      return null;
    }

    try {
      // Handle wordcloud type differently
      if (chartData.type === 'wordcloud') {
        console.log('📝 Wordcloud type - returning null for text handling');
        return null; // We'll handle this as text in PDF
      }

      // Prepare Chart.js data structure with better error checking
      const labels = chartData.data.map(item => {
        const label = item.category || item.word || item.label || `Item ${chartData.data.indexOf(item) + 1}`;
        return String(label);
      });
      
      const dataValues = chartData.data.map(item => {
        const value = item.value || item.frequency || 0;
        return Number(value);
      });

      if (labels.length === 0 || dataValues.length === 0) {
        console.log('❌ No valid data found for chart');
        return null;
      }

      const chartJSData = {
        labels: labels,
        datasets: [{
          label: chartData.title || 'Data',
          data: dataValues,
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 205, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          borderWidth: 1
        }]
      };

      console.log('📊 Chart.js data prepared:', chartJSData);

      const chartOptions = {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: chartData.type !== 'pie',
            position: 'top',
            labels: { 
              font: { size: 12 },
              boxWidth: 12
            }
          },
          title: {
            display: true,
            text: chartData.title,
            font: { size: 14, weight: 'bold' },
            padding: 10
          }
        },
        scales: chartData.type === 'pie' ? undefined : {
          y: { 
            beginAtZero: true,
            ticks: { 
              font: { size: 10 },
              stepSize: 1
            }
          },
          x: { 
            ticks: { 
              font: { size: 10 },
              maxRotation: 45 
            }
          }
        }
      };

      console.log('⚙️ Calling createChartImage function...');
      
      // Use a promise-based approach with timeout
      const chartPromise = createChartImage({
        type: chartData.type === 'pie' ? 'pie' : 'bar',
        data: chartJSData,
        options: chartOptions,
        width: 1200,
        height: 500
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Chart generation timeout')), 10000)
      );

      const imageResult = await Promise.race([chartPromise, timeoutPromise]);

      console.log('✅ Chart image created successfully:', imageResult ? imageResult.substring(0, 50) + '...' : 'Failed to generate');
      return imageResult;

    } catch (error) {
      console.error('❌ Error creating chart image for PDF:', error);
      return null;
    }
  };

  // --- PDF Export ---
  const handleExportPDF = async () => {
    if (!report || isExporting) {
      toast.error("Report data unavailable or export in progress.");
      return;
    }
    
    setIsExporting(true);
    toast.loading("Generating comprehensive PDF report with charts...", { id: "pdf-export" });
    
    try {
      // Test chart generation first
      console.log('🧪 Testing chart generation before PDF creation...');
      const testResult = await testChartGeneration();
      if (!testResult) {
        console.log('⚠️ Chart generation test failed, but continuing with PDF...');
      }

      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let currentY = margin;

      // Extract data using same logic as render function
      const executive_summary = report.executive_summary || report.advanced_report?.executive_summary || [];
      const question_insights = report.question_insights || report.advanced_report?.question_insights || [];
      const insights = report.insights || report.advanced_report?.insights || [];
      const statistics = report.statistics || report.advanced_report?.statistics || {};

      console.log('📊 Processing insights:', {
        executive_summary: executive_summary.length,
        question_insights: question_insights.length,
        insights: insights.length,
        statistics: Object.keys(statistics).length
      });

      // Helper function to check page break
      const checkPageBreak = (neededSpace) => {
        if (currentY + neededSpace > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }
      };

      // Title and Header
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(170, 46, 255); // Purple color
      doc.text("AI Insights Report", margin, currentY);
      currentY += 20;

      // Report Meta Information
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "bold");
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, currentY);
      currentY += 7;
      doc.text(`Questions Analyzed: ${question_insights?.length || 0}`, margin, currentY);
      currentY += 7;
      if (statistics?.total_responses) {
        doc.text(`Sample Size: ${statistics.total_responses} responses`, margin, currentY);
        currentY += 7;
      }
      currentY += 15;



      // Executive Summary Section
      if (executive_summary && executive_summary.length > 0) {
        checkPageBreak(60);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Key Performance Insights", margin, currentY);
        currentY += 18;

        executive_summary.forEach((item, idx) => {
          checkPageBreak(35);
          
          // Headline
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(170, 46, 255);
          const headlineLines = doc.splitTextToSize(item.headline, pageWidth - margin * 2);
          doc.text(headlineLines, margin + 5, currentY);
          currentY += headlineLines.length * 7 + 4;

          // Detail
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const detailLines = doc.splitTextToSize(item.detail, pageWidth - margin * 2);
          doc.text(detailLines, margin + 5, currentY);
          currentY += detailLines.length * 6 + 12;
        });
        currentY += 8;
      }

      // Strategic Recommendations Section
      if (insights && insights.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Strategic Recommendations", margin, currentY);
        currentY += 18;

        insights.forEach((insight, idx) => {
          checkPageBreak(20);
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text(`• `, margin + 5, currentY);
          const insightLines = doc.splitTextToSize(insight, pageWidth - margin * 2 - 15);
          doc.text(insightLines, margin + 15, currentY);
          currentY += insightLines.length * 7 + 8;
        });
        currentY += 15;
      }

      // Question Insights Section
      if (question_insights && question_insights.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Detailed Question Analysis", margin, currentY);
        currentY += 20;

                // Process each question sequentially
        let chartSuccessCount = 0;
        let chartFailCount = 0;
        
        for (const [idx, insight] of question_insights.entries()) {
          console.log(`📝 Processing question ${idx + 1}/${question_insights.length}`);
          checkPageBreak(70);

          // Question Title
          doc.setFontSize(15);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(170, 46, 255);
          const questionLines = doc.splitTextToSize(`Q${idx + 1}: ${insight.question_text}`, pageWidth - margin * 2);
          doc.text(questionLines, margin, currentY);
          currentY += questionLines.length * 8 + 6;

          // Headline
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          const headlineLines = doc.splitTextToSize(insight.headline, pageWidth - margin * 2);
          doc.text(headlineLines, margin + 5, currentY);
          currentY += headlineLines.length * 7 + 4;

          // Summary
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          const summaryLines = doc.splitTextToSize(insight.summary, pageWidth - margin * 2);
          doc.text(summaryLines, margin + 5, currentY);
          currentY += summaryLines.length * 6 + 8;



          // Key Insights
          if (insight.insights && insight.insights.length > 0) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("Key Findings:", margin + 5, currentY);
            currentY += 8;

            insight.insights.forEach((finding, findingIdx) => {
              checkPageBreak(12);
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.text(`• `, margin + 10, currentY);
              const findingLines = doc.splitTextToSize(finding, pageWidth - margin * 2 - 15);
              doc.text(findingLines, margin + 15, currentY);
              currentY += findingLines.length * 6 + 3;
            });
          }

          // Chart Generation and Embedding
          if (insight.chart_data) {
            console.log(`🎨 Processing chart for question ${idx + 1}:`, insight.chart_data);
            checkPageBreak(80); // More space needed for chart

            // Add chart title
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(`📊 ${insight.chart_data.title}`, margin + 5, currentY);
            currentY += 8;

            // Update toast message
            toast.loading(`Generating chart ${idx + 1}/${question_insights.length}...`, { id: "pdf-export" });
            
            if (insight.chart_data.type === 'wordcloud') {
              // Handle wordcloud as text
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(100, 100, 100);
              doc.text("Word frequency analysis:", margin + 10, currentY);
              currentY += 5;
              
              insight.chart_data.data.forEach((item, itemIdx) => {
                if (itemIdx < 10) { // Show top 10 words
                  doc.text(`• ${item.word}: ${item.frequency} mentions`, margin + 15, currentY);
                  currentY += 4;
                }
              });
              currentY += 5;
              chartSuccessCount++;
            } else {
              // Generate and embed actual chart
              try {
                console.log('🔄 Generating chart image...');
                const chartImage = await createChartImageForPDF(insight.chart_data);
                
                if (chartImage && chartImage.startsWith('data:image')) {
                  console.log('🖼️ Adding chart image to PDF...');
                  // Calculate chart dimensions (maintain aspect ratio)
                  const maxWidth = pageWidth - margin * 2 - 10;
                  const maxHeight = 60; // mm
                  const chartWidth = Math.min(maxWidth, 120);
                  const chartHeight = Math.min(maxHeight, (chartWidth * 500) / 1200); // Maintain aspect ratio
                  
                  // Check if we need a page break for the chart
                  if (currentY + chartHeight > pageHeight - margin) {
                    console.log('📄 Adding new page for chart');
                    doc.addPage();
                    currentY = margin;
                    
                    // Repeat chart title on new page
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);
                    doc.text(`📊 ${insight.chart_data.title}`, margin + 5, currentY);
                    currentY += 8;
                  }
                  
                  // Add chart image to PDF
                  doc.addImage(
                    chartImage, 
                    'PNG', 
                    margin + 10, // x position
                    currentY,    // y position  
                    chartWidth,  // width
                    chartHeight  // height
                  );
                  
                  currentY += chartHeight + 5;
                  
                  // Add data summary below chart
                  doc.setFontSize(8);
                  doc.setFont("helvetica", "italic");
                  doc.setTextColor(120, 120, 120);
                  doc.text(`Data points: ${insight.chart_data.data.length} categories`, margin + 10, currentY);
                  currentY += 5;
                  
                  chartSuccessCount++;
                  console.log('✅ Chart successfully added to PDF');
                } else {
                  throw new Error('Invalid chart image data');
                }
              } catch (chartError) {
                console.error('❌ Error generating/adding chart:', chartError);
                chartFailCount++;
                
                // Fallback to text description
                doc.setFontSize(9);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(150, 150, 150);
                doc.text(`Chart: ${insight.chart_data.title} (${insight.chart_data.type}) - Unable to render`, margin + 10, currentY);
                currentY += 8;
              }
            }
          }

          currentY += 12; // Space between questions
        }
        
        console.log(`📊 Chart generation summary: ${chartSuccessCount} successful, ${chartFailCount} failed`);
      }

      // Footer with timestamp
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by Eclipseer AI Analytics - ${new Date().toLocaleString()}`, margin, pageHeight - 10);

      const filename = `AI_Insights_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);
      toast.success("Comprehensive PDF report with charts generated!", { id: "pdf-export" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF", { id: "pdf-export" });
    } finally {
      setIsExporting(false);
    }
  };

  // --- Render Functions ---
  const renderWelcomeStep = () => (
    <div className="analytics-panel-container demographics-summary-page">
      <div style={{ marginBottom: '20px' }}>
        <span style={{ 
          backgroundColor: '#AA2EFF', 
          color: 'white', 
          padding: '4px 12px', 
          borderRadius: '12px', 
          fontSize: '12px', 
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          BETA
        </span>
      </div>
      <h3 className="analytics-panel-title">Welcome to AI Insights</h3>
      <p className="para">
        Get automated summaries, headline findings, and an executive-level
        report based on your survey data. This feature is currently in beta and under active development.
      </p>
      <button className="step-button primary" onClick={handleStartAnalysis}>
        Get Started
      </button>
    </div>
  );

  const renderQuestionSelectionStep = () => {
    if (surveyQuestions.length === 0) {
      return (
        <div className="analytics-section">
          <h3>Select Questions</h3>
          <p>Loading questions...</p>
          <div className="step-navigation">
            <button className="step-button secondary" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="step-button primary" disabled={true}>
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="analytics-section">
        <h3>
          Select Questions ({selectedQuestions.length} / {surveyQuestions.length})
        </h3>
        {/* Select All */}
        <div className="filter-checkbox-item" style={{ marginBottom: '0.5rem' , color: '#000'}}>
          <input
            type="checkbox"
            id="select-all-qs"
            checked={selectedQuestions.length === surveyQuestions.length}
            onChange={(e) => handleSelectAllChange(e.target.checked)}
          />
          <label htmlFor="select-all-qs"><strong>Select All</strong></label>
        </div>
        <p>Choose questions for the AI analysis.</p>
        <div className="question-selection-grid">
          {surveyQuestions.map((q) => (
            <div key={q.id} className="question-checkbox-item">
              <input
                type="checkbox"
                id={`q-${q.id}`}
                checked={selectedQuestions.includes(q.id)}
                onChange={() => handleQuestionSelect(q.id)}
              />
              <label htmlFor={`q-${q.id}`}>
                {`Q${q.sequence_number || q.id}: ${q.question_text || "[No Text Found]"}`}
              </label>
            </div>
          ))}
        </div>
        <div className="step-navigation">
          <button className="step-button secondary" onClick={() => setStep(0)}>
            Back
          </button>
          <button
            className="step-button primary"
            onClick={() => setStep(2)}
            disabled={selectedQuestions.length === 0}
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  const renderFilterStep = () => (
    <div className="analytics-section">
      <h3>Apply Filters (Optional)</h3>
      <p>Analyze responses from specific groups.</p>
      <div className="filter-options-container">
        <div className="filter-checkbox-item">
          <input
            type="checkbox"
            id="include-all"
            checked={filters.includeAllResponses}
            onChange={(e) =>
              handleFilterChange("includeAllResponses", e.target.checked)
            }
          />
          <label htmlFor="include-all" style={{ color: "#000" }}>
            Include all responses
          </label>
        </div>
        {!filters.includeAllResponses && (
          <>
            <div className="filter-group">
              <h4 className="filter-group-title">Age Group</h4>
              <div className="filter-options-grid" style={{ color: "#000" }}>
                {["18-24", "25-34", "35-44", "45-54", "55+"].map((age) => (
                  <div key={age} className="filter-checkbox-item">
                    <input
                      type="checkbox"
                      id={`age-${age}`}
                      checked={filters.ageGroup.includes(age)}
                      onChange={(e) =>
                        handleFilterChange("ageGroup", age, e.target.checked)
                      }
                    />
                    <label htmlFor={`age-${age}`}>{age}</label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="sample-size-indicator">
        Sample Size: {sampleSize} Responses
      </div>
      {sampleSize < 200 && !filters.includeAllResponses && (
        <div className="sample-size-indicator warning">
          Low sample size. Results may be less reliable.
        </div>
      )}
      <div className="step-navigation">
        <button className="step-button secondary" onClick={() => setStep(1)}>
          Back
        </button>
        <button className="step-button primary" onClick={() => setStep(3)}>
          Continue
        </button>
      </div>
    </div>
  );

  const renderComparisonStep = () => (
    <div className="analytics-section">
      <h3>Compare Results (Optional)</h3>
      <p>Compare responses across segments.</p>
      <div className="comparison-options-container">
        <select
          value={comparisonGroup}
          onChange={(e) => handleComparisonGroupChange(e.target.value)}
        >
          <option value="none">No Comparison</option>
          <option value="age">Age group</option>
          <option value="gender">Gender</option>
          <option value="region">Region</option>
          <option value="cohort">Cohort</option>
        </select>
        {comparisonGroup !== "none" && (
          <div className="comparison-segments-grid" style={{ color: "#000" }}>
            {availableSegments.map((segment) => (
              <div key={segment} className="filter-checkbox-item">
                <input
                  type="checkbox"
                  id={`seg-${segment}`}
                  checked={comparisonSegments.includes(segment)}
                  onChange={() => handleSegmentSelect(segment)}
                />
                <label htmlFor={`seg-${segment}`}>{segment}</label>
              </div>
            ))}
          </div>
        )}
        {comparisonGroup !== "none" && comparisonSegments.length < 2 && (
          <div className="segment-warning">Select at least 2 segments.</div>
        )}
      </div>
      <div className="step-navigation">
        <button className="step-button secondary" onClick={() => setStep(2)}>
          Back
        </button>
        <button
          className="step-button primary"
          onClick={handleGenerateReport}
          disabled={
            (comparisonGroup !== "none" && comparisonSegments.length < 2) ||
            selectedQuestions.length === 0
          }
        >
          Generate Report
        </button>
      </div>
    </div>
  );

  // --- Helper to render charts based on chart_data ---
  const renderChart = (chartData) => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return null;
    const chartJSData = {
      labels: chartData.data.map((d) => d.label),
      datasets: [
        {
          label: '',
          data: chartData.data.map((d) => d.value),
          backgroundColor: generateDefaultColors(chartData.data.length),
        },
      ],
    };
    const options = { plugins: { legend: { display: chartData.type === 'pie' } } };
    if (chartData.type === 'pie') return <Pie data={chartJSData} options={options} />;
    return <Bar data={chartJSData} options={options} />;
  };

  const renderFinalReport = () => {
    // Debug logging
    console.log('🔍 AISummaryReport - renderFinalReport called');
    console.log('📊 Report data:', report);
    console.log('❌ Error state:', error);
    console.log('⏳ Loading state:', isLoading);

    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loader"></div>
          <p style={{ color: "#AA2EFF" }}>Generating detailed analytics with trends...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="analytics-section error-message">
          <h3>Report Failed</h3>
          <p>{error}</p>
          <div className="step-navigation">
            <button className="step-button secondary" onClick={() => setStep(3)}>
              Back
            </button>
          </div>
        </div>
      );
    }

    // Check if report has the expected data structure
    const hasReportData = report && (
      report.executive_summary || 
      report.question_insights || 
      report.advanced_report
    );

    if (!hasReportData) {
      console.log('⚠️ No report data available');
      console.log('Report structure:', {
        report,
        hasReport: !!report,
        hasAdvancedReport: !!(report && report.advanced_report),
        hasDirectData: !!(report && (report.executive_summary || report.question_insights)),
        reportKeys: report ? Object.keys(report) : 'N/A'
      });
      return (
        <div className="analytics-section no-data">
          <p>No report data available to display.</p>
          <p>Debug: Report keys - {report ? Object.keys(report).join(', ') : 'None'}</p>
          <div className="step-navigation">
            <button className="step-button secondary" onClick={() => setStep(3)}>
              Back
            </button>
          </div>
        </div>
      );
    }

    // Extract data with fallbacks - handle both direct and nested structures
    const executive_summary = report.executive_summary || report.advanced_report?.executive_summary || [];
    const question_insights = report.question_insights || report.advanced_report?.question_insights || [];
    const insights = report.insights || report.advanced_report?.insights || [];
    const statistics = report.statistics || report.advanced_report?.statistics || {};

    console.log('✅ Report data extracted successfully:', {
      executive_summary: executive_summary.length,
      question_insights: question_insights.length, 
      insights: insights.length,
      statistics_keys: Object.keys(statistics)
    });

    return (
      <div className="analytics-section enhanced-report">
        {/* Report Header */}
        <div className="report-header" style={{ marginBottom: '30px', padding: '25px', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '15px' }}>Detailed Analytics Report</h2>
          <div className="report-metadata" style={{ fontSize: '16px', color: '#5a6c7d' }}>
            <span style={{ marginRight: '25px', fontWeight: '600' }}>Analysis Type: Trends & Performance</span>
            <span style={{ marginRight: '25px', fontWeight: '600' }}>Generated: {new Date().toLocaleDateString()}</span>
            <span style={{ marginRight: '25px', fontWeight: '600' }}>Questions Analyzed: {question_insights?.length || 0}</span>
            {(statistics?.total_responses || report.metadata?.sample_size) && (
              <span style={{ fontWeight: '600' }}>Sample Size: {statistics?.total_responses || report.metadata?.sample_size} responses</span>
            )}
          </div>
        </div>

        {/* Executive Summary */}
        {executive_summary && executive_summary.length > 0 && (
          <div className="executive-summary enhanced-summary" style={{ marginBottom: '35px' }}>
            <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '20px', textAlign: 'center' }}>Key Performance Insights</h3>
            <div className="summary-grid" style={{ gap: '20px' }}>
              {executive_summary.map((item, idx) => (
                <div key={idx} className="summary-card trend-card" style={{ 
                  padding: '25px', 
                  borderRadius: '12px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  backgroundColor: '#ffffff',
                  border: '2px solid #e9ecef'
                }}>
                  <h4 className="summary-headline" style={{
                    color: "#AA2EFF", 
                    fontSize: '22px', 
                    fontWeight: 'bold', 
                    marginBottom: '15px',
                    lineHeight: '1.3'
                  }}>{item.headline}</h4>
                  <p className="summary-detail" style={{
                    fontSize: '16px', 
                    lineHeight: '1.6', 
                    color: '#4a5568',
                    fontWeight: '500'
                  }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Overall Insights */}
        {insights && insights.length > 0 && (
          <div className="overall-insights" style={{ marginBottom: '35px' }}>
            <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '20px', textAlign: 'center' }}>Strategic Recommendations</h3>
            <div className="insights-list" style={{ gap: '15px' }}>
              {insights.map((insight, idx) => (
                <div key={idx} className="insight-item" style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: '#f8f9fa',
                  border: '2px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '15px',
                  marginBottom: '15px'
                }}>
                  <span className="insight-icon" style={{ fontSize: '24px', marginTop: '2px', fontWeight: 'bold', color: '#AA2EFF' }}>•</span>
                  <p style={{
                    fontSize: '17px',
                    lineHeight: '1.6',
                    color: '#2c3e50',
                    fontWeight: '600',
                    margin: '0'
                  }}>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question Insights */}
        {question_insights && question_insights.length > 0 && (
          <div className="question-insights enhanced-insights" style={{ 
            marginBottom: '35px',
            width: '100%',
            display: 'block'
          }}>
            <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '25px', textAlign: 'center' }}>Detailed Question Analysis</h3>
            {question_insights.map((insight, idx) => (
              <div key={idx} className="question-insight-card enhanced-card" style={{
                padding: '25px',
                marginBottom: '30px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                width: '100%',
                display: 'block',
                clear: 'both'
              }}>
                <div className="insight-header" style={{ marginBottom: '25px' }}>
                  {/* Question Text in Purple */}
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: '#AA2EFF',
                    marginBottom: '15px',
                    lineHeight: '1.4'
                  }}>Q{idx + 1}: {insight.question_text}</h3>
                  
                  {/* Headline in Black */}
                  <h4 className="insight-headline" style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#000000',
                    marginBottom: '8px',
                    lineHeight: '1.3'
                  }}>{insight.headline}</h4>
                  
                  {/* Simple sample size text */}
                  {insight.sample_size && (
                    <p style={{
                      fontSize: '14px',
                      color: '#6c757d',
                      margin: '0',
                      fontStyle: 'italic'
                    }}>Sample: {insight.sample_size} responses</p>
                  )}
                </div>
                
                <div className="insight-content" style={{ 
                  width: '100%', 
                  display: 'flex', 
                  flexDirection: 'column' 
                }}>
                  {/* Main Summary - Full Width */}
                  <div style={{ 
                    width: '100%', 
                    marginBottom: '20px',
                    display: 'block'
                  }}>
                    <p className="insight-summary" style={{
                      fontSize: '16px',
                      lineHeight: '1.6',
                      color: '#333333',
                      fontWeight: 'normal',
                      marginBottom: '0',
                      textAlign: 'justify',
                      width: '100%'
                    }}>{insight.summary}</p>
                  </div>

                  {/* Key Insights - Below Summary */}
                  {insight.insights && insight.insights.length > 0 && (
                    <div className="key-insights" style={{ 
                      width: '100%', 
                      marginBottom: '25px',
                      display: 'block'
                    }}>
                      <h5 style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#000000',
                        marginBottom: '12px'
                      }}>Key Findings:</h5>
                      <ul style={{ 
                        paddingLeft: '18px',
                        lineHeight: '1.6',
                        margin: '0',
                        width: '100%'
                      }}>
                        {insight.insights.map((finding, findingIdx) => (
                          <li key={findingIdx} style={{
                            fontSize: '16px',
                            color: '#333333',
                            fontWeight: 'normal',
                            marginBottom: '8px'
                          }}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Enhanced Chart Rendering - Full Width Block */}
                  {insight.chart_data && (
                    <div style={{ 
                      width: '100%', 
                      marginTop: '20px',
                      display: 'block',
                      clear: 'both'
                    }}>
                      {renderEnhancedChart(insight.chart_data)}
                    </div>
                  )}

                  {/* Warning Message */}
                  {insight.warning && (
                    <div className="insight-warning">
                      <span className="warning-icon">⚠️</span>
                      <span>{insight.warning}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Actions */}
        <div className="report-actions">
          <button 
            className="step-button secondary" 
            onClick={() => setStep(3)}
          >
            Back to Configuration
          </button>
          <button 
            className="step-button primary export-btn" 
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? 'Generating PDF...' : 'Export PDF Report'}
          </button>
          <button 
            className="step-button secondary"
            onClick={testChartGeneration}
            style={{ marginLeft: '10px' }}
          >
            Test Chart Generation
          </button>
        </div>
      </div>
    );
  };

  // Enhanced chart rendering function
  const renderEnhancedChart = (chartData) => {
    console.log('📈 Rendering chart with data:', chartData);
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      console.log('⚠️ Chart data is empty or invalid');
      return null;
    }

    // Handle info card type (for open-ended questions)
    if (chartData.type === 'info_card') {
      return (
        <div className="enhanced-chart-container" style={{ 
          width: '100%', 
          maxWidth: 'none',
          display: 'block',
          margin: '1.5rem 0',
          clear: 'both'
        }}>
          <div className="info-card-display">
            <h6>{chartData.title}</h6>
            <p className="info-text">{chartData.info_text}</p>
            <div className="response-count">
              <span className="count-number">{chartData.data[0]?.value || 0}</span>
              <span className="count-label">responses</span>
            </div>
          </div>
        </div>
      );
    }

    // Handle wordcloud type (convert to bar chart for now)
    if (chartData.type === 'wordcloud') {
      return (
        <div className="enhanced-chart-container" style={{ 
          width: '100%', 
          maxWidth: 'none',
          display: 'block',
          margin: '1.5rem 0',
          clear: 'both'
        }}>
          <div className="wordcloud-display">
            <h6>{chartData.title}</h6>
            <div className="wordcloud-items">
              {chartData.data.map((item, idx) => (
                <div key={idx} className="wordcloud-item">
                  <span className="word">{item.word || item.category}</span>
                  <span className="frequency">({item.frequency || item.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || 'Question Analysis',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        legend: {
          display: chartData.type === 'pie',
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const dataPoint = chartData.data[context.dataIndex];
              if (dataPoint.percentage !== null && dataPoint.percentage !== undefined) {
                return `${context.label}: ${context.parsed} (${dataPoint.percentage}%)`;
              }
              return `${context.label}: ${context.parsed}`;
            }
          }
        }
      },
      scales: (chartData.type === 'bar' || 
               chartData.type === 'nps_chart' || 
               chartData.type === 'ranking_bar' ||
               chartData.type === 'comparison_bar') ? {
        x: {
          title: {
            display: true,
            text: chartData.x_axis_label || 'Categories'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: chartData.y_axis_label || 'Values'
          },
          ticks: {
            callback: function(value) {
              return Number.isInteger(value) ? value : '';
            }
          }
        }
      } : {}
    };

    const getChartColors = () => {
      if (chartData.type === 'nps_chart' && chartData.nps_zones) {
        return chartData.data.map((item) => {
          const score = parseInt(item.category.replace('Score ', ''));
          if (score >= 9) return '#4CAF50'; // Promoters - Green
          if (score >= 7) return '#FF9800'; // Passives - Orange  
          return '#F44336'; // Detractors - Red
        });
      }
      
      if (chartData.performance_zones) {
        return chartData.data.map((item) => {
          const rating = parseInt(item.category.replace('Rating ', ''));
          if (rating >= 4) return '#4CAF50'; // High ratings - Green
          if (rating >= 3) return '#FF9800'; // Medium ratings - Orange
          return '#F44336'; // Low ratings - Red
        });
      }

      if (chartData.type === 'ranking_bar') {
        // Use gradient for rankings (lower rank = better = greener)
        return chartData.data.map((_, idx) => {
          const colors = ['#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722'];
          return colors[idx % colors.length];
        });
      }

      if (chartData.type === 'comparison_bar') {
        // Use distinct colors for comparison segments
        const colors = ['#2196F3', '#FF9800', '#4CAF50', '#E91E63', '#9C27B0', '#00BCD4'];
        return chartData.data.map((_, idx) => colors[idx % colors.length]);
      }
      
      return generateDefaultColors(chartData.data.length);
    };

    const chartJSData = {
      labels: chartData.data.map(d => d.category),
      datasets: [{
        label: getDatasetLabel(chartData.type),
        data: chartData.data.map(d => d.value),
        backgroundColor: getChartColors(),
        borderWidth: 1,
        borderColor: '#ddd'
      }]
    };

    return (
      <div className="enhanced-chart-container" style={{ 
        width: '100%', 
        maxWidth: 'none',
        display: 'block',
        margin: '1.5rem 0',
        clear: 'both'
      }}>
        <div className="chart-wrapper full-width-chart-wrapper" style={{ 
          height: '500px', 
          width: '100%', 
          marginTop: '1rem',
          display: 'block',
          float: 'none',
          clear: 'both',
          overflow: 'hidden'
        }}>
          {chartData.type === 'pie' ? (
            <Pie data={chartJSData} options={chartOptions} />
          ) : chartData.type === 'wordcloud' ? (
            // Wordcloud already handled above, this is fallback
            <div className="chart-fallback">
              <p>Chart type "{chartData.type}" - see data above</p>
            </div>
          ) : (
            <Bar data={chartJSData} options={chartOptions} />
          )}
        </div>
        
        {/* Chart Insights */}
        <div className="chart-insights">
          {chartData.type === 'nps_chart' && chartData.nps_score !== undefined && (
            <div className="nps-score-display">
              <span className="nps-label">Net Promoter Score:</span>
              <span className={`nps-score ${chartData.nps_score >= 0 ? 'positive' : 'negative'}`}>
                {chartData.nps_score > 0 ? '+' : ''}{chartData.nps_score}
              </span>
            </div>
          )}
          
          {chartData.performance_zones && (
            <div className="performance-indicators">
              <span className="excellent">●</span> Excellent (4-5)
              <span className="good">●</span> Good (3)  
              <span className="poor">●</span> Needs Improvement (1-2)
            </div>
          )}

          {chartData.nps_zones && (
            <div className="performance-indicators">
              <span className="excellent">●</span> Promoters (9-10)
              <span className="good">●</span> Passives (7-8)  
              <span className="poor">●</span> Detractors (0-6)
            </div>
          )}

          {chartData.lower_is_better && (
            <div className="ranking-info">
              <small>📊 Lower rank values indicate better performance</small>
            </div>
          )}

          {chartData.show_percentages && (
            <div className="percentage-info">
              <small>📈 Percentages show distribution across responses</small>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to get appropriate dataset label
  const getDatasetLabel = (chartType) => {
    switch (chartType) {
      case 'nps_chart': return 'NPS Responses';
      case 'ranking_bar': return 'Average Rank';
      case 'comparison_bar': return 'Comparison Values';
      case 'bar': return 'Response Count';
      case 'pie': return 'Distribution';
      default: return 'Values';
    }
  };

  // --- Main Render ---
  return (
    <div className="analytics-dashboard">
      <div className="analytics-main-content">
        <h2 className="main-content-title" style={{ color: "#AA2EFF" }}>AI Insights</h2>
        {step === 0 && renderWelcomeStep()}
        {step === 1 && renderQuestionSelectionStep()}
        {step === 2 && renderFilterStep()}
        {step === 3 && renderComparisonStep()}
        {step === 4 && renderFinalReport()}
      </div>

      {/* Legal Acceptance Modal */}
      {showLegalModal && (
        <LegalAcceptanceModal
          onAccepted={handleLegalAccepted}
          user={user}
        />
      )}
    </div>
  );
};

export default AISummaryReport;
