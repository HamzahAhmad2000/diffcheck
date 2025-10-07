import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { marketplaceAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import ImageCropperWithPreview from './ImageCropperWithPreview';
import '../../styles/b_admin_styling.css';
import './ui/b_ui.css';
import { BFormField, BTextInput, BTextarea, BSelect, BCheckbox } from './ui';
import BButton from './ui/BButton';

const EditMarketplaceItem = () => {
    const navigate = useNavigate();
    const { itemId } = useParams();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [xpCost, setXpCost] = useState('');
    const [itemType, setItemType] = useState('DIRECT');
    const [stock, setStock] = useState('');
    const [redeemLimitPerUser, setRedeemLimitPerUser] = useState('');
    const [raffleEntriesPerUser, setRaffleEntriesPerUser] = useState('1');
    const [raffleEndDate, setRaffleEndDate] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState(''); // Existing image URL
    const [croppedImageBlob, setCroppedImageBlob] = useState(null);
    const [imageUrl, setImageUrl] = useState(''); // For URL input only
    const [isActive, setIsActive] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const fetchItemDetails = useCallback(async () => {
        setIsFetching(true);
        try {
            // Fetch the specific item using the new admin endpoint
            const response = await marketplaceAPI.adminGetItemById(itemId);
            const item = response.data.item; // Assuming the API returns { item: { ... } }

            if (item) {
                setTitle(item.title);
                setDescription(item.description || '');
                setXpCost(item.xp_cost.toString());
                setItemType(item.item_type);
                setStock(item.stock !== null ? item.stock.toString() : '');
                setRedeemLimitPerUser(item.redeem_limit_per_user !== null ? item.redeem_limit_per_user.toString() : '');
                setRaffleEntriesPerUser(item.raffle_entries_per_user !== null ? item.raffle_entries_per_user.toString() : '1');
                setRaffleEndDate(item.raffle_end_date ? item.raffle_end_date.substring(0, 16) : ''); // Format for datetime-local
                setCurrentImageUrl(item.image_url || '');
                setImageUrl(item.image_url || '');
                setIsActive(item.is_active);
            } else {
                toast.error('Marketplace item not found.');
                navigate('/admin/marketplace/manage');
            }
        } catch (error) {
            console.error("Error fetching item details:", error);
            toast.error(error.response?.data?.error || 'Failed to load item details.');
            navigate('/admin/marketplace/manage');
        } finally {
            setIsFetching(false);
        }
    }, [itemId, navigate]);

    useEffect(() => {
        fetchItemDetails();
    }, [fetchItemDetails]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validations (similar to CreateMarketplaceItem)
        if (!title.trim() || !xpCost) {
            toast.error('Title and XP Cost are required.');
            return;
        }
        // ... add other validations ...

        setIsLoading(true);

        let finalImageUrl = imageUrl; // holds current or typed URL
        // If a new cropped image is provided, upload it first
        if (croppedImageBlob) {
            // Keep finalImageUrl empty; we'll send raw file instead
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('xp_cost', parseInt(xpCost, 10));
        formData.append('item_type', itemType);
        if (stock) formData.append('stock', parseInt(stock, 10));
        else formData.append('stock', ''); // Send empty if cleared to nullify
        
        if (redeemLimitPerUser) formData.append('redeem_limit_per_user', parseInt(redeemLimitPerUser, 10));
        else formData.append('redeem_limit_per_user', '');

        if (itemType === 'RAFFLE') {
            formData.append('raffle_entries_per_user', parseInt(raffleEntriesPerUser, 10));
            if (raffleEndDate) formData.append('raffle_end_date', raffleEndDate);
            else formData.append('raffle_end_date', '');
        }
        formData.append('is_active', isActive);

        // Handle image data
        if (croppedImageBlob) {
            formData.append('image', croppedImageBlob, 'marketplace_item.jpg');
        } else if (imageUrl !== currentImageUrl) {
            if (imageUrl) {
                formData.append('image_url', imageUrl);
            } else if (!imageUrl && currentImageUrl) {
                formData.append('image_url', '');
            }
        }

        try {
            await marketplaceAPI.adminUpdateItem(itemId, formData);
            toast.success('Marketplace item updated successfully!');
            navigate('/admin/marketplace/manage');
        } catch (error) {
            console.error("Error updating marketplace item:", error.response?.data || error.message);
            toast.error(error.response?.data?.error || 'Failed to update item.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCroppedImageChange = (file) => {
        setCroppedImageBlob(file);
    };
    
    const handleImageUrlChange = (e) => {
        setImageUrl(e.target.value);
        setCroppedImageBlob(null); // Clear cropped image if URL is being typed
    };

    if (isFetching) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-form-page">
                    <div className="loading-indicator"><p>Loading item details...</p></div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 ">
                <div className="form-container-card">
                    <div className="form-header">
                         <button onClick={() => navigate('/admin/marketplace/manage')} className="back-to-dashboard-link" style={{marginBottom: '1rem'}}>
                            <i className="ri-arrow-left-s-line"></i> Back to Manage Items
                        </button>
                        <h1 className="chat-title">Edit Marketplace Item</h1>
                        <p className="chat-subtitle">Modify the details of an existing reward item.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form">
                        {/* Form groups similar to CreateMarketplaceItem, but populated with state values */}
                        <BFormField label={<span>Item Title* <span style={{ color: '#666', fontSize: '12px' }}>({title.length}/50)</span></span>} required>
                            <BTextInput 
                                id="title" 
                                value={title} 
                                onChange={(e) => {
                                    if (e.target.value.length <= 50) {
                                        setTitle(e.target.value);
                                    }
                                }} 
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
                            <BTextInput type="number" id="xpCost" value={xpCost} onChange={(e) => setXpCost(e.target.value)} min="1" required />
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
                                <input type="number" id="stock" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Leave blank for unlimited" min="0" />
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
                                    <BTextInput type="number" id="raffleEntriesPerUser" value={raffleEntriesPerUser} onChange={(e) => setRaffleEntriesPerUser(e.target.value)} min="1" required />
                                </BFormField>
                                <BFormField label="Raffle End Date (Optional)">
                                    <BTextInput type="datetime-local" id="raffleEndDate" value={raffleEndDate} onChange={(e) => setRaffleEndDate(e.target.value)} />
                                </BFormField>
                            </>
                        )}

                        <BFormField label="Item Image">
                            <ImageCropperWithPreview 
                                onCroppedImageChange={handleCroppedImageChange}
                                onImageUpload={(file) => setCroppedImageBlob(file)}
                                initialImage={currentImageUrl}
                            />
                        </BFormField>
                        <BFormField label="Or Image URL" hint="Upload and crop an image or provide a direct URL. Upload takes precedence.">
                            <BTextInput 
                                type="url" 
                                id="imageUrl" 
                                value={croppedImageBlob ? '' : imageUrl} 
                                onChange={handleImageUrlChange} 
                                placeholder="https://example.com/image.png" 
                                disabled={!!croppedImageBlob} 
                            />
                        </BFormField>

                        <div className="newform-group permission-item" style={{ flexDirection: 'row', alignItems: 'center', marginTop: '1rem', padding: '10px', border:'1px solid #eee', borderRadius:'8px' }}>
                            <BCheckbox id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label={<span style={{marginBottom: 0, fontSize: '14px', cursor: 'pointer'}}>Item is Active (available in marketplace)</span>} />
                        </div>

                        <div className="form-actions">
                            <BButton type="button" variant="secondary" onClick={() => navigate('/admin/marketplace/manage')} disabled={isLoading}>
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

export default EditMarketplaceItem; 