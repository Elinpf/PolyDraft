## MODIFIED Requirements

### Requirement: 生成结果展示

前端 SHALL 在输出页展示候选与审查意见，并支持候选编辑、定稿、复制、重新审查交互。定稿为前端态，不落库。

#### Scenario: 实时进度展示
- **WHEN** `/generate` SSE 推送进度事件
- **THEN** 前端显示「生成中 N/M」「审查中」等分阶段状态
- **AND** 完成后切换为结果展示

#### Scenario: 候选编辑与定稿
- **WHEN** 用户选中一份候选并在文本框内编辑
- **THEN** 可改字后点击 [定稿]，前端标记「已定稿」
- **AND** 定稿不写后端（不落库）

#### Scenario: 复制候选
- **WHEN** 用户点击 [复制]
- **THEN** 当前文本框内容（可能已编辑）复制到剪贴板

#### Scenario: 重新审查
- **WHEN** 用户点击 [重新审查]
- **THEN** 调用 `/re-review`（带当前候选与输入），返回新 review 替换意见块
- **AND** 候选项不变

#### Scenario: 改输入重走
- **WHEN** 用户点击 [改输入]
- **THEN** 回到输入页重走整条流水线
