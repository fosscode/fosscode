#!/bin/bash

# End-to-End Test Runner for fosscode Interactive Features
# This script runs comprehensive E2E tests that exercise the interactive chat functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting fosscode E2E Tests${NC}"
echo "==========================================="

# Check if required dependencies are available
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is required but not installed${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Set up test environment
export NODE_ENV=test
export CI=true

# Create test results directory
TEST_RESULTS_DIR="test-results/e2e"
mkdir -p "$TEST_RESULTS_DIR"

# Function to run a specific test file
run_test_file() {
    local test_file="$1"
    local test_name="$2"
    
    echo -e "${YELLOW}🧪 Running $test_name...${NC}"
    
    if bun test "$test_file" --timeout 60000 2>&1 | tee "$TEST_RESULTS_DIR/$test_name.log"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        echo "   Check log: $TEST_RESULTS_DIR/$test_name.log"
        return 1
    fi
}

# Function to clean up any hanging processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    pkill -f "mock.*server" 2>/dev/null || true
    pkill -f "fosscode" 2>/dev/null || true
    
    # Clean up test config files
    find src/__tests__/e2e -name "test-*.json" -delete 2>/dev/null || true
    
    # Clean up temporary directories
    find /tmp -name "fosscode-*" -type d -exec rm -rf {} + 2>/dev/null || true
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test files to run
declare -a TEST_FILES=(
    "src/__tests__/e2e/InteractiveChat.e2e.test.ts:Interactive_Chat"
    "src/__tests__/e2e/ToolExecution.e2e.test.ts:Tool_Execution"
    "src/__tests__/e2e/MultiTurnConversation.e2e.test.ts:Multi_Turn_Conversation"
)

echo -e "${GREEN}📊 Test Summary${NC}"
echo "Tests to run: ${#TEST_FILES[@]}"
echo ""

# Run each test file
for test_entry in "${TEST_FILES[@]}"; do
    IFS=':' read -r test_file test_name <<< "$test_entry"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if run_test_file "$test_file" "$test_name"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
done

# Final summary
echo "==========================================="
echo -e "${GREEN}📊 Final Results${NC}"
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All E2E tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 $FAILED_TESTS test(s) failed${NC}"
    echo ""
    echo -e "${YELLOW}📝 Check individual test logs in:${NC}"
    echo "   $TEST_RESULTS_DIR/"
    echo ""
    echo -e "${YELLOW}💡 Tips for debugging:${NC}"
    echo "   • Check if the fosscode binary builds correctly: bun run build"
    echo "   • Verify no other instances are running on test ports (3001, 3002)"
    echo "   • Run individual tests: bun test src/__tests__/e2e/InteractiveChat.e2e.test.ts"
    echo "   • Check system resources (memory, file descriptors)"
    exit 1
fi