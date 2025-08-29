#!/bin/bash

# Performance Test Runner for FOSSCODE Tools
# This script runs performance tests and generates reports

set -e

echo "🚀 Running FOSSCODE Performance Tests"
echo "====================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo "❌ Error: Please run this script from the fosscode root directory"
    exit 1
fi

# Create performance reports directory
REPORTS_DIR="performance-reports"
mkdir -p "$REPORTS_DIR"

# Timestamp for the report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORTS_DIR/performance_report_$TIMESTAMP.md"

echo "📊 Running performance tests..."

# Run performance tests
if command -v bun &> /dev/null; then
    echo "Using Bun to run tests..."
    bun test src/__tests__/performance/ --reporter=verbose
elif command -v npm &> /dev/null; then
    echo "Using npm to run tests..."
    npm test -- --testPathPattern="performance" --reporter=verbose
else
    echo "❌ Error: Neither bun nor npm found"
    exit 1
fi

echo ""
echo "📈 Generating performance report..."

# Generate performance report using Node.js
node -e "
const { performanceFramework } = require('./src/__tests__/performance/PerformanceTestFramework.ts');
const fs = require('fs');

const report = performanceFramework.generateReport();
fs.writeFileSync('$REPORT_FILE', report);

console.log('✅ Performance report generated: $REPORT_FILE');
console.log('');
console.log('📋 Report Summary:');
console.log(report.split('\n').slice(0, 10).join('\n'));
"

echo ""
echo "🎯 Performance testing completed!"
echo "📁 Report saved to: $REPORT_FILE"

# Display a quick summary
if [ -f "$REPORT_FILE" ]; then
    echo ""
    echo "📊 Quick Summary:"
    head -20 "$REPORT_FILE"
fi