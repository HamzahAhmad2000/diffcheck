import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import { businessAPI, uploadAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css'; // Shared form styles
import './EditSplashPage.css'; // Specific styles for this page
import { baseURL } from '../../services/apiClient';
import SimpleImageCropper from './SimpleImageCropper';

const EditSplashPage = () => {
    const navigate = useNavigate();
    const { businessId } = useParams();
    const [businessName, setBusinessName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    
    const [currentLogoUrl, setCurrentLogoUrl] = useState('');
    const [croppedLogoBlob, setCroppedLogoBlob] = useState(null);
    // NEW: Splash layout state
    const TEMPLATE_DEFS = {
        1: { columns: [1, 2, 1], slotsPerColumn: [1, 2, 2] },
        2: { columns: [1, 2, 1], slotsPerColumn: [1, 1, 2] },
        3: { columns: [3, 1], slotsPerColumn: [1, 2] },
        4: { columns: [3, 1], slotsPerColumn: [1, 1] },
        5: { columns: [1, 3], slotsPerColumn: [1, 1] },
        6: { columns: [4], slotsPerColumn: [1] },
        // NEW TEMPLATES
        7: { columns: [1, 2, 1], slotsPerColumn: [1, 1, 1] }, // s m s (no split)
        8: { columns: [1, 2, 1], slotsPerColumn: [1, 2, 1] }, // s m(split) s
        9: { columns: [2, 2], slotsPerColumn: [1, 1] },       // m m (no split)
        10:{ columns: [2, 2], slotsPerColumn: [2, 2] },       // m(split) m(split)
    };
    const ALL_CONTENT_ITEMS = [
        { key: 'SURVEYS', label: 'Surveys', permission: 'can_create_surveys' },
        { key: 'QUESTS', label: 'Quests', permission: 'can_create_quests' },
        { key: 'BUGS_LIST', label: 'Bugs (Upvoting)', permission: 'can_create_bug_reports' },
        { key: 'FEATURES_LIST', label: 'Features (Upvoting)', permission: 'can_create_feature_requests' },
        { key: 'REPORT_FORM', label: 'Report Form', permission: null }, // Always available
        { key: 'CO_CREATE', label: 'Co-Create', permission: 'can_view_co_create' },
    ];
    const DEFAULT_ORDER = ['SURVEYS', 'QUESTS', 'REPORT_FORM', 'BUGS_LIST', 'FEATURES_LIST', 'CO_CREATE'];

    const [splashTemplate, setSplashTemplate] = useState(3); // sensible default
    const [assignedBlocks, setAssignedBlocks] = useState([]); // ordered array matching slots
    const [businessPermissions, setBusinessPermissions] = useState({}); // Store business permissions

    // Helper function to get the largest panel index for templates 3-6
    const getLargestPanelIndex = (template) => {
        const def = TEMPLATE_DEFS[template];
        if (!def) return -1;
        
        // Find the column with the largest width
        const maxColumnWidth = Math.max(...def.columns);
        const maxColumnIndex = def.columns.indexOf(maxColumnWidth);
        
        // Calculate the slot index for the largest column
        let slotIndex = 0;
        for (let i = 0; i < maxColumnIndex; i++) {
            slotIndex += def.slotsPerColumn[i];
        }
        
        return slotIndex;
    };

    const userRole = localStorage.getItem('userRole');
    const dashboardLink = userRole === 'business_admin'
        ? '/business-admin/dashboard'
        : `/admin/business/dashboard/${businessId}`;

    // Filter content items based on business permissions and template restrictions
    const CONTENT_ITEMS = ALL_CONTENT_ITEMS.filter(item => {
        // CO_CREATE is only allowed on templates 3, 4, 5, 6
        if (item.key === 'CO_CREATE' && ![3, 4, 5, 6].includes(splashTemplate)) {
            return false;
        }
        
        // Always show items without permission requirements
        if (!item.permission) return true;
        
        // Show all items for super admins
        if (userRole === 'super_admin') return true;
        
        // Check if business has the required permission
        return businessPermissions[item.permission] === true;
    });

    const fetchBusinessBranding = useCallback(async () => {
        setIsFetching(true);
        try {
            const response = await businessAPI.getDetails(businessId);
            const biz = response.data;
            setBusinessName(biz.name || 'Business');
            
            // Set business permissions for content filtering
            setBusinessPermissions(biz.permissions || {});
            
            if (biz.logo_url) {
                const fullUrl = biz.logo_url.startsWith('http') ? biz.logo_url : `${baseURL}${biz.logo_url}`;
                setCurrentLogoUrl(`${fullUrl}?t=${new Date().getTime()}`);
            }

            // Load saved layout - only set if not already modified by user
            const tpl = biz.splash_template || 3; // default to template 3
            setSplashTemplate(tpl);
            
            const slotCount = (TEMPLATE_DEFS[tpl]?.slotsPerColumn || []).reduce((a,b)=>a+b,0);
            const incoming = Array.isArray(biz.splash_blocks) ? biz.splash_blocks : [];
            
            // Filter out content blocks that are no longer allowed based on permissions
            const allowedContentKeys = ALL_CONTENT_ITEMS
                .filter(item => {
                    if (!item.permission) return true;
                    if (userRole === 'super_admin') return true;
                    return (biz.permissions || {})[item.permission] === true;
                })
                .map(item => item.key);
            
            const filteredIncoming = incoming.map(block => 
                allowedContentKeys.includes(block) ? block : null
            );
            
            const prefilled = new Array(slotCount).fill(null).map((_,i)=> 
                filteredIncoming[i] || (allowedContentKeys.includes(DEFAULT_ORDER[i]) ? DEFAULT_ORDER[i] : null)
            );
            
            // Ensure CO_CREATE gets the largest panel in templates 3-6
            if ([3, 4, 5, 6].includes(tpl) && allowedContentKeys.includes('CO_CREATE')) {
                const largestPanelIndex = getLargestPanelIndex(tpl);
                if (largestPanelIndex !== -1) {
                    // Remove CO_CREATE from any other slot
                    const cleanedBlocks = prefilled.map(block => block === 'CO_CREATE' ? null : block);
                    // Assign CO_CREATE to the largest panel
                    cleanedBlocks[largestPanelIndex] = 'CO_CREATE';
                    setAssignedBlocks(cleanedBlocks);
                } else {
                    setAssignedBlocks(prefilled);
                }
            } else {
                setAssignedBlocks(prefilled);
            }

        } catch (error) {
            toast.error('Failed to load business branding data.');
            console.error("Error fetching business branding:", error);
        } finally {
            setIsFetching(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchBusinessBranding();
    }, [fetchBusinessBranding]);
    
    const handleCroppedImageChange = (file) => {
        setCroppedLogoBlob(file);
    };

    // Compute total slots for current template and normalize state
    useEffect(() => {
        const slots = (TEMPLATE_DEFS[splashTemplate]?.slotsPerColumn || []).reduce((a,b)=>a+b,0);
        setAssignedBlocks(prev => {
            const next = [...prev];
            
            // Remove CO_CREATE if switching to templates that don't support it
            if (![3, 4, 5, 6].includes(splashTemplate)) {
                for (let i = 0; i < next.length; i++) {
                    if (next[i] === 'CO_CREATE') {
                        next[i] = null;
                    }
                }
            }
            
            if (next.length < slots) {
                // extend
                const needed = slots - next.length;
                const startIndex = next.length;
                for (let i = 0; i < needed; i++) {
                    next.push(DEFAULT_ORDER[startIndex + i] || null);
                }
            } else if (next.length > slots) {
                next.length = slots;
            }
            
            // For templates 3-6, ensure CO_CREATE is only on the largest panel if it exists
            if ([3, 4, 5, 6].includes(splashTemplate)) {
                const largestPanelIndex = getLargestPanelIndex(splashTemplate);
                const hasCoCreate = next.includes('CO_CREATE');
                
                if (hasCoCreate && largestPanelIndex !== -1) {
                    // Remove CO_CREATE from all other slots
                    for (let i = 0; i < next.length; i++) {
                        if (i !== largestPanelIndex && next[i] === 'CO_CREATE') {
                            next[i] = null;
                        }
                    }
                    // Ensure CO_CREATE is on the largest panel
                    if (next[largestPanelIndex] !== 'CO_CREATE') {
                        // Find where CO_CREATE currently is and swap
                        const coCreateIndex = next.findIndex(item => item === 'CO_CREATE');
                        if (coCreateIndex !== -1) {
                            next[coCreateIndex] = next[largestPanelIndex];
                            next[largestPanelIndex] = 'CO_CREATE';
                        }
                    }
                }
            }
            
            return next;
        });
    }, [splashTemplate]);

    // Drag and Drop helpers
    const handleDragStart = (e, payload) => {
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDropOnSlot = (e, slotIndex) => {
        e.preventDefault();
        const payload = JSON.parse(e.dataTransfer.getData('application/json'));
        setAssignedBlocks(prev => {
            const next = [...prev];
            let incomingKey = null;
            if (payload.type === 'palette') {
                incomingKey = payload.key;
                
                // CO_CREATE restriction: only allow on largest panel for templates 3-6
                if (incomingKey === 'CO_CREATE' && [3, 4, 5, 6].includes(splashTemplate)) {
                    const largestPanelIndex = getLargestPanelIndex(splashTemplate);
                    if (slotIndex !== largestPanelIndex) {
                        toast.error('Co-Create can only be placed on the largest panel for this template.');
                        return prev; // Don't make any changes
                    }
                }
                
                // Avoid duplicates: remove from any other slot
                const existingIdx = next.findIndex(k => k === incomingKey);
                if (existingIdx !== -1) next[existingIdx] = null;
            } else if (payload.type === 'slot') {
                incomingKey = next[payload.index];
                
                // CO_CREATE restriction for slot-to-slot moves
                if (incomingKey === 'CO_CREATE' && [3, 4, 5, 6].includes(splashTemplate)) {
                    const largestPanelIndex = getLargestPanelIndex(splashTemplate);
                    if (slotIndex !== largestPanelIndex) {
                        toast.error('Co-Create can only be placed on the largest panel for this template.');
                        return prev; // Don't make any changes
                    }
                }
                
                next[payload.index] = next[slotIndex];
            }
            next[slotIndex] = incomingKey;
            return next;
        });
    };
    const allowDrop = (e) => e.preventDefault();
    const clearSlot = (slotIndex) => setAssignedBlocks(prev => {
        const next = [...prev];
        next[slotIndex] = null; return next;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        let finalLogoUrl = currentLogoUrl.split('?')[0].replace(baseURL, '');

        try {
            if (croppedLogoBlob) {
                const uploadResponse = await uploadAPI.uploadImage(croppedLogoBlob, 'business_logo.png');
                finalLogoUrl = uploadResponse.data.image_url;
            }

            const slotCount = (TEMPLATE_DEFS[splashTemplate]?.slotsPerColumn || []).reduce((a,b)=>a+b,0);
            const blocks = assignedBlocks.slice(0, slotCount).map(x => x || null);
            const updatedBrandingData = {
                logo_url: finalLogoUrl,
                splash_template: splashTemplate,
                splash_blocks: blocks,
            };
            
            await businessAPI.updateBranding(businessId, updatedBrandingData);
            toast.success('Splash page updated successfully!');
            fetchBusinessBranding(); 
        } catch (error) {
            console.error("Error updating splash page:", error);
            toast.error(error.response?.data?.error || 'Failed to update splash page.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-form-page"><p>Loading splash page editor...</p></div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-form-page">
                <div className="form-container-card">
                    <div className="form-header">
                         <Link to={dashboardLink} className="back-to-dashboard-link">
                            <i className="ri-arrow-left-line"></i> Back to {businessName} Dashboard
                        </Link>
                        <h1 className="chat-title">Edit Splash Page for {businessName}</h1>
                        <p className="chat-subtitle">Customize the public appearance of the business.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-form edit-splash-form">

                        {/* Logo Upload */}
                        <div className="newform-group">
                            <label htmlFor="logo">Business Logo</label>
                            <p style={{ 
                                fontSize: '14px', 
                                color: '#666', 
                                marginBottom: '16px',
                                fontStyle: 'italic'
                            }}>
                                Upload and crop your business logo. Recommended 4:3 aspect ratio.
                            </p>
                            <SimpleImageCropper 
                                onCroppedImageChange={handleCroppedImageChange}
                                initialImage={currentLogoUrl}
                                aspect={4 / 3} // Set to 4:3 aspect ratio
                                maxHeight={400}
                                cropShape="rect"
                            />
                        </div>

                        {/* Template Selection */}
                        <div className="newform-group">
                            <label>Layout Template</label>
                            <div className="template-grid">
                                {[1,2,3,4,5,6,7,8,9,10].map(tpl => (
                                    <div
                                        key={tpl}
                                        className={`template-card ${splashTemplate===tpl?'selected':''}`}
                                        onClick={() => setSplashTemplate(tpl)}
                                    >
                                        <TemplatePreview template={tpl} />
                                        <div className="template-label">Template {tpl}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Drag and Drop Assignment */}
                        <div className="newform-group">
                            <label>Assign Content</label>
                            <div className="assignment-container">
                                <div className="palette">
                                    <div className="palette-title">Content</div>
                                    {CONTENT_ITEMS.map(it => (
                                        <div
                                            key={it.key}
                                            className="palette-item"
                                            draggable
                                            onDragStart={(e)=>handleDragStart(e,{type:'palette', key: it.key})}
                                        >{it.label}</div>
                                    ))}
                                </div>
                                <div className="slots">
                                    <div className="slots-title">Visual Layout (drop into segments)</div>
                                    {(() => {
                                        const def = TEMPLATE_DEFS[splashTemplate];
                                        const totalUnits = def.columns.reduce((a,b)=>a+b,0);
                                        let cursor = 0;
                                        const labelMap = CONTENT_ITEMS.reduce((m,it)=>{ m[it.key]=it.label; return m; },{});
                                        return (
                                            <div className="interactive-layout" style={{ gridTemplateColumns: def.columns.map(c=>`${(c/totalUnits)*100}%`).join(' ') }}>
                                                {def.columns.map((width, colIdx) => {
                                                    const split = def.slotsPerColumn[colIdx] === 2;
                                                    const rows = split ? 2 : 1;
                                                    const partIndices = Array.from({length: rows}, (_,i)=> cursor + i);
                                                    cursor += rows;
                                                    return (
                                                        <div key={colIdx} className="interactive-col" style={{ gridTemplateRows: `repeat(${rows}, minmax(64px, auto))` }}>
                                                            {partIndices.map((slotIndex, partIdx) => {
                                                                const val = assignedBlocks[slotIndex];
                                                                const isLargestPanel = [3, 4, 5, 6].includes(splashTemplate) && 
                                                                                      slotIndex === getLargestPanelIndex(splashTemplate);
                                                                return (
                                                                    <div
                                                                        key={partIdx}
                                                                        className={`interactive-slot ${split? 'split':''} ${isLargestPanel ? 'largest-panel' : ''}`}
                                                                        onDrop={(e)=>handleDropOnSlot(e, slotIndex)}
                                                                        onDragOver={allowDrop}
                                                                        draggable={Boolean(val)}
                                                                        onDragStart={(e)=> val && handleDragStart(e,{type:'slot', index: slotIndex})}
                                                                    >
                                                                        <span className="slot-index">{slotIndex+1}</span>
                                                                        <span className="slot-label">
                                                                            {val ? labelMap[val] || val : 'Drop here'}
                                                                        </span>
                                                                        {val && (
                                                                            <button type="button" className="slot-clear" onClick={()=>clearSlot(slotIndex)}>×</button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="newform-actions">
                            <button 
                                type="button" 
                                className="newform-button secondary" 
                                onClick={() => navigate(dashboardLink)} 
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="newform-button primary" 
                                disabled={isLoading}
                            >
                                {isLoading ? 'Saving...' : 'Save Splash Page'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditSplashPage;

// --- Small preview component for templates ---
const TemplatePreview = ({ template }) => {
    const map = {
        1: { cols: [1,2,1], splits: [false,true,true] },
        2: { cols: [1,2,1], splits: [false,false,true] },
        3: { cols: [3,1], splits: [false,true] },
        4: { cols: [3,1], splits: [false,false] },
        5: { cols: [1,3], splits: [false,false] },
        6: { cols: [4], splits: [false] },
        7: { cols: [1,2,1], splits: [false,false,false] },
        8: { cols: [1,2,1], splits: [false,true,false] },
        9: { cols: [2,2], splits: [false,false] },
        10:{ cols: [2,2], splits: [true,true] },
    };
    const def = map[template];
    const total = def.cols.reduce((a,b)=>a+b,0);
    return (
        <div className="tpl" style={{ gridTemplateColumns: def.cols.map(c=>`${(c/total)*100}%`).join(' ') }}>
            {def.cols.map((c, i)=> (
                <div key={i} className="tpl-col">
                    <div className={`tpl-block ${def.splits[i]?'split':''}`}></div>
                </div>
            ))}
        </div>
    );
};