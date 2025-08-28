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
echo "  2. Sign all binaries with GPG"
echo "  3. Upload binaries and signatures to the specified GitHub release"
echo "  4. Clean up local binary and signature files"
echo ""
echo "Requirements:"
echo "  - Bun (https://bun.sh/docs/installation)"
echo "  - GitHub CLI (https://cli.github.com/)"
echo "  - Authenticated gh CLI (run: gh auth login)"
echo "  - GPG with a private key (run: gpg --gen-key if needed)"
echo "  - GPG passphrase file at ~/gpg_pass.txt"
echo "  - gpg-wrapper script in project root"
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

# Check if gpg is available
if ! command -v gpg &> /dev/null; then
    echo "❌ Error: GPG is not installed"
    echo "Install GPG to sign binaries (apt install gnupg or similar)"
    exit 1
fi

# Check if gpg has a default key
if ! gpg --list-keys --with-colons | grep -q "^pub:"; then
    echo "❌ Error: No GPG keys found"
    echo "Create a GPG key with: gpg --gen-key"
    exit 1
fi

# Check if passphrase file exists
if [ ! -f ~/gpg_pass.txt ]; then
    echo "❌ Error: GPG passphrase file not found at ~/gpg_pass.txt"
    echo "Create the passphrase file with your GPG key passphrase"
    exit 1
fi

# Check if gpg-wrapper exists and is executable
if [ ! -x "./gpg-wrapper" ]; then
    echo "❌ Error: gpg-wrapper not found or not executable"
    echo "Make sure gpg-wrapper is in the project root and executable"
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
bun build src/binary.ts --target node --compile --production --outfile fosscode-linux-x64

# Build Linux ARM64
echo "Building Linux ARM64..."
bun build src/binary.ts --target node --compile --production --outfile fosscode-linux-arm64

# Build macOS Intel
echo "Building macOS Intel..."
bun build src/binary.ts --target node --compile --production --outfile fosscode-macos-x64

# Build macOS ARM64
echo "Building macOS ARM64..."
bun build src/binary.ts --target node --compile --production --outfile fosscode-macos-arm64

# Build Windows x64
echo "Building Windows x64..."
bun build src/binary.ts --target node --compile --production --outfile fosscode-windows-x64.exe

echo "📦 All binaries built successfully!"
echo ""
echo "📋 Binary sizes:"
ls -lh fosscode-*

echo ""
echo "🔐 Signing binaries with GPG..."

# Function to sign a binary with error handling
sign_binary() {
    local binary_file=$1
    echo "Signing $binary_file..."
    if ./gpg-wrapper --detach-sign --armor "$binary_file" 2>/dev/null; then
        echo "✅ Signed $binary_file"
        return 0
    else
        echo "⚠️  Failed to sign $binary_file"
        echo "   Make sure your GPG key passphrase is in ~/gpg_pass.txt"
        return 1
    fi
}

# Sign each binary
SIGNING_SUCCESS=true
sign_binary fosscode-linux-x64 || SIGNING_SUCCESS=false
sign_binary fosscode-linux-arm64 || SIGNING_SUCCESS=false
sign_binary fosscode-macos-x64 || SIGNING_SUCCESS=false
sign_binary fosscode-macos-arm64 || SIGNING_SUCCESS=false
sign_binary fosscode-windows-x64.exe || SIGNING_SUCCESS=false

if [[ "$SIGNING_SUCCESS" == "true" ]]; then
    echo "✅ All binaries signed successfully!"
    echo ""
    echo "📋 Signature files created:"
    ls -lh fosscode-*.asc
else
    echo "⚠️  Some binaries could not be signed. Uploading unsigned binaries only."
    echo "💡 To enable signing: Make sure ~/gpg_pass.txt contains your GPG key passphrase"
    echo "   and that your GPG key is properly configured"
fi

echo ""
echo "⬆️  Uploading binaries to GitHub release..."

# Prepare upload command with binaries
UPLOAD_FILES=(
    fosscode-linux-x64
    fosscode-linux-arm64
    fosscode-macos-x64
    fosscode-macos-arm64
    fosscode-windows-x64.exe
)

# Add signature files if they exist
if [[ "$SIGNING_SUCCESS" == "true" ]]; then
    UPLOAD_FILES+=(
        fosscode-linux-x64.asc
        fosscode-linux-arm64.asc
        fosscode-macos-x64.asc
        fosscode-macos-arm64.asc
        fosscode-windows-x64.exe.asc
    )
fi

# Upload binaries and signatures to the release
gh release upload $VERSION_TAG "${UPLOAD_FILES[@]}"

echo ""
echo "🧹 Cleaning up local binary files..."
rm fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe

if [[ "$SIGNING_SUCCESS" == "true" ]]; then
    echo "🧹 Cleaning up signature files..."
    rm fosscode-linux-x64.asc fosscode-linux-arm64.asc fosscode-macos-x64.asc fosscode-macos-arm64.asc fosscode-windows-x64.exe.asc
fi

echo ""
if [[ "$SIGNING_SUCCESS" == "true" ]]; then
    echo "✅ Binary building, signing, and upload completed successfully!"
else
    echo "✅ Binary building and upload completed successfully!"
    echo "⚠️  Note: Binaries were not signed due to GPG configuration issues"
fi
echo ""
echo "📥 Download URLs:"
echo "Linux x64:     https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-x64"
echo "Linux ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-arm64"
echo "macOS Intel:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-x64"
echo "macOS ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-arm64"
echo "Windows:       https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-windows-x64.exe"

if [[ "$SIGNING_SUCCESS" == "true" ]]; then
    echo ""
    echo "🔐 Signature files (for verification):"
    echo "Linux x64:     https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-x64.asc"
    echo "Linux ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-linux-arm64.asc"
    echo "macOS Intel:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-x64.asc"
    echo "macOS ARM64:   https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-macos-arm64.asc"
    echo "Windows:       https://github.com/fosscode/fosscode/releases/download/$VERSION_TAG/fosscode-windows-x64.exe.asc"
    echo ""
    echo "🔍 To verify signatures: gpg --verify <signature-file> <binary-file>"
fi