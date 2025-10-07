// src/components/AnalyticsComponents/ReportDownloadControl.js
import React, { useState, useRef, useEffect } from 'react'; // Added useEffect, useRef
import PropTypes from 'prop-types'; // Recommended
import toast from 'react-hot-toast';
import { reportTabAPI } from '../../services/apiClient'; // *** Use reportTabAPI ***
import './AnalyticsComponents.css';

// *** Receive filterState as a prop ***
const ReportDownloadControl = ({ surveyId, onGeneratePDF, disabled, filterState = {} }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false); // Loading state for Excel
    const dropdownRef = useRef(null);

    // --- Event Handlers ---
    const handleToggleDropdown = () => setIsDropdownOpen(prev => !prev);

    const handlePdfClick = () => {
        setIsDropdownOpen(false);
        if (typeof onGeneratePDF === 'function') {
            console.log("Triggering PDF generation...");
            onGeneratePDF(); // Trigger PDF generation passed from parent
        } else {
            console.error("onGeneratePDF prop is not a function or is missing.");
            toast.error("PDF generation function is not available.");
        }
    };

    // --- UPDATED Excel Click Handler ---
    const handleExcelClick = async () => {
        setIsDropdownOpen(false);
        if (!surveyId) {
             toast.error("Cannot generate Excel report: Survey ID is missing.");
             return;
        }

        setIsExportingExcel(true); // Set loading state
        toast.loading('Generating Excel export...', { id: 'excel-export-toast' });

        try {
            // *** Use reportTabAPI.exportExcelReport ***
            // *** Pass the filterState prop ***
            const response = await reportTabAPI.exportExcelReport(surveyId, filterState);

            // response from apiClient for blob is the response object itself
            const blob = response.data; // Blob is in response.data

            // --- Extract filename from Content-Disposition header ---
            const contentDisposition = response.headers['content-disposition'];
            let filename = `survey_${surveyId}_export_${Date.now()}.xlsx`; // Default filename
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            // --- End Filename Extraction ---

            // Create a link and trigger the download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel download started!', { id: 'excel-export-toast' });

        } catch (err) {
            console.error("Excel export error:", err);
             // Use error message from API if available
            const errorMsg = err.response?.data?.error || err.message || "Failed to generate Excel export.";
            toast.error(`Error: ${errorMsg}`, { id: 'excel-export-toast' });
        } finally {
             setIsExportingExcel(false); // Clear loading state
        }
    };
    // --- End UPDATED Excel Click Handler ---

    // --- Effect for closing dropdown on outside click --- (Keep as is)
    useEffect(() => { /* ... existing logic ... */ }, [isDropdownOpen]);

    return (
        <div className="report-download-control" ref={dropdownRef}>
            <button
                className="export-trigger-button chart-button primary"
                onClick={handleToggleDropdown}
                // Disable if PDF is generating OR Excel is exporting
                disabled={disabled || isExportingExcel}
                style={{ minWidth: '120px' }}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
            >
                <i className="ri-download-2-line"></i> Export
            </button>

            {isDropdownOpen && (
                <div className="export-dropdown-menu" role="menu">
                    {/* PDF Option */}
                    <div className="export-option" onClick={handlePdfClick} role="menuitem">
                        {/* ... PDF description ... */}
                         <div className="export-option-header">
                             <i className="ri-file-pdf-line"></i> PDF (Report)
                        </div>
                        <p className="export-option-desc">
                            Download your customized report as a PDF. Hidden questions and toggled-off tables will be excluded.
                        </p>
                    </div>
                    {/* Excel Option */}
                    <div
                        // Disable clicking while exporting Excel
                        className={`export-option ${isExportingExcel ? 'disabled' : ''}`}
                        onClick={!isExportingExcel ? handleExcelClick : undefined}
                        role="menuitem"
                        aria-disabled={isExportingExcel}
                    >
                        <div className="export-option-header">
                             <i className="ri-file-excel-line"></i> Excel (Raw Data)
                        </div>
                        <p className="export-option-desc">
                            Download raw survey data in Excel format. Each column represents a question; each row is a participant's full response.
                        </p>
                        {/* Optional: Show spinner or text while exporting */}
                        {isExportingExcel && <span style={{fontSize: '0.8em', color: '#AA2EFF', marginLeft: '10px'}}>(Generating...)</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Prop Types ---
ReportDownloadControl.propTypes = {
    surveyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onGeneratePDF: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    filterState: PropTypes.object // *** Add filterState prop ***
};

export default ReportDownloadControl;