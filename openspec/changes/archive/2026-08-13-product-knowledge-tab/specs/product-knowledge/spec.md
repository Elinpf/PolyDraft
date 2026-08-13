## ADDED Requirements

### Requirement: 产品知识按系列结构化存储

系统 SHALL 将产品知识按产品系列组织，每系列一条文本，独立存储于 `product_knowledge` 表，不再作为全局变量。

#### Scenario: 维护某系列知识
- **WHEN** 产品在「产品知识」tab 编辑某系列（如 A 系列）的知识文本并保存
- **THEN** 系统保存该条记录，支持多行文本

#### Scenario: 增删系列知识
- **WHEN** 产品新增一个系列知识条目或删除已有条目
- **THEN** 产品知识列表更新

### Requirement: 生成时按系列联动注入

系统 SHALL 在生成时根据所选产品系列，自动把该系列的知识作为 `{产品知识}` 注入变量上下文。

#### Scenario: 选系列注入对应知识
- **WHEN** 生成页选了产品系列 A
- **THEN** 生成时 `{产品知识}` 渲染为 A 系列的知识文本
- **AND** 该知识进入 system prompt（因 system prompt 引用了 `{产品知识}`）

#### Scenario: 未选系列或无对应知识
- **WHEN** 未选产品系列，或所选系列在 product_knowledge 表无记录
- **THEN** `{产品知识}` 保留占位或为空，不报错
- **AND** 生成正常进行

### Requirement: 产品知识独立 tab

前端 SHALL 提供独立的「产品知识」tab，供产品维护各系列知识，与变量页分开。

#### Scenario: 独立维护入口
- **WHEN** 产品进入「产品知识」tab
- **THEN** 看到各系列知识列表，可编辑/增删
- **AND** 变量页不再出现「产品知识」
