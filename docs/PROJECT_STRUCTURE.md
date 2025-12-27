# Project Structure

> Auto-generated file. Do not edit manually.
> 
> **Generated:** 2025-12-16T14:16:38.887Z
> 
> **Command:** `node scripts/gen_structure.js` or `./scripts/gen_structure.sh`

## Directory Tree

```
BandRoadie/
├── __mocks__/
│   ├── fileMock.js
│   └── styleMock.js
├── __tests__/
│   ├── blockouts.test.ts
│   ├── capitalizeWords.test.ts
│   ├── dashboard.datableed.test.tsx
│   ├── dashboard.emptyGigs.test.tsx
│   ├── dashboard.gigDrawer.integration.test.tsx
│   ├── dateOnly.test.ts
│   ├── deleteSetlistSong.test.ts
│   ├── duration.test.ts
│   ├── durationFormatting.test.ts
│   ├── exportToMusicService.test.tsx
│   ├── PotentialGigMembersSection.test.tsx
│   ├── ProfileForm.integration.test.tsx
│   ├── session.test.ts
│   ├── setlistDetail.test.tsx
│   ├── setlistDurationConsistency.test.ts
│   ├── shareText.test.ts
│   ├── smoke.test.js
│   ├── test-config.ts
│   ├── useVirtualKeyboard.test.ts
│   └── zipLookup.test.ts
├── .githooks/
│   └── pre-commit
├── .husky/
│   └── pre-commit
├── android/
│   ├── app/
│   │   ├── src/
│   │   │   ├── debug/
│   │   │   │   └── AndroidManifest.xml
│   │   │   ├── main/
│   │   │   │   ├── java/
│   │   │   │   │   └── io/
│   │   │   │   │       └── flutter/
│   │   │   │   │           └── plugins/
│   │   │   │   ├── kotlin/
│   │   │   │   │   └── com/
│   │   │   │   │       └── example/
│   │   │   │   │           └── tonyholmes/
│   │   │   │   │               └── MainActivity.kt
│   │   │   │   ├── res/
│   │   │   │   │   ├── drawable/
│   │   │   │   │   │   └── launch_background.xml
│   │   │   │   │   ├── drawable-v21/
│   │   │   │   │   │   └── launch_background.xml
│   │   │   │   │   ├── mipmap-hdpi/
│   │   │   │   │   │   └── ic_launcher.png
│   │   │   │   │   ├── mipmap-mdpi/
│   │   │   │   │   │   └── ic_launcher.png
│   │   │   │   │   ├── mipmap-xhdpi/
│   │   │   │   │   │   └── ic_launcher.png
│   │   │   │   │   ├── mipmap-xxhdpi/
│   │   │   │   │   │   └── ic_launcher.png
│   │   │   │   │   ├── mipmap-xxxhdpi/
│   │   │   │   │   │   └── ic_launcher.png
│   │   │   │   │   ├── values/
│   │   │   │   │   │   └── styles.xml
│   │   │   │   │   └── values-night/
│   │   │   │   │       └── styles.xml
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── profile/
│   │   │       └── AndroidManifest.xml
│   │   └── build.gradle.kts
│   ├── gradle/
│   │   └── wrapper/
│   │       ├── gradle-wrapper.jar
│   │       └── gradle-wrapper.properties
│   ├── .gitignore
│   ├── build.gradle.kts
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── local.properties
│   └── settings.gradle.kts
├── app/
│   ├── (auth)/
│   │   ├── invite/
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── logout/
│   │   │   └── route.ts
│   │   └── signup/
│   │       └── page.tsx
│   ├── (protected)/
│   │   ├── bands/
│   │   │   ├── [bandId]/
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   ├── create/
│   │   │   │   └── page.tsx
│   │   │   └── onboarding/
│   │   │       └── page.tsx
│   │   ├── calendar/
│   │   │   ├── AddBlockoutDrawer.tsx
│   │   │   ├── AddEventDrawer.tsx
│   │   │   ├── CalendarContent.tsx
│   │   │   ├── EditGigDrawer.tsx
│   │   │   ├── EditRehearsalDrawer.tsx
│   │   │   ├── EventDrawer.tsx
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardClient.tsx
│   │   │   ├── DashboardContent.tsx
│   │   │   ├── DashboardContent.tsx.bak
│   │   │   ├── EditGigBottomDrawer.tsx
│   │   │   ├── EventBottomDrawer.tsx
│   │   │   └── page.tsx
│   │   ├── gigs/
│   │   │   ├── [gigId]/
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   └── create/
│   │   │       └── page.tsx
│   │   ├── invite/
│   │   │   └── [invitationId]/
│   │   │       └── page.tsx
│   │   ├── members/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   ├── page.tsx
│   │   │   └── ProfileForm.tsx
│   │   ├── rehearsals/
│   │   │   ├── create/
│   │   │   │   └── page.tsx
│   │   │   └── next/
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   ├── report-bug/
│   │   │   └── page.tsx
│   │   ├── setlists/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   ├── songs/
│   │   │   └── [songId]/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   ├── (providers)/
│   │   └── ServiceWorkerUpdater.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   │   └── route.ts
│   │   │   ├── logout/
│   │   │   │   └── route.ts
│   │   │   ├── magic-link/
│   │   │   │   └── route.ts
│   │   │   ├── me/
│   │   │   │   └── route.ts
│   │   │   ├── session/
│   │   │   │   └── route.ts
│   │   │   ├── start/
│   │   │   │   └── route.ts
│   │   │   ├── user/
│   │   │   │   └── route.ts
│   │   │   └── verify-token/
│   │   │       └── route.ts
│   │   ├── bands/
│   │   │   ├── [bandId]/
│   │   │   │   ├── invites/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── members/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── create/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── bug-report/
│   │   │   └── route.ts
│   │   ├── cleanup-tunings/
│   │   │   └── route.ts
│   │   ├── dashboard/
│   │   │   └── route.ts
│   │   ├── debug/
│   │   │   └── band-membership/
│   │   │       └── route.ts
│   │   ├── errors/
│   │   │   └── route.ts
│   │   ├── gigs/
│   │   │   ├── [gigId]/
│   │   │   │   └── responses/
│   │   │   │       └── route.ts
│   │   │   └── route.ts
│   │   ├── invitations/
│   │   │   └── [invitationId]/
│   │   │       └── accept/
│   │   │           └── route.ts
│   │   ├── invites/
│   │   │   └── accept/
│   │   │       └── route.ts
│   │   ├── playlists/
│   │   │   └── parse/
│   │   │       └── route.ts
│   │   ├── profile/
│   │   │   └── route.ts
│   │   ├── realtime/
│   │   │   └── route.ts
│   │   ├── rehearsals/
│   │   │   └── route.ts
│   │   ├── roles/
│   │   │   └── route.ts
│   │   ├── setlists/
│   │   │   ├── [id]/
│   │   │   │   ├── copy/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── songs/
│   │   │   │   │   ├── [songId]/
│   │   │   │   │   │   ├── copy/
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── bulk-delete/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── debug/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── totals/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── songs/
│   │   │   ├── [songId]/
│   │   │   │   ├── notes/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── backfill-durations/
│   │   │   │   └── route.ts
│   │   │   ├── bulk-durations/
│   │   │   │   └── route.ts
│   │   │   ├── duration-backfill/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── test-tunings/
│   │   │   └── route.ts
│   │   ├── tunings/
│   │   │   └── route.ts
│   │   └── users/
│   │       └── create-profile/
│   │           └── route.ts
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts
│   │   ├── set-session/
│   │   │   └── route.ts
│   │   ├── verify/
│   │   │   └── page.tsx
│   │   └── verify-client/
│   │       └── page.tsx
│   ├── callback/
│   │   └── route.ts
│   ├── clear-auth/
│   │   └── page.tsx
│   ├── examples/
│   │   └── date-picker/
│   │       └── page.tsx
│   ├── providers/
│   │   └── providers.tsx
│   ├── error.tsx
│   ├── global-error.tsx
│   ├── globals-simple.css
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── theme-rose.css
│   └── viewport.config.ts
├── components/
│   ├── auth/
│   │   └── SessionSync.tsx
│   ├── branding/
│   │   └── Wordmark.tsx
│   ├── calendar/
│   │   ├── DayDots.tsx
│   │   └── PotentialGigMembersSection.tsx
│   ├── dashboard/
│   │   └── DashboardContentRealtime.tsx
│   ├── icons/
│   │   └── ProviderIcons.tsx
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   ├── AppLoadingBoundary.tsx
│   │   ├── BandBoundary.tsx
│   │   └── OrientationGuard.tsx
│   ├── navigation/
│   │   ├── BottomNav.tsx
│   │   ├── Footer.tsx
│   │   └── TopNav.tsx
│   ├── pwa/
│   │   ├── InstallPrompt.tsx
│   │   ├── PWABootstrap.tsx
│   │   ├── PWAErrorHandler.tsx
│   │   ├── PWAPerformanceMonitor.tsx
│   │   ├── PWARedirectHandler.tsx
│   │   ├── ServiceWorkerNavigationHandler.tsx
│   │   └── ServiceWorkerRegistration.tsx
│   ├── realtime/
│   │   ├── ConflictDialog.tsx
│   │   └── LiveUpdateComponents.tsx
│   ├── setlists/
│   │   ├── AllSongsEditor.tsx
│   │   ├── BpmInput.tsx
│   │   ├── BulkCopyToSetlistSheet.tsx
│   │   ├── BulkPasteDrawer.tsx
│   │   ├── ConfirmDeleteSetlistDialog.tsx
│   │   ├── CopyToSetlistSheet.tsx
│   │   ├── DurationInput.tsx
│   │   ├── OptimizedSongSearchOverlay.tsx
│   │   ├── ProviderImportDrawer.tsx
│   │   ├── SetlistImportRow.tsx
│   │   ├── SetlistSongRow.tsx
│   │   ├── SongRow.tsx
│   │   ├── SongSearchOverlay.tsx
│   │   ├── SwipeableContainer.tsx
│   │   ├── SwipeableSongRow.tsx
│   │   ├── SwipeActions.tsx
│   │   ├── SwipeToAction.tsx
│   │   ├── SwipeToActionDual.tsx
│   │   └── TuningBadge.tsx
│   ├── songs/
│   │   └── NotesDrawer.tsx
│   ├── ui/
│   │   ├── add-event-drawer.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── alert.tsx
│   │   ├── AnimatedDrawer.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── Card.tsx
│   │   ├── checkbox.tsx
│   │   ├── Chip.tsx
│   │   ├── Dialog.tsx
│   │   ├── Drawer.tsx
│   │   ├── empty.tsx
│   │   ├── gradient-border-button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── popover.tsx
│   │   ├── scroll-area.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── SheetWithClose.tsx
│   │   ├── switch.tsx
│   │   ├── tabs.tsx
│   │   ├── Toast.tsx
│   │   └── toggle-group.tsx
│   ├── BottomNav.tsx
│   └── date-picker.tsx
├── contexts/
│   └── BandsContext.tsx
├── docs/
│   ├── API_ROUTES_BAND_SCOPING_STATUS.md
│   ├── AUTH_CALLBACK_PROFILE_FIX.md
│   ├── AUTH_ROUTING_FIX.md
│   ├── auth.md
│   ├── BLOCKOUT_RANGE_GROUPING.md
│   ├── CLEAR_PWA_CACHE.md
│   ├── DASHBOARD_DRAWER_UNIFICATION.md
│   ├── DATE_PICKER_IMPLEMENTATION.md
│   ├── DATE_PICKER_QUICK_REFERENCE.md
│   ├── DATE_PICKER.md
│   ├── DELETE_BAND_MIGRATION.md
│   ├── EMAIL_INVITE_FIX.md
│   ├── INVITE_SYSTEM_DEPLOYMENT.md
│   ├── INVITE_SYSTEM_REFERENCE.md
│   ├── INVITE_SYSTEM_TEST_MATRIX.md
│   ├── INVITES_TROUBLESHOOTING.md
│   ├── KNOWLEDGE_BASE.md
│   ├── MAGIC_LINK_AUTH_FIX.md
│   ├── MAGIC_LINK_FIX_COMPLETE.md
│   ├── MAGIC_LINK_FIX.md
│   ├── MAGIC_LINK_QUICK_REF.md
│   ├── MIGRATION_COMPLETE.md
│   ├── MIGRATION_GUIDE.md
│   ├── MULTI_BAND_SCOPING.md
│   ├── PORTRAIT_MODE.md
│   ├── PROJECT_STRUCTURE.md
│   ├── PWA-INSTALL.md
│   ├── QUICK_REFERENCE_BAND_SCOPING.md
│   ├── REALTIME_INTEGRATION_GUIDE.md
│   ├── REALTIME_TEST_PLAN.md
│   ├── SSL_FIX_LOCAL_DEV.md
│   ├── TEST_DELETE_BAND.md
│   ├── URL_CONFIGURATION.md
│   ├── VERCEL_SETUP.md
│   └── VIRTUAL_KEYBOARD_SUPPORT.md
├── hooks/
│   ├── useAuth.ts
│   ├── useBandChange.ts
│   ├── useBandMembers.ts
│   ├── useBands.ts
│   ├── useBands.ts.backup
│   ├── useDrawer.ts
│   ├── useDurationBackfill.ts
│   ├── useFocusManagement.ts
│   ├── useGigs.ts
│   ├── useLoadingState.ts
│   ├── usePWAInstall.ts
│   ├── usePWASession.ts
│   ├── useRealtime.ts
│   ├── useToast.ts
│   └── useVirtualKeyboard.ts
├── ios/
│   ├── Flutter/
│   │   ├── AppFrameworkInfo.plist
│   │   ├── Debug.xcconfig
│   │   ├── flutter_export_environment.sh
│   │   ├── Generated.xcconfig
│   │   └── Release.xcconfig
│   ├── Runner/
│   │   ├── Assets.xcassets/
│   │   │   ├── AppIcon.appiconset/
│   │   │   │   ├── Contents.json
│   │   │   │   ├── Icon-App-1024x1024@1x.png
│   │   │   │   ├── Icon-App-20x20@1x.png
│   │   │   │   ├── Icon-App-20x20@2x.png
│   │   │   │   ├── Icon-App-20x20@3x.png
│   │   │   │   ├── Icon-App-29x29@1x.png
│   │   │   │   ├── Icon-App-29x29@2x.png
│   │   │   │   ├── Icon-App-29x29@3x.png
│   │   │   │   ├── Icon-App-40x40@1x.png
│   │   │   │   ├── Icon-App-40x40@2x.png
│   │   │   │   ├── Icon-App-40x40@3x.png
│   │   │   │   ├── Icon-App-60x60@2x.png
│   │   │   │   ├── Icon-App-60x60@3x.png
│   │   │   │   ├── Icon-App-76x76@1x.png
│   │   │   │   ├── Icon-App-76x76@2x.png
│   │   │   │   └── Icon-App-83.5x83.5@2x.png
│   │   │   └── LaunchImage.imageset/
│   │   │       ├── Contents.json
│   │   │       ├── LaunchImage.png
│   │   │       ├── LaunchImage@2x.png
│   │   │       ├── LaunchImage@3x.png
│   │   │       └── README.md
│   │   ├── Base.lproj/
│   │   │   ├── LaunchScreen.storyboard
│   │   │   └── Main.storyboard
│   │   ├── AppDelegate.swift
│   │   ├── Info.plist
│   │   └── Runner-Bridging-Header.h
│   ├── Runner.xcodeproj/
│   │   ├── project.xcworkspace/
│   │   │   ├── xcshareddata/
│   │   │   │   ├── swiftpm/
│   │   │   │   │   └── configuration/
│   │   │   │   ├── IDEWorkspaceChecks.plist
│   │   │   │   └── WorkspaceSettings.xcsettings
│   │   │   └── contents.xcworkspacedata
│   │   ├── xcshareddata/
│   │   │   └── xcschemes/
│   │   │       └── Runner.xcscheme
│   │   └── project.pbxproj
│   ├── Runner.xcworkspace/
│   │   ├── xcshareddata/
│   │   │   ├── swiftpm/
│   │   │   │   └── configuration/
│   │   │   ├── IDEWorkspaceChecks.plist
│   │   │   └── WorkspaceSettings.xcsettings
│   │   └── contents.xcworkspacedata
│   ├── RunnerTests/
│   │   └── RunnerTests.swift
│   ├── .gitignore
│   └── Podfile
├── lib/
│   ├── app/
│   │   ├── models/
│   │   │   ├── band_invitation.dart
│   │   │   ├── band_member.dart
│   │   │   ├── band.dart
│   │   │   ├── gig_response.dart
│   │   │   ├── gig.dart
│   │   │   ├── models.dart
│   │   │   ├── rehearsal.dart
│   │   │   └── user_profile.dart
│   │   ├── services/
│   │   │   └── supabase_client.dart
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   └── design_tokens.dart
│   │   └── supabase_config.dart
│   ├── auth/
│   │   ├── pkce.ts
│   │   └── session.ts
│   ├── config/
│   │   └── site.ts
│   ├── data/
│   │   └── gigs.ts
│   ├── email/
│   │   ├── templates/
│   │   │   ├── invite.tsx
│   │   │   ├── member-added.tsx
│   │   │   └── verification.tsx
│   │   └── client.ts
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth_gate.dart
│   │   │   └── login_screen.dart
│   │   ├── bands/
│   │   │   ├── widgets/
│   │   │   │   └── band_avatar.dart
│   │   │   ├── active_band_controller.dart
│   │   │   ├── band_form_screen.dart
│   │   │   ├── band_repository.dart
│   │   │   ├── create_band_screen.dart
│   │   │   └── edit_band_screen.dart
│   │   ├── feedback/
│   │   │   └── bug_report_screen.dart
│   │   ├── gigs/
│   │   │   ├── gig_controller.dart
│   │   │   └── gig_repository.dart
│   │   ├── home/
│   │   │   ├── widgets/
│   │   │   │   ├── band_switcher.dart
│   │   │   │   ├── bottom_nav_bar.dart
│   │   │   │   ├── confirmed_gig_card.dart
│   │   │   │   ├── empty_home_state.dart
│   │   │   │   ├── empty_section_card.dart
│   │   │   │   ├── home_app_bar.dart
│   │   │   │   ├── no_band_state.dart
│   │   │   │   ├── potential_gig_card.dart
│   │   │   │   ├── quick_actions_row.dart
│   │   │   │   ├── rehearsal_card.dart
│   │   │   │   ├── section_header.dart
│   │   │   │   └── side_drawer.dart
│   │   │   └── home_screen.dart
│   │   ├── profile/
│   │   │   ├── my_profile_screen.dart
│   │   │   └── profile_screen.dart
│   │   └── rehearsals/
│   │       ├── rehearsal_controller.dart
│   │       └── rehearsal_repository.dart
│   ├── server/
│   │   ├── band-scope.ts
│   │   └── send-band-invites.ts
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_delete_band_function.sql
│   │   │   ├── 003_create_roles_table.sql
│   │   │   ├── 004_create_user_roles_table.sql
│   │   │   ├── 005_create_setlists_tables.sql
│   │   │   ├── 006_update_setlists_schema.sql
│   │   │   ├── 007_update_setlists_schema_fixed.sql
│   │   │   ├── 008_add_itunes_spotify_support.sql
│   │   │   ├── 009_fix_setlist_songs_rls_policy.sql
│   │   │   ├── 010_fix_songs_rls_policy.sql
│   │   │   └── 030_add_all_songs_setlist.sql
│   │   ├── client.ts
│   │   ├── middleware.ts
│   │   ├── server-queries.ts
│   │   ├── server.ts
│   │   ├── setlist-totals.ts
│   │   └── setlists.ts
│   ├── time/
│   │   └── duration.ts
│   ├── types/
│   │   └── realtime.ts
│   ├── utils/
│   │   ├── blockouts.ts
│   │   ├── date.ts
│   │   ├── dateOnly.ts
│   │   ├── formatters.ts
│   │   ├── potential-gigs.ts
│   │   ├── pwa-links.ts
│   │   ├── realtime-broadcast.ts
│   │   ├── realtime-connections.ts
│   │   ├── time.ts
│   │   ├── tuning.ts
│   │   ├── validators.ts
│   │   ├── version.ts
│   │   └── zip-lookup.ts
│   ├── accessibility-utils.ts
│   ├── constants.ts
│   ├── main.dart
│   ├── motion-config.ts
│   ├── security-config.ts
│   ├── types.ts
│   └── utils.ts
├── linux/
│   ├── flutter/
│   │   ├── CMakeLists.txt
│   │   └── generated_plugin_registrant.h
│   ├── runner/
│   │   ├── CMakeLists.txt
│   │   ├── main.cc
│   │   ├── my_application.cc
│   │   └── my_application.h
│   ├── .gitignore
│   └── CMakeLists.txt
├── macos/
│   ├── Flutter/
│   │   ├── Flutter-Debug.xcconfig
│   │   └── Flutter-Release.xcconfig
│   ├── Runner/
│   │   ├── Assets.xcassets/
│   │   │   └── AppIcon.appiconset/
│   │   │       ├── app_icon_1024.png
│   │   │       ├── app_icon_128.png
│   │   │       ├── app_icon_16.png
│   │   │       ├── app_icon_256.png
│   │   │       ├── app_icon_32.png
│   │   │       ├── app_icon_512.png
│   │   │       ├── app_icon_64.png
│   │   │       └── Contents.json
│   │   ├── Base.lproj/
│   │   │   └── MainMenu.xib
│   │   ├── Configs/
│   │   │   ├── AppInfo.xcconfig
│   │   │   ├── Debug.xcconfig
│   │   │   ├── Release.xcconfig
│   │   │   └── Warnings.xcconfig
│   │   ├── AppDelegate.swift
│   │   ├── DebugProfile.entitlements
│   │   ├── Info.plist
│   │   ├── MainFlutterWindow.swift
│   │   └── Release.entitlements
│   ├── Runner.xcodeproj/
│   │   ├── project.xcworkspace/
│   │   │   └── xcshareddata/
│   │   │       ├── swiftpm/
│   │   │       │   └── configuration/
│   │   │       └── IDEWorkspaceChecks.plist
│   │   ├── xcshareddata/
│   │   │   └── xcschemes/
│   │   │       └── Runner.xcscheme
│   │   └── project.pbxproj
│   ├── Runner.xcworkspace/
│   │   ├── xcshareddata/
│   │   │   ├── swiftpm/
│   │   │   │   └── configuration/
│   │   │   └── IDEWorkspaceChecks.plist
│   │   └── contents.xcworkspacedata
│   ├── RunnerTests/
│   │   └── RunnerTests.swift
│   ├── .gitignore
│   └── Podfile
├── migrations/
│   ├── add_setlist_id_to_rehearsals.sql
│   ├── add_tuning_confirmations.sql
│   └── add_user_insert_policy.sql
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json
│   ├── apple-touch-icon.png
│   ├── band_roadie_icon.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   ├── icon-192x192.png
│   ├── icon-512x512.png
│   ├── manifest.json
│   ├── robots.txt
│   └── sw.js
├── scripts/
│   ├── codemods/
│   │   └── convert-buttons-to-shadcn.js
│   ├── apply-delete-band-migration.js
│   ├── apply-migration.js
│   ├── backfill-durations.ts
│   ├── check-songs.ts
│   ├── gen_structure.js
│   ├── gen_structure.sh
│   ├── generate-version.js
│   └── run-migration.js
├── supabase/
│   ├── .temp/
│   │   ├── cli-latest
│   │   ├── gotrue-version
│   │   ├── pooler-url
│   │   ├── postgres-version
│   │   ├── project-ref
│   │   ├── rest-version
│   │   └── storage-version
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 012_add_invite_tokens.sql
│   │   ├── 013_delete_band_function.sql
│   │   ├── 014_add_multi_band_scoping.sql
│   │   ├── 015_potential_gig_enhancements.sql
│   │   ├── 016_add_band_members_policies.sql
│   │   ├── 017_fix_birthday_timezone.sql
│   │   ├── 018_create_song_notes_table.sql
│   │   ├── 019_fix_reorder_positions_constraint.sql
│   │   ├── 020_fix_rls_infinite_recursion.sql
│   │   ├── 030_rls_complete_schema.sql
│   │   ├── 031_seed_data.sql
│   │   ├── 035_rls_policies_only.sql
│   │   ├── 040_songs_band_scoped.sql
│   │   ├── 041_songs_band_id_schema.sql
│   │   ├── 042_verify_songs_migration.sql
│   │   ├── 043_songs_add_band_id.sql
│   │   ├── 044_songs_band_partition.sql
│   │   ├── 045_songs_band_scoped_unique.sql
│   │   ├── 050_create_band_rpc.sql
│   │   └── 051_band_roles_table.sql
│   └── RLS_TESTING_CHECKLIST.md
├── test/
│   └── widget_test.dart
├── types/
│   └── test-env.d.ts
├── web/
│   ├── icons/
│   │   ├── Icon-192.png
│   │   ├── Icon-512.png
│   │   ├── Icon-maskable-192.png
│   │   └── Icon-maskable-512.png
│   ├── favicon.png
│   ├── index.html
│   └── manifest.json
├── windows/
│   ├── flutter/
│   │   ├── CMakeLists.txt
│   │   └── generated_plugin_registrant.h
│   ├── runner/
│   │   ├── resources/
│   │   │   └── app_icon.ico
│   │   ├── CMakeLists.txt
│   │   ├── flutter_window.cpp
│   │   ├── flutter_window.h
│   │   ├── main.cpp
│   │   ├── resource.h
│   │   ├── runner.exe.manifest
│   │   ├── Runner.rc
│   │   ├── utils.cpp
│   │   ├── utils.h
│   │   ├── win32_window.cpp
│   │   └── win32_window.h
│   ├── .gitignore
│   └── CMakeLists.txt
├── .env
├── .env.example
├── .env.production
├── .eslintrc.json
├── .gitignore
├── .instructions.md
├── .nvmrc
├── .prettierrc
├── analysis_options.yaml
├── apply_all_songs_migration.sh
├── apply-migration-019.sh
├── apply-migration.js
├── apply-migration.sh
├── BAND_ROADIE_DOCUMENTATION.md
├── CHANGELOG.md
├── CLEANUP-REPORT.md
├── CODE_REVIEW_IMPLEMENTATION_SUMMARY.md
├── components.json
├── DEPLOYMENT_CHECKLIST.md
├── dev.log
├── EMPTY_GIGS_UPDATE_SUMMARY.md
├── folder-structure.txt
├── INVITE_SYSTEM_SUMMARY.md
├── jest.config.mjs
├── jest.setup.ts
├── LICENSE
├── MAGIC_LINK_FIX_SUMMARY.md
├── middleware.ts
├── MULTI_BAND_SCOPING_SUMMARY.md
├── next.config.js
├── package-lock.json
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── pubspec.yaml
├── PWA_FIX_IMPLEMENTATION.md
├── README.md
├── release.sh
├── SERVER_SIDE_PKCE_MIGRATION.md
├── simple_migration.sql
├── tailwind.config.ts
└── tsconfig.json
```

## Notes

- This file is automatically updated via a pre-commit hook
- Excluded: `.git/`, `.dart_tool/`, `build/`, `Pods/`, `.gradle/`, `node_modules/`, lock files, generated files
- To regenerate manually: `./scripts/gen_structure.sh`
