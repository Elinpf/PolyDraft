import { type ReactNode } from 'react'
import type { Page } from '../types'
import { NAV_ITEMS } from '../nav'

// ============ 品牌高级感 · App 壳 ============
// 左侧常驻文字侧栏 + 主区单栏线性内容流。
// page 状态由 App 持有（与主区内容一致），侧栏导航调 App 的 setPage。
// 主区内容由 App 传入（children）——统一走 pages/* 入口 + 主题 View。

export function BrandApp({ page, setPage, children }: {
  page: Page
  setPage: (p: Page) => void
  children: ReactNode
}) {
  // 侧栏图标字形映射
  const brandIcon: Record<string, string> = {
    generate: '✎', slots: '◈', options: '▤',
    knowledge: '◇', history: '⌛', config: '◯',
  }

  return (
    <div className="brand-app">
      <aside className="brand-sidebar">
        <div className="brand-mark">
          <div className="brand-logo">◈</div>
          <div>
            <div className="brand-name">PolyDraft</div>
            <div className="brand-sub">COPY STUDIO</div>
          </div>
        </div>
        <nav className="brand-nav">
          {NAV_ITEMS.map((n) => (
            <button key={n.key} className={'brand-nav-btn' + (page === n.key ? ' active' : '')}
              onClick={() => setPage(n.key)}>
              <span className="bn-icon">{brandIcon[n.key]}</span>
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="brand-main">
        {children}
      </main>
    </div>
  )
}
