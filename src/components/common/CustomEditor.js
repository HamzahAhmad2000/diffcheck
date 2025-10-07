import React, { useState, useRef, useEffect } from "react";
import "./CustomEditor.css";

const CustomEditor = ({
  initialValue = "",
  onChange,
  onBlur,
  placeholder = "Enter text here...",
  height = "150px",
}) => {
  const [htmlContent, setHtmlContent] = useState(initialValue);
  const editorRef = useRef(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [activeStates, setActiveStates] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savedSelection, setSavedSelection] = useState(null);
  const colorPickerRef = useRef(null);
  const isInitialMount = useRef(true);

  const commands = {
    bold: { icon: "ri-bold", command: "bold", tooltip: "Bold" },
    italic: { icon: "ri-italic", command: "italic", tooltip: "Italic" },
    underline: { icon: "ri-underline", command: "underline", tooltip: "Underline" },
    textColor: { icon: "ri-font-color", command: "foreColor", tooltip: "Text Color", isColorPicker: true },
    unorderedList: { icon: "ri-list-unordered", command: "insertUnorderedList", tooltip: "Bullet List" },
    orderedList: { icon: "ri-list-ordered", command: "insertOrderedList", tooltip: "Numbered List" },
    outdent: { icon: "ri-indent-decrease", command: "outdent", tooltip: "Decrease Indent" },
    indent: { icon: "ri-indent-increase", command: "indent", tooltip: "Increase Indent" },
    link: { icon: "ri-link", command: "createLink", tooltip: "Insert Link" },
    separator: { type: "separator" }
  };

  const colorOptions = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080', '#FFE4B5',
    '#AA2EFF', '#4A90E2', '#50E3C2', '#F5A623', '#D0021B', '#7ED321'
  ];

  useEffect(() => {
    // Only set content from initialValue on the very first mount
    if (initialValue && editorRef.current && isInitialMount.current) {
      editorRef.current.innerHTML = initialValue;
      setHtmlContent(initialValue);
      setUndoStack([initialValue]);
      isInitialMount.current = false; // Prevent this from running again
    }
    // If initialValue changes *after* the initial mount, update the editor.
    // This is crucial for re-editing scenarios.
    else if (initialValue !== htmlContent && !isInitialMount.current) {
      setIsUpdating(true); // Prevent handleContentChange from firing
      editorRef.current.innerHTML = initialValue;
      setHtmlContent(initialValue);
      setUndoStack([initialValue]);
      setRedoStack([]);
      setTimeout(() => setIsUpdating(false), 50); // Allow DOM to update
    }
  }, [initialValue]);

  useEffect(() => {
    updateActiveStates();
  }, []);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateActiveStates = () => {
    if (!editorRef.current) return;
    
    const newActiveStates = {};
    Object.entries(commands).forEach(([key, value]) => {
      if (value.command && value.command !== 'createLink' && value.command !== 'foreColor') {
        try {
          newActiveStates[key] = document.queryCommandState(value.command);
        } catch (e) {
          newActiveStates[key] = false;
        }
      }
    });
    setActiveStates(newActiveStates);
  };

  const handleContentChange = () => {
    if (!editorRef.current || isUpdating) return;
    
    const newContent = editorRef.current.innerHTML;
    if (newContent !== htmlContent) {
      setHtmlContent(newContent);
      
      if (onChange) {
        onChange({
          html: newContent,
          text: editorRef.current.textContent || "",
        });
      }
    }
  };

  const execCommand = (command, value = null) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    setIsUpdating(true);

    if (command === "createLink") {
      handleLink();
      setIsUpdating(false);
      return;
    }

    // Special handling for foreColor command to preserve selection
    if (command === "foreColor") {
      handleColorCommand(value);
      setIsUpdating(false);
      return;
    }

    // Save current state to undo stack before making changes
    const currentContent = editorRef.current.innerHTML;
    
    try {
      const success = document.execCommand(command, false, value);
      
      if (success) {
        const newContent = editorRef.current.innerHTML;
        if (newContent !== currentContent) {
          setUndoStack(prev => [...prev.slice(-10), newContent]); // Keep only last 10 states
          setRedoStack([]);
          setHtmlContent(newContent);

          if (onChange) {
            onChange({
              html: newContent,
              text: editorRef.current.textContent || "",
            });
          }
        }
      }
    } catch (error) {
      console.error('Command execution failed:', error);
    }
    
    // Update active states after command execution
    setTimeout(() => {
      updateActiveStates();
      setIsUpdating(false);
    }, 50);
  };

  // Save current selection before opening color picker
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setSavedSelection({
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
        collapsed: range.collapsed
      });
    }
  };

  // Restore previously saved selection
  const restoreSelection = () => {
    if (savedSelection && editorRef.current) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(savedSelection.startContainer, savedSelection.startOffset);
        range.setEnd(savedSelection.endContainer, savedSelection.endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (error) {
        console.error('Error restoring selection:', error);
      }
    }
  };

  const handleColorCommand = (color) => {
    if (!editorRef.current) return;

    // First restore any saved selection
    if (savedSelection) {
      restoreSelection();
    }

    const selection = window.getSelection();
    const currentContent = editorRef.current.innerHTML;
    
    // Check if there's a text selection
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      // There's selected text - apply color to selection
      try {
        const range = selection.getRangeAt(0);
        
        // Store the selection for restoration if needed
        const selectedText = selection.toString();
        
        if (selectedText.trim()) {
          // Apply color to selected text
          document.execCommand("foreColor", false, color);
          
          // Update content
          const newContent = editorRef.current.innerHTML;
          if (newContent !== currentContent) {
            setUndoStack(prev => [...prev.slice(-10), newContent]);
            setRedoStack([]);
            setHtmlContent(newContent);

            if (onChange) {
              onChange({
                html: newContent,
                text: editorRef.current.textContent || "",
              });
            }
          }
        }
      } catch (error) {
        console.error('Error applying color to selection:', error);
      }
    } else {
      // No text selected - set color for future typing
      try {
        // Create a temporary span to set the color context
        const span = document.createElement('span');
        span.style.color = color;
        span.innerHTML = '&nbsp;'; // Non-breaking space
        
        // Insert the span at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(span);
          
          // Place cursor inside the span
          const newRange = document.createRange();
          newRange.setStart(span.firstChild, 1);
          newRange.setEnd(span.firstChild, 1);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        
        // Update content
        const newContent = editorRef.current.innerHTML;
        if (newContent !== currentContent) {
          setUndoStack(prev => [...prev.slice(-10), newContent]);
          setRedoStack([]);
          setHtmlContent(newContent);

          if (onChange) {
            onChange({
              html: newContent,
              text: editorRef.current.textContent || "",
            });
          }
        }
      } catch (error) {
        console.error('Error setting color for future typing:', error);
        // Fallback to simple execCommand
        document.execCommand("foreColor", false, color);
      }
    }

    // Clear saved selection
    setSavedSelection(null);

    // Update active states
    setTimeout(() => {
      updateActiveStates();
    }, 50);
  };

  const handleColorChange = (color) => {
    execCommand("foreColor", color);
    setShowColorPicker(false);
  };

  const handleColorPickerToggle = () => {
    if (!showColorPicker) {
      // Save selection before opening color picker
      saveSelection();
    }
    setShowColorPicker(!showColorPicker);
  };

  const handleUndo = () => {
    if (undoStack.length > 1) {
      const currentContent = editorRef.current.innerHTML;
      const previousContent = undoStack[undoStack.length - 2];
      
      setRedoStack(prev => [...prev, currentContent]);
      setUndoStack(prev => prev.slice(0, -1));
      
      editorRef.current.innerHTML = previousContent;
      setHtmlContent(previousContent);
      editorRef.current.focus();
      
      if (onChange) {
        onChange({
          html: previousContent,
          text: editorRef.current.textContent || "",
        });
      }
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[redoStack.length - 1];
      
      setUndoStack(prev => [...prev, nextContent]);
      setRedoStack(prev => prev.slice(0, -1));
      
      editorRef.current.innerHTML = nextContent;
      setHtmlContent(nextContent);
      editorRef.current.focus();
      
      if (onChange) {
        onChange({
          html: nextContent,
          text: editorRef.current.textContent || "",
        });
      }
    }
  };

  const handleLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString();
    
    let url = prompt("Enter URL:", "https://");
    if (!url || url === "https://") return;
    
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//)) {
      url = "https://" + url;
    }
    
    if (selectedText) {
      // If text is selected, create link with selected text
      document.execCommand("createLink", false, url);
    } else {
      // If no text selected, insert link with URL as text
      const linkHtml = `<a href="${url}" target="_blank">${url}</a>&nbsp;`;
      document.execCommand("insertHTML", false, linkHtml);
    }
    
    handleContentChange();
    updateActiveStates();
  };

  const handleInput = (e) => {
    handleContentChange();
    updateActiveStates();
  };

  const handleBlur = () => {
    updateActiveStates();
    
    if (onBlur) {
      const content = editorRef.current.innerHTML;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      onBlur({
        html: content,
        text: tempDiv.textContent || tempDiv.innerText || "",
      });
    }
  };

  const handleSelectionChange = () => {
    // Debounce selection change to improve performance
    if (editorRef.current && editorRef.current.contains(document.activeElement)) {
      updateActiveStates();
    }
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  return (
    <div className="custom-editor">
      <div className="custom-editor__toolbar">
        {Object.entries(commands).map(([key, value]) => {
          if (value.type === "separator") {
            return <div key={key} className="custom-editor__toolbar-separator" />;
          }

          if (value.isColorPicker) {
            return (
              <div key={key} className="custom-editor__color-picker-container" ref={colorPickerRef}>
                <button
                  type="button"
                  onClick={() => handleColorPickerToggle()}
                  className={`custom-editor__toolbar-btn ${activeStates[key] ? 'active' : ''}`}
                  title={value.tooltip}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <i className={value.icon}></i>
                </button>
                {showColorPicker && (
                  <div className="custom-editor__color-palette">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="custom-editor__color-option"
                        style={{ backgroundColor: color }}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent losing focus from editor
                          handleColorChange(color);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => execCommand(value.command)}
              className={`custom-editor__toolbar-btn ${activeStates[key] ? 'active' : ''}`}
              title={value.tooltip}
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            >
              <i className={value.icon}></i>
            </button>
          );
        })}
      </div>
      <div
        ref={editorRef}
        className="custom-editor__content"
        contentEditable={true}
        onInput={handleInput}
        onBlur={handleBlur}
        style={{ height }}
        suppressContentEditableWarning={true}
        onKeyDown={(e) => {
          if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
          } else if ((e.key === 'y' && e.ctrlKey) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) {
            e.preventDefault();
            handleRedo();
          }
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default CustomEditor;