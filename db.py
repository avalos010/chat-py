import aiosqlite

import os
from dotenv import load_dotenv

load_dotenv()

class Database:

    def __init__(self, db_name=os.getenv("DB_NAME")):
        self.db_name = db_name
        self.conn = None


    async def create_tables(self):
        print("Creating tables...")
        async with aiosqlite.connect(self.db_name) as db:
            await db.execute("""
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
        async with aiosqlite.connect(self.db_name) as db:
            async with db.execute("SELECT * FROM users WHERE username = ?", (username,)) as cursor:
                user = await cursor.fetchone()
                if user:
                    return user
                else:
                    return None

    async def get_user_by_email(self, email: str):
        async with aiosqlite.connect(self.db_name) as db:
            async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
                user = await cursor.fetchone()
                if user:
                    return user
                else:
                    return None