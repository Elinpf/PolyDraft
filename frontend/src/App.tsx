import { useState } from 'react'
import './App.css'
import type { Page, SharedState } from './types'
import { GeneratePage } from './pages/generate'
import { ConfigPage } from './pages/config'
import { SlotsPage } from './pages/slots'
import { OptionsPage } from './pages/options'
import { KnowledgePage } from './pages/knowledge'
import { HistoryPage } from './pages/history'
import { DocsPage } from './pages/docs'

// ============ App ============

function App() {
  const [page, setPage] = useState<Page>('generate')
  // 仅跨页刷新信号——单消费者状态已就地进各页面
  const [finalizeTick, setFinalizeTick] = useState(0)
  const [dimsTick, setDimsTick] = useState(0)

  const shared: SharedState = {
    finalizeTick, bumpFinalizeTick: () => setFinalizeTick((n) => n + 1),
    dimsTick, bumpDimsTick: () => setDimsTick((n) => n + 1),
  }

  const navItems: { key: Page; label: string; icon: string }[] = [
    { key: 'generate', label: '生成', icon: '✍️' },
    { key: 'slots', label: '文案风格', icon: '🎨' },
    { key: 'options', label: '选项配置', icon: '🎚️' },
    { key: 'knowledge', label: '产品知识', icon: '📚' },
    { key: 'history', label: '历史', icon: '🗂️' },
    { key: 'config', label: '模型配置', icon: '🔑' },
  ]

  return (
    <div>
      <div className="topbar">
        <h1>🍼 文案生成引擎</h1>
        <div className="row">
          {navItems.map((n) => (
            <button key={n.key} className={'nav-btn' + (page === n.key ? ' active' : '')} onClick={() => setPage(n.key)}>{n.icon} {n.label}</button>
          ))}
          <button className={'nav-btn' + (page === 'docs' ? ' active' : '')} onClick={() => setPage('docs')} title="使用文档">📖 文档</button>
          <span className="badge">多风格 · 并行 · 审核</span>
        </div>
      </div>
      {/* 所有页面常驻挂载，仅隐藏未激活的——保留生成页 SSE reader 与状态，切 tab 不丢 */}
      <div style={{ display: page === 'generate' ? 'block' : 'none' }}><GeneratePage s={shared} /></div>
      <div style={{ display: page === 'config' ? 'block' : 'none' }}><ConfigPage /></div>
      <div style={{ display: page === 'slots' ? 'block' : 'none' }}><SlotsPage /></div>
      <div style={{ display: page === 'options' ? 'block' : 'none' }}><OptionsPage s={shared} /></div>
      <div style={{ display: page === 'knowledge' ? 'block' : 'none' }}><KnowledgePage /></div>
      <div style={{ display: page === 'history' ? 'block' : 'none' }}><HistoryPage s={shared} /></div>
      <div style={{ display: page === 'docs' ? 'block' : 'none' }}><DocsPage /></div>
    </div>
  )
}

export default App
