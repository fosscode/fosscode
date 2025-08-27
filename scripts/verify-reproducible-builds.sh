#!/bin/bash

# Reproducible Builds Verification Script
# This script builds the project multiple times and compares outputs to verify reproducibility

set -e

echo "🔍 Verifying Reproducible Builds for fosscode"
echo "=============================================="

# Clean any existing build artifacts
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f fosscode-test-*

# Function to build and hash
build_and_hash() {
    local build_num=$1
    echo "🏗️  Building iteration $build_num..."

    # Clean and build
    bun run clean
    bun run build

    # Create hash of the dist directory
    if [ -d "dist" ]; then
        local hash=$(find dist -type f -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)
        echo "Hash for build $build_num: $hash"
        echo "$hash" > "build-$build_num.hash"
    else
        echo "❌ Build $build_num failed - no dist directory"
        exit 1
    fi
}

# Build multiple times
echo "🔨 Building project 3 times for comparison..."
build_and_hash 1
build_and_hash 2
build_and_hash 3

# Compare hashes
echo ""
echo "📊 Comparing build hashes..."
hash1=$(cat build-1.hash)
hash2=$(cat build-2.hash)
hash3=$(cat build-3.hash)

echo "Build 1: $hash1"
echo "Build 2: $hash2"
echo "Build 3: $hash3"

if [ "$hash1" = "$hash2" ] && [ "$hash2" = "$hash3" ]; then
    echo "✅ SUCCESS: All builds are identical!"
    echo "🎉 Reproducible builds verification passed"
else
    echo "❌ FAILURE: Builds are not identical"
    echo "This indicates the build process is not fully reproducible"
    exit 1
fi

# Clean up
rm -f build-*.hash

echo ""
echo "📋 Build verification completed"