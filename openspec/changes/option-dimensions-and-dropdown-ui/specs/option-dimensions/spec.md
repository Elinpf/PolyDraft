## ADDED Requirements

### Requirement: 选项维度可配置

系统 SHALL 支持前台维护的「选项维度」，每个维度有一个名字与一组选项。维度可在 WebUI 增删改。每个维度区分类型：纯值维度 或 带 prompt 片段维度。

#### Scenario: 新增维度
- **WHEN** 产品在选项维度管理页新建一个维度（如「产品系列」），选类型为纯值
- **THEN** 系统保存该维度，可在生成页渲染为下拉框

#### Scenario: 维度选项增删改
- **WHEN** 产品在某维度下增删改选项（如产品系列加一个 E）
- **THEN** 选项列表更新，生成页下拉框同步反映

#### Scenario: 维度类型区分
- **WHEN** 创建维度时选择类型
- **THEN** 纯值维度的选项只需填值；带 prompt 片段维度的选项需填值 + prompt 片段

### Requirement: 带 prompt 片段的选项

带 prompt 片段维度的每个选项 SHALL 额外携带一段 prompt 文本，选中后注入生成上下文。

#### Scenario: 文案类型选项带约束
- **WHEN** 维度「文案类型」的选项「朋友圈」配置了 prompt 片段「不超过7行，每行…」
- **THEN** 生成页选「朋友圈」后，该 prompt 片段作为变量值注入 prompt 渲染
- **AND** 纯值维度的选项无 prompt 片段，仅注入值

### Requirement: 维度数据持久化

系统 SHALL 将选项维度与选项持久化到 SQLite，支持后续 change 的知识联动等场景。

#### Scenario: 应用启动写入默认维度
- **WHEN** 后端启动且无选项维度数据
- **THEN** 写入默认占位维度（产品系列/产品段位/文案类型）及各自默认选项
