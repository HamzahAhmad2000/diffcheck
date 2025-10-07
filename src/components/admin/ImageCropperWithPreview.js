import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const ImageCropperWithPreview = ({ 
    onCroppedImageChange, 
    initialImage, 
    onImageUpload 
}) => {
    const [imageSrc, setImageSrc] = useState(initialImage || '');
    const [crop, setCrop] = useState({
        unit: '%',
        width: 90,
        height: 60,
        x: 5,
        y: 20
    });
    const [completedCrop, setCompletedCrop] = useState(null);
    const [croppedImageUrl, setCroppedImageUrl] = useState('');
    const [imageRef, setImageRef] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [rotate, setRotate] = useState(0);

    // Update imageSrc when initialImage changes (for edit mode)
    useEffect(() => {
        if (initialImage && initialImage !== imageSrc) {
            setImageSrc(initialImage);
            setCroppedImageUrl(''); // Reset cropped URL so it shows the new initial image
        }
    }, [initialImage, imageSrc]);

    // Generate cropped image canvas
    const getCroppedImg = useCallback((image, crop) => {
        if (!crop || !crop.width || !crop.height || !image || !image.complete) {
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            
            canvas.width = Math.max(1, crop.width * scaleX);
            canvas.height = Math.max(1, crop.height * scaleY);
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(
                image,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                canvas.width,
                canvas.height,
            );

            return canvas;
        } catch (error) {
            console.error('Error cropping image:', error);
            return null;
        }
    }, []);

    // Update cropped image when crop changes
    useEffect(() => {
        if (completedCrop && imageRef && imageRef.complete) {
            const canvas = getCroppedImg(imageRef, completedCrop);
            if (canvas) {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        setCroppedImageUrl(url);
                        const file = new File([blob], 'marketplace_item.jpg', { type: 'image/jpeg' });
                        onCroppedImageChange && onCroppedImageChange(file, url);
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    }, [completedCrop, imageRef, getCroppedImg, onCroppedImageChange]);

    const onSelectFile = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result);
                onImageUpload && onImageUpload(file);
            });
            reader.readAsDataURL(file);
        }
    };

    const onImageLoad = useCallback((img) => {
        setImageRef(img);
        
        // Set initial crop to center of image with good proportions for marketplace
        const aspect = 350 / 220; // Based on marketplace card dimensions
        const width = Math.min(90, (img.height * aspect) / img.width * 100);
        const height = Math.min(60, (img.width / aspect) / img.height * 100);
        
        setCrop({
            unit: '%',
            width: width,
            height: height,
            x: (100 - width) / 2,
            y: (100 - height) / 2,
        });
    }, []);

    const resetCrop = () => {
        if (imageRef) {
            const aspect = 350 / 220;
            const width = Math.min(90, (imageRef.height * aspect) / imageRef.width * 100);
            const height = Math.min(60, (imageRef.width / aspect) / imageRef.height * 100);
            
            setCrop({
                unit: '%',
                width: width,
                height: height,
                x: (100 - width) / 2,
                y: (100 - height) / 2,
            });
        }
    };

    // Marketplace preview component that mimics the actual marketplace card
    const MarketplacePreview = ({ imageUrl, title = "Sample Item Title", description = "This is how your item will appear in the marketplace with the current crop settings." }) => (
        <div style={{
            background: '#fff',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
            width: '350px',
            border: '1px solid #e8e8e8',
            fontSize: '14px'
        }}>
            <div style={{ 
                position: 'relative',
                height: '220px',
                overflow: 'hidden',
                background: '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Preview"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                ) : (
                    <div style={{
                        color: '#999',
                        textAlign: 'center',
                        padding: '20px'
                    }}>
                        Upload an image to see preview
                    </div>
                )}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'linear-gradient(135deg, #4caf50, #43a047)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600'
                }}>
                    ⚡ Instant
                </div>
            </div>
            <div style={{ padding: '20px' }}>
                <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    lineHeight: '1.3'
                }}>
                    {title}
                </h3>
                <p style={{
                    margin: '0 0 16px 0',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.4'
                }}>
                    {description}
                </p>
                <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #aa2eff 0%, #8c1fd9 100%)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontWeight: '700',
                    textAlign: 'center'
                }}>
                    🪙 1,000 XP
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333'
                }}>
                    Item Image*
                </label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px dashed #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer'
                    }}
                />
                <p style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    margin: '8px 0 0 0'
                }}>
                    Upload an image and use the cropping tool below to ensure it looks perfect in the marketplace.
                </p>
            </div>

            {imageSrc && (
                <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '32px',
                    alignItems: 'start'
                }}>
                    {/* Cropping Interface */}
                    <div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            marginBottom: '16px'
                        }}>
                            <div className="crop-control">
                                <label>Zoom:</label>
                                <input
                                    type="range"
                                    value={scale}
                                    disabled={!imageSrc}
                                    onChange={(e) => setScale(Number(e.target.value))}
                                    min="1"
                                    max="3"
                                    step="0.1"
                                    className="crop-slider"
                                />
                                <span>{Math.round(scale * 100)}%</span>
                            </div>
                            <div className="crop-control">
                                <label>Rotate:</label>
                                <input
                                    type="range"
                                    value={rotate}
                                    disabled={!imageSrc}
                                    onChange={(e) => setRotate(Math.min(180, Math.max(-180, Number(e.target.value))))}
                                    min="-180"
                                    max="180"
                                    step="1"
                                    className="crop-slider"
                                />
                                <span>{rotate}°</span>
                            </div>
                        </div>
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={350 / 220}
                        >
                            <img
                                ref={setImageRef}
                                src={imageSrc}
                                onLoad={onImageLoad}
                                alt="Crop me"
                                style={{ 
                                    transform: `scale(${scale}) rotate(${rotate}deg)`,
                                    maxHeight: '400px' 
                                }}
                            />
                        </ReactCrop>
                        <button onClick={resetCrop} style={{ marginTop: '10px' }}>Reset Crop</button>
                    </div>
                    {/* Preview Section */}
                    <div style={{
                        position: 'sticky',
                        top: '20px'
                    }}>
                        <h3 style={{
                            margin: '0 0 16px 0',
                            fontSize: '18px',
                            fontWeight: '700'
                        }}>
                            Live Marketplace Preview
                        </h3>
                        <MarketplacePreview imageUrl={croppedImageUrl || imageSrc} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageCropperWithPreview; 