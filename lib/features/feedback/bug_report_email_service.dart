import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/services/supabase_client.dart';

// ============================================================================
// BUG REPORT EMAIL SERVICE
// Sends bug reports via Supabase Edge Function (Resend).
// No email client needed - sends directly from server.
// ============================================================================

/// Result of attempting to send a bug report email.
sealed class BugReportResult {}

/// Email sent successfully.
class BugReportSuccess extends BugReportResult {}

/// Failed to send - provides the report text for clipboard fallback.
class BugReportEmailAppNotFound extends BugReportResult {
  final String message;
  final String reportText;
  BugReportEmailAppNotFound(this.message, this.reportText);
}

/// Failed to send - provides the report text for clipboard fallback.
class BugReportLaunchFailed extends BugReportResult {
  final String message;
  final String reportText;
  BugReportLaunchFailed(this.message, this.reportText);
}

/// Service for sending bug reports via edge function.
class BugReportEmailService {
  /// Email recipient for all bug reports (for reference/clipboard).
  static const String recipientEmail = 'tonycraig@gmail.com';

  /// Send a bug report via edge function.
  ///
  /// [type] - 'bug' or 'feature'
  /// [description] - User-entered description
  /// [screenName] - Current screen/route name (optional)
  /// [bandId] - Active band ID (optional)
  ///
  /// Returns [BugReportResult] indicating success or failure.
  static Future<BugReportResult> send({
    required String type,
    required String description,
    String? screenName,
    String? bandId,
  }) async {
    try {
      debugPrint('[BugReport] Sending via edge function...');

      // Get app info
      String appVersion = 'unknown';
      String buildNumber = 'unknown';
      try {
        final packageInfo = await PackageInfo.fromPlatform();
        appVersion = packageInfo.version;
        buildNumber = packageInfo.buildNumber;
      } catch (e) {
        debugPrint('[BugReport] Failed to get package info: $e');
      }

      // Get user info
      String? userId;
      try {
        userId = supabase.auth.currentUser?.id;
      } catch (e) {
        debugPrint('[BugReport] Failed to get user: $e');
      }

      // Get platform info
      final platform = _getPlatformName();
      final osVersion = _getOsVersion();

      // Call edge function
      final response = await supabase.functions.invoke(
        'send-bug-report',
        body: {
          'type': type,
          'description': description,
          'screenName': screenName ?? 'Report Bugs',
          'bandId': bandId,
          'userId': userId,
          'platform': platform,
          'osVersion': osVersion,
          'appVersion': appVersion,
          'buildNumber': buildNumber,
        },
      );

      if (response.status == 200) {
        debugPrint('[BugReport] Sent successfully');
        return BugReportSuccess();
      } else {
        debugPrint('[BugReport] Edge function error: ${response.data}');
        final fallbackText = await buildReportText(
          type: type,
          description: description,
          screenName: screenName,
          bandId: bandId,
        );
        return BugReportLaunchFailed(
          'Failed to send report. Please try again or copy the report below.',
          fallbackText,
        );
      }
    } catch (e, stack) {
      debugPrint('[BugReport] Exception: $e');
      debugPrint('[BugReport] Stack: $stack');

      // Build report text for clipboard fallback
      String fallbackText;
      try {
        fallbackText = await buildReportText(
          type: type,
          description: description,
          screenName: screenName,
          bandId: bandId,
        );
      } catch (_) {
        fallbackText = 'Type: $type\n\n$description';
      }

      return BugReportLaunchFailed(
        'Error sending report: ${e.toString()}',
        fallbackText,
      );
    }
  }

  /// Build the full report text (for email body or clipboard).
  /// This is public so it can be used for clipboard fallback.
  static Future<String> buildReportText({
    required String type,
    required String description,
    String? screenName,
    String? bandId,
  }) async {
    // Get app info
    String appVersion = 'unknown';
    String buildNumber = 'unknown';
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      appVersion = packageInfo.version;
      buildNumber = packageInfo.buildNumber;
    } catch (e) {
      debugPrint('[BugReportEmail] Failed to get package info: $e');
    }

    // Get user info
    String userId = 'not signed in';
    try {
      final user = supabase.auth.currentUser;
      userId = user?.id ?? 'not signed in';
    } catch (e) {
      debugPrint('[BugReportEmail] Failed to get user: $e');
    }

    // Get platform info
    final platform = _getPlatformName();
    final osVersion = _getOsVersion();

    // Get timestamp (local time)
    final timestamp = DateTime.now().toIso8601String();

    // Build the email body with user description first
    final buffer = StringBuffer();

    // User's description at the top
    buffer.writeln(description);
    buffer.writeln();
    buffer.writeln();

    // Diagnostic context appended at the bottom
    buffer.writeln('--- Diagnostic Info (auto-generated) ---');
    buffer.writeln('Type: ${type == 'bug' ? 'Bug Report' : 'Feature Request'}');
    buffer.writeln('Screen: ${screenName ?? 'Report Bugs'}');
    buffer.writeln('Band ID: ${bandId ?? 'none'}');
    buffer.writeln('User ID: $userId');
    buffer.writeln('Platform: $platform');
    buffer.writeln('OS Version: $osVersion');
    buffer.writeln('App Version: $appVersion ($buildNumber)');
    buffer.writeln('Timestamp: $timestamp');

    return buffer.toString();
  }

  /// Get human-readable platform name.
  static String _getPlatformName() {
    if (kIsWeb) return 'Web';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isWindows) return 'Windows';
    if (Platform.isLinux) return 'Linux';
    return 'Unknown';
  }

  /// Get OS version string.
  static String _getOsVersion() {
    if (kIsWeb) return 'N/A';
    try {
      return Platform.operatingSystemVersion;
    } catch (e) {
      return 'unknown';
    }
  }
}
