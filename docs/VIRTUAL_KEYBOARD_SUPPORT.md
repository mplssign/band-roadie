# Virtual Keyboard Support Implementation

## Overview
Implemented smart viewport adjustments for the login screen to ensure the "Send Login Link" button remains visible above the virtual keyboard on iOS/Android mobile devices.

## What Was Implemented

### 1. Virtual Keyboard Detection Hook (`hooks/useVirtualKeyboard.ts`)
- **`useVirtualKeyboard()`**: Detects when the mobile virtual keyboard is displayed by monitoring viewport height changes
- **`useKeyboardAdjustment()`**: Provides CSS transform styles to shift elements up when the keyboard appears
- Uses 150px threshold to distinguish between keyboard and browser UI changes
- Supports both `window.visualViewport` API and fallback `resize` events

### 2. Login Page Enhancement (`app/(auth)/login/page.tsx`)
- Added keyboard adjustment styles to the main form container
- Implemented focus/blur handlers for the email input
- Added smooth scroll to center the input when focused
- 300ms delay on scroll to allow keyboard animation to start

### 3. Testing (`__tests__/useVirtualKeyboard.test.ts`)
- Unit tests for keyboard detection logic
- Validates transform calculations
- Tests enabled/disabled states

## How It Works

### Detection Logic
```typescript
const heightDifference = initialHeight - currentHeight;
const isKeyboardOpen = heightDifference > 150; // 150px threshold
const keyboardHeight = isKeyboardOpen ? heightDifference : 0;
```

### Transform Calculation
```typescript
const transform = enabled && isKeyboardOpen 
  ? `translateY(-${Math.min(keyboardHeight - offset, keyboardHeight * 0.5)}px)`
  : 'none';
```

### Usage Example
```typescript
const keyboardAdjustment = useKeyboardAdjustment(isEmailFocused, 40);
<div style={keyboardAdjustment}>
  {/* Form content */}
</div>
```

## Key Features

1. **Smart Detection**: Only triggers for significant viewport changes (>150px)
2. **Safe Adjustment**: Limits upward movement to prevent over-shifting
3. **Smooth Animation**: CSS transitions for natural feel
4. **Focus-Based**: Only active when email input is focused
5. **Cross-Platform**: Works on iOS Safari, Chrome mobile, PWA installs

## Browser Support

- **iOS Safari**: Full support with Visual Viewport API
- **Android Chrome**: Full support with resize events
- **PWA Mode**: Works in both browser and installed app
- **Desktop**: No interference with normal usage

## Testing

- All 81 tests passing
- Deployed to production: https://bandroadie.com
- Ready for mobile device testing

## Benefits

- **UX Improvement**: Users can always see the login button
- **Accessibility**: Better experience for users with virtual keyboards
- **PWA Ready**: Works in both browser and installed app contexts
- **Performance**: Lightweight implementation with minimal overhead