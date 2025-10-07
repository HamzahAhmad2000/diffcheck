import React, { useState } from 'react';

const DESCRIPTION_WORD_LIMIT = 100;

const SurveySettingsModal = ({ isOpen, initialSettings, onSave, onCancel, customStyles }) => {
  const [settings, setSettings] = useState({
    startDate: initialSettings?.startDate || '',
    endDate: initialSettings?.endDate || '',
    participantLimit: initialSettings?.participantLimit || '',
    brandingUrl: initialSettings?.brandingUrl || '',
    description: initialSettings?.description || '',
  });

  // If not open, don't render anything
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description') {
      const words = value.split(/\s+/).filter(Boolean);
      const limited =
        words.length > DESCRIPTION_WORD_LIMIT
          ? words.slice(0, DESCRIPTION_WORD_LIMIT).join(' ')
          : value;
      setSettings({ ...settings, [name]: limited });
    } else {
      setSettings({ ...settings, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(settings);
  };

  // Use the custom styles if provided, otherwise fallback to default styles
  const styles = customStyles || {
    overlay: { background: 'rgba(0,0,0,0.5)' },
    content: { padding: '20px' },
    header: {},
    title: {},
    closeButton: {},
    footer: {},
    cancelButton: {},
    saveButton: {},
    input: {},
    textarea: {},
    inputLabel: {},
  };

  return (
    <div style={{
      ...styles.overlay,
      zIndex: 1500, // Ensure settings modal is always on top
    }}>
      <div style={{
        ...styles.content,
        zIndex: 1501, // Ensure content is above overlay
      }}>
        <div style={styles.header}>
          <h3 style={styles.title}>Survey Settings</h3>
          <button style={styles.closeButton} onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: '15px' }}>
            <label style={styles.inputLabel}>End Date</label>
            <input
              type="date"
              name="endDate"
              value={settings.endDate}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={styles.inputLabel}>Participant Limit</label>
            <input
              type="number"
              name="participantLimit"
              value={settings.participantLimit}
              onChange={handleChange}
              placeholder="Leave empty for unlimited"
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={styles.inputLabel}>Branding URL (Logo)</label>
            <input
              type="text"
              name="brandingUrl"
              value={settings.brandingUrl}
              onChange={handleChange}
              placeholder="Enter URL to logo image"
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={styles.inputLabel}>Survey Description</label>
            <textarea
              name="description"
              value={settings.description}
              onChange={handleChange}
              placeholder="Enter survey description"
              style={styles.textarea}
            />
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onCancel} style={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" style={styles.saveButton}>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SurveySettingsModal;
