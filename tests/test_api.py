"""Test API endpoints for friends, messages, and other features."""

import pytest
from httpx import AsyncClient


class TestFriendsAPI:
    """Test friends-related API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_friends_list(self, client: AsyncClient, auth_headers):
        """Test getting friends list."""
        response = await client.get("/api/friends", headers=auth_headers)
        
        assert response.status_code == 200
        friends = response.json()
        assert isinstance(friends, list)
    
    @pytest.mark.asyncio
    async def test_get_friends_unauthorized(self, client: AsyncClient):
        """Test getting friends list without authentication."""
        response = await client.get("/api/friends")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_send_friend_request(self, client: AsyncClient, auth_headers, two_users):
        """Test sending a friend request."""
        user1, user2 = two_users
        
        # Login as user1
        login_response = await client.post("/login", data={
            "username": user1["username"],
            "password": user1["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Get user2's ID (would need to implement this endpoint or get from user creation)
        # For now, we'll assume we have a way to get user IDs
        response = await client.post(
            "/api/friend-request/send",
            json={"friend_id": 2},  # Assuming user2 has ID 2
            headers=user1_headers
        )
        
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_friend_requests(self, client: AsyncClient, auth_headers):
        """Test getting friend requests."""
        response = await client.get("/api/friend-request/pending", headers=auth_headers)
        
        assert response.status_code == 200
        requests = response.json()
        assert isinstance(requests, list)


class TestMessagesAPI:
    """Test messages-related API endpoints."""
    
    @pytest.mark.asyncio
    async def test_send_message(self, client: AsyncClient, auth_headers):
        """Test sending a message."""
        response = await client.post(
            "/api/messages/send",
            json={
                "recipient_id": 2,
                "text": "Hello, this is a test message!"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        message = response.json()
        assert message["text"] == "Hello, this is a test message!"
        assert "id" in message
        assert "timestamp" in message
    
    @pytest.mark.asyncio
    async def test_get_conversation(self, client: AsyncClient, auth_headers):
        """Test getting conversation messages."""
        response = await client.get(
            "/api/messages/conversation/2",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        messages = response.json()
        assert isinstance(messages, list)
    
    @pytest.mark.asyncio
    async def test_get_recent_conversations(self, client: AsyncClient, auth_headers):
        """Test getting recent conversations."""
        response = await client.get("/api/messages/conversations", headers=auth_headers)
        
        assert response.status_code == 200
        conversations = response.json()
        assert isinstance(conversations, list)


class TestUserStatusAPI:
    """Test user status and online presence endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_online_status(self, client: AsyncClient, auth_headers):
        """Test getting online status of friends."""
        response = await client.get("/api/friends/online-status", headers=auth_headers)
        
        assert response.status_code == 200
        status = response.json()
        assert isinstance(status, dict)


class TestPageRoutes:
    """Test page routes and redirects."""
    
    @pytest.mark.asyncio
    async def test_home_page_redirects_to_chat_when_authenticated(self, client: AsyncClient, auth_headers):
        """Test that home page redirects to chat when user is authenticated."""
        response = await client.get("/", headers=auth_headers, follow_redirects=False)
        
        assert response.status_code == 302
        assert response.headers["location"] == "/chat"
    
    @pytest.mark.asyncio
    async def test_home_page_redirects_to_login_when_not_authenticated(self, client: AsyncClient):
        """Test that home page redirects to login when user is not authenticated."""
        response = await client.get("/", follow_redirects=False)
        
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
    
    @pytest.mark.asyncio
    async def test_login_page_redirects_to_chat_when_authenticated(self, client: AsyncClient, auth_headers):
        """Test that login page redirects to chat when user is authenticated."""
        response = await client.get("/login", headers=auth_headers, follow_redirects=False)
        
        assert response.status_code == 302
        assert response.headers["location"] == "/chat"
    
    @pytest.mark.asyncio
    async def test_signup_page_redirects_to_chat_when_authenticated(self, client: AsyncClient, auth_headers):
        """Test that signup page redirects to chat when user is authenticated."""
        response = await client.get("/signup", headers=auth_headers, follow_redirects=False)
        
        assert response.status_code == 302
        assert response.headers["location"] == "/chat"
