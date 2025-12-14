import 'package:flutter/material.dart';

class PotentialGigCard extends StatelessWidget {
  final String venueName;
  final String location;
  final String dateTime;
  final int yesCount;
  final int noCount;
  final int notRespondedCount;

  const PotentialGigCard({
    super.key,
    this.venueName = 'The Blue Note',
    this.location = 'Downtown',
    this.dateTime = 'Saturday, Jan 15 • 8:00 PM',
    this.yesCount = 3,
    this.noCount = 1,
    this.notRespondedCount = 2,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B).withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF59E0B), width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with badge
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'POTENTIAL GIG',
                  style: TextStyle(
                    color: Color(0xFFF59E0B),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Venue name
          Text(
            venueName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.45,
            ),
          ),
          const SizedBox(height: 4),

          // Location
          Row(
            children: [
              const Icon(
                Icons.location_on_outlined,
                color: Color(0xFF94A3B8),
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                location,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Date/time
          Text(
            dateTime,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          ),

          const SizedBox(height: 16),

          // Divider
          Container(height: 1, color: const Color(0xFF334155)),

          const SizedBox(height: 16),

          // RSVP counts
          Row(
            children: [
              _RsvpBadge(
                label: 'Yes',
                count: yesCount,
                color: const Color(0xFF22C55E),
              ),
              const SizedBox(width: 8),
              const Text('•', style: TextStyle(color: Color(0xFF64748B))),
              const SizedBox(width: 8),
              _RsvpBadge(
                label: 'No',
                count: noCount,
                color: const Color(0xFFEF4444),
              ),
              const SizedBox(width: 8),
              const Text('•', style: TextStyle(color: Color(0xFF64748B))),
              const SizedBox(width: 8),
              _RsvpBadge(
                label: 'Not Responded',
                count: notRespondedCount,
                color: const Color(0xFF94A3B8),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Review / RSVP button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFF59E0B),
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: Color(0xFFF59E0B), width: 1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Review / RSVP',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RsvpBadge extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _RsvpBadge({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label ($count)',
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
