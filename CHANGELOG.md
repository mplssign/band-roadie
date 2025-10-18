## [1.2.4] - 2025-10-17

### Added
- ui: add shadcn button & input (lowercase paths) (5408cd1)
- fix: add shadcn button + stabilize daysOfWeek in AddEventDrawer (5218a9b)
- feat(config): implement getBaseUrl() with Vercel preview support (1a31549)
- docs: add Vercel environment variables setup guide (c53c63c)
- chore: add local release script (59ea9b0)

### Changed
- chore: remove 51 dead files and duplicates (Phase 1 & 2) (e88542d)
- chore: remove debug routes (Phase 3) (8d1dc03)
- refactor(setlists): use next/dynamic + vercel.json + all jest deps (d4542c4)
- chore(tsconfig): include .next/types (Next.js auto-update) (ffc1531)
- chore: add local release script (59ea9b0)

### Fixed
- test(jest): fix passWithNoTests boolean in config (c03a7a5)
- fix: add shadcn button + stabilize daysOfWeek in AddEventDrawer (5218a9b)
- chore: remove debug routes (Phase 3) (8d1dc03)
- fix(auth): standardize magic-link redirect to /auth/callback (05e2a92)
- auth(login): use Rose 'Send Login Link', shared wordmark, domain shortcuts; fix magic-link callback to establish session and redirect new→profile, existing→dashboard; exclude callback from middleware (1d671ec)

---

# Changelog

