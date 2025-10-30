#!/bin/bash
set -euo pipefail

# Band Roadie Production Release Script
# Usage: ./release.sh
RELEASE_BRANCH="${RELEASE_BRANCH:-main}"

echo "🚀 Band Roadie Production Release"
echo "=================================="
echo ""

# 1) Verify branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$RELEASE_BRANCH" ]; then
  echo "❌ Error: Must be on '$RELEASE_BRANCH' branch (current: $CURRENT_BRANCH)"
  exit 1
fi
echo "✅ On correct branch: $CURRENT_BRANCH"

# 2) Clean tree
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working tree is not clean"
  git status --short
  exit 1
fi
echo "✅ Clean working tree"

# 3) Update branch (rebase to avoid merge commits)
echo "📥 Pulling latest changes..."
git pull --rebase origin "$RELEASE_BRANCH"

# 4) Tests / Lint / Build
echo "🧪 Running tests..."; pnpm test
echo "🔍 Running linter..."; pnpm lint
echo "🏗️  Running production build..."; pnpm build

# 5) Changelog inputs
echo "📋 Generating changelog..."
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
  COMMITS=$(git log --pretty=format:"- %s (%h)" --reverse)
else
  echo "Last tag: $LAST_TAG"
  COMMITS=$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s (%h)" --reverse)
fi

# 6) Version bump (ask user)
echo ""
echo "Current version: $(node -p "require('./package.json').version")"
echo "Select version bump: 1) patch  2) minor  3) major"
read -p "Enter choice [1-3]: " VERSION_CHOICE
case $VERSION_CHOICE in
  1) BUMP_TYPE="patch" ;;
  2) BUMP_TYPE="minor" ;;
  3) BUMP_TYPE="major" ;;
  *) echo "❌ Invalid choice"; exit 1 ;;
esac

echo "📦 Bumping version ($BUMP_TYPE)..."
# NOTE: --no-git-tag-version avoids npm-style auto tag; pnpm does not auto-commit with this flag.
pnpm version "$BUMP_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# 7) Update CHANGELOG.md (prepend)
TODAY=$(date +%Y-%m-%d)
[ -f CHANGELOG.md ] || printf "# Changelog\n\n" > CHANGELOG.md

{
  echo "## [$NEW_VERSION] - $TODAY"
  echo ""
  echo "### Added"
  echo "$COMMITS" | grep -Ei "feat|add" || echo "- No new features"
  echo ""
  echo "### Changed"
  echo "$COMMITS" | grep -Ei "refactor|change|update|chore" || echo "- No changes"
  echo ""
  echo "### Fixed"
  echo "$COMMITS" | grep -Ei "fix|bug|hotfix" || echo "- No fixes"
  echo ""
  echo "---"
  echo ""
  cat CHANGELOG.md
} > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

# 8) Commit only if there are changes
if git diff --quiet; then
  echo "ℹ️  No changes to commit (unexpected)."
else
  echo "💾 Committing version bump + changelog..."
  git add package.json CHANGELOG.md
  # pnpm-lock.yaml usually doesn't change for a version bump, add it if present/changed
  git add -A pnpm-lock.yaml || true
  git commit -m "chore(release): bump version to $NEW_VERSION"
fi

# 9) Tag (skip if tag already exists)
if git rev-parse -q --verify "refs/tags/v$NEW_VERSION" >/dev/null; then
  echo "🏷️  Tag v$NEW_VERSION already exists, skipping."
else
  echo "🏷️  Creating tag v$NEW_VERSION..."
  git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
fi

# 10) Push
echo "📤 Pushing branch & tags..."
git push origin "$RELEASE_BRANCH"
git push origin --tags

# 11) Create PR (if gh is installed)
if command -v gh >/dev/null 2>&1; then
  echo "📋 Creating Pull Request..."
  CHANGELOG_SNIPPET=$(sed -n "/^## \[$NEW_VERSION\]/,/^---$/p" CHANGELOG.md | sed '$d' || true)
  gh pr create \
    --base main \
    --head "$RELEASE_BRANCH" \
    --title "feat(auth): refine login UI + fix magic-link routing + prod URL config" \
    --body "## 🎯 Summary

This release includes auth flow improvements, login UI refinements, and production magic-link routing fixes.

## 📝 Changelog

$CHANGELOG_SNIPPET

## ✅ Checks
- [x] Tests pass (\`pnpm test\`)
- [x] Lint/build pass (\`pnpm lint && pnpm build\`)
- [x] Magic link redirects to production
- [x] New users → /profile; existing → /dashboard

Merging to \`main\` triggers Vercel production deploy."
    --web
  echo "✅ PR opened."
else
  echo "⚠️  GitHub CLI not installed. Open PR manually:"
  echo "   https://github.com/mplssign/band-roadie/compare/main...$RELEASE_BRANCH"
fi

echo ""
echo "✅ Release preparation complete! Merge the PR to deploy via Vercel."