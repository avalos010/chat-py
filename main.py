from codecs import encode
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
from models.auth import LoginData, User, UserCreate, Token, UserInDB
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

app = FastAPI()
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

async def get_current_user(token: str = Depends(oauth2_scheme)):
    print("Get current user executed")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user(db, username)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return user
    
@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    print("Protected route executed")
    return {"message": f"Hello, {current_user.username}!"}

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




@app.exception_handler(401)
async def unauthorized_exception_handler(request: Request, exc: Exception):
    logging.error("Unauthorized exception: %s", exc)
    return templates.TemplateResponse("unauthorized.html", {"request": request, "message": "Unauthorized access"})
@app.get("/")
async def root(request: Request, user: Optional[User] = Depends(get_current_user)):
    logging.debug("User object: %s", user)
    if user:
      return templates.TemplateResponse("chat.html", {
        "request": request,
        "active_users": len(connections),
        "user": user
    })
    return templates.TemplateResponse("login.html", {"request": request})


# About page route
@app.get("/about")
def about() -> dict[str, str]:
    return {"message": "This is the about page."}


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
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Depends(oauth2_scheme)
):
    try:
        user = await get_current_user(token)
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
    if not verify_password(password, user.hashed_password):
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
    return {"access_token": access_token, "token_type": "bearer"}