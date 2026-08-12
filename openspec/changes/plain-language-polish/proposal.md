## Why

当前界面充斥技术词（Provider/Slot/System Prompt/temperature/generate_slots 等），面向非技术产品同学不友好。产品部门要求界面通俗化、去英文，只有不得不用英文时（API key/base_url/model 等技术配置、`{var}` 占位语法）才保留英文。部分技术参数（如 temperature）产品同学不应看到。本 change 对全局文案与视觉做通俗化打磨。

## What Changes

- 界面文案技术词换通俗说法：Provider→模型配置、Slot→文案风格、System Prompt→写作设定、generate→生成、candidates→候选文案、review→审核意见、finalized→定稿、temperature→隐藏等。
- 仅保留必要英文：API key、base_url、model（技术配置）、`{var}` 占位语法、API 返回的错误原文。
- temperature 等技术参数从产品可见 UI 移除（默认 1，对产品不可见）。
- 视觉细节打磨：按钮/标签/状态提示统一通俗语气。

## Capabilities

### Modified Capabilities
- `generation-ui`: 生成页文案通俗化，技术词替换。
- `provider-config-ui`: 配置页保留 API key/base_url/model 英文，其余通俗化。
- `project-skeleton`: 顶部导航、tab 名等全局文案通俗化。

## Impact

- 前端全局文案替换（App.tsx + App.css 相关文本）。
- temperature 字段从槽位 UI 移除/折叠。
- 不动后端逻辑（仅文案与可见性）。
- 依赖 A/B/C 基本定型后做，避免返工。
