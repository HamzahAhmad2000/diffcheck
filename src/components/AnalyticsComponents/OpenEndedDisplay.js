// src/components/AnalyticsComponents/OpenEndedDisplay.js
import React, { useState, useEffect, useMemo } from 'react';
import './AnalyticsComponents.css'; // Ensure shared styles are imported
import PropTypes from 'prop-types'; // Recommended
import ReactWordcloud from 'react-wordcloud'; // Import Word Cloud component

const OpenEndedDisplay = ({ question, analyticsData, settings = {}, pdfExportOptions = {} }) => {
    // --- State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [displayedResponses, setDisplayedResponses] = useState([]);
    const [showFullList, setShowFullList] = useState(false); // To manage showing all vs limited responses

    // --- Derived Data & Settings ---
    const {
        showWordCloud = true, // Default to true if not specified
        showDropdownResponses: showResponseList = true, // Default to true
    } = settings;

    
    const responseLimit = pdfExportOptions?.openEndedResponseLimit ?? 10;
    const { openEndedResponseLimit = 10 } = pdfExportOptions; // Default limit

    // Memoize extracting data to prevent unnecessary recalculations
    const { allResponses, wordFrequencies, totalResponseCount } = useMemo(() => {
        // Use the correct prop name 'analyticsData'
        const analytics = analyticsData?.analytics;
        const responses = analytics?.all_responses || analytics?.latest_10 || [];
        const frequencies = analytics?.word_frequencies || [];
        const totalCount = analytics?.response_count ?? analytics?.count_valid ?? responses.length;
        const wordCloudData = frequencies.map(item => ({ text: item.word, value: item.count }));
        console.log(`OpenEndedDisplay (${question?.id}): Extracted ${responses.length} resp, ${frequencies.length} words. Total: ${totalCount}`);
        return { allResponses: responses, wordFrequencies: wordCloudData, totalResponseCount: totalCount };
    // Update dependency array to use 'analyticsData'
    }, [analyticsData, question?.id]);

    // --- Effects ---
    // Effect to filter/limit displayed responses
    useEffect(() => {
        let filtered = allResponses;
        const lowerSearchTerm = searchTerm.trim().toLowerCase();

        if (lowerSearchTerm !== '') {
            console.log(`OpenEndedDisplay (${question?.id}): Filtering for term "${lowerSearchTerm}"`);
            filtered = allResponses.filter(resp =>
                resp.text?.toLowerCase().includes(lowerSearchTerm)
            );
            setShowFullList(true); // Always show all *matching* results when searching
        } else {
            // If not searching, apply limit or show full list based on state
            if (!showFullList && allResponses.length > openEndedResponseLimit) {
                console.log(`OpenEndedDisplay (${question?.id}): Showing limited responses (${openEndedResponseLimit})`);
                filtered = allResponses.slice(0, openEndedResponseLimit);
            } else {
                console.log(`OpenEndedDisplay (${question?.id}): Showing all ${allResponses.length} responses (or no search term).`);
                filtered = allResponses; // Show all if showFullList is true or limit not exceeded
            }
        }
        setDisplayedResponses(filtered);
    }, [searchTerm, allResponses, openEndedResponseLimit, showFullList, question?.id]); // Rerun when these change

    const renderWordCloudSection = () => {
        if (!showWordCloud) return null; // Skip section if setting is off

        const wordCloudOptions = {
            // colors: ["#AA2EFF", "#6200EA", "#3700B3", "#03DAC6", "#018786", "#B00020"], // Example palette
            colors: ["#4F0996", "#AA2EFF", "#C97EFF", "#E0B3FF", "#F0D4FF", "#6D7278"], // Shades of purple + grey
            enableTooltip: true,
            deterministic: false, // More organic layout
            fontFamily: "Poppins, sans-serif", // Use consistent font
            fontSizes: [16, 60], // Adjust size range
            fontStyle: "normal",
            fontWeight: "bold",
            padding: 2,
            rotations: 2,
            rotationAngles: [-30, 0, 30], // Slightly more rotation variation
            scale: "sqrt", // Options: 'sqrt', 'log', 'linear'
            spiral: "archimedean", // Options: 'archimedean', 'rectangular'
            transitionDuration: 1000,
        };

        return (
            <div className="word-frequency-section">
                <h5>Word Cloud</h5>
                {wordFrequencies.length > 0 ? (
                    // Render the visual word cloud
                    <div style={{ height: '300px', width: '100%', border: '1px solid #eee', borderRadius: '4px', padding: '10px', background: '#fff' }}>
                        <ReactWordcloud
                            words={wordFrequencies}
                            options={wordCloudOptions}
                            // Optional: Add callbacks for word interactions
                            // callbacks={{
                            //     getWordTooltip: word => `${word.text} (${word.value})`,
                            //     onWordClick: (word, event) => console.log("Word clicked:", word),
                            // }}
                        />
                    </div>
                ) : (
                    <p className="no-data-small">Not enough text data to generate word cloud.</p>
                )}
            </div>
        );
    };
    // --- Render Logic ---
    const renderWordFrequencyTable = () => {
        if (!showWordCloud) return null;

        // Rest of the function remains the same...
        return (
            <div className="word-frequency-section">
                <h5>Top Words</h5>
                {wordFrequencies.length > 0 ? (
                    <div className="table-container compact-table-container">
                        <table className="analytics-table compact-table">
                            <thead>
                                <tr>
                                    <th>Word</th>
                                    <th>Frequency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wordFrequencies.slice(0, 20).map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.word}</td>
                                        <td>{item.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="no-data-small">No significant word frequencies found.</p>
                )}
            </div>
        );
    };
    const renderResponseSearchAndList = () => {
        if (!showResponseList) return null;

        const isSearching = searchTerm.trim() !== '';
        // Use totalResponseCount from analytics if available, fallback to array length
        const totalAvailableResponses = totalResponseCount;
        // Determine number shown based on search/limit/showAll state
        const numberToShow = isSearching ? displayedResponses.length : (showFullList ? totalAvailableResponses : Math.min(responseLimit, totalAvailableResponses));
        const listTitle = isSearching
            ? `Search Results (${displayedResponses.length})`
            : `Responses (${numberToShow} of ${totalAvailableResponses})`;

        // Rest of the function remains the same...
        return (
            <div className="response-search-section">
                <h5>Search & View Responses</h5>
                <input
                    type="text"
                    placeholder="Search responses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    style={{ width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <h6>{listTitle}</h6>
                {displayedResponses.length > 0 ? (
                    <div className="responses-list scrollable">
                        {displayedResponses.map((resp, index) => (
                            <div key={resp.id || `resp-${index}`} className="response-item">
                                <div className="response-meta">
                                   <span>{resp.username || 'Anonymous'}</span>
                                   <span>{resp.created_at ? new Date(resp.created_at).toLocaleString() : ''}</span>
                                </div>
                                <p className="response-content">{resp.text}</p>
                            </div>
                        ))}
                         {/* Toggle Show All/Fewer Button - Uses responseLimit from props */}
                         {!isSearching && totalAvailableResponses > responseLimit && (
                             <button
                                 onClick={() => setShowFullList(!showFullList)}
                                 className="show-all-btn"
                             >
                                 {showFullList ? `Show Fewer (Top ${responseLimit})` : `Show All ${totalAvailableResponses} Responses`}
                             </button>
                         )}
                    </div>
                ) : (
                    <p className="no-data-small">{isSearching ? 'No responses match your search.' : 'No responses available.'}</p>
                )}
            </div>
        );
    };

    // Main Component Return
    return (
        <div className="open-ended-display question-analytics-wrapper">
            {/* Optional: Render Question Text if needed, or assume parent does */}
            {/* <h4>{settings?.customTitle || question?.question_text}</h4> */}
            {renderWordCloudSection()}
            
            {renderResponseSearchAndList()}
        </div>
    );
};
OpenEndedDisplay.propTypes = {
    question: PropTypes.object, // Question object (optional but useful for context)
    analyticsDataExternal: PropTypes.object, // The analytics data object passed from parent
    settings: PropTypes.shape({ // Receive the settings object
        showWordCloud: PropTypes.bool,
        showDropdownResponses: PropTypes.bool,
        // Add other potential settings if needed
    }),
    pdfExportOptions: PropTypes.shape({ // Receive PDF export options
        openEndedResponseLimit: PropTypes.number,
    }),
};


// Add CSS for OpenEndedDisplay (in AnalyticsComponents.css or similar)
/*
.open-ended-display {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.open-ended-display h5 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.1em;
    color: #333;
    font-weight: 600;
}

.word-frequency-section {
    margin-bottom: 25px;
}

.response-search-section {
    margin-top: 25px;
    padding-top: 15px;
    border-top: 1px solid #eee;
}

.response-search-section h6 {
    font-size: 0.9em;
    color: #555;
    margin-bottom: 10px;
    font-weight: 500;
}

.search-input { // Example style
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 15px;
  box-sizing: border-box;
}
.search-input:focus {
  outline: none;
  border-color: #AA2EFF;
  box-shadow: 0 0 0 2px rgba(170, 46, 255, 0.1);
}


.table-container.compact-table-container {
    max-height: 300px; // Limit height of word freq table
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius: 4px;
}

.analytics-table.compact-table th,
.analytics-table.compact-table td {
    font-size: 0.9em; // Smaller font for compact table
    padding: 8px 10px;
}
.analytics-table.compact-table th {
    position: sticky; // Keep header visible
    top: 0;
    background-color: #f8f9fa; // Header background
}


.no-data-small {
    font-size: 0.9em;
    color: #888;
    text-align: center;
    padding: 15px;
    font-style: italic;
}

.responses-list.scrollable {
    max-height: 450px; // Max height before scrolling
    overflow-y: auto;
    border: 1px solid #eee;
    padding: 15px;
    border-radius: 4px;
    background: #fcfdff; // Slightly different background
}

.response-item {
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;
}

.response-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

.response-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: #777;
  margin-bottom: 5px;
}

.response-content {
    margin: 0;
    font-size: 0.95em;
    line-height: 1.6;
    color: #444;
    white-space: pre-wrap; // Preserve whitespace/newlines
    word-wrap: break-word;
}

.show-all-btn {
    display: block;
    margin: 15px auto 5px; // Center button
    font-size: 0.9em;
    background: none;
    border: 1px solid #AA2EFF;
    color: #AA2EFF;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
}
.show-all-btn:hover {
    background-color: rgba(170, 46, 255, 0.1);
}

*/


export default OpenEndedDisplay;