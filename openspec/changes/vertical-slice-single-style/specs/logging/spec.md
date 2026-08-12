## MODIFIED Requirements

### Requirement: SQLite 结构化日志记录

系统 SHALL 在 SQLite 中维护三张结构化日志表，分别承载操作审计、调用链路、生成内容留存。本 change 起，`call_logs` 与 `gen_records` 由 provider 调用与生成流程实际写入（Change 0 仅建表与提供写入函数）。

- `operations`：操作审计（谁、何时、触发了什么操作）
- `call_logs`：模型调用链路（provider、耗时、成功/失败、错误信息）
- `gen_records`：生成内容留存（每次 generate 的输入变量、候选列表、review 意见）

#### Scenario: 应用启动时建表
- **WHEN** 后端应用启动
- **THEN** 若三张日志表不存在则创建，schema 就绪

#### Scenario: provider 调用写入 call_logs
- **WHEN** 一次 provider 调用完成（成功或失败）
- **THEN** `call_logs` 写入一条记录，含 provider 名、耗时、成功/失败、错误信息

#### Scenario: 生成完成写入 gen_records
- **WHEN** 一次 generate 完成
- **THEN** `gen_records` 写入输入变量与生成结果

#### Scenario: 生成内容留存的边界
- **WHEN** 一次 generate 完成
- **THEN** 系统在 `gen_records` 记录该次输入变量与生成结果
- **AND** 用户的最终定稿选择与编辑内容 **不** 落库（定稿仅前端态）
