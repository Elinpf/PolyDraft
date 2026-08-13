## ADDED Requirements

### Requirement: 界面文案通俗化

前端界面 SHALL 使用通俗中文，避免技术词与不必要的英文。只有技术配置项（API key/base_url/model）、`{var}` 占位语法、API 错误原文等不得不用英文时才保留。

#### Scenario: 技术词替换
- **WHEN** 产品同学浏览界面
- **THEN** 看到「模型配置」「文案风格」「写作设定」「生成」「候选文案」「审核意见」「定稿」等通俗说法
- **AND** 不出现 Provider/Slot/System Prompt/generate/candidates 等技术词

#### Scenario: 保留必要英文
- **WHEN** 展示技术配置项或占位语法
- **THEN** API key、base_url、model、`{var}` 保留英文
- **AND** API 返回的错误原文保留英文

### Requirement: 技术参数对产品隐藏

temperature 等产品同学无需关心的技术参数 SHALL 从产品可见 UI 移除，默认值在后端处理。

#### Scenario: temperature 不可见
- **WHEN** 产品在风格槽位管理页
- **THEN** 不显示 temperature 字段
- **AND** 后端默认 temperature=1
