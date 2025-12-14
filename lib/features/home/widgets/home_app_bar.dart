import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';

// ============================================================================
// HOME APP BAR
// Sliver app bar with band name, menu, and actions. Figma-polished.
// ============================================================================

class HomeAppBar extends StatelessWidget {
  final String bandName;
  final VoidCallback onMenuTap;
  final VoidCallback onSignOut;

  const HomeAppBar({
    super.key,
    required this.bandName,
    required this.onMenuTap,
    required this.onSignOut,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      backgroundColor: AppColors.scaffoldBg,
      surfaceTintColor: Colors.transparent,
      pinned: true,
      floating: false,
      expandedHeight: 60,
      toolbarHeight: 60,
      leadingWidth: 56,
      leading: Padding(
        padding: const EdgeInsets.only(left: Spacing.space8),
        child: Center(
          child: _AppBarIconButton(
            icon: Icons.menu_rounded,
            onPressed: onMenuTap,
          ),
        ),
      ),
      title: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            bandName,
            style: AppTextStyles.cardTitle.copyWith(
              fontSize: 17,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 2),
          Container(
            width: 24,
            height: 3,
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
      centerTitle: true,
      actions: [
        // Sign out button
        _AppBarIconButton(icon: Icons.logout_rounded, onPressed: onSignOut),
        const SizedBox(width: Spacing.space8),
        // Notification badge
        _NotificationBadge(),
        const SizedBox(width: Spacing.space16),
      ],
    );
  }
}

/// Reusable icon button for app bar
class _AppBarIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;

  const _AppBarIconButton({required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.textMuted, size: 20),
        ),
      ),
    );
  }
}

/// Notification badge with pulse animation
class _NotificationBadge extends StatefulWidget {
  @override
  State<_NotificationBadge> createState() => _NotificationBadgeState();
}

class _NotificationBadgeState extends State<_NotificationBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.cardBgElevated,
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: AppColors.warning.withValues(
                  alpha: 0.2 * _pulseAnimation.value,
                ),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Icon(
            Icons.bolt_rounded,
            color: AppColors.warning,
            size: 20 * (0.9 + 0.1 * _pulseAnimation.value),
          ),
        );
      },
    );
  }
}
