## ADDED Requirements

### Requirement: 后端工程骨架

系统 SHALL 提供一个 FastAPI 后端工程骨架，含应用入口与启动时初始化逻辑，可独立启动。

#### Scenario: 启动后端
- **WHEN** 执行后端启动命令
- **THEN** FastAPI 应用启动并监听配置端口
- **AND** 启动时执行 SQLite 初始化（建库、建表，含日志表）

#### Scenario: 目录结构
- **WHEN** 查看后端目录
- **THEN** 存在应用入口文件、logging 配置、DB 初始化、中间件等模块文件
- **AND** 存在 `requirements.txt` 列出后端依赖

### Requirement: 前端工程骨架

系统 SHALL 提供一个 Vite + React + TypeScript 前端工程骨架，可独立启动开发服务器，但本 change 内不含任何功能页面。

#### Scenario: 启动前端开发服务器
- **WHEN** 执行前端开发命令
- **THEN** Vite 开发服务器启动并可访问
- **AND** 显示默认占位页面（无业务功能）

#### Scenario: 目录结构
- **WHEN** 查看前端目录
- **THEN** 存在 Vite 默认骨架文件与 `package.json`
