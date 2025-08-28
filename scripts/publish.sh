#!/bin/bash

# Simple publish script for fosscode
# Usage: ./scripts/publish.sh

set -e

echo "📦 Publishing to npm..."

# Check if logged into npm
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ Not logged into npm. Please run 'npm login' first."
  exit 1
fi

# Build the project
echo "🔨 Building project..."
bun run build

# Run tests and linting
echo "🧪 Running tests and linting..."
bun run lint
bun run typecheck
bun run test

# Publish to npm
npm publish

echo "✅ Package published successfully!"