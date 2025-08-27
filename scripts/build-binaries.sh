#!/bin/bash

# Binary Building and Upload Script for fosscode
# Usage: ./scripts/build-binaries.sh <version-tag>
# Example: ./scripts/build-binaries.sh v0.0.17

set -e

# Check if version tag is provided
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "📦 fosscode Binary Builder"
    echo ""
    echo "Usage: $0 <version-tag>"
    echo ""
    echo "Examples:"
    echo "  $0 v0.0.17          # Build for specific version"
    echo "  $0 \$(git describe --tags --abbrev=0)  # Build for latest tag"
    echo ""
    echo "This script will:"
    echo "  1. Build binaries for Linux (x64 & ARM64), macOS (Intel & ARM64), and Windows"
    echo "  2. Upload them to the specified GitHub release"
    echo "  3. Clean up local binary files"
    echo ""
    echo "Requirements:"
    echo "  - Bun (https://bun.sh/docs/installation)"
    echo "  - GitHub CLI (https://cli.github.com/)"
    echo "  - Authenticated gh CLI (run: gh auth login)"
    echo "  - Existing GitHub release with the specified tag"
    exit 1
fi

VERSION_TAG=$1

# Validate version tag format
if [[ ! $VERSION_TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "⚠️  Warning: Version tag '$VERSION_TAG' doesn't match expected format (v0.0.0)"
    echo "Continuing anyway..."
fi

echo "🚀 Building fosscode binaries for $VERSION_TAG..."

# Validate environment
echo "🔍 Validating environment..."

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed"
    echo "Install from: https://bun.sh/docs/installation"
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

# Check if src/binary.ts exists
if [ ! -f "src/binary.ts" ]; then
    echo "❌ Error: src/binary.ts not found"
    exit 1
fi

echo "✅ Environment validation passed"

# Check if release exists
if ! gh release view $VERSION_TAG &> /dev/null; then
    echo "❌ Error: Release $VERSION_TAG does not exist"
    echo "Create it first with: gh release create $VERSION_TAG --title \"Release $VERSION_TAG\" --generate-notes"
    exit 1
fi

echo "🔨 Building binaries for all platforms..."

# Build Linux x64
echo "Building Linux x64..."
bun build src/binary.ts --target node --compile --outfile fosscode-linux-x64

# Build Linux ARM64
echo "Building Linux ARM64..."
bun build src/binary.ts --target node --compile --outfile fosscode-linux-arm64

# Build macOS Intel
echo "Building macOS Intel..."
bun build src/binary.ts --target node --compile --outfile fosscode-macos-x64

# Build macOS ARM64
echo "Building macOS ARM64..."
bun build src/binary.ts --target node --compile --outfile fosscode-macos-arm64

# Build Windows x64
echo "Building Windows x64..."
bun build src/binary.ts --target node --compile --outfile fosscode-windows-x64.exe

echo "📦 All binaries built successfully!"
echo ""
echo "📋 Binary sizes:"
ls -lh fosscode-*

echo ""
echo "⬆️  Uploading binaries to GitHub release..."

# Upload all binaries to the release
gh release upload $VERSION_TAG \
    fosscode-linux-x64 \
    fosscode-linux-arm64 \
    fosscode-macos-x64 \
    fosscode-macos-arm64 \
    fosscode-windows-x64.exe

echo ""
echo "🧹 Cleaning up local binary files..."
rm fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe

echo ""
echo "✅ Binary building and upload completed successfully!"
echo ""
echo "📥 Download URLs:"
echo "Linux x64:     https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-x64"
echo "Linux ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-arm64"
echo "macOS Intel:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-x64"
echo "macOS ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-arm64"
echo "Windows:       https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-windows-x64.exe"