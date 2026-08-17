## Why

生成页的"补充输入"（变量名→值，如 品牌=爱他美）目前只存浏览器 localStorage（`copygen_extra_inputs`）。换浏览器/设备即丢失，无法跨设备同步，也没法在配置页统一管理。用户希望自动保存到后端，跨设备可用。

## What Changes

- **后端新增 `extra_inputs` 表**：单行配置表（id=1），存补充输入 JSON（变量名→值）。
- **新增 API**：`GET /extra-inputs`（读）、`POST /extra-inputs`（整体覆盖写）。
- **前端 logic 改为后端持久化**：`useGenerateLogic` 启动 fetch `/extra-inputs` 初始化；每次 extraInputs 变化 debounce 写回后端（不再写 localStorage）。
- **一次性迁移**：首次启动若后端表空，读 localStorage 旧数据迁入后端（保留用户已有补充输入）。
- **默认值**：表空且 localStorage 也空时，seed 默认 `{'品牌':'爱他美'}`。
- **不做**：单独的补充输入配置页（本期仍由生成页内联编辑，只是持久化层换后端）；变量级增删 API（整体覆盖写足够）。

## Capabilities

### New Capabilities
- `extra-inputs`: 生成页补充输入的后端持久化，跨设备同步。

### Modified Capabilities
- `generation-ui`: 补充输入从 localStorage 改为后端 API 持久化，行为一致。

## Impact

- `backend/store.py`：SCHEMA 加 `extra_inputs` 表；`get_extra_inputs`/`save_extra_inputs` CRUD；`_seed_extra_inputs` 默认值；`_migrate_extra_inputs_from_localstorage`（前端旧数据迁移不到后端，后端无 localStorage 访问——改为前端首次 fetch 空时上传 localStorage）
- `backend/app.py`：`GET /extra-inputs`、`POST /extra-inputs` 路由
- `frontend/src/logic/useGenerateLogic.ts`：extraInputs 改 async fetch 初始化 + debounce POST 保存；localStorage 作迁移源用一次
- 行为变化：补充输入跨设备同步；首次启动迁移 localStorage 旧数据
