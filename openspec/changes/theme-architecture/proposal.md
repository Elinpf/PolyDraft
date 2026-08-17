## Why

当前前端有两套并行 UI：经典版（`pages/*.tsx`）和新版（`brand/`），生成页逻辑在两处几乎完全重复（`pages/generate.tsx` 和 `brand/GeneratePage.tsx` 同一份 state + fetch + SSE + 操作，只 JSX/className 不同）。Q3 已确认"后面还可能有其他风格版本"——若每加一套样式就复制一份逻辑，重复将 N 倍膨胀，且任何逻辑改动要改 N 处。

本期把"页面逻辑"与"视图渲染"分离：逻辑抽到 `logic/` hooks，视图按主题组织到 `views/<theme>/`。新增主题只加 `views/<theme>/`，逻辑与页面入口零改动。主题切换从"按路由"改为"按偏好（localStorage）"，顶部按钮切换、记住偏好。

## What Changes

- **逻辑层 `logic/`**：每个页面抽 `useXxxLogic` hook（纯 state + fetch + 操作，无 JSX 无 className）。返回一个 logic 对象。
- **视图层 `views/<theme>/`**：每主题每页面一个 View 组件，接收 logic 对象整体作为 props，只负责 JSX + className。经典版 View 从 `pages/` 现有渲染提取；新版 View 从 `brand/` 现有渲染提取。
- **主题上下文 `theme.tsx`**：ThemeContext + useTheme，按 localStorage 偏好（`copygen_theme`，值 `classic` | `brand`）决定渲染哪主题的 View。顶部按钮切换写 localStorage。
- **页面入口 `pages/*.tsx`**：改为 `const logic = useXxxLogic(); const View = useThemeView('generate'); return <View {...logic} />`，不含渲染细节。
- **路由 `/new` 弃用**：主题切换不再走路由，`/new` 仍兼容（重定向到 `/` 并切 brand 主题）或直接弃用。
- **生成页先行**：本 change 先迁移生成页验证架构（logic + 两套 View + 主题切换），跑通后再铺其余 6 页（可拆后续 change 或本 change 内增量）。

## Capabilities

### New Capabilities
- `theme-system`: 主题（视觉风格）切换机制——偏好持久化 + 逻辑视图分离架构，支持多套样式并存。

### Modified Capabilities
- `generation-ui`: 生成页拆为 logic hook + 主题 View，行为不变。
- `project-skeleton`: 新增 logic/ + views/ + theme 上下文目录结构。

## Impact

- 新增 `frontend/src/logic/useGenerateLogic.ts`
- 新增 `frontend/src/views/classic/GenerateView.tsx` + `frontend/src/views/brand/GenerateView.tsx`
- 新增 `frontend/src/theme.tsx`（ThemeContext + useTheme + useThemeView）
- 改 `frontend/src/pages/generate.tsx` 为入口（logic + View 组合）
- 删 `frontend/src/brand/GeneratePage.tsx`（逻辑并入 logic/，渲染并入 views/brand/）
- 经典版 `App.tsx` 顶部加主题切换按钮
- `/new` 路由兼容处理
- 行为零变化：生成、审核、定稿、维度、localStorage 全部不变
- 为后续 6 页迁移 + 第三套主题铺路
