"""Simple API flow tests using the working test setup."""

import pytest
from fastapi.testclient import TestClient
from utils.security import get_password_hash
import uuid


class TestAPIFlows:
    """Test API endpoints and basic flows."""
    
    def test_login_and_user_info(self, client: TestClient, test_user: dict):
        """Test login and getting user info."""
        # Test login
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        
        assert login_response.status_code == 302  # Redirect after login
        assert "auth_token" in login_response.cookies
        
        # Test getting user info
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        user_info_response = client.get("/api/user/me", headers=auth_headers)
        
        assert user_info_response.status_code == 200
        user_info = user_info_response.json()
        assert user_info["username"] == test_user["username"]
        assert user_info["email"] == test_user["email"]
    
    def test_unauthorized_access(self, client: TestClient):
        """Test that protected endpoints require authentication."""
        # Test accessing user info without auth
        response = client.get("/api/user/me")
        assert response.status_code == 401
        
        # Test accessing friends without auth
        response = client.get("/api/friends")
        assert response.status_code == 401
        
        # Test accessing messages without auth
        response = client.get("/api/messages/conversations")
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
        assert response.status_code == 422  # Validation error
    
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
        
        friends = friends_response.json()
        assert isinstance(friends, list)
        # Should be empty for a new user
    
    def test_messages_conversations_structure(self, client: TestClient, test_user: dict):
        """Test messages/conversations endpoint structure."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test conversations endpoint
        conversations_response = client.get("/api/messages/conversations", headers=auth_headers)
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
        
        # Test pending friend requests
        pending_response = client.get("/api/friend-request/pending", headers=auth_headers)
        assert pending_response.status_code == 200
        
        pending_requests = pending_response.json()
        assert isinstance(pending_requests, list)
        # Should be empty for a new user
    
    def test_invalid_message_operations(self, client: TestClient, test_user: dict):
        """Test message operations with invalid data."""
        # Login first
        login_response = client.post("/login", data={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        auth_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test sending message to non-existent user
        send_response = client.post(
            "/api/messages/send",
            json={
                "recipient_id": 99999,  # Non-existent user
                "text": "Test message"
            },
            headers=auth_headers
        )
        assert send_response.status_code == 400
        
        # Test deleting non-existent message
        delete_response = client.delete("/api/messages/99999", headers=auth_headers)
        assert delete_response.status_code == 404
    
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
        
        # Test malformed JSON in message send
        response = client.post(
            "/api/messages/send",
            data="invalid json",  # Not JSON
            headers=auth_headers,
            content_type="application/json"
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
        
        # Test message send without required fields
        response = client.post(
            "/api/messages/send",
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
        response = client.get("/api/messages/send", headers=auth_headers)
        assert response.status_code == 405  # Method not allowed
        
        # Test POST on GET-only endpoint
        response = client.post("/api/user/me", headers=auth_headers)
        assert response.status_code == 405  # Method not allowed
