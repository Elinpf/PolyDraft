# Design: 审查流程改造（独立审核 + 三维度 + 全部定稿）

## Context

当前审查：全部候选拼成 `{candidates}` 一次调用 → 综合意见 → 选一份定稿。产品真实工作流：每份风格候选独立审核、独立保留、未过改后重审、最终全部定稿。审核维度需结构化为正向亲和/反向亲和/产品知识准确性 + 综合打分，由人判断是否通过。

依赖 Change B（`{产品知识}` 注入，审核产品知识准确性维度需参照）。

## Goals / Non-Goals

**Goals**
- 每份候选独立审核（N 次调用）。
- 三维度意见 + 综合打分，LLM 产出供人判断。
- 单份重审。
- 每份独立定稿、全部保留。
- finalized 表记录候选来源 + 审核意见 + 打分 + 定稿文本。

**Non-Goals**
- 自动通过/不通过判定（由人）。
- 审核意见的固定 JSON schema 强约束（本期用结构化文本，若解析困难再定）。
- 通俗化文案（Change D）。

## Decisions

### 1. 审查调用模型
从「一次 `{candidates}` 拼接」改为「每份独立调用」。审查 prompt 接收单份候选（`{candidate}`）+ `{产品知识}` 参照，产出三维度意见 + 打分。

审查 prompt 调整为：
```
请审核以下文案，从三个维度评估并给出综合打分：
- 正向亲和：…
- 反向亲和：…
- 产品知识准确性：…
产品知识参照：{产品知识}
文案：{candidate}
请输出：综合打分(0-100) + 三维度意见。
```

### 2. 审核结果结构
LLM 返回结构化文本。前端解析展示。本期不强求 JSON，若前端解析困难，下个迭代加 schema。审核结果字段：
```
{ score: int, positive: str, reverse: str, accuracy: str, raw: str }
```

### 3. SSE 事件结构
done 事件从 `{drafts, review}` 改为 `drafts` 各自带 `review` 结果：
```
done: { candidates: [ {text, review: {score,positive,reverse,accuracy}}, ... ] }
```
审查进度可加 `review_progress` 事件（N/M 审查中）。

### 4. 单份重审
`/re-review` 改为接收单份候选（text + 维度上下文），返回该份审核结果。不再接收 drafts 数组重审全部。

### 5. finalized 表调整
```
finalized:
  id, ts, provider, input_vars(JSON), selected_idx, text,  -- 既有
  score, positive, reverse, accuracy  -- 新增审核结果
```
一次生成 N 份定稿 = N 条记录。

## Risks / Trade-offs

- [审查调用从 1 次变 N 次，耗时与 token 增加] → 可并行审查（asyncio.gather），缓解耗时。
- [LLM 输出结构化不一致] → prompt 明确格式要求；前端容错解析；必要时下迭代加 JSON schema。
- [审核三维度与产品知识准确性需 `{产品知识}` 可用] → 依赖 Change B 注入；若产品知识为空，准确性维度降级。

## Open Questions
- 审查是否并行：倾向并行（asyncio.gather）加速。
- 打分是否强约束 0-100：倾向是，prompt 明确要求。
