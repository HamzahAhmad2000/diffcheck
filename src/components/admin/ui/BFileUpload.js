import React, { useRef } from 'react';

const BFileUpload = ({
  accept,
  onChange,
  placeholder = 'Choose a file',
  buttonLabel = 'Browse',
  className = '',
  ...props
}) => {
  const inputRef = useRef(null);

  return (
    <div className={["b_ui-file", className].filter(Boolean).join(' ')}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="b_ui-file__input"
        {...props}
      />
      <div className="b_ui-file__control">
        <span className="b_ui-file__placeholder">{placeholder}</span>
        <button type="button" className="b_admin_styling-btn b_admin_styling-btn--secondary b_ui-file__button" onClick={() => inputRef.current?.click()}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default BFileUpload;




