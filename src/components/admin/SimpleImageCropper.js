import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// A robust utility function to generate the preview on a canvas.
// This is adapted from the official react-image-crop examples to ensure correctness.
function canvasPreview(image, canvas, crop, scale = 1, rotate = 0, cropShape = 'rect') {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  const rotateRads = (rotate * Math.PI) / 180;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();
  
  if (cropShape === 'round') {
    ctx.beginPath();
    const radius = Math.min(crop.width * scaleX, crop.height * scaleY) / 2;
    ctx.arc((crop.width * scaleX) / 2, (crop.height * scaleY) / 2, radius, 0, 2 * Math.PI);
    ctx.clip();
  }

  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight);

  ctx.restore();
}

const SimpleImageCropper = ({ 
    onCroppedImageChange, 
    initialImage,
    aspect = 1,
    maxHeight = 300,
    cropShape = 'rect'
}) => {
    const [imageSrc, setImageSrc] = useState(initialImage || '');
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [scale, setScale] = useState(1);
    const [rotate, setRotate] = useState(0);
    const [isCropMode, setIsCropMode] = useState(false); // New state to control crop mode

    const imageRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [corsError, setCorsError] = useState(false);

    const previewWidth = 200;
    // Calculate preview height based on the aspect ratio to maintain its shape
    const previewHeight = aspect ? previewWidth / aspect : previewWidth;

    const onImageLoad = useCallback((img) => {
        imageRef.current = img;
        
        // Only set up crop if in crop mode
        if (isCropMode) {
            const { width, height } = img;
            const targetAspect = cropShape === 'round' ? 1 : aspect;

            const newCrop = { unit: '%', width: 80 };
            const cropWidth = newCrop.width;
            const cropHeight = (cropWidth / targetAspect) * (height / width);
            
            newCrop.height = cropHeight;
            newCrop.x = (100 - cropWidth) / 2;
            newCrop.y = (100 - cropHeight) / 2;

            setCrop(newCrop);
            setCompletedCrop({
                unit: 'px',
                x: (newCrop.x * width) / 100,
                y: (newCrop.y * height) / 100,
                width: (newCrop.width * width) / 100,
                height: (newCrop.height * height) / 100,
            });
        }

        if (initialImage && initialImage.startsWith('http') && !initialImage.startsWith(window.location.origin)) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toDataURL('image/jpeg');
                setCorsError(false);
            } catch (e) {
                console.warn('CORS issue detected with initial image.', e);
                setCorsError(true);
            }
        }
    }, [aspect, cropShape, initialImage, isCropMode]);

    const onSelectFile = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined);
            setIsCropMode(false); // Reset crop mode when new file selected
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || '');
                setScale(1);
                setRotate(0);
                setCorsError(false);
                setCompletedCrop(null);
            });
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    const generateCroppedImageBlob = useCallback(async () => {
        if (!completedCrop || !imageRef.current) {
            return;
        }

        const image = imageRef.current;
        const tempCanvas = document.createElement('canvas');

        try {
            canvasPreview(image, tempCanvas, completedCrop, scale, rotate, cropShape);
            
            tempCanvas.toBlob(
                (blob) => {
                    if (blob) {
                        const file = new File([blob], 'logo.png', { type: 'image/png' });
                        onCroppedImageChange(file);
                        setCorsError(false);
                    }
                },
                'image/png',
                1
            );
        } catch (error) {
            console.error('Error creating blob:', error);
            if (error.name === 'SecurityError') {
                setCorsError(true);
                if (imageSrc) {
                   fetch(imageSrc).then(res => res.blob()).then(blob => {
                       const file = new File([blob], 'logo_original.png', { type: 'image/png' });
                       onCroppedImageChange(file);
                   });
                }
            }
        }
    }, [completedCrop, scale, rotate, onCroppedImageChange, imageSrc, cropShape]);

    useEffect(() => {
        if (completedCrop && previewCanvasRef.current && imageRef.current && isCropMode) {
            canvasPreview(imageRef.current, previewCanvasRef.current, completedCrop, scale, rotate, cropShape);
            generateCroppedImageBlob();
        }
    }, [completedCrop, scale, rotate, generateCroppedImageBlob, cropShape, isCropMode]);

    // Handle initial image changes (refresh/load scenario)
    useEffect(() => {
        if (initialImage && initialImage !== imageSrc) {
            setImageSrc(initialImage);
            setScale(1);
            setRotate(0);
            setCorsError(false);
            setCompletedCrop(null);
            setIsCropMode(false); // Reset crop mode on refresh
        }
    }, [initialImage, imageSrc]);

    const enterCropMode = () => {
        setIsCropMode(true);
        if (imageRef.current) {
            onImageLoad(imageRef.current);
        }
    };

    const exitCropMode = () => {
        setIsCropMode(false);
        setCrop(undefined);
        setCompletedCrop(null);
        setScale(1);
        setRotate(0);
        onCroppedImageChange(null); // Clear any cropped image
    };

    const resetCrop = () => {
        if (imageRef.current && isCropMode) {
            onImageLoad(imageRef.current);
        }
    };

    return (
        <div className="simple-image-cropper" style={{ width: '100%' }}>
            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#333' }}>
                    Logo Image
                </label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onSelectFile} />
                 <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
                    Upload and crop your business logo
                </p>
                {corsError && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>
                        ⚠️ Cropping is disabled for this image due to security restrictions. The original image will be used. For best results, upload a local file.
                    </div>
                )}
            </div>

            {imageSrc && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
                    {/* Image Display / Cropping Interface */}
                    <div>
                        {!isCropMode ? (
                            // Simple image display with crop button
                            <div>
                                <div style={{ marginBottom: '16px' }}>
                                    <button 
                                        onClick={enterCropMode} 
                                        className="reset-btn"
                                        style={{ 
                                            backgroundColor: '#007bff', 
                                            color: 'white', 
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Crop Image
                                    </button>
                                </div>
                                <img 
                                    src={imageSrc} 
                                    onLoad={(e) => onImageLoad(e.target)} 
                                    alt="Business logo" 
                                    crossOrigin="anonymous" 
                                    style={{ 
                                        maxHeight: `${maxHeight}px`, 
                                        maxWidth: '100%',
                                        border: '1px solid #ccc',
                                        borderRadius: '8px'
                                    }} 
                                />
                            </div>
                        ) : (
                            // Full cropping interface
                            <div>
                                <div className="controls" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ flexBasis: '60px' }}>Zoom:</label>
                                        <input type="range" value={scale} disabled={!imageSrc || corsError} onChange={(e) => setScale(Number(e.target.value))} min="0.5" max="3" step="0.05" style={{ flex: 1 }} />
                                        <span className="control-value" style={{ width: '40px', textAlign: 'right' }}>{Math.round(scale * 100)}%</span>
                                    </div>
                                    <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ flexBasis: '60px' }}>Rotate:</label>
                                        <input type="range" value={rotate} disabled={!imageSrc || corsError} onChange={(e) => setRotate(Number(e.target.value))} min="-180" max="180" step="1" style={{ flex: 1 }} />
                                        <span className="control-value" style={{ width: '40px', textAlign: 'right' }}>{rotate}°</span>
                                    </div>
                                </div>
                                
                                <div className="crop-container">
                                    <ReactCrop
                                        crop={crop}
                                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                                        onComplete={(c) => setCompletedCrop(c)}
                                        aspect={aspect}
                                        circularCrop={cropShape === 'round'}
                                        minWidth={20}
                                        minHeight={20}
                                        disabled={corsError}
                                    >
                                        <img src={imageSrc} onLoad={(e) => onImageLoad(e.target)} alt="Crop me" crossOrigin="anonymous" style={{ transform: `scale(${scale}) rotate(${rotate}deg)`, maxHeight: `${maxHeight}px` }} />
                                    </ReactCrop>
                                </div>
                                
                                <div className="reset-buttons" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                    <button onClick={resetCrop} className="reset-btn">Reset Crop</button>
                                    <button onClick={() => { setScale(1); setRotate(0); }} className="reset-btn">Reset Transform</button>
                                    <button onClick={exitCropMode} className="reset-btn" style={{ backgroundColor: '#dc3545', color: 'white' }}>Cancel Crop</button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Preview */}
                    <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>Preview</h3>
                        <div className="preview-container" style={{
                            width: `${previewWidth}px`,
                            height: `${previewHeight}px`,
                            borderRadius: '8px',
                            overflow: 'hidden', 
                            border: '1px solid #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f0f0f0'
                        }}>
                            {isCropMode && completedCrop ? (
                                <canvas
                                    ref={previewCanvasRef}
                                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                />
                            ) : (
                                <img 
                                    src={imageSrc} 
                                    alt="Preview"
                                    style={{ 
                                        objectFit: 'contain', 
                                        width: '100%', 
                                        height: '100%' 
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleImageCropper;