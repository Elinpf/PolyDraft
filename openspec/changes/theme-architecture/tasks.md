## 1. 逻辑层

- [x] 1.1 新建 `frontend/src/logic/useGenerateLogic.ts`，从 `pages/generate.tsx` 提取全部 state + fetch + SSE + 操作（generate/doFinalize/reReviewOne/changeInput/patchCand/loadDims），返回 logic 对象
- [x] 1.2 导出 `export type GenerateLogic = ReturnType<typeof useGenerateLogic>`
- [x] 1.3 logic 中无 JSX、无 className、无 CSS import

## 2. 视图层

- [x] 2.1 新建 `frontend/src/views/classic/GenerateView.tsx`，从 `pages/generate.tsx` 提取 JSX 渲染，接收 `props: { logic: GenerateLogic }`，解构使用，无逻辑
- [x] 2.2 新建 `frontend/src/views/brand/GenerateView.tsx`，从 `brand/GeneratePage.tsx` 提取 JSX 渲染，接收 `props: { logic: GenerateLogic }`，解构使用，无逻辑
- [x] 2.3 两套 View 的 className 各自对应经典版 App.css / 新版 brand-ui.css，不变

## 3. 主题机制

- [x] 3.1 新建 `frontend/src/theme.tsx`：ThemeContext（值 `classic` | `brand`）+ ThemeProvider（读 localStorage `copygen_theme` 初始化）+ useTheme（返回 theme + setTheme）
- [x] 3.2 主题 View 注册表：`THEMES = { classic: { generate: ClassicGenerateView }, brand: { generate: BrandGenerateView } }`，`useThemeView('generate')` 取当前主题对应 View
- [x] 3.3 /new 兼容：ThemeProvider 初始化前若 pathname.startsWith('/new')，设 localStorage=brand 并 history.replaceState 到 /

## 4. 页面入口与 App

- [x] 4.1 改 `frontend/src/pages/generate.tsx` 为入口：`const logic = useGenerateLogic(s); const View = useThemeView('generate'); return <View logic={logic} />`
- [x] 4.2 `App.tsx`：包 ThemeProvider，经典版顶栏加"切换新版"按钮（调 setTheme('brand')）
- [x] 4.3 新版 BrandApp 侧栏"返回经典版"改为调 setTheme('classic') 而非 href
- [x] 4.4 删 `/new` 路由分支（isBrand 判断），统一走主题机制

## 5. 清理

- [x] 5.1 删 `frontend/src/brand/GeneratePage.tsx`（逻辑入 logic/，渲染入 views/brand/）
- [x] 5.2 保留 `brand/BrandApp.tsx`（新版侧栏布局壳），主区渲染由 App 传入的 children
- [x] 5.3 确认无残留引用 `brand/GeneratePage`

## 6. 验证

- [x] 6.1 tsc --noEmit 通过
- [x] 6.2 后端 + 前端可达，API 数据正常（dims 4 / providers 2 / finalized 7）
- [ ] 6.3 经典版生成页 e2e：生成/审核/定稿/重审/维度/补充输入全跑通（待浏览器人工验证）
- [ ] 6.4 新版生成页 e2e：同上，玻璃卡 + 莫兰迪棕侧栏样式正常（待浏览器人工验证）
- [ ] 6.5 切主题不丢状态：生成页有候选时切换主题，候选/审核/编辑/输入全部保留（待浏览器人工验证）
- [ ] 6.6 偏好持久化：刷新页面主题保持（待浏览器人工验证）
- [ ] 6.7 /new 兼容：访问 /new 跳 / 且用 brand 主题（待浏览器人工验证）
