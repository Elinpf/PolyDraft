## ADDED Requirements

### Requirement: SSE 流式进度

系统 SHALL 将 `/generate` 改为 SSE 流式响应，逐步推送进度事件，前端用 EventSource 消费。

#### Scenario: 推送生成进度
- **WHEN** 生成阶段进行中
- **THEN** 系统推送 `{"type":"stage","stage":"generating"}` 与 `{"type":"gen_progress","done":N,"total":M}` 事件
- **AND** 每完成一份候选推送一次进度

#### Scenario: 推送审查阶段与完成
- **WHEN** 生成完成进入审查
- **THEN** 推送 `{"type":"stage","stage":"reviewing"}`
- **AND** 审查完成后推送 `{"type":"done","drafts":[...],"review":"..."}`

#### Scenario: 全部失败的完成事件
- **WHEN** 所有槽位生成失败
- **THEN** 推送 `{"type":"done","error":"all generations failed"}` 并结束流

### Requirement: 进度事件操作审计

系统 SHALL 将流水线各阶段事件（开始生成、进入审查、完成/失败）写入 `operations` 表作为操作审计。

#### Scenario: 记录阶段事件
- **WHEN** 流水线进入一个新阶段
- **THEN** `operations` 表写入一条该阶段事件记录
