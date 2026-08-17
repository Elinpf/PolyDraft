import { createContext, useContext, useEffect, useState, type ComponentType } from 'react'
import { ClassicGenerateView } from './views/classic/GenerateView'
import { BrandGenerateView } from './views/brand/GenerateView'

// ============ 主题机制 ============
// 按偏好（localStorage copygen_theme）切换主题，URL 不变。
// 状态在 logic hook 中，切主题时 View 组件树更换但 state 保留。
// /new 路由兼容：访问 /new 时设偏好 brand 并 replaceState 到 /。

export type Theme = 'classic' | 'brand'
const STORAGE_KEY = 'copygen_theme'

type ViewProps = { logic: any }
type ViewComponent = ComponentType<ViewProps>

// 主题 View 注册表：每主题每页面一个 View 组件。
// 已迁移的页面注册在此；未迁移的页面返回 null（由 pages 入口 fallback 到经典版旧组件）。
const THEMES: Record<Theme, Partial<Record<string, ViewComponent>>> = {
  classic: {
    generate: ClassicGenerateView,
  },
  brand: {
    generate: BrandGenerateView,
  },
}

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
}
const ThemeContext = createContext<ThemeCtx>({ theme: 'classic', setTheme: () => {} })

// /new 兼容：启动时若在 /new，设偏好 brand 并跳 /（仅执行一次）
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
      if (v === 'brand' || v === 'classic') return v
    } catch { /* ignore */ }
    return 'classic'
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
  return THEMES[theme]?.[page] ?? null
}
