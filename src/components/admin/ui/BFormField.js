import React, { useId, cloneElement } from 'react';

/**
 * BFormField
 * Wrapper that renders a label, hint, and error for a single form control.
 * It will inject id, aria-invalid, and aria-describedby into the child control.
 */
const BFormField = ({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
}) => {
  const reactId = useId();
  const controlId = id || `b-ui-field-${reactId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const childrenArray = React.Children.toArray(children).filter(Boolean);
  const firstChild = childrenArray[0];

  let control = null;
  let extras = null;

  if (React.isValidElement(firstChild)) {
    const childClassName = [firstChild.props.className, error ? 'is-invalid' : '']
      .filter(Boolean)
      .join(' ');

    control = cloneElement(firstChild, {
      id: firstChild.props.id || controlId,
      'aria-invalid': !!error || undefined,
      'aria-describedby': describedBy,
      className: childClassName,
    });
    extras = childrenArray.slice(1);
  } else {
    // Fallback: render children as-is if first is not a valid element
    extras = childrenArray;
  }

  return (
    <div className={["b_ui-field", className].filter(Boolean).join(' ')}>
      {label && (
        <label className="b_ui-label" htmlFor={controlId}>
          {label}
          {required && <span className="b_ui-required" title="Required">*</span>}
        </label>
      )}
      {control}
      {extras}
      {hint && !error && (
        <div id={hintId} className="b_ui-hint">{hint}</div>
      )}
      {error && (
        <div id={errorId} className="b_ui-error">{error}</div>
      )}
    </div>
  );
};

export default BFormField;


