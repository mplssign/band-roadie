import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/supabase_config.dart';
import 'app/theme/app_theme.dart';
import 'features/auth/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Validate credentials before initializing
  validateSupabaseConfig();

  // Initialize Supabase before running app
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);

  // Wrap app with Riverpod for state management
  runApp(const ProviderScope(child: BandRoadieApp()));
}

class BandRoadieApp extends StatelessWidget {
  const BandRoadieApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BandRoadie',
      debugShowCheckedModeBanner: false,

      // Dark mode only
      themeMode: ThemeMode.dark,

      // Use centralized theme
      darkTheme: AppTheme.darkTheme,

      // AuthGate decides: LoginScreen or HomeScreen
      home: const AuthGate(),
    );
  }
}
