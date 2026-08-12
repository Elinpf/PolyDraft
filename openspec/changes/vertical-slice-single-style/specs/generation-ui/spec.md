## ADDED Requirements

### Requirement: 生成结果展示

前端 SHALL 在生成页展示 `/generate` 返回的单条文案，供用户阅读/复制。

#### Scenario: 展示生成结果
- **WHEN** `/generate` 成功返回文案
- **THEN** 生成页在结果区展示该文案文本
- **AND** 提供复制按钮

> 注：本 change 仅单条结果展示。多候选切换、编辑、定稿、审查意见在后续 change 引入。
