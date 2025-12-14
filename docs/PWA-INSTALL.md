# PWA Install Experience

Band Roadie provides a native app-like installation experience across all platforms with platform-specific prompts and a full-screen feel when installed.

## Features

### 1. Full-Screen Experience

**Manifest Configuration** (`public/manifest.json`)
- `display: "standalone"` - Hides browser chrome when installed
- `start_url: "/?source=pwa"` - Tracks PWA installs
- `theme_color: "#dc2626"` - Rose theme for status bar
- `background_color: "#0a0a0a"` - Dark background for splash screen
- `orientation: "portrait-primary"` - Locks to portrait mode

**Viewport Meta Tags**
- `viewport-fit=cover` - Extends content into safe areas
- Apple Web App meta tags for iOS standalone mode
- Status bar styled as `black-translucent` on iOS

**CSS Utilities**
- `100dvh` - Dynamic viewport height (accounts for mobile browser chrome)
- Safe area insets - `env(safe-area-inset-*)` for iOS notch/home indicator
- `overscroll-behavior: none` - Prevents rubber-band scrolling

### 2. Smart Install Prompts

**Platform Detection**
- ✅ **Android/Chrome**: Native install prompt via `beforeinstallprompt` API
- ✅ **iOS Safari**: Custom instructions for "Add to Home Screen"
- ✅ **Desktop**: Hidden (mobile-only experience)
- ✅ **Embedded iframes**: Hidden (avoid confusion)

**Timing & UX**
- Shows after **3 seconds** delay
- Requires at least **1 user interaction** (click/touch/scroll)
- Never shows on desktop (width > 768px)
- Auto-hides when already installed
- Remembers dismissal for **7 days**

**Android/Chrome Flow**
1. App captures `beforeinstallprompt` event
2. Shows custom banner with "Install" button
3. Clicking "Install" triggers native install dialog
4. Listens for `appinstalled` event
5. Hides banner permanently after install

**iOS Safari Flow**
1. Detects iOS device not in standalone mode
2. Shows banner with Share icon and instructions
3. "Tap Share → Add to Home Screen"
4. User manually adds via Safari menu
5. Hides banner after dismissal (7 days)

## Implementation

### Components

**`hooks/usePWAInstall.ts`**
```typescript
const {
  isStandalone,    // true if already installed
  isIOS,           // true on iOS devices
  isAndroid,       // true on Android devices
  canPrompt,       // true if native prompt available
  shouldShowBanner, // true if should show install banner
  promptInstall,   // function to trigger native install
  dismiss,         // function to dismiss banner
} = usePWAInstall();
```

**`components/pwa/InstallPrompt.tsx`**
- Fixed bottom banner with safe-area padding
- Platform-specific UI (Android vs iOS)
- shadcn/ui Card, Button components
- Animated entrance
- Dismissible with localStorage persistence

### Integration

**Root Layout** (`app/layout.tsx`)
```tsx
export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Band Roadie',
  },
  viewport: {
    viewportFit: 'cover',
  },
};
```

**Protected Layout** (`app/(protected)/layout.tsx`)
```tsx
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

// ...in JSX
<InstallPrompt />
```

## Testing

### Test Android Install

1. **Open in Chrome** (mobile or desktop DevTools device mode)
   ```
   http://localhost:3000
   ```

2. **Wait for banner** (~3 seconds + 1 interaction)
3. **Click "Install"** - Should trigger native dialog
4. **Accept install** - App installs to home screen
5. **Launch from home screen** - Should open full-screen without address bar
6. **Verify banner gone** - Shouldn't show again

### Test iOS Install

1. **Open in Safari on iOS**
   ```
   http://localhost:3000
   ```

2. **Wait for banner** (~3 seconds + scroll/tap)
3. **See instructions** - "Tap Share → Add to Home Screen"
4. **Manually add** via Safari Share menu
5. **Launch from home screen** - Full-screen, no Safari UI
6. **Verify status bar** - Should use dark translucent style

### Test Dismissal Persistence

1. See install banner
2. Click "Not now"
3. Reload page - banner shouldn't appear
4. Check localStorage - `pwa-install-dismissed` key should exist
5. Clear localStorage - banner reappears after delay

### Test Already Installed

1. Install PWA
2. Launch from home screen
3. Navigate around app
4. Verify: No install banner ever shows
5. Check: `window.matchMedia('(display-mode: standalone)').matches === true`

### Test Desktop (Should Hide)

1. Open on desktop browser (width > 768px)
2. Wait 10+ seconds
3. Verify: Banner never appears
4. Resize to mobile width
5. Wait for delay - banner should appear

## Browser Support

| Platform | Install Prompt | Full-screen | Safe Areas | Status |
|----------|---------------|-------------|------------|--------|
| iOS Safari 16.4+ | Manual instructions | ✅ | ✅ | Full support |
| iOS Safari <16.4 | Manual instructions | ✅ | ✅ | No `dvh` |
| Android Chrome | Native prompt | ✅ | ✅ | Full support |
| Android Firefox | Manual instructions | ✅ | ✅ | No `beforeinstallprompt` |
| Desktop Chrome | Hidden | N/A | N/A | Not shown |
| Desktop Safari | Hidden | N/A | N/A | Not shown |

## CSS Utilities

### Dynamic Viewport Height

```css
/* Instead of min-h-screen */
.min-h-dvh {
  min-height: 100dvh;
}

.h-dvh {
  height: 100dvh;
}
```

**Why `dvh`?**
- `vh` includes browser chrome (address bar, tabs)
- `dvh` adjusts dynamically as chrome shows/hides
- Prevents content being cut off on mobile

### Safe Area Utilities

```css
/* Individual sides */
.pt-safe { padding-top: env(safe-area-inset-top); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pl-safe { padding-left: env(safe-area-inset-left); }
.pr-safe { padding-right: env(safe-area-inset-right); }

/* Both axes */
.px-safe {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.py-safe {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Position utilities */
.safe-top { top: env(safe-area-inset-top); }
.safe-bottom { bottom: env(safe-area-inset-bottom); }
```

**Usage:**
```tsx
// Fixed bottom element (respects iOS home indicator)
<div className="fixed bottom-0 pb-safe">
  <BottomNav />
</div>

// Full-screen container (respects notch + home indicator)
<div className="min-h-dvh py-safe">
  {children}
</div>
```

## Troubleshooting

### Banner not showing

**Possible causes:**
1. Already installed (check display-mode in DevTools)
2. Previously dismissed (check localStorage for `pwa-install-dismissed`)
3. Desktop browser (width > 768px)
4. Embedded in iframe
5. Haven't interacted yet (need 1 click/tap/scroll)
6. Delay hasn't passed (wait 3 seconds)

**Debug:**
```javascript
// In browser console
console.log({
  isStandalone: matchMedia('(display-mode: standalone)').matches,
  dismissed: localStorage.getItem('pwa-install-dismissed'),
  width: window.innerWidth,
  inIframe: window.self !== window.top
});
```

### Install button doesn't work (Android)

**Possible causes:**
1. `beforeinstallprompt` not fired yet
2. Page not served over HTTPS (required for PWA)
3. Manifest not valid
4. Already installed

**Fix:**
- Check DevTools Console for errors
- Verify manifest in Application tab
- Ensure running on HTTPS (localhost is OK)
- Clear site data and reload

### iOS not showing full-screen

**Possible causes:**
1. Opened in Safari tab (not installed)
2. Apple Web App meta tags missing
3. Manifest not linked

**Fix:**
- Must install via "Add to Home Screen"
- Check `<meta name="apple-mobile-web-app-capable" content="yes">`
- Verify manifest link in `<head>`

### Content hidden by iOS notch

**Possible causes:**
1. Not using `viewport-fit=cover`
2. Not using safe-area-inset padding

**Fix:**
```html
<meta name="viewport" content="viewport-fit=cover">
```

```css
.my-fixed-header {
  padding-top: env(safe-area-inset-top);
}
```

### Banner shows on desktop

**Expected behavior** if:
- Window width < 768px (mobile emulation)

**Fix:**
- Intended for mobile testing
- Real desktop (>768px) won't show banner

## Customization

### Change Install Delay

Edit `components/pwa/InstallPrompt.tsx`:

```typescript
const SHOW_DELAY = 3000; // Change to 5000 for 5 seconds
```

### Change Dismissal Duration

Edit `hooks/usePWAInstall.ts`:

```typescript
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
// Change to 30 days:
const DISMISSAL_DURATION = 30 * 24 * 60 * 60 * 1000;
```

### Change Mobile Breakpoint

Edit `components/pwa/InstallPrompt.tsx`:

```typescript
if (window.innerWidth > 768) {
  return; // Change to 640 or 1024
}
```

### Disable Install Prompt

Remove from layout:

```tsx
// app/(protected)/layout.tsx
- <InstallPrompt />
```

### Custom Banner Styling

Edit `components/pwa/InstallPrompt.tsx`:

```tsx
<Card className="mx-4 mb-4 border-rose-600/50"> {/* Your styles */}
```

## Analytics

Track PWA installs and usage:

```typescript
// Track PWA source
const params = new URLSearchParams(window.location.search);
if (params.get('source') === 'pwa') {
  // User opened from installed PWA
  analytics.track('pwa_open');
}

// Track install acceptance
window.addEventListener('appinstalled', () => {
  analytics.track('pwa_installed');
});
```

## References

- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [beforeinstallprompt API](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)
- [iOS PWA Guide](https://web.dev/learn/pwa/installation/)
- [Safe Area Insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Dynamic Viewport Units](https://web.dev/viewport-units/)
