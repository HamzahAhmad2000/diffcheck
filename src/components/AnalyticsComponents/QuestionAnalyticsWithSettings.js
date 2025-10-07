import React, { useState, useEffect } from "react";
import QuestionAnalyticsChart from "./QuestionAnalyticsChart";
import WordCloudViewer from "./WordCloudViewer";
import GridAnalytics from "./GridAnalytics";
import "./AnalyticsComponents.css";
import { chartAPI, reportTabAPI } from "../../services/apiClient";

const QuestionAnalyticsWithSettings = ({
  question,
  surveyId,
  questionSettings,
  globalSettings = {}, // Provide default to prevent errors
  onSettingsChange,
  questionOptions,
  index, // Kept for context if needed
}) => {
  // Local state for immediate UI feedback, backed by reliable backend saves
  const [localSettings, setLocalSettings] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error'

  // Check if this is an open-ended question
  const isOpenEnded = question.question_type === "open-ended";

  // Update local settings when props change
  useEffect(() => {
    // If this is an open-ended question and we're initializing settings,
    // set isHidden to true by default (exclude from PDF)
    if (isOpenEnded && !questionSettings.hasOwnProperty('isHidden')) {
      const initialSettings = {
        ...questionSettings,
        isHidden: true // Default to excluded from PDF for open-ended
      };
      setLocalSettings(initialSettings);
      
      // Save this default setting to backend immediately
      saveSettingsToBackend(initialSettings);
    } else {
      setLocalSettings(questionSettings || {});
    }
  }, [questionSettings, isOpenEnded]);

  // Save settings to backend with proper error handling
  const saveSettingsToBackend = async (settings) => {
    try {
      setSaveStatus("saving");
      
      // Call the parent component's onSettingsChange to save to backend
      const success = await onSettingsChange(null, settings);
      
      if (success !== false) { // success is true or undefined (async function completed)
        setSaveStatus("saved");
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      } else {
        throw new Error("Save operation returned false");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveStatus("error");
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSaveStatus(null);
      }, 5000);
    }
  };

  const handleSettingChange = (field, value) => {
    // Update local settings for immediate visual changes
    const newSettings = {
      ...localSettings,
      [field]: value,
    };
    setLocalSettings(newSettings);
    
    // Save immediately to backend
    saveSettingsToBackend(newSettings);
  };

  const updateOptionColor = (optionIndex, color) => {
    const currentColors = Array.isArray(localSettings.customColors) ? localSettings.customColors : [];
    const newColors = [...currentColors];
    while (newColors.length <= optionIndex) {
      newColors.push(localSettings.chartColor || globalSettings?.chartColor || "#36A2EB");
    }
    newColors[optionIndex] = color;
    
    // Update local settings and save immediately
    handleSettingChange('customColors', newColors);
  };

  const updateSpecialColors = (colorType, colorKey, color) => {
    const newColorSettings = { ...(localSettings[colorType] || {}), [colorKey]: color };
    handleSettingChange(colorType, newColorSettings);
  };

  // Helper function to get the actual chart colors that will be used
  const getActualChartColors = () => {
    // Use the same default palette as QuestionAnalyticsChart component
    const defaultPalette = [
      "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
      "#FF9F40", "#66FF66", "#FF66B3", "#3399FF", "#FF6666",
    ];
    
    // For scale questions, use scale_points length
    let count = 0;
    if (isScale && question.scale_points) {
      count = question.scale_points.length;
    } else if (questionOptions && questionOptions.length > 0) {
      count = questionOptions.length;
    } else {
      return []; // No options to color
    }
    
    // Always prioritize saved custom colors from settings
    const savedCustomColors = questionSettings.customColors || localSettings.customColors || [];
    
    // Create result array with default colors first
    const result = [];
    for (let i = 0; i < count; i++) {
      const savedColor = savedCustomColors[i];
      const defaultColor = defaultPalette[i % defaultPalette.length];
      
      // Use saved color if it exists and is valid, otherwise use default
      if (savedColor && typeof savedColor === 'string' && savedColor.trim() !== '') {
        result.push(savedColor);
      } else {
        result.push(defaultColor);
      }
    }
    
    return result;
  };

  const getDefaultChartType = (questionType) => {
    switch (questionType) {
      case "single-choice":
      case "multiple-choice":
        return "bar";
      case "rating-scale":
      case "star-rating":
      case "slider":
      case "rating": // Slider question type in backend
      case "nps":
        return "bar";
      case "likert-scale":
        return "bar";
      case "scale": // Add scale question type support
        return "bar";
      default:
        return "bar";
    }
  };

  const isChartable = !["open-ended", "grid-single", "grid-multiple", "interactive-ranking"].includes(
    question.question_type
  );
  const hasStats = [
    "rating-scale",
    "star-rating",
    "star-rating-grid", 
    "radio-grid",
    "checkbox-grid",
    "likert-scale",
    "slider",
    "rating", // Slider question type in backend
    "nps",
    "numerical-input",
    "scale" // Add scale to stats
  ].includes(question.question_type);
  const hasDistribution = [
    "single-choice", 
    "multiple-choice", 
    "multi-choice",
    "checkbox", 
    "dropdown",
    "single-image-select",
    "multiple-image-select",
    "multi-image-select",
    "scale",
    "rating" // Slider question type in backend - has distribution table
  ].includes(question.question_type);
  const hasNAOption = ["rating-scale", "star-rating", "star-rating-grid", "likert-scale", "rating", "scale"].includes(
    question.question_type
  );
  const isImageType = [
    "single-image-select",
    "multiple-image-select",
    "multi-image-select",
    "image-choice",
  ].includes(question.question_type);
  const isSlider = question.question_type === "slider" || question.question_type === "rating";
  const isNPS = question.question_type === "nps";
  const isStarRating = question.question_type === "star-rating";
  const isScale = question.question_type === "scale"; // Fixed to use correct question type

  const renderScaleColorOptions = () => {
    // For scale questions, use the actual scale points instead of generating numeric range
    const scalePoints = question.scale_points || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

    return (
      <div className="settings-group">
        <h5>Scale Option Colors:</h5>
        <div className="option-colors-grid">
          {scalePoints.map((point, index) => {
            const colorInputId = `scale-color-${question.id}-${index}`;
            return (
              <div 
                key={`scale-${index}`} 
                className="scale-color-item clickable-color-row"
                onClick={() => document.getElementById(colorInputId).click()}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <input
                  id={colorInputId}
                  type="color"
                  value={
                    localSettings.customColors?.[index] ||
                    localSettings.chartColor ||
                    globalSettings?.chartColor ||
                    "#36A2EB"
                  }
                  onChange={(e) => {
                    updateOptionColor(index, e.target.value);
                  }}
                  style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span style={{ userSelect: 'none', cursor: 'pointer', flex: 1 }}>{point}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNPSColorOptions = () => {
    const npsPoints = Array.from({ length: 11 }, (_, i) => i);

    return (
      <div className="settings-group">
        <h5>NPS Point Colors:</h5>
        <div className="nps-colors-grid">
          {npsPoints.map((point) => {
            const colorInputId = `nps-color-${question.id}-${point}`;
            return (
              <div 
                key={`nps-${point}`} 
                className="nps-color-item clickable-color-row"
                onClick={() => document.getElementById(colorInputId).click()}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <input
                  id={colorInputId}
                  type="color"
                  value={
                    localSettings.npsColors?.[point] ||
                    (point <= 6
                      ? "#ff4d4d" // Detractors (0-6)
                      : point <= 8
                      ? "#ffd700" // Passives (7-8)
                      : "#4CAF50") // Promoters (9-10)
                  }
                  onChange={(e) => {
                    const currentColors = { ...(localSettings.npsColors || {}) };
                    currentColors[point] = e.target.value;
                    handleSettingChange("npsColors", currentColors);
                  }}
                  style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span style={{ userSelect: 'none', cursor: 'pointer' }}>{point}</span>
              </div>
            );
          })}
        </div>
        
        <div className="nps-legend">
          <div className="nps-legend-item detractor">Detractors (0-6)</div>
          <div className="nps-legend-item passive">Passives (7-8)</div>
          <div className="nps-legend-item promoter">Promoters (9-10)</div>
        </div>
      </div>
    );
  };

  const renderStarRatingColorOptions = () => {
    const maxStars = question.max_stars || 5;
    const starPoints = Array.from({ length: maxStars }, (_, i) => i + 1);

    return (
      <div className="settings-group">
        <h5>Star Rating Colors:</h5>
        <div className="star-colors-grid">
          {starPoints.map((stars) => {
            const colorInputId = `star-color-${question.id}-${stars}`;
            return (
              <div 
                key={`star-${stars}`} 
                className="star-color-item clickable-color-row"
                onClick={() => document.getElementById(colorInputId).click()}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <input
                  id={colorInputId}
                  type="color"
                  value={localSettings.starColors?.[stars] || "#ffd700"}
                  onChange={(e) => {
                    updateSpecialColors("starColors", stars, e.target.value);
                  }}
                  style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span style={{ userSelect: 'none', cursor: 'pointer' }}>
                  {stars} {stars === 1 ? "Star" : "Stars"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSliderColorOptions = () => {
    // Handle both "slider" and "rating" question types with different field names
    const maxValue = question.max_value || question.rating_end || 100;
    const minValue = question.min_value || question.rating_start || 0;
    const step = question.step || question.rating_step || 1;
    const sliderPoints = [];
    for (let i = minValue; i <= maxValue; i += step) {
      sliderPoints.push(i);
    }

    return (
     <> </>
    );
  };

  const renderChartSettings = () => {
    return (
      <div className="settings-panel">
        <h4 className="settings-title">Question Settings</h4>
        <div className="settings-content">
          {/* Custom Title - Hide for NPS */}
          {!isNPS && (
            <div className="settings-group">
              <div className="input-group">
                <label htmlFor={`qTitle-${question.id}`}>Custom Title:</label>
                <input
                  id={`qTitle-${question.id}`}
                  type="text"
                  value={localSettings.customTitle || ""}
                  onChange={(e) =>
                    handleSettingChange("customTitle", e.target.value)
                  }
                  placeholder="Custom title (optional)"
                />
              </div>
            </div>
          )}

          {/* Chart Settings - Hide for NPS */}
          {isChartable && !isNPS && (
            <>
              <div className="settings-group">
                <div className="input-group">
                  <label htmlFor={`qChartType-${question.id}`}>
                    Chart Type:
                  </label>
                  <select
                    id={`qChartType-${question.id}`}
                    value={
                      localSettings.chartType ||
                      getDefaultChartType(question.question_type)
                    }
                    onChange={(e) =>
                      handleSettingChange("chartType", e.target.value)
                    }
                  >
                    <option value="bar">Bar</option>
                    <option value="pie">Pie</option>
                    <option value="doughnut">Doughnut</option>
                    <option value="line">Line</option>
                    <option value="none">No Chart</option>
                  </select>
                </div>

                {/* Only show base color for question types where all bars are the same color - EXCLUDE IMAGE TYPES */}
                {(!questionOptions || questionOptions.length <= 1) && !isScale && !isImageType ? (
                  <div className="input-group">
                    <label htmlFor={`qChartColor-${question.id}`} style={{ marginRight: '5px' , marginTop: '5px'}}>
                      Base Color:
                    </label>
                    <input
                      id={`qChartColor-${question.id}`}
                      type="color"
                      value={
                        localSettings.chartColor ||
                        globalSettings?.chartColor ||
                        "#36A2EB"
                      }
                      onChange={(e) =>
                        handleSettingChange("chartColor", e.target.value)
                      }
                    />
                  </div>
                ) : null}

                {/* Chart Display Options - Hide for NPS */}
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        localSettings.showPercentages !== undefined
                          ? localSettings.showPercentages
                          : true
                      }
                      onChange={(e) =>
                        handleSettingChange("showPercentages", e.target.checked)
                      }
                    />
                    Show Percentages
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        localSettings.showLegend !== undefined
                          ? localSettings.showLegend
                          : !["bar", "horizontalBar"].includes(localSettings.chartType || getDefaultChartType(question.question_type)) // Default legend based on chart type
                      }
                      onChange={(e) =>
                        handleSettingChange("showLegend", e.target.checked)
                      }
                    />
                    Show Legend
                  </label>
                </div>
              </div>

              {/* Question-specific color options */}
              {isSlider && renderSliderColorOptions()}
              {isStarRating && renderStarRatingColorOptions()}

              {/* Option Colors for choice questions AND scale questions */}
              {(questionOptions && questionOptions.length > 1) || isScale ? (
                <div className="settings-group">
                  <h5>Option Colors:</h5>
                  <div className="option-colors-grid">
                    {isScale ? (
                      // For scale questions, use scale_points
                      (question.scale_points || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map((point, optIndex) => {
                        const actualColors = getActualChartColors();
                        const colorInputId = `color-${question.id}-${optIndex}`;
                        return (
                          <div
                            key={`${question.id}-scale-${optIndex}`}
                            className="option-color-item clickable-color-row"
                            onClick={() => document.getElementById(colorInputId).click()}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <input
                              id={colorInputId}
                              type="color"
                              value={actualColors[optIndex] || "#36A2EB"}
                              onChange={(e) =>
                                updateOptionColor(optIndex, e.target.value)
                              }
                              style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            />
                            <span 
                              title={point}
                              style={{ flex: 1, userSelect: 'none', cursor: 'pointer' }}
                            >
                              {point}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      // For other choice questions, use questionOptions
                      questionOptions.map((option, optIndex) => {
                        const actualColors = getActualChartColors();
                        const colorInputId = `color-${question.id}-${optIndex}`;
                        return (
                          <div
                            key={`${question.id}-${optIndex}`}
                            className="option-color-item clickable-color-row"
                            onClick={() => document.getElementById(colorInputId).click()}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <input
                              id={colorInputId}
                              type="color"
                              value={actualColors[optIndex] || "#36A2EB"}
                              onChange={(e) =>
                                updateOptionColor(optIndex, e.target.value)
                              }
                              style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            />
                            <span 
                              title={`${option.label} (${option.count})`}
                              style={{ flex: 1, userSelect: 'none', cursor: 'pointer' }}
                            >
                              {option.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {/* NPS has its own color options */}
              {isNPS && renderNPSColorOptions()}

              {/* Statistics Display Settings - For all question types with stats */}
              {hasStats && (
                <div className="settings-group">
                  <h5>Statistics Display:</h5>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          localSettings.showStatsTable !== undefined
                            ? localSettings.showStatsTable
                            : true
                        }
                        onChange={(e) =>
                          handleSettingChange("showStatsTable", e.target.checked)
                        }
                      />
                      Show Statistics Table
                    </label>
                    
                    {/* NPS-specific table options */}
                    {isNPS && (
                      <label>
                        <input
                          type="checkbox"
                          checked={
                            localSettings.showResponseDist !== undefined
                              ? localSettings.showResponseDist
                              : true
                          }
                          onChange={(e) =>
                            handleSettingChange("showResponseDist", e.target.checked)
                          }
                        />
                        Show Response Distribution Table
                      </label>
                    )}
                    
                    {/* Individual stat controls - only show if stats table is enabled */}
                    {(localSettings.showStatsTable !== false) && (
                      <div className="checkbox-group" style={{ paddingLeft: '20px', marginTop: '10px' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              localSettings.showMean !== undefined
                                ? localSettings.showMean
                                : true
                            }
                            onChange={(e) =>
                              handleSettingChange("showMean", e.target.checked)
                            }
                          />
                          Show Mean/Average
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              localSettings.showMedian !== undefined
                                ? localSettings.showMedian
                                : true
                            }
                            onChange={(e) =>
                              handleSettingChange("showMedian", e.target.checked)
                            }
                          />
                          Show Median
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              localSettings.showMin !== undefined
                                ? localSettings.showMin
                                : true
                            }
                            onChange={(e) =>
                              handleSettingChange("showMin", e.target.checked)
                            }
                          />
                          Show Min
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              localSettings.showMax !== undefined
                                ? localSettings.showMax
                                : true
                            }
                            onChange={(e) =>
                              handleSettingChange("showMax", e.target.checked)
                            }
                          />
                          Show Max
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              localSettings.showStdDev !== undefined
                                ? localSettings.showStdDev
                                : true
                            }
                            onChange={(e) =>
                              handleSettingChange("showStdDev", e.target.checked)
                            }
                          />
                          Show Std Dev
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Settings */}
              <div className="settings-group">
                <div className="checkbox-group">
                  {hasDistribution && (
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          localSettings.showResponseDist !== undefined
                            ? localSettings.showResponseDist
                            : true
                        }
                        onChange={(e) =>
                          handleSettingChange("showResponseDist", e.target.checked)
                        }
                      />
                      Show Distribution Table
                    </label>
                  )}

                  {hasNAOption && (
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          localSettings.showNA !== undefined
                            ? localSettings.showNA
                            : true
                        }
                        onChange={(e) =>
                          handleSettingChange("showNA", e.target.checked)
                        }
                      />
                      Show 'N/A' Responses
                    </label>
                  )}

                  <div className="input-group">
                    <label htmlFor={`qSort-${question.id}`}>Sort Options:</label>
                    <select
                      id={`qSort-${question.id}`}
                      value={localSettings.sortOrder || (localSettings.sortByCount ? 'desc' : 'default')}
                      onChange={(e) => handleSettingChange('sortOrder', e.target.value)}
                    >
                      <option value="default">Default Order</option>
                      <option value="desc">Most Selected</option>
                      <option value="asc">Least Selected</option>
                    </select>
                  </div>

                  
                </div>
              </div>

              {/* Auto-save notification */}
              <div className="settings-group" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}>
                {saveStatus === 'saving' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: '14px' }}>
                    <i className="ri-loader-4-line" style={{ marginRight: '5px', animation: 'spin 1s linear infinite' }}></i>
                    Saving...
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#28a745', fontSize: '14px' }}>
                    <i className="ri-check-line" style={{ marginRight: '5px' }}></i>
                    Settings saved
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc3545', fontSize: '14px' }}>
                    <i className="ri-error-warning-line" style={{ marginRight: '5px' }}></i>
                    Error saving settings
                  </div>
                )}
              </div>

            </>
          )}

          {/* Auto-save notification */}
          <div className="settings-group" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}>
            {saveStatus === 'saving' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: '14px' }}>
                <i className="ri-loader-4-line" style={{ marginRight: '5px', animation: 'spin 1s linear infinite' }}></i>
                Saving...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#28a745', fontSize: '14px' }}>
                <i className="ri-check-line" style={{ marginRight: '5px' }}></i>
                Settings saved
              </div>
            )}
            {saveStatus === 'error' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc3545', fontSize: '14px' }}>
                <i className="ri-error-warning-line" style={{ marginRight: '5px' }}></i>
                Error saving settings
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="question-analytics-container">
      <div className="question-analytics-header">
        <div className="header-content">
          {/* Drag Handle */}
          <span className="drag-handle" style={{ 
            cursor: 'move', 
            marginRight: '8px', 
            fontSize: '16px', 
            color: '#666',
            userSelect: 'none',
            padding: '4px',
            borderRadius: '3px',
            transition: 'all 0.2s ease'
          }}>
            ⋮⋮
          </span>
          <strong>#{localSettings.displayOrder || question.sequence_number || "N/A"}:</strong>{" "}
          {question.question_text}
        </div>
        
        {/* Display Order & PDF Include Controls */}
        <div className="header-controls" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <label className="order-control" style={{ color: 'black', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>
            Order:
            <input
              type="number"
              value={localSettings.displayOrder || ''}
              onChange={(e) => handleSettingChange('displayOrder', e.target.value)}
              className="order-input"
              min="1"
              placeholder="auto"
              style={{ width: '60px', padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
          </label>
          
          <label className="pdf-include-control" style={{ 
            color: 'black', 
            fontSize: '14px', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: localSettings.isHidden !== true ? '#e8f5e8' : '#f8e8e8',
            borderRadius: '5px',
            border: `1px solid ${localSettings.isHidden !== true ? '#4CAF50' : '#f44336'}`,
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={localSettings.isHidden !== true} // Checked if NOT hidden
              onChange={(e) => handleSettingChange('isHidden', !e.target.checked)}
              style={{ marginRight: '0' }}
            />
            <i className={`ri-file-pdf-line`} style={{ fontSize: '16px' }}></i>
            Include in PDF Export
          </label>
          
          {/* Only show settings toggle for non-open-ended questions */}
          {!isOpenEnded && (
            <label className="settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={showSettings}
                onChange={() => setShowSettings(!showSettings)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label" style={{ color: 'black', fontSize: '14px' }}>
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </span>
            </label>
          )}
        </div>
      </div>
      <div className={`question-analytics-grid ${showSettings ? 'with-settings' : ''}`}>
        <div className="chart-column">
          {question.question_type === "open-ended" ? (
            <WordCloudViewer
              surveyId={surveyId}
              questionId={question.id}
              className="word-cloud-viewer"
            />
          ) : question.question_type.includes("grid") ? (
            <GridAnalytics
              data={{
                question_id: question.id,
                question_text: question.question_text,
                question_type: question.question_type,
              }}
              surveyId={surveyId}
              questionId={question.id}
              className="grid-analytics"
            />
          ) : (
            <QuestionAnalyticsChart
              surveyId={surveyId}
              questionId={question.id}
              className="question-chart"
              hideCustomization={true}
              settings={{
                chartType: localSettings.chartType || globalSettings.chartType,
                ...globalSettings, // Pass all global settings
                ...localSettings   // Override with local question-specific settings - this ensures immediate visual feedback
              }}
            />
          )}
        </div>
        {showSettings && !isOpenEnded && (
          <div className="settings-column">
            <div className="settings-panel">
              <div className="settings-content">
                {renderChartSettings()}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Save status indicator */}
      {saveStatus && (
        <div className="save-status-indicator" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '10px 20px',
          background: saveStatus === 'saving' ? '#f8f9fa' : 
                      saveStatus === 'saved' ? '#d4edda' : '#f8d7da',
          color: saveStatus === 'saving' ? '#6c757d' : 
                 saveStatus === 'saved' ? '#155724' : '#721c24',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000,
          transition: 'all 0.3s ease'
        }}>
                     {saveStatus === 'saving' && <i className="ri-loader-4-line" style={{marginRight: '8px', animation: 'spin 1s linear infinite'}}></i>}
           {saveStatus === 'saved' && <i className="ri-check-line" style={{marginRight: '8px'}}></i>}
           {saveStatus === 'error' && <i className="ri-error-warning-line" style={{marginRight: '8px'}}></i>}
           {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Settings saved' : 'Error saving settings'}
        </div>
      )}
    </div>
  );
};

export default QuestionAnalyticsWithSettings;
