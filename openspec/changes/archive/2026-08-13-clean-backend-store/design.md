## Context

`backend/store.py` 675 行混三类职责（提示词模板常量 / 一次性迁移函数 / CRUD）。模板常量是长字面量，淹没 CRUD 逻辑；8 个迁移函数是历史演进的一次性包袱，散落在 CRUD 之间。本期纯文件拆分，行为零变化。

当前 `init_store` 编排顺序（不可变）：
1. `executescript(SCHEMA)`
2. `_ensure_slot_name_column()`
3. seed 默认 slots / review / system
4. `_ensure_finalized_review_columns()`
5. `_migrate_default_slots()`
6. `_migrate_brand_tone_placeholders()`
7. `_strip_tone_from_slots_and_system()`
8. `_rename_constraint_to_prompt_var()`
9. `_migrate_review_prompt()`
10. `_migrate_product_knowledge()`
11. `_seed_dimensions()`
12. `_seed_product_knowledge()`

依赖关系：`_migrate_*` 函数引用 `prompts` 里的 `_OLD_*` / `_DEFAULT_*` 常量做比对替换；`_seed_*` 引用 `_DEFAULT_DIMENSIONS` / `_DEFAULT_KB_SERIES`。拆分后这些引用改为跨文件 import。

## Goals / Non-Goals

**Goals:**
- store.py 只剩 dataclass + CRUD + `init_store` 编排，读起来不被模板字面量和迁移历史淹没。
- 提示词模板集中在 prompts.py，未来调提示词只动一个文件。
- 迁移函数集中在 migrations.py，历史包袱与当前 CRUD 分离。
- 行为零变化：`init_store` 编排顺序、SCHEMA、seed、迁移逻辑全部不变。

**Non-Goals:**
- 不引入迁移版本号机制（8 个迁移是一次性历史包袱，不是演进中模式，speculative）。
- 不合并/删除任何迁移函数（它们仍需对旧库执行）。
- 不改 SCHEMA、不改 dataclass 字段、不改公共 API（`init_store` 仍由 store.py 导出）。
- 不动 `app.py` 的 import（`from .store import ...` 全部不变）。
- 不拆 #4 审核 shape（独立 change `unify-review-shape` 处理）。

## Decisions

### 决策 1：拆三个文件，按职责切

- `backend/prompts.py`：所有 `_DEFAULT_*` / `_OLD_*` 模板常量 + `_DEFAULT_DIMENSIONS` / `_DEFAULT_KB_SERIES` seed 数据。
- `backend/migrations.py`：`_ensure_columns` + 8 个 `_migrate_*`/`_ensure_*`/`_strip_*`/`_rename_*` 函数。
- `backend/store.py`：dataclass（GenSlot/PromptBody/Finalized/OptionDimension/OptionChoice/ProductKnowledge）+ CRUD + SCHEMA + `init_store` + `_seed_dimensions`/`_seed_product_knowledge`（seed 是 CRUD 邻近逻辑，留 store）。

**为何不拆得更细**（如每个领域一个文件 slots.py/dimensions.py/finalized.py）：deletion test——再拆只是按表分组，CRUD 间无耦合，不会因拆分集中复杂度，纯属搬家收益递减。三个文件已让"模板/迁移/当前逻辑"三类清晰分离。

**为何 seed 留 store 不进 prompts**：`_seed_dimensions`/`_seed_product_knowledge` 是写库逻辑（INSERT OR IGNORE），与 CRUD 同层；prompts 只放纯数据常量。`_DEFAULT_DIMENSIONS` 常量进 prompts，seed 函数留 store。

### 决策 2：init_store 留在 store.py，编排迁移调用

`init_store` 仍由 store.py 导出（app.py `from .store import init_store` 不变）。函数体逻辑不变，只是 `_migrate_*` 调用指向 `from .migrations import ...`，常量指向 `from .prompts import ...`。

**为何 init_store 不进 migrations.py**：`init_store` 是 store 的入口（建表 + seed + 迁移编排），是公共 API；迁移是它的内部步骤。把它留在 store.py 保持 `app.py` import 不变，减少 blast radius。

### 决策 3：迁移函数保持私有（下划线前缀）

`_migrate_*` 搬到 migrations.py 仍保留下划线前缀，只由 `init_store` 调用，不暴露公共 API。prompts 常量也无下划线约束（被 migrations 和 store seed 引用，可视为模块内部常量）。

## Risks / Trade-offs

- **[循环 import]** migrations.py 引 prompts 常量 + `conn`；store.py 引 migrations 函数 + prompts 常量。无循环（prompts 不引任何人，migrations 不引 store，store 引两者）。→ 验证：拆分后 `python -c "from backend import app"` 无 ImportError。
- **[迁移漏搬]** 漏搬某个 `_migrate_*` 会导致 `init_store` NameError。→ 验证：grep `_migrate\|_ensure\|_strip\|_rename` 在 store.py 残留为空；启动后端 + e2e 跑通。
- **[常量漏搬]** 漏搬 `_OLD_*` 会让迁移比对失配（旧库迁移静默失效）。→ 验证：grep `_DEFAULT\|_OLD` 在 store.py 残留仅 seed 函数内部引用，常量定义全在 prompts.py。

## Migration Plan

纯文件搬运，无数据迁移、无 API 变化。

1. 新建 prompts.py，搬所有 `_DEFAULT_*`/`_OLD_*` 常量。
2. 新建 migrations.py，搬 `_ensure_columns` + 8 个迁移函数，`from .prompts import ...` 引用常量，`from .db import conn`。
3. store.py 删除已搬走的定义，`from .prompts import ...` + `from .migrations import ...` 补引用；`init_store` 函数体不变。
4. 验证：`tsc`（前端不受影响，仅后端）+ 后端 import 冒烟 + 现有 e2e。

回滚：单 commit，`git revert` 即可。

## Open Questions

无。拆分边界由 deletion test 明确，无 speculative 抽象。
