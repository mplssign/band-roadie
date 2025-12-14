import 'package:flutter/material.dart';

import '../../../app/theme/design_tokens.dart';

/// Section header with uppercase styling
class SectionHeader extends StatelessWidget {
  final String title;

  const SectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(title, style: AppTextStyles.sectionHeader);
  }
}
