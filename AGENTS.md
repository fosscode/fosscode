# Agents

## Code Guidelines

- Keep code files under 300 lines where possible to maintain readability and maintainability

## Task Management with Markdown Todo Lists

The `tasks/` folder contains markdown files for tracking complex development initiatives using GitHub-flavored todo lists.

### File Types

- **Implementation Plans**: Feature breakdowns (e.g., `context-percentage-implementation-plan.md`)
- **Testing Plans**: Test strategies (e.g., `e2e_testing_plan.md`)
- **Todo Lists**: Actionable tasks (e.g., `missing_tools_todo.md`)
- **Implementation Guides**: Development guides (e.g., `missing_tools_implementation.md`)

### Usage

1. **Naming**: Use descriptive, hyphen-separated names
2. **Location**: Place files in `tasks/` directory
3. **Structure**: Start with overview, then detailed task breakdown

### Task Format

```markdown
## Feature Implementation Plan

### Overview

Brief description of the feature and its goals.

### Tasks

- [ ] Task 1: Description of what needs to be done
- [ ] Task 2: Description with implementation details
- [ ] Task 3: Description with dependencies noted
  - [ ] Subtask 3.1: Specific implementation step
  - [ ] Subtask 3.2: Testing requirements
```

### Task States

- `[ ]` - Not started
- `[x]` - Completed
- `[-]` - In progress

### Best Practices

- Break complex tasks into manageable items
- Include implementation notes, dependencies, and testing requirements
- Keep task status current and reference relevant code/files

## User Notify Script

**Location:** `/home/dev/user_notify.py`

Sends messages to configured chat and waits for replies. Loads environment variables from `/home/dev/.env`.

**Usage:** `python3 /home/dev/user_notify.py "message"`

**Requirements:** Bot token and chat ID in `.env` file

## Binary Building and Release Process

fosscode builds static binaries for Linux x64/ARM64, macOS Intel/ARM64, and Windows using Bun's compile feature. Binaries are uploaded manually to GitHub releases.

### Automated Scripts

#### `scripts/build-binaries.sh`

**Purpose:** Builds and uploads platform binaries to GitHub releases

**Usage:** `./scripts/build-binaries.sh <version-tag>`

**Features:** Environment validation, builds 5 platform binaries, uploads to release, cleanup, error handling

#### `scripts/release.sh`

**Purpose:** Automates version bump, build, test, and tagging

**Usage:** `./scripts/release.sh [patch|minor|major]`

**Process:** Increments version, builds/tests, commits, pushes, creates git tag

### Manual Binary Building

For testing or custom builds:

**Build platforms:**

```bash
bun build src/binary.ts --target node --compile --outfile fosscode-{platform}
# Platforms: linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64.exe
```

**Upload:** `gh release upload <tag> fosscode-*`

**Cleanup:** `rm fosscode-*`

### Release Workflow

**Automated:**

1. `./scripts/release.sh patch`
2. `gh release create vX.X.X --title "Release vX.X.X" --generate-notes`
3. `./scripts/build-binaries.sh vX.X.X`

**Manual:** Build binaries → upload to release → cleanup

### Binary Specifications

- **Format:** Standalone Bun-compiled executables (~98MB each)
- **Platforms:** Linux x64/ARM64, macOS Intel/ARM64, Windows x64
- **Dependencies:** All bundled, no external requirements

### Troubleshooting

**Build fails:**

- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Verify `src/binary.ts` exists and `bun install` ran

**Upload fails:**

- Install/authenticate `gh` CLI
- Verify release exists: `gh release list`
- Check repository upload permissions

**Permission issues:** GitHub Actions cannot upload assets - use manual scripts

### Quick Start

**Automated workflow:**

```bash
cd /home/dev/fosscode
./scripts/release.sh patch
gh release create vX.X.X --title "Release vX.X.X" --generate-notes
./scripts/build-binaries.sh vX.X.X
```

Handles environment validation, building, uploading, and cleanup automatically.

### File Locations

- **Source:** `src/binary.ts`
- **Scripts:** `scripts/build-binaries.sh`, `scripts/release.sh`
- **Config:** `package.json`, `.github/workflows/release.yml`
- **Docs:** `AGENTS.md`
