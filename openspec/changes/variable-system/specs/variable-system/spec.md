## ADDED Requirements

### Requirement: 变量二分与合并

系统 SHALL 将变量分为全局变量（常驻配置态，存 `variables` 表）与输入变量（每次运行态，不落库），运行时通过 `merge_variables` 合并注入所有阶段 prompt，输入同名覆盖全局。

#### Scenario: 合并全局与输入变量
- **WHEN** 一次生成携带输入变量
- **THEN** 系统合并全局变量与本次输入变量为单一上下文
- **AND** 输入变量与全局变量同名时，输入值覆盖
- **AND** 合并后的上下文注入生成与审查阶段 prompt

#### Scenario: 全局变量增删改
- **WHEN** 用户在变量管理页新增/编辑/删除一个全局变量
- **THEN** `variables` 表对应更新
- **AND** 操作写入 `operations`

### Requirement: 系统保留变量名

系统 SHALL 保留 `{candidates}` 作为系统注入变量名，禁止用户变量同名占用。

#### Scenario: 拒绝保留名
- **WHEN** 用户尝试保存名为 `candidates` 的变量
- **THEN** 系统返回错误，拒绝保存

### Requirement: {var} 渲染

系统 SHALL 用 `format_map` + `_SafeDict` 渲染提示词占位，未定义变量保留原占位不抛错。

#### Scenario: 正常渲染
- **WHEN** prompt 含 `{brand}` 且上下文有 brand 值
- **THEN** 占位被替换为对应值

#### Scenario: 未定义变量保留占位
- **WHEN** prompt 含 `{xxx}` 但上下文无该变量
- **THEN** 保留 `{xxx}` 原样，不抛异常

### Requirement: 可用变量名查询

系统 SHALL 提供 `GET /variables/known` 返回当前可用变量名集合（全局变量名 + 系统保留名），供前端校验。

#### Scenario: 查询已知变量
- **WHEN** 前端请求可用变量名
- **THEN** 返回全局变量名列表 + `candidates`
