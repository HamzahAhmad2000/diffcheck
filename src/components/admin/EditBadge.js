import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { badgeAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea } from './ui';
import BButton from './ui/BButton';
import BFileUpload from './ui/BFileUpload';

const EditBadge = () => {
    const navigate = useNavigate();
    const { badgeId } = useParams();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [xpThreshold, setXpThreshold] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [previewImageUrl, setPreviewImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const fetchBadgeDetails = useCallback(async () => {
        setIsFetching(true);
        try {
            const response = await badgeAPI.adminGetBadgeById(badgeId);
            const badge = response.data.badge;

            if (badge) {
                setName(badge.name);
                setDescription(badge.description || '');
                setXpThreshold(badge.xp_threshold.toString());
                setCurrentImageUrl(badge.image_url || '');
                setPreviewImageUrl(badge.image_url || '');
            } else {
                toast.error('Badge not found.');
                navigate('/admin/badges');
            }
        } catch (error) {
            console.error("Error fetching badge details:", error);
            toast.error(error.response?.data?.error || 'Failed to load badge details.');
            navigate('/admin/badges');
        } finally {
            setIsFetching(false);
        }
    }, [badgeId, navigate]);

    useEffect(() => {
        fetchBadgeDetails();
    }, [fetchBadgeDetails]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !xpThreshold) {
            toast.error('Badge Name and XP Threshold are required.');
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('xp_threshold', parseInt(xpThreshold, 10));

        if (imageFile) {
            formData.append('image', imageFile);
        } else if (previewImageUrl !== currentImageUrl && previewImageUrl) {
            formData.append('image_url', previewImageUrl);
        } else if (!previewImageUrl && currentImageUrl) {
            formData.append('image_url', ''); // To remove image
        }

        try {
            await badgeAPI.adminUpdateBadge(badgeId, formData);
            toast.success('Badge updated successfully!');
            navigate('/admin/badges');
        } catch (error) {
            console.error("Error updating badge:", error.response?.data || error.message);
            toast.error(error.response?.data?.error || 'Failed to update badge.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setPreviewImageUrl(URL.createObjectURL(file));
        }
    };
    
    const handleImageUrlChange = (e) => {
        setPreviewImageUrl(e.target.value);
        setImageFile(null);
    };

    if (isFetching) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-form-page">
                    <div className="loading-indicator"><p>Loading badge details...</p></div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-form-page">
                <div className="form-container-card">
                    <div className="form-header">
                         <button onClick={() => navigate('/admin/badges')} className="back-to-dashboard-link" style={{marginBottom: '1rem'}}>
                            <i className="ri-arrow-left-s-line"></i> Back to Manage Badges
                        </button>
                        <h1 className="chat-title">Edit Badge</h1>
                        <p className="chat-subtitle">Modify the details of an existing achievement badge.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <BFormField label="Badge Name" required>
                            <BTextInput id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </BFormField>

                        <BFormField label="Description">
                            <BTextarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </BFormField>
                        
                        <BFormField label="XP Threshold" required>
                            <BTextInput type="number" id="xpThreshold" value={xpThreshold} onChange={(e) => setXpThreshold(e.target.value)} min="0" required />
                        </BFormField>

                        <BFormField label="Badge Image (Upload new)">
                            <BFileUpload accept="image/*" onChange={handleImageFileChange} />
                            {previewImageUrl && <img src={previewImageUrl} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '50%' }} />}
                        </BFormField>
                        <BFormField label="Or Image URL" hint="Upload an image or provide a URL. Uploading takes precedence. Clear the URL to remove the image.">
                            <BTextInput type="url" id="imageUrl" value={imageFile ? '' : previewImageUrl} onChange={handleImageUrlChange} placeholder="https://example.com/badge.png" disabled={!!imageFile} />
                        </BFormField>

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin/badges')} disabled={isLoading}>
                                Cancel
                            </BButton>
                            <BButton type="submit" variant="primary" disabled={isLoading || isFetching}>
                                {isLoading ? 'Updating...' : 'Save Changes'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditBadge; 