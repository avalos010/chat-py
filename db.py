import aiosqlite

import os
from dotenv import load_dotenv
from models.auth import UserInDB
from utils.security import verify_password

load_dotenv()

class Database:

    def __init__(self, db_name=os.getenv("DB_NAME")):
        self.db_name = db_name
        self.conn = None


    async def create_tables(self):
        print("Creating tables...")
        if not self.conn:
            await self.connect()
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                password TEXT NOT NULL
            )
        """)
        await self.commit()

    async def connect(self):
        
        self.conn = await aiosqlite.connect(self.db_name)

    async def close(self):
        await self.conn.close()

    async def commit(self):
        await self.conn.commit()

    async def execute(self, query, params=None):
        cursor = await self.conn.execute(query, params)
        await self.conn.commit()
        return cursor

    async def fetchall(self, query, params=None):
        cursor = await self.execute(query, params)
        return await cursor.fetchall()

    async def fetchone(self, query, params=None):
        cursor = await self.execute(query, params)
        return await cursor.fetchone()
    
    async def get_user_by_username(self, username: str):
        if not self.conn:
            return None
        async with self.conn.execute("SELECT * FROM users WHERE username = ?", (username,)) as cursor:
            user_tuple = await cursor.fetchone()
        if user_tuple:
            user_dict = dict(zip(["id", "username", "email", "password"], user_tuple))
            return UserInDB(**user_dict)
        else:
            return None

    async def get_user_by_email(self, email: str):
        if not self.conn:
            return None
        async with self.conn.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
            user_tuple = await cursor.fetchone()
        if user_tuple:
            user_dict = dict(zip(["id", "username", "email", "password"], user_tuple))
            return UserInDB(**user_dict)
        else:
            return None


    async def get_user_by_id(self, user_id: int):
        if not self.conn:
            return None
        async with self.conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            user_tuple = await cursor.fetchone()
        if user_tuple:
            user_dict = dict(zip(["id", "username", "email", "password"], user_tuple))
            return UserInDB(**user_dict)
        else:
            return None

    async def get_all_users(self):
        if not self.conn:
            return []
        async with self.conn.execute("SELECT * FROM users") as cursor:
            user_tuples = await cursor.fetchall()
        users = []
        for user_tuple in user_tuples:
            user_dict = dict(zip(["id", "username", "email", "password"], user_tuple))
            users.append(UserInDB(**user_dict))
        return users

    async def verify_password(self, username: str, password: str):
        user = await self.get_user_by_username(username)
        if not user:
            return False
        # Assuming you have a password hash stored in the database
        return verify_password(password, user.password)
