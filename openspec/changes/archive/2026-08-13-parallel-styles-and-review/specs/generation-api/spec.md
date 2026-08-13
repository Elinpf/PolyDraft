## MODIFIED Requirements

### Requirement: 单风格同步生成

系统 SHALL 提供 `/generate` API，触发多风格并行生成（每个槽位独立 prompt + temperature），失败容忍降级，并执行审查阶段，返回多份候选与审查意见。

#### Scenario: 触发并行生成
- **WHEN** 客户端 POST `/generate`，带输入变量与选定的 provider
- **THEN** 系统对所有 generate 槽位并发调用（每槽位各自的 prompt 与 temperature）
- **AND** 返回各候选文案 + 审查意见

#### Scenario: 失败容忍
- **WHEN** 部分槽位生成失败
- **THEN** 成功的候选仍交审查，失败的被过滤
- **AND** 全部失败时返回错误

#### Scenario: provider 未配置
- **WHEN** 请求指定的 provider 在 `providers` 表不存在
- **THEN** 返回 400 错误，提示 provider 未配置

### Requirement: 生成内容留存

系统 SHALL 在每次 `/generate` 完成后向 `gen_records` 写入记录，含输入变量、多份候选、审查意见。定稿选择不落库。

#### Scenario: 生成成功后留存
- **WHEN** 一次生成成功完成
- **THEN** `gen_records` 写入输入变量、各候选文案、审查意见
- **AND** 不记录任何定稿信息（定稿为前端态）
