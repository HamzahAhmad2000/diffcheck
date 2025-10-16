import { SeasonPassTierManager } from '../services/apiClient';

/**
 * Season Pass XP Calculation Utilities
 */
export const SeasonPassXPUtils = {
  /**
   * Calculate XP with season pass multiplier applied
   * @param {number} baseXP - The base XP amount
   * @returns {number} - XP amount with multiplier applied
   */
  calculateXPWithMultiplier(baseXP) {
    const multiplier = SeasonPassTierManager.getMultiplier();
    const finalXP = Math.floor(baseXP * multiplier);

    console.log(`[SeasonPassXPUtils] Base XP: ${baseXP}, Multiplier: ${multiplier}, Final XP: ${finalXP}`);

    return finalXP;
  },

  /**
   * Get current user's tier information
   * @returns {object} - { tier: string|null, multiplier: number, hasPass: boolean }
   */
  getCurrentTierInfo() {
    return {
      tier: SeasonPassTierManager.getTier(),
      multiplier: SeasonPassTierManager.getMultiplier(),
      hasPass: SeasonPassTierManager.hasSeasonPass()
    };
  },

  /**
   * Get display information for current tier
   * @returns {object} - { tierName: string, multiplierText: string, hasPass: boolean }
   */
  getTierDisplayInfo() {
    const tier = SeasonPassTierManager.getTier();
    const multiplier = SeasonPassTierManager.getMultiplier();

    if (!tier) {
      return {
        tierName: 'No Season Pass',
        multiplierText: '1x XP',
        hasPass: false
      };
    }

    return {
      tierName: tier === 'LUNAR' ? 'Lunar Pass' : 'Totality Pass',
      multiplierText: `${multiplier}x XP`,
      hasPass: true
    };
  }
};

export default SeasonPassXPUtils;
