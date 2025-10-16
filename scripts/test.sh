#!/bin/bash

# Test runner script for chat-py project

set -e

echo "🧪 Running tests for chat-py..."

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  No virtual environment detected. Please activate your venv first."
    echo "   Run: source venv/bin/activate"
    exit 1
fi

# Check if DATABASE_URL is set
if [[ -z "$DATABASE_URL" ]]; then
    echo "⚠️  DATABASE_URL not found in environment variables."
    echo "   Make sure your .env file is loaded."
    echo "   For GitHub Actions, add DATABASE_URL as a repository secret."
fi

# Install dependencies if needed
echo "📦 Installing dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
npm install > /dev/null 2>&1

# Build frontend assets
echo "🔨 Building frontend assets..."
npm run build > /dev/null 2>&1

# Run Python tests
echo "🐍 Running Python tests..."
python -m pytest tests/unit/ tests/integration/ -v --cov=. --cov-report=term-missing --cov-report=html

# Run JavaScript tests
echo "🟨 Running JavaScript tests..."
npm test -- tests/frontend/simple.test.ts --watchAll=false

# Generate combined coverage report
echo "📊 Test coverage reports generated:"
echo "   - Python: htmlcov/index.html"
echo "   - JavaScript: coverage/lcov-report/index.html"

echo ""
echo "✅ All tests completed!"
echo ""
echo "🚀 For testing actual functionality (messaging, friend requests):"
echo "   1. Start server: uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "   2. Run integration tests: ./scripts/test-integration.sh"
echo ""
echo "🚀 GitHub Actions Setup:"
echo "   1. Add DATABASE_URL as a repository secret"
echo "   2. Push to GitHub to trigger automated tests"
echo "   3. Check the Actions tab for results"
echo ""
echo "💡 Run './scripts/test-ci.sh' to simulate GitHub Actions locally"
