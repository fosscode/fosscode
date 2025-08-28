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

- ✅ Environment validation (Bun, GitHub CLI, GPG, authentication)
- ✅ Builds 5 platform binaries (Linux x64/ARM64, macOS Intel/ARM64, Windows)
- ✅ Signs all binaries with GPG for security
- ✅ Uploads binaries and detached signatures to GitHub release
- ✅ Cleans up local files after upload
- ✅ Provides download URLs for both binaries and signatures
- ✅ Comprehensive error handling

**What it does:**

1. Validates environment and requirements (Bun, GitHub CLI, GPG)
2. Builds 5 platform-specific binaries using Bun
3. Signs each binary with GPG to create detached signatures
4. Verifies the GitHub release exists
5. Uploads all binaries and signatures to the specified GitHub release
6. Cleans up local binary and signature files after upload
7. Displays download URLs for both binaries and signatures

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

# Sign binaries
gpg --detach-sign --armor fosscode-linux-x64
gpg --detach-sign --armor fosscode-linux-arm64
gpg --detach-sign --armor fosscode-macos-x64
gpg --detach-sign --armor fosscode-macos-arm64
gpg --detach-sign --armor fosscode-windows-x64.exe

# Upload to release (binaries and signatures)
gh release upload v0.0.18 \
    fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe \
    fosscode-linux-x64.asc fosscode-linux-arm64.asc fosscode-macos-x64.asc fosscode-macos-arm64.asc fosscode-windows-x64.exe.asc

# Clean up
rm fosscode-linux-x64 fosscode-linux-arm64 fosscode-macos-x64 fosscode-macos-arm64 fosscode-windows-x64.exe
rm fosscode-linux-x64.asc fosscode-linux-arm64.asc fosscode-macos-x64.asc fosscode-macos-arm64.asc fosscode-windows-x64.exe.asc
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

### GPG Signing and Verification

#### Overview

All fosscode binaries are signed with GPG to ensure authenticity and integrity. Each release includes detached signature files (`.asc`) that can be used to verify the binaries haven't been tampered with.

#### GPG Key Information

- **Key ID:** 5A4818774F6CA92319CE88A45ACBB22988757D6E
- **Key Owner:** fosscode <fosscode0@gmail.com>
- **Key Type:** EDDSA (Ed25519)

#### Verifying Binaries

To verify a downloaded binary:

1. Download both the binary and its corresponding `.asc` signature file
2. Import the fosscode GPG key (one time setup):

```bash
# Import the public key
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 5A4818774F6CA92319CE88A45ACBB22988757D6E
```

3. Verify the signature:

```bash
# For Linux/macOS binaries
gpg --verify fosscode-linux-x64.asc fosscode-linux-x64

# For Windows binary
gpg --verify fosscode-windows-x64.exe.asc fosscode-windows-x64.exe
```

4. Expected output for valid signatures:

```
gpg: Signature made Thu Aug 28 01:27:42 2025 UTC
gpg:                using EDDSA key 5A4818774F6CA92319CE88A45ACBB22988757D6E
gpg: Good signature from "fosscode <fosscode0@gmail.com>" [ultimate]
```

#### Release Artifacts

Each release includes:

- **Binaries:** Platform-specific executables
- **Signatures:** Detached ASCII-armored signatures (`.asc` files)
- **Checksums:** SHA256 hashes for additional verification

#### Security Benefits

- **Authenticity:** Verify the binary comes from fosscode
- **Integrity:** Detect any tampering or corruption
- **Trust:** Build confidence in downloaded software

### Troubleshooting

#### Build Fails

- Ensure Bun is installed: `curl -fsSL https://bun.sh/install | bash`
- Check that `src/binary.ts` exists and is valid
- Verify all dependencies are installed: `bun install`

#### Upload Fails

- Ensure you have `gh` CLI installed and authenticated
- Verify the release tag exists: `gh release list`
- Check that you have permission to upload to the repository

#### GPG Signing Fails

- Ensure GPG is installed: `apt install gnupg` (Ubuntu/Debian) or equivalent
- Verify you have a GPG private key: `gpg --list-secret-keys`
- If no key exists, generate one: `gpg --gen-key`
- Make sure your GPG key is not expired: `gpg --list-keys --with-validity`
- Check that GPG can sign: `echo "test" | gpg --clearsign`

#### Signature Verification Fails

- Ensure you have imported the fosscode public key: `gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 5A4818774F6CA92319CE88A45ACBB22988757D6E`
- Verify the key fingerprint matches: `gpg --fingerprint 5A4818774F6CA92319CE88A45ACBB22988757D6E`
- Check that both binary and signature files are from the same release
- Ensure files weren't corrupted during download

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

## End-to-End Interactive Testing

### Overview

fosscode includes comprehensive end-to-end (E2E) tests that exercise the interactive chat functionality, tool execution, and multi-turn conversations. These tests are **not included in CI** to avoid complexity and flakiness in the automated pipeline, but provide valuable verification of the interactive features.

### Test Categories

#### 1. Interactive Chat Tests (`InteractiveChat.e2e.test.ts`)

- **Basic session startup and shutdown**
- **Command handling** (`/help`, `/providers`, `/models`, `/themes`)
- **Theme switching functionality**
- **Invalid command handling and error recovery**

#### 2. Tool Execution Tests (`ToolExecution.e2e.test.ts`)

- **Bash command execution through AI tool calls**
- **File read operations via tools**
- **File write operations via tools**
- **Grep/search operations via tools**
- **Mock API server integration**

#### 3. Multi-Turn Conversation Tests (`MultiTurnConversation.e2e.test.ts`)

- **Context preservation across multiple interactions**
- **Conversation history maintenance**
- **Conversation reset functionality**
- **Error recovery in ongoing conversations**

### Running E2E Tests

#### Quick Start

```bash
# Run all E2E tests with the automated script
./scripts/run-e2e-tests.sh
```

#### Manual Test Execution

```bash
# Run individual test suites
bun test src/__tests__/e2e/InteractiveChat.e2e.test.ts --timeout 60000
bun test src/__tests__/e2e/ToolExecution.e2e.test.ts --timeout 60000
bun test src/__tests__/e2e/MultiTurnConversation.e2e.test.ts --timeout 60000

# Run all E2E tests
bun test src/__tests__/e2e/ --timeout 60000
```

### Test Architecture

#### Mock API Server Integration

- Tests use **local mock servers** (ports 3001, 3002) to simulate AI provider responses
- **No external API calls** are made during testing
- Mock servers provide realistic tool call responses and conversation flows

#### Temporary File System

- Each test suite creates **isolated temporary directories**
- Files are automatically cleaned up after test completion
- Tests operate in `/tmp/fosscode-*` directories to avoid conflicts

#### Process Management

- Tests spawn actual `fosscode` binary processes
- **Real interactive sessions** are created and controlled programmatically
- Proper cleanup ensures no hanging processes

### Test Configuration

#### Environment Variables

```bash
NODE_ENV=test           # Enables test mode
CI=true                 # Prevents unnecessary output
```

#### Test Timeouts

- **Individual tests:** 15-35 seconds
- **Overall suite:** 60 seconds maximum
- **Process cleanup:** Automatic via trap handlers

#### Port Usage

- **3001:** Tool execution mock server
- **3002:** Multi-turn conversation mock server
- Tests run **sequentially** to avoid port conflicts

### Troubleshooting E2E Tests

#### Common Issues

1. **Port Conflicts**

   ```bash
   # Check for processes using test ports
   lsof -i :3001 -i :3002

   # Kill any hanging processes
   pkill -f "mock.*server"
   pkill -f "fosscode"
   ```

2. **Test Timeouts**

   ```bash
   # Increase timeout for debugging
   bun test src/__tests__/e2e/InteractiveChat.e2e.test.ts --timeout 120000
   ```

3. **Build Issues**

   ```bash
   # Ensure fosscode builds correctly
   bun run build

   # Test the binary directly
   bun run src/binary-chat.ts --help
   ```

4. **File System Issues**

   ```bash
   # Clean up temporary directories
   find /tmp -name "fosscode-*" -type d -exec rm -rf {} +

   # Check available disk space
   df -h /tmp
   ```

#### Debug Mode

For detailed debugging, modify test files to include additional logging:

```typescript
child.stdout?.on('data', data => {
  const output = data.toString();
  console.log('[STDOUT]', output); // Add this for debugging
  // ... rest of test logic
});

child.stderr?.on('data', data => {
  console.log('[STDERR]', data.toString()); // Add this for debugging
});
```

### Test Results and Logging

#### Automated Logging

- Test results are saved to `test-results/e2e/`
- Each test suite generates a separate log file
- **Logs are preserved** even after test completion for debugging

#### Result Interpretation

```bash
# View test results
ls -la test-results/e2e/
cat test-results/e2e/Interactive_Chat.log
```

### Development Guidelines

#### Adding New E2E Tests

1. **Create test file** in `src/__tests__/e2e/`
2. **Use appropriate timeout** (15-35 seconds typically)
3. **Include proper cleanup** in `afterAll()`
4. **Add to test runner script** if needed
5. **Test both success and failure scenarios**

#### Best Practices

- **Use unique ports** for each test suite
- **Always clean up** temporary files and processes
- **Test realistic user workflows**, not just API calls
- **Include error recovery scenarios**
- **Avoid external dependencies** (use mocks)

### File Locations

- **Test Files:** `src/__tests__/e2e/*.e2e.test.ts`
- **Test Runner:** `scripts/run-e2e-tests.sh`
- **Jest Config:** `src/__tests__/e2e/jest.config.js`
- **Test Results:** `test-results/e2e/`

### Why E2E Tests Are Not in CI

1. **Complexity:** Interactive tests require process spawning and cleanup
2. **Flakiness:** Timing-dependent tests can be unreliable in CI environments
3. **Resource Usage:** Tests require mock servers and temporary files
4. **Development Focus:** These tests are for manual verification during development
5. **CI Speed:** Keeps the main CI pipeline fast and focused

The E2E tests provide **comprehensive coverage** of interactive features while maintaining **CI simplicity** and **reliability**.

## Code Style Guidelines

### File Size Limits

- **Keep code files under 300 lines when possible**
  - Break large files into smaller, focused modules
  - Use logical separation of concerns
  - Consider extracting utility functions or classes
  - Improves maintainability and readability
  - Makes code easier to review and test
