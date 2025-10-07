// SignaturePad.js
import React, { useRef, useState, useEffect } from 'react';

const SignaturePad = ({ value, onChange }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(value?.signature_image_base64 || '');
  const [fullName, setFullName] = useState(value?.typed_full_name || '');

  // Initialize canvas on component mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions based on display size  
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set the actual size in memory (scaled to account for extra pixel density)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale the drawing context back down
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Set canvas display size back to normal
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Set initial background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Set drawing style defaults
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature if available
    if (signatureData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = signatureData;
    }
  }, [signatureData]);

  // Update parent when fullName or signatureData changes
  useEffect(() => {
    onChange({ signature_image_base64: signatureData, typed_full_name: fullName });
  }, [signatureData, fullName, onChange]);

  const getCoordinates = (event) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    let x, y;
    
    // Check if it's a touch event
    if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      // Mouse event
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }
    
    return { x, y };
  };

  const startDrawing = (e) => {
    e.preventDefault(); // Prevent scrolling for touch events
    setIsDrawing(true);
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling for touch events
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath(); // Reset the path
    
    // Save the signature data
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData(dataUrl);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setSignatureData('');
  };

  const handleNameChange = (e) => {
    setFullName(e.target.value);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ 
          border: '1px solid #000', 
          marginBottom: '10px',
          width: '300px',
          height: '150px',
          backgroundColor: '#ffffff',
          cursor: 'crosshair',
          touchAction: 'none' // Prevent default touch behaviors
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div>
        <button 
          onClick={clearCanvas}
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Signature
        </button>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label>Full Name:</label>
        <input
          type="text"
          value={fullName}
          onChange={handleNameChange}
          placeholder="Type your full name"
          style={{ 
            marginLeft: '5px',
            padding: '5px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>
    </div>
  );
};

export default SignaturePad;