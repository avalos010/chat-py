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
        
        # Friends table
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS friends (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (friend_id) REFERENCES users (id),
                UNIQUE(user_id, friend_id)
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

    # Friend-related methods
    async def send_friend_request(self, from_user_id: int, to_user_id: int):
        """Send a friend request from one user to another"""
        try:
            await self.conn.execute(
                "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')",
                (from_user_id, to_user_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error sending friend request: {e}")
            return False

    async def accept_friend_request(self, user_id: int, friend_id: int):
        """Accept a friend request"""
        try:
            # Update the friend request to accepted
            await self.conn.execute(
                "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?",
                (friend_id, user_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error accepting friend request: {e}")
            return False

    async def reject_friend_request(self, user_id: int, friend_id: int):
        """Reject a friend request"""
        try:
            await self.conn.execute(
                "DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
                (friend_id, user_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error rejecting friend request: {e}")
            return False

    async def get_friend_requests(self, user_id: int):
        """Get pending friend requests for a user"""
        try:
            cursor = await self.conn.execute("""
                SELECT f.id, f.user_id, f.created_at, u.username, u.email
                FROM friends f
                JOIN users u ON f.user_id = u.id
                WHERE f.friend_id = ? AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, (user_id,))
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "user_id": row[1],
                    "created_at": row[2],
                    "username": row[3],
                    "email": row[4]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting friend requests: {e}")
            return []

    async def get_sent_friend_requests(self, user_id: int):
        """Get pending friend requests sent by a user"""
        try:
            cursor = await self.conn.execute("""
                SELECT f.id, f.friend_id, f.created_at, u.username, u.email
                FROM friends f
                JOIN users u ON f.friend_id = u.id
                WHERE f.user_id = ? AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, (user_id,))
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "friend_id": row[1],
                    "created_at": row[2],
                    "username": row[3],
                    "email": row[4]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting sent friend requests: {e}")
            return []

    async def cancel_friend_request(self, user_id: int, friend_id: int):
        """Cancel a sent friend request"""
        try:
            await self.conn.execute(
                "DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
                (user_id, friend_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error canceling friend request: {e}")
            return False

    async def get_friends_list(self, user_id: int):
        """Get accepted friends for a user"""
        try:
            cursor = await self.conn.execute("""
                SELECT 
                    CASE 
                        WHEN f.user_id = ? THEN f.friend_id
                        ELSE f.user_id
                    END as friend_id,
                    u.username, u.email
                FROM friends f
                JOIN users u ON (
                    CASE 
                        WHEN f.user_id = ? THEN f.friend_id
                        ELSE f.user_id
                    END = u.id
                )
                WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
                GROUP BY friend_id
                ORDER BY u.username
            """, (user_id, user_id, user_id, user_id))
            rows = await cursor.fetchall()
            return [
                {
                    "friend_id": row[0],
                    "username": row[1],
                    "email": row[2]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting friends list: {e}")
            return []

    async def remove_friend(self, user_id: int, friend_id: int):
        """Remove a friend (delete both friendship records)"""
        try:
            await self.conn.execute(
                "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                (user_id, friend_id, friend_id, user_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error removing friend: {e}")
            return False

    async def search_users(self, search_term: str, exclude_user_id: int = None):
        """Search for users by username (excluding the current user)"""
        try:
            if exclude_user_id:
                cursor = await self.conn.execute("""
                    SELECT id, username, email
                    FROM users
                    WHERE username LIKE ? AND id != ?
                    ORDER BY username
                """, (f"%{search_term}%", exclude_user_id))
            else:
                cursor = await self.conn.execute("""
                    SELECT id, username, email
                    FROM users
                    WHERE username LIKE ?
                    ORDER BY username
                """, (f"%{search_term}%",))
            
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "username": row[1],
                    "email": row[2]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error searching users: {e}")
            return []
