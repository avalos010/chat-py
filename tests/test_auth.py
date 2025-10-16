"""Test authentication endpoints and utilities."""

import pytest
from httpx import AsyncClient
from utils.security import verify_password, get_password_hash


class TestPasswordHashing:
    """Test password hashing and verification."""
    
    def test_password_hashing(self):
        """Test that passwords are hashed correctly."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 50  # bcrypt hashes are long
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)
    
    def test_password_verification_edge_cases(self):
        """Test password verification with edge cases."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        # Empty password
        assert not verify_password("", hashed)
        
        # Very long password
        long_password = "a" * 100
        long_hashed = get_password_hash(long_password)
        assert verify_password(long_password, long_hashed)


class TestAuthenticationEndpoints:
    """Test authentication-related API endpoints."""
    
    @pytest.mark.asyncio
    async def test_signup_success(self, client: AsyncClient, test_db):
        """Test successful user signup."""
        response = await client.post("/signup", data={
            "username": "newuser",
            "email": "newuser@example.com", 
            "password": "password123"
        })
        
        # Should redirect to login on success
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
    
    @pytest.mark.asyncio
    async def test_signup_duplicate_username(self, client: AsyncClient, test_user):
        """Test signup with duplicate username."""
        response = await client.post("/signup", data={
            "username": test_user["username"],  # Already exists
            "email": "different@example.com",
            "password": "password123"
        })
        
        assert response.status_code == 400
        assert "Username already exists" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, client: AsyncClient, test_user):
        """Test signup with duplicate email."""
        response = await client.post("/signup", data={
            "username": "differentuser",
            "email": test_user["email"],  # Already exists
            "password": "password123"
        })
        
        assert response.status_code == 400
        assert "Email already exists" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Test successful login."""
        response = await client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        
        assert response.status_code == 302
        assert response.headers["location"] == "/chat"
        assert "auth_token" in response.cookies
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        response = await client.post("/login", data={
            "username": "nonexistent",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Test login with correct username but wrong password."""
        response = await client.post("/login", data={
            "username": test_user["username"],
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_logout(self, client: AsyncClient, auth_headers):
        """Test logout functionality."""
        response = await client.post("/logout", headers=auth_headers)
        
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers, test_user):
        """Test getting current user information."""
        response = await client.get("/api/user/me", headers=auth_headers)
        
        assert response.status_code == 200
        user_data = response.json()
        assert user_data["username"] == test_user["username"]
        assert user_data["email"] == test_user["email"]
        assert "id" in user_data
        assert "password" not in user_data  # Password should not be returned
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/user/me")
        
        assert response.status_code == 401
