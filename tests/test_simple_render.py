"""Simple test for Render PostgreSQL database connection."""

import pytest
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class TestSimpleRenderConnection:
    """Simple test for Render PostgreSQL connection."""
    
    @pytest.mark.asyncio
    async def test_render_db_connection(self):
        """Test basic connection to Render PostgreSQL database."""
        from db import Database
        
        # Get database URL from environment
        database_url = os.getenv("DATABASE_URL")
        
        if not database_url:
            pytest.skip("DATABASE_URL not found in environment variables")
        
        # Create database instance
        db = Database(database_url)
        
        try:
            # Connect to database
            await db.connect()
            
            # Test a simple query
            result = await db.fetchone("SELECT 1 as test")
            assert result['test'] == 1
            
            # Test that tables exist
            tables_result = await db.fetchall("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            
            table_names = [row['table_name'] for row in tables_result]
            assert 'users' in table_names
            assert 'messages' in table_names
            assert 'friends' in table_names
            
            print(f"✅ Successfully connected to Render PostgreSQL database!")
            print(f"📊 Found tables: {', '.join(table_names)}")
            
        finally:
            # Always close the connection
            await db.close()
    
    @pytest.mark.asyncio
    async def test_create_and_delete_test_user(self):
        """Test creating and deleting a user in Render database."""
        from db import Database
        from utils.security import get_password_hash
        import uuid
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            pytest.skip("DATABASE_URL not found in environment variables")
        
        db = Database(database_url)
        
        try:
            await db.connect()
            
            # Create a unique test user
            unique_id = str(uuid.uuid4())[:8]
            username = f"test_render_user_{unique_id}"
            email = f"test_render_{unique_id}@example.com"
            password = "testpassword123"
            
            hashed_password = get_password_hash(password)
            
            # Create user
            await db.create_user(username, email, hashed_password)
            
            # Verify user was created
            user = await db.get_user_by_username(username)
            assert user is not None
            assert user.username == username
            assert user.email == email
            
            print(f"✅ Successfully created test user: {username}")
            
            # Clean up - delete the user
            await db.execute("DELETE FROM users WHERE username = $1", username)
            
            # Verify user was deleted
            user = await db.get_user_by_username(username)
            assert user is None
            
            print(f"✅ Successfully deleted test user: {username}")
            
        finally:
            await db.close()
