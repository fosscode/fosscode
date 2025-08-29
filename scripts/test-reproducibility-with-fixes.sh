#!/bin/bash

# Enhanced Reproducible Builds Verification Script for fosscode
# This script tests reproducibility with deterministic build environment
# Usage: ./scripts/test-reproducibility-with-fixes.sh

set -e

echo "🔬 Testing Enhanced Build Reproducibility for fosscode"
echo "======================================================="

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

# Set up reproducible build environment
echo "🔧 Setting up deterministic build environment..."

# Use fixed timestamp for reproducible builds
if [ -z "$SOURCE_DATE_EPOCH" ]; then
    # Use git timestamp or fixed epoch
    if git log -1 --format=%ct >/dev/null 2>&1; then
        export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
        echo "📅 Using git commit timestamp: $SOURCE_DATE_EPOCH"
    else
        # Fixed timestamp for truly deterministic builds
        export SOURCE_DATE_EPOCH=1672531200  # 2023-01-01 00:00:00 UTC
        echo "📅 Using fixed timestamp: $SOURCE_DATE_EPOCH"
    fi
else
    echo "📅 Using provided SOURCE_DATE_EPOCH: $SOURCE_DATE_EPOCH"
fi

# Normalize build environment
export LANG=C
export LC_ALL=C
export TZ=UTC

# Set deterministic umask
umask 022

# Set deterministic temporary directory to avoid /tmp paths in binary
export TMPDIR="/tmp/reproducible-build-$SOURCE_DATE_EPOCH"
export TEMP="$TMPDIR"
export TMP="$TMPDIR"
mkdir -p "$TMPDIR"
echo "📁 Using deterministic TMPDIR: $TMPDIR"

# Additional environment variables for reproducible builds
export SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH"
export ZERO_AR_DATE=1  # For ar archives
export AR_FLAGS="D"    # Deterministic mode for ar

# Try to override Bun's internal temp directory usage
export BUN_TMPDIR="$TMPDIR"
export BUN_CACHE_DIR="$TMPDIR/.bun-cache"
mkdir -p "$BUN_CACHE_DIR"

# Force deterministic behavior
export NODE_OPTIONS="--require=/dev/null" 2>/dev/null || true

# Set fixed seed for any random operations
export RANDOM_SEED=12345
export BUN_RANDOM_SEED=12345

# Try to disable ASLR for more deterministic builds
echo 0 | tee /proc/sys/kernel/randomize_va_space >/dev/null 2>&1 || true

# Clean Bun cache to ensure clean builds
rm -rf "$HOME/.bun/cache" 2>/dev/null || true
rm -rf "$TMPDIR/.bun-cache" 2>/dev/null || true
mkdir -p "$TMPDIR/.bun-cache"

echo "🔍 Build environment:"
echo "   SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH ($(date -u -d @$SOURCE_DATE_EPOCH 2>/dev/null || date -u -r $SOURCE_DATE_EPOCH))"
echo "   LANG=$LANG"
echo "   LC_ALL=$LC_ALL"
echo "   TZ=$TZ"
echo "   umask=$(umask)"
echo ""

# Clean any existing test binaries
echo "🧹 Cleaning existing test binaries..."
rm -f fosscode-repro-test-1 fosscode-repro-test-2

# Function to build with deterministic environment
build_reproducible() {
    local output=$1
    local build_num=$2

    echo "🔨 Building reproducible binary #$build_num..."

    # Build with normalized environment including deterministic TMPDIR
    # Try different compilation strategies to improve reproducibility
    env \
        SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH" \
        LANG=C \
        LC_ALL=C \
        TZ=UTC \
        TMPDIR="$TMPDIR" \
        TEMP="$TMPDIR" \
        TMP="$TMPDIR" \
        ZERO_AR_DATE=1 \
        AR_FLAGS="D" \
        BUN_TMPDIR="$TMPDIR" \
        BUN_CACHE_DIR="$TMPDIR/.bun-cache" \
        RANDOM_SEED=12345 \
        BUN_RANDOM_SEED=12345 \
    bun build src/binary.ts --target node --compile --outfile "$output" --minify

    local size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output")
    local hash=$(shasum -a 256 "$output" | cut -d' ' -f1)
    local build_time=$(date -u)

    echo "   Size: $size bytes"
    echo "   SHA256: $hash"
    echo "   Built at: $build_time (UTC)"

    # Store values for comparison
    if [ $build_num -eq 1 ]; then
        BUILD1_SIZE=$size
        BUILD1_HASH=$hash
        BUILD1_TIME=$build_time
    else
        BUILD2_SIZE=$size
        BUILD2_HASH=$hash
        BUILD2_TIME=$build_time
    fi
}

# Build 1
build_reproducible "fosscode-repro-test-1" 1

# Small delay between builds
echo ""
echo "⏱️  Waiting 2 seconds before second build (testing timestamp independence)..."
sleep 2

# Build 2
build_reproducible "fosscode-repro-test-2" 2

# Compare builds
echo ""
echo "🔍 Comparing reproducible builds..."
echo "Build 1 - Size: $BUILD1_SIZE bytes, SHA256: $BUILD1_HASH"
echo "Build 2 - Size: $BUILD2_SIZE bytes, SHA256: $BUILD2_HASH"

echo ""
if [ "$BUILD1_HASH" = "$BUILD2_HASH" ]; then
    echo "✅ SUCCESS: Reproducible builds are identical!"
    echo "   Both builds have the same SHA256 hash: $BUILD1_HASH"  
    echo "   Size consistency: $BUILD1_SIZE bytes"
    echo "   Build reproducibility: PASSED"
    echo ""
    
    # Additional verification
    echo "🔍 Additional verification:"
    if cmp -s fosscode-repro-test-1 fosscode-repro-test-2; then
        echo "   ✅ Binary comparison (cmp): Files are byte-for-byte identical"
    else
        echo "   ❌ Binary comparison (cmp): Files differ (unexpected!)"
    fi
    
    echo ""
    echo "🧹 Cleaning up test binaries..."
    rm -f fosscode-repro-test-1 fosscode-repro-test-2
    echo "✨ All test artifacts cleaned up"
    
    echo ""
    echo "🎉 Enhanced reproducible build test PASSED!"
    echo ""
    echo "📋 Reproducibility verified with:"
    echo "   - Deterministic SOURCE_DATE_EPOCH: $SOURCE_DATE_EPOCH"
    echo "   - Normalized locale (LANG=C, LC_ALL=C)"
    echo "   - Fixed timezone (TZ=UTC)"
    echo "   - Consistent umask (022)"
    echo "   - Multiple build iterations with time delays"
    
else
    echo "❌ FAILURE: Reproducible builds are still different!"
    echo "   Build 1 SHA256: $BUILD1_HASH"
    echo "   Build 2 SHA256: $BUILD2_HASH"
    echo "   Build reproducibility: FAILED"
    echo ""
    echo "🔍 Binary files saved as fosscode-repro-test-1 and fosscode-repro-test-2 for inspection"
    echo ""
    echo "🛠️  To investigate remaining differences:"
    echo "   hexdump -C fosscode-repro-test-1 | head -30"
    echo "   hexdump -C fosscode-repro-test-2 | head -30"
    echo "   diff <(hexdump -C fosscode-repro-test-1) <(hexdump -C fosscode-repro-test-2) | head -20"
    echo ""
    
    # Enhanced analysis of remaining non-determinism
    echo "🔍 Enhanced analysis of non-deterministic elements:"
    
    # Check for timestamps
    if strings fosscode-repro-test-1 | grep -E "[0-9]{4}-[0-9]{2}-[0-9]{2}" >/dev/null; then
        echo "   📅 Found timestamps in binary"
        echo "      Sample timestamps:"
        strings fosscode-repro-test-1 | grep -E "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -3 | sed 's/^/      /'
    fi
    
    # Check for build paths
    if strings fosscode-repro-test-1 | grep -E "/(tmp|build|home)/" >/dev/null; then
        echo "   📁 Found build paths in binary"
        echo "      Sample paths:"
        strings fosscode-repro-test-1 | grep -E "/(tmp|build|home)/" | head -3 | sed 's/^/      /'
    fi
    
    # Check for UUIDs or random values
    if strings fosscode-repro-test-1 | grep -E "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" >/dev/null; then
        echo "   🔄 Found potential UUIDs in binary"
    fi
    
    # Check for memory addresses
    if strings fosscode-repro-test-1 | grep -E "0x[0-9a-f]{8,}" >/dev/null; then
        echo "   💾 Found potential memory addresses in binary"
    fi
    
    echo ""
    echo "📝 This indicates Bun's compile process may include build-time information"
    echo "   that cannot be controlled via SOURCE_DATE_EPOCH alone."
    echo ""
    echo "🛠️  Potential solutions:"
    echo "   1. Use Bun flags to disable timestamp inclusion (if available)"
    echo "   2. Post-process binaries to normalize timestamps"
    echo "   3. Use different compilation strategy"
    echo "   4. Contact Bun maintainers about reproducible builds support"

    # Try post-processing to normalize timestamps and paths
    echo ""
    echo "🔧 Attempting post-processing fixes..."

    # Create normalized copies for comparison
    cp fosscode-repro-test-1 fosscode-repro-test-1-normalized
    cp fosscode-repro-test-2 fosscode-repro-test-2-normalized

    # More aggressive post-processing using hex manipulation
    echo "   📝 Attempting to normalize embedded timestamps and paths..."

    # Use perl for more sophisticated binary editing
    if command -v perl >/dev/null; then
        # Normalize date patterns (YYYY-MM-DD)
        perl -pe 's/\d{4}-\d{2}-\d{2}/2023-01-01/g' fosscode-repro-test-1-normalized > fosscode-repro-test-1-temp && mv fosscode-repro-test-1-temp fosscode-repro-test-1-normalized
        perl -pe 's/\d{4}-\d{2}-\d{2}/2023-01-01/g' fosscode-repro-test-2-normalized > fosscode-repro-test-2-temp && mv fosscode-repro-test-2-temp fosscode-repro-test-2-normalized

        # Normalize time patterns (HH:MM:SS)
        perl -pe 's/\d{2}:\d{2}:\d{2}/12:00:00/g' fosscode-repro-test-1-normalized > fosscode-repro-test-1-temp && mv fosscode-repro-test-1-temp fosscode-repro-test-1-normalized
        perl -pe 's/\d{2}:\d{2}:\d{2}/12:00:00/g' fosscode-repro-test-2-normalized > fosscode-repro-test-2-temp && mv fosscode-repro-test-2-temp fosscode-repro-test-2-normalized

        # Normalize /tmp/bun-node-* paths
        perl -pe 's|/tmp/bun-node-[a-f0-9]+|/tmp/bun-node-fixed|g' fosscode-repro-test-1-normalized > fosscode-repro-test-1-temp && mv fosscode-repro-test-1-temp fosscode-repro-test-1-normalized
        perl -pe 's|/tmp/bun-node-[a-f0-9]+|/tmp/bun-node-fixed|g' fosscode-repro-test-2-normalized > fosscode-repro-test-2-temp && mv fosscode-repro-test-2-temp fosscode-repro-test-2-normalized
    fi

    # Compare normalized binaries
    NORM_HASH1=$(shasum -a 256 fosscode-repro-test-1-normalized | cut -d' ' -f1)
    NORM_HASH2=$(shasum -a 256 fosscode-repro-test-2-normalized | cut -d' ' -f1)

    echo "   Normalized Build 1 SHA256: $NORM_HASH1"
    echo "   Normalized Build 2 SHA256: $NORM_HASH2"

    if [ "$NORM_HASH1" = "$NORM_HASH2" ]; then
        echo "   ✅ Post-processing successful: Normalized binaries are identical"
        echo "   📝 This suggests the differences are due to embedded timestamps and paths"
        echo "   💡 Consider integrating this normalization into the build process"
    else
        echo "   ❌ Post-processing unsuccessful: Normalized binaries still differ"
        echo "   📝 This indicates more complex non-deterministic elements (UUIDs, memory addresses)"

        # Try one more approach: compare only the executable sections
        echo "   🔍 Attempting to compare executable sections only..."
        if command -v objdump >/dev/null; then
            objdump -d fosscode-repro-test-1-normalized > /tmp/dump1 2>/dev/null || echo "   objdump failed for binary 1"
            objdump -d fosscode-repro-test-2-normalized > /tmp/dump2 2>/dev/null || echo "   objdump failed for binary 2"
            if [ -f /tmp/dump1 ] && [ -f /tmp/dump2 ]; then
                EXEC_HASH1=$(shasum -a 256 /tmp/dump1 | cut -d' ' -f1)
                EXEC_HASH2=$(shasum -a 256 /tmp/dump2 | cut -d' ' -f1)
                echo "   Executable section 1 SHA256: $EXEC_HASH1"
                echo "   Executable section 2 SHA256: $EXEC_HASH2"
                if [ "$EXEC_HASH1" = "$EXEC_HASH2" ]; then
                    echo "   ✅ Executable sections are identical - differences are in metadata only"
                fi
            fi
        fi
    fi

    exit 1
fi