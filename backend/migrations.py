"""一次性数据库迁移函数。

从 store.py 拆出：`_ensure_columns` + 8 个 `_migrate_*`/`_ensure_*`/`_strip_*`/`_rename_*`。
这些是历史演进的一次性包袱，对旧库执行后即恒等。由 `store.init_store` 编排调用。
"""
import re

from .db import conn
from .prompts import (
    _DEFAULT_SLOTS, _OLD_DEFAULT_SLOTS, _OLD_EN_SLOTS,
    _DEFAULT_REVIEW, _OLD_DEFAULT_REVIEW,
    _DEFAULT_SYSTEM, _OLD_EN_SYSTEM, _OLD_ZH_SYSTEM_WITH_TONE,
    _OLD_PRE_LAYERING_SLOTS, _OLD_PRE_LAYERING_SYSTEM,
)


def _ensure_columns(table: str, columns: list[tuple[str, str]]):
    """迁移：确保 table 表存在 columns 中声明的列（[(col, decl)...]），缺则 ALTER 补。"""
    with conn() as c:
        cols = [r[1] for r in c.execute(f"PRAGMA table_info({table})").fetchall()]
        for col, decl in columns:
            if col not in cols:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def _ensure_slot_name_column():
    """迁移：旧 generate_slots 表可能没有 name 列，补上。"""
    _ensure_columns("generate_slots", [("name", "TEXT NOT NULL DEFAULT ''")])


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
            elif body in _OLD_EN_SLOTS:
                # 英文占位版默认槽位 → 中文占位版
                idx = _OLD_EN_SLOTS.index(body)
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (_DEFAULT_SLOTS[idx][1], slot))


def _migrate_brand_tone_placeholders():
    """一次性迁移：把提示词里的 {brand}/{tone} 占位替换为中文 {品牌}/{语气}。

    覆盖 system_prompt 与所有 generate_slots，仅做占位替换，保留用户其他改动。
    """
    with conn() as c:
        row = c.execute("SELECT body FROM system_prompt WHERE id=1").fetchone()
        if row and "{brand}" in row["body"]:
            new = row["body"].replace("{brand}", "{品牌}").replace("{tone}", "{语气}")
            c.execute("UPDATE system_prompt SET body=? WHERE id=1", (new,))
        elif row and row["body"] == _OLD_EN_SYSTEM:
            c.execute("UPDATE system_prompt SET body=? WHERE id=1", (_DEFAULT_SYSTEM,))
        for r in c.execute("SELECT slot, body FROM generate_slots").fetchall():
            if "{brand}" in r["body"]:
                new = r["body"].replace("{brand}", "{品牌}").replace("{tone}", "{语气}")
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (new, r["slot"]))


def _strip_tone_from_slots_and_system():
    """一次性迁移：移除 {语气} 变量（语气改由文案风格控制）。

    - generate_slots / system_prompt 里删掉「语气：{语气}」行，并替换裸 {语气} 占位为空。
    - 默认槽位（仍是老 body）整体替换为新默认值。
    """
    with conn() as c:
        # system_prompt：默认值整体替换；用户改过的删语气行 + 裸占位
        row = c.execute("SELECT body FROM system_prompt WHERE id=1").fetchone()
        if row:
            body = row["body"]
            if body in (_OLD_ZH_SYSTEM_WITH_TONE, _OLD_EN_SYSTEM):
                c.execute("UPDATE system_prompt SET body=? WHERE id=1", (_DEFAULT_SYSTEM,))
            elif "{语气}" in body:
                new = re.sub(r"^\s*语气：\{语气\}\s*\n", "", body, flags=re.MULTILINE)
                new = new.replace("{语气}", "")
                c.execute("UPDATE system_prompt SET body=? WHERE id=1", (new,))
        # generate_slots：默认值整体替换；用户改过的删语气行 + 裸占位
        rows = c.execute("SELECT slot, body FROM generate_slots").fetchall()
        # 旧默认（含 {语气}）→ 新默认 body
        old_with_tone = [b.replace("品牌：{品牌}\n语气：{语气}", "品牌：{品牌}") for b in _OLD_EN_SLOTS]
        for r in rows:
            slot, body = r["slot"], r["body"]
            if body in old_with_tone:
                idx = old_with_tone.index(body)
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (_DEFAULT_SLOTS[idx][2], slot))
            elif "{语气}" in body:
                new = re.sub(r"^\s*语气：\{语气\}\s*\n", "", body, flags=re.MULTILINE)
                new = new.replace("{语气}", "")
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (new, slot))


def _rename_constraint_to_prompt_var():
    """一次性迁移：把提示词里的 {X约束} 占位重命名为 {X提示词}（更通用）。

    覆盖 system_prompt 与 generate_slots。
    """
    with conn() as c:
        row = c.execute("SELECT body FROM system_prompt WHERE id=1").fetchone()
        if row and "约束}" in row["body"]:
            new = re.sub(r"\{([^{}]+)约束\}", r"{\1提示词}", row["body"])
            c.execute("UPDATE system_prompt SET body=? WHERE id=1", (new,))
        for r in c.execute("SELECT slot, body FROM generate_slots").fetchall():
            if "约束}" in r["body"]:
                new = re.sub(r"\{([^{}]+)约束\}", r"{\1提示词}", r["body"])
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (new, r["slot"]))


def _migrate_review_prompt():
    """一次性迁移：旧版综合审查 prompt（含 {candidates}）替换为三维度独立审核版。"""
    with conn() as c:
        row = c.execute("SELECT body FROM review_prompt WHERE id=1").fetchone()
        if row and row["body"] == _OLD_DEFAULT_REVIEW:
            c.execute("UPDATE review_prompt SET body=? WHERE id=1", (_DEFAULT_REVIEW,))


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


def _migrate_prompt_layering():
    """一次性迁移：把分层前的旧默认 system/slot 迁移到新版分层结构。

    - system_prompt：body == _OLD_PRE_LAYERING_SYSTEM → 替换为新 _DEFAULT_SYSTEM
    - generate_slots：每个 slot body 若等于 _OLD_PRE_LAYERING_SLOTS[idx] → 替换为新 _DEFAULT_SLOTS[idx]
    - 用户自定义（不等于旧默认）的保留不动
    幂等：已是新版则不匹配旧默认，跳过。
    """
    with conn() as c:
        row = c.execute("SELECT body FROM system_prompt WHERE id=1").fetchone()
        if row and row["body"] == _OLD_PRE_LAYERING_SYSTEM:
            c.execute("UPDATE system_prompt SET body=? WHERE id=1", (_DEFAULT_SYSTEM,))
        slots = c.execute("SELECT slot, body FROM generate_slots ORDER BY slot").fetchall()
        for r in slots:
            slot, body = r["slot"], r["body"]
            if 0 <= slot < len(_OLD_PRE_LAYERING_SLOTS) and body == _OLD_PRE_LAYERING_SLOTS[slot]:
                new_body = _DEFAULT_SLOTS[slot][1]
                c.execute("UPDATE generate_slots SET body=? WHERE slot=?", (new_body, slot))
