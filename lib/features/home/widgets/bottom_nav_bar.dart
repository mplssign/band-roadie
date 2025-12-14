import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';

// ============================================================================
// BOTTOM NAV BAR
// Polished navigation bar with Figma-intent styling and micro-interactions.
// ============================================================================

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(
        left: Spacing.space20,
        right: Spacing.space20,
        top: Spacing.space8,
        bottom: Spacing.space8,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        border: Border(
          top: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: const [
            _NavItem(icon: Icons.home_rounded, label: 'Home', isActive: true),
            _NavItem(
              icon: Icons.queue_music_rounded,
              label: 'Setlists',
              isActive: false,
            ),
            _NavItem(
              icon: Icons.calendar_today_rounded,
              label: 'Calendar',
              isActive: false,
            ),
            _NavItem(
              icon: Icons.people_rounded,
              label: 'Band',
              isActive: false,
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isActive;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem>
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
      end: 0.9,
    ).animate(CurvedAnimation(parent: _tapController, curve: AppCurves.ease));
  }

  @override
  void dispose() {
    _tapController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    _tapController.forward();
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
      onTap: () {},
      behavior: HitTestBehavior.opaque,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: AppDurations.fast,
          curve: AppCurves.ease,
          padding: const EdgeInsets.symmetric(
            horizontal: Spacing.space12,
            vertical: Spacing.space8,
          ),
          decoration: BoxDecoration(
            color: widget.isActive ? AppColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                widget.icon,
                color: widget.isActive ? Colors.white : AppColors.textMuted,
                size: 22,
              ),
              const SizedBox(height: Spacing.space4),
              Text(
                widget.label,
                style: AppTextStyles.navLabel.copyWith(
                  color: widget.isActive ? Colors.white : AppColors.textMuted,
                  fontWeight: widget.isActive
                      ? FontWeight.w600
                      : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
