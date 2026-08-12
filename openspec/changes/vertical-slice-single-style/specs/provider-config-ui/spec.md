## ADDED Requirements

### Requirement: Provider 配置页

前端 SHALL 提供 provider 配置页，列出已配置 provider，支持填写/编辑 base_url、api_key、model 并保存。

#### Scenario: 查看与编辑配置
- **WHEN** 用户进入配置页
- **THEN** 显示 kimi 与 vllm 两条配置（含已存值）
- **AND** 用户可编辑字段并保存，保存后提示成功

#### Scenario: 测试连通性
- **WHEN** 用户在某 provider 行点击「测试」按钮
- **THEN** 调用测试 API，按钮显示加载态
- **AND** 返回后显示 ok/失败结果

### Requirement: 生成页

前端 SHALL 提供生成页，用户填入输入变量、选择 provider、触发生成并显示单条结果。

#### Scenario: 触发生成
- **WHEN** 用户填写输入并点击「生成」
- **THEN** 调用 `/generate`，显示加载态
- **AND** 返回后展示生成的文案

#### Scenario: 生成失败提示
- **WHEN** 生成请求返回错误
- **THEN** 页面显示错误信息，不崩溃
