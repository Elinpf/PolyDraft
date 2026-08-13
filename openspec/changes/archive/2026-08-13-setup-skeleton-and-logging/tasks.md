# Tasks: 工程骨架与日志基础

## 1. 后端工程骨架

- [x] 1.1 创建 `backend/app.py`：FastAPI 实例 + startup 钩子（调用 init_db）
- [x] 1.2 创建 `backend/db.py`：连接器（contextmanager）+ `init_db()` 建日志三表
- [x] 1.3 创建 `requirements.txt`，列出 fastapi、uvicorn、openai 等依赖

## 2. 日志系统

- [x] 2.1 创建 `backend/logging_config.py`：`TimedRotatingFileHandler` 按天轮转，保留 7 天，目录 `./logs/`
- [x] 2.2 创建 `backend/log_store.py`：`operations`/`call_logs`/`gen_records` 三表的写入函数
- [x] 2.3 创建 `backend/middleware.py`：请求日志中间件，记录 method/path/耗时/status，写文件 + operations 表
- [x] 2.4 在 `app.py` 注册中间件并应用 logging 配置

## 3. 前端工程骨架

- [x] 3.1 用 `npm create vite` 初始化 React + TypeScript 项目于 `frontend/`
- [x] 3.2 验证前端开发服务器可独立启动并显示默认页面

## 4. 验证

- [x] 4.1 启动后端，确认日志表自动创建、`./logs/` 生成
- [x] 4.2 发一次请求，确认文件日志与 operations 表各有一条记录
- [x] 4.3 启动前端，确认开发服务器可访问
