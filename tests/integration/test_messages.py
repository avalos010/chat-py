"""Integration tests for message and conversation functionality."""

import pytest
from fastapi.testclient import TestClient


class TestMessagesIntegration:
    """Test message and conversation endpoints."""
    
    def test_chat_page_loads(self, client: TestClient):
        """Test that chat page loads."""
        response = client.get("/chat")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_conversation_endpoints_exist(self, client: TestClient):
        """Test that conversation endpoints exist."""
        # Test conversation endpoint with non-existent user
        response = client.get("/api/conversation/99999")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Conversation endpoint should exist"
    
    def test_recent_conversations_endpoint(self, client: TestClient):
        """Test recent conversations endpoint."""
        response = client.get("/api/recent-conversations")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Recent conversations endpoint should exist"
    
    def test_conversation_with_anyone_endpoint(self, client: TestClient):
        """Test conversation with anyone endpoint."""
        response = client.get("/api/conversation/99999/anyone")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Conversation with anyone endpoint should exist"
    
    def test_mark_read_endpoint(self, client: TestClient):
        """Test mark read endpoint."""
        response = client.post("/api/conversation/99999/mark-read")
        assert response.status_code == 401  # Should require authentication
        
        # If we got a response, it means the endpoint exists
        assert response.status_code != 404, "Mark read endpoint should exist"
    
    def test_messages_endpoint(self, client: TestClient):
        """Test messages endpoint."""
        response = client.get("/messages")
        assert response.status_code == 200  # This endpoint should work without auth
        
        # Should return some response
        response_data = response.json()
        assert isinstance(response_data, dict)
