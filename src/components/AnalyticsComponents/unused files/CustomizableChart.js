import React, { useState, useEffect } from 'react';
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
  LineElement,
  RadialLinearScale
} from 'chart.js';
import { analyticsAPI } from 'services/apiClient';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend
);

/**
 * CustomizableChart component supports:
 * Vertical Bar, Horizontal Bar, Pie, Semi-Pie, Line, and Histogram chart types.
 * Custom color selection for each option in drop down and MCQ questions.
 * Saving and loading configuration from localStorage.
 */ 
const CustomizableChart = ({ surveyId, questionId, questionType }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Customization state
  const [chartType, setChartType] = useState('verticalBar'); // default to vertical bar
  const [chartColor, setChartColor] = useState('#36A2EB');
  const [showPercentages, setShowPercentages] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [customTitle, setCustomTitle] = useState('');
  const [customColors, setCustomColors] = useState([]);
  const [showCustomization, setShowCustomization] = useState(false);

  // Load saved configuration from localStorage
  useEffect(() => {
    const storageKey = `chartConfig_${surveyId}_${questionId}`;
    const savedConfig = localStorage.getItem(storageKey);
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.chartType) setChartType(config.chartType);
        if (config.chartColor) setChartColor(config.chartColor);
        if (typeof config.showPercentages === 'boolean') setShowPercentages(config.showPercentages);
        if (typeof config.showLegend === 'boolean') setShowLegend(config.showLegend);
        if (config.customTitle) setCustomTitle(config.customTitle);
        if (Array.isArray(config.customColors)) setCustomColors(config.customColors);
      } catch (err) {
        console.error('Error loading saved chart configuration:', err);
      }
    }
  }, [surveyId, questionId]);

  // Fetch chart data from the API
  useEffect(() => {
    const fetchChartData = async () => {
      if (!surveyId || !questionId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('token');
        const response = await analyticsAPI.getChartData(surveyId, questionId);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setChartData(data);
        
        // Initialize custom colors if not already set
        if (data.data && data.data.length > 0 && customColors.length === 0) {
          const defaultColors = generateDefaultColors(data.data.length);
          setCustomColors(defaultColors);
        }
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChartData();
  }, [surveyId, questionId]);

  // Generate default color palette
  const generateDefaultColors = (count) => {
    const defaultPalette = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#66FF66', '#FF66B3', '#3399FF', '#FF6666'
    ];
    
    if (count <= defaultPalette.length) {
      return defaultPalette.slice(0, count);
    }
    
    const colors = [...defaultPalette];
    for (let i = defaultPalette.length; i < count; i++) {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      colors.push(`rgb(${r}, ${g}, ${b})`);
    }
    
    return colors;
  };

  // Save configuration to localStorage
  const saveConfiguration = () => {
    const config = {
      chartType,
      chartColor,
      showPercentages,
      showLegend,
      customTitle,
      customColors
    };
    
    const storageKey = `chartConfig_${surveyId}_${questionId}`;
    localStorage.setItem(storageKey, JSON.stringify(config));
    setShowCustomization(false);
  };

  // Update a specific color in the customColors array
  const updateCustomColor = (index, color) => {
    const newColors = [...customColors];
    newColors[index] = color;
    setCustomColors(newColors);
  };

  // Define available chart types
  const availableChartTypes = [
    { value: "verticalBar", label: "Vertical Bar Chart" },
    { value: "horizontalBar", label: "Horizontal Bar Chart" },
    { value: "pie", label: "Pie Chart" },
    { value: "semiPie", label: "Semi-Pie Chart" },
    { value: "line", label: "Line Chart" },
    { value: "histogram", label: "Histogram" }
  ];

  // Prepare data for Chart.js
  const prepareChartData = () => {
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      return null;
    }
    
    const labels = chartData.data.map(item => item.label);
    const values = chartData.data.map(item => 
      showPercentages ? item.percentage : item.count
    );
    
    // Use customColors if available, otherwise use chartColor
    const backgroundColor = customColors.length > 0 
      ? customColors.slice(0, values.length) 
      : Array(values.length).fill(chartColor);
      
    // For line charts, we need both background and border colors
    if (chartType === 'line') {
      return {
        labels,
        datasets: [{
          label: showPercentages ? 'Percentage (%)' : 'Count',
          data: values,
          backgroundColor: backgroundColor,
          borderColor: backgroundColor,
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }]
      };
    }
    
    return {
      labels,
      datasets: [{
        label: showPercentages ? 'Percentage (%)' : 'Count',
        data: values,
        backgroundColor: backgroundColor,
        borderColor: backgroundColor.map(color => color.replace('rgb', 'rgba').replace(')', ', 1)')),
        borderWidth: 1
      }]
    };
  };

  // Get Chart.js options based on selected chart type
  const getChartOptions = () => {
    const titleText = customTitle || (chartData && chartData.question_text ? chartData.question_text : 'Chart');
    
    let options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegend,
          position: 'bottom'
        },
        title: {
          display: true,
          text: titleText,
          font: {
            size: 16
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return showPercentages ? `${value.toFixed(1)}%` : `Count: ${value}`;
            }
          }
        }
      }
    };

    if (chartType === 'verticalBar' || chartType === 'histogram') {
      options = {
        ...options,
        indexAxis: 'x',
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: showPercentages ? 'Percentage (%)' : 'Count' }
          }
        }
      };
    } else if (chartType === 'horizontalBar') {
      options = {
        ...options,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: showPercentages ? 'Percentage (%)' : 'Count' }
          }
        }
      };
    } else if (chartType === 'line') {
      options = {
        ...options,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: showPercentages ? 'Percentage (%)' : 'Count' }
          }
        }
      };
    } else if (chartType === 'semiPie') {
      // Semi-pie chart: display as half-doughnut
      options = {
        ...options,
        rotation: -Math.PI,
        circumference: Math.PI
      };
    }
    
    return options;
  };

  // Render the appropriate chart component based on chartType
  const renderChart = () => {
    const data = prepareChartData();
    const options = getChartOptions();
    
    if (!data) return null;
    
    switch (chartType) {
      case 'verticalBar':
        return <Bar data={data} options={options} />;
      case 'histogram':
        // For a histogram, we use a Bar chart with custom binning if needed
        return <Bar data={data} options={options} />;
      case 'horizontalBar':
        return <Bar data={data} options={options} />;
      case 'pie':
        return <Pie data={data} options={options} />;
      case 'semiPie':
        return <Doughnut data={data} options={options} />;
      case 'line':
        return <Line data={data} options={options} />;
      default:
        return <Bar data={data} options={options} />;
    }
  };

  if (loading) return <div>Loading chart data...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!chartData || !chartData.data || chartData.data.length === 0) 
    return <div>No data available for this question.</div>;

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>{customTitle || chartData.question_text}</h3>
        <button
          onClick={() => setShowCustomization(!showCustomization)}
          style={{ padding: '6px 12px', fontSize: '14px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
        >
          {showCustomization ? 'Hide Options' : 'Customize Chart'}
        </button>
      </div>

      {showCustomization && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chart Type:</label>
            <select 
              value={chartType} 
              onChange={e => setChartType(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {availableChartTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Custom Title:</label>
            <input 
              type="text" 
              value={customTitle} 
              onChange={e => setCustomTitle(e.target.value)} 
              placeholder={chartData.question_text || "Enter chart title"}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px', display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showPercentages} 
                onChange={e => setShowPercentages(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Show Percentages
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showLegend} 
                onChange={e => setShowLegend(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Show Legend
            </label>
          </div>
          
          {chartData.data && chartData.data.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '10px' }}>Custom Colors for Options</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {chartData.data.map((item, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={customColors[index] || chartColor}
                      onChange={e => updateCustomColor(index, e.target.value)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button 
            onClick={saveConfiguration} 
            style={{ 
              padding: '8px 16px', 
              fontSize: '14px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            Save Configuration
          </button>
        </div>
      )}

      <div style={{ height: '200px', width: '500%', maxWidth: '400px', margin: '0 auto' }}>
        {renderChart()}
      </div>
    </div>
  );
};

export default CustomizableChart;