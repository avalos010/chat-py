# Testing Guide for Chat-Py

This project has a clean, organized test structure with three types of tests to ensure comprehensive coverage.

## 🧪 Test Structure

### 📁 Organized Test Directory
```
tests/
├── unit/           # Fast, isolated unit tests (12 tests)
├── integration/    # Database and API integration tests (30 tests)  
├── e2e/            # End-to-end user workflow tests (6 tests)
└── fixtures/       # Shared test data and fixtures
```

### 1. Unit Tests (Fast & Isolated) ⚡
**Purpose**: Test individual functions and components in isolation
**Run**: `python -m pytest tests/unit/ -v`

**What they test**:
- ✅ Password hashing and verification functions
- ✅ Pydantic model validation and serialization
- ✅ Security utilities and edge cases
- ✅ Input validation and error handling

**Coverage**: 12 tests - all passing

### 2. Integration Tests (API & Database) 🔗
**Purpose**: Test API endpoints, database connectivity, and component integration
**Run**: `./scripts/test.sh` or `python -m pytest tests/integration/ -v`

**What they test**:
- ✅ API endpoint availability and structure
- ✅ Authentication middleware and security
- ✅ Database connectivity (Render PostgreSQL)
- ✅ Friend request and management endpoints
- ✅ Message and conversation endpoints
- ✅ Static file serving and infrastructure
- ✅ Error handling and validation

**Coverage**: 30 tests - all passing

### 3. End-to-End Tests (Real User Workflows) 🚀
**Purpose**: Test complete user workflows using real server
**Run**: `./scripts/test-integration.sh` (requires running server)

**What they test**:
- 🚀 Complete user signup and login flows
- 🚀 Friend request workflows (send, accept, reject)
- 🚀 Message workflows between friends
- 🚀 WebSocket token generation
- 🚀 Online status functionality
- 🚀 User search and discovery

**Coverage**: 6 tests - test actual functionality

## 🚀 Running Tests

### Quick Start (Infrastructure Tests)
```bash
# Activate virtual environment
source venv/bin/activate

# Run all infrastructure tests
./scripts/test.sh
```

### Full Functionality Testing
```bash
# Terminal 1: Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Run integration tests
./scripts/test-integration.sh
```

### Individual Test Files
```bash
# Infrastructure tests
python -m pytest tests/test_working_flows.py -v
python -m pytest tests/test_simple.py -v
python -m pytest tests/test_simple_render.py -v

# Integration tests (requires running server)
python -m pytest tests/test_integration_functionality.py -v
```

## 📊 Test Results

### Infrastructure Tests (31 tests)
```
tests/test_working_flows.py::TestBasicEndpoints::test_home_page PASSED
tests/test_working_flows.py::TestBasicEndpoints::test_login_page PASSED
tests/test_working_flows.py::TestBasicEndpoints::test_signup_page PASSED
tests/test_working_flows.py::TestBasicEndpoints::test_about_page PASSED
tests/test_working_flows.py::TestUnauthorizedAccess::test_api_user_me_unauthorized PASSED
tests/test_working_flows.py::TestUnauthorizedAccess::test_api_friends_unauthorized PASSED
tests/test_working_flows.py::TestInvalidRequests::test_invalid_login_credentials PASSED
tests/test_working_flows.py::TestErrorHandling::test_invalid_http_methods PASSED
tests/test_working_flows.py::TestAPIStructure::test_api_endpoints_exist PASSED
tests/test_working_flows.py::TestApplicationHealth::test_application_starts PASSED
... (and 21 more)
```

### Integration Tests (6 tests)
```
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_server_health PASSED
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_user_signup_and_login_flow PASSED
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_friend_request_workflow PASSED
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_message_workflow PASSED
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_websocket_token_generation PASSED
tests/test_integration_functionality.py::TestIntegrationFunctionality::test_online_status_functionality PASSED
```

## 🔧 CI/CD Integration

### GitHub Actions
The project includes automated testing via GitHub Actions (`.github/workflows/test.yml`):

**Infrastructure Tests** (run on every push):
- ✅ Python backend tests
- ✅ JavaScript frontend tests
- ✅ Database connectivity tests
- ✅ Coverage reporting

**Setup Required**:
1. Add `DATABASE_URL` as a repository secret in GitHub
2. Push code to trigger automated tests
3. Check Actions tab for results

### Local CI Simulation
```bash
# Simulate GitHub Actions locally
./scripts/test-ci.sh
```

## 🎯 Test Coverage

### Infrastructure Coverage
- **Pages**: Home, login, signup, about, friends, chat
- **API Endpoints**: All major endpoints tested for existence and security
- **Authentication**: Middleware, token handling, unauthorized access
- **Database**: Connection, basic operations
- **Security**: Password hashing, input validation
- **Error Handling**: Malformed requests, invalid methods

### Functionality Coverage
- **User Management**: Signup, login, profile access
- **Social Features**: Friend requests, friend management
- **Messaging**: Conversation access, message history
- **Real-time**: WebSocket token generation, online status
- **Search**: User search functionality

## 🚨 Troubleshooting

### Common Issues

1. **"Server is not running"**
   ```bash
   # Start the server first
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **"DATABASE_URL not found"**
   ```bash
   # Make sure .env file exists with DATABASE_URL
   # Or set environment variable
   export DATABASE_URL="your_postgresql_url"
   ```

3. **Async loop conflicts in unit tests**
   - This is expected and why we use integration tests
   - Infrastructure tests avoid async operations
   - Integration tests use real HTTP requests

### Test Environment Setup
```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# 4. Run tests
./scripts/test.sh
```

## 📈 Test Strategy

### Why Two Types of Tests?

1. **Infrastructure Tests**: 
   - Fast, reliable, no external dependencies
   - Perfect for CI/CD
   - Catch deployment and configuration issues
   - Verify security and basic functionality

2. **Integration Tests**:
   - Test actual user workflows
   - Verify business logic works end-to-end
   - Require running server (more complex setup)
   - Catch logic bugs and integration issues

### Best Practices

- **Always run infrastructure tests** before deployment
- **Run integration tests** when testing new features
- **Use both test types** for comprehensive coverage
- **Keep infrastructure tests fast** (under 30 seconds)
- **Integration tests can be slower** (up to 2 minutes)

## 🎉 Success Criteria

### Infrastructure Tests Must Pass
- All 31 tests pass
- No async loop conflicts
- Database connectivity works
- All endpoints respond correctly

### Integration Tests Should Pass
- All 6 tests pass
- Real user workflows work
- Friend requests function correctly
- Messaging system works
- WebSocket tokens generate properly

### Deployment Ready When
- ✅ Infrastructure tests: 31/31 passing
- ✅ Integration tests: 6/6 passing (optional but recommended)
- ✅ GitHub Actions: Green checkmark
- ✅ Database: Connected and working
- ✅ Security: Authentication and authorization working