#!/bin/bash

# Setup git hooks for pre-push checks
# This will automatically run quality checks before each push

set -e

HOOKS_DIR=".git/hooks"
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔧 Setting up git hooks for pre-push checks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-push hook
cat > "$PRE_PUSH_HOOK" << 'EOF'
#!/bin/bash

# Pre-push hook that runs quality checks
# This hook is automatically created by scripts/setup-git-hooks.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRE_PUSH_SCRIPT="$SCRIPT_DIR/scripts/pre-push-checks.sh"

echo "🛡️  Running pre-push quality checks..."

# Run the pre-push checks script
if [ -x "$PRE_PUSH_SCRIPT" ]; then
    "$PRE_PUSH_SCRIPT"
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        echo ""
        echo "❌ Pre-push checks failed. Push aborted."
        echo "   To skip these checks, use: git push --no-verify"
        exit 1
    fi
else
    echo "⚠️  Warning: Pre-push script not found or not executable: $PRE_PUSH_SCRIPT"
    echo "   Run './scripts/setup-git-hooks.sh' to fix this."
fi

echo "✅ Pre-push checks passed. Proceeding with push..."
exit 0
EOF

# Make the hook executable
chmod +x "$PRE_PUSH_HOOK"

echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo ""
echo "📋 What's been configured:"
echo "   • Pre-push hook will run quality checks automatically"
echo "   • Checks include: formatting, linting, typecheck, build, tests"
echo ""
echo "💡 Usage:"
echo "   • Normal push: git push (will run checks)"
echo "   • Skip checks: git push --no-verify"
echo "   • Manual check: ./scripts/pre-push-checks.sh"
echo ""
echo -e "${YELLOW}Note: If you need to bypass checks temporarily, use --no-verify${NC}"