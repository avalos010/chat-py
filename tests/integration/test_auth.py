"""Integration tests for authentication endpoints and flows."""

import pytest
from fastapi.testclient import TestClient


class TestAuthenticationIntegration:
    """Test authentication endpoints and flows."""
    
    def test_login_page_loads(self, client: TestClient):
        """Test that login page loads correctly."""
        response = client.get("/login")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_signup_page_loads(self, client: TestClient):
        """Test that signup page loads correctly."""
        response = client.get("/signup")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_invalid_login_credentials(self, client: TestClient):
        """Test login with invalid credentials."""
        response = client.post("/login", data={
            "username": "nonexistent_user",
            "password": "wrong_password"
        })
        assert response.status_code == 401
    
    def test_empty_login_credentials(self, client: TestClient):
        """Test login with empty credentials."""
        response = client.post("/login", data={
            "username": "",
            "password": ""
        })
        assert response.status_code == 401
    
    def test_unauthorized_api_access(self, client: TestClient):
        """Test that protected API endpoints require authentication."""
        # Test accessing user info without auth
        response = client.get("/api/user/me")
        assert response.status_code == 401
        
        # Test accessing friends without auth
        response = client.get("/api/friends")
        assert response.status_code == 401
        
        # Test accessing recent conversations without auth
        response = client.get("/api/recent-conversations")
        assert response.status_code == 401
    
    def test_api_endpoints_exist(self, client: TestClient):
        """Test that API endpoints exist (return 401 instead of 404)."""
        api_endpoints = [
            "/api/user/me",
            "/api/friends",
            "/api/recent-conversations",
            "/api/friends/online-status",
            "/api/friend-requests",
            "/api/all-friend-requests",
            "/api/sent-friend-requests",
            "/api/users/search"
        ]
        
        for endpoint in api_endpoints:
            response = client.get(endpoint)
            # Should return 401 (unauthorized) not 404 (not found)
            assert response.status_code == 401, f"Endpoint {endpoint} should exist but return 401"
    
    def test_invalid_http_methods(self, client: TestClient):
        """Test invalid HTTP methods on endpoints."""
        # Test GET on POST-only endpoint
        response = client.get("/api/friend-request/send")
        assert response.status_code == 405  # Method not allowed
        
        # Test POST on GET-only endpoint
        response = client.post("/api/user/me")
        assert response.status_code == 405  # Method not allowed
    
    def test_malformed_json_requests(self, client: TestClient):
        """Test handling of malformed JSON requests."""
        response = client.post(
            "/api/friend-request/send",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422  # Validation error for malformed JSON
    
    def test_missing_required_fields(self, client: TestClient):
        """Test requests with missing required fields."""
        response = client.post(
            "/api/friend-request/send",
            json={},  # Missing required fields
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422  # Validation error for missing fields
