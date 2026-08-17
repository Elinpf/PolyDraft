## MODIFIED Requirements

### Requirement: 变量注入用可读 label

`selections_to_vars` SHALL 注入选项的 label（用户选的可读文本），而非 value。value 仅用于 `selection_value` 查产品知识库，不进入提示词。

#### Scenario: 产品系列注入 label
- **WHEN** 用户选产品系列"至熠"（label=至熠, value=A）
- **THEN** vars_ctx 中 {产品系列} = "至熠"
- **AND** 提示词渲染后出现"产品系列：至熠"而非"产品系列：A"

#### Scenario: label==value 时无影响
- **WHEN** 维度 label==value（如"朋友圈"）
- **THEN** 注入"朋友圈"，行为不变

#### Scenario: 产品知识仍按 value 查
- **WHEN** 查产品知识
- **THEN** selection_value 仍取 value（A）查 product_knowledge
- **AND** 知识内容正确返回

### Requirement: system prompt 清晰分层

system prompt SHALL 分层：人设 + 调性 + 产品知识（整段注入）+ 选取指引。去掉拼贴式变量组合指令。

#### Scenario: system 分层结构
- **WHEN** 渲染 system prompt
- **THEN** 含人设、调性、{产品知识}占位、选取指引（"根据文案类型和喂养场景选取相关卖点，不堆砌全部"）
- **AND** 不含拼贴式指令（如"结合选中的{喂养场景}中对应的{喂养场景提示词}..."）

#### Scenario: 产品知识整段注入
- **WHEN** 渲染 system
- **THEN** {产品知识} 替换为所选产品系列的完整知识文本
- **AND** 有明确指引让模型选取相关部分

### Requirement: slot body 带业务变量占位

每个风格槽位 body SHALL 含风格描述 + 业务变量占位（{产品系列}/{产品段位}/{文案类型}/{文案类型提示词}/{喂养场景}/{喂养场景提示词}/{品牌}）。

#### Scenario: slot body 含变量
- **WHEN** 渲染某个风格 slot
- **THEN** body 含风格描述 + 各业务变量占位
- **AND** 渲染后变量替换为实际值（如"产品系列：至熠"）

#### Scenario: 三版风格描述保留
- **WHEN** 迁移后
- **THEN** 官方版/亲切版/闺蜜版风格描述保留各自特色
- **AND** 三版都带相同的业务变量占位

### Requirement: 一次性迁移旧 prompt

init_store SHALL 一次性迁移仍是旧默认的 system/slot 到新版分层结构。用户自定义的 prompt 保留不动。

#### Scenario: 旧默认 system 迁移
- **WHEN** system_prompt.body 等于旧默认值
- **THEN** 替换为新版分层 system

#### Scenario: 用户自定义 system 保留
- **WHEN** system_prompt.body 不等于旧默认（用户改过）
- **THEN** 不迁移，保留用户内容

#### Scenario: 旧默认 slot 迁移
- **WHEN** 某 slot body 等于旧默认
- **THEN** 替换为新版带变量占位 slot

#### Scenario: 迁移幂等
- **WHEN** 重复执行迁移
- **THEN** 已迁移的不重复替换（已是新版则跳过）
