# 技术栈选型 prototype

> Wayfinder ticket 01 的 prototype 资产。不是产品代码，是让人 react 的具体骨架。

## 选型结论

| 层 | 选型 | 理由 |
|----|------|------|
| 后端 | **Python + FastAPI** | Python 优先；FastAPI 自带 OpenAPI、async 原生，契合「并行模型调用」；非技术用户无关语言。 |
| LLM 调用 | **OpenAI SDK（`openai` 客户端直连）** | Kimi 与 vLLM 都是 OpenAI 兼容，只需切 `base_url`+`api_key`。**不引入 LangChain**——流水线只有 3 步、固定管线，编排库的认知税 > 收益。 |
| 模型接入抽象 | **自写薄 provider 层**（见 `backend/providers.py`） | 两个供应商 + 一个「测试连通性」动作，抽象成接口 + 两份配置即可。扩展新供应商 = 加一个配置项。 |
| 并发 | **`asyncio.gather`** | 同模型并发 N 份取优，async I/O 原生够用。不引入 Celery/RQ——本地部署无重负载。 |
| 存储 | **SQLite（标准库 `sqlite3`）** | 提示词、变量、生成结果落库；单机本地，无需 Postgres。用 SQLAlchemy 薄封装。 |
| 前端 | **React + Vite + TS** | 提示词可视化编辑、变量表单、连通性测试按钮需要前端框架；非技术用户友好。 |
| 前后端通信 | FastAPI REST + 静态托管前端 dist | 单进程部署，简单。 |

## 主要权衡（react 点）

1. **不引入 LLM 编排库**：流水线形状已固定（生成→审查→输出），抽象成 3 个函数比引入 LangChain 更轻、更好调试。如果你预期未来要复杂路由/工具调用，这里要重判。
2. **SQLite 而非内存态**：提示词和变量需要持久化（用户改了要存住），SQLite 零运维。如果你觉得结果不必落库，可砍掉。
3. **provider 抽象很薄**：不做「多供应商路由」，只做「同一接口、不同配置」。并行是同模型多份，不是跨供应商。

## 骨架文件

- `backend/providers.py` — 模型接入抽象 + Kimi/vLLM 配置 + 连通性测试
- `backend/pipeline.py` — 流水线三步编排（并行生成 → 审查 → 返回）
- `backend/main.py` — FastAPI 路由（配置、连通性测试、生成）
- `frontend/` — 前端占位（待 ticket 推进时落地）

## 运行（骨架不全，仅示意）

```bash
pip install fastapi openai
uvicorn backend.main:app
```
