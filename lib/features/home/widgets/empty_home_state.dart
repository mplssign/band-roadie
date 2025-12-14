import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';
import 'bottom_nav_bar.dart';
import 'empty_section_card.dart';
import 'home_app_bar.dart';
import 'quick_actions_row.dart';
import 'section_header.dart';

// ============================================================================
// EMPTY HOME STATE
// Shown when user has a band but no gigs/rehearsals scheduled.
// Features staggered entrance animations for visual polish.
// ============================================================================

class EmptyHomeState extends StatefulWidget {
  const EmptyHomeState({super.key});

  @override
  State<EmptyHomeState> createState() => _EmptyHomeStateState();
}

class _EmptyHomeStateState extends State<EmptyHomeState>
    with TickerProviderStateMixin {
  late AnimationController _entranceController;
  late List<Animation<double>> _fadeAnimations;
  late List<Animation<Offset>> _slideAnimations;

  @override
  void initState() {
    super.initState();

    _entranceController = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    );

    // Create staggered animations for 4 sections
    _fadeAnimations = List.generate(4, (index) {
      final start = index * 0.15;
      final end = (start + 0.4).clamp(0.0, 1.0);
      return Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(
          parent: _entranceController,
          curve: Interval(start, end, curve: Curves.easeOut),
        ),
      );
    });

    _slideAnimations = List.generate(4, (index) {
      final start = index * 0.15;
      final end = (start + 0.4).clamp(0.0, 1.0);
      return Tween<Offset>(
        begin: const Offset(0, 0.08),
        end: Offset.zero,
      ).animate(
        CurvedAnimation(
          parent: _entranceController,
          curve: Interval(start, end, curve: AppCurves.slideIn),
        ),
      );
    });

    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _entranceController.forward();
    });
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  Widget _buildAnimatedSection(int index, Widget child) {
    return SlideTransition(
      position: _slideAnimations[index],
      child: FadeTransition(opacity: _fadeAnimations[index], child: child),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          // App bar
          HomeAppBar(
            bandName: 'BandRoadie',
            onMenuTap: () {},
            onSignOut: () {},
          ),

          // Main content
          SliverPadding(
            padding: const EdgeInsets.symmetric(
              horizontal: Spacing.pagePadding,
            ),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: Spacing.space32),

                  // Empty hero message
                  _buildAnimatedSection(0, _EmptyHeroSection()),

                  const SizedBox(height: Spacing.space40),

                  // Rehearsal section
                  _buildAnimatedSection(
                    1,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        SectionHeader(title: 'NEXT REHEARSAL'),
                        SizedBox(height: Spacing.space12),
                        EmptySectionCard(
                          icon: Icons.music_note_rounded,
                          title: 'Nothing scheduled',
                          subtitle: 'Your drummer is probably relieved.',
                          buttonLabel: 'Schedule Rehearsal',
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: Spacing.space40),

                  // Gigs section
                  _buildAnimatedSection(
                    2,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        SectionHeader(title: 'UPCOMING GIGS'),
                        SizedBox(height: Spacing.space12),
                        EmptySectionCard(
                          icon: Icons.event_available_rounded,
                          title: 'No gigs booked',
                          subtitle: "The world clearly isn't ready yet.",
                          buttonLabel: 'Create Gig',
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: Spacing.space48),

                  // Quick actions
                  _buildAnimatedSection(
                    3,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        SectionHeader(title: 'QUICK ACTIONS'),
                        SizedBox(height: Spacing.space16),
                        QuickActionsRow(),
                      ],
                    ),
                  ),

                  const SizedBox(height: Spacing.space32),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: const BottomNavBar(),
    );
  }
}

/// Hero section for empty state with encouraging copy
class _EmptyHeroSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Spacing.space24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.accent.withValues(alpha: 0.08), AppColors.cardBg],
        ),
        borderRadius: BorderRadius.circular(Spacing.cardRadius),
        border: Border.all(
          color: AppColors.accent.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.rocket_launch_rounded,
                  color: AppColors.accent,
                  size: 24,
                ),
              ),
              const SizedBox(width: Spacing.space16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Let's get this show started!",
                      style: AppTextStyles.cardTitle.copyWith(fontSize: 18),
                    ),
                    const SizedBox(height: Spacing.space4),
                    Text(
                      'Add your first gig or rehearsal below.',
                      style: AppTextStyles.cardSubtitle,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
