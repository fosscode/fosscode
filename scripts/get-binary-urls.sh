#!/bin/bash

# Simple script to get binary download URLs for a specific version
# Usage: ./scripts/get-binary-urls.sh [version]
# If no version provided, uses the latest release

set -e

# Get the latest release version if not provided
if [ -z "$1" ]; then
    echo "Getting latest release version..."
    VERSION=$(gh release list --limit 1 --json tagName --jq '.[0].tagName')
    if [ -z "$VERSION" ]; then
        echo "Error: Could not get latest release version"
        exit 1
    fi
else
    VERSION="$1"
fi

echo "Binary download URLs for version $VERSION:"
echo

# Get release assets
ASSETS_JSON=$(gh release view "$VERSION" --json assets)

# Extract and display binary URLs
echo "## Linux"
echo "- **x64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-x64") | .url')"
echo "- **ARM64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-arm64") | .url')"
echo

echo "## macOS"
echo "- **Intel (x64)**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-x64") | .url')"
echo "- **Apple Silicon (ARM64)**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-arm64") | .url')"
echo

echo "## Windows"
echo "- **x64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-windows-x64.exe") | .url')"
echo

echo "## Signatures (for verification)"
echo "- **Linux x64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-x64.asc") | .url')"
echo "- **Linux ARM64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-arm64.asc") | .url')"
echo "- **macOS x64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-x64.asc") | .url')"
echo "- **macOS ARM64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-arm64.asc") | .url')"
echo "- **Windows x64**: $(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-windows-x64.exe.asc") | .url')"