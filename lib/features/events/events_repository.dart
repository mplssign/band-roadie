import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/models/gig.dart';
import '../../app/models/rehearsal.dart';
import '../../app/services/supabase_client.dart';
import 'models/event_form_data.dart';

// ============================================================================
// EVENTS REPOSITORY
// Unified repository for creating/updating rehearsals and gigs.
// Implements lightweight caching with 5-minute TTL, keyed by bandId + month.
//
// BAND ISOLATION: Every operation REQUIRES a non-null bandId.
// ============================================================================

/// Exception thrown when attempting operations without a band context.
class NoBandSelectedError extends Error {
  final String message;
  NoBandSelectedError([
    this.message = 'No band selected. Cannot perform this operation.',
  ]);

  @override
  String toString() => 'NoBandSelectedError: $message';
}

/// Cache entry with timestamp
class _CacheEntry<T> {
  final T data;
  final DateTime timestamp;

  _CacheEntry(this.data) : timestamp = DateTime.now();

  bool get isExpired =>
      DateTime.now().difference(timestamp).inMinutes >= 5; // 5-minute TTL
}

class EventsRepository {
  // Cache: key = "$bandId:$yearMonth" for events lists
  final Map<String, _CacheEntry<List<Rehearsal>>> _rehearsalCache = {};
  final Map<String, _CacheEntry<List<Gig>>> _gigCache = {};

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /// Get cache key for a band and month
  String _cacheKey(String bandId, DateTime date) {
    final yearMonth = '${date.year}-${date.month.toString().padLeft(2, '0')}';
    return '$bandId:$yearMonth';
  }

  /// Invalidate all cache entries for a band (call after create/update)
  void invalidateCache(String bandId) {
    debugPrint('[EventsRepository] Invalidating cache for band: $bandId');
    _rehearsalCache.removeWhere((key, _) => key.startsWith(bandId));
    _gigCache.removeWhere((key, _) => key.startsWith(bandId));
  }

  /// Clear all cache (e.g., on logout)
  void clearAllCache() {
    _rehearsalCache.clear();
    _gigCache.clear();
  }

  // ============================================================================
  // REHEARSAL OPERATIONS
  // ============================================================================

  /// Create a new rehearsal
  Future<Rehearsal> createRehearsal({
    required String bandId,
    required EventFormData formData,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    // Recurrence not yet supported in DB schema
    if (formData.isRecurring) {
      throw Exception('Recurring events are not yet supported.');
    }

    debugPrint('[EventsRepository] Creating rehearsal for band: $bandId');

    final data = {
      'band_id': bandId,
      'date': formData.date.toIso8601String().split('T')[0],
      'start_time': formData.startTimeDisplay,
      'end_time': formData.endTimeDisplay,
      'location': formData.location,
      'notes': formData.notes,
      'setlist_id': formData.setlistId,
    };

    final response = await supabase
        .from('rehearsals')
        .insert(data)
        .select()
        .single();

    invalidateCache(bandId);
    return Rehearsal.fromJson(response);
  }

  /// Update an existing rehearsal
  Future<Rehearsal> updateRehearsal({
    required String rehearsalId,
    required String bandId,
    required EventFormData formData,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    debugPrint(
      '[EventsRepository] Updating rehearsal $rehearsalId for band: $bandId',
    );

    final data = {
      'date': formData.date.toIso8601String().split('T')[0],
      'start_time': formData.startTimeDisplay,
      'end_time': formData.endTimeDisplay,
      'location': formData.location,
      'notes': formData.notes,
      'setlist_id': formData.setlistId,
      'updated_at': DateTime.now().toIso8601String(),
    };

    final response = await supabase
        .from('rehearsals')
        .update(data)
        .eq('id', rehearsalId)
        .eq('band_id', bandId)
        .select()
        .single();

    invalidateCache(bandId);
    return Rehearsal.fromJson(response);
  }

  /// Fetch rehearsals for a month (with caching)
  Future<List<Rehearsal>> fetchRehearsalsForMonth({
    required String bandId,
    required DateTime month,
    bool forceRefresh = false,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    final key = _cacheKey(bandId, month);

    // Check cache
    if (!forceRefresh) {
      final cached = _rehearsalCache[key];
      if (cached != null && !cached.isExpired) {
        debugPrint('[EventsRepository] Cache hit for rehearsals: $key');
        return cached.data;
      }
    }

    debugPrint('[EventsRepository] Fetching rehearsals for month: $key');

    final startOfMonth = DateTime(month.year, month.month, 1);
    final endOfMonth = DateTime(month.year, month.month + 1, 0);

    final response = await supabase
        .from('rehearsals')
        .select()
        .eq('band_id', bandId)
        .gte('date', startOfMonth.toIso8601String().split('T')[0])
        .lte('date', endOfMonth.toIso8601String().split('T')[0])
        .order('date', ascending: true);

    final rehearsals = response
        .map<Rehearsal>((json) => Rehearsal.fromJson(json))
        .toList();

    // Update cache
    _rehearsalCache[key] = _CacheEntry(rehearsals);

    return rehearsals;
  }

  // ============================================================================
  // GIG OPERATIONS
  // ============================================================================

  /// Create a new gig
  Future<Gig> createGig({
    required String bandId,
    required EventFormData formData,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    // Recurrence not yet supported
    if (formData.isRecurring) {
      throw Exception('Recurring events are not yet supported.');
    }

    final name = formData.name ?? formData.displayName;
    if (name.isEmpty) {
      throw Exception('Gig name is required.');
    }

    debugPrint('[EventsRepository] Creating gig for band: $bandId');

    final data = {
      'band_id': bandId,
      'name': name,
      'date': formData.date.toIso8601String().split('T')[0],
      'start_time': formData.startTimeDisplay,
      'end_time': formData.endTimeDisplay,
      'location': formData.location,
      'notes': formData.notes,
      'is_potential': formData.isPotentialGig,
      'setlist_id': formData.setlistId,
      'setlist_name': formData.setlistName,
      'required_member_ids': formData.selectedMemberIds.toList(),
    };

    final response = await supabase.from('gigs').insert(data).select().single();

    invalidateCache(bandId);
    return Gig.fromJson(response);
  }

  /// Update an existing gig
  Future<Gig> updateGig({
    required String gigId,
    required String bandId,
    required EventFormData formData,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    final name = formData.name ?? formData.displayName;
    if (name.isEmpty) {
      throw Exception('Gig name is required.');
    }

    debugPrint('[EventsRepository] Updating gig $gigId for band: $bandId');

    final data = {
      'name': name,
      'date': formData.date.toIso8601String().split('T')[0],
      'start_time': formData.startTimeDisplay,
      'end_time': formData.endTimeDisplay,
      'location': formData.location,
      'notes': formData.notes,
      'is_potential': formData.isPotentialGig,
      'setlist_id': formData.setlistId,
      'setlist_name': formData.setlistName,
      'required_member_ids': formData.selectedMemberIds.toList(),
      'updated_at': DateTime.now().toIso8601String(),
    };

    final response = await supabase
        .from('gigs')
        .update(data)
        .eq('id', gigId)
        .eq('band_id', bandId)
        .select()
        .single();

    invalidateCache(bandId);
    return Gig.fromJson(response);
  }

  /// Fetch gigs for a month (with caching)
  Future<List<Gig>> fetchGigsForMonth({
    required String bandId,
    required DateTime month,
    bool forceRefresh = false,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    final key = _cacheKey(bandId, month);

    // Check cache
    if (!forceRefresh) {
      final cached = _gigCache[key];
      if (cached != null && !cached.isExpired) {
        debugPrint('[EventsRepository] Cache hit for gigs: $key');
        return cached.data;
      }
    }

    debugPrint('[EventsRepository] Fetching gigs for month: $key');

    final startOfMonth = DateTime(month.year, month.month, 1);
    final endOfMonth = DateTime(month.year, month.month + 1, 0);

    final response = await supabase
        .from('gigs')
        .select()
        .eq('band_id', bandId)
        .gte('date', startOfMonth.toIso8601String().split('T')[0])
        .lte('date', endOfMonth.toIso8601String().split('T')[0])
        .order('date', ascending: true);

    final gigs = response.map<Gig>((json) => Gig.fromJson(json)).toList();

    // Update cache
    _gigCache[key] = _CacheEntry(gigs);

    return gigs;
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /// Delete a rehearsal by ID
  Future<void> deleteRehearsal({
    required String rehearsalId,
    required String bandId,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    debugPrint(
      '[EventsRepository] Deleting rehearsal $rehearsalId for band: $bandId',
    );

    await supabase
        .from('rehearsals')
        .delete()
        .eq('id', rehearsalId)
        .eq('band_id', bandId);

    invalidateCache(bandId);
  }

  /// Delete a gig by ID
  Future<void> deleteGig({
    required String gigId,
    required String bandId,
  }) async {
    if (bandId.isEmpty) {
      throw NoBandSelectedError();
    }

    debugPrint('[EventsRepository] Deleting gig $gigId for band: $bandId');

    await supabase.from('gigs').delete().eq('id', gigId).eq('band_id', bandId);

    invalidateCache(bandId);
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

final eventsRepositoryProvider = Provider<EventsRepository>((ref) {
  return EventsRepository();
});
