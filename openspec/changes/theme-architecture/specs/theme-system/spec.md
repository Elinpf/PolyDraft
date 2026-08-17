## ADDED Requirements

### Requirement: 逻辑与视图分离架构

前端 SHALL 将页面逻辑抽到 `logic/` hooks（纯 state + fetch + 操作，无 JSX 无 className），视图渲染按主题组织到 `views/<theme>/`（纯 JSX + className）。页面入口 `pages/*.tsx` 组合 logic + 主题 View，自身不含渲染细节。

#### Scenario: logic hook 无渲染
- **WHEN** 查看 frontend/src/logic/useGenerateLogic.ts
- **THEN** 仅含 state 声明、fetch、SSE 解析、操作函数
- **AND** 无 JSX、无 className、无 import 任何 CSS

#### Scenario: View 无逻辑
- **WHEN** 查看 views/classic/GenerateView.tsx 和 views/brand/GenerateView.tsx
- **THEN** 仅含 JSX 渲染 + className
- **AND** 无 fetch、无 state 声明（仅接收 props.logic 解构）

#### Scenario: 页面入口组合
- **WHEN** 查看 pages/generate.tsx
- **THEN** 调用 useGenerateLogic() 得到 logic 对象
- **AND** 通过主题机制取对应 View，渲染 <View logic={logic} />

### Requirement: 主题按偏好切换

系统 SHALL 通过 ThemeContext 提供主题切换，偏好存 localStorage `copygen_theme`（`classic` | `brand`），URL 不变。顶部按钮切换并持久化。

#### Scenario: 主题切换即生效
- **WHEN** 用户点"切换新版"按钮
- **THEN** 立即重渲染为新版 View，URL 不变
- **AND** localStorage.copygen_theme 设为 brand

#### Scenario: 偏好持久化
- **WHEN** 用户刷新页面
- **THEN** 主题按 localStorage 偏好加载

#### Scenario: /new 路由兼容
- **WHEN** 访问 /new
- **THEN** 设偏好为 brand 并 replaceState 到 /
- **AND** 渲染新版

### Requirement: 切主题不丢状态

页面状态（state）SHALL 存在 logic hook 中而非 View 中，切换主题时 View 组件树更换但 logic state 保留。

#### Scenario: 生成中途切主题
- **WHEN** 生成页有候选文案时切换主题
- **THEN** 候选文案、审核结果、编辑内容全部保留
- **AND** 输入区状态（模型、维度选择、补充输入）保留

## MODIFIED Requirements

### Requirement: 生成页组件从 App.tsx 迁出到独立文件，状态就地化

生成页 SHALL 拆为 `logic/useGenerateLogic` hook + 主题 View。状态存在 logic hook 中，切主题不丢。复用现有 API + localStorage key，行为不变。

#### Scenario: 经典版生成页行为不变
- **WHEN** 经典版运行生成/审核/定稿/重审流程
- **THEN** 与重构前完全一致

#### Scenario: 新版生成页行为不变
- **WHEN** 新版运行生成/审核/定稿/重审流程
- **THEN** 与重构前完全一致
