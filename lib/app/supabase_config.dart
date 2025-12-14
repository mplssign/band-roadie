// ========================================
// SUPABASE CONFIGURATION
// Credentials are passed via --dart-define at build/run time
// See README.md for usage instructions
// ========================================

const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

/// Call this before Supabase.initialize() to ensure credentials are set.
/// Throws a friendly error if missing.
void validateSupabaseConfig() {
  if (supabaseUrl.isEmpty) {
    throw StateError('''
╔══════════════════════════════════════════════════════════════════╗
║  SUPABASE_URL is missing!                                        ║
║                                                                  ║
║  Run the app with:                                               ║
║  flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co  ║
║              --dart-define=SUPABASE_ANON_KEY=your-anon-key       ║
║                                                                  ║
║  Or create a .env file and use a launch configuration.           ║
╚══════════════════════════════════════════════════════════════════╝
''');
  }

  if (supabaseAnonKey.isEmpty) {
    throw StateError('''
╔══════════════════════════════════════════════════════════════════╗
║  SUPABASE_ANON_KEY is missing!                                   ║
║                                                                  ║
║  Run the app with:                                               ║
║  flutter run --dart-define=SUPABASE_URL=https://xxx.supabase.co  ║
║              --dart-define=SUPABASE_ANON_KEY=your-anon-key       ║
║                                                                  ║
║  Find your anon key in Supabase Dashboard > Settings > API.      ║
╚══════════════════════════════════════════════════════════════════╝
''');
  }
}
