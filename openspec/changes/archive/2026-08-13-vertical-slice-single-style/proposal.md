## Why

需要让产品第一次能端到端跑通：用户配置一个 LLM provider 的 API key、测试连通性、触发一次单风格生成并看到结果。这是验证整条技术链路（接入→调用→返回→展示）的最小可用闭环，为后续并行/审查/SSE 等增量提供可验证基础。

## What Changes

- 新增 provider 接入层：`ProviderConfig` + `LLMProvider`，Kimi 与 vLLM 共用 OpenAI 兼容客户端，仅配置不同。
- 新增 provider 持久化：`providers` 表存配置（API key 明文，单机单人）。
- 新增「测试连通性」能力：发 `max_tokens=1` 最小请求探活。
- 新增单条生成 prompt：`review_prompt` 暂不引入，仅 `generate_slots` 表先放一条槽位（单风格直通）。
- 新增生成 API：`/generate` 同步返回单条结果（本 change 不并行、不审查、不 SSE）。
- 新增前端：API key 配置页（填表 + 测试按钮）、生成页（输入 + 触发 + 显示单条结果）。
- 接入日志：provider 调用写入 `call_logs`，生成写入 `gen_records`。

## Capabilities

### New Capabilities
- `model-integration`: LLM provider 接入抽象——Kimi/vLLM 共用 OpenAI 兼容客户端，配置持久化，连通性测试，调用记录日志。
- `generation-api`: 单风格同步生成 API（`/generate`），无并行无审查，结果与日志落库。
- `provider-config-ui`: 前端 API key 配置页与连通性测试交互。
- `generation-ui`: 前端生成页——输入触发、显示单条结果。

### Modified Capabilities
- `logging`: provider 调用与生成开始实际写入 `call_logs`、`gen_records`（基座表已在 Change 0 建立）。

## Impact

- 新增 `backend/providers.py`、`backend/store.py`（slots 部分）、`backend/main.py` 路由。
- 新增前端配置页与生成页组件。
- 依赖 Change 0 的日志表与 DB 连接器。
- vLLM 与 Kimi 一并接入（同为 OpenAI 兼容，无额外工作量）。
