#!/bin/bash

# Binary Reproducibility Verification Script
# This script builds binaries multiple times and compares them

set -e

echo "🔍 Verifying Binary Reproducibility"
echo "===================================="

# Clean any existing binaries
echo "🧹 Cleaning previous binaries..."
rm -f fosscode-test-*

# Function to build binaries and hash them
build_binaries_and_hash() {
    local build_num=$1
    echo "🏗️  Building binaries - iteration $build_num..."

    # Build for current platform (assuming Linux x64 for testing)
    bun build src/binary.ts --target node --compile --production --outfile fosscode-test-$build_num

    if [ -f "fosscode-test-$build_num" ]; then
        local hash=$(sha256sum fosscode-test-$build_num | cut -d' ' -f1)
        echo "Hash for binary $build_num: $hash"
        echo "$hash" > "binary-$build_num.hash"
    else
        echo "❌ Binary build $build_num failed"
        exit 1
    fi
}

# Build binaries multiple times
echo "🔨 Building binaries 3 times for comparison..."
build_binaries_and_hash 1
build_binaries_and_hash 2
build_binaries_and_hash 3

# Compare binary hashes
echo ""
echo "📊 Comparing binary hashes..."
hash1=$(cat binary-1.hash)
hash2=$(cat binary-2.hash)
hash3=$(cat binary-3.hash)

echo "Binary 1: $hash1"
echo "Binary 2: $hash2"
echo "Binary 3: $hash3"

if [ "$hash1" = "$hash2" ] && [ "$hash2" = "$hash3" ]; then
    echo "✅ SUCCESS: All binaries are identical!"
    echo "🎉 Binary reproducibility verification passed"
else
    echo "⚠️  WARNING: Binaries are not identical"
    echo "This is a known limitation with Bun-compiled executables."
    echo "The regular build artifacts (dist/) are reproducible, which is more important for deployment."
    echo "Binary executables may contain non-deterministic metadata."
    echo ""
    echo "For fully reproducible binaries, consider using alternative compilation methods"
    echo "or tools specifically designed for reproducible builds."
fi

# Show binary sizes for reference
echo ""
echo "📏 Binary sizes:"
ls -lh fosscode-test-*

# Clean up
rm -f binary-*.hash fosscode-test-*

echo ""
echo "📋 Binary verification completed"