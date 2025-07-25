import aiosqlite

class Database:
    def __init__(self, db_name):
        self.db_name = db_name
        self.conn = None

    async def connect(self):
        self.conn = await aiosqlite.connect(self.db_name)

    async def close(self):
        await self.conn.close()

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