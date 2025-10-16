"""Test PostgreSQL database functionality."""

import pytest
from httpx import AsyncClient
from utils.security import get_password_hash


class TestPostgreSQLDatabase:
    """Test PostgreSQL database operations."""
    
    @pytest.mark.asyncio
    async def test_database_connection(self, test_db):
        """Test that we can connect to the PostgreSQL test database."""
        assert test_db is not None
        assert test_db.pool is not None
        
        # Test a simple query
        result = await test_db.fetchone("SELECT 1 as test")
        assert result['test'] == 1
    
    @pytest.mark.asyncio
    async def test_create_user(self, test_db):
        """Test creating a user in PostgreSQL."""
        username = "postgres_test_user"
        email = "postgres@test.com"
        password = "testpassword123"
        
        hashed_password = get_password_hash(password)
        
        # Create user
        await test_db.create_user(username, email, hashed_password)
        
        # Verify user was created
        user = await test_db.get_user_by_username(username)
        assert user is not None
        assert user['username'] == username
        assert user['email'] == email
    
    @pytest.mark.asyncio
    async def test_user_login_flow(self, client: AsyncClient, test_db):
        """Test the complete user login flow with PostgreSQL."""
        username = "login_test_user"
        email = "login@test.com"
        password = "testpassword123"
        
        hashed_password = get_password_hash(password)
        
        # Create user
        await test_db.create_user(username, email, hashed_password)
        
        # Test login
        response = await client.post("/login", data={
            "username": username,
            "password": password
        })
        
        # Should redirect to chat on successful login
        assert response.status_code == 302
        assert response.headers["location"] == "/chat"
        assert "auth_token" in response.cookies
    
    @pytest.mark.asyncio
    async def test_database_tables_exist(self, test_db):
        """Test that all required database tables exist."""
        # Check if users table exists
        result = await test_db.fetchone("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        """)
        assert result['exists'] is True
        
        # Check if messages table exists
        result = await test_db.fetchone("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'messages'
            );
        """)
        assert result['exists'] is True
        
        # Check if friends table exists
        result = await test_db.fetchone("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'friends'
            );
        """)
        assert result['exists'] is True
