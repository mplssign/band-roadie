import 'package:flutter/material.dart';

// ============================================================================
// BANDROADIE DESIGN TOKENS
// Centralized spacing, colors, curves, and durations for Figma fidelity.
// ============================================================================

/// Spacing tokens (8px grid)
class Spacing {
  Spacing._();

  static const double space4 = 4.0;
  static const double space6 = 6.0;
  static const double space8 = 8.0;
  static const double space10 = 10.0;
  static const double space12 = 12.0;
  static const double space14 = 14.0;
  static const double space16 = 16.0;
  static const double space20 = 20.0;
  static const double space24 = 24.0;
  static const double space32 = 32.0;
  static const double space40 = 40.0;
  static const double space48 = 48.0;
  static const double space56 = 56.0;
  static const double space64 = 64.0;

  /// Horizontal page padding
  static const double pagePadding = 20.0;

  /// Card corner radius (large, intentional)
  static const double cardRadius = 20.0;

  /// Button corner radius
  static const double buttonRadius = 12.0;

  /// Small badge/chip radius
  static const double chipRadius = 8.0;
}

/// Color palette
class AppColors {
  AppColors._();

  // Primary accent
  static const Color accent = Color(0xFFF43F5E);
  static const Color accentMuted = Color(0x33F43F5E); // 20% opacity

  // Backgrounds (dark → darker)
  static const Color scaffoldBg = Color(0xFF121212);
  static const Color surfaceDark = Color(0xFF1A1A1A);
  static const Color cardBg = Color(0xFF1E1E1E);
  static const Color cardBgElevated = Color(0xFF252525);

  // Borders
  static const Color borderSubtle = Color(0xFF2A2A2A);
  static const Color borderMuted = Color(0xFF333333);
  static const Color borderAccent = Color(0xFF3B82F6); // Blue accent for CTAs

  // Text hierarchy
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDisabled = Color(0xFF475569);

  // Semantic
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);

  // Gradients
  static const LinearGradient rehearsalGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6)],
  );

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF121212), Color(0xFF0A0A0A)],
  );
}

/// Animation durations
class AppDurations {
  AppDurations._();

  static const Duration instant = Duration(milliseconds: 100);
  static const Duration fast = Duration(milliseconds: 180);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration medium = Duration(milliseconds: 350);
  static const Duration slow = Duration(milliseconds: 500);
  static const Duration entrance = Duration(milliseconds: 400);
}

/// Custom curves for "rubberband" and fluid feel
class AppCurves {
  AppCurves._();

  /// Standard ease out for most transitions
  static const Curve ease = Curves.easeOutCubic;

  /// Snappy entrance with slight overshoot
  static const Curve overshoot = Curves.elasticOut;

  /// Smooth decelerate for slide-ins
  static const Curve slideIn = Curves.easeOutQuart;

  /// Bounce-like for playful elements
  static const Curve bounce = Curves.bounceOut;

  /// Custom rubberband curve (controlled overshoot)
  static Curve get rubberband => const _RubberbandCurve();
}

/// Custom curve with controlled overshoot
class _RubberbandCurve extends Curve {
  const _RubberbandCurve();

  @override
  double transformInternal(double t) {
    // Slight overshoot around 0.8, then settle
    if (t == 0) return 0;
    if (t == 1) return 1;
    final oneMinusT = 1 - t;
    return -0.5 * oneMinusT * oneMinusT * oneMinusT +
        1.5 * oneMinusT * oneMinusT +
        t;
  }
}

/// Typography styles (matches Figma intent)
class AppTextStyles {
  AppTextStyles._();

  // Screen titles / greetings
  static const TextStyle displayLarge = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: AppColors.textPrimary,
    height: 1.2,
  );

  static const TextStyle displayMedium = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.3,
    color: AppColors.textPrimary,
    height: 1.25,
  );

  // Section headers (smaller, subtle)
  static const TextStyle sectionHeader = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.8,
    color: AppColors.textMuted,
    height: 1.4,
  );

  // Card titles
  static const TextStyle cardTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
    height: 1.3,
  );

  // Card subtitles
  static const TextStyle cardSubtitle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    color: AppColors.textSecondary,
    height: 1.4,
  );

  // Body text
  static const TextStyle body = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    color: AppColors.textSecondary,
    height: 1.5,
  );

  // Small labels
  static const TextStyle label = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.3,
    color: AppColors.textMuted,
    height: 1.4,
  );

  // Badge/tag text
  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.5,
    height: 1.2,
  );

  // Button text
  static const TextStyle button = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
    height: 1.2,
  );

  // Nav label
  static const TextStyle navLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
    color: AppColors.textSecondary,
    height: 1.2,
  );
}
