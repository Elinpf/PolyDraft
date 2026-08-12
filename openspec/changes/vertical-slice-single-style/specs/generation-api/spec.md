## ADDED Requirements

### Requirement: 单风格同步生成

系统 SHALL 提供 `/generate` API，同步触发一次单风格生成（无并行、无审查、无 SSE），返回生成的单条文案。

#### Scenario: 触发生成
- **WHEN** 客户端 POST `/generate`，带输入变量与选定的 provider
- **THEN** 系统用该 provider 调用 `generate_slots` 中对应槽位的 prompt
- **AND** 同步返回生成的文案文本

#### Scenario: provider 未配置
- **WHEN** 请求指定的 provider 在 `providers` 表不存在
- **THEN** 返回 400 错误，提示 provider 未配置

### Requirement: 生成内容留存

系统 SHALL 在每次 `/generate` 完成后向 `gen_records` 写入记录，含输入变量与生成结果。定稿选择不落库。

#### Scenario: 生成成功后留存
- **WHEN** 一次生成成功完成
- **THEN** `gen_records` 写入输入变量与生成文案
- **AND** 不记录任何定稿信息（定稿为前端态，后续 change 引入）
