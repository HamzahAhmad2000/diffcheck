import React, { createContext, useContext, useState, useEffect } from 'react';
import { businessAPI } from './apiClient';
import { toast } from 'react-hot-toast';

const BusinessContext = createContext(null);

export const BusinessProvider = ({ children }) => {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = localStorage.getItem('userRole');

  // Fetch business details when component mounts or user changes
  const fetchBusinessDetails = async () => {
    if (userRole === 'business_admin' && user.business_id) {
      setLoading(true);
      setError(null);
      
      try {
        const response = await businessAPI.getDetails(user.business_id);
        console.log('[BUSINESS_CONTEXT] API Response:', response.data);
        setBusiness(response.data);
      } catch (error) {
        console.error('[BusinessContext] Error fetching business details:', error);
        setError(error.response?.data?.error || 'Failed to load business details');
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    } else {
      // Not a business admin or no business_id
      setBusiness(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessDetails();
  }, [userRole, user.business_id]);

  // Function to refresh business data (useful after purchases or permission changes)
  const refreshBusiness = async () => {
    await fetchBusinessDetails();
  };

  // Function to update AI points locally (for optimistic updates)
  const updateAIPoints = (newPoints) => {
    if (business) {
      setBusiness(prev => ({
        ...prev,
        ai_points: newPoints
      }));
    }
  };

  // Helper functions for permissions and points checking
  const hasPermission = (permissionKey) => {
    // Super admin always has all permissions
    if (userRole === 'super_admin') {
      return true;
    }

    if (!business?.permissions) {
      // Special handling for AI Builder permission - default to true for backward compatibility
      if (permissionKey === 'CAN_USE_AI_BUILDER') {
        return true;
      }
      return false;
    }

    // Check exact permission key first
    if (business.permissions[permissionKey] === true) return true;
    if (business.permissions[permissionKey] === false) return false;

    // Special case for CAN_USE_AI_BUILDER - default to true when key missing (backward compatibility)
    if (permissionKey === 'CAN_USE_AI_BUILDER' && business.permissions[permissionKey] === undefined) {
      return true;
    }

    // fallback: try uppercase without can_ prefix
    const normalized = permissionKey.toUpperCase().replace(/^CAN[_]*/, '').replace(/^CAN/, '').replace(/^_/, '');
    if (business.permissions[normalized] === true) return true;
    if (business.permissions[normalized] === false) return false;

    // also try adding CAN_ prefix uppercase
    const prefixed = `CAN_${normalized}`;
    if (business.permissions[prefixed] === true) return true;
    if (business.permissions[prefixed] === false) return false;

    // Final fallback for CAN_USE_AI_BUILDER - default to true
    if (permissionKey === 'CAN_USE_AI_BUILDER') {
      return true;
    }

    return false;
  };

  const hasAIPoints = (pointsNeeded = 1) => {
    // Super admin always has unlimited points
    if (userRole === 'super_admin') {
      return true;
    }
    
    return (business?.ai_points || 0) >= pointsNeeded;
  };

  const canUseAIFeature = (permissionKey, pointsNeeded = 1) => {
    // Super admin bypass - always allow
    if (userRole === 'super_admin') {
      return true;
    }

    // Allow when permission key absent or truthy
    if (!permissionKey) return hasAIPoints(pointsNeeded);

    return hasPermission(permissionKey) && hasAIPoints(pointsNeeded);
  };

  // Calculate available quest credits (monthly allowance + purchased credits)
  const getAvailableQuestCredits = () => {
    if (userRole === 'super_admin') {
      return Infinity;
    }
    
    if (!business) return 0;
    
    // Get tier permissions
    const tierAllowsQuests = business.tier_info?.can_create_quests || false;
    
    // Check if tier allows quests OR if there's a legacy monthly quest limit
    const hasQuestCapability = tierAllowsQuests || (business.monthly_quest_limit > 0);
    
    if (hasQuestCapability) {
      // Tier allows quest creation or legacy limit exists, check monthly allowance
      const monthlyLimit = business.monthly_quest_limit || 0;
      const monthlyUsed = business.monthly_quests_used || 0;
      const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
      const purchasedCredits = business.quest_credits_purchased || 0;
      
      return remainingMonthly + purchasedCredits;
    } else {
      // Tier doesn't allow quests and no legacy limit, only purchased credits
      return business.quest_credits_purchased || 0;
    }
  };

  // Check if user can create quests
  const canCreateQuests = () => {
    if (userRole === 'super_admin') {
      return true;
    }
    
    if (!business) return false;
    
    // Get tier permissions
    const tierAllowsQuests = business.tier_info?.can_create_quests || false;
    
    // Check if tier allows quests OR if there's a legacy monthly quest limit
    const hasQuestCapability = tierAllowsQuests || (business.monthly_quest_limit > 0);
    
    if (!hasQuestCapability) {
      return false; // No quest capability at all
    }
    
    // Check if they have available credits
    const monthlyLimit = business.monthly_quest_limit || 0;
    const monthlyUsed = business.monthly_quests_used || 0;
    const remainingMonthly = Math.max(0, monthlyLimit - monthlyUsed);
    const purchasedCredits = business.quest_credits_purchased || 0;
    
    return (remainingMonthly + purchasedCredits) > 0;
  };

  // Get total admin seats available (tier limit + purchased seats)
  const getTotalAdminSeats = () => {
    if (!business) return 0;
    
    // Use tier_info first (from BusinessTier table), then fallback to legacy field
    const tierLimit = business.tier_info?.admin_seat_limit || business.admin_seat_limit || 1;
    const purchasedSeats = business.admin_seats_purchased || 0;
    
    // Handle unlimited seats (-1)
    if (tierLimit === -1) return Infinity;
    
    return tierLimit + purchasedSeats;
  };

  // Get current admin seat usage
  const getUsedAdminSeats = () => {
    // Use the current admin count from the API
    return business?.current_admin_count || 0;
  };

  // Check if more admin seats can be added
  const canAddAdminSeat = () => {
    if (userRole === 'super_admin') {
      return true;
    }
    
    const totalSeats = getTotalAdminSeats();
    const usedSeats = getUsedAdminSeats();
    
    return totalSeats === Infinity || usedSeats < totalSeats;
  };

  // Always return a proper object, never null
  const contextValue = {
    business,
    loading,
    error,
    refreshBusiness,
    updateAIPoints,
    hasPermission,
    hasAIPoints,
    canUseAIFeature,
    getAvailableQuestCredits,
    canCreateQuests,
    getTotalAdminSeats,
    getUsedAdminSeats,
    canAddAdminSeat,
    // Helper properties for easy access
    aiPoints: userRole === 'super_admin' ? Infinity : (business?.ai_points || 0),
    tier: business?.tier || 'normal',
    tierInfo: business?.tier_info || null,
    permissions: business?.permissions || {},
    isBusinessAdmin: userRole === 'business_admin',
    isSuperAdmin: userRole === 'super_admin',
    // Quest-related properties
    questCredits: getAvailableQuestCredits(),
    monthlyQuestLimit: business?.monthly_quest_limit || 0,
    monthlyQuestsUsed: business?.monthly_quests_used || 0,
    questCreditsPurchased: business?.quest_credits_purchased || 0,
    // Admin seat properties
    totalAdminSeats: getTotalAdminSeats(),
    usedAdminSeats: getUsedAdminSeats(),
    adminSeatsPurchased: business?.admin_seats_purchased || 0
  };

  return (
    <BusinessContext.Provider value={contextValue}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  
  // Return a safe default object if context is somehow null
  if (context === null) {
    return {
      business: null,
      loading: false,
      error: null,
      refreshBusiness: async () => {},
      updateAIPoints: () => {},
      hasPermission: () => false,
      hasAIPoints: () => false,
      canUseAIFeature: () => false,
      getAvailableQuestCredits: () => 0,
      canCreateQuests: () => false,
      getTotalAdminSeats: () => 0,
      getUsedAdminSeats: () => 0,
      canAddAdminSeat: () => false,
      aiPoints: 0,
      tier: 'normal',
      tierInfo: null,
      permissions: {},
      isBusinessAdmin: false,
      isSuperAdmin: false,
      questCredits: 0,
      monthlyQuestLimit: 0,
      monthlyQuestsUsed: 0,
      questCreditsPurchased: 0,
      totalAdminSeats: 0,
      usedAdminSeats: 0,
      adminSeatsPurchased: 0
    };
  }
  
  return context;
};

export default BusinessContext; 