"""End-to-end tests for complete user workflows using real server."""

import pytest
import requests
import time
import json
import uuid


class TestUserJourneys:
    """End-to-end tests using a real running server."""
    
    @pytest.fixture(scope="class")
    def server_url(self):
        """Base URL for the running server."""
        return "http://localhost:8000"
    
    @pytest.fixture(scope="class")
    def server_running(self, server_url):
        """Check if the server is running and wait for it to be ready."""
        max_attempts = 30
        for attempt in range(max_attempts):
            try:
                response = requests.get(f"{server_url}/", timeout=2)
                if response.status_code == 200:
                    print(f"✅ Server is running at {server_url}")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            if attempt < max_attempts - 1:
                print(f"⏳ Waiting for server to start... (attempt {attempt + 1}/{max_attempts})")
                time.sleep(1)
        
        pytest.skip("Server is not running. Start the server with: uvicorn main:app --reload")
    
    def test_complete_user_signup_and_login_flow(self, server_url, server_running):
        """Test the complete signup and login workflow."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Test signup
        signup_data = {
            "username": f"e2euser_{unique_id}",
            "email": f"e2e_{unique_id}@example.com",
            "password": "testpassword123"
        }
        
        signup_response = requests.post(
            f"{server_url}/signup",
            data=signup_data,
            allow_redirects=False
        )
        
        # Signup should succeed (200 or redirect)
        assert signup_response.status_code in [200, 302]
        
        # Test login
        login_response = requests.post(
            f"{server_url}/login",
            data={
                "username": signup_data["username"],
                "password": signup_data["password"]
            },
            allow_redirects=False
        )
        
        # Login should succeed
        assert login_response.status_code in [200, 302]
        
        # Should get auth token cookie
        cookies = login_response.cookies
        assert "auth_token" in cookies
        token = cookies.get("auth_token")
        assert token is not None
        assert len(token) > 20  # JWT tokens are long
        
        # Test accessing protected endpoint with auth
        auth_headers = {"Cookie": f"auth_token={token}"}
        user_info_response = requests.get(f"{server_url}/api/user/me", headers=auth_headers)
        assert user_info_response.status_code == 200
        
        user_info = user_info_response.json()
        assert user_info["username"] == signup_data["username"]
        assert user_info["email"] == signup_data["email"]
    
    def test_complete_friend_request_workflow(self, server_url, server_running):
        """Test the complete friend request workflow."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"friend1_{unique_id}",
            "email": f"fr1_{unique_id}@example.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"friend2_{unique_id}",
            "email": f"fr2_{unique_id}@example.com",
            "password": "password123"
        }
        
        # Signup both users
        requests.post(f"{server_url}/signup", data=user1_data)
        requests.post(f"{server_url}/signup", data=user2_data)
        
        # Login user1
        login1_response = requests.post(
            f"{server_url}/login",
            data={"username": user1_data["username"], "password": user1_data["password"]},
            allow_redirects=False
        )
        user1_cookies = login1_response.cookies
        
        # Login user2
        login2_response = requests.post(
            f"{server_url}/login",
            data={"username": user2_data["username"], "password": user2_data["password"]},
            allow_redirects=False
        )
        user2_cookies = login2_response.cookies
        
        # User1 searches for user2
        search_response = requests.get(
            f"{server_url}/api/users/search?q={user2_data['username']}",
            cookies=user1_cookies
        )
        assert search_response.status_code == 200
        
        search_results = search_response.json()
        assert isinstance(search_results, list)
        
        # Find user2 in search results
        user2_found = None
        for user in search_results:
            if user["username"] == user2_data["username"]:
                user2_found = user
                break
        
        assert user2_found is not None, "User2 should be found in search results"
        
        # User1 sends friend request to user2
        friend_request_response = requests.post(
            f"{server_url}/api/friend-request/send",
            json={"friend_id": user2_found["id"]},
            cookies=user1_cookies,
            headers={"Content-Type": "application/json"}
        )
        
        # Should succeed
        assert friend_request_response.status_code == 200
        response_data = friend_request_response.json()
        assert "message" in response_data
        
        # User2 checks for pending friend requests
        pending_response = requests.get(
            f"{server_url}/api/friend-requests",
            cookies=user2_cookies
        )
        assert pending_response.status_code == 200
        
        pending_requests = pending_response.json()
        assert isinstance(pending_requests, list)
        assert len(pending_requests) > 0, "User2 should have pending friend requests"
        
        # Find the friend request from user1
        friend_request = None
        for request in pending_requests:
            if request["sender_username"] == user1_data["username"]:
                friend_request = request
                break
        
        assert friend_request is not None, "Friend request from user1 should be found"
        
        # User2 accepts the friend request
        accept_response = requests.post(
            f"{server_url}/api/friend-request/accept/{friend_request['sender_id']}",
            cookies=user2_cookies
        )
        assert accept_response.status_code == 200
        
        # Verify they are now friends
        friends_response = requests.get(
            f"{server_url}/api/friends",
            cookies=user1_cookies
        )
        assert friends_response.status_code == 200
        
        friends_data = friends_response.json()
        friends_list = friends_data["friends"]
        
        # Check if user2 is in user1's friends list
        friend_usernames = [friend["username"] for friend in friends_list]
        assert user2_data["username"] in friend_usernames, "User2 should be in user1's friends list"
    
    def test_message_workflow_between_friends(self, server_url, server_running):
        """Test messaging workflow between friends."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create two users
        user1_data = {
            "username": f"msguser1_{unique_id}",
            "email": f"msg1_{unique_id}@example.com",
            "password": "password123"
        }
        user2_data = {
            "username": f"msguser2_{unique_id}",
            "email": f"msg2_{unique_id}@example.com",
            "password": "password123"
        }
        
        # Signup both users
        requests.post(f"{server_url}/signup", data=user1_data)
        requests.post(f"{server_url}/signup", data=user2_data)
        
        # Login both users
        login1_response = requests.post(
            f"{server_url}/login",
            data={"username": user1_data["username"], "password": user1_data["password"]},
            allow_redirects=False
        )
        user1_cookies = login1_response.cookies
        
        login2_response = requests.post(
            f"{server_url}/login",
            data={"username": user2_data["username"], "password": user2_data["password"]},
            allow_redirects=False
        )
        user2_cookies = login2_response.cookies
        
        # User1 searches for user2
        search_response = requests.get(
            f"{server_url}/api/users/search?q={user2_data['username']}",
            cookies=user1_cookies
        )
        search_results = search_response.json()
        user2_found = None
        for user in search_results:
            if user["username"] == user2_data["username"]:
                user2_found = user
                break
        
        assert user2_found is not None
        
        # User1 sends friend request to user2
        requests.post(
            f"{server_url}/api/friend-request/send",
            json={"friend_id": user2_found["id"]},
            cookies=user1_cookies,
            headers={"Content-Type": "application/json"}
        )
        
        # User2 accepts friend request
        requests.post(
            f"{server_url}/api/friend-request/accept/{user1_data['username']}",  # Accept by username
            cookies=user2_cookies
        )
        
        # Test conversation endpoint (should work now that they're friends)
        conversation_response = requests.get(
            f"{server_url}/api/conversation/{user2_found['id']}",
            cookies=user1_cookies
        )
        assert conversation_response.status_code == 200
        
        conversation_data = conversation_response.json()
        assert "conversation" in conversation_data
        assert isinstance(conversation_data["conversation"], list)
        
        # Should be empty initially
        assert len(conversation_data["conversation"]) == 0
        
        # Test recent conversations
        recent_response = requests.get(
            f"{server_url}/api/recent-conversations",
            cookies=user1_cookies
        )
        assert recent_response.status_code == 200
        
        recent_conversations = recent_response.json()
        assert isinstance(recent_conversations, list)
    
    def test_websocket_token_generation_workflow(self, server_url, server_running):
        """Test WebSocket token generation for authenticated users."""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create and login user
        user_data = {
            "username": f"wsuser_{unique_id}",
            "email": f"ws_{unique_id}@example.com",
            "password": "password123"
        }
        
        requests.post(f"{server_url}/signup", data=user_data)
        
        login_response = requests.post(
            f"{server_url}/login",
            data={"username": user_data["username"], "password": user_data["password"]},
            allow_redirects=False
        )
        user_cookies = login_response.cookies
        
        # Test WebSocket token generation
        ws_token_response = requests.get(
            f"{server_url}/api/ws-token",
            cookies=user_cookies
        )
        assert ws_token_response.status_code == 200
        
        ws_token_data = ws_token_response.json()
        assert "token" in ws_token_data
        
        token = ws_token_data["token"]
        assert len(token) > 20  # JWT tokens are long
        
        # Test that we can construct a WebSocket URL
        ws_url = f"ws://localhost:8000/ws?token={token}"
        assert "token=" in ws_url
        assert token in ws_url
