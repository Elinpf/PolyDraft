## ADDED Requirements

### Requirement: Provider 配置持久化

系统 SHALL 将 LLM provider 配置（name、base_url、api_key、model）持久化到 SQLite `providers` 表。本地单机单人场景下 API key 明文存储。

#### Scenario: 保存 provider 配置
- **WHEN** 用户提交一份 provider 配置
- **THEN** 系统写入或更新 `providers` 表对应记录
- **AND** name 作为主键，重复提交则更新

#### Scenario: 应用启动写入默认占位
- **WHEN** 后端启动且 `providers` 表无 kimi/vllm 记录
- **THEN** 写入 kimi 与 vllm 两条默认占位配置（key 为空，待用户填写）

### Requirement: OpenAI 兼容客户端接入

系统 SHALL 通过 OpenAI SDK 直连 provider，Kimi 与 vLLM 共用同一客户端，仅 base_url 与 api_key 不同。不引入 LangChain 等编排库。

#### Scenario: 调用生成
- **WHEN** 系统用某 provider 配置发起一次 chat completion
- **THEN** 请求发往该 provider 的 base_url，使用其 api_key 与 model
- **AND** 返回生成文本

#### Scenario: Kimi 与 vLLM 配置差异
- **WHEN** 查看 kimi 与 vllm 默认配置
- **THEN** kimi 的 base_url 指向 moonshot，vllm 指向本地实例（如 `http://localhost:8000/v1`）
- **AND** vllm 的 api_key 常为占位（如 `EMPTY`）

### Requirement: 连通性测试

系统 SHALL 提供连通性测试能力，发一个 `max_tokens=1` 的最小请求探活。

#### Scenario: 测试连通性成功
- **WHEN** 用户对某 provider 触发测试
- **THEN** 系统发最小请求，成功返回 ok=true
- **AND** 该次调用写入 `call_logs`

#### Scenario: 测试连通性失败
- **WHEN** provider 不可达或 key 无效
- **THEN** 返回 ok=false，不抛异常给调用方
- **AND** 失败信息写入 `call_logs`

### Requirement: Provider 调用日志

系统 SHALL 在每次 provider 调用时写入 `call_logs` 表，记录 provider 名、耗时、成功/失败、错误信息。

#### Scenario: 记录一次成功调用
- **WHEN** 一次 provider 调用成功返回
- **THEN** `call_logs` 写入一条记录，含 provider、耗时、success=true

#### Scenario: 记录一次失败调用
- **WHEN** 一次 provider 调用抛异常
- **THEN** `call_logs` 写入一条记录，含错误信息、success=false
