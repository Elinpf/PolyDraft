## MODIFIED Requirements

### Requirement: 生成结果展示

前端 SHALL 在输出页展示 `/generate` 返回的多份候选与审查意见，支持候选切换。本 change 引入多候选展示与审查意见块；定稿/编辑/复制在 Change 3 完善。

#### Scenario: 展示多候选与审查意见
- **WHEN** `/generate` 返回多份候选与 review
- **THEN** 输出页显示审查意见块（综合意见 + 每份简评）
- **AND** 显示候选选择器，可切换查看每份

### Requirement: 槽位管理页

前端 SHALL 提供槽位管理页，增删改各 generate 槽位的 prompt 与 temperature，并查看审查 prompt。

#### Scenario: 增删改槽位
- **WHEN** 用户在槽位管理页编辑某槽位的 prompt/temperature 并保存
- **THEN** 调用保存 API，更新对应槽位
- **AND** 可新增/删除槽位

#### Scenario: 编辑审查 prompt
- **WHEN** 用户编辑审查 prompt 并保存
- **THEN** 更新 `review_prompt`
