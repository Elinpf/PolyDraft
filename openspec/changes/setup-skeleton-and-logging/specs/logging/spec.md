## ADDED Requirements

### Requirement: 文件日志记录

系统 SHALL 通过 Python `logging` 将运行时日志写入文件，按天轮转，记录 API 调用链路与运行时事件。

#### Scenario: 应用启动时初始化日志
- **WHEN** 后端应用启动
- **THEN** logging 配置生效，日志文件在配置的目录下创建（不存在则创建）
- **AND** 日志按天轮转，保留最近 N 天（N 可配置）

#### Scenario: 运行时事件落文件
- **WHEN** 任何运行时事件发生（API 请求、模型调用、错误）
- **THEN** 该事件以结构化文本行写入当日日志文件，含时间戳、级别、事件描述

### Requirement: SQLite 结构化日志记录

系统 SHALL 在 SQLite 中维护三张结构化日志表，分别承载操作审计、调用链路、生成内容留存。

- `operations`：操作审计（谁、何时、触发了什么操作）
- `call_logs`：模型调用链路（provider、耗时、成功/失败、错误信息）
- `gen_records`：生成内容留存（每次 generate/re_review 的输入变量、候选列表、review 意见）

#### Scenario: 应用启动时建表
- **WHEN** 后端应用启动
- **THEN** 若三张日志表不存在则创建，schema 就绪

#### Scenario: 生成内容留存的边界
- **WHEN** 一次 generate 或 re_review 完成
- **THEN** 系统在 `gen_records` 记录该次输入变量、各候选内容、review 意见
- **AND** 用户的最终定稿选择与编辑内容 **不** 落库（定稿仅前端态）

### Requirement: API 请求日志中间件

系统 SHALL 通过一个中间件记录每次 API 请求的方法、路径、耗时、状态码，同时写入文件日志与 `operations` 表。

#### Scenario: 记录一次 API 调用
- **WHEN** 任一 HTTP 请求到达后端并返回响应
- **THEN** 该请求的 method、path、耗时(ms)、status code 写入文件日志
- **AND** 同样写入 `operations` 表（操作审计）

#### Scenario: 请求处理异常
- **WHEN** 请求处理过程中抛出未捕获异常
- **THEN** 中间件仍记录该请求与错误信息，状态码记为 500
- **AND** 不吞掉或掩盖异常栈
