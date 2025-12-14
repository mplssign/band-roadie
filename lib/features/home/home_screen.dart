import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/services/supabase_client.dart';
import '../../app/theme/design_tokens.dart';
import '../bands/active_band_controller.dart';
import '../gigs/gig_controller.dart';
import '../rehearsals/rehearsal_controller.dart';
import 'widgets/bottom_nav_bar.dart';
import 'widgets/confirmed_gig_card.dart';
import 'widgets/empty_home_state.dart';
import 'widgets/empty_section_card.dart';
import 'widgets/home_app_bar.dart';
import 'widgets/no_band_state.dart';
import 'widgets/potential_gig_card.dart';
import 'widgets/quick_actions_row.dart';
import 'widgets/rehearsal_card.dart';
import 'widgets/section_header.dart';

// ============================================================================
// HOME SCREEN
// The main dashboard. Shows different states based on band membership and gigs.
//
// STATES:
// 1. Loading — fetching bands or gigs
// 2. Error — something went wrong (with retry)
// 3. No Band — user has zero band memberships
// 4. Empty — user has a band but zero gigs/rehearsals
// 5. Content — user has a band with data to show
//
// BAND ISOLATION: All data is fetched ONLY for the active band.
// ============================================================================

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with TickerProviderStateMixin {
  late AnimationController _entranceController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    // Entrance animation controller
    _entranceController = AnimationController(
      duration: AppDurations.entrance,
      vsync: this,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: AppCurves.ease,
    );

    _slideAnimation =
        Tween<Offset>(begin: const Offset(0, 0.02), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _entranceController,
            curve: AppCurves.slideIn,
          ),
        );

    // Load user's bands when screen initializes
    Future.microtask(() {
      ref.read(activeBandProvider.notifier).loadUserBands();
    });

    // Start entrance animation
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _entranceController.forward();
    });
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  Future<void> _signOut() async {
    ref.read(activeBandProvider.notifier).reset();
    ref.read(gigProvider.notifier).reset();
    ref.read(rehearsalProvider.notifier).reset();
    await supabase.auth.signOut();
  }

  void _retry() {
    ref.read(activeBandProvider.notifier).loadUserBands();
  }

  @override
  Widget build(BuildContext context) {
    final bandState = ref.watch(activeBandProvider);
    final gigState = ref.watch(gigProvider);
    final rehearsalState = ref.watch(rehearsalProvider);
    final hasRehearsal = rehearsalState.hasUpcomingRehearsal;

    // Determine which state widget to show
    final Widget stateWidget;
    final String stateKey;

    if (bandState.isLoading) {
      stateKey = 'loading-bands';
      stateWidget = _buildLoadingScreen('Tuning up...');
    } else if (bandState.error != null) {
      stateKey = 'error-bands';
      stateWidget = _buildErrorScreen(
        'The roadie tripped over a cable.',
        bandState.error!,
      );
    } else if (!bandState.hasBands) {
      stateKey = 'no-band';
      stateWidget = const NoBandState();
    } else if (gigState.isLoading) {
      stateKey = 'loading-gigs';
      stateWidget = _buildLoadingScreen('Loading the setlist...');
    } else if (gigState.error != null) {
      stateKey = 'error-gigs';
      stateWidget = _buildErrorScreen(
        'Couldn\'t load your gigs.',
        gigState.error!,
      );
    } else if (!gigState.hasGigs && !hasRehearsal) {
      stateKey = 'empty';
      stateWidget = const EmptyHomeState();
    } else {
      stateKey = 'content';
      stateWidget = _buildContentScreen(bandState, gigState, rehearsalState);
    }

    // Wrap in AnimatedSwitcher for smooth state transitions
    return AnimatedSwitcher(
      duration: AppDurations.medium,
      switchInCurve: AppCurves.ease,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, animation) {
        final slideAnimation = Tween<Offset>(
          begin: const Offset(0.0, 0.02),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: animation, curve: AppCurves.slideIn));

        return SlideTransition(
          position: slideAnimation,
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      child: KeyedSubtree(key: ValueKey(stateKey), child: stateWidget),
    );
  }

  /// Loading screen with roadie-style message
  Widget _buildLoadingScreen(String message) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Animated loading indicator
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.8, end: 1.0),
              duration: const Duration(milliseconds: 800),
              curve: Curves.easeInOut,
              builder: (context, value, child) {
                return Transform.scale(scale: value, child: child);
              },
              child: Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.accentMuted,
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      color: AppColors.accent,
                      strokeWidth: 3,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: Spacing.space24),
            Text(
              message,
              style: AppTextStyles.body.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  /// Error screen with humor and retry button
  Widget _buildErrorScreen(String title, String details) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Spacing.space32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Error icon with glow effect
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: AppColors.accentMuted,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.2),
                      blurRadius: 24,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.music_off_rounded,
                  size: 40,
                  color: AppColors.accent,
                ),
              ),
              const SizedBox(height: Spacing.space32),
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTextStyles.displayMedium,
              ),
              const SizedBox(height: Spacing.space12),
              Text(
                'Don\'t worry, even the best roadies\ndrop a cable sometimes.',
                textAlign: TextAlign.center,
                style: AppTextStyles.body,
              ),
              const SizedBox(height: Spacing.space40),
              SizedBox(
                width: 180,
                child: FilledButton.icon(
                  onPressed: _retry,
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  label: const Text('Try Again'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: Spacing.space24,
                      vertical: Spacing.space16,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Spacing.buttonRadius),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: Spacing.space24),
              // Debug info (subtle)
              GestureDetector(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    backgroundColor: AppColors.cardBg,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(Spacing.cardRadius),
                      ),
                    ),
                    builder: (context) => Padding(
                      padding: const EdgeInsets.all(Spacing.space24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Technical Details',
                            style: AppTextStyles.cardTitle,
                          ),
                          const SizedBox(height: Spacing.space12),
                          Text(
                            details,
                            style: AppTextStyles.label.copyWith(
                              fontFamily: 'monospace',
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: Spacing.space24),
                        ],
                      ),
                    ),
                  );
                },
                child: Text(
                  'View technical stuff',
                  style: AppTextStyles.label.copyWith(
                    color: AppColors.textDisabled,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Main content screen with gigs and rehearsals
  Widget _buildContentScreen(
    ActiveBandState bandState,
    GigState gigState,
    RehearsalState rehearsalState,
  ) {
    final activeBand = bandState.activeBand;
    final potentialGig = gigState.nextPotentialGig;
    final upcomingGig = gigState.nextConfirmedGig;
    final nextRehearsal = rehearsalState.nextRehearsal;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: RefreshIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.cardBg,
        onRefresh: () async {
          await ref.read(gigProvider.notifier).refresh();
          await ref.read(rehearsalProvider.notifier).refresh();
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            // App bar
            HomeAppBar(
              bandName: activeBand?.name ?? 'BandRoadie',
              onMenuTap: () {},
              onSignOut: _signOut,
            ),

            // Main content with staggered entrance
            SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: Spacing.pagePadding,
              ),
              sliver: SliverToBoxAdapter(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: Spacing.space24),

                        // Potential gig card (urgent, needs response)
                        if (potentialGig != null) ...[
                          _AnimatedCardEntrance(
                            delay: const Duration(milliseconds: 0),
                            child: PotentialGigCard(gig: potentialGig),
                          ),
                          const SizedBox(height: Spacing.space24),
                        ],

                        // Next rehearsal section
                        const SectionHeader(title: 'NEXT REHEARSAL'),
                        const SizedBox(height: Spacing.space12),
                        _AnimatedCardEntrance(
                          delay: const Duration(milliseconds: 80),
                          child: nextRehearsal != null
                              ? RehearsalCard(rehearsal: nextRehearsal)
                              : const EmptySectionCard(
                                  icon: Icons.music_note_rounded,
                                  title: 'Nothing scheduled',
                                  subtitle:
                                      'Your drummer is probably relieved.',
                                  buttonLabel: 'Schedule Rehearsal',
                                ),
                        ),

                        const SizedBox(height: Spacing.space40),

                        // Upcoming gigs section
                        const SectionHeader(title: 'UPCOMING GIGS'),
                        const SizedBox(height: Spacing.space12),
                        _AnimatedCardEntrance(
                          delay: const Duration(milliseconds: 160),
                          child: upcomingGig != null
                              ? ConfirmedGigCard(gig: upcomingGig)
                              : const EmptySectionCard(
                                  icon: Icons.event_available_rounded,
                                  title: 'No gigs booked',
                                  subtitle:
                                      'The world clearly isn\'t ready yet.',
                                  buttonLabel: 'Create Gig',
                                ),
                        ),

                        const SizedBox(height: Spacing.space48),

                        // Quick actions
                        const SectionHeader(title: 'QUICK ACTIONS'),
                        const SizedBox(height: Spacing.space16),
                        _AnimatedCardEntrance(
                          delay: const Duration(milliseconds: 240),
                          child: const QuickActionsRow(),
                        ),

                        // Bottom padding for nav bar
                        const SizedBox(height: Spacing.space32),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const BottomNavBar(),
    );
  }
}

// ============================================================================
// ANIMATED CARD ENTRANCE
// Staggered fade + slide animation for cards
// ============================================================================

class _AnimatedCardEntrance extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const _AnimatedCardEntrance({required this.child, required this.delay});

  @override
  State<_AnimatedCardEntrance> createState() => _AnimatedCardEntranceState();
}

class _AnimatedCardEntranceState extends State<_AnimatedCardEntrance>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: AppDurations.medium,
      vsync: this,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: AppCurves.ease,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: AppCurves.slideIn));

    Future.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(position: _slideAnimation, child: widget.child),
    );
  }
}
