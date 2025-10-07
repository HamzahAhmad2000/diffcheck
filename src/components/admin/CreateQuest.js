import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { questAPI, businessAPI, uploadAPI } from '../../services/apiClient';
import AdminLayout from '../layouts/AdminLayout';
import './AdminForms.css';
import '../../styles/CreateSurvey.css';
import { toast } from 'react-hot-toast';

const CreateQuest = ({ initialState = {} }) => {
  const navigate = useNavigate();
  
  // Extract business context from initialState
  const {
    businessId,
    businessName,
    fromBusinessManagement,
    editMode,
    questId,
    existingQuest
  } = initialState;

  // Get user role and user info from localStorage
  const userRole = localStorage.getItem('userRole');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userRole === 'super_admin';
  const isBusinessAdmin = userRole === 'business_admin';
  
  const [formData, setFormData] = useState({
    title: existingQuest?.title || '',
    description: existingQuest?.description || '',
    quest_type: existingQuest?.quest_type || '',
    image_url: existingQuest?.image_url || '',
    target_url: existingQuest?.target_url || '',
    target_data: existingQuest?.target_data || '',
    verification_method: existingQuest?.verification_method || 'CLICK_VERIFY',
    xp_reward: existingQuest?.xp_reward || 100,
    has_raffle_prize: existingQuest?.has_raffle_prize || false,
    raffle_prize_description: existingQuest?.raffle_prize_description || '',
    raffle_end_date: existingQuest?.raffle_end_date || '',
    max_completions: existingQuest?.max_completions || '',
    start_date: existingQuest?.start_date || '',
    end_date: existingQuest?.end_date || '',
    is_featured: existingQuest?.is_featured || false,
    business_id: businessId || existingQuest?.business_id || (isBusinessAdmin ? user.business_id : '')
  });

  const [questTypes, setQuestTypes] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    fetchQuestTypes();
    if (isSuperAdmin) {
      fetchBusinesses();
    } else if (isBusinessAdmin && user.business_id && !businessName) {
      // If business admin and we don't have business name from initialState, fetch it
      fetchUserBusiness();
    }
  }, []);

  const fetchQuestTypes = async () => {
    try {
      const response = await questAPI.getQuestTypes();
      setQuestTypes(response.data.quest_types || []);
    } catch (err) {
      console.error('Error fetching quest types:', err);
    }
  };

  const fetchBusinesses = async () => {
    try {
      const response = await businessAPI.listAll();
      setBusinesses(response.data.businesses || []);
    } catch (err) {
      console.error('Error fetching businesses:', err);
    }
  };

  const fetchUserBusiness = async () => {
    try {
      const response = await businessAPI.getDetails(user.business_id);
      const businessData = response.data;
      setBusinesses([businessData]); // Only show the user's business
    } catch (err) {
      console.error('Error fetching user business:', err);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (formData.title.length > 50) {
      newErrors.title = 'Title must be 50 characters or less';
    }

    if (!formData.quest_type) {
      newErrors.quest_type = 'Quest type is required';
    }

    if (!formData.target_url.trim()) {
      newErrors.target_url = 'Target URL is required';
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
        xp_reward: (isBusinessAdmin || fromBusinessManagement) ? 100 : parseInt(formData.xp_reward),
        max_completions: formData.max_completions ? parseInt(formData.max_completions) : null,
        business_id: formData.business_id || null,
        // Include screenshot description if verification method is screenshot
        screenshot_description: formData.verification_method === 'SCREENSHOT_VERIFY' ? 
          formData.screenshot_description : null
      };

      if (fromBusinessManagement && businessId) {
        // Business admin context - use business quest API
        if (editMode && questId) {
          await questAPI.updateBusinessQuest(businessId, questId, questData);
        } else {
          await questAPI.createBusinessQuest(businessId, questData);
        }
        
        // Navigate back to business quest management page
        navigate(`/admin/business/${businessId}/quests`);
      } else {
        // Super admin context - use admin quest API
        if (editMode && questId) {
          await questAPI.adminUpdateQuest(questId, questData);
        } else {
          await questAPI.adminCreateQuest(questData);
        }
        
        // Navigate back to admin quests management page
        navigate('/admin/quests');
      }
    } catch (err) {
      console.error('Error saving quest:', err);
      setErrors({ submit: err.response?.data?.error || 'Failed to save quest' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (fromBusinessManagement && businessId) {
      navigate(`/admin/business/${businessId}/quests`);
    } else {
      navigate('/admin/quests');
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
      // For business admin, exclude Internal and Eclipseer quest types
      if (isBusinessAdmin || fromBusinessManagement) {
        const excludedTypes = ['INTERNAL', 'ECLIPSEER'];
        const isExcluded = excludedTypes.some(excluded => 
          type.value.includes(excluded) || type.category.includes(excluded)
        );
        if (isExcluded) return;
      }
      
      if (!categories[type.category]) {
        categories[type.category] = [];
      }
      categories[type.category].push(type);
    });
    return categories;
  };

  const questTypeCategories = getQuestTypesByCategory();

  // Determine if business selection should be shown and what options to display
  const shouldShowBusinessSelection = () => {
    // Don't show business selection if coming from business management (business is already determined)
    if (fromBusinessManagement && businessId) {
      return false;
    }
    
    // Show for super admin (they can choose any business or platform-wide)
    if (isSuperAdmin) {
      return true;
    }
    
    // Don't show for business admin (they can only create for their business)
    return false;
  };

  const getBusinessDisplayName = () => {
    if (fromBusinessManagement && businessName) {
      return businessName;
    }
    
    if (isBusinessAdmin && businesses.length > 0) {
      return businesses[0].name;
    }
    
    return 'Unknown Business';
  };

  // Simplified verification methods for business admin
  const getVerificationMethods = () => {
    if (isBusinessAdmin || fromBusinessManagement) {
      return [
        { value: 'CLICK_VERIFY', label: 'Open Link' },
        { value: 'SCREENSHOT_VERIFY', label: 'Screenshot Upload' }
      ];
    } else {
      return [
        { value: 'CLICK_VERIFY', label: 'Click to Verify' },
        { value: 'SCREENSHOT_VERIFY', label: 'Screenshot Upload' },
        { value: 'AUTOMATIC', label: 'Automatic' },
        { value: 'MANUAL_REVIEW', label: 'Manual Review' }
      ];
    }
  };

  const verificationMethods = getVerificationMethods();

  return (
    <AdminLayout>
      <div className="survey-management">
        <div className="create-content">
          <div className="create-header">
            <div>
              <h1 className="create-title">
                <i className="ri-treasure-map-line" style={{ marginRight: '12px' }}></i>
                {editMode ? 'Edit Quest' : 'Create New Quest'}
                {(fromBusinessManagement || isBusinessAdmin) && (
                  <span style={{ fontSize: '16px', color: '#888', fontWeight: 'normal', marginLeft: '10px' }}>
                    for {getBusinessDisplayName()}
                  </span>
                )}
              </h1>
              <p style={{ color: '#666', fontSize: '14px', margin: '0' }}>
                {editMode ? 'Update quest details and settings' : 'Design engaging quests to drive user participation and engagement'}
              </p>
            </div>

          </div>

          <form onSubmit={handleSubmit} className="quest-creation-form">
            {errors.submit && (
              <div className="ai-generated-badge" style={{ backgroundColor: '#ffe6e6', borderColor: '#ff4444' }}>
                <i className="ri-error-warning-line" style={{ color: '#ff4444' }}></i>
                <span style={{ color: '#ff4444' }}>{errors.submit}</span>
              </div>
            )}

            {/* Basic Information */}
            <div className="question-bank" style={{ marginBottom: '30px' }}>
              <div className="question-bank-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <i className="ri-information-line" style={{ color: '#aa3eff' }}></i>
                Basic Information
              </div>
              
              <div className="create-input-container">
                <label className="create-input-label">
                  Quest Title *
                  <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                    (Max 50 characters)
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`survey-input ${errors.title ? 'error' : ''}`}
                  placeholder="Enter an engaging quest title..."
                  maxLength={50}
                />
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  {formData.title.length}/50 characters
                </div>
                {errors.title && <div className="error-message">{errors.title}</div>}
              </div>

              <div className="create-input-container">
                <label className="create-input-label">Quest Type *</label>
                <select
                  value={formData.quest_type}
                  onChange={(e) => handleInputChange('quest_type', e.target.value)}
                  className={`survey-input ${errors.quest_type ? 'error' : ''}`}
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
                {errors.quest_type && <div className="error-message">{errors.quest_type}</div>}
              </div>

              <div className="create-input-container">
                <label className="create-input-label">Target URL *</label>
                <input
                  type="url"
                  value={formData.target_url}
                  onChange={(e) => handleInputChange('target_url', e.target.value)}
                  className={`survey-input ${errors.target_url ? 'error' : ''}`}
                  placeholder="https://example.com/page-to-visit"
                />
                {errors.target_url && <div className="error-message">{errors.target_url}</div>}
              </div>

              <div className="create-input-container">
                <label className="create-input-label">Verification Method</label>
                <select
                  value={formData.verification_method}
                  onChange={(e) => handleInputChange('verification_method', e.target.value)}
                  className="survey-input"
                >
                  {verificationMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.verification_method === 'SCREENSHOT_VERIFY' && (
                <div className="create-input-container">
                  <label className="create-input-label">Screenshot Instructions</label>
                  <textarea
                    value={formData.screenshot_description || "Upload a screenshot to show you've completed the task. If it checks out, you'll be able to claim your XP—usually within 48 hours!"}
                    onChange={(e) => handleInputChange('screenshot_description', e.target.value)}
                    className="survey-textarea"
                    rows={3}
                  />
                  <div className="ai-generated-badge" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', marginTop: '10px' }}>
                    <i className="ri-time-line" style={{ color: '#856404' }}></i>
                    <span style={{ color: '#856404' }}>
                      Screenshots will automatically be approved after 48 hours if not manually reviewed.
                    </span>
                  </div>
                </div>
              )}

              {shouldShowBusinessSelection() && (
                <div className="create-input-container">
                  <label className="create-input-label">Business Assignment</label>
                  <select
                    value={formData.business_id}
                    onChange={(e) => handleInputChange('business_id', e.target.value)}
                    className="survey-input"
                  >
                    <option value="">Platform-wide Quest (Super Admin)</option>
                    {businesses.map(business => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!shouldShowBusinessSelection() && isBusinessAdmin && (
                <>
                  <div className="ai-generated-badge" style={{ backgroundColor: '#e6f3ff', borderColor: '#0066cc' }}>
                    <i className="ri-information-line" style={{ color: '#0066cc' }}></i>
                    <span style={{ color: '#0066cc' }}>
                      This quest will be created for your business: {getBusinessDisplayName()}
                    </span>
                  </div>
                  <div className="ai-generated-badge" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', marginTop: '10px' }}>
                    <i className="ri-time-line" style={{ color: '#856404' }}></i>
                    <span style={{ color: '#856404' }}>
                      Quest will be pending approval. Super admin must approve before it's published.
                    </span>
                  </div>
                </>
            )}
          </div>

          {/* Image Upload Section */}
          <div className="question-bank" style={{ marginBottom: '30px' }}>
            <div className="question-bank-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <i className="ri-image-line" style={{ color: '#aa3eff' }}></i>
              Quest Images
            </div>
            
            {/* Main Quest Image */}
            <div className="create-input-container">
              <label className="create-input-label">Quest Image (Optional)</label>
              <div className="image-upload-section">
                {formData.image_url ? (
                  <div className="image-preview">
                    <img 
                      src={formData.image_url.startsWith('http') ? formData.image_url : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${formData.image_url}`}
                      alt="Quest preview" 
                      style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <button 
                      type="button"
                      onClick={handleRemoveImage}
                      className="remove-image-btn"
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
                ) : (
                  <div className="image-upload-area" style={{
                    border: '2px dashed #ccc',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleImageUpload(file);
                      }}
                      style={{ display: 'none' }}
                      id="quest-image-upload"
                    />
                    <label htmlFor="quest-image-upload" style={{ cursor: 'pointer', display: 'block' }}>
                      {imageUploading ? (
                        <div>
                          <i className="ri-loader-2-line spinning" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                          <p>Uploading...</p>
                        </div>
                      ) : (
                        <div>
                          <i className="ri-image-add-line" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                          <p>Click to upload quest image</p>
                          <small style={{ color: '#666' }}>PNG, JPG, GIF up to 10MB</small>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* XP Reward - Only for Super Admin */}
            {isSuperAdmin && !fromBusinessManagement && (
              <div className="question-bank" style={{ marginBottom: '30px' }}>
                <div className="question-bank-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <i className="ri-trophy-line" style={{ color: '#aa3eff' }}></i>
                  Rewards & Gamification
                </div>
                
                <div className="create-input-container">
                  <label className="create-input-label">XP Reward *</label>
                  <input
                    type="number"
                    value={formData.xp_reward}
                    onChange={(e) => handleInputChange('xp_reward', e.target.value)}
                    min="0"
                    className={`survey-input ${errors.xp_reward ? 'error' : ''}`}
                    placeholder="Enter XP points to award"
                  />
                  {errors.xp_reward && <div className="error-message">{errors.xp_reward}</div>}
                </div>

                <div className="create-input-container">
                  <label className="togglenew-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.has_raffle_prize}
                        onChange={(e) => handleInputChange('has_raffle_prize', e.target.checked)}
                      />
                      <span className="togglenew-slider"></span>
                    </div>
                    Enable Raffle Prize
                  </label>
                </div>

                {formData.has_raffle_prize && (
                  <div className="ai-generated-badge" style={{ marginBottom: '20px' }}>
                    <i className="ri-gift-line"></i>
                    <span>Raffle prize is enabled - configure the details below</span>
                  </div>
                )}

                {formData.has_raffle_prize && (
                  <>
                    <div className="create-input-container">
                      <label className="create-input-label">Raffle Prize Description *</label>
                      <textarea
                        value={formData.raffle_prize_description}
                        onChange={(e) => handleInputChange('raffle_prize_description', e.target.value)}
                        className={`survey-textarea ${errors.raffle_prize_description ? 'error' : ''}`}
                        placeholder="Describe the amazing raffle prize in detail..."
                        rows={3}
                      />
                      {errors.raffle_prize_description && <div className="error-message">{errors.raffle_prize_description}</div>}
                    </div>

                    <div className="create-input-container">
                      <label className="create-input-label">Raffle End Date *</label>
                      <input
                        type="datetime-local"
                        value={formData.raffle_end_date}
                        onChange={(e) => handleInputChange('raffle_end_date', e.target.value)}
                        className={`survey-datepicker ${errors.raffle_end_date ? 'error' : ''}`}
                      />
                      {errors.raffle_end_date && <div className="error-message">{errors.raffle_end_date}</div>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Business Admin gets default 100 XP */}
            {(isBusinessAdmin || fromBusinessManagement) && (
              <div className="ai-generated-badge" style={{ backgroundColor: '#e6f3ff', borderColor: '#0066cc', marginBottom: '30px' }}>
                <i className="ri-trophy-line" style={{ color: '#0066cc' }}></i>
                <span style={{ color: '#0066cc' }}>
                  XP Reward: 100 XP (default for business quests)
                </span>
              </div>
            )}

            {/* Scheduling & Limits - Only for Super Admin */}
            {isSuperAdmin && !fromBusinessManagement && (
              <div className="question-bank" style={{ marginBottom: '30px' }}>
                <div className="question-bank-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <i className="ri-calendar-line" style={{ color: '#aa3eff' }}></i>
                  Scheduling & Limits
                </div>
                
                <div className="settings-row">
                  <div className="settings-field-third">
                    <label className="create-input-label">Start Date</label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => handleInputChange('start_date', e.target.value)}
                      className="survey-datepicker"
                    />
                  </div>

                  <div className="settings-field-third">
                    <label className="create-input-label">End Date</label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => handleInputChange('end_date', e.target.value)}
                      className={`survey-datepicker ${errors.end_date ? 'error' : ''}`}
                    />
                    {errors.end_date && <div className="error-message">{errors.end_date}</div>}
                  </div>
                </div>

                <div className="create-input-container">
                  <label className="create-input-label">Max Completions (Optional)</label>
                  <input
                    type="number"
                    value={formData.max_completions}
                    onChange={(e) => handleInputChange('max_completions', e.target.value)}
                    min="1"
                    placeholder="Leave empty for unlimited completions"
                    className={`survey-input ${errors.max_completions ? 'error' : ''}`}
                  />
                  {errors.max_completions && <div className="error-message">{errors.max_completions}</div>}
                </div>

                <div className="create-input-container">
                  <label className="togglenew-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                      />
                      <span className="togglenew-slider"></span>
                    </div>
                    Feature this quest prominently
                  </label>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="newsave-button-container">

              <button 
                type="submit" 
                disabled={loading} 
                className={`newsave-button ${loading ? 'save-button--disabled' : ''}`}
              >
                {loading ? (
                  <>
                    <i className="ri-loader-2-line spinning" style={{ marginRight: '8px' }}></i>
                    {editMode ? 'Updating Quest...' : 'Creating Quest...'}
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" style={{ marginRight: '8px' }}></i>
                    {editMode ? 'Update Quest' : 'Create Quest'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
};

export default CreateQuest; 