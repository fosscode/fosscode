# Reproducible Builds Documentation

## Overview

Reproducible builds ensure that building the same source code multiple times produces identical binaries, regardless of build environment, timestamps, or other variables. This is critical for security auditing, supply chain verification, and maintaining trust in distributed software.

## Current Status

⚠️ **Partial Implementation**: fosscode has implemented deterministic build environments but **Bun's compile process includes non-deterministic elements** that prevent fully reproducible builds.

### What Works ✅

- Deterministic build environment (locale, timezone, umask)
- Pinned tool versions (Bun 1.2.21, Node.js)
- SOURCE_DATE_EPOCH timestamp normalization
- Reproducibility testing infrastructure
- Build manifest generation

### Known Limitations ❌

- Bun includes build timestamps in compiled binaries
- Temporary build paths embedded in binaries (`/tmp/bun-node-*`)
- Memory addresses and UUIDs in binary output
- No upstream Bun support for SOURCE_DATE_EPOCH

## Build Scripts

### Reproducible Build Script

```bash
./scripts/build-binaries-reproducible.sh v1.0.0
```

Features:

- Uses SOURCE_DATE_EPOCH from git tags/commits
- Normalizes build environment (LANG=C, LC_ALL=C, TZ=UTC)
- Generates reproducibility manifest with hashes
- Optional GitHub release upload

### Reproducibility Testing

```bash
# Basic reproducibility test
./scripts/test-reproducibility.sh

# Enhanced test with deterministic environment
./scripts/test-reproducibility-with-fixes.sh
```

## Build Environment

### Required Environment Variables

```bash
export SOURCE_DATE_EPOCH=1672531200  # Unix timestamp
export LANG=C
export LC_ALL=C
export TZ=UTC
umask 022
```

### Tool Versions

- **Bun**: 1.2.21 (pinned)
- **Node.js**: 20.x or 22.x
- **Platform**: Linux, macOS, Windows supported

## Reproducibility Manifest

Each build generates a manifest file:

```json
{
  "version": "v1.0.0",
  "build_timestamp": "1672531200",
  "build_date": "2023-01-01T00:00:00Z",
  "environment": {
    "bun_version": "1.2.21",
    "node_version": "v20.18.1",
    "os": "Linux",
    "arch": "x86_64"
  },
  "binaries": {
    "fosscode-linux-x64": {
      "size": 98311555,
      "sha256": "abc123..."
    }
  }
}
```

## CI/CD Integration

### GitHub Actions Workflows

1. **Reproducible Builds Test** (`.github/workflows/reproducible-builds.yml`)
   - Tests build reproducibility on every push
   - Cross-platform testing (Linux, macOS, Windows)
   - Weekly regression testing

2. **Release Builds** (`.github/workflows/release.yml`)
   - Uses pinned Bun version (1.2.21)
   - Includes reproducibility checks

## Verification Process

### Manual Verification

1. Clone the repository at a specific git commit
2. Set SOURCE_DATE_EPOCH to the commit timestamp
3. Build twice with identical environment
4. Compare SHA256 hashes

### Automated Verification

```bash
# Verify a release
git checkout v1.0.0
export SOURCE_DATE_EPOCH=$(git show -s --format=%ct v1.0.0)
./scripts/test-reproducibility-with-fixes.sh
```

## Current Challenges

### Bun Compiler Limitations

The main obstacle to reproducible builds is **Bun's compilation process**, which embeds:

- Current system time during compilation
- Temporary build directory paths
- Runtime memory addresses
- Generated UUIDs

### Potential Solutions

1. **Upstream Bun Support**: Request SOURCE_DATE_EPOCH support from Bun maintainers
2. **Post-Processing**: Binary patching to normalize timestamps (complex)
3. **Alternative Compilation**: Use different bundling/compilation strategy
4. **Container Builds**: Fully controlled build environment

## Best Practices

### For Developers

1. Always use the reproducible build script for releases
2. Pin exact tool versions in development
3. Test reproducibility before major releases
4. Document any environment dependencies

### For Verifiers

1. Use the same SOURCE_DATE_EPOCH value
2. Match the exact tool versions from manifest
3. Verify build environment normalization
4. Report reproducibility issues

## Security Implications

### Trust and Verification

- Reproducible builds enable independent verification of release binaries
- Users can verify that published binaries match the source code
- Helps detect supply chain attacks or compromised build environments

### Supply Chain Security

- Deterministic builds prevent injection of malicious code during compilation
- Build manifests provide audit trail for security analysis
- Cross-platform verification catches platform-specific issues

## Future Improvements

### Short Term

- [ ] Add binary diffing tools for debugging non-determinism
- [ ] Implement build caching for identical inputs
- [ ] Create reproducibility verification service

### Long Term

- [ ] Work with Bun maintainers on reproducible builds support
- [ ] Explore alternative compilation strategies
- [ ] Implement post-compilation binary normalization
- [ ] Add cryptographic build attestations

## FAQ

### Q: Why aren't builds fully reproducible yet?

**A**: Bun's compiler includes build-time information (timestamps, paths, addresses) that varies between builds. This is a limitation of the Bun toolchain, not our build process.

### Q: How can I verify a release binary?

**A**: Use the reproducibility manifest SHA256 hashes and follow the manual verification process documented above.

### Q: Will reproducible builds be supported in the future?

**A**: Yes, we're actively working on solutions including upstream Bun support and alternative compilation strategies.

### Q: Can I trust the current binaries?

**A**: Yes, while not byte-for-byte reproducible, our build process is deterministic in environment and includes security scanning via GitHub Actions.

## Contact

For questions about reproducible builds:

- Open an issue in the fosscode repository
- Discuss in the #reproducible-builds channel
- Review the build logs in GitHub Actions

## References

- [Reproducible Builds Project](https://reproducible-builds.org/)
- [SOURCE_DATE_EPOCH Specification](https://reproducible-builds.org/docs/source-date-epoch/)
- [Bun Documentation](https://bun.sh/docs)
- [GitHub Actions for Reproducible Builds](https://github.com/reproducible-builds/reproducible-website)
