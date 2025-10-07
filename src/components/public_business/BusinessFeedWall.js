import React, { useState, useEffect, useCallback } from 'react';
import { publicBusinessAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './BusinessFeedWall.css';

const BusinessFeedWall = ({ businessId, feedWallBgColor, feedTextColor }) => {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchActivities = useCallback(async () => {
        if (!businessId) return;
        setIsLoading(true);
        try {
            const response = await publicBusinessAPI.getBusinessActivities(businessId, { limit: 15 });
            setActivities(response.data || []);
        } catch (error) {
            toast.error("Could not load business feed.");
            console.error("Error fetching business activities:", error);
        } finally {
            setIsLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getActivityIcon = (activityType) => {
        switch (activityType) {
            case 'SURVEY_PUBLISHED':
                return 'ri-survey-line';
            case 'QUEST_CREATED':
                return 'ri-map-pin-line';
            case 'CUSTOM_POST':
                return 'ri-chat-1-line';
            case 'BUG_REPORTED':
                return 'ri-bug-line';
            case 'FEATURE_REQUESTED':
                return 'ri-lightbulb-line';
            default:
                return 'ri-notification-3-line';
        }
    };
    
    const feedStyle = {
        backgroundColor: feedWallBgColor || '#f8f9fa',
        color: feedTextColor || '#212529'
    };
    
    const titleStyle = {
        color: feedTextColor || '#212529',
        borderBottom: `2px solid ${feedTextColor ? feedTextColor.replace(')', ', 0.3)').replace('rgb', 'rgba') : 'rgba(0,0,0,0.1)'}` 
    };

    const itemTextStyle = { color: feedTextColor || '#212529' };
    const itemTimestampStyle = { color: feedTextColor || '#212529', opacity: 0.75 };
    const itemIconStyle = { color: feedTextColor || '#212529' };

    return (
        <div className="business-feed-wall" style={feedStyle}>
            <h2 className="feed-wall-title" style={titleStyle}>Activity Feed</h2>
            {isLoading ? (
                <p className="feed-loading-text" style={itemTextStyle}>Loading feed...</p>
            ) : activities.length > 0 ? (
                <ul className="feed-list">
                    {activities.map(activity => (
                        <li key={activity.id} className="feed-item">
                            <div className="feed-item-icon-container">
                                <i className={`${getActivityIcon(activity.activity_type)} feed-item-icon`} style={itemIconStyle}></i>
                            </div>
                            <div className="feed-item-content">
                                <p className="feed-item-text" style={itemTextStyle}>
                                    <span className="feed-item-title">{activity.title}</span>
                                    {activity.description && (
                                        <span className="feed-item-description"> - {activity.description}</span>
                                    )}
                                </p>
                                <span className="feed-item-timestamp" style={itemTimestampStyle}>
                                    {formatTimestamp(activity.created_at)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="feed-no-activity-text" style={itemTextStyle}>No recent activity to display.</p>
            )}
        </div>
    );
};

export default BusinessFeedWall; 