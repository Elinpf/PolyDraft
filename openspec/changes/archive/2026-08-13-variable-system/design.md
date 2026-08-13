# Design: 变量系统 + 前端校验

## Context

Change 1-3 中输入变量仅作为原样字典传递，未做全局/输入合并，提示词 `{var}` 也无校验。本 change 补齐变量系统。wayfinder 已定：变量二分（全局常驻/输入每次现填）、`merge_variables` 合并注入、`{candidates}` 系统保留名、`{var}` 用 `format_map`+`_SafeDict`、校验仅警告不阻止保存。

## Goals / Non-Goals

**Goals**
- 全局变量表 + merge 合并注入。
- `{candidates}` 保留名。
- `/variables/known` 供校验。
- 前端变量管理页 + 输入变量表单 + 编辑器 `{var}` 校验。

**Non-Goals**
- 不做变量版本管理/回滚（map fog，延伸项）。
- 不做变量类型（枚举/长文本），纯字符串。

## Decisions

### 1. 变量二分
全局变量存 `variables`（name/value），WebUI 变量管理页维护。输入变量在生成页表单现填，不落库。运行时 `merge_variables(input_vars)` = 全局 + 输入（输入覆盖全局）。

### 2. 系统保留名
`SYSTEM_VARS = {"candidates"}`，由审查阶段注入候选拼接结果。`save_variable` 拒绝保留名。

### 3. 渲染容错
`format_map` + `_SafeDict`，未定义变量保留 `{name}` 原样，不抛错——为「校验仅警告不阻止」兜底。

### 4. 前端校验三态
- 未定义（变量管理页没有）→ 标红「未知变量」。
- 未填（输入变量声明了但本次空）→ 黄色警告「未填值」。
- 已知且已填 → 正常。
对照集合来自 `/variables/known` + 前端生成的输入变量名。

## Risks / Trade-offs

- [纯字符串变量限制表达力] → 够用，未来若需枚举/长文本再扩。
- [校验仅警告可能用户忽略] → 后端兜底保留占位不崩，运行安全；非阻塞利于「先写 prompt 再补变量」的流程。

## Open Questions

- 输入变量名如何声明：本 change 由生成页表单的字段名即声明，无需单独声明步骤。
