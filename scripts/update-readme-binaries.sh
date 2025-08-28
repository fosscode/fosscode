#!/bin/bash

# Script to update README.md with latest binary download URLs
# Usage: ./scripts/update-readme-binaries.sh [version]
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

echo "Updating README.md with binary URLs for version $VERSION..."

# Get release assets
ASSETS_JSON=$(gh release view "$VERSION" --json assets)

# Extract binary URLs
LINUX_X64_URL=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-x64") | .url')
LINUX_X64_ASC=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-x64.asc") | .url')

LINUX_ARM64_URL=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-arm64") | .url')
LINUX_ARM64_ASC=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-linux-arm64.asc") | .url')

MACOS_X64_URL=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-x64") | .url')
MACOS_X64_ASC=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-x64.asc") | .url')

MACOS_ARM64_URL=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-arm64") | .url')
MACOS_ARM64_ASC=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-macos-arm64.asc") | .url')

WINDOWS_X64_URL=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-windows-x64.exe") | .url')
WINDOWS_X64_ASC=$(echo "$ASSETS_JSON" | jq -r '.assets[] | select(.name == "fosscode-windows-x64.exe.asc") | .url')

# Check if all URLs were found
if [ -z "$LINUX_X64_URL" ] || [ -z "$MACOS_X64_URL" ] || [ -z "$WINDOWS_X64_URL" ]; then
    echo "Error: Could not find all required binary assets for version $VERSION"
    exit 1
fi

# Create the replacement content
NEW_CONTENT="### Binary Installation (Latest: $VERSION)

Download the latest pre-built binaries for your platform:

#### Linux
- **x64**: [fosscode-linux-x64]($LINUX_X64_URL) | [Signature]($LINUX_X64_ASC)
- **ARM64**: [fosscode-linux-arm64]($LINUX_ARM64_URL) | [Signature]($LINUX_ARM64_ASC)

#### macOS
- **Intel (x64)**: [fosscode-macos-x64]($MACOS_X64_URL) | [Signature]($MACOS_X64_ASC)
- **Apple Silicon (ARM64)**: [fosscode-macos-arm64]($MACOS_ARM64_URL) | [Signature]($MACOS_ARM64_ASC)

#### Windows
- **x64**: [fosscode-windows-x64.exe]($WINDOWS_X64_URL) | [Signature]($WINDOWS_X64_ASC)

**Installation Steps:**
\`\`\`bash
# Download the appropriate binary for your platform
curl -L -o fosscode https://github.com/fosscode/fosscode/releases/download/$VERSION/fosscode-linux-x64  # Replace with your platform
chmod +x fosscode
sudo mv fosscode /usr/local/bin/  # Or add to your PATH
\`\`\`

**Verify Installation:**
\`\`\`bash
# Verify the binary signature (optional)
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 5A4818774F6CA92319CE88A45ACBB22988757D6E
gpg --verify fosscode.asc fosscode
\`\`\`"

# Update the README.md file
# Create backup
cp README.md README.md.backup

# Use Python for the replacement since sed has issues with multi-line content
python3 -c "
import re
import sys

# Read the README
with open('README.md', 'r') as f:
    content = f.read()

# Create the replacement pattern
pattern = r'### Binary Installation \(Latest:.*?\)### NPM Install \(Coming Soon\)'

# Replace the section
new_content = '''$NEW_CONTENT
### NPM Install (Coming Soon)'''

replacement = re.sub(pattern, new_content, content, flags=re.DOTALL)

# Write back
with open('README.md', 'w') as f:
    f.write(replacement)
"

echo "✅ README.md updated with binary URLs for version $VERSION"
echo "📋 Binary URLs:"
echo "  Linux x64: $LINUX_X64_URL"
echo "  Linux ARM64: $LINUX_ARM64_URL"
echo "  macOS x64: $MACOS_X64_URL"
echo "  macOS ARM64: $MACOS_ARM64_URL"
echo "  Windows x64: $WINDOWS_X64_URL"