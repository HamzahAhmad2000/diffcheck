import React from 'react';
import '../../../styles/b_admin_styling.css';
import BButton from './BButton';
import { BFormField, BTextInput, BTextarea, BCheckbox, BSelect } from './index';

/**
 * Generic admin package form modal
 * Props:
 * - isOpen: boolean
 * - title: string
 * - onClose: () => void
 * - onSubmit: (e) => void  (parent should preventDefault in handler if needed)
 * - submitLabel: string
 * - submitting: boolean
 * - fields: Array<{
 *     name: string,
 *     label?: string,
 *     type: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'calculated',
 *     required?: boolean,
 *     placeholder?: string,
 *     hint?: string,
 *     min?: number,
 *     step?: number,
 *     options?: Array<{ value: string | number, label: string }>,
 *     render?: (values) => React.ReactNode // for calculated
 *   }>
 * - values: object (controlled)
 * - onChange: (e) => void (standard input change events)
 */
const BPackageFormModal = ({
  isOpen,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  fields = [],
  values = {},
  onChange,
}) => {
  if (!isOpen) return null;

  const renderField = (field) => {
    const { name, label, type, hint, placeholder, required, min, step, options, render } = field;
    if (type === 'calculated') {
      return (
        <BFormField label={label} hint={hint}>
          <div className="admin-calculated-value">{render ? render(values) : '-'}</div>
        </BFormField>
      );
    }
    if (type === 'textarea') {
      return (
        <BFormField label={label}>
          <BTextarea name={name} value={values[name] ?? ''} onChange={onChange} placeholder={placeholder} rows={3} />
          {hint ? <small className="admin-form-help">{hint}</small> : null}
        </BFormField>
      );
    }
    if (type === 'checkbox') {
      return (
        <div className="admin-checkbox-grid">
          <label className="admin-checkbox">
            <input type="checkbox" name={name} checked={!!values[name]} onChange={onChange} />
            <span className="checkmark"></span>
            <div className="admin-checkbox-content">
              <strong>{label}</strong>
              {hint ? <span>{hint}</span> : null}
            </div>
          </label>
        </div>
      );
    }
    if (type === 'select') {
      return (
        <BFormField label={label}>
          <BSelect name={name} value={values[name] ?? ''} onChange={onChange} options={options || []} />
          {hint ? <small className="admin-form-help">{hint}</small> : null}
        </BFormField>
      );
    }
    // default text/number
    return (
      <BFormField label={label} required={required}>
        <BTextInput
          type={type === 'number' ? 'number' : 'text'}
          name={name}
          value={values[name] ?? (type === 'number' ? '' : '')}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          step={step}
          required={required}
        />
        {hint ? <small className="admin-form-help">{hint}</small> : null}
      </BFormField>
    );
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>{title}</h2>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close">
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={onSubmit} className="admin-form">
          <div className="admin-form-grid">
            {fields.filter(f => ['text', 'number', 'textarea', 'select'].includes(f.type)).map((f, idx) => (
              <div key={idx} className="admin-form-group">
                {renderField(f)}
              </div>
            ))}
          </div>

          {/* Checkboxes and calculated fields below as full-width */}
          <div className="admin-form-section">
            {fields.filter(f => f.type === 'checkbox' || f.type === 'calculated').map((f, idx) => (
              <div key={`cb-${idx}`} style={{ marginBottom: f.type === 'checkbox' ? 6 : 12 }}>
                {renderField(f)}
              </div>
            ))}
          </div>

          <div className="admin-form-actions">
            <BButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </BButton>
            <BButton type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <i className="ri-loader-4-line spinning"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  {submitLabel}
                </>
              )}
            </BButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BPackageFormModal;


