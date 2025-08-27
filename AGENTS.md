# Agents

## User Notify Script

Location: /home/dev/user_notify.py

This script allows sending messages to the user and waiting for replies.

It automatically loads environment variables from /home/dev/.env

Usage: python3 /home/dev/user_notify.py "message"

It sends the message to the configured chat and waits for a reply, printing it to stdout.

Note: Requires bot token and chat ID in .env file (not included here for security)

## Binary Building and Release Process

### Overview

fosscode builds static binaries for multiple platforms (Linux x64, Linux ARM64, macOS Intel, macOS ARM64, Windows) using Bun's compile feature. These binaries are uploaded manually to GitHub releases since GitHub Actions lacks permission to upload release assets.

### Automated Scripts

#### `scripts/build-binaries.sh`

**Location:** `/home/dev/fosscode/scripts/build-binaries.sh`

**Purpose:** Builds static binaries for all platforms and uploads them to a GitHub release.

**Usage:**

```bash
./scripts/build-binaries.sh <version-tag>
```

**Examples:**

```bash
./scripts/build-binaries.sh v0.0.17
./scripts/build-binaries.sh $(git describe --tags --abbrev=0)  # Latest tag
```

**Features:**

- ✅ Environment validation (Bun, GitHub CLI, authentication)
- ✅ Builds 5 platform binaries (Linux x64/ARM64, macOS Intel/ARM64, Windows)
- ✅ Uploads all binaries to GitHub release
- ✅ Cleans up local files after upload
- ✅ Provides download URLs
- ✅ Comprehensive error handling

**What it does:**

1. Validates environment and requirements
2. Builds 4 platform-specific binaries using Bun
3. Verifies the GitHub release exists
4. Uploads all binaries to the specified GitHub release
5. Cleans up local binary files after upload
6. Displays download URLs for verification

#### `scripts/release.sh`

**Location:** `/home/dev/fosscode/scripts/release.sh`

**Purpose:** Automates the version bump, build, test, and tagging process.

**Usage:**

```bash
./scripts/release.sh [patch|minor|major]
```

**Example:**

```bash
./scripts/release.sh patch  # bumps 0.0.17 -> 0.0.18
```

**What it does:**

1. Increments version number
2. Builds and tests the project
3. Commits changes with new version
4. Pushes to GitHub and creates git tag
5. Provides instructions for creating GitHub release

### Manual Binary Building Process

If you need to build binaries manually (for testing or custom builds):

#### Build All Platforms

```bash
# Linux x64
bun build src/binary.ts --target node --compile --outfile fosscode-linux-x64

# Linux ARM64
bun build src/binary.ts --target node --compile --outfile fosscode-linux-arm64

# macOS Intel
bun build src/binary.ts --target node --compile --outfile fosscode-macos-x64

# macOS ARM64 (Apple Silicon)
bun build src/binary.ts --target node --compile --outfile fosscode-macos-arm64

# Windows x64
bun build src/binary.ts --target node --compile --outfile fosscode-windows-x64.exe
```

#### Upload to GitHub Release

```bash
gh release upload <tag> fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe
```

#### Clean Up

```bash
rm fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe
```

### Complete Release Workflow for LLMs

#### Step 1: Prepare Release

```bash
cd /home/dev/fosscode
./scripts/release.sh patch
```

#### Step 2: Create GitHub Release

```bash
gh release create v0.0.18 --title "Release v0.0.18" --generate-notes
```

#### Step 3: Build and Upload Binaries

```bash
./scripts/build-binaries.sh v0.0.18
```

#### Alternative: Manual Process

```bash
# Build binaries
bun build src/binary.ts --target node --compile --outfile fosscode-linux-x64
bun build src/binary.ts --target node --compile --outfile fosscode-linux-arm64
bun build src/binary.ts --target node --compile --outfile fosscode-macos-x64
bun build src/binary.ts --target node --compile --outfile fosscode-macos-arm64
bun build src/binary.ts --target node --compile --outfile fosscode-windows-x64.exe

# Upload to release
gh release upload v0.0.18 fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe

# Clean up
rm fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe
```

### Binary Specifications

- **Format:** Standalone executable compiled with Bun
- **Target:** Node.js runtime (bundled)
- **Platforms:**
  - Linux x64 (~98MB)
  - Linux ARM64 (~98MB)
  - macOS Intel x64 (~98MB)
  - macOS ARM64 (~98MB)
  - Windows x64 (~98MB)
- **Dependencies:** All dependencies bundled, no external requirements

### Troubleshooting

#### Build Fails

- Ensure Bun is installed: `curl -fsSL https://bun.sh/install | bash`
- Check that `src/binary.ts` exists and is valid
- Verify all dependencies are installed: `bun install`

#### Upload Fails

- Ensure you have `gh` CLI installed and authenticated
- Verify the release tag exists: `gh release list`
- Check that you have permission to upload to the repository

#### Permission Issues

- GitHub Actions cannot upload release assets due to token restrictions
- Always build and upload binaries manually or via local scripts
- The release workflow handles testing and changelog generation only

### Quick Start for LLMs

#### Complete Automated Workflow

```bash
# 1. Create and prepare release
cd /home/dev/fosscode
./scripts/release.sh patch

# 2. Create GitHub release (copy the URL from step 1)
gh release create v0.0.18 --title "Release v0.0.18" --generate-notes

# 3. Build and upload binaries
./scripts/build-binaries.sh v0.0.18
```

#### That's it! 🎉

The script handles everything automatically:

- Environment validation
- Binary building for all platforms
- Upload to GitHub release
- Cleanup and verification

### File Locations

- **Source:** `src/binary.ts`
- **Build Script:** `scripts/build-binaries.sh`
- **Release Script:** `scripts/release.sh`
- **Package Config:** `package.json` (build scripts)
- **Workflow:** `.github/workflows/release.yml`
- **Documentation:** `AGENTS.md` (this file)

## Reproducible Builds

### Overview

fosscode implements reproducible builds to ensure that the same source code produces identical build artifacts across different environments and build times. This is crucial for security, debugging, and deployment consistency.

### Implementation

#### Build Environment Standardization

- **Bun Version Pinning:** All build environments use Bun version 1.2.21
  - CI/CD workflows: Pinned in `.github/workflows/*.yml`
  - Local development: Specified in `.bun-version`
  - Docker: Uses `oven/bun:1.2.21` base image

- **Dependency Locking:** Dependencies are locked using `bun.lock`
- **Build Flags:** Consistent use of `--production` flag for optimization

#### Package Configuration

- **Exact Versions:** `package.json` uses exact dependency versions instead of ranges
- **Build Scripts:** Standardized build commands with consistent flags

### Verification

#### Local Verification

Run reproducible build verification locally:

```bash
# Verify regular builds
./scripts/verify-reproducible-builds.sh

# Verify binary reproducibility (may have limitations)
./scripts/verify-binary-reproducibility.sh
```

#### CI/CD Verification

The CI pipeline includes automated reproducible build verification:

1. **Reproducible Builds Job:** Builds the project twice and compares checksums
2. **Failure Prevention:** CI fails if builds are not identical
3. **Dependency:** Test matrix only runs after reproducible builds are verified

### Current Status

- ✅ **Regular Builds:** Fully reproducible (dist/ directory)
- ⚠️ **Binary Executables:** Limited reproducibility due to Bun compilation metadata
- ✅ **CI/CD Integration:** Automated verification in place

### Troubleshooting

#### Build Not Reproducible

1. **Check Bun Version:**

   ```bash
   bun --version  # Should be 1.2.21
   ```

2. **Verify Dependencies:**

   ```bash
   bun install --frozen-lockfile
   ```

3. **Check Environment Variables:**
   - Ensure no environment-specific variables affect the build
   - Use `SOURCE_DATE_EPOCH=0` for timestamp control (limited effect with Bun)

4. **Clean Build:**
   ```bash
   bun run clean
   bun run build
   ```

#### Binary Reproducibility Issues

Binary executables compiled with Bun may not be fully reproducible due to:

- Internal metadata timestamps
- Compilation environment differences
- Non-deterministic optimization choices

**Workaround:** Use the regular build artifacts (`dist/` directory) for deployment, which are fully reproducible.

### Files

- **Verification Scripts:** `scripts/verify-reproducible-builds.sh`, `scripts/verify-binary-reproducibility.sh`
- **Build Configuration:** `package.json`, `.bun-version`
- **CI/CD:** `.github/workflows/ci.yml`
- **Docker:** `Dockerfile`
