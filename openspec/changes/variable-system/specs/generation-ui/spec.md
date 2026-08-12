## MODIFIED Requirements

### Requirement: 生成结果展示

前端 SHALL 在提示词编辑器中实时校验 `{var}` 引用，并在生成页提供本次输入变量表单。

#### Scenario: 提示词编辑器实时校验
- **WHEN** 用户在提示词编辑器输入或修改 `{var}`
- **THEN** 前端对照可用变量集合（全局 + 系统保留 `{candidates}` + 已声明输入变量）校验
- **AND** 未定义变量标红提示，未填值变量黄色警告

#### Scenario: 校验不阻止保存
- **WHEN** 提示词含未知变量
- **THEN** 仅警告，允许保存
- **AND** 后端 `_SafeDict` 兜底保留占位不崩

#### Scenario: 生成页输入变量表单
- **WHEN** 用户在生成页填写本次输入变量
- **THEN** 表单收集为输入变量字典，随 `/generate` 提交
- **AND** 与全局变量合并后注入 prompt
