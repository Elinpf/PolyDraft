import { useState, useEffect } from 'react'
import type { Slot } from '../types'

// ============ 文案风格管理页 ============

export function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [reviewBody, setReviewBody] = useState('')
  const [systemBody, setSystemBody] = useState('')

  async function load() {
    const [s, r, sy] = await Promise.all([fetch('/slots'), fetch('/prompts/review'), fetch('/prompts/system')])
    setSlots(await s.json())
    setReviewBody((await r.json()).body)
    setSystemBody((await sy.json()).body)
  }
  useEffect(() => { load() }, [])

  async function saveSlot(sl: Slot) {
    await fetch('/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sl) })
    alert('已保存')
  }
  async function delSlot(slot: number) { await fetch(`/slots/${slot}`, { method: 'DELETE' }); load() }
  async function saveReview() {
    await fetch('/prompts/review?body=' + encodeURIComponent(reviewBody), { method: 'POST' }); alert('已保存')
  }
  async function saveSystem() {
    await fetch('/prompts/system?body=' + encodeURIComponent(systemBody), { method: 'POST' }); alert('已保存')
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🧠</div><h2>写作设定</h2><span className="tag">设定</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>所有内容的起点。放稳定的背景：身份、品牌调性等。每次生成都带。可用 {'{var}'} 引用变量（如 {'{品牌}'}、{'{产品知识}'}）。</p>
        <div className="form-group"><textarea style={{ minHeight: 140 }} value={systemBody} onChange={(e) => setSystemBody(e.target.value)} /></div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-primary" onClick={saveSystem}>💾 保存</button></div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">🎨</div><h2>文案风格管理</h2><span className="tag">风格</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>每个风格 = 一种写法，独立提示词。并行时各跑一份，一次产出多份候选文案。</p>
        {slots.map((sl, i) => {
          return (
            <div className="list-item" key={i}>
              <div className="item-head"><span className="item-name">🎨 {sl.name || `风格 ${sl.slot}`}</span></div>
              <div className="form-row"><div className="form-group" style={{ flex: 1 }}><label>风格名</label><input value={sl.name ?? ''} placeholder="如 官方版 / 亲切版 / 闺蜜版" onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, name: e.target.value }; setSlots(ns) }} /></div></div>
              <div className="form-group"><label>提示词</label><textarea style={{ minHeight: 100 }} value={sl.body} onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, body: e.target.value }; setSlots(ns) }} /></div>
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={() => saveSlot(slots[i])}>💾 保存</button>
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
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-primary" onClick={saveReview}>💾 保存</button></div>
      </div>
    </div>
  )
}

