import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../app/models/rehearsal.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../app/utils/time_formatter.dart';

// ============================================================================
// REHEARSAL CARD
// Figma: 361x111px, radius 16, border 1px gray-400 (#9ca3af)
// Gradient fill: blue-600 (#2563EB) to purple-600 (#9333EA) - ANIMATED
// "Next Rehearsal" title, date/time, location with pin, "Setlist" link,
// "New Songs" chip (92x32, radius 16, accent bg)
// ============================================================================

class RehearsalCard extends StatefulWidget {
  final Rehearsal rehearsal;
  final VoidCallback? onTap;

  const RehearsalCard({super.key, required this.rehearsal, this.onTap});

  @override
  State<RehearsalCard> createState() => _RehearsalCardState();
}

class _RehearsalCardState extends State<RehearsalCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _gradientController;
  late Animation<Alignment> _beginAlignment;
  late Animation<Alignment> _endAlignment;

  @override
  void initState() {
    super.initState();
    _gradientController = AnimationController(
      duration: const Duration(seconds: 6),
      vsync: this,
    )..repeat(reverse: true);

    _beginAlignment =
        TweenSequence<Alignment>([
          TweenSequenceItem(
            tween: Tween(begin: Alignment.centerLeft, end: Alignment.topLeft),
            weight: 1,
          ),
          TweenSequenceItem(
            tween: Tween(begin: Alignment.topLeft, end: Alignment.topCenter),
            weight: 1,
          ),
        ]).animate(
          CurvedAnimation(parent: _gradientController, curve: Curves.easeInOut),
        );

    _endAlignment =
        TweenSequence<Alignment>([
          TweenSequenceItem(
            tween: Tween(
              begin: Alignment.centerRight,
              end: Alignment.bottomRight,
            ),
            weight: 1,
          ),
          TweenSequenceItem(
            tween: Tween(
              begin: Alignment.bottomRight,
              end: Alignment.bottomCenter,
            ),
            weight: 1,
          ),
        ]).animate(
          CurvedAnimation(parent: _gradientController, curve: Curves.easeInOut),
        );
  }

  @override
  void dispose() {
    _gradientController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap ?? () {},
      child: AnimatedBuilder(
        animation: _gradientController,
        builder: (context, child) {
          return Container(
            height: Spacing.rehearsalCardHeight, // 111px
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: _beginAlignment.value,
                end: _endAlignment.value,
                colors: const [
                  Color(0xFF2563EB), // blue-600
                  Color(0xFF9333EA), // purple-600
                ],
              ),
              borderRadius: BorderRadius.circular(Spacing.cardRadius), // 16px
              border: Border.all(
                color: const Color(0xFF9CA3AF), // gray-400
                width: 1,
              ),
            ),
            padding: const EdgeInsets.all(Spacing.space16),
            child: child,
          );
        },
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title "Next Rehearsal"
                  Text(
                    'Next Rehearsal',
                    style: GoogleFonts.ubuntu(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.23,
                      color: Colors.white,
                    ),
                  ),

                  const SizedBox(height: Spacing.space8),

                  // Date and time
                  Text(
                    _formatDateAndTime(widget.rehearsal),
                    style: AppTextStyles.callout.copyWith(
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),

                  const Spacer(),

                  // Location row with pin icon
                  Row(
                    children: [
                      Icon(
                        Icons.location_on,
                        size: 14,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          widget.rehearsal.location,
                          style: AppTextStyles.footnote.copyWith(
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Right content - Setlist label and New Songs pill in a row at bottom
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Setlist label + New Songs chip in a row
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // "Setlist" label (no underline, matches pill font size)
                    Text(
                      'Setlist',
                      style: AppTextStyles.footnote.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    // "New Songs" chip
                    Container(
                      width: 92,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(
                          Spacing.chipRadius,
                        ), // 16px
                      ),
                      child: Center(
                        child: Text(
                          'New Songs',
                          style: AppTextStyles.footnote.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Format the date and time using the actual startTime/endTime strings.
  /// Uses TimeFormatter to ensure consistency with Edit drawer.
  String _formatDateAndTime(Rehearsal rehearsal) {
    final date = rehearsal.date;
    final days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    final months = [
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

    final dayName = days[date.weekday - 1];
    final monthName = months[date.month - 1];

    // Parse the start time using shared TimeFormatter
    final parsed = TimeFormatter.parse(rehearsal.startTime);
    final formattedTime = parsed.format();

    if (kDebugMode) {
      debugPrint(
        '[RehearsalCard] id=${rehearsal.id}, raw="${rehearsal.startTime}", formatted="$formattedTime"',
      );
    }

    return '$dayName $monthName ${date.day} • $formattedTime';
  }
}
