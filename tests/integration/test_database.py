"""Integration tests for database connectivity and basic operations."""

import pytest
import pytest_asyncio
from db import Database
from utils.security import get_password_hash


class TestDatabaseConnectivity:
    """Test database connection and basic operations."""
    
    @pytest_asyncio.fixture(scope="session")
    async def test_db(self):
        """Create a test database instance using Render PostgreSQL."""
        import os
        database_url = os.getenv("DATABASE_URL")
        
        if not database_url:
            pytest.skip("DATABASE_URL not found in environment variables")
        
        db = Database(database_url)
        await db.connect()
        await db.create_tables()
        
        yield db
        await db.close()
    
    def test_render_db_connection(self, test_db):
        """Test connection to Render PostgreSQL database."""
        assert test_db is not None
        assert test_db.pool is not None
    
    def test_database_connection_basic(self, test_db):
        """Test basic database connection without async operations."""
        # Just verify the database object exists and has a pool
        assert test_db is not None
        assert test_db.pool is not None
        
        # Test that we can create a simple connection (without using it)
        # This verifies the connection string is valid
        assert test_db.pool is not None
