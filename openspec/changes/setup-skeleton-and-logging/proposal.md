## Why

文案生成流水线产品需要先建立可运行的后端/前端工程骨架，并从第一个 change 起就埋好日志能力，避免后续模块完成后回补日志要侵入所有代码。本 change 搭建项目脚手架与横切的日志基础设施，作为后续所有功能 change 的承载基座。

## What Changes

- 新建后端工程：FastAPI 应用结构、应用入口、启动时 SQLite 初始化。
- 新建前端工程：Vite + React + TypeScript 项目结构（仅骨架，无功能页面）。
- 建立日志系统，双写：
  - 文件日志：Python `logging`，按天轮转，记录 API 调用链路与运行时事件。
  - SQLite 结构化记录：三张日志表（操作审计 `operations`、调用链路 `call_logs`、生成内容留存 `gen_records`）。
- 新建一个 logging 中间件，记录每次 API 请求的方法、路径、耗时、状态码。
- 建立项目依赖清单（`requirements.txt` / 前端 `package.json`）。

## Capabilities

### New Capabilities
- `logging`: 横切日志基础设施——文件日志 + SQLite 结构化记录表，覆盖操作审计、调用链路、生成内容留存四类用途；含 API 请求 logging 中间件。
- `project-skeleton`: 后端 FastAPI 与前端 Vite/React 工程的目录结构与启动入口。

### Modified Capabilities
<!-- 无，首个 change -->

## Impact

- 新增后端目录与文件（`backend/`）：app 入口、logging 配置、DB 初始化、中间件。
- 新增前端目录（`frontend/`）：Vite 默认骨架。
- 新增依赖清单与运行说明。
- 不涉及任何业务功能（provider/流水线/变量等在后续 change）。
- 日志表 schema 一旦定义即被后续 change 的代码依赖，需在本 change 稳定。
