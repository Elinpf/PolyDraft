## ADDED Requirements

### Requirement: 选项维度作为变量注入来源

系统 SHALL 在生成时将所选维度的值与 prompt 片段作为变量并入上下文，与全局变量、输入变量一起参与 prompt 渲染。

#### Scenario: 纯值维度注入
- **WHEN** 生成时某纯值维度（如产品系列）选了「A」
- **THEN** 变量上下文中以维度名为 key、选项值为 value 注入（如 {产品系列} = A）
- **AND** prompt 中对应占位被渲染为该值

#### Scenario: 带 prompt 片段维度注入
- **WHEN** 生成时某带 prompt 片段维度（如文案类型）选了「朋友圈」
- **THEN** 该选项的 prompt 片段作为变量值注入（如 {文案类型约束} = 朋友圈那段约束文本）
- **AND** prompt 中对应占位被渲染为该段约束文本

#### Scenario: 与全局/输入变量合并
- **WHEN** 选项维度值与全局变量、输入变量合并
- **THEN** 选项维度值作为一个来源并入 merge_variables
- **AND** 同名冲突时的覆盖优先级由实现决定，但 SHALL 有明确可预期的行为
