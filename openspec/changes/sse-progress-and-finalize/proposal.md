## Why

并行生成与审查耗时较长，用户需要看到流水线实时进度而非空转等待；同时需要在前端对候选进行编辑、定稿、复制与重新审查。本 change 补齐流式进度与定稿交互，完成产品核心使用闭环。

## What Changes

- `/generate` 改为 SSE 流式响应，推送进度事件（stage: generating/reviewing、gen_progress、done）。
- 前端用 EventSource 消费进度，分阶段显示「生成中 N/M」「审查中」。
- 前端输出页补齐定稿交互：候选可编辑文本框、[定稿]、[复制]、[重新审查] 按钮。
- 定稿为前端态，不落库（保持既有边界）。
- 操作审计日志记录流水线各阶段事件。

## Capabilities

### New Capabilities
- `pipeline-progress`: SSE 流式进度——`/generate` 推送 stage/gen_progress/done 事件，前端 EventSource 消费分阶段展示。

### Modified Capabilities
- `generation-ui`: 输出页补齐候选编辑、定稿、复制、重新审查交互（Change 2 已有多候选展示）。

## Impact

- 改 `backend/pipeline.py`：`run` 改为 async generator yield 事件。
- 改 `backend/main.py`：`/generate` 返回 `text/event-stream`。
- 改前端输出页：EventSource 接入 + 编辑/定稿/复制/重审交互。
- operations 表记录阶段事件。
