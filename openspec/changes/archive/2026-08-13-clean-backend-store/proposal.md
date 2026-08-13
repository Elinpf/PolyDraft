## Why

`backend/store.py` 是后端最大热点，675 行混三类职责：

1. **提示词模板常量**（`_DEFAULT_SLOTS`/`_OLD_DEFAULT_SLOTS`/`_OLD_EN_SLOTS`/`_DEFAULT_REVIEW`/`_OLD_DEFAULT_REVIEW`/`_DEFAULT_SYSTEM`/`_OLD_EN_SYSTEM`/`_OLD_ZH_SYSTEM_WITH_TONE`/`_DEFAULT_KB`/`_DEFAULT_KB_SERIES`/`_DEFAULT_DIMENSIONS`）—— 行 58-137
2. **8 个一次性迁移函数**（`_ensure_columns`/`_ensure_slot_name_column`/`_ensure_finalized_review_columns`/`_migrate_default_slots`/`_migrate_brand_tone_placeholders`/`_strip_tone_from_slots_and_system`/`_rename_constraint_to_prompt_var`/`_migrate_review_prompt`/`_migrate_product_knowledge`）—— 散落 188-354
3. **CRUD + dataclass + `init_store`** —— 其余

deletion test：把 1、2 搬走，store.py 只剩 CRUD，复杂度集中（CRUD 读起来不再被迁移历史和模板字面量淹没），证明 1、2 是浅层混杂而非深模块。

## What Changes

- **提示词模板**搬出 `backend/prompts.py`：所有 `_DEFAULT_*` / `_OLD_*` 常量集中，`store.py` 与 `migrations.py` import 引用。
- **迁移函数**搬出 `backend/migrations.py`：8 个 `_migrate_*`/`_ensure_*` 集中，`init_store` 调用不变。
- **store.py 只留**：dataclass + CRUD + `init_store`（`init_store` 仍编排 SCHEMA + seed + 迁移调用，但函数体逻辑不变）。
- **不做**：不改任何函数实现、不改 SCHEMA、不动 seed 逻辑、不改 `init_store` 调用顺序、不引入迁移版本号机制（speculative，8 个迁移是一次性历史包袱，不是演进中模式）。

## Capabilities

### New Capabilities
（无新能力——纯文件拆分，行为不变）

### Modified Capabilities
- `project-skeleton`: store.py 按职责拆为 store.py（CRUD）+ prompts.py（模板常量）+ migrations.py（一次性迁移函数），调用关系与行为不变。

## Impact

- 后端 `backend/store.py` → 拆为 `store.py`（CRUD + dataclass + init_store 编排）+ `prompts.py`（模板常量）+ `migrations.py`（迁移函数）
- `init_store` 仍由 store.py 导出（app.py 不改 import）
- 迁移函数从 store.py 私有迁到 migrations.py，仍由 init_store 内部调用，不暴露公共 API
- 行为零变化（纯文件搬运 + import 调整）
- 为未来提示词/迁移演进扫清结构障碍（但本期不实现迁移版本号）
