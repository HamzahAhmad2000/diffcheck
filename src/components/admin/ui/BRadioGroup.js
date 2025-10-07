import React from 'react';

const BRadioGroup = ({
  name,
  options = [], // [{value, label}]
  value,
  onChange,
  inline = false,
  className = '',
}) => {
  return (
    <div className={["b_ui-radio-group", inline ? 'b_ui-radio-group--inline' : '', className].filter(Boolean).join(' ')}>
      {options.map((opt) => (
        <label key={opt.value} className="b_ui-radio">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange && onChange(e.target.value)}
            className="b_ui-radio__input"
          />
          <span className="b_ui-radio__dot" aria-hidden="true" />
          <span className="b_ui-radio__label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

export default BRadioGroup;




