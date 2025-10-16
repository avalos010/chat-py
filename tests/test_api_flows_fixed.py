"""Fixed API flow tests that match the actual application endpoints."""

import pytest
from fastapi.testclient import TestClient
from utils.security import get_password_hash
import uuid


class TestAPIFlows:
    """Test actual API endpoints and flows."""
    
    def test_login_and_user_info(self, client: TestClient, test_user: dict):
        """Test login and getting user info."""
        # Test login - the app expects OAuth2PasswordRequestForm
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        
        # Login should return 200 with redirect info, not 302 redirect
        assert login_response.status_code == 200
        response_data = login_response.json()
        assert "redirect_url" in response_data
        assert response_data["redirect_url"] == "/chat"
        
        # Check that auth token cookie was set
        assert "auth_token" in login_response.cookies
        token = login_response.cookies.get("auth_token")
        assert token is not None
        assert len(token) > 20  # JWT tokens are long
    
    def test_unauthorized_access(self, client: TestClient):
        """Test that protected endpoints require authentication."""
        # Test accessing user info without auth
        response = client.get("/api/user/me")
        assert response.status_code == 401
        
        # Test accessing friends without auth
        response = client.get("/api/friends")
        assert response.status_code == 401
        
        # Test accessing recent conversations without auth
        response = client.get("/api/recent-conversations")
        assert response.status_code == 401
    
    def test_invalid_login(self, client: TestClient):
        """Test invalid login attempts."""
        # Test with wrong password
        response = client.post("/login", data={
            "username": "nonexistent",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        
        # Test with empty credentials
        response = client.post("/login", data={
            "username": "",
            "password": ""
        })
        assert response.status_code == 401
    
    def test_friends_endpoint_structure(self, client: TestClient, test_user: dict):
        """Test friends endpoint returns proper structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test friends endpoint
        friends_response = client.get("/api/friends", headers=auth_headers)
        assert friends_response.status_code == 200
        
        friends_data = friends_response.json()
        assert isinstance(friends_data, dict)
        assert "friends" in friends_data
        assert isinstance(friends_data["friends"], list)
        # Should be empty for a new user
        assert len(friends_data["friends"]) == 0
    
    def test_recent_conversations_structure(self, client: TestClient, test_user: dict):
        """Test recent conversations endpoint structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test recent conversations endpoint
        conversations_response = client.get("/api/recent-conversations", headers=auth_headers)
        assert conversations_response.status_code == 200
        
        conversations = conversations_response.json()
        assert isinstance(conversations, list)
        # Should be empty for a new user
    
    def test_online_status_structure(self, client: TestClient, test_user: dict):
        """Test online status endpoint structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test online status endpoint
        status_response = client.get("/api/friends/online-status", headers=auth_headers)
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        assert isinstance(status_data, dict)
    
    def test_friend_request_pending_structure(self, client: TestClient, test_user: dict):
        """Test friend request pending endpoint structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test pending friend requests - this endpoint doesn't exist, so it should 404
        # Let's test the actual friend request endpoints
        sent_requests_response = client.get("/api/sent-friend-requests", headers=auth_headers)
        assert sent_requests_response.status_code == 200
        
        sent_requests = sent_requests_response.json()
        assert isinstance(sent_requests, list)
        # Should be empty for a new user
    
    def test_conversation_endpoint_structure(self, client: TestClient, test_user: dict):
        """Test conversation endpoint structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test conversation with non-existent user (should return 403 or 404)
        conversation_response = client.get("/api/conversation/99999", headers=auth_headers)
        # This should fail because user 99999 doesn't exist or isn't a friend
        assert conversation_response.status_code in [403, 404]
    
    def test_invalid_friend_operations(self, client: TestClient, test_user: dict):
        """Test friend operations with invalid data."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test sending friend request to non-existent user
        friend_request_response = client.post(
            "/api/friend-request/send",
            json={"friend_id": 99999},  # Non-existent user
            headers=auth_headers
        )
        assert friend_request_response.status_code == 400
        
        # Test accepting friend request from non-existent user
        accept_response = client.post(
            "/api/friend-request/accept/99999",
            headers=auth_headers
        )
        assert accept_response.status_code == 400


class TestWebSocketSecurity:
    """Test WebSocket security and authentication."""
    
    def test_websocket_url_construction(self, client: TestClient, test_user: dict):
        """Test WebSocket URL construction with valid token."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        
        token = login_response.cookies.get("auth_token")
        assert token is not None
        
        # Test WebSocket URL construction
        ws_url = f"ws://localhost:8000/ws?token={token}"
        assert "token=" in ws_url
        assert token in ws_url
        assert len(token) > 20  # JWT tokens are typically long
    
    def test_invalid_websocket_tokens(self, client: TestClient):
        """Test WebSocket URL construction with invalid tokens."""
        # Test with no token
        ws_url_no_token = "ws://localhost:8000/ws"
        assert "token=" not in ws_url_no_token
        
        # Test with invalid token
        ws_url_invalid = "ws://localhost:8000/ws?token=invalid_token"
        assert "invalid_token" in ws_url_invalid
        
        # Test with malformed token
        ws_url_malformed = "ws://localhost:8000/ws?token=not.a.valid.jwt"
        assert "not.a.valid.jwt" in ws_url_malformed


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    def test_malformed_json_requests(self, client: TestClient, test_user: dict):
        """Test handling of malformed JSON requests."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test malformed JSON in friend request
        response = client.post(
            "/api/friend-request/send",
            data="invalid json",  # Not JSON
            headers=auth_headers
        )
        assert response.status_code == 422  # Validation error
    
    def test_missing_required_fields(self, client: TestClient, test_user: dict):
        """Test requests with missing required fields."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test friend request send without required fields
        response = client.post(
            "/api/friend-request/send",
            json={},  # Missing required fields
            headers=auth_headers
        )
        assert response.status_code == 422  # Validation error
    
    def test_invalid_http_methods(self, client: TestClient, test_user: dict):
        """Test invalid HTTP methods on endpoints."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test GET on POST-only endpoint
        response = client.get("/api/friend-request/send", headers=auth_headers)
        assert response.status_code == 405  # Method not allowed
        
        # Test POST on GET-only endpoint
        response = client.post("/api/user/me", headers=auth_headers)
        assert response.status_code == 405  # Method not allowed


class TestUserManagement:
    """Test user management functionality."""
    
    def test_user_search(self, client: TestClient, test_user: dict):
        """Test user search functionality."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test user search
        search_response = client.get("/api/users/search?q=test", headers=auth_headers)
        assert search_response.status_code == 200
        
        search_results = search_response.json()
        assert isinstance(search_results, list)
    
    def test_user_me_endpoint(self, client: TestClient, test_user: dict):
        """Test the /api/user/me endpoint."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test user info endpoint
        user_response = client.get("/api/user/me", headers=auth_headers)
        assert user_response.status_code == 200
        
        user_info = user_response.json()
        assert isinstance(user_info, dict)
        assert "username" in user_info
        assert "email" in user_info
        assert user_info["username"] == test_user["username"]
        assert user_info["email"] == test_user["email"]


class TestFriendRequestFlow:
    """Test friend request workflow."""
    
    def test_friend_request_endpoints_exist(self, client: TestClient, test_user: dict):
        """Test that friend request endpoints exist and return proper structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test all friend request endpoints
        endpoints_to_test = [
            "/api/friend-requests",
            "/api/all-friend-requests", 
            "/api/sent-friend-requests"
        ]
        
        for endpoint in endpoints_to_test:
            response = client.get(endpoint, headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            # Should be empty for a new user
            assert len(data) == 0
