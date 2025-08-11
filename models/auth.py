from pydantic import BaseModel, EmailStr, SecretStr
from typing import Dict, Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    disabled: Optional[bool] = False

class UserInDB(User):
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class LoginData(BaseModel):
    username: str
    password:str

class MsgPayload(BaseModel):
    message: str
    sender: str
    timestamp: float

class MessageResponse(BaseModel):
    messages: Dict[str, MsgPayload]