## ADDED Requirements

### Requirement: 生成页按勾选维度渲染下拉

生成页 SHALL 按用户勾选的维度子集渲染下拉框，而非自动渲染全部维度。维度数据刷新受选项配置改动驱动。

#### Scenario: 下拉框按勾选渲染
- **WHEN** 生成页加载维度列表
- **THEN** 仅渲染用户已勾选的维度对应的下拉框
- **AND** 每个下拉框列出该维度的所有选项

#### Scenario: 维度数据受 dimsTick 驱动刷新
- **WHEN** 选项配置发生保存 / 增删维度 / 增删选项
- **THEN** 通过共享信号 dimsTick 通知生成页
- **AND** 生成页重新拉取 /dimensions，下拉选项更新为最新

## REMOVED Requirements

### Requirement: 生成页按维度动态渲染下拉框
（被「按勾选维度渲染下拉」取代——原要求自动渲染全部维度，现改为按子集渲染。）
