# Authentication Setup

BandRoadie uses Supabase magic-link (passwordless) authentication.

## How It Works

1. User enters their email on the login screen
2. Supabase sends a magic link to that email
3. User clicks the link → opens the app → logged in automatically
4. Session persists across app restarts

## Important: Same-Device Requirement

> ⚠️ **You must click the magic link on the same device that requested it.**

If you request a login link on your iPhone but click it on your laptop, it won't work. The link contains a token that must be opened on the same device/browser session.

## Supabase Dashboard Configuration

Go to **Supabase Dashboard → Authentication → URL Configuration** and add:

### Redirect URLs

Add this URL to the **Redirect URLs** list:

```
bandroadie://login-callback/
```

This allows Supabase to redirect back to the Flutter app after authentication.

### Site URL (Optional)

If you're also building a web version, set the **Site URL** to your web app's URL. For mobile-only, you can leave this as the default.

## Platform-Specific Setup

### iOS

The custom URL scheme is registered in `ios/Runner/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>bandroadie</string>
    </array>
  </dict>
</array>
```

### macOS

Same registration in `macos/Runner/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>bandroadie</string>
    </array>
  </dict>
</array>
```

### Android

Deep link intent filter in `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data
    android:scheme="bandroadie"
    android:host="login-callback"
    android:pathPattern=".*"/>
</intent-filter>
```

## Troubleshooting

### "PKCE error" or redirects to bandroadie.com

- Ensure you added `bandroadie://login-callback/` (with trailing slash) to Supabase Redirect URLs
- Make sure the Flutter app is using the custom scheme, not a web URL

### Link opens browser instead of app

- On iOS/macOS: Verify `CFBundleURLSchemes` includes `bandroadie`
- On Android: Check the intent filter is inside the main `<activity>` block
- Rebuild the app after changes: `flutter clean && flutter run`

### Session not persisting

- `supabase_flutter` handles session persistence automatically
- Make sure `Supabase.initialize()` is called before `runApp()`

### Magic link doesn't arrive

- Check spam folder
- Verify email is correct
- Check Supabase Dashboard → Logs for auth errors
