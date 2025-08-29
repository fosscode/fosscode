#!/bin/bash

# Reproducible Builds Verification Script for fosscode
# This script builds the same binary twice and compares them for byte-for-byte equality
# Usage: ./scripts/test-reproducibility.sh

set -e

echo "🔬 Testing Build Reproducibility for fosscode"
echo "=============================================="

# Validate environment
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed"
    echo "Install from: https://bun.sh/docs/installation"
    exit 1
fi

if [ ! -f "src/binary.ts" ]; then
    echo "❌ Error: src/binary.ts not found"
    exit 1
fi

echo "🔍 Current Bun version: $(bun --version)"
echo "🔍 Current Node version: $(node --version)"
echo "🔍 Current OS: $(uname -a)"
echo ""

# Clean any existing test binaries
echo "🧹 Cleaning existing test binaries..."
rm -f fosscode-test-build-1 fosscode-test-build-2

# Create temporary directory for builds
BUILD_DIR=$(mktemp -d)
echo "📁 Using temporary build directory: $BUILD_DIR"

# Build 1
echo "🔨 Building binary #1..."
cd "$BUILD_DIR"
cp -r "$OLDPWD"/* ./ 2>/dev/null || true  # Copy all files, ignore errors for directories
bun build src/binary.ts --target node --compile --outfile fosscode-test-build-1
BUILD1_SIZE=$(stat -f%z fosscode-test-build-1 2>/dev/null || stat -c%s fosscode-test-build-1)
BUILD1_HASH=$(shasum -a 256 fosscode-test-build-1 | cut -d' ' -f1)
BUILD1_TIME=$(date)

echo "   Size: $BUILD1_SIZE bytes"
echo "   SHA256: $BUILD1_HASH"
echo "   Built at: $BUILD1_TIME"

# Small delay to ensure different timestamps if they're included
echo "⏱️  Waiting 2 seconds before second build..."
sleep 2

# Build 2
echo "🔨 Building binary #2..."
bun build src/binary.ts --target node --compile --outfile fosscode-test-build-2
BUILD2_SIZE=$(stat -f%z fosscode-test-build-2 2>/dev/null || stat -c%s fosscode-test-build-2)
BUILD2_HASH=$(shasum -a 256 fosscode-test-build-2 | cut -d' ' -f1)
BUILD2_TIME=$(date)

echo "   Size: $BUILD2_SIZE bytes"  
echo "   SHA256: $BUILD2_HASH"
echo "   Built at: $BUILD2_TIME"

# Compare builds
echo ""
echo "🔍 Comparing builds..."
echo "Build 1 - Size: $BUILD1_SIZE bytes, SHA256: $BUILD1_HASH"
echo "Build 2 - Size: $BUILD2_SIZE bytes, SHA256: $BUILD2_HASH"

# Copy builds back to original directory for inspection
cp fosscode-test-build-1 "$OLDPWD/"
cp fosscode-test-build-2 "$OLDPWD/"
cd "$OLDPWD"

# Clean up temp directory
rm -rf "$BUILD_DIR"

echo ""
if [ "$BUILD1_HASH" = "$BUILD2_HASH" ]; then
    echo "✅ SUCCESS: Builds are identical!"
    echo "   Both builds have the same SHA256 hash: $BUILD1_HASH"
    echo "   Build reproducibility: PASSED"
    echo ""
    echo "🧹 Cleaning up test binaries..."
    rm -f fosscode-test-build-1 fosscode-test-build-2
    echo "✨ All test artifacts cleaned up"
else
    echo "❌ FAILURE: Builds are different!"
    echo "   Build 1 SHA256: $BUILD1_HASH"
    echo "   Build 2 SHA256: $BUILD2_HASH"
    echo "   Build reproducibility: FAILED"
    echo ""
    echo "🔍 Binary files saved as fosscode-test-build-1 and fosscode-test-build-2 for inspection"
    echo ""
    echo "🛠️  To investigate differences:"
    echo "   hexdump -C fosscode-test-build-1 | head -20"
    echo "   hexdump -C fosscode-test-build-2 | head -20"
    echo "   diff <(hexdump -C fosscode-test-build-1) <(hexdump -C fosscode-test-build-2) | head -10"
    
    # Try to identify common sources of non-determinism
    echo ""
    echo "🔍 Checking for common non-deterministic patterns..."
    
    # Check for timestamps in the binaries
    if strings fosscode-test-build-1 | grep -E "[0-9]{4}-[0-9]{2}-[0-9]{2}" >/dev/null; then
        echo "   📅 Found potential timestamps in binary"
    fi
    
    # Check for build paths
    if strings fosscode-test-build-1 | grep -E "/tmp/|/build/" >/dev/null; then
        echo "   📁 Found potential build paths in binary"
    fi
    
    exit 1
fi

echo ""
echo "🎉 Reproducible build test completed successfully!"