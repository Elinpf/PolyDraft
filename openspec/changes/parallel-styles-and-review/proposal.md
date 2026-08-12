## Why

单风格直通验证了链路，现在扩展为产品的核心形态：多风格并行生成 + 合并审查产出意见。这是流水线主干能力的补齐，让「输入→并行生成→审查→输出」真正成立。

## What Changes

- 扩展 `generate_slots` 为多槽位：每个槽位独立 prompt + temperature，对应一种风格。
- 流水线改为并行：对所有槽位 `asyncio.as_completed` 并发调用，逐份产出，失败容忍降级。
- 新增审查 prompt（`review_prompt` 单条）与审查阶段：候选拼成 `{candidates}` 喂审查 LLM，产出综合意见+每份简评，不替人选优。
- 新增 `/re-review` 端点：复用已有候选单独重跑审查，不重走生成。
- 生成内容留存扩展：`gen_records` 记录多候选 + review。
- 前端槽位管理页：增删改槽位（prompt + temperature）。
- 前端输出页扩展：多候选展示 + 审查意见块。

## Capabilities

### New Capabilities
- `review`: 审查阶段——全部候选喂审查 LLM 产出综合意见+每份简评，不替人选优，可单独重跑。

### Modified Capabilities
- `generation-api`: 生成从单条扩展为多槽位并行，失败容忍；`/generate` 返回多候选 + review。
- `generation-ui`: 输出页从单条展示扩展为多候选 + 审查意见块 + 槽位管理页。

## Impact

- 改 `backend/store.py`：多槽位存取、`review_prompt` 单例表。
- 改 `backend/pipeline.py`：并行生成 + 审查阶段 + re_review。
- 改 `backend/main.py`：slots/review 路由 + `/re-review`。
- 改前端生成/输出页：多候选切换、审查意见展示、槽位管理。
- `gen_records` 记录多候选与 review。
