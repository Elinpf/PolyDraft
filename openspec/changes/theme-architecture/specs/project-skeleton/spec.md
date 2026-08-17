## ADDED Requirements

### Requirement: 新增 logic/ 与 views/ 目录结构

前端 SHALL 新增 `logic/`（纯逻辑 hooks）与 `views/<theme>/`（主题视图）目录，页面入口 `pages/` 只做组合。

#### Scenario: 目录结构
- **WHEN** 查看 frontend/src/
- **THEN** 存在 logic/、views/classic/、views/brand/、theme.tsx
- **AND** pages/generate.tsx 仅做 logic + View 组合
