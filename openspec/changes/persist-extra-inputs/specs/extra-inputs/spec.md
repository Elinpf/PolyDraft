## ADDED Requirements

### Requirement: 补充输入后端持久化

系统 SHALL 在后端 `extra_inputs` 单行表持久化补充输入（变量名→值 JSON），提供 GET/POST API，跨设备同步。

#### Scenario: 表结构
- **WHEN** 查看 backend schema
- **THEN** 存在 extra_inputs 单行表（id=1，body 存 JSON）

#### Scenario: 读取
- **WHEN** GET /extra-inputs
- **THEN** 返回 {变量名: 值} JSON

#### Scenario: 保存
- **WHEN** POST /extra-inputs 带 {变量名: 值}
- **THEN** 整体覆盖写入 extra_inputs 表
- **AND** 返回 {ok: true}

#### Scenario: 默认 seed
- **WHEN** 首次启动表空
- **THEN** seed {'品牌': '爱他美'}

### Requirement: 前端自动保存

生成页补充输入 SHALL 启动从后端加载，变化时 debounce 500ms 自动保存到后端，不再依赖 localStorage 持久化。

#### Scenario: 启动加载
- **WHEN** 生成页挂载
- **THEN** fetch /extra-inputs 初始化 extraInputs

#### Scenario: 自动保存
- **WHEN** 用户编辑补充输入（变量名/值/增删）
- **THEN** debounce 500ms 后 POST /extra-inputs 保存
- **AND** 不每次按键都 POST

#### Scenario: localStorage 迁移
- **WHEN** 首次启动后端空但 localStorage 有旧数据
- **THEN** 用 localStorage 数据初始化并上传后端
- **AND** 迁移后清 localStorage，不再当源

#### Scenario: 跨设备同步
- **WHEN** 设备A编辑补充输入后，设备B打开
- **THEN** 设备B从后端加载到设备A的输入
