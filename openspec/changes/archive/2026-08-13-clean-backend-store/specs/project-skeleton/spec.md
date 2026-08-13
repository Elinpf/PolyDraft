## ADDED Requirements

### Requirement: store.py 按职责拆分为三文件

后端 SHALL 将 `backend/store.py` 中的提示词模板常量搬出到 `backend/prompts.py`，一次性迁移函数搬出到 `backend/migrations.py`，store.py 只保留 dataclass、CRUD、SCHEMA 与 `init_store` 编排。

#### Scenario: 模板常量集中到 prompts.py
- **WHEN** 查看 backend/prompts.py
- **THEN** 所有 `_DEFAULT_*` 与 `_OLD_*` 常量（含 `_DEFAULT_SLOTS`/`_OLD_DEFAULT_SLOTS`/`_OLD_EN_SLOTS`/`_DEFAULT_REVIEW`/`_OLD_DEFAULT_REVIEW`/`_DEFAULT_SYSTEM`/`_OLD_EN_SYSTEM`/`_OLD_ZH_SYSTEM_WITH_TONE`/`_DEFAULT_KB`/`_DEFAULT_KB_SERIES`/`_DEFAULT_DIMENSIONS`）定义在此
- **AND** store.py 与 migrations.py 通过 import 引用，不再定义这些常量

#### Scenario: 迁移函数集中到 migrations.py
- **WHEN** 查看 backend/migrations.py
- **THEN** `_ensure_columns` 与全部 `_migrate_*`/`_ensure_*`/`_strip_*`/`_rename_*` 函数定义在此
- **AND** 函数实现逻辑不变，仅常量引用改为 `from .prompts import`
- **AND** store.py 中不再定义这些函数

#### Scenario: store.py 只留 CRUD 与编排
- **WHEN** 查看 backend/store.py
- **THEN** 仅含 dataclass、CRUD 函数、SCHEMA、`init_store` 与 `_seed_dimensions`/`_seed_product_knowledge`
- **AND** `init_store` 编排顺序与拆分前完全一致

#### Scenario: 公共 API 不变
- **WHEN** app.py 执行 `from .store import init_store, list_slots, ...`
- **THEN** 所有 import 与拆分前一致，无需修改 app.py
- **AND** `init_store` 仍由 store.py 导出

#### Scenario: 行为不变
- **WHEN** 拆分后启动后端并运行生成/审核/定稿/维度配置/产品知识流程
- **THEN** 全部功能与拆分前完全一致
- **AND** 旧库迁移（含 `{brand}`→`{品牌}`、去 `{语气}`、`{X约束}`→`{X提示词}`、综合审查→三维度）仍正常执行
