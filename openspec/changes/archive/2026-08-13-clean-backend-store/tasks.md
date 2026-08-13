## 1. 拆出提示词模板常量

- [x] 1.1 新建 `backend/prompts.py`，搬入所有 `_DEFAULT_*` / `_OLD_*` 常量：`_DEFAULT_SLOTS`、`_OLD_DEFAULT_SLOTS`、`_OLD_EN_SLOTS`、`_DEFAULT_REVIEW`、`_OLD_DEFAULT_REVIEW`、`_DEFAULT_SYSTEM`、`_OLD_EN_SYSTEM`、`_OLD_ZH_SYSTEM_WITH_TONE`、`_DEFAULT_KB`、`_DEFAULT_KB_SERIES`、`_DEFAULT_DIMENSIONS`
- [x] 1.2 在 store.py 顶部 `from .prompts import _DEFAULT_SLOTS, _OLD_DEFAULT_SLOTS, ...`（所有 seed / 迁移引用到的常量）

## 2. 拆出迁移函数

- [x] 2.1 新建 `backend/migrations.py`，搬入 `_ensure_columns`、`_ensure_slot_name_column`、`_ensure_finalized_review_columns`、`_migrate_default_slots`、`_migrate_brand_tone_placeholders`、`_strip_tone_from_slots_and_system`、`_rename_constraint_to_prompt_var`、`_migrate_review_prompt`、`_migrate_product_knowledge`
- [x] 2.2 migrations.py 顶部 `from .db import conn` 与 `from .prompts import ...`（迁移比对用到的 `_OLD_*` / `_DEFAULT_*` 常量）；函数体逻辑零改动
- [x] 2.3 migrations.py 内 `_strip_tone_from_slots_and_system` / `_rename_constraint_to_prompt_var` 的 `import re` 提到文件顶部

## 3. store.py 收尾

- [x] 3.1 store.py 删除已搬走的常量定义与迁移函数定义，保留 `from .prompts import`（seed 用）与 `from .migrations import`（init_store 用）
- [x] 3.2 store.py 保留：SCHEMA、dataclass（GenSlot/PromptBody/Finalized/OptionDimension/OptionChoice/ProductKnowledge）、CRUD、`_seed_dimensions`、`_seed_product_knowledge`、`init_store`
- [x] 3.3 `init_store` 编排顺序与函数体逻辑不变（仅被调函数来源改为 migrations）

## 4. 验证

- [x] 4.1 `python -c "from backend import app"` 无 ImportError（无循环 import）
- [x] 4.2 grep 验证：store.py 不再含 `_migrate`/`_ensure`/`_strip`/`_rename` 函数定义、不含 `_DEFAULT_`/`_OLD_` 常量定义
- [x] 4.3 启动后端 + 前端 e2e：生成 / 审核 / 定稿 / 维度增删改 / 产品知识 CRUD 全跑通
- [x] 4.4 旧库迁移冒烟：用现有 copygen.db 启动，确认迁移函数仍被调用、无 NameError
