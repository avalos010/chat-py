import aiosqlite
import uuid

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
        
        # Messages table for storing chat messages
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY,
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
        await self.conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
            ON messages (conversation_id)
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
    async def send_friend_request(self, user_id: int, friend_id: int):
        """Send a friend request to another user"""
        try:
            # Check if already friends
            existing_friendship = await self.conn.execute(
                "SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                (user_id, friend_id, friend_id, user_id)
            )
            existing = await existing_friendship.fetchone()
            
            if existing:
                # Check if it's already accepted
                if existing[3] == 'accepted':  # status column
                    return False  # Already friends
                elif existing[3] == 'pending':
                    # Check if this is a mutual request (both users sent requests to each other)
                    if existing[1] == user_id and existing[2] == friend_id:
                        # User is sending to friend, check if friend also sent to user
                        mutual_check = await self.conn.execute(
                            "SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'",
                            (friend_id, user_id)
                        )
                        mutual = await mutual_check.fetchone()
                        
                        if mutual:
                            # Mutual request detected! Auto-accept both
                            await self.conn.execute(
                                "UPDATE friends SET status = 'accepted' WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                                (user_id, friend_id, friend_id, user_id)
                            )
                            await self.commit()
                            return True  # Mutual friendship created
                    
                    return False  # Request already exists
            
            # Insert new friend request
            await self.conn.execute(
                "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')",
                (user_id, friend_id)
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
        """Remove a friend (delete both friendship records) but preserve messages"""
        try:
            # Delete friendship records but keep messages
            await self.conn.execute(
                "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                (user_id, friend_id, friend_id, user_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error removing friend: {e}")
            return False

    async def get_conversation_with_anyone(self, user1_id: int, user2_id: int, limit: int = 50):
        """Get conversation between two users regardless of friendship status"""
        try:
            cursor = await self.conn.execute("""
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
                WHERE (m.sender_id = ? AND m.recipient_id = ?) 
                   OR (m.sender_id = ? AND m.recipient_id = ?)
                ORDER BY m.timestamp ASC
                LIMIT ?
            """, (user1_id, user2_id, user2_id, user1_id, limit))
            
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "sender_id": row[1],
                    "recipient_id": row[2],
                    "message_text": row[3],
                    "timestamp": row[4],
                    "is_read": bool(row[5]),
                    "sender_username": row[6]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting conversation with anyone: {e}")
            return []

    async def get_recent_conversations(self, user_id: int, limit: int = 10):
        """Get recent conversations for a user (including former friends)"""
        try:
            # Simpler query that gets the most recent message for each conversation
            cursor = await self.conn.execute("""
                WITH recent_messages AS (
                    SELECT 
                        CASE 
                            WHEN m.sender_id = ? THEN m.recipient_id
                            ELSE m.sender_id
                        END as other_user_id,
                        m.conversation_id,
                        m.message_text,
                        m.timestamp,
                        m.sender_id,
                        m.recipient_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY 
                                CASE 
                                    WHEN m.sender_id = ? THEN m.recipient_id
                                    ELSE m.sender_id
                                END
                            ORDER BY m.timestamp DESC
                        ) as rn
                    FROM messages m
                    WHERE m.sender_id = ? OR m.recipient_id = ?
                )
                SELECT 
                    rm.other_user_id,
                    u.username,
                    u.email,
                    rm.conversation_id,
                    rm.timestamp as last_message_time,
                    rm.message_text as last_message_text,
                    rm.sender_id as last_message_sender,
                    (
                        SELECT COUNT(*) 
                        FROM messages m2 
                        WHERE m2.recipient_id = ? AND m2.sender_id = rm.other_user_id AND m2.is_read = FALSE
                    ) as unread_count
                FROM recent_messages rm
                JOIN users u ON rm.other_user_id = u.id
                WHERE rm.rn = 1
                ORDER BY rm.timestamp DESC
                LIMIT ?
            """, (user_id, user_id, user_id, user_id, user_id, limit))
            
            rows = await cursor.fetchall()
            return [
                {
                    "friend_id": row[0],
                    "username": row[1],
                    "email": row[2],
                    "conversation_id": row[3],
                    "last_message_time": row[4],
                    "last_message_text": row[5] or "No messages yet",
                    "last_message_sender": row[6],
                    "unread_count": row[7]
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
            # Sort the IDs to ensure consistent conversation ID regardless of who sends first
            user_ids = sorted([sender_id, recipient_id])
            conversation_id = f"conv_{user_ids[0]}_{user_ids[1]}"
            
            await self.conn.execute(
                "INSERT INTO messages (conversation_id, sender_id, recipient_id, message_text) VALUES (?, ?, ?, ?)",
                (conversation_id, sender_id, recipient_id, message_text)
            )
            await self.commit()
            return conversation_id
        except Exception as e:
            print(f"Error saving message: {e}")
            return False

    async def get_conversation(self, user1_id: int, user2_id: int, limit: int = 50):
        """Get conversation between two users"""
        try:
            cursor = await self.conn.execute("""
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
                WHERE (m.sender_id = ? AND m.recipient_id = ?) 
                   OR (m.sender_id = ? AND m.recipient_id = ?)
                ORDER BY m.timestamp ASC
                LIMIT ?
            """, (user1_id, user2_id, user2_id, user1_id, limit))
            
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "sender_id": row[1],
                    "recipient_id": row[2],
                    "message_text": row[3],
                    "timestamp": row[4],
                    "is_read": bool(row[5]),
                    "sender_username": row[6]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting conversation: {e}")
            return []

    async def mark_messages_as_read(self, user_id: int, sender_id: int):
        """Mark messages from a specific sender as read"""
        try:
            await self.conn.execute(
                "UPDATE messages SET is_read = TRUE WHERE recipient_id = ? AND sender_id = ? AND is_read = FALSE",
                (user_id, sender_id)
            )
            await self.commit()
            return True
        except Exception as e:
            print(f"Error marking messages as read: {e}")
            return False

    async def get_unread_message_count(self, user_id: int, friend_id: int):
        """Get count of unread messages from a specific friend"""
        # Force reload - ensure this method signature is correct
        try:
            cursor = await self.conn.execute(
                "SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND sender_id = ? AND is_read = FALSE",
                (user_id, friend_id)
            )
            result = await cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            print(f"Error getting unread message count: {e}")
            return 0

    async def get_unread_message_count_for_conversation(self, user_id: int, other_user_id: int):
        """Get count of unread messages from a specific user in conversation"""
        try:
            cursor = await self.conn.execute(
                "SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND sender_id = ? AND is_read = FALSE",
                (user_id, other_user_id)
            )
            result = await cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            print(f"Error getting unread message count for conversation: {e}")
            return 0

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

    async def get_all_pending_requests(self, user_id: int):
        """Get all pending friend requests for a user (both incoming and outgoing)"""
        try:
            cursor = await self.conn.execute("""
                SELECT 
                    f.id,
                    f.user_id,
                    f.friend_id,
                    f.status,
                    f.created_at,
                    u.username,
                    u.email,
                    CASE 
                        WHEN f.user_id = ? THEN 'outgoing'
                        ELSE 'incoming'
                    END as request_type
                FROM friends f
                JOIN users u ON (
                    CASE 
                        WHEN f.user_id = ? THEN f.friend_id
                        ELSE f.user_id
                    END = u.id
                )
                WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'pending'
                ORDER BY f.created_at DESC
            """, (user_id, user_id, user_id, user_id))
            
            rows = await cursor.fetchall()
            return [
                {
                    "id": row[0],
                    "user_id": row[1],
                    "friend_id": row[2],
                    "status": row[3],
                    "created_at": row[4],
                    "username": row[5],
                    "email": row[6],
                    "request_type": row[7]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting all pending requests: {e}")
            return []
