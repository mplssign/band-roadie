import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/services/supabase_client.dart';
import '../shell/app_shell.dart';
import 'login_screen.dart';

// Re-export supabase client for backward compatibility
export '../../app/services/supabase_client.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  StreamSubscription<AuthState>? _authSubscription;
  Session? _session;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _initializeAuth();
  }

  void _initializeAuth() {
    // Get current session
    _session = supabase.auth.currentSession;
    _initialized = true;

    debugPrint(
      '[AuthGate] Initial session: ${_session != null ? "present" : "null"}',
    );

    // Listen for auth state changes (login, logout, token refresh, deep link callback)
    _authSubscription = supabase.auth.onAuthStateChange.listen(
      (data) {
        debugPrint('[AuthGate] Auth state changed: ${data.event.name}');

        if (mounted) {
          setState(() {
            _session = data.session;
          });
        }
      },
      onError: (error) {
        debugPrint('[AuthGate] Auth error: $error');
      },
    );

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Show loading while initializing
    if (!_initialized) {
      return const Scaffold(
        backgroundColor: Color(0xFF1E1E1E),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF3B82F6)),
        ),
      );
    }

    // Session exists -> show app shell with all tabs
    if (_session != null) {
      return const AppShell();
    }

    // No session -> show login
    return const LoginScreen();
  }
}
