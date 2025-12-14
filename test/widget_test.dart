// Basic widget test for BandRoadie

import 'package:flutter_test/flutter_test.dart';

import 'package:tonyholmes/main.dart';

void main() {
  testWidgets('App builds without errors', (WidgetTester tester) async {
    // Build the app and trigger a frame
    await tester.pumpWidget(const BandRoadieApp());

    // Verify app loads (basic smoke test)
    expect(find.text('BandRoadie'), findsAny);
  });
}
