import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme/design_tokens.dart';

// ============================================================================
// BUTTON GROUP GRID
// A reusable grid of toggle buttons with uniform sizing.
//
// USAGE:
//   ButtonGroupGrid<Duration>(
//     items: Duration.values,
//     labelBuilder: (d) => d.label,
//     isSelected: (d) => selectedDuration == d,
//     onTap: (d) => setState(() => selectedDuration = d),
//     columns: 4,
//   );
// ============================================================================

/// A reusable grid component for rendering fixed-size toggle buttons/chips.
class ButtonGroupGrid<T> extends StatelessWidget {
  /// The list of items to render as buttons.
  final List<T> items;

  /// Function to generate the label text for each item.
  final String Function(T) labelBuilder;

  /// Function to determine if an item is currently selected.
  final bool Function(T) isSelected;

  /// Callback when an item is tapped.
  final void Function(T)? onTap;

  /// Number of columns in the grid.
  final int columns;

  /// Height of each button (default: 42).
  final double buttonHeight;

  /// Horizontal spacing between buttons (default: 8).
  final double horizontalSpacing;

  /// Vertical spacing between rows (default: 8).
  final double verticalSpacing;

  /// Whether buttons should have equal width (default: true).
  final bool equalWidth;

  /// Whether the grid is enabled (default: true).
  final bool enabled;

  const ButtonGroupGrid({
    super.key,
    required this.items,
    required this.labelBuilder,
    required this.isSelected,
    this.onTap,
    this.columns = 4,
    this.buttonHeight = 42,
    this.horizontalSpacing = 8,
    this.verticalSpacing = 8,
    this.equalWidth = true,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate rows needed
    final rowCount = (items.length / columns).ceil();

    return Column(
      children: List.generate(rowCount, (rowIndex) {
        final startIndex = rowIndex * columns;
        final endIndex = (startIndex + columns).clamp(0, items.length);
        final rowItems = items.sublist(startIndex, endIndex);

        // Pad the last row with empty spaces if needed for equal width
        final paddedRowItems = List<T?>.from(rowItems);
        while (paddedRowItems.length < columns) {
          paddedRowItems.add(null);
        }

        return Padding(
          padding: EdgeInsets.only(
            bottom: rowIndex < rowCount - 1 ? verticalSpacing : 0,
          ),
          child: Row(
            children: List.generate(columns, (colIndex) {
              final item = paddedRowItems[colIndex];

              // Add spacing between buttons
              final margin = EdgeInsets.only(
                right: colIndex < columns - 1 ? horizontalSpacing : 0,
              );

              if (item == null) {
                // Empty spacer for incomplete last row
                return Expanded(child: Container(margin: margin));
              }

              final selected = isSelected(item);

              return Expanded(
                child: Container(
                  margin: margin,
                  child: _ButtonGridItem(
                    label: labelBuilder(item),
                    isSelected: selected,
                    height: buttonHeight,
                    enabled: enabled,
                    onTap: onTap == null
                        ? null
                        : () {
                            onTap!(item);
                            HapticFeedback.selectionClick();
                          },
                  ),
                ),
              );
            }),
          ),
        );
      }),
    );
  }
}

/// Internal button item widget with animation and styling.
class _ButtonGridItem extends StatelessWidget {
  final String label;
  final bool isSelected;
  final double height;
  final bool enabled;
  final VoidCallback? onTap;

  const _ButtonGridItem({
    required this.label,
    required this.isSelected,
    required this.height,
    required this.enabled,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: AppDurations.fast,
        height: height,
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.scaffoldBg,
          borderRadius: BorderRadius.circular(Spacing.buttonRadius),
          border: Border.all(
            color: isSelected ? AppColors.accent : AppColors.borderMuted,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.footnote.copyWith(
            color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
          textAlign: TextAlign.center,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
