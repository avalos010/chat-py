"""Simple tests that don't require database setup."""

import pytest
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
    
    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes."""
        password1 = "password1"
        password2 = "password2"
        
        hash1 = get_password_hash(password1)
        hash2 = get_password_hash(password2)
        
        assert hash1 != hash2
        assert verify_password(password1, hash1)
        assert verify_password(password2, hash2)
        assert not verify_password(password1, hash2)
        assert not verify_password(password2, hash1)
