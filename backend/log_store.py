"""三张日志表的写入函数 — Change 0。

供后续 change 调用：operations（审计）、call_logs（调用链路）、gen_records（生成留存）。
"""
import json
import logging
from datetime import datetime, timezone

from .db import conn

log = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- operations（操作审计）---

def log_operation(method: str, path: str, status: int, duration_ms: int, detail: str = ""):
    with conn() as c:
        c.execute(
            "INSERT INTO operations(ts, method, path, status, duration_ms, detail) VALUES (?,?,?,?,?,?)",
            (_now(), method, path, status, duration_ms, detail),
        )
    log.info("op %s %s %s %sms", method, path, status, duration_ms)


# --- call_logs（模型调用链路）---

def log_call(provider: str, success: bool, duration_ms: int, error: str = ""):
    with conn() as c:
        c.execute(
            "INSERT INTO call_logs(ts, provider, success, duration_ms, error) VALUES (?,?,?,?,?)",
            (_now(), provider, 1 if success else 0, duration_ms, error),
        )
    log.info("call provider=%s success=%s %sms%s", provider, success, duration_ms,
             f" err={error}" if error else "")


# --- gen_records（生成内容留存）---

def log_generation(kind: str, provider: str, input_vars: dict, drafts: list, review: str = ""):
    """生成内容留存。定稿选择不在此记录（定稿不落库）。"""
    with conn() as c:
        c.execute(
            "INSERT INTO gen_records(ts, kind, provider, input_vars, drafts, review) VALUES (?,?,?,?,?,?)",
            (_now(), kind, provider, json.dumps(input_vars, ensure_ascii=False),
             json.dumps(drafts, ensure_ascii=False), review),
        )
    log.info("gen_record kind=%s provider=%s drafts=%d", kind, provider, len(drafts))
