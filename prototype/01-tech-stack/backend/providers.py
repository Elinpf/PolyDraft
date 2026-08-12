"""模型接入抽象层 + 配置持久化 — ticket 02 落地。

关键决策：
- Kimi 与 vLLM 均 OpenAI 兼容，接入层 = 一份配置(ProviderConfig) + 一个 AsyncOpenAI 客户端。
- API key 明文存 SQLite（本地单机单人使用，文件权限保护即可，加密徒增复杂度）。
- 连通性测试：发 max_tokens=1 的最小请求探活。
- 扩展新供应商 = 加一条 ProviderConfig 记录，无代码改动（只要 OpenAI 兼容）。
"""
import sqlite3
from dataclasses import dataclass, asdict
from contextlib import contextmanager
from openai import AsyncOpenAI


SCHEMA = """
CREATE TABLE IF NOT EXISTS providers (
    name      TEXT PRIMARY KEY,
    base_url  TEXT NOT NULL,
    api_key   TEXT NOT NULL,
    model     TEXT NOT NULL
);
"""


@dataclass
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    model: str


# 首次启动写入的默认占位配置 —— 用户在 WebUI 改成自己的 key/model
_DEFAULTS = [
    ProviderConfig("kimi", "https://api.moonshot.cn/v1", "", "moonshot-v1-8k"),
    ProviderConfig("vllm", "http://localhost:8000/v1", "EMPTY", ""),
]


@contextmanager
def _conn(db_path="copygen.db"):
    c = sqlite3.connect(db_path)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db(db_path="copygen.db"):
    with _conn(db_path) as c:
        c.executescript(SCHEMA)
        for cfg in _DEFAULTS:
            c.execute(
                "INSERT OR IGNORE INTO providers(name, base_url, api_key, model) VALUES (?,?,?,?)",
                (cfg.name, cfg.base_url, cfg.api_key, cfg.model),
            )


def save_provider(cfg: ProviderConfig, db_path="copygen.db"):
    """新增或更新一条供应商配置。"""
    with _conn(db_path) as c:
        c.execute(
            "INSERT INTO providers(name, base_url, api_key, model) VALUES (?,?,?,?) "
            "ON CONFLICT(name) DO UPDATE SET base_url=excluded.base_url, "
            "api_key=excluded.api_key, model=excluded.model",
            (cfg.name, cfg.base_url, cfg.api_key, cfg.model),
        )


def list_providers(db_path="copygen.db") -> list[ProviderConfig]:
    with _conn(db_path) as c:
        rows = c.execute("SELECT * FROM providers").fetchall()
        return [ProviderConfig(**dict(r)) for r in rows]


def get_provider(name: str, db_path="copygen.db") -> ProviderConfig | None:
    with _conn(db_path) as c:
        row = c.execute("SELECT * FROM providers WHERE name=?", (name,)).fetchone()
        return ProviderConfig(**dict(row)) if row else None


class LLMProvider:
    """同一 OpenAI 兼容客户端，按配置切换 base_url/key/model。"""

    def __init__(self, cfg: ProviderConfig):
        self.cfg = cfg
        self.client = AsyncOpenAI(base_url=cfg.base_url, api_key=cfg.api_key)

    async def complete(self, prompt: str, variables: dict, temperature: float = 0.7) -> str:
        rendered = _render(prompt, variables)
        resp = await self.client.chat.completions.create(
            model=self.cfg.model,
            messages=[{"role": "user", "content": rendered}],
            temperature=temperature,
        )
        return resp.choices[0].message.content

    async def ping(self) -> bool:
        """连通性测试：最小请求探活。vLLM 本地免费，Kimi 极少 token。"""
        try:
            await self.client.chat.completions.create(
                model=self.cfg.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True
        except Exception:
            return False


def _render(template: str, variables: dict) -> str:
    try:
        return template.format_map(_SafeDict(variables))
    except Exception:
        return template


class _SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"
