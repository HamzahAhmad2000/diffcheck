import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { chartAPI } from 'services/apiClient';

/**
 * A production-level batch chart customization editor.
 * 1) Lists all relevant questions from a given survey (passed as prop).
 * 2) Allows the admin to choose a single chartType, color, etc. 
 *    or override question by question.
 * 3) Saves everything to the backend API.
 * 
 * The parent (e.g. your Admin Dashboard) can pass in "survey" with its "questions".
 */
export default function BatchChartCustomizationEditor({  onClose }) {
  const { survey } = useParams();
  const [bulkChartType, setBulkChartType] = useState('bar');
  const [bulkBarColor, setBulkBarColor] = useState('#36A2EB');
  const [bulkShowPercentages, setBulkShowPercentages] = useState(false);
  const [bulkColorTemplate, setBulkColorTemplate] = useState('blue');

  const [questionConfigs, setQuestionConfigs] = useState({});
  const [questionSequence, setQuestionSequence] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available color templates
  const colorTemplates = {
    blue: ["#36A2EB", "#2196F3", "#1976D2", "#0D47A1", "#82B1FF"],
    red: ["#FF6384", "#F44336", "#D32F2F", "#B71C1C", "#FF8A80"],
    green: ["#4BC0C0", "#4CAF50", "#388E3C", "#1B5E20", "#B9F6CA"],
    purple: ["#9966FF", "#9C27B0", "#7B1FA2", "#4A148C", "#EA80FC"],
    orange: ["#FF9F40", "#FF9800", "#F57C00", "#E65100", "#FFD180"]
  };

  useEffect(() => {
    // On mount, load settings from API
    if (!survey || !survey.questions) return;
    fetchSettings();
  }, [survey]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await chartAPI.getChartSettings(survey.id);
      
      
        const data =response.data;
        if (data.settings) {
          // Set global settings if available
          if (data.settings.global) {
            const global = data.settings.global;
            setBulkChartType(global.chartType || 'bar');
            setBulkBarColor(global.barColor || '#36A2EB');
            setBulkShowPercentages(global.showPercentages || false);
          }
          
          // Set question configs if available
          if (data.settings.questions) {
            setQuestionConfigs(data.settings.questions);
          } else {
            // Initialize empty configs
            const newConfigs = {};
            survey.questions.forEach(q => {
              newConfigs[q.id] = {
                chartType: 'bar',
                barColor: '#36A2EB',
                showPercentages: false,
                customTitle: '',
                colorTemplate: 'blue',
                customColors: []
              };
            });
            setQuestionConfigs(newConfigs);
          }
          
          // Set question sequence if available
          if (data.settings.question_sequence) {
            setQuestionSequence(data.settings.question_sequence);
          } else {
            // Initialize default sequence
            const newSequence = {};
            survey.questions.forEach((q, index) => {
              newSequence[q.id] = index + 1;
            });
            setQuestionSequence(newSequence);
          }
          
          // Set color template if available
          if (data.settings.color_template) {
            setBulkColorTemplate(data.settings.color_template || 'blue');
          }
        } else {
          // Initialize default values
          const newConfigs = {};
          const newSequence = {};
          survey.questions.forEach((q, index) => {
            newConfigs[q.id] = {
              chartType: 'bar',
              barColor: '#36A2EB',
              showPercentages: false,
              customTitle: '',
              colorTemplate: 'blue',
              customColors: []
            };
            newSequence[q.id] = index + 1;
          });
          setQuestionConfigs(newConfigs);
          setQuestionSequence(newSequence);
        }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chart settings:', error);
      setError('Failed to load chart settings');
      setLoading(false);
    }
  };

  // Handler to update a single question's config
  const handleQuestionConfigChange = (questionId, field, value) => {
    setQuestionConfigs(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  // Handler to update question sequence
  const handleSequenceChange = (questionId, value) => {
    setQuestionSequence(prev => ({
      ...prev,
      [questionId]: parseInt(value, 10) || 1
    }));
  };

  // Apply a color template to a question
  const applyColorTemplate = (questionId, template) => {
    const colors = colorTemplates[template] || colorTemplates.blue;
    setQuestionConfigs(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        colorTemplate: template,
        customColors: [...colors]
      }
    }));
  };

  // Bulk apply color template to all questions
  const bulkApplyColorTemplate = (template) => {
    setBulkColorTemplate(template);
    const colors = colorTemplates[template] || colorTemplates.blue;
    
    const newConfigs = { ...questionConfigs };
    survey.questions.forEach(q => {
      newConfigs[q.id] = {
        ...newConfigs[q.id],
        colorTemplate: template,
        customColors: [...colors]
      };
    });
    setQuestionConfigs(newConfigs);
  };

  // Bulk apply 
  const handleBulkApply = () => {
    if (!survey || !survey.questions) return;
    const newConfigs = { ...questionConfigs };
    const colors = colorTemplates[bulkColorTemplate] || colorTemplates.blue;
    
    survey.questions.forEach(q => {
      newConfigs[q.id] = {
        ...newConfigs[q.id],
        chartType: bulkChartType,
        barColor: bulkBarColor,
        showPercentages: bulkShowPercentages,
        colorTemplate: bulkColorTemplate,
        customColors: [...colors]
      };
    });
    setQuestionConfigs(newConfigs);
  };

  // Save all to backend
  const handleSaveAll = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create a complete configuration object
      const fullConfig = {
        global: {
          chartType: bulkChartType,
          barColor: bulkBarColor,
          showPercentages: bulkShowPercentages,
          colorTemplate: bulkColorTemplate
        },
        questions: questionConfigs,
        question_sequence: questionSequence,
        color_template: Object.fromEntries(
          Object.entries(questionConfigs).map(([id, config]) => [id, config.colorTemplate || 'blue'])
        )
      };
      
      // Save to the backend
      const response = await chartAPI.saveChartSettings(survey.id, fullConfig);
      
    
      
      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving batch chart settings:', error);
      setError('Failed to save settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onClose) onClose();
  };

  if (!survey || !survey.questions) {
    return <div>No survey questions found.</div>;
  }

  // Sort questions by sequence number for display
  const sortedQuestions = [...survey.questions].sort((a, b) => {
    const seqA = questionSequence[a.id] || a.sequence_number;
    const seqB = questionSequence[b.id] || b.sequence_number;
    return seqA - seqB;
  });

  return (
    <div style={styles.modal}>
      <div style={styles.content}>
        <h3>Batch Chart Customization for Survey: {survey.title}</h3>
        
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* Bulk fields */}
        <div style={styles.bulkSection}>
          <h4>Bulk Settings (Apply to All):</h4>
          <div style={styles.field}>
            <label>Chart Type: </label>
            <select 
              value={bulkChartType} 
              onChange={e => setBulkChartType(e.target.value)}
              style={styles.select}
            >
              <option value="bar">Bar</option>
              <option value="horizontalBar">Horizontal Bar</option>
              <option value="pie">Pie</option>
              <option value="line">Line</option>
            </select>
          </div>
          <div style={styles.field}>
            <label>Color Template:</label>
            <select
              value={bulkColorTemplate}
              onChange={e => bulkApplyColorTemplate(e.target.value)}
              style={styles.select}
            >
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
              <option value="orange">Orange</option>
            </select>
            <div style={styles.colorPalette}>
              {(colorTemplates[bulkColorTemplate] || []).map((color, idx) => (
                <div 
                  key={idx} 
                  style={{
                    ...styles.colorSwatch,
                    backgroundColor: color
                  }}
                ></div>
              ))}
            </div>
          </div>
          <div style={styles.field}>
            <label>Base Color:</label>
            <input
              type="color"
              value={bulkBarColor}
              onChange={e => setBulkBarColor(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </div>
          <div style={styles.field}>
            <label style={{ marginRight: 6 }}>Show Percentages?</label>
            <input
              type="checkbox"
              checked={bulkShowPercentages}
              onChange={() => setBulkShowPercentages(!bulkShowPercentages)}
            />
          </div>
          <button style={styles.applyBtn} onClick={handleBulkApply}>
            Apply to All Below
          </button>
        </div>

        {/* Individual question overrides */}
        <div style={styles.questionList}>
          {sortedQuestions.map(q => {
            const cfg = questionConfigs[q.id] || {};
            return (
              <div key={q.id} style={styles.questionItem}>
                <div style={styles.questionHeader}>
                  <div>
                    <strong>Q#{q.sequence_number}:</strong> {q.question_text}
                  </div>
                  <div style={styles.sequenceControl}>
                    <label style={{marginRight: 5}}>Display Order:</label>
                    <input
                      type="number"
                      min="1"
                      max={survey.questions.length}
                      value={questionSequence[q.id] || q.sequence_number}
                      onChange={e => handleSequenceChange(q.id, e.target.value)}
                      style={styles.sequenceInput}
                    />
                  </div>
                </div>
                <div style={styles.inlineField}>
                  <label>Chart Type:</label>
                  <select
                    value={cfg.chartType || 'bar'}
                    onChange={e => handleQuestionConfigChange(q.id, 'chartType', e.target.value)}
                    style={styles.select}
                  >
                    <option value="bar">Bar</option>
                    <option value="horizontalBar">Horizontal Bar</option>
                    <option value="pie">Pie</option>
                    <option value="line">Line</option>
                  </select>
                </div>
                <div style={styles.inlineField}>
                  <label>Color Template:</label>
                  <select
                    value={cfg.colorTemplate || 'blue'}
                    onChange={e => applyColorTemplate(q.id, e.target.value)}
                    style={styles.select}
                  >
                    <option value="blue">Blue</option>
                    <option value="red">Red</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                    <option value="orange">Orange</option>
                  </select>
                  <div style={styles.colorPalette}>
                    {((cfg.customColors?.length ? cfg.customColors : colorTemplates[cfg.colorTemplate || 'blue']) || []).map((color, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          ...styles.colorSwatch,
                          backgroundColor: color
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
                <div style={styles.inlineField}>
                  <label>Base Color:</label>
                  <input
                    type="color"
                    value={cfg.barColor || '#36A2EB'}
                    onChange={e => handleQuestionConfigChange(q.id, 'barColor', e.target.value)}
                    style={{ marginLeft: 8 }}
                  />
                </div>
                <div style={styles.inlineField}>
                  <label style={{ marginRight: 6 }}>Show Percentage?</label>
                  <input
                    type="checkbox"
                    checked={cfg.showPercentages || false}
                    onChange={() =>
                      handleQuestionConfigChange(q.id, 'showPercentages', !cfg.showPercentages)
                    }
                  />
                </div>
                <div style={styles.inlineField}>
                  <label>Custom Title:</label>
                  <input
                    type="text"
                    value={cfg.customTitle || ''}
                    onChange={e => handleQuestionConfigChange(q.id, 'customTitle', e.target.value)}
                    style={styles.customTitle}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.bottomButtons}>
          <button 
            style={loading ? styles.loadingBtn : styles.saveBtn} 
            onClick={handleSaveAll}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save All'}
          </button>
          <button style={styles.cancelBtn} onClick={handleCancel}>
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
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'auto'
  },
  content: {
    background: '#fff',
    borderRadius: 6,
    padding: 20,
    width: '90%',
    maxWidth: 800,
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  bulkSection: {
    marginBottom: 20,
    padding: 10,
    border: '1px solid #ccc'
  },
  field: {
    marginBottom: 10
  },
  inlineField: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 10
  },
  select: {
    marginLeft: 8,
    padding: 6
  },
  applyBtn: {
    backgroundColor: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer'
  },
  questionList: {
    border: '1px solid #ccc',
    padding: 10,
    borderRadius: 4,
    maxHeight: '50vh',
    overflowY: 'auto'
  },
  questionItem: {
    borderBottom: '1px solid #ddd',
    padding: 10
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sequenceControl: {
    display: 'flex',
    alignItems: 'center'
  },
  sequenceInput: {
    width: 50,
    padding: 4,
    textAlign: 'center'
  },
  customTitle: {
    marginLeft: 8,
    padding: 6,
    width: '50%'
  },
  bottomButtons: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end'
  },
  saveBtn: {
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    marginRight: 10
  },
  loadingBtn: {
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'not-allowed',
    marginRight: 10
  },
  cancelBtn: {
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer'
  },
  colorPalette: {
    display: 'flex',
    marginLeft: 10
  },
  colorSwatch: {
    width: 20,
    height: 20,
    marginRight: 4,
    borderRadius: 2,
    border: '1px solid #ddd'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '8px 12px',
    borderRadius: 4,
    marginBottom: 15
  }
};