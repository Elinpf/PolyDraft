## Context

当前两套 UI（经典 `pages/` + 新版 `brand/`）的生成页逻辑重复（state/fetch/SSE/操作全一样，只渲染不同）。Q3 确认未来还有第三套样式——必须抽公共逻辑，否则重复 N 倍膨胀。

决策已定：
- 主题切换：按偏好（localStorage `copygen_theme`），不分路由
- 重构策略：先生成页验证架构
- View 接口：logic 对象整体传（`<View {...logic} />`）

## Goals / Non-Goals

**Goals:**
- 逻辑与视图分离：`logic/`（纯 hooks）+ `views/<theme>/`（纯渲染）
- 主题按偏好切换：顶部按钮 + localStorage 持久化
- 生成页先迁移验证架构，跑通后铺 6 页
- 行为零变化

**Non-Goals:**
- 本 change 只做生成页迁移，其余 6 页后续（拆 change 或本 change 增量，先跑通生成页再定）
- 不实现第三套主题（架构支持即可，本期不新建）
- 不抽跨页面的公共业务逻辑（每页面独立 hook，无更高层抽象）
- 不改后端 API

## Decisions

### 决策 1：目录结构

```
frontend/src/
├── logic/
│   └── useGenerateLogic.ts      # 生成页 state + fetch + SSE + 操作，返回对象
├── views/
│   ├── classic/
│   │   └── GenerateView.tsx     # 经典版渲染（从 pages/generate.tsx JSX 提取）
│   └── brand/
│       └── GenerateView.tsx     # 新版渲染（从 brand/GeneratePage.tsx JSX 提取）
├── theme.tsx                    # ThemeContext + useTheme + 主题 View 注册表
└── pages/
    └── generate.tsx             # 入口：logic + 主题 View 组合
```

**为何 logic 放 `logic/` 不放 `pages/`**：logic 是跨主题共享的，独立目录强调"与视图无关"。pages/ 只做组合入口。

**为何 View 放 `views/<theme>/` 不放 `<theme>/`**：`views/` 前缀明确"这是视图层"，与 `logic/`（逻辑层）对称，新人一眼懂分层。

### 决策 2：logic 对象接口

```typescript
// logic/useGenerateLogic.ts
export function useGenerateLogic(s: SharedState) {
  // 所有 state + 操作
  const [candidates, setCandidates] = useState(...)
  // ... fetch, generate, doFinalize, reReviewOne, changeInput ...
  return {
    // state
    candidates, status, loading, error, stage, failureDetail,
    genProvider, setGenProvider, extraInputs, setExtraInputs,
    dimensions, selections, setSelections, selectedDims, setSelectedDims,
    // 派生
    steps, scoreColor,
    // 操作
    generate, doFinalize, reReviewOne, changeInput, patchCand,
  }
}
export type GenerateLogic = ReturnType<typeof useGenerateLogic>
```

View 接收 `props: { logic: GenerateLogic }`，整体传。`ReturnType<typeof>` 自动同步，加字段不用手维护类型。

**为何不拆细 props**：generate 页字段 20+，拆 props 列表长且易漏；整体传 + ReturnType 类型自动跟随，最稳。

### 决策 3：主题切换机制

`theme.tsx`：
```typescript
const THEMES = {
  classic: { generate: ClassicGenerateView, ... },
  brand: { generate: BrandGenerateView, ... },
}
const ThemeContext = createContext<'classic' | 'brand'>('classic')
function useThemeView(page: 'generate') {
  const theme = useContext(ThemeContext)
  return THEMES[theme][page]
}
```

- 偏好存 `localStorage.copygen_theme`（`classic` | `brand`）
- `ThemeProvider` 在 App 顶层，读 localStorage 初始化，提供 setter
- 顶部按钮调 setter 切换 + 写 localStorage
- **无路由**：URL 不变，切换即重渲染换 View

**为何不用路由**：Q2 选了偏好方案。路由方案 URL 会变、刷新才生效；偏好方案切换即生效、记住偏好，体验更顺。`/new` 兼容：访问 `/new` 时 ThemeProvider 初始化前把 localStorage 设为 brand 并跳 `/`。

### 决策 4：/new 路由兼容

`/new` 仍可访问：App 启动时若 `pathname.startsWith('/new')`，设 `copygen_theme=brand` 并 `history.replaceState` 到 `/`。之后全走偏好机制。这样旧链接不失效，但主题切换不再依赖路由。

### 决策 5：经典版顶部切换按钮

经典版 `App.tsx` 顶栏加"切换新版"按钮，调 `setTheme('brand')`。新版 `BrandApp` 侧栏底部已有"返回经典版"，改为调 `setTheme('classic')` 而非 `<a href="/">`。

## Risks / Trade-offs

- **[logic 对象过大]** 20+ 字段一个对象传，props 链路粗。→ ReturnType 类型自动跟随，View 解构用；可接受，比拆 props 稳。
- **[两套 View 漂移]** 经典版 View 久不维护可能坏。→ 行为一致是 spec 要求，验证时两套都跑 e2e。
- **[主题切换重渲染]** 切主题会换 View 组件树，生成页 SSE reader 状态在 logic hook 里（不在 View），切主题不丢。→ 这是把 state 放 logic 的核心收益，验证时要测"生成中途切主题不丢状态"。
- **[重构范围蔓延]** 只做生成页，但目录结构要一次建好。→ tasks 明确只迁生成页，6 页后续。

## Migration Plan

1. 建 `logic/useGenerateLogic.ts`（从 `pages/generate.tsx` 提取逻辑，返回对象）
2. 建 `views/classic/GenerateView.tsx`（从 `pages/generate.tsx` 提取 JSX，接 logic 对象）
3. 建 `views/brand/GenerateView.tsx`（从 `brand/GeneratePage.tsx` 提取 JSX，接 logic 对象）
4. 建 `theme.tsx`（Context + 注册表 + /new 兼容）
5. 改 `pages/generate.tsx` 为入口（logic + View 组合）
6. 改 `App.tsx`：包 ThemeProvider + 顶部切换按钮 + 删 /new 路由分支（改走主题）
7. 删 `brand/GeneratePage.tsx`（已拆入 views/）
8. 验证：经典版 + 新版生成页 e2e 全流程，切主题不丢状态

回滚：单 commit，git revert。

## Open Questions

- 其余 6 页迁移：本 change 增量做，还是拆后续 change？→ 先跑通生成页再定，倾向拆后续 change（每页一个，原子可归档）。
