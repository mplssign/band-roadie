import '../../app/models/band.dart';
import '../../app/services/supabase_client.dart';

// ============================================================================
// BAND REPOSITORY
// Handles all band-related data fetching.
//
// ISOLATION RULES:
// - Bands are fetched via the band_members table (user must be a member)
// - Supabase RLS policies enforce that users can only see their own memberships
// - This repository NEVER fetches all bands — only bands the user belongs to
// ============================================================================

class BandRepository {
  /// Fetches all bands the current user belongs to.
  ///
  /// This queries band_members where user_id = current user,
  /// then joins to bands to get band details.
  ///
  /// Returns empty list if user has no bands.
  Future<List<Band>> fetchUserBands() async {
    final userId = supabase.auth.currentUser?.id;

    if (userId == null) {
      // Not logged in — return empty
      return [];
    }

    // Query band_members for this user, select the related band
    // Assumes Supabase RLS is set up to only allow users to see their own memberships
    final response = await supabase
        .from('band_members')
        .select('band_id, bands(*)')
        .eq('user_id', userId);

    final List<Band> bands = [];

    for (final row in response) {
      final bandData = row['bands'] as Map<String, dynamic>?;
      if (bandData != null) {
        bands.add(Band.fromJson(bandData));
      }
    }

    return bands;
  }

  /// Fetches a single band by ID.
  ///
  /// Returns null if band doesn't exist or user doesn't have access.
  Future<Band?> fetchBandById(String bandId) async {
    final userId = supabase.auth.currentUser?.id;

    if (userId == null) {
      return null;
    }

    // First verify user is a member of this band
    final memberCheck = await supabase
        .from('band_members')
        .select('id')
        .eq('user_id', userId)
        .eq('band_id', bandId)
        .maybeSingle();

    if (memberCheck == null) {
      // User is not a member of this band — deny access
      return null;
    }

    // User is a member, fetch the band
    final response = await supabase
        .from('bands')
        .select()
        .eq('id', bandId)
        .maybeSingle();

    if (response == null) {
      return null;
    }

    return Band.fromJson(response);
  }
}
