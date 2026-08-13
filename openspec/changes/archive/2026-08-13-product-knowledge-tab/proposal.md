## Why

产品知识目前是变量页里的一个全局变量（一大段文本，混在一起），无法按产品系列区分。产品部门需要产品知识按系列组织、独立维护，且生成页选了某产品系列后自动注入该系列的知识到 system prompt，无需手动切换。本 change 把产品知识从变量体系独立出来，结构化按系列存储，并与 Change A 的产品系列选项联动。

## What Changes

- 新增 `product_knowledge` 表：按产品系列一条文本存储（系列名 + 知识文本）。
- 新增「产品知识」独立 tab：CRUD 各系列的知识条目，支持多行编辑。
- 移除变量页里的「产品知识」全局变量（迁移到独立表）。
- 生成时：根据所选产品系列（来自 Change A 的选项维度），自动把对应系列的知识作为 `{产品知识}` 注入。
- system prompt 默认引用 `{产品知识}`（已存在，保持）。

## Capabilities

### New Capabilities
- `product-knowledge`: 按产品系列结构化的产品知识库——独立 tab 维护，每系列一条文本；生成时按所选系列自动注入 `{产品知识}`。

### Modified Capabilities
- `variable-system`: 移除「产品知识」全局变量；`{产品知识}` 改为由 product-knowledge 注入，不再走全局变量 merge。
- `option-dimensions`: 产品系列维度的选择触发产品知识联动注入（跨 capability 协作）。

## Impact

- 新增 `backend/store.py` 的 product_knowledge 部分 + 路由。
- 改 `backend/pipeline.py`：生成前按所选产品系列查 product_knowledge，注入 `{产品知识}` 到变量上下文。
- 新增前端「产品知识」tab。
- 从变量页移除「产品知识」默认条目（迁移数据）。
- 依赖 Change A 的选项维度（产品系列）作为联动触发点。
