"""模型接入层 — Change 1（model-integration）。

Kimi 与 vLLM 均 OpenAI 兼容，接入层 = 一份配置 + 一个 AsyncOpenAI 客户端。
provider 配置明文存 SQLite（单机单人）。连通性测试发 max_tokens=1 探活。
调用写入 call_logs。
"""
import time
import logging
import os
from dataclasses import dataclass
from openai import AsyncOpenAI

from .db import conn
from .log_store import log_call

log = logging.getLogger(__name__)

# 本地部署场景下，本机可能设了 http(s)_proxy（如 Clash 7890），会把到内网/直连模型
# 端点的请求劫持进代理导致超时或丢路径。模型调用一律不走代理 —— 在模块加载时清掉代理
# 环境变量，让 AsyncOpenAI 的 httpx 直连。
for _k in ("http_proxy", "https_proxy", "all_proxy",
           "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"):
    os.environ.pop(_k, None)


SCHEMA = """
CREATE TABLE IF NOT EXISTS providers (
    name      TEXT PRIMARY KEY,
    base_url  TEXT NOT NULL,
    api_key   TEXT NOT NULL,
    model     TEXT NOT NULL
);
"""

_DEFAULTS = [
    ("kimi", "https://api.kimi.com/coding/v1", "", "kimi-for-coding"),
    ("custom", "http://localhost:8000/v1", "EMPTY", ""),
]

# 一次性重命名：旧默认 vllm provider 改名为 custom（name 是主键，INSERT OR IGNORE 不会更新已存行）
_PROVIDER_RENAMES = {"vllm": "custom"}


def _rename_legacy_providers():
    """把旧的默认 vllm 行重命名为 custom；若 custom 已存在则跳过。"""
    with conn() as c:
        for old, new in _PROVIDER_RENAMES.items():
            old_row = c.execute("SELECT base_url, api_key, model FROM providers WHERE name=?", (old,)).fetchone()
            if not old_row:
                continue
            new_row = c.execute("SELECT name FROM providers WHERE name=?", (new,)).fetchone()
            if new_row:
                # custom 已存在，仅删除旧 vllm 避免重复
                c.execute("DELETE FROM providers WHERE name=?", (old,))
            else:
                c.execute(
                    "UPDATE providers SET name=? WHERE name=?",
                    (new, old),
                )


@dataclass
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    model: str


def init_providers(db_path=None):
    with conn(db_path) as c:
        c.executescript(SCHEMA)
        for name, base_url, api_key, model in _DEFAULTS:
            c.execute(
                "INSERT OR IGNORE INTO providers(name, base_url, api_key, model) VALUES (?,?,?,?)",
                (name, base_url, api_key, model),
            )
    # 旧库迁移：默认 vllm 改名为 custom
    _rename_legacy_providers()


def list_providers() -> list[ProviderConfig]:
    with conn() as c:
        rows = c.execute("SELECT * FROM providers ORDER BY name").fetchall()
        return [ProviderConfig(**dict(r)) for r in rows]


def get_provider(name: str) -> ProviderConfig | None:
    with conn() as c:
        row = c.execute("SELECT * FROM providers WHERE name=?", (name,)).fetchone()
        return ProviderConfig(**dict(row)) if row else None


def save_provider(cfg: ProviderConfig):
    with conn() as c:
        c.execute(
            "INSERT INTO providers(name, base_url, api_key, model) VALUES (?,?,?,?) "
            "ON CONFLICT(name) DO UPDATE SET base_url=excluded.base_url, "
            "api_key=excluded.api_key, model=excluded.model",
            (cfg.name, cfg.base_url, cfg.api_key, cfg.model),
        )


class LLMProvider:
    def __init__(self, cfg: ProviderConfig):
        self.cfg = cfg
        # 空 key 时用占位，避免构造崩溃；真实调用会失败并记 call_logs
        key = cfg.api_key or "EMPTY"
        # 代理已在模块加载时清掉（见文件顶部），这里直连模型端点
        self.client = AsyncOpenAI(base_url=cfg.base_url, api_key=key)

    async def complete(self, prompt: str, variables: dict, temperature: float = 0.7, system: str | None = None) -> str:
        rendered = _render(prompt, variables)
        messages = []
        if system:
            messages.append({"role": "system", "content": _render(system, variables)})
        messages.append({"role": "user", "content": rendered})
        start = time.perf_counter()
        try:
            resp = await self.client.chat.completions.create(
                model=self.cfg.model,
                messages=messages,
                temperature=temperature,
            )
            log_call(self.cfg.name, True, int((time.perf_counter() - start) * 1000))
            return resp.choices[0].message.content
        except Exception as e:
            log_call(self.cfg.name, False, int((time.perf_counter() - start) * 1000), str(e))
            raise

    async def ping(self) -> bool:
        start = time.perf_counter()
        try:
            await self.client.chat.completions.create(
                model=self.cfg.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            log_call(self.cfg.name, True, int((time.perf_counter() - start) * 1000))
            return True
        except Exception as e:
            log_call(self.cfg.name, False, int((time.perf_counter() - start) * 1000), str(e))
            return False


def _render(template: str, variables: dict) -> str:
    try:
        return template.format_map(_SafeDict(variables))
    except Exception:
        return template


class _SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"
