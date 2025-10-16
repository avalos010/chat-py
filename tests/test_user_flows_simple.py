"""Simplified user flow tests using TestClient."""

import pytest
from fastapi.testclient import TestClient
from utils.security import get_password_hash
import uuid


class TestMessagingFlow:
    """Test complete messaging workflows between users."""
    
    def test_complete_messaging_flow(self, client: TestClient, test_db):
        """Test complete messaging flow: user1 sends message to user2."""
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
        
        # Create users in database
        hashed_password = get_password_hash("password123")
        
        # Use asyncio to run the async database operations
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(test_db.create_user(user1_data["username"], user1_data["email"], hashed_password))
            loop.run_until_complete(test_db.create_user(user2_data["username"], user2_data["email"], hashed_password))
            
            # Get user IDs
            user1 = loop.run_until_complete(test_db.get_user_by_username(user1_data["username"]))
            user2 = loop.run_until_complete(test_db.get_user_by_username(user2_data["username"]))
        finally:
            loop.close()
        
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
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(test_db.execute("DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1", user1.id))
            loop.run_until_complete(test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                                                   user1_data["username"], user2_data["username"]))
        finally:
            loop.close()


class TestFriendRequestFlow:
    """Test friend request workflows."""
    
    def test_complete_friend_request_flow(self, client: TestClient, test_db):
        """Test complete friend request flow: send -> accept -> become friends."""
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
        
        # Use asyncio to run the async database operations
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(test_db.create_user(user1_data["username"], user1_data["email"], hashed_password))
            loop.run_until_complete(test_db.create_user(user2_data["username"], user2_data["email"], hashed_password))
            
            user1 = loop.run_until_complete(test_db.get_user_by_username(user1_data["username"]))
            user2 = loop.run_until_complete(test_db.get_user_by_username(user2_data["username"]))
        finally:
            loop.close()
        
        # User1 sends friend request to user2
        login_response1 = client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response1.cookies.get('auth_token')}"}
        
        friend_request_response = client.post(
            "/api/friend-request/send",
            json={"friend_id": user2.id},
            headers=user1_headers
        )
        
        assert friend_request_response.status_code == 200
        
        # User2 accepts the friend request
        login_response2 = client.post("/login", data={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_headers = {"Cookie": f"auth_token={login_response2.cookies.get('auth_token')}"}
        
        # Get pending friend requests
        pending_response = client.get("/api/friend-request/pending", headers=user2_headers)
        assert pending_response.status_code == 200
        pending_requests = pending_response.json()
        assert len(pending_requests) == 1
        assert pending_requests[0]["requester_id"] == user1.id
        
        # Accept the friend request
        accept_response = client.post(
            f"/api/friend-request/accept/{user1.id}",
            headers=user2_headers
        )
        
        assert accept_response.status_code == 200
        
        # Verify they are now friends
        friends_response = client.get("/api/friends", headers=user1_headers)
        assert friends_response.status_code == 200
        friends = friends_response.json()
        assert len(friends) == 1
        assert friends[0]["username"] == user2_data["username"]
        
        # Clean up
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(test_db.execute("DELETE FROM friends WHERE user_id = $1 OR friend_id = $1", user1.id))
            loop.run_until_complete(test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                                                   user1_data["username"], user2_data["username"]))
        finally:
            loop.close()


class TestMessageDeletion:
    """Test message deletion functionality."""
    
    def test_message_deletion_flow(self, client: TestClient, test_db):
        """Test deleting messages."""
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
        
        # Use asyncio to run the async database operations
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(test_db.create_user(user1_data["username"], user1_data["email"], hashed_password))
            loop.run_until_complete(test_db.create_user(user2_data["username"], user2_data["email"], hashed_password))
            
            user1 = loop.run_until_complete(test_db.get_user_by_username(user1_data["username"]))
            user2 = loop.run_until_complete(test_db.get_user_by_username(user2_data["username"]))
        finally:
            loop.close()
        
        # Login as user1 and send message
        login_response = client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Send message
        send_response = client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": "Message to be deleted"
            },
            headers=user1_headers
        )
        
        message_id = send_response.json()["id"]
        
        # Delete the message
        delete_response = client.delete(
            f"/api/messages/{message_id}",
            headers=user1_headers
        )
        
        assert delete_response.status_code == 200
        
        # Verify message is deleted
        conversation_response = client.get(
            f"/api/messages/conversation/{user2.id}",
            headers=user1_headers
        )
        
        messages = conversation_response.json()
        assert len(messages) == 0
        
        # Clean up
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                                                   user1_data["username"], user2_data["username"]))
        finally:
            loop.close()


class TestOnlineStatus:
    """Test online status functionality."""
    
    def test_online_status_api(self, client: TestClient, test_db):
        """Test online status API endpoint."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a user
        user_data = {
            "username": f"online_{unique_id}",
            "email": f"online_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        
        # Use asyncio to run the async database operations
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(test_db.create_user(user_data["username"], user_data["email"], hashed_password))
        finally:
            loop.close()
        
        # Login
        login_response = client.post("/login", data={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        user_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Test online status endpoint
        status_response = client.get("/api/friends/online-status", headers=user_headers)
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        assert isinstance(status_data, dict)
        
        # Clean up
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(test_db.execute("DELETE FROM users WHERE username = $1", user_data["username"]))
        finally:
            loop.close()
