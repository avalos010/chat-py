from codecs import encode
from typing_extensions import Annotated
from fastapi import Body, FastAPI, WebSocket, Depends, HTTPException, status, Request
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
# Store active connections
connections: List[WebSocket] = []

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

@app.get("/dashboard")
async def dashboard_route(request: Request):
    """Serve the dashboard page template - requires authentication"""
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
    
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user})

@app.get("/api/dashboard")
async def dashboard_api_route(request: Request, current_user: User = Depends(get_current_user_from_request)):
    """API endpoint for dashboard data - requires authentication"""
    print("Dashboard API route executed")
    return {"message": f"Hello, {current_user.username}!", "username": current_user.username}



@app.get("/login")
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if not await db.verify_password(form_data.username, form_data.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    # Generate a JWT token
    expires_delta = timedelta(minutes=30)  # 30 minutes
    expire = datetime.utcnow() + expires_delta
    token = jwt.encode({"sub": form_data.username, "exp": expire}, SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}


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
    """Serve the friends page template"""
    return templates.TemplateResponse("friends.html", {"request": request})

# Friend-related endpoints
@app.get("/api/friends")
async def get_friends(request: Request):
    """Get current user's friends list"""
    user = await get_current_user_from_request(request)
    friends = await db.get_friends_list(user.id)
    return {"friends": friends}

@app.get("/api/friend-requests")
async def get_friend_requests(request: Request):
    """Get pending friend requests for current user"""
    user = await get_current_user_from_request(request)
    requests = await db.get_friend_requests(user.id)
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
        return {"message": "Friend request sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send friend request")

@app.post("/api/friend-request/accept")
async def accept_friend_request(request: Request, friend_data: FriendRequestData):
    """Accept a friend request"""
    user = await get_current_user_from_request(request)
    success = await db.accept_friend_request(user.id, friend_data.friend_id)
    if success:
        return {"message": "Friend request accepted"}
    else:
        raise HTTPException(status_code=500, detail="Failed to accept friend request")

@app.post("/api/friend-request/reject")
async def reject_friend_request(request: Request, friend_data: FriendRequestData):
    """Reject a friend request"""
    user = await get_current_user_from_request(request)
    success = await db.reject_friend_request(user.id, friend_data.friend_id)
    if success:
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
        # Get token from query parameters or headers
        token = websocket.query_params.get("token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        
        if not token:
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
            connections.append(websocket)
            try:
                while True:
                    data = await websocket.receive_text()
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    message = f"[{timestamp}] {user.username}: {data}"
                    
                    for connection in connections:
                        await connection.send_text(message)
            except:
                connections.remove(websocket)
        except JWTError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


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
        "redirect_url": "/dashboard"
    }


@app.middleware("http")
async def verify_token(request: Request, call_next):
    print("Middleware executed")
    print(f"Request path: {request.url.path}")
    print(f"Authorization header: {request.headers.get('Authorization')}")
    try:
        token = request.headers.get("Authorization")
        if not token:
            # Set a default user for unauthenticated requests
            request.state.user = None
            print("No Authorization header found")
            return await call_next(request)
        
        token = token.replace("Bearer ", "")  # Remove the Bearer prefix
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