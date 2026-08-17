import { useState, useEffect } from 'react'
import './App.css'
import type { Page, SharedState } from './types'
import { GeneratePage } from './pages/generate'
import { ConfigPage } from './pages/config'
import { SlotsPage } from './pages/slots'
import { OptionsPage } from './pages/options'
import { KnowledgePage } from './pages/knowledge'
import { HistoryPage } from './pages/history'
import { DocsPage } from './pages/docs'
import { BrandApp } from './brand/BrandApp'
import './brand-ui.css'

// ============ 后端健康检查 ============
// 启动 + 每 15s 探一次 /health，失败显示顶部横条提示。经典版/新版都覆盖。

function useBackendHealth() {
  const [down, setDown] = useState(false)
  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/health', { cache: 'no-store' })
        if (!alive) return
        setDown(!r.ok)
      } catch {
        if (alive) setDown(true)
      }
    }
    check()
    const id = setInterval(check, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return down
}

function BackendDownBanner() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 999,
      background: 'linear-gradient(90deg, #c62828, #d97070)',
      color: '#fff', textAlign: 'center',
      padding: '8px 16px', fontSize: 13, fontWeight: 600,
      boxShadow: '0 2px 8px rgba(198,40,40,0.3)',
    }}>
      ⚠️ 后端服务未响应，数据无法加载。请检查后端是否启动（端口 8099）。
    </div>
  )
}

// ============ App ============

// /new 路由走品牌高级感探索版（独立样式 + 组件，不影响经典版）
function useIsBrandRoute() {
  const [isBrand] = useState(() => typeof window !== 'undefined' && window.location.pathname.startsWith('/new'))
  return isBrand
}

function App() {
  const isBrand = useIsBrandRoute()
  const backendDown = useBackendHealth()
  const [page, setPage] = useState<Page>('generate')
  // 仅跨页刷新信号——单消费者状态已就地进各页面
  const [finalizeTick, setFinalizeTick] = useState(0)
  const [dimsTick, setDimsTick] = useState(0)

  const shared: SharedState = {
    finalizeTick, bumpFinalizeTick: () => setFinalizeTick((n) => n + 1),
    dimsTick, bumpDimsTick: () => setDimsTick((n) => n + 1),
  }

  if (isBrand) return (
    <>
      {backendDown && <BackendDownBanner />}
      <BrandApp s={shared} />
    </>
  )

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
      {backendDown && <BackendDownBanner />}
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
