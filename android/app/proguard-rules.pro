# Proguard rules for BandRoadie release builds
# Keep Flutter and plugin classes
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep Supabase classes
-keep class io.supabase.** { *; }

# Keep Google Fonts
-keep class com.google.** { *; }

# Don't warn about missing classes from optional dependencies
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
