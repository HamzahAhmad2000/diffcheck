import React from 'react';

const QuestionList = ({
  questions,
  onEditQuestion,
  onDeleteQuestion,
  onCopyQuestion,
  onMoveQuestionUp,
  onMoveQuestionDown,
  onBranchEdit,
  onAddToBank,
  customStyles
}) => {
  // Use custom styles if provided, otherwise use basic styles
  const styles = customStyles || {
    container: {},
    questionItem: { marginBottom: '10px', border: '1px solid #ccc', padding: '8px' },
    questionText: { margin: 0 },
    buttonGroup: { marginTop: '5px' },
    button: { marginRight: '5px' },
    optionsList: { marginTop: '10px' },
    optionItem: {}
  };

  // Helper function to render grid preview
  const renderGridPreview = (question) => {
    if (!question.grid_rows || !question.grid_columns) return null;
    
    return (
      <div className="grid-preview" style={{ marginTop: '10px', fontSize: '12px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '4px' }}></th>
              {question.grid_columns.map((col, i) => (
                <th key={i} style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>
                  {col.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.grid_rows.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>
                  {row.text}
                </td>
                {question.grid_columns.map((col, j) => (
                  <td key={j} style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>
                    {renderGridCell(question.type, i, j)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper function to render the appropriate grid cell type
  const renderGridCell = (type, rowIndex, colIndex) => {
    switch (type) {
      case 'radio-grid':
        return <div style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', border: '1px solid #666' }}></div>;
      case 'checkbox-grid':
        return <div style={{ display: 'inline-block', width: '10px', height: '10px', border: '1px solid #666' }}></div>;
      case 'star-rating-grid':
        return <span style={{ color: '#ccc' }}>★</span>;
      default:
        return null;
    }
  };

  // Helper function to get question type display name
  const getQuestionTypeDisplay = (type) => {
    const types = {
      'multiple-choice': 'Multiple Choice',
      'checkbox': 'Checkbox',
      'open-ended': 'Open-Ended Textbox',
      'rating': 'Slider',
      'nps': 'NPS (0-10)',
      'radio-grid': 'Radio Button Grid',
      'checkbox-grid': 'Checkbox Grid',
      'star-rating': 'Star Rating',
      'star-rating-grid': 'Star Rating Grid',
      'numerical-input': 'Numerical Input',
      'email-input': 'Email Input',
      'date-picker': 'Date Selection',
      'signature': 'Signature',
    };
    return types[type] || type;
  };

  return (
    <div style={styles.container}>
      {questions.map((q, index) => (
        <div key={index} style={styles.questionItem}>
          <p style={styles.questionText}>
            <strong>Q{index + 1}:</strong> {q.text || '(No text)'}
          </p>

          <p style={{ margin: '3px 0', fontSize: '12px', color: '#666' }}>
            Type: {getQuestionTypeDisplay(q.type)}
          </p>

          {/* Grid question preview */}
          {['radio-grid', 'checkbox-grid', 'star-rating-grid'].includes(q.type) && renderGridPreview(q)}

          {/* Regular options display for non-grid questions */}
          {q.options && Array.isArray(q.options) && q.options.length > 0 && 
           !['radio-grid', 'checkbox-grid', 'star-rating-grid'].includes(q.type) && (
            <div style={{ marginTop: '10px' }}>
              <strong>Options:</strong>
              <ul style={{ margin: '5px 0' }}>
                {q.options.map((opt, optIndex) => (
                  <li key={optIndex} style={styles.optionItem}>
                    {opt.text}{' '}
                    <button onClick={() => onBranchEdit(index, optIndex)}>
                      {opt.branch ? "Edit Branch" : "Set Branch"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button onClick={() => onMoveQuestionUp(index)} style={styles.button}>
              Up
            </button>
            <button onClick={() => onMoveQuestionDown(index)} style={styles.button}>
              Down
            </button>
            <button onClick={() => onEditQuestion(index)} style={styles.button}>
              Edit
            </button>
            <button onClick={() => onCopyQuestion(index)} style={styles.button}>
              Copy
            </button>
            <button onClick={() => onDeleteQuestion(index)} style={styles.button}>
              Delete
            </button>
            <button onClick={() => onAddToBank(q)}>Add to Bank</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuestionList;
