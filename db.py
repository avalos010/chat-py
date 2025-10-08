import asyncpg
import uuid

import os
from dotenv import load_dotenv
from models.auth import UserInDB
from utils.security import verify_password

load_dotenv()

class Database:

    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        self.pool = None


    async def create_tables(self):
        print("Creating tables...")
        if not self.pool:
            await self.connect()
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    password TEXT NOT NULL
                )
            """)
        
            # Friends table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS friends (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    friend_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (friend_id) REFERENCES users (id),
                    UNIQUE(user_id, friend_id)
                )
            """)
        
            # Messages table for storing chat messages
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    sender_id INTEGER NOT NULL,
                    recipient_id INTEGER NOT NULL,
                    message_text TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_read BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (sender_id) REFERENCES users (id),
                    FOREIGN KEY (recipient_id) REFERENCES users (id)
                )
            """)
            
            # Create index on conversation_id for better performance
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
                ON messages (conversation_id)
            """)

    async def connect(self):
        self.pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=10)

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def execute(self, query, *params):
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *params)

    async def fetchall(self, query, *params):
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *params)

    async def fetchone(self, query, *params):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *params)
    
    async def get_user_by_username(self, username: str):
        if not self.pool:
            return None
        row = await self.fetchone("SELECT * FROM users WHERE username = $1", username)
        if row:
            user_dict = dict(row)
            return UserInDB(**user_dict)
        else:
            return None

    async def get_user_by_email(self, email: str):
        if not self.pool:
            return None
        row = await self.fetchone("SELECT * FROM users WHERE email = $1", email)
        if row:
            user_dict = dict(row)
            return UserInDB(**user_dict)
        else:
            return None

    async def get_user_by_id(self, user_id: int):
        if not self.pool:
            return None
        row = await self.fetchone("SELECT * FROM users WHERE id = $1", user_id)
        if row:
            user_dict = dict(row)
            return UserInDB(**user_dict)
        else:
            return None

    async def get_all_users(self):
        if not self.pool:
            return []
        rows = await self.fetchall("SELECT * FROM users")
        users = []
        for row in rows:
            user_dict = dict(row)
            users.append(UserInDB(**user_dict))
        return users

    async def verify_password(self, username: str, password: str):
        user = await self.get_user_by_username(username)
        if not user:
            return False
        # Assuming you have a password hash stored in the database
        return verify_password(password, user.password)

    # Friend-related methods
    async def send_friend_request(self, user_id: int, friend_id: int):
        """Send a friend request to another user"""
        try:
            # Check if already friends
            existing = await self.fetchone(
                "SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
                user_id, friend_id
            )
            
            if existing:
                # Check if it's already accepted
                if existing['status'] == 'accepted':
                    return False  # Already friends
                elif existing['status'] == 'pending':
                    # Check if this is a mutual request
                    if existing['user_id'] == user_id and existing['friend_id'] == friend_id:
                        # User is sending to friend, check if friend also sent to user
                        mutual = await self.fetchone(
                            "SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'",
                            friend_id, user_id
                        )
                        
                        if mutual:
                            # Mutual request detected! Auto-accept both
                            await self.execute(
                                "UPDATE friends SET status = 'accepted' WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
                                user_id, friend_id
                            )
                            return True  # Mutual friendship created
                    
                    return False  # Request already exists
            
            # Insert new friend request
            await self.execute(
                "INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')",
                user_id, friend_id
            )
            return True
        except Exception as e:
            print(f"Error sending friend request: {e}")
            return False

    async def accept_friend_request(self, user_id: int, friend_id: int):
        """Accept a friend request"""
        try:
            await self.execute(
                "UPDATE friends SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2",
                friend_id, user_id
            )
            return True
        except Exception as e:
            print(f"Error accepting friend request: {e}")
            return False

    async def reject_friend_request(self, user_id: int, friend_id: int):
        """Reject a friend request"""
        try:
            await self.execute(
                "DELETE FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'",
                friend_id, user_id
            )
            return True
        except Exception as e:
            print(f"Error rejecting friend request: {e}")
            return False

    async def get_friend_requests(self, user_id: int):
        """Get pending friend requests for a user"""
        try:
            rows = await self.fetchall("""
                SELECT f.id, f.user_id, f.created_at, u.username, u.email
                FROM friends f
                JOIN users u ON f.user_id = u.id
                WHERE f.friend_id = $1 AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, user_id)
            return [
                {
                    "id": row['id'],
                    "user_id": row['user_id'],
                    "created_at": row['created_at'],
                    "username": row['username'],
                    "email": row['email']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting friend requests: {e}")
            return []

    async def get_sent_friend_requests(self, user_id: int):
        """Get pending friend requests sent by a user"""
        try:
            rows = await self.fetchall("""
                SELECT f.id, f.friend_id, f.created_at, u.username, u.email
                FROM friends f
                JOIN users u ON f.friend_id = u.id
                WHERE f.user_id = $1 AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, user_id)
            return [
                {
                    "id": row['id'],
                    "friend_id": row['friend_id'],
                    "created_at": row['created_at'],
                    "username": row['username'],
                    "email": row['email']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting sent friend requests: {e}")
            return []

    async def cancel_friend_request(self, user_id: int, friend_id: int):
        """Cancel a sent friend request"""
        try:
            await self.execute(
                "DELETE FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'",
                user_id, friend_id
            )
            return True
        except Exception as e:
            print(f"Error canceling friend request: {e}")
            return False

    async def get_friends_list(self, user_id: int):
        """Get accepted friends for a user"""
        try:
            rows = await self.fetchall("""
                SELECT 
                    CASE 
                        WHEN f.user_id = $1 THEN f.friend_id
                        ELSE f.user_id
                    END as friend_id,
                    u.username, u.email
                FROM friends f
                JOIN users u ON (
                    CASE 
                        WHEN f.user_id = $1 THEN f.friend_id
                        ELSE f.user_id
                    END = u.id
                )
                WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
                GROUP BY friend_id, u.username, u.email
                ORDER BY u.username
            """, user_id)
            return [
                {
                    "friend_id": row['friend_id'],
                    "username": row['username'],
                    "email": row['email']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting friends list: {e}")
            return []

    async def remove_friend(self, user_id: int, friend_id: int):
        """Remove a friend (delete both friendship records) but preserve messages"""
        try:
            await self.execute(
                "DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
                user_id, friend_id
            )
            return True
        except Exception as e:
            print(f"Error removing friend: {e}")
            return False

    async def get_conversation_with_anyone(self, user1_id: int, user2_id: int, limit: int = 50):
        """Get conversation between two users regardless of friendship status"""
        try:
            rows = await self.fetchall("""
                SELECT 
                    m.id,
                    m.sender_id,
                    m.recipient_id,
                    m.message_text,
                    m.timestamp,
                    m.is_read,
                    u.username as sender_username
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE (m.sender_id = $1 AND m.recipient_id = $2) 
                   OR (m.sender_id = $2 AND m.recipient_id = $1)
                ORDER BY m.timestamp ASC
                LIMIT $3
            """, user1_id, user2_id, limit)
            
            return [
                {
                    "id": row['id'],
                    "sender_id": row['sender_id'],
                    "recipient_id": row['recipient_id'],
                    "message_text": row['message_text'],
                    "timestamp": row['timestamp'],
                    "is_read": bool(row['is_read']),
                    "sender_username": row['sender_username']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting conversation with anyone: {e}")
            return []

    async def get_recent_conversations(self, user_id: int, limit: int = 10):
        """Get recent conversations for a user (including former friends)"""
        try:
            rows = await self.fetchall("""
                WITH recent_messages AS (
                    SELECT 
                        CASE 
                            WHEN m.sender_id = $1 THEN m.recipient_id
                            ELSE m.sender_id
                        END as other_user_id,
                        m.conversation_id,
                        m.message_text,
                        m.timestamp,
                        m.sender_id,
                        m.recipient_id,
                        m.is_read,
                        ROW_NUMBER() OVER (
                            PARTITION BY 
                                CASE 
                                    WHEN m.sender_id = $1 THEN m.recipient_id
                                    ELSE m.sender_id
                                END
                            ORDER BY m.timestamp DESC
                        ) as rn
                    FROM messages m
                    WHERE m.sender_id = $1 OR m.recipient_id = $1
                )
                SELECT 
                    rm.other_user_id,
                    u.username,
                    u.email,
                    rm.conversation_id,
                    rm.timestamp as last_message_time,
                    rm.message_text as last_message_text,
                    rm.sender_id as last_message_sender,
                    rm.is_read as last_message_read,
                    (
                        SELECT COUNT(*) 
                        FROM messages m2 
                        WHERE m2.recipient_id = $1 AND m2.sender_id = rm.other_user_id AND m2.is_read = FALSE
                    ) as unread_count
                FROM recent_messages rm
                JOIN users u ON rm.other_user_id = u.id
                WHERE rm.rn = 1
                ORDER BY rm.timestamp DESC
                LIMIT $2
            """, user_id, limit)
            
            return [
                {
                    "friend_id": row['other_user_id'],
                    "username": row['username'],
                    "email": row['email'],
                    "conversation_id": row['conversation_id'],
                    "last_message_time": row['last_message_time'],
                    "last_message_text": row['last_message_text'] or "No messages yet",
                    "last_message_sender": row['last_message_sender'],
                    "last_message_read": row['last_message_read'],
                    "unread_count": row['unread_count']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting recent conversations: {e}")
            return []

    async def save_message(self, sender_id: int, recipient_id: int, message_text: str):
        """Save a new message to the database"""
        try:
            # Generate a unique conversation ID based on the two users
            user_ids = sorted([sender_id, recipient_id])
            conversation_id = f"conv_{user_ids[0]}_{user_ids[1]}"
            
            await self.execute(
                "INSERT INTO messages (conversation_id, sender_id, recipient_id, message_text) VALUES ($1, $2, $3, $4)",
                conversation_id, sender_id, recipient_id, message_text
            )
            return conversation_id
        except Exception as e:
            print(f"Error saving message: {e}")
            return False

    async def get_conversation(self, user1_id: int, user2_id: int, limit: int = 50):
        """Get conversation between two users"""
        try:
            rows = await self.fetchall("""
                SELECT 
                    m.id,
                    m.sender_id,
                    m.recipient_id,
                    m.message_text,
                    m.timestamp,
                    m.is_read,
                    u.username as sender_username
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE (m.sender_id = $1 AND m.recipient_id = $2) 
                   OR (m.sender_id = $2 AND m.recipient_id = $1)
                ORDER BY m.timestamp ASC
                LIMIT $3
            """, user1_id, user2_id, limit)
            
            return [
                {
                    "id": row['id'],
                    "sender_id": row['sender_id'],
                    "recipient_id": row['recipient_id'],
                    "message_text": row['message_text'],
                    "timestamp": row['timestamp'],
                    "is_read": bool(row['is_read']),
                    "sender_username": row['sender_username']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting conversation: {e}")
            return []

    async def mark_messages_as_read(self, user_id: int, sender_id: int):
        """Mark messages from a specific sender as read"""
        try:
            await self.execute(
                "UPDATE messages SET is_read = TRUE WHERE recipient_id = $1 AND sender_id = $2 AND is_read = FALSE",
                user_id, sender_id
            )
            return True
        except Exception as e:
            print(f"Error marking messages as read: {e}")
            return False

    async def get_unread_message_count(self, user_id: int, friend_id: int):
        """Get count of unread messages from a specific friend"""
        try:
            row = await self.fetchone(
                "SELECT COUNT(*) as count FROM messages WHERE recipient_id = $1 AND sender_id = $2 AND is_read = FALSE",
                user_id, friend_id
            )
            return row['count'] if row else 0
        except Exception as e:
            print(f"Error getting unread message count: {e}")
            return 0

    async def get_unread_message_count_for_conversation(self, user_id: int, other_user_id: int):
        """Get count of unread messages from a specific user in conversation"""
        try:
            row = await self.fetchone(
                "SELECT COUNT(*) as count FROM messages WHERE recipient_id = $1 AND sender_id = $2 AND is_read = FALSE",
                user_id, other_user_id
            )
            return row['count'] if row else 0
        except Exception as e:
            print(f"Error getting unread message count for conversation: {e}")
            return 0

    async def search_users(self, search_term: str, exclude_user_id: int = None):
        """Search for users by username (excluding the current user)"""
        try:
            if exclude_user_id:
                rows = await self.fetchall("""
                    SELECT id, username, email
                    FROM users
                    WHERE username LIKE $1 AND id != $2
                    ORDER BY username
                """, f"%{search_term}%", exclude_user_id)
            else:
                rows = await self.fetchall("""
                    SELECT id, username, email
                    FROM users
                    WHERE username LIKE $1
                    ORDER BY username
                """, f"%{search_term}%")
            
            return [
                {
                    "id": row['id'],
                    "username": row['username'],
                    "email": row['email']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error searching users: {e}")
            return []

    async def get_all_pending_requests(self, user_id: int):
        """Get all pending friend requests for a user (both incoming and outgoing)"""
        try:
            rows = await self.fetchall("""
                SELECT 
                    f.id,
                    f.user_id,
                    f.friend_id,
                    f.status,
                    f.created_at,
                    u.username,
                    u.email,
                    CASE 
                        WHEN f.user_id = $1 THEN 'outgoing'
                        ELSE 'incoming'
                    END as request_type
                FROM friends f
                JOIN users u ON (
                    CASE 
                        WHEN f.user_id = $1 THEN f.friend_id
                        ELSE f.user_id
                    END = u.id
                )
                WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, user_id)
            
            return [
                {
                    "id": row['id'],
                    "user_id": row['user_id'],
                    "friend_id": row['friend_id'],
                    "status": row['status'],
                    "created_at": row['created_at'],
                    "username": row['username'],
                    "email": row['email'],
                    "request_type": row['request_type']
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting all pending requests: {e}")
            return []

    async def create_user(self, username: str, email: str, password: str):
        """Create a new user"""
        try:
            await self.execute(
                "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
                username, email, password
            )
            return True
        except Exception as e:
            print(f"Error creating user: {e}")
            return False

