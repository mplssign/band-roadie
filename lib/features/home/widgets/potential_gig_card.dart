import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../app/models/gig.dart';
import '../../../app/theme/design_tokens.dart';
import '../../../app/utils/time_formatter.dart';

// ============================================================================
// POTENTIAL GIG CARD
// Figma: 361x130px, orange→rose gradient (ANIMATED), border gray-400, radius 16
// Title "Potential Gig", venue name, location, date/time right-aligned
// Footer with RSVP status: Yes/No/Not replied counts
// ============================================================================

class PotentialGigCard extends StatefulWidget {
  final Gig gig;
  final VoidCallback? onTap;

  /// Response counts for the footer
  final int yesCount;
  final int noCount;
  final int notRespondedCount;

  const PotentialGigCard({
    super.key,
    required this.gig,
    this.onTap,
    this.yesCount = 0,
    this.noCount = 0,
    this.notRespondedCount = 0,
  });

  @override
  State<PotentialGigCard> createState() => _PotentialGigCardState();
}

class _PotentialGigCardState extends State<PotentialGigCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _gradientController;
  late Animation<Alignment> _beginAlignment;
  late Animation<Alignment> _endAlignment;

  @override
  void initState() {
    super.initState();
    _gradientController = AnimationController(
      duration: const Duration(seconds: 5),
      vsync: this,
    )..repeat(reverse: true);

    _beginAlignment =
        TweenSequence<Alignment>([
          TweenSequenceItem(
            tween: Tween(begin: Alignment.centerLeft, end: Alignment.topLeft),
            weight: 1,
          ),
          TweenSequenceItem(
            tween: Tween(begin: Alignment.topLeft, end: Alignment.topCenter),
            weight: 1,
          ),
        ]).animate(
          CurvedAnimation(parent: _gradientController, curve: Curves.easeInOut),
        );

    _endAlignment =
        TweenSequence<Alignment>([
          TweenSequenceItem(
            tween: Tween(
              begin: Alignment.centerRight,
              end: Alignment.bottomRight,
            ),
            weight: 1,
          ),
          TweenSequenceItem(
            tween: Tween(
              begin: Alignment.bottomRight,
              end: Alignment.bottomCenter,
            ),
            weight: 1,
          ),
        ]).animate(
          CurvedAnimation(parent: _gradientController, curve: Curves.easeInOut),
        );
  }

  @override
  void dispose() {
    _gradientController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _gradientController,
        builder: (context, child) {
          return Container(
            constraints: const BoxConstraints(minHeight: 150),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: _beginAlignment.value,
                end: _endAlignment.value,
                colors: const [
                  Color(0xFFF77800), // orange
                  Color(0xFFE11D48), // rose-600
                ],
              ),
              borderRadius: BorderRadius.circular(Spacing.cardRadius), // 16px
              border: Border.all(
                color: const Color(0xFF94A3B8), // gray-400
                width: 1,
              ),
            ),
            child: child,
          );
        },
        child: Stack(
          children: [
            // Main content
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 15, 20, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left side content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title with info icon
                        Row(
                          children: [
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                              child: const Center(
                                child: Text(
                                  '!',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Potential Gig',
                              style: GoogleFonts.ubuntu(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.23,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 15),

                        // Venue name (moved 16px lower)
                        const SizedBox(height: 16),
                        Text(
                          widget.gig.name,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.43,
                            color: Colors.white,
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),

                        const SizedBox(height: 2),

                        // Location
                        Text(
                          widget.gig.location,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w400,
                            letterSpacing: -0.31,
                            color: Colors.white,
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),

                  // Right side - date/time
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const SizedBox(height: 2),
                      Text(
                        _formatDateLine(widget.gig.date),
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.43,
                          color: Colors.white,
                          height: 1.2,
                        ),
                      ),

                      const SizedBox(height: 2),

                      Text(
                        TimeFormatter.formatRange(
                          widget.gig.startTime,
                          widget.gig.endTime,
                        ),
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.43,
                          color: Colors.white,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Footer with RSVP status
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                height: 27,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.75), // 75% opacity
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(15),
                    bottomRight: Radius.circular(15),
                  ),
                ),
                child: Center(
                  child: Text(
                    'Yes: ${widget.yesCount}     No: ${widget.noCount}     Not replied: ${widget.notRespondedCount}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.23,
                      color: Color(0xFFE11D48), // rose-600
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDateLine(DateTime date) {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
    return '${days[date.weekday - 1]} ${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
