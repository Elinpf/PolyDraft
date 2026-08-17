"""数据层 CRUD + init_store 编排。

从原 store.py 收窄：提示词模板常量 → prompts.py；一次性迁移函数 → migrations.py。
本文件只留 SCHEMA、dataclass、CRUD、init_store 编排与 seed。
"""
from dataclasses import dataclass
import json
from .db import conn
from .review import ReviewFields
from .prompts import (
    _DEFAULT_SLOTS, _DEFAULT_REVIEW, _DEFAULT_SYSTEM,
    _DEFAULT_KB_SERIES, _DEFAULT_DIMENSIONS,
)
from .migrations import (
    _ensure_slot_name_column, _ensure_finalized_review_columns,
    _migrate_default_slots, _migrate_brand_tone_placeholders,
    _strip_tone_from_slots_and_system, _rename_constraint_to_prompt_var,
    _migrate_review_prompt, _migrate_product_knowledge, _migrate_prompt_layering,
)


SCHEMA = """
CREATE TABLE IF NOT EXISTS generate_slots (
    slot        INTEGER PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',   -- 风格名（小标题，用户可改，如 官方版/亲切版）
    body        TEXT NOT NULL,
    temperature REAL NOT NULL DEFAULT 1.0   -- 对产品隐藏，后端固定 1
);
CREATE TABLE IF NOT EXISTS review_prompt (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    body  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_prompt (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    body  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finalized (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    provider    TEXT,
    input_vars  TEXT,          -- JSON
    selected_idx INTEGER,     -- 选中第几份候选
    text        TEXT NOT NULL, -- 编辑后的最终文本
    review      TEXT,           -- 该次的审查意见（兼容旧字段，存 raw）
    score       INTEGER,        -- Change C：综合打分 0-100
    positive    TEXT,           -- 正向亲和意见
    reverse      TEXT,           -- 反向亲和意见
    accuracy    TEXT            -- 产品知识准确性意见
);
CREATE TABLE IF NOT EXISTS option_dimensions (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    kind  TEXT NOT NULL DEFAULT 'value'   -- 'value' | 'prompt'
);
CREATE TABLE IF NOT EXISTS option_choices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_id    INTEGER NOT NULL,
    label           TEXT NOT NULL,
    value           TEXT,              -- 注入值；空则用 label
    prompt_fragment TEXT DEFAULT '',    -- 仅 kind=prompt 维度用
    FOREIGN KEY (dimension_id) REFERENCES option_dimensions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS product_knowledge (
    series TEXT PRIMARY KEY,   -- 产品系列名，与「产品系列」选项维度的选项 value 软关联
    body   TEXT NOT NULL       -- 知识文本（多行）
);
"""


@dataclass
class GenSlot:
    slot: int
    body: str
    name: str = ""
    temperature: float = 0.7


@dataclass
class PromptBody:
    """单例提示词的统一载体（review / system prompt 都是单个 body 文本）。"""
    body: str


# 兼容旧名：review/system prompt 共用同一载体
ReviewPrompt = PromptBody


def init_store(db_path=None):
    with conn(db_path) as c:
        c.executescript(SCHEMA)
    # 旧库迁移：generate_slots 补 name 列
    _ensure_slot_name_column()
    with conn(db_path) as c:
        for s in _DEFAULT_SLOTS:
            c.execute("INSERT OR IGNORE INTO generate_slots(slot, name, body, temperature) VALUES (?,?,?,?)", s)
        c.execute("INSERT OR IGNORE INTO review_prompt(id, body) VALUES (1, ?)", (_DEFAULT_REVIEW,))
        c.execute("INSERT OR IGNORE INTO system_prompt(id, body) VALUES (1, ?)", (_DEFAULT_SYSTEM,))
    # Change C：finalized 表补审核结果列
    _ensure_finalized_review_columns()
    # 旧版默认槽位（仍含 {topic}/{语气}）迁移到维度变量版，仅替换未改动的默认值
    _migrate_default_slots()
    # {brand}/{tone} 占位迁移为中文 {品牌}/{语气}
    _migrate_brand_tone_placeholders()
    # 移除 {语气}（语气改由文案风格控制）
    _strip_tone_from_slots_and_system()
    # {X约束} 占位重命名为 {X提示词}（更通用）
    _rename_constraint_to_prompt_var()
    # Change C：旧版综合审查 prompt 迁移到三维度独立审核版
    _migrate_review_prompt()
    # Change B：把旧「产品知识」全局变量迁移到 product_knowledge 表，并删除变量条目
    _migrate_product_knowledge()
    # 提示词分层重构：旧默认 system/slot → 新版（人设+知识分层 + slot 带变量占位）
    _migrate_prompt_layering()
    # 选项维度 seed
    _seed_dimensions()
    # 产品知识 seed
    _seed_product_knowledge()


# --- slots ---

def list_slots() -> list[GenSlot]:
    with conn() as c:
        rows = c.execute("SELECT slot, name, body, temperature FROM generate_slots ORDER BY slot").fetchall()
        return [GenSlot(**dict(r)) for r in rows]


def save_slot(slot: int, body: str, temperature: float, name: str = ""):
    """temperature 对产品隐藏，后端固定 1，忽略客户端传入值。name 为风格名。"""
    with conn() as c:
        c.execute(
            "INSERT INTO generate_slots(slot, name, body, temperature) VALUES (?,?,?,?) "
            "ON CONFLICT(slot) DO UPDATE SET name=excluded.name, body=excluded.body, temperature=1.0",
            (slot, name, body, 1.0),
        )


def delete_slot(slot: int):
    with conn() as c:
        c.execute("DELETE FROM generate_slots WHERE slot=?", (slot,))


# --- review prompt ---

def get_review_prompt() -> ReviewPrompt:
    with conn() as c:
        row = c.execute("SELECT body FROM review_prompt WHERE id=1").fetchone()
        if not row:
            raise KeyError("review prompt not found")
        return ReviewPrompt(**dict(row))


def save_review_prompt(body: str):
    with conn() as c:
        c.execute(
            "INSERT INTO review_prompt(id, body) VALUES (1,?) "
            "ON CONFLICT(id) DO UPDATE SET body=excluded.body",
            (body,),
        )


# --- system prompt ---

def get_system_prompt() -> ReviewPrompt:
    with conn() as c:
        row = c.execute("SELECT body FROM system_prompt WHERE id=1").fetchone()
        if not row:
            raise KeyError("system prompt not found")
        return ReviewPrompt(**dict(row))


def save_system_prompt(body: str):
    with conn() as c:
        c.execute(
            "INSERT INTO system_prompt(id, body) VALUES (1,?) "
            "ON CONFLICT(id) DO UPDATE SET body=excluded.body",
            (body,),
        )


# --- 定稿成品留存 ---

@dataclass
class Finalized(ReviewFields):
    # 字段全有默认值以兼容 dataclass 继承顺序（基类 ReviewFields 字段均有默认）
    id: int | None = None
    ts: str = ""
    provider: str = ""
    input_vars: str = ""        # JSON
    selected_idx: int = 0
    text: str = ""
    review: str = ""


def save_finalized(provider: str, input_vars: dict, selected_idx: int, text: str,
                   review: str = "", review_fields: ReviewFields | None = None) -> int:
    """用户定稿时写入。text 为编辑后的最终文本；review 为审核原文，review_fields 为结构化审核结果。"""
    rf = review_fields or ReviewFields()
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc).isoformat()
    with conn() as c:
        cur = c.execute(
            "INSERT INTO finalized(ts, provider, input_vars, selected_idx, text, review, score, positive, reverse, accuracy) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (ts, provider, json.dumps(input_vars, ensure_ascii=False), selected_idx, text, review,
             rf.score, rf.positive, rf.reverse, rf.accuracy),
        )
        return cur.lastrowid


def list_finalized() -> list[Finalized]:
    with conn() as c:
        rows = c.execute(
            "SELECT id, ts, provider, input_vars, selected_idx, text, review, "
            "score, positive, reverse, accuracy FROM finalized ORDER BY id DESC"
        ).fetchall()
        return [Finalized(**dict(r)) for r in rows]


def delete_finalized(fid: int):
    with conn() as c:
        c.execute("DELETE FROM finalized WHERE id=?", (fid,))


# --- 选项维度 (Change A) ---

@dataclass
class OptionDimension:
    id: int
    name: str
    kind: str = "value"   # 'value' | 'prompt'


@dataclass
class OptionChoice:
    id: int
    dimension_id: int
    label: str
    value: str = ""
    prompt_fragment: str = ""


def _seed_dimensions():
    """启动时 seed 默认维度与选项；已存在则不重复写入。"""
    with conn() as c:
        cnt = c.execute("SELECT COUNT(*) AS n FROM option_dimensions").fetchone()["n"]
        if cnt > 0:
            return
        for dim in _DEFAULT_DIMENSIONS:
            cur = c.execute(
                "INSERT INTO option_dimensions(name, kind) VALUES (?,?)",
                (dim["name"], dim["kind"]),
            )
            dim_id = cur.lastrowid
            for ch in dim["choices"]:
                c.execute(
                    "INSERT INTO option_choices(dimension_id, label, value, prompt_fragment) VALUES (?,?,?,?)",
                    (dim_id, ch["label"], ch["value"], ch["prompt_fragment"]),
                )


def list_dimensions() -> list[OptionDimension]:
    with conn() as c:
        rows = c.execute("SELECT id, name, kind FROM option_dimensions ORDER BY id").fetchall()
        return [OptionDimension(**dict(r)) for r in rows]


def get_dimension(dim_id: int) -> OptionDimension | None:
    with conn() as c:
        row = c.execute("SELECT id, name, kind FROM option_dimensions WHERE id=?", (dim_id,)).fetchone()
        return OptionDimension(**dict(row)) if row else None


def save_dimension(name: str, kind: str) -> int:
    """新建维度；name 唯一，冲突报 ValueError。返回 id。"""
    if kind not in ("value", "prompt"):
        raise ValueError(f"unknown dimension kind '{kind}'")
    name = (name or "").strip()
    if not name:
        raise ValueError("维度名不能为空")
    with conn() as c:
        exists = c.execute("SELECT id FROM option_dimensions WHERE name=?", (name,)).fetchone()
        if exists:
            raise ValueError(f"维度名「{name}」已存在")
        cur = c.execute("INSERT INTO option_dimensions(name, kind) VALUES (?,?)", (name, kind))
        return cur.lastrowid


def update_dimension(dim_id: int, name: str, kind: str):
    if kind not in ("value", "prompt"):
        raise ValueError(f"unknown dimension kind '{kind}'")
    name = (name or "").strip()
    if not name:
        raise ValueError("维度名不能为空")
    with conn() as c:
        dup = c.execute(
            "SELECT id FROM option_dimensions WHERE name=? AND id<>?", (name, dim_id)
        ).fetchone()
        if dup:
            raise ValueError(f"维度名「{name}」已存在")
        c.execute("UPDATE option_dimensions SET name=?, kind=? WHERE id=?", (name, kind, dim_id))


def delete_dimension(dim_id: int):
    with conn() as c:
        c.execute("DELETE FROM option_dimensions WHERE id=?", (dim_id,))


def list_choices(dim_id: int) -> list[OptionChoice]:
    with conn() as c:
        rows = c.execute(
            "SELECT id, dimension_id, label, value, prompt_fragment FROM option_choices "
            "WHERE dimension_id=? ORDER BY id",
            (dim_id,),
        ).fetchall()
        return [OptionChoice(**dict(r)) for r in rows]


def save_choice(dim_id: int, label: str, value: str = "", prompt_fragment: str = "") -> int:
    label = (label or "").strip()
    if not label:
        raise ValueError("选项 label 不能为空")
    with conn() as c:
        cur = c.execute(
            "INSERT INTO option_choices(dimension_id, label, value, prompt_fragment) VALUES (?,?,?,?)",
            (dim_id, label, value or label, prompt_fragment),
        )
        return cur.lastrowid


def update_choice(choice_id: int, label: str, value: str, prompt_fragment: str):
    label = (label or "").strip()
    if not label:
        raise ValueError("选项 label 不能为空")
    with conn() as c:
        c.execute(
            "UPDATE option_choices SET label=?, value=?, prompt_fragment=? WHERE id=?",
            (label, value or label, prompt_fragment, choice_id),
        )


def delete_choice(choice_id: int):
    with conn() as c:
        c.execute("DELETE FROM option_choices WHERE id=?", (choice_id,))


def selections_to_vars(selections: dict) -> dict:
    """把用户所选「维度名 -> 选项 label」解析为变量上下文。

    纯值维度：{维度名} = 选项 value（空则用 label）
    带 prompt 维度：额外注入 {维度名提示词} = prompt_fragment

    返回 dict 中「维度名 -> 选项 value」可直接复用于产品知识查询。
    """
    if not selections:
        return {}
    dims = {d.name: d for d in list_dimensions()}
    out: dict[str, str] = {}
    for dim_name, choice_label in selections.items():
        dim = dims.get(dim_name)
        if not dim:
            continue
        choices = list_choices(dim.id)
        ch = next((c for c in choices if c.label == choice_label), None)
        if not ch:
            continue
        # 注入 label（用户选的可读文本，如"至熠"），不注入 value（如"A"）。
        # value 仅 selection_value 内部查产品知识库用，不进提示词。
        out[dim.name] = ch.label
        if dim.kind == "prompt" and ch.prompt_fragment:
            out[dim.name + "提示词"] = ch.prompt_fragment
    return out


def selection_value(selections: dict, dim_name: str) -> str:
    """把 selections[维度名] 的 label 解析为该选项的 value（label==value 时不变）。

    用于产品知识按 series(=value) 查询，避免 label/value 不一致时失配。
    """
    if not selections:
        return ""
    choice_label = selections.get(dim_name)
    if not choice_label:
        return ""
    dim = next((d for d in list_dimensions() if d.name == dim_name), None)
    if not dim:
        return ""
    ch = next((c for c in list_choices(dim.id) if c.label == choice_label), None)
    if not ch:
        return ""
    return ch.value or ch.label


# --- 产品知识 (Change B) ---

@dataclass
class ProductKnowledge:
    series: str
    body: str


def _seed_product_knowledge():
    """启动时 seed 默认系列知识；已存在则不覆盖。"""
    with conn() as c:
        for series, body in _DEFAULT_KB_SERIES.items():
            c.execute(
                "INSERT OR IGNORE INTO product_knowledge(series, body) VALUES (?,?)",
                (series, body),
            )


def list_product_knowledge() -> list[ProductKnowledge]:
    with conn() as c:
        rows = c.execute("SELECT series, body FROM product_knowledge ORDER BY series").fetchall()
        return [ProductKnowledge(**dict(r)) for r in rows]


def get_product_knowledge(series: str) -> str | None:
    with conn() as c:
        row = c.execute("SELECT body FROM product_knowledge WHERE series=?", (series,)).fetchone()
        return row["body"] if row else None


def save_product_knowledge(series: str, body: str):
    series = (series or "").strip()
    if not series:
        raise ValueError("产品系列不能为空")
    with conn() as c:
        c.execute(
            "INSERT INTO product_knowledge(series, body) VALUES (?,?) "
            "ON CONFLICT(series) DO UPDATE SET body=excluded.body",
            (series, body),
        )


def delete_product_knowledge(series: str):
    with conn() as c:
        c.execute("DELETE FROM product_knowledge WHERE series=?", (series,))


def product_knowledge_for_selection(selections: dict) -> str:
    """从 selections 取产品系列 value（label→value 解析），查 product_knowledge 得 body。

    注意：selections 存的是选项 label，但 product_knowledge.series 对应选项 value，
    故必须经 selection_value 解析为 value 再查，否则 label≠value 时失配。
    """
    series = selection_value(selections, "产品系列")
    if not series:
        return ""
    return get_product_knowledge(series) or ""
