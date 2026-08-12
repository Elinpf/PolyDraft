"""DB 连接器与初始化 — Change 0。

集中提供 SQLite 连接逻辑，供日志与后续业务模块复用。
启动时 init_db 建日志三表。
"""
import sqlite3
from contextlib import contextmanager

DB_PATH = "copygen.db"


@contextmanager
def conn(db_path: str = DB_PATH):
    c = sqlite3.connect(db_path or DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


LOG_SCHEMA = """
CREATE TABLE IF NOT EXISTS operations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT NOT NULL,
    method    TEXT,
    path      TEXT,
    status    INTEGER,
    duration_ms INTEGER,
    detail    TEXT
);
CREATE TABLE IF NOT EXISTS call_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT NOT NULL,
    provider  TEXT,
    success   INTEGER NOT NULL,
    duration_ms INTEGER,
    error     TEXT
);
CREATE TABLE IF NOT EXISTS gen_records (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT NOT NULL,
    kind      TEXT NOT NULL,           -- 'generate' | 're_review'
    provider  TEXT,
    input_vars TEXT,                    -- JSON
    drafts    TEXT,                     -- JSON array
    review    TEXT
);
"""


def init_db(db_path: str = DB_PATH):
    """启动时建日志三表。后续 change 的业务表由各自 init 追加。"""
    with conn(db_path) as c:
        c.executescript(LOG_SCHEMA)
