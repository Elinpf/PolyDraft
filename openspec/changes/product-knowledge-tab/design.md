# Design: 产品知识独立 tab + 与产品系列联动

## Context

Change A 引入了「产品系列」选项维度。产品知识需要按系列组织，选系列即注入对应知识。当前产品知识是变量页里一个全局变量（一大段文本），无法按系列区分。本 change 把它独立成结构化表 + 独立 tab，并与产品系列选择联动。

依赖 Change A（产品系列维度已存在）。

## Goals / Non-Goals

**Goals**
- product_knowledge 表，按系列一条文本。
- 独立「产品知识」tab，CRUD。
- 生成时按所选产品系列注入 `{产品知识}`。
- 从变量页移除产品知识全局变量。

**Non-Goals**
- 产品知识的多字段结构（卖点/受众/范文分开）——本期一条文本，后续按需扩展。
- 产品知识按段位细分——本期只按系列。
- 审查流程（Change C）、通俗化（Change D）。

## Decisions

### 1. 数据模型
```
product_knowledge 表:
  series TEXT PRIMARY KEY,   -- 产品系列名，与 Change A 选项维度「产品系列」的选项值对应
  body  TEXT NOT NULL        -- 知识文本（多行）
```
series 与选项维度「产品系列」的选项 value 对应（非外键约束，软关联）。

### 2. 联动注入
生成请求携带 selections（Change A）。pipeline 读取 selections 中的产品系列值，查 product_knowledge 表得 body，注入为 `{产品知识}` 变量。注入进 system（因 system prompt 引用 `{产品知识}`），由 `{var}` 位置决定，不特殊处理。

### 3. 迁移
- variables 表里的「产品知识」默认条目移除（init_store 的 _DEFAULT_VARS 删掉产品知识）。
- 已存的用户「产品知识」变量值：本 change 提供一次性迁移到 product_knowledge 表的默认系列条目（或提示用户迁移），避免数据丢失。

### 4. 与选项维度的软关联
产品系列维度的选项 value 与 product_knowledge.series 对应。若选项改名导致不匹配，注入时按 series 查不到则 `{产品知识}` 为空，不报错。

## Risks / Trade-offs

- [软关联可能因改名失配] → 简单可接受，产品知识查不到时优雅降级为空。
- [迁移已有产品知识变量] → 一次性迁移脚本/逻辑，把现有值挪到默认系列条目。

## Open Questions

- 产品知识是否需要版本/历史：本期不做。
- 系列重命名时是否级联更新 product_knowledge.series：本期不做，依赖产品手动同步。
