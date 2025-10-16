"""Complete user journey tests - from signup to full chat experience."""

import pytest
from httpx import AsyncClient
from utils.security import get_password_hash
import uuid


class TestCompleteUserJourney:
    """Test complete user journey from signup to active chatting."""
    
    @pytest.mark.asyncio
    async def test_full_user_lifecycle(self, client: AsyncClient, test_db):
        """Test complete user lifecycle: signup -> login -> friend request -> chat -> logout."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Step 1: Create two users (simulating signup)
        user1_data = {
            "username": f"journey1_{unique_id}",
            "email": f"journey1_{unique_id}@test.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"journey2_{unique_id}",
            "email": f"journey2_{unique_id}@test.com",
            "password": "password123"
        }
        
        hashed_password = get_password_hash("password123")
        await test_db.create_user(user1_data["username"], user1_data["email"], hashed_password)
        await test_db.create_user(user2_data["username"], user2_data["email"], hashed_password)
        
        user1 = await test_db.get_user_by_username(user1_data["username"])
        user2 = await test_db.get_user_by_username(user2_data["username"])
        
        # Step 2: User1 logs in
        login1_response = await client.post("/login", data={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        assert login1_response.status_code == 302  # Redirect after login
        user1_headers = {"Cookie": f"auth_token={login1_response.cookies.get('auth_token')}"}
        
        # Step 3: User1 sends friend request to User2
        friend_request_response = await client.post(
            "/api/friend-request/send",
            json={"friend_id": user2.id},
            headers=user1_headers
        )
        assert friend_request_response.status_code == 200
        
        # Step 4: User2 logs in and sees friend request
        login2_response = await client.post("/login", data={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_headers = {"Cookie": f"auth_token={login2_response.cookies.get('auth_token')}"}
        
        # Check pending friend requests
        pending_response = await client.get("/api/friend-request/pending", headers=user2_headers)
        assert pending_response.status_code == 200
        pending_requests = pending_response.json()
        assert len(pending_requests) == 1
        assert pending_requests[0]["requester_id"] == user1.id
        
        # Step 5: User2 accepts friend request
        accept_response = await client.post(
            f"/api/friend-request/accept/{user1.id}",
            headers=user2_headers
        )
        assert accept_response.status_code == 200
        
        # Step 6: Verify they are now friends
        friends_response1 = await client.get("/api/friends", headers=user1_headers)
        friends_response2 = await client.get("/api/friends", headers=user2_headers)
        
        friends1 = friends_response1.json()
        friends2 = friends_response2.json()
        
        assert len(friends1) == 1
        assert len(friends2) == 1
        assert friends1[0]["username"] == user2_data["username"]
        assert friends2[0]["username"] == user1_data["username"]
        
        # Step 7: Start chatting - User1 sends first message
        message1_response = await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": "Hey! How are you doing?"
            },
            headers=user1_headers
        )
        assert message1_response.status_code == 200
        
        # Step 8: User2 replies
        message2_response = await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user1.id,
                "text": "I'm doing great! Thanks for asking."
            },
            headers=user2_headers
        )
        assert message2_response.status_code == 200
        
        # Step 9: Verify conversation history
        conversation1_response = await client.get(
            f"/api/messages/conversation/{user2.id}",
            headers=user1_headers
        )
        conversation2_response = await client.get(
            f"/api/messages/conversation/{user1.id}",
            headers=user2_headers
        )
        
        conv1_messages = conversation1_response.json()
        conv2_messages = conversation2_response.json()
        
        assert len(conv1_messages) == 2
        assert len(conv2_messages) == 2
        
        # Verify message order and content
        assert conv1_messages[0]["text"] == "Hey! How are you doing?"
        assert conv1_messages[0]["sender_id"] == user1.id
        assert conv1_messages[1]["text"] == "I'm doing great! Thanks for asking."
        assert conv1_messages[1]["sender_id"] == user2.id
        
        # Step 10: Get recent conversations
        conversations1_response = await client.get("/api/messages/conversations", headers=user1_headers)
        conversations2_response = await client.get("/api/messages/conversations", headers=user2_headers)
        
        convs1 = conversations1_response.json()
        convs2 = conversations2_response.json()
        
        assert len(convs1) == 1
        assert len(convs2) == 1
        assert convs1[0]["friend_username"] == user2_data["username"]
        assert convs2[0]["friend_username"] == user1_data["username"]
        
        # Step 11: User1 deletes a message
        message_to_delete = conv1_messages[0]["id"]
        delete_response = await client.delete(
            f"/api/messages/{message_to_delete}",
            headers=user1_headers
        )
        assert delete_response.status_code == 200
        
        # Verify message was deleted
        updated_conversation = await client.get(
            f"/api/messages/conversation/{user2.id}",
            headers=user1_headers
        )
        remaining_messages = updated_conversation.json()
        assert len(remaining_messages) == 1
        assert remaining_messages[0]["text"] == "I'm doing great! Thanks for asking."
        
        # Step 12: Check online status
        status1_response = await client.get("/api/friends/online-status", headers=user1_headers)
        status2_response = await client.get("/api/friends/online-status", headers=user2_headers)
        
        assert status1_response.status_code == 200
        assert status2_response.status_code == 200
        
        # Step 13: User1 removes User2 as friend
        unfriend_response = await client.delete(
            f"/api/friends/{user2.id}",
            headers=user1_headers
        )
        assert unfriend_response.status_code == 200
        
        # Verify they are no longer friends
        final_friends_response = await client.get("/api/friends", headers=user1_headers)
        final_friends = final_friends_response.json()
        assert len(final_friends) == 0
        
        # Clean up
        await test_db.execute("DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1", user1.id)
        await test_db.execute("DELETE FROM users WHERE username = $1 OR username = $2", 
                             user1_data["username"], user2_data["username"])
    
    @pytest.mark.asyncio
    async def test_multi_conversation_management(self, client: AsyncClient, test_db):
        """Test managing multiple conversations simultaneously."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create three users
        users_data = []
        for i in range(3):
            user_data = {
                "username": f"multi{i}_{unique_id}",
                "email": f"multi{i}_{unique_id}@test.com",
                "password": "password123"
            }
            users_data.append(user_data)
        
        hashed_password = get_password_hash("password123")
        user_objects = []
        
        for user_data in users_data:
            await test_db.create_user(user_data["username"], user_data["email"], hashed_password)
            user = await test_db.get_user_by_username(user_data["username"])
            user_objects.append(user)
        
        user1, user2, user3 = user_objects
        
        # Login as user1
        login_response = await client.post("/login", data={
            "username": users_data[0]["username"],
            "password": users_data[0]["password"]
        })
        user1_headers = {"Cookie": f"auth_token={login_response.cookies.get('auth_token')}"}
        
        # Make user1 friends with user2 and user3
        await test_db.execute(
            "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')",
            user1.id, user2.id
        )
        await test_db.execute(
            "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')",
            user1.id, user3.id
        )
        
        # Send messages to both friends
        await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user2.id,
                "text": "Message to friend 2"
            },
            headers=user1_headers
        )
        
        await client.post(
            "/api/messages/send",
            json={
                "recipient_id": user3.id,
                "text": "Message to friend 3"
            },
            headers=user1_headers
        )
        
        # Get all conversations
        conversations_response = await client.get("/api/messages/conversations", headers=user1_headers)
        conversations = conversations_response.json()
        
        assert len(conversations) == 2
        
        # Verify both conversations are present
        friend_usernames = [conv["friend_username"] for conv in conversations]
        assert users_data[1]["username"] in friend_usernames
        assert users_data[2]["username"] in friend_usernames
        
        # Clean up
        await test_db.execute("DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1", user1.id)
        await test_db.execute("DELETE FROM friends WHERE user_id = $1 OR friend_id = $1", user1.id)
        for user in user_objects:
            await test_db.execute("DELETE FROM users WHERE id = $1", user.id)
    
    @pytest.mark.asyncio
    async def test_error_handling_flows(self, client: AsyncClient, test_db):
        """Test error handling in user flows."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a user
        user_data = {
            "username": f"error_{unique_id}",
            "email": f"error_{unique_id}@test.com",
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
        
        # Test sending message to non-existent user
        invalid_message_response = await client.post(
            "/api/messages/send",
            json={
                "recipient_id": 99999,  # Non-existent user ID
                "text": "This should fail"
            },
            headers=user_headers
        )
        assert invalid_message_response.status_code == 400
        
        # Test sending friend request to non-existent user
        invalid_friend_response = await client.post(
            "/api/friend-request/send",
            json={"friend_id": 99999},  # Non-existent user ID
            headers=user_headers
        )
        assert invalid_friend_response.status_code == 400
        
        # Test accessing non-existent conversation
        invalid_conversation_response = await client.get(
            "/api/messages/conversation/99999",
            headers=user_headers
        )
        assert invalid_conversation_response.status_code == 404
        
        # Clean up
        await test_db.execute("DELETE FROM users WHERE username = $1", user_data["username"])
