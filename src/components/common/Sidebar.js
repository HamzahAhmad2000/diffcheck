import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';
import { baseURL } from '../../services/apiClient';
import { useBusiness } from '../../services/BusinessContext';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(window.innerWidth > 768);
  const [expandedItems, setExpandedItems] = useState({}); // State for managing expanded submenus
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get user data and role
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = localStorage.getItem('userRole');

  // State for business data when context is not available
  const [businessData, setBusinessData] = useState(null);
  const [businessDataLoading, setBusinessDataLoading] = useState(false);
  // State for pending quest approvals (super admin)
  const [questApprovalCount, setQuestApprovalCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Get business context for AI points and permissions
  let businessContextData = null;
  try {
    businessContextData = useBusiness();
  } catch (error) {
    // Not in a business context, which is fine for non-business admin users
  }

  // If no business context but user is business admin, fetch business data directly
  useEffect(() => {
    if (!businessContextData && userRole === 'business_admin' && user.business_id && !businessDataLoading) {
      setBusinessDataLoading(true);
      
      const fetchBusinessData = async () => {
        try {
          const { businessAPI } = await import('../../services/apiClient');
          const response = await businessAPI.getDetails(user.business_id);
          setBusinessData(response.data);
        } catch (error) {
          console.error('[Sidebar] Failed to fetch business data:', error);
          setBusinessData(null);
        } finally {
          setBusinessDataLoading(false);
        }
      };
      
      fetchBusinessData();
    }
  }, [businessContextData, userRole, user.business_id, businessDataLoading]);

  // Fetch admin dashboard summary for super admins/admins
  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin') {
      const fetchSummary = async () => {
        try {
          const { adminDashboardAPI } = await import('../../services/apiClient');
          const response = await adminDashboardAPI.getSummary();
          const pendingApprovals = response?.data?.pending_quest_approvals ?? 0;
          const unread = response?.data?.unread_notifications ?? 0;
          setQuestApprovalCount(pendingApprovals);
          setUnreadNotificationCount(unread);
        } catch (error) {
          console.error('[Sidebar] Failed to fetch admin dashboard summary:', error);
        }
      };

      fetchSummary();
      const intervalId = setInterval(fetchSummary, 30000); // Refresh every 30s for responsiveness
      return () => clearInterval(intervalId);
    }
  }, [userRole]);

  // Use business context data if available, otherwise use directly fetched data
  const effectiveBusinessData = businessContextData || (businessData ? {
    business: businessData,
    aiPoints: businessData.ai_points || 0,
    permissions: businessData.permissions || {},
    hasPermission: (permission) => businessData.permissions?.[permission] === true,
    hasAIPoints: (points) => (businessData.ai_points || 0) >= points,
    questCredits: businessData.quest_credits_available || 0,
    questCreditsPurchased: businessData.quest_credits_purchased || 0,
    monthlyQuestLimit: businessData.monthly_quest_limit || 0,
    monthlyQuestsUsed: businessData.monthly_quests_used || 0,
    canCreateQuests: () => {
      if (userRole === 'super_admin') return true;
      
      const tierAllowsQuests = businessData.tier_info?.can_create_quests || false;
      // Check if tier allows quests OR if there's a legacy monthly quest limit
      const hasQuestCapability = tierAllowsQuests || (businessData.monthly_quest_limit > 0);
      
      if (!hasQuestCapability) {
        return (businessData.quest_credits_purchased || 0) > 0;
      }
      
      const monthlyLimit = businessData.monthly_quest_limit || 0;
      const monthlyUsed = businessData.monthly_quests_used || 0;
      const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
      const purchasedCredits = businessData.quest_credits_purchased || 0;
      
      return (remainingMonthly + purchasedCredits) > 0;
    },
    canAddAdminSeat: () => {
      const totalSeats = (businessData.tier_info?.admin_seat_limit || 1) + (businessData.admin_seats_purchased || 0);
      const usedSeats = businessData.current_admin_count || 0;
      return totalSeats === -1 || usedSeats < totalSeats; // -1 means unlimited
    },
    getAvailableQuestCredits: () => {
      if (userRole === 'super_admin') return Infinity;
      
      const tierAllowsQuests = businessData.tier_info?.can_create_quests || false;
      // Check if tier allows quests OR if there's a legacy monthly quest limit
      const hasQuestCapability = tierAllowsQuests || (businessData.monthly_quest_limit > 0);
      
      if (hasQuestCapability) {
        const monthlyLimit = businessData.monthly_quest_limit || 0;
        const monthlyUsed = businessData.monthly_quests_used || 0;
        const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
        const purchasedCredits = businessData.quest_credits_purchased || 0;
        
        return remainingMonthly + purchasedCredits;
      } else {
        return businessData.quest_credits_purchased || 0;
      }
    }
  } : null);

  // Extract business context from URL or user data
  const getBusinessContext = () => {
    // Check if we're in a business-specific route
    const businessMatch = location.pathname.match(/\/admin\/business\/(\d+)/);
    if (businessMatch) {
      return { businessId: businessMatch[1], fromUrl: true };
    }

    // For business admin, use their associated business
    if (userRole === 'business_admin' && user.business_id) {
      return { businessId: user.business_id, fromUser: true };
    }

    return null;
  };

  const businessContext = getBusinessContext();

  // Helper function to check if a feature is locked due to tier limitations
  const isFeatureLocked = (item) => {
    if (userRole === 'super_admin') return false; // Super admin bypass
    if (!effectiveBusinessData) return true;

    // Check for super business tier (usually highest tier with unlimited access)
    const isSuperTier = effectiveBusinessData.business?.tier === 'super' || 
                        effectiveBusinessData.business?.tier_info?.is_unlimited || 
                        false;
    
    if (isSuperTier) return false; // Super tier has all features

    // Check specific feature requirements
    if (item.requiresQuests) {
      return !effectiveBusinessData.canCreateQuests();
    }

    if (item.requiresAdminSeats) {
      return !effectiveBusinessData.canAddAdminSeat();
    }

    if (item.requiresAI) {
      return !effectiveBusinessData.hasAIPoints(item.minPoints || 1);
    }

    return false;
  };

  // Helper function to get redirect path for locked features
  const getRedirectPath = (item) => {
    if (item.requiresQuests) {
      // Check if they have any credits available before redirecting
      const credits = effectiveBusinessData.getAvailableQuestCredits();
      if (credits <= 0) {
        return '/business/purchase-quest-credits';
      }
      // If they have credits, don't redirect - allow the click to proceed
      return null;
    }
    if (item.requiresAdminSeats) {
      return '/business/purchase-admin-seats';
    }
    if (item.requiresAI) {
      return '/business/purchase-points';
    }
    return null;
  };

  // Enhanced click handler for sidebar items
  const handleSidebarClick = (item, originalPath) => {
    // Check if feature is locked
    if (isFeatureLocked(item)) {
      const redirectPath = getRedirectPath(item);
      if (redirectPath) {
        navigate(redirectPath);
        return;
      }
    }

    // Check permissions for regular items
    if (isFeatureDisabled(item)) {
      return; // Don't navigate if feature is disabled by permissions
    }

    // Normal navigation
    navigate(originalPath);
  };

  // Add window resize handler and body class management
  useEffect(() => {
    const handleResize = () => {
      setIsOpen(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add/remove body class for sidebar spacing
  useEffect(() => {
    // Pages that should NOT have sidebar spacing (they have their own layout or custom sidebar)
    const excludedPages = [
      '/login', '/signup', '/businesses', // Public pages
      '/survey/', // Survey response pages (starts with)
      '/business/', // Public business pages (starts with) - but need to check if it's business admin context
    ];
    
    // Check if current page should be excluded
    const isExcludedPage = excludedPages.some(path => {
      if (path.endsWith('/')) {
        return location.pathname.startsWith(path);
      }
      return location.pathname === path;
    });

    // Special case: /business/:id routes should not have sidebar for public users, 
    // but business admin pages under /admin/business should have sidebar
    const isPublicBusinessPage = location.pathname.startsWith('/business/') && 
                                 !location.pathname.startsWith('/business/request') &&
                                 !location.pathname.startsWith('/business/subscription-management') &&
                                 !location.pathname.startsWith('/business/purchase-');

    if (!isExcludedPage && !isPublicBusinessPage && window.innerWidth > 1024) {
      document.body.classList.add('sidebar-active');
    } else {
      document.body.classList.remove('sidebar-active');
    }

    const handleResize = () => {
      if (!isExcludedPage && !isPublicBusinessPage && window.innerWidth > 1024) {
        document.body.classList.add('sidebar-active');
      } else {
        document.body.classList.remove('sidebar-active');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('sidebar-active');
    };
  }, [location.pathname]);

  // Keep parent menu open if child route is active
  useEffect(() => {
    const currentPath = location.pathname;
    const navigationItems = getNavigationItems();
    
    navigationItems.forEach(item => {
      if (item.subItems) {
        const hasActiveChild = item.subItems.some(subItem => currentPath === subItem.path);
        if (hasActiveChild) {
          setExpandedItems(prev => ({ ...prev, [item.key]: true }));
        }
      }
    });
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');

      // Call the logout endpoint
      await fetch(`${baseURL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Clear ALL session/authentication data from localStorage.
      // This is the critical fix. It removes login tokens AND any leftover
      // registration tokens (like reg_temp_auth_token).
      localStorage.clear();

      // Redirect to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);

      // Even if the server request fails, still clear local storage and redirect
      localStorage.clear();
      navigate('/login');
    }
  };

  const toggleSidebar = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (window.innerWidth >= 1024) {
      if (nextOpen) {
        document.body.classList.add('sidebar-active');
      } else {
        document.body.classList.remove('sidebar-active');
      }
    }
  };

  // Function to toggle submenu expansion
  const toggleExpand = (key) => {
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Generate navigation items based on context and role
  const getNavigationItems = () => {
    let items = [];

    // Business Admin context
    if (userRole === 'business_admin' && businessContext) {
      items = [
        {
          path: `/business-admin/dashboard`,
          icon: 'ri-dashboard-line',
          label: 'Dashboard',
        },
        {
          label: 'Surveys',
          icon: 'ri-file-list-3-line',
          key: 'surveys',
          subItems: [
            {
              path: `/admin/business/${businessContext.businessId}/surveys/new`,
              icon: 'ri-corner-down-right-line',
              label: 'New Survey',
              permissionKey: 'can_create_surveys'
            },            
            {
              path: '/survey-builder',
              icon: 'ri-corner-down-right-line',
              label: 'AI Survey Builder',
              requiresAI: true,
              minPoints: 1
            },
            {
              path: '/quick-poll',
              icon: 'ri-corner-down-right-line',
              label: 'Quick Poll',
              permissionKey: 'can_create_surveys'
            },
            {
              path: `/admin/business/${businessContext.businessId}/surveys/manage`,
              icon: 'ri-corner-down-right-line',
              label: 'Manage Surveys',
              permissionKey: 'can_edit_surveys'
            }
          ]
        },
        {
          path: `/admin/business/${businessContext.businessId}/analytics`,
          icon: 'ri-bar-chart-box-line',
          label: 'Business Analytics',
          permissionKey: 'can_view_survey_analytics'
        },
        {
          label: 'Quests',
          icon: 'ri-compass-3-line',
          key: 'quests',
          subItems: [
            {
              path: `/admin/business/${businessContext.businessId}/quests/new`,
              icon: 'ri-corner-down-right-line',
              label: 'Create Quest',
              permissionKey: 'can_create_quests',
              requiresQuests: true
            },
            {
              path: `/admin/business/${businessContext.businessId}/quests`,
              icon: 'ri-corner-down-right-line',
              label: 'Manage Quests',
              permissionKey: 'can_create_quests',
              requiresQuests: true
            },
            {
              path: `/admin/business/${businessContext.businessId}/quest-verifications`,
              icon: 'ri-corner-down-right-line',
              label: 'Verify Completions',
              permissionKey: 'can_create_quests'
            }
          ]
        },
        {
          label: 'Brand Wall',
          icon: 'ri-palette-line',
          key: 'customization',
          subItems: [
            {
              path: `/admin/business/${businessContext.businessId}/splash-page/edit`,
              icon: 'ri-corner-down-right-line',
              label: 'Brand Page Customization',
            },
            {
              path: `/admin/business/${businessContext.businessId}/audience`,
              icon: 'ri-corner-down-right-line',
              label: 'Audience Selection',
            }
          ]
        },
        {
          label: 'Bug & Feature Prioritization',
          icon: 'ri-feedback-line',
          key: 'feedback',
          subItems: [
            {
              path: `/admin/business/${businessContext.businessId}/bugs`,
              icon: 'ri-corner-down-right-line',
              label: 'Bugs',
              permissionKey: 'can_create_bug_reports'
            },
            {
              path: `/admin/business/${businessContext.businessId}/features`,
              icon: 'ri-corner-down-right-line',
              label: 'Features',
              permissionKey: 'can_create_feature_requests'
            },
            {
              path: `/admin/business/${businessContext.businessId}/items`,
              icon: 'ri-corner-down-right-line',
              label: 'All Feedback',
              permissionKeys: ['can_manage_items','can_create_bug_reports','can_create_feature_requests']
            }
          ]
        },
        {
          label: 'Co-Create Ideas',
          icon: 'ri-lightbulb-line',
          key: 'ideas',
          path: `/admin/business/${businessContext.businessId}/ideas`,
          permissionKey: 'can_view_co_create'
        },
        {
          path: `/admin/business/${businessContext.businessId}/admins/manage`,
          icon: 'ri-admin-line',
          label: 'Manage Business Admins',
          permissionKey: 'can_manage_admins',
          requiresAdminSeats: true
        },
        {
          path: '/business/subscription-management',
          icon: 'ri-vip-crown-line',
          label: 'Subscription Management',
        },
        {
          path: '/business/purchase-responses',
          icon: 'ri-database-2-line',
          label: 'Purchase Responses',
        },
      ];
    }

    // Super Admin general context
    else if (userRole === 'super_admin' || userRole === 'admin') {
      const questLabel = 'Quests';
      const questApprovalsSubLabel = 'Quest Approvals';

      items = [
        {
          label: 'Surveys',
          icon: 'ri-file-list-3-line',
          key: 'surveys',
          subItems: [
            {
              path: '/create-survey',
              icon: 'ri-corner-down-right-line',
              label: 'New Survey',
            },
            {
              path: '/quick-poll',
              icon: 'ri-corner-down-right-line',
              label: 'Quick Poll',
            },
            {
              path: '/savedsurveys',
              icon: 'ri-corner-down-right-line',
              label: 'All Surveys',
            }
          ]
        },
        {
          label: questLabel,
          icon: 'ri-compass-3-line',
          key: 'quests',
          bold: questApprovalCount > 0,
          subItems: [
            {
              path: '/admin/quests/create',
              icon: 'ri-corner-down-right-line',
              label: 'Create Quest',
            },
            {
              path: '/admin/quests',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Quests',
            },
            {
              path: '/admin/quest-approvals',
              icon: 'ri-corner-down-right-line',
              label: questApprovalsSubLabel,
              count: questApprovalCount,
              bold: questApprovalCount > 0,
            },
            {
              path: '/admin/quest-packages',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Quest Packages',
            }
          ]
        },
        {
          label: 'Business',
          icon: 'ri-building-line',
          key: 'business',
          subItems: [
            {
              path: '/admin/business/manage',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Business',
            },
            {
              path: '/admin/business/new',
              icon: 'ri-corner-down-right-line',
              label: 'Add Business',
            }
          ]
        },
        {
          label: 'AI Tools',
          icon: 'ri-robot-line',
          key: 'ai',
          subItems: [
            {
              path: '/survey-builder',
              icon: 'ri-corner-down-right-line',
              label: 'AI Survey Builder',
            },
            {
              path: '/ai-test-data',
              icon: 'ri-corner-down-right-line',
              label: 'AI Test Data Gen',
            }
          ]
        },
        {
          label: 'Business Management',
          icon: 'ri-settings-3-line',
          key: 'business-management',
          subItems: [
            {
              path: '/admin/business-tiers',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Business Tiers',
            },
            {
              path: '/admin/ai-points-packages',
              icon: 'ri-corner-down-right-line',
              label: 'Manage AI Points Packages',
            },
            {
              path: '/admin/response-packages',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Response Packages',
            },
            {
              path: '/admin/admin-seat-packages',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Admin Seat Packages',
            }
          ]
        },
        {
          label: 'Badges & Platform',
          icon: 'ri-medal-line',
          key: 'platform',
          subItems: [
            {
              path: '/admin/badges',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Badges',
            },
            {
              path: '/admin/leaderboard',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Leaderboard',
            },
            {
              path: '/admin/season-pass',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Season Pass',
            },
            {
              path: '/admin/daily-rewards',
              icon: 'ri-corner-down-right-line',
              label: 'Daily Rewards',
            },
            {
              path: '/admin/platform-overview',
              icon: 'ri-corner-down-right-line',
              label: 'Platform Statistics',
            }
          ]
        },
        {
          path: '/admin/users/manage',
          icon: 'ri-group-line',
          label: 'Users',
        },
        {
          path: '/admin/marketplace/manage',
          icon: 'ri-store-2-line',
          label: 'Marketplace',
        },
        {
          label: 'Notifications',
          icon: 'ri-notification-line',
          key: 'notifications',
          count: unreadNotificationCount,
          subItems: [
            {
              path: '/admin/notifications',
              icon: 'ri-corner-down-right-line',
              label: 'Admin Dashboard',
            },
            {
              path: '/admin/notifications/send',
              icon: 'ri-corner-down-right-line',
              label: 'Send Notifications',
            }
          ]
        },
        {
          label: 'Referral & Affiliate System',
          icon: 'ri-user-add-line',
          key: 'referral-system',
          subItems: [
            {
              path: '/admin/referrals/manage',
              icon: 'ri-corner-down-right-line',
              label: 'Manage Referrals',
            },
            {
              path: '/admin/referrals/analytics',
              icon: 'ri-corner-down-right-line',
              label: 'Referral Analytics',
            }
          ]
        },
        {
          path: '/admin/share-to-earn',
          icon: 'ri-share-line',
          label: 'Share-to-Earn Config',
        },
        { type: 'separator' },
        {
          path: '/admin',
          icon: 'ri-admin-line',
          label: 'Super Admin Panel',
          priority: true
        },
      ];
    }

    // Regular User Navigation
    else if (userRole === 'user') {
      items = [
        {
          path: '/user/home',
          icon: 'ri-home-4-line',
          label: 'Homepage',
          description: 'Your personal dashboard'
        },
        {
          path: '/surveys',
          icon: 'ri-file-list-3-line',
          label: 'Surveys',
          description: 'Find surveys from businesses'
        },
        {
          path: '/quests',
          icon: 'ri-compass-3-line',
          label: 'Quests',
          description: 'Discover quests from businesses'
        },
        {
          path: '/businesses',
          icon: 'ri-building-line',
          label: 'Businesses',
          description: 'Explore all businesses'
        },
        {
          path: '/marketplace',
          icon: 'ri-store-2-line',
          label: 'Marketplace',
          description: 'Redeem your XP for rewards'
        },
        {
          path: '/user/xp-history',
          icon: 'ri-history-line',
          label: 'XP History',
          description: 'View your XP transactions'
        },
        { type: 'separator' },
        {
          path: '/business/request/new',
          icon: 'ri-bug-line',
          label: 'Report Bugs',
          description: 'Report issues you found'
        },
        {
          path: '/business/request/new',
          icon: 'ri-lightbulb-flash-line',
          label: 'Request Features',
          description: 'Suggest new features'
        }
      ];
    }

    return items;
  };

  const navigationItems = getNavigationItems();

  // Helper function to check if an item should be disabled due to permissions
  const isFeatureDisabled = (item) => {
    if (!item.permissionKey && !item.permissionKeys) return false;
    if (userRole === 'super_admin') return false; // super admin bypass
    if (!effectiveBusinessData) return true;
    if (item.permissionKey) {
      return !effectiveBusinessData.hasPermission(item.permissionKey);
    }
    if (item.permissionKeys) {
      // disable only if NONE of the listed permissions are allowed
      const allowed = item.permissionKeys.some(pk => effectiveBusinessData.hasPermission(pk));
      return !allowed;
    }
    return false;
  };

  // Helper function to check if an AI feature should be disabled
  const isAIFeatureDisabled = (item) => {
    if (!item.requiresAI) return false;
    if (userRole === 'super_admin') return false; // Super admin bypass

    if (!effectiveBusinessData) {
      return true; // No business context
    }

    // Check permission
    if (item.aiPermission && !effectiveBusinessData.hasPermission(item.aiPermission)) {
      return true;
    }

    // For business admin, if they don't have AI points, redirect them to purchase
    if (item.minPoints && !effectiveBusinessData.hasAIPoints(item.minPoints)) {
      return true; // This will show as locked and redirect on click
    }
    return false;
  };

  // Get sidebar title based on context
  const getSidebarTitle = () => {
    if (businessContext && userRole === 'business_admin') {
      return 'Business Panel';
    }
    if (businessContext && (userRole === 'super_admin' || userRole === 'admin')) {
      return `Admin: Business ${businessContext.businessId}`;
    }
    if (userRole === 'super_admin' || userRole === 'admin') {
      return 'Super Admin';
    }
    return 'Eclipseer';
  };

  return (
    <>
      <button className={`sidebar-toggle ${isOpen ? 'open' : ''}`} onClick={toggleSidebar}>
        <i className={`ri-${isOpen ? 'close' : 'menu'}-line`}></i>
      </button>

      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={toggleSidebar}></div>

      <div className={`common-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-top-icons">
          <button className="icon-button" onClick={toggleSidebar} aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'} title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <i className={`ri-${isOpen ? 'arrow-left-s-line' : 'menu-2-line'}`}></i>
          </button>
          <button className="icon-button">
            <i className="ri-notification-line"></i>
          </button>
          <button className="icon-button">
            <i className="ri-settings-line"></i>
          </button>
          <button className="icon-button">
            <i className="ri-refresh-line"></i>
          </button>
        </div>

        <div className="sidebar-content">
          <nav className="sidebar-nav">
            {navigationItems.map((item, index) => {
              // Handle separator
              if (item.type === 'separator') {
                return <div key={`separator-${index}`} className="sidebar-separator" />;
              }

              // Handle items with subitems
              if (item.subItems) {
                const isExpanded = expandedItems[item.key];
                const hasActiveChild = item.subItems.some(subItem => location.pathname === subItem.path);
                
                return (
                  <div key={index} className="nav-item-container">
                    <div 
                      className={`sidebar-link ${hasActiveChild ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(item.key)}
                      style={{ fontWeight: item.bold ? 'bold' : 'normal' }}
                    >
                      <i className={`ri-arrow-right-s-line expand-icon ${isExpanded ? 'expanded' : ''}`}></i>
                      <i className={item.icon}></i>
                      <span>{item.label}</span>
                      {item.count > 0 && (
                        <span className="badge-count">{item.count}</span>
                      )}
                    </div>
                    <div className={`submenu ${isExpanded ? 'expanded' : ''}`}>
                      {item.subItems.map((subItem, subIndex) => {
                        const isDisabled = isFeatureDisabled(subItem) || isAIFeatureDisabled(subItem);
                        const isLocked = isFeatureLocked(subItem);
                        
                        if (isDisabled || isLocked) {
                          let tooltipText = '';
                                                     if (isLocked) {
                             if (subItem.requiresQuests) {
                               const monthlyLimit = effectiveBusinessData?.monthlyQuestLimit || 0;
                               const monthlyUsed = effectiveBusinessData?.monthlyQuestsUsed || 0;
                               const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
                               const purchased = effectiveBusinessData?.questCreditsPurchased || 0;
                               
                               if (remainingMonthly > 0) {
                                 tooltipText = `Requires quest credits - you have ${remainingMonthly} monthly quests + ${purchased} purchased credits remaining`;
                               } else {
                                 tooltipText = 'Requires quest credits - click to purchase quest packages';
                               }
                             } else if (subItem.requiresAdminSeats) {
                               tooltipText = 'Requires admin seats - click to purchase admin seat packages';
                             } else if (subItem.requiresAI) {
                               tooltipText = 'Requires AI points - click to purchase AI points';
                             }
                           } else {
                            tooltipText = `Requires ${subItem.minPoints || 1} AI points and ${subItem.aiPermission || 'AI'} permission`;
                          }

                          return (
                            <div
                              key={subIndex}
                              className={`sidebar-link submenu-link ${isLocked ? 'locked' : 'disabled'}`}
                              title={tooltipText}
                              onClick={() => isLocked && handleSidebarClick(subItem, subItem.path)}
                              style={{ cursor: isLocked ? 'pointer' : 'not-allowed' }}
                            >
                              <i className={subItem.icon}></i>
                              <span>{subItem.label}</span>
                              {subItem.count > 0 && (
                                <span className="badge-count">{subItem.count}</span>
                              )}
                              <i className={`ri-${isLocked ? 'shopping-cart' : 'lock'}-line lock-icon`}></i>
                            </div>
                          );
                        }

                        return (
                          <NavLink
                            key={subIndex}
                            to={subItem.path}
                            className={({ isActive }) => `sidebar-link submenu-link ${isActive ? 'active' : ''}`}
                            onClick={() => window.innerWidth <= 768 && setIsOpen(false)}
                            style={{ fontWeight: subItem.bold ? 'bold' : 'normal' }}
                          >
                            <i className={subItem.icon}></i>
                            <span>{subItem.label}</span>
                            {subItem.count > 0 && (
                              <span className="badge-count">{subItem.count}</span>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Handle regular navigation items
              const regDisabled = isFeatureDisabled(item) || isAIFeatureDisabled(item);
              const regLocked = isFeatureLocked(item);
              
              if (regDisabled || regLocked) {
                let tooltipText = '';
                                 if (regLocked) {
                   if (item.requiresQuests) {
                     const monthlyLimit = effectiveBusinessData?.monthlyQuestLimit || 0;
                     const monthlyUsed = effectiveBusinessData?.monthlyQuestsUsed || 0;
                     const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
                     const purchased = effectiveBusinessData?.questCreditsPurchased || 0;
                     
                     if (remainingMonthly > 0) {
                       tooltipText = `Requires quest credits - you have ${remainingMonthly} monthly quests + ${purchased} purchased credits remaining`;
                     } else {
                       tooltipText = 'Requires quest credits - click to purchase quest packages';
                     }
                   } else if (item.requiresAdminSeats) {
                     tooltipText = 'Requires admin seats - click to purchase admin seat packages';
                   } else if (item.requiresAI) {
                     tooltipText = 'Requires AI points - click to purchase AI points';
                   }
                 } else {
                  tooltipText = 'Feature disabled';
                }

                return (
                  <div 
                    key={index} 
                    className={`sidebar-link ${regLocked ? 'locked' : 'disabled'}`}
                    title={tooltipText}
                    onClick={() => regLocked && handleSidebarClick(item, item.path)}
                    style={{ cursor: regLocked ? 'pointer' : 'not-allowed' }}
                  >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                    {item.count > 0 && (
                      <span className="badge-count">{item.count}</span>
                    )}
                    <i className={`ri-${regLocked ? 'shopping-cart' : 'lock'}-line lock-icon`}></i>
                  </div>
                );
              }
              
              return (
                <NavLink
                  key={index}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${item.priority ? 'priority' : ''}`}
                  style={{ fontWeight: item.bold ? 'bold' : 'normal' }}
                  onClick={() => window.innerWidth <= 768 && setIsOpen(false)}
                >
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                  {item.count > 0 && (
                    <span className="badge-count">{item.count}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="user-profile-section">
            {showUserMenu && (
              <div className="user-menu">
                <button onClick={() => { navigate('/user/update-password'); setShowUserMenu(false); }} className="logout-button">
                  <i className="ri-lock-password-line"></i>
                  <span>Update Password</span>
                </button>
                <button onClick={handleLogout} className="logout-button">
                  <i className="ri-logout-box-line"></i>
                  <span>Logout</span>
                </button>
              </div>
            )}
            <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="user-avatar">
                <i className="ri-user-line"></i>
              </div>
              <div className="user-info">
                <span className="user-name">{user.name || 'User'}</span>
                <span className="user-role">{userRole}</span>
              </div>
              <i className={`ri-arrow-down-s-line ${showUserMenu ? 'expanded' : ''}`}></i>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;