# Design: 并行多风格 + 审查

## Context

Change 1 打通单风格直通。本 change 把生成扩展为多槽位并行 + 审查阶段，构成流水线主干。wayfinder 已定：每槽位独立 prompt+temperature（风格差异）、并行用 `asyncio.as_completed` 失败容忍、审查全部候选产出意见不替人选优、可单独重跑审查。

## Goals / Non-Goals

**Goals**
- 多槽位并行生成，每槽位独立 prompt/temperature。
- 审查阶段产出综合意见+每份简评。
- `/re-review` 单独重跑审查。
- 前端槽位管理 + 多候选展示 + 审查意见块。

**Non-Goals**
- 不做 SSE 流式进度（Change 3）。
- 不做定稿/编辑/复制交互（Change 3）。
- 不做变量系统（Change 4）。

## Decisions

### 1. 槽位即并行单元
N = 槽位数。每槽位各跑一次（不同 prompt/temperature → 风格差异），非同 prompt 跑 N 次取随机。这是 wayfinder 07 的核心澄清。

### 2. 失败容忍
`asyncio.as_completed` 收集，异常条目过滤，全部失败才整体报错。成功候选交审查。

### 3. 审查不替人选优
审查产出意见结构（综合意见 + 每份简评），不含「最佳」标记。选稿在前端由人完成。

### 4. re_review 复用候选
`/re-review` 接收已有候选 + 输入变量，只重跑审查，不重走生成。对应 wayfinder 03 的「可单独重审」。

### 5. store 结构
- `generate_slots`（slot/body/temperature）多行。
- `review_prompt` 单例（id=1）。

## Risks / Trade-offs

- [槽位多时并发压力] → 单机单人低并发，且 vLLM 本地并发能力未知（map fog「并发限流」），本 change 不做限流，后续视情况。
- [审查与生成同模型] → 已定（降低复杂度），若审查质量不足可后续允许审查用不同 provider（非本 change）。

## Open Questions

- 审查意见结构是否需固定 JSON schema（综合意见字段 + 简评数组）：本 change 先按自由文本，若前端解析困难再定结构。
