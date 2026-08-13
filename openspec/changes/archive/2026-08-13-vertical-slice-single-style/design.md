# Design: 最窄垂直切片——单风格直通

## Context

在 Change 0 的工程骨架与日志基座上，打通第一条端到端链路：配置 provider → 测试连通 → 触发单风格生成 → 展示。wayfinder 已定接入用 OpenAI SDK 直连、Kimi/vLLM 共用客户端、key 明文存 SQLite、连通性测试发 max_tokens=1 探活。本 change 刻意砍掉并行、审查、SSE、变量系统，只验证最窄闭环。

## Goals / Non-Goals

**Goals**
- provider 配置可存可改可测连通。
- 单条生成 prompt（一个 generate 槽位）可跑通。
- `/generate` 同步返回单条文案。
- 前端配置页 + 生成页可用。
- 调用与生成落日志。

**Non-Goals**
- 不做多风格并行（Change 2）。
- 不做审查/re_review（Change 2）。
- 不做 SSE 进度（Change 3）。
- 不做变量系统与 {var} 校验（Change 4）。本 change 输入变量仅作为原样传递的字典，不做合并/校验。

## Decisions

### 1. 单槽位先行
`generate_slots` 表本 change 只放一条槽位。`/generate` 直接用该槽位跑一次。Change 2 才引入多槽位并行。这样数据模型一次到位（槽位结构不变），只先填一条。

### 2. 输入变量本 change 不合并
wayfinder 的 `merge_variables`（全局+输入）在 Change 4 才完整。本 change `/generate` 接收的 input_vars 直接当变量字典用于 prompt 渲染（用 `format_map` + `_SafeDict`，未定义变量留占位）。Change 4 再接 merge。

### 3. /generate 同步非 SSE
本 change 不引入 SSE（Change 3 才做）。同步请求等结果返回。链路验证优先于体验。

### 4. 前端两页：配置页 + 生成页
配置页管 provider，生成页触发与展示。路由用 React Router 或简单状态切换，本 change 选简单状态切换（无 Router 依赖）。

## Risks / Trade-offs

- [单槽位先跑、Change 2 改并行可能动 generate 逻辑] → pipeline 抽象预留，Change 1 的 generate 是 pipeline 的退化单步版，Change 2 扩成多槽位并行。
- [输入变量不合并] → 全局变量概念暂缺，prompt 里只能用本次传入的变量；Change 4 补齐。

## Open Questions

- 前端是否需要 Router：本 change 选不引入，若后续页面增多在 Change 2/3 再加。
