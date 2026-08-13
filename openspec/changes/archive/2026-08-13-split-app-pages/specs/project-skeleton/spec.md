## ADDED Requirements

### Requirement: App.tsx 按领域拆分为页面文件

前端 SHALL 将 App.tsx 中的页面组件拆分到 `frontend/src/pages/` 下独立文件，App.tsx 只保留路由与常驻挂载渲染。跨页类型 SHALL 集中到 `frontend/src/types.ts`。

#### Scenario: 页面文件独立
- **WHEN** 查看 frontend/src/pages/
- **THEN** 存在 generate.tsx / config.tsx / slots.tsx / options.tsx / knowledge.tsx / history.tsx / docs.tsx
- **AND** App.tsx 仅含路由逻辑与 display 切换渲染
- **AND** 跨页类型在 types.ts，各页 import

#### Scenario: 行为不变
- **WHEN** 拆分后运行应用
- **THEN** 所有页面功能（生成/定稿/切 tab/维度刷新）与拆分前完全一致

### Requirement: 单消费者状态就地化

仅被单一页面消费的状态 SHALL 落进该页面组件内部，不上提到 App 顶层。刷新信号保持计数器逻辑但从 SharedState 拆出单独传递。

#### Scenario: 生成页状态就地
- **WHEN** 生成页使用 genProvider / extraInputs
- **THEN** 这些状态定义在 GeneratePage 内部
- **AND** 切 tab 不丢（页面常驻挂载保活）

#### Scenario: 配置页状态就地
- **WHEN** 配置页使用 provEditing
- **THEN** 状态定义在 ConfigPage 内部
- **AND** 切 tab 不丢

#### Scenario: 刷新信号去混味
- **WHEN** 定稿 / 维度变更
- **THEN** finalizeTick / dimsTick 计数器逻辑保持
- **AND** 不再混在 SharedState 全家桶里，单独传给真正需要的页面
