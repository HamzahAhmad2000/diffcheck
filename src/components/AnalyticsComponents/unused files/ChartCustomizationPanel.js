import React, { useEffect, useState } from 'react';

/**
 * A PRODUCTION-READY chart customization panel. 
 * - No placeholders: it has real controls for chart type, color, etc.
 * - Persists to localStorage under the key: 'chartConfig_{surveyId}_{questionId}'
 * - The parent can re-fetch these settings when rendering the chart.
 */
export default function ChartCustomizationPanel({
  surveyId,
  questionId,
  onClose,
  onUpdateConfig
}) {
  // We'll store chart settings locally in state, then persist to localStorage on Save
  // For demonstration, we have chartType, barColor, showPercentages, customTitle, etc.
  const [chartType, setChartType] = useState('bar');
  const [barColor, setBarColor] = useState('#36A2EB');
  const [showPercentages, setShowPercentages] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  // 1) On mount, load any existing config from localStorage
  useEffect(() => {
    const storageKey = getStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.chartType) setChartType(parsed.chartType);
        if (parsed.barColor) setBarColor(parsed.barColor);
        if (typeof parsed.showPercentages === 'boolean') {
          setShowPercentages(parsed.showPercentages);
        }
        if (parsed.customTitle) setCustomTitle(parsed.customTitle);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  function getStorageKey() {
    return `chartConfig_${surveyId}_${questionId}`;
  }

  // 2) Save to local storage & pass config to parent
  const handleSave = () => {
    const config = {
      chartType,
      barColor,
      showPercentages,
      customTitle
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(config));
    // If parent wants to do something with the updated config
    if (onUpdateConfig) {
      onUpdateConfig(config);
    }
    onClose();
  };

// In ChartCustomizationPanel.js
const saveChartSettings = async (config) => {
  try {
    const response = await chartAPI.getChartSettings(surveyId);
    
    
    
    // If parent wants to do something with the updated config
    if (onUpdateConfig) {
      onUpdateConfig(config);
    }
    onClose();
  } catch (error) {
    console.error('Error saving chart settings:', error);
  }
};

// In your component's useEffect, load existing settings:
useEffect(() => {
  const fetchSettings = async () => {
    try {
      const response = await chartAPI.saveChartSettings(surveyId, config);
      
      
        const data = await response.json();
        if (data.settings) {
          const config = data.settings;
          // Apply settings to your state
          if (config.chartType) setChartType(config.chartType);
          if (config.barColor) setBarColor(config.barColor);
          if (typeof config.showPercentages === 'boolean') {
            setShowPercentages(config.showPercentages);
          }
          if (config.customTitle) setCustomTitle(config.customTitle);
        }
      
    } catch (error) {
      console.error('Error fetching chart settings:', error);
    }
  };
  
  fetchSettings();
}, [surveyId]);

  const handleCancel = () => {
    onClose();
  };

  return (
    <div style={styles.modal}>
      <div style={styles.content}>
        <h3>Customize Chart</h3>
        <div style={styles.field}>
          <label>Chart Type:</label>
          <select
            value={chartType}
            onChange={e => setChartType(e.target.value)}
            style={styles.select}
          >
            <option value="bar">Bar Chart (vertical)</option>
            <option value="horizontalBar">Horizontal Bar Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="line">Line Chart</option>
          </select>
        </div>

        <div style={styles.field}>
          <label>Bar/Line Color (hex):</label>
          <input
            type="color"
            value={barColor}
            onChange={e => setBarColor(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </div>

        <div style={styles.field}>
          <label style={{ marginRight: 8 }}>Show Percentages Instead of Counts?</label>
          <input
            type="checkbox"
            checked={showPercentages}
            onChange={() => setShowPercentages(!showPercentages)}
          />
        </div>

        <div style={styles.field}>
          <label>Custom Chart Title:</label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            style={styles.input}
            placeholder="e.g. 'Age vs. Preference'"
          />
        </div>

        <div style={styles.buttons}>
          <button onClick={handleSave} style={styles.saveBtn}>
            Save Settings
          </button>
          <button onClick={handleCancel} style={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modal: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  content: {
    background: '#fff',
    padding: 20,
    borderRadius: 8,
    minWidth: 300
  },
  field: {
    marginBottom: 14
  },
  select: {
    marginLeft: 8,
    padding: 6
  },
  input: {
    marginLeft: 8,
    padding: 6,
    width: '80%'
  },
  buttons: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end'
  },
  saveBtn: {
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 4,
    marginRight: 10,
    cursor: 'pointer'
  },
  cancelBtn: {
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 4,
    cursor: 'pointer'
  }
};
