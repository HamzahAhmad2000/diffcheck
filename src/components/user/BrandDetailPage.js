import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicBusinessAPI, itemAPI, baseURL, discordAPI, questAPI, ideaAPI, uploadAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './BrandDetailPage.css';
import './CoCreatePage.css';
import ScreenshotQuestInterface from '../quests/ScreenshotQuestInterface';

const BrandDetailPage = () => {
    const { businessId } = useParams();
    const navigate = useNavigate();
    const [business, setBusiness] = useState(null);
    const [surveys, setSurveys] = useState([]);
    const [quests, setQuests] = useState([]);
    const [completedQuests, setCompletedQuests] = useState(new Set());
    const [topBugs, setTopBugs] = useState([]);
    const [topFeatures, setTopFeatures] = useState([]);
    const [topIdeas, setTopIdeas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [discordAccessCache, setDiscordAccessCache] = useState({});
    const [logoLoaded, setLogoLoaded] = useState(false);
    const [pendingQuests, setPendingQuests] = useState(new Set());
    const [selectedScreenshotQuest, setSelectedScreenshotQuest] = useState(null);
    const [showIdeaSubmissionModal, setShowIdeaSubmissionModal] = useState(false);
    // Layout configuration (mirrors admin editor)
    const TEMPLATE_MAP = {
        1: { cols: [1,2,1], splits: [false,true,true] },
        2: { cols: [1,2,1], splits: [false,false,true] },
        3: { cols: [3,1], splits: [false,true] },
        4: { cols: [3,1], splits: [false,false] },
        5: { cols: [1,3], splits: [false,false] },
        6: { cols: [4], splits: [false] },
        7: { cols: [1,2,1], splits: [false,false,false] },   // s m s no split
        8: { cols: [1,2,1], splits: [false,true,false] },    // s m(split) s
        9: { cols: [2,2], splits: [false,false] },           // m m no split
        10:{ cols: [2,2], splits: [true,true] },             // m(split) m(split)
    };
    const DEFAULT_BLOCKS = ['SURVEYS','QUESTS','REPORT_FORM','BUGS_LIST','FEATURES_LIST'];

    // Detect user theme context
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || localStorage.getItem('userRole') || 'user';
    const isAdminContext = userRole === 'admin' || userRole === 'super_admin';
    
    // Force dark theme for user context in BrandDetailPage (this is user-facing content)
    const themeClass = 'brand-detail-dark-theme';

    const refreshTopIdeas = useCallback(async () => {
        try {
            const response = await ideaAPI.getTopIdeas(businessId, 5);
            setTopIdeas(response?.data || []);
        } catch (error) {
            console.error('Error refreshing top ideas:', error);
        }
    }, [businessId]);

    useEffect(() => {
        fetchBusinessData();
        setLogoLoaded(false); // Reset logo loading state when business changes
    }, [businessId]);

    // Debug logging
    useEffect(() => {
        if (business) {
            console.log('BrandDetailPage Debug:', {
                businessId,
                business,
                surveysCount: surveys.length,
                questsCount: quests.length,
                bugsCount: topBugs.length,
                featuresCount: topFeatures.length,
                ideasCount: topIdeas.length,
                discordAccessCache
            });
        }
    }, [business, surveys, quests, topBugs, topFeatures, topIdeas, businessId, discordAccessCache]);

    const checkDiscordAccess = async (surveyId) => {
        try {
            const response = await discordAPI.checkSurveyAccess(surveyId);
            return response.data;
        } catch (error) {
            console.error(`Error checking Discord access for survey ${surveyId}:`, error);
            return { has_access: false, reason: 'Error checking access' };
        }
    };

    const fetchBusinessData = async () => {
        try {
            setLoading(true);
            setError(null);
            const businessIdNum = parseInt(businessId);
            
            const businessResponse = await publicBusinessAPI.getBusinessDetails(businessId);
            
            if (businessResponse.data) {
                setBusiness(businessResponse.data);
            } else {
                setError('Business not found');
                return;
            }

            // Fetch all related data
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = userData?.id;
            
            const [surveysResponse, itemsResponse, questsResponse, completionsResponse, ideasResponse] = await Promise.allSettled([
                publicBusinessAPI.getBusinessSurveys(businessIdNum),
                itemAPI.listItemsForBusiness(businessIdNum, { sort: 'votes', admin_view: false }),
                questAPI.getAvailableQuests({ business_id: businessIdNum }),
                userId ? questAPI.getUserQuestCompletions(userId) : Promise.resolve({ data: { completions: [] } }),
                ideaAPI.getTopIdeas(businessIdNum, 5)
            ]);

            // Process responses...
            const surveysData = surveysResponse.status === 'fulfilled' ? surveysResponse.value.data?.surveys || [] : [];
            setSurveys(surveysData);

            const itemsData = itemsResponse.status === 'fulfilled' ? itemsResponse.value.data?.items || [] : [];
            const bugs = itemsData.filter(item => item.item_type === 'BUG');
            const features = itemsData.filter(item => item.item_type === 'FEATURE');
            setTopBugs(bugs.slice(0, 5));
            setTopFeatures(features.slice(0, 5));

            const questsData = questsResponse.status === 'fulfilled' ? questsResponse.value?.data?.quests || [] : [];
            const publishedQuests = questsData.filter(q => q.is_published !== false);
            setQuests(publishedQuests);
            
            const ideasData = ideasResponse.status === 'fulfilled' ? ideasResponse.value.data || [] : [];
            setTopIdeas(ideasData);

            const completionsData = completionsResponse.status === 'fulfilled' ? completionsResponse.value.data?.completions || [] : [];
            const verified = completionsData.filter(c => c.verification_status === 'VERIFIED' || c.xp_status === 'AWARDED');
            const pending = completionsData.filter(c => (c.verification_status === 'PENDING' || c.xp_status === 'PENDING') && !(c.verification_status === 'VERIFIED' || c.xp_status === 'AWARDED'));
            const completedIds = new Set(verified.map(q => q.quest_id || q.id));
            const pendingIds = new Set(pending.map(q => q.quest_id || q.id));
            setCompletedQuests(completedIds);
            setPendingQuests(pendingIds);

            // Check Discord access for surveys
            const discordCache = {};
            for (const survey of surveysData) {
                if (survey.audience_settings?.discord_roles_allowed?.length > 0) {
                    const discordAccess = await checkDiscordAccess(survey.id);
                    discordCache[survey.id] = discordAccess;
                }
            }
            setDiscordAccessCache(discordCache);

        } catch (err) {
            console.error('Error fetching business data:', err);
            setError('Failed to load business data');
        } finally {
            setLoading(false);
        }
    };

    const handleLinkDiscord = () => {
        discordAPI.initiateOAuth();
    };

    // Helper function to construct logo URL with cache busting
    const getLogoUrl = (logoUrl) => {
        if (!logoUrl) return '/image.png';
    
        let fullUrl = logoUrl;
        
        // If it's a relative path, construct the full URL
        if (!logoUrl.startsWith('http')) {
            const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
            fullUrl = `${baseURL}${path}`;
        }
        
        // Add a cache-busting query parameter
        return `${fullUrl}?v=${new Date().getTime()}`;
    };

    if (loading) {
        return (
            <div className={`brand-detail-loading ${themeClass}`}>
                <div className="user-loading-indicator">
                    <div className="user-loading-spinner"></div>
                    <p>Loading Brand Details...</p>
                </div>
            </div>
        );
    }

    if (!business) {
        return (
            <div className={`brand-detail-error ${themeClass}`}>
                <h2>Business Not Found</h2>
                <button onClick={() => navigate('/user/brands')}>Back to Brands</button>
            </div>
        );
    }

    const discordRestrictedSurveys = surveys.filter(s => 
        s.audience_settings?.discord_roles_allowed?.length > 0 && 
        discordAccessCache[s.id]?.has_access === false
    );

    const hasCustomLayout = Boolean((business?.splash_template) || (Array.isArray(business?.splash_blocks) && business.splash_blocks.length > 0));

    const renderLayout = () => {
        const tpl = business.splash_template || 3;
        const def = TEMPLATE_MAP[tpl] || TEMPLATE_MAP[3];
        // Expand blocks into slots
        const slotCount = def.splits.reduce((acc, split) => acc + (split ? 2 : 1), 0);
        const blocks = Array.isArray(business.splash_blocks) ? business.splash_blocks.slice(0, slotCount) : [];
        const filled = new Array(slotCount).fill(null).map((_,i)=> blocks[i] || DEFAULT_BLOCKS[i] || null);

        // Build columns with consistent two rows. Unsplit columns span both rows.
        let cursor = 0;
        const columns = def.splits.map((split, idx) => {
            if (split) {
                const top = filled[cursor++];
                const bottom = filled[cursor++];
                return { width: def.cols[idx], parts: [{key: top, span: 1}, {key: bottom, span: 1}] };
            }
            const single = filled[cursor++];
            return { width: def.cols[idx], parts: [{key: single, span: 2}] };
        });

        const totalUnits = 4; // fixed 4-unit grid as per spec
        const ctx = {
            surveys,
            quests,
            topBugs,
            topFeatures,
            topIdeas,
            completedQuests,
            pendingQuests,
            fetchBusinessData,
            businessId,
            isAdminContext,
            discordAccessCache,
            setSelectedScreenshotQuest,
            navigate
        };

        // Flatten into absolute grid items over a 4-column, 2-row grid
        const items = [];
        let startUnit = 1;
        columns.forEach((col, colIdx) => {
            const colSpan = def.cols[colIdx];
            if (col.parts.length === 2) {
                // split column: two items one per row
                items.push({ row: 1, colStart: startUnit, colSpan, rowSpan: 1, key: col.parts[0].key, units: colSpan });
                items.push({ row: 2, colStart: startUnit, colSpan, rowSpan: 1, key: col.parts[1].key, units: colSpan });
            } else if (col.parts.length === 1) {
                items.push({ row: 1, colStart: startUnit, colSpan, rowSpan: 2, key: col.parts[0].key, units: colSpan });
            }
            startUnit += colSpan;
        });

        // Set explicit row heights to maintain visual balance (e.g., 400px each) but responsive
        const rowHeight = 'minmax(280px, auto)';
        return (
            <div className="brand-content-grid-generic" style={{ display: 'grid', gridTemplateColumns: `repeat(${totalUnits}, 1fr)`, gridTemplateRows: `repeat(2, ${rowHeight})`, gap: '16px' }}>
                {items.map((it, idx) => (
                    <div key={idx} className="brand-block scrollable-panel" style={{ gridColumn: `${it.colStart} / span ${it.colSpan}`, gridRow: `${it.row} / span ${it.rowSpan}` }}>
                        {it.key === 'SURVEYS' && (<h2>Surveys</h2>)}
                        {it.key === 'QUESTS' && (<h2>Top Quests</h2>)}
                        {it.key === 'BUGS_LIST' && (<h2>Top Bugs</h2>)}
                        {it.key === 'FEATURES_LIST' && (<h2>Top Features</h2>)}
                        {renderSection(it.key, ctx, it.units)}
                    </div>
                ))}
            </div>
        );
    };

    const renderLegacyLayout = () => (
        <div className="brand-content-grid">
            <div className="left-panel scrollable-panel">
                <h2>Surveys</h2>
                <div className="surveys-list">
                    {surveys.length > 0 ? (
                        surveys.map(survey => (
                            <SurveyCard 
                                key={survey.id} 
                                survey={survey} 
                                discordStatus={discordAccessCache[survey.id]}
                            />
                        ))
                    ) : (
                        <div className="empty-message"><p>No surveys available</p></div>
                    )}
                </div>
                {surveys.length > 5 && (
                    <button className="view-more-btn">View More Surveys</button>
                )}
            </div>

            <div className="center-panel">
                <div className="quests-section">
                    <h2>Top Quests</h2>
                <div className="quests-grid">
                        {quests.length > 0 ? (
                            quests.slice(0, 4).map(quest => (
                                <QuestCard 
                                    key={quest.id} 
                                    quest={quest} 
                                isCompleted={completedQuests.has(quest.id)}
                                isPending={pendingQuests.has(quest.id)}
                                onQuestComplete={fetchBusinessData}
                                onStartScreenshot={(q) => setSelectedScreenshotQuest(q)}
                                />
                            ))
                        ) : (
                            <div className="empty-message"><p>No quests available</p></div>
                        )}
                    </div>
                </div>
                <BugFeatureReportForm businessId={businessId} onSubmitSuccess={fetchBusinessData} />
            </div>

            <div className="right-panel">
                <div className="top-bugs-container scrollable-panel">
                    <h2>Top Bugs</h2>
                    <div className="items-list">
                        {topBugs.length > 0 ? (
                            topBugs.map(bug => (
                                <ItemCard key={bug.id} item={bug} type="bug" isAdmin={isAdminContext} />
                            ))
                        ) : (
                            <div className="empty-message"><p>No bugs reported yet</p></div>
                        )}
                    </div>
                </div>
                <div className="top-features-container scrollable-panel">
                    <h2>Top Features</h2>
                    <div className="items-list">
                        {topFeatures.length > 0 ? (
                            topFeatures.map(feature => (
                                <ItemCard key={feature.id} item={feature} type="feature" isAdmin={isAdminContext} />
                            ))
                        ) : (
                            <div className="empty-message"><p>No features requested yet</p></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`brand-detail-page ${themeClass}`}>
            {/* Brand Header */}
            <div className="brand-header">
                

                <div className="brand-header__content">
                    <div className="brand-header__logo">
                        <img
                            src={getLogoUrl(business.logo_url)}
                            alt={`${business.name} logo`}
                            className="brand-logo"
                            style={{
                                opacity: logoLoaded ? 1 : 0,
                                transition: 'opacity 0.3s ease-in-out'
                            }}
                            onLoad={() => setLogoLoaded(true)}
                            onError={(e) => {
                                e.target.src = '/image.png';
                                setLogoLoaded(true);
                            }}
                        />
                    </div>
                    <h1 className="brand-header__title">{business.name}</h1>
                </div>
            </div>

            {/* Rest of the component remains the same... */}
            {discordRestrictedSurveys.length > 0 && (
                 <div style={{
                    backgroundColor: '#e8f3ff',
                    border: '1px solid #bbdefb',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    margin: '16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <i className="ri-discord-line" style={{ color: '#5865F2', fontSize: '20px' }}></i>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#1976d2' }}>
                            <strong>{discordRestrictedSurveys.length}</strong> survey{discordRestrictedSurveys.length !== 1 ? 's' : ''} from this business {discordRestrictedSurveys.length === 1 ? 'requires' : 'require'} Discord roles.
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                            Link your Discord account and join their server to access these surveys.
                        </p>
                    </div>
                    <button
                        onClick={handleLinkDiscord}
                        style={{
                            backgroundColor: '#5865F2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <i className="ri-discord-line"></i>
                        Link Discord
                    </button>
                </div>
            )}

            {hasCustomLayout ? renderLayout() : renderLegacyLayout()}

            {selectedScreenshotQuest && (
                <ScreenshotQuestInterface
                    quest={selectedScreenshotQuest}
                    onClose={() => setSelectedScreenshotQuest(null)}
                    onComplete={() => {
                        setSelectedScreenshotQuest(null);
                        fetchBusinessData();
                    }}
                    user={user}
                />
            )}
        </div>
    );
};


const SurveyCard = ({ survey, discordStatus }) => {
    const navigate = useNavigate();
    const handleStartSurvey = () => navigate(`/survey/${survey.id}`);
    const estimatedTime = survey.estimated_time || (survey.question_count || 1);
    const xpReward = survey.xp_reward || ((survey.question_count || 1) * 30);
    const requiresDiscord = survey.audience_settings?.discord_roles_allowed?.length > 0;
    const hasDiscordAccess = discordStatus?.has_access !== false;
    const isCompleted = survey.completed_by_user;
    return (
        <div className="survey-item">
            <h3>{survey.title}</h3>
            <div className="survey-meta">
                <span>⏱️ {estimatedTime} min</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#ffc107' }}>✨ {xpReward} XP</span>
                {requiresDiscord && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: hasDiscordAccess ? '#5865F2' : '#999' }}>
                        <i className="ri-discord-line"></i> Discord
                    </span>
                )}
            </div>
            {survey.description && (
                <p className="survey-description">{survey.description.length > 100 ? `${survey.description.substring(0, 97)}...` : survey.description}</p>
            )}
            {requiresDiscord && !hasDiscordAccess && (
                <div style={{ fontSize: '12px', color: '#f44336', marginTop: '8px', padding: '4px 8px', backgroundColor: '#ffebee', borderRadius: '4px', border: '1px solid #ffcdd2' }}>
                    <i className="ri-lock-line"></i> Requires Discord role in {survey.business_name}
                </div>
            )}
            <button className="start-btn" onClick={handleStartSurvey} disabled={isCompleted || (requiresDiscord && !hasDiscordAccess)} style={{ opacity: (isCompleted || (requiresDiscord && !hasDiscordAccess)) ? 0.6 : 1, cursor: (isCompleted || (requiresDiscord && !hasDiscordAccess)) ? 'not-allowed' : 'pointer', backgroundColor: isCompleted ? '#6c757d' : '' }}>
                {isCompleted ? 'Completed' : (requiresDiscord && !hasDiscordAccess ? 'Access Restricted' : 'Start Survey')}
            </button>
        </div>
    );
};

const QuestCard = ({ quest, isCompleted, isPending, onQuestComplete, onStartScreenshot }) => {
    const [questState, setQuestState] = useState(isCompleted ? 'completed' : (isPending ? 'pending' : 'initial'));
    const handleQuestAction = async () => {
        if (questState !== 'initial') return;
        try {
            // Enforce screenshot flow
            if (quest.verification_method === 'SCREENSHOT_VERIFY') {
                onStartScreenshot && onStartScreenshot(quest);
                return;
            }

            if (quest.target_url) {
                try { await questAPI.trackLinkClick(quest.id); } catch (e) { /* no-op */ }
                window.open(quest.target_url, '_blank', 'noopener,noreferrer');
                setQuestState('claimable');
            } else {
                await handleQuestComplete();
            }
        } catch (error) { toast.error('Could not start quest. Please try again.'); }
    };
    const handleQuestComplete = async () => {
        try {
            await questAPI.completeQuest(quest.id, {});
            const xpEarned = quest.xp_reward || 0;
            toast.success(`Quest completed! You earned ${xpEarned} XP.`);
            window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpEarned } }));
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData) {
                userData.xp_balance = (userData.xp_balance || 0) + xpEarned;
                localStorage.setItem('user', JSON.stringify(userData));
                window.dispatchEvent(new CustomEvent('userUpdated'));
            }
            setQuestState('completed');
            if (onQuestComplete) onQuestComplete();
        } catch (error) { toast.error(error.response?.data?.error || 'Failed to complete quest.'); }
    };
    const getButtonText = () => {
        if (questState === 'completed') return '✓ Completed';
        if (questState === 'pending') return 'Pending Approval';
        if (questState === 'claimable') return 'Claim Reward';
        if (quest.target_url) return 'Visit Link';
        return 'Complete Quest';
    };
    const getButtonAction = () => {
        if (questState === 'claimable') return handleQuestComplete;
        return handleQuestAction;
    };
    return (
        <div className="quest-card">
            {quest.image_url && (
                <div className="quest-card-image">
                    <img 
                        src={quest.image_url.startsWith('http') ? quest.image_url : `${baseURL}${quest.image_url}`}
                        alt={quest.title || 'Quest image'}
                        style={{
                            width: '100%',
                            height: '100px',
                            objectFit: 'contain',
                            borderRadius: '8px 8px 0 0',
                            marginBottom: '8px',
                            backgroundColor: '#f5f5f5'
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}
            <h4>{quest.title}</h4>
            {quest.description && !quest.image_url && (<p style={{ fontSize: '0.85em', margin: '8px 0' }}>{quest.description}</p>)}
            <div className="quest-reward"><span style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#ffc107' }}>✨ {quest.xp_reward} XP</span></div>
            <button className="quest-btn" onClick={getButtonAction()} disabled={questState === 'completed' || questState === 'pending'} style={{ backgroundColor: questState === 'completed' ? '#6c757d' : (questState === 'claimable' ? '#28a745' : (questState === 'pending' ? '#6c757d' : '')) }}>
                {getButtonText()}
            </button>
        </div>
    );
};

const BugFeatureReportForm = ({ businessId, onSubmitSuccess }) => {
    const [reportType, setReportType] = useState('BUG');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) { toast.error('Please fill in all required fields'); return; }
        setSubmitting(true);
        try {
            const reportData = { item_type: reportType, title: title.trim(), description: description.trim() };
            if (image) reportData.image = image;
            await itemAPI.createItem(businessId, reportData);
            toast.success(`${reportType === 'BUG' ? 'Bug report' : 'Feature request'} submitted successfully!`, { duration: 6000 });
            setTitle(''); setDescription(''); setImage(null);
            if (onSubmitSuccess) onSubmitSuccess();
        } catch (error) { toast.error(error.response?.data?.error || 'Failed to submit report');
        } finally { setSubmitting(false); }
    };
    return (
        <div className="bug-report-section">
            <h4>Report Bug or Request Feature</h4>
            <p className="report-help-text">Your submission will be reviewed before appearing publicly.</p>
            <form onSubmit={handleSubmit} className="report-form">
                <div className="form-group" style={{ position: 'relative' }}>
                    <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="form-select" style={{ appearance: 'none' }}>
                        <option value="BUG">🐛 Report Bug</option>
                        <option value="FEATURE">💡 Request Feature</option>
                    </select>
                    <i className="ri-arrow-down-s-line" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}></i>
                </div>
                <div className="form-group"><input type="text" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" required maxLength={50} /></div>
                <div className="form-group"><textarea placeholder="Description *" value={description} onChange={(e) => setDescription(e.target.value)} className="form-textarea" required rows={3} maxLength={500} /></div>
                <div className="form-group">
                    <label className="file-input-label"><input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} className="file-input" />📎 Attach Image (Optional)</label>
                    {image && (<div className="file-preview"><span>{image.name}</span><button type="button" onClick={() => setImage(null)}>×</button></div>)}
                </div>
                <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Submitting...' : `Submit ${reportType === 'BUG' ? 'Report' : 'Request'}`}</button>
            </form>
        </div>
    );
};

const ItemCard = ({ item, type, isAdmin }) => {
    const [userVote, setUserVote] = useState(null);
    const [netVotes, setNetVotes] = useState(item.net_votes || 0);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const handleVote = async (newVoteType) => {
        if (votingInProgress) return;
        setVotingInProgress(true);
        const previousVote = userVote; const previousNetVotes = netVotes;
        let newVoteState = newVoteType; let voteChange = 0;
        if (previousVote === newVoteType) { newVoteState = null; voteChange = -newVoteType;
        } else if (previousVote !== null) { voteChange = newVoteType - previousVote;
        } else { voteChange = newVoteType; }
        setUserVote(newVoteState); setNetVotes(previousNetVotes + voteChange);
        try {
            const response = await itemAPI.voteOnItem(item.id, { vote: newVoteType });
            setNetVotes(response.data.item.net_votes);
            setUserVote(response.data.item.user_vote);
            toast.success('Vote recorded!');
        } catch (error) { setUserVote(previousVote); setNetVotes(previousNetVotes); toast.error('Failed to record vote.');
        } finally { setVotingInProgress(false); }
    };
    return (
        <div className="item-card">
            <div className="item-header">
                <h4>{item.title}</h4>
                {isAdmin && (<span className={`item-status ${item.status?.toLowerCase()}`}>{item.status}</span>)}
            </div>
            <p className="item-description">{item.description}</p>
            <div className="voting-section">
                <button className={`vote-btn upvote ${userVote === 1 ? 'active' : ''}`} onClick={() => handleVote(1)} disabled={votingInProgress}>↑</button>
                <span className="vote-count">{netVotes}</span>
                <button className={`vote-btn downvote ${userVote === -1 ? 'active' : ''}`} onClick={() => handleVote(-1)} disabled={votingInProgress}>↓</button>
            </div>
        </div>
    );
};

export default BrandDetailPage;

// --- Layout renderer ---
function renderSection(key, ctx, columnUnits = 1) {
    // Determine cards-per-row based on column width units (1=S, 2=M, 3=L, 4=Full)
    const cardsPerRow = Math.max(1, Math.min(4, columnUnits));
    switch (key) {
        case 'SURVEYS':
            return (
                <div className="surveys-list" style={{ display: 'grid', gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)`, gap: '12px' }}>
                    {ctx.surveys.length > 0 ? (
                        ctx.surveys.map(survey => (
                            <SurveyCard key={survey.id} survey={survey} discordStatus={ctx.discordAccessCache[survey.id]} />
                        ))
                    ) : (
                        <div className="empty-message"><p>No surveys available</p></div>
                    )}
                </div>
            );
        case 'QUESTS':
            return (
                <div className="quests-grid" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)` }}>
                    {ctx.quests.length > 0 ? (
                        ctx.quests.slice(0, 4).map(quest => (
                            <QuestCard
                                key={quest.id}
                                quest={quest}
                                isCompleted={ctx.completedQuests.has(quest.id)}
                                isPending={ctx.pendingQuests.has(quest.id)}
                                onQuestComplete={ctx.fetchBusinessData}
                                onStartScreenshot={(q) => ctx.setSelectedScreenshotQuest ? ctx.setSelectedScreenshotQuest(q) : null}
                            />
                        ))
                    ) : (
                        <div className="empty-message"><p>No quests available</p></div>
                    )}
                </div>
            );
        case 'REPORT_FORM':
            return <BugFeatureReportForm businessId={ctx.businessId} onSubmitSuccess={ctx.fetchBusinessData} />;
        case 'BUGS_LIST':
            return (
                <div className="items-list" style={{ display: 'grid', gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)`, gap: '12px' }}>
                    {ctx.topBugs.length > 0 ? (
                        ctx.topBugs.map(bug => (
                            <ItemCard key={bug.id} item={bug} type="bug" isAdmin={ctx.isAdminContext} />
                        ))
                    ) : (
                        <div className="empty-message"><p>No bugs reported yet</p></div>
                    )}
                </div>
            );
        case 'FEATURES_LIST':
            return (
                <div className="items-list" style={{ display: 'grid', gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)`, gap: '12px' }}>
                    {ctx.topFeatures.length > 0 ? (
                        ctx.topFeatures.map(feature => (
                            <ItemCard key={feature.id} item={feature} type="feature" isAdmin={ctx.isAdminContext} />
                        ))
                    ) : (
                        <div className="empty-message"><p>No features requested yet</p></div>
                    )}
                </div>
            );
        case 'CO_CREATE':
            // Determine max ideas based on column size
            const getMaxIdeas = (units) => {
                if (units === 1) return 3;  // Small section
                if (units === 2) return 6;  // Medium section
                return 9;                   // Large section (3+ units)
            };
            
            const maxIdeas = getMaxIdeas(columnUnits);
            const displayedIdeas = ctx.topIdeas.slice(0, maxIdeas);
            const hasMoreIdeas = ctx.topIdeas.length > maxIdeas;
            
            return (
                <CoCreateSection 
                    businessId={ctx.businessId}
                    topIdeas={ctx.topIdeas}
                    displayedIdeas={displayedIdeas}
                    hasMoreIdeas={hasMoreIdeas}
                    cardsPerRow={cardsPerRow}
                    onIdeaSubmit={ctx.fetchBusinessData}
                    onNavigate={ctx.navigate}
                />
            );
        default:
            return <div className="empty-message"><p>Unassigned</p></div>;
    }
}

// Co-Create Section Component
const CoCreateSection = ({ businessId, topIdeas, displayedIdeas, hasMoreIdeas, cardsPerRow, onIdeaSubmit, onNavigate }) => {
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [filteredIdeas, setFilteredIdeas] = useState(displayedIdeas);
    
    useEffect(() => {
        let filtered = [...displayedIdeas];
        
        // Apply search filter
        if (searchTerm.trim()) {
            filtered = filtered.filter(idea => 
                idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (idea.description && idea.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            if (sortBy === 'most_liked') {
                return (b.likes_count || 0) - (a.likes_count || 0);
            }
            return new Date(b.created_at) - new Date(a.created_at); // newest first
        });
        
        setFilteredIdeas(filtered);
    }, [displayedIdeas, searchTerm, sortBy]);
    
    const handleSubmitIdea = () => {
        setShowSubmissionModal(true);
    };
    
    return (
        <div className="co-create-section">
            {/* Header with controls on same line */}
            <div className="section-header d-flex justify-content-between align-items-center mb-3">
                <h2 className="mb-0">
                    Community Ideas ({topIdeas.length})
                </h2>
                
                <div className="d-flex align-items-center gap-3">
                    {/* Search Input */}
                    <div className="search-input-wrapper" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search ideas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                width: '200px',
                                paddingLeft: '36px',
                                backgroundColor: '#0d0d0d',
                                borderColor: '#8b5cf6',
                                color: '#ffffff',
                                fontSize: '14px'
                            }}
                        />
                        <style>{`
                            .search-input-wrapper input::placeholder {
                                color: #ffffff !important;
                                opacity: 0.7;
                            }
                        `}</style>
                        <i className="ri-search-line" style={{ 
                            position: 'absolute', 
                            left: '12px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            color: 'var(--bs-text-muted)' 
                        }}></i>
                    </div>
                    {/* Sort Select */}
                    <select 
                        className="form-select form-select-sm"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ 
                            width: 'auto',
                            backgroundColor: '#0d0d0d',
                            borderColor: '#8b5cf6',
                            color: '#ffffff',
                            fontSize: '14px'
                        }}
                    >
                        <option value="newest">Newest First</option>
                        <option value="most_liked">Most Liked</option>
                    </select>
                    
                    {/* Submit Button - smaller size */}
                    <button 
                        className="start-btn"
                        onClick={handleSubmitIdea}
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                        <i className="ri-lightbulb-line me-1"></i>
                        Submit Idea
                    </button>
                </div>
            </div>
            
            {/* Ideas Grid */}
            <div className="ideas-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)`, gap: '12px', minHeight: '200px' }}>
                {filteredIdeas.length > 0 ? (
                    filteredIdeas.map(idea => (
                        <EnhancedIdeaCard 
                            key={idea.id} 
                            idea={idea} 
                            onClick={() => onNavigate(`/user/idea/${idea.id}`)}
                            onRefresh={onIdeaSubmit}
                        />
                    ))
                ) : (
                    <div className="empty-message">
                        <div className="text-center py-4">
                            <i className="ri-lightbulb-line" style={{ fontSize: '2.5rem', color: 'var(--bs-text-muted)', marginBottom: '1rem', display: 'block' }}></i>
                            <h4>No Ideas Found</h4>
                            <p className="text-muted mb-3">
                                {searchTerm ? 'Try adjusting your search to find more ideas.' : 'Be the first to share a creative idea!'}
                            </p>
                            <button 
                                className="start-btn"
                                onClick={handleSubmitIdea}
                            >
                                <i className="ri-lightbulb-line me-2"></i>
                                Submit Your Idea
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {showSubmissionModal && (
                <IdeaSubmissionModal 
                    businessId={businessId}
                    onClose={() => setShowSubmissionModal(false)}
                    onSubmit={() => {
                        setShowSubmissionModal(false);
                        onIdeaSubmit();
                    }}
                />
            )}
        </div>
    );
};

// Enhanced Idea Card Component with consistent Lego-style layout
const EnhancedIdeaCard = ({ idea, onClick, onRefresh }) => {
    const [isLiked, setIsLiked] = useState(idea.user_liked || idea.liked_by_user || false);
    const [likesCount, setLikesCount] = useState(idea.likes_count || 0);

    const handleLike = async (event) => {
        event.stopPropagation();
        try {
            const response = await ideaAPI.likeIdea(idea.id);
            setIsLiked(response.liked);
            setLikesCount(response.likes_count);
            toast.success(response.liked ? 'Idea liked!' : 'Like removed!');
            if (onRefresh) {
                onRefresh().catch(console.error);
            }
        } catch (error) {
            console.error('Error liking idea:', error);
            toast.error(error.message || 'Failed to update like');
        }
    };

    const calculateDaysLeft = (supportEndsAt) => {
        if (!supportEndsAt) return null;
        const endDate = new Date(supportEndsAt);
        const now = new Date();
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const daysLeft = calculateDaysLeft(idea.support_ends_at);
    
    return (
        <div className="survey-item idea-card-enhanced" style={{ 
            cursor: 'pointer', 
            height: '340px', // Fixed height for consistency
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Clickable Content Area */}
            <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ 
                    fontSize: '1.1rem', 
                    marginBottom: '8px', 
                    lineHeight: '1.3',
                    fontWeight: '600',
                    color: 'white'
                }}>{idea.title}</h4>
                
                <div style={{ flex: 1, marginBottom: '12px' }}>
                    <p className="survey-description" style={{ 
                        fontSize: '0.85rem', 
                        lineHeight: '1.4',
                        color: 'rgba(255, 255, 255, 0.8)',
                        margin: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                    }}>
                        {idea.description || 'No description provided.'}
                    </p>
                </div>
                
                {daysLeft !== null && (
                    <div className="idea-card-subtext" style={{ 
                        marginBottom: '12px',
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <i className="ri-time-line"></i>
                        {daysLeft}d left
                    </div>
                )}
            </div>
            
            {/* Fixed Bottom Section */}
            <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                {/* Stats and Like Button Row */}
                <div className="idea-card-meta-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                }}>
                    <div className="idea-card-stats" style={{
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ri-heart-line"></i>{likesCount}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ri-chat-3-line"></i>{idea.comments_count || 0}
                        </span>
                    </div>
                    <button 
                        type="button"
                        className={`btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} idea-card-like-btn`}
                        onClick={handleLike}
                        style={{ padding: '4px 8px' }}
                    >
                        <i className="ri-heart-line"></i>
                    </button>
                </div>

                {/* View Button */}
                <button 
                    className="start-btn idea-card-view-btn" 
                    onClick={onClick}
                    style={{ 
                        width: '100%',
                        padding: '8px 16px',
                        fontSize: '0.9rem'
                    }}
                >
                    <i className="ri-eye-line me-1"></i>
                    View Details
                </button>
            </div>
        </div>
    );
};

// Legacy Idea Card Component (keeping for compatibility)
const IdeaCard = ({ idea, onClick, onRefresh }) => {
    return <EnhancedIdeaCard idea={idea} onClick={onClick} onRefresh={onRefresh} />;
};

// Idea Submission Modal Component (matches CoCreatePage style exactly)
const IdeaSubmissionModal = ({ businessId, onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) { 
            toast.error('Please fill in all required fields'); 
            return; 
        }
        
        setSubmitting(true);
        try {
            const ideaData = { 
                title: title.trim(), 
                description: description.trim() 
            };

            if (images.length > 0) {
                try {
                    const uploadedImageUrls = [];
                    for (const image of images) {
                        const uploadResponse = await uploadAPI.uploadImage(image);
                        console.log('Upload response:', uploadResponse); // Debug log
                        if (uploadResponse.data && uploadResponse.data.image_url) {
                            uploadedImageUrls.push(uploadResponse.data.image_url);
                            console.log('Image URL set:', uploadResponse.data.image_url); // Debug log
                        } else {
                            console.error('No image_url in upload response:', uploadResponse);
                            toast.error('Image upload failed: No URL returned');
                            setSubmitting(false);
                            return;
                        }
                    }
                    // For now, use the first image as the main image_url for backward compatibility
                    // Later we can extend the backend to support multiple images
                    ideaData.image_url = uploadedImageUrls[0];
                    if (uploadedImageUrls.length > 1) {
                        ideaData.additional_images = uploadedImageUrls.slice(1);
                    }
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    toast.error('Failed to upload images. Please try again.');
                    setSubmitting(false);
                    return;
                }
            }
            
            await ideaAPI.createIdea(businessId, ideaData);
            toast.success('Idea submitted successfully! It will be reviewed before appearing publicly.', { duration: 6000 });
            setTitle(''); 
            setDescription(''); 
            setImages([]);
            onSubmit();
        } catch (error) { 
            toast.error(error.response?.data?.error || 'Failed to submit idea');
        } finally { 
            setSubmitting(false); 
        }
    };
    
    return (
        <div className="co-create-modal-overlay" onClick={onClose}>
            <div 
                className="co-create-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="co-create-modal__header">
                    <h5 className="co-create-modal__title">
                        <i className="ri-lightbulb-line"></i>
                        Submit Your Idea
                    </h5>
                    <button 
                        type="button" 
                        className="co-create-modal__close" 
                        onClick={onClose}
                        aria-label="Close idea submission"
                    >
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <div className="co-create-modal__body">
                    <div className="bug-report-section">
                        <p className="report-help-text">Your submission will be reviewed before appearing publicly.</p>
                        <form onSubmit={handleSubmit} className="report-form">
                            <div className="form-group">
                                <input 
                                    type="text" 
                                    placeholder="Idea Title *" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    className="form-input" 
                                    required 
                                    maxLength={120} 
                                />
                            </div>
                            <div className="form-group">
                                <textarea 
                                    placeholder="Description *" 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    className="form-textarea" 
                                    required 
                                    rows={4} 
                                    maxLength={500} 
                                />
                            </div>
                            <div className="form-group">
                                <label className="file-input-label">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files);
                                            if (files.length + images.length > 5) {
                                                toast.error('Maximum 5 images allowed');
                                                return;
                                            }
                                            setImages(prev => [...prev, ...files]);
                                        }} 
                                        className="file-input" 
                                    />
                                    📎 Attach Images (Optional, max 5)
                                </label>
                                {images.length > 0 && (
                                    <div className="images-preview" style={{ 
                                        display: 'flex', 
                                        flexWrap: 'wrap', 
                                        gap: '8px', 
                                        marginTop: '12px' 
                                    }}>
                                        {images.map((image, index) => (
                                            <div key={index} className="image-preview-item" style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                padding: '8px',
                                                border: '1px solid var(--bs-border-color)',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bs-secondary-bg)',
                                                maxWidth: '120px'
                                            }}>
                                                <img 
                                                    src={URL.createObjectURL(image)} 
                                                    alt={`Preview ${index + 1}`}
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        objectFit: 'cover',
                                                        borderRadius: '4px'
                                                    }}
                                                />
                                                <span style={{ 
                                                    fontSize: '0.7rem', 
                                                    marginTop: '4px',
                                                    textAlign: 'center',
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {image.name.length > 15 ? `${image.name.substring(0, 12)}...` : image.name}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        background: 'rgba(220, 53, 69, 0.8)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="d-flex gap-2 justify-content-end">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={onClose}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="submit-btn" 
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Idea'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
