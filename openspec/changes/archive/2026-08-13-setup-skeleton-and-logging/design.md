# Design: 工程骨架与日志基础

## Context

本项目是面向公司内部非技术内容人员的文案生成流水线 WebUI 产品，本地部署、单机单人。在功能 change 开始前需要一个可承载的工程骨架，且日志作为横切关注点需从基座就绪，避免后续回补侵入。已通过 wayfinder 确定技术栈：后端 Python + FastAPI，前端 React + Vite + TS，存储 SQLite，模型调用 OpenAI SDK 直连（不引入 LangChain）。

## Goals / Non-Goals

**Goals**
- 后端可独立启动，启动时初始化 DB（含日志表）。
- 前端可独立启动开发服务器。
- 日志双写就绪：文件（轮转）+ SQLite 三张结构化表。
- API 请求 logging 中间件生效。

**Non-Goals**
- 不实现任何业务功能（provider/流水线/变量/提示词等）。
- 不做前端功能页面，仅默认骨架。
- 不做日志的统计/查询页面（那是日后延伸）。

## Decisions

### 1. 日志双写：文件 + SQLite
文件管「实时可读的链路」（排错用），SQLite 管「结构化可查的记录」（统计/回看用）。
- **备选**：仅文件 → 丢失结构化查询能力；仅 SQLite → 实时排错不直观。双写兼顾。
- 文件用 Python 标准 `logging` + `TimedRotatingFileHandler`（按天轮转，保留 7 天）。

### 2. 三张日志表职责划分
- `operations`：操作审计（谁/何时/做了什么），由 API 中间件写入。
- `call_logs`：模型调用链路（provider/耗时/成败/错误），由后续 provider 层写入（本 change 仅建表 + 提供写入函数）。
- `gen_records`：生成内容留存（输入变量+候选+review），由后续 pipeline 写入（本 change 仅建表 + 写入函数）。

### 3. 生成记录留存 vs 定稿不落库
边界：`gen_records` 留「生成过程产物」（输入/候选/review），但用户最终定稿的选择与编辑**不**持久化。满足「追踪提示词效果」又不违背 map 的「定稿不落库」决策。

### 4. 连接器复用
后续 change 的业务表与日志表共用同一 SQLite 文件，但连接逻辑在本 change 的 DB 模块集中提供，避免各模块各自 `sqlite3.connect`。

### 5. 工程结构
```
backend/
├── app.py            # FastAPI 实例 + 启动钩子
├── logging_config.py # logging 配置 + 轮转
├── db.py             # 连接器 + init_db（建日志表）
├── middleware.py     # 请求日志中间件
└── log_store.py      # 三张表的写入函数
frontend/             # Vite 默认骨架（npm create vite）
requirements.txt
```

## Risks / Trade-offs

- [三张表 schema 一旦定义即被后续 change 依赖] → 在本 change 稳定 schema，后续只读不轻易改；如需改走新 change。
- [双写带来轻微性能开销] → 本地单机低并发，可接受；文件日志用缓冲。
- [中间件异常吞栈] → 中间件捕获仅用于记录，重新抛出，不掩盖。

## Open Questions

- 日志文件目录位置：默认 `./logs/`，保留天数默认 7——可在配置里改，非阻塞。
