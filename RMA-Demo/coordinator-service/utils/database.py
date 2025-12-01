"""
Database initialization utilities
For MVP: Using in-memory storage
For production: Can switch to SQLite or PostgreSQL
"""

import os
from typing import Optional


def init_db():
    """Initialize database"""

    # For MVP, we use in-memory storage (worker_registry.workers dict)
    # For production, uncomment below to use SQLite or PostgreSQL

    # db_path = os.getenv("DATABASE_PATH", "coordinator.db")
    # if not os.path.exists(db_path):
    #     # Create database schema
    #     conn = sqlite3.connect(db_path)
    #     cursor = conn.cursor()
    #
    #     cursor.execute("""
    #         CREATE TABLE workers (
    #             worker_id TEXT PRIMARY KEY,
    #             tier INTEGER NOT NULL,
    #             status TEXT NOT NULL,
    #             capabilities JSON NOT NULL,
    #             assigned_containers JSON NOT NULL,
    #             last_heartbeat TIMESTAMP,
    #             registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    #             current_load REAL DEFAULT 0.0,
    #             ip_address TEXT,
    #             tasks_completed INTEGER DEFAULT 0
    #         )
    #     """)
    #
    #     conn.commit()
    #     conn.close()

    print("✅ Database initialized (in-memory mode)")
