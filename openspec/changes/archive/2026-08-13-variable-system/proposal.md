## Why

提示词中的 `{var}` 占位需要真实变量支撑，用户需要管理常驻变量（品牌名/tone 等）并填写每次输入变量，同时需要编辑器校验提示词里引用的变量是否存在。本 change 补齐变量系统与前端校验，使提示词模板真正可用。

## What Changes

- 新增 `variables` 表：全局变量（name/value），常驻配置态。
- 新增 `merge_variables`：运行时合并全局变量 + 本次输入变量，输入同名覆盖全局。
- 新增 `GET /variables/known`：返回可用变量名集合（全局 + 系统保留 `{candidates}`），供前端校验。
- 前端变量管理页：增删改全局变量。
- 前端生成页：本次输入变量表单。
- 前端提示词编辑器：实时扫描 `{var}` 校验，未定义标红、未填黄色警告，仅警告不阻止保存。
- 变量增删记 operations。

## Capabilities

### New Capabilities
- `variable-system`: 变量分全局（DB 常驻）/输入（每次现填），运行时合并注入所有阶段 prompt；`{candidates}` 系统注入保留名；`{var}` 用 `format_map`+`_SafeDict` 渲染。

### Modified Capabilities
- `generation-ui`: 提示词编辑器加 `{var}` 实时校验；生成页加输入变量表单。

## Impact

- 新增 `backend/store.py` 的 variables 部分 + `merge_variables`。
- 改 `backend/pipeline.py`：生成与审查调用前用 `merge_variables` 合并上下文。
- 新增 `GET/POST/DELETE /variables`、`GET /variables/known`。
- 前端变量管理页 + 编辑器校验逻辑。
