import React, { useState, useEffect } from 'react';
import { questAPI, businessAPI, uploadAPI } from '../../services/apiClient';
import './AdminForms.css';
import { toast } from 'react-hot-toast';

const EditQuest = ({ quest, questTypes, onSuccess, onCancel, isAdmin = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quest_type: '',
    image_url: '',
    target_url: '',
    target_data: '',
    verification_method: 'CLICK_VERIFY',
    xp_reward: 100,
    has_raffle_prize: false,
    raffle_prize_description: '',
    raffle_end_date: '',
    max_completions: '',
    start_date: '',
    end_date: '',
    is_featured: false,
    business_id: ''
  });

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (quest) {
      populateFormData();
    }
    if (isAdmin) {
      fetchBusinesses();
    }
  }, [quest, isAdmin]);

  const populateFormData = () => {
    setFormData({
      title: quest.title || '',
      description: quest.description || '',
      quest_type: quest.quest_type || '',
      image_url: quest.image_url || '',
      target_url: quest.target_url || '',
      target_data: quest.target_data || '',
      verification_method: quest.verification_method || 'CLICK_VERIFY',
      xp_reward: quest.xp_reward || 100,
      has_raffle_prize: quest.has_raffle_prize || false,
      raffle_prize_description: quest.raffle_prize_description || '',
      raffle_end_date: quest.raffle_end_date ? formatDateForInput(quest.raffle_end_date) : '',
      max_completions: quest.max_completions || '',
      start_date: quest.start_date ? formatDateForInput(quest.start_date) : '',
      end_date: quest.end_date ? formatDateForInput(quest.end_date) : '',
      is_featured: quest.is_featured || false,
      business_id: quest.business_id || ''
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  };

  const fetchBusinesses = async () => {
    try {
      const response = await businessAPI.listAll();
      setBusinesses(response.data.businesses || []);
    } catch (err) {
      console.error('Error fetching businesses:', err);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.quest_type) {
      newErrors.quest_type = 'Quest type is required';
    }

    if (!formData.xp_reward || formData.xp_reward < 0) {
      newErrors.xp_reward = 'XP reward must be a positive number';
    }

    if (formData.has_raffle_prize && !formData.raffle_prize_description.trim()) {
      newErrors.raffle_prize_description = 'Raffle prize description is required when raffle is enabled';
    }

    if (formData.has_raffle_prize && !formData.raffle_end_date) {
      newErrors.raffle_end_date = 'Raffle end date is required when raffle is enabled';
    }

    if (formData.start_date && formData.end_date && new Date(formData.start_date) >= new Date(formData.end_date)) {
      newErrors.end_date = 'End date must be after start date';
    }

    if (formData.max_completions && formData.max_completions < 1) {
      newErrors.max_completions = 'Max completions must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const questData = {
        ...formData,
        xp_reward: parseInt(formData.xp_reward),
        max_completions: formData.max_completions ? parseInt(formData.max_completions) : null,
        business_id: formData.business_id || null
      };

      if (isAdmin) {
        await questAPI.adminUpdateQuest(quest.id, questData);
      } else {
        await questAPI.updateBusinessQuest(quest.business_id, quest.id, questData);
      }

      onSuccess();
    } catch (err) {
      console.error('Error updating quest:', err);
      setErrors({ submit: err.response?.data?.error || 'Failed to update quest' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      setImageUploading(true);
      const response = await uploadAPI.uploadImage(file);
      
      if (response.data && response.data.image_url) {
        setFormData(prev => ({ ...prev, image_url: response.data.image_url }));
        setImageFile(file);
        toast.success('Quest image uploaded successfully!');
      } else {
        throw new Error('No image URL returned from server');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Failed to upload quest image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

  const getQuestTypesByCategory = () => {
    const categories = {};
    questTypes.forEach(type => {
      if (!categories[type.category]) {
        categories[type.category] = [];
      }
      categories[type.category].push(type);
    });
    return categories;
  };

  const questTypeCategories = getQuestTypesByCategory();

  return (
    <div className="admin-form-container">
      <div className="admin-form-header">
        <h3>Edit Quest: {quest?.title}</h3>
        <button className="close-btn" onClick={onCancel}>×</button>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        {errors.submit && (
          <div className="error-message">{errors.submit}</div>
        )}

        {/* Quest Status Info */}
        <div className="form-section">
          <h4>Quest Status</h4>
          <div className="status-info">
            <span className={`status-badge ${quest?.is_published ? 'published' : 'draft'}`}>
              {quest?.is_published ? 'Published' : 'Draft'}
            </span>
            {quest?.is_featured && (
              <span className="status-badge featured">Featured</span>
            )}
            {quest?.is_archived && (
              <span className="status-badge archived">Archived</span>
            )}
            <span className="completion-info">
              {quest?.completion_count || 0} completions
            </span>
          </div>
        </div>

        {/* Basic Information */}
        <div className="form-section">
          <h4>Basic Information</h4>
          
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={errors.title ? 'error' : ''}
              placeholder="Enter quest title..."
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the quest objectives and instructions..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Quest Type *</label>
            <select
              value={formData.quest_type}
              onChange={(e) => handleInputChange('quest_type', e.target.value)}
              className={errors.quest_type ? 'error' : ''}
            >
              <option value="">Select quest type...</option>
              {Object.entries(questTypeCategories).map(([category, types]) => (
                <optgroup key={category} label={category}>
                  {types.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.quest_type && <span className="error-text">{errors.quest_type}</span>}
          </div>

          {isAdmin && (
            <div className="form-group">
              <label>Business (Optional)</label>
              <select
                value={formData.business_id}
                onChange={(e) => handleInputChange('business_id', e.target.value)}
              >
                <option value="">Super Admin Quest</option>
                {businesses.map(business => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quest Configuration */}
        <div className="form-section">
          <h4>Quest Configuration</h4>
          
          <div className="form-group">
            <label>Target URL</label>
            <input
              type="url"
              value={formData.target_url}
              onChange={(e) => handleInputChange('target_url', e.target.value)}
              placeholder="https://example.com/page-to-visit"
            />
          </div>

          <div className="form-group">
            <label>Target Data (JSON)</label>
            <textarea
              value={formData.target_data}
              onChange={(e) => handleInputChange('target_data', e.target.value)}
              placeholder='{"username": "@example", "post_id": "123"}'
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Verification Method</label>
            <select
              value={formData.verification_method}
              onChange={(e) => handleInputChange('verification_method', e.target.value)}
            >
              <option value="CLICK_VERIFY">Click to Verify</option>
              <option value="SCREENSHOT">Screenshot Upload</option>
              <option value="AUTOMATIC">Automatic</option>
              <option value="MANUAL_REVIEW">Manual Review</option>
            </select>
          </div>
        </div>

        {/* Rewards & Gamification */}
        <div className="form-section">
          <h4>Rewards & Gamification</h4>
          
          <div className="form-group">
            <label>XP Reward *</label>
            <input
              type="number"
              value={formData.xp_reward}
              onChange={(e) => handleInputChange('xp_reward', e.target.value)}
              min="0"
              className={errors.xp_reward ? 'error' : ''}
            />
            {errors.xp_reward && <span className="error-text">{errors.xp_reward}</span>}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.has_raffle_prize}
                onChange={(e) => handleInputChange('has_raffle_prize', e.target.checked)}
              />
              Enable Raffle Prize
            </label>
          </div>

          {formData.has_raffle_prize && (
            <>
              <div className="form-group">
                <label>Raffle Prize Description *</label>
                <textarea
                  value={formData.raffle_prize_description}
                  onChange={(e) => handleInputChange('raffle_prize_description', e.target.value)}
                  className={errors.raffle_prize_description ? 'error' : ''}
                  placeholder="Describe the raffle prize..."
                  rows={2}
                />
                {errors.raffle_prize_description && <span className="error-text">{errors.raffle_prize_description}</span>}
              </div>

              <div className="form-group">
                <label>Raffle End Date *</label>
                <input
                  type="datetime-local"
                  value={formData.raffle_end_date}
                  onChange={(e) => handleInputChange('raffle_end_date', e.target.value)}
                  className={errors.raffle_end_date ? 'error' : ''}
                />
                {errors.raffle_end_date && <span className="error-text">{errors.raffle_end_date}</span>}
              </div>
            </>
          )}
        </div>

        {/* Scheduling & Limits */}
        <div className="form-section">
          <h4>Scheduling & Limits</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                className={errors.end_date ? 'error' : ''}
              />
              {errors.end_date && <span className="error-text">{errors.end_date}</span>}
            </div>
          </div>

          <div className="form-group">
            <label>Max Completions (Optional)</label>
            <input
              type="number"
              value={formData.max_completions}
              onChange={(e) => handleInputChange('max_completions', e.target.value)}
              min="1"
              placeholder="Leave empty for unlimited"
              className={errors.max_completions ? 'error' : ''}
            />
            {errors.max_completions && <span className="error-text">{errors.max_completions}</span>}
          </div>
        </div>

        {/* Media & Visual */}
        <div className="form-section">
          <h4>Media & Visual</h4>
          
          {/* Main Quest Image */}
          <div className="form-group">
            <label>Quest Image</label>
            <div className="image-upload-section">
              {formData.image_url ? (
                <div className="image-preview" style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
                  <img 
                    src={formData.image_url.startsWith('http') ? formData.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${formData.image_url}`}
                    alt="Quest preview" 
                    style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <button 
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: 'rgba(255, 0, 0, 0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '25px',
                      height: '25px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleImageUpload(file);
                  }}
                  style={{ display: 'none' }}
                  id="quest-image-upload-edit"
                />
                <label htmlFor="quest-image-upload-edit" className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', display: 'inline-block' }}>
                  {imageUploading ? 'Uploading...' : (formData.image_url ? 'Change Image' : 'Upload Image')}
                </label>
              </div>
              
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => handleInputChange('image_url', e.target.value)}
                placeholder="Or enter image URL directly"
                style={{ width: '100%' }}
              />
            </div>
          </div>


          {isAdmin && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                />
                Feature this quest
              </label>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Updating...' : 'Update Quest'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditQuest; 