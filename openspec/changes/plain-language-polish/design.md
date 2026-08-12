# Design: 去英文、去技术化（通俗化打磨）

## Context

产品已跑通且功能定型（A/B/C 完成后），进入视觉与文案打磨。当前界面技术词多、对非技术用户不友好。本 change 做全局通俗化，去英文，隐藏技术参数。

依赖 A/B/C 基本定型（避免返工）。

## Goals / Non-Goals

**Goals**
- 技术词换通俗说法。
- 保留必要英文（API key/base_url/model/`{var}`/错误原文）。
- temperature 对产品隐藏，默认 1。

**Non-Goals**
- 功能变更（仅文案与可见性）。
- 后端逻辑改动（temperature 默认值已在 Change A/C 相关，本 change 仅 UI 隐藏）。

## Decisions

### 1. 术语对照表
```
技术词（现）              通俗（改）
─────────────────────────────────
Provider                模型配置
Slot / 风格槽位          文案风格
System Prompt           写作设定
generate                生成
candidates / drafts     候选文案
review                  审核意见
finalized               定稿
temperature             （隐藏）
option dimensions       选项配置
product knowledge       产品知识
变量                    （保留，但加说明）
```

### 2. 保留英文清单
- 配置页：API key、base_url、model（字段标签可中文化为「接口地址」等，但值是英文）
- 占位语法：`{var}` 在提示词编辑器内保留
- 错误信息：API 返回原文保留

### 3. temperature 隐藏
槽位管理页移除 temperature 输入框，后端固定 1（kimi-for-coding 等约束已满足）。

## Risks / Trade-offs
- [部分通俗词可能不够精准] → 与产品确认术语对照表后执行。
- [隐藏 temperature 后调试不便] → 可保留开发者入口或后端可配。

## Open Questions
- 「变量」「占位」这类词是否保留：倾向保留但配说明文案。
