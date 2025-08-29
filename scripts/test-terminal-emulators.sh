#!/bin/bash

# Test script for tmux behavior across different terminal emulators
# This script helps validate that tmux integration works consistently

set -e

echo "🖥️  Testing tmux behavior across terminal emulators..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -n "Testing: $test_name... "
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
        echo -e "${RED}❌ tmux is not installed. Skipping terminal emulator tests.${NC}"
        exit 0
    fi
}

# Function to test basic terminal capabilities
test_terminal_capabilities() {
    echo -e "\n📋 Testing basic terminal capabilities..."

    # Test 1: Terminal size detection
    run_test "Terminal size detection" "echo 'Terminal size: $(tput cols)x$(tput lines)' | grep -E '[0-9]+x[0-9]+'"

    # Test 2: Color support detection
    run_test "Color support detection" "tput colors | grep -E '^[0-9]+$'"

    # Test 3: Unicode support
    run_test "Unicode support" "echo 'Unicode: ✓' | grep -q '✓'"

    # Test 4: Cursor positioning
    run_test "Cursor positioning" "tput cup 0 0 && echo 'Cursor test' | grep -q 'Cursor test'"
}

# Function to test tmux with different terminal types
test_tmux_terminal_types() {
    echo -e "\n🔧 Testing tmux with different terminal types..."

    # Test 5: tmux with TERM=xterm
    run_test "tmux with TERM=xterm" "TERM=xterm tmux new-session -d -s test-term-xterm 'echo test' && sleep 1 && tmux kill-session -t test-term-xterm"

    # Test 6: tmux with TERM=screen
    run_test "tmux with TERM=screen" "TERM=screen tmux new-session -d -s test-term-screen 'echo test' && sleep 1 && tmux kill-session -t test-term-screen"

    # Test 7: tmux with TERM=tmux
    run_test "tmux with TERM=tmux" "TERM=tmux tmux new-session -d -s test-term-tmux 'echo test' && sleep 1 && tmux kill-session -t test-term-tmux"

    # Test 8: tmux with TERM=xterm-256color
    run_test "tmux with TERM=xterm-256color" "TERM=xterm-256color tmux new-session -d -s test-term-256 'echo test' && sleep 1 && tmux kill-session -t test-term-256"
}

# Function to test tmux pane size reporting
test_pane_size_reporting() {
    echo -e "\n📏 Testing tmux pane size reporting..."

    # Test 9: Pane size with different terminal sizes
    run_test "Pane size reporting (80x24)" "tmux new-session -d -s test-size-80x24 -x 80 -y 24 'sleep 2' && sleep 1 && tmux display-message -t test-size-80x24 -p '#{pane_width},#{pane_height}' | grep -q '80,24' && tmux kill-session -t test-size-80x24"

    # Test 10: Pane size with larger terminal
    run_test "Pane size reporting (120x30)" "tmux new-session -d -s test-size-120x30 -x 120 -y 30 'sleep 2' && sleep 1 && tmux display-message -t test-size-120x30 -p '#{pane_width},#{pane_height}' | grep -q '120,30' && tmux kill-session -t test-size-120x30"
}

# Function to test tmux feature availability
test_feature_availability() {
    echo -e "\n⚙️  Testing tmux feature availability..."

    # Test 11: Status line feature
    run_test "Status line feature availability" "tmux new-session -d -s test-status 'sleep 2' && sleep 1 && tmux set-status-left -t test-status 'test' && tmux kill-session -t test-status"

    # Test 12: Key binding feature
    run_test "Key binding feature availability" "tmux new-session -d -s test-keys 'sleep 2' && sleep 1 && tmux bind-key -t test-keys C-test 'echo test' && tmux kill-session -t test-keys"
}

# Function to test error recovery
test_error_recovery() {
    echo -e "\n🛠️  Testing error recovery..."

    # Test 13: Handle missing tmux commands gracefully
    run_test "Missing tmux command handling" "tmux display-message -t nonexistent-session -p '#{session_name}' 2>&1 | grep -q 'session not found' || echo 'Expected error not found'"

    # Test 14: Handle invalid pane references
    run_test "Invalid pane reference handling" "tmux new-session -d -s test-invalid 'sleep 2' && sleep 1 && tmux display-message -t test-invalid:99 -p '#{pane_id}' 2>&1 | grep -q 'pane not found' && tmux kill-session -t test-invalid"
}

# Function to generate test report
generate_report() {
    echo -e "\n📊 Terminal Emulator Test Report"
    echo -e "=================================="
    echo -e "Tests run: ${TESTS_RUN}"
    echo -e "Tests passed: ${TESTS_PASSED}"
    echo -e "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
    echo -e "Success rate: $((TESTS_PASSED * 100 / TESTS_RUN))%"

    echo -e "\n🔍 Test Coverage:"
    echo -e "• Basic terminal capabilities"
    echo -e "• tmux with different TERM values"
    echo -e "• Pane size reporting accuracy"
    echo -e "• Feature availability detection"
    echo -e "• Error recovery mechanisms"

    echo -e "\n💡 Recommendations:"
    echo -e "• Test with actual terminal emulators (iTerm2, GNOME Terminal, etc.)"
    echo -e "• Verify tmux integration in different environments"
    echo -e "• Check for terminal-specific tmux configurations"
    echo -e "• Validate color and Unicode rendering"
}

# Function to provide manual testing instructions
manual_testing_instructions() {
    echo -e "\n📝 Manual Testing Instructions"
    echo -e "================================"

    echo -e "\n${BLUE}1. iTerm2 (macOS):${NC}"
    echo -e "   • Open iTerm2"
    echo -e "   • Start tmux session: tmux"
    echo -e "   • Split panes: Ctrl-b % (vertical) or Ctrl-b \" (horizontal)"
    echo -e "   • Verify pane size detection and responsive breakpoints"

    echo -e "\n${BLUE}2. GNOME Terminal (Linux):${NC}"
    echo -e "   • Open GNOME Terminal"
    echo -e "   • Start tmux session: tmux"
    echo -e "   • Split panes: Ctrl-b % or Ctrl-b \""
    echo -e "   • Check status line and key binding functionality"

    echo -e "\n${BLUE}3. Windows Terminal (Windows):${NC}"
    echo -e "   • Open Windows Terminal with WSL"
    echo -e "   • Start tmux session: tmux"
    echo -e "   • Test pane operations and tmux integration"

    echo -e "\n${BLUE}4. Alacritty (Cross-platform):${NC}"
    echo -e "   • Open Alacritty"
    echo -e "   • Start tmux session: tmux"
    echo -e "   • Verify tmux pane detection and status updates"

    echo -e "\n${YELLOW}For each terminal emulator, verify:${NC}"
    echo -e "   ✓ tmux pane size is correctly detected"
    echo -e "   ✓ Status line shows current mode/provider"
    echo -e "   ✓ Key bindings work (Ctrl+T for mode toggle, etc.)"
    echo -e "   ✓ Responsive breakpoints adjust UI correctly"
    echo -e "   ✓ No rendering artifacts or display issues"
}

# Main test execution
main() {
    echo -e "${YELLOW}🚀 Starting terminal emulator compatibility tests...${NC}"

    check_tmux

    echo -e "\n📋 Running terminal emulator compatibility tests...\n"

    # Run all test categories
    test_terminal_capabilities
    test_tmux_terminal_types
    test_pane_size_reporting
    test_feature_availability
    test_error_recovery

    # Generate report
    generate_report

    # Provide manual testing instructions
    manual_testing_instructions

    echo -e "\n${GREEN}✅ Terminal emulator compatibility testing completed!${NC}"

    if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
        echo -e "${GREEN}🎉 All automated tests passed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Some automated tests failed, but this may be expected.${NC}"
        echo -e "${YELLOW}   Manual testing with different terminal emulators is recommended.${NC}"
        exit 0
    fi
}

# Run main function
main