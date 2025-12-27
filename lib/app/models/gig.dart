// ============================================================================
// GIG MODEL
// Represents a gig (potential or confirmed) for a band.
//
// IMPORTANT: Every gig MUST have a bandId.
// Gigs are always fetched in the context of a specific band.
//
// Schema: public.gigs
// ============================================================================

import '../utils/time_formatter.dart';

class Gig {
  final String id;
  final String bandId;
  final String name;
  final DateTime date;
  final String startTime;
  final String endTime;
  final String location;
  final String? setlistId;
  final String? setlistName;
  final String? notes;

  /// If true, this gig requires band member approval before it's confirmed.
  /// Potential gigs show RSVP UI. Confirmed gigs show as scheduled.
  final bool isPotential;

  /// List of user IDs for band members required for this potential gig.
  /// Empty set means all members are required (default behavior).
  final Set<String> requiredMemberIds;

  final DateTime createdAt;
  final DateTime updatedAt;

  const Gig({
    required this.id,
    required this.bandId,
    required this.name,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.location,
    this.setlistId,
    this.setlistName,
    this.notes,
    required this.isPotential,
    this.requiredMemberIds = const {},
    required this.createdAt,
    required this.updatedAt,
  });

  /// Create a Gig from Supabase row data
  factory Gig.fromJson(Map<String, dynamic> json) {
    return Gig(
      id: json['id'] as String,
      bandId: json['band_id'] as String,
      name: json['name'] as String,
      date: DateTime.parse(json['date'] as String),
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      location: json['location'] as String,
      setlistId: json['setlist_id'] as String?,
      setlistName: json['setlist_name'] as String?,
      notes: json['notes'] as String?,
      isPotential: json['is_potential'] as bool? ?? false,
      requiredMemberIds: _parseRequiredMemberIds(json['required_member_ids']),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  /// Convert to JSON for Supabase insert/update
  Map<String, dynamic> toJson() {
    return {
      'band_id': bandId,
      'name': name,
      'date': date.toIso8601String().split('T')[0], // date only
      'start_time': startTime,
      'end_time': endTime,
      'location': location,
      'setlist_id': setlistId,
      'setlist_name': setlistName,
      'notes': notes,
      'is_potential': isPotential,
      'required_member_ids': requiredMemberIds.toList(),
    };
  }

  /// Parse required_member_ids from database (can be null, List, or array)
  static Set<String> _parseRequiredMemberIds(dynamic value) {
    if (value == null) return {};
    if (value is List) {
      return value.map((e) => e.toString()).toSet();
    }
    return {};
  }

  /// Returns true if this is a confirmed (not potential) gig
  bool get isConfirmed => !isPotential;

  /// Formatted time range (e.g., "7:30 PM - 10:30 PM")
  /// Uses TimeFormatter to ensure consistent 12-hour format display.
  String get timeRange => TimeFormatter.formatRange(startTime, endTime);

  @override
  String toString() => 'Gig(id: $id, name: $name, isPotential: $isPotential)';
}
