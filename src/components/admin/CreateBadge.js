import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const CreateBadge = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [xpThreshold, setXpThreshold] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !xpThreshold) {
            toast.error('Badge Name and XP Threshold are required.');
            return;
        }
        if (isNaN(parseInt(xpThreshold, 10)) || parseInt(xpThreshold, 10) < 0) {
            toast.error('XP Threshold must be a non-negative number.');
            return;
        }
        // Allow creating badges without image (will use default placeholder)
        // if (!imageFile && !imageUrl) {
        //     toast.error('An image is required for the badge.');
        //     return;
        // }

        setIsLoading(true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('xp_threshold', parseInt(xpThreshold, 10));
        
        if (imageFile) {
            formData.append('image', imageFile);
        } else if (imageUrl) {
            formData.append('image_url', imageUrl);
        }

        try {
            const response = await badgeAPI.adminCreateBadge(formData);
            toast.success(response.data.message || 'Badge created successfully!');
            navigate('/admin/badges');
        } catch (error) {
            console.error("Error creating badge:", error.response?.data || error.message);
            toast.error(error.response?.data?.error || 'Failed to create badge.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file)); // For preview
        }
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33">
                <div className="form-container-card">
                    <div className="form-header">
                        <button onClick={() => navigate('/admin/badges')} className="back-to-dashboard-link" style={{marginBottom: '1rem'}}>
                            <i className="ri-arrow-left-s-line"></i> Back to Manage Badges
                        </button>
                        <h1 className="chat-title">Create New Badge</h1>
                        <p className="chat-subtitle">Set up a new achievement badge for users.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <BFormField label="Badge Name" required>
                            <BTextInput
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Survey Starter"
                                required
                            />
                        </BFormField>

                        <BFormField label="Description">
                            <BTextarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe how to earn this badge"
                                rows={3}
                            />
                        </BFormField>
                        
                        <BFormField label="XP Threshold" required>
                            <BTextInput
                                type="number"
                                id="xpThreshold"
                                value={xpThreshold}
                                onChange={(e) => setXpThreshold(e.target.value)}
                                placeholder="e.g., 100"
                                min="0"
                                required
                            />
                        </BFormField>

                        <BFormField label="Badge Image (Upload)">
                            <BFileUpload accept="image/*" onChange={handleImageFileChange} />
                            {imageUrl && <img src={imageUrl} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '50%' }} />}
                        </BFormField>
                        <BFormField label="Or Image URL" hint="Provide either an image upload or a URL. If left empty, a default badge placeholder will be used.">
                            <BTextInput
                                type="url"
                                id="imageUrl"
                                value={imageFile ? '' : imageUrl}
                                onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }}
                                placeholder="https://example.com/badge.png"
                                disabled={!!imageFile}
                            />
                        </BFormField>

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin/badges')} disabled={isLoading}>
                                Cancel
                            </BButton>
                            <BButton type="submit" variant="primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Badge'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateBadge; 