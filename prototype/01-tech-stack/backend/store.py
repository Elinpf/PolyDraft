"""变量与提示词数据层 — ticket 04 落地。

数据模型：
- 变量分两类：
  - 全局变量（常驻配置态）：品牌名/tone/受众描述，存 DB，WebUI「变量管理」页维护。
  - 输入变量（每次运行态）：本次主题/关键词，生成页表单现填，不落库。
- 提示词分两条：generate_prompt / review_prompt，各自独立编辑。
- {candidates} 是系统注入变量（并行候选拼接），非用户变量，审查阶段由流水线注入。

运行时变量合并：全局变量 + 本次输入变量 -> dict，注入所有阶段 prompt。
"""
import sqlite3
from dataclasses import dataclass
from contextlib import contextmanager


@contextmanager
def _conn(db_path="copygen.db"):
    c = sqlite3.connect(db_path)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS variables (
    name  TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_prompt (
    id    INTEGER PRIMARY KEY CHECK (id = 1),  -- 单例：审查 prompt 只一条
    body  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generate_slots (
    slot        INTEGER PRIMARY KEY,   -- 0,1,2... 每份候选一个槽位
    body        TEXT NOT NULL,         -- 该风格的生成 prompt
    temperature REAL NOT NULL DEFAULT 0.7
);
"""

# 系统注入变量，禁止用户变量同名占用
SYSTEM_VARS = {"candidates"}


@dataclass
class Variable:
    name: str
    value: str


@dataclass
class ReviewPrompt:
    body: str


@dataclass
class GenSlot:
    slot: int
    body: str
    temperature: float = 0.7


# 默认 3 个风格槽位占位 —— 用户在 WebUI 改成自己的风格 prompt + 温度
_DEFAULT_SLOTS = [
    GenSlot(0, "请根据以下信息写一段营销文案，风格专业严谨。\n主题：{topic}\n品牌：{brand}\n语气：{tone}", 0.7),
    GenSlot(1, "请根据以下信息写一段营销文案，风格活泼口语化。\n主题：{topic}\n品牌：{brand}\n语气：{tone}", 0.9),
    GenSlot(2, "请根据以下信息写一段营销文案，风格故事化、有画面感。\n主题：{topic}\n品牌：{brand}\n语气：{tone}", 0.5),
]

_DEFAULT_REVIEW = "以下是多份候选文案，请逐份点评并给出综合改进意见：\n{candidates}"


def init_store(db_path="copygen.db"):
    with _conn(db_path) as c:
        c.executescript(SCHEMA)
        c.execute(
            "INSERT OR IGNORE INTO review_prompt(id, body) VALUES (1, ?)",
            (_DEFAULT_REVIEW,),
        )
        for s in _DEFAULT_SLOTS:
            c.execute(
                "INSERT OR IGNORE INTO generate_slots(slot, body, temperature) VALUES (?,?,?)",
                (s.slot, s.body, s.temperature),
            )


# --- 变量存取 ---

def list_variables(db_path="copygen.db") -> list[Variable]:
    with _conn(db_path) as c:
        rows = c.execute("SELECT name, value FROM variables ORDER BY name").fetchall()
        return [Variable(**dict(r)) for r in rows]


def save_variable(name: str, value: str, db_path="copygen.db"):
    if name in SYSTEM_VARS:
        raise ValueError(f"'{name}' 是系统保留变量，不可作为用户变量")
    with _conn(db_path) as c:
        c.execute(
            "INSERT INTO variables(name, value) VALUES (?,?) "
            "ON CONFLICT(name) DO UPDATE SET value=excluded.value",
            (name, value),
        )


def delete_variable(name: str, db_path="copygen.db"):
    with _conn(db_path) as c:
        c.execute("DELETE FROM variables WHERE name=?", (name,))


def merge_variables(input_vars: dict, db_path="copygen.db") -> dict:
    """合并全局变量 + 本次输入变量。输入变量同名覆盖全局。"""
    merged = {v.name: v.value for v in list_variables(db_path)}
    merged.update(input_vars)
    return merged


# --- 提示词存取 ---

def get_review_prompt(db_path="copygen.db") -> ReviewPrompt:
    with _conn(db_path) as c:
        row = c.execute("SELECT body FROM review_prompt WHERE id=1").fetchone()
        if not row:
            raise KeyError("review prompt not found")
        return ReviewPrompt(**dict(row))


def save_review_prompt(body: str, db_path="copygen.db"):
    with _conn(db_path) as c:
        c.execute(
            "INSERT INTO review_prompt(id, body) VALUES (1,?) "
            "ON CONFLICT(id) DO UPDATE SET body=excluded.body",
            (body,),
        )


def list_slots(db_path="copygen.db") -> list[GenSlot]:
    with _conn(db_path) as c:
        rows = c.execute("SELECT slot, body, temperature FROM generate_slots ORDER BY slot").fetchall()
        return [GenSlot(**dict(r)) for r in rows]


def save_slot(slot: int, body: str, temperature: float, db_path="copygen.db"):
    with _conn(db_path) as c:
        c.execute(
            "INSERT INTO generate_slots(slot, body, temperature) VALUES (?,?,?) "
            "ON CONFLICT(slot) DO UPDATE SET body=excluded.body, temperature=excluded.temperature",
            (slot, body, temperature),
        )


def delete_slot(slot: int, db_path="copygen.db"):
    with _conn(db_path) as c:
        c.execute("DELETE FROM generate_slots WHERE slot=?", (slot,))
