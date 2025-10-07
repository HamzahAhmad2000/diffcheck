import React, { useState } from 'react';
import { questAPI, uploadAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './ScreenshotQuestInterface.css';

const ScreenshotQuestInterface = ({ quest, onClose, onComplete, user }) => {
    const [screenshots, setScreenshots] = useState([]);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [hasClickedLink, setHasClickedLink] = useState(false);
    const [proofText, setProofText] = useState('');

    const handleLinkClick = async () => {
        if (quest.target_url) {
            try {
                await questAPI.trackLinkClick(quest.id);
                setHasClickedLink(true);
                window.open(quest.target_url, '_blank');
                toast.success('Link visited! Now upload your screenshot to complete the quest.');
            } catch (error) {
                console.error('Error tracking link click:', error);
                window.open(quest.target_url, '_blank');
                setHasClickedLink(true);
            }
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setScreenshots(files);
    };

    const handleScreenshotUpload = async () => {
        if (screenshots.length === 0) {
            toast.error('Please upload at least one screenshot');
            return;
        }

        try {
            setUploadingProof(true);
            
            // Upload screenshots first
            const uploadedFiles = [];
            for (const file of screenshots) {
                try {
                    const uploadResult = await uploadAPI.uploadImage(file);
                    if (uploadResult.data && (uploadResult.data.image_url || uploadResult.data.file_url)) {
                        const resolvedUrl = uploadResult.data.image_url || uploadResult.data.file_url;
                        uploadedFiles.push({
                            name: file.name,
                            filename: file.name,
                            url: resolvedUrl,
                            size: file.size
                        });
                    }
                } catch (uploadError) {
                    console.error('Error uploading file:', uploadError);
                    toast.error(`Failed to upload ${file.name}`);
                    return;
                }
            }

            const proofData = {
                proof_type: 'SCREENSHOT',
                proof_files: uploadedFiles,
                proof_text: proofText,
                link_clicked: hasClickedLink
            };

            const result = await questAPI.submitProof(quest.id, proofData);
            if (result && result.data) {
                toast.success("Screenshot submitted! Status: Pending approval (up to 48 hours).");
                onComplete && onComplete();
                onClose();
            }
        } catch (error) {
            console.error('Error submitting proof:', error);
            toast.error('Failed to submit screenshot');
        } finally {
            setUploadingProof(false);
        }
    };

    const getQuestTypeIcon = () => {
        const type = quest.quest_type;
        if (!type) return '🎯';
        if (type.includes('TWITTER') || type.includes('X_')) return '🐦';
        if (type.includes('INSTAGRAM')) return '📷';
        if (type.includes('LINKEDIN')) return '💼';
        if (type.includes('YOUTUBE')) return '📺';
        if (type.includes('DISCORD')) return '🎮';
        if (type.includes('TELEGRAM')) return '💬';
        if (type.includes('SURVEY')) return '📋';
        if (type.includes('VISIT')) return '🔗';
        return '🎯';
    };

    return (
        <div className="screenshot-quest-overlay">
            <div className="screenshot-quest-container">
                {/* Header */}
                <div className="screenshot-quest-header">
                    <div className="screenshot-quest-title-section">
                        <span className="screenshot-quest-icon">{getQuestTypeIcon()}</span>
                        <div>
                            <h2 className="screenshot-quest-title">{quest.title}</h2>
                            <span className="screenshot-quest-type">{quest.quest_type?.replace(/_/g, ' ') || 'Screenshot Quest'}</span>
                        </div>
                    </div>
                    <button className="screenshot-quest-close" onClick={onClose}>×</button>
                </div>

                {/* Main Content */}
                <div className="screenshot-quest-content">
                    {/* Quest Description */}
                    <div className="screenshot-quest-description">
                        <p className="screenshot-quest-desc-text">
                            {quest.description || quest.screenshot_description || 
                            "Upload a screenshot to show you've completed the task. If it checks out, you'll be able to claim your XP—usually within 48 hours!"}
                        </p>
                    </div>

                    {/* XP Reward Display */}
                    <div className="screenshot-quest-reward">
                        <span className="screenshot-quest-xp">✨ {quest.xp_reward || 0} XP Reward</span>
                    </div>

                    {/* Step 1: Visit Link (if required) */}
                    {quest.target_url && (
                        <div className="screenshot-quest-step">
                            <div className="screenshot-quest-step-header">
                                <span className="screenshot-quest-step-number">1</span>
                                <h3 className="screenshot-quest-step-title">Visit the Target Link</h3>
                            </div>
                            <div className="screenshot-quest-link-container">
                                <p className="screenshot-quest-link-text">{quest.target_url}</p>
                                <button 
                                    className={`screenshot-quest-link-btn ${hasClickedLink ? 'visited' : ''}`}
                                    onClick={handleLinkClick}
                                >
                                    {hasClickedLink ? '✓ Visited' : '🔗 Visit Link'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Upload Screenshot */}
                    <div className="screenshot-quest-step">
                        <div className="screenshot-quest-step-header">
                            <span className="screenshot-quest-step-number">{quest.target_url ? '2' : '1'}</span>
                            <h3 className="screenshot-quest-step-title">Upload Screenshot</h3>
                        </div>
                        
                        <div className="screenshot-quest-upload-area">
                            <input
                                type="file"
                                id="screenshot-upload"
                                accept="image/*"
                                multiple
                                onChange={handleFileChange}
                                className="screenshot-quest-file-input"
                            />
                            <label htmlFor="screenshot-upload" className="screenshot-quest-upload-label">
                                <div className="screenshot-quest-upload-icon">📷</div>
                                <p className="screenshot-quest-upload-text">
                                    {screenshots.length > 0 
                                        ? `${screenshots.length} file(s) selected` 
                                        : 'Click to upload screenshot(s)'
                                    }
                                </p>
                                {screenshots.length > 0 && (
                                    <div className="screenshot-quest-file-list">
                                        {screenshots.map((file, index) => (
                                            <span key={index} className="screenshot-quest-file-name">
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Optional Notes */}
                        <div className="screenshot-quest-notes">
                            <textarea
                                placeholder="Add any additional notes (optional)"
                                value={proofText}
                                onChange={(e) => setProofText(e.target.value)}
                                className="screenshot-quest-notes-textarea"
                                rows={3}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            className="screenshot-quest-submit-btn"
                            onClick={handleScreenshotUpload}
                            disabled={screenshots.length === 0 || uploadingProof || (quest.target_url && !hasClickedLink)}
                        >
                            {uploadingProof ? 'Submitting...' : 'Submit Screenshot'}
                        </button>

                        {/* Approval Info */}
                        <div className="screenshot-quest-approval-info">
                            <span className="screenshot-quest-approval-icon">⏱️</span>
                            <span className="screenshot-quest-approval-text">
                                Screenshots are usually reviewed within 48 hours. If not reviewed, they'll be automatically approved.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScreenshotQuestInterface; 