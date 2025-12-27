import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme/design_tokens.dart';
import '../models/setlist_song.dart';
import '../tuning/tuning_helpers.dart';
import 'animated_value_text.dart';
import 'tuning_picker_bottom_sheet.dart';

// ============================================================================
// REORDERABLE SONG CARD
// Variant of SongCard optimized for ReorderableListView with inline editing.
//
// Border: StandardCardBorder (#334155) 1.5px - matches non-Catalog setlist cards
// Layout:
// - Drag handle icon (left, 6px from edge) - ALWAYS visible for reorder
// - Song title (20px white semibold, 36px from left)
// - Artist name (16px gray, below title)
// - Delete icon (top right, rose/red)
// - Tags row: BPM, Duration, Tuning (tap-to-edit)
// Card height: 121px
//
// EDITABLE FIELDS (tap-to-edit):
// - BPM: numeric input, 20-300 range
// - Duration: mmss format, 30s-20m range
// - Tuning: bottom sheet selector
//
// MICRO-INTERACTIONS:
// - Tap: scale/opacity feedback
// - Drag: handled by parent ReorderableListView proxyDecorator
// - Edited indicator: small dot when override exists
// ============================================================================

class ReorderableSongCard extends StatefulWidget {
  final SetlistSong song;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;
  final Future<bool> Function(int bpm)? onBpmChanged;
  final Future<bool> Function()? onBpmCleared;
  final Future<bool> Function(int durationSeconds)? onDurationChanged;
  final Future<bool> Function(String tuning)? onTuningChanged;

  const ReorderableSongCard({
    super.key,
    required this.song,
    this.onTap,
    this.onDelete,
    this.onBpmChanged,
    this.onBpmCleared,
    this.onDurationChanged,
    this.onTuningChanged,
  });

  @override
  State<ReorderableSongCard> createState() => _ReorderableSongCardState();
}

class _ReorderableSongCardState extends State<ReorderableSongCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _tapController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  // Editing states
  bool _isEditingBpm = false;
  bool _isEditingDuration = false;
  bool _isSaving = false;
  String? _editError;

  final TextEditingController _bpmController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final FocusNode _bpmFocus = FocusNode();
  final FocusNode _durationFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      duration: AppDurations.instant,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.98,
    ).animate(CurvedAnimation(parent: _tapController, curve: Curves.easeInOut));
    _opacityAnimation = Tween<double>(
      begin: 1.0,
      end: 0.9,
    ).animate(CurvedAnimation(parent: _tapController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _tapController.dispose();
    _bpmController.dispose();
    _durationController.dispose();
    _bpmFocus.dispose();
    _durationFocus.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    _tapController.forward();
  }

  void _handleTapUp(TapUpDetails details) {
    _tapController.reverse();
  }

  void _handleTapCancel() {
    _tapController.reverse();
  }

  // ============================================================
  // BPM EDITING
  // ============================================================

  void _startEditingBpm() {
    if (_isSaving) return;
    setState(() {
      _isEditingBpm = true;
      _editError = null;
      _bpmController.text = widget.song.bpm?.toString() ?? '';
    });
    Future.delayed(const Duration(milliseconds: 50), () {
      _bpmFocus.requestFocus();
    });
  }

  Future<void> _saveBpm() async {
    final text = _bpmController.text.trim();

    // Empty input clears the BPM (sets to null via callback)
    if (text.isEmpty) {
      setState(() {
        _isSaving = true;
        _editError = null;
      });
      // Clear BPM by passing null
      final success = await widget.onBpmCleared?.call() ?? true;
      setState(() {
        _isSaving = false;
        if (success) {
          _isEditingBpm = false;
        } else {
          _editError = 'Clear failed';
        }
      });
      return;
    }

    final bpm = int.tryParse(text);
    if (bpm == null) {
      setState(() {
        _editError = 'Invalid number';
      });
      return;
    }

    // Validate BPM range (0-999, but 0 treated as clear)
    if (bpm == 0) {
      // Treat 0 as clear
      setState(() {
        _isSaving = true;
        _editError = null;
      });
      final success = await widget.onBpmCleared?.call() ?? true;
      setState(() {
        _isSaving = false;
        if (success) {
          _isEditingBpm = false;
        } else {
          _editError = 'Clear failed';
        }
      });
      return;
    }

    if (bpm < 20 || bpm > 300) {
      setState(() {
        _editError = 'BPM: 20-300';
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _editError = null;
    });

    final success = await widget.onBpmChanged?.call(bpm) ?? false;

    setState(() {
      _isSaving = false;
      if (success) {
        _isEditingBpm = false;
      } else {
        _editError = 'Save failed';
      }
    });
  }

  // ============================================================
  // DURATION EDITING
  // ============================================================

  void _startEditingDuration() {
    if (_isSaving) return;
    // Pre-fill with current duration as mmss (e.g., 345 for 3:45)
    final minutes = widget.song.durationSeconds ~/ 60;
    final seconds = widget.song.durationSeconds % 60;
    final prefilledValue = '$minutes${seconds.toString().padLeft(2, '0')}';

    setState(() {
      _isEditingDuration = true;
      _editError = null;
      _durationController.text = prefilledValue;
    });
    Future.delayed(const Duration(milliseconds: 50), () {
      _durationFocus.requestFocus();
    });
  }

  Future<void> _saveDuration() async {
    final text = _durationController.text.trim();
    if (text.isEmpty) {
      setState(() {
        _isEditingDuration = false;
      });
      return;
    }

    // Parse mmss format: 345 => 3:45, 1025 => 10:25
    int? durationSeconds;
    final digits = text.replaceAll(RegExp(r'[^0-9]'), '');

    if (digits.length <= 2) {
      // Just seconds (e.g., "45" => 45 seconds)
      durationSeconds = int.tryParse(digits);
    } else if (digits.length == 3) {
      // m:ss format (e.g., "345" => 3:45 => 225 seconds)
      final minutes = int.tryParse(digits.substring(0, 1)) ?? 0;
      final seconds = int.tryParse(digits.substring(1)) ?? 0;
      durationSeconds = (minutes * 60) + seconds;
    } else {
      // mm:ss format (e.g., "1025" => 10:25 => 625 seconds)
      final minutes = int.tryParse(digits.substring(0, digits.length - 2)) ?? 0;
      final seconds = int.tryParse(digits.substring(digits.length - 2)) ?? 0;
      durationSeconds = (minutes * 60) + seconds;
    }

    if (durationSeconds == null) {
      setState(() {
        _editError = 'Invalid format';
      });
      return;
    }

    if (durationSeconds < 30 || durationSeconds > 1200) {
      setState(() {
        _editError = '30s - 20m';
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _editError = null;
    });

    final success =
        await widget.onDurationChanged?.call(durationSeconds) ?? false;

    setState(() {
      _isSaving = false;
      if (success) {
        _isEditingDuration = false;
      } else {
        _editError = 'Save failed';
      }
    });
  }

  // ============================================================
  // TUNING SELECTION
  // ============================================================

  Future<void> _selectTuning() async {
    if (_isSaving) return;

    final result = await showTuningPickerBottomSheet(
      context,
      selectedTuningIdOrName: widget.song.tuning,
    );

    if (result != null && result != widget.song.tuning) {
      setState(() {
        _isSaving = true;
      });

      final success = await widget.onTuningChanged?.call(result) ?? false;

      setState(() {
        _isSaving = false;
        if (!success) {
          _editError = 'Save failed';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _tapController,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: Opacity(opacity: _opacityAnimation.value, child: child),
          );
        },
        child: Container(
          width: double.infinity,
          height: 121,
          decoration: BoxDecoration(
            color: AppColors.scaffoldBg,
            border: Border.all(
              color: StandardCardBorder.color,
              width: StandardCardBorder.width,
            ),
            borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          ),
          child: Stack(
            children: [
              // Drag handle icon - positioned 6px from left, 13px from top
              Positioned(
                left: SongCardLayout.dragHandleLeft,
                top: 13,
                child: Icon(
                  Icons.drag_indicator_rounded,
                  size: 24,
                  color: AppColors.textSecondary.withValues(alpha: 0.6),
                ),
              ),

              // Saving indicator
              if (_isSaving)
                Positioned(
                  right: 48,
                  top: 14,
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        AppColors.accent.withValues(alpha: 0.7),
                      ),
                    ),
                  ),
                ),

              // Content area with shared padding
              Padding(
                padding: EdgeInsets.only(
                  left: SongCardLayout.contentLeftPadding,
                  right: SongCardLayout.cardHorizontalPadding,
                  top: SongCardLayout.cardVerticalPadding,
                  bottom: SongCardLayout.cardVerticalPadding,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top row: title/artist left + trash right
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title/Artist block (left-aligned, expands)
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.song.title,
                                style: AppTextStyles.title3,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widget.song.artist,
                                style: AppTextStyles.callout,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        // Trash icon - fixed hit target, no rose dot
                        SizedBox(
                          width: SongCardLayout.trashIconHitSize,
                          height: SongCardLayout.trashIconHitSize,
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            iconSize: SongCardLayout.trashIconSize,
                            onPressed: widget.onDelete,
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              color: AppColors.accent,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const Spacer(),

                    // Error message
                    if (_editError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          _editError!,
                          style: const TextStyle(
                            color: AppColors.accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),

                    // Metrics row uses fixed columns to keep alignment identical across cards.
                    _buildMetricsRow(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Metrics row with fixed-width columns for deterministic alignment.
  /// - BPM: left-aligned, fixed width (placeholder "—" if null)
  /// - Duration: left-aligned, fixed width (placeholder "—" if null)
  /// - Tuning: right-aligned, trailing column
  Widget _buildMetricsRow() {
    return SizedBox(
      height: SongCardLayout.metricsRowHeight,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // BPM column (fixed width, left-aligned)
          SizedBox(
            width: SongCardLayout.bpmColWidth,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _isEditingBpm ? _buildBpmInput() : _buildBpmValue(),
            ),
          ),

          // Gutter
          const SizedBox(width: SongCardLayout.metricsGutter),

          // Duration column (fixed width, left-aligned)
          SizedBox(
            width: SongCardLayout.durationColWidth,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _isEditingDuration
                  ? _buildDurationInput()
                  : _buildDurationValue(),
            ),
          ),

          // Spacer pushes tuning to right
          const Spacer(),

          // Tuning column (fixed width, right-aligned)
          SizedBox(
            width: SongCardLayout.trailingColWidth,
            child: Align(
              alignment: Alignment.centerRight,
              child: _buildTuningBadge(),
            ),
          ),
        ],
      ),
    );
  }

  /// Builds BPM value with placeholder support and animation
  /// User can tap to edit regardless of whether BPM has a value
  Widget _buildBpmValue() {
    return AnimatedValueText(
      displayText: widget.song.formattedBpm,
      isPlaceholder: widget.song.isBpmPlaceholder,
      onTap: _isSaving ? null : _startEditingBpm,
      backgroundColor: const Color(0xFF2C2C2C),
      borderColor: widget.song.hasBpmOverride ? AppColors.accent : null,
    );
  }

  /// Builds Duration value with placeholder support and animation
  Widget _buildDurationValue() {
    // Duration always has a value (model requires it)
    final displayText = widget.song.formattedDuration;

    return AnimatedValueText(
      displayText: displayText,
      isPlaceholder: false,
      onTap: _isSaving ? null : _startEditingDuration,
      backgroundColor: const Color(0xFF2C2C2C),
      borderColor: widget.song.hasDurationOverride ? AppColors.accent : null,
    );
  }

  /// Builds the tuning badge with micro-interaction on tap
  /// NO border - filled background only, pill shape
  Widget _buildTuningBadge() {
    final tuning = widget.song.tuning;
    final shortLabel = tuningShortLabel(tuning);
    final bgColor = tuningBadgeColor(tuning);
    final textColor = tuningBadgeTextColor(bgColor);

    return GestureDetector(
      onTap: _isSaving ? null : _selectTuning,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 1.0, end: 1.0),
        duration: AppDurations.instant,
        builder: (context, value, child) {
          return Transform.scale(scale: value, child: child);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.space12,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: bgColor,
            // NO border - filled background only
            borderRadius: BorderRadius.circular(100), // Pill shape
          ),
          child: Text(
            shortLabel,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: textColor,
              height: 1,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBpmInput() {
    return Container(
      width: 80,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF2C2C2C),
        border: Border.all(
          color: SongCardLayout.inputBorderColor,
          width: SongCardLayout.inputBorderWidth,
        ),
        borderRadius: BorderRadius.circular(SongCardLayout.inputBorderRadius),
      ),
      child: TextField(
        controller: _bpmController,
        focusNode: _bpmFocus,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(3),
        ],
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFFF5F5F5),
        ),
        textAlign: TextAlign.center,
        decoration: const InputDecoration(
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          isDense: true,
        ),
        onSubmitted: (_) => _saveBpm(),
        onEditingComplete: _saveBpm,
      ),
    );
  }

  Widget _buildDurationInput() {
    return Container(
      width: 70,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF2C2C2C),
        border: Border.all(
          color: SongCardLayout.inputBorderColor,
          width: SongCardLayout.inputBorderWidth,
        ),
        borderRadius: BorderRadius.circular(SongCardLayout.inputBorderRadius),
      ),
      child: TextField(
        controller: _durationController,
        focusNode: _durationFocus,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFFF5F5F5),
        ),
        textAlign: TextAlign.center,
        decoration: const InputDecoration(
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          isDense: true,
          hintText: 'mmss',
          hintStyle: TextStyle(fontSize: 12, color: Color(0xFF888888)),
        ),
        onSubmitted: (_) => _saveDuration(),
        onEditingComplete: _saveDuration,
      ),
    );
  }
}
