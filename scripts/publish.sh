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
npm run build

# Run tests and linting
echo "🧪 Running tests and linting..."
npm run lint
npm run typecheck
npm test

# Publish to npm
npm publish

echo "✅ Package published successfully!"