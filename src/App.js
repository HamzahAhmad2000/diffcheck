import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Router, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
// import { HelmetProvider } from 'react-helmet-async';

// Survey & Analytics
import SurveyDashboard from "./components/SurveyDashboard";
import SurveyResponse from "./components/SurveyResponse";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ReportTabPage from "./components/ReportTabPage";
import BatchReportCustomization from "../src/components/AnalyticsComponents/BatchReportCustomization";
import { authAPI } from 'services/apiClient';
import { BusinessProvider } from './services/BusinessContext';
// Survey Creation / Management
import GenerateSurvey from "./components/GenerateSurvey";
import SurveyGenerator from "./components/SurveyManagement/SurveyGenerator";
import AIChat from "./components/SurveyManagement/AIChat";
import QuickPoll from "./components/SurveyManagement/QuickPoll";
import SurveyCreationEntry from './components/SurveyManagement/SurveyCreationEntry';
import GuidedSurveyBuilder from './components/SurveyManagement/GuidedSurveyBuilder';
import CreateSurvey from "./components/SurveyManagement/CreateSurvey";
import CreateSurveyForBusiness from "./components/SurveyManagement/CreateSurveyForBusiness";

// Additional Admin Tools
import DistributionPanel from "./components/Analytics/DistributionPanel";
import SavedSurveyList from "./components/SurveyManagement/SavedSurveyList";
import "./styles/fonts.css"; // Import the fonts
import AISummaryReport from "./components/Analytics/AISummaryReport";
import LiveResponses from 'components/Analytics/LiveResponses';
// Import Analytics Components
import DemographicsFilterPanel from "./components/AnalyticsComponents/DemographicsFilterPanel";
import DemographicsSummary from "./components/AnalyticsComponents/DemographicsSummary";
import MergeAnalyticsDashboard from "./components/AnalyticsComponents/MergeAnalyticsDashboard";
import ResponseTimeAnalyticsPanel from "./components/AnalyticsComponents/ResponseTimeAnalyticsPanel";
import DropoutAnalysisPanel from "./components/AnalyticsComponents/DropoutAnalysisPanel";
import ReportDownloadPanel from "./components/AnalyticsComponents/ReportDownloadPanel";

// Authentication
import Login from "./components/Authentication/Login";
import LoginPasskey from "./components/Authentication/LoginPasskey";
import AdminRegistration from "./components/Authentication/AdminRegistration";
import Home from './components/Home';

// Import AdminDashboard
import AdminDashboard from './components/AdminDashboard';

// Import AdminLayout
import AdminLayout from './components/layouts/AdminLayout';

// Import AITestDataGenerator
import AITestDataGenerator from './components/ai_testing/AITestDataGenerator';

// Import GenerateResponses (Test Data Generator)
import GenerateResponses from './components/surveys/GenerateResponses';

// Import SuperAdminDashboard
import SuperAdminDashboard from './components/SuperAdminDashboard';
import CreateBusiness from './components/admin/CreateBusiness';
import CreateBusinessAdmin from './components/admin/CreateBusinessAdmin';
import ManageBusinesses from './components/admin/ManageBusinesses';
import EditBusiness from './components/admin/EditBusiness';
import BusinessSpecificDashboard from './components/admin/BusinessSpecificDashboard';
import EditSplashPage from './components/admin/EditSplashPage';
import ManageBusinessSurveys from './components/admin/ManageBusinessSurveys';
import BusinessAdminDashboard from './components/admin/BusinessAdminDashboard';
import PurchaseAIPoints from './components/admin/PurchaseAIPoints';
import BusinessSubscriptionManagement from './components/admin/BusinessSubscriptionManagement';
import ManageBusinessWall from './components/admin/ManageBusinessWall';
import ManageBusinessRequests from './components/admin/ManageBusinessRequests';
import UserManagement from './components/admin/UserManagement';
import BusinessFeedbackManagement from './components/admin/BusinessFeedbackManagement';
import BusinessIdeasManagement from './components/admin/BusinessIdeasManagement';
import PurchaseResponses from './components/admin/PurchaseResponses';
import ManageBusinessAdmins from './components/admin/ManageBusinessAdmins';
import CreateBusinessAdminForBusiness from './components/admin/CreateBusinessAdminForBusiness';

import UserEditProfile from './components/user/UserEditProfile';
import UserProfileOverview from './components/user/UserProfileOverview';
import UserHomepage from './components/user/UserHomepage';
import UserReferrals from './components/user/UserReferrals';
import UserLayout from './components/layouts/UserLayout'; // Import the new layout

// Import Share-to-Earn User Components
import { XPHistoryPage } from './components/user/share';



import BrandDetailPage from './components/user/BrandDetailPage';
import ReportBugPage from './components/user/ReportBugPage'; 
import RequestFeaturePage from './components/user/RequestFeaturePage';

// Import Business Analytics
import BusinessAnalyticsDashboard from './components/Analytics/BusinessAnalyticsDashboard';

// Import Marketplace Components
import MarketplacePage from './components/user/MarketplacePage'; // New User Marketplace
import MarketplaceItemDetail from './components/user/MarketplaceItemDetail'; // Marketplace Item Detail
import CreateMarketplaceItem from './components/admin/CreateMarketplaceItem'; // New Admin Create Item
import ManageMarketplaceItems from './components/admin/ManageMarketplaceItems'; // New Admin Manage Items
import EditMarketplaceItem from './components/admin/EditMarketplaceItem'; // New Admin Edit Item

// Import Marketplace Purchase Flow Components
import DeliveryForm from './components/marketplace/DeliveryForm';
import OrderConfirmation from './components/marketplace/OrderConfirmation';
import NotificationsScreen from './components/user/NotificationsScreen';

// Import Admin Marketplace Management Components
import AdminRaffleManagement from './components/admin/AdminRaffleManagement';
import AdminDeliveryManagement from './components/admin/AdminDeliveryManagement';
import AdminNotificationSender from './components/admin/AdminNotificationSender';
import SuperAdminNotificationsDashboard from './components/admin/SuperAdminNotificationsDashboard';

// Import Badge Components
import ManageBadges from './components/admin/ManageBadges';
import CreateBadge from './components/admin/CreateBadge';
import EditBadge from './components/admin/EditBadge';

// Import Referral Components
import ManageReferrals from './components/admin/ManageReferrals';
import ReferralAnalytics from './components/admin/ReferralAnalytics';

// Import Share-to-Earn Components
import ShareToEarnConfig from './components/admin/ShareToEarnConfig';

// Import Leaderboard Components
import LeaderboardManagement from './components/admin/LeaderboardManagement';

// Import Season Pass Components
import ManageSeasonPass from './components/admin/ManageSeasonPass';

// Import Daily Rewards Components
import AdminDailyRewardsDashboard from './components/admin/AdminDailyRewardsDashboard';
import AdminDailyRewardsConfigForm from './components/admin/AdminDailyRewardsConfigForm';

// Import Quest Management Components
import ManageQuests from './components/admin/ManageQuests';
import CreateQuest from './components/admin/CreateQuest';
import EditQuest from './components/admin/EditQuest';
import CreateQuestForBusiness from './components/admin/CreateQuestForBusiness';
import ManageQuestsForBusiness from './components/admin/ManageQuestsForBusiness';

// Import Business Tier and AI Points Package Management Components
import ManageBusinessTiers from './components/admin/ManageBusinessTiers';
import CreateBusinessTier from './components/admin/CreateBusinessTier';
import EditBusinessTier from './components/admin/EditBusinessTier';
import ManageAIPointsPackages from './components/admin/ManageAIPointsPackages';
import CreateAIPointsPackage from './components/admin/CreateAIPointsPackage';
import EditAIPointsPackage from './components/admin/EditAIPointsPackage';
import ManageResponsePackages from './components/admin/ManageResponsePackages';
import ManageQuestPackages from './components/admin/ManageQuestPackages';
import ManageAdminSeatPackages from './components/admin/ManageAdminSeatPackages';
import QuestApprovalDashboard from './components/admin/QuestApprovalDashboard';
import QuestVerificationDashboard from './components/admin/QuestVerificationDashboard';
import PurchaseQuestPackages from './components/admin/PurchaseQuestPackages';
import PurchaseAdminSeats from './components/admin/PurchaseAdminSeats';
import PurchaseResponsePackages from './components/admin/PurchaseResponsePackages';

// Import Forgot Password Components
import ForgotPasswordChoose from './components/Auth/ForgotPasswordFlow/ForgotPasswordChoose';
import ForgotPasswordEmail from './components/Auth/ForgotPasswordFlow/ForgotPasswordEmail';
import ForgotPasswordQuestions from './components/Auth/ForgotPasswordFlow/ForgotPasswordQuestions';
import ForgotPasswordPasskey from './components/Auth/ForgotPasswordFlow/ForgotPasswordPasskey';
import ResetPassword from './components/Auth/ForgotPasswordFlow/ResetPassword';

// Import Signup Step Components
import SignupStep1Credentials from './components/Auth/SignupStep1_Credentials';
import SignupStep2Profile from './components/Auth/SignupStep2_Profile';

import VerifyEmailPage from './components/Auth/VerifyEmailPage';

// Import User Components
import RequestBusinessForm from './components/user/RequestBusinessForm';
import SurveysPage from './components/user/SurveysPage';
import UserEditTags from './components/user/UserEditTags';
import UserRewardsHistory from './components/user/UserRewardsHistory';

// Import Season Pass Components
import SeasonPassActivation from './components/user/SeasonPassActivation';
import SeasonPassRewards from './components/user/SeasonPassRewards';
import UserBadges from './components/user/UserBadges';
import DailyRewards from './components/user/DailyRewards';

// Import Co-Create Components
import CoCreatePage from './components/user/CoCreatePage';
import IdeaDetailPage from './components/user/IdeaDetailPage';

// Import Quest Components
import QuestDashboard from './components/quests/QuestDashboard';

// Import Leaderboard Components
import Leaderboard from './components/user/Leaderboard';

// Import Survey Management Layout

// Import UpdatePassword
import UpdatePassword from './components/user/UpdatePassword';

// Import PurchaseSubscriptionTier
import PurchaseSubscriptionTier from './components/admin/PurchaseSubscriptionTier';

// Import ManageBusinessAudience
import ManageBusinessAudience from './components/admin/ManageBusinessAudience';

/**
 * ProtectedRoute:
 *   - Ensures user is logged in with a valid token
 *   - Allows roles: user, admin (by default) or can be restricted
 *   - If not authenticated or unauthorized role -> redirect
 *   - Performs token validation check
 */
const ProtectedRoute = ({ children, allowedRoles = ["user", "admin", "business_admin", "super_admin"] }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  useEffect(() => {
    const validateToken = async () => {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      const storedRole = localStorage.getItem('userRole');
      const storedUser = localStorage.getItem('user');
      
      if (!token) {
        console.log("No token found, redirecting to login");
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Use the authAPI to validate the token
        const response = await authAPI.getCurrentUser();
        console.log("Token validation response:", response);
        
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userRole', response.data.role);
        
        setUserData(response.data.user);
        setUserRole(response.data.role);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Token validation error:', error);
        
        // If we get a 401 Unauthorized, clear storage
        if (error.response && error.response.status === 401) {
          // Clear all localStorage data including any registration tokens
          localStorage.clear();
        } else {
          // For other errors like network issues, rely on stored role
          // This prevents users from being locked out due to temporary API issues
                  if (storedUser && storedRole) {
          console.log("Using stored role due to API error:", storedRole);
          try {
            setUserData(JSON.parse(storedUser));
            setUserRole(storedRole);
            setIsAuthenticated(true);
          } catch (parseError) {
            console.error("Error parsing stored user data:", parseError);
            localStorage.clear();
            setIsAuthenticated(false);
          }
          } else {
            setIsAuthenticated(false);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    validateToken();
  }, []);
  
  if (isLoading) {
    // Show loading state while validating
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

/** AdminRoute: subset of ProtectedRoute restricted to Super Admin role only. */
const AdminRoute = ({ children }) => {
  return <ProtectedRoute allowedRoles={["admin", "super_admin"]}>{children}</ProtectedRoute>;
};

/**
 * For public routes that should redirect authenticated users
 */
const PublicOnlyRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const tempToken = localStorage.getItem('reg_temp_auth_token');
  
  // Allow registration flows even if there's a temp token
  if (token && !tempToken) {
    const userRole = localStorage.getItem('userRole');
    // Route based on user role
    if (userRole === 'admin' || userRole === 'super_admin') {
      return <Navigate to="/admin" replace />;
    } else if (userRole === 'business_admin') {
      return <Navigate to="/business-admin/dashboard" replace />;
    } else {
      return <Navigate to="/user/home" replace />;
    }
  }
  
  return children;
};

/**
 * RootRedirect: Handles the root path "/" with proper authentication and role checks
 */
const RootRedirect = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log("[ROOT_REDIRECT] No token found, redirecting to home");
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Validate token with backend
        const response = await authAPI.getCurrentUser();
        console.log("[ROOT_REDIRECT] Token validation successful:", response.data);
        
        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userRole', response.data.role);
        
        setUserRole(response.data.role);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('[ROOT_REDIRECT] Token validation failed:', error);
        
        // Clear invalid auth data
        localStorage.clear();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthAndRedirect();
  }, []);
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/home" replace />;
  }
  
  // Redirect based on user role
  console.log("[ROOT_REDIRECT] Redirecting based on role:", userRole);
  
  if (userRole === 'super_admin' || userRole === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (userRole === 'business_admin') {
    return <Navigate to="/business-admin/dashboard" replace />;
  } else {
    return <Navigate to="/user/home" replace />;
  }
};

// ----- Route Wrappers -----
const QuestVerificationRouteWrapper = () => {
  const { businessId } = useParams();
  return <QuestVerificationDashboard businessId={businessId} />;
};

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* ========== PUBLIC BUSINESS ROUTES ========== */}
        <Route path="/businesses" element={<Navigate to="/user/surveys" replace />} />
        
        {/* This is the new detail page for a business */}
        <Route path="/business/:businessId" element={
          <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
            <BrandDetailPage />
          </ProtectedRoute>
        } />
        
        {/* This is the new page for viewing and voting on all feedback */}


        {/* These are the new separate form pages */}
        <Route path="/business/:businessId/report-bug" element={
          <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
            <ReportBugPage />
          </ProtectedRoute>
        } />
        <Route path="/business/:businessId/request-feature" element={
          <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
            <RequestFeaturePage />
          </ProtectedRoute>
        } />
        
        {/* Brand detail page - new layout with surveys, quests, and bug reporting */}
        <Route path="/brand/:businessId" element={
          <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
            <BrandDetailPage />
          </ProtectedRoute>
        } />
        
        <Route path="/home" element={<Home/>}/>

        {/* ========== AUTH ========== */}
        <Route path="/login" element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        } />
        <Route path="/login-passkey" element={
          <PublicOnlyRoute>
            <LoginPasskey />
          </PublicOnlyRoute>
        } />
        <Route path="/signup" element={<Navigate to="/register/step1" replace />} />

        {/* ========== FORGOT PASSWORD FLOW ========== */}
        <Route path="/forgot-password" element={
          <PublicOnlyRoute>
            <ForgotPasswordChoose />
          </PublicOnlyRoute>
        } />
        <Route path="/forgot-password/send-email" element={
          <PublicOnlyRoute>
            <ForgotPasswordEmail />
          </PublicOnlyRoute>
        } />
        <Route path="/forgot-password/verify-questions" element={
          <PublicOnlyRoute>
            <ForgotPasswordQuestions />
          </PublicOnlyRoute>
        } />
        <Route path="/forgot-password/verify-passkey" element={
          <PublicOnlyRoute>
            <ForgotPasswordPasskey />
          </PublicOnlyRoute>
        } />
        <Route path="/reset-password/:token" element={
          <PublicOnlyRoute>
            <ResetPassword />
          </PublicOnlyRoute>
        } />

        {/* ========== MULTI-STEP REGISTRATION ROUTES ========== */}
        <Route path="/register/step1" element={
          <PublicOnlyRoute>
            <SignupStep1Credentials />
          </PublicOnlyRoute>
        } />
        <Route path="/verify-email" element={
          <PublicOnlyRoute>
            <VerifyEmailPage />
          </PublicOnlyRoute>
        } />
        <Route path="/register/step2" element={
          <PublicOnlyRoute>
            <SignupStep2Profile />
          </PublicOnlyRoute>
        } />


        {/* ========== USER DASHBOARD & RELATED ROUTES (Wrapped in UserLayout) ========== */}
        <Route path="/user" element={
          <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
            <UserLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<UserHomepage />} />
          <Route path="dashboard" element={<Navigate to="/user/home" replace />} />
          <Route path="profile" element={<UserProfileOverview />} />
          <Route path="rewards-history" element={<UserRewardsHistory />} />
          <Route path="settings" element={<UserEditProfile />} />
          <Route path="profile/edit" element={<UserEditProfile />} />
          <Route path="profile/tags" element={<UserEditTags />} />
          <Route path="badges" element={<UserBadges />} />
          <Route path="rewards" element={<UserRewardsHistory />} />
          <Route path="xp-history" element={<XPHistoryPage />} />
          <Route path="daily-rewards" element={<DailyRewards />} />
          <Route path="brands" element={<UserHomepage />} />
          <Route path="surveys" element={<SurveysPage />} />
          <Route path="quests" element={<QuestDashboard />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="marketplace/item/:itemId" element={<MarketplaceItemDetail />} />
          <Route path="marketplace/purchase/:purchaseId/delivery" element={<DeliveryForm />} />
          <Route path="marketplace/order/:purchaseId/confirmation" element={<OrderConfirmation />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="season-pass/activate" element={<SeasonPassActivation />} />
          <Route path="season-pass/rewards" element={<SeasonPassRewards />} />
          <Route path="referrals" element={<UserReferrals />} />
          <Route path="brand/:businessId" element={<BrandDetailPage />} />
          <Route path="brand/:businessId/co-create" element={<CoCreatePage />} />
          <Route path="idea/:ideaId" element={<IdeaDetailPage />} />
        </Route>
        
        {/* Standalone routes without the main UserLayout */}

        {/* ========== ADMIN CREATE NEW ADMIN ========== */}
        <Route
          path="/admin/register"
          element={
            <AdminRoute>
              <AdminLayout><AdminRegistration /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== DEFAULT REDIRECT (HOME) ========== */}
        <Route
          path="/"
          element={
            <RootRedirect />
          }
        />

        {/* ========== CONTEXT-AWARE SURVEY CREATION REDIRECTS ========== */}
        {/* Redirect generic survey builder to business-specific if in business context */}
        <Route
          path="/survey-builder"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <BusinessProvider>
                <SurveyCreationEntry />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        
        {/* Redirect dashboard to appropriate context */}
        <Route
          path="/dashboard"
          element={
            localStorage.getItem("token") ? (
              (() => {
                const userRole = localStorage.getItem("userRole");
                let user = {};
                try {
                  user = JSON.parse(localStorage.getItem("user") || "{}");
                } catch (parseError) {
                  console.error("Error parsing user data in redirect logic:", parseError);
                  user = {};
                }
                
                if (userRole === "business_admin" && user.business_id) {
                  return <Navigate to={`/admin/business/${user.business_id}/surveys/new`} replace />;
                } else if (userRole === "admin" || userRole === "super_admin") {
                  return <Navigate to="/survey-builder" replace />;
                } else {
                  return <Navigate to="/user/home" replace />;
                }
              })()
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* ========== BUSINESS ADMIN DASHBOARD ========== */}
        <Route
          path="/business-admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <BusinessAdminDashboard />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Handle Discord OAuth success redirect */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <BusinessAdminDashboard />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== AI POINTS PURCHASE PAGE ========== */}
        <Route
          path="/business/purchase-points"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <AdminLayout>
                  <PurchaseAIPoints />
                </AdminLayout>
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== SUBSCRIPTION MANAGEMENT PAGE ========== */}
        <Route
          path="/business/subscription-management"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <AdminLayout>
                  <PurchaseSubscriptionTier />
                </AdminLayout>
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== SUPER ADMIN DASHBOARD (New Primary Admin Panel) ========== */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout><SuperAdminDashboard /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* Route for creating a new business (Super Admin only) */}
        <Route
          path="/admin/business/new"
          element={
            <AdminRoute>
              <AdminLayout><CreateBusiness /></AdminLayout>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/business-admin/new"
          element={
            <AdminRoute>
              <CreateBusinessAdmin />
            </AdminRoute>
          }
        />

        {/* Route for managing existing businesses (Super Admin only) */}
        <Route
          path="/admin/business/manage"
          element={
            <AdminRoute>
              <AdminLayout><ManageBusinesses /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* Route for editing a specific business (Super Admin only) */}
        <Route
          path="/admin/business/edit/:businessId"
          element={
            <AdminRoute>
              <AdminLayout><EditBusiness /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== BUSINESS SPECIFIC DASHBOARD ROUTES ========== */}
        {/* Route for business-specific dashboard */}
        <Route
          path="/admin/business/dashboard/:businessId"
          element={
            <AdminRoute>
              <BusinessSpecificDashboard />
            </AdminRoute>
          }
        />

        {/* Route for business analytics */}
        <Route
          path="/admin/business/:businessId/analytics"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <BusinessAnalyticsDashboard />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for editing business splash page/branding */}
        <Route
          path="/admin/business/:businessId/splash-page/edit"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <EditSplashPage />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for managing business surveys */}
        <Route
          path="/admin/business/:businessId/surveys/manage"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <ManageBusinessSurveys />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for managing business wall content */}
        <Route
          path="/admin/business/:businessId/wall/manage"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <BusinessProvider>
                <ManageBusinessWall />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/business/:businessId/admins/manage"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <BusinessProvider>
                <ManageBusinessAdmins />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/business/:businessId/admins/new"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <BusinessProvider>
                <CreateBusinessAdminForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* New route for the card-based feedback dashboard */}
        <Route path="/admin/business/:businessId/feedback" element={
          <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
            <BusinessProvider>
              <BusinessFeedbackManagement type="bugs" />
            </BusinessProvider>
          </ProtectedRoute>
        } />

        {/* Route for managing business ideas (co-create) */}
        <Route path="/admin/business/:businessId/ideas" element={
          <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
            <BusinessProvider>
              <BusinessIdeasManagement />
            </BusinessProvider>
          </ProtectedRoute>
        } />

        {/* Route for managing business audience settings */}
        <Route
          path="/admin/business/:businessId/audience"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <ManageBusinessAudience />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />

        <Route path="/admin/marketplace/new" element={<AdminRoute><CreateMarketplaceItem/></AdminRoute>}/>

        {/* Route for creating surveys for a specific business */}
        <Route
          path="/admin/business/:businessId/surveys/new"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <CreateSurveyForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for editing surveys for a specific business */}
        <Route
          path="/admin/business/:businessId/surveys/:surveyId/edit"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <CreateSurveyForBusiness />
            </ProtectedRoute>
          }
        />

        {/* Route for creating quests for a specific business */}
        <Route
          path="/admin/business/:businessId/quests/new"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <CreateQuestForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for managing quests for a specific business */}
        <Route
          path="/admin/business/:businessId/quests"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <ManageQuestsForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/business/:businessId/quests/manage"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <ManageQuestsForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* Route for editing quests for a specific business */}
        <Route
          path="/admin/business/:businessId/quests/:questId/edit"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <CreateQuestForBusiness />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== BUSINESS REQUEST WORKFLOW ROUTES ========== */}
        {/* Route for users to request a business */}
        <Route
          path="/business/request/new"
          element={
            <ProtectedRoute allowedRoles={["user", "business_admin"]}>
              <RequestBusinessForm />
            </ProtectedRoute>
          }
        />

        {/* Route for Super Admins to manage business requests */}
        <Route
          path="/admin/business/requests"
          element={
            <AdminRoute>
              <ManageBusinessRequests />
            </AdminRoute>
          }
        />

        {/* Route for Super Admins to manage all users */}
        <Route
          path="/admin/users/manage"
          element={
            <AdminRoute>
            
              <UserManagement />
            </AdminRoute>
          }
        />

        {/* Route for Platform Analytics/Statistics Dashboard */}
        <Route
          path="/admin/platform-overview"
          element={
            <AdminRoute>
              <AdminLayout><AdminDashboard /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* Route for Marketplace Management (placeholder for now) */}
        <Route
          path="/admin/marketplace/manage"
          element={
            <AdminRoute>
              <AdminLayout><ManageMarketplaceItems /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/marketplace/create"
          element={
            <AdminRoute>
              <AdminLayout><CreateMarketplaceItem /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/marketplace/edit/:itemId"
          element={
            <AdminRoute>
              <AdminLayout><EditMarketplaceItem /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== MARKETPLACE PURCHASE FLOW ADMIN ROUTES ========== */}
        <Route
          path="/admin/marketplace/raffles"
          element={
            <AdminRoute>
              <AdminLayout><AdminRaffleManagement /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/marketplace/delivery"
          element={
            <AdminRoute>
              <AdminLayout><AdminDeliveryManagement /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <AdminRoute>
              <SuperAdminNotificationsDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/notifications/send"
          element={
            <AdminRoute>
              <AdminLayout><AdminNotificationSender /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== BADGE MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/badges"
          element={
            <AdminRoute>
              <AdminLayout><ManageBadges /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/badges/create"
          element={
            <AdminRoute>
              <AdminLayout><CreateBadge /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/badges/edit/:badgeId"
          element={
            <AdminRoute>
              <AdminLayout><EditBadge /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* Route for managing referral system (Super Admin only) */}
        <Route
          path="/admin/referrals/manage"
          element={
            <AdminRoute>
              <><ManageReferrals /></>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/referrals/analytics"
          element={
            <AdminRoute>
              <><ReferralAnalytics /></>
            </AdminRoute>
          }
        />

        {/* ========== SHARE-TO-EARN MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/share-to-earn"
          element={
            <AdminRoute>
              <AdminLayout><ShareToEarnConfig /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== LEADERBOARD MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/leaderboard"
          element={
            <AdminRoute>
              <AdminLayout><LeaderboardManagement /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== SEASON PASS MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/season-pass"
          element={
            <AdminRoute>
              <ManageSeasonPass />
            </AdminRoute>
          }
        />

        {/* ========== DAILY REWARDS MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/daily-rewards"
          element={
            <AdminRoute>
              <AdminLayout><AdminDailyRewardsDashboard /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/daily-rewards/create"
          element={
            <AdminRoute>
              <AdminLayout><AdminDailyRewardsConfigForm /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/daily-rewards/edit/:configId"
          element={
            <AdminRoute>
              <AdminLayout><AdminDailyRewardsConfigForm /></AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/daily-rewards/duplicate/:configId"
          element={
            <AdminRoute>
              <AdminLayout><AdminDailyRewardsConfigForm /></AdminLayout>
            </AdminRoute>
          }
        />

        {/* ========== BUSINESS MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/business-tiers"
          element={
            <AdminRoute>
              <ManageBusinessTiers />
              </AdminRoute>
            }
          />
        {/* ========== QUEST MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/quests"
          element={
            <AdminRoute>
              <ManageQuests />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ai-points-packages"
          element={
            <AdminRoute>
              <ManageAIPointsPackages />
              </AdminRoute>
            }
          />
        <Route
          path="/admin/quests/create"
          element={
            <AdminRoute>
             <CreateQuest />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/response-packages"
          element={
            <AdminRoute>
              <ManageResponsePackages />
              </AdminRoute>
            }
          />
          <Route
          path="/admin/quests/edit/:questId"
          element={
            <AdminRoute>
              <EditQuest />
            </AdminRoute>
          }
        />

        {/* ========== BUSINESS TIER MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/business-tiers"
          element={
            <AdminRoute>
              <ManageBusinessTiers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/business-tiers/new"
          element={
            <AdminRoute>
              <CreateBusinessTier />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/business-tiers/edit/:tierId"
          element={
            <AdminRoute>
              <EditBusinessTier />
            </AdminRoute>
          }
        />

        {/* ========== AI POINTS PACKAGE MANAGEMENT ROUTES (SUPER ADMIN) ========== */}
        <Route
          path="/admin/ai-points-packages"
          element={
            <AdminRoute>
              <ManageAIPointsPackages />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ai-points-packages/new"
          element={
            <AdminRoute>
              <CreateAIPointsPackage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ai-points-packages/edit/:packageId"
          element={
            <AdminRoute>
              <EditAIPointsPackage />
           </AdminRoute>
          }
        />

        {/* Routes for business feedback management */}
        <Route
          path="/admin/business/:businessId/bugs"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <BusinessFeedbackManagement type="bugs" />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/business/:businessId/features"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <BusinessFeedbackManagement type="features" />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/business/:businessId/items"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "business_admin"]}>
              <BusinessProvider>
                <BusinessFeedbackManagement type="all" />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== SURVEY DASHBOARD (For Survey Listing/Stats) ========== */}
        <Route
          path="/survey-dashboard"
          element={
            <AdminRoute>
              <SurveyDashboard />
            </AdminRoute>
          }
        />

        {/* ========== AI TEST DATA GENERATOR (ADMIN ONLY) ========== */}
        <Route
          path="/ai-test-data"
          element={
            <ProtectedRoute allowedRoles={["admin", "business_admin", "super_admin"]}>
              <BusinessProvider>
                <AITestDataGenerator />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== GENERATE SURVEY RESPONSES (ADMIN ONLY) ========== */}
        <Route
          path="/admin/surveys/:surveyId/generate-responses"
          element={
            <ProtectedRoute allowedRoles={["admin", "business_admin", "super_admin"]}>
              <GenerateResponses />
            </ProtectedRoute>
          }
        />

        {/* ========== SAVED SURVEYS LIST (ADMIN ONLY) ========== */}
        <Route
          path="/savedsurveys"
          element={
            <AdminRoute>
              <SavedSurveyList />
            </AdminRoute>
          }
        />

        {/* ========== SURVEY RESPONSE (ANY LOGGED USER) ========== */}
        <Route 
          path="/survey/:surveyId/:linkCode" 
          element={
            <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
              <SurveyResponse />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/survey/:surveyId" 
          element={
            <ProtectedRoute allowedRoles={["user", "admin", "business_admin", "super_admin"]}>
              <SurveyResponse />
            </ProtectedRoute>
          } 
        />

        {/* ========== ANALYTICS DASHBOARD (ADMIN ONLY) ========== */}
        <Route
          path="/analytics/:surveyId"
          element={
            <ProtectedRoute allowedRoles={[ "admin", "business_admin", "super_admin"]}>
              <AnalyticsDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<BatchReportCustomization />} />
          <Route path="demographics" element={<DemographicsFilterPanel />} />
          <Route path="demographics-summary" element={<DemographicsSummary />} />
          <Route path="merge-links" element={<MergeAnalyticsDashboard />} />
          <Route path="response-time" element={<ResponseTimeAnalyticsPanel />} />
          <Route path="dropout" element={<DropoutAnalysisPanel />} />
          <Route path="report" element={<ReportDownloadPanel />} />
          <Route path="ai-summary" element={<AISummaryReport />} />
          <Route path="distribution" element={<DistributionPanel />} />
          <Route path="/analytics/:surveyId/batch-customization" element={<BatchReportCustomization />} />
          <Route path="live-responses" element={<LiveResponses />} />
          <Route path="pdf-reporting" element={<ReportTabPage />} />
        </Route>

        {/* ========== SURVEY CREATION & AI TOOLS ========== */}
        <Route
          path="/generate"
          element={
            <AdminRoute>
              <GenerateSurvey />
            </AdminRoute>
          }
        />
        <Route
          path="/survey-editor"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <SurveyGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-chat"
          element={
            <AdminRoute>
              <AIChat />
            </AdminRoute>
          }
        />
        <Route
          path="/quick-poll"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
              <BusinessProvider>
                <QuickPoll />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-survey"
          element={
            <AdminRoute>
              <CreateSurvey />
            </AdminRoute>
          }
        />
        {/* ========== SURVEY BUILDER SUB-ROUTES ========== */}
        <Route path="/survey-builder/quick" element={
          <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
            <BusinessProvider>
              <AIChat />
            </BusinessProvider>
          </ProtectedRoute>
        } />
        <Route path="/survey-builder/guided" element={
          <ProtectedRoute allowedRoles={["super_admin", "admin", "business_admin"]}>
            <BusinessProvider>
              <GuidedSurveyBuilder />
            </BusinessProvider>
          </ProtectedRoute>
        } />
        <Route path="/ai-survey-builder/*" element={<Navigate to="/survey-builder" replace />} />

        {/* ========== OPTIONAL ADMIN PANELS FOR DISTRIBUTION / ACCESS ========== */}
        <Route
          path="/distribution/:surveyId"
          element={
            <AdminRoute>
              <DistributionPanel />
            </AdminRoute>
          }
        />
        <Route
          path="/analytics/:surveyId/live-analytics"
          element={
            <ProtectedRoute allowedRoles={["admin", "business_admin", "super_admin"]}>
              <LiveResponses />
            </ProtectedRoute>
          }
        />
        


        {/* ========== RESPONSE QUOTA PURCHASE PAGE ========== */}
        <Route
          path="/business/purchase-responses"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <PurchaseResponses />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ========== UNAUTHORIZED & 404 ========== */}
        <Route
          path="/unauthorized"
          element={
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <h2>Unauthorized Access</h2>
              <p>You don't have permission to access this page.</p>
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "20px",
                }}
              >
                Go Back
              </button>
            </div>
          }
        />

        {/* Update Password Route */}
        <Route
          path="/user/update-password"
          element={
            <ProtectedRoute allowedRoles={["user", "business_admin", "admin", "super_admin"]}>
              <UpdatePassword />
            </ProtectedRoute>
          }
        />

        {/* ===== NEW QUEST & SEAT PACKAGE MANAGEMENT ROUTES ===== */}
        <Route
          path="/admin/quest-packages"
          element={
            <AdminRoute>
              <ManageQuestPackages />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/admin-seat-packages"
          element={
            <AdminRoute>
              <ManageAdminSeatPackages />
            </AdminRoute>
          }
        />
        {/* ===== QUEST APPROVAL DASHBOARD (SUPER ADMIN) ===== */}
        <Route
          path="/admin/quest-approvals"
          element={
            <AdminRoute>
              <QuestApprovalDashboard />
            </AdminRoute>
          }
        />

        {/* ===== BUSINESS ADMIN QUEST VERIFICATION DASHBOARD ===== */}
        <Route
          path="/admin/business/:businessId/quest-verifications"
          element={
            <ProtectedRoute allowedRoles={["business_admin", "super_admin"]}>
              <BusinessProvider>
                <QuestVerificationRouteWrapper />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* ===== BUSINESS ADMIN PURCHASE PAGES ===== */}
        <Route
          path="/business/purchase-quest-credits"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <PurchaseQuestPackages />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/business/purchase-admin-seats"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <PurchaseAdminSeats />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/business/purchase-responses"
          element={
            <ProtectedRoute allowedRoles={["business_admin"]}>
              <BusinessProvider>
                <PurchaseResponsePackages />
              </BusinessProvider>
            </ProtectedRoute>
          }
        />

        {/* User Profile Routes */}
        <Route path="/profile" element={<ProtectedRoute><UserProfileOverview /></ProtectedRoute>} />

        <Route
          path="*"
          element={
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <h2>404 - Page Not Found</h2>
              <p>The page you're looking for doesn't exist.</p>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "20px",
                }}
              >
                Go Home
              </button>
            </div>
          }
        />
      </Routes>
    </>
  );
}

export default App;
