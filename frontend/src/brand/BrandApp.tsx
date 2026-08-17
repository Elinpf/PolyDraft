import { useState } from 'react'
import type { Page, SharedState } from '../types'
import { BrandGeneratePage } from './GeneratePage'

// ============ 干净清新高级感 · App 壳 ============
// /new 路由下挂载。左侧常驻文字侧栏 + 主区单栏线性内容流。
// 复用 App 传来的 SharedState。仅生成页做了新版设计，其余页面待迁移。

export function BrandApp({ s }: { s: SharedState }) {
  const [page, setPage] = useState<Page>('generate')

  const navItems: { key: Page; label: string; icon: string }[] = [
    { key: 'generate', label: '生成', icon: '✎' },
    { key: 'slots', label: '文案风格', icon: '◈' },
    { key: 'options', label: '选项配置', icon: '▤' },
    { key: 'knowledge', label: '产品知识', icon: '◇' },
    { key: 'history', label: '历史', icon: '⌛' },
    { key: 'config', label: '模型配置', icon: '◯' },
  ]

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
          {navItems.map((n) => (
            <button key={n.key} className={'brand-nav-btn' + (page === n.key ? ' active' : '')}
              onClick={() => setPage(n.key)}>
              <span className="bn-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <a className="brand-back-link" href="/">← 返回经典版</a>
      </aside>

      <main className="brand-main">
        {page === 'generate' && <BrandGeneratePage s={s} />}
        {page !== 'generate' && (
          <div className="brand-container">
            <div className="brand-empty">
              <p>「{navItems.find((n) => n.key === page)?.label}」尚未迁移至新版</p>
              <p style={{ marginTop: 8, fontSize: 12 }}>请在左侧切换至「生成」，或返回经典版使用该功能。</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
