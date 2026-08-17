import { useState, useEffect } from 'react'
import './App.css'
import type { SharedState } from './types'
import { NAV_ITEMS } from './nav'
import { GeneratePage } from './pages/generate'
import { ConfigPage } from './pages/config'
import { SlotsPage } from './pages/slots'
import { OptionsPage } from './pages/options'
import { KnowledgePage } from './pages/knowledge'
import { HistoryPage } from './pages/history'
import { DocsPage } from './pages/docs'
import { BrandApp } from './brand/BrandApp'
import { ThemeProvider, useTheme } from './theme'
import './brand-ui.css'

// ============ 后端健康检查 ============
// 启动 + 每 15s 探一次 /health，失败显示顶部横条提示。经典版/新版都覆盖。
// 页面隐藏时暂停轮询，可见时立即复查，省后台流量。

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
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!id) { check(); id = setInterval(check, 15000) } }
    const stop = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => { document.hidden ? stop() : start() }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return down
}

function BackendDownBanner() {
  return (
    <div className="backend-down-banner">
      ⚠️ 后端服务未响应，数据无法加载。请检查后端是否启动（端口 8099）。
    </div>
  )
}

// ============ App ============

function AppInner() {
  useTheme()   // 主题机制保留（仅 brand），未来可再接新主题
  const backendDown = useBackendHealth()
  const [page, setPage] = useState<typeof NAV_ITEMS[number]['key'] | 'docs'>('generate')
  // 仅跨页刷新信号——单消费者状态已就地进各页面
  const [finalizeTick, setFinalizeTick] = useState(0)
  const [dimsTick, setDimsTick] = useState(0)

  const shared: SharedState = {
    finalizeTick, bumpFinalizeTick: () => setFinalizeTick((n) => n + 1),
    dimsTick, bumpDimsTick: () => setDimsTick((n) => n + 1),
  }

  // 页面内容（统一入口；生成页已走主题 View，其余页面暂用各自组件）
  const pageContent = (
    <>
      <div style={{ display: page === 'generate' ? 'block' : 'none' }}><GeneratePage s={shared} /></div>
      <div style={{ display: page === 'config' ? 'block' : 'none' }}><ConfigPage /></div>
      <div style={{ display: page === 'slots' ? 'block' : 'none' }}><SlotsPage /></div>
      <div style={{ display: page === 'options' ? 'block' : 'none' }}><OptionsPage s={shared} /></div>
      <div style={{ display: page === 'knowledge' ? 'block' : 'none' }}><KnowledgePage /></div>
      <div style={{ display: page === 'history' ? 'block' : 'none' }}><HistoryPage s={shared} /></div>
      <div style={{ display: page === 'docs' ? 'block' : 'none' }}><DocsPage /></div>
    </>
  )

  return (
    <>
      {backendDown && <BackendDownBanner />}
      <BrandApp page={page} setPage={setPage}>
        {pageContent}
      </BrandApp>
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

export default App
