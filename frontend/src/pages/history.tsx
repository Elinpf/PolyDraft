import { useState, useEffect } from 'react'
import type { FinalizedItem, SharedState } from '../types'
import { copyText } from '../clipboard'

// ============ 历史页 ============

export function HistoryPage({ s }: { s: SharedState }) {
  const [items, setItems] = useState<FinalizedItem[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [copiedId, setCopiedId] = useState<number | null>(null)

  async function load() { setItems(await (await fetch('/finalized')).json()) }
  useEffect(() => { load() }, [])
  // 定稿后刷新（页面常驻挂载，切回可见最新）
  useEffect(() => { if (s.finalizeTick > 0) load() }, [s.finalizeTick])

  async function del(id: number) {
    if (!confirm('确定删除这条定稿？')) return
    await fetch(`/finalized/${id}`, { method: 'DELETE' }); load()
  }
  function copy(id: number, text: string) {
    copyText(text).then((ok) => {
      if (ok) { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) }
    })
  }

  function fmtTs(ts: string) {
    try { return new Date(ts).toLocaleString('zh-CN') } catch { return ts }
  }
  function fmtInputs(s: string) {
    try { return Object.entries(JSON.parse(s)).map(([k, v]) => `${k}: ${v}`).join(' · ') } catch { return s }
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">📚</div><h2>定稿历史</h2><span className="tag">{items.length} 条</span></div>
        {items.length === 0 && <div className="empty-state"><p>暂无定稿。生成文案并定稿后将出现在这里。</p></div>}
        {items.map((it) => (
          <div className="list-item" key={it.id}>
            <div className="item-head">
              <span className="item-name">📄 定稿 #{it.id}</span>
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => del(it.id)}>🗑️</button>
            </div>
            <div className="item-meta">📅 {fmtTs(it.ts)} · 🤖 {it.provider} · 📝 候选 {it.selected_idx}{it.score != null ? ` · 打分 ${it.score}` : ''}</div>
            <div className="item-meta">输入：{fmtInputs(it.input_vars)}</div>
            <div className="copy-preview" style={{ marginTop: 8, maxHeight: expanded[it.id] ? 'none' : 100, overflow: 'hidden' }}>{it.text}</div>
            <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => copy(it.id, it.text)}>{copiedId === it.id ? '✓ 已复制' : '📋 复制'}</button>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setExpanded({ ...expanded, [it.id]: !expanded[it.id] })}>{expanded[it.id] ? '收起' : '展开全文'}</button>
            </div>
            {(it.score != null || it.positive || it.reverse || it.accuracy || it.review) && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12, color: 'var(--gold-dark)', cursor: 'pointer' }}>🔎 审核结果</summary>
                <div className="review-box" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.8 }}>
                  {it.score != null && <div><strong style={{ color: 'var(--gold-dark)' }}>综合打分：</strong>{it.score}</div>}
                  {it.positive && <div><strong style={{ color: 'var(--gold-dark)' }}>正向亲和：</strong>{it.positive}</div>}
                  {it.reverse && <div><strong style={{ color: 'var(--gold-dark)' }}>反向亲和：</strong>{it.reverse}</div>}
                  {it.accuracy && <div><strong style={{ color: 'var(--gold-dark)' }}>产品知识准确性：</strong>{it.accuracy}</div>}
                  {it.review && !it.positive && !it.reverse && !it.accuracy && <div>{it.review}</div>}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

