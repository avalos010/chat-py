"""Unit tests for security utilities (password hashing, JWT)."""

import pytest
from utils.security import get_password_hash, verify_password


class TestPasswordHashing:
    """Test password hashing and verification functions."""
    
    def test_password_hashing(self):
        """Test that passwords are hashed correctly."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        # Hash should be different from original password
        assert hashed != password
        assert len(hashed) > 50  # bcrypt hashes are long
        
        # Should be able to verify the password
        assert verify_password(password, hashed) is True
    
    def test_password_verification_edge_cases(self):
        """Test password verification with edge cases."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        # Wrong password should fail
        assert verify_password("wrongpassword", hashed) is False
        
        # Empty password should fail
        assert verify_password("", hashed) is False
        
        # None password should fail
        assert verify_password(None, hashed) is False
    
    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes."""
        password1 = "password1"
        password2 = "password2"
        
        hash1 = get_password_hash(password1)
        hash2 = get_password_hash(password2)
        
        # Different passwords should produce different hashes
        assert hash1 != hash2
        
        # Each hash should verify only its corresponding password
        assert verify_password(password1, hash1) is True
        assert verify_password(password2, hash1) is False
        assert verify_password(password1, hash2) is False
        assert verify_password(password2, hash2) is True
    
    def test_password_length_limits(self):
        """Test password length handling."""
        # Test very long password (should be truncated by bcrypt)
        long_password = "a" * 100
        hashed = get_password_hash(long_password)
        assert len(hashed) > 50
        
        # Should still be able to verify
        assert verify_password(long_password, hashed) is True
    
    def test_special_characters_in_passwords(self):
        """Test passwords with special characters."""
        special_password = "Test@123#$%^&*()_+-=[]{}|;:,.<>?"
        hashed = get_password_hash(special_password)
        
        assert verify_password(special_password, hashed) is True
        assert verify_password("Test@123#$%^&*()_+-=[]{}|;:,.<>", hashed) is False
