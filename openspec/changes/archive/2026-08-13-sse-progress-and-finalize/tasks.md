# Tasks: SSE 进度 + 定稿交互

## 1. 后端 SSE

- [x] 1.1 `pipeline.py`：`run` 改 async generator，yield stage/gen_progress/done 事件
- [x] 1.2 `main.py`：`/generate` 返回 `StreamingResponse`，media_type `text/event-stream`
- [x] 1.3 事件 JSON 序列化为 `data: {...}\n\n`
- [x] 1.4 阶段事件写入 `operations`

## 2. 前端进度消费

- [x] 2.1 `/generate` 用 fetch + ReadableStream 解析 SSE（POST 不支持 EventSource）
- [x] 2.2 分阶段状态展示：生成中 N/M、审查中、完成/失败

## 3. 前端定稿交互

- [x] 3.1 候选单选切换 + 可编辑文本框
- [x] 3.2 [定稿] 按钮：前端标记「已定稿」，不调后端
- [x] 3.3 [复制] 按钮：复制文本框内容
- [x] 3.4 [重新审查] 按钮：调 `/re-review`，替换意见块
- [x] 3.5 [改输入]：回输入页

## 4. 验证

- [x] 4.1 触发生成，前端实时显示进度阶段
- [x] 4.2 编辑候选后定稿，刷新后丢失（确认前端态）
- [x] 4.3 复制可用
- [x] 4.4 重新审查只更新意见块
- [x] 4.5 全部失败时显示错误
