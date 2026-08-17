## ADDED Requirements

### Requirement: 生成候选携带渲染后的提示词

每个生成候选 SHALL 携带实际发给模型的 system + user 提示词（变量替换后），供排错查看。`provider.complete` SHALL 返回 `(text, messages)`，pipeline 从 messages 提取 system/user 塞入 candidate 的 `prompts` 字段。

#### Scenario: complete 返回 messages
- **WHEN** 调用 provider.complete
- **THEN** 返回 (text, messages) tuple
- **AND** messages 含 system + user 的实际 content（变量已替换）

#### Scenario: candidate 带 prompts 字段
- **WHEN** /generate SSE done 事件
- **THEN** 每个 candidate 含 prompts: {system: str, user: str}
- **AND** system 为渲染后的 system 提示词（无 system 配置时为空串）
- **AND** user 为渲染后的 user 提示词

#### Scenario: re_review 适配签名
- **WHEN** 调用 re_review
- **THEN** 正确解包 complete 返回的 tuple 取 text
- **AND** re_review 响应不含 prompts（仅生成环节暴露）

### Requirement: 候选卡可查看提示词

每个候选卡 SHALL 提供"查看提示词"折叠区，展开显示 system + user 两段（等宽字体），默认收起。

#### Scenario: 折叠区展示
- **WHEN** 候选卡渲染且有 prompts 字段
- **THEN** 显示"查看提示词"折叠入口
- **AND** 展开后分 system / user 两段，等宽字体显示
- **AND** system 为空时显示"(无)"

#### Scenario: 无 prompts 时隐藏
- **WHEN** 候选无 prompts 字段（如旧数据/重审后）
- **THEN** 不显示折叠入口

## MODIFIED Requirements

### Requirement: 生成流水线行为不变

生成/审核/定稿结果 SHALL 与重构前完全一致，仅多携带提示词字段。API 契约 `/generate` SSE done.candidates[] 新增 prompts 字段，`/re-review` 不变。

#### Scenario: 生成结果不变
- **WHEN** 运行生成流程
- **THEN** 候选文案、审核结果、定稿与重构前一致
- **AND** 仅多 prompts 字段
