import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/models/rehearsal.dart';
import '../bands/active_band_controller.dart';
import 'rehearsal_repository.dart';

// ============================================================================
// REHEARSAL CONTROLLER
// Manages rehearsal data for the active band.
//
// BAND ISOLATION: Rehearsals are ALWAYS fetched in context of activeBandId.
// When active band changes, rehearsals are automatically refetched.
// ============================================================================

/// State for rehearsal data
class RehearsalState {
  final List<Rehearsal> allRehearsals;
  final List<Rehearsal> upcomingRehearsals;
  final Rehearsal? nextRehearsal;
  final bool isLoading;
  final String? error;

  const RehearsalState({
    this.allRehearsals = const [],
    this.upcomingRehearsals = const [],
    this.nextRehearsal,
    this.isLoading = false,
    this.error,
  });

  /// Returns true if there are any rehearsals
  bool get hasRehearsals => allRehearsals.isNotEmpty;

  /// Returns true if there's an upcoming rehearsal
  bool get hasUpcomingRehearsal => nextRehearsal != null;

  RehearsalState copyWith({
    List<Rehearsal>? allRehearsals,
    List<Rehearsal>? upcomingRehearsals,
    Rehearsal? nextRehearsal,
    bool? isLoading,
    String? error,
    bool clearError = false,
    bool clearNextRehearsal = false,
  }) {
    return RehearsalState(
      allRehearsals: allRehearsals ?? this.allRehearsals,
      upcomingRehearsals: upcomingRehearsals ?? this.upcomingRehearsals,
      nextRehearsal: clearNextRehearsal
          ? null
          : (nextRehearsal ?? this.nextRehearsal),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Notifier that manages rehearsal state
class RehearsalNotifier extends Notifier<RehearsalState> {
  @override
  RehearsalState build() {
    // Watch the active band — when it changes, reset and refetch
    final bandId = ref.watch(activeBandIdProvider);

    // If no band selected, return empty state
    if (bandId == null) {
      return const RehearsalState();
    }

    // Trigger async load (can't await in build, so use Future.microtask)
    Future.microtask(() => loadRehearsals());

    return const RehearsalState(isLoading: true);
  }

  RehearsalRepository get _repository => ref.read(rehearsalRepositoryProvider);
  String? get _bandId => ref.read(activeBandIdProvider);

  /// Load all rehearsal data for the active band
  Future<void> loadRehearsals() async {
    final bandId = _bandId;
    if (bandId == null) {
      state = const RehearsalState();
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true);

    try {
      // Fetch rehearsals in parallel
      final results = await Future.wait([
        _repository.fetchRehearsalsForBand(bandId),
        _repository.fetchUpcomingRehearsals(bandId),
        _repository.fetchNextRehearsal(bandId),
      ]);

      state = state.copyWith(
        allRehearsals: results[0] as List<Rehearsal>,
        upcomingRehearsals: results[1] as List<Rehearsal>,
        nextRehearsal: results[2] as Rehearsal?,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Refresh rehearsals (for pull-to-refresh or retry)
  Future<void> refresh() => loadRehearsals();

  /// Clear all rehearsal state (e.g., on logout)
  void reset() {
    state = const RehearsalState();
  }
}

// ============================================================================
// PROVIDERS
// ============================================================================

/// Provider for the rehearsal repository
final rehearsalRepositoryProvider = Provider<RehearsalRepository>((ref) {
  return RehearsalRepository();
});

/// Provider for rehearsal state — automatically refetches when active band changes
final rehearsalProvider = NotifierProvider<RehearsalNotifier, RehearsalState>(
  () {
    return RehearsalNotifier();
  },
);

/// Convenience: does the active band have any rehearsals?
final hasRehearsalsProvider = Provider<bool>((ref) {
  return ref.watch(rehearsalProvider).hasRehearsals;
});

/// Convenience: is there an upcoming rehearsal?
final hasUpcomingRehearsalProvider = Provider<bool>((ref) {
  return ref.watch(rehearsalProvider).hasUpcomingRehearsal;
});

/// Convenience: get the next upcoming rehearsal
final nextRehearsalProvider = Provider<Rehearsal?>((ref) {
  return ref.watch(rehearsalProvider).nextRehearsal;
});
