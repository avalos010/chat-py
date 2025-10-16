# Testing Guide for chat-py

This document explains how to run and write tests for the chat-py project.

## 🧪 Testing Stack

### Backend (Python/FastAPI)

- **pytest** - Main testing framework
- **pytest-asyncio** - Async/await support
- **pytest-cov** - Coverage reporting
- **pytest-mock** - Mocking utilities
- **httpx** - API testing

### Frontend (TypeScript/JavaScript)

- **jest** - JavaScript testing framework
- **@testing-library/dom** - DOM testing utilities
- **jest-environment-jsdom** - Browser-like environment
- **ts-jest** - TypeScript support

## 🚀 Quick Start

### Install Dependencies

```bash
# Python dependencies
pip install -r requirements.txt

# JavaScript dependencies
npm install
```

### Run All Tests

```bash
# Use the test runner script
./scripts/test.sh

# Or run individually:
pytest tests/ -v --cov=. --cov-report=html    # Python tests
npm test                                      # JavaScript tests
```

## 📁 Test Structure

```
tests/
├── __init__.py
├── conftest.py              # Pytest configuration & fixtures
├── test_simple.py           # Simple unit tests (working)
├── test_auth.py            # Authentication tests
├── test_api.py             # API endpoint tests
├── test_websocket.py       # WebSocket tests
├── frontend/
│   ├── simple.test.ts      # Basic frontend tests (working)
│   ├── chat.test.ts        # Chat functionality tests
│   └── auth.test.ts        # Frontend auth tests
├── test-utils.ts           # Testing utilities
└── setup.ts               # Jest setup
```

## ✅ Working Tests

### Python Tests

- ✅ **Password Hashing** (`tests/test_simple.py`)
  - Password hashing and verification
  - Edge cases (empty passwords, long passwords)
  - Different passwords produce different hashes

### JavaScript Tests

- ✅ **Frontend Basics** (`tests/frontend/simple.test.ts`)
  - DOM manipulation
  - Event handling
  - CSS class management
  - Async operations
  - Fetch mocking

## 🚧 Tests That Need Database Setup

The following test files exist but require database configuration to run:

- `tests/test_auth.py` - Authentication API tests
- `tests/test_api.py` - API endpoint tests
- `tests/test_websocket.py` - WebSocket functionality tests
- `tests/frontend/chat.test.ts` - Chat UI tests
- `tests/frontend/auth.test.ts` - Frontend authentication tests

## 🔧 Configuration Files

- **`pytest.ini`** - Pytest configuration with coverage settings
- **`jest.config.js`** - Jest configuration for TypeScript
- **`tests/conftest.py`** - Shared fixtures and test setup
- **`tests/setup.ts`** - Jest global setup and mocks

## 📊 Coverage Reports

After running tests, coverage reports are generated:

- **Python**: `htmlcov/index.html`
- **JavaScript**: `coverage/lcov-report/index.html`

## 🛠️ Writing New Tests

### Python Tests

```python
import pytest
from utils.security import verify_password, get_password_hash

def test_password_hashing():
    password = "testpassword123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)
```

### JavaScript Tests

```typescript
/**
 * @jest-environment jsdom
 */

describe("My Component", () => {
  test("should work correctly", () => {
    document.body.innerHTML = `<div id="test">Hello</div>`;

    const element = document.getElementById("test");
    expect(element?.textContent).toBe("Hello");
  });
});
```

## 🐛 Troubleshooting

### Common Issues

1. **PostgreSQL Connection Errors**

   - The project uses PostgreSQL in production but SQLite for testing
   - Database tests are currently disabled to avoid setup complexity

2. **TypeScript Import Errors**

   - Some frontend tests may fail due to module import issues
   - Use the working `simple.test.ts` as a template

3. **Missing Dependencies**
   - Run `pip install -r requirements.txt` for Python deps
   - Run `npm install` for JavaScript deps

### Test Commands

```bash
# Run specific test files
pytest tests/test_simple.py -v
npm test -- tests/frontend/simple.test.ts

# Run with coverage
pytest tests/ --cov=. --cov-report=html
npm run test:coverage

# Watch mode (JavaScript only)
npm run test:watch
```

## 📈 Next Steps

To expand the test suite:

1. **Database Tests**: Set up SQLite test database for API tests
2. **Integration Tests**: Test full user flows (signup → login → chat)
3. **WebSocket Tests**: Test real-time messaging functionality
4. **E2E Tests**: Consider adding Playwright or Cypress for full browser testing

## 🎯 Test Goals

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database interactions
- **Frontend Tests**: Test DOM manipulation and user interactions
- **Coverage**: Aim for >80% code coverage across the project
