import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/services/supabase_client.dart';

// ============================================================================
// GIG RESPONSE REPOSITORY
// Handles all gig response (RSVP) data operations.
//
// BAND ISOLATION: All queries require bandId and enforce band-scoped access.
// ============================================================================

/// Summary of responses for a potential gig
class GigResponseSummary {
  final int yesCount;
  final int noCount;
  final int notRespondedCount;
  final int totalMembers;

  const GigResponseSummary({
    required this.yesCount,
    required this.noCount,
    required this.notRespondedCount,
    required this.totalMembers,
  });

  /// Create empty summary
  const GigResponseSummary.empty()
    : yesCount = 0,
      noCount = 0,
      notRespondedCount = 0,
      totalMembers = 0;

  @override
  String toString() =>
      'GigResponseSummary(yes: $yesCount, no: $noCount, notResponded: $notRespondedCount)';
}

/// A potential gig that needs the user's response
class PendingPotentialGig {
  final String gigId;
  final String bandId;
  final String name;
  final DateTime date;
  final String startTime;
  final String endTime;
  final String location;

  const PendingPotentialGig({
    required this.gigId,
    required this.bandId,
    required this.name,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.location,
  });

  factory PendingPotentialGig.fromJson(Map<String, dynamic> json) {
    return PendingPotentialGig(
      gigId: json['id'] as String,
      bandId: json['band_id'] as String,
      name: json['name'] as String,
      date: DateTime.parse(json['date'] as String),
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      location: json['location'] as String? ?? '',
    );
  }
}

class GigResponseRepository {
  /// Fetch all potential gigs for a band where the current user has NOT responded yet.
  /// Ordered by date + start_time (earliest first).
  Future<List<PendingPotentialGig>> fetchPendingPotentialGigs({
    required String bandId,
    required String userId,
  }) async {
    debugPrint('[GigResponseRepository] fetchPendingPotentialGigs: bandId=$bandId, userId=$userId');
    
    // Get today's date for filtering (only future/today gigs)
    final today = DateTime.now().toIso8601String().split('T')[0];
    debugPrint('[GigResponseRepository] Filtering gigs >= $today');

    // Fetch all potential gigs for the band
    final gigsResponse = await supabase
        .from('gigs')
        .select('id, band_id, name, date, start_time, end_time, location')
        .eq('band_id', bandId)
        .eq('is_potential', true)
        .gte('date', today)
        .order('date', ascending: true)
        .order('start_time', ascending: true);

    debugPrint('[GigResponseRepository] Found ${gigsResponse.length} potential gigs');
    for (final gig in gigsResponse) {
      debugPrint('[GigResponseRepository]   - ${gig['name']} on ${gig['date']}');
    }

    if (gigsResponse.isEmpty) {
      debugPrint('[GigResponseRepository] No potential gigs found, returning empty');
      return [];
    }

    // Get all gig IDs
    final gigIds = gigsResponse.map((g) => g['id'] as String).toList();

    // Fetch user's responses for these gigs
    final responsesResponse = await supabase
        .from('gig_responses')
        .select('gig_id, response')
        .eq('user_id', userId)
        .inFilter('gig_id', gigIds);

    debugPrint('[GigResponseRepository] User has ${responsesResponse.length} responses');
    for (final r in responsesResponse) {
      debugPrint('[GigResponseRepository]   - gig ${r['gig_id']}: ${r['response']}');
    }

    // Build set of gigs user has responded to
    final respondedGigIds = <String>{};
    for (final r in responsesResponse) {
      final response = r['response'] as String?;
      // Only count as responded if they have a yes/no response
      if (response == 'yes' || response == 'no') {
        respondedGigIds.add(r['gig_id'] as String);
      }
    }

    // Filter out gigs user has already responded to
    final pendingGigs = <PendingPotentialGig>[];
    for (final gig in gigsResponse) {
      final gigId = gig['id'] as String;
      if (!respondedGigIds.contains(gigId)) {
        pendingGigs.add(PendingPotentialGig.fromJson(gig));
      }
    }

    debugPrint('[GigResponseRepository] Returning ${pendingGigs.length} pending gigs');

    return pendingGigs;
  }

  /// Get the current user's response for a specific gig.
  /// Returns 'yes', 'no', or null if not responded.
  Future<String?> fetchUserResponse({
    required String gigId,
    required String userId,
  }) async {
    final response = await supabase
        .from('gig_responses')
        .select('response')
        .eq('gig_id', gigId)
        .eq('user_id', userId)
        .maybeSingle();

    if (response == null) return null;
    return response['response'] as String?;
  }

  /// Submit or update the user's response for a gig.
  /// Uses upsert on (gig_id, user_id) constraint.
  Future<void> upsertResponse({
    required String gigId,
    required String bandId,
    required String userId,
    required String response, // 'yes' or 'no'
  }) async {
    debugPrint(
      '[GigResponseRepository] upsertResponse: gigId=$gigId, bandId=$bandId, userId=$userId, response=$response',
    );

    try {
      // Check if a response already exists
      final existing = await supabase
          .from('gig_responses')
          .select('id')
          .eq('gig_id', gigId)
          .eq('user_id', userId)
          .maybeSingle();

      final now = DateTime.now().toUtc().toIso8601String();

      if (existing != null) {
        // Update existing response
        debugPrint('[GigResponseRepository] Updating existing response');
        await supabase
            .from('gig_responses')
            .update({
              'response': response,
              'updated_at': now,
            })
            .eq('gig_id', gigId)
            .eq('user_id', userId);
        debugPrint('[GigResponseRepository] Update successful');
      } else {
        // Insert new response
        // Note: gig_responses table doesn't have band_id column - 
        // band authorization is done via RLS joining to gigs table
        debugPrint('[GigResponseRepository] Inserting new response');
        await supabase.from('gig_responses').insert({
          'gig_id': gigId,
          'user_id': userId,
          'response': response,
        });
        debugPrint('[GigResponseRepository] Insert successful');
      }
    } catch (e, stackTrace) {
      debugPrint('[GigResponseRepository] Error in upsertResponse: $e');
      debugPrint('[GigResponseRepository] Stack trace: $stackTrace');
      rethrow;
    }
  }

  /// Fetch response summary for a specific gig.
  /// Returns counts of yes, no, and not-responded members.
  Future<GigResponseSummary> fetchGigResponseSummary({
    required String gigId,
    required String bandId,
  }) async {
    // Get all active band members
    final membersResponse = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('status', 'active');

    final totalMembers = membersResponse.length;

    if (totalMembers == 0) {
      return const GigResponseSummary.empty();
    }

    // Get all responses for this gig
    final responsesResponse = await supabase
        .from('gig_responses')
        .select('user_id, response')
        .eq('gig_id', gigId);

    int yesCount = 0;
    int noCount = 0;

    for (final r in responsesResponse) {
      final response = r['response'] as String?;
      if (response == 'yes') {
        yesCount++;
      } else if (response == 'no') {
        noCount++;
      }
    }

    final notRespondedCount = totalMembers - yesCount - noCount;

    return GigResponseSummary(
      yesCount: yesCount,
      noCount: noCount,
      notRespondedCount: notRespondedCount < 0 ? 0 : notRespondedCount,
      totalMembers: totalMembers,
    );
  }

  /// Fetch response summaries for multiple gigs at once (for dashboard optimization).
  Future<Map<String, GigResponseSummary>> fetchMultipleGigResponseSummaries({
    required List<String> gigIds,
    required String bandId,
  }) async {
    if (gigIds.isEmpty) {
      return {};
    }

    // Get all active band members
    final membersResponse = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('status', 'active');

    final totalMembers = membersResponse.length;

    if (totalMembers == 0) {
      return {for (var id in gigIds) id: const GigResponseSummary.empty()};
    }

    // Get all responses for these gigs
    final responsesResponse = await supabase
        .from('gig_responses')
        .select('gig_id, user_id, response')
        .inFilter('gig_id', gigIds);

    // Group responses by gig_id
    final responsesByGig = <String, List<Map<String, dynamic>>>{};
    for (final r in responsesResponse) {
      final gigId = r['gig_id'] as String;
      responsesByGig.putIfAbsent(gigId, () => []).add(r);
    }

    // Calculate summary for each gig
    final summaries = <String, GigResponseSummary>{};
    for (final gigId in gigIds) {
      final responses = responsesByGig[gigId] ?? [];
      int yesCount = 0;
      int noCount = 0;

      for (final r in responses) {
        final response = r['response'] as String?;
        if (response == 'yes') {
          yesCount++;
        } else if (response == 'no') {
          noCount++;
        }
      }

      final notRespondedCount = totalMembers - yesCount - noCount;

      summaries[gigId] = GigResponseSummary(
        yesCount: yesCount,
        noCount: noCount,
        notRespondedCount: notRespondedCount < 0 ? 0 : notRespondedCount,
        totalMembers: totalMembers,
      );
    }

    return summaries;
  }
}

/// Provider for the repository
final gigResponseRepositoryProvider = Provider(
  (ref) => GigResponseRepository(),
);
