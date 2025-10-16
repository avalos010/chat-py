"""Unit tests for Pydantic models."""

import pytest
from models.auth import User, UserCreate, UserInDB, LoginData, FriendRequestData


class TestUserModels:
    """Test Pydantic model validation and serialization."""
    
    def test_user_model(self):
        """Test User model validation."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com"
        }
        
        user = User(**user_data)
        assert user.username == "testuser"
        assert user.email == "test@example.com"
    
    def test_user_create_model(self):
        """Test UserCreate model validation."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123"
        }
        
        user_create = UserCreate(**user_data)
        assert user_create.username == "newuser"
        assert user_create.email == "new@example.com"
        assert user_create.password == "password123"
    
    def test_user_in_db_model(self):
        """Test UserInDB model validation."""
        user_data = {
            "id": 1,
            "username": "dbuser",
            "email": "db@example.com",
            "password": "hashed_password_here"
        }
        
        user_in_db = UserInDB(**user_data)
        assert user_in_db.id == 1
        assert user_in_db.username == "dbuser"
        assert user_in_db.email == "db@example.com"
        assert user_in_db.password == "hashed_password_here"
    
    def test_login_data_model(self):
        """Test LoginData model validation."""
        login_data = {
            "username": "loginuser",
            "password": "loginpass123"
        }
        
        login = LoginData(**login_data)
        assert login.username == "loginuser"
        assert login.password == "loginpass123"
    
    def test_friend_request_data_model(self):
        """Test FriendRequestData model validation."""
        friend_request_data = {
            "friend_id": 123
        }
        
        friend_request = FriendRequestData(**friend_request_data)
        assert friend_request.friend_id == 123
    
    def test_model_validation_errors(self):
        """Test model validation with invalid data."""
        # Test missing required fields
        with pytest.raises(ValueError):
            User(username="test")  # Missing email
        
        with pytest.raises(ValueError):
            User(email="test@example.com")  # Missing username
        
        # Test invalid email format
        with pytest.raises(ValueError):
            User(username="test", email="invalid-email")
        
        # Test invalid friend_id type
        with pytest.raises(ValueError):
            FriendRequestData(friend_id="not_a_number")
    
    def test_model_serialization(self):
        """Test model serialization to dict."""
        user_data = {
            "username": "serialize_user",
            "email": "serialize@example.com"
        }
        
        user = User(**user_data)
        user_dict = user.model_dump()
        
        assert user_dict["username"] == "serialize_user"
        assert user_dict["email"] == "serialize@example.com"
        assert "username" in user_dict
        assert "email" in user_dict
