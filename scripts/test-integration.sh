#!/bin/bash

# Integration test script that tests actual functionality
# This requires the server to be running

echo "🧪 Running Integration Tests for Actual Functionality"
echo "=================================================="

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s http://localhost:8000/ > /dev/null; then
    echo "✅ Server is running at http://localhost:8000"
else
    echo "❌ Server is not running!"
    echo ""
    echo "To run integration tests:"
    echo "1. Start the server in one terminal:"
    echo "   uvicorn main:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "2. Run this script in another terminal:"
    echo "   ./scripts/test-integration.sh"
    echo ""
    exit 1
fi

echo ""
echo "🐍 Running integration tests..."
echo "These tests will test actual functionality like:"
echo "  - User signup and login"
echo "  - Friend requests (send, accept, reject)"
echo "  - Message workflows"
echo "  - WebSocket token generation"
echo "  - Online status"
echo ""

# Run the integration tests
python -m pytest tests/e2e/ -v -s

echo ""
echo "📊 Integration Test Summary:"
echo "  - These tests verify actual business logic"
echo "  - They require a running server"
echo "  - They test real user workflows"
echo "  - They use the actual Render PostgreSQL database"
