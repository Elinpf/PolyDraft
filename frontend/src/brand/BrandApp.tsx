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
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="brand-main">
        {children}
        <footer className="brand-footer">© {new Date().getFullYear()} PolyDraft · 基于 AGPL-3.0 开源</footer>
      </main>
    </div>
  )
}
