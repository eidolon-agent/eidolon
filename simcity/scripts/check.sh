#!/bin/bash
set -e

echo "🔍 Running SimCity security & quality checks..."

cd "$(dirname "$0")/../packages/contracts"

# 1. Build
echo "📦 Building contracts..."
forge build
echo "✅ Build succeeded"

# 2. Lint
echo "🧹 Running solhint..."
if solhint "src/**/*.sol" "test/**/*.sol"; then
  echo "✅ Lint passed"
else
  echo "❌ Lint failed"
  exit 1
fi

# 3. Slither
echo "🐍 Running Slither analysis..."
if slither . --config ../slither.json; then
  echo "✅ Slither scan completed (no errors)"
else
  echo "❌ Slither found issues (see output above)"
  exit 1
fi

# 4. Tests with high fuzz
echo "🧪 Running tests with fuzz (10000 runs)..."
forge test --fuzz-runs 10000 -vvv
echo "✅ Tests passed"

# 5. Coverage (optional)
if forge coverage --report lcov &>/dev/null; then
  echo "📊 Coverage generated (lcov.info)"
else
  echo "⚠️  Coverage generation skipped (solc may not support --optimize in this setup)"
fi

echo "🎉 All checks passed! Ready for deployment."