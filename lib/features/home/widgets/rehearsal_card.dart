import 'package:flutter/material.dart';

import '../../../app/models/rehearsal.dart';
import '../../../app/theme/design_tokens.dart';

// ============================================================================
// REHEARSAL CARD
// Card showing the next upcoming rehearsal with Figma-polished layout.
// Features a gradient accent bar and interactive feedback.
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
  late AnimationController _tapController;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      duration: AppDurations.fast,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.98,
    ).animate(CurvedAnimation(parent: _tapController, curve: AppCurves.ease));
  }

  @override
  void dispose() {
    _tapController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    setState(() => _isPressed = true);
    _tapController.forward();
  }

  void _handleTapUp(TapUpDetails _) {
    setState(() => _isPressed = false);
    _tapController.reverse();
  }

  void _handleTapCancel() {
    setState(() => _isPressed = false);
    _tapController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: widget.onTap ?? () {},
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: AppDurations.fast,
          decoration: BoxDecoration(
            color: _isPressed ? AppColors.cardBgElevated : AppColors.cardBg,
            borderRadius: BorderRadius.circular(Spacing.cardRadius),
            border: Border.all(
              color: _isPressed
                  ? const Color(0xFF3B82F6).withValues(alpha: 0.3)
                  : AppColors.borderSubtle,
              width: 1,
            ),
            boxShadow: _isPressed
                ? [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                      blurRadius: 12,
                      spreadRadius: 2,
                    ),
                  ]
                : null,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Spacing.cardRadius),
            child: Row(
              children: [
                // Gradient accent bar
                Container(
                  width: 6,
                  height: 130,
                  decoration: const BoxDecoration(
                    gradient: AppColors.rehearsalGradient,
                  ),
                ),

                // Content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(Spacing.space16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: Spacing.space8,
                            vertical: Spacing.space4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF3B82F6,
                            ).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(
                              Spacing.chipRadius,
                            ),
                          ),
                          child: Text(
                            'PRACTICE TIME',
                            style: AppTextStyles.badge.copyWith(
                              color: const Color(0xFF3B82F6),
                            ),
                          ),
                        ),

                        const SizedBox(height: Spacing.space12),

                        // Title
                        Text(
                          'Band Rehearsal',
                          style: AppTextStyles.cardTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),

                        const SizedBox(height: Spacing.space10),

                        // Date and time row
                        Row(
                          children: [
                            Icon(
                              Icons.access_time_rounded,
                              size: 15,
                              color: AppColors.textMuted,
                            ),
                            const SizedBox(width: Spacing.space6),
                            Text(
                              _formatDateTime(widget.rehearsal.date),
                              style: AppTextStyles.cardSubtitle.copyWith(
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),

                        // Location
                        const SizedBox(height: Spacing.space4),
                        Row(
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 15,
                              color: AppColors.textMuted,
                            ),
                            const SizedBox(width: Spacing.space6),
                            Expanded(
                              child: Text(
                                widget.rehearsal.location,
                                style: AppTextStyles.cardSubtitle.copyWith(
                                  fontSize: 13,
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
                ),

                // Chevron
                Padding(
                  padding: const EdgeInsets.only(right: Spacing.space16),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: _isPressed
                        ? AppColors.textSecondary
                        : AppColors.textMuted,
                    size: 24,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatDateTime(DateTime date) {
    final now = DateTime.now();
    final difference = date.difference(now).inDays;

    String dayPart;
    if (difference == 0) {
      dayPart = 'Today';
    } else if (difference == 1) {
      dayPart = 'Tomorrow';
    } else if (difference < 7) {
      final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      dayPart = days[date.weekday - 1];
    } else {
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
      dayPart = '${months[date.month - 1]} ${date.day}';
    }

    final hour = date.hour > 12
        ? date.hour - 12
        : (date.hour == 0 ? 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minute = date.minute.toString().padLeft(2, '0');

    return '$dayPart at $hour:$minute $period';
  }
}
