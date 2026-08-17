import { useState, useEffect } from 'react'
import type { Slot } from '../types'

// ============ 文案风格管理页 ============

type SaveState = 'saving' | 'done' | 'error'

export function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [reviewBody, setReviewBody] = useState('')
  const [systemBody, setSystemBody] = useState('')
  const [sysState, setSysState] = useState<SaveState | null>(null)
  const [revState, setRevState] = useState<SaveState | null>(null)
  const [slotState, setSlotState] = useState<Record<number, SaveState>>({})

  async function load() {
    const [s, r, sy] = await Promise.all([fetch('/slots'), fetch('/prompts/review'), fetch('/prompts/system')])
    setSlots(await s.json())
    setReviewBody((await r.json()).body)
    setSystemBody((await sy.json()).body)
  }
  useEffect(() => { load() }, [])

  function flash(setter: (s: SaveState | null) => void, ok: boolean) {
    setter(ok ? 'done' : 'error')
    setTimeout(() => setter(null), ok ? 1500 : 2000)
  }
  function flashSlot(slot: number, ok: boolean) {
    setSlotState((s) => ({ ...s, [slot]: ok ? 'done' : 'error' }))
    setTimeout(() => setSlotState((s) => { const n = { ...s }; delete n[slot]; return n }), ok ? 1500 : 2000)
  }

  async function saveSlot(sl: Slot) {
    setSlotState((s) => ({ ...s, [sl.slot]: 'saving' }))
    try {
      const r = await fetch('/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sl) })
      flashSlot(sl.slot, r.ok)
    } catch { flashSlot(sl.slot, false) }
  }
  async function delSlot(slot: number) { await fetch(`/slots/${slot}`, { method: 'DELETE' }); load() }
  async function saveReview() {
    setRevState('saving')
    try {
      const r = await fetch('/prompts/review?body=' + encodeURIComponent(reviewBody), { method: 'POST' })
      flash(setRevState, r.ok)
    } catch { flash(setRevState, false) }
  }
  async function saveSystem() {
    setSysState('saving')
    try {
      const r = await fetch('/prompts/system?body=' + encodeURIComponent(systemBody), { method: 'POST' })
      flash(setSysState, r.ok)
    } catch { flash(setSysState, false) }
  }

  const sysLabel = sysState === 'saving' ? '保存中…' : sysState === 'done' ? '✓ 已保存' : sysState === 'error' ? '保存失败' : '💾 保存'
  const revLabel = revState === 'saving' ? '保存中…' : revState === 'done' ? '✓ 已保存' : revState === 'error' ? '保存失败' : '💾 保存'
  const slotLabel = (slot: number) => {
    const st = slotState[slot]
    return st === 'saving' ? '保存中…' : st === 'done' ? '✓ 已保存' : st === 'error' ? '保存失败' : '💾 保存'
  }
  const cls = (st: SaveState | null | undefined) => st === 'done' ? 'btn-success' : st === 'error' ? 'btn-danger' : 'btn-primary'

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🧠</div><h2>写作设定</h2><span className="tag">设定</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>所有内容的起点。放稳定的背景：身份、品牌调性等。每次生成都带。可用 {'{var}'} 引用变量（如 {'{品牌}'}、{'{产品知识}'}）。</p>
        <div className="form-group"><textarea style={{ minHeight: 140 }} value={systemBody} onChange={(e) => setSystemBody(e.target.value)} /></div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className={'btn ' + cls(sysState)} onClick={saveSystem} disabled={sysState === 'saving'}>{sysLabel}</button></div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">🎨</div><h2>文案风格管理</h2><span className="tag">风格</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>每个风格 = 一种写法，独立提示词。并行时各跑一份，一次产出多份候选文案。</p>
        {slots.map((sl, i) => {
          const st = slotState[sl.slot]
          return (
            <div className="list-item" key={i}>
              <div className="item-head"><span className="item-name">🎨 {sl.name || `风格 ${sl.slot}`}</span></div>
              <div className="form-row"><div className="form-group" style={{ flex: 1 }}><label>风格名</label><input value={sl.name ?? ''} placeholder="如 官方版 / 亲切版 / 闺蜜版" onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, name: e.target.value }; setSlots(ns) }} /></div></div>
              <div className="form-group"><label>提示词</label><textarea style={{ minHeight: 100 }} value={sl.body} onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, body: e.target.value }; setSlots(ns) }} /></div>
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button className={'btn ' + cls(st)} onClick={() => saveSlot(slots[i])} disabled={st === 'saving'}>{slotLabel(sl.slot)}</button>
                <button className="btn btn-danger" onClick={() => delSlot(sl.slot)}>🗑️ 删除</button>
              </div>
            </div>
          )
        })}
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-success" onClick={() => setSlots([...slots, { slot: Math.max(-1, ...slots.map((s) => s.slot)) + 1, name: '', body: '', temperature: 1 }])}>+ 新增风格</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">🔎</div><h2>审核意见设定</h2><span className="tag">审核</span></div>
        <div className="form-group"><textarea style={{ minHeight: 120 }} value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} /></div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className={'btn ' + cls(revState)} onClick={saveReview} disabled={revState === 'saving'}>{revLabel}</button></div>
      </div>
    </div>
  )
}

