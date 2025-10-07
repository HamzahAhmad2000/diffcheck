# Share-to-Earn XP Feature

## 🎯 Quick Start

This feature rewards users for sharing their Eclipseer achievements on X (Twitter).

## 📦 Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `ShareButton` | Reusable share button | Any page needing share functionality |
| `HomeShareBanner` | Welcome banner for new users | UserHomepage |
| `SharePromptModal` | Celebration modal with share | After rewards/raffles |
| `BadgeShareIntegration` | Badge share helper | Badge pages |
| `XPHistoryPage` | XP transaction log | `/user/xp-history` |
| `ShareToEarnConfig` | Admin config panel | `/admin/share-to-earn` |

## 🚀 Quick Integration

### Add to Homepage
```jsx
import { HomeShareBanner } from './components/user/share';

<HomeShareBanner />
```

### Add to Badges
```jsx
import { BadgeShareIntegration } from './components/user/share';

<BadgeShareIntegration badge={badge} />
```

### Add to Rewards
```jsx
import { SharePromptModal } from './components/user/share';

<SharePromptModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  shareType="reward_redemption"
  entityId={reward.id}
  entityName={reward.name}
  title="Congratulations!"
  message={`Your ${reward.name} is on its way!`}
  xpReward={50}
/>
```

## 📍 Navigation Updates

Already added to:
- ✅ Sidebar (User: XP History, Admin: Share Config)
- ✅ UserProfileOverview (XP History link)

## 🎨 Visual Consistency

All components use:
- Reusable button components from `/components/user/components/buttons`
- Form components from `/components/admin/ui`
- Consistent dark theme styling
- Responsive design (mobile-first)
- Smooth animations

## 🔑 Key Features

### For Users
- **500 XP** for joining and sharing (one-time, 72-hour window)
- **50 XP** per badge shared
- **50 XP** per reward redemption shared
- **50 XP** per raffle win shared
- **10 XP** per raffle entry shared
- Full XP transaction history

### For Admins
- Master on/off toggle
- Configurable XP rewards
- Customizable post templates
- Time window configuration
- Analytics dashboard

## 📊 Default Settings

- Join share window: **72 hours**
- Join share XP: **500**
- Badge share XP: **50**
- Reward share XP: **50**
- Raffle win XP: **50**
- Raffle entry XP: **10**

## 🔗 Important Links

- [Complete Integration Guide](./INTEGRATION_GUIDE.md)
- [Backend Implementation](../../../../../backend/SHARE_TO_EARN_IMPLEMENTATION.md)

## ⚡ Quick Tips

1. Test on mobile - share prompts are optimized for mobile UX
2. Monitor admin analytics to see engagement
3. Customize post templates to match your brand voice
4. Use appropriate share types for each context
5. Handle share success callbacks to update UI

## 🆘 Need Help?

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for:
- Detailed component documentation
- Step-by-step integration
- API reference
- Troubleshooting guide
- Best practices

---

**Status**: ✅ Ready for Production
**Last Updated**: 2025-10-02

