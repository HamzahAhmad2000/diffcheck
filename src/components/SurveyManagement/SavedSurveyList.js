// SavedSurveyList.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import EditSurvey from './EditSurvey'; // EditSurvey logic moved to navigation
import '../../styles/fonts.css';
import '../../styles/SavedSurveyList.css';
import Sidebar from '../common/Sidebar';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { surveyAPI, baseURL, aiAPI } from '../../services/apiClient';


const SavedSurveyList = () => {
  const [surveys, setSurveys] = useState([]);
  // const [editingSurvey, setEditingSurvey] = useState(null); // Replaced by navigate
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(6);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); // State for open menu
  const menuRef = useRef(null); // Ref for click outside detection
  const [featuredSurveyIds, setFeaturedSurveyIds] = useState(new Set());

  const navigate = useNavigate();

  const fetchSurveys = async () => {
    try {
      const response = await surveyAPI.getAll();
      const data = response.data;
      if (Array.isArray(data)) {
        setSurveys(data);
        const featuredIds = new Set(data.filter(s => s.is_featured).map(s => s.id));
        setFeaturedSurveyIds(featuredIds);
      } else if (data.surveys && Array.isArray(data.surveys)) {
        setSurveys(data.surveys);
        const featuredIds = new Set(data.surveys.filter(s => s.is_featured).map(s => s.id));
        setFeaturedSurveyIds(featuredIds);
      } else {
        console.error('Invalid data format received:', data);
        setSurveys([]);
      }
    } catch (err) {
      console.error('Error fetching surveys:', err);
      setSurveys([]);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  // --- Click outside listener for menu ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        // Check if the click target is NOT the menu button itself
        if (!event.target.closest('.menu-button')) {
            setOpenMenuId(null); // Close the menu
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef]); // Re-run if menuRef changes (though it shouldn't often)
  // --- End Click outside listener ---

  const handleCopySurvey = async (id, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu
    if (!id) {
      alert('Survey id is undefined.');
      return;
    }
    try {
      const response = await surveyAPI.copy(id);
      if (response.status === 200 || response.status === 201) {
        alert('Survey copied successfully.');
        fetchSurveys();
      } else {
        alert('Copy failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error copying survey:', err);
      alert('An error occurred while copying the survey.');
    }
  };

  const handlePublishToggle = async (id, currentStatus, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu if open
    try {
      let response;
      if (currentStatus) {
        // Survey is currently published, so unpublish it
        console.log(`Unpublishing survey ${id}`);
        response = await surveyAPI.unpublish(id);
      } else {
        // Survey is currently unpublished, so publish it
        console.log(`Publishing survey ${id}`);
        response = await surveyAPI.publish(id);
      }
      
      if (response.status === 200) {
        // Success message depends on action
        alert(`Survey ${currentStatus ? 'unpublished' : 'published'} successfully.`);
        fetchSurveys(); // Refresh list
      } else {
        alert('Publish action failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error toggling publish status:', err);
      alert('An error occurred while updating publish status.');
    }
  };

  const handleFeatureToggle = async (id, currentStatus, e) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      let response;
      if (currentStatus) {
        response = await surveyAPI.unfeature(id);
      } else {
        response = await surveyAPI.feature(id);
      }
      if (response.status === 200) {
        // Update the local state immediately for better UX
        setSurveys(prevSurveys => 
          prevSurveys.map(survey => 
            survey.id === id 
              ? { ...survey, is_featured: !currentStatus }
              : survey
          )
        );
        // Update the featured set
        setFeaturedSurveyIds(prev => {
          const newSet = new Set(prev);
          if (currentStatus) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return newSet;
        });
        alert(`Survey ${currentStatus ? 'unfeatured' : 'featured'} successfully.`);
        // Still fetch surveys to ensure data consistency
        fetchSurveys();
      } else {
        alert('Action failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error toggling feature status:', err);
      alert('An error occurred while updating feature status.');
    }
  };

  const handleEditSurvey = (survey, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu
    navigate('/create-survey', {
      state: {
        editMode: true,
        surveyId: survey.id,
        // Pass business context if the survey is associated with a business
        ...(survey.business_id && { 
          businessId: survey.business_id, 
          businessName: survey.business_name // Ensure business_name is available in survey object
        })
      }
    });
  };

  const handleDeleteSurvey = async (id, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu
    if (!window.confirm("Are you sure you'd like to delete this survey? This action cannot be undone.")) return;
    try {
      const response = await surveyAPI.delete(id);
      if (response.status === 200 || response.status === 204) {
        alert('Survey deleted successfully.');
        fetchSurveys();
      } else {
        alert('Deletion failed: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting survey:', err);
      alert('An error occurred while deleting the survey.');
    }
  };

  const handleAnalytics = (id, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu
    navigate(`/analytics/${id}`);
  };

  // --- NEW: Handler for AI Response Generation ---
  const handleAIGenerateResponses = (id, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(null); // Close menu
    
    // Navigate to the new GenerateResponses component
    navigate(`/admin/surveys/${id}/generate-responses`);
  };

  // --- Open Schedule Modal ---
  const openScheduleModal = (survey, e) => {
    e.stopPropagation(); // Prevent card click
    setSelectedSurvey(survey);
    setStatusModalOpen(true);
    setScheduleDate(null); // Reset date picker
    setOpenMenuId(null); // Close menu if open
  };

  // --- Schedule Handlers remain the same ---
   const handleScheduleClose = async () => {
    if (!selectedSurvey || !scheduleDate) return;
    try {
      const response = await surveyAPI.publish(selectedSurvey.id, {
        // published: true, // Keep it published or re-publish if it was closed
        closeDate: scheduleDate.toISOString()
      });
      if (response.status === 200) {
        fetchSurveys();
        setStatusModalOpen(false);
        alert('Survey scheduled to close successfully.');
      } else {
        alert('Failed to schedule survey closure: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Error scheduling survey closure:', e);
      alert('An error occurred while scheduling closure.');
    }
  };

  const handleScheduleOpen = async () => {
    if (!selectedSurvey || !scheduleDate) return;
    try {
      const response = await surveyAPI.publish(selectedSurvey.id, {
        // published: false, // Let backend handle status based on open date vs now
        openDate: scheduleDate.toISOString()
      });
      if (response.status === 200) {
        fetchSurveys();
        setStatusModalOpen(false);
        alert('Survey scheduled to open successfully.');
      } else {
        alert('Failed to schedule survey opening: ' + (response.data?.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Error scheduling survey opening:', e);
      alert('An error occurred while scheduling opening.');
    }
  };
  // --- End Schedule Handlers ---


  // Filter and Pagination Logic (remains the same)
  const filteredSurveys = surveys
    .slice() // Create a copy before filtering
    .filter(survey =>
      survey.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const totalSurveys = filteredSurveys.length;
  const totalPages = Math.ceil(totalSurveys / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);
  const handleEntriesChange = (e) => {
    setEntriesPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };
  const handlePrevPage = () => currentPage > 1 && setCurrentPage(prev => prev - 1);
  const handleNextPage = () => currentPage < totalPages && setCurrentPage(prev => prev + 1);

  const handleSurveyClick = (id, e) => {
     // Prevent redirect if clicking on interactive elements within the card
     if (e.target.closest('.card-top-controls, .menu-button, .card-action-menu, .toggle-switch-label, .icon-button')) {
      return;
    }
    navigate(`/survey/${id}`); // Or /analytics/${id} if preferred
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);
      if (currentPage <= 3) {
        pageNumbers.push(2, 3, 4, 'ellipsis', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pageNumbers.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
      }
    }
    return pageNumbers;
  };

  // --- Toggle Menu ---
  const toggleMenu = (id, e) => {
    e.stopPropagation(); // Prevent card click
    setOpenMenuId(openMenuId === id ? null : id);
  };
  // --- End Toggle Menu ---

  return (
    <div className="saved-surveys-container">
      <Sidebar />
      <div className="main-content">
        {/* Header Controls (remain the same) */}
        <div className="header-controls">
          <div className="entries-control">
            <span className="entries-text">Show</span>
            <select value={entriesPerPage} onChange={handleEntriesChange} className="entries-select">
              <option value={6}>6</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="entries-text">Entries</span>
          </div>
          <div className="search-add-section">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {/* Optional: Add back icon if needed <i className="ri-search-line search-icon"></i> */}
            </div>
            <button onClick={() => navigate('/dashboard')} className="add-button">
              <i className="ri-add-line"></i>
              New Survey
            </button>
          </div>
        </div>

        {/* Surveys Grid */}
        <div className="surveys-grid">
          {currentSurveys.length > 0 ? (
            currentSurveys.map((survey, index) => (
              <div
                key={survey.id || index}
                className={`survey-card ${survey.published ? 'open-card' : 'closed-card'} ${survey.is_featured ? 'newfeatured-card' : ''}`}
                onClick={(e) => handleSurveyClick(survey.id, e)}
              >
                {/* --- Top Controls: Toggle, Calendar, Menu --- */}
                <div className="card-top-controls">
                    {/* Status Toggle */}
                    <label className="toggle-switch-label" onClick={(e) => e.stopPropagation()} title={survey.published ? 'Click to Close Now' : 'Click to Publish Now'}>
                      <input
                        type="checkbox"
                        className="toggle-switch-input"
                        checked={survey.published}
                        onChange={(e) => handlePublishToggle(survey.id, survey.published, e)}
                      />
                      <span className="toggle-switch-slider"></span>
                    </label>
                     {/* Schedule Icon */}
                    <button
                      className="icon-button calendar-button"
                      title="Schedule Open/Close"
                      onClick={(e) => openScheduleModal(survey, e)}
                      >
                      <i className="ri-calendar-event-line"></i>
                    </button>
                     {/* Feature Icon */}
                    <button
                      className="icon-button star-button"
                      title={survey.is_featured ? 'Unfeature' : 'Feature'}
                      onClick={(e) => handleFeatureToggle(survey.id, survey.is_featured, e)}
                    >
                      <i className={survey.is_featured ? 'ri-star-fill' : 'ri-star-line'}></i>
                    </button>
                     {/* Menu Icon */}
                    <button
                        className="icon-button menu-button"
                        title="Actions"
                        onClick={(e) => toggleMenu(survey.id, e)}
                    >
                        <i className="ri-more-2-fill"></i>
                    </button>
                </div>

                 {/* --- Action Menu Dropdown --- */}
                {openMenuId === survey.id && (
                    <div className="card-action-menu" ref={menuRef}>
                        <button className="menu-item" onClick={(e) => handleAnalytics(survey.id, e)}>
                            <i className="ri-bar-chart-line"></i> View Analytics
                        </button>
                        <button className="menu-item" onClick={(e) => handleEditSurvey(survey, e)}>
                            <i className="ri-pencil-line"></i> Edit Survey
                        </button>
                        <button className="menu-item" onClick={(e) => handleCopySurvey(survey.id, e)}>
                            <i className="ri-file-copy-line"></i> Duplicate
                        </button>
                        <button className="menu-item" onClick={(e) => openScheduleModal(survey, e)}>
                            <i className="ri-time-line"></i> Schedule
                        </button>
                        <button className="menu-item" onClick={(e) => handleAIGenerateResponses(survey.id, e)}>
                            <i className="ri-database-2-line"></i> Generate Test Data
                        </button>
                        <button className="menu-item" onClick={(e) => handleFeatureToggle(survey.id, survey.is_featured, e)}>
                            <i className={survey.is_featured ? 'ri-star-fill' : 'ri-star-line'}></i> {survey.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button className="menu-item delete" onClick={(e) => handleDeleteSurvey(survey.id, e)}>
                            <i className="ri-delete-bin-line"></i> Delete
                        </button>
                    </div>
                )}


                {/* Status Banner (can keep or remove if toggle is sufficient) */}
                {/* <div className={`survey-status-banner ${survey.published ? 'open' : 'closed'}`}>
                  {survey.published ? 'OPEN' : 'CLOSED'}
                </div> */}

                <div className="survey-image">
                  <img
                    src={survey.branding ? `${baseURL}${survey.branding}` : `${baseURL}/uploads/default.png`}
                    alt={survey.title || 'Survey thumbnail'}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${baseURL}/uploads/default.png`;
                    }}
                  />
                </div>

                <div className="survey-content">
                  <h3 className="survey-title">
                    {survey.title || 'This is a title of a survey.'}
                  </h3>
                  <p className="survey-description">
                    {survey.description || 'Short description of the survey.'}
                  </p>
                  <div className="survey-meta">
                    <span className="survey-responses">
                      <i className="ri-user-3-line"></i> {/* Changed icon */}
                      {survey.responseCount || 0} Responses
                    </span>
                    {/* Display Scheduled Dates */}
                     {survey.open_date && new Date(survey.open_date) > new Date() && !survey.published && (
                       <span className="survey-schedule-info scheduled-open">
                          <i className="ri-time-line"></i> {/* Changed icon */}
                          Opens: {new Date(survey.open_date).toLocaleTimeString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                       </span>
                    )}
                    {survey.close_date && new Date(survey.close_date) > new Date() && survey.published && (
                       <span className="survey-schedule-info scheduled-close">
                           <i className="ri-timer-flash-line"></i> {/* Changed icon */}
                           Closes: {new Date(survey.close_date).toLocaleTimeString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                       </span>
                    )}
                  </div>
                   {/* REMOVED OLD survey-actions div */}
                </div>
              </div>
            ))
          ) : (
            <div className="nonew-surveys">
              <p>No surveys found. Click the "New Survey" button to create one!</p>
            </div>
          )}
        </div>

        {/* Status Modal (remains the same) */}
        {statusModalOpen && selectedSurvey && (
          <div className="status-modal">
            <div className="status-modal-content">
              {/* Title changes based on current status */}
              <h3 style={{ color: '#aa2eff' }}>
                  Schedule Survey { new Date(selectedSurvey.open_date) > new Date() && !selectedSurvey.published ? 'Opening' : 'Closure' }
              </h3>
              <p style={{fontSize: '13px', color: '#555', marginTop: '-10px'}}>Select a future date and time.</p>
              <DatePicker
                selected={scheduleDate}
                onChange={(date) => setScheduleDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText="Select date and time"
                className="styled-datepicker"
                minDate={new Date()} // Prevent scheduling in the past
              />
              <div className="modal-buttons">
                {/* Button text/action changes based on status */}
                 { new Date(selectedSurvey.open_date) > new Date() && !selectedSurvey.published ? (
                     <button
                         onClick={handleScheduleOpen}
                         className="schedule-button confirm" // Added confirm class
                         disabled={!scheduleDate}
                     >
                         Schedule Open
                     </button>
                 ) : (
                     <button
                         onClick={handleScheduleClose}
                         className="schedule-button confirm" // Added confirm class
                         disabled={!scheduleDate}
                     >
                         Schedule Close
                     </button>
                 )}
                <button onClick={() => setStatusModalOpen(false)} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination (remains the same) */}
        <div className="paginationnew">
           <div className="paginationnew-info">
            Showing {startIndex + 1}-{Math.min(endIndex, totalSurveys)} of {totalSurveys} entries
          </div>
           <div className="paginationnew-controls">
            <span className={`paginationnew-prev ${currentPage === 1 ? 'disabled' : ''}`} onClick={handlePrevPage}>Prev</span>
            {getPageNumbers().map((pageNum, index) =>
              pageNum === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="paginationnew-ellipsis">...</span>
              ) : (
                <button key={pageNum} className={`paginationnew-button ${currentPage === pageNum ? 'active' : 'inactive'}`} onClick={() => handlePageChange(pageNum)}>
                  {pageNum}
                </button>
              )
            )}
            <span className={`paginationnew-next ${currentPage === totalPages ? 'disabled' : ''}`} onClick={handleNextPage}>Next</span>
          </div>
        </div>
      </div>

       {/* Edit Survey Component is no longer rendered here, handled by navigation */}
       {/* {editingSurvey && (
         <EditSurvey surveyId={editingSurvey} onClose={handleCloseEdit} />
       )} */}
    </div>
  );
};

export default SavedSurveyList;