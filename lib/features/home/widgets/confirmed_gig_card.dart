import 'package:flutter/material.dart';

import '../../../app/models/gig.dart';
import '../../../app/theme/design_tokens.dart';

// ============================================================================
// CONFIRMED GIG CARD
// Card showing a confirmed upcoming gig with Figma-polished layout.
// Features date highlight, status indicator, and tap interaction.
// ============================================================================

class ConfirmedGigCard extends StatefulWidget {
  final Gig gig;
  final VoidCallback? onTap;

  const ConfirmedGigCard({super.key, required this.gig, this.onTap});

  @override
  State<ConfirmedGigCard> createState() => _ConfirmedGigCardState();
}

class _ConfirmedGigCardState extends State<ConfirmedGigCard>
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
    final gig = widget.gig;

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
                  ? AppColors.success.withValues(alpha: 0.3)
                  : AppColors.borderSubtle,
              width: 1,
            ),
            boxShadow: _isPressed
                ? [
                    BoxShadow(
                      color: AppColors.success.withValues(alpha: 0.1),
                      blurRadius: 12,
                      spreadRadius: 2,
                    ),
                  ]
                : null,
          ),
          child: Padding(
            padding: const EdgeInsets.all(Spacing.space16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Date box with gradient
                Container(
                  width: 60,
                  padding: const EdgeInsets.symmetric(
                    vertical: Spacing.space12,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.accent.withValues(alpha: 0.15),
                        AppColors.accent.withValues(alpha: 0.08),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    border: Border.all(
                      color: AppColors.accent.withValues(alpha: 0.2),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _getMonthAbbr(gig.date.month),
                        style: AppTextStyles.badge.copyWith(
                          color: AppColors.accent,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        gig.date.day.toString(),
                        style: AppTextStyles.displayMedium.copyWith(
                          color: AppColors.accent,
                          fontSize: 24,
                          height: 1.1,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: Spacing.space16),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Confirmed badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: Spacing.space8,
                          vertical: Spacing.space4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(
                            Spacing.chipRadius,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.check_circle_rounded,
                              size: 12,
                              color: AppColors.success,
                            ),
                            const SizedBox(width: Spacing.space4),
                            Text(
                              'LOCKED IN',
                              style: AppTextStyles.badge.copyWith(
                                color: AppColors.success,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: Spacing.space10),

                      // Gig name
                      Text(
                        gig.name,
                        style: AppTextStyles.cardTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      const SizedBox(height: Spacing.space10),

                      // Location row
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
                              gig.location,
                              style: AppTextStyles.cardSubtitle.copyWith(
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: Spacing.space4),

                      // Time row
                      Row(
                        children: [
                          Icon(
                            Icons.access_time_rounded,
                            size: 15,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(width: Spacing.space6),
                          Text(
                            _formatTime(gig.date),
                            style: AppTextStyles.cardSubtitle.copyWith(
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Chevron
                Padding(
                  padding: const EdgeInsets.only(top: Spacing.space8),
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

  String _getMonthAbbr(int month) {
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    return months[month - 1];
  }

  String _formatTime(DateTime date) {
    final hour = date.hour > 12
        ? date.hour - 12
        : (date.hour == 0 ? 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute $period';
  }
}
