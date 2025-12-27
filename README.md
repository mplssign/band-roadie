# BandRoadie

A Flutter app for managing your band — gigs, rehearsals, setlists, and more.

## Getting Started

### Prerequisites

- Flutter SDK (3.10+)
- A Supabase project ([create one free](https://supabase.com))

### Supabase Setup

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project → **Settings** → **API**
3. Copy the **Project URL** and **anon public** key

### Running the App

**Never hardcode your Supabase credentials.** Pass them at runtime using `--dart-define`:

```bash
# iOS Simulator
flutter run -d "iPhone 16" \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here

# macOS
flutter run -d macos \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here

# Android
flutter run -d emulator-5554 \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here

# Chrome (web)
flutter run -d chrome \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key-here
```

### VS Code Launch Configuration (Recommended)

A template is provided at `.vscode/launch.template.json`. To set up:

1. Copy the template:
   ```bash
   cp .vscode/launch.template.json .vscode/launch.json
   ```

2. Edit `.vscode/launch.json` and replace the placeholder values:
   - `https://YOUR_PROJECT.supabase.co` → your actual Supabase URL
   - `your-anon-key-here` → your actual anon key

3. Run from VS Code:
   - Open the **Run and Debug** panel (⇧⌘D)
   - Select **BandRoadie (macOS)** or **BandRoadie (iOS Simulator)**
   - Press **F5** to launch

> ✅ `.vscode/launch.json` is gitignored — your real keys stay local.

### Deep Linking (Magic Link Auth)

The app uses `bandroadie://login-callback` for magic link authentication.

**In Supabase Dashboard:**
1. Go to **Authentication** → **URL Configuration**
2. Add `bandroadie://login-callback` to **Redirect URLs**

## Project Structure

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for the complete folder and file structure (auto-generated).

```
lib/
├── main.dart                  # App entry point
├── app/
│   └── supabase_config.dart   # Supabase credential validation
└── features/
    ├── auth/
    │   ├── auth_gate.dart     # Auth state listener
    │   └── login_screen.dart  # Magic link login
    └── home/
        ├── home_screen.dart   # Main dashboard
        └── widgets/           # Reusable UI components
```

## Development Setup

### Enable Git Hooks

To auto-update the project structure documentation on each commit:

```bash
# Enable the custom hooks directory
git config core.hooksPath .githooks

# Test the generator
./scripts/gen_structure.sh
```

### Regenerate Project Structure Manually

```bash
./scripts/gen_structure.sh
```

## Tech Stack

- **Flutter** with Material 3 (dark mode only)
- **Supabase** for auth and backend
- No third-party UI libraries

## License

Private project.
