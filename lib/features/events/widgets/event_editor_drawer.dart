import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/services/supabase_client.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../components/ui/brand_action_button.dart';
import '../../../components/ui/field_hint.dart';
import '../../../shared/utils/snackbar_helper.dart';
import '../../../shared/utils/title_case_formatter.dart';
import '../../calendar/calendar_controller.dart';
import '../../gigs/gig_controller.dart';
import '../../gigs/gig_response_repository.dart';
import '../../members/members_controller.dart';
import '../../members/member_vm.dart';
import '../../rehearsals/rehearsal_controller.dart';
import '../../setlists/models/setlist.dart';
import '../../setlists/setlists_screen.dart' show setlistsProvider;
import '../models/event_form_data.dart';
import '../events_repository.dart';
import 'button_group_grid.dart';

// ============================================================================
// EVENT EDITOR DRAWER
// A reusable drawer widget for creating/editing rehearsals and gigs.
// This is the single source of truth for event editing UI.
//
// USAGE:
//   showModalBottomSheet(
//     context: context,
//     builder: (_) => EventEditorDrawer(
//       mode: EventEditorMode.create,
//       initialEventType: EventType.rehearsal,
//       bandId: activeBandId,
//       onSaved: () => refresh(),
//     ),
//   );
// ============================================================================

/// Mode for the event editor
enum EventEditorMode { create, edit }

class EventEditorDrawer extends ConsumerStatefulWidget {
  /// Create mode or edit mode
  final EventEditorMode mode;

  /// Initial event type (rehearsal or gig)
  final EventType initialEventType;

  /// Initial date (prefilled from calendar day tap, etc.)
  final DateTime? initialDate;

  /// Existing event data for edit mode (nullable)
  final EventFormData? existingEvent;

  /// Existing event ID for edit mode (required for updates)
  final String? existingEventId;

  /// The band ID (required)
  final String bandId;

  /// Callback when event is saved successfully
  final VoidCallback? onSaved;

  /// Callback when editor is cancelled
  final VoidCallback? onCancelled;

  const EventEditorDrawer({
    super.key,
    this.mode = EventEditorMode.create,
    required this.initialEventType,
    this.initialDate,
    this.existingEvent,
    this.existingEventId,
    required this.bandId,
    this.onSaved,
    this.onCancelled,
  });

  @override
  ConsumerState<EventEditorDrawer> createState() => _EventEditorDrawerState();
}

class _EventEditorDrawerState extends ConsumerState<EventEditorDrawer>
    with SingleTickerProviderStateMixin {
  // Form state
  late EventType _eventType;
  late DateTime _selectedDate;
  int _selectedHour = 7;
  int _selectedMinutes = 0;
  bool _isPM = true;
  EventDuration _selectedDuration = EventDuration.hour2;
  final _locationController = TextEditingController();
  final _nameController = TextEditingController();
  final _notesController = TextEditingController();

  // Field hint controllers
  final _venueHintController = FieldHintController();
  final _cityHintController = FieldHintController();
  final _locationHintController = FieldHintController();
  final _notesHintController = FieldHintController();

  // Recurring state
  bool _isRecurring = false;
  Set<Weekday> _selectedDays = {};
  RecurrenceFrequency _frequency = RecurrenceFrequency.weekly;
  DateTime? _untilDate;

  // Potential gig state (gigs only)
  // Selected members are persisted to gigs.required_member_ids column.
  // Empty set means all members are required (default).
  bool _isPotentialGig = false;
  Set<String> _selectedMemberIds = {};

  // Current user's RSVP response for this potential gig (edit mode only)
  String? _currentUserResponse; // 'yes', 'no', or null
  String? _initialUserResponse; // Track initial value for change detection
  bool _isLoadingUserResponse = false;
  bool _isSubmittingUserResponse = false;

  // Setlist state
  String? _selectedSetlistId;
  String? _selectedSetlistName;

  // Location autocomplete suggestions (loaded once from past rehearsals)
  List<String> _locationSuggestions = [];

  // Gig autocomplete suggestions (fetched as user types)
  List<String> _gigNameSuggestions = [];
  List<String> _gigCitySuggestions = [];
  Timer? _gigNameDebounceTimer;
  Timer? _gigCityDebounceTimer;

  // Animation for recurring section
  late AnimationController _recurringAnimController;
  late Animation<double> _recurringFadeAnimation;
  late Animation<Offset> _recurringSlideAnimation;

  // Loading / error state
  bool _isSaving = false;
  bool _isDeleting = false;
  String? _errorMessage;
  final Map<String, String> _fieldErrors = {};

  // Initial state tracking for edit mode (to detect changes)
  EventFormData? _initialFormData;

  @override
  void initState() {
    super.initState();

    _eventType = widget.initialEventType;
    _selectedDate = widget.initialDate ?? DateTime.now();

    // Set default day based on selected date
    _selectedDays = {Weekday.values[_selectedDate.weekday % 7]};

    // Populate fields for edit mode
    if (widget.existingEvent != null) {
      final data = widget.existingEvent!;
      _eventType = data.type;
      _selectedDate = data.date;
      _selectedHour = data.hour;
      _selectedMinutes = data.minutes;
      _isPM = data.isPM;
      _selectedDuration = data.duration;
      _locationController.text = data.location;
      if (data.name != null) _nameController.text = data.name!;
      if (data.notes != null) _notesController.text = data.notes!;
      _isRecurring = data.isRecurring;
      if (data.recurrence != null) {
        _selectedDays = data.recurrence!.daysOfWeek;
        _frequency = data.recurrence!.frequency;
        _untilDate = data.recurrence!.untilDate;
      }
      // Populate potential gig state for edit mode
      _isPotentialGig = data.isPotentialGig;
      _selectedMemberIds = Set.from(data.selectedMemberIds);
      // Populate setlist state for edit mode
      _selectedSetlistId = data.setlistId;
      _selectedSetlistName = data.setlistName;

      // Store initial form data for change detection in edit mode
      _initialFormData = data;
    }

    // Load members for potential gig section
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(membersProvider.notifier).loadMembers(widget.bandId);
      _loadLocationSuggestions();

      // Load current user's RSVP response for potential gig in edit mode
      if (widget.mode == EventEditorMode.edit &&
          widget.existingEventId != null &&
          _isPotentialGig) {
        _loadCurrentUserResponse();

        // Pre-select all members for potential gig in edit mode
        // since selectedMemberIds isn't persisted to the database
        _preSelectAllMembersForPotentialGig();
      }
    });

    // Recurring section animation - 250ms with easeOut for snappy + smooth feel
    _recurringAnimController = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    );

    _recurringFadeAnimation = CurvedAnimation(
      parent: _recurringAnimController,
      curve: Curves.easeOut,
    );

    _recurringSlideAnimation =
        Tween<Offset>(begin: const Offset(0, -0.1), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _recurringAnimController,
            curve: Curves.easeOut,
          ),
        );

    if (_isRecurring) {
      _recurringAnimController.value = 1.0;
    }

    // Initialize field hint controllers
    final isEdit = widget.existingEvent != null;
    _venueHintController.initialize(
      hasInitialValue: isEdit && _nameController.text.isNotEmpty,
    );
    _cityHintController.initialize(
      hasInitialValue: isEdit && _locationController.text.isNotEmpty,
    );
    _locationHintController.initialize(
      hasInitialValue: isEdit && _locationController.text.isNotEmpty,
    );
    _notesHintController.initialize(
      hasInitialValue: isEdit && _notesController.text.isNotEmpty,
    );
  }

  @override
  void dispose() {
    _gigNameDebounceTimer?.cancel();
    _gigCityDebounceTimer?.cancel();
    _locationController.dispose();
    _nameController.dispose();
    _notesController.dispose();
    _venueHintController.dispose();
    _cityHintController.dispose();
    _locationHintController.dispose();
    _notesHintController.dispose();
    _recurringAnimController.dispose();
    super.dispose();
  }

  /// Load past rehearsal locations for autocomplete suggestions
  Future<void> _loadLocationSuggestions() async {
    try {
      // Query distinct non-null locations from past rehearsals for this band
      // Order by most recent to prioritize frequently used locations
      final response = await supabase
          .from('rehearsals')
          .select('location, date')
          .eq('band_id', widget.bandId)
          .not('location', 'is', null)
          .neq('location', '')
          .order('date', ascending: false)
          .limit(50);

      // Extract unique locations case-insensitively, preserving order (most recent first)
      final Set<String> seenLower = {};
      final List<String> suggestions = [];
      for (final row in response) {
        final location = row['location'] as String?;
        if (location != null && location.isNotEmpty) {
          final lower = location.toLowerCase();
          if (!seenLower.contains(lower)) {
            seenLower.add(lower);
            suggestions.add(location);
            if (suggestions.length >= 15) break; // Max 15 suggestions
          }
        }
      }

      if (mounted) {
        setState(() {
          _locationSuggestions = suggestions;
        });
        debugPrint(
          '[RehearsalLocation] loaded ${suggestions.length} suggestions for ${widget.bandId}',
        );
      }
    } catch (e) {
      debugPrint('[RehearsalLocation] Error loading suggestions: $e');
      // Fail silently - autocomplete is optional enhancement
    }
  }

  /// Load the current user's RSVP response for this potential gig
  Future<void> _loadCurrentUserResponse() async {
    final gigId = widget.existingEventId;
    final userId = supabase.auth.currentUser?.id;

    if (gigId == null || userId == null) return;

    setState(() => _isLoadingUserResponse = true);

    try {
      final response = await ref
          .read(gigResponseRepositoryProvider)
          .fetchUserResponse(gigId: gigId, userId: userId);

      if (mounted) {
        setState(() {
          _currentUserResponse = response;
          _initialUserResponse = response; // Track for change detection
          _isLoadingUserResponse = false;
        });
      }
    } catch (e) {
      debugPrint('[EventEditorDrawer] Error loading user response: $e');
      if (mounted) {
        setState(() => _isLoadingUserResponse = false);
      }
    }
  }

  /// Pre-select all members for potential gig in edit mode IF no members were persisted.
  /// If requiredMemberIds was loaded from the database, we use that selection instead.
  void _preSelectAllMembersForPotentialGig() {
    debugPrint(
      '[EventEditorDrawer] _preSelectAllMembersForPotentialGig called',
    );
    debugPrint(
      '[EventEditorDrawer] Current selection: ${_selectedMemberIds.length} members',
    );

    // If we already have a selection from the database, don't override it
    if (_selectedMemberIds.isNotEmpty) {
      debugPrint(
        '[EventEditorDrawer] Using persisted selection of ${_selectedMemberIds.length} members',
      );
      return;
    }

    // Wait for members to load, then select all as default
    Future.delayed(const Duration(milliseconds: 100), () {
      if (!mounted) return;

      // Check again in case selection was set while waiting
      if (_selectedMemberIds.isNotEmpty) {
        debugPrint(
          '[EventEditorDrawer] Selection was set while waiting, using that',
        );
        return;
      }

      final members = ref.read(membersProvider).members;
      debugPrint('[EventEditorDrawer] Members loaded: ${members.length}');

      if (members.isNotEmpty) {
        // Pre-select all members as default when no selection was persisted
        final allMemberIds = members.map((m) => m.userId).toSet();
        setState(() {
          _selectedMemberIds = allMemberIds;
          // Also update initialFormData so this doesn't count as a change
          // (since all members selected is the intended default for potential gigs)
          // IMPORTANT: Create a copy of the Set to avoid reference issues -
          // otherwise mutations to _selectedMemberIds also affect _initialFormData
          if (_initialFormData != null) {
            _initialFormData = _initialFormData!.copyWith(
              selectedMemberIds: Set<String>.from(_selectedMemberIds),
            );
          }
        });
        debugPrint(
          '[EventEditorDrawer] Pre-selected ${_selectedMemberIds.length} members for potential gig (default)',
        );
      } else {
        // Members not loaded yet, try again
        debugPrint('[EventEditorDrawer] Members not loaded yet, retrying...');
        _preSelectAllMembersForPotentialGig();
      }
    });
  }

  /// Submit the current user's RSVP response
  Future<void> _submitUserResponse(String response) async {
    debugPrint(
      '[EventEditorDrawer] _submitUserResponse called with: $response',
    );

    final gigId = widget.existingEventId;
    final userId = supabase.auth.currentUser?.id;

    debugPrint('[EventEditorDrawer] gigId: $gigId, userId: $userId');

    if (gigId == null || userId == null) {
      debugPrint('[EventEditorDrawer] gigId or userId is null, returning');
      return;
    }

    // Don't submit if same response
    if (_currentUserResponse == response) {
      debugPrint('[EventEditorDrawer] Same response, returning');
      return;
    }

    setState(() => _isSubmittingUserResponse = true);
    debugPrint('[EventEditorDrawer] Starting submission...');

    // Haptic feedback
    HapticFeedback.mediumImpact();

    try {
      debugPrint('[EventEditorDrawer] Calling upsertResponse...');
      await ref
          .read(gigResponseRepositoryProvider)
          .upsertResponse(
            gigId: gigId,
            bandId: widget.bandId,
            userId: userId,
            response: response,
          );
      debugPrint('[EventEditorDrawer] upsertResponse succeeded!');

      if (mounted) {
        setState(() {
          _currentUserResponse = response;
          _isSubmittingUserResponse = false;
        });

        // Refresh gig data to update counts
        ref.read(gigProvider.notifier).refresh();

        showSuccessSnackBar(
          context,
          message: response == 'yes'
              ? 'You\'re available! 🎸'
              : 'Got it — you\'re not available.',
        );
      }
    } catch (e, stackTrace) {
      debugPrint('[EventEditorDrawer] Error submitting response: $e');
      debugPrint('[EventEditorDrawer] Stack trace: $stackTrace');
      if (mounted) {
        setState(() => _isSubmittingUserResponse = false);
        showErrorSnackBar(context, message: 'Failed to update availability');
      }
    }
  }

  /// Fetch gig name suggestions with debounce (from past gig names for this band)
  void _fetchGigNameSuggestions(String query) {
    _gigNameDebounceTimer?.cancel();

    // Clear suggestions if query is too short
    if (query.length < 2) {
      if (_gigNameSuggestions.isNotEmpty) {
        setState(() => _gigNameSuggestions = []);
      }
      return;
    }

    _gigNameDebounceTimer = Timer(const Duration(milliseconds: 300), () async {
      try {
        // Query distinct gig names from past gigs for this band
        // prefix-matched, case-insensitive
        final response = await supabase
            .from('gigs')
            .select('name, date')
            .eq('band_id', widget.bandId)
            .not('name', 'is', null)
            .neq('name', '')
            .ilike('name', '$query%')
            .order('date', ascending: false)
            .limit(30);

        // Dedupe case-insensitively and limit to 15
        final Set<String> seenLower = {};
        final List<String> suggestions = [];
        for (final row in response) {
          final name = row['name'] as String?;
          if (name != null && name.isNotEmpty) {
            final lower = name.toLowerCase();
            if (!seenLower.contains(lower)) {
              seenLower.add(lower);
              suggestions.add(name);
              if (suggestions.length >= 15) break;
            }
          }
        }

        if (mounted) {
          setState(() => _gigNameSuggestions = suggestions);
          debugPrint('[GigNameAutocomplete] "$query" -> ${suggestions.length}');
        }
      } catch (e) {
        debugPrint('[GigNameAutocomplete] Error: $e');
        // Fail silently
      }
    });
  }

  /// Fetch gig city suggestions with debounce (from past gig cities for this band)
  void _fetchGigCitySuggestions(String query) {
    _gigCityDebounceTimer?.cancel();

    // Clear suggestions if query is too short
    if (query.length < 2) {
      if (_gigCitySuggestions.isNotEmpty) {
        setState(() => _gigCitySuggestions = []);
      }
      return;
    }

    _gigCityDebounceTimer = Timer(const Duration(milliseconds: 300), () async {
      try {
        // Query distinct cities from past gigs for this band
        // prefix-matched, case-insensitive
        final response = await supabase
            .from('gigs')
            .select('city, date')
            .eq('band_id', widget.bandId)
            .not('city', 'is', null)
            .neq('city', '')
            .ilike('city', '$query%')
            .order('date', ascending: false)
            .limit(30);

        // Dedupe case-insensitively and limit to 15
        final Set<String> seenLower = {};
        final List<String> suggestions = [];
        for (final row in response) {
          final city = row['city'] as String?;
          if (city != null && city.isNotEmpty) {
            final lower = city.toLowerCase();
            if (!seenLower.contains(lower)) {
              seenLower.add(lower);
              suggestions.add(city);
              if (suggestions.length >= 15) break;
            }
          }
        }

        if (mounted) {
          setState(() => _gigCitySuggestions = suggestions);
          debugPrint('[GigCityAutocomplete] "$query" -> ${suggestions.length}');
        }
      } catch (e) {
        debugPrint('[GigCityAutocomplete] Error: $e');
        // Fail silently
      }
    });
  }

  void _toggleRecurring(bool value) {
    setState(() {
      _isRecurring = value;
    });
    if (value) {
      _recurringAnimController.forward();
    } else {
      _recurringAnimController.reverse();
    }
  }

  void _togglePotentialGig(bool value) {
    setState(() {
      _isPotentialGig = value;
      // When enabling potential gig, select all members by default
      if (value && _selectedMemberIds.isEmpty) {
        final members = ref.read(membersProvider).members;
        _selectedMemberIds = members.map((m) => m.userId).toSet();
      }
    });
  }

  EventFormData _buildFormData() {
    return EventFormData(
      type: _eventType,
      date: _selectedDate,
      hour: _selectedHour,
      minutes: _selectedMinutes,
      isPM: _isPM,
      duration: _selectedDuration,
      location: _locationController.text.trim(),
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
      name: _nameController.text.trim().isEmpty
          ? null
          : _nameController.text.trim(),
      isRecurring: _isRecurring,
      recurrence: _isRecurring
          ? RecurrenceConfig(
              daysOfWeek: _selectedDays,
              frequency: _frequency,
              untilDate: _untilDate,
            )
          : null,
      isPotentialGig: _eventType == EventType.gig && _isPotentialGig,
      selectedMemberIds: _selectedMemberIds,
      setlistId: _selectedSetlistId,
      setlistName: _selectedSetlistName,
    );
  }

  /// Check if form has changes from initial state (edit mode only)
  bool get _hasChanges {
    if (widget.mode != EventEditorMode.edit || _initialFormData == null) {
      return true; // Always allow save in create mode
    }
    final current = _buildFormData();
    final initial = _initialFormData!;

    // Compare all fields including gig-specific ones
    // For selectedMemberIds, compare as Sets with stable ordering
    final memberIdsChanged = !_setsEqual(
      current.selectedMemberIds,
      initial.selectedMemberIds,
    );

    // Use normalized string comparison for text fields
    return current.type != initial.type ||
        current.date != initial.date ||
        current.hour != initial.hour ||
        current.minutes != initial.minutes ||
        current.isPM != initial.isPM ||
        current.duration != initial.duration ||
        !_stringsEqual(current.location, initial.location) ||
        !_stringsEqual(current.notes, initial.notes) ||
        !_stringsEqual(current.name, initial.name) ||
        current.isRecurring != initial.isRecurring ||
        current.isPotentialGig != initial.isPotentialGig ||
        memberIdsChanged ||
        current.setlistId != initial.setlistId ||
        _currentUserResponse != _initialUserResponse;
  }

  /// Helper to compare two Sets for equality
  bool _setsEqual<T>(Set<T> a, Set<T> b) {
    if (a.length != b.length) return false;
    return a.containsAll(b) && b.containsAll(a);
  }

  /// Helper to compare strings with normalization.
  /// Treats null and empty string as equivalent.
  /// Trims whitespace and collapses repeated spaces.
  bool _stringsEqual(String? a, String? b) {
    final normalizedA = _normalizeString(a);
    final normalizedB = _normalizeString(b);
    return normalizedA == normalizedB;
  }

  /// Normalize a string: trim, collapse whitespace, treat null as empty.
  String _normalizeString(String? s) {
    if (s == null) return '';
    return s.trim().replaceAll(RegExp(r'\s+'), ' ');
  }

  /// Whether this is edit mode
  bool get _isEditMode => widget.mode == EventEditorMode.edit;

  Future<void> _handleSave() async {
    // Clear previous errors
    setState(() {
      _errorMessage = null;
    });

    // Validate
    final formData = _buildFormData();
    final errors = formData.validate();

    if (errors.isNotEmpty) {
      setState(() {
        _errorMessage = errors.first;
      });
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final repository = ref.read(eventsRepositoryProvider);

      if (widget.mode == EventEditorMode.edit &&
          widget.existingEventId != null) {
        // Update existing event
        if (_eventType == EventType.rehearsal) {
          await repository.updateRehearsal(
            rehearsalId: widget.existingEventId!,
            bandId: widget.bandId,
            formData: formData,
          );
        } else {
          await repository.updateGig(
            gigId: widget.existingEventId!,
            bandId: widget.bandId,
            formData: formData,
          );

          // Save user availability response if it changed (potential gigs only)
          if (_isPotentialGig &&
              _currentUserResponse != null &&
              _currentUserResponse != _initialUserResponse) {
            final userId = supabase.auth.currentUser?.id;
            if (userId != null) {
              await ref
                  .read(gigResponseRepositoryProvider)
                  .upsertResponse(
                    gigId: widget.existingEventId!,
                    bandId: widget.bandId,
                    userId: userId,
                    response: _currentUserResponse!,
                  );
            }
          }
        }
      } else {
        // Create new event
        if (_eventType == EventType.rehearsal) {
          await repository.createRehearsal(
            bandId: widget.bandId,
            formData: formData,
          );
        } else {
          await repository.createGig(bandId: widget.bandId, formData: formData);
        }
      }

      // Invalidate cache
      repository.invalidateCache(widget.bandId);

      // Refresh providers directly to ensure immediate UI update
      // This is more reliable than relying on onSaved callback after pop
      ref.read(gigProvider.notifier).refresh();
      ref.read(rehearsalProvider.notifier).refresh();
      ref
          .read(calendarProvider.notifier)
          .invalidateAndRefresh(bandId: widget.bandId);

      // Success feedback
      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.of(context).pop(true);
        widget.onSaved?.call();

        showSuccessSnackBar(
          context,
          message: widget.mode == EventEditorMode.edit
              ? '${_eventType.displayName} updated'
              : '${_eventType.displayName} created',
        );
      }
    } catch (e) {
      setState(() {
        _isSaving = false;
        _errorMessage = _mapErrorToMessage(e);
      });
    }
  }

  String _mapErrorToMessage(Object error) {
    final errorStr = error.toString().toLowerCase();

    if (errorStr.contains('permission') ||
        errorStr.contains('rls') ||
        errorStr.contains('policy')) {
      return "You don't have permission to add events for this band.";
    }

    if (errorStr.contains('network') ||
        errorStr.contains('socket') ||
        errorStr.contains('connection')) {
      return "Can't reach the server. Please try again.";
    }

    if (errorStr.contains('validation') || errorStr.contains('invalid')) {
      return "Please check your input and try again.";
    }

    // Recurrence not supported yet
    if (errorStr.contains('recurrence') || errorStr.contains('recurring')) {
      return "Recurring events coming soon!";
    }

    return "Something went wrong. Please try again.";
  }

  /// Show delete confirmation dialog and handle deletion
  Future<void> _showDeleteConfirmation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardBgElevated,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete Event?',
          style: AppTextStyles.title3.copyWith(color: AppColors.textPrimary),
        ),
        content: Text(
          'This action cannot be undone.',
          style: AppTextStyles.callout.copyWith(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              'Cancel',
              style: AppTextStyles.calloutEmphasized.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(
              'Delete',
              style: AppTextStyles.calloutEmphasized.copyWith(
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _handleDelete();
    }
  }

  /// Delete the event
  Future<void> _handleDelete() async {
    if (widget.existingEventId == null) return;

    setState(() {
      _isDeleting = true;
      _errorMessage = null;
    });

    try {
      final repository = ref.read(eventsRepositoryProvider);

      if (_eventType == EventType.rehearsal) {
        await repository.deleteRehearsal(
          rehearsalId: widget.existingEventId!,
          bandId: widget.bandId,
        );
        debugPrint(
          '[DeleteEvent] deleted rehearsal ${widget.existingEventId} for band ${widget.bandId}',
        );
      } else {
        await repository.deleteGig(
          gigId: widget.existingEventId!,
          bandId: widget.bandId,
        );
        debugPrint(
          '[DeleteEvent] deleted gig ${widget.existingEventId} for band ${widget.bandId}',
        );
      }

      // Invalidate cache
      repository.invalidateCache(widget.bandId);

      // Refresh providers directly to ensure immediate UI update
      // This is more reliable than relying on onSaved callback after pop
      ref.read(gigProvider.notifier).refresh();
      ref.read(rehearsalProvider.notifier).refresh();
      ref
          .read(calendarProvider.notifier)
          .invalidateAndRefresh(bandId: widget.bandId);

      // Success feedback
      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.of(context).pop(true);
        widget.onSaved?.call(); // Refresh caller's data (dashboard + calendar)

        showSuccessSnackBar(
          context,
          message: '${_eventType.displayName} deleted',
        );
      }
    } catch (e) {
      setState(() {
        _isDeleting = false;
        _errorMessage = _mapDeleteErrorToMessage(e);
      });
    }
  }

  String _mapDeleteErrorToMessage(Object error) {
    final errorStr = error.toString().toLowerCase();

    if (errorStr.contains('permission') ||
        errorStr.contains('rls') ||
        errorStr.contains('policy')) {
      return "You don't have permission to delete this event.";
    }

    if (errorStr.contains('network') ||
        errorStr.contains('socket') ||
        errorStr.contains('connection')) {
      return "Can't reach the server. Please try again.";
    }

    return "Failed to delete event. Please try again.";
  }

  String get _primaryButtonLabel {
    final typeName = _eventType.displayName;
    return widget.mode == EventEditorMode.edit ? 'Update' : 'Add $typeName';
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderMuted,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          const SizedBox(height: Spacing.space16),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: Spacing.pagePadding,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.mode == EventEditorMode.edit
                        ? 'Edit ${_eventType.displayName}'
                        : 'Add Event',
                    style: AppTextStyles.title3,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).pop(false);
                    widget.onCancelled?.call();
                  },
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: AppColors.scaffoldBg,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: Spacing.space16),

          // Scrollable content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(
                left: Spacing.pagePadding,
                right: Spacing.pagePadding,
                bottom: bottomPadding + safeBottom + 100,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Error banner
                  if (_errorMessage != null) ...[
                    _buildErrorBanner(),
                    const SizedBox(height: Spacing.space16),
                  ],

                  // 1. Event Type Toggle
                  _buildEventTypeToggle(),

                  const SizedBox(height: Spacing.space20),

                  // Gig name field (only for gigs) - with autocomplete
                  if (_eventType == EventType.gig) ...[
                    _buildGigNameAutocomplete(),
                    const SizedBox(height: Spacing.space16),

                    // Potential Gig Section - wrapped with optional rose border
                    _buildPotentialGigContainer(),

                    const SizedBox(height: Spacing.space12),
                  ],

                  // 2. Date Picker
                  _buildDatePicker(),

                  const SizedBox(height: Spacing.space16),

                  // 3. Start Time Selectors
                  _buildTimeSelector(),

                  const SizedBox(height: Spacing.space16),

                  // 4. Duration Toggles (4x2 grid)
                  _buildDurationSelector(),

                  const SizedBox(height: Spacing.space16),

                  // 5. Location/City Input (context-aware label)
                  // Rehearsals get autocomplete from past locations
                  // Gigs get autocomplete from past cities
                  _eventType == EventType.rehearsal
                      ? _buildLocationAutocomplete()
                      : _buildGigCityAutocomplete(),

                  const SizedBox(height: Spacing.space16),

                  // 6. Setlist Selector (optional for both gigs and rehearsals)
                  _buildSetlistSelector(),

                  const SizedBox(height: Spacing.space16),

                  // Notes (optional)
                  _buildTextField(
                    label: 'Notes (optional)',
                    controller: _notesController,
                    hint: 'Any additional details...',
                    maxLines: 3,
                  ),
                  FieldHint(
                    text: "Optional — visible only to band members.",
                    controller: _notesHintController,
                  ),

                  const SizedBox(height: Spacing.space20),

                  // 6. Recurring Toggle (rehearsals only - gigs don't recur)
                  if (_eventType == EventType.rehearsal) ...[
                    _buildRecurringToggle(),

                    // 7. Recurring Section (animated with slide + fade)
                    AnimatedSize(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeOut,
                      alignment: Alignment.topCenter,
                      child: _isRecurring
                          ? SlideTransition(
                              position: _recurringSlideAnimation,
                              child: FadeTransition(
                                opacity: _recurringFadeAnimation,
                                child: _buildRecurringSection(),
                              ),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],

                  // Delete Event button (edit mode only)
                  if (_isEditMode) ...[
                    const SizedBox(height: Spacing.space24),
                    _buildDeleteButton(),
                  ],
                ],
              ),
            ),
          ),

          // 8. Bottom Buttons (sticky) - Equal width
          _buildBottomButtons(safeBottom),
        ],
      ),
    );
  }

  // ============================================================================
  // WIDGET BUILDERS
  // ============================================================================

  Widget _buildErrorBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.error,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMessage!,
              style: AppTextStyles.callout.copyWith(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }

  /// Delete button (destructive text style) - only shown in edit mode
  Widget _buildDeleteButton() {
    return Center(
      child: TextButton(
        onPressed: (_isSaving || _isDeleting) ? null : _showDeleteConfirmation,
        child: _isDeleting
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.error,
                ),
              )
            : Text(
                'Delete Event',
                style: AppTextStyles.calloutEmphasized.copyWith(
                  color: AppColors.error,
                ),
              ),
      ),
    );
  }

  Widget _buildEventTypeToggle() {
    // In edit mode, the toggle is disabled to prevent type changes
    final isDisabled = _isEditMode || _isSaving;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.scaffoldBg,
            borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          ),
          padding: const EdgeInsets.all(4),
          child: Row(
            children: EventType.values.map((type) {
              final isSelected = _eventType == type;
              return Expanded(
                child: GestureDetector(
                  onTap: isDisabled
                      ? null
                      : () {
                          setState(() {
                            _eventType = type;
                          });
                          HapticFeedback.selectionClick();
                        },
                  child: AnimatedContainer(
                    duration: AppDurations.fast,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? (isDisabled
                                ? AppColors.accent.withValues(alpha: 0.5)
                                : AppColors.accent)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(
                        Spacing.buttonRadius - 2,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      type.displayName,
                      style: AppTextStyles.calloutEmphasized.copyWith(
                        color: isSelected
                            ? (isDisabled
                                  ? AppColors.textPrimary.withValues(alpha: 0.7)
                                  : AppColors.textPrimary)
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        // Helper text in edit mode
        if (_isEditMode) ...[
          const SizedBox(height: 6),
          Text(
            'Event type cannot be changed after creation.',
            style: AppTextStyles.footnote.copyWith(color: AppColors.textMuted),
          ),
        ],
      ],
    );
  }

  Widget _buildDatePicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Date',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: _isSaving ? null : _showDatePicker,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.scaffoldBg,
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              border: Border.all(color: AppColors.borderMuted),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 18,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 10),
                Text(
                  _formatDateDisplay(_selectedDate),
                  style: AppTextStyles.callout.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _formatDateDisplay(DateTime date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final dayName = days[date.weekday % 7];
    final monthName = months[date.month - 1];
    return '$dayName, $monthName ${date.day}, ${date.year}';
  }

  Future<void> _showDatePicker() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.accent,
              surface: AppColors.cardBg,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        // Update selected days for recurring
        _selectedDays = {Weekday.values[picked.weekday % 7]};
      });
    }
  }

  Widget _buildTimeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Start Time',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            // Hour dropdown
            Expanded(
              child: _buildDropdown(
                value: _selectedHour,
                items: List.generate(12, (i) => i + 1),
                onChanged: (v) => setState(() => _selectedHour = v!),
                labelBuilder: (v) => v.toString(),
              ),
            ),
            const SizedBox(width: 8),
            // Minutes dropdown
            Expanded(
              child: _buildDropdown(
                value: _selectedMinutes,
                items: [0, 15, 30, 45],
                onChanged: (v) => setState(() => _selectedMinutes = v!),
                labelBuilder: (v) => ':${v.toString().padLeft(2, '0')}',
              ),
            ),
            const SizedBox(width: 8),
            // AM/PM toggle
            Container(
              decoration: BoxDecoration(
                color: AppColors.scaffoldBg,
                borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildAmPmButton('AM', !_isPM),
                  _buildAmPmButton('PM', _isPM),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDropdown<T>({
    required T value,
    required List<T> items,
    required ValueChanged<T?> onChanged,
    required String Function(T) labelBuilder,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.scaffoldBg,
        borderRadius: BorderRadius.circular(Spacing.buttonRadius),
        border: Border.all(color: AppColors.borderMuted),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          dropdownColor: AppColors.cardBgElevated,
          style: AppTextStyles.callout.copyWith(color: AppColors.textPrimary),
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: AppColors.textSecondary,
          ),
          items: items.map((item) {
            return DropdownMenuItem<T>(
              value: item,
              child: Text(labelBuilder(item)),
            );
          }).toList(),
          onChanged: _isSaving ? null : onChanged,
        ),
      ),
    );
  }

  Widget _buildAmPmButton(String label, bool isSelected) {
    return GestureDetector(
      onTap: _isSaving
          ? null
          : () {
              setState(() {
                _isPM = label == 'PM';
              });
              HapticFeedback.selectionClick();
            },
      child: AnimatedContainer(
        duration: AppDurations.fast,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(Spacing.buttonRadius - 2),
        ),
        child: Text(
          label,
          style: AppTextStyles.footnote.copyWith(
            color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  /// Duration selector using ButtonGroupGrid for 4x2 uniform layout
  Widget _buildDurationSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Duration',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        ButtonGroupGrid<EventDuration>(
          items: EventDuration.values,
          labelBuilder: (d) => d.label,
          isSelected: (d) => _selectedDuration == d,
          onTap: (d) {
            setState(() {
              _selectedDuration = d;
            });
          },
          columns: 4,
          buttonHeight: 42,
          enabled: !_isSaving,
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    String? hint,
    String? error,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          enabled: !_isSaving,
          maxLines: maxLines,
          style: AppTextStyles.callout.copyWith(color: AppColors.textPrimary),
          // Trigger rebuild on text change so _hasChanges is re-evaluated
          // and the Update button enables/disables appropriately.
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: AppTextStyles.callout.copyWith(
              color: AppColors.textMuted,
            ),
            filled: true,
            fillColor: AppColors.scaffoldBg,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              borderSide: BorderSide(
                color: error != null ? AppColors.error : AppColors.borderMuted,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              borderSide: BorderSide(
                color: error != null ? AppColors.error : AppColors.borderMuted,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              borderSide: BorderSide(
                color: error != null ? AppColors.error : AppColors.accent,
              ),
            ),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 4),
          Text(
            error,
            style: AppTextStyles.footnote.copyWith(color: AppColors.error),
          ),
        ],
      ],
    );
  }

  /// Build location field with autocomplete for rehearsals
  Widget _buildLocationAutocomplete() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Location',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        Autocomplete<String>(
          initialValue: TextEditingValue(text: _locationController.text),
          optionsBuilder: (TextEditingValue textEditingValue) {
            // Only show suggestions when input length >= 1
            if (textEditingValue.text.isEmpty) {
              return const Iterable<String>.empty();
            }
            // Filter suggestions by case-insensitive contains, limit to 8
            final query = textEditingValue.text.toLowerCase();
            return _locationSuggestions
                .where((location) => location.toLowerCase().contains(query))
                .take(8);
          },
          onSelected: (String selection) {
            _locationController.text = selection;
            debugPrint('[RehearsalLocation] selected suggestion: $selection');
            setState(() {});
          },
          fieldViewBuilder:
              (
                BuildContext context,
                TextEditingController fieldController,
                FocusNode focusNode,
                VoidCallback onFieldSubmitted,
              ) {
                // Sync the field controller with our location controller
                fieldController.addListener(() {
                  _locationController.text = fieldController.text;
                });
                return TextField(
                  controller: fieldController,
                  focusNode: focusNode,
                  enabled: !_isSaving,
                  textCapitalization: TextCapitalization.words,
                  inputFormatters: [TitleCaseTextFormatter()],
                  style: AppTextStyles.callout.copyWith(
                    color: AppColors.textPrimary,
                  ),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'e.g., Studio, Venue Address',
                    hintStyle: AppTextStyles.callout.copyWith(
                      color: AppColors.textMuted,
                    ),
                    filled: true,
                    fillColor: AppColors.scaffoldBg,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(
                        color: AppColors.borderMuted,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(
                        color: AppColors.borderMuted,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(color: AppColors.accent),
                    ),
                  ),
                );
              },
          optionsViewBuilder:
              (
                BuildContext context,
                AutocompleteOnSelected<String> onSelected,
                Iterable<String> options,
              ) {
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 200),
                      decoration: BoxDecoration(
                        color: AppColors.cardBgElevated,
                        borderRadius: BorderRadius.circular(
                          Spacing.buttonRadius,
                        ),
                        border: Border.all(color: AppColors.borderMuted),
                      ),
                      child: ListView.builder(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: options.length,
                        itemBuilder: (BuildContext context, int index) {
                          final option = options.elementAt(index);
                          return ListTile(
                            dense: true,
                            title: Text(
                              option,
                              style: AppTextStyles.callout.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                            onTap: () => onSelected(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
        ),
        FieldHint(
          text: "We'll remember locations you've used before.",
          controller: _locationHintController,
        ),
      ],
    );
  }

  /// Build gig name field with autocomplete and title case
  Widget _buildGigNameAutocomplete() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Gig Venue / Festival / Name',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        RawAutocomplete<String>(
          textEditingController: _nameController,
          focusNode: FocusNode(),
          optionsBuilder: (TextEditingValue textEditingValue) {
            // Trigger async fetch (debounced)
            _fetchGigNameSuggestions(textEditingValue.text);
            // Return current suggestions
            if (textEditingValue.text.length < 2) {
              return const Iterable<String>.empty();
            }
            return _gigNameSuggestions;
          },
          onSelected: (String selection) {
            _nameController.text = selection;
            _nameController.selection = TextSelection.collapsed(
              offset: selection.length,
            );
            setState(() => _gigNameSuggestions = []);
          },
          fieldViewBuilder:
              (
                BuildContext context,
                TextEditingController controller,
                FocusNode focusNode,
                VoidCallback onFieldSubmitted,
              ) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  enabled: !_isSaving,
                  textCapitalization: TextCapitalization.words,
                  inputFormatters: [TitleCaseTextFormatter()],
                  style: AppTextStyles.callout.copyWith(
                    color: AppColors.textPrimary,
                  ),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'e.g., The Blue Note, SummerFest 2026',
                    hintStyle: AppTextStyles.callout.copyWith(
                      color: AppColors.textMuted,
                    ),
                    filled: true,
                    fillColor: AppColors.scaffoldBg,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: BorderSide(
                        color: _fieldErrors['name'] != null
                            ? AppColors.error
                            : AppColors.borderMuted,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: BorderSide(
                        color: _fieldErrors['name'] != null
                            ? AppColors.error
                            : AppColors.borderMuted,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: BorderSide(
                        color: _fieldErrors['name'] != null
                            ? AppColors.error
                            : AppColors.accent,
                      ),
                    ),
                  ),
                );
              },
          optionsViewBuilder:
              (
                BuildContext context,
                AutocompleteOnSelected<String> onSelected,
                Iterable<String> options,
              ) {
                if (options.isEmpty) return const SizedBox.shrink();
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 200),
                      width:
                          MediaQuery.of(context).size.width -
                          (Spacing.pagePadding * 2),
                      decoration: BoxDecoration(
                        color: AppColors.cardBgElevated,
                        borderRadius: BorderRadius.circular(
                          Spacing.buttonRadius,
                        ),
                        border: Border.all(color: AppColors.borderMuted),
                      ),
                      child: ListView.builder(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: options.length,
                        itemBuilder: (BuildContext context, int index) {
                          final option = options.elementAt(index);
                          return ListTile(
                            dense: true,
                            title: Text(
                              option,
                              style: AppTextStyles.callout.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                            onTap: () => onSelected(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
        ),
        if (_fieldErrors['name'] != null) ...[
          const SizedBox(height: 4),
          Text(
            _fieldErrors['name']!,
            style: AppTextStyles.footnote.copyWith(color: AppColors.error),
          ),
        ],
        FieldHint(
          text: "Start typing to reuse past venues.",
          controller: _venueHintController,
        ),
      ],
    );
  }

  /// Build city field with autocomplete and title case (for gigs)
  Widget _buildGigCityAutocomplete() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'City',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        RawAutocomplete<String>(
          textEditingController: _locationController,
          focusNode: FocusNode(),
          optionsBuilder: (TextEditingValue textEditingValue) {
            // Trigger async fetch (debounced)
            _fetchGigCitySuggestions(textEditingValue.text);
            // Return current suggestions
            if (textEditingValue.text.length < 2) {
              return const Iterable<String>.empty();
            }
            return _gigCitySuggestions;
          },
          onSelected: (String selection) {
            _locationController.text = selection;
            _locationController.selection = TextSelection.collapsed(
              offset: selection.length,
            );
            setState(() => _gigCitySuggestions = []);
          },
          fieldViewBuilder:
              (
                BuildContext context,
                TextEditingController controller,
                FocusNode focusNode,
                VoidCallback onFieldSubmitted,
              ) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  enabled: !_isSaving,
                  textCapitalization: TextCapitalization.words,
                  inputFormatters: [TitleCaseTextFormatter()],
                  style: AppTextStyles.callout.copyWith(
                    color: AppColors.textPrimary,
                  ),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'e.g., Chicago, IL',
                    hintStyle: AppTextStyles.callout.copyWith(
                      color: AppColors.textMuted,
                    ),
                    filled: true,
                    fillColor: AppColors.scaffoldBg,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(
                        color: AppColors.borderMuted,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(
                        color: AppColors.borderMuted,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                      borderSide: const BorderSide(color: AppColors.accent),
                    ),
                  ),
                );
              },
          optionsViewBuilder:
              (
                BuildContext context,
                AutocompleteOnSelected<String> onSelected,
                Iterable<String> options,
              ) {
                if (options.isEmpty) return const SizedBox.shrink();
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 200),
                      width:
                          MediaQuery.of(context).size.width -
                          (Spacing.pagePadding * 2),
                      decoration: BoxDecoration(
                        color: AppColors.cardBgElevated,
                        borderRadius: BorderRadius.circular(
                          Spacing.buttonRadius,
                        ),
                        border: Border.all(color: AppColors.borderMuted),
                      ),
                      child: ListView.builder(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: options.length,
                        itemBuilder: (BuildContext context, int index) {
                          final option = options.elementAt(index);
                          return ListTile(
                            dense: true,
                            title: Text(
                              option,
                              style: AppTextStyles.callout.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                            onTap: () => onSelected(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
        ),
        FieldHint(
          text: "Auto-fills based on past gigs.",
          controller: _cityHintController,
        ),
      ],
    );
  }

  // ============================================================================
  // POTENTIAL GIG SECTION
  // ============================================================================

  /// Builds the entire Potential Gig container with optional rose border
  Widget _buildPotentialGigContainer() {
    final membersState = ref.watch(membersProvider);
    final members = membersState.members;

    // Container with conditional rose border when toggle is ON
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      padding: const EdgeInsets.all(Spacing.space12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: _isPotentialGig
            ? Border.all(color: AppColors.accent, width: 2)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: Title + Toggle
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Potential Gig',
                      style: AppTextStyles.callout.copyWith(
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Requires member confirmation before gig is official.',
                      style: AppTextStyles.footnote.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: _isPotentialGig,
                onChanged: _isSaving ? null : _togglePotentialGig,
                activeTrackColor: AppColors.accent,
                thumbColor: WidgetStateProperty.resolveWith((states) {
                  if (states.contains(WidgetState.selected)) {
                    return AppColors.textPrimary;
                  }
                  return null;
                }),
              ),
            ],
          ),

          // Member grid (only visible when toggle is ON)
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            alignment: Alignment.topCenter,
            child: _isPotentialGig
                ? Column(
                    children: [
                      _buildMemberSelectionGrid(
                        members,
                        membersState.isLoading,
                      ),
                      // Your Availability section (edit mode only)
                      if (widget.mode == EventEditorMode.edit &&
                          widget.existingEventId != null)
                        _buildUserAvailabilitySection(),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  /// Builds the "Your Availability" section with YES/NO buttons
  Widget _buildUserAvailabilitySection() {
    debugPrint('[EventEditorDrawer] Building Your Availability section');
    debugPrint(
      '[EventEditorDrawer] _isLoadingUserResponse: $_isLoadingUserResponse',
    );
    debugPrint(
      '[EventEditorDrawer] _currentUserResponse: $_currentUserResponse',
    );
    debugPrint(
      '[EventEditorDrawer] _isSubmittingUserResponse: $_isSubmittingUserResponse',
    );

    return Padding(
      padding: const EdgeInsets.only(top: Spacing.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Divider
          Container(
            height: 1,
            margin: const EdgeInsets.only(bottom: Spacing.space12),
            color: AppColors.borderMuted,
          ),

          // Label
          Text(
            'Your Availability',
            style: AppTextStyles.footnote.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),

          const SizedBox(height: Spacing.space8),

          // Loading state
          if (_isLoadingUserResponse)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: Spacing.space8),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            // NO / YES buttons
            Row(
              children: [
                // NO button
                Expanded(
                  child: _AvailabilityButton(
                    label: 'NO',
                    icon: Icons.close,
                    isSelected: _currentUserResponse == 'no',
                    isPositive: false,
                    isLoading: false,
                    onPressed: () {
                      setState(() => _currentUserResponse = 'no');
                      HapticFeedback.selectionClick();
                    },
                  ),
                ),

                const SizedBox(width: Spacing.space12),

                // YES button
                Expanded(
                  child: _AvailabilityButton(
                    label: 'YES',
                    icon: Icons.check,
                    isSelected: _currentUserResponse == 'yes',
                    isPositive: true,
                    isLoading: false,
                    onPressed: () {
                      setState(() => _currentUserResponse = 'yes');
                      HapticFeedback.selectionClick();
                    },
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  /// Builds the member selection grid for potential gig
  Widget _buildMemberSelectionGrid(List<MemberVM> members, bool isLoading) {
    if (isLoading) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: Spacing.space16),
        child: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (members.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: Spacing.space12),
        child: Text(
          'No members to notify',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: Spacing.space12),
      child: ButtonGroupGrid<MemberVM>(
        items: members,
        labelBuilder: (member) => _getMemberLabel(member, members),
        isSelected: (member) => _selectedMemberIds.contains(member.userId),
        onTap: (member) {
          if (_isSaving) return;
          setState(() {
            if (_selectedMemberIds.contains(member.userId)) {
              _selectedMemberIds.remove(member.userId);
            } else {
              _selectedMemberIds.add(member.userId);
            }
          });
        },
        columns: 4,
        buttonHeight: 38,
      ),
    );
  }

  /// Get display label for a member with disambiguation for duplicate first names
  String _getMemberLabel(MemberVM member, List<MemberVM> allMembers) {
    // Use firstName if available, otherwise fallback to name
    final firstName = member.firstName;

    if (firstName == null || firstName.isEmpty) {
      // Fallback: use full name, truncated if needed
      final name = member.name;
      return name.length > 10 ? '${name.substring(0, 9)}…' : name;
    }

    // Check for duplicate first names
    final duplicateCount = allMembers
        .where((m) => m.firstName == firstName)
        .length;

    if (duplicateCount > 1 &&
        member.lastName != null &&
        member.lastName!.isNotEmpty) {
      // Disambiguate with last initial: "Mike H"
      final label = '$firstName ${member.lastName![0]}';
      return label.length > 10 ? '${label.substring(0, 9)}…' : label;
    }

    // Just use first name
    return firstName.length > 10 ? '${firstName.substring(0, 9)}…' : firstName;
  }

  Widget _buildRecurringToggle() {
    return Row(
      children: [
        Expanded(
          child: Text(
            'Make this recurring',
            style: AppTextStyles.callout.copyWith(color: AppColors.textPrimary),
          ),
        ),
        Switch.adaptive(
          value: _isRecurring,
          onChanged: _isSaving ? null : _toggleRecurring,
          activeTrackColor: AppColors.accent,
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.textPrimary;
            }
            return null;
          }),
        ),
      ],
    );
  }

  Widget _buildRecurringSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: Spacing.space16),

        // A) Days of the Week
        Text(
          'Repeat on',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: Weekday.values.map((day) {
            final isSelected = _selectedDays.contains(day);
            return GestureDetector(
              onTap: _isSaving
                  ? null
                  : () {
                      setState(() {
                        if (isSelected) {
                          _selectedDays.remove(day);
                        } else {
                          _selectedDays.add(day);
                        }
                      });
                      HapticFeedback.selectionClick();
                    },
              child: AnimatedContainer(
                duration: AppDurations.fast,
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.accent : AppColors.scaffoldBg,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected
                        ? AppColors.accent
                        : AppColors.borderMuted,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  day.shortLabel,
                  style: AppTextStyles.footnote.copyWith(
                    color: isSelected
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: Spacing.space16),

        // B) Frequency toggles
        Text(
          'Frequency',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: RecurrenceFrequency.values.map((freq) {
            final isSelected = _frequency == freq;
            return Expanded(
              child: GestureDetector(
                onTap: _isSaving
                    ? null
                    : () {
                        setState(() {
                          _frequency = freq;
                        });
                        HapticFeedback.selectionClick();
                      },
                child: AnimatedContainer(
                  duration: AppDurations.fast,
                  margin: EdgeInsets.only(
                    right: freq != RecurrenceFrequency.monthly ? 8 : 0,
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.accent : AppColors.scaffoldBg,
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.accent
                          : AppColors.borderMuted,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    freq.displayName,
                    style: AppTextStyles.footnote.copyWith(
                      color: isSelected
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),

        const SizedBox(height: Spacing.space16),

        // C) Until date
        Text(
          'Until (optional)',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: _isSaving ? null : _showUntilDatePicker,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.scaffoldBg,
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              border: Border.all(color: AppColors.borderMuted),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.event_rounded,
                  size: 18,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _untilDate != null
                        ? _formatDateDisplay(_untilDate!)
                        : 'No end date',
                    style: AppTextStyles.callout.copyWith(
                      color: _untilDate != null
                          ? AppColors.textPrimary
                          : AppColors.textMuted,
                    ),
                  ),
                ),
                if (_untilDate != null)
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _untilDate = null;
                      });
                    },
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ),

        const SizedBox(height: Spacing.space16),

        // D) Recurrence Summary with spelled-out day names
        if (_selectedDays.isNotEmpty) ...[
          Text(
            'Summary',
            style: AppTextStyles.footnote.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(Spacing.buttonRadius),
              border: Border.all(
                color: AppColors.accent.withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              _buildRecurrenceSummary(),
              style: AppTextStyles.callout.copyWith(
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// Build a human-readable recurrence summary with spelled-out day names.
  /// Examples:
  /// - "Weekly on Tuesdays and Thursdays until February 21, 2026"
  /// - "Biweekly on Mondays, Wednesdays, and Fridays"
  /// - "Monthly on Saturdays until March 15, 2026"
  String _buildRecurrenceSummary() {
    if (_selectedDays.isEmpty) return '';

    // Sort days starting from Sunday
    final sortedDays = _selectedDays.toList()
      ..sort((a, b) => a.dayIndex.compareTo(b.dayIndex));

    // Map to plural day names
    final dayNames = sortedDays.map((d) => d.pluralName).toList();

    // Natural joining: 2 days = "X and Y", 3+ days = "X, Y, and Z"
    String daysText;
    if (dayNames.length == 1) {
      daysText = dayNames.first;
    } else if (dayNames.length == 2) {
      daysText = '${dayNames[0]} and ${dayNames[1]}';
    } else {
      final allButLast = dayNames.sublist(0, dayNames.length - 1).join(', ');
      daysText = '$allButLast, and ${dayNames.last}';
    }

    final frequencyText = _frequency.displayName;

    String? untilText;
    if (_untilDate != null) {
      untilText = ' until ${_formatFullDate(_untilDate!)}';
    }

    return '$frequencyText on $daysText${untilText ?? ''}';
  }

  /// Format date with full month name (e.g., "February 21, 2026")
  String _formatFullDate(DateTime date) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  Future<void> _showUntilDatePicker() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _untilDate ?? _selectedDate.add(const Duration(days: 30)),
      firstDate: _selectedDate,
      lastDate: _selectedDate.add(const Duration(days: 730)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.accent,
              surface: AppColors.cardBg,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _untilDate = picked;
      });
    }
  }

  /// Bottom action buttons - both equal width (50% each)
  Widget _buildBottomButtons(double safeBottom) {
    // In edit mode, disable the button until changes are made
    final canSave = !_isSaving && !_isDeleting && _hasChanges;

    return Container(
      padding: EdgeInsets.only(
        left: Spacing.pagePadding,
        right: Spacing.pagePadding,
        top: Spacing.space12,
        bottom: safeBottom + Spacing.space12,
      ),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        border: Border(
          top: BorderSide(color: AppColors.borderMuted.withValues(alpha: 0.5)),
        ),
      ),
      child: Row(
        children: [
          // Cancel button - equal width
          Expanded(
            child: SizedBox(
              height: 48,
              child: OutlinedButton(
                onPressed: (_isSaving || _isDeleting)
                    ? null
                    : () {
                        Navigator.pop(context);
                        widget.onCancelled?.call();
                      },
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textSecondary,
                  side: const BorderSide(color: AppColors.borderMuted),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                  ),
                ),
                child: Text(
                  'Cancel',
                  style: AppTextStyles.calloutEmphasized.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: Spacing.space12),
          // Primary button - equal width
          Expanded(
            child: BrandActionButton(
              label: _primaryButtonLabel,
              isLoading: _isSaving,
              onPressed: canSave ? _handleSave : null,
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // SETLIST SELECTOR
  // ============================================================================

  /// Builds the setlist selector row with horizontal scrolling pills
  Widget _buildSetlistSelector() {
    final setlistsState = ref.watch(setlistsProvider);
    final setlists = setlistsState.setlists;
    final isLoading = setlistsState.isLoading;
    final error = setlistsState.error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Setlist',
          style: AppTextStyles.footnote.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),

        // Loading state
        if (isLoading)
          Container(
            height: 42,
            alignment: Alignment.centerLeft,
            child: Row(
              children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
                Text(
                  'Loading setlists...',
                  style: AppTextStyles.footnote.copyWith(
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          )
        // Error state
        else if (error != null && setlists.isEmpty)
          Container(
            height: 42,
            alignment: Alignment.centerLeft,
            child: Text(
              "Couldn't load setlists",
              style: AppTextStyles.footnote.copyWith(color: AppColors.error),
            ),
          )
        // Normal state: horizontal scrollable pills
        else
          SizedBox(
            height: 42,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  // "None" pill - always first
                  _buildSetlistPill(
                    id: null,
                    name: 'None',
                    isSelected: _selectedSetlistId == null,
                  ),
                  const SizedBox(width: 8),

                  // Setlist pills - Catalog first, then alphabetical
                  ..._sortSetlists(setlists).map((setlist) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _buildSetlistPill(
                        id: setlist.id,
                        name: setlist.name,
                        isSelected: _selectedSetlistId == setlist.id,
                        isCatalog: setlist.isCatalog,
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
      ],
    );
  }

  /// Sort setlists: alphabetical by name (Catalog excluded)
  List<Setlist> _sortSetlists(List<Setlist> setlists) {
    // Filter out Catalog - it's not a valid option for events
    final filtered = setlists.where((s) => !s.isCatalog).toList();
    // Sort alphabetically
    filtered.sort(
      (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
    );
    return filtered;
  }

  /// Build an individual setlist pill/toggle button
  Widget _buildSetlistPill({
    required String? id,
    required String name,
    required bool isSelected,
    bool isCatalog = false,
  }) {
    return GestureDetector(
      onTap: _isSaving
          ? null
          : () {
              setState(() {
                if (id == null) {
                  // "None" selected
                  _selectedSetlistId = null;
                  _selectedSetlistName = null;
                } else {
                  _selectedSetlistId = id;
                  _selectedSetlistName = name;
                }
              });
              HapticFeedback.selectionClick();
            },
      child: AnimatedContainer(
        duration: AppDurations.fast,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.scaffoldBg,
          borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          border: Border.all(
            color: isSelected ? AppColors.accent : AppColors.borderMuted,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isCatalog) ...[
              Icon(
                Icons.library_music_rounded,
                size: 14,
                color: isSelected
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              name,
              style: AppTextStyles.footnote.copyWith(
                color: isSelected
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// AVAILABILITY BUTTON
// YES/NO button for user's potential gig availability response
// ============================================================================

class _AvailabilityButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final bool isPositive;
  final bool isLoading;
  final VoidCallback onPressed;

  const _AvailabilityButton({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.isPositive,
    required this.isLoading,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = isPositive
        ? const Color(0xFF22C55E) // green-500
        : const Color(0xFFEF4444); // red-500

    final backgroundColor = isSelected
        ? activeColor.withValues(alpha: 0.2)
        : AppColors.scaffoldBg;

    final borderColor = isSelected ? activeColor : AppColors.borderMuted;

    final contentColor = isSelected ? activeColor : AppColors.textSecondary;

    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor, width: isSelected ? 2 : 1),
          ),
          child: Center(
            child: isLoading
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: activeColor,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, size: 20, color: contentColor),
                      const SizedBox(width: 6),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: contentColor,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
