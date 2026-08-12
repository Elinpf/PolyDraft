# Tasks: 选项维度配置 + 生成页下拉化

## 1. 后端数据层

- [x] 1.1 `store.py`：`option_dimensions` 表（id/name/kind）+ `option_choices` 表（id/dimension_id/label/value/prompt_fragment）
- [x] 1.2 存取函数：维度 list/save/delete、选项 list/save/delete（含 prompt_fragment）
- [x] 1.3 startup seed 默认维度（产品系列-纯值、产品段位-纯值、文案类型-带prompt）及各自默认选项

## 2. 后端路由

- [x] 2.1 `GET/POST/DELETE /dimensions` 维度管理（含 PUT 更新）
- [x] 2.2 `GET/POST/DELETE /dimensions/{id}/choices` 选项管理（含 PUT /choices/{id}）
- [x] 2.3 维度名校验唯一，返回友好错误

## 3. 后端流水线接入

- [x] 3.1 `GenerateInput` 增加 `selections: dict`（维度→选项映射）
- [x] 3.2 `selections_to_vars` 接入选项维度值与 prompt_fragment（纯值→{维度名}=value，带prompt→额外{维度名约束}=fragment）
- [x] 3.3 pipeline 生成前按 selections 注入变量上下文（覆盖同名全局）

## 4. 前端选项维度管理页

- [x] 4.1 维度列表 + 增删改（name + kind 选择）
- [x] 4.2 每个维度下选项列表 + 增删改（label/value + prompt_fragment，prompt 维度才显示片段框）

## 5. 前端生成页改造

- [x] 5.1 生成页拉取维度列表，按维度动态渲染下拉框
- [x] 5.2 各下拉选好后触发生成，传 selections
- [x] 5.3 移除自由填空输入变量表单（保留 provider 选择 + 生成按钮）
- [x] 5.4 无维度时提示去配置

## 6. 验证

- [x] 6.1 配置三个维度及选项，生成页下拉正确渲染（API 验证 /dimensions 返回 seed）
- [x] 6.2 选产品系列 A → {产品系列} 注入值为 A（selections_to_vars 单测通过）
- [x] 6.3 选文案类型朋友圈 → 对应 prompt 片段注入（{文案类型约束} 渲染朋友圈约束）
- [x] 6.4 生成走通（SSE + 并行候选 + 审查），变量正确渲染（流水线跑通，仅 kimi 配额耗尽外部失败）
- [x] 6.5 前台增删改维度/选项即时反映到生成页
