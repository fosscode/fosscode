#!/bin/bash

# Release script for fosscode
# Usage: ./scripts/release.sh [patch|minor|major] [--skip-binaries]
# This script prepares a release by bumping version, building, testing, tagging, creating GitHub release,
# and building/signing/uploading binaries for all platforms.
# Publishing to npm is handled automatically by GitHub Actions when the release is published.

set -e

# Default to patch version bump
VERSION_TYPE=${1:-patch}
BUILD_BINARIES=true

# Parse arguments
if [[ "$2" == "--skip-binaries" ]]; then
  BUILD_BINARIES=false
fi

echo "🚀 Starting release process..."

# Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Working directory is not clean. Please commit or stash changes first."
  exit 1
fi

# Check if logged into npm
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ Not logged into npm. Please run 'npm login' first."
  exit 1
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI (gh) is not installed"
  echo "Install from: https://cli.github.com/"
  exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
  echo "❌ Error: GitHub CLI is not authenticated"
  echo "Run: gh auth login"
  exit 1
fi

echo "📦 Incrementing version ($VERSION_TYPE)..."
npm version "$VERSION_TYPE" --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")

echo "🔨 Building project..."
npm run build

echo "🧪 Running tests and linting..."
npm run lint
npm run typecheck
npm test

echo "📝 Committing changes..."
git add package.json package-lock.json
git commit -m "chore: bump version to $NEW_VERSION"

echo "⬆️  Pushing to GitHub..."
git push origin main

echo "🏷️  Creating and pushing git tag..."
git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"

echo "📋 Generating changelog..."
# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CURRENT_TAG="v$NEW_VERSION"

if [ -n "$LATEST_TAG" ]; then
  # Generate changelog between tags
  CHANGES=$(git log --pretty=format:"- %s (%h)" $LATEST_TAG..HEAD)
else
  # First release
  CHANGES=$(git log --pretty=format:"- %s (%h)" --max-count=10)
fi

echo "📝 Creating GitHub release..."
# Create the GitHub release with the changelog
gh release create "v$NEW_VERSION" \
  --title "Release v$NEW_VERSION" \
  --notes "$CHANGES" \
  --generate-notes

if [[ "$BUILD_BINARIES" == "true" ]]; then
  echo "🔨 Building, signing, and uploading binaries for all platforms..."
  # Build and upload binaries
  ./scripts/build-binaries.sh "v$NEW_VERSION"
else
  echo "⏭️  Skipping binary building (--skip-binaries flag used)"
fi

echo "✅ Release $NEW_VERSION completed successfully!"
echo "📦 NPM publishing will be handled automatically by GitHub Actions"
if [[ "$BUILD_BINARIES" == "true" ]]; then
  echo "📥 Binaries available at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases/tag/v$NEW_VERSION"
fi
echo "🔗 Release URL: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases/tag/v$NEW_VERSION"