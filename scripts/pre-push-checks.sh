#!/bin/bash

# Pre-push checks script - replicates GitHub CI quality checks
# Run this before pushing to ensure your code passes the same tests as CI

set -e  # Exit on any error

echo "🚀 Running pre-push quality checks..."
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✅ $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Error: Bun is not installed. Please install Bun first.${NC}"
    echo "   Visit: https://bun.sh/docs/installation"
    exit 1
fi

echo "🔧 Setting up environment..."

# Install dependencies if node_modules doesn't exist or is outdated
if [ ! -d "node_modules" ] || [ ! -f "bun.lock" ]; then
    echo "📦 Installing dependencies..."
    bun install
    print_status $? "Dependencies installed"
fi

echo ""
echo "🔍 Running quality checks..."
echo "----------------------------"

# 1. Check formatting
echo "📝 Checking code formatting..."
bun run format > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Formatting failed${NC}"
    exit 1
fi

# Check for formatting changes
if [ -n "$(git diff --name-only)" ]; then
    echo -e "${RED}❌ Code formatting issues found. Please run 'bun run format' locally.${NC}"
    git diff --name-only
    exit 1
else
    print_status 0 "Code formatting check passed"
fi

# 2. Run linter
echo "🔍 Running linter..."
bun run lint > /dev/null 2>&1
print_status $? "Linting check passed"

# 3. Run typecheck
echo "🔍 Running TypeScript typecheck..."
bun run typecheck > /dev/null 2>&1
print_status $? "TypeScript typecheck passed"

# 4. Run build
echo "🔨 Running build..."
bun run build > /dev/null 2>&1
print_status $? "Build completed successfully"

# 5. Run tests
echo "🧪 Running tests..."
bun run test > /dev/null 2>&1
print_status $? "All tests passed"

# 6. Security audit
echo "🔒 Running security audit..."
bun install --frozen-lockfile > /dev/null 2>&1
if command -v npm &> /dev/null; then
    npm audit --audit-level=moderate > /dev/null 2>&1 || true
fi
print_status 0 "Security audit completed"

echo ""
echo -e "${GREEN}🎉 All pre-push checks passed! Safe to push.${NC}"
echo "====================================="

exit 0