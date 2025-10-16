# chat-py

A modern chat application built with FastAPI, TypeScript, and Tailwind CSS. This project features real-time messaging, user authentication, and a responsive web interface.

For a more in-depth tutorial, see our [Fast API tutorial](https://code.visualstudio.com/docs/python/tutorial-fastapi).

The code in this repo aims to follow Python style guidelines as outlined in [PEP 8](https://peps.python.org/pep-0008/).

## Set up instructions

This sample makes use of Dev Containers, in order to leverage this setup, make sure you have [Docker installed](https://www.docker.com/products/docker-desktop).

To successfully run this example, we recommend the following VS Code extensions:

- [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Python](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [Python Debugger](https://marketplace.visualstudio.com/items?itemName=ms-python.debugpy)
- [Pylance](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance)

In addition to these extension there a few settings that are also useful to enable. You can enable to following settings by opening the Settings editor (`Ctrl+,`) and searching for the following settings:

- Python > Analysis > **Type Checking Mode** : `basic`
- Python > Analysis > Inlay Hints: **Function Return Types** : `enable`
- Python > Analysis > Inlay Hints: **Variable Types** : `enable`

## Running the sample

- Open the template folder in VS Code (**File** > **Open Folder...**)
- Open the Command Palette in VS Code (**View > Command Palette...**) and run the **Dev Container: Reopen in Container** command.
- Run the app using the Run and Debug view or by pressing `F5`
- `Ctrl + click` on the URL that shows up on the terminal to open the running application
- Test the API functionality by navigating to `/docs` URL to view the Swagger UI

## Testing

This project includes a comprehensive test suite with **48 total tests** organized into three categories:

### 🧪 Test Structure
```
tests/
├── unit/           # Fast, isolated unit tests (12 tests)
├── integration/    # Database and API integration tests (30 tests)  
├── e2e/            # End-to-end user workflow tests (6 tests)
└── fixtures/       # Shared test data and fixtures
```

### 🚀 Running Tests

#### Quick Start (Unit + Integration Tests)
```bash
# Run all unit and integration tests
./scripts/test.sh

# Or run specific test types
python -m pytest tests/unit/ -v          # Unit tests only
python -m pytest tests/integration/ -v   # Integration tests only
```

#### End-to-End Tests (Real User Workflows)
```bash
# Terminal 1: Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Run end-to-end tests
./scripts/test-integration.sh
```

### 📊 Test Coverage

- **Unit Tests (12 tests)**: Password hashing, model validation, security utilities
- **Integration Tests (30 tests)**: API endpoints, database connectivity, authentication
- **End-to-End Tests (6 tests)**: Complete user workflows, friend requests, messaging
- **Frontend Tests (5 tests)**: DOM manipulation, event handling, async operations

### ✅ What Gets Tested

- ✅ **Authentication**: Login, signup, JWT tokens, password security
- ✅ **API Endpoints**: All endpoints tested for availability and security
- ✅ **Database**: PostgreSQL connectivity and basic operations
- ✅ **Friend Management**: Friend requests, acceptance, rejection
- ✅ **Messaging**: Conversation endpoints, message history
- ✅ **Real-time Features**: WebSocket token generation, online status
- ✅ **Error Handling**: Malformed requests, validation errors
- ✅ **Infrastructure**: Static files, middleware, security headers

### 🔧 CI/CD Integration

Tests run automatically on every push via GitHub Actions:
- Unit and integration tests run in CI
- Database connectivity verified with Render PostgreSQL
- Coverage reporting included
- All tests must pass before deployment

See [TESTING.md](TESTING.md) for detailed testing documentation.
