# Design: SSE 进度 + 定稿交互

## Context

Change 2 完成多候选与审查，但 `/generate` 仍是同步请求、输出页无编辑/定稿/重审交互。本 change 引入 SSE 流式进度与定稿闭环。wayfinder 已定 SSE（选项 B）、定稿不落库、候选单选切换+单文本框、重新审查单独重跑。

## Goals / Non-Goals

**Goals**
- `/generate` SSE 推送 stage/gen_progress/done。
- 前端 EventSource 消费，分阶段展示。
- 输出页：候选编辑、定稿、复制、重新审查、改输入。
- 阶段事件写 operations。

**Non-Goals**
- 不做变量系统（Change 4）。
- 不做结果落库（定稿保持前端态）。

## Decisions

### 1. SSE 实现
`/generate` 返回 `StreamingResponse(media_type="text/event-stream")`，pipeline 的 `run` 改为 async generator yield 事件 dict，路由序列化为 `data: {...}\n\n`。前端用浏览器原生 `EventSource` 或 fetch 流读。

### 2. 进度事件协议
固定事件类型：`stage`（generating/reviewing）、`gen_progress`（done/total）、`done`（drafts+review 或 error）。JSON 字段稳定。

### 3. 定稿纯前端态
`selectedIdx`/`editedText`/`finalized` 仅前端 state，刷新即丢。后端不知「定稿」一事。符合「定稿不落库」边界。

### 4. 重新审查走既有 `/re-review`
Change 2 已建 `/re-review`，本 change 只接通前端按钮。

## Risks / Trade-offs

- [SSE 连接中断时部分结果丢失] → done 事件未到则前端显示生成中，可加重试；本地低断连风险，本 change 不做断点续传。
- [EventSource 不支持 POST] → `/generate` 用 POST，前端用 fetch + ReadableStream 读 SSE，而非原生 EventSource（EventSource 仅 GET）。

## Open Questions

- 进度事件是否需要序列号/游标以便重连：本地单机、低断连，本 change 不做。
