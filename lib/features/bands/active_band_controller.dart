import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/models/band.dart';
import 'band_repository.dart';

// ============================================================================
// ACTIVE BAND CONTROLLER
// Manages which band is currently active in the app.
//
// ISOLATION RULES:
// - Only one band can be active at a time
// - Switching bands MUST reset all band-scoped state
// - All features that need band context should read from this controller
// ============================================================================

/// State for the active band controller
class ActiveBandState {
  /// All bands the user belongs to
  final List<Band> userBands;

  /// The currently selected band (null if none selected)
  final Band? activeBand;

  /// Loading state
  final bool isLoading;

  /// Error message if fetch failed
  final String? error;

  const ActiveBandState({
    this.userBands = const [],
    this.activeBand,
    this.isLoading = false,
    this.error,
  });

  /// Returns true if user has at least one band
  bool get hasBands => userBands.isNotEmpty;

  /// Returns the active band ID (or null)
  String? get activeBandId => activeBand?.id;

  /// Copy with new values
  ActiveBandState copyWith({
    List<Band>? userBands,
    Band? activeBand,
    bool clearActiveBand = false,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return ActiveBandState(
      userBands: userBands ?? this.userBands,
      activeBand: clearActiveBand ? null : (activeBand ?? this.activeBand),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Notifier that manages the active band state (Riverpod 2.0+ style)
class ActiveBandNotifier extends Notifier<ActiveBandState> {
  @override
  ActiveBandState build() {
    return const ActiveBandState();
  }

  BandRepository get _bandRepository => ref.read(bandRepositoryProvider);

  /// Fetch all bands for the current user and auto-select the first one
  Future<void> loadUserBands() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final bands = await _bandRepository.fetchUserBands();

      // Auto-select first band if user has bands but none selected
      Band? selected = state.activeBand;
      if (selected == null && bands.isNotEmpty) {
        selected = bands.first;
      }

      // If currently selected band is no longer in the list, clear it
      if (selected != null && !bands.any((b) => b.id == selected!.id)) {
        selected = bands.isNotEmpty ? bands.first : null;
      }

      state = state.copyWith(
        userBands: bands,
        activeBand: selected,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load bands: $e',
      );
    }
  }

  /// Switch to a different band
  ///
  /// IMPORTANT: When switching bands, all band-scoped data should be reset.
  /// Features listening to activeBandId will automatically refetch.
  void selectBand(Band band) {
    if (!state.userBands.any((b) => b.id == band.id)) {
      // Safety check: can't select a band user doesn't belong to
      return;
    }

    state = state.copyWith(activeBand: band);
  }

  /// Select band by ID
  void selectBandById(String bandId) {
    final band = state.userBands.where((b) => b.id == bandId).firstOrNull;
    if (band != null) {
      selectBand(band);
    }
  }

  /// Clear active band (e.g., on logout)
  void clearActiveBand() {
    state = state.copyWith(clearActiveBand: true);
  }

  /// Reset all state (e.g., on logout)
  void reset() {
    state = const ActiveBandState();
  }
}

// ============================================================================
// PROVIDERS
// ============================================================================

/// Provider for the band repository
final bandRepositoryProvider = Provider<BandRepository>((ref) {
  return BandRepository();
});

/// Provider for the active band state
final activeBandProvider =
    NotifierProvider<ActiveBandNotifier, ActiveBandState>(() {
      return ActiveBandNotifier();
    });

/// Convenience provider for just the active band ID
/// Use this when you only need the ID for queries
final activeBandIdProvider = Provider<String?>((ref) {
  return ref.watch(activeBandProvider).activeBandId;
});

/// Convenience provider for checking if user has any bands
final hasBandsProvider = Provider<bool>((ref) {
  return ref.watch(activeBandProvider).hasBands;
});
