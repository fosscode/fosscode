#!/bin/bash

echo "🧪 Testing individual checks..."

echo "1. Format check..."
bun run format > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Format: OK"
else
    echo "❌ Format: FAILED"
fi

echo "2. Lint check..."
bun run lint > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Lint: OK"
else
    echo "❌ Lint: FAILED"
fi

echo "3. Typecheck..."
timeout 30 bun run typecheck > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Typecheck: OK"
else
    echo "❌ Typecheck: FAILED"
fi

echo "4. Build..."
bun run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build: OK"
else
    echo "❌ Build: FAILED"
fi

echo "5. Test..."
timeout 60 bun run test > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Test: OK"
else
    echo "❌ Test: FAILED"
fi

echo "🎉 All checks completed!"