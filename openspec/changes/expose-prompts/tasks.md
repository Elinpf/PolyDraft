## 1. 后端 complete 返回 messages

- [x] 1.1 `backend/providers.py`：`LLMProvider.complete` 返回 `(str, list[dict])`，把内部渲染的 messages 返回（不再丢弃）
- [x] 1.2 确认 `log_call` 仍收 messages（原本就有，不受影响）

## 2. pipeline 收集 prompts

- [x] 2.1 `_run_one` 返回值加 messages：`(idx, slot, style, text, messages, err)`
- [x] 2.2 candidate 组装时从 messages 提取 system/user 塞入 `prompts` 字段
- [x] 2.3 `re_review` 适配新签名：解包 `(text, messages)` 取 text，不返回 prompts

## 3. 前端类型与逻辑

- [x] 3.1 `frontend/src/types.ts`：Candidate 加 `prompts?: { system: string; user: string }`
- [x] 3.2 `logic/useGenerateLogic.ts`：done 事件映射 candidate 时透传 prompts

## 4. 前端折叠区视图

- [x] 4.1 `views/classic/GenerateView.tsx`：候选卡加 `<details>` 折叠区，有 prompts 时显示，system/user 分段等宽
- [x] 4.2 `views/brand/GenerateView.tsx`：同上，套 brand 样式
- [x] 4.3 `App.css` + `brand-ui.css`：折叠区样式（等宽、分段、收起箭头）

## 5. 验证

- [x] 5.1 tsc --noEmit 通过
- [x] 5.2 后端 import 冒烟 + _extract_prompts 逻辑验证
- [ ] 5.3 前端候选卡能展开看提示词（待浏览器人工验证）
- [x] 5.4 无 prompts 时（重审后）折叠区隐藏（`c.prompts &&` 条件渲染）
- [x] 5.5 生成/审核/定稿结果与重构前一致（行为零变化，仅多携带 prompts）
