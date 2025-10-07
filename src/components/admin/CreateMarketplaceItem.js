import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../common/Sidebar'; // Assuming this is your admin sidebar
import { marketplaceAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css'; // Common admin form styles
import ImageCropperWithPreview from './ImageCropperWithPreview';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BSelect } from './ui';
import BButton from './ui/BButton';

const CreateMarketplaceItem = () => {
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [xpCost, setXpCost] = useState('');
    const [itemType, setItemType] = useState('DIRECT'); // 'DIRECT' or 'RAFFLE'
    const [stock, setStock] = useState(''); // Optional
    const [redeemLimitPerUser, setRedeemLimitPerUser] = useState(''); // New state
    const [raffleEntriesPerUser, setRaffleEntriesPerUser] = useState('1');
    const [raffleEndDate, setRaffleEndDate] = useState('');
    const [croppedImageBlob, setCroppedImageBlob] = useState(null);
    const [imageUrl, setImageUrl] = useState(''); // For URL input only
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !xpCost) {
            toast.error('Title and XP Cost are required.');
            return;
        }
        if (isNaN(parseInt(xpCost, 10)) || parseInt(xpCost, 10) <= 0) {
            toast.error('XP Cost must be a positive number.');
            return;
        }
        if (itemType === 'RAFFLE' && (!raffleEntriesPerUser || isNaN(parseInt(raffleEntriesPerUser,10)) || parseInt(raffleEntriesPerUser,10) < 1)) {
            toast.error('Raffle entries per user must be a positive number.');
            return;
        }

        setIsLoading(true);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('xp_cost', parseInt(xpCost, 10));
        formData.append('item_type', itemType);
        if (stock) formData.append('stock', parseInt(stock, 10));
        if (redeemLimitPerUser) formData.append('redeem_limit_per_user', parseInt(redeemLimitPerUser, 10));
        if (itemType === 'RAFFLE') {
            formData.append('raffle_entries_per_user', parseInt(raffleEntriesPerUser, 10));
            if (raffleEndDate) formData.append('raffle_end_date', raffleEndDate);
        }
        if (croppedImageBlob) {
            formData.append('image', croppedImageBlob, 'marketplace_item.jpg');
        } else if (imageUrl) {
            formData.append('image_url', imageUrl);
        }
        // Add is_active if you want a toggle, default true in backend controller
        // formData.append('is_active', true);

        try {
            const response = await marketplaceAPI.adminCreateItem(formData);
            toast.success(response.data.message || 'Marketplace item created successfully!');
            navigate('/admin/marketplace/manage'); // Navigate to manage marketplace items page
        } catch (error) {
            console.error("Error creating marketplace item:", error.response?.data || error.message);
            toast.error(error.response?.data?.error || 'Failed to create item.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCroppedImageChange = (file) => {
        setCroppedImageBlob(file);
    };

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33">
                <div className="form-container-card">
                    <div className="form-header">
                        <button onClick={() => navigate('/admin/marketplace/manage')} className="back-to-dashboard-link" style={{marginBottom: '1rem'}}>
                            <i className="ri-arrow-left-s-line"></i> Back to Manage Items
                        </button>
                        <h1 className="chat-title">Create New Marketplace Item</h1>
                        <p className="chat-subtitle">Add a new reward item for users to redeem with XP.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        <BFormField label={<span>Item Title* <span style={{ color: '#666', fontSize: '12px' }}>({title.length}/50)</span></span>} required>
                            <BTextInput
                                id="title"
                                value={title}
                                onChange={(e) => {
                                    if (e.target.value.length <= 50) {
                                        setTitle(e.target.value);
                                    }
                                }}
                                placeholder="Enter item title"
                                maxLength={50}
                                required
                                style={{
                                    borderColor: title.length > 45 ? '#ff9800' : title.length === 50 ? '#f44336' : '#ddd'
                                }}
                            />
                            {title.length > 45 && (
                                <small style={{ color: title.length === 50 ? '#f44336' : '#ff9800', fontSize: '12px' }}>
                                    {title.length === 50 ? 'Character limit reached' : `${50 - title.length} characters remaining`}
                                </small>
                            )}
                        </BFormField>

                        <BFormField label={<span>Description <span style={{ color: '#666', fontSize: '12px' }}>({description.length}/150)</span></span>}>
                            <BTextarea
                                id="description"
                                value={description}
                                onChange={(e) => {
                                    if (e.target.value.length <= 150) {
                                        setDescription(e.target.value);
                                    }
                                }}
                                placeholder="Enter item description (optional)"
                                rows={3}
                                style={{
                                    borderColor: description.length > 130 ? '#ff9800' : description.length === 150 ? '#f44336' : '#ddd'
                                }}
                            />
                            {description.length > 130 && (
                                <small style={{ color: description.length === 150 ? '#f44336' : '#ff9800', fontSize: '12px' }}>
                                    {description.length === 150 ? 'Character limit reached' : `${150 - description.length} characters remaining`}
                                </small>
                            )}
                        </BFormField>
                        
                        <BFormField label="XP Cost" required>
                            <BTextInput
                                type="number"
                                id="xpCost"
                                value={xpCost}
                                onChange={(e) => setXpCost(e.target.value)}
                                placeholder="e.g., 100"
                                min="1"
                                required
                            />
                        </BFormField>

                        <BFormField label="Item Type" required>
                            <BSelect id="itemType" value={itemType} onChange={(e) => setItemType(e.target.value)} required>
                                <option value="DIRECT">Direct Purchase</option>
                                <option value="RAFFLE">Raffle Entry</option>
                            </BSelect>
                        </BFormField>

                        {itemType === 'DIRECT' && (
                            <div className="newform-group">
                                <label htmlFor="stock">Stock (Optional)</label>
                                <input
                                    type="number"
                                    id="stock"
                                    value={stock}
                                    onChange={(e) => setStock(e.target.value)}
                                    placeholder="Leave blank for unlimited"
                                    min="0"
                                />
                            </div>
                        )}

                        {itemType === 'DIRECT' && (
                            <div className="newform-group">
                                <label htmlFor="redeemLimitPerUser">Redemption Limit Per User (Optional)</label>
                                <input
                                    type="number"
                                    id="redeemLimitPerUser"
                                    value={redeemLimitPerUser}
                                    onChange={(e) => setRedeemLimitPerUser(e.target.value)}
                                    placeholder="Leave blank for unlimited"
                                    min="1"
                                />
                            </div>
                        )}

                        {itemType === 'RAFFLE' && (
                            <>
                                <BFormField label="Max Entries Per User" required>
                                    <BTextInput
                                        type="number"
                                        id="raffleEntriesPerUser"
                                        value={raffleEntriesPerUser}
                                        onChange={(e) => setRaffleEntriesPerUser(e.target.value)}
                                        min="1"
                                        required
                                    />
                                </BFormField>
                                <BFormField label="Raffle End Date (Optional)">
                                    <BTextInput
                                        type="datetime-local"
                                        id="raffleEndDate"
                                        value={raffleEndDate}
                                        onChange={(e) => setRaffleEndDate(e.target.value)}
                                    />
                                </BFormField>
                            </>
                        )}

                        <BFormField label="Item Image">
                            <ImageCropperWithPreview 
                                onCroppedImageChange={handleCroppedImageChange}
                                onImageUpload={(file) => setCroppedImageBlob(file)}
                                initialImage=""
                            />
                        </BFormField>
                        <BFormField label="Or Image URL" hint="Provide either upload an image with crop tool or provide a direct URL. Upload takes precedence.">
                            <BTextInput
                                type="url"
                                id="imageUrl"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://example.com/image.png"
                            />
                        </BFormField>

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin/marketplace/manage')} disabled={isLoading}>
                                Cancel
                            </BButton>
                            <BButton type="submit" variant="primary" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Item'}
                            </BButton>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateMarketplaceItem; 