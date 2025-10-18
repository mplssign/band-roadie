# Portrait Mode Enforcement

Band Roadie is designed to work best in portrait mode. The app enforces portrait orientation through multiple layers:

## Implementation

### 1. Web App Manifest (`public/manifest.json`)

```json
{
  "orientation": "portrait-primary"
}
```

This tells the browser/OS to prefer portrait mode when the PWA is installed. On most mobile devices, this prevents the app from rotating to landscape when installed as a standalone app.

### 2. Programmatic Screen Lock (`OrientationGuard`)

For installed PWAs, the app attempts to programmatically lock the screen orientation using the Screen Orientation API:

```typescript
// Only for standalone PWA mode
await screen.orientation.lock('portrait-primary');
```

**Browser Support:**
- ✅ Chrome/Edge on Android (PWA mode)
- ✅ Safari on iOS (limited - only in fullscreen)
- ❌ Desktop browsers (API not available)

### 3. Rotate Overlay (`OrientationGuard`)

On mobile devices (width ≤ 768px), when the device is in landscape mode, a fullscreen overlay prompts the user to rotate their device:

**Features:**
- Animated rotating icon
- Clear messaging: "Please Rotate Your Device"
- Only shows on mobile devices in landscape
- Automatically dismisses when rotated to portrait

## Component Details

### `OrientationGuard`

**Location:** `components/layout/OrientationGuard.tsx`

**Responsibilities:**
1. Detect if device is mobile (≤ 768px width)
2. Detect current orientation (portrait vs landscape)
3. Attempt programmatic lock for installed PWAs
4. Show overlay when mobile + landscape

**Usage:**

```tsx
import { OrientationGuard } from '@/components/layout/OrientationGuard';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <OrientationGuard />
        {children}
      </body>
    </html>
  );
}
```

## Testing

### Test on Mobile Device

1. **Install as PWA:**
   - Open Band Roadie in mobile browser
   - Add to Home Screen (iOS) or Install App (Android)
   - Launch from home screen icon

2. **Test Orientation Lock:**
   - Rotate device to landscape
   - PWA should stay in portrait (if API supported)
   - OR see rotate overlay prompting to rotate back

3. **Test in Browser:**
   - Rotate device to landscape while in browser
   - Should see rotate overlay
   - Rotate back to portrait - overlay disappears

### Test on Desktop

1. Resize browser window to mobile width (< 768px)
2. Make window wider than tall (landscape)
3. Should see rotate overlay
4. Resize to portrait aspect ratio - overlay disappears

## Browser Support Matrix

| Platform | Manifest Hint | Programmatic Lock | Rotate Overlay |
|----------|---------------|-------------------|----------------|
| iOS Safari PWA | ✅ | ⚠️ Fullscreen only | ✅ |
| iOS Safari Browser | ❌ | ❌ | ✅ |
| Android Chrome PWA | ✅ | ✅ | ✅ |
| Android Chrome Browser | ⚠️ Suggestion only | ❌ | ✅ |
| Desktop Chrome | N/A | ❌ | ✅ |
| Desktop Safari | N/A | ❌ | ✅ |

**Legend:**
- ✅ Fully supported
- ⚠️ Partially supported or limited
- ❌ Not supported

## Why Portrait Only?

Band Roadie's UI is optimized for portrait mode:

1. **Setlists** - Vertical scrolling through songs
2. **Dashboard** - Card-based layout works best in portrait
3. **Forms** - Input fields and buttons designed for portrait
4. **Mobile-first** - Most users are musicians using phones at rehearsals/gigs
5. **One-handed use** - Easier to operate in portrait while holding instrument

## Customization

To modify the orientation behavior:

### Change Breakpoint

Edit `OrientationGuard.tsx`:

```typescript
// Current: 768px
setIsMobile(window.innerWidth <= 768);

// Change to 640px (mobile-only):
setIsMobile(window.innerWidth <= 640);
```

### Disable Overlay (Keep Lock Only)

In `OrientationGuard.tsx`:

```typescript
// Always return null to hide overlay
if (!isLandscape || !isMobile) {
  return null;
}

// Change to:
return null; // Never show overlay
```

### Allow Landscape

1. Update `manifest.json`:
   ```json
   "orientation": "any"
   ```

2. Remove `OrientationGuard` from layout:
   ```tsx
   // app/layout.tsx
   // Remove: <OrientationGuard />
   ```

## Troubleshooting

### Overlay shows on desktop

**Cause:** Window is narrow and wider than tall

**Solution:** Expected behavior - overlay is based on aspect ratio, not just mobile detection

### PWA not locking orientation

**Possible causes:**
1. Browser doesn't support Screen Orientation API
2. Not running in standalone mode (check display-mode)
3. Browser permissions/security restrictions

**Solution:** Fallback to rotate overlay works automatically

### Overlay animation not smooth

**Cause:** CSS animations may conflict with device rotation

**Solution:** Overlay uses simple bounce/ping animations that work across devices

## Future Enhancements

- [ ] Add user preference to allow landscape mode
- [ ] Detect if keyboard is open and allow landscape for typing
- [ ] Add haptic feedback when orientation changes
- [ ] Store orientation preference in localStorage
- [ ] A/B test to see if users prefer strict portrait enforcement

## References

- [Screen Orientation API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Orientation_API)
- [Web App Manifest - orientation](https://developer.mozilla.org/en-US/docs/Web/Manifest/orientation)
- [PWA Best Practices](https://web.dev/pwa/)
