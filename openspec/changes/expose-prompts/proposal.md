## Why

生成后排错时无法看到每个候选实际发给模型的提示词——`provider.complete` 内部渲染了 system + user messages 但只返回模型文本，pipeline 的 `done` 事件只给 `{text, style, review}`，没有提示词。提示词模板含变量替换，排错（为什么这版文案跑偏、变量是否注入对、哪个槽位 prompt 有问题）必须看渲染后的实际 messages，而非模板原文。

## What Changes

- **`provider.complete` 多返回渲染后的 messages**：返回值从 `str` 改为 `(text, messages)`，messages 含 system + user 的实际 content。渲染逻辑仍在 complete 内（单一真相源，不重复渲染）。
- **pipeline 收集 messages 塞进 candidate**：`done` 事件的每个 candidate 加 `prompts: {system: str, user: str}` 字段（从 messages 提取）。
- **re_review 同步改**：complete 签名变，re_review 调用处适配（但 re_review 不返回提示词，仅适配签名）。
- **前端 candidate 类型加 prompts**：`Candidate.prompts?: {system: string, user: string}`，从 SSE done 事件接收。
- **候选卡加"查看提示词"折叠区**：点开显示 system / user 两段（等宽字体），默认收起，排错时展开。
- **不做**：审核环节提示词暴露（Q3 选 A，只给生成）；提示词编辑（本期只读，用于排错）。

## Capabilities

### New Capabilities
- `prompt-inspection`: 生成后每个候选可查看实际渲染的 system + user 提示词，用于排错。

### Modified Capabilities
- `generation-pipeline`: complete 返回渲染后 messages，candidate 带 prompts 字段，行为不变。

## Impact

- `backend/providers.py`：`LLMProvider.complete` 返回 `(str, list[message])`，提取渲染逻辑为可复用
- `backend/pipeline.py`：`_run_one` 收集 messages，candidate 组装加 prompts；`re_review` 适配新签名
- `frontend/src/types.ts`：Candidate 加 `prompts?` 字段
- `frontend/src/logic/useGenerateLogic.ts`：done 事件映射时透传 prompts
- `frontend/src/views/{classic,brand}/GenerateView.tsx`：候选卡加提示词折叠区
- API 契约：`/generate` SSE done.candidates[].prompts 新增字段；`/re-review` 不变
- 行为不变：生成/审核/定稿结果不变，仅多携带提示词
