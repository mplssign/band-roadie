import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/supabase_config.dart';
import 'app/theme/app_theme.dart';
import 'features/auth/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load .env file (silently fails if not present)
  await loadEnvConfig();

  // Validate credentials - returns error message if missing
  final configError = validateSupabaseConfig();
  if (configError != null) {
    // Show error UI instead of crashing
    runApp(ConfigErrorApp(errorMessage: configError));
    return;
  }

  // Initialize Supabase with PKCE auth flow for magic links
  // Deep links are handled automatically by supabase_flutter via app_links
  // when the incoming URI contains ?code= (PKCE) or #access_token (implicit)
  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      // PKCE flow is more secure than implicit flow for magic links
      authFlowType: AuthFlowType.pkce,
      // Auto-detect deep links and extract session (default: true)
      detectSessionInUri: true,
    ),
  );

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

// ============================================================================
// CONFIG ERROR APP
// Shown when Supabase credentials are missing. Friendly error UI.
// ============================================================================

class ConfigErrorApp extends StatelessWidget {
  final String errorMessage;

  const ConfigErrorApp({super.key, required this.errorMessage});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BandRoadie - Configuration Error',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: AppTheme.darkTheme,
      home: Scaffold(
        backgroundColor: const Color(0xFF1E1E1E),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Error icon
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF43F5E).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.settings_outlined,
                      size: 40,
                      color: Color(0xFFF43F5E),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Configuration Missing',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'The roadie can\'t find the venue address.\nCheck your .env file or launch config.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 16),
                  ),
                  const SizedBox(height: 32),
                  // Technical details
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: SingleChildScrollView(
                      child: Text(
                        errorMessage,
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
