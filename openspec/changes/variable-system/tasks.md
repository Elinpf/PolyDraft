# Tasks: 变量系统 + 前端校验

## 1. 后端数据层

- [x] 1.1 `store.py`：`variables` 表 + 存取函数（list/save/delete）
- [x] 1.2 `SYSTEM_VARS = {"candidates"}` + `save_variable` 拒绝保留名
- [x] 1.3 `merge_variables(input_vars)`：全局 + 输入合并，输入覆盖全局
- [x] 1.4 startup 写入默认全局变量占位（如 brand/tone）

## 2. 后端路由

- [x] 2.1 `GET/POST/DELETE /variables`
- [x] 2.2 `GET /variables/known`：返回全局变量名 + SYSTEM_VARS
- [x] 2.3 变量增删写 `operations`

## 3. 后端流水线接入

- [x] 3.1 `pipeline.py`：生成与审查前调 `merge_variables` 合并上下文
- [x] 3.2 确认 `{candidates}` 在审查阶段注入

## 4. 前端变量管理页

- [x] 4.1 全局变量列表 + 增删改
- [x] 4.2 保存保留名时前端拦截提示

## 5. 前端生成页与编辑器校验

- [x] 5.1 生成页输入变量表单（字段名即声明）
- [x] 5.2 提示词编辑器实时扫描 `{var}`，调 `/variables/known` 校验
- [x] 5.3 三态：未定义标红、未填黄色警告、已知已填正常
- [x] 5.4 校验仅警告不阻止保存

## 6. 验证

- [x] 6.1 全局变量增删改生效且注入 prompt
- [x] 6.2 输入变量覆盖同名全局
- [x] 6.3 保留名 `candidates` 被拒绝作为用户变量
- [x] 6.4 编辑器标红未知变量、黄色警告未填
- [x] 6.5 含未知变量的 prompt 仍可保存且运行不崩（占位保留）
