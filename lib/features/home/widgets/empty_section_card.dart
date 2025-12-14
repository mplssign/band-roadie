import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';

// ============================================================================
// EMPTY SECTION CARD
// Reusable card for empty states with animated CTA button and Figma polish.
// ============================================================================

class EmptySectionCard extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String buttonLabel;
  final VoidCallback? onButtonPressed;

  const EmptySectionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.buttonLabel,
    this.onButtonPressed,
  });

  @override
  State<EmptySectionCard> createState() => _EmptySectionCardState();
}

class _EmptySectionCardState extends State<EmptySectionCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _buttonController;
  late Animation<double> _buttonScale;

  @override
  void initState() {
    super.initState();
    _buttonController = AnimationController(
      duration: AppDurations.medium,
      vsync: this,
    );
    _buttonScale = Tween<double>(begin: 0.9, end: 1.0).animate(
      CurvedAnimation(parent: _buttonController, curve: AppCurves.rubberband),
    );
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _buttonController.forward();
    });
  }

  @override
  void dispose() {
    _buttonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Spacing.space24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(Spacing.cardRadius),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: Column(
        children: [
          // Icon with subtle background
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(widget.icon, color: AppColors.textMuted, size: 28),
          ),

          const SizedBox(height: Spacing.space16),

          // Title
          Text(
            widget.title,
            style: AppTextStyles.cardTitle.copyWith(fontSize: 17),
          ),

          const SizedBox(height: Spacing.space8),

          // Subtitle
          Text(
            widget.subtitle,
            textAlign: TextAlign.center,
            style: AppTextStyles.cardSubtitle.copyWith(
              color: AppColors.textMuted,
            ),
          ),

          const SizedBox(height: Spacing.space20),

          // CTA button with scale animation
          ScaleTransition(
            scale: _buttonScale,
            child: OutlinedButton(
              onPressed: widget.onButtonPressed ?? () {},
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.accent,
                padding: const EdgeInsets.symmetric(
                  horizontal: Spacing.space20,
                  vertical: Spacing.space12,
                ),
                side: BorderSide(
                  color: AppColors.accent.withValues(alpha: 0.5),
                  width: 1.5,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.add_rounded, size: 18),
                  const SizedBox(width: Spacing.space6),
                  Text(
                    widget.buttonLabel,
                    style: AppTextStyles.button.copyWith(
                      color: AppColors.accent,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
