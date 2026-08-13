## ADDED Requirements

### Requirement: 每份候选独立定稿保留

系统 SHALL 允许每份候选各自定稿并全部保留，而非只留一份。一次生成可产生 N 条定稿记录。

#### Scenario: 多份定稿
- **WHEN** 用户对多份候选分别点定稿
- **THEN** 每份定稿各自写入 finalized 表
- **AND** 不互相覆盖，全部保留

#### Scenario: 定稿记录审核结果
- **WHEN** 某份候选定稿
- **THEN** finalized 记录包含该候选的审核意见与打分
- **AND** 记录定稿文本（可能经用户编辑）

## ADDED Requirements

### Requirement: 候选粒度审核状态

每份候选 SHALL 维护独立的审核状态（待审/已审）与审核结果，供前端展示。

#### Scenario: 展示每份审核状态
- **WHEN** 生成完成后
- **THEN** 每份候选卡片显示其审核状态、打分、三维度意见
- **AND** 用户可据此决定定稿或修改重审
