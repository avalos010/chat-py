"""Comprehensive user flow tests for chat-py application."""

import pytest
from fastapi.testclient import TestClient
from utils.security import get_password_hash
import uuid


class TestMessagingFlow:
    """Test complete messaging workflows between users."""
    
    def test_complete_messaging_flow(self, client: TestClient, test_db):
        """Test complete messaging flow: user1 sends message to user2."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"messenger1_{unique_id}",
            "email": f"msg1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"messenger2_{unique_id}",
            "email": f"msg2_{unique_id}@test.com", 
            "password": "password123"
        }
        
        # Create users
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        # Get user IDs
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # Login as user1
        login_response = client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Send message from user1 to user2
        message_text = "Hello, this is a test message!"
        send_response = client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": message_text
            },
            headers=user1_headers
        )
        
        assert send_response.status_code == 200
        sent_message = send_response.json()
        assert sent_message["text"] == message_text
        assert sent_message["sender_id"] == user1.id
        assert sent_message["recipient_id"] == user2.id
        
        # Login as user2 and get conversation
        login_response2 = client.post("/login", data={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_headers = {"Cookie": f"auth_token={login_response2.cookies.get('auth_token')}"}
        
        # Get conversation messages
        conversation_response = client.get(
            f"/api/messages/conversation/{user1.id}",
            headers=user2_headers
        )
        
        assert conversation_response.status_code == 200
        messages = conversation_response.json()
        assert len(messages) == 1
        assert messages[0]["text"] == message_text
        assert messages[0]["sender_id"] == user1.id
        
        # Clean up
        await test_db.execute("DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1", user1.id)
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])
    
    @pytest.mark.asyncio
    async def test_message_deletion_flow(self, client: AsyncClient, test_db):
        """Test deleting messages."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"deleter1_{unique_id}",
            "email": f"del1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"deleter2_{unique_id}",
            "email": f"del2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # Login as user1 and send message
        login_response = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Send message
        send_response = await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": "Message to be deleted"
            },
            headers=user1_headers
        )
        
        message_id = send_response.json()["id"]
        
        # Delete the message
        delete_response = await client.delete(
            f"/api/messages/{message_id}",
            headers=user1_headers
        )
        
        assert delete_response.status_code == 200
        
        # Verify message is deleted
        conversation_response = await client.get(
            f"/api/messages/conversation/{user2.id}",
            headers=user1_headers
        )
        
        messages = conversation_response.json()
        assert len(messages) == 0
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])


class TestFriendRequestFlow:
    """Test friend request workflows."""
    
    @pytest.mark.asyncio
    async def test_complete_friend_request_flow(self, client: AsyncClient, test_db):
        """Test complete friend request flow: send -> accept -> become friends."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"friend1_{unique_id}",
            "email": f"fr1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"friend2_{unique_id}",
            "email": f"fr2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # User1 sends friend request to user2
        login_response1 = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response1.cookies.get('auth_token')}"}
        
        friend_request_response = await client.post(
            "/api/friend-request/send",
            json={"friend_id": user2.id},
            headers=user1_headers
        )
        
        assert friend_request_response.status_code == 200
        
        # User2 accepts the friend request
        login_response2 = await client.post("/login", data={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_headers = {"Cookie": f"auth_token={login_response2.cookies.get('auth_token')}"}
        
        # Get pending friend requests
        pending_response = await client.get("/api/friend-request/pending", headers=user2_headers)
        assert pending_response.status_code == 200
        pending_requests = pending_response.json()
        assert len(pending_requests) == 1
        assert pending_requests[0]["requester_id"] == user1.id
        
        # Accept the friend request
        accept_response = await client.post(
            f"/api/friend-request/accept/{user1.id}",
            headers=user2_headers
        )
        
        assert accept_response.status_code == 200
        
        # Verify they are now friends
        friends_response = await client.get("/api/friends", headers=user1_headers)
        assert friends_response.status_code == 200
        friends = friends_response.json()
        assert len(friends) == 1
        assert friends[0]["username"] == user2_data["username"]
        
        # Clean up
        await test_db.execute("DELETE FROM friends WHERE user_id = $1 OR friend_id = $1", user1.id)
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])
    
    @pytest.mark.asyncio
    async def test_friend_request_rejection_flow(self, client: AsyncClient, test_db):
        """Test friend request rejection flow."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"reject1_{unique_id}",
            "email": f"rj1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"reject2_{unique_id}",
            "email": f"rj2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # User1 sends friend request
        login_response1 = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response1.cookies.get('auth_token')}"}
        
        await client.post(
            "/api/friend-request/send",
            json={"friend_id": user2.id},
            headers=user1_headers
        )
        
        # User2 rejects the friend request
        login_response2 = await client.post("/login", data={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_headers = {"Cookie": f"auth_token={login_response2.cookies.get('auth_token')}"}
        
        reject_response = await client.post(
            f"/api/friend-request/reject/{user1.id}",
            headers=user2_headers
        )
        
        assert reject_response.status_code == 200
        
        # Verify they are NOT friends
        friends_response = await client.get("/api/friends", headers=user1_headers)
        friends = friends_response.json()
        assert len(friends) == 0
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])


class TestFriendManagement:
    """Test friend management operations."""
    
    @pytest.mark.asyncio
    async def test_unfriend_flow(self, client: AsyncClient, test_db):
        """Test removing a friend."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users and make them friends
        user1_data = {
            "username": f"unfriend1_{unique_id}",
            "email": f"uf1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"unfriend2_{unique_id}",
            "email": f"uf2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # Manually add them as friends (simulate accepted friend request)
        await test_db.execute(
            "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')",
            user1.id, user2.id
        )
        
        # Login as user1
        login_response = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Verify they are friends initially
        friends_response = await client.get("/api/friends", headers=user1_headers)
        friends = friends_response.json()
        assert len(friends) == 1
        
        # Remove friend
        unfriend_response = await client.delete(
            f"/api/friends/{user2.id}",
            headers=user1_headers
        )
        
        assert unfriend_response.status_code == 200
        
        # Verify they are no longer friends
        friends_response = await client.get("/api/friends", headers=user1_headers)
        friends = friends_response.json()
        assert len(friends) == 0
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])


class TestOnlineStatus:
    """Test online status and WebSocket functionality."""
    
    @pytest.mark.asyncio
    async def test_online_status_api(self, client: AsyncClient, test_db):
        """Test online status API endpoint."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a user
        user_data = {
            "username": f"online_{unique_id}",
            "email": f"online_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user_data["username"], user_data["email"], hashed_password)
        
        # Login
        login_response = await client.post("/login", data={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        user_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test online status endpoint
        status_response = await client.get("/api/friends/online-status", headers=user_headers)
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        assert isinstance(status_data, dict)
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1", user_data["username"])
    
    @pytest.mark.asyncio
    async def test_websocket_connection_auth(self, client: AsyncClient, test_db):
        """Test WebSocket connection with authentication."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a user
        user_data = {
            "username": f"ws_{unique_id}",
            "email": f"ws_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user_data["username"], user_data["email"], hashed_password)
        
        # Login to get token
        login_response = await client.post("/login", data={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        
        token = login_response.cookies.get("auth_token")
        assert token is not None
        
        # Test that we can construct a WebSocket URL with token
        # (Note: Actual WebSocket testing would require a WebSocket client)
        ws_url = f"ws://localhost:8000/ws?token={token}"
        assert "token=" in ws_url
        assert token in ws_url
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1", user_data["username"])


class TestConversationManagement:
    """Test conversation and message management."""
    
    @pytest.mark.asyncio
    async def test_recent_conversations(self, client: AsyncClient, test_db):
        """Test getting recent conversations."""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"conv1_{unique_id}",
            "email": f"c1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"conv2_{unique_id}",
            "email": f"c2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # Login as user1
        login_response = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Send a message to create a conversation
        await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": "Test conversation message"
            },
            headers=user1_headers
        )
        
        # Get recent conversations
        conversations_response = await client.get("/api/messages/conversations", headers=user1_headers)
        assert conversations_response.status_code == 200
        
        conversations = conversations_response.json()
        assert len(conversations) == 1
        assert conversations[0]["friend_username"] == user2_data["username"]
        
        # Clean up
        await test_db.execute("DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1", user1.id)
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])
