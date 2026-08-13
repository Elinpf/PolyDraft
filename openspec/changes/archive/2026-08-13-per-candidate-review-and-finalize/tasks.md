# Tasks: 审查流程改造（独立审核 + 三维度 + 全部定稿）

## 1. 后端审查逻辑

- [x] 1.1 `pipeline.py`：审查从一次综合改为每份独立（N 次调用，并行 gather/as_completed）
- [x] 1.2 审查 prompt 改为单份输入 `{candidate}` + `{产品知识}` 参照，要求输出综合打分+三维度
- [x] 1.3 默认 review_prompt 更新为三维度结构化要求（含旧 prompt 一次性迁移）

## 2. 后端审核结果结构

- [x] 2.1 定义审核结果结构（score/positive/reverse/accuracy/raw）— ReviewResult dataclass + to_dict
- [x] 2.2 LLM 返回文本的容错解析（_parse_review 按标签前缀解析，失败降级 raw）

## 3. 后端 SSE 与路由

- [x] 3.1 done 事件改为 candidates 各自带 review 结果（{text, review:{...}}）
- [x] 3.2 加 review_progress 事件（审查 N/M）
- [x] 3.3 `/re-review` 改为单份（接收 text + selections + 上下文，返回该份审核）

## 4. 后端定稿表

- [x] 4.1 `finalized` 表加 score/positive/reverse/accuracy 字段（含旧表迁移 _ensure_finalized_review_columns）
- [x] 4.2 `save_finalized` 接收审核结果
- [x] 4.3 一次生成 N 份定稿 = N 条记录（每份独立调 /finalized）

## 5. 前端输出页改造

- [x] 5.1 每份候选卡片展示审核状态/打分/三维度意见
- [x] 5.2 每份独立「定稿」按钮，各自保留
- [x] 5.3 每份「重新审核」按钮（单份重审）
- [x] 5.4 候选可编辑后重审（重审发送 edited 文本）

## 6. 验证

- [x] 6.1 三份候选各自获得独立审核结果（打分+三维度）— done 事件 candidates 结构验证通过；_parse_review 单测通过
- [x] 6.2 每份可独立定稿，全部保留到历史 — /finalized 接收 score/三维度，历史页展示
- [x] 6.3 单份重审只更新该份审核，其他不变 — /re-review 单份返回 review
- [x] 6.4 审查进度 N/M 展示 — review_progress 事件
- [x] 6.5 历史页每条定稿含审核结果 — HistoryItem 新字段 + 审核结果折叠区
