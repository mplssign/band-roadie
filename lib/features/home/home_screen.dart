import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/models/gig.dart';
import '../../app/services/supabase_client.dart';
import '../bands/active_band_controller.dart';
import '../gigs/gig_controller.dart';
import 'widgets/empty_home_state.dart';
import 'widgets/empty_section_card.dart';
import 'widgets/no_band_state.dart';
import 'widgets/quick_actions_row.dart';

// ============================================================================
// HOME SCREEN
// The main dashboard. Shows different states based on band membership and gigs.
//
// STATES:
// 1. Loading — fetching bands or gigs
// 2. Error — something went wrong (with retry)
// 3. No Band — user has zero band memberships
// 4. Empty — user has a band but zero gigs
// 5. Content — user has a band and one or more gigs
//
// BAND ISOLATION: All data is fetched ONLY for the active band.
// ============================================================================

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  // TODO: Wire up rehearsals once provider is ready
  static const bool hasRehearsal = false;

  @override
  void initState() {
    super.initState();
    // Load user's bands when screen initializes
    Future.microtask(() {
      ref.read(activeBandProvider.notifier).loadUserBands();
    });
  }

  Future<void> _signOut() async {
    // Clear all state on logout
    ref.read(activeBandProvider.notifier).reset();
    ref.read(gigProvider.notifier).reset();
    await supabase.auth.signOut();
  }

  void _retry() {
    ref.read(activeBandProvider.notifier).loadUserBands();
  }

  @override
  Widget build(BuildContext context) {
    final bandState = ref.watch(activeBandProvider);
    final gigState = ref.watch(gigProvider);

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
      stateWidget = _buildContentScreen(bandState, gigState);
    }

    // Wrap in AnimatedSwitcher for smooth state transitions
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 400),
      switchInCurve: Curves.easeOutBack,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, animation) {
        // Slide up + fade for entering widget
        final slideAnimation =
            Tween<Offset>(
              begin: const Offset(0.0, 0.05),
              end: Offset.zero,
            ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
            );

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
      backgroundColor: const Color(0xFF1E1E1E),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFFF43F5E)),
            const SizedBox(height: 24),
            Text(
              message,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Error screen with humor and retry button
  Widget _buildErrorScreen(String title, String details) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E1E1E),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Sad guitar icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFF43F5E).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.error_outline,
                  size: 40,
                  color: Color(0xFFF43F5E),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Don\'t worry, these things happen.\nThe show must go on.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _retry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
              ),
              const SizedBox(height: 16),
              // Debug info (collapsible)
              ExpansionTile(
                title: Text(
                  'Technical stuff',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4),
                    fontSize: 12,
                  ),
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      details,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.4),
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Main content screen with gigs
  Widget _buildContentScreen(ActiveBandState bandState, GigState gigState) {
    final activeBand = bandState.activeBand;
    final potentialGig = gigState.nextPotentialGig;
    final upcomingGig = gigState.nextConfirmedGig;

    return Scaffold(
      backgroundColor: const Color(0xFF1E1E1E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B).withValues(alpha: 0.5),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: Colors.white),
          onPressed: () {},
        ),
        // Show active band name in title
        title: Text(
          activeBand?.name ?? 'BandRoadie',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        actions: [
          // Logout button (temporary)
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            onPressed: _signOut,
            tooltip: 'Logout',
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF334155),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.bolt, color: Color(0xFFF59E0B), size: 20),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFFF43F5E),
        onRefresh: () => ref.read(gigProvider.notifier).refresh(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),

                // Potential gig card (if present)
                if (potentialGig != null) ...[
                  _PotentialGigCardWithData(gig: potentialGig),
                  const SizedBox(height: 24),
                ],

                // Rehearsal section (TODO: wire to real data)
                if (hasRehearsal)
                  const _NextRehearsalCard()
                else
                  const EmptySectionCard(
                    icon: Icons.event_busy,
                    title: 'No Rehearsal Scheduled',
                    subtitle: 'Get the band together and lock in a time.',
                    buttonLabel: '+ Schedule Rehearsal',
                  ),

                const SizedBox(height: 36),

                // Upcoming Gigs section
                const Text(
                  'Upcoming Gigs',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.45,
                  ),
                ),
                const SizedBox(height: 12),

                if (upcomingGig != null)
                  _ConfirmedGigCardWithData(gig: upcomingGig)
                else
                  const EmptySectionCard(
                    icon: Icons.event_available,
                    title: 'No upcoming gigs.',
                    subtitle:
                        'The world clearly isn\'t ready. Add a gig when it is.',
                    buttonLabel: '+ Create Gig',
                  ),

                const SizedBox(height: 36),

                // Quick actions
                const QuickActionsRow(),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: const _BottomNavBar(),
    );
  }
}

// ========================================
// POTENTIAL GIG CARD (with real data)
// ========================================

class _PotentialGigCardWithData extends StatelessWidget {
  final Gig gig;

  const _PotentialGigCardWithData({required this.gig});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF43F5E).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF43F5E), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF43F5E).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'NEEDS RESPONSE',
                  style: TextStyle(
                    color: Color(0xFFF43F5E),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            gig.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            gig.location,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _formatDate(gig.date),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            gig.timeRange,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),
          // RSVP buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    // TODO: Implement RSVP no
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.3),
                    ),
                  ),
                  child: const Text('Can\'t Make It'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    // TODO: Implement RSVP yes
                  },
                  child: const Text('I\'m In'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const months = [
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
    return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

// ========================================
// CONFIRMED GIG CARD (with real data)
// ========================================

class _ConfirmedGigCardWithData extends StatelessWidget {
  final Gig gig;

  const _ConfirmedGigCardWithData({required this.gig});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2563EB), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'CONFIRMED',
                  style: TextStyle(
                    color: Color(0xFF22C55E),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Venue name
          Text(
            gig.name,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.45,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            gig.location,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          ),
          const SizedBox(height: 8),
          // Date and time
          Text(
            _formatDate(gig.date),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            gig.timeRange,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

// ========================================
// REHEARSAL CARD (placeholder - TODO: wire to real data)
// ========================================

class _NextRehearsalCard extends StatelessWidget {
  const _NextRehearsalCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF9333EA)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF94A3B8), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Next Rehearsal',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.45,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Friday Dec 5 • 6:00 PM',
            style: TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.43,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.location_on_outlined,
                color: Colors.white,
                size: 16,
              ),
              const SizedBox(width: 4),
              const Text(
                'The Clubhouse',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w400,
                  letterSpacing: -0.31,
                ),
              ),
              const Spacer(),
              const Text(
                'Setlist',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w400,
                  letterSpacing: -0.31,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF43F5E),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'New Songs',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.08,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ========================================
// BOTTOM NAV BAR
// ========================================

class _BottomNavBar extends StatelessWidget {
  const _BottomNavBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 68,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(color: Color(0xFF1E293B)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: const [
          _NavItem(icon: Icons.home, label: 'Dashboard', isActive: true),
          _NavItem(icon: Icons.queue_music, label: 'Setlists', isActive: false),
          _NavItem(
            icon: Icons.calendar_today,
            label: 'Calendar',
            isActive: false,
          ),
          _NavItem(icon: Icons.people, label: 'Members', isActive: false),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFFF43F5E) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: const Color(0xFFF8FAFC), size: 20),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFFF8FAFC),
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }
}
