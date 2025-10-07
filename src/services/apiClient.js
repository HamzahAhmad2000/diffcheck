// apiClient.js - Updated paths based *only* on provided response.py
import axios from 'axios';

// Backend base URL. Can be overridden with REACT_APP_API_BASE_URL
const baseURL = process.env.REACT_APP_API_BASE_URL  ||  'http://localhost:5000'; // Default to localhost for local development
// const baseURL = 'http://localhost:5000';
const apiClient = axios.create({
  baseURL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true' // Bypass ngrok warning page
  },
  withCredentials: true // Important for cookies/session
});

// Prevent multiple parallel 401 handlers from racing
let isHandlingUnauthorized = false;

// Add request interceptor to add auth token
apiClient.interceptors.request.use(
  config => {
    // Log outgoing requests for debugging
    console.log(`Making ${config.method.toUpperCase()} request to ${config.url}`);

    // Add auth token if available
    const token = localStorage.getItem('token'); // Changed from 'authToken' to 'token'
    if (token) {
      // Basic JWT format validation before sending
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.error('Malformed JWT token detected, removing from localStorage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        // Don't add Authorization header for malformed tokens
      }
    } else {
      console.warn(`No token found for ${config.method?.toUpperCase()} request to ${config.url}`);
    }
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API_CLIENT] ✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`[API_CLIENT] ❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'Network Error'}`);
    console.error('[API_CLIENT] Error response:', error.response?.data);
    
    if (error.response?.status === 401) {
      console.warn('[API_CLIENT] 401 Unauthorized - Token may be expired or invalid');
      // Always clear local session and force a redirect to login once
      if (!isHandlingUnauthorized) {
        isHandlingUnauthorized = true;
        try {
          const token = localStorage.getItem('token');
          // Best-effort server logout to clear cookies; ignore failures
          fetch(`${baseURL}/auth/logout`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          }).catch(() => {});
        } catch (_) {}
        // Clear all app auth/user state
        try { localStorage.clear(); } catch (_) {}
        // Redirect to login if not already there
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    }
    
    // Handle ngrok HTML response error
    if (typeof error.response?.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
       console.error('Received HTML instead of JSON. Check API URL / ngrok tunnel.');
       return Promise.reject(new Error('API connection error: Received HTML instead of data.'));
    }

    // Create a more informative error object
    const customError = new Error(error.response?.data?.error || error.message || 'An API error occurred');
    customError.response = error.response;
    customError.request = error.request;
    customError.config = error.config;
    return Promise.reject(customError);
  }
);

// Auth API endpoints (Paths NOT verified by response.py)
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  loginWithPasskey: (data) => apiClient.post('/auth/login-passkey', data),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: () => {
    console.log('[AUTH_API] Logging out');
    return apiClient.post('/auth/logout');
  },
  getCurrentUser: () => {
    console.log('[AUTH_API] Checking current user');
    return apiClient.get('/auth/me');
  },
  registerAdmin: (adminData) => apiClient.post('/auth/admin/register', adminData),
  validateToken: () => {
    console.log('[AUTH_API] Validating token');
    return apiClient.get('/auth/validate-token');
  },
  // Multi-Step Registration
  initiateRegistrationStep1: (data) => apiClient.post('/auth/register/initiate', data),
  verifyEmail: (token) => apiClient.get('/auth/register/verify-email', { params: { token } }),
  verifyOtp: ({ email, pin }) => apiClient.post('/auth/verify-otp', { email, pin }),
  resendOtp: ({ email }) => apiClient.post('/auth/resend-otp', { email }),
  completeRegistrationStep2Profile: (profileDataWithToken) => apiClient.post('/auth/register/profile', profileDataWithToken),

  completeRegistrationStep4Security: (securityDataWithToken) => apiClient.post('/auth/register/complete', securityDataWithToken),
  // Forgot Password
  initiatePasswordResetEmail: (emailData) => apiClient.post('/auth/forgot-password/initiate-email', emailData),
  fetchSecurityQuestionsForEmail: (emailData) => apiClient.post('/auth/forgot-password/get-questions', emailData),
verifySecurityAnswers: (answersData) => apiClient.post('/auth/forgot-password/verify-questions', answersData),
  verifyPasskeyRecovery: (passkeyData) => apiClient.post('/auth/forgot-password/verify-passkey', passkeyData),
  resetPasswordWithToken: (resetData) => apiClient.post('/auth/reset-password', resetData),
  getCurrentUserDetails: () => apiClient.get('/auth/me'),
  getAvailableSecurityQuestions: (tempToken) => apiClient.get('/auth/security/questions/available', {
    headers: { 'Authorization': `Bearer ${tempToken}` }
  }),
  // Discord OAuth endpoints
  initiateDiscordOAuth: () => apiClient.get('/linking/discord/initiate'),
  inviteDiscordBot: (businessId) => apiClient.get('/linking/discord/bot-invite', {
    params: businessId ? { business_id: businessId } : {}
  }),
  setupMFA: (dataWithToken) => apiClient.post('/auth/security/mfa/setup', dataWithToken),
  verifyMFA: (mfaVerifyDataWithToken) => apiClient.post('/auth/security/mfa/verify', mfaVerifyDataWithToken),
  setSecurityQuestions: (questionsDataWithToken) => apiClient.post('/auth/security/questions/set', questionsDataWithToken),
  generatePasskeys: (dataWithToken) => apiClient.post('/auth/security/passkeys/generate', dataWithToken),
  verifyMfaLogin: (data) => apiClient.post('/auth/verify-mfa-login', data),
};

// User Profile & Gamification API
export const userProfileAPI = {
  getProfile: () => apiClient.get('/api/profile'),
  updateProfile: (profileData) => apiClient.put('/api/profile', profileData),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  // New method for changing password
  changePassword: (passwordData) => apiClient.post('/api/profile/change-password', passwordData),
  // New method for getting linked accounts
  getLinkedAccounts: () => apiClient.get('/api/profile/linked-accounts'),
  // New method for unlinking a social account
  unlinkSocialAccount: (provider) => apiClient.delete(`/api/profile/linked-accounts/${provider}`),
  // Method for dashboard overview
  getDashboardOverview: () => apiClient.get('/api/profile/dashboard-overview'),
  getMyBadges: () => apiClient.get('/api/profile/my-badges'),
  getBadgeOverview: () => apiClient.get('/api/profile/badge-overview'),
  // Claim any newly earned badges
  claimBadges: () => apiClient.post('/api/profile/claim-badges'),
  
  // Admin ProfileTag Management
  adminGetProfileTags: (params) => apiClient.get('/api/admin/profile-tags', { params }),
  adminCreateProfileTag: (data) => apiClient.post('/api/admin/profile-tags', data),
  adminUpdateProfileTag: (tagId, data) => apiClient.put(`/api/admin/profile-tags/${tagId}`, data),
  adminDeleteProfileTag: (tagId) => apiClient.delete(`/api/admin/profile-tags/${tagId}`),
  
  // Admin User Management  
  adminGetAllUsers: (params = {}) => apiClient.get('/api/admin/users', { params }),

  // Security-related APIs - using /auth/security/* endpoints (not /api/security/*)
  setupMFA: () => apiClient.post('/auth/security/mfa/setup'),
  verifyMFA: (data) => apiClient.post('/auth/security/mfa/verify', data),
  disableMFA: (data) => apiClient.post('/auth/security/mfa/disable', data),
  getAvailableSecurityQuestions: () => apiClient.get('/auth/security/questions/available'),
  setSecurityQuestions: (data) => apiClient.post('/auth/security/questions/set', data),
  generatePasskeys: () => apiClient.post('/auth/security/passkeys/generate'),
  
  // Welcome popup tracking
  markWelcomePopupSeen: () => apiClient.post('/api/profile/welcome-popup-seen'),
  
  // Admin user management
  adminGetAllUsers: (params = {}) => apiClient.get('/api/admin/users', { params }),
};

// Badge API endpoints
export const badgeAPI = {
  // Admin Badge Management
  adminGetBadges: () => apiClient.get('/api/admin/badges'),
  adminGetBadgeById: (badgeId) => apiClient.get(`/api/admin/badges/${badgeId}`),
  adminCreateBadge: (formData) => apiClient.post('/api/admin/badges', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  adminUpdateBadge: (badgeId, formData) => apiClient.put(`/api/admin/badges/${badgeId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  adminDeleteBadge: (badgeId) => apiClient.delete(`/api/admin/badges/${badgeId}`),
  
  // Public Badge Access
  getAvailableBadges: () => apiClient.get('/badges/available'),
};

// Admin API endpoints for user management
export const adminAPI = {
  getAllUsers: (params = {}) => apiClient.get('/api/admin/users', { params }),
  getAllSuperAdmins: (params = {}) => apiClient.get('/api/admin/super-admins', { params }),
  deleteUser: (userId) => apiClient.delete(`/api/admin/users/${userId}`),
  deleteSuperAdmin: (adminId) => apiClient.delete(`/api/admin/super-admins/${adminId}`),
  toggleUserStatus: (userId) => apiClient.post(`/api/admin/users/${userId}/toggle-status`),
  getAdminStats: () => apiClient.get('/api/admin/stats'),
  // Admin User Management (Example, adjust as needed)
  getUsers: (params) => apiClient.get('/api/admin/users', { params }),
  getUserDetails: (userId) => apiClient.get(`/api/admin/users/${userId}`),
  updateUser: (userId, data) => apiClient.put(`/api/admin/users/${userId}`, data),
  getBusinessNames: (data) => apiClient.post('/api/businesses/names', data),

  // General Admin actions related to site settings or overview data
  getSiteStats: () => apiClient.get('/api/admin/stats'), // Example
};

// Survey API endpoints
export const surveyAPI = {
  // Business-scoped survey operations
  getBusinessSurvey: (businessId, surveyId) => apiClient.get(`/api/businesses/${businessId}/surveys/${surveyId}`),
  updateBusinessSurvey: (businessId, surveyId, surveyData) => apiClient.put(`/api/businesses/${businessId}/surveys/${surveyId}`, surveyData),
  createBusinessSurvey: (businessId, surveyData) => apiClient.post(`/api/businesses/${businessId}/surveys`, surveyData),
  deleteBusinessSurvey: (businessId, surveyId) => apiClient.delete(`/api/businesses/${businessId}/surveys/${surveyId}`),
  publishBusinessSurvey: (businessId, surveyId) => apiClient.patch(`/api/businesses/${businessId}/surveys/${surveyId}/publish`),
  unpublishBusinessSurvey: (businessId, surveyId) => apiClient.patch(`/api/businesses/${businessId}/surveys/${surveyId}/unpublish`),
  copyBusinessSurvey: (businessId, surveyId, data = {}) => apiClient.post(`/api/businesses/${businessId}/surveys/${surveyId}/copy`, data),

  // Public survey access (for panelists taking surveys)
  getPublicSurveyById: (id) => apiClient.get(`/api/surveys/${id}`),
  getAccessibleSurveys: async (params) => {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/api/surveys/accessible?${queryParams}` : '/api/surveys/accessible';
    const response = await apiClient.get(url);
    return response.data;
  },

  // NEW SURVEY FLOW ENDPOINTS
  getAvailableSurveys: () => {
    console.log('[SURVEY_API] Fetching available surveys with XP and time calculations');
    return apiClient.get('/api/surveys/available');
  },
  getPublicSurveys: () => {
    console.log('[SURVEY_API] Fetching public surveys including super admin surveys');
    return apiClient.get('/api/surveys/public');
  },

  // Legacy/Super Admin general routes (for admin/edit views)
  getAll: () => apiClient.get('/api/surveys'),
  getById: (id) => {
    console.log(`[SURVEY_API] Fetching survey ${id}`);
    return apiClient.get(`/api/surveys/${id}`);
  },
  create: (surveyData) => apiClient.post('/api/surveys', surveyData),
  update: (id, surveyData) => apiClient.put(`/api/surveys/${id}/admin`, surveyData),
  delete: (id) => {
    console.log(`[SURVEY_API] Deleting survey ${id}`);
    return apiClient.delete(`/api/surveys/${id}/admin`);
  },
  publish: (id) => {
    console.log(`[SURVEY_API] Publishing survey ${id}`);
    return apiClient.patch(`/api/surveys/${id}/admin/publish`);
  },
  unpublish: (id) => {
    console.log(`[SURVEY_API] Unpublishing survey ${id}`);
    return apiClient.patch(`/api/surveys/${id}/admin/unpublish`);
  },
  copy: (id, data = {}) => apiClient.post(`/api/surveys/${id}/admin/copy`, data),

  // Common operations that work for both business and general surveys
  getLinks: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/links`),
  exportPdf: (surveyId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/export-pdf`, { filters }, { responseType: 'blob' }),
  submitResponse: (surveyId, responseData) => apiClient.post(`/api/surveys/${surveyId}/submit`, { ...responseData, survey_id: parseInt(surveyId) }),
  getResponses: (surveyId, params) => apiClient.get(`/api/surveys/${surveyId}/live-responses`, { params }),
  getLiveResponses: (surveyId, params) => apiClient.get(`/api/surveys/${surveyId}/live-responses`, { params }),
  exportResponses: (surveyId, format, params) => apiClient.get(`/api/surveys/${surveyId}/export-responses`, {
    params: { ...params, format },
    responseType: 'blob'
  }),
  getSummary: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/report-summary`),
  getMergedAnalytics: (surveyId, linkIds) => apiClient.post(`/api/surveys/${surveyId}/merged-analytics`, { link_ids: linkIds }),
  getDropoutAnalysis: (surveyId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/dropout-analysis`, { filters }),
  getResponseTimesAdvanced: (surveyId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/response-times-advanced`, { filters }),
  getDemographicAnalytics: (surveyId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/demographic-analytics`, { filters }),
  getFilteredQuestionAnalytics: (surveyId, questionId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/questions/${questionId}/filtered-analytics`, { filters }),
  getOpenEndedWithUsers: (surveyId, questionId, limit = 15) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/openended-with-users`, { params: { limit } }),
  generateRandomResponses: (surveyId, count) => {
    console.log(`[SURVEY_API] Generating ${count} random responses for survey ${surveyId}`);
    return apiClient.post(`/api/surveys/${surveyId}/generate-responses`, { count });
  },
  getPublicSurveyFeed: (page = 1, perPage = 10, tags = '') => {
    console.log(`[SURVEY_API] Fetching public survey feed page: ${page}, tags: ${tags}`);
    let url = `/api/surveys/public-feed?page=${page}&per_page=${perPage}`;
    if (tags && tags.length > 0) {
      url += `&tags=${encodeURIComponent(tags)}`;
    }
    return apiClient.get(url);
  },
  adminDeleteSurvey: (businessId, surveyId) => apiClient.delete(`/api/businesses/${businessId}/surveys/${surveyId}`),
  adminGetSurveyResponses: (businessId, surveyId) => apiClient.get(`/api/businesses/${businessId}/surveys/${surveyId}/responses`),
  // --- Feature / Unfeature ---
  feature: (id) => apiClient.patch(`/api/surveys/${id}/admin/feature`, { featured: true }),
  unfeature: (id) => apiClient.patch(`/api/surveys/${id}/admin/feature`, { featured: false }),

  // NEW: Optimized survey fetching
  getAccessibleSurveysOptimized: (businessId = null) => {
    const params = businessId ? { business_id: businessId } : {};
    return apiClient.get('/api/surveys/accessible-optimized', { params });
  },
  
  // NEW: Discord role management
  updateSurveyDiscordRoles: (businessId, surveyId, data) => {
    return apiClient.put(`/api/businesses/${businessId}/surveys/${surveyId}/discord-roles`, data);
  },
  
  // NEW: Direct access link generation
  generateDirectAccessLink: (businessId, surveyId) => {
    return apiClient.post(`/api/businesses/${businessId}/surveys/${surveyId}/direct-access`);
  },

  // NEW: Direct access survey retrieval
  getSurveyWithDirectAccess: (surveyId, directToken) => {
    return apiClient.get(`/api/surveys/${surveyId}/direct`, {
      params: { direct_token: directToken }
    });
  },
};

// Question Bank API (Paths NOT verified by response.py)
export const questionBankAPI = {
  getAll: () => apiClient.get('/api/question-bank'),
  getByCategory: (category) => apiClient.get(`/api/question-bank/category/${category}`),
  createQuestion: (question) => apiClient.post('/api/question-bank', question),
  updateQuestion: (id, question) => apiClient.put(`/api/question-bank/${id}`, question),
  deleteQuestion: (id) => apiClient.delete(`/api/question-bank/${id}`)
};

export const reportTabAPI = {
  /** Get survey structure and available filter options. */
  getBaseData: (surveyId) => {
    console.log(`[REPORT_API] Fetching base data for survey ${surveyId}`);
    return apiClient.get(`/pdf-reporting/surveys/${surveyId}/report/base-data`);
  },

  /** Get filtered/compared analytics data. */
  getReportData: (surveyId, filters = {}, comparison = null) => {
    console.log(`[REPORT_API] Fetching report data for survey ${surveyId}`, { filters, comparison });
    return apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/report-data`, {
      filters: filters || {}, // Ensure filters is an object
      comparison: comparison // Pass comparison object (null if none)
    });
  },

  /** Get the count of submissions matching filters. */
  getFilteredCount: (surveyId, filters = {}) => {
    console.log(`[REPORT_API] Getting filtered count for survey ${surveyId}`, { filters });
    return apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/filtered-count`, {
      filters: filters || {}
    });
  },

  /** Get counts per segment for a comparison dimension. */
  getSegmentCounts: (surveyId, dimension, baseFilters = {}) => {
    console.log(`[REPORT_API] Getting segment counts for survey ${surveyId}`, { dimension, baseFilters });
    return apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/segment-counts`, {
      dimension,
      base_filters: baseFilters || {}
    });
  },

  /** Get default report settings (uses placeholder user ID on backend). */
  getReportSettings: (surveyId) =>
    apiClient.get(`/pdf-reporting/surveys/${surveyId}/report/settings`),

  /** Save default report settings (uses placeholder user ID on backend). */
  saveReportSettings: (surveyId, settings) =>
    apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/settings`, {
      settings // Send the full settings object
    }),

  /** List named saved views (uses placeholder user ID on backend). */
  listSavedViews: (surveyId) =>
    apiClient.get(`/pdf-reporting/surveys/${surveyId}/report/views`),

  /** Save a new named view (uses placeholder user ID on backend). */
  saveNamedView: (surveyId, name, settingsSnapshot) =>
    apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/views`, {
      name,
      settingsSnapshot
    }),

  /** Load settings for a specific named view by ID or name (uses placeholder user ID). */
  loadNamedView: (surveyId, viewIdentifier) =>
    apiClient.get(`/pdf-reporting/surveys/${surveyId}/report/views/${encodeURIComponent(viewIdentifier)}`), // Ensure identifier is URL encoded

  /** Delete a specific named view by ID or name (uses placeholder user ID). */
  deleteNamedView: (surveyId, viewIdentifier) =>
    apiClient.delete(`/pdf-reporting/surveys/${surveyId}/report/views/${encodeURIComponent(viewIdentifier)}`), // Ensure identifier is URL encoded

  /** Export filtered raw data to Excel. */
  exportExcelReport: (surveyId, filters = {}) =>
    apiClient.post(`/pdf-reporting/surveys/${surveyId}/report/export-excel`, {
      filters: filters || {}
    }, {
      responseType: 'blob' // Expect a file blob back
    })
};

// Public Business API endpoints (New)
export const publicBusinessAPI = {
  /** List all active and approved businesses for public discovery */
  listBusinesses: (params) => apiClient.get('/api/public/businesses', { params }),
  
  /** Get public details for a specific business for splash page */
  getBusinessDetails: (businessId) => apiClient.get(`/api/public/businesses/${businessId}`),
  
  /** Get public activity feed for a specific business */
  getBusinessActivities: (businessId, params) => apiClient.get(`/api/public/businesses/${businessId}/feed`, { params }),
  
  /** Get publicly accessible surveys for a specific business */
  getBusinessSurveys: (businessId, params) => {
    console.log(`[PUBLIC_BUSINESS_API] Fetching surveys for business ${businessId}`);
    return apiClient.get(`/api/public/businesses/${businessId}/surveys`, { params });
  },
};

// Business Admin API endpoints (Updated)
export const businessAPI = {
  /** List all businesses (Admin only) */
  listAll: (params) => apiClient.get('/api/businesses', { params }),
  
  /** Create a new business (Super Admin only) */
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return apiClient.post('/api/businesses', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  /** Request business creation (User) */
  requestCreation: (requestData) => apiClient.post('/api/businesses/request', requestData),
  
  /** Approve business request (Super Admin only) */
  approveRequest: (businessId) => apiClient.put(`/api/businesses/${businessId}/approve`),
  
  /** Reject business request (Super Admin only) */
  rejectRequest: (businessId) => apiClient.delete(`/api/businesses/${businessId}/request`),
  
  /** Get business details (Admin access) */
  getDetails: (id) => apiClient.get(`/api/businesses/${id}`),
  
  /** Update business details (Super Admin only) */
  update: (id, data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return apiClient.put(`/api/businesses/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  /** Update business branding logo (Super Admin or Business Admin with permission) */
  updateBranding: (businessId, brandingData) => apiClient.put(`/api/businesses/${businessId}/branding`, brandingData),
  
  /** Delete business (Super Admin only) */
  delete: (businessId) => apiClient.delete(`/api/businesses/${businessId}`),
  
  /** Get surveys for specific business */
  getSurveysForBusiness: (businessId, params = {}) => apiClient.get(`/api/businesses/${businessId}/surveys`, { params }),
  
  /** Create survey for business */
  createSurveyForBusiness: (businessId, surveyData) => apiClient.post(`/api/businesses/${businessId}/surveys`, surveyData),
  
  /** Update survey for business */
  updateSurveyForBusiness: (businessId, surveyId, surveyData) => apiClient.put(`/api/businesses/${businessId}/surveys/${surveyId}`, surveyData),
  
  /** Delete survey from business */
  deleteSurveyFromBusiness: (businessId, surveyId) => apiClient.delete(`/api/businesses/${businessId}/surveys/${surveyId}`),
  
  /** Publish survey for business */
  publishSurveyForBusiness: (businessId, surveyId) => apiClient.patch(`/api/businesses/${businessId}/surveys/${surveyId}/publish`),
  
  /** Unpublish survey for business */
  unpublishSurveyForBusiness: (businessId, surveyId) => apiClient.patch(`/api/businesses/${businessId}/surveys/${surveyId}/unpublish`),
  
  /** Copy survey for business */
  copySurveyForBusiness: (businessId, surveyId, data = {}) => apiClient.post(`/api/businesses/${businessId}/surveys/${surveyId}/copy`, data),
  
  /** Get business activities for admin view */
  getActivities: (businessId, params) => apiClient.get(`/api/businesses/${businessId}/activities`, { params }),
  
  /** Create custom post for business feed */
  createCustomPost: (businessId, postData) => apiClient.post(`/api/businesses/${businessId}/activities/custom-post`, postData),
  
  /** Update activity visibility */
  updateActivityVisibility: (activityId, updateData) => apiClient.put(`/api/activities/${activityId}/visibility`, updateData),
  
  /** Delete activity */
  deleteActivity: (activityId) => apiClient.delete(`/api/activities/${activityId}`),

  /** Get survey audience settings */
  getSurveyAudienceSettings: (businessId, surveyId) => apiClient.get(`/api/businesses/${businessId}/surveys/${surveyId}/audience`),
  
  /** Update survey audience settings */
  updateSurveyAudienceSettings: (businessId, surveyId, settings) => apiClient.put(`/api/businesses/${businessId}/surveys/${surveyId}/audience`, settings),
  
  /** Get survey responses */
  getSurveyResponses: (businessId, surveyId, params = {}) => apiClient.get(`/api/businesses/${businessId}/surveys/${surveyId}/responses`, { params }),
  
  /** Export survey responses */
  exportSurveyResponses: (businessId, surveyId, format = 'csv') => apiClient.get(`/api/businesses/${businessId}/surveys/${surveyId}/export`, {
    params: { format },
    responseType: 'blob'
  }),
  
  /** Get survey analytics */
  getSurveyAnalytics: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/analytics`),
  
  /** Get survey question analytics */
  getSurveyQuestionAnalytics: (surveyId, questionId) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/analytics`),
  
  /** Get survey response trends */
  getSurveyResponseTrends: ( surveyId, timeframe = 'daily') => apiClient.get(`/api/surveys/${surveyId}/response-trends`, {
    params: { timeframe }
  }),
  
  /** Get survey completion rate */
  getSurveyCompletionRate: ( surveyId) => apiClient.get(`/api/surveys/${surveyId}/completion-rate`),
  
  /** Get survey dropout analysis */
  getSurveyDropoutAnalysis: ( surveyId, filters ={}) => apiClient.post(`/api/surveys/${surveyId}/dropout-analysis`, { filters }),
  
  /** Get survey demographic analytics */
  getSurveyDemographicAnalytics: ( surveyId, filters ={}) => apiClient.post(`/api/surveys/${surveyId}/demographic-analytics`, { filters }),
  
  /** Get filtered question analytics */
  getFilteredQuestionAnalytics: ( surveyId, questionId, filters ={}) => apiClient.post(`/api/surveys/${surveyId}/questions/${questionId}/filtered-analytics`, { filters }),
  
  /** Get open-ended responses with user info */
  getOpenEndedWithUsers: (surveyId, questionId, limit = 15) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/openended-with-users`, {
    params: { limit }
  }),
  
  /** Search open-ended responses */
  searchOpenEndedResponses: ( surveyId, questionId, keyword) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/search-responses`, {
    params: { keyword }
  }),
  
  /** Get recent open-ended responses */
  getRecentOpenEndedResponses: ( surveyId, questionId, limit = 10) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/recent-responses`, {
    params: { limit }
  }),

  /** Get business analytics */
  getBusinessAnalytics: (businessId) => apiClient.get(`/api/businesses/${businessId}/analytics`),

  /** Get business survey analytics */
  getBusinessSurveyAnalytics: (businessId) => apiClient.get(`/api/businesses/${businessId}/survey-analytics`),

  /** Get business quest analytics */
  getBusinessQuestAnalytics: (businessId) => apiClient.get(`/api/businesses/${businessId}/quest-analytics`),

  /** Get business visitor analytics */
  getBusinessVisitorAnalytics: (businessId) => apiClient.get(`/api/businesses/${businessId}/visitor-analytics`),

  /** Archive a survey */
  archiveSurveyForBusiness: (businessId, surveyId) => apiClient.patch(`/api/businesses/${businessId}/surveys/${surveyId}/archive`),

  /** Get business details */
  getBusinessDetails: (businessId) => apiClient.get(`/api/businesses/${businessId}`),

  /** NEW: Get overall business analytics summary */
  getBusinessAnalyticsSummary: (businessId) => apiClient.get(`/api/businesses/${businessId}/analytics`),

  // AI Points Management APIs
  getAIPointsBalance: (businessId) => apiClient.get(`/api/businesses/${businessId}/ai_points`),
  getAIPointsUsageHistory: (businessId, params = {}) => apiClient.get(`/api/businesses/${businessId}/ai_points/usage`, { params }),
  checkAIPointsAvailability: (businessId, pointsNeeded) => apiClient.post(`/api/businesses/${businessId}/check_points`, { points_needed: pointsNeeded }),
  addAIPointsForBusiness: (businessId, points, action = 'MANUAL_ADD') => apiClient.post(`/api/businesses/${businessId}/ai_points/add`, { points, action }),
  
  // Stripe Integration APIs
  getStripePackages: () => apiClient.get('/api/stripe/packages'),
  getResponsePackages: () => apiClient.get('/api/stripe/response_packages'),
  createPaymentIntent: (businessId, packageType) => apiClient.post('/api/stripe/create_payment_intent', { business_id: businessId, package: packageType }),
  createAIPointsPaymentIntent: (packageId) => {
    // Get current user's business from context or use the package ID directly
    return apiClient.post('/api/stripe/create_payment_intent', { 
      package: packageId, 
      business_id: null  // Will be filled by backend from token
    });
  },
  confirmPayment: (paymentIntentId) => apiClient.post('/api/stripe/confirm_payment', { payment_intent_id: paymentIntentId }),
  simulatePayment: (paymentIntentId) => apiClient.post('/api/stripe/simulate_payment', { payment_intent_id: paymentIntentId }),
  createResponsePaymentIntent: (packageKey) => apiClient.post('/api/stripe/response/create_payment_intent', { 
    package: packageKey, 
    business_id: null  // Will be filled by backend from token
  }),
  simulateResponsePayment: (paymentIntentId) => apiClient.post('/api/stripe/response/simulate_payment', { payment_intent_id: paymentIntentId }),
  getTransactionHistory: (businessId, params = {}) => apiClient.get(`/api/businesses/${businessId}/transactions`, { params }),
  
  // Business Permissions Management
  getBusinessPermissions: (businessId) => apiClient.get(`/api/businesses/${businessId}/permissions`),
  updateBusinessPermissions: (businessId, permissions) => apiClient.put(`/api/businesses/${businessId}/permissions`, permissions),
  
  // Subscription Management APIs
  getSubscriptionTiers: () => apiClient.get('/api/subscription/tiers'),
  createSubscriptionIntent: (businessId, targetTier) => apiClient.post('/api/subscription/create_intent', { business_id: businessId, tier: targetTier }),
  simulateSubscriptionPayment: (paymentIntentId) => apiClient.post('/api/subscription/simulate_payment', { payment_intent_id: paymentIntentId }),
  changeBusinessTier: (businessId, targetTier) => apiClient.put('/api/subscription/change_tier', { business_id: businessId, tier: targetTier }),
  
  // Business Tier Management APIs (Super Admin)
  getAllBusinessTiers: (includeInactive = false) => apiClient.get(`/api/admin/business-tiers?include_inactive=${includeInactive}`),
  getBusinessTier: (tierId) => apiClient.get(`/api/admin/business-tiers/${tierId}`),
  createBusinessTier: (tierData) => apiClient.post('/api/admin/business-tiers', tierData),
  updateBusinessTier: (tierId, tierData) => apiClient.put(`/api/admin/business-tiers/${tierId}`, tierData),
  deleteBusinessTier: (tierId) => apiClient.delete(`/api/admin/business-tiers/${tierId}`),
  getBusinessTierStats: () => apiClient.get('/api/admin/business-tiers/statistics'),
  
  /** Get Discord roles for a business */
  getDiscordRoles: (businessId) => apiClient.get(`/api/businesses/${businessId}/discord-roles`),
  
  /** Get Discord roles formatted for audience selection */
  getDiscordRolesForAudience: (businessId) => apiClient.get(`/api/businesses/${businessId}/discord-roles-for-audience`),
  
  /** Manual sync Discord roles */
  syncDiscordRoles: (businessId) => apiClient.post(`/api/businesses/${businessId}/discord-roles/sync`),
  
  /** Manual sync Discord roles alias for backward compatibility */
  syncRoles: (businessId) => apiClient.post(`/api/businesses/${businessId}/discord-roles/sync`),
  
  /** List business admins for a specific business */
  listBusinessAdmins: (businessId) => apiClient.get(`/api/businesses/${businessId}/admins`),
  
  /** Delete a business admin from a specific business */
  deleteBusinessAdmin: (businessId, adminId) => apiClient.delete(`/api/businesses/${businessId}/admins/${adminId}`),
  
  /** Check Discord integration status for business */
  checkDiscordStatus: (businessId) => apiClient.get(`/api/businesses/${businessId}/discord-status`),
  // Public Business Tier APIs
  getAvailableBusinessTiers: () => apiClient.get('/api/business-tiers'),
  
  // AI Points Package Management APIs (Super Admin)
  getAllAIPointsPackages: (includeInactive = false) => apiClient.get(`/api/admin/ai-points-packages?include_inactive=${includeInactive}`),
  getAIPointsPackage: (packageId) => apiClient.get(`/api/admin/ai-points-packages/${packageId}`),
  createAIPointsPackage: (packageData) => apiClient.post('/api/admin/ai-points-packages', packageData),
  updateAIPointsPackage: (packageId, packageData) => apiClient.put(`/api/admin/ai-points-packages/${packageId}`, packageData),
  deleteAIPointsPackage: (packageId) => apiClient.delete(`/api/admin/ai-points-packages/${packageId}`),
  toggleAIPointsPackagePopular: (packageId) => apiClient.post(`/api/admin/ai-points-packages/${packageId}/toggle-popular`),
  getAIPointsPackageStats: () => apiClient.get('/api/admin/ai-points-packages/statistics'),
  
  // Public AI Points Package APIs
  getAvailableAIPointsPackages: () => apiClient.get('/api/business/ai-points-packages/available'),
  
  // Feature/Unfeature Business APIs
  featureBusiness: (businessId) => apiClient.put(`/api/businesses/${businessId}`, { is_featured: true }),
  unfeatureBusiness: (businessId) => apiClient.put(`/api/businesses/${businessId}`, { is_featured: false }),

  updateAudienceSettings: async (businessId, settings) => {
    return await apiClient.put(`/auth/businesses/${businessId}/audience`, settings);
  },
  
  checkBusinessAccess: async (businessId) => {
    return await apiClient.get(`/auth/businesses/${businessId}/access`);
  },

  // NEW: Optimized survey fetching
  getAccessibleSurveysOptimized: (businessId = null) => {
    const params = businessId ? { business_id: businessId } : {};
    return apiClient.get('/api/surveys/accessible-optimized', { params });
  },
  
  // NEW: Discord role management
  updateSurveyDiscordRoles: (businessId, surveyId, data) => {
    return apiClient.put(`/api/businesses/${businessId}/surveys/${surveyId}/discord-roles`, data);
  },
  
  // NEW: Direct access link generation
  generateDirectAccessLink: (businessId, surveyId) => {
    return apiClient.post(`/api/businesses/${businessId}/surveys/${surveyId}/direct-access`);
  },
};

// Quest API endpoints
export const questAPI = {
  // Quest Type Management
  getQuestTypes: () => {
    console.log('[QUEST_API] Fetching quest types');
    return apiClient.get('/api/quest-types');
  },

  // Super Admin Quest Management
  adminGetAllQuests: (params = {}) => {
    console.log('[QUEST_API] Admin fetching all quests', params);
    return apiClient.get('/api/admin/quests', { params });
  },
  adminGetQuest: (questId, includeCompletions = false) => {
    console.log(`[QUEST_API] Admin fetching quest ${questId}`);
    return apiClient.get(`/api/admin/quests/${questId}`, { 
      params: { include_completions: includeCompletions } 
    });
  },
  adminCreateQuest: (questData) => {
    console.log('[QUEST_API] Admin creating quest', questData.title);
    return apiClient.post('/api/admin/quests', questData);
  },
  adminUpdateQuest: (questId, questData) => {
    console.log(`[QUEST_API] Admin updating quest ${questId}`);
    return apiClient.put(`/api/admin/quests/${questId}`, questData);
  },
  adminDeleteQuest: (questId) => {
    console.log(`[QUEST_API] Admin deleting quest ${questId}`);
    return apiClient.delete(`/api/admin/quests/${questId}`);
  },
  adminPublishQuest: (questId) => {
    console.log(`[QUEST_API] Admin publishing quest ${questId}`);
    return apiClient.patch(`/api/admin/quests/${questId}/publish`);
  },
  adminUnpublishQuest: (questId) => {
    console.log(`[QUEST_API] Admin unpublishing quest ${questId}`);
    return apiClient.patch(`/api/admin/quests/${questId}/unpublish`);
  },
  adminFeatureQuest: (questId, featured = true) => {
    console.log(`[QUEST_API] Admin ${featured ? 'featuring' : 'unfeaturing'} quest ${questId}`);
    return apiClient.patch(`/api/admin/quests/${questId}/feature`, { featured });
  },
  adminGetQuestCompletions: (questId, params = {}) => {
    console.log(`[QUEST_API] Admin getting completions for quest ${questId}`);
    return apiClient.get(`/api/admin/quests/${questId}/completions`, { params });
  },

  // Business Admin Quest Management
  getBusinessQuests: (businessId, params = {}) => {
    console.log(`[QUEST_API] Fetching quests for business ${businessId}`);
    return apiClient.get(`/api/businesses/${businessId}/quests`, { params });
  },
  getBusinessQuest: (businessId, questId, includeCompletions = false) => {
    console.log(`[QUEST_API] Fetching quest ${questId} for business ${businessId}`);
    return apiClient.get(`/api/businesses/${businessId}/quests/${questId}`, {
      params: { include_completions: includeCompletions }
    });
  },
  createBusinessQuest: (businessId, questData) => {
    console.log(`[QUEST_API] Creating quest for business ${businessId}`, questData.title);
    return apiClient.post(`/api/businesses/${businessId}/quests`, questData);
  },
  updateBusinessQuest: (businessId, questId, questData) => {
    console.log(`[QUEST_API] Updating quest ${questId} for business ${businessId}`);
    return apiClient.put(`/api/businesses/${businessId}/quests/${questId}`, questData);
  },
  deleteBusinessQuest: (businessId, questId) => {
    console.log(`[QUEST_API] Deleting quest ${questId} for business ${businessId}`);
    return apiClient.delete(`/api/businesses/${businessId}/quests/${questId}`);
  },
  publishBusinessQuest: (businessId, questId) => {
    console.log(`[QUEST_API] Publishing quest ${questId} for business ${businessId}`);
    return apiClient.patch(`/api/businesses/${businessId}/quests/${questId}/publish`);
  },
  unpublishBusinessQuest: (businessId, questId) => {
    console.log(`[QUEST_API] Unpublishing quest ${questId} for business ${businessId}`);
    return apiClient.patch(`/api/businesses/${businessId}/quests/${questId}/unpublish`);
  },
  getBusinessQuestCompletions: (businessId, questId, params = {}) => {
    console.log(`[QUEST_API] Getting completions for quest ${questId} in business ${businessId}`);
    return apiClient.get(`/api/businesses/${businessId}/quests/${questId}/completions`, { params });
  },

  // User/Public Quest Endpoints
  getAvailableQuests: (params = {}) => {
    console.log('[QUEST_API] Fetching available quests for user');
    return apiClient.get('/api/quests/available', { params });
  },
  getPublicQuest: (questId) => {
    console.log(`[QUEST_API] Fetching public quest ${questId}`);
    return apiClient.get(`/api/quests/${questId}`);
  },
  completeQuest: (questId, verificationData = {}) => {
    console.log(`[QUEST_API] Completing quest ${questId}`);
    return apiClient.post(`/api/quests/${questId}/complete`, verificationData);
  },
  trackLinkClick: (questId) => {
    console.log(`[QUEST_API] Tracking link click for quest ${questId}`);
    return apiClient.post(`/api/quests/${questId}/track-link-click`);
  },
  checkLinkClick: (questId) => {
    console.log(`[QUEST_API] Checking link click status for quest ${questId}`);
    return apiClient.get(`/api/quests/${questId}/check-link-click`);
  },
  getUserQuestCompletions: (userId, params = {}) => {
    console.log(`[QUEST_API] Fetching quest completions for user ${userId}`);
    return apiClient.get(`/api/users/${userId}/quest-completions`, { params });
  },
  getPublicBusinessQuests: (businessId, params = {}) => {
    console.log(`[QUEST_API] Fetching public quests for business ${businessId}`);
    return apiClient.get(`/api/public/businesses/${businessId}/quests`, { params });
  },

  // NEW: Quest Progress and Proof Submission
  submitProof: (questId, proofData) => {
    console.log(`[QUEST_API] Submitting proof for quest ${questId}`);
    return apiClient.post(`/api/quests/${questId}/submit-proof`, proofData);
  },
  getQuestProgress: (questId) => {
    console.log(`[QUEST_API] Getting progress for quest ${questId}`);
    return apiClient.get(`/api/quests/${questId}/progress`);
  },
  getUserActivitySummary: (userId) => {
    console.log(`[QUEST_API] Getting activity summary for user ${userId}`);
    return apiClient.get(`/api/users/${userId}/activity-summary`);
  }
};

// Analytics API endpoints (Paths updated based on response.py)
export const analyticsAPI = {
  getOverall: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/analytics`), // Fixed: Added /api prefix
  getSummaryReport: (surveyId, format = 'json') => apiClient.get(`/api/surveys/${surveyId}/report-summary`, { // Fixed: Added /api prefix, but this endpoint may not exist
    params: { format } // format param might not be used by this specific route
  }),
  getQuestionAnalytics: (surveyId, questionId) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/analytics`, { // Fixed: Added /api prefix
     params: { surveyId, questionId } // Pass IDs if needed in query params
  }),
  getQuestionAnalyticsUnified: (surveyId, questionId) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/analytics-unified`), // Fixed: Added /api prefix
  // getDemographicsSummary: (surveyId) => apiClient.get(`/surveys/${surveyId}/demographics-summary`), // No GET route in response.py, use surveyAPI.getDemographicAnalytics (POST)
  // getResponseTimeAnalytics: (surveyId) => apiClient.get(`/surveys/${surveyId}/response-time`), // No GET route in response.py, use surveyAPI.getResponseTimesAdvanced (POST)
  getDropoutAnalysis: (surveyId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/dropout-analysis`, { filters }), // Fixed: Added /api prefix
  getFilteredAnalytics: (surveyId, questionId, filters) => apiClient.post(`/api/surveys/${surveyId}/questions/${questionId}/filtered-analytics`, { filters }),
  getResponses: (surveyId, params) => apiClient.get(`/api/surveys/${surveyId}/live-responses`, { params }), // Fixed: Added /api prefix
  exportExcel: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/export/excel`, { responseType: 'blob' }), // Fixed: Added /api prefix
  exportResponses: (surveyId, format, params) => apiClient.get(`/api/surveys/${surveyId}/export`, { // Fixed: Added /api prefix
    params: { ...params, format },
    responseType: 'blob' // Might not be blob
  }),
  // exportPdf: (surveyId, filters = {}) => apiClient.post(`/surveys/${surveyId}/export-pdf`, { filters }, { responseType: 'blob' }), // No route in response.py - Duplicate
  getSummary: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/report-summary`), // Fixed: Added /api prefix - Duplicate
  getMergedAnalytics: (surveyId, linkIds) => apiClient.post(`/api/surveys/${surveyId}/merged-analytics`, { link_ids: linkIds }), // Fixed: Added /api prefix - Duplicate
  // Advanced analytics duplicates (use surveyAPI versions)
  // getResponseTimesAdvanced: (surveyId, filters = {}) => apiClient.post(`/surveys/${surveyId}/response-times-advanced`, { filters }),
  // getDemographicAnalytics: (surveyId, filters = {}) => apiClient.post(`/surveys/${surveyId}/demographic-analytics`, { filters }),
  getFilteredQuestionAnalytics: (surveyId, questionId, filters = {}) => apiClient.post(`/api/surveys/${surveyId}/questions/${questionId}/filtered-analytics`, { filters }), // Fixed: Added /api prefix
  // getOpenEndedWithUsers: (surveyId, questionId, limit = 15) => apiClient.get(`/surveys/${surveyId}/questions/${questionId}/openended-with-users`, { params: { limit } }), // Path UPDATED - Duplicate

  // Newly added based on response.py
  getGridAnalysis: (surveyId, questionId) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/grid-analysis`), // Fixed: Added /api prefix
  getResponseTrends: (surveyId, timeframe = 'daily') => apiClient.get(`/api/surveys/${surveyId}/response-trends`, { params: { timeframe } }), // Fixed: Added /api prefix
  getQuestionCompletionRate: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/question-completion-rate`), // Fixed: Added /api prefix
  searchOpenEnded: (surveyId, questionId, keyword) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/search-responses`, { params: { keyword } }), // Fixed: Added /api prefix
  getAnalyticsByLink: (surveyId, linkId) => apiClient.get('/api/responses/analytics/link', { params: { survey_id: surveyId, link_id: linkId } }), // Fixed: Added /api prefix
  getMergedLegacy: (surveyId, mergeIdsList) => apiClient.get('/api/responses/analytics/merged', { params: { survey_id: surveyId, merge_ids: mergeIdsList.join(',') } }), // Fixed: Added /api prefix
  getRecentOpenEnded: (surveyId, questionId, limit=10) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/recent-responses`, { params: { limit } }), // Fixed: Added /api prefix
  getOpenEndedResponses: (surveyId, questionId, limit = 50) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/openended-with-users`, { params: { limit } }),
  getAgeGroupAnalytics: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/age-group-analytics`) // Fixed: Added /api prefix
};

// Chart API endpoints
export const chartAPI = {
  getChartSettings: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/chart-settings`),
  saveChartSettings: (surveyId, settings) => apiClient.post(`/api/surveys/${surveyId}/chart-settings`, settings),
  getChartData: (surveyId, questionId, params = {}) => apiClient.get(`/api/surveys/${surveyId}/questions/${questionId}/chart-data`, { params })
};

// AI API endpoints
export const aiAPI = {
  // Existing chat methods
  chat: (message) => apiClient.post('/api/ai/chat', { message }),
  createThread: (surveyId) => apiClient.post('/api/ai/create_survey_thread', { survey_id: surveyId }),
  editSurvey: (surveyId, instructions) => apiClient.post('/api/ai/edit_survey_ai', {
    survey_id: surveyId,
    edit_instructions: instructions
  }),
  editQuestion: (originalQuestion, prompt, surveyId) => apiClient.post('/api/ai/ai_edit_question', {
    original: originalQuestion,
    prompt,
    survey_id: surveyId
  }),
  regenerateSurvey: (currentSurveyState, userMessage, surveyId, businessId) => apiClient.post('/api/ai/regenerate_survey', {
    survey: currentSurveyState,
    prompt: userMessage,
    survey_id: surveyId,
    business_id: businessId
  }),
  continueSurveyConversation: (data) => apiClient.post('/api/ai/continue_survey_conversation', data),
  getSummary: (surveyId) => apiClient.get('/api/ai/ai_summary', { params: { survey_id: surveyId } }),
  converseSummary: (surveyId, prompt) => apiClient.post('/api/ai/converse_ai_summary', {
    survey_id: surveyId,
    prompt
  }),
  
  // Enhanced: Generate AI Insights Report with Trends
  generateReportInsights: (surveyId, selectedQuestionIds, filters, comparisonSettings) => {
    console.log('[API_CLIENT] Generating enhanced AI insights report with trends');
    return apiClient.post('/api/ai/generate_report_insights', {
      survey_id: surveyId,
      selected_question_ids: selectedQuestionIds,
      filters: filters,
      comparison_settings: comparisonSettings
    }, {
      timeout: 240000 // Doubled timeout for comprehensive analysis
    });
  },

  // Get questions eligible for AI analysis
  getEligibleQuestions: (surveyId) => {
    console.log(`[API_CLIENT] Fetching AI-eligible questions for survey ${surveyId}`);
    return apiClient.get(`/api/ai/surveys/${surveyId}/ai_eligible_questions`);
  },

  // Auto-generate survey responses
  autoGenerateSurveyResponses: (surveyId, num_responses) => {
    console.log(`[API_CLIENT] Auto-generating ${num_responses} responses for survey ${surveyId}`);
    return apiClient.post(`/api/ai/surveys/${surveyId}/auto_generate_responses`, {
      num_responses: num_responses
    });
  },

  // Legacy methods (keeping for compatibility)
  chatWithAI: (message) => apiClient.post('/api/ai/chat', { message }),
  getConversationalResponse: (surveyId, prompt) => apiClient.post(`/ai/surveys/${surveyId}/converse`, { prompt }),
};

// Upload API endpoints
export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  uploadDocument: (file, surveyId, questionId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (surveyId) formData.append('survey_id', surveyId);
    if (questionId) formData.append('question_id', questionId);
    return apiClient.post('/upload/document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

// Enhanced fetch function (Keep as is, useful utility)
const enhancedFetch = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {})
  };

  // Add auth token if available (same logic as apiClient interceptor)
  const token = localStorage.getItem('token');
  if (token) {
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('Malformed JWT token detected in enhancedFetch');
    }
  }

  try {
    console.log(`[ENHANCED_FETCH] Making ${options.method || 'GET'} request to ${fullUrl}`);
    console.log(`[ENHANCED_FETCH] Auth header present:`, headers['Authorization'] ? 'Yes' : 'No');
    
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: 'include' // Ensure cookies are sent/received for session management
    });

    if (!response.ok) {
      // Attempt to parse error if JSON, otherwise use status text
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // Not a JSON response
      }
      const errorMessage = errorData?.error || errorData?.message || response.statusText || `Fetch failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.response = response; // Attach full response for more context if needed
      error.errorData = errorData; // Attach parsed error data
      throw error;
    }

    // For blob responses (e.g., file downloads)
    if (options.responseType === 'blob') {
      return await response.blob();
    }

    // For JSON responses (default)
    // Check if content-type is application/json before trying to parse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    // If not JSON, but still OK, return text (or handle other types as needed)
    return await response.text(); 

  } catch (error) {
    console.error('Enhanced fetch error:', error.message, error.errorData ? JSON.stringify(error.errorData) : '');
    // Re-throw the error so it can be caught by the caller
    // The error object should now have status and potentially errorData from the response
    throw error;
  }
};

// Export the enhanced fetch for use in components that need direct fetch access
export { enhancedFetch };
export { baseURL };

// Marketplace API endpoints (New)
export const marketplaceAPI = {
  getItems: (params) => apiClient.get('/api/marketplace/items', { params }),
  getItemDetail: (itemId) => apiClient.get(`/api/marketplace/items/${itemId}`),
  redeemItem: (itemId) => apiClient.post(`/api/marketplace/items/${itemId}/redeem`),
  enterRaffle: (itemId) => apiClient.post(`/api/marketplace/items/${itemId}/enter-raffle`),
  getMyRewards: () => apiClient.get('/api/marketplace/my-rewards'),
  exportMyRewards: () => apiClient.get('/api/marketplace/my-rewards/export', { responseType: 'blob' }),

  // Admin Marketplace
  adminGetItems: () => apiClient.get('/api/admin/marketplace/items'),
  adminGetItemById: (itemId) => apiClient.get(`/api/admin/marketplace/items/${itemId}`),
  adminCreateItem: (formData) => apiClient.post('/api/admin/marketplace/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  adminUpdateItem: (itemId, formData) => apiClient.put(`/api/admin/marketplace/items/${itemId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  adminDeleteItem: (itemId) => apiClient.delete(`/api/admin/marketplace/items/${itemId}`),
  adminGetRewardLogs: () => apiClient.get('/api/admin/marketplace/rewards'),
  adminUpdateRewardStatus: (logId, data) => apiClient.put(`/api/admin/marketplace/rewards/${logId}/status`, data),
  /** Feature / Unfeature marketplace item */
  featureItem: (itemId) => apiClient.patch(`/api/admin/marketplace/items/${itemId}/feature`, { featured: true }),
  unfeatureItem: (itemId) => apiClient.patch(`/api/admin/marketplace/items/${itemId}/feature`, { featured: false }),
};

export const itemAPI = {
  // --- Item Management ---
  listItemsForBusiness: (businessId, params = {}) => 
    apiClient.get(`/api/businesses/${businessId}/items`, { params }),
  
  getItem: (itemId) => 
    apiClient.get(`/api/items/${itemId}`),
  
  createItem: (businessId, itemData) => 
    apiClient.post(`/api/businesses/${businessId}/items`, itemData),

  updateItem: (itemId, itemData) => 
    apiClient.put(`/api/items/${itemId}`, itemData),
  
  deleteItem: (itemId) => 
    apiClient.delete(`/api/items/${itemId}`),
  
  // --- Status and Visibility ---
  updateItemStatus: (itemId, statusData) =>
    apiClient.put(`/api/items/${itemId}/status`, statusData),

  updateBusinessItemStatus: (businessId, itemId, statusData) =>
    apiClient.put(`/api/items/${itemId}/status`, statusData),
  
  publishItem: (itemId) => 
    apiClient.put(`/api/items/${itemId}/publish`),
  
  unpublishItem: (itemId) => 
    apiClient.put(`/api/items/${itemId}/unpublish`),
  
  archiveItem: (itemId) => 
    apiClient.put(`/api/items/${itemId}/archive`),
  
  unarchiveItem: (itemId) => 
    apiClient.put(`/api/items/${itemId}/unarchive`),
  
  // --- Voting ---
  voteOnItem: (itemId, voteData) => 
    apiClient.post(`/api/items/${itemId}/vote`, voteData),
  
  getUserVote: (itemId) => 
    apiClient.get(`/api/items/${itemId}/vote`),

  // --- Legacy/Compatibility (can be removed if UI is updated) ---
  listBugsForBusiness: (businessId, params = {}) => {
    params.type = 'BUG';
    return apiClient.get(`/api/businesses/${businessId}/items`, { params });
  },
  
  listFeaturesForBusiness: (businessId, params = {}) => {
    params.type = 'FEATURE';
    return apiClient.get(`/api/businesses/${businessId}/items`, { params });
  },

  createBugReport: (businessId, itemData) => {
    itemData.item_type = 'BUG';
    return apiClient.post(`/api/businesses/${businessId}/items`, itemData);
  },
  
  createFeatureRequest: (businessId, itemData) => {
    itemData.item_type = 'FEATURE';
    return apiClient.post(`/api/businesses/${businessId}/items`, itemData);
  },

  // --- Admin Feature Request Management ---
  getAdminFeatureRequests: (params = {}) => 
    apiClient.get('/api/admin/feature-requests', { params }),
  
  getFeatureRequestById: (requestId) => 
    apiClient.get(`/api/admin/feature-requests/${requestId}`),
  
  reviewFeatureRequest: (requestId, reviewData) => 
    apiClient.post(`/api/admin/feature-requests/${requestId}/review`, reviewData),
  
  getFeatureRequestStats: () => 
    apiClient.get('/api/admin/feature-requests/statistics')
};

// Business Tier API endpoints
export const businessTierAPI = {
  // Super Admin Business Tier Management
  adminGetAllTiers: (includeInactive = false) => 
    apiClient.get('/api/admin/business-tiers', { params: { include_inactive: includeInactive } }),
  adminGetTierById: (tierId) => apiClient.get(`/api/admin/business-tiers/${tierId}`),
  adminCreateTier: (tierData) => apiClient.post('/api/admin/business-tiers', tierData),
  adminUpdateTier: (tierId, tierData) => apiClient.put(`/api/admin/business-tiers/${tierId}`, tierData),
  adminDeleteTier: (tierId) => apiClient.delete(`/api/admin/business-tiers/${tierId}`),
  adminGetTierStats: () => apiClient.get('/api/admin/business-tiers/statistics'),
  
  // Public Business Tier Access
  getAvailableTiers: () => apiClient.get('/api/business-tiers'),
  requestCustomTier: (data) => apiClient.post('/api/business-tiers/custom-request', data),
};

// AI Points Package API endpoints
export const aiPointsPackageAPI = {
  // Super Admin AI Points Package Management
  adminGetAllPackages: (includeInactive = false) => 
    apiClient.get('/api/admin/ai-points-packages', { params: { include_inactive: includeInactive } }),
  adminGetPackageById: (packageId) => apiClient.get(`/api/admin/ai-points-packages/${packageId}`),
  adminCreatePackage: (packageData) => apiClient.post('/api/admin/ai-points-packages', packageData),
  adminUpdatePackage: (packageId, packageData) => apiClient.put(`/api/admin/ai-points-packages/${packageId}`, packageData),
  adminDeletePackage: (packageId) => apiClient.delete(`/api/admin/ai-points-packages/${packageId}`),
  adminTogglePopularStatus: (packageId) => apiClient.post(`/api/admin/ai-points-packages/${packageId}/toggle-popular`),
  adminGetPackageStats: () => apiClient.get('/api/admin/ai-points-packages/statistics'),
  
  // Public AI Points Package Access
  getAvailablePackages: () => apiClient.get('/api/business/ai-points-packages/available'),
};

// Response Package API endpoints
export const responsePackageAPI = {
  // Super Admin Response Package Management
  adminGetAllPackages: (includeInactive = false) => 
    apiClient.get('/api/admin/response-packages', { params: { include_inactive: includeInactive } }),
  adminGetPackageById: (packageId) => apiClient.get(`/api/admin/response-packages/${packageId}`),
  adminCreatePackage: (packageData) => apiClient.post('/api/admin/response-packages', packageData),
  adminUpdatePackage: (packageId, packageData) => apiClient.put(`/api/admin/response-packages/${packageId}`, packageData),
  adminDeletePackage: (packageId) => apiClient.delete(`/api/admin/response-packages/${packageId}`),
  adminTogglePopularStatus: (packageId) => apiClient.put(`/api/admin/response-packages/${packageId}/toggle-popular`),
  adminGetPackageStats: () => apiClient.get('/api/admin/response-packages/stats'),
  
  // Public Response Package Access
  getAvailablePackages: () => apiClient.get('/api/business/response-packages/available'),
};

// Quest Package API endpoints
export const questPackageAPI = {
  // Super Admin Quest Package Management
  adminGetAllPackages: (includeInactive = false) => 
    apiClient.get('/api/admin/quest-packages', { params: { include_inactive: includeInactive } }),
  adminGetPackageById: (packageId) => apiClient.get(`/api/admin/quest-packages/${packageId}`),
  adminCreatePackage: (packageData) => apiClient.post('/api/admin/quest-packages', packageData),
  adminUpdatePackage: (packageId, packageData) => apiClient.put(`/api/admin/quest-packages/${packageId}`, packageData),
  adminDeletePackage: (packageId) => apiClient.delete(`/api/admin/quest-packages/${packageId}`),
  
  // Business Quest Package Purchase
  getAvailablePackages: () => apiClient.get('/api/business/quest-packages/available'),
  purchasePackage: (packageId, paymentData) => 
    apiClient.post(`/api/business/quest-packages/${packageId}/purchase`, paymentData),
};

// Admin Seat Package API endpoints
export const adminSeatPackageAPI = {
  // Super Admin Admin Seat Package Management
  adminGetAllPackages: (includeInactive = false) => 
    apiClient.get('/api/admin/admin-seat-packages', { params: { include_inactive: includeInactive } }),
  adminGetPackageById: (packageId) => apiClient.get(`/api/admin/admin-seat-packages/${packageId}`),
  adminCreatePackage: (packageData) => apiClient.post('/api/admin/admin-seat-packages', packageData),
  adminUpdatePackage: (packageId, packageData) => apiClient.put(`/api/admin/admin-seat-packages/${packageId}`, packageData),
  adminDeletePackage: (packageId) => apiClient.delete(`/api/admin/admin-seat-packages/${packageId}`),
  
  // Business Admin Seat Package Purchase and Info
  getAvailablePackages: () => apiClient.get('/api/business/admin-seat-packages/available'),
  purchasePackage: (packageId, paymentData) => 
    apiClient.post(`/api/business/admin-seat-packages/${packageId}/purchase`, paymentData),
  getBusinessSeatInfo: () => apiClient.get('/api/business/admin-seats/info'),
};

// Quest Verification and Approval API endpoints
export const questVerificationAPI = {
  // User endpoints for proof submission
  submitQuestProof: (questId, proofData) => 
    apiClient.post(`/api/quests/${questId}/submit-proof`, proofData),
  
  // Business admin endpoints for verification
  getPendingVerifications: (businessId, params = {}) => 
    apiClient.get(`/api/businesses/${businessId}/quest-verifications`, { params }),
  verifyQuestCompletion: (completionId, decision, notes = '') => 
    apiClient.post(`/api/quest-completions/${completionId}/verify`, { decision, notes }),
  
  // Super admin endpoints for quest approval
  getPendingQuestApprovals: (params = {}) => 
    apiClient.get('/api/admin/quest-approvals', { params }),
  approveQuest: (questId, notes = '') => 
    apiClient.post(`/api/admin/quests/${questId}/approve`, { notes }),
  rejectQuest: (questId, notes = '') => 
    apiClient.post(`/api/admin/quests/${questId}/reject`, { notes }),
};

// Discord API endpoints
export const discordAPI = {
  // User Discord linking
  initiateOAuth: () => apiClient.get('/linking/discord/initiate'),
  
  // Sync user's Discord roles across all guilds
  syncUserRoles: () => apiClient.post('/api/user/discord-roles/sync'),
  
  // Get user's Discord connection and role information
  getUserDiscordInfo: () => apiClient.get('/api/user/discord-info'),
  
  // Get Discord server roles for business admin configuration
  getServerRoles: (businessId) => apiClient.get(`/api/businesses/${businessId}/discord-roles`),
  
  // Check user's Discord access to a survey
  checkSurveyAccess: (surveyId) => apiClient.get(`/api/surveys/${surveyId}/discord-access-check`),
  
  // Get user's Discord membership info for a business
  getDiscordMembership: (businessId) => apiClient.get(`/api/businesses/${businessId}/discord/membership`),
  
  // Unlink Discord account
  unlinkAccount: () => apiClient.delete('/api/profile/linked-accounts/discord')
};

// Notification API endpoints
export const notificationAPI = {
  // User notification management
  getUserNotifications: () => apiClient.get('/api/notifications'),
  getNotificationSummary: () => apiClient.get('/api/notifications/summary'),
  markNotificationRead: (notificationId) => apiClient.put(`/api/notifications/${notificationId}/read`),
  markAllNotificationsRead: () => apiClient.put('/api/notifications/read-all'),
  dismissNotification: (notificationId) => apiClient.put(`/api/notifications/${notificationId}/dismiss`),
  deleteNotification: (notificationId) => apiClient.delete(`/api/notifications/${notificationId}`),
  
  // Admin notification management
  adminSendCustomNotification: (notificationData) => apiClient.post('/api/admin/notification/send', notificationData),
  adminSendBulkNotification: (notificationData) => apiClient.post('/api/admin/notification/send-bulk', notificationData),
  adminGetAllNotifications: (params = {}) => apiClient.get('/api/admin/notification', { params }),
  adminMarkNotificationRead: (notificationId) => apiClient.put(`/api/admin/notification/${notificationId}/read`),
  adminDeleteNotification: (notificationId) => apiClient.delete(`/api/admin/notification/${notificationId}`),
};

// Admin dashboard summary
export const adminDashboardAPI = {
  getSummary: () => apiClient.get('/api/admin/dashboard-summary'),
};

// Purchase API endpoints
export const purchaseAPI = {
  // User purchase flow
  initiatePurchase: (itemId, purchaseType) => apiClient.post('/api/purchases/initiate', { item_id: itemId, purchase_type: purchaseType }),
  submitDeliveryInfo: (purchaseId, deliveryData) => apiClient.post(`/api/marketplace/delivery-info/${purchaseId}`, deliveryData),
  getPurchaseDetails: (purchaseId) => apiClient.get(`/api/marketplace/purchase/${purchaseId}`),
  
  // Admin purchase management
  adminGetAllPurchases: (params = {}) => apiClient.get('/api/admin/purchases', { params }),
  adminGetPurchaseDetails: (purchaseId) => apiClient.get(`/api/admin/purchases/${purchaseId}`),
  adminUpdatePurchaseStatus: (purchaseId, statusData) => apiClient.put(`/api/admin/purchases/${purchaseId}/status`, statusData),
  
  // Admin raffle management
  adminGetRaffleEntries: (params = {}) => apiClient.get('/api/admin/raffles/entries', { params }),
  adminSelectRaffleWinner: (itemId) => apiClient.post(`/api/admin/raffles/${itemId}/select-winner`),
  adminGetDeliveryInfo: (params = {}) => apiClient.get('/api/admin/purchases/delivery-info', { params }),
};

// Referral API endpoints
export const referralAPI = {
  // User referral management
  getUserReferralLink: () => {
    console.log('[REFERRAL_API] Getting user referral link');
    return apiClient.get('/api/referrals/referral-link');
  },
  getUserReferrals: (params = {}) => {
    console.log('[REFERRAL_API] Getting user referrals', params);
    return apiClient.get('/api/referrals/referrals', { params });
  },
  getReferralStats: () => {
    console.log('[REFERRAL_API] Getting referral statistics');
    return apiClient.get('/api/referrals/stats');
  },
  validateReferralCode: (code, type = 'referral') => {
    console.log(`[REFERRAL_API] Validating ${type} code:`, code);
    return apiClient.post('/api/referrals/validate', { code, type });
  },
  
  // Admin referral management
  adminGetReferralSettings: () => apiClient.get('/api/referrals/admin/settings'),
  adminUpdateReferralSettings: (settings) => apiClient.put('/api/referrals/admin/settings', settings),
  adminGetReferralAnalytics: (params = {}) => apiClient.get('/api/referrals/admin/analytics', { params }),
  adminCreateAffiliateLink: (linkData) => apiClient.post('/api/referrals/admin/affiliate-links', linkData),
  adminGetUserReferrals: (userId, params = {}) => apiClient.get(`/api/referrals/admin/users/${userId}/referrals`, { params }),
};

// Daily Reward API endpoints
export const dailyRewardAPI = {
  // User daily reward management
  getDailyRewardState: () => {
    console.log('[DAILY_REWARD_API] Getting daily reward calendar state');
    return apiClient.get('/api/daily-rewards/state');
  },
  claimDailyReward: (targetDate = null) => {
    console.log('[DAILY_REWARD_API] Claiming daily reward', targetDate ? `for date: ${targetDate}` : 'for today');
    const body = targetDate ? { date: targetDate } : {};
    return apiClient.post('/api/daily-rewards/claim', body);
  },
  getUserStreak: () => {
    console.log('[DAILY_REWARD_API] Getting user streak information');
    return apiClient.get('/api/daily-rewards/streak');
  },
  
  // Admin daily reward management
  adminGetWeekConfigurations: () => {
    console.log('[DAILY_REWARD_API] Admin getting week configurations');
    return apiClient.get('/api/admin/daily-rewards/configurations');
  },
  adminCreateWeekConfiguration: (configData) => {
    console.log('[DAILY_REWARD_API] Admin creating week configuration');
    return apiClient.post('/api/admin/daily-rewards/configurations', configData);
  },
  adminActivateWeekConfiguration: (configId) => {
    console.log(`[DAILY_REWARD_API] Admin activating week configuration ${configId}`);
    return apiClient.put(`/api/admin/daily-rewards/configurations/${configId}/activate`);
  },
  adminGetDailyRewardAnalytics: (params = {}) => {
    console.log('[DAILY_REWARD_API] Admin getting daily reward analytics');
    return apiClient.get('/api/admin/daily-rewards/analytics', { params });
  },
  adminUpdateWeekConfiguration: (configId, configData) => {
    console.log(`[DAILY_REWARD_API] Admin updating week configuration ${configId}`);
    return apiClient.put(`/api/admin/daily-rewards/configurations/${configId}`, configData);
  },
  adminDeleteWeekConfiguration: (configId) => {
    console.log(`[DAILY_REWARD_API] Admin deleting week configuration ${configId}`);
    return apiClient.delete(`/api/admin/daily-rewards/configurations/${configId}`);
  },
  adminGetWeekConfiguration: (configId) => {
    console.log(`[DAILY_REWARD_API] Admin getting week configuration ${configId}`);
    return apiClient.get(`/api/admin/daily-rewards/configurations/${configId}`);
  }
};

// Season Pass API
export const seasonPassAPI = {
  // User endpoints
  getState: () => {
    console.log('[SEASON_PASS_API] Getting user season pass state');
    return apiClient.get('/api/season-pass/state');
  },
  claimReward: (seasonRewardId) => {
    console.log(`[SEASON_PASS_API] Claiming reward ${seasonRewardId}`);
    return apiClient.post('/api/season-pass/claim-reward', { season_reward_id: seasonRewardId });
  },
  getPreview: () => {
    console.log('[SEASON_PASS_API] Getting season preview');
    return apiClient.get('/api/season-pass/preview');
  },
  getLeaderboard: (params = {}) => {
    console.log('[SEASON_PASS_API] Getting season leaderboard');
    return apiClient.get('/api/season-pass/leaderboard', { params });
  },
  
  // Payment endpoints
  getPaymentMethods: () => {
    console.log('[SEASON_PASS_API] Getting payment methods');
    return apiClient.get('/api/season-pass/payment/methods');
  },
  createStripeIntent: (tierType) => {
    console.log(`[SEASON_PASS_API] Creating Stripe payment intent for ${tierType}`);
    return apiClient.post('/api/season-pass/payment/stripe/create-intent', { tier_type: tierType });
  },
  confirmStripePayment: (paymentIntentId) => {
    console.log(`[SEASON_PASS_API] Confirming Stripe payment ${paymentIntentId}`);
    return apiClient.post('/api/season-pass/payment/stripe/confirm', { payment_intent_id: paymentIntentId });
  },
  createCryptoSession: (tierType) => {
    console.log(`[SEASON_PASS_API] Creating crypto payment session for ${tierType}`);
    return apiClient.post('/api/season-pass/payment/crypto/create-session', { tier_type: tierType });
  },
  
  // Direct purchase (for testing/manual processing)
  purchaseDirect: (tierType, paymentMethod = null, paymentReference = null) => {
    console.log(`[SEASON_PASS_API] Direct purchase ${tierType}`);
    return apiClient.post('/api/season-pass/purchase', {
      tier_type: tierType,
      payment_method: paymentMethod,
      payment_reference: paymentReference
    });
  },
  
  // Admin endpoints
  admin: {
    // Season management
    listSeasons: (params = {}) => {
      console.log('[SEASON_PASS_ADMIN_API] Listing seasons');
      return apiClient.get('/api/admin/season-pass/seasons', { params });
    },
    createSeason: (seasonData) => {
      console.log('[SEASON_PASS_ADMIN_API] Creating season');
      return apiClient.post('/api/admin/season-pass/seasons', seasonData);
    },
    activateSeason: (seasonId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Activating season ${seasonId}`);
      return apiClient.post(`/api/admin/season-pass/seasons/${seasonId}/activate`);
    },
    setNextSeason: (seasonId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Setting next season ${seasonId}`);
      return apiClient.post(`/api/admin/season-pass/seasons/${seasonId}/set-next`);
    },
    updateXPRequirements: (seasonId, levelXpMap) => {
      console.log(`[SEASON_PASS_ADMIN_API] Updating XP requirements for season ${seasonId}`);
      return apiClient.put(`/api/admin/season-pass/seasons/${seasonId}/xp-requirements`, {
        level_xp_map: levelXpMap
      });
    },
    getSeasonAnalytics: (seasonId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Getting analytics for season ${seasonId}`);
      return apiClient.get(`/api/admin/season-pass/seasons/${seasonId}/analytics`);
    },
    getSeasonOverview: (seasonId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Getting full overview for season ${seasonId}`);
      return apiClient.get(`/api/admin/season-pass/seasons/${seasonId}/full-overview`);
    },
    
    // Subscription Analytics
    getSubscriptionAnalytics: (seasonId = null) => {
      console.log(`[SEASON_PASS_ADMIN_API] Getting subscription analytics${seasonId ? ` for season ${seasonId}` : ' for all seasons'}`);
      const params = seasonId ? { season_id: seasonId } : {};
      return apiClient.get('/api/admin/season-pass/analytics/subscriptions', { params });
    },
    getRetentionAnalytics: () => {
      console.log('[SEASON_PASS_ADMIN_API] Getting retention analytics');
      return apiClient.get('/api/admin/season-pass/analytics/retention');
    },
    getChurnAnalytics: () => {
      console.log('[SEASON_PASS_ADMIN_API] Getting churn analytics');
      return apiClient.get('/api/admin/season-pass/analytics/churn');
    },
    getGrowthAnalytics: () => {
      console.log('[SEASON_PASS_ADMIN_API] Getting growth analytics');
      return apiClient.get('/api/admin/season-pass/analytics/growth');
    },
    
    // Level management
    createLevel: (seasonId, levelData) => {
      console.log(`[SEASON_PASS_ADMIN_API] Creating level for season ${seasonId}`);
      return apiClient.post(`/api/admin/season-pass/seasons/${seasonId}/levels`, levelData);
    },
    
    // Reward management
    createReward: (seasonId, levelId, rewardData) => {
      console.log(`[SEASON_PASS_ADMIN_API] Creating reward for level ${levelId}`);
      return apiClient.post(`/api/admin/season-pass/seasons/${seasonId}/levels/${levelId}/rewards`, rewardData);
    },
    updateReward: (seasonId, levelId, rewardId, rewardData) => {
      console.log(`[SEASON_PASS_ADMIN_API] Updating reward ${rewardId}`);
      return apiClient.put(`/api/admin/season-pass/seasons/${seasonId}/levels/${levelId}/rewards/${rewardId}`, rewardData);
    },
    deleteReward: (seasonId, levelId, rewardId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Deleting reward ${rewardId}`);
      return apiClient.delete(`/api/admin/season-pass/seasons/${seasonId}/levels/${levelId}/rewards/${rewardId}`);
    },
    getLevelRewards: (seasonId, levelId) => {
      console.log(`[SEASON_PASS_ADMIN_API] Getting rewards for level ${levelId}`);
      return apiClient.get(`/api/admin/season-pass/seasons/${seasonId}/levels/${levelId}/rewards`);
    }
  }
};

// ============= REFERRAL ADMIN API =============
// Referral and Affiliate Admin API
export const referralAdminAPI = {
  // Referral Settings Management
  getReferralSettings: () => apiClient.get('/api/referrals/admin/settings'),
  updateReferralSettings: (settings) => apiClient.put('/api/referrals/admin/settings', settings),
  
  // Referral Analytics
  getReferralAnalytics: (params = {}) => apiClient.get('/api/referrals/admin/analytics', { params }),
  getTagAnalytics: () => apiClient.get('/api/referrals/admin/tag-analytics'),
  
  // Affiliate Link Management
  listAffiliateLinks: (params = {}) => apiClient.get('/api/referrals/admin/affiliate-links', { params }),
  createAffiliateLink: (linkData) => apiClient.post('/api/referrals/admin/affiliate-links', linkData),
  updateAffiliateLink: (linkId, linkData) => apiClient.put(`/api/referrals/admin/affiliate-links/${linkId}`, linkData),
  deleteAffiliateLink: (linkId) => apiClient.delete(`/api/referrals/admin/affiliate-links/${linkId}`),
  
  // User Referral Management (for admin view)
  getUserReferrals: (userId, params = {}) => apiClient.get(`/api/referrals/admin/users/${userId}/referrals`, { params }),
};

// ============= IDEA API (Co-Create) =============
// Leaderboard API endpoints
export const leaderboardAPI = {
  // Public leaderboard endpoints
  getLeaderboard: () => {
    console.log('[LEADERBOARD_API] Fetching leaderboard data');
    return apiClient.get('/api/leaderboard');
  },
  getMyRank: (timeframe = null) => {
    console.log('[LEADERBOARD_API] Fetching user rank', timeframe ? `for ${timeframe}` : '');
    const params = timeframe ? { timeframe } : {};
    return apiClient.get('/api/leaderboard/my-rank', { params });
  },
  getLeaderboardStatus: () => {
    console.log('[LEADERBOARD_API] Fetching leaderboard status');
    return apiClient.get('/api/leaderboard/status');
  },
  
  // Admin leaderboard endpoints
  admin: {
    getSettings: () => {
      console.log('[LEADERBOARD_ADMIN_API] Fetching leaderboard settings');
      return apiClient.get('/api/admin/leaderboard/settings');
    },
    updateSettings: (settings) => {
      console.log('[LEADERBOARD_ADMIN_API] Updating leaderboard settings', settings);
      return apiClient.put('/api/admin/leaderboard/settings', settings);
    },
    refreshCache: () => {
      console.log('[LEADERBOARD_ADMIN_API] Refreshing leaderboard cache');
      return apiClient.post('/api/admin/leaderboard/refresh');
    },
    getCacheStatus: () => {
      console.log('[LEADERBOARD_ADMIN_API] Fetching cache status');
      return apiClient.get('/api/admin/leaderboard/cache-status');
    },
    getUserRank: (userId) => {
      console.log(`[LEADERBOARD_ADMIN_API] Fetching rank for user ${userId}`);
      return apiClient.get(`/api/admin/leaderboard/user/${userId}/rank`);
    }
  }
};

// Share to Earn XP API
export const shareAPI = {
  // Get user's share eligibility
  getShareEligibility: () => 
    enhancedFetch('/api/shares/eligibility'),
  
  // Generate share URL for specific type
  generateShareUrl: (shareData) => 
    enhancedFetch('/api/shares/generate-url', {
      method: 'POST',
      body: JSON.stringify(shareData)
    }),
  
  // Confirm a share action and award XP
  confirmShare: (shareData) => 
    enhancedFetch('/api/shares/confirm', {
      method: 'POST',
      body: JSON.stringify(shareData)
    }),
  
  // Record when a share prompt is shown
  recordPromptShown: (shareData) => 
    enhancedFetch('/api/shares/prompt-shown', {
      method: 'POST',
      body: JSON.stringify(shareData)
    }),
  
  // Get user's share history
  getShareHistory: (page = 1, perPage = 20) => 
    enhancedFetch(`/api/shares/history?page=${page}&per_page=${perPage}`),
  
  // Check if user has already shared for a specific type and object
  checkShareStatus: (shareType, relatedObjectId = null) => {
    const params = relatedObjectId ? `?related_object_id=${relatedObjectId}` : '';
    return enhancedFetch(`/api/shares/check-status/${shareType}${params}`);
  },
  
  // Get available badges that user can share
  getAvailableBadgeShares: () => 
    enhancedFetch('/api/shares/available-badges'),
  
  // Get available reward redemptions that user can share
  getAvailableRewardShares: () => 
    enhancedFetch('/api/shares/available-rewards'),
  
  // Get available raffle wins that user can share
  getAvailableRaffleShares: () => 
    enhancedFetch('/api/shares/available-raffles'),
  
  // Admin functions
  admin: {
    // Get share configuration
    getConfig: () => 
      enhancedFetch('/api/admin/shares/config'),
    
    // Update share configuration
    updateConfig: (configData) => 
      enhancedFetch('/api/admin/shares/config/bulk-update', {
        method: 'PUT',
        body: JSON.stringify(configData)
      }),
    
    // Get share analytics
    getAnalytics: (days = 30) => 
      enhancedFetch(`/api/admin/shares/analytics?days=${days}`),
    
    // Get detailed analytics
    getDetailedAnalytics: (days = 30, shareType = null) => {
      const params = new URLSearchParams({ days });
      if (shareType) params.append('share_type', shareType);
      return enhancedFetch(`/api/admin/shares/analytics/detailed?${params}`);
    },
    
    // Get top sharers
    getTopSharers: (limit = 10, days = 30) => 
      enhancedFetch(`/api/admin/shares/users/top-sharers?limit=${limit}&days=${days}`),
    
    // Reset configuration to defaults
    resetToDefaults: () => 
      enhancedFetch('/api/admin/shares/config/reset-defaults', {
        method: 'POST'
      }),
    
    // Test share URL generation
    testShareUrl: (testData) => 
      enhancedFetch('/api/admin/shares/test-share-url', {
        method: 'POST',
        body: JSON.stringify(testData)
      }),
    
    // Export analytics data
    exportAnalytics: (days = 30) => 
      enhancedFetch(`/api/admin/shares/export/analytics?days=${days}`),
    
    // Initialize default configuration
    initializeConfig: () => 
      enhancedFetch('/api/admin/shares/initialize-config', {
        method: 'POST'
      }),
    
    // Get dashboard data
    getDashboard: () => 
      enhancedFetch('/api/admin/shares/dashboard'),
    
    // Get HTML dashboard (for direct browser access)
    getDashboardHtml: () => 
      enhancedFetch('/api/admin/shares/dashboard-html')
  }
};

// Share Type Constants
export const SHARE_TYPES = {
  JOIN_SHARE: 'JOIN_SHARE',
  BADGE_SHARE: 'BADGE_SHARE',
  REWARD_REDEMPTION_SHARE: 'REWARD_REDEMPTION_SHARE',
  RAFFLE_WIN_SHARE: 'RAFFLE_WIN_SHARE',
  RAFFLE_ENTRY_SHARE: 'RAFFLE_ENTRY_SHARE'
};

// Helper function to open X (Twitter) share window
export const openShareWindow = (shareUrl, shareText) => {
  const width = 550;
  const height = 420;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;
  
  const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
  
  // Open X (Twitter) share window
  const shareWindow = window.open(shareUrl, 'share-window', features);
  
  // Focus the window if it was successfully opened
  if (shareWindow) {
    shareWindow.focus();
  }
  
  return shareWindow;
};

// Helper function to handle share flow
export const handleShareFlow = async (shareType, relatedObjectId = null, options = {}) => {
  try {
    // Record that prompt was shown
    if (options.recordPrompt !== false) {
      await shareAPI.recordPromptShown({
        share_type: shareType,
        related_object_id: relatedObjectId
      });
    }
    
    // Generate share URL
    const shareResult = await shareAPI.generateShareUrl({
      share_type: shareType,
      related_object_id: relatedObjectId
    });
    
    if (shareResult.error) {
      throw new Error(shareResult.error);
    }
    
    // Open share window
    const shareWindow = openShareWindow(shareResult.share_url, shareResult.share_text);
    
    // Optimistically confirm the share (as described in the requirements)
    const confirmResult = await shareAPI.confirmShare({
      share_type: shareType,
      related_object_id: relatedObjectId
    });
    
    return {
      success: true,
      shareWindow,
      shareResult,
      confirmResult,
      xpEarned: confirmResult.xp_earned || 0
    };
    
  } catch (error) {
    console.error('Share flow error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process share'
    };
  }
};

// Co-Create / Ideas API
export const ideaAPI = {
  // Public idea endpoints
  getTopIdeas: async (businessId, limit = 5) => {
      const response = await enhancedFetch(`/api/businesses/${businessId}/ideas/top?limit=${limit}`);
      return response;
  },
  
  getPublicIdeas: async (businessId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return enhancedFetch(`/api/businesses/${businessId}/ideas/public?${queryString}`);
  },
  
  getIdeaDetails: async (ideaId) => 
      enhancedFetch(`/api/ideas/${ideaId}`),
  
  // User actions
  createIdea: (businessId, ideaData) => 
      enhancedFetch(`/api/businesses/${businessId}/ideas`, {
          method: 'POST',
          body: JSON.stringify(ideaData)
      }),
  
  likeIdea: async (ideaId) => 
      enhancedFetch(`/api/ideas/${ideaId}/like`, { method: 'POST' }),
  
  // Comments
  getIdeaComments: (ideaId) => 
      enhancedFetch(`/api/ideas/${ideaId}/comments`),
  
  addComment: (ideaId, commentData) => 
      enhancedFetch(`/api/ideas/${ideaId}/comments`, {
          method: 'POST',
          body: JSON.stringify(commentData)
      }),
  
  // Admin endpoints
  getAdminIdeas: (businessId, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return enhancedFetch(`/api/admin/businesses/${businessId}/ideas?${queryString}`);
  },
  
  reviewIdea: (ideaId, reviewData) => 
      enhancedFetch(`/api/admin/ideas/${ideaId}/review`, {
          method: 'PUT',
          body: JSON.stringify(reviewData)
      })
};


export default apiClient;
