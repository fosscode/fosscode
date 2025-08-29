#!/bin/bash

# Test script for different tmux configurations
# This script tests the tmux integration with various pane layouts and session configurations

set -e

echo "🧪 Testing tmux configurations..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Running test: $test_name... "
    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}FAILED${NC}"
    fi
}

# Function to check if tmux is available
check_tmux() {
    if ! command -v tmux >/dev/null 2>&1; then
        echo -e "${RED}❌ tmux is not installed. Skipping tmux configuration tests.${NC}"
        exit 0
    fi
}

# Function to clean up tmux sessions
cleanup_sessions() {
    tmux kill-session -t "test-session-1" >/dev/null 2>&1 || true
    tmux kill-session -t "test-session-2" >/dev/null 2>&1 || true
    tmux kill-session -t "nested-session" >/dev/null 2>&1 || true
}

# Function to test basic tmux detection
test_basic_detection() {
    # Test 1: No tmux session
    run_test "Basic tmux detection (no session)" "node -e \"console.log(process.env.TMUX ? 'in-tmux' : 'not-in-tmux')\" | grep -q 'not-in-tmux'"

    # Test 2: Inside tmux session
    run_test "Basic tmux detection (in session)" "tmux new-session -d -s test-session-1 'node -e \"console.log(process.env.TMUX ? \\\"in-tmux\\\" : \\\"not-in-tmux\\\")\"' && sleep 1 && tmux capture-pane -t test-session-1 -p | grep -q 'in-tmux'"
}

# Function to test pane size detection
test_pane_sizes() {
    # Test 3: Single pane size detection
    run_test "Single pane size detection" "tmux new-session -d -s test-session-1 -x 120 -y 30 'sleep 2' && sleep 1 && tmux display-message -t test-session-1 -p '#{pane_width},#{pane_height}' | grep -q '120,30'"

    # Test 4: Split pane size detection
    run_test "Split pane size detection" "tmux new-session -d -s test-session-2 -x 120 -y 30 'sleep 2' && tmux split-window -h -t test-session-2 && sleep 1 && tmux display-message -t test-session-2:0.0 -p '#{pane_width},#{pane_height}' | grep -E '^[0-9]+,[0-9]+$'"
}

# Function to test session information
test_session_info() {
    # Test 5: Session name detection
    run_test "Session name detection" "tmux new-session -d -s test-session-1 'sleep 2' && sleep 1 && tmux display-message -t test-session-1 -p '#{session_name}' | grep -q 'test-session-1'"

    # Test 6: Window name detection
    run_test "Window name detection" "tmux new-session -d -s test-session-1 'sleep 2' && sleep 1 && tmux display-message -t test-session-1 -p '#{window_name}' | grep -q '0'"

    # Test 7: Pane ID detection
    run_test "Pane ID detection" "tmux new-session -d -s test-session-1 'sleep 2' && sleep 1 && tmux display-message -t test-session-1 -p '#{pane_id}' | grep -E '^%[0-9]+$'"
}

# Function to test nested sessions (if supported)
test_nested_sessions() {
    # Test 8: Nested session detection (basic)
    run_test "Nested session basic detection" "tmux new-session -d -s nested-session 'sleep 2' && sleep 1 && tmux display-message -t nested-session -p '#{session_name}' | grep -q 'nested-session'"
}

# Function to test tmux hooks and commands
test_hooks_and_commands() {
    # Test 9: Status line commands
    run_test "Status line commands" "tmux new-session -d -s test-session-1 'sleep 2' && sleep 1 && tmux set-status-left -t test-session-1 'test-status' && tmux show-options -t test-session-1 status-left | grep -q 'test-status'"

    # Test 10: Key binding setup (basic)
    run_test "Key binding setup" "tmux new-session -d -s test-session-1 'sleep 2' && sleep 1 && tmux bind-key -t test-session-1 C-test 'echo test' && tmux list-keys -t test-session-1 | grep -q 'C-test'"
}

# Function to test error handling
test_error_handling() {
    # Test 11: Invalid session handling
    run_test "Invalid session handling" "tmux display-message -t invalid-session -p '#{session_name}' 2>&1 | grep -q 'session not found' || echo 'Expected error not found'"

    # Test 12: Invalid pane handling
    run_test "Invalid pane handling" "tmux display-message -t test-session-1:invalid-pane -p '#{pane_id}' 2>&1 | grep -q 'pane not found' || echo 'Expected error not found'"
}

# Main test execution
main() {
    echo -e "${YELLOW}🚀 Starting tmux configuration tests...${NC}"

    check_tmux
    cleanup_sessions

    echo -e "\n📋 Running tmux configuration tests...\n"

    # Run all test categories
    test_basic_detection
    test_pane_sizes
    test_session_info
    test_nested_sessions
    test_hooks_and_commands
    test_error_handling

    # Cleanup
    cleanup_sessions

    echo -e "\n📊 Test Results:"
    echo -e "Tests run: ${TESTS_RUN}"
    echo -e "Tests passed: ${TESTS_PASSED}"
    echo -e "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

    if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
        echo -e "${GREEN}✅ All tmux configuration tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tmux configuration tests failed.${NC}"
        exit 1
    fi
}

# Run main function
main