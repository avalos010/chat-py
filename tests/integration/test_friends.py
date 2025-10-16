"""Integration tests for friend request and management functionality."""

import pytest
from fastapi.testclient import TestClient


class TestFriendsIntegration:
    """Test friend request and management endpoints."""
    
    def test_friends_page_loads(self, client: TestClient):
        """Test that friends page loads."""
        response = client.get("/friends")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_friend_request_endpoints_exist(self, client: TestClient):
        """Test that friend request endpoints exist."""
        # Test the main friend request endpoint
        response = client.post("/api/friend-request/send", json={"test": "data"})
        assert response.status_code in [401, 422], f"Friend request send endpoint should return 401 or 422, got {response.status_code}"
        
        # Test that the endpoint exists (doesn't return 404)
        assert response.status_code != 404, "Friend request send endpoint should exist"
    
    def test_friend_request_endpoints_structure(self, client: TestClient):
        """Test that friend request endpoints return proper structure."""
        # Test all friend request endpoints
        endpoints_to_test = [
            "/api/friend-requests",
            "/api/all-friend-requests", 
            "/api/sent-friend-requests"
        ]
        
        for endpoint in endpoints_to_test:
            response = client.get(endpoint)
            assert response.status_code == 401  # Should require authentication
            
            # If we got a response, it means the endpoint exists
            assert response.status_code != 404, f"Endpoint {endpoint} should exist"
    
    def test_friends_endpoint_structure(self, client: TestClient):
        """Test friends endpoint returns proper structure."""
        response = client.get("/api/friends")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Friends endpoint should exist"
    
    def test_user_search_endpoint(self, client: TestClient):
        """Test user search endpoint."""
        response = client.get("/api/users/search?q=test")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "User search endpoint should exist"
    
    def test_online_status_endpoint(self, client: TestClient):
        """Test online status endpoint."""
        response = client.get("/api/friends/online-status")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Online status endpoint should exist"
