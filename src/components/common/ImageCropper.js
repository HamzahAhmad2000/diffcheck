import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toast } from 'react-hot-toast';
import './ImageCropper.css';

const ImageCropper = ({ 
  isOpen, 
  onClose, 
  onCropComplete, 
  imageSrc, 
  title = "Crop Image",
  aspect = 1, // Default to square crop
  circularCrop = false 
}) => {
  const [crop, setCrop] = useState({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10
  });
  
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  const onImageLoad = useCallback((img) => {
    imgRef.current = img;
    
    // Store image dimensions
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    
    // Calculate initial crop based on aspect ratio
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let cropWidth, cropHeight;
    
    if (imgAspect > aspect) {
      // Image is wider than target aspect
      cropHeight = 80;
      cropWidth = cropHeight * aspect;
    } else {
      // Image is taller than target aspect
      cropWidth = 80;
      cropHeight = cropWidth / aspect;
    }
    
    setCrop({
      unit: '%',
      width: cropWidth,
      height: cropHeight,
      x: (100 - cropWidth) / 2,
      y: (100 - cropHeight) / 2,
    });
  }, [aspect]);

  const getCroppedImg = useCallback((image, crop) => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !crop?.width || !crop?.height) {
      return null;
    }

    try {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      // Calculate actual pixel dimensions
      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;
      const cropWidth = crop.width * scaleX;
      const cropHeight = crop.height * scaleY;

      // Set canvas size to the cropped dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set high quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw the cropped portion
      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      return new Promise((resolve) => {
        try {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                console.error('Canvas is empty');
                resolve(null);
                return;
              }
              resolve(blob);
            },
            'image/jpeg',
            0.95
          );
        } catch (error) {
          console.error('CORS error when creating blob:', error);
          // Fallback: try to create blob from data URL if available
          if (imageSrc && imageSrc.startsWith('data:')) {
            fetch(imageSrc)
              .then(res => res.blob())
              .then(blob => resolve(blob))
              .catch(() => resolve(null));
          } else {
            resolve(null);
          }
        }
      });
    } catch (error) {
      console.error('Error cropping image:', error);
      return Promise.resolve(null);
    }
  }, [imageSrc]);

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current) {
      toast.error('Please select a crop area first');
      return;
    }

    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      if (croppedImageBlob) {
        onCropComplete(croppedImageBlob);
        onClose();
      } else {
        toast.error('Failed to crop image. Please try again.');
      }
    } catch (error) {
      console.error('Error completing crop:', error);
      toast.error('Failed to crop image. Please try again.');
    }
  };

  const resetCrop = () => {
    if (imgRef.current) {
      const imgAspect = imageDimensions.width / imageDimensions.height;
      let cropWidth, cropHeight;
      
      if (imgAspect > aspect) {
        cropHeight = 80;
        cropWidth = cropHeight * aspect;
      } else {
        cropWidth = 80;
        cropHeight = cropWidth / aspect;
      }
      
      setCrop({
        unit: '%',
        width: cropWidth,
        height: cropHeight,
        x: (100 - cropWidth) / 2,
        y: (100 - cropHeight) / 2,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <div className="image-cropper-header">
          <h3>{title}</h3>
          <button 
            className="image-cropper-close"
            onClick={onClose}
            type="button"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
        
        <div className="image-cropper-content">
          {imageSrc && (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <ReactCrop
                crop={crop}
                onChange={(newCrop) => setCrop(newCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                circularCrop={circularCrop}
                className="image-cropper-crop"
                minWidth={20}
                minHeight={20}
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imageSrc}
                  onLoad={(e) => onImageLoad(e.currentTarget)}
                  crossOrigin="anonymous"
                  className="image-cropper-image"
                />
              </ReactCrop>
              
              <button 
                onClick={resetCrop}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '6px 12px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Reset
              </button>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />
        </div>
        
        <div className="image-cropper-footer">
          <button 
            className="image-cropper-btn image-cropper-btn--cancel"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button 
            className="image-cropper-btn image-cropper-btn--crop"
            onClick={handleCropComplete}
            disabled={!completedCrop}
            type="button"
          >
            Crop & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper; 