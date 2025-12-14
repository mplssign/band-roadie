import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/models/gig.dart';
import '../../../app/theme/design_tokens.dart';
import '../../gigs/gig_controller.dart';

// ============================================================================
// POTENTIAL GIG CARD
// Card for a potential gig that needs RSVP. Features a subtle pulse animation
// to convey urgency and rubberband entrance for playful feel.
// ============================================================================

class PotentialGigCard extends ConsumerStatefulWidget {
  final Gig gig;

  const PotentialGigCard({super.key, required this.gig});

  @override
  ConsumerState<PotentialGigCard> createState() => _PotentialGigCardState();
}

class _PotentialGigCardState extends ConsumerState<PotentialGigCard>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late AnimationController _entranceController;
  late Animation<double> _entranceScale;
  late Animation<Offset> _entranceSlide;
  bool _isResponding = false;

  @override
  void initState() {
    super.initState();

    // Pulse animation for urgency
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Rubberband entrance animation
    _entranceController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    _entranceScale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _entranceController, curve: AppCurves.rubberband),
    );

    _entranceSlide =
        Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _entranceController,
            curve: AppCurves.slideIn,
          ),
        );

    Future.delayed(const Duration(milliseconds: 50), () {
      if (mounted) _entranceController.forward();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  Future<void> _handleRsvp(bool attending) async {
    if (_isResponding) return;
    setState(() => _isResponding = true);

    try {
      if (attending) {
        await ref.read(gigProvider.notifier).rsvpYes(widget.gig.id);
      } else {
        await ref.read(gigProvider.notifier).rsvpNo(widget.gig.id);
      }
    } finally {
      if (mounted) {
        setState(() => _isResponding = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final gig = widget.gig;

    return SlideTransition(
      position: _entranceSlide,
      child: ScaleTransition(
        scale: _entranceScale,
        child: AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            final pulseValue = _pulseAnimation.value;

            return Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Spacing.cardRadius),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.cardBg,
                    Color.lerp(
                      AppColors.cardBg,
                      AppColors.accent.withValues(alpha: 0.12),
                      pulseValue * 0.4,
                    )!,
                  ],
                ),
                border: Border.all(
                  color: Color.lerp(
                    AppColors.accent.withValues(alpha: 0.3),
                    AppColors.accent.withValues(alpha: 0.6),
                    pulseValue * 0.5,
                  )!,
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.accent.withValues(
                      alpha: 0.08 + pulseValue * 0.08,
                    ),
                    blurRadius: 20 + pulseValue * 12,
                    spreadRadius: pulseValue * 4,
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(Spacing.space20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Urgency badge with glow
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: Spacing.space12,
                        vertical: Spacing.space6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(Spacing.chipRadius),
                        border: Border.all(
                          color: AppColors.accent.withValues(alpha: 0.3),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accent.withValues(
                              alpha: 0.15 * pulseValue,
                            ),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.notifications_active_rounded,
                            size: 14,
                            color: AppColors.accent,
                          ),
                          const SizedBox(width: Spacing.space6),
                          Text(
                            'HEY! ARE YOU IN?',
                            style: AppTextStyles.badge.copyWith(
                              color: AppColors.accent,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: Spacing.space16),

                    // Gig name
                    Text(
                      gig.name,
                      style: AppTextStyles.cardTitle.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),

                    const SizedBox(height: Spacing.space12),

                    // Location row
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 16,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: Spacing.space6),
                        Expanded(
                          child: Text(
                            gig.location,
                            style: AppTextStyles.cardSubtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: Spacing.space6),

                    // Date row
                    Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          size: 16,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: Spacing.space6),
                        Text(
                          _formatDate(gig.date),
                          style: AppTextStyles.cardSubtitle,
                        ),
                      ],
                    ),

                    const SizedBox(height: Spacing.space24),

                    // RSVP buttons
                    Row(
                      children: [
                        Expanded(
                          child: _RsvpButton(
                            label: "Can't Make It",
                            isOutlined: true,
                            isLoading: false,
                            onPressed: _isResponding
                                ? null
                                : () => _handleRsvp(false),
                          ),
                        ),
                        const SizedBox(width: Spacing.space12),
                        Expanded(
                          flex: 2,
                          child: _RsvpButton(
                            label: "I'm In!",
                            emoji: '🤘',
                            isOutlined: false,
                            isLoading: _isResponding,
                            onPressed: _isResponding
                                ? null
                                : () => _handleRsvp(true),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = date.difference(now).inDays;

    if (difference == 0) {
      return 'Today — better not flake!';
    } else if (difference == 1) {
      return 'Tomorrow';
    } else if (difference < 7) {
      return 'In $difference days';
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
      return '${months[date.month - 1]} ${date.day}';
    }
  }
}

/// RSVP button with micro-interaction
class _RsvpButton extends StatefulWidget {
  final String label;
  final String? emoji;
  final bool isOutlined;
  final bool isLoading;
  final VoidCallback? onPressed;

  const _RsvpButton({
    required this.label,
    this.emoji,
    required this.isOutlined,
    required this.isLoading,
    this.onPressed,
  });

  @override
  State<_RsvpButton> createState() => _RsvpButtonState();
}

class _RsvpButtonState extends State<_RsvpButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _tapController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      duration: AppDurations.fast,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(parent: _tapController, curve: AppCurves.ease));
  }

  @override
  void dispose() {
    _tapController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    if (widget.onPressed != null) _tapController.forward();
  }

  void _handleTapUp(TapUpDetails _) {
    _tapController.reverse();
  }

  void _handleTapCancel() {
    _tapController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: widget.isOutlined
            ? OutlinedButton(
                onPressed: widget.onPressed,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textSecondary,
                  side: BorderSide(color: AppColors.borderMuted),
                  padding: const EdgeInsets.symmetric(
                    vertical: Spacing.space14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                  ),
                ),
                child: Text(
                  widget.label,
                  style: AppTextStyles.button.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              )
            : FilledButton(
                onPressed: widget.onPressed,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    vertical: Spacing.space14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                  ),
                ),
                child: widget.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            widget.label,
                            style: AppTextStyles.button.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          if (widget.emoji != null) ...[
                            const SizedBox(width: Spacing.space6),
                            Text(
                              widget.emoji!,
                              style: const TextStyle(fontSize: 16),
                            ),
                          ],
                        ],
                      ),
              ),
      ),
    );
  }
}
