# Scripts

This directory contains utility scripts for the fosscode project.

## Pre-Push Quality Checks

### `pre-push-checks.sh`

Runs the same quality checks that GitHub CI will run before merging your code.

**What it checks:**

- ✅ Code formatting (Prettier)
- ✅ Linting (ESLint)
- ✅ TypeScript type checking
- ✅ Build compilation
- ✅ Unit tests (Jest)
- ✅ Security audit

**Usage:**

```bash
./scripts/pre-push-checks.sh
```

**Exit codes:**

- `0`: All checks passed
- `1`: One or more checks failed

### `setup-git-hooks.sh`

Sets up automatic git hooks to run quality checks before each push.

**What it does:**

- Creates a `pre-push` git hook
- Hook automatically runs `pre-push-checks.sh` before allowing pushes
- Provides clear feedback on check results

**Usage:**

```bash
./scripts/setup-git-hooks.sh
```

**After setup:**

- `git push` will automatically run checks
- Use `git push --no-verify` to skip checks temporarily

## Other Scripts

### `build-binaries.sh`

Builds static binaries for multiple platforms and uploads to GitHub releases.

### `release.sh`

Automates version bumping, building, testing, and tagging.

### `publish.sh`

Handles publishing the package to npm.

### `setup-mcp.sh`

Sets up MCP (Model Context Protocol) configuration.

## Quick Start

1. **Manual checks** (run before pushing):

   ```bash
   ./scripts/pre-push-checks.sh
   ```

2. **Automatic checks** (set up once):

   ```bash
   ./scripts/setup-git-hooks.sh
   ```

3. **Build and release**:
   ```bash
   ./scripts/release.sh patch  # or minor/major
   ./scripts/build-binaries.sh v0.0.42
   ```

## Troubleshooting

- **Checks fail**: Fix the reported issues (formatting, linting, etc.) and run again
- **Hook not working**: Run `./scripts/setup-git-hooks.sh` again
- **Skip checks**: Use `git push --no-verify` for urgent pushes
- **Bun not found**: Install Bun from https://bun.sh/docs/installation
