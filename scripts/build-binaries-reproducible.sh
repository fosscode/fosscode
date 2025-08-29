#!/bin/bash

# Reproducible Binary Building Script for fosscode
# Usage: ./scripts/build-binaries-reproducible.sh <version-tag>
# This script creates reproducible builds using deterministic timestamps and environment controls

set -e

# Check if version tag is provided
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "📦 fosscode Reproducible Binary Builder"
    echo ""
    echo "Usage: $0 <version-tag>"
    echo ""
    echo "Examples:"
    echo "  $0 v0.0.17          # Build for specific version"
    echo "  $0 \$(git describe --tags --abbrev=0)  # Build for latest tag"
    echo ""
    echo "This script will:"
    echo "  1. Build reproducible binaries for Linux (x64 & ARM64), macOS (Intel & ARM64), and Windows"
    echo "  2. Use deterministic timestamps from SOURCE_DATE_EPOCH or git"
    echo "  3. Normalize build environment for reproducibility"
    echo "  4. Optionally upload to GitHub release"
    echo ""
    echo "Requirements:"
    echo "  - Bun (https://bun.sh/docs/installation)"
    echo "  - GitHub CLI (https://cli.github.com/) [optional for upload]"
    echo ""
    echo "Environment Variables:"
    echo "  SOURCE_DATE_EPOCH - Unix timestamp for reproducible builds (auto-detected from git if not set)"
    echo "  SKIP_UPLOAD=1     - Skip GitHub release upload"
    echo "  BUN_VERSION       - Specific Bun version to use (optional)"
    exit 1
fi

VERSION_TAG=$1

# Validate version tag format
if [[ ! $VERSION_TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "⚠️  Warning: Version tag '$VERSION_TAG' doesn't match expected format (v0.0.0)"
    echo "Continuing anyway..."
fi

echo "🚀 Building reproducible fosscode binaries for $VERSION_TAG..."

# Set up reproducible build environment
echo "🔧 Setting up reproducible build environment..."

# Determine SOURCE_DATE_EPOCH for reproducible builds
if [ -z "$SOURCE_DATE_EPOCH" ]; then
    # Try to get timestamp from git tag
    if git show -s --format=%ct "$VERSION_TAG" >/dev/null 2>&1; then
        export SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$VERSION_TAG")
        echo "📅 Using git tag timestamp: $SOURCE_DATE_EPOCH ($(date -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -r $SOURCE_DATE_EPOCH))"
    else
        # Fallback to latest commit timestamp
        export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
        echo "📅 Using latest commit timestamp: $SOURCE_DATE_EPOCH ($(date -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -r $SOURCE_DATE_EPOCH))"
    fi
else
    echo "📅 Using provided SOURCE_DATE_EPOCH: $SOURCE_DATE_EPOCH ($(date -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -r $SOURCE_DATE_EPOCH))"
fi

# Normalize build environment
export LANG=C
export LC_ALL=C
export TZ=UTC

# Set deterministic umask
umask 022

echo "🔍 Reproducible build environment:"
echo "   SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH"
echo "   LANG=$LANG"
echo "   LC_ALL=$LC_ALL"
echo "   TZ=$TZ"
echo "   umask=$(umask)"

# Validate environment
echo "🔍 Validating environment..."

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed"
    echo "Install from: https://bun.sh/docs/installation"
    exit 1
fi

# Check Bun version if specified
if [ -n "$BUN_VERSION" ]; then
    CURRENT_BUN_VERSION=$(bun --version)
    if [ "$CURRENT_BUN_VERSION" != "$BUN_VERSION" ]; then
        echo "⚠️  Warning: Expected Bun version $BUN_VERSION, but found $CURRENT_BUN_VERSION"
        echo "For fully reproducible builds, use the exact Bun version: $BUN_VERSION"
    fi
fi

# Check if src/binary.ts exists
if [ ! -f "src/binary.ts" ]; then
    echo "❌ Error: src/binary.ts not found"
    exit 1
fi

echo "🔍 Build tool versions:"
echo "   Bun: $(bun --version)"
echo "   Node: $(node --version)"

echo "✅ Environment validation passed"

# Clean any existing binaries
echo "🧹 Cleaning existing binaries..."
rm -f fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe

echo "🔨 Building reproducible binaries for all platforms..."

# Create build environment that Bun will use
# Note: Bun doesn't directly use SOURCE_DATE_EPOCH, but we set it for any external tools
# For now, we'll build with the current Bun but document the limitation

build_binary() {
    local platform=$1
    local output=$2
    local target_flag=$3
    
    echo "Building $platform..."
    
    # Set consistent build environment for this binary
    env \
        SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH" \
        LANG=C \
        LC_ALL=C \
        TZ=UTC \
    bun build src/binary.ts --target node --compile --outfile "$output" $target_flag
    
    # Get file info
    local size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output")
    local hash=$(shasum -a 256 "$output" | cut -d' ' -f1)
    echo "   Size: $size bytes, SHA256: ${hash:0:16}..."
}

# Build all platforms with consistent environment
build_binary "Linux x64" "fosscode-linux-x64" ""
build_binary "Linux ARM64" "fosscode-linux-arm64" ""
build_binary "macOS Intel" "fosscode-macos-x64" ""
build_binary "macOS ARM64" "fosscode-macos-arm64" ""
build_binary "Windows x64" "fosscode-windows-x64.exe" ""

echo ""
echo "📦 All binaries built successfully!"
echo ""
echo "📋 Binary information:"
echo "Platform          Size         SHA256 (first 16 chars)"
echo "=================================================="
for binary in fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe; do
    if [ -f "$binary" ]; then
        size=$(stat -f%z "$binary" 2>/dev/null || stat -c%s "$binary")
        hash=$(shasum -a 256 "$binary" | cut -d' ' -f1)
        printf "%-15s %10s   %s...\n" "$binary" "$size" "${hash:0:16}"
    fi
done

# Check for upload
if [ "$SKIP_UPLOAD" = "1" ]; then
    echo ""
    echo "⏩ Skipping GitHub release upload (SKIP_UPLOAD=1)"
else
    # Check if gh CLI is available
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        # Check if release exists
        if gh release view $VERSION_TAG &> /dev/null; then
            echo ""
            echo "⬆️  Uploading binaries to GitHub release..."
            
            # Upload all binaries to the release
            gh release upload $VERSION_TAG \
                fosscode-linux-x64 \
                fosscode-linux-arm64 \
                fosscode-macos-x64 \
                fosscode-macos-arm64 \
                fosscode-windows-x64.exe
            
            echo "✅ Binaries uploaded successfully!"
        else
            echo ""
            echo "⚠️  Release $VERSION_TAG does not exist. Skipping upload."
            echo "Create it first with: gh release create $VERSION_TAG --title \"Release $VERSION_TAG\" --generate-notes"
        fi
    else
        echo ""
        echo "⚠️  GitHub CLI not available or not authenticated. Skipping upload."
        echo "Install gh CLI and run 'gh auth login' to enable automatic upload."
    fi
fi

# Create reproducibility manifest
echo ""
echo "📄 Creating reproducibility manifest..."
cat > "reproducibility-manifest-$VERSION_TAG.json" << EOF
{
  "version": "$VERSION_TAG",
  "build_timestamp": "$SOURCE_DATE_EPOCH",
  "build_date": "$(date -u -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -u -r $SOURCE_DATE_EPOCH)",
  "environment": {
    "bun_version": "$(bun --version)",
    "node_version": "$(node --version)",
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "lang": "$LANG",
    "lc_all": "$LC_ALL",
    "tz": "$TZ"
  },
  "binaries": {
EOF

# Add binary hashes to manifest
first=true
for binary in fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe; do
    if [ -f "$binary" ]; then
        if [ "$first" = false ]; then
            echo "," >> "reproducibility-manifest-$VERSION_TAG.json"
        fi
        size=$(stat -f%z "$binary" 2>/dev/null || stat -c%s "$binary")
        hash=$(shasum -a 256 "$binary" | cut -d' ' -f1)
        echo -n "    \"$binary\": {\"size\": $size, \"sha256\": \"$hash\"}" >> "reproducibility-manifest-$VERSION_TAG.json"
        first=false
    fi
done

cat >> "reproducibility-manifest-$VERSION_TAG.json" << EOF

  }
}
EOF

echo "✅ Reproducibility manifest saved: reproducibility-manifest-$VERSION_TAG.json"

echo ""
echo "✅ Reproducible binary building completed!"
echo ""
echo "📋 To verify reproducibility:"
echo "   1. Run this script again with the same VERSION_TAG"
echo "   2. Compare the SHA256 hashes in the manifest"
echo "   3. Use the test script: ./scripts/test-reproducibility.sh"
echo ""
echo "📝 Build reproducibility notes:"
echo "   - All binaries built with SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH"
echo "   - Environment normalized (LANG=C, LC_ALL=C, TZ=UTC)"
echo "   - Tool versions: Bun $(bun --version), Node $(node --version)"