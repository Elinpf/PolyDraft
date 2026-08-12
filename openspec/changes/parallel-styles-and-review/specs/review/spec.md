## ADDED Requirements

### Requirement: 审查阶段产出意见

系统 SHALL 在生成后执行审查阶段：将全部候选拼接为 `{candidates}` 块，喂审查 prompt，产出综合意见 + 每份候选简评，不替人选优。最终选稿由人在前端完成。

#### Scenario: 审查全部候选
- **WHEN** 并行生成产出 N 份候选
- **THEN** 系统把 N 份拼成 `{candidates}` 注入审查 prompt
- **AND** 审查 LLM 返回综合意见与每份简评

#### Scenario: 审查不替人选优
- **WHEN** 审查完成
- **THEN** 结果仅含意见，不含自动选定的「最佳」标记
- **AND** 选稿由前端用户决定

### Requirement: 审查可单独重跑

系统 SHALL 提供 `/re-review` 端点，复用已有候选只重跑审查阶段，不重走生成。

#### Scenario: 重新审查
- **WHEN** 客户端 POST `/re-review`，带已有候选与输入变量
- **THEN** 系统仅执行审查阶段，返回新 review
- **AND** 不重新生成候选

#### Scenario: 重新审查的留存
- **WHEN** 一次 re-review 完成
- **THEN** `gen_records` 记录该次候选与新 review
