from codecs import encode
from typing_extensions import Annotated
from fastapi import Body, FastAPI, WebSocket, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
import jwt
from models.auth import MsgPayload, MessageResponse
from models.auth import LoginData, User, UserCreate, Token, UserInDB, FriendRequestData
from utils.security import (
    verify_token,
    oauth2_scheme,
    SECRET_KEY,
    ALGORITHM,
    create_access_token,
    verify_password,
    get_password_hash
)

from db import Database
import logging
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

# Fake database for development
fake_users_db = {}

app = FastAPI(debug=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
db = Database()

@app.on_event("startup")
async def on_startup():
    print("Starting up!")
    await db.connect()
    await db.create_tables()
@app.on_event("shutdown")
async def on_shutdown():
    print("shutting down!")
    await db.close()
# Store active connections with user info
connections: List[dict] = []

# In-memory storage for messages
messages_list: dict[int, MsgPayload] = {}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    print("Get current user executed")
    print("Request headers:", request.headers)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        print("Decoded payload:", payload)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as e:
        print("Error:", e)
        raise credentials_exception
    user = await get_user(db, username)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return user

async def get_current_user_from_cookie(request: Request):
    """Get current user from secure HttpOnly cookie"""
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await get_user(db, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_user_from_request(request: Request):
    """Get current user from request state (set by middleware)"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
    
@app.get("/chat")
async def chat_route(request: Request):
    """Serve the chat page template - requires authentication"""
    # First try to get user from middleware (for API requests with headers)
    user = getattr(request.state, 'user', None)
    
    # If no user from middleware, check for token in query params (for browser navigation)
    if not user:
        token = request.query_params.get("token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    # If still no user, check for token in cookies as fallback
    if not user:
        token = request.cookies.get("auth_token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    
    return templates.TemplateResponse("chat.html", {
        "request": request,
        "active_users": len(connections),
        "user": user
    })

@app.get("/chat/{conversation_id}")
async def chat_conversation_route(request: Request, conversation_id: str):
    """Serve the chat page template for a specific conversation - requires authentication"""
    # First try to get user from middleware (for API requests with headers)
    user = getattr(request.state, 'user', None)
    
    # If no user from middleware, check for token in query params (for browser navigation)
    if not user:
        token = request.query_params.get("token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    # If still no user, check for token in cookies as fallback
    if not user:
        token = request.cookies.get("auth_token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    
    return templates.TemplateResponse("chat.html", {
        "request": request,
        "active_users": len(connections),
        "user": user,
        "conversation_id": conversation_id
    })

@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
async def login_user(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    if not await db.verify_password(form_data.username, form_data.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Generate a JWT token
    expires_delta = timedelta(minutes=30)  # 30 minutes
    expire = datetime.utcnow() + expires_delta
    access_token = jwt.encode({"sub": form_data.username, "exp": expire}, SECRET_KEY, algorithm="HS256")
    
    # Set a secure, HttpOnly cookie instead of returning the token
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        samesite="strict",
        secure=False,  # Set to True in production with HTTPS
        max_age=1800  # 30 minutes in seconds
    )
    
    return {"redirect_url": "/chat"}


@app.get("/signup")
async def login(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})


@app.post("/signup", response_model=User)
async def signup(user_create: UserCreate):
    try:
        # Validate the user data
        await db.create_tables()
        user = await db.get_user_by_username(user_create.username)
        if user:
            raise HTTPException(status_code=400, detail="Username already exists")
        user = await db.get_user_by_email(user_create.email)
        if user:
            raise HTTPException(status_code=400, detail="Email already exists")

        # Hash the password
        hashed_password = get_password_hash(user_create.password)

        # Create a new user in the database
        await db.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (user_create.username, user_create.email, hashed_password))
        await db.commit()

        # Return a redirect to the login page
        return RedirectResponse(url="/login", status_code=302)
    except Exception as e:
        # Log the error and return a 500 response
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Error creating user")




# @app.exception_handler(401)
# async def unauthorized_exception_handler(request: Request, exc: Exception):
#     logging.error("Unauthorized exception: %s", exc)
#     return templates.TemplateResponse("unauthorized.html", {"request": request, "message": "Unauthorized access"})
@app.get("/")
async def root(request: Request):
    """Serve the home page - authentication handled client-side"""
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/check-auth")
async def check_auth(request: Request):
    """Check if user is authenticated and return user info"""
    user = getattr(request.state, 'user', None)
    if user:
        return {"authenticated": True, "username": user.username}
    return {"authenticated": False}


# About page route
@app.get("/about")
async def about(request: Request):
    """Serve the about page template"""
    return templates.TemplateResponse("about.html", {"request": request})

@app.get("/friends")
async def friends_page(request: Request):
    """Serve the friends page template - requires authentication"""
    # First try to get user from middleware (for API requests with headers)
    user = getattr(request.state, 'user', None)
    
    # If no user from middleware, check for token in query params (for browser navigation)
    if not user:
        token = request.query_params.get("token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    # If still no user, check for token in cookies as fallback
    if not user:
        token = request.cookies.get("auth_token")
        if token:
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
                if username:
                    user = await get_user(db, username)
            except JWTError:
                pass
    
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    
    return templates.TemplateResponse("friends.html", {"request": request, "user": user})

# Friend-related endpoints
@app.get("/api/friends")
async def get_friends(request: Request):
    """Get current user's friends list"""
    user = await get_current_user_from_request(request)
    friends = await db.get_friends_list(user.id)
    
    # Add unread message counts for each friend
    for friend in friends:
        unread_count = await db.get_unread_message_count(user.id, friend["friend_id"])
        friend["unread_count"] = unread_count
    
    return {"friends": friends}

@app.get("/api/conversation/{friend_id}")
async def get_conversation(request: Request, friend_id: int):
    """Get conversation history with a specific friend"""
    user = await get_current_user_from_request(request)
    
    # Verify they are friends
    friends = await db.get_friends_list(user.id)
    is_friend = any(friend["friend_id"] == friend_id for friend in friends)
    
    if not is_friend:
        raise HTTPException(status_code=403, detail="Can only view conversations with friends")
    
    conversation = await db.get_conversation(user.id, friend_id)
    return {"conversation": conversation}

@app.get("/api/conversation/{user_id}/anyone")
async def get_conversation_with_anyone(request: Request, user_id: int):
    """Get conversation history with any user (including former friends)"""
    current_user = await get_current_user_from_request(request)
    
    # Allow viewing conversations with anyone (for chat history preservation)
    conversation = await db.get_conversation_with_anyone(current_user.id, user_id)
    return {"conversation": conversation}

@app.get("/api/recent-conversations")
async def get_recent_conversations(request: Request):
    """Get recent conversations for current user (including former friends)"""
    user = await get_current_user_from_request(request)
    conversations = await db.get_recent_conversations(user.id)
    return {"conversations": conversations}

@app.post("/api/conversation/{friend_id}/mark-read")
async def mark_conversation_read(request: Request, friend_id: int):
    """Mark messages from a specific friend as read"""
    user = await get_current_user_from_request(request)
    
    # Verify they are friends
    friends = await db.get_friends_list(user.id)
    is_friend = any(friend["friend_id"] == friend_id for friend in friends)
    
    if not is_friend:
        raise HTTPException(status_code=403, detail="Can only mark messages from friends as read")
    
    success = await db.mark_messages_as_read(user.id, friend_id)
    if success:
        return {"message": "Messages marked as read"}
    else:
        raise HTTPException(status_code=500, detail="Failed to mark messages as read")

@app.get("/api/friend-requests")
async def get_friend_requests(request: Request):
    """Get pending friend requests for current user"""
    user = await get_current_user_from_request(request)
    requests = await db.get_friend_requests(user.id)
    return {"requests": requests}

@app.get("/api/all-friend-requests")
async def get_all_friend_requests(request: Request):
    """Get all pending friend requests (both incoming and outgoing) for current user"""
    user = await get_current_user_from_request(request)
    requests = await db.get_all_pending_requests(user.id)
    return {"requests": requests}

@app.get("/api/sent-friend-requests")
async def get_sent_friend_requests(request: Request):
    """Get pending friend requests sent by current user"""
    user = await get_current_user_from_request(request)
    requests = await db.get_sent_friend_requests(user.id)
    return {"requests": requests}

@app.delete("/api/friend-request/cancel/{friend_id}")
async def cancel_friend_request(request: Request, friend_id: int):
    """Cancel a sent friend request"""
    user = await get_current_user_from_request(request)
    success = await db.cancel_friend_request(user.id, friend_id)
    if success:
        return {"message": "Friend request canceled successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to cancel friend request")

@app.get("/api/user/me")
async def get_current_user_info(request: Request):
    """Get current user information"""
    user = await get_current_user_from_request(request)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }


@app.get("/api/friends/online-status")
async def get_friends_online_status(request: Request):
    """Get online status of all friends"""
    user = await get_current_user_from_request(request)
    
    # Get user's friends list
    friends = await db.get_friends_list(user.id)
    
    # Get online status for each friend
    online_status = []
    for friend in friends:
        friend_id = friend["friend_id"]
        is_online = any(conn["user_id"] == friend_id for conn in connections)
        
        online_status.append({
            "friend_id": friend_id,
            "username": friend["username"],
            "status": "online" if is_online else "offline"
        })
    
    return {"friends_status": online_status}


@app.post("/api/friend-request/send")
async def send_friend_request(request: Request, friend_data: FriendRequestData):
    """Send a friend request to another user"""
    user = await get_current_user_from_request(request)
    
    # Check if user is trying to add themselves
    if user.id == friend_data.friend_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if friend request already exists
    existing_requests = await db.get_friend_requests(friend_data.friend_id)
    for req in existing_requests:
        if req["user_id"] == user.id:
            raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Check if already friends
    friends = await db.get_friends_list(user.id)
    for friend in friends:
        if friend["friend_id"] == friend_data.friend_id:
            raise HTTPException(status_code=400, detail="Already friends with this user")
    
    success = await db.send_friend_request(user.id, friend_data.friend_id)
    if success:
        # Get recipient user info for WebSocket notification
        recipient_user = await db.get_user_by_id(friend_data.friend_id)
        if recipient_user:
            # Broadcast friend request update via WebSocket
            await broadcast_friend_request_update(
                user.id, user.username, 
                recipient_user.id, recipient_user.username, 
                "sent"
            )
        return {"message": "Friend request sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send friend request")

@app.post("/api/friend-request/accept")
async def accept_friend_request(request: Request, friend_data: FriendRequestData):
    """Accept a friend request"""
    user = await get_current_user_from_request(request)
    success = await db.accept_friend_request(user.id, friend_data.friend_id)
    if success:
        # Get sender user info for WebSocket notification
        sender_user = await db.get_user_by_id(friend_data.friend_id)
        if sender_user:
            # Broadcast friend request update via WebSocket
            await broadcast_friend_request_update(
                sender_user.id, sender_user.username, 
                user.id, user.username, 
                "accepted"
            )
        return {"message": "Friend request accepted"}
    else:
        raise HTTPException(status_code=500, detail="Failed to accept friend request")

@app.post("/api/friend-request/reject")
async def reject_friend_request(request: Request, friend_data: FriendRequestData):
    """Reject a friend request"""
    user = await get_current_user_from_request(request)
    success = await db.reject_friend_request(user.id, friend_data.friend_id)
    if success:
        # Get sender user info for WebSocket notification
        sender_user = await db.get_user_by_id(friend_data.friend_id)
        if sender_user:
            # Broadcast friend request update via WebSocket
            await broadcast_friend_request_update(
                sender_user.id, sender_user.username, 
                user.id, user.username, 
                "rejected"
            )
        return {"message": "Friend request rejected"}
    else:
        raise HTTPException(status_code=500, detail="Failed to reject friend request")

@app.delete("/api/friends/{friend_id}")
async def remove_friend(request: Request, friend_id: int):
    """Remove a friend"""
    user = await get_current_user_from_request(request)
    success = await db.remove_friend(user.id, friend_id)
    if success:
        return {"message": "Friend removed successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to remove friend")

@app.get("/api/users/search")
async def search_users(request: Request, q: str = ""):
    """Search for users by username"""
    user = await get_current_user_from_request(request)
    if len(q) < 2:
        return {"users": []}
    
    users = await db.search_users(q, user.id)
    return {"users": users}


# Route to add a message
@app.post("/messages/{msg_name}/")
def add_msg(msg_name: str) -> dict[str, MsgPayload]:
    # Generate an ID for the item based on the highest ID in the messages_list
    msg_id = max(messages_list.keys()) + 1 if messages_list else 0
    messages_list[msg_id] = MsgPayload(msg_id=msg_id, msg_name=msg_name)

    return {"message": messages_list[msg_id]}


# Route to list all messages
@app.get("/messages")
def message_items() -> dict[str, dict[int, MsgPayload]]:
    return {"messages:": messages_list}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        # Get token from query parameters (preferred for WebSocket) or headers/cookies
        token = websocket.query_params.get("token")
        
        # If no token in query params, try Authorization header
        if not token:
            auth_header = websocket.headers.get("authorization", "")
            if auth_header:
                token = auth_header.replace("Bearer ", "")
        
        # If no token in header, try to get from cookie header
        if not token:
            cookie_header = websocket.headers.get("cookie", "")
            if cookie_header:
                # Parse cookies manually
                for cookie in cookie_header.split(";"):
                    if "auth_token=" in cookie:
                        token = cookie.split("=")[1].strip()
                        break
        
        if not token:
            print("WebSocket: No token found in query params, headers, or cookies")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            username = payload.get("sub")
            if not username:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
                
            user = await get_user(db, username)
            if not user:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
                
            await websocket.accept()
            
            # Store connection with user info
            user_connection = {"websocket": websocket, "user_id": user.id, "username": user.username}
            connections.append(user_connection)
            
            # Send initial connection confirmation
            await websocket.send_text(json.dumps({
                "type": "connection_established",
                "user_id": user.id,
                "username": user.username,
                "timestamp": datetime.now().isoformat()
            }))
            
            # Notify other users that this user is now online
            await broadcast_user_status_update(user.id, user.username, "online")
            
            try:
                while True:
                    data = await websocket.receive_text()
                    
                    try:
                        # Parse the message data
                        message_data = json.loads(data)
                        
                        # Handle different message types
                        if message_data.get("type") == "message" or (message_data.get("text") and message_data.get("recipient")):
                            # This is a chat message
                            message_text = message_data.get("text", "")
                            recipient_username = message_data.get("recipient", "")
                            
                            if not message_text or not recipient_username:
                                continue
                            
                            # Get recipient user
                            recipient_user = await get_user(db, recipient_username)
                            if not recipient_user:
                                continue
                            
                            # Verify they are friends
                            friends = await db.get_friends_list(user.id)
                            is_friend = any(friend["friend_id"] == recipient_user.id for friend in friends)
                            
                            if not is_friend:
                                continue
                            
                            # Save message to database
                            conversation_id = await db.save_message(user.id, recipient_user.id, message_text)
                            
                            # Create message object to send
                            message_to_send = {
                                "type": "message",
                                "sender_id": user.id,
                                "sender_username": user.username,
                                "recipient_id": recipient_user.id,
                                "recipient_username": recipient_username,
                                "message_text": message_text,
                                "timestamp": datetime.now().isoformat(),
                                "message_id": conversation_id,
                                "conversation_id": conversation_id
                            }
                            
                            # Send to recipient if they're online
                            connections_copy = connections.copy()
                            broken_connections = []
                            
                            for conn in connections_copy:
                                if conn["user_id"] == recipient_user.id:
                                    try:
                                        await conn["websocket"].send_text(json.dumps(message_to_send))
                                        
                                        # Also send a notification update
                                        await conn["websocket"].send_text(json.dumps({
                                            "type": "notification_update",
                                            "notification_type": "new_message",
                                            "sender_username": user.username,
                                            "sender_id": user.id,
                                            "recipient_id": recipient_user.id,
                                            "conversation_id": conversation_id,
                                            "message_preview": message_text[:50] + "..." if len(message_text) > 50 else message_text,
                                            "timestamp": message_to_send["timestamp"]
                                        }))
                                    except:
                                        # Mark for removal
                                        broken_connections.append(conn)
                            
                            # Remove broken connections
                            for broken_conn in broken_connections:
                                if broken_conn in connections:
                                    connections.remove(broken_conn)
                            
                            # Send confirmation back to sender
                            confirmation = {
                                "type": "message_sent",
                                "message_id": message_to_send["message_id"],
                                "timestamp": message_to_send["timestamp"]
                            }
                            await websocket.send_text(json.dumps(confirmation))
                            
                        elif message_data.get("type") == "typing_indicator":
                            # Handle typing indicator
                            recipient_username = message_data.get("recipient", "")
                            is_typing = message_data.get("isTyping", False)
                            
                            if recipient_username:
                                recipient_user = await get_user(db, recipient_username)
                                if recipient_user:
                                    # Send typing indicator to recipient
                                    typing_message = {
                                        "type": "typing_indicator",
                                        "username": user.username,
                                        "isTyping": is_typing,
                                        "timestamp": datetime.now().isoformat()
                                    }
                                    
                                    connections_copy = connections.copy()
                                    broken_connections = []
                                    
                                    for conn in connections_copy:
                                        if conn["user_id"] == recipient_user.id:
                                            try:
                                                await conn["websocket"].send_text(json.dumps(typing_message))
                                            except:
                                                broken_connections.append(conn)
                                    
                                    # Remove broken connections
                                    for broken_conn in broken_connections:
                                        if broken_conn in connections:
                                            connections.remove(broken_conn)
                                                
                        elif message_data.get("type") == "read_receipt":
                            # Handle read receipt
                            message_id = message_data.get("message_id", "")
                            
                            if message_id:
                                # Find the sender of the original message
                                # For now, we'll broadcast to all connections
                                # In a real app, you'd store message ownership in the database
                                read_receipt = {
                                    "type": "read_receipt",
                                    "message_id": message_id,
                                    "read_by": user.username,
                                    "timestamp": datetime.now().isoformat()
                                }
                                
                                # Send to all connections (in a real app, you'd send only to the message sender)
                                connections_copy = connections.copy()
                                broken_connections = []
                                
                                for conn in connections_copy:
                                    try:
                                        await conn["websocket"].send_text(json.dumps(read_receipt))
                                    except:
                                        broken_connections.append(conn)
                                
                                # Remove broken connections
                                for broken_conn in broken_connections:
                                    if broken_conn in connections:
                                        connections.remove(broken_conn)
                        
                    except json.JSONDecodeError:
                        # Handle non-JSON messages (fallback)
                        continue
                        
            except Exception as e:
                print(f"WebSocket error for user {user.username}: {e}")
                # Remove connection safely
                if user_connection in connections:
                    connections.remove(user_connection)
                # Notify other users that this user is now offline
                await broadcast_user_status_update(user.id, user.username, "offline")
            finally:
                # Always clean up connection when WebSocket closes
                if user_connection in connections:
                    connections.remove(user_connection)
                # Notify other users that this user is now offline
                await broadcast_user_status_update(user.id, user.username, "offline")
                
        except JWTError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


async def broadcast_user_status_update(user_id: int, username: str, status: str):
    """Broadcast user status updates to all connected clients"""
    status_message = {
        "type": "user_status_update",
        "user_id": user_id,
        "username": username,
        "status": status,
        "timestamp": datetime.now().isoformat()
    }
    
    # Create a copy of connections to avoid modification during iteration
    connections_copy = connections.copy()
    broken_connections = []
    
    for conn in connections_copy:
        try:
            await conn["websocket"].send_text(json.dumps(status_message))
        except:
            # Mark for removal
            broken_connections.append(conn)
    
    # Remove broken connections
    for broken_conn in broken_connections:
        if broken_conn in connections:
            connections.remove(broken_conn)


async def broadcast_friend_request_update(sender_id: int, sender_username: str, recipient_id: int, recipient_username: str, request_type: str):
    """Broadcast friend request updates to relevant users"""
    request_message = {
        "type": "friend_request_update",
        "request_type": request_type,  # "sent", "received", "accepted", "declined"
        "sender_id": sender_id,
        "sender_username": sender_username,
        "recipient_id": recipient_id,
        "recipient_username": recipient_username,
        "timestamp": datetime.now().isoformat()
    }
    
    # Send to both sender and recipient if they're online
    connections_copy = connections.copy()
    broken_connections = []
    
    for conn in connections_copy:
        if conn["user_id"] in [sender_id, recipient_id]:
            try:
                await conn["websocket"].send_text(json.dumps(request_message))
            except:
                broken_connections.append(conn)
    
    # Remove broken connections
    for broken_conn in broken_connections:
        if broken_conn in connections:
            connections.remove(broken_conn)


ACCESS_TOKEN_EXPIRE_MINUTES = 30


async def get_user(db, username: str):
    return await db.get_user_by_username(username)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt
async def authenticate_user(db, username: str, password: str):
    user = await get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user


@app.post("/token", response_model=Token)
async def login_for_access_token(login_data: LoginData):
    user = await authenticate_user(db, login_data.username, login_data.password)
    if not user:
        print("Authentication failed for user:", login_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    logging.debug("Access token created: %s", access_token)
    print("Access token created:", access_token)
    
    # Return token with redirect information
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "redirect_url": "/chat"
    }


@app.middleware("http")
async def verify_token(request: Request, call_next):
    print("Middleware executed")
    print(f"Request path: {request.url.path}")
    print(f"Authorization header: {request.headers.get('Authorization')}")
    print(f"Cookies: {request.cookies}")
    
    try:
        # First try to get token from Authorization header
        token = request.headers.get("Authorization")
        if token:
            token = token.replace("Bearer ", "")  # Remove the Bearer prefix
        else:
            # Fallback to cookie-based authentication
            token = request.cookies.get("auth_token")
        
        if not token:
            # Set a default user for unauthenticated requests
            request.state.user = None
            print("No token found in headers or cookies")
            return await call_next(request)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            username = payload.get("sub")
            if username:
                # Get user from database and set it on request
                user = await get_user(db, username)
                if user:
                    request.state.user = user
                    print(f"User authenticated: {user.username}")
                else:
                    request.state.user = None
                    print("User not found in database")
            else:
                request.state.user = None
                print("No username in token payload")
        except JWTError as e:
            print("Error decoding token:", e)
            request.state.user = None
    except Exception as e:
        print("Error:", e)
        request.state.user = None
    
    return await call_next(request)

@app.post("/logout")
async def logout_user(response: Response):
    """Logout user by clearing the auth cookie"""
    response.delete_cookie(
        key="auth_token",
        httponly=True,
        samesite="strict",
        secure=False  # Set to True in production with HTTPS
    )
    return {"message": "Logged out successfully"}

@app.get("/api/ws-token")
async def get_ws_token(request: Request):
    """Get a token for WebSocket authentication"""
    # Get user from cookie authentication
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Generate a JWT token for WebSocket authentication
    expires_delta = timedelta(minutes=30)
    expire = datetime.utcnow() + expires_delta
    access_token = jwt.encode({"sub": user.username, "exp": expire}, SECRET_KEY, algorithm="HS256")
    
    return {"token": access_token}