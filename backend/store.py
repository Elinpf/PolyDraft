"""提示词数据层 — Change 2/4（多槽位 + review_prompt + variables）。

generate_slots 多行；review_prompt 单例；variables 全局变量表。
Change 4 加：variables + SYSTEM_VARS + merge_variables。
"""
from dataclasses import dataclass
import json
from .db import conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS generate_slots (
    slot        INTEGER PRIMARY KEY,
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

_DEFAULT_SLOTS = [
    (0, "请撰写一段营销文案，风格为「官方版」：专业严谨、权威克制。\n产品系列：{产品系列}\n产品段位：{产品段位}\n文案类型：{文案类型}\n约束要求：{文案类型约束}\n品牌：{brand}\n语气：{tone}", 1.0),
    (1, "请撰写一段营销文案，风格为「亲切版」：活泼口语化、像朋友在分享。\n产品系列：{产品系列}\n产品段位：{产品段位}\n文案类型：{文案类型}\n约束要求：{文案类型约束}\n品牌：{brand}\n语气：{tone}", 1.0),
    (2, "请撰写一段营销文案，风格为「闺蜜版」：故事化、有画面感、走心。\n产品系列：{产品系列}\n产品段位：{产品段位}\n文案类型：{文案类型}\n约束要求：{文案类型约束}\n品牌：{brand}\n语气：{tone}", 1.0),
]
# 旧版默认槽位（用于一次性迁移到维度变量版）
_OLD_DEFAULT_SLOTS = [
    "请根据以下信息写一段营销文案，风格专业严谨。\n主题：{topic}\n品牌：{brand}\n语气：{tone}",
    "请根据以下信息写一段营销文案，风格活泼口语化。\n主题：{topic}\n品牌：{brand}\n语气：{tone}",
    "请根据以下信息写一段营销文案，风格故事化、有画面感。\n主题：{topic}\n品牌：{brand}\n语气：{tone}",
]
_DEFAULT_REVIEW = (
    "请审核以下文案，从三个维度评估并给出综合打分（0-100 整数）：\n"
    "- 正向亲和：是否体现亲和、温暖、贴近用户的正向表达\n"
    "- 反向亲和：是否避免生硬、说教、推销感等引起反感的表达\n"
    "- 产品知识准确性：是否符合产品知识，有无事实错误\n\n"
    "产品知识参照：\n{产品知识}\n\n"
    "待审核文案：\n{candidate}\n\n"
    "请严格按以下格式输出，每项一行（意见可在同一行内简述）：\n"
    "综合打分：<0-100 整数>\n"
    "正向亲和：<意见>\n"
    "反向亲和：<意见>\n"
    "产品知识准确性：<意见>"
)
# 旧版综合审查 prompt（用于一次性迁移到三维度独立审核版）
_OLD_DEFAULT_REVIEW = "以下是多份候选文案，请逐份点评并给出综合改进意见：\n{candidates}"
_DEFAULT_SYSTEM = "你是品牌官方私域内容专家，身份为品牌官方营养师/喂养顾问。请用专业、克制、有温度的语气撰写文案。\n品牌：{brand}\n语气：{tone}\n\n产品知识：\n{产品知识}"
_DEFAULT_KB = """【产品知识库】

爱他美卓傲（高端牛奶粉）：
- 9:1 自护益生元设计，含 HMO 母乳低聚糖
- 天然乳脂 OPO，帮助钙铁锌镁吸收
- 全段全乳糖，不添加香精蔗糖
- 适合 0-6 岁宝宝，转奶/消化吸收顾虑

爱他美领熠（超高端·奇迹系列）：
- 独家 SYNEO®：240 亿 M-16V + 100+ 种自护益生元
- 双源 OPO（新国标 2 倍），软化便便促吸收
- 适合追求顶配配方、宝宝消化吸收难题的家长

（在此维护产品卖点、受众、范文等知识，生成时通过 {产品知识} 注入 system prompt）"""

# Change B：产品知识按系列一条文本，与「产品系列」选项维度的 value 软关联
_DEFAULT_KB_SERIES = {
    "A": "【产品系列 A · 卓傲（高端牛奶粉）】\n- 9:1 自护益生元设计，含 HMO 母乳低聚糖\n- 天然乳脂 OPO，帮助钙铁锌镁吸收\n- 全段全乳糖，不添加香精蔗糖\n- 适合 0-6 岁宝宝，转奶/消化吸收顾虑",
    "B": "【产品系列 B · 领熠（超高端·奇迹系列）】\n- 独家 SYNEO®：240 亿 M-16V + 100+ 种自护益生元\n- 双源 OPO（新国标 2 倍），软化便便促吸收\n- 适合追求顶配配方、宝宝消化吸收难题的家长",
    "C": "【产品系列 C】\n（在此维护系列 C 的产品卖点、受众、范文等知识）",
    "D": "【产品系列 D】\n（在此维护系列 D 的产品卖点、受众、范文等知识）",
}

# 选项维度 seed：产品系列(纯值) / 产品段位(纯值) / 文案类型(带prompt片段)
_DEFAULT_DIMENSIONS = [
    {"name": "产品系列", "kind": "value", "choices": [
        {"label": "A", "value": "A", "prompt_fragment": ""},
        {"label": "B", "value": "B", "prompt_fragment": ""},
        {"label": "C", "value": "C", "prompt_fragment": ""},
        {"label": "D", "value": "D", "prompt_fragment": ""},
    ]},
    {"name": "产品段位", "kind": "value", "choices": [
        {"label": "1", "value": "1", "prompt_fragment": ""},
        {"label": "2", "value": "2", "prompt_fragment": ""},
        {"label": "3", "value": "3", "prompt_fragment": ""},
    ]},
    {"name": "文案类型", "kind": "prompt", "choices": [
        {"label": "朋友圈", "value": "朋友圈", "prompt_fragment": "文案不超过7行，每行不超过20字；开头要有钩子，适合朋友圈发布。"},
        {"label": "1v1", "value": "1v1", "prompt_fragment": "1对1私聊口吻，像朋友单独对话，200字以内，语气亲近。"},
        {"label": "社群文案", "value": "社群文案", "prompt_fragment": "适合社群群发，带互动引导与行动号召，300字以内。"},
        {"label": "小红书", "value": "小红书", "prompt_fragment": "小红书种草风格，带emoji、分段，标题吸睛，400字以内。"},
    ]},
]


@dataclass
class GenSlot:
    slot: int
    body: str
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
        for s in _DEFAULT_SLOTS:
            c.execute("INSERT OR IGNORE INTO generate_slots(slot, body, temperature) VALUES (?,?,?)", s)
        c.execute("INSERT OR IGNORE INTO review_prompt(id, body) VALUES (1, ?)", (_DEFAULT_REVIEW,))
        c.execute("INSERT OR IGNORE INTO system_prompt(id, body) VALUES (1, ?)", (_DEFAULT_SYSTEM,))
    # Change C：finalized 表补审核结果列
    _ensure_finalized_review_columns()
    # 旧版默认槽位（仍含 {topic}）迁移到维度变量版，仅替换未改动的默认值
    _migrate_default_slots()
    # Change C：旧版综合审查 prompt 迁移到三维度独立审核版
    _migrate_review_prompt()
    # Change B：把旧「产品知识」全局变量迁移到 product_knowledge 表，并删除变量条目
    _migrate_product_knowledge()
    # 选项维度 seed
    _seed_dimensions()
    # 产品知识 seed
    _seed_product_knowledge()


# --- slots ---

def list_slots() -> list[GenSlot]:
    with conn() as c:
        rows = c.execute("SELECT slot, body, temperature FROM generate_slots ORDER BY slot").fetchall()
        return [GenSlot(**dict(r)) for r in rows]


def save_slot(slot: int, body: str, temperature: float):
    """temperature 对产品隐藏，后端固定 1，忽略客户端传入值。"""
    with conn() as c:
        c.execute(
            "INSERT INTO generate_slots(slot, body, temperature) VALUES (?,?,?) "
            "ON CONFLICT(slot) DO UPDATE SET body=excluded.body, temperature=1.0",
            (slot, body, 1.0),
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


def _ensure_columns(table: str, columns: list[tuple[str, str]]):
    """迁移：确保 table 表存在 columns 中声明的列（[(col, decl)...]），缺则 ALTER 补。"""
    with conn() as c:
        cols = [r[1] for r in c.execute(f"PRAGMA table_info({table})").fetchall()]
        for col, decl in columns:
            if col not in cols:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def _ensure_finalized_review_columns():
    """迁移：旧 finalized 表可能没有 score/positive/reverse/accuracy 列，补上。"""
    _ensure_columns("finalized", [
        ("score", "INTEGER"),
        ("positive", "TEXT"),
        ("reverse", "TEXT"),
        ("accuracy", "TEXT"),
    ])


def _migrate_default_slots():
    """一次性迁移：把仍是旧版默认（含 {topic}）的槽位替换为维度变量版。"""
    with conn() as c:
        rows = c.execute("SELECT slot, body FROM generate_slots ORDER BY slot").fetchall()
        for r in rows:
            slot, body = r["slot"], r["body"]
            if body in _OLD_DEFAULT_SLOTS:
                idx = _OLD_DEFAULT_SLOTS.index(body)
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (_DEFAULT_SLOTS[idx][1], slot))


def _migrate_review_prompt():
    """一次性迁移：旧版综合审查 prompt（含 {candidates}）替换为三维度独立审核版。"""
    with conn() as c:
        row = c.execute("SELECT body FROM review_prompt WHERE id=1").fetchone()
        if row and row["body"] == _OLD_DEFAULT_REVIEW:
            c.execute("UPDATE review_prompt SET body=? WHERE id=1", (_DEFAULT_REVIEW,))


# --- 定稿成品留存 ---

@dataclass
class Finalized:
    id: int | None
    ts: str
    provider: str
    input_vars: str        # JSON
    selected_idx: int
    text: str
    review: str = ""
    score: int | None = None
    positive: str = ""
    reverse: str = ""
    accuracy: str = ""


def save_finalized(provider: str, input_vars: dict, selected_idx: int, text: str,
                   review: str = "", score: int | None = None,
                   positive: str = "", reverse: str = "", accuracy: str = "") -> int:
    """用户定稿时写入。text 为编辑后的最终文本；review 为审核原文，score/三维度为结构化审核结果。"""
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc).isoformat()
    with conn() as c:
        cur = c.execute(
            "INSERT INTO finalized(ts, provider, input_vars, selected_idx, text, review, score, positive, reverse, accuracy) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (ts, provider, json.dumps(input_vars, ensure_ascii=False), selected_idx, text, review,
             score, positive, reverse, accuracy),
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
    带 prompt 维度：额外注入 {维度名约束} = prompt_fragment

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
        out[dim.name] = ch.value or ch.label
        if dim.kind == "prompt" and ch.prompt_fragment:
            out[dim.name + "约束"] = ch.prompt_fragment
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


def _migrate_product_knowledge():
    """一次性迁移：把旧 variables 表的「产品知识」全局变量迁到 product_knowledge 表并删除原变量。

    迁移目标：若已有产品系列维度，取其第一个选项 value 作为默认 series；否则落到 series='A'。
    仅在 product_knowledge 表为空时迁移，避免覆盖用户已维护内容。
    variables 表在新版本已移除；旧库可能仍残留该表，迁移后清理。
    """
    with conn() as c:
        # variables 表在新版本不再创建；旧库可能残留，确认存在再操作
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='variables'").fetchall()]
        if "variables" not in tables:
            return
        pk_exists = c.execute("SELECT COUNT(*) AS n FROM product_knowledge").fetchone()["n"]
        if pk_exists > 0:
            # 表已有内容，仅清理残留的旧变量条目
            c.execute("DELETE FROM variables WHERE name=?", ("产品知识",))
            return
        row = c.execute("SELECT value FROM variables WHERE name=?", ("产品知识",)).fetchone()
        if not row:
            return
        legacy_value = row["value"] or ""
        # 取产品系列维度第一个选项 value 作为迁移 series
        series = "A"
        drow = c.execute("SELECT id FROM option_dimensions WHERE name=?", ("产品系列",)).fetchone()
        if drow:
            first = c.execute(
                "SELECT value, label FROM option_choices WHERE dimension_id=? ORDER BY id LIMIT 1",
                (drow["id"],),
            ).fetchone()
            if first:
                series = first["value"] or first["label"] or "A"
        if legacy_value.strip():
            c.execute(
                "INSERT INTO product_knowledge(series, body) VALUES (?,?) "
                "ON CONFLICT(series) DO UPDATE SET body=excluded.body",
                (series, legacy_value),
            )
        c.execute("DELETE FROM variables WHERE name=?", ("产品知识",))


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
