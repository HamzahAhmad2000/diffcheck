import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfileAPI } from '../../services/apiClient';
import TagSelector from '../common/TagSelector';
import toast from 'react-hot-toast';
import '../../styles/Auth.css';
import '../../styles/account.css';

const SignupStep3Tags = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [tempAuthToken, setTempAuthToken] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('reg_temp_auth_token');
    if (!token) {
      toast.error("Session expired. Please start registration again.");
      navigate('/register');
    } else {
      setTempAuthToken(token);
      const currentTags = JSON.parse(localStorage.getItem('reg_tags') || '{}');
      if (currentTags.interests) {
        setSelectedTagIds(currentTags.interests);
      }
    }
  }, [navigate]);

  const fetchTags = useCallback(async () => {
    console.log('[SignupStep3Tags] Fetching tags...');
    setTagsLoading(true);
    try {
      const response = await userProfileAPI.adminGetProfileTags({ category: 'INTEREST' });
      const tags = response.data || response || [];
      console.log('[SignupStep3Tags] Fetched tags:', tags);
      setAvailableTags(Array.isArray(tags) ? tags : []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      toast.error("Could not load interest tags. Using sample tags.");
      setAvailableTags([
        { id: 'sample1', name: 'Gaming', category: 'INTEREST' },
        { id: 'sample2', name: 'Technology', category: 'INTEREST' },
        { id: 'sample3', name: 'Movies', category: 'INTEREST' },
      ]);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tempAuthToken) {
      fetchTags();
    }
  }, [tempAuthToken, fetchTags]);

  const handleSaveTags = useCallback(() => {
    console.log('[SignupStep3Tags] Saving tags:', selectedTagIds);
    if (!tempAuthToken) {
      toast.error("Session is invalid. Please restart registration.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const currentTags = JSON.parse(localStorage.getItem('reg_tags') || '{}');
      currentTags.interests = selectedTagIds;
      localStorage.setItem('reg_tags', JSON.stringify(currentTags));
      
      toast.success("Tags saved! Proceeding to the next step.");
      navigate('/register/step4');
    } catch (error) {
      console.error("Error saving tags:", error);
      toast.error("Failed to save tags. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [tempAuthToken, navigate, selectedTagIds]);
  
  const handleSkip = useCallback(() => {
    try {
      const currentTags = JSON.parse(localStorage.getItem('reg_tags') || '{}');
      currentTags.interests = [];
      localStorage.setItem('reg_tags', JSON.stringify(currentTags));
      toast.success("Skipped. Proceeding to the next step.");
      navigate('/register/step4');
    } catch (error) {
      console.error("Error skipping tags:", error);
      toast.error("Failed to skip. Please try again.");
    }
  }, [navigate]);

  if (!tempAuthToken || tagsLoading) {
    return <div className="auth-container">Loading session...</div>;
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2 className="auth-title">Step 3: What are you interested in?</h2>
        <p className="auth-subtitle">Choose tags that best describe your interests. This helps us personalize your experience.</p>

        <TagSelector
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
          onSave={handleSaveTags}
          onSkip={handleSkip}
          isLoading={isLoading}
          parentLoading={tagsLoading}
          title="Select Your Interests"
          saveButtonText="Save & Continue"
          skipButtonText="Skip for Now"
        />
      </div>
    </div>
  );
};

export default SignupStep3Tags; 