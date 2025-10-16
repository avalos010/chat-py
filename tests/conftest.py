"""Pytest configuration and fixtures for testing with Render PostgreSQL database."""

import pytest
import pytest_asyncio
import asyncio
import os
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import your app and database
from main import app
from db import Database


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db() -> AsyncGenerator[Database, None]:
    """Create a test database instance using Render PostgreSQL."""
    # Use the DATABASE_URL from .env (Render PostgreSQL)
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        pytest.skip("DATABASE_URL not found in environment variables")
    
    # Create database instance
    db = Database(database_url)
    await db.connect()
    
    # Create tables (they should already exist, but ensure they're there)
    await db.create_tables()
    
    yield db
    
    # Cleanup - close connection but don't drop tables
    await db.close()


@pytest.fixture
def client(test_db: Database) -> TestClient:
    """Create a test client with the Render PostgreSQL database."""
    return TestClient(app)


@pytest_asyncio.fixture
async def test_user(test_db: Database) -> dict:
    """Create a test user and return user data."""
    from utils.security import get_password_hash
    
    # Use unique usernames/emails for tests to avoid conflicts
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    
    username = f"testuser_{unique_id}"
    email = f"test_{unique_id}@example.com"
    password = os.getenv("TEST_USER_PASSWORD", "testpassword123")
    
    hashed_password = get_password_hash(password)
    await test_db.create_user(username, email, hashed_password)
    
    return {
        "username": username,
        "email": email,
        "password": password,
        "hashed_password": hashed_password
    }


@pytest.fixture
def auth_headers(client: TestClient, test_user: dict) -> dict:
    """Create authentication headers for a test user."""
    # Login to get token
    response = client.post("/login", data={
        "username": test_user["username"],
        "password": test_user["password"]
    })
    
    # Extract cookies from response
    cookies = response.cookies
    return {"Cookie": f"auth_token={cookies.get('auth_token')}"}


@pytest_asyncio.fixture
async def two_users(test_db: Database) -> tuple[dict, dict]:
    """Create two test users for friend/conversation tests."""
    from utils.security import get_password_hash
    import uuid
    
    unique_id = str(uuid.uuid4())[:8]
    
    # User 1
    user1_data = {
        "username": f"user1_{unique_id}",
        "email": f"user1_{unique_id}@example.com",
        "password": os.getenv("TEST_USER_PASSWORD_ALT", "password123")
    }
    hashed_password1 = get_password_hash(user1_data["password"])
    await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password1)
    
    # User 2
    user2_data = {
        "username": f"user2_{unique_id}", 
        "email": f"user2_{unique_id}@example.com",
        "password": os.getenv("TEST_USER_PASSWORD_ALT", "password123")
    }
    hashed_password2 = get_password_hash(user2_data["password"])
    await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password2)
    
    return user1_data, user2_data


# Test cleanup fixture
@pytest_asyncio.fixture(autouse=True)
async def cleanup_test_data(test_db: Database, test_user: dict):
    """Automatically clean up test data after each test."""
    yield
    
    # Clean up the test user after each test
    try:
        await test_db.execute("DELETE FROM users WHERE username = $1", test_user["username"])
    except Exception:
        pass  # Ignore cleanup errors


@pytest_asyncio.fixture(autouse=True)
async def cleanup_two_users_test_data(test_db: Database, two_users):
    """Clean up test data for two_users fixture."""
    yield
    
    user1, user2 = two_users
    try:
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1["username"], user2["username"])
    except Exception:
        pass  # Ignore cleanup errors