# Share-to-Earn XP Feature - Integration Guide

## Overview

The Share-to-Earn XP feature provides a comprehensive social promotion system that rewards users for sharing their achievements on X (Twitter). This guide explains how to integrate and use all components.

## 📁 File Structure

```
react/src/components/user/share/
├── ShareButton.js & .css           # Reusable share button
├── HomeShareBanner.js & .css       # Welcome banner for new users
├── SharePromptModal.js & .css      # Modal for reward/raffle shares
├── BadgeShareIntegration.js        # Example badge integration
├── XPHistoryPage.js & .css         # XP transaction history page
├── index.js                        # Component exports
└── INTEGRATION_GUIDE.md            # This file

react/src/components/admin/
├── ShareToEarnConfig.js & .css     # Admin configuration panel
```

## 🎯 Components Overview

### 1. ShareButton
**Purpose**: Reusable button component for all sharing actions

**Props**:
- `shareType` (required): 'join_share' | 'badge_share' | 'reward_redemption' | 'raffle_win' | 'raffle_entry'
- `entityId`: ID of the shared entity (badge, reward, raffle)
- `entityName`: Name of the shared entity for display
- `variant`: 'primary' | 'secondary' | 'success' | 'minimal'
- `size`: 'small' | 'medium' | 'large'
- `hasShared`: Boolean to show if already shared
- `xpReward`: Number of XP to display
- `onShareSuccess`: Callback function when share is successful

**Example Usage**:
```jsx
import { ShareButton } from '../components/user/share';

<ShareButton
  shareType="badge_share"
  entityId={badge.id}
  entityName={badge.name}
  variant="primary"
  size="medium"
  xpReward={50}
  onShareSuccess={(data) => console.log('Shared!', data)}
/>
```

### 2. HomeShareBanner
**Purpose**: Welcome banner shown to new users (within configured time window)

**Props**: None (handles eligibility checking internally)

**Example Usage**:
```jsx
import { HomeShareBanner } from '../components/user/share';

// In your UserHomepage component:
const UserHomepage = () => {
  return (
    <div className="homepage">
      <HomeShareBanner />
      {/* Rest of your homepage content */}
    </div>
  );
};
```

**Features**:
- Automatically checks user eligibility
- Shows countdown timer
- Dismissible (persists for session)
- Auto-hides after 72 hours or when shared

### 3. SharePromptModal
**Purpose**: Modal popup for reward redemption and raffle win celebrations

**Props**:
- `isOpen` (required): Boolean to control visibility
- `onClose` (required): Function to close modal
- `shareType` (required): 'reward_redemption' | 'raffle_win' | 'raffle_entry'
- `entityId`: ID of reward/raffle
- `entityName`: Name of reward/raffle
- `title`: Custom title (default: "Congratulations!")
- `message`: Custom message
- `skipButtonText`: Text for skip button
- `xpReward`: XP amount
- `icon`: RemixIcon class name
- `onShareSuccess`: Callback function

**Example Usage**:
```jsx
import { SharePromptModal } from '../components/user/share';

const RewardRedemption = () => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [redeemedReward, setRedeemedReward] = useState(null);

  const handleRedeemSuccess = (reward) => {
    setRedeemedReward(reward);
    setShowShareModal(true);
  };

  return (
    <>
      {/* Your redemption UI */}
      
      <SharePromptModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareType="reward_redemption"
        entityId={redeemedReward?.id}
        entityName={redeemedReward?.name}
        title="Congratulations!"
        message={`Your ${redeemedReward?.name} is on its way!`}
        xpReward={50}
        icon="ri-gift-line"
      />
    </>
  );
};
```

### 4. BadgeShareIntegration
**Purpose**: Helper component to add share functionality to badge displays

**Props**:
- `badge` (required): Object with id and name
- `onShareSuccess`: Callback function

**Example Usage**:
```jsx
import { BadgeShareIntegration } from '../components/user/share';

const BadgeCard = ({ badge }) => {
  return (
    <div className="badge-card">
      <img src={badge.image_url} alt={badge.name} />
      <h3>{badge.name}</h3>
      <p>{badge.description}</p>
      
      <BadgeShareIntegration
        badge={badge}
        onShareSuccess={(data) => {
          console.log('Badge shared!', data);
          // Update UI or refresh badge list
        }}
      />
    </div>
  );
};
```

### 5. XPHistoryPage
**Purpose**: Full page displaying user's XP transaction history

**Props**: None (standalone page component)

**Route Setup**:
```jsx
// In your App.js or routing configuration:
import { XPHistoryPage } from '../components/user/share';

<Route path="/user/xp-history" element={<XPHistoryPage />} />
```

**Features**:
- Filterable by share type
- Paginated results
- Displays all XP transactions
- Back navigation to profile

### 6. ShareToEarnConfig (Admin)
**Purpose**: Super Admin configuration panel

**Props**: None (standalone admin component)

**Route Setup**:
```jsx
// In your admin routes:
import ShareToEarnConfig from '../components/admin/ShareToEarnConfig';

<Route path="/admin/share-to-earn" element={<ShareToEarnConfig />} />
```

**Features**:
- Master on/off toggle
- XP reward configuration
- Time window settings
- Post template customization
- Analytics summary

## 🔧 Integration Steps

### Step 1: Add Route Configurations
Add the following routes to your app:

```jsx
// User routes
<Route path="/user/xp-history" element={<XPHistoryPage />} />

// Admin routes (with admin protection)
<Route path="/admin/share-to-earn" element={<ShareToEarnConfig />} />
```

### Step 2: Integrate HomeShareBanner
Add to your UserHomepage component:

```jsx
import { HomeShareBanner } from './components/user/share';

const UserHomepage = () => {
  return (
    <div className="user-homepage">
      <HomeShareBanner />
      {/* Rest of homepage */}
    </div>
  );
};
```

### Step 3: Add Share Buttons to Badges
In your badge display component:

```jsx
import { BadgeShareIntegration } from './components/user/share';

// Inside your badge rendering:
<BadgeShareIntegration
  badge={badge}
  onShareSuccess={handleShareSuccess}
/>
```

### Step 4: Add Share Prompts to Rewards
In your marketplace/reward redemption flow:

```jsx
import { SharePromptModal } from './components/user/share';

const [showShareModal, setShowShareModal] = useState(false);
const [purchasedItem, setPurchasedItem] = useState(null);

// After successful purchase:
const handlePurchaseComplete = (item) => {
  setPurchasedItem(item);
  setShowShareModal(true);
};

// In your JSX:
<SharePromptModal
  isOpen={showShareModal}
  onClose={() => setShowShareModal(false)}
  shareType="reward_redemption"
  entityId={purchasedItem?.id}
  entityName={purchasedItem?.name}
  title="Congratulations!"
  message={`Your ${purchasedItem?.name} is on its way!`}
  xpReward={50}
/>
```

### Step 5: Add Share Prompts to Raffles
Similar to rewards, in your raffle system:

```jsx
// When user wins a raffle:
<SharePromptModal
  isOpen={showWinModal}
  onClose={() => setShowWinModal(false)}
  shareType="raffle_win"
  entityId={raffle.id}
  entityName={raffle.prize_name}
  title="You're a Winner!"
  message={`Congratulations! You won ${raffle.prize_name}!`}
  icon="ri-trophy-line"
  xpReward={50}
/>

// When user enters a raffle:
<SharePromptModal
  isOpen={showEntryModal}
  onClose={() => setShowEntryModal(false)}
  shareType="raffle_entry"
  entityId={raffle.id}
  entityName={raffle.prize_name}
  title="You're In!"
  message={`Good luck in the ${raffle.prize_name} raffle!`}
  icon="ri-ticket-line"
  xpReward={10}
/>
```

## 🎨 Styling

All components use consistent styling with the rest of the user component library. They support:
- Dark theme (default)
- Responsive design (mobile-first)
- Smooth animations
- Consistent spacing and colors

### Customization
You can override styles by targeting component classes:

```css
/* Custom share button styling */
.share-button--custom {
  background: your-custom-gradient;
  /* ... */
}
```

## 🔌 API Integration

The components use `shareAPI` from `apiClient.js`:

```javascript
// Required API methods (already implemented in apiClient.js):
shareAPI.getShareEligibility()        // Check user's eligibility
shareAPI.generateShareUrl(data)       // Generate Twitter share URL
shareAPI.confirmShare(data)           // Confirm share and award XP
shareAPI.getShareHistory(page, limit) // Get XP history
shareAPI.getAdminConfig()             // Get admin config (admin only)
shareAPI.updateAdminConfig(config)    // Update config (admin only)
shareAPI.getAdminAnalytics()          // Get analytics (admin only)
```

## 📊 Events

Components dispatch custom events for XP updates:

```javascript
// Listen for XP updates:
window.addEventListener('xp-updated', (event) => {
  const { xp_awarded, new_balance } = event.detail;
  // Update your XP display
});

// Listen for profile updates:
document.addEventListener('profile-updated', (event) => {
  const { user } = event.detail;
  // Refresh user data
});
```

## ✅ Best Practices

1. **Always check eligibility** before showing share prompts
2. **Handle errors gracefully** with toast notifications
3. **Update UI immediately** after successful shares
4. **Use appropriate share types** for each context
5. **Test on mobile devices** for responsive behavior
6. **Monitor analytics** in admin panel regularly

## 🐛 Troubleshooting

### Share button doesn't work
- Check if share-to-earn feature is enabled in admin panel
- Verify API endpoints are returning correctly
- Check browser console for errors

### Banner not showing
- User might not be within time window (default 72 hours)
- User may have already shared
- Feature might be disabled

### XP not being awarded
- Check backend logs for errors
- Verify share was confirmed via API
- Check if user has already shared this entity

## 📝 Notes

- The feature automatically prevents duplicate shares per entity
- XP rewards are configurable by admins
- Post templates support placeholders like [Prize Name]
- All share actions are tracked in analytics

## 🚀 Future Enhancements

Potential additions:
- Share to other platforms (Facebook, LinkedIn)
- Referral tracking via share links
- Leaderboards for top sharers
- Monthly share challenges
- Share streaks and bonuses

---

**Created**: 2025
**Last Updated**: 2025-10-02
**Version**: 1.0.0

