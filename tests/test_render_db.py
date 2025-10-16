"""Test Render PostgreSQL database functionality."""

import pytest
from httpx import AsyncClient
from utils.security import get_password_hash


class TestRenderDatabase:
    """Test Render PostgreSQL database operations."""
    
    @pytest.mark.asyncio
    async def test_database_connection(self, test_db):
        """Test that we can connect to the Render PostgreSQL database."""
        assert test_db is not None
        assert test_db.pool is not None
        
        # Test a simple query
        result = await test_db.fetchone("SELECT 1 as test")
        assert result['test'] == 1
    
    @pytest.mark.asyncio
    async def test_create_user_in_render_db(self, test_db):
        """Test creating a user in Render PostgreSQL database."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        username = f"render_test_user_{unique_id}"
        email = f"render_test_{unique_id}@test.com"
        password = "testpassword123"
        
        hashed_password = get_password_hash(password)
        
        # Create user
        await test_db.create_user(username, email, hashed_password)
        
        # Verify user was created
        user = await test_db.get_user_by_username(username)
        assert user is not None
        assert user['username'] == username
        assert user['email'] == email
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1", username)
    
    @pytest.mark.asyncio
    async def test_user_login_flow_with_render_db(self, client: AsyncClient, test_db):
        """Test the complete user login flow with Render PostgreSQL."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        username = f"login_render_user_{unique_id}"
        email = f"login_render_{unique_id}@test.com"
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
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1", username)
    
    @pytest.mark.asyncio
    async def test_render_database_tables_exist(self, test_db):
        """Test that all required database tables exist in Render database."""
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
    
    @pytest.mark.asyncio
    async def test_database_schema_structure(self, test_db):
        """Test that the database schema has the correct structure."""
        # Check users table columns
        columns = await test_db.fetchall("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        """)
        
        column_names = [col['column_name'] for col in columns]
        assert 'id' in column_names
        assert 'username' in column_names
        assert 'email' in column_names
        assert 'password' in column_names
        assert 'created_at' in column_names
