import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';

// ============================================================================
// QUICK ACTIONS ROW
// Horizontal row of action chips with Figma polish and hover states.
// ============================================================================

class QuickActionsRow extends StatelessWidget {
  const QuickActionsRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: Spacing.space12,
      runSpacing: Spacing.space12,
      children: [
        _QuickActionChip(
          icon: Icons.music_note_rounded,
          label: 'Schedule Rehearsal',
          onPressed: () {},
        ),
        _QuickActionChip(
          icon: Icons.queue_music_rounded,
          label: 'Create Setlist',
          onPressed: () {},
        ),
        _QuickActionChip(
          icon: Icons.event_rounded,
          label: 'Add Gig',
          onPressed: () {},
        ),
        _QuickActionChip(
          icon: Icons.person_add_rounded,
          label: 'Invite Member',
          onPressed: () {},
        ),
      ],
    );
  }
}

class _QuickActionChip extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  const _QuickActionChip({
    required this.icon,
    required this.label,
    this.onPressed,
  });

  @override
  State<_QuickActionChip> createState() => _QuickActionChipState();
}

class _QuickActionChipState extends State<_QuickActionChip>
    with SingleTickerProviderStateMixin {
  late AnimationController _hoverController;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _hoverController = AnimationController(
      duration: AppDurations.fast,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.96,
    ).animate(CurvedAnimation(parent: _hoverController, curve: AppCurves.ease));
  }

  @override
  void dispose() {
    _hoverController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    setState(() => _isPressed = true);
    _hoverController.forward();
  }

  void _handleTapUp(TapUpDetails _) {
    setState(() => _isPressed = false);
    _hoverController.reverse();
  }

  void _handleTapCancel() {
    setState(() => _isPressed = false);
    _hoverController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: widget.onPressed ?? () {},
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: AppDurations.fast,
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.space16,
            vertical: Spacing.space12,
          ),
          decoration: BoxDecoration(
            color: _isPressed ? AppColors.cardBgElevated : AppColors.cardBg,
            borderRadius: BorderRadius.circular(Spacing.buttonRadius),
            border: Border.all(
              color: _isPressed
                  ? AppColors.accent.withValues(alpha: 0.4)
                  : AppColors.borderSubtle,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                widget.icon,
                size: 18,
                color: _isPressed ? AppColors.accent : AppColors.textMuted,
              ),
              const SizedBox(width: Spacing.space8),
              Text(
                widget.label,
                style: AppTextStyles.label.copyWith(
                  color: _isPressed
                      ? AppColors.textPrimary
                      : AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
