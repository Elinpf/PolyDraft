import { createContext, useContext, useState, type ComponentType } from 'react'
import { BrandGenerateView } from './views/brand/GenerateView'

// ============ 主题机制 ============
// 按偏好（localStorage copygen_theme）切换主题，URL 不变。
// 状态在 logic hook 中，切主题时 View 组件树更换但 state 保留。
// 经典版已下线（见 classic-theme-backup 分支），当前仅 brand 主题；
// 机制保留以便未来再接新主题，localStorage 旧值 'classic' 一律回落 brand。
// /new 路由兼容：访问 /new 时确认 brand 偏好并 replaceState 到 /。

export type Theme = 'classic' | 'brand'
const STORAGE_KEY = 'copygen_theme'

type ViewProps = { logic: any }
type ViewComponent = ComponentType<ViewProps>

// 主题 View 注册表：每主题每页面一个 View 组件。
// 已迁移的页面注册在此；未迁移的页面返回 null（由 pages 入口 fallback 到经典版旧组件）。
const THEMES: Record<Theme, Partial<Record<string, ViewComponent>>> = {
  classic: {},   // 经典版已下线，无注册视图
  brand: {
    generate: BrandGenerateView,
  },
}

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
}
const ThemeContext = createContext<ThemeCtx>({ theme: 'brand', setTheme: () => {} })

// /new 兼容：启动时若在 /new，确认偏好 brand 并跳 /（仅执行一次）
function consumeNewRoute() {
  if (typeof window === 'undefined') return
  if (window.location.pathname.startsWith('/new')) {
    try { localStorage.setItem(STORAGE_KEY, 'brand') } catch { /* ignore */ }
    window.history.replaceState(null, '', '/')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    consumeNewRoute()
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'brand') return 'brand'
    } catch { /* ignore */ }
    return 'brand'   // 'classic' 旧值也回落 brand
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

// 取当前主题某页面的 View；未注册返回 null（调用方 fallback）
export function useThemeView(page: string): ViewComponent | null {
  const { theme } = useTheme()
  return THEMES[theme]?.[page] ?? THEMES['brand']?.[page] ?? null
}
